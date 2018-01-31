console.log(process.argv[2]);

var fs = require('fs');
var config = require('config');
var amqp = require('amqplib');

var Q = process.argv[2];
var rabbitMQurl = config.get('rabbitMQurl')

amqp.connect(rabbitMQurl).then(function(conn) {
	process.once('SIGINT', function() { conn.close(); });
	return conn.createChannel().then(function(ch) {
		var ok = ch.assertQueue(Q, {durable: true});
		ok = ok.then(function() { ch.prefetch(1); });
		ok = ok.then(function() {
			ch.consume(Q, doWork, {noAck: false});
			console.log(" [*] Waiting for messages. To exit press CTRL+C");
		});
		return ok;

		function doWork(msg) {
			var body = msg.content.toString();

			var filepath = Q + ".txt"

			var logger = fs.createWriteStream(filepath, {
			  flags: 'a' // 'a' means appending (old data will be preserved)
			});

			console.log(body);

			logger.write(body + "\n");

			logger.end(function() {
				ch.ack(msg);
			});
		}
	}); //channel code end
}).catch(console.warn); //end amqp 