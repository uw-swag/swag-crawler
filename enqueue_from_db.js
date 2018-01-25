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
      // console.log(result.length)

      var uniqueDocIds = [...new Set(result.map(obj => obj.docid))]; //otherwise same docids will be pushed to Queue and produce redundancy (Sets are new object type in javascript)
      // console.log(uniqueDocIds.length);
      
      amqp.connect(rabbitMQurl).then(function(conn) {
        return conn.createChannel().then(function(ch) {
          var ok = ch.assertQueue(taskQueue, {durable: true});

          return ok.then(function() {
            uniqueDocIds.forEach((msg) => {
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

/* Below utility functions might be of use in the future!! don't delete */

// function customIncludes(arrayOfObjects, obj) { //given an array of objects, returns if an object is present
//   var length = arrayOfObjects.filter(function(storedObj) { return storedObj.docid == obj.docid }).length;
//   if(length > 0)
//     return true;
//   return false;
// }


//filtering logic

// var documentForReviewQueue = filterDocuments(result, uniqueDocIds);
// console.log(documentForReviewQueue.length);


// amqp.connect(rabbitMQurl).then(function(conn) {
//   return conn.createChannel().then(function(ch) {
//     var ok = ch.assertQueue(reviewQueue, {durable: true});

//     return ok.then(function() {
//       documentForReviewQueue.forEach((doc) => {
//           reviewCollection.findOne({ docid: doc.docid }, function(err, result) {
//             var newComments = doc.aggregateRating.commentCount.low;
//             if(result != null) {
//               // newComments = difference from oldcomments from db
//             }
//           });
//           var pages = Math.ceil( newComments / 40)
//           for(var i=0; i < pages; i++) {
//             var obj = { docid: doc.docid, page: i, totalComments: doc.aggregateRating.commentCount.low };
//             ch.sendToQueue(reviewQueue, Buffer.from(JSON.stringify(obj)), {deliveryMode: true});
//             console.log(" [a] Sent '%s'", doc.docid);
//           }
//       });
//       return ch.close();
//     });
//   }).finally(function() { conn.close(); });;
// }).catch(console.warn);

// function filterDocuments(result, uniqueDocIds) {
//   return uniqueDocIds.map((docid) => {
//     return result.filter(function(current, i, ar) { 
//       return current.docid == docid;  //filtering documents with same docids
//     }).reduce(function(previous, current) { //getting the latest document (with more reviews)
//       if (previous.aggregateRating.commentCount.low > current.aggregateRating.commentCount.low) { 
//         return previous;
//       } 
//       return current;
//     }); 
//   });
// }