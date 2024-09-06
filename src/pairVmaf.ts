import getAnalysisData from './get-analysis-data';
import logger from './logger';
import { JsonVmafScores } from './models/json-vmaf-scores';
import { Resolution } from './models/resolution';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { VmafBitratePair } from './models/vmaf-bitrate-pair';

export async function pairVmafWithResolutionAndBitrate(
  directoryWithVmafFiles: string,
  filterFunction: (
    bitrate: number,
    resolution: Resolution,
    vmafScores: JsonVmafScores
  ) => boolean = () => true,
  onProgress: (
    index: number,
    filename: string,
    total: number
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) => void = () => {},
  probeBitrate = false
): Promise<VmafBitratePair[]> {
  const pairs: VmafBitratePair[] = [];
  logger.info(`Loading VMAF data from ${directoryWithVmafFiles}...`);
  const analysisData = await getAnalysisData(
    directoryWithVmafFiles,
    onProgress
  );
  let counter = 1;
  // Reinterpret bitrateList as a Record type
  const bitrates: Record<string, number> | undefined = analysisData.bitrateList
    ? analysisData.bitrateList.reduce<Record<string, number>>(
        (record, file) => {
          record[file.filename] = file.bitrate;
          return record;
        },
        {}
      )
    : probeBitrate
      ? await getBitrates(
          analysisData.vmafList.map((vmaf) =>
            path.resolve(directoryWithVmafFiles, vmaf.filename)
          )
        )
      : undefined;
  const cpuTimes:
    | Record<string, { realTime: number; cpuTime: number }>
    | undefined = await getCpuTimes(
    analysisData.vmafList.map((vmaf) =>
      path.resolve(directoryWithVmafFiles, vmaf.filename)
    )
  );
  logger.info(
    `Loaded VMAF data from ${JSON.stringify(analysisData, null, 2)}.`
  );
  analysisData.vmafList.forEach(({ filename, vmafScores }) => {
    const dataFromFilename = parseVmafFilename(filename);
    if (!dataFromFilename) {
      logger.error('Unable to parse data from filename: ', filename);
      return;
    }
    const { width, height, targetBitrate, variables } = dataFromFilename;

    const actualBitrate = bitrates ? bitrates[filename] : 0;
    const cpuTime = cpuTimes ? cpuTimes[filename] : undefined;
    const vmaf = vmafScores.vmaf;
    const vmafHd = vmafScores.vmafHd;
    const vmafHdPhone = vmafScores.vmafHdPhone;

    if (filterFunction(targetBitrate, { width, height }, vmafScores)) {
      pairs.push({
        targetBitrate,
        actualBitrate,
        resolution: { width, height },
        variables,
        vmaf,
        vmafHd,
        vmafHdPhone,
        cpuTime,
        vmafFile: filename
      });
    }

    logger.info(
      `Finished loading VMAF ${counter}/${analysisData.vmafList.length}.`
    );
    counter += 1;
  });
  return pairs;
}

async function getCpuTimes(vmafFiles: string[]) {
  const cpuTimes: Record<string, { realTime: number; cpuTime: number }> = {};
  for (const filename of vmafFiles) {
    cpuTimes[path.basename(filename)] = await getCpuTime(filename);
  }
  return cpuTimes;
}

async function getCpuTime(file: string) {
  let timeFile = file.replace('_vmaf.json', '.mp4.pass1-cpu-time.txt');
  if (!fileExists(timeFile)) {
    // Look in parent folder
    timeFile = path.resolve(
      path.dirname(timeFile),
      `../${path.basename(timeFile)}`
    );
  }
  if (!fileExists(timeFile)) {
    logger.info(
      `Unable to find corresponding cpu-time file: ${timeFile} for vmaf file: ${file}`
    );
    return { realTime: 0, cpuTime: 0 };
  }

  const metadata = JSON.parse(fs.readFileSync(timeFile, 'utf8'));
  const realTime = metadata.realTime as number;
  const cpuUserMode = metadata.cpuUserMode as number;
  const cpuKernelMode = metadata.cpuKernelMode as number;
  console.log(
    `Got time data realTime: ${realTime}, cpuUserMode: ${cpuUserMode}, cpuKernelMode: ${cpuKernelMode} from file ${timeFile}`
  );
  return {
    realTime,
    cpuTime: parseFloat((cpuUserMode + cpuKernelMode).toFixed(2))
  };
}

async function getBitrates(
  filenames: string[]
): Promise<Record<string, number>> {
  const bitrates: Record<string, number> = {};
  for (const filename of filenames) {
    bitrates[path.basename(filename)] = await getBitrate(filename);
  }
  return bitrates;
}

async function getBitrate(vmafFile) {
  let mp4File = vmafFile.replace('_vmaf.json', '.mp4');
  if (!fileExists(mp4File)) {
    // Look in parent folder
    mp4File = path.resolve(
      path.dirname(mp4File),
      `../${path.basename(mp4File)}`
    );
  }
  if (!fileExists(mp4File)) {
    throw new Error(
      `Unable to find corresponding mp4 for vmaf file ${vmafFile}`
    );
  }
  const metadata: { streams: any[] } = (await runFfprobe(mp4File)) as any;
  const bitrate = metadata.streams[0].bit_rate;
  console.log(`Probed bitrate ${bitrate} from file ${mp4File}`);
  return bitrate;
}

function fileExists(file) {
  return fs.existsSync(file);
}

export async function runFfprobe(file) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
}

const vmafFilenameRegex =
  /(.*\/)?(?<width>\d+)x(?<height>\d+)_(?<bitrate>\d+)(?<variables>(_([A-Za-z0-9-]+)_([A-Za-z0-9.]+))*)?(_vmaf\.json|\.[A-Za-z0-9]+)/;

export function parseVmafFilename(file):
  | {
      width: number;
      height: number;
      targetBitrate: number;
      variables: Record<string, string>;
    }
  | undefined {
  const result = vmafFilenameRegex.exec(file);
  if (!result) {
    return undefined;
  }
  const groups = result.groups as {
    width: string;
    height: string;
    bitrate: string;
    variables: string;
  };
  const variables = {};
  if (groups.variables) {
    const variablesList = groups.variables.split('_').slice(1);
    for (let i = 0; i < variablesList.length - 1; i += 2) {
      variables[variablesList[i]] = variablesList[i + 1];
    }
  }
  return {
    width: parseInt(groups.width),
    height: parseInt(groups.height),
    targetBitrate: parseInt(groups.bitrate),
    variables
  };
}
