import { ALBResult, ALBEvent } from 'aws-lambda';
import { default_profile } from './encodingProfiles/profiles';
import { default_pipeline } from './pipelines/pipelines';
import { createJob } from '../src/index';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  if (event.httpMethod === 'POST' && event.path === '/' && event['body']) {
    const body = JSON.parse(event.body);
    const job = body.job;
    let pipelineData = body['pipeline'];
    let encodingProfileData = body['encodingProfile'];

    if (!pipelineData) {
      pipelineData = default_pipeline;
    }
    if (!encodingProfileData) {
      encodingProfileData = default_profile;
    }

    try {
      createJob(job, pipelineData, encodingProfileData);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Job created.',
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
        error: 'Method not allowed.',
      }),
    };
  }
}
