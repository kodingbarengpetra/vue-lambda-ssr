'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const https = require('https');

const RENDERER_FUNCTION_SECRET_ID = 'RENDERER_FUNCTION_URL';
const RENDER_BUCKET_SECRET_ID = 'RENDER_BUCKET_DOMAIN_NAME';
const SECRET_REGION = 'us-east-1';

async function getRendererFunctionUrlFromSecrets() {
    const client = new SecretsManagerClient({
        region: SECRET_REGION,
    });
    const command = new GetSecretValueCommand({
        SecretId: RENDERER_FUNCTION_SECRET_ID,
    });

    const response = await client.send(command);

    return response.SecretString;
}

async function getRenderBucketDomainNameFromSecrets() {
    const client = new SecretsManagerClient({
        region: SECRET_REGION,
    });
    const command = new GetSecretValueCommand({
        SecretId: RENDER_BUCKET_SECRET_ID,
    });

    const response = await client.send(command);

    return response.SecretString;
}

function isRequestFromBot(headers) {
    let isBot = false;
    const headerName = 'x-is-bot';
    if (headers[headerName]) {
        if (headers[headerName].length > 0) {
            isBot = (headers[headerName][0].value === 'true')
        }
    }
    return isBot;
}

async function getRenderTargetPageUrlFromRequest(request) {
    const rendererUrl = await getRendererFunctionUrlFromSecrets();
    const pageUrl = rendererUrl.replace(/\/+$/, '') + request['uri'];
    console.log(pageUrl);
    return pageUrl;
}

async function invokeRender(pageUrl) {
    return new Promise((resolve, reject) => {
        https.get(pageUrl, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                console.log(body);
                resolve(body);
            });
            res.on('error', (error) => {
                reject(error);
            });
        });
    });
    // console.log(`Invoking render function for ${pageUrl}`);
    // const renderResponse = await axios.get(pageUrl);
    // console.log(renderResponse.data);
}

async function modifyRequestHeaderToRenderBucket(request) {
    const rendererDomain = await getRenderBucketDomainNameFromSecrets();
    console.log(rendererDomain);
    request.headers['host'] = [{key: 'host',  value: rendererDomain}];
    if (request.origin.custom) {
        request.origin.custom.domainName = rendererDomain;
    } else if (request.origin.s3) {
        request.origin.s3.domainName = rendererDomain;
    }
}

exports.handler =  async function(event, context, callback) {
    const cf = event.Records[0].cf;
    const request = cf.request;

    if (!isRequestFromBot(request.headers)) {
        console.log('Request not from bot');
        console.log('Request: ', JSON.stringify(request, null, 2));
        callback(null, request);
        return;
    }

    console.log('Request from bot');
    try {
        const pageUrl = await getRenderTargetPageUrlFromRequest(request);
        await invokeRender(pageUrl);
        await modifyRequestHeaderToRenderBucket(request);    
    } catch (error) {
        console.log(`Error: ${error}`);
    }
    
    console.log('Request: ', JSON.stringify(request, null, 2));
    callback(null, request);
}
