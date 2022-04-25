import { CfnOutput, Duration, RemovalPolicy, SecretValue, Size, Stack, StackProps } from 'aws-cdk-lib';
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
    private renderBucket: Bucket;

    private distribution: Distribution;

    private viewerRequestEdgeFunction: cloudfront.experimental.EdgeFunction;
    private originRequestEdgeFunction: cloudfront.experimental.EdgeFunction;

    private rendererFunction: Function;
    private rendererFunctionUrl: FunctionUrl;

    private rendererFunctionUrlSecret: Secret;
    private renderBucketDomainSecret: Secret;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.logBucket = this.createLogBucket();
        this.siteBucket = this.createSiteBucket(this.logBucket);
        this.renderBucket = this.createRenderBucket(this.logBucket);
        this.renderBucketDomainSecret = this.createRenderBucketDomainSecret(this.renderBucket.bucketWebsiteDomainName);

        this.rendererFunction = this.createRendererFunction(this.siteBucket, this.renderBucket);
        this.rendererFunctionUrl = this.createRendererFunctionUrl(this.rendererFunction);
        this.rendererFunctionUrlSecret = this.createRendererFunctionUrlSecret(this.rendererFunctionUrl.url);

        this.viewerRequestEdgeFunction = this.createViewerRequestEdgeFunction();
        this.originRequestEdgeFunction = this.createOriginRequestEdgeFunction();
        
        this.rendererFunctionUrlSecret.grantRead(this.originRequestEdgeFunction);
        this.renderBucketDomainSecret.grantRead(this.originRequestEdgeFunction);
        
        this.distribution = this.createDistribution(
            this.siteBucket,
            this.logBucket,
            this.viewerRequestEdgeFunction,
            this.originRequestEdgeFunction
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
            websiteErrorDocument: 'index.html',
            publicReadAccess: true,
            serverAccessLogsBucket: logBucket,
            serverAccessLogsPrefix: 'bucket-access/',
            removalPolicy: RemovalPolicy.DESTROY,
        });
    }

    createRenderBucket(logBucket: Bucket): Bucket {
        return new Bucket(this, 'RenderBucket', {
            websiteIndexDocument: 'index.html',
            publicReadAccess: true,
            serverAccessLogsBucket: logBucket,
            serverAccessLogsPrefix: 'render-bucket-access/',
            versioned: true,
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

    createRenderBucketDomainSecret(bucketDns: string) {
        return new Secret(this, 'RenderBucketDomainNameSecret', {
            secretName: 'RENDER_BUCKET_DOMAIN_NAME',
            secretStringValue: new SecretValue(bucketDns),
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

    createOriginRequestEdgeFunction(): cloudfront.experimental.EdgeFunction {
        const assetPath = path.join(__dirname, '../../../../lambda/edge-origin-request');
        const code = Code.fromAsset(assetPath);     
        return new cloudfront.experimental.EdgeFunction(this, `OriginRequestEdgeFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
        });
    }

    createRendererFunction(siteBucket: Bucket, renderBucket: Bucket): Function {
        const assetPath = path.join(__dirname, '../../../../lambda/renderer');
        const code = Code.fromAsset(assetPath);     
        const func = new Function(this, `RendererFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
            memorySize: 10240,
            ephemeralStorageSize: Size.gibibytes(1),
            timeout: Duration.minutes(1),
            environment: {
                SITE_BUCKET_URL: siteBucket.bucketWebsiteDomainName,
                RENDER_BUCKET: renderBucket.bucketName,
            }
        });

        siteBucket.grantRead(func);
        renderBucket.grantReadWrite(func);

        return func;
    }

    createRendererFunctionUrl(func: Function): FunctionUrl {
        return func.addFunctionUrl({
            authType: FunctionUrlAuthType.NONE,
        });
    }

    createDistribution(siteBucket: Bucket, logBucket: Bucket, viewerRequestEdgeFunction: cloudfront.experimental.EdgeFunction, originRequestEdgeFunction: cloudfront.experimental.EdgeFunction): Distribution {
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
                        functionVersion: originRequestEdgeFunction.currentVersion,
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

    createBucketWebsiteDnsSecret(bucket: Bucket): Secret {
        return new Secret(this, 'BucketDomainNameSecret', {
            secretName: 'SITE_BUCKET_DOMAIN_NAME',
            secretStringValue: new SecretValue(bucket.bucketWebsiteDomainName),
            removalPolicy: RemovalPolicy.DESTROY,
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
            new CfnOutput(this, 'SiteBucketName', { value: this.siteBucket.bucketName }),
            new CfnOutput(this, 'SiteBucketDomainName', { value: this.siteBucket.bucketDomainName }),

            new CfnOutput(this, 'RenderBucketName', { value: this.renderBucket.bucketName }),
            new CfnOutput(this, 'RenderBucketDomainName', { value: this.renderBucket.bucketDomainName }),

            new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId }),
            new CfnOutput(this, 'DistributionDns', { value: this.distribution.distributionDomainName }),    

            new CfnOutput(this, 'RendererFunctionUrl', { value: this.rendererFunctionUrl.url }),
        ];
    }
}
