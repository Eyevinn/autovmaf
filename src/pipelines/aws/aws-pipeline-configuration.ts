export type AWSPipelineConfiguration = {
  s3Bucket: string;
  mediaConvertRole: string;
  mediaConvertEndpoint: string;
  mediaConvertSettings: any;
  ecsSubnet: string;
  ecsSecurityGroup: string;
  ecsCluster: string;
  ecsContainerName: string;
  ecsTaskDefinition: string;
};
