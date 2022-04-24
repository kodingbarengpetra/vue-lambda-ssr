'use strict';

const chromium = require('chrome-aws-lambda');

async function renderFromUrl(url) {
    let browser = null;
    let response = null;
    try {
        browser = await chromium.puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        const page = await browser.newPage();
        const response = await page.goto(url, { 
            waitUntil: ['domcontentloaded', 'load', "networkidle0"]
        });
    } catch (error) {
        console.log(error);
        return response;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    return response;
}

exports.handler =  async function(event, context, callback) {

    console.log('Event: ', JSON.stringify(event, null, 2));
    console.log('Context: ', JSON.stringify(context, null, 2));

    const path = event.rawPath;

    return {
        statusCode: 200,
        body: 'Hello Lambda!',
    }
}
