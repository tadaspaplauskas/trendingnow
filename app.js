var config = require('./config');

var Twitter = require('twitter');
var client = new Twitter(config.twitter);

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var url = config.mongodb.url;


var insertTweet = function(db, tweet)
{
    var keywords = getKeywordsArray(tweet.text);

    if (keywords.length > 0)
    {
        db.collection('tweets').insertOne( {
            "keywords" : keywords,
            "keywords_lower" : getLowerCaseKeywordsArray(tweet.text),
            //"text" : tweet.text,
            "timestamp" : Math.round(tweet.timestamp_ms / 1000)
        },
        function(err, result)
        {
            assert.equal(err, null);
            //console.log("Inserted " + tweet.timestamp_ms);
        });
    }
};

var getLowerCaseKeywordsArray = function (str)
{
    return str.toLowerCase()
        .replace(/[^a-zA-Z0-9 #]/g, '')
        .trim()
        .split(' ')
        .filter(String); //remove empty elements
};

var getKeywordsArray = function (str)
{
    return str.replace(/[^a-zA-Z0-9 #]/g, '')
        .trim()
        .split(' ')
        .filter(String); //remove empty elements
};

var timestamp = function() {
    return Math.round(Date.now() / 1000);
};

var setupStreamToDB = function(err, db) {
    assert.equal(null, err);
    console.log("Connected to server.");

    //remove records older than 24hours
    var cleaning = setInterval(function(db)
    {
        db.collection('tweets').remove( {
            timestamp: { $lt: timestamp() - 3600 * 24 * 1000 }
        });
    }, 60 * 1000, db);

    client.stream('statuses/sample', function(stream) {

        //setTimeout(function () { process.exit(); }, 3600 * 1000); //quit after an hour

        stream.on('data', function(tweet) {
            if (tweet.text !== undefined)
            {
                insertTweet(db, tweet);
            }
        });

        stream.on('error', function(error) {
                throw error;
        });
    });
};



MongoClient.connect(url, setupStreamToDB);

//web server
var express = require('express');
var web = express();

web.get('/', function (req, res) {
    res.send('Hello World!');

    console.log(req);
});

web.get('/search', function (req, res) {
    res.send('Search pls ' + req.query.q);
});

web.listen(80, function () {
    console.log('Example app listening on port 80!');
});