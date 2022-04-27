const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const https = require('https');

const REGION = 'us-east-1';

async function getSecrets() {
    const client = new SecretsManagerClient({
        region: REGION
    });
    const command = new GetSecretValueCommand({
        SecretId: 'VUE_SSR_LAMBDA_EDGE_SECRETS',
    });

    const response = await client.send(command);
    const retval = JSON.parse(response.SecretString);
    console.log(retval);

    return retval;
}

async function invokeLambda(arn) {
    const client = new LambdaClient({
        region: REGION
    });
    const command = new InvokeCommand({
        FunctionName: arn,
    });
    const response = await client.send(command);
    console.log(response.StatusCode);
}

function requestUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                console.log(body);
                resolve(body);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

exports.handler =  async function(event, context, callback) {
    console.log('Event: ', JSON.stringify(event, null, 2));
    const request = event.Records[0].cf.request;
    const secrets = await getSecrets();
    const functionArn = secrets['FUNCTION_ARN'];
    const functionUrl = secrets['FUNCTION_URL'];

    switch (request['uri']) {
        case '/file1.html':
            console.log(`Invoking Lambda via Function URL: ${functionUrl}`);
            await requestUrl(functionUrl);
            break;
        case '/file2.html':
            console.log(`Invoking Lambda via SDK: ${functionArn}`);
            await invokeLambda(functionArn);
            break;
        case '/file3.html':
            const url = 'https://www.example.com';
            console.log(`Invoking Non-AWS URL: ${url}`);
            await requestUrl(url);
            break;
        default:
            break;
    }
    
    callback(null, request);
}

// function isRequestFromBot(headers) {
//     let isBot = false;
//     const headerName = 'x-is-bot';
//     if (headers[headerName]) {
//         if (headers[headerName].length > 0) {
//             isBot = (headers[headerName][0].value === 'true')
//         }
//     }
//     return isBot;
// }

// async function getRenderTargetPageUrlFromRequest(request) {
//     const rendererUrl = await getRendererFunctionUrlFromSecrets();
//     const pageUrl = rendererUrl.replace(/\/+$/, '') + request['uri'];
//     console.log(pageUrl);
//     return pageUrl;
// }

// function invokeRender(pageUrl) {
//     console.log(`Hitting renderer function with url: ${pageUrl}`);
//     const resp = https.get(pageUrl, (res) => {
//         console.log('statusCode:', res.statusCode);
//         console.log('headers:', res.headers);

//         let body = '';

//         res.on('data', (data) => {
//             body += data;
//         });

//         res.on('end', () => {
//             console.log(`End request: ${body}`);
//         });
//     })

//     resp.on('error', (e) => {
//         console.error(e);
//     });
// }

// async function modifyRequestHeaderToRenderBucket(request) {
//     const rendererDomain = await getRenderBucketDomainNameFromSecrets();
//     console.log(rendererDomain);
//     request.headers['host'] = [{key: 'host',  value: rendererDomain}];
//     if (request.origin.custom) {
//         request.origin.custom.domainName = rendererDomain;
//     } else if (request.origin.s3) {
//         request.origin.s3.domainName = rendererDomain;
//     }
// }

// exports.handler =  async function(event, context, callback) {
//     const cf = event.Records[0].cf;
//     const request = cf.request;

//     if (!isRequestFromBot(request.headers)) {
//         console.log('Request not from bot');
//         console.log('Request: ', JSON.stringify(request, null, 2));
//         callback(null, request);
//         return;
//     }

//     console.log('Request from bot');
//     try {
//         const pageUrl = await getRenderTargetPageUrlFromRequest(request);
//         //invokeRender('https://en430bekoryrd.x.pipedream.net/');
//         invokeRender(pageUrl);
//         //await new Promise(resolve => setTimeout(resolve, 5000));
//         //await sleep(1500);
//         await modifyRequestHeaderToRenderBucket(request);    
//     } catch (error) {
//         console.log(`Error: ${error}`);
//     }
    
//     console.log('Request: ', JSON.stringify(request, null, 2));
//     callback(null, request);
// }
