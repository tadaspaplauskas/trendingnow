var analysis = function (params)
{
    var helpers = require('./helpers');
    var MetaInspector = require('node-metainspector');

    var tweets = params.tweets;
    var hashtags = params.hashtags;
    var trending = params.trending;
    var links = params.links;

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

        if (doc.hours[currentHour] !== undefined &&
                ((doc.link !== undefined && mentions > config.commonSenseEdgeLink) ||
                (doc.hashtag !== undefined && mentions > config.commonSenseEdgeHashtag)))
        {
            var currentHours = doc.hours[currentHour];// not needed for now because hashtag is deleted after an hour of inactivity, so this scews results + (currentHour > 0 ? doc.hours[currentHour-1] : doc.hours[23]);

            zScore = helpers.zScore(currentHours, values);
        }
        return { zScore: zScore, mentions: mentions };
    };

    var scanHashtags = function (hashtags, trending, config)
    {
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
                    { $set: { zscore: results.zScore, mentions: results.mentions, updated_at: new Date() } },
                    { upsert: true });
            }
        });
    };

    var getWebpage = function (link, next)
    {
        var client = new MetaInspector(link, { timeout: 5000 });
        client.on('fetch', function()
        {
            next(client);
            client = null;
        });
        client.on('error', function(err) { /* do nothing, it's their loss */ });
        client.fetch();
    };

    var scanLinks = function (links, trending, config)
    {
        links.find({}).each(function (err, doc)
        {
            if (err) throw err;

            if (doc === null)
                return 0;

            var results = analyzeDoc(doc, config);

            if (results.zScore > config.zScorePos)
            {
                getWebpage(doc.link, function(webpage)
                {
                    trending.updateOne(
                        { link: doc.link },
                        { $set: {
                            zscore: results.zScore,
                            mentions: results.mentions,
                            updated_at: new Date(),
                            title: webpage.title
                        } },
                        { upsert: true });
                });
            }
        });

        links.find({}).sort( { mentions: -1 }).limit(10).each(function (err, doc)
        {
            if (err) throw err;

            if (doc === null)
                return 0;

            getWebpage(doc.link, function(webpage)
            {
                links.updateOne({ _id: doc._id }, { $set: { title: webpage.title }});
            });
        });
    };

    setInterval(scanHashtags, 55 * 1000, hashtags, trending, params.config);

    setInterval(scanLinks, 120 * 1000, links, trending, params.config);

    setInterval(function (trending)
    {
        // keep trends on the homepage for 24 hours
        trending.remove( { updated_at: { $lt: new Date(new Date() - 24 * 3600 * 1000) } } );
    }, 60 * 1000, trending);
};

module.exports = analysis;