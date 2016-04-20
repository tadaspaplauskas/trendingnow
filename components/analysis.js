var analysis = function (params)
{
    var helpers = require('./helpers');
    var tweets = params.tweets;
    var hashtags = params.hashtags;
    var trending = params.trending;

    var analyzeHashtag = function (doc, config)
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
        var mentions = helpers.sum(values);

        if (doc.hours[currentHour] !== undefined && mentions > config.commonSenseEdge)
        {
            var currentHours = doc.hours[currentHour];// not needed for now because hashtag is deleted after an hour of inactivity, so this scews results + (currentHour > 0 ? doc.hours[currentHour-1] : doc.hours[23]);

            zScore = helpers.zScore(currentHours, values);
        }
        return { zScore: zScore, mentions: mentions };
    };

    var scanHashtagsForTrends = function (hashtags, trending, config)
    {
        hashtags.find({}).each(function (err, doc)
        {
            if (err)
            {
                console.error(err);
                return false;
            }

            if (doc === null)
                return 0;

            var results = analyzeHashtag(doc, config);

            if (results.zScore > config.zScorePos)
            {
                trending.updateOne(
                    { hashtag: doc.hashtag },
                    { $set: { zscore: results.zScore, mentions: results.mentions, updated_at: new Date() } },
                    { upsert: true });
            }
        });
    };

    setInterval(scanHashtagsForTrends, 60 * 1000, hashtags, trending, params.config);

    setInterval(function (trending)
    {
        trending.remove( { updated_at: { $lt: new Date(new Date() - 3600 * 1000) } } );
    }, 60 * 1000, trending);
};

module.exports = analysis;