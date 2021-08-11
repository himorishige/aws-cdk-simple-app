#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SimpleAppStack } from '../lib/simple-app-stack';
import { SimpleAppStackDns } from '../lib/simple-app-stack-dns';

const domainNameApex = 'fslabs.jp';

const app = new cdk.App();
const { hostedZone, certificate } = new SimpleAppStackDns(app, 'SimpleAppStackDns', {
  dnsName: domainNameApex,
});

new SimpleAppStack(app, 'SimpleAppStack', {
  dnsName: domainNameApex,
  hostedZone: hostedZone,
  certificate: certificate,
});
