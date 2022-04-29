import { CfnOutput, Duration, RemovalPolicy, SecretValue, Size, Stack, StackProps } from 'aws-cdk-lib';
import { CachePolicy, Distribution, IOrigin, LambdaEdgeEventType, OriginAccessIdentity, OriginRequestHeaderBehavior, OriginRequestPolicy, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { OriginGroup, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Code, Function, FunctionUrl, FunctionUrlAuthType, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source as S3Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class VueLambdaSsrEdgeStack extends Stack {
    private websiteBucket: Bucket;
    private renderBucket: Bucket;
    private logBucket: Bucket;
    private distribution: Distribution;

    private originRequestFunctionSecrets: Secret;
    private rendererFunction: Function;
    private rendererFunctionUrl: FunctionUrl;

    private originRequestEdgeFunction: cloudfront.experimental.EdgeFunction;
    private viewerRequestEdgeFunction: cloudfront.experimental.EdgeFunction;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.logBucket = this.createLogBucket();

        this.websiteBucket = this.createWebsiteBucket(this.logBucket);
        this.renderBucket = this.createRenderBucket(this.logBucket);
        this.rendererFunction = this.createRendererFunction(
            this.websiteBucket,
            this.renderBucket
        );
        this.rendererFunctionUrl = this.rendererFunction.addFunctionUrl({
            authType: FunctionUrlAuthType.NONE,
        });
        this.originRequestFunctionSecrets = this.createRendererFunctionSecret({
            FUNCTION_ARN: this.rendererFunction.functionArn,
            FUNCTION_URL: this.rendererFunctionUrl.url,
            RENDER_BUCKET_DOMAIN: this.renderBucket.bucketRegionalDomainName,
        });

        this.originRequestEdgeFunction = this.createOriginRequestEdgeFunction();
        this.viewerRequestEdgeFunction = this.createViewerRequestEdgeFunction();

        this.rendererFunction.grantInvoke(this.originRequestEdgeFunction);
        this.rendererFunctionUrl.grantInvokeUrl(this.originRequestEdgeFunction);

        this.originRequestFunctionSecrets.grantRead(this.originRequestEdgeFunction);

        this.distribution = this.createDistribution(
            this.websiteBucket,
            this.renderBucket,
            this.logBucket,
            this.originRequestEdgeFunction,
            this.viewerRequestEdgeFunction
        );
        this.outputs();
    }

    createLogBucket(): Bucket {
        return  new Bucket(this, 'LogBucket', {
        });
    }

    createWebsiteBucket(logBucket: Bucket) {
        const bucket = new Bucket(this, 'WebsiteBucket', {
            serverAccessLogsBucket: logBucket,
            serverAccessLogsPrefix: 'bucket-access/',
        });

        const assetPath = path.join(__dirname, '../../../../web/dist');
        new BucketDeployment(this, 'DeployWebsite', {
            sources: [
                S3Source.asset(assetPath)
            ],
            destinationBucket: bucket,
        });

        return bucket;
    }

    createRenderBucket(logBucket: Bucket): Bucket {
        return new Bucket(this, 'RenderBucket', {
            serverAccessLogsBucket: logBucket,
            serverAccessLogsPrefix: 'render-bucket-access/',
            versioned: true
        });
    }

    createRendererFunction(websiteBucket: Bucket, renderBucket: Bucket) {
        const assetPath = path.join(__dirname, '../../../../lambda/renderer');
        const code = Code.fromAsset(assetPath);    

        const func = new Function(this, 'RendererFunction', {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
            memorySize: 10240,
            ephemeralStorageSize: Size.gibibytes(1),
            timeout: Duration.seconds(30),
            environment: {
                WEBSITE_BUCKET_DOMAIN_NAME: websiteBucket.bucketWebsiteDomainName,
                RENDER_BUCKET_NAME: renderBucket.bucketName,
            }
        });

        renderBucket.grantReadWrite(func);
        return func;
    }

    createRendererFunctionSecret(secret: any) {
        return new Secret(this, 'RendererFunctionSecret', {
            secretName: 'VUE_SSR_LAMBDA_EDGE_2_SECRETS',
            secretStringValue: new SecretValue(JSON.stringify(secret)),
            removalPolicy: RemovalPolicy.DESTROY,
        });
    }

    createOriginRequestEdgeFunction() {
        const assetPath = path.join(__dirname, '../../../../lambda/edge-origin-request');
        const code = Code.fromAsset(assetPath);     
        return new cloudfront.experimental.EdgeFunction(this, `OriginRequestEdgeFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
            timeout: Duration.seconds(30),
        });
    }

    createViewerRequestEdgeFunction() {
        const assetPath = path.join(__dirname, '../../../../lambda/edge-viewer-request');
        const code = Code.fromAsset(assetPath);     
        return new cloudfront.experimental.EdgeFunction(this, `ViewerRequestEdgeFunction`, {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code,
            timeout: Duration.seconds(5),
        });
    }

    createDistribution(
        websiteBucket: Bucket,
        renderBucket: Bucket,
        logBucket: Bucket,
        originRequestEdgeFunction: cloudfront.experimental.EdgeFunction,
        viewerRequestEdgeFunction: cloudfront.experimental.EdgeFunction
    ) {
        const origin = this.createDistributionOrigin(websiteBucket, renderBucket);

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
                originRequestPolicy: requestPolicy,
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

    createDistributionOrigin(websiteBucket: Bucket,
        renderBucket: Bucket): IOrigin {
        return new OriginGroup({
            primaryOrigin: this.createBucketOrigin(websiteBucket),
            fallbackOrigin: this.createBucketOrigin(renderBucket),
        });
    }

    createBucketOrigin(bucket: Bucket) {
        return new S3Origin(bucket, {
            originPath: '/',
            originAccessIdentity: this.createOriginAccessIdentity(bucket),
        });
    }

    createOriginAccessIdentity(bucket: Bucket): OriginAccessIdentity {
        const oai = new OriginAccessIdentity(this, `OriginAccessIdentity_${bucket.node.id}`, {
            comment: 'Origin Access Identity for ' + bucket.node.id,
        });
        const access = new PolicyStatement();
        access.addActions('s3:GetBucket*');
        access.addActions('s3:GetObject*');
        access.addActions('s3:List*');
        access.addResources(bucket.bucketArn);
        access.addResources(`${bucket.bucketArn}/*`);
        access.addCanonicalUserPrincipal(
            oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
        );

        access.addResources(bucket.bucketArn);
        access.addResources(`${bucket.bucketArn}/*`);
        bucket.addToResourcePolicy(access);
        return oai;
    }

    outputs() {
        return [
            new CfnOutput(this, 'WebsiteBucketName', { value: this.websiteBucket.bucketName }),
            new CfnOutput(this, 'WebsiteBucketUrl', { value: this.websiteBucket.bucketWebsiteUrl }),
            new CfnOutput(this, 'RenderBucketName', { value: this.renderBucket.bucketName }),
            new CfnOutput(this, 'RenderBucketUrl', { value: this.renderBucket.bucketWebsiteUrl }),

            new CfnOutput(this, 'RendererFunctionArn', { value: this.rendererFunction.functionArn }),
            new CfnOutput(this, 'RendererFunctionUrl', { value: this.rendererFunctionUrl.url }),
            new CfnOutput(this, 'OriginRequestEdgeFunctionArn', { value: this.originRequestEdgeFunction.edgeArn }),
            new CfnOutput(this, 'ViewerRequestEdgeFunctionArn', { value: this.viewerRequestEdgeFunction.edgeArn }),
            new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId }),
            new CfnOutput(this, 'DistributionDomain', { value: this.distribution.domainName }),
        ];
    }
}
