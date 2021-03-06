var analysis = function (params)
{
    var helpers = require('./helpers');

    var tweets = params.tweets;
    var hashtags = params.hashtags;
    var trending = params.trending;

    var analyzeDoc = function (doc, config)
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

        if (doc.hours[currentHour] !== undefined && doc.hashtag !== undefined && mentions > config.commonSenseEdgeHashtag)
        {
            var currentHours = doc.hours[currentHour];// not needed for now because hashtag is deleted after an hour of inactivity, so this scews results + (currentHour > 0 ? doc.hours[currentHour-1] : doc.hours[23]);
            zScore = helpers.zScore(currentHours, values);
        }
        return { zScore: zScore, mentions: mentions };
    };

    var scanHashtags = function (hashtags, trending, config)
    {
        // skip if it's only the first minutes of the new hour
        if (new Date().getMinutes() <= 2)
        {
            return;
        }

        hashtags.find({}).each(function (err, doc)
        {
            if (err) throw err;

            if (doc === null)
                return 0;

            var results = analyzeDoc(doc, config);

            if (results.zScore > config.zScorePos)
            {
                trending.updateOne(
                    { hashtag: doc.hashtag },
                    { $set: { zscore: results.zScore, mentions: results.mentions, updated_at: new Date(), doc: doc } },
                    { upsert: true });
            }
        });
    };

    setInterval(scanHashtags, 55 * 1000, hashtags, trending, params.config);

    setInterval(function (trending)
    {
        // keep trends on the homepage for 24 hours
        trending.remove( { updated_at: { $lt: new Date(new Date() - 24 * 3600 * 1000) } } );
    }, 60 * 1000, trending);
};

module.exports = analysis;