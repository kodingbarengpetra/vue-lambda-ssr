'use strict';

exports.handler =  async function(event, context, callback) {
    const cf = event.Records[0].cf;
    const request = cf.request;
    const response = cf.response;

    console.log('Event: ', JSON.stringify(event, null, 2));
    console.log('Record: ', JSON.stringify(cf, null, 2));
    console.log('Context: ', JSON.stringify(context, null, 2));
    console.log('Request: ', JSON.stringify(request, null, 2));
    console.log('Response: ', JSON.stringify(response, null, 2));
    
    callback(null, request);
}
