import { GetObjectCommand, ListObjectsV2Command, S3 } from '@aws-sdk/client-s3';
import { Resolution } from './models/resolution';
import { isS3URI } from './pipelines/aws/aws-pipeline';
import path from 'path';
import logger from './logger';
import { BitrateResolutionVMAF } from './models/birate-resolution-vmaf';

export default async function suggestLadder(directoryWithVmafFiles: string): Promise<BitrateResolutionVMAF[]> {
  let pairs = new Map<number, { resolution: Resolution; vmaf: number }[]>();
  let optimal: { resolution: Resolution; vmaf: number; bitrate: number }[] = [];
  logger.info('Loading VMAF data...');
  if (isS3URI(directoryWithVmafFiles)) {
    const uri = new URL(directoryWithVmafFiles);
    const bucket = uri.hostname;
    const key = uri.pathname.substring(1);
    let s3 = new S3({});
    const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: key });
    const listResponse = await s3.send(listCommand);

    const streamToString = (stream: any): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });

    if (listResponse.Contents !== undefined) {
      const getCommands = listResponse.Contents?.map(obj => new GetObjectCommand({ Bucket: bucket, Key: obj.Key }));
      const getReponses = getCommands
        .filter(command => command.input.Key?.endsWith('.json'))
        .map(async command => {
          const response = await s3.send(command);
          return { key: command.input.Key!, response };
        });
      let counter = 1;
      for (const promise of getReponses) {
        const { key, response } = await promise;
        const stream = (await response).Body;
        const data = await streamToString(stream);
        const vmafData = JSON.parse(data);
        const filename = path.basename(key);
        const [resolutionStr, bitrateStr] = filename.split('_');
        const [widthStr, heightStr] = resolutionStr.split('x');

        const vmaf = vmafData['pooled_metrics']['vmaf']['harmonic_mean'];
        const width = parseInt(widthStr);
        const height = parseInt(heightStr);
        const bitrate = parseInt(bitrateStr);

        if (pairs.has(bitrate)) {
          pairs.get(bitrate)?.push({ resolution: { width, height }, vmaf });
        } else {
          pairs.set(bitrate, [{ resolution: { width, height }, vmaf }]);
        }

        logger.info(`Finished loading VMAF ${counter}/${getReponses.length}.`);
        counter += 1;
      }
    }
  } else {
    // TODO: Load local VMAF-scores
  }

  pairs.forEach((bitrateVmafPairs, bitrate) => {
    let bestVmaf = 0;
    let bestResolution: Resolution | undefined;
    for (let pair of bitrateVmafPairs) {
      if (pair.vmaf > bestVmaf) {
        bestVmaf = pair.vmaf;
        bestResolution = pair.resolution;
      }
    }
    if (bestResolution !== undefined) {
      optimal.push({ bitrate: bitrate, resolution: bestResolution, vmaf: bestVmaf });
    }
  });

  let ladder: { resolution: Resolution; vmaf: number; bitrate: number }[] = [];
  optimal
    .sort((a, b) => b.bitrate - a.bitrate)
    .forEach(pair => {
      if (ladder.length === 0) {
        if (pair.vmaf < 94) {
          ladder.push(pair);
        }
        return;
      }

      const lastPair = ladder[ladder.length - 1];
      const bitrateFactor = lastPair.bitrate / pair.bitrate;
      const vmafDelta = lastPair.vmaf - pair.vmaf;

      const bitrateCondition = bitrateFactor >= 1.5 && bitrateFactor <= 2.0;
      const vmafCondition = vmafDelta > 6;
      const failSafeCondition = bitrateFactor >= 2.0;

      if ((bitrateCondition && vmafCondition) || failSafeCondition) {
        ladder.push(pair);
      }
    });

  return ladder.reverse();
}
