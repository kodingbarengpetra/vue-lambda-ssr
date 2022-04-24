#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VueLambdaSsrStack } from '../lib/site-stack';

const app = new cdk.App();

new VueLambdaSsrStack(app, 'VueLambdaSsrStack', {
    env: {
        region: 'us-east-1',
    }
});
