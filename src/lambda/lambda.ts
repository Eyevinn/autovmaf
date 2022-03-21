import { ALBResult, ALBEvent } from 'aws-lambda';
import { default_profile } from './encodingProfiles/profiles';
import { default_pipeline } from './pipelines/pipelines';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
import { createJob } from '../index';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'POST' && event.path === '/' && event['body']) {
    const body = JSON.parse(event.body);
    if (!body['job']) {
      return {
        headers: responseHeaders,
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
      console.log(`Loading encoding settings from S3: ${encodingS3Url}`);
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
        headers: responseHeaders,
        statusCode: 500,
        body: JSON.stringify({
          error: error,
        }),
      };
    }
  } else {
    return {
      headers: responseHeaders,
      statusCode: 405,
      body: JSON.stringify({
        error: 'Method not allowed!',
      }),
    };
  }
}
