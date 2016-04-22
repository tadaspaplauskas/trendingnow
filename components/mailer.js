var mailer = function (params)
{
    var helpers = require('./helpers');
    var mailgun = new require('mailgun-js')(params.config.mailgun);
    var pug = require('pug');
    var trending = params.trending;
    var emails = params.emails;
    var subscribers = params.subscribers;

    setInterval(function (trending)
    {
        trending.find().sort( { zscore: -1, mentions: -1 }).limit(10)
        .each(function(err, trend)
        {
            if (err)
            {
                console.error(err);
                return false;
            }
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
                    if (err)
                    {
                        console.error(err);
                        return false;
                    }

                    if (doc === null && trend.hashtag !== undefined) // send to subscribers, save to emails
                    {
                        var hashtag = trend.hashtag;
                        pug.renderFile('views/email.pug', {
                            hashtag: hashtag,
                            trending_url: helpers.searchUrl(hashtag),
                            google_url: helpers.googleSearchUrl(hashtag),
                            twitter_url: helpers.twitterSearchUrl(hashtag)/*, TODO FIXME
                            blacklist_url: config.url +*/
                        }, function(err, html) {
                            if (err)
                            {
                                console.error(err);
                                return false;
                            }
                            // format email
                            var data = {
                                from: params.config.admin.name +' <'+ params.config.admin.email +'>',
                                to: params.config.mailgun.mailingList,
                                subject: 'Looks like ' + trend.hashtag + ' is trending ' + trend.zscore + ' ' + trend.mentions,
                                html: html
                            };
                            // send email
                            mailgun.messages().send(data, function (err, body) {
                                if (err)
                                {
                                    console.error(err);
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