var mailer = function (params)
{
    var helpers = require('./helpers');
    var mailgun = new require('mailgun-js')(params.config.mailgun);
    var pug = require('pug');
    var trending = params.trending;
    var emails = params.emails;
    var subscribers = params.subscribers;

    /** functions ***/
    var sendEmailToSubscriber = function(subscriber, trend)
    {
        // check if subscriber hasnt blacklisted the hashtag
        if (subscriber.blacklist !== undefined && subscriber.blacklist.indexOf(trend.hashtag) !== -1)
            return false;

        if (trend.hashtag !== undefined)
        {
            pug.renderFile('views/email_hashtag.pug', {
                hashtag: trend.hashtag,
                trend: trend,
                trending_url: helpers.searchUrl(trend.hashtag),
                google_url: helpers.googleSearchUrl(trend.hashtag),
                twitter_url: helpers.twitterSearchUrl(trend.hashtag),
                blacklist_url: helpers.blacklistUrl(subscriber._id, trend.hashtag)
            }, function(err, html) {
                if (err) throw err;

                // format email
                var data = {
                    from: params.config.admin.name +' <'+ params.config.admin.email +'>',
                    to: subscriber.email,
                    subject: 'Looks like ' + trend.hashtag + ' is trending',
                    html: html
                };
                // send email
                //console.log('sent!');
                mailgun.messages().send(data, function (err, body) {
                    if (err) throw err;
                });
            });
            return true;
        }
    };

    // send try-outs
    setInterval(function (trending, emails, subscribers)
    {
        // skip if it's only the first minutes of the new hour
        if (new Date().getMinutes() <= 5)
        {
            return;
        }

        trending.find({
            hashtag: { $exists: true },
            zscore: { $gte: params.config.zScoreHashtagEmail },
            mentions: { $gte: params.config.commonSenseEdgeHashtag } })
        .sort( { zscore: -1, mentions: -1 }).limit(10)
        .each(function(err, trend)
        {
            if (err) throw err;

            if (trend === null)
            {
                return;
            }
            // check if email about this tag was sent recently (last 49h)
            emails.findOne({ hashtag: trend.hashtag, created_at: { $gt: new Date(new Date() - 49 * 3600 * 1000) }},
            function (err, doc)
            {
                if (err) throw err;
                if (doc !== null || trend.hashtag === undefined)
                {
                    return;
                }

                var subscribersArray = [];

                // send to random ~10% subscribers, disable for now until we get at least 20-30
                subscribers.find({ email: 'trendingnow.io@gmail.com' })/*function() { return Math.ceil(Math.random()*10) === 1 }*/
                .each(function(err, subscriber)
                {
                    if (err) throw err;

                    if (subscriber === null) // finished cursor
                    {
                        emails.insertOne({
                            type: 'test',
                            hashtag: trend.hashtag,
                            zscore: trend.zscore,
                            mentions: trend.mentions,
                            blacklisted: 0,
                            created_at: new Date(),
                            tested_subscribers: subscribersArray,
                            trend: trend
                        });
                        return;
                    }

                    if (sendEmailToSubscriber(subscriber, trend))
                        subscribersArray.push(subscriber.email);
                });
            });
        });
    }, 60 * 1000, trending, emails, subscribers);

    //scan for emails older than 15mins, type: 'test', blacklisted < Math.ceil(first_responders.length * 0.01)
    //send to the rest of subscribers, mark type: published.
    setInterval(function(emails, subscribers)
    {
        emails.find({ hashtag: { $exists: true }, type: 'test', created_at: { $lt: new Date(new Date() - 15 * 60 * 1000 ) } }).each(function (err, email)
        {
            if (err) throw err;
            if (email === null)
                return;

            var update = {};
            if (email.blacklisted >= Math.ceil(email.tested_subscribers.length * 0.1))
            {
                update = { type: 'rejected' };
            }
            else
            {
                update = { type: 'approved' };
                // send to the rest
                subscribers.find().each(function(err, subscriber)
                {
                    if (err) throw err;

                    if (subscriber === null)
                        return;
                    // not yet sent
                    if (email.tested_subscribers.indexOf(subscriber.email) === -1)
                    {
                        sendEmailToSubscriber(subscriber, email.trend);
                    }
                });
            }
            emails.updateOne({ _id: email._id }, { $set: update }, function(err, updt)
            {
                if (err) throw err;
            });
        });
    }, 50 * 1000, emails, subscribers);
};

module.exports = mailer;