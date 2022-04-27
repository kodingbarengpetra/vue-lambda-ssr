'use strict';

exports.handler =  async function(event, context, callback) {
    console.log('Event: ', JSON.stringify(event, null, 2));
    const request = event.Records[0].cf.request;
    
    callback(null, request);
}

// function isBot(userAgent) {
//     if (!userAgent) {
//         return false;
//     }
//     const regexBot = new RegExp('bot|crawler|spider|crawling|facebook|twitter|slack', 'i')
//     return regexBot.test(userAgent);
// }

// function getBotRequestHeader(userAgent) {
//     if (isBot(userAgent)) {
//         return [
//             { key: 'x-is-bot', value: 'true' }
//         ];
//     }
//     return [
//         { key: 'x-is-bot', value: 'false' }
//     ];
// }

// exports.handler =  async function(event, context, callback) {
//     const cf = event.Records[0].cf;
//     const request = cf.request;
//     const response = cf.response;

//     let userAgent = request.headers['user-agent'][0].value;
    
//     request.headers['x-is-bot'] = getBotRequestHeader(userAgent);
    

//     // console.log('Event: ', JSON.stringify(event, null, 2));
//     // console.log('Record: ', JSON.stringify(cf, null, 2));
//     // console.log('Context: ', JSON.stringify(context, null, 2));
//     // console.log('Request: ', JSON.stringify(request, null, 2));
//     // console.log('Response: ', JSON.stringify(response, null, 2));

//     callback(null, request);
// }
