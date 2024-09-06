import { JobDescription } from '../../src/create-job';

export const job: JobDescription = {
  name: 'test-job',
  pipeline: 'pipeline.yml',
  encodingProfile: 'profile.json',
  reference: 'reference.mp4',
  models: ['HD', 'PhoneHD'],
  resolutions: [{ width: 1280, height: 720, range: undefined }],
  bitrates: [600000],
  method: 'bruteForce'
};

export const localJob: JobDescription = {
  name: 'test-job',
  pipeline: './tests/resources/pipeline.yml',
  encodingProfile: './tests/resources/profile.json',
  reference: './tests/resources/reference.mp4',
  models: ['HD'],
  resolutions: [{ width: 1280, height: 720, range: undefined }],
  bitrates: [600000],
  method: 'bruteForce'
};

export const pipeline = {
  aws: {
    s3Bucket: 'vmaf-files',
    mediaConvertRole: 'arn:aws:iam::1234:role/MediaConvert_Default_Role',
    mediaConvertEndpoint:
      'https://abc123xyz.mediaconvert.eu-north-1.amazonaws.com',
    ecsSubnet: 'subnet-05d98882c13408e16',
    ecsSecurityGroup: 'sg-0e444b67a747bf739',
    ecsContainerName: 'easyvmaf-s3',
    ecsCluster: 'vmaf-runner',
    ecsTaskDefinition: 'easyvmaf-s3:1'
  }
};

export const encodingSettings = {
  Inputs: [
    {
      TimecodeSource: 'ZEROBASED',
      VideoSelector: {},
      FileInput: '$INPUT'
    }
  ],
  OutputGroups: [
    {
      Name: 'File Group',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: {
          Destination: '$OUTPUT'
        }
      },
      Outputs: [
        {
          VideoDescription: {
            CodecSettings: {
              Codec: 'H_265',
              H265Settings: {
                GopBReference: 'ENABLED',
                HrdBufferSize: '$HRDBUFFER',
                Bitrate: '$BITRATE',
                RateControlMode: 'CBR',
                CodecProfile: 'MAIN10_HIGH',
                AdaptiveQuantization: 'AUTO',
                GopSizeUnits: 'AUTO'
              }
            },
            Width: '$WIDTH',
            Height: '$HEIGHT'
          },
          ContainerSettings: {
            Container: 'MP4',
            Mp4Settings: {}
          }
        }
      ]
    }
  ],
  TimecodeConfig: {
    Source: 'ZEROBASED'
  }
};
