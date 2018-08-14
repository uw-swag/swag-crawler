#!/usr/bin/env node

var MongoClient = require('mongodb').MongoClient;
var gplay = require('gpapi');

var mongoDBurl = "mongodb://application:softwarearchitecturegroup@appcrawler00.watgamer.uwaterloo.ca:27017/SwagCrawler?authMechanism=DEFAULT&authSource=admin"
var collectionName = "app_details"


MongoClient.connect(mongoDBurl, function(err, db) {
	if(!err) {
		console.log("MongoClient connected");
		var collection = db.collection(collectionName);

		var api = gplay.GooglePlayAPI({
			username: "scrawler16.1@gmail.com",
			password: "softwarearchitecturegroup",
			androidId: "3fddcb51d78c34da"
			// apiUserAgent: optional API agent override (see below)
			// downloadUserAgent: optional download agent override (see below)
		});

		var body = "za.co.digitlab.trackbox"

		api.details(body).then((data) => {
			var json = JSON.stringify(data);
    	json = JSON.parse(json);
    	json.last_crawled_date = new Date();

    	let v_code = json.details.appDetails.versionCode

    	console.log(v_code)

    	console.log(Object.prototype.toString.call(v_code))

    	collection.findOne({ "docid": body, "details.appDetails.versionCode" : v_code }, function(err, result) {
				if(result) {
					console.log(result)
					console.log("result in")
				} else console.log("No result, need to insert")
			});

		});		
	} //end-if
	else {
		console.log(err);
	}
}); //end MongoDB conn
