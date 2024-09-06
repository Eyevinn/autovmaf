import { AccelerationMode } from '@aws-sdk/client-mediaconvert';

export type AWSPipelineConfiguration = {
  inputBucket: string;
  outputBucket: string;
  mediaConvertRole: string;
  mediaConvertEndpoint: string;
  mediaConvertSettings: any;
  ecsSubnet: string;
  ecsSecurityGroup: string;
  ecsCluster: string;
  ecsContainerName: string;
  ecsTaskDefinition: string;
  accelerationMode?: AccelerationMode;
};
