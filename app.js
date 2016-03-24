#!/usr/bin/env nodejs

var config = require('./config');
var helpers = require('./helpers');

var express = require('express');
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
    },
    function(err, result)
    {
        assert.equal(err, null);
    });
};

var trackHashtags = function(hashtagsCol, keywords)
{
    var currentHour = new Date().getHours();
    var hashtag = '';

    for (var i = 0; i < keywords.length; i++)
    {
        hashtag = keywords[i];

        if (hashtag.charAt(0) === '#')
        {
            var updateObj = {};
            updateObj['hours.' + currentHour] = 1;

            hashtagsCol.updateOne(
                { hashtag: hashtag },
                { $inc: updateObj, $set: { updated_at: new Date() } },
                { upsert: true },
                function(err, result) { assert.equal(err, null); });
        }
    }
};

/*** connect twittter stream to mongodb ***/

var setupStreamToDB = function(err, db) {


    setupWeb(tweetsCol); //start web server
};

/*** search happens here ***/

var searchKeywords = function(tweetsCol, query, next)
{
    var queryKeywords = helpers.getLowerCaseKeywordsArray(query);
    var dictionary = {};

    tweetsCol.find({
        keywords_lower: {
            $all:  queryKeywords
        }
    }).each(
        function(err, item) // do something with results, count stuff or smth
        {
            assert.equal(err, null);

            // finish up
            if (item === null)
            {
                var sorted = [];

                for (var prop in dictionary)
                {
                    sorted.push([prop, dictionary[prop]]);
                }

                sorted = sorted.sort(function(a, b) { return b[1] - a[1]; }).slice(0, 30);

                next(sorted);
                return;
            }

            // else process the document, count keywords
            var keywords = item.keywords_lower;

            for (var j = 0; j < keywords.length; j++)
            {
                var keyword = keywords[j];

                if (queryKeywords.indexOf(keyword) === -1)
                {
                    if (dictionary[keyword] === undefined)
                        dictionary[keyword] = 1;
                    else
                        dictionary[keyword]++;
                }
            }
        });
};

var getTweetsCount = function (tweetsCol, next)
{
    tweetsCol.count(function (err, count)
        {
            next(count);
        });
};



/*** web server and requests handling ***/

var setupWeb = function (err, db)
{
    assert.equal(null, err);

    var tweetsCol = db.collection('tweets');
    var hashtagsCol = db.collection('hashtags');

    var web = express();

    // index
    web.get('/', function (req, res) {
        getTweetsCount(tweetsCol, function(count)
        {
            res.send('Hello. ' + count + ' tweets in the database. Use /search?q= to search.');
        });
    });

    //search
    web.get('/search', function (req, res) {
        var query = helpers.removePunctuation(req.query.q);

        searchKeywords(tweetsCol, query, function(result)
        {
            res.send(JSON.stringify(result));
        });
    });

    web.listen(8080, function () {
        console.log('Listening on port 8080!');
    });
};

MongoClient.connect(config.mongodb.url, setupWeb);