import { mockClient } from 'aws-sdk-client-mock';
import { CreateJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { S3Client, HeadObjectCommand, HeadBucketCommandOutput } from '@aws-sdk/client-s3';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { AWSPipeline } from '../src';
import { AWSPipelineConfiguration } from '../src';

const mediaConvertSettings = {
  Inputs: [
    {
      TimecodeSource: 'ZEROBASED',
      VideoSelector: {},
      FileInput: '$INPUT',
    },
  ],
  OutputGroups: [
    {
      Name: 'File Group',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: {
          Destination: '$OUTPUT',
        },
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
                GopSizeUnits: 'AUTO',
              },
            },
            Width: '$WIDTH',
            Height: '$HEIGHT',
          },
          ContainerSettings: {
            Container: 'MP4',
            Mp4Settings: {},
          },
        },
      ],
    },
  ],
  TimecodeConfig: {
    Source: 'ZEROBASED',
  },
};
const pipelineSettings: AWSPipelineConfiguration = {
    inputBucket: 'vmaf-files',
    outputBucket: 'vmaf-files',
    mediaConvertRole: 'arn:aws:iam::1234:role/MediaConvert_Default_Role',
    mediaConvertEndpoint: 'https://abc123xyz.mediaconvert.eu-north-1.amazonaws.com',
    mediaConvertSettings: mediaConvertSettings,
    ecsSubnet: 'subnet-05d98882c13408e16',
    ecsSecurityGroup: 'sg-0e444b67a747bf739',
    ecsContainerName: 'easyvmaf-s3',
    ecsCluster: 'vmaf-runner',
    ecsTaskDefinition: 'easyvmaf-s3:1',
};
const mcMock = mockClient(MediaConvertClient);
const ecsMock = mockClient(ECSClient);
const s3Mock = mockClient(S3Client);

const pipeline = new AWSPipeline(pipelineSettings);

beforeEach(() => {
  mcMock.reset();
  ecsMock.reset();
  s3Mock.reset();

  process.env.LOAD_CREDENTIALS_FROM_ENV = 'true';
});

afterEach(() => {
  delete process.env.LOAD_CREDENTIALS_FROM_ENV;
});

describe('AWSPipeline', () => {
  it("waitForObjectInS3 should return true if object exists in S3 bucket", async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    expect(await pipeline.waitForObjectInS3('bucket', 'key')).toEqual(true);
  });

  /*it("waitForObjectInS3 should return false if object doesn't exists in S3 bucket", async () => {
    s3Mock.on(HeadObjectCommand).rejects({});
    expect(await pipeline.waitForObjectInS3('bucket', 'key')).toEqual(false);
  });*/
});
