import { createJob } from '../index';

export const handler = async (event: any): Promise<any> => {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const settings = JSON.parse(event);
  console.log(JSON.stringify(settings));
  try {
    await createJob(settings['job'], settings['pipeline'], settings['mediaConvertProfile']);
    return {
      headers: responseHeaders,
      statusCode: 200,
      body: 'Job finished successfully!',
    };
  } catch (error) {
    console.log(error);
    return {
      headers: responseHeaders,
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
}
