#!/usr/bin/env nodejs

// packages

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

//components
var config = require('./config');
var streamer = require('./components/streamer');
var analysis = require('./components/analysis');
//var mailer = require('./components/mailer');

MongoClient.connect(config.mongodb.url, function(err, db) {
    assert.equal(null, err);
    console.log("Mongodb connected");

    var tweets = db.collection('tweets');
    var hashtags = db.collection('hashtags');
    var trending = db.collection('trending');

    streamer.init({tweets: tweets, hashtags: hashtags, config: config});
    analysis.init({tweets: tweets, hashtags: hashtags, trending: trending, config: config});
    //mailer.init({tweets: tweets, hashtags: hashtags, config: config});
    console.log('Components initialized');
});