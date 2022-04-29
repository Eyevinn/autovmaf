import { ALBResult, ALBEvent } from 'aws-lambda';
import { default_profile } from './encodingProfiles/profiles';
import { default_pipeline } from './pipelines/pipelines';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
import aws from 'aws-sdk';

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
        body: JSON.stringify({ Error: 'Missing job parameter!' }),
      };
    }
    const job = body.job;
    let pipelineS3Url = body['pipelineUrl'];
    let encodingS3Url = body['encodingSettingsUrl'];
    let mediaConvertProfile = default_profile;
    let pipeline = default_pipeline;
    try {
      if (pipelineS3Url) {
        pipeline = JSON.parse(await loadFromS3(pipelineS3Url));
      }
      if (encodingS3Url) {
        mediaConvertProfile = JSON.parse(await loadFromS3(encodingS3Url));
      }
    } catch (error) {
      console.error(error);
      return {
        headers: responseHeaders,
        statusCode: 500,
        body: JSON.stringify({ Message: 'Failed to load settings from S3' }),
      };
    }
    console.log(`Job: ${JSON.stringify(job)} \n Pipeline: ${JSON.stringify(pipeline)} \n MediaConvertProfile: ${JSON.stringify(mediaConvertProfile)}`);
    let message = 'Job created successfully! 🎞️';
    let statusCode = 202;
    try {
      await createLambdaJob({
        job: job, 
        pipeline: pipeline, 
        encodingProfile: mediaConvertProfile 
      }); 
    } catch (error) {
      console.error(error);
      message = 'Failed to create job!';
      statusCode = 500;
    }
    return {
      headers: responseHeaders,
      statusCode: statusCode,
      body: message,
    };
  } else {
    return {
      headers: responseHeaders,
      statusCode: 405,
      body: JSON.stringify({ Error: 'Method not allowed!' }),
    };
  }
}

async function createLambdaJob(data: any): Promise<any> {
  const lambda = new aws.Lambda({ region: 'eu-north-1' });
  const params = {
    FunctionName: "lambda-create-autovmaf-job",
    InvocationType: "Event",
    Payload: JSON.stringify(data),
  };
  return new Promise((resolve, reject) => {
    lambda.invoke(params, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        console.log(data);
        resolve(data);
      }
    });
  });
}

async function loadFromS3(encodingS3Url: string): Promise<string> {
  const s3 = new S3({ region: (process.env.AWS_REGION || 'eu-north-1') });
  console.log('Bucket: ' + encodingS3Url.split('/')[2] + ' Key: ' + encodingS3Url.split('/')[3]);
  const getCommand = new GetObjectCommand({ Bucket: encodingS3Url.split('/')[2], Key: encodingS3Url.split('/')[3] });
  const response = await s3.send(getCommand);
  return await streamToString(response);
}

async function streamToString(stream: any): Promise<string> {
  return new Promise(async (resolve, reject) => {
    let responseDataChunks = []  as  any;
    stream.Body.once('error', err => reject(err));
    stream.Body.on('data', chunk => responseDataChunks.push(chunk));
    stream.Body.once('end', () => resolve(responseDataChunks.join('')));
  });
}
