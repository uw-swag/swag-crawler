/**
 * Created by lakshmanan on 12/01/18.
 */

var fs = require('fs')
var amqp = require('amqplib')
var config = require('config')
var MongoClient = require('mongodb').MongoClient

/* file reading */

var filepath = config.get('filePathToAppIds')
var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = config.get('taskQueueName')
var mongoDBurl = config.get('mongoDBurl')
var collectionName = config.get('mongoCollectionName')

var contents = fs.readFileSync(filepath, 'utf8');
var ids = contents.split("\n");

MongoClient.connect(mongoDBurl, function(err, db) {
  if(!err) {
    console.log("MongoClient connected");
    var collection = db.collection(collectionName);

    collection.find({}).toArray(function(err, result) {
      if (err) throw err;
      console.log(result.length)
      
      amqp.connect(rabbitMQurl).then(function(conn) {
        return conn.createChannel().then(function(ch) {
          var ok = ch.assertQueue(taskQueue, {durable: true});

          return ok.then(function() {
              result.forEach((doc) => {
                  var msg = doc.docid;
                  if (msg && msg.length) {
                      ch.sendToQueue(taskQueue, Buffer.from(msg), {deliveryMode: true});
                      console.log(" [x] Sent '%s'", msg);
                  }
              });
            return ch.close();
          });
        }).finally(function() { conn.close(); });
      }).catch(console.warn); //end amqp
    }); //end-collection

  } //end-if
}); //end mongo