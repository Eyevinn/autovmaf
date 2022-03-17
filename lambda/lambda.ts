import { ALBResult, ALBEvent } from 'aws-lambda';
import { default_profile } from './encodingProfiles/profiles';
import { default_pipeline } from './pipelines/pipelines';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
import { createJob } from '../src/index';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  if (event.httpMethod === 'POST' && event.path === '/' && event['body']) {
    const body = JSON.parse(event.body);
    if (!body['job']) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing job parameter.',
        }),
      };
    }

    const job = body.job;
    let pipelineData = body['pipeline'];
    let encodingS3Url = body['encodingSettingsUrl'];
    let mediaConvertProfile = {};

    if (!pipelineData) {
      pipelineData = default_pipeline;
    }
    if (!encodingS3Url) {
      mediaConvertProfile = default_profile;
    } else {
      const s3 = new S3({});
      const getCommand = new GetObjectCommand({ Bucket: encodingS3Url.split('/')[2], Key: encodingS3Url.split('/')[3] });
      mediaConvertProfile = await s3.send(getCommand);
    }
    console.log(`Job: ${JSON.stringify(job)} \n Pipeline: ${JSON.stringify(pipelineData)} \n MediaConvertProfile: ${JSON.stringify(mediaConvertProfile)}`);

    try {
      createJob(job, pipelineData, mediaConvertProfile);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Job created successfully! 🎞️',
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: error.message,
        }),
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method not allowed!',
      }),
    };
  }
}
