const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const https = require('https');

const REGION = 'us-east-1';

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

async function invokeRendererLambda(arn, path) {
    const client = new LambdaClient({
        region: REGION
    });
    const command = new InvokeCommand({
        FunctionName: arn,
        Payload: JSON.stringify({
            path: path
        })
    });
    const response = await client.send(command);
    console.log(response.StatusCode);
}

async function modifyRequestHeaderToRenderBucket(request, rendererDomain) {
    request.headers['host'] = [{key: 'host',  value: rendererDomain}];
    if (request.origin.custom) {
        request.origin.custom.domainName = rendererDomain;
    } else if (request.origin.s3) {
        request.origin.s3.domainName = rendererDomain;
    }
}

exports.handler =  async function(event, context, callback) {
    console.log('Event: ', JSON.stringify(event, null, 2));
    const request = event.Records[0].cf.request;

    const secrets = await getSecrets();
    const functionArn = secrets['FUNCTION_ARN'];
    const renderBucketDomain = secrets['RENDER_BUCKET_DOMAIN'];

    if (!isRequestFromBot(request.headers)) {
        console.log('Request not from bot');
        console.log('Request: ', JSON.stringify(request, null, 2));
        callback(null, request);
        return;
    }

    console.log('Request from bot');
    const path = request['uri'];

    try {
        await invokeRendererLambda(functionArn, path);
        await modifyRequestHeaderToRenderBucket(request, renderBucketDomain);
    } catch (err) {
        console.log(err);
    }

    console.log('Request: ', JSON.stringify(request, null, 2));
    callback(null, request);
}
