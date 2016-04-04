var analysis = {};

analysis.helpers = require('./helpers');

analysis.analyzeHashtag = function (doc, config)
{
    var values = [];
    var currentHour = analysis.helpers.getCurrentHour();

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
    var mentions = analysis.helpers.sum(values);

    if (doc.hours[currentHour] !== undefined && mentions > config.commonSenseEdge)
    {
        var currentHours = doc.hours[currentHour];// not needed for now because hashtag is deleted after an hour of inactivity, so this scews results + (currentHour > 0 ? doc.hours[currentHour-1] : doc.hours[23]);

        zScore = analysis.helpers.zScore(currentHours, values);
    }
    return { zScore: zScore, mentions: mentions };
};

analysis.scanHashtagsForTrends = function (hashtags, trending, config)
{
    hashtags.find({}).each(function (err, doc)
    {
        if (doc === null)
            return 0;

        var results = analysis.analyzeHashtag(doc, config);

        if (results.zScore > config.zScorePos)
        {
            trending.updateOne(
                { hashtag: doc.hashtag },
                { $set: { zscore: results.zScore, mentions: results.mentions, updated_at: new Date() } },
                { upsert: true });
        }
    });
};

analysis.init = function (params)
{
    var tweets = params.tweets;
    var hashtags = params.hashtags;
    var trending = params.trending;

    setInterval(analysis.scanHashtagsForTrends, 60 * 1000, hashtags, trending, params.config);

    setInterval(function (trending)
    {
        trending.remove( { updated_at: { $lt: new Date(new Date() - 3600 * 1000) } } );
    }, 60 * 1000, trending);
};

module.exports = analysis;