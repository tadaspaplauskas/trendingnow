#!/usr/bin/env nodejs

var config = require('./config');
var helpers = require('./helpers');

var Twit = require('twit');
var twitter = new Twit(config.twitter);

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

var forbiddenWords = config.forbiddenWords;

var insertTweet = function(tweetsCol, keywords, tweet)
{
    tweetsCol.insertOne( {
        //"keywords" : keywords,
        "keywords_lower" : keywords,
        //"text" : tweet.text,
        "timestamp" : Math.round(tweet.timestamp_ms / 1000)
    });
};

var searchHashtags = function(hashtagsCol, keywords)
{
    var updateObj = {};
    updateObj['hours.' + helpers.getCurrentHour()] = 1;
    updateObj.mentions = 1;

    var hashtag = null;

    for (var i = 0; i < keywords.length; i++)
    {
        hashtag = keywords[i];

        if (hashtag.charAt(0) === '#' && hashtag.length > 2)
        {
            hashtagsCol.updateOne(
            { hashtag: hashtag },
            { $inc: updateObj, $set: { updated_at: new Date() } },
            { upsert: true });
        }
    }
};

/*** connect twittter stream to mongodb ***/

var setupStreamToDB = function(err, db) {
    assert.equal(null, err);
    console.log("Mongodb connected");

    var tweetsCol = db.collection('tweets');
    var hashtagsCol = db.collection('hashtags');

    /*** HOUSE KEEEPING ***/

    //remove records older than 24hours
    var cleaningTweets = setInterval(function(tweetsCol)
    {
        tweetsCol.remove( {
            timestamp: { $lt: helpers.timestamp() - 3600 * 24 }
        }); // keep for 24 hours
    }, 60 * 1000, tweetsCol);

    // every hour reset current hour's counter
    var cleaningHashtagCounters = setInterval(function(hashtagsCol)
    {
        var date = new Date();

        // nullify mentions counter when day starts
        if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0)
        {
            hashtagsCol.update({}, { $set : { mentions: 0 } }, { multi: true} );
        }

        if (date.getMinutes() === 0 && date.getSeconds() === 0)
        {
            var update = {};
            update['hours.' + date.getHours()] = 0;

            hashtagsCol.update({}, { $set : update }, { multi: true} );
        }
    }, 1000, hashtagsCol);

    var cleaningHashtags = setInterval(function(hashtagsCol)
    {
        hashtagsCol.remove( { updated_at: { $lt: new Date(new Date() - 24 * 3600 * 1000) } } );
    }, 60 * 1000, hashtagsCol);

    /*** HOUSE KEEEPING ***/

    var stream = twitter.stream('statuses/sample');

    stream.on('tweet', function(tweet) {
        if (tweet.text !== undefined && tweet.lang === 'en') // only english at least for now
        {
            var keywords = [];

            keywords = helpers.getLowerCaseKeywordsArray(tweet.text);
            keywords = helpers.keepValidKeywords(keywords, forbiddenWords);

            if (keywords.length > 0)
            {
                insertTweet(tweetsCol, keywords, tweet);
                searchHashtags(hashtagsCol, keywords);
            }
            keywords = null;
        }
    });

    stream.on('connect', function(request) {
        console.log(new Date() + ' Trying to connect to twitter');
    });

    stream.on('connected', function(response) {
        console.log(new Date() + ' Connected to twitter!');
    });

    stream.on('error', function(error) {
        console.log(error);
        process.exit(1);
    });
};

MongoClient.connect(config.mongodb.url, setupStreamToDB);