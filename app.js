var config = require('./config');

var Twitter = require('twitter');
var client = new Twitter(config.twitter);

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var url = config.mongodb.url;
var collection;

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

/*** connect twittter stream to mongodb ***/

var setupStreamToDB = function(err, db) {
    assert.equal(null, err);
    console.log("Connected to server.");

    collection = db.collection('tweets');

    //remove records older than 24hours
    var cleaning = setInterval(function(db)
    {
        db.collection('tweets').remove( {
            timestamp: { $lt: timestamp() - 3600 * 24 * 1000 }
        });
    }, 60 * 1000, db);

    client.stream('statuses/sample', function(stream)
    {
        stream.on('data', function(tweet) {
            if (tweet.text !== undefined)
            {
                insertTweet(db, tweet);
                //console.log(tweet.text);
            }
        });

        stream.on('error', function(error) {
                throw error;
        });
    });

    setupWeb(db); //start web server
};

MongoClient.connect(url, setupStreamToDB);

/*** search happens here ***/

var searchKeywords = function(db, query, next)
{
    var keywords = getLowerCaseKeywordsArray(query);
    //{ $and: [ {keywords: "' + ['look', 'here'].join('" } , { keywords: "') + '" } ] }'
    collection.find({
        keywords_lower: {
            $all:  keywords
        }
    }).toArray(
        function(err, result) // do something with results, count stuff or smth
        {
            assert.equal(err, null);

            // process the results, count keywords

            var dictionary = [];

            // every record
            /*for (i = 0; i <= result.length; i++)
            {
                // every keyword
                var record = result[i].keywords_lower;

                for (j = 0; j <= record.length; j++)
                {
                    var keyword = record[j];

                    if (dictionary[keyword] !== undefined)
                        dictionary[keyword]++;
                    else
                        dictionary[keyword] = 1;
                }
            }

            var max = 0;// max js integer val

            for (n = 0; n <= dictionary.length; n++)
            {
                if ()
            }*/

            next(result);
        });
};

/*** web server and requests handling ***/
var setupWeb = function (db)
{
    var express = require('express');
    var web = express();

    // index
    web.get('/', function (req, res) {
        res.send('Hello and welcome to the index page. Use /search?q= to look up some stuff');
    });

    //search
    web.get('/search', function (req, res) {
        var query = req.query.q.removePunctuation();

        searchKeywords(db, query, function(result)
        {
            res.send(JSON.stringify(result));
        });
    });

    web.listen(80, function () {
        console.log('Example app listening on port 80!');
    });
};