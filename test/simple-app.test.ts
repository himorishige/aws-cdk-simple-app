import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as SimpleApp from '../lib/simple-app-stack';
import '@aws-cdk/assert/jest';

test('Stack create a S3 bucket', () => {
  // ARRANGE
  const app = new cdk.App();
  // ACT
  const stack = new SimpleApp.SimpleAppStack(app, 'MyTestStack');
  // ASSERT
  expect(stack).toHaveResource('AWS::S3::Bucket');
});
