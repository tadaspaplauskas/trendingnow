#!/usr/bin/env nodejs

var config = require('./config');

var Twitter = require('twitter');
var client = new Twitter(config.twitter);

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var url = config.mongodb.url;

var forbiddenWords = ['amp', 'are', 'more', 'via', 'its', 'http', 'https', 'is',
'rt', 'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'];

/*** helpers ***/

// remove punctuation from tweets
String.prototype.removePunctuation = function ()
{
    return this.replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, '');
};

// prepare keywords array (used for search)
var getLowerCaseKeywordsArray = function (str)
{
    return str.toLowerCase()
        .removePunctuation()
        .trim()
        .split(' ')
        .filter(String); //remove empty elements
};

// prepare keywords array (used for representation. maybe?)
var getKeywordsArray = function (str)
{
    return str
        .removePunctuation()
        .trim()
        .split(' ')
        .filter(String); //remove empty elements
};

// get current timestamp in seconds
var timestamp = function() {
    return Math.round(Date.now() / 1000);
};

/*** helpers end ***/



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
        //console.log("Inserted " + tweet.timestamp_ms);
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
            updateObj['days.' + currentHour] = 1;

            hashtagsCol.updateOne( { hashtag: hashtag }, { $inc: updateObj }, { upsert: true },
                function(err, result) { assert.equal(err, null); });
        }
    }
};

/*** connect twittter stream to mongodb ***/

var setupStreamToDB = function(err, db) {
    assert.equal(null, err);
    console.log("Connected to server.");

    var tweetsCol = db.collection('tweets');
    var hashtagsCol = db.collection('hashtags');

    //remove records older than 24hours
    var cleaning = setInterval(function(tweetsCol)
    {
        tweetsCol.remove( {
            timestamp: { $lt: timestamp() - 3600 * 24 }
        }); // keep for 24 hours
    }, 60 * 1000, tweetsCol); //turn off to aqquire more data

    client.stream('statuses/sample', function(stream)
    {
        stream.on('data', function(tweet) {
            var keywords = [];
            if (tweet.text !== undefined)
            {
                keywords = getLowerCaseKeywordsArray(tweet.text);

                if (keywords.length > 0)
                {
                    insertTweet(tweetsCol, keywords, tweet);
                    trackHashtags(hashtagsCol, keywords);
                }
            }
        });

        stream.on('error', function(error) {
                throw error;
        });
    });

    setupWeb(tweetsCol); //start web server
};

MongoClient.connect(url, setupStreamToDB);

/*** search happens here ***/

var searchKeywords = function(tweetsCol, query, next)
{
    var queryKeywords = getLowerCaseKeywordsArray(query);
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

                if (forbiddenWords.indexOf(keyword) === -1 && queryKeywords.indexOf(keyword) === -1)
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
var setupWeb = function (tweetsCol)
{
    var express = require('express');
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
        var query = req.query.q.removePunctuation();

        searchKeywords(tweetsCol, query, function(result)
        {
            res.send(JSON.stringify(result));
        });
    });

    web.listen(8080, function () {
        console.log('Listening on port 8080!');
    });
};