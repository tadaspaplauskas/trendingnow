var helpers = {};

helpers.removePunctuation = function (str)
{
    return str.replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, '');
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


module.exports = helpers;