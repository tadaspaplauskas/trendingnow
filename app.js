var config = require('./config');

var Twitter = require('twitter');
var client = new Twitter(config.twitter);

/*var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var url = config.mongodb.url;

var insertTweet = function(db, tweet, callback) {
   db.collection('tweets').insertOne( {
      "text" : 'labadiena kas cia yra',
      "timestamp" : 123456,
      "lang" : "en",

   }, function(err, result) {
    assert.equal(err, null);
    console.log("Inserted a document into the restaurants collection.");
    callback();
  });
};

MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server.");
  insertTweet(db, function() {
      db.close();
  });
});

//twitter stream

var insertTweet = function(db, tweet, callback) {
   db.collection('tweets').insertOne( {
      "text" : tweet.text,
      "timestamp" : Math.round(tweet.timestamp_ms / 1000),
      "lang" : tweet.lang,

   }, function(err, result) {
    assert.equal(err, null);
    console.log("Inserted a document into the restaurants collection.");
    callback();
  });
};*/

client.stream('statuses/sample', function(stream) {

    var count = 0;

    stream.on('data', function(tweet) {
        if (tweet.text !== undefined)
        {
            count++;
            console.log(count + '. ' + tweet.text);
        }
    });

    stream.on('error', function(error) {
        throw error;
    });
});

//web server
var express = require('express');
var web = express();

web.get('/', function (req, res) {
  res.send('Hello World!');
});

web.listen(80, function () {
  console.log('Example app listening on port 80!');
});