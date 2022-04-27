'use strict';

function isBot(userAgent) {
    if (!userAgent) {
        return false;
    }
    const regexBot = new RegExp('bot|crawler|spider|crawling|facebook|twitter|slack', 'i')
    return regexBot.test(userAgent);
}

function getBotRequestHeader(userAgent) {
    if (isBot(userAgent)) {
        return [
            { key: 'x-is-bot', value: 'true' }
        ];
    }
    return [
        { key: 'x-is-bot', value: 'false' }
    ];
}

exports.handler =  async function(event, context, callback) {
    const cf = event.Records[0].cf;
    const request = cf.request;
    const response = cf.response;
    
    let userAgent = request.headers['user-agent'][0].value;
    request.headers['x-is-bot'] = getBotRequestHeader(userAgent);

    callback(null, request);
}
