#!/usr/bin/env nodejs

var config = require('./config');
var helpers = require('./components/helpers');
var Messenger = require('./components/messenger');

var express = require('express');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var assert = require('assert');
var ObjectID = mongodb.ObjectID;
var Mailgun = require('mailgun-js');
var validator = require('validator');
var pug = require('pug');

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

var searchHashtag = function (hashtags, hashtag, next)
{
    var hashtagsArray = helpers.getLowerCaseKeywordsArray(hashtag);
    hashtag = hashtagsArray[0];

    hashtags.findOne( { hashtag: hashtag }, function (err, doc)
    {
        next(doc);
    });
};

var getLists = function (trending, hashtags, next)
{
    var results = {};

    var first = function ()
    {
        var popularHashtags = [];

        hashtags.find().sort( { mentions: -1 }).limit(10)
        .each(function(err, doc)
        {
            if (err) throw err;

            if (doc === null)
            {
                results.popularHashtags = popularHashtags;
                second();
            }
            else
            {
                popularHashtags.push(doc);
            }
        });
    },
    second = function ()
    {
        var trendingHashtags = [];

        trending.find({ hashtag: { $exists: true } }).sort( { zscore: -1, mentions: -1 }).limit(10)
        .each(function(err, doc)
        {
            if (err) throw err;

            if (doc === null)
            {
                results.trendingHashtags = trendingHashtags;
                next(results);
            }
            else
            {
                trendingHashtags.push(doc);
            }
        });
    };
    first();
};

