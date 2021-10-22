import { S3, GetObjectCommand } from '@aws-sdk/client-s3';
import { isS3URI } from './pipelines/aws/aws-pipeline';
import fs from 'fs';

export default async function getVmaf(filename: string): Promise<number> {
  const streamToString = (stream: any): Promise<string> =>
    new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

  if (isS3URI(filename)) {
    const s3 = new S3({});
    const uri = new URL(filename);
    const bucket = uri.hostname;
    const key = uri.pathname.substring(1);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });

    const response = await s3.send(command);
    const stream = response.Body;
    const data = await streamToString(stream);
    const vmafData = JSON.parse(data);

    const vmaf = vmafData['pooled_metrics']['vmaf']['harmonic_mean'];
    return vmaf;
  } else {
    const file = fs.readFileSync(filename, 'utf-8');
    const data = JSON.parse(file);
    const vmaf = data['pooled_metrics']['vmaf']['harmonic_mean'];
    return vmaf;
  }
}
