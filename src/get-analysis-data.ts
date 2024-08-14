import { S3, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { isS3URI } from './pipelines/aws/aws-pipeline';
import path from 'path';
import fs from 'fs';
import logger from './logger';
import { VmafList } from './models/vmaf-list';
import { BitrateList } from './models/bitrate-list';

function vmafFromJsonString(str: string): number {
  try {
    const data = JSON.parse(str);
    if (data?.['pooled_metrics']?.['vmaf']) {
      return data['pooled_metrics']['vmaf']['harmonic_mean'];
    }
    if (data?.['VMAF score']) {
      return data['VMAF score'];
    }
    return data?.['pooled_metrics']?.['vmaf_hd']?.['harmonic_mean'];
  } catch {
    return NaN;
  }
}

function bitrateFromJsonString(str: string): number {
  try {
    const data = JSON.parse(str);
    if (data.stream[0].bit_rate) {
      return data.stream[0].bit_rate;
    }
    return NaN;
  } catch {
    return NaN;
  }
}

async function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function dataFromS3(
  uri: string,
  onProgress: (index: number, filename: string, total: number) => void
): Promise<{ filename: string; contents: string }[]> {
  logger.info('Loading from S3...');
  const uriObj = new URL(uri);
  const bucket = uriObj.hostname;
  const key = uriObj.pathname.substring(1);
  let s3 = new S3({});
  const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: key });
  const listResponse = await s3.send(listCommand);

  let dataList: any = [];

  if (listResponse.Contents !== undefined) {
    const getCommands = listResponse.Contents?.map(
      (obj) => new GetObjectCommand({ Bucket: bucket, Key: obj.Key })
    );
    const getResponses = getCommands
      .filter((command) => command.input.Key?.endsWith('.json'))
      .map(async (command) => {
        const response = await s3.send(command);
        return { key: command.input.Key!, response };
      });

    let counter = 1;
    for (const promise of getResponses) {
      const { key, response } = await promise;
      const stream = (await response).Body;
      const data = await streamToString(stream);
      dataList.push({ filename: path.basename(key), contents: data });
      onProgress(counter - 1, path.basename(key), getResponses.length);
      logger.info(`Finished loading VMAF ${counter}/${getResponses.length}.`);
      counter += 1;
    }
  }

  return dataList;
}

/**
 * Returns the VMAF-values from a JSON-file or a directory of JSON-files. Can be used on both local paths as well as S3-URIs.
 *
 * @example **Example of retrieving a list of VMAF-scores from S3.**
 * ```javascript
 * const vmafFiles = await getVmaf('s3://path/to/vmaf/');
 * vmafFiles.forEach(file => {
 *   console.log(file.filename + ': ' + file.vmaf);
 * });
 * ```
 *
 * @param filename The path to the file or directory. Can be a local path or a S3-URI.
 * @returns A list of objects with filename and VMAF-scores.
 */
export default async function getAnalysisData(
  filename: string,
  onProgress: (
    index: number,
    filename: string,
    total: number
  ) => void = () => {}
): Promise<{ vmafList: VmafList; bitrateList?: BitrateList }> {
  if (isS3URI(filename)) {
    const list = await dataFromS3(filename, onProgress);
    const vmafList = list
      .filter((file) => !file.filename.includes('metadata'))
      .map(({ filename, contents }) => ({
        filename,
        vmaf: vmafFromJsonString(contents)
      }));
    const bitrateList = list
      .filter((file) => file.filename.includes('metadata'))
      .map(({ filename, contents }) => ({
        filename,
        bitrate: bitrateFromJsonString(contents)
      }));
    return { vmafList, bitrateList };
  } else {
    let bitrateList = undefined;
    if (fs.lstatSync(filename).isDirectory()) {
      logger.info('Loading VMAF from directory...');
      const files = fs
        .readdirSync(filename)
        .filter((file) => path.extname(file) === '.json');
      const vmafList: VmafList = await Promise.all(
        files.map(async (f) => {
          const contents = fs.readFileSync(path.join(filename, f), 'utf-8');
          const vmaf = await vmafFromJsonString(contents);
          return { filename: f, vmaf };
        })
      );
      return { vmafList, bitrateList };
    } else {
      const contents = fs.readFileSync(filename, 'utf-8');
      const vmaf = await vmafFromJsonString(contents);
      const vmafList: VmafList = [{ filename: filename, vmaf: vmaf }];
      return { vmafList, bitrateList };
    }
  }
}