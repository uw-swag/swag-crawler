/**
 * Created by lakshmanan on 12/01/18.
 */

var amqp = require('amqplib')
var config = require('config')
var MongoClient = require('mongodb').MongoClient

/* file reading */

var rabbitMQurl = config.get('rabbitMQurl')
var taskQueue = config.get('apkTaskQueueName')
var mongoDBurl = config.get('mongoDBurl')
var collectionName = config.get('mongoCollectionName')

console.log("Queing to: " + taskQueue);

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
            	var obj = { docid: doc.docid, versionCode: doc.details.appDetails.versionCode };
                ch.sendToQueue(taskQueue, Buffer.from(JSON.stringify(obj)), {deliveryMode: true});
                console.log(" [x] Sent '%s'", doc.docid);
            });
            return ch.close();
          });
        }).finally(function() { conn.close(); });
      }).catch(console.warn); //end amqp
    }); //end-collection
  } //end-if
}); //end mongo