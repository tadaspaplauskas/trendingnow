var streamer = function (params)
{
    var helpers = require('./helpers');
    var tweets = params.tweets;
    var hashtags = params.hashtags;
    var links = params.links;

    twitter = new require('twit')(params.config.twitter);


    var insertTweet = function(tweets, keywords, tweet)
    {
        insertTweet.cache.push({
            "keywords_lower" : keywords,
            "timestamp" : Math.round(tweet.timestamp_ms / 1000)
        });

        if (insertTweet.cache.length >= 100)
        {
            tweets.insertMany(insertTweet.cache, { ordered: false, w:0 }, function(err, r)
            {
                if (err) throw err;
            });
            insertTweet.cache = [];
        }
    };
    insertTweet.cache = [];

    var insertHashtags = function(hashtags, keywords)
    {
        var updateObj = {};
        updateObj['hours.' + helpers.getCurrentHour()] = 1;
        updateObj.mentions = 1;

        var hashtag = null;

        for (var i = 0; i < keywords.length; i++)
        {
            hashtag = keywords[i];

            if (helpers.isHashtag(hashtag))
            {
                insertHashtags.cache.push({
                    updateOne: {
                        filter: { hashtag: hashtag },
                        update: { $inc: updateObj, $set: { updated_at: new Date() } },
                        upsert: true
                    }
                });
            }
        }

        if (insertHashtags.cache.length >= 100)
        {
            hashtags.bulkWrite(insertHashtags.cache, { ordered: false, w:0 }, function (err, res)
            {
                if (err) throw err;
            });
            insertHashtags.cache = [];
        }
    };
    insertHashtags.cache = [];

    var insertLinks = function(links, urls)
    {
        var updateObj = {};
        updateObj['hours.' + helpers.getCurrentHour()] = 1;
        updateObj.mentions = 1;

        for (var i = 0; i < urls.length; i++)
        {
            insertLinks.cache.push({
                updateOne: {
                    filter: { link: urls[i].expanded_url },
                    update: { $inc: updateObj, $set: { updated_at: new Date() } },
                    upsert: true
                }
            });
        }
        if (insertLinks.cache.length >= 100)
        {
            links.bulkWrite(insertLinks.cache, { ordered: false, w:0 }, function (err, res)
            {
                if (err) throw err;
            });
            insertLinks.cache = [];
        }
    };
    insertLinks.cache = [];

    //remove records older than 24hours
    setInterval(function()
    {
        tweets.remove( { timestamp: { $lt: helpers.timestamp() - 3600 * 24 } }, { w: 0 } ); // keep for 24 hours

        hashtags.remove( { updated_at: { $lt: new Date(new Date() - 24 * 3600 * 1000) } }, { w: 0 } );

        links.remove( { updated_at: { $lt: new Date(new Date() - 24 * 3600 * 1000) } }, { w: 0 } );
    }, 60 * 1000);

    // every hour reset current hour's counter
    setInterval(function()
    {
        var date = new Date();
        // nullify mentions counter when day starts
        if (date.getHours() === 0 && date.getMinutes() === 0)
        {
            hashtags.update({}, { $set : { mentions: 0 } }, { multi: true} );
        }
        if (date.getMinutes() === 0)
        {
            var update = {};
            update['hours.' + date.getHours()] = 0;

            hashtags.update({}, { $set : update }, { multi: true} );
        }
    }, 60 * 1000);

    /*** streamer ***/
    var stream = twitter.stream('statuses/sample', { 'language': 'en', 'filter_level': 'low' }); // filter level also a possibility

    stream.on('tweet', function(tweet)
    {
        var userCreatedAt = new Date(tweet.user.created_at);
        var cutoffTimestamp = new Date() - 1000 * 3600 * 24 * 365;

        if (tweet.text !== undefined && userCreatedAt < cutoffTimestamp) // if user is older than a year
        {
            var keywords = [];

            keywords = helpers.getLowerCaseKeywordsArray(tweet.text);
            keywords = helpers.keepValidKeywords(keywords, params.config.forbiddenWords);

            if (keywords.length > 0)
            {
                insertTweet(tweets, keywords, tweet);
                insertHashtags(hashtags, keywords);
            }
            // save links too
            if (tweet.entities.urls.length > 0)
            {
                insertLinks(links, tweet.entities.urls);
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
        console.error(error);
        process.exit(1);
    });
};
module.exports = streamer;