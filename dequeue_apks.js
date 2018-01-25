var gplay = require('gpapi');
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var shell = require('shelljs');
var config = require('config');

var rabbitMQurl = config.get('rabbitMQurl')
var apkTaskQueue = config.get('apkTaskQueueName')
var apkFailureQueue = config.get('apkFailureQueueName')
var filePath = config.get('filePathToStoreAPKs')

process.env.GOOGLE_PASSWORD = "softwarearchitecturegroup"
process.env.ANDROID_ID = "3fddcb51d78c34da"

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
			var body = msg.content.toString();
			console.log(" [x] Received '%s'", body);
			var secs = body.split('.').length - 1;

			var filepath = filePath + body + ".apk"

			var usernames = ['scrawler16.1@gmail.com', 'scrawler16.9@gmail.com', 'scrawler16.8@gmail.com', 'scrawler16.7@gmail.com', 'scrawler16.6@gmail.com', 'scrawler16.2@gmail.com', 'scrawler16.3@gmail.com', 'scrawler16.4@gmail.com']
			var index = Math.floor(Math.random() * usernames.length)

			process.env.GOOGLE_LOGIN = usernames[index]

			console.log('Requesting from:' + process.env.GOOGLE_LOGIN);

			var cmd ="gp-download "+ body +" > "+ filepath

			shell.exec(cmd, function(data) {
				console.log('Downloaded:' + body);
				ch.ack(msg);
			}, function(err) {
				var not_ok = ch.assertQueue(apkFailureQueue, {durable: true});
				ch.sendToQueue(apkFailureQueue, Buffer.from(body), {deliveryMode: true});
				console.log('Failed:' + body);
				setTimeout(function(argument) {
					ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
				}, 1000);
			});
		}
	}); //channel code end
}).catch(console.warn); //end amqp 
