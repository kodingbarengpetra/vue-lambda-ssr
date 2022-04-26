'use strict';

const chromium = require('chrome-aws-lambda');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

exports.handler =  async function(event, context, callback) {
    console.dir(event);
    
    return {
        statusCode: 200,
        headers: {
           'Content-Type': 'text/plain',
        },
        body: 'Hello World!',
    }
}
