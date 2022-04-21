#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VueLambdaSsrStack } from '../lib/cdk-stack';

const app = new cdk.App();
new VueLambdaSsrStack(app, 'VueLambdaSsrStack', {
});
