require('dotenv').config();

var config = {};

config.url = 'http://trendingnow.io';

config.admin = { email: 'contact@trendingnow.io',
                name: 'trendingnow.io'};

config.commonSenseEdgeHashtag = 1000; // do not let pass hashtags with less that that amount of mentions. 150; 200;
config.zScorePos = 1.95; //2.58; // 1.95;
config.zScoreNeg = -1.95; //2.58; //-1.95
config.zScoreHashtagEmail = 3.5;

config.mailgun = {apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN};
config.mailgun.mailingList = process.env.MAILGUN_MAILING_LIST;

config.twitter = {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms: 60 * 1000,
};

config.mongodb = {
    url: process.env.MONGODB_URL
};

config.messenger = {
    token: 'EAABupC0sX0QBAChTTImUeWX51GpBgG8c2WYoyNjrbgoynF9Poo8kK8zZBDYVUXNn3WZA7KAcD7LRdmMTYVqWNr8qFYxPfQTxOVmeBQOxqTvKoHqefftjSysJal89JTgx3LfGpcfKNi5R7UUi9ajDlrajvTzvMh4KNQZBZBcuWAZDZD',
    url: 'https://graph.facebook.com/v2.6/me' };

// if only this part of a word matches, the whole word is removed
config.filter = [
'#voice',
'nowshowing',
'newvideo',
'#news',
'video',
'#aldub',
'amateur',
'anal',
'amateur',
'wife',
'dick',
'mirrorphotos',
'porngif',
'fuck',
'adult',
'teen',
'follow',
'giveaway',
'#giveaway',
'cumshot',
'blowjob',
'sex',
'porn',
'fuck',
'ass',
'pussy',
'sexy',
'xxx',
'naked',
'horny',
'whore',
'boobs',
'tits',
'anal',
'deepthroat',
'http',
'https',
'#dolceamore',
];

// complete words like this are removed
config.forbiddenWords = [
'#jobs',
'#hiring',
'#gameinsight',
'#soundcloud',
'#inspiration',
'nsfw',
'#love',
'#music',
'#android',
'#breakingnews',
'quote',
'#quote',
'#beauty',
'#followtrick',
'followtrick',
'#sale',
'sale',
'deals',
'#deals',
'nude',
'#nude',
'hot',
'sex',
'wet',
'cum',
'girls',
'#cam',
'#hardcore',
'#twitter',
'#androidgames',
'#teamfollowback',
'#retweet',
'#f4f',
'#nowplaying',
'amp',
'are',
'more',
'via',
'its',
'ad',
'#ad',
'is',
'rt',
'the',
'of',
'and',
'to',
'a',
'in',
'for',
'is',
'on',
'that',
'by',
'this',
'with',
'i',
'you',
'it',
'not',
'or',
'be',
'are',
'from',
'at',
'as',
'your',
'all',
'have',
'new',
'more',
'an',
'was',
'we',
'will',
'home',
'can',
'us',
'about',
'if',
'page',
'my',
'has',
'search',
'free',
'but',
'our',
'one',
'other',
'do',
'no',
'information',
'time',
'they',
'site',
'he',
'up',
'may',
'what',
'which',
'their',
'news',
'out',
'use',
'any',
'there',
'see',
'only',
'so',
'his',
'when',
'contact',
'here',
'business',
'who',
'web',
'also',
'now',
'help',
'get',
'pm',
'view',
'online',
'c',
'e',
'first',
'am',
'been',
'would',
'how',
'were',
'me',
's',
'services',
'some',
'these',
'click',
'its',
'like',
'service',
'x',
'than',
'find',];

module.exports = config;