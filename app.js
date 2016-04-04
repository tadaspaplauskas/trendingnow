#!/usr/bin/env nodejs

var config = require('./config');
var helpers = require('./components/helpers');
var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;

/*** search happens here ***/
var searchKeywords = function(tweetsCol, query, next)
{
    var queryKeywords = helpers.getLowerCaseKeywordsArray(query);
    var dictionary = {};

    tweetsCol.find({
        keywords_lower: {
            $all:  queryKeywords
        }
    }).limit(30).each(function(err, item) // do something with results, count stuff or smth
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

var searchHashtag = function (hashtagsCol, hashtag, next)
{
    var hashtags = helpers.getLowerCaseKeywordsArray(hashtag);
    hashtag = hashtags[0];

    hashtagsCol.findOne( { hashtag: hashtag }, function (err, doc)
    {
        next(doc);
    });
};

var getHashtagLists = function (trendingCol, hashtagsCol, next)
{
    var trends = [];
    var popular = [];

    trendingCol.find().sort( { zscore: -1, mentions: -1 }).limit(10)
    .each(function(err, trend)
    {
        if (trend === null)
        {
            hashtagsCol.find().sort( { mentions: -1 }).limit(10)
            .each(function(err, pop)
            {
                if (pop === null)
                {
                    next(trends, popular);
                }
                else
                {
                    popular.push(pop);
                }
            });
        }
        else
        {
            trends.push(trend);
        }
    });
};

/*** web server and requests handling ***/
MongoClient.connect(config.mongodb.url, function (err, db)
{
    assert.equal(null, err);
    var tweetsCol = db.collection('tweets');
    var hashtagsCol = db.collection('hashtags');
    var trendingCol = db.collection('trending');

    /*** web server setup ***/

    var app = express();
    app.set('view engine', 'pug');

    app.use(express.static('public'));

    app.listen(8080, function () {
        console.log('Listening on port 8080!');
    });

    /*** routing ***/

    //return trending hashtags
    app.get('/', function (req, res)
    {
        getHashtagLists(trendingCol, hashtagsCol, function(trending, popular)
        {
            res.render('index', { trendingList: trending, popularList: popular });
        });
    });

    app.get('/count', function (req, res) {
        getTweetsCount(tweetsCol, function(count)
        {
            res.send(count + ' tweets in the database.');
        });
    });

    //search keyword
    app.get('/keywords/:keyword', function (req, res) {
        var query = helpers.removePunctuation(req.params.keyword);

        searchKeywords(tweetsCol, query, function(related)
        {
            if (helpers.isHashtag(req.params.keyword))
            {
                searchHashtag(hashtagsCol, query, function(hashtagData)
                {
                    var hashtagGraph = [];
                    if (hashtagData === null || hashtagData.hours === undefined)
                    {
                        hashtagGraph = null;
                    }
                    else
                    {
                        var date = new Date();

                        var i = date.getHours();
                        do
                        {
                            i++;
                            if (i >= 23)
                            {
                                i = 0;
                            }
                            if (hashtagData.hours[i] !== undefined)
                            {
                                hashtagGraph.push(hashtagData.hours[i] * 100);
                            }
                            else
                            {
                                hashtagGraph.push(0);
                            }
                        } while (hashtagGraph.length <= 23);
                    }
                    res.render('keyword', { keyword: req.params.keyword, related: related, hashtagGraph: JSON.stringify(hashtagGraph) } );
                });
            }
            else
            {
                res.render('keyword', { keyword: req.params.keyword, related: related, hashtagData: null } );
            }
        });
    });

    //return trending hashtags
    app.get('/about', function (req, res)
    {
        res.render('about', { title: "about" });
    });

    app.use(function(req, res) {
        res.status(404).render('404');
    });
});