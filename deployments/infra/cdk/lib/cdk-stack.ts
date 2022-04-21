import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { CachePolicy, Distribution, OriginAccessIdentity, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

export class VueLambdaSsrStack extends Stack {
    private distribution: Distribution;
    private bucket: Bucket;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.bucket = this.createBucket();
        this.distribution = this.createDistribution(this.bucket);
        this.deploy(this.bucket, this.distribution);
        this.outputs();
    }

    createBucket(): Bucket {
        const bucket = new Bucket(this, 'Bucket', {
            websiteIndexDocument: 'index.html',
            publicReadAccess: true,
        });
        return bucket;
    }

    createDistribution(bucket: Bucket): Distribution {
        const originAccessIdentity = this.createOai(bucket);
        const origin = new S3Origin(bucket, {
            originPath: '/',
            originAccessIdentity
        });

        const distribution = new Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin,
                cachePolicy: CachePolicy.CACHING_DISABLED,
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                }
            ],
        });

        return distribution;
    }

    createOai(bucket: Bucket) {
        const oai = new OriginAccessIdentity(this, 'Oai', {
            comment: 'Mobile Web Origin Access Identity ' + this.node.id
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
        bucket.grantRead(oai);

        return oai;
    }

    deploy(bucket: Bucket, distribution: Distribution) {
        const assetPath = path.join(__dirname, '../../../../web/dist');
        new BucketDeployment(this, 'DeployWebsite', {
            sources: [
                Source.asset(assetPath)
            ],
            destinationBucket: bucket,
            distribution,
            distributionPaths: ['/*'],
        });
    }
    
    outputs() {
        return [
            new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName }),
            new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId }),
            new CfnOutput(this, 'DistributionDns', { value: this.distribution.distributionDomainName }),
        ];
    }
}
