'use strict';

const chromium = require('chrome-aws-lambda');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const WEBSITE_BUCKET_DOMAIN_NAME = process.env.WEBSITE_BUCKET_DOMAIN_NAME;
const RENDER_BUCKET_NAME = process.env.RENDER_BUCKET_NAME;

async function renderFromPath(path) {
    let browser = null;
    let response = null;
    let content = null;
    let headers = null;
    
    const requestPath = path == '/index.html' ? '': path;
    const url = `http://${WEBSITE_BUCKET_DOMAIN_NAME}${requestPath}`;
    console.log(url);

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
        if (headers['content-type'] == 'text/html') {
            content = await page.content();
        } else {
            content = await response.buffer();
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

async function writeRenderedPageToObject(path, headers, body) {
    const cleaned = path.replace(/^\/|\/$/g, '')
    const key = (cleaned == '') ? 'index.html' : cleaned;

    const client = new S3Client({});
    const command = new PutObjectCommand({
        Bucket: RENDER_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: headers['content-type']
    });

    const response = await client.send(command);
    console.log(response);
}

exports.handler =  async function(event, context, callback) {
    console.log('Event: ', JSON.stringify(event, null, 2));

    const path = event.path ? event.path : '';

    try {
        const response = await renderFromPath(path);
        console.log(response);
        await writeRenderedPageToObject(path, response.headers, response.body);
        
        return {
            statusCode: 200,
            headers: {
               'Content-Type': 'text/plain',
            },
            body: 'Hello World!',
        }
    } catch (err) {
        return {
            statusCode: 500,
            body: `Error ${err}`
        }
    }
}
