var Messenger = function (params)
{
    Messenger.helpers = require('./helpers');
    Messenger.request = require('request');
    Messenger.trending = params.trending || null;
    Messenger.emails = params.emails  || null;
    Messenger.subscribers = params.subscribers  || null;
    Messenger.config = params.config  || null;

    return Messenger;
};

Messenger.entry = function(req, res)
{
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++)
    {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;

        if (event.message && event.message.text) {
            Messenger.sendTextMessage(sender, "Text received, echo: "+ event.message.text.substring(0, 200));
        }
    }
    res.sendStatus(200);
};

Messenger.sendTextMessage = function(sender, text) {
    var messageData = {
        text:text
    };
    Messenger.request({
        url: Messenger.config.messenger.url + '/messages',
        qs: { access_token: Messenger.config.messenger.token },
        method: 'POST',
        json: {
          recipient: {id:sender},
          message: messageData,
        }
    }, function(error, response, body)
    {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
        }
    });
};

module.exports = Messenger;