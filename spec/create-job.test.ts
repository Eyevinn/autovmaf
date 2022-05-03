import { mockClient } from 'aws-sdk-client-mock';
import { CreateJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { S3Client, waitUntilObjectExists, HeadObjectCommand, HeadBucketCommandOutput } from '@aws-sdk/client-s3';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import createJob from '../src/create-job';
import { JobDescription } from '../src/create-job';
import { resolve } from 'path';

const mcMock = mockClient(MediaConvertClient);
const ecsMock = mockClient(ECSClient);
const s3Mock = mockClient(S3Client);

const job: JobDescription = {
  name: "test-job",
  pipeline: "pipeline.yml",
  encodingProfile: "profile.json",
  reference: "reference.mp4",
  models: ["HD", "PhoneHD"],
  resolutions: [{ width: 1280, height: 720 }],
  bitrates: [600000],
  method: "bruteForce"
};
const pipeline = {
  aws: {
    s3Bucket: 'vmaf-files',
    mediaConvertRole: 'arn:aws:iam::1234:role/MediaConvert_Default_Role',
    mediaConvertEndpoint: 'https://abc123xyz.mediaconvert.eu-north-1.amazonaws.com',
    ecsSubnet: 'subnet-05d98882c13408e16',
    ecsSecurityGroup: 'sg-0e444b67a747bf739',
    ecsContainerName: 'easyvmaf-s3',
    ecsCluster: 'vmaf-runner',
    ecsTaskDefinition: 'easyvmaf-s3:1',
  },
};
const encodingSettings = {
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

beforeEach(() => {
  mcMock.reset();
  ecsMock.reset();
  s3Mock.reset();
});

describe('create-job', () => {
  it('should create a job successfully', async () => {
    const s3Output: HeadBucketCommandOutput = {
      $metadata: {
        attempts: 1,
        cfId: '',
        extendedRequestId: '',
        httpStatusCode: 200,
        requestId: '',
        totalRetryDelay: 0,
      },
    };
    s3Mock.on(HeadObjectCommand).resolves(s3Output);
    mcMock.on(CreateJobCommand).resolves({});
    ecsMock.on(RunTaskCommand).resolves({});
    await createJob(job, pipeline, encodingSettings);
  });
});
