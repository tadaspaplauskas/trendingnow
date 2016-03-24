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

module.exports = helpers;