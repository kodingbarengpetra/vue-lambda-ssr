'use strict';

const chromium = require('chrome-aws-lambda');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

async function renderFromUrl(url) {
    let browser = null;
    let response = null;
    let content = null;
    let headers = null;

    try {
        browser = await chromium.puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        const page = await browser.newPage();
        response = await page.goto(url, { 
            waitUntil: ['domcontentloaded', 'load', "networkidle0"]
        });
        headers = response.headers();
        if (isContentTypeBinary(headers['content-type'])) {
            content = await response.buffer();
        } else {
            content = await page.content();
        }
        
    } catch (error) {
        console.log(error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    return {
        headers: headers,
        body: content,
    }
}

function isContentTypeBinary(contentType) {
    return contentType.startsWith('image/') || 
        contentType.startsWith('audio/') || 
        contentType.startsWith('video/');
}

async function writeRenderedPageToObject(path, headers, body) {
    const bucket = process.env.RENDER_BUCKET;
    const cleaned = path.replace(/^\/|\/$/g, '')
    const key = (cleaned == '') ? 'index.html' : cleaned;

    const client = new S3Client({});
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: headers['content-type']
    });

    const response = await client.send(command);
    console.log(response);
}

exports.handler =  async function(event, context, callback) {

    console.log('Event: ', JSON.stringify(event, null, 2));
    console.log('Context: ', JSON.stringify(context, null, 2));

    console.log(`SITE_BUCKET_URL ${process.env.SITE_BUCKET_URL}`);
    console.log(`RENDER_BUCKET ${process.env.RENDER_BUCKET}`);

    const path = event.rawPath;
    const siteBucket = process.env.SITE_BUCKET_URL;
    const url = `http://${siteBucket}${path}`;

    try {
        const response = await renderFromUrl(url);
        await writeRenderedPageToObject(path, response.headers, response.body);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: {
                message: `Rendered ${url} to s3://${process.env.RENDER_BUCKET}${path}`,
            }
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: `Error ${error}`
        }
    }
}
