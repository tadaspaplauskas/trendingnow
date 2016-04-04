var streamer = {};

streamer.helpers = require('./helpers');
streamer.Twit = require('twit');

streamer.insertTweet = function(tweets, keywords, tweet)
{
    tweets.insertOne( {
        "keywords_lower" : keywords,
        //"text" : tweet.text,
        "timestamp" : Math.round(tweet.timestamp_ms / 1000)
    });
};

streamer.insertHashtags = function(hashtags, keywords)
{
    var updateObj = {};
    updateObj['hours.' + streamer.helpers.getCurrentHour()] = 1;
    updateObj.mentions = 1;

    var hashtag = null;

    for (var i = 0; i < keywords.length; i++)
    {
        hashtag = keywords[i];

        if (streamer.helpers.isHashtag(hashtag))
        {
            hashtags.updateOne(
            { hashtag: hashtag },
            { $inc: updateObj, $set: { updated_at: new Date() } },
            { upsert: true });
        }
    }
};

streamer.init = function (params)
{
    var helpers = streamer.helpers;
    var tweets = params.tweets;
    var hashtags = params.hashtags;

    twitter = new streamer.Twit(params.config.twitter);

    //remove records older than 24hours
    setInterval(function()
    {
        tweets.remove( {
            timestamp: { $lt: helpers.timestamp() - 3600 * 24 }
        }); // keep for 24 hours
    }, 60 * 1000);

    // every hour reset current hour's counter
    setInterval(function()
    {
        var date = new Date();
        // nullify mentions counter when day starts
        if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0)
        {
            hashtags.update({}, { $set : { mentions: 0 } }, { multi: true} );
        }
        if (date.getMinutes() === 0 && date.getSeconds() === 0)
        {
            var update = {};
            update['hours.' + date.getHours()] = 0;

            hashtags.update({}, { $set : update }, { multi: true} );
        }
    }, 1000);

    setInterval(function()
    {
        hashtags.remove( { updated_at: { $lt: new Date(new Date() - 24 * 3600 * 1000) } } );
    }, 60 * 1000);

    /*** streamer ***/
    var stream = twitter.stream('statuses/sample');

    stream.on('tweet', function(tweet) {
        if (tweet.text !== undefined && tweet.lang === 'en') // only english at least for now
        {
            var keywords = [];

            keywords = helpers.getLowerCaseKeywordsArray(tweet.text);
            keywords = helpers.keepValidKeywords(keywords, params.config.forbiddenWords);

            if (keywords.length > 0)
            {
                streamer.insertTweet(tweets, keywords, tweet);
                streamer.insertHashtags(hashtags, keywords);
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

module.exports = streamer;