#!/usr/bin/env nodejs

// packages

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

//components
var config = require('./config');
var streamer = require('./components/streamer');
var analysis = require('./components/analysis');
var mailer = require('./components/mailer');

MongoClient.connect(config.mongodb.url, function(err, db) {
    assert.equal(null, err);
    console.log("Mongodb connected");

    var tweets = db.collection('tweets');
    var hashtags = db.collection('hashtags');
    var trending = db.collection('trending');
    var emails = db.collection('emails');
    var subscribers = db.collection('subscribers');

    streamer({tweets: tweets, hashtags: hashtags, config: config});
    analysis({tweets: tweets, hashtags: hashtags, trending: trending, config: config});
    mailer({emails: emails, subscribers:subscribers, trending: trending, config: config});
    console.log('Components initialized in ' + process.env.NODE_ENV + ' mode');
});

process.on('uncaughtException', function (err)
{
    console.error('uncaughtException: ', err.message);
    console.error(err.stack);
    process.exit(1);
});