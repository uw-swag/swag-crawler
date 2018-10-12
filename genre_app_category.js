#!/usr/bin/env node

var gplay = require('google-play-scraper');
var MongoClient = require('mongodb').MongoClient;
var amqp = require('amqplib');
var config = require('config')

var mongoDBurl = config.get('mongoDBurl')
var collectionName = config.get('genreCollection')
var rabbitMQurl = config.get('rabbitMQurl')
var genreQueue = config.get('genreQueue')
var failureQueue = config.get('genreFailureQueueName')

MongoClient.connect(mongoDBurl, function(err, db) {
	if(!err) {
		console.log("MongoClient connected");
		var collection = db.collection(collectionName);

		amqp.connect(rabbitMQurl).then(function(conn) {
			process.once('SIGINT', function() { conn.close(); });

			return conn.createChannel().then(function(ch) {
				var ok = ch.assertQueue(genreQueue, {durable: true, maxPriority: 10});
				ok = ok.then(function() { ch.prefetch(1); });
				ok = ok.then(function() {
					ch.consume(genreQueue, doWork, {noAck: false});
					console.log(" [*] Waiting for messages. To exit press CTRL+C");
				});
				return ok;

				function doWork(msg) {
					var body = msg.content.toString();
					console.log(" [x] Received '%s'", body);

					// var doc = JSON.parse(body);

					var delay = Math.floor(Math.random() * ((8-4)+1) + 4); //random number between 4 & 8
					delay = 18
					delay = delay * 1000

					gplay.app({
					  appId: body,
					}).then((data) => {
						var json = JSON.stringify(data);
	        	json = JSON.parse(json);
	        	json.last_crawled_date = new Date();
	        	// console.log(json);

	        	//insert if not available
	        	collection.findOne({ "docid": body}, function(err, result) {
							if(result) {
								acknowledgeToQ(msg, delay, "Already in db");
							}
							else {
								collection.insert(json, function(err, result){
							    if (!err) {
							    	console.log("inserted:" + body);
							    }
							    else {
							    	console.log("failed:" + body);
							    	console.log(err)
							    }

							    acknowledgeToQ(msg, delay, " [x] Done");
								});
							}
						});
					}).catch((err) => {
						var not_ok = ch.assertQueue(failureQueue, {durable: true, maxPriority: 10});
						ch.sendToQueue(failureQueue, Buffer.from(body), {deliveryMode: true, priority: 1});
						console.log(err)
						console.log(" [y] Sent '%s'", body);
						acknowledgeToQ(msg, delay, " [y] Failed");
					}); //end gplay api details
				} //end doWork()

				function acknowledgeToQ(msg, time, log) {
					setTimeout(function() {
						console.log(log);
						ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
					}, time);
				}
			}); //channel code end
		}).catch(console.warn); //end amqp 
	}
}); //end mongo connect
