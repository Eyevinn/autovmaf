import { mockClient } from 'aws-sdk-client-mock';
import { CreateJobCommand, GetJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { HeadObjectCommand, S3Client, waitUntilObjectExists } from '@aws-sdk/client-s3';
import { ECSClient } from '@aws-sdk/client-ecs';
//import { createJob } from '../src/create-job';

const mcMock = mockClient(MediaConvertClient);
const ecsMock = mockClient(ECSClient);
const s3Mock = mockClient(S3Client);

beforeEach(() => {
  mcMock.reset();
  ecsMock.reset();
  s3Mock.reset();
});


// test the create-job method
describe('create-job', () => {
  it('should create a job successfully', async () => {
    console.log('should create a job successfully');
  });
});
