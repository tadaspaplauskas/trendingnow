#!/usr/bin/env nodejs

var config = require('./config');
var helpers = require('./helpers');

var Twitter = require('twitter');
var client = new Twitter(config.twitter);

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

var trackHashtags = function(hashtagsCol, keywords)
{
    var date = new Date();
    var currentHour = date.getHours();

    var updateObj = {};
    updateObj['hours.' + currentHour] = 1;

    var hashtag = null;
    var hashtagsList = [];

    for (var i = 0; i < keywords.length; i++)
    {
        hashtag = keywords[i];

        if (hashtag.charAt(0) === '#')
            hashtagsList.push(hashtag);
    }

    if (hashtagsList.length > 0)
    {
        hashtagsCol.update(
            { hashtag: { $in: hashtagsList } },
            { $inc: updateObj, $set: { updated_at: date } },
            { upsert: true });
    }
};

/*** connect twittter stream to mongodb ***/

var setupStreamToDB = function(err, db) {
    assert.equal(null, err);
    console.log("Streaming to DB");

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
    }
    , 60 * 1000, hashtagsCol);

    /*** HOUSE KEEEPING ***/

    client.stream('statuses/sample', function(stream)
    {
        stream.on('data', function(tweet) {
            if (tweet.text !== undefined)
            {
                var keywords = [];

                keywords = helpers.getLowerCaseKeywordsArray(tweet.text);
                keywords = helpers.keepValidKeywords(keywords, forbiddenWords);

                if (keywords.length > 0)
                {
                    insertTweet(tweetsCol, keywords, tweet);
                    trackHashtags(hashtagsCol, keywords);
                }
                keywords = null;
            }
        });

        stream.on('error', function(error) {
            throw error;
        });
    });
};

MongoClient.connect(config.mongodb.url, setupStreamToDB);