/*** web server and requests handling ***/
MongoClient.connect(config.mongodb.url, function (err, db)
{
    if (err) throw err;

    var tweetsCol = db.collection('tweets');
    var hashtags = db.collection('hashtags');
    var trending = db.collection('trending');
    var subscribers = db.collection('subscribers');
    var emails = db.collection('emails');
    /*** web server setup ***/

    var app = express();
    var bodyParser = require('body-parser');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.set('view engine', 'pug');
    app.use(express.static('public'));

    var messenger = Messenger({ config: config, emails: emails, subscribers: subscribers });
    var mailgun = new Mailgun(config.mailgun);

    app.listen(8080, function () {
        console.log('Listening on port 8080 in ' + process.env.NODE_ENV + ' mode');
    });

    // local helpers
    var findSubscriber = function (req, res, next)
    {
        var id;
        try
        {
            id = ObjectID( req.params.subscriber );
        }
        catch (e)
        {
            res.render('failure', { message: 'Enter correct id' });
            return;
        }

        subscribers.findOne( { _id: id }, function (err, subscriber)
        {
            if (subscriber === null || err)
            {
                res.render('failure', { message: 'No such subscriber in my database! Did I get something wrong or did you?..' });
                return;
            }
            var blacklist = subscriber.blacklist === undefined ? [] : subscriber.blacklist;
            var item = req.params.item;

            next(subscriber, id);
        });
    };

    /*** routing ***/

    //return trending hashtags
    app.get('/', function (req, res)
    {
        getLists(trending, hashtags, function(result)
        {
            res.render('index', {
                trendingHashtagsList: result.trendingHashtags,
                popularHashtagsList: result.popularHashtags
            });
        });
    });

    app.post('/subscribers', function (req, res)
    {
        if (!validator.isEmail(req.body.email))
        {
            res.render('subscribed', { err: {message: 'Please provide a correct email address.'} });
            return;
        }
        else
        {
            subscribers.findOne( {email: req.body.email }, function (err, result)
            {
                if (result === null)
                {
                    var confirm_url = helpers.url('subscribers/confirm/', req.body.email);

                    mailgun.messages().send({
                        from: config.admin.name +' <'+ config.admin.email +'>',
                        to: req.body.email,
                        subject: 'Please confirm your subscription to trendingnow.io',
                        html: pug.renderFile('views/email_confirm.pug', {err: err, confirm_url: confirm_url})
                    }, function (err, body) {
                        if (err) {
                            console.log(err);
                        }
                        res.render('subscription_requested', { err: err });
                    });
                }
                else
                {
                    res.render('failure', { message: 'You are already subscribed!' });
                }
            });
        }
    });

    app.get('/subscribers/confirm/:email', function (req, res)
    {
        if (!validator.isEmail(req.params.email))
        {
            res.render('failure', { message: 'Please provide a correct email address.'} );
            return;
        }
        else
        {
            subscribers.findOne( {email: req.params.email }, function (err, result)
            {
                if (result === null)
                {
                    subscribers.insertOne({email: req.params.email, created_at: new Date() }, function (err, body) {
                        if (err)
                        {
                            console.error(err);
                            res.render('failure', { message: 'Something went wrong, please try again in a minute.' });
                        }
                        else
                        {
                            res.render('success', { message: 'You are now subscribed to the mailing list. We will notify you as soon as we find something that might be interesting.'});
                        }
                    });
                }
                else
                {
                    res.render('failure', { message: 'You are already subscribed!' });
                }
            });
        }
    });

    app.get('/subscribers/:subscriber/blacklist/:item', function (req, res)
    {
        findSubscriber(req, res, function(subscriber)
        {
            var item = req.params.item;
            var blacklist = subscriber.blacklist === undefined ? [] : subscriber.blacklist;

            if (blacklist.indexOf(item) !== -1)
            {
                res.render('success', { message: 'Already blacklisted.', close: true });
                return;
            }

            // increase blacklisted count for current testing emails (should be just one but hey)
            emails.updateOne({ type: 'test', hashtag: item }, { $inc: { blacklisted: 1 } });

            blacklist.push(item);

            subscribers.updateOne({ _id: subscriber._id }, { $set: { blacklist: blacklist, updated_at: new Date() }}, function (err, body) {
                if (err)
                {
                    console.error(err);
                    res.render('failure', { err: 'Something went wrong, please try again in a minute.' });
                }
                else
                {
                    res.render('success', { message: 'Blacklisted successfully! You will not hear about it again.', close: true });
                }
            });
        });
    });

    app.get('/subscribers/:subscriber/blacklist_remove/:item', function (req, res)
    {
        findSubscriber(req, res, function(subscriber, id) {
            var blacklist = subscriber.blacklist;
            var index = blacklist.indexOf(req.params.item);

            if (index !== -1)
            {
                blacklist.splice(index, 1);

                subscribers.updateOne({ _id: id }, { $set: { blacklist: blacklist, updated_at: new Date() }}, function (err, body) {
                    if (err)
                    {
                        console.error(err);
                        res.render('failure', { err: 'Something went wrong, please try again in a minute.' });
                    }
                    else
                    {
                        res.redirect(req.header('Referer') || '/');
                    }
                });
            }
        });
    });

    app.get('/subscribers/:subscriber', function (req, res)
    {
        findSubscriber(req, res, function(subscriber) {
            res.render('subscriber', {
                title: 'Preferences',
                subscriber: subscriber,
                remove_link: '/subscribers/' + subscriber._id + '/blacklist_remove/' });
        });
    });

    app.get('/email', function (reg, res)
    {
        var hashtag = '#hiphop';
        var encoded = encodeURIComponent(hashtag);
        res.render('email_hashtag', {
            link: 'abcd',
            title: 'Nothing good',
            blacklist_url: helpers.blacklistUrl(123, '456')
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
            var search = { google: helpers.googleSearchUrl(req.params.keyword), twitter: helpers.twitterSearchUrl(req.params.keyword) };

            if (helpers.isHashtag(req.params.keyword))
            {
                searchHashtag(hashtags, query, function(hashtagData)
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
                            if (i === 24)
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
                    res.render('keyword', { title: req.params.keyword, keyword: req.params.keyword, related: related, search: search, hashtagGraph: JSON.stringify(hashtagGraph) } );
                });
            }
            else
                res.render('keyword', { title: req.params.keyword, keyword: req.params.keyword, related: related, hashtagData: null, search: search } );
        });
    });

    //return trending hashtags
    app.get('/about', function (req, res)
    {
        res.render('about', { title: "about" });
    });

    /*** messenger bot entry point ***/
    app.post('/bot/messenger', function (req, res) {
        messenger.entry(req, res);
    });
});