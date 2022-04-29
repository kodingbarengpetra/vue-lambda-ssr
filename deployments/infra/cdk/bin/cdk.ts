#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VueLambdaSsrEdgeStack } from '../lib/site-stack';

const app = new cdk.App();

new VueLambdaSsrEdgeStack(app, 'VueLambdaSsrEdge2Stack', {
    env: {
        region: 'us-east-1',
    }
});
