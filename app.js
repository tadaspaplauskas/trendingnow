#!/usr/bin/env nodejs

var config = require('./config');
var helpers = require('./helpers');

var express = require('express');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

var forbiddenWords = config.forbiddenWords;

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

var analyzeHashtagDoc = function (doc)
{
    var values = [];
    var currentHour = helpers.getCurrentHour();

    if (doc === null)
        return 0;

    for (var i = 0; i < 24; i++)
    {
        if (doc.hours[i] !== undefined)
        {
            values.push(doc.hours[i]);
        }
    }

    var zScore = 0;

    if (doc.hours[currentHour] !== undefined)
    {
        zScore = helpers.zScore(doc.hours[currentHour], values);
    }
    return zScore;
};

var searchHashtag = function (hashtagsCol, hashtag, next)
{
    var hashtags = helpers.getLowerCaseKeywordsArray(hashtag);
    hashtag = hashtags[0];

    hashtagsCol.findOne( { hashtag: hashtag }, function (err, doc)
    {
        var zScore = analyzeHashtagDoc(doc);

        // is trending?
        var output = '';

        if (zScore > config.zScorePos)
            output = 'Hashtag is trending, get on it!';
        else if (zScore < config.zScoreNeg)
            output = 'Hashtag is trending down';
        else
            output = 'Hashtag is not trending';

        next(zScore + ': ' + output);

        //1.96 significance level should be at least that
    });
};

var scanHashtagsForTrends = function (hashtagsCol, trendingCol)
{
    hashtagsCol.find({}).each(function (err, doc)
    {
        if (doc === null)
            return 0;

        var zScore = analyzeHashtagDoc(doc);

        if (zScore > config.zScorePos)
        {
            trendingCol.updateOne(
                { hashtag: doc.hashtag },
                { $set: { zscore: zScore, updated_at: new Date() } },
                { upsert: true });
        }
    });
};

var getTrendingHashtags = function (trendingCol, next)
{
    var trends = [];
    trendingCol.find().sort( { zscore: -1 }).each(function(err, doc)
    {
        if (doc === null)
            next(trends);

        trends.push(doc);
    });
};
/*** connect to mongodb ***/

var setupStreamToDB = function(err, db)
{
    setupWeb(tweetsCol); //start web server
};

/*** web server and requests handling ***/

var setupWeb = function (err, db)
{
    assert.equal(null, err);

    var tweetsCol = db.collection('tweets');
    var hashtagsCol = db.collection('hashtags');
    var trendingCol = db.collection('trending');

    /*** CONSTANTLY SCAN FOR TRENDING TOPICS ***/

    setInterval(scanHashtagsForTrends, 60 * 1000, hashtagsCol, trendingCol);

    setInterval(function (trendingCol)
    {
        trendingCol.remove( { updated_at: { $lt: new Date(new Date() - 120 * 1000) } } );
    }, 60 * 1000, trendingCol);

    /*** ***/

    var web = express();

    // index
    web.get('/', function (req, res) {
        getTweetsCount(tweetsCol, function(count)
        {
            var output = 'Hello. ' + count + ' tweets in the database. Use /search?q= to search.';

            res.send(output);
        });
    });

    //return trending hashtags
    web.get('/trending', function (req, res)
    {
        getTrendingHashtags(trendingCol, function(result)
            {
                var output = '';

                for (var i = 0; i < result.length; i++)
                {
                    output += '<li>' + result[i].zscore + ': ' + result[i].hashtag + '</li>';
                }

                res.send('<ol>' + output + '</ol>');
            });
    });

    //search keyword
    web.get('/keywords', function (req, res) {
        var query = helpers.removePunctuation(req.query.q);

        searchKeywords(tweetsCol, query, function(result)
        {
            res.send(JSON.stringify(result));
        });
    });

    //search keyword
    web.get('/hashtag', function (req, res) {
        var query = helpers.removePunctuation(req.query.q);

        searchHashtag(hashtagsCol, query, function(result)
        {
            res.send(result);
        });
    });

    web.listen(8080, function () {
        console.log('Listening on port 8080!');
    });
};

MongoClient.connect(config.mongodb.url, setupWeb);