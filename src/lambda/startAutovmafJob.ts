import { createJob } from '../index';

export const handler = async (event: any): Promise<any> => {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  console.log(JSON.stringify(event));
  if (!event['job'] || !event['pipeline'] || !event['encodingProfile']) {
    console.error('Missing parameters in event');
    return {
      headers: responseHeaders,
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing job, pipeline or encodingProfile parameter.'
      })
    };
  }
  try {
    await createJob(event['job'], event['pipeline'], event['encodingProfile']);
    return {
      headers: responseHeaders,
      statusCode: 200,
      body: 'Job finished successfully!'
    };
  } catch (error) {
    console.error(error);
    return {
      headers: responseHeaders,
      statusCode: 500,
      body: 'Failed to create job'
    };
  }
};
