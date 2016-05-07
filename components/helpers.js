var helpers = {};

helpers.removePunctuation = function (str)
{
    //return str.replace(/\n/g,  ' ').replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, '');
    return str.replace(/\n/g,  ' ').replace(/[^\w# ]/g, '');
};

// prepare keywords array (used for search)
helpers.getLowerCaseKeywordsArray = function (str)
{
    return helpers.removePunctuation(str)
        .toLowerCase()
        .trim()
        .split(' ')
        .filter(String); //remove empty elements
};

// prepare keywords array (used for representation. maybe?)
/*helpers.getKeywordsArray = function (str)
{
    return helpers.removePunctuation(str)
        .trim()
        .split(' ')
        .filter(String); //remove empty elements
};*/

// get current timestamp in seconds
helpers.timestamp = function()
{
    return Math.round(Date.now() / 1000);
};

helpers.isHashtag = function (hashtag)
{
  return (hashtag.charAt(0) === '#' && hashtag.length > 4);
};

helpers.keepValidKeywords = function (keywords, forbidden) //removes links and most common words
{
    return keywords.filter(function(keyword)
    {
        return (forbidden.indexOf(keyword) === -1 && isNaN(keyword) && keyword.substring(0, 4) !== 'http');
    });
};

helpers.average = function (data)
{
    var sum = data.reduce(function(sum, value){
        return sum + value;
    }, 0);

    var avg = sum / data.length;

    return avg;
};

helpers.standardDeviation = function (values)
{
    var avg = helpers.average(values);

    var squareDiffs = values.map(function(value){
        var diff = value - avg;
        var sqrDiff = diff * diff;
        return sqrDiff;
    });

    var avgSquareDiff = helpers.average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);

    return stdDev;
};

helpers.zScore = function (current, values)
{
    var std = helpers.standardDeviation(values);
    var avg = helpers.average(values);

    return (current - avg) / std;
};

helpers.getCurrentHour = function ()
{
    return new Date().getHours();
};

helpers.sum = function (array)
{
    return array.reduce(function(a, b) { return a + b; }, 0);
};

helpers.googleSearchUrl = function (keyword)
{
    return 'https://www.google.lt/search?q=' + encodeURIComponent(keyword);
};

helpers.twitterSearchUrl = function (keyword)
{
    return 'https://twitter.com/search?q=' + encodeURIComponent(keyword);
};

helpers.searchUrl = function (keyword)
{
    return 'http://trendingnow.io/keywords/' + encodeURIComponent(keyword);
};

helpers.url = function (path, params)
{
    return 'http://trendingnow.io/' + path + encodeURIComponent(params);
};

helpers.blacklistUrl = function (subscriberId, keyword)
{
    return 'http://trendingnow.io/subscribers/'+ encodeURIComponent(subscriberId) +'/blacklist/' + encodeURIComponent(keyword);
};

module.exports = helpers;