#!/usr/bin/env node

var gplay = require('gpapi');
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var config = require('config');
var fs = require("fs");

var rabbitMQurl = config.get('rabbitMQurl')
var apkTaskQueue = config.get('apkTaskQueueName')
var apkFailureQueue = config.get('apkFailureQueueName')
var filePath = config.get('filePathToStoreAPKs')

amqp.connect(rabbitMQurl).then(function(conn) {
	process.once('SIGINT', function() { conn.close(); });
	return conn.createChannel().then(function(ch) {
		var ok = ch.assertQueue(apkTaskQueue, {durable: true});
		ok = ok.then(function() { ch.prefetch(1); });
		ok = ok.then(function() {
			ch.consume(apkTaskQueue, doWork, {noAck: false});
			console.log(" [*] Waiting for messages. To exit press CTRL+C");
		});
		return ok;

		function doWork(msg) {
			console.log(msg);
			var doc = JSON.parse(msg.content.toString());
			var body = doc.docid;
			var version = "0";

			if(doc.versionCode != null) version = doc.versionCode;

			console.log(" [x] Received '%s'", body);

			var filepath = filePath + body + "_"+ version +".apk"

			var usernames = config.get('usernames')
			var index = Math.floor(Math.random() * usernames.length)
			var api = gplay.GooglePlayAPI({
				username: usernames[index],
				password: config.get('googlePassword'),
				androidId: config.get('androidID')
				// apiUserAgent: optional API agent override (see below)
				// downloadUserAgent: optional download agent override (see below)
			});

			api.download(body, doc.versionCode).then(function (res) {
				var myFile = fs.createWriteStream(filepath);
				console.log("Starting:"+ body);
				res.pipe(myFile);

				res.on('end', () => {
					console.log("finished:" + body);
					ch.ack(msg);
					myFile.end();
				});

				res.on('error', () => {
					console.log("Error downloading:" + body);
					errHandle(body, doc.versionCode);
					myFile.end();
				});
			}, function (err) {
			  console.error(err.toString());
			  errHandle(body, doc.versionCode);
			});

			function errHandle(body, versionCode) {
				var not_ok = ch.assertQueue(apkFailureQueue, {durable: true});
				var obj = { docid: body, versionCode: versionCode };
				ch.sendToQueue(apkFailureQueue, Buffer.from(obj), {deliveryMode: true});
				console.log('Failed:' + body);
				setTimeout(function(argument) {
					ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
				}, 3000);
			}
		}
	}); //channel code end
}).catch(console.warn); //end amqp 
