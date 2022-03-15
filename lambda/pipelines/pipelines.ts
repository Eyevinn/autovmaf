const default_pipeline = {
  "aws": {
    "s3Bucket": "vmaf-files",
    "mediaConvertRole": "arn:aws:iam::590877988961:role/MediaConvert_Default_Role",
    "mediaConvertEndpoint": "https://xnlmxec5a.mediaconvert.eu-north-1.amazonaws.com",
    "ecsSubnet": "subnet-05d98882c13408e16",
    "ecsSecurityGroup": "sg-0e444b67a747bf739",
    "ecsContainerName": "easyvmaf-s3",
    "ecsCluster": "vmaf-runner",
    "ecsTaskDefinition": "easyvmaf-s3:3"
  }
};

export { default_pipeline };
