var amqp = require('amqplib');
var config = require('config')

var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = 'testPriorityQ'
var failureQueue = 'testFailedQ'


amqp.connect(rabbitMQurl).then(function(conn) {
	process.once('SIGINT', function() { conn.close(); });
	return conn.createChannel().then(function(ch) {
		var ok = ch.assertQueue(taskQueue, {durable: true, maxPriority: 10});

		ok = ok.then(function() { ch.prefetch(1); });
		ok = ok.then(function() {
			ch.consume(taskQueue, doWork, {noAck: false});
			console.log(" [*] Waiting for messages. To exit press CTRL+C");


			// for(i=0; i<100; i++){
			// 	ch.sendToQueue(taskQueue, new Buffer("test"+i), {priority: 1});
			// }

			// for(i=0; i<10; i++){
			// 	ch.sendToQueue(taskQueue, new Buffer("pri"+i), {priority: 10});
			// }
		});
		return ok;

		function doWork(msg) {
			console.log(msg.properties.priority);
			var body = msg.content.toString();
			console.log(" [x] Received '%s'", body);
			
			// var not_ok = ch.assertQueue(failureQueue, {durable: true, maxPriority: 10});
			// ch.sendToQueue(failureQueue, Buffer.from(body), {deliveryMode: true});
			// console.log(err)
			// console.log(" [y] Sent '%s'", body);
			acknowledgeToQ(msg, 2000, "done!");

		} //end doWork()

		function acknowledgeToQ(msg, time, log) {
			setTimeout(function() {
				console.log(log);
				ch.ack(msg); //Acknowledgement sent to the Queue to pick up the next one
			}, time);
		}

	}); //channel code end
}).catch(console.warn); //end amqp