var mailer = {};

mailer.helpers = require('./helpers');
mailer.Mailgun = require('mailgun-js');
mailer.Pug = require('pug');

mailer.analyzeHashtag = function (doc, config)
{
    var values = [];
    var currentHour = mailer.helpers.getCurrentHour();

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
    var mentions = mailer.helpers.sum(values);

    if (doc.hours[currentHour] !== undefined && mentions > config.commonSenseEdge)
    {
        var currentHours = doc.hours[currentHour];// not needed for now because hashtag is deleted after an hour of inactivity, so this scews results + (currentHour > 0 ? doc.hours[currentHour-1] : doc.hours[23]);

        zScore = mailer.helpers.zScore(currentHours, values);
    }
    return { zScore: zScore, mentions: mentions };
};

mailer.scanHashtagsForTrends = function (hashtags, trending, config)
{
    hashtags.find({}).each(function (err, doc)
    {
        if (doc === null)
            return 0;

        var results = mailer.analyzeHashtag(doc, config);

        if (results.zScore > config.zScorePos)
        {
            trending.updateOne(
                { hashtag: doc.hashtag },
                { $set: { zscore: results.zScore, mentions: results.mentions, updated_at: new Date() } },
                { upsert: true });
        }
    });
};

mailer.init = function (params)
{
    var mailgun = new mailer.Mailgun(params.config.mailgun);
    var pug = mailer.Pug;
    var trending = params.trending;
    var emails = params.emails;
    var subscribers = params.subscribers;

    setInterval(function (trending)
    {
        trending.find().sort( { zscore: -1, mentions: -1 }).limit(10)
        .each(function(err, trend)
        {
            if (trend === null)
            {
                return true;
            }
            // check if email threshold z-score is reached
            else if (trend.zscore >= params.config.zScoreEmail)
            {
                // check if email about this tag was sent recently (last 24h)
                emails.findOne({ hashtag: trend.hashtag, created_at: { $gt: new Date(new Date() - 24 * 3600 * 1000) }},
                function (err, doc)
                {
                    if (doc === null && trend.hashtag !== undefined) // send to subscribers, save to emails
                    {
                        var hashtag = trend.hashtag;
                        pug.renderFile('views/email.pug', {
                            hashtag: hashtag,
                            trending_url: mailer.helpers.searchUrl(hashtag),
                            google_url: mailer.helpers.googleSearchUrl(hashtag),
                            twitter_url: mailer.helpers.twitterSearchUrl(hashtag),
                        }, function(error, html) {
                            if (error)
                            {
                                console.log(error);
                                return false;
                            }
                            // format email
                            var data = {
                                from: params.config.admin.email,
                                to: params.config.mailgun.mailingList,
                                subject: 'Looks like ' + trend.hashtag + ' is trending ' + trend.zscore,
                                html: html
                            };
                            // send email
                            mailgun.messages().send(data, function (error, body) {
                                if (error)
                                {
                                    console.log(error);
                                    return false;
                                }
                                // store email
                                emails.insertOne({hashtag: trend.hashtag, email: data, created_at: new Date()});
                            });
                        });
                    }
                });
            }
        });
    }, 60 * 1000, trending, emails);
};

module.exports = mailer;