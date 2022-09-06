import { mockClient } from 'aws-sdk-client-mock';
import { CreateJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { AWSPipeline } from '../src';
import { AWSPipelineConfiguration } from '../src';
import { QualityAnalysisModel } from '../src/models/quality-analysis-model';
import { isS3URI } from '../src/pipelines/aws/aws-pipeline';

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
  mediaConvertEndpoint:
    'https://abc123xyz.mediaconvert.eu-north-1.amazonaws.com',
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
  jest.clearAllMocks();
  delete process.env.LOAD_CREDENTIALS_FROM_ENV;
});

describe('AWSPipeline', () => {
  it('fileExists should return "true" if file is found in S3', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    expect(await pipeline.fileExists('bucket', 'key')).toEqual(true);
  });

  it(`fileExists should return "false" if file doesn't exist in S3`, async () => {
    s3Mock.on(HeadObjectCommand).rejects({});

    expect(await pipeline.fileExists('bucket', 'key')).toEqual(false);
  });

  it('waitForObjectInS3 should return "true" if object exists in S3 bucket', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    expect(await pipeline.waitForObjectInS3('bucket', 'key')).toEqual(true);
  });

  it('uploadIfNeeded should upload file to S3 if not found', async () => {
    jest.spyOn(pipeline, 'uploadToS3').mockResolvedValue();
    jest.spyOn(pipeline, 'fileExists').mockResolvedValue(false);

    await pipeline.uploadIfNeeded('file', 'bucket', 's3Dir');

    expect(pipeline.uploadToS3).toHaveBeenCalledWith(
      'file',
      'bucket',
      's3Dir/file'
    );

    expect(pipeline.fileExists).toHaveBeenCalledWith('bucket', 's3Dir/file');
    expect(pipeline.fileExists).toReturnTimes(1);
  });

  it('uploadIfNeeded should do nothing if file already exists in S3', async () => {
    jest.spyOn(pipeline, 'uploadToS3').mockResolvedValue();
    jest.spyOn(pipeline, 'fileExists').mockResolvedValue(true);

    await pipeline.uploadIfNeeded('file', 'bucket', 's3Dir');

    expect(pipeline.uploadToS3).not.toHaveBeenCalled();
    expect(pipeline.fileExists).toHaveBeenCalledWith('bucket', 's3Dir/file');
    expect(pipeline.fileExists).toReturnTimes(1);
  });

  it('stringReplacement should replace keyword in string', async () => {
    const str = 'FileInput: $INPUT';
    expect(pipeline.stringReplacement(str, '$INPUT', 'testFile')).toEqual('FileInput: testFile');
  });

  it('transcode should start a transcoding job', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});
    mcMock.on(CreateJobCommand).resolves({});

    jest.spyOn(pipeline, 'fileExists').mockResolvedValue(true);

    await pipeline.transcode('file', { width: 1280, height: 720 }, 900000, 's3Dir');

    expect(pipeline.fileExists).toReturnTimes(2);
    expect(mcMock.send).toHaveBeenCalled;
  });

  it('analyzeQuality should start job in ECS', async () => {
    jest.spyOn(pipeline, 'waitForObjectInS3').mockResolvedValue(true);
    jest.spyOn(pipeline, 'uploadIfNeeded').mockResolvedValue('file'); 
    jest.spyOn(pipeline, 'fileExists').mockResolvedValue(false);

    s3Mock.on(HeadObjectCommand).resolves({});
    ecsMock.on(RunTaskCommand).resolves({});

    await pipeline.analyzeQuality('referenceFile', 'distortedFile', 's3Dir', QualityAnalysisModel.HD);

    expect(ecsMock.send).toHaveBeenCalled;
    expect(pipeline.fileExists).toHaveBeenCalledWith('vmaf-files', 'results/s3Dir');
    expect(pipeline.waitForObjectInS3).toHaveBeenCalledWith('vmaf-files', 'results/s3Dir');
  });

  it('analyzeQuality should skip job if outputObject already exists in S3', async () => {
    jest.spyOn(pipeline, 'fileExists').mockResolvedValue(true);

    await pipeline.analyzeQuality('referenceFile', 'distortedFile', 'fileInS3', QualityAnalysisModel.HD);

    expect(ecsMock.send).not.toHaveBeenCalled;
    expect(pipeline.fileExists).toHaveBeenCalledWith('vmaf-files', 'results/fileInS3');
  });

  it('isS3URI should return "true" if string is a valid S3 URI', async () => {
    expect(isS3URI('s3://bucket/key')).toEqual(true);
  });

  it('isS3URI should return "false" if string is not a valid S3 URI', async () => {
    expect(isS3URI('https://bucket/key')).toEqual(false);
  });
});
