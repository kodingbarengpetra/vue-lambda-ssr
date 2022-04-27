'use strict';

const chromium = require('chrome-aws-lambda');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");


const WEBSITE_BUCKET_DOMAIN_NAME = process.env.WEBSITE_BUCKET_DOMAIN_NAME;
const RENDER_BUCKET_NAME = process.env.RENDER_BUCKET_NAME;

exports.handler =  async function(event, context, callback) {
    console.log('Event: ', JSON.stringify(event, null, 2));

    console.log(WEBSITE_BUCKET_DOMAIN_NAME);
    console.log(RENDER_BUCKET_NAME);
    
    return {
        statusCode: 200,
        headers: {
           'Content-Type': 'text/plain',
        },
        body: 'Hello World!',
    }
}
