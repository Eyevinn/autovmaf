const default_pipeline = {
  aws: {
    s3Bucket: 'vmaf-files',
    mediaConvertRole: 'your-media-convert-role',
    mediaConvertEndpoint: 'your-media-convert-endpoint',
    ecsSubnet: 'subnet-05d98882c13408e16',
    ecsSecurityGroup: 'your-ecs-security-group',
    ecsContainerName: 'easyvmaf-s3',
    ecsCluster: 'vmaf-runner',
    ecsTaskDefinition: 'easyvmaf-s3:3'
  }
};

export { default_pipeline };
