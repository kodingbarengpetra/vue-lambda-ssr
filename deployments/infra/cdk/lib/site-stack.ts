import { CfnOutput, RemovalPolicy, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { CachePolicy, Distribution, LambdaEdgeEventType, OriginAccessIdentity, OriginRequestHeaderBehavior, OriginRequestPolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Code, Function, FunctionUrl, FunctionUrlAuthType, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source as S3Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';
import { Secret, ReplicaRegion } from 'aws-cdk-lib/aws-secretsmanager';

export class VueLambdaSsrStack extends Stack {
    private logBucket: Bucket;
    private siteBucket: Bucket;
    private rendererFunctionUrlSecret: Secret;
    private distribution: Distribution;
    private viewerRequestEdgeFunction: cloudfront.experimental.EdgeFunction;
    private originResponseEdgeFunction: cloudfront.experimental.EdgeFunction;
    private rendererFunction: Function;
    private rendererFunctionUrl: FunctionUrl;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.logBucket = this.createLogBucket();
        this.siteBucket = this.createSiteBucket(this.logBucket);
        this.rendererFunction = this.createRendererFunction();
        this.rendererFunctionUrl = this.createRendererFunctionUrl(this.rendererFunction);
        this.rendererFunctionUrlSecret = this.createRendererFunctionUrlSecret(this.rendererFunctionUrl.url);

        this.viewerRequestEdgeFunction = this.createViewerRequestEdgeFunction();
        this.originResponseEdgeFunction = this.createOriginResponseEdgeFunction();
        
        this.rendererFunctionUrlSecret.grantRead(this.originResponseEdgeFunction);
        
        this.distribution = this.createDistribution(
            this.siteBucket,
            this.logBucket,
            this.viewerRequestEdgeFunction,
            this.originResponseEdgeFunction
        );

        this.deploySite(this.siteBucket);

        this.outputs();
    }

    createLogBucket(): Bucket {
        return  new Bucket(this, 'LogBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
        });
    }

    createSiteBucket(logBucket: Bucket): Bucket {
        return new Bucket(this, 'Bucket', {
            websiteIndexDocument: 'index.html',
            publicReadAccess: true,
            serverAccessLogsBucket: logBucket,
            serverAccessLogsPrefix: 'bucket-access/',
            removalPolicy: RemovalPolicy.DESTROY,
        });
    }

    createRendererFunctionUrlSecret(url: string) {
        return new Secret(this, 'RendererFunctionUrlSecret', {
            secretName: 'RENDERER_FUNCTION_URL',
            secretStringValue: new SecretValue(url),
            removalPolicy: RemovalPolicy.DESTROY,
        });
    }

    createViewerRequestEdgeFunction(): cloudfront.experimental.EdgeFunction {
        const assetPath = path.join(__dirname, '../../../../lambda/edge-viewer-request');
        const code = Code.fromAsset(assetPath);     
        return new cloudfront.experimental.EdgeFunction(this, `ViewerRequestEdgeFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
        });
    }

    createOriginResponseEdgeFunction(): cloudfront.experimental.EdgeFunction {
        const assetPath = path.join(__dirname, '../../../../lambda/edge-origin-response');
        const code = Code.fromAsset(assetPath);     
        return new cloudfront.experimental.EdgeFunction(this, `OriginResponseEdgeFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
        });
    }

    createRendererFunction(): Function {
        const assetPath = path.join(__dirname, '../../../../lambda/renderer');
        const code = Code.fromAsset(assetPath);     
        return new Function(this, `RendererFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
        });
    }

    createRendererFunctionUrl(func: Function): FunctionUrl {
        return func.addFunctionUrl({
            authType: FunctionUrlAuthType.NONE,
        });
    }

    createDistribution(siteBucket: Bucket, logBucket: Bucket, viewerRequestEdgeFunction: cloudfront.experimental.EdgeFunction, originResponseEdgeFunction: cloudfront.experimental.EdgeFunction): Distribution {
        const origin = new S3Origin(siteBucket, {
            originPath: '/'
        });

        const requestPolicy = new OriginRequestPolicy(this, 'OriginRequestPolicy', {
            headerBehavior: OriginRequestHeaderBehavior.allowList(
                'X-Is-Bot',
            )
        });
        return new Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin,
                cachePolicy: CachePolicy.CACHING_DISABLED,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                edgeLambdas: [
                    {
                        functionVersion: viewerRequestEdgeFunction.currentVersion,
                        eventType: LambdaEdgeEventType.VIEWER_REQUEST,
                    },
                    {
                        functionVersion: originResponseEdgeFunction.currentVersion,
                        eventType: LambdaEdgeEventType.ORIGIN_REQUEST,
                    }
                ],
                originRequestPolicy: requestPolicy,
            },
            logBucket: logBucket,
            logFilePrefix: 'cloudfront-access/',
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                }
            ],
        });
    }

    deploySite(siteBucket: Bucket) {
        const assetPath = path.join(__dirname, '../../../../web/dist');
        new BucketDeployment(this, 'DeployWebsite', {
            sources: [
                S3Source.asset(assetPath)
            ],
            destinationBucket: siteBucket,
        });
    }

    outputs() {
        return [
            new CfnOutput(this, 'BucketName', { value: this.siteBucket.bucketName }),
            new CfnOutput(this, 'BucketDomainName', { value: this.siteBucket.bucketDomainName }),
            new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId }),
            new CfnOutput(this, 'DistributionDns', { value: this.distribution.distributionDomainName }),    
            new CfnOutput(this, 'RendererFunctionUrl', { value: this.rendererFunctionUrl.url }),
        ];
    }
}
