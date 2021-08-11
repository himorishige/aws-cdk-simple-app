import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda-nodejs';
import * as cdk from '@aws-cdk/core';
import { Runtime } from '@aws-cdk/aws-lambda';
import * as path from 'path';
import { BucketDeployment, Source } from '@aws-cdk/aws-s3-deployment';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { CorsHttpMethod, HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { CloudFrontWebDistribution, Distribution } from '@aws-cdk/aws-cloudfront';
import { ARecord, IPublicHostedZone, RecordTarget } from '@aws-cdk/aws-route53';
import { ICertificate } from '@aws-cdk/aws-certificatemanager';
import { S3Origin } from '@aws-cdk/aws-cloudfront-origins';
import { CloudFrontTarget } from '@aws-cdk/aws-route53-targets';
import { S3BucketWithDeploy } from './s3-bucket-with-deploy';

interface SimpleAppStackProps extends cdk.StackProps {
  dnsName: string;
  hostedZone: IPublicHostedZone;
  certificate: ICertificate;
}

export class SimpleAppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: SimpleAppStackProps) {
    super(scope, id, props);
    const { dnsName, hostedZone, certificate } = props;

    const { bucket } = new S3BucketWithDeploy(this, 'MySimpleAppCustomBucket', {
      deployTo: ['..', 'photos'],
      encryption: BucketEncryption.S3_MANAGED,
    });

    const websiteBucket = new Bucket(this, 'MySimpleAppWebsiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
    });

    const cloudFront = new Distribution(this, 'MySimpleAppDistribution', {
      defaultBehavior: { origin: new S3Origin(websiteBucket) },
      domainNames: [dnsName],
      certificate: certificate,
    });

    new ARecord(this, 'MySimpleAppARecordApex', {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFront)),
    });

    // const cloudFront1 = new CloudFrontWebDistribution(this, 'MySimpleAppDistribution', {
    //   originConfigs: [
    //     {
    //       s3OriginSource: {
    //         s3BucketSource: websiteBucket,
    //       },
    //       behaviors: [{ isDefaultBehavior: true }],
    //     },
    //   ],
    // });

    new BucketDeployment(this, 'MySimpleAppWebsiteDeploy', {
      sources: [Source.asset(path.join(__dirname, '..', 'frontend', 'build'))],
      destinationBucket: websiteBucket,
      distribution: cloudFront,
    });

    const getPhotos = new lambda.NodejsFunction(this, 'MySimpleAppLambda', {
      runtime: Runtime.NODEJS_14_X,
      entry: path.join(__dirname, '..', 'api', 'get-photos', 'index.ts'),
      handler: 'getPhotos',
      environment: {
        PHOTO_BUCKET_NAME: bucket.bucketName,
      },
    });

    const bucketContainerPermissions = new PolicyStatement();
    bucketContainerPermissions.addResources(bucket.bucketArn);
    bucketContainerPermissions.addActions('s3:ListBucket');

    const bucketPermissions = new PolicyStatement();
    bucketPermissions.addResources(`${bucket.bucketArn}/*`);
    bucketPermissions.addActions('s3:GetObject', 's3:PutObject');

    getPhotos.addToRolePolicy(bucketPermissions);
    getPhotos.addToRolePolicy(bucketContainerPermissions);

    const httpApi = new HttpApi(this, 'MySimpleAppHttpApi', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [CorsHttpMethod.GET],
      },
      apiName: 'photo-api',
      createDefaultStage: true,
    });

    const lambdaIntegration = new LambdaProxyIntegration({
      handler: getPhotos,
    });

    httpApi.addRoutes({
      path: '/getAllPhotos',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: lambdaIntegration,
    });

    new cdk.CfnOutput(this, 'MySimpleAppBucketNameExport', {
      value: bucket.bucketName,
      exportName: `MySimpleAppBucketName`,
    });

    new cdk.CfnOutput(this, 'MuSimpleAppWebsiteBucketNameExport', {
      value: websiteBucket.bucketName,
      exportName: `MySimpleAppWebsiteBucketName`,
    });

    new cdk.CfnOutput(this, 'MySimpleAppWebsiteUrl', {
      value: cloudFront.distributionDomainName,
      exportName: `MySimpleAppUrl`,
    });

    new cdk.CfnOutput(this, 'MySimpleAppApi', {
      value: httpApi.url!,
      exportName: `MySimpleAppApiEndpoint`,
    });
  }
}
