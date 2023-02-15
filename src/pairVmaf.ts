import getVmaf from './get-vmaf';
import logger from './logger';
import { Resolution } from './models/resolution';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

export async function pairVmafWithResolutionAndBitrate(
  directoryWithVmafFiles: string, 
  filterFunction: (bitrate: number, resolution: Resolution, vmaf: number) => boolean = () => true,
  onProgress: (index: number, filename: string, total: number) => void = () => {},
  probeBitrate: boolean = false) {

  let pairs = new Map<number, { resolution: Resolution; vmaf: number, cpuTime?: {realTime: number, cpuTime: number}}[]>();
  logger.info(`Loading VMAF data from ${directoryWithVmafFiles}...`);
  const vmafs = await getVmaf(directoryWithVmafFiles, onProgress);
  let counter = 1;
  const bitrates: Record<string,number> | undefined = probeBitrate ?
    await getBitrates(vmafs.map(vmaf => path.resolve(directoryWithVmafFiles, vmaf.filename))) : undefined;
  const cpuTimes: Record<string,{realTime: number, cpuTime: number}> | undefined = await getCpuTimes(vmafs.map(vmaf => path.resolve(directoryWithVmafFiles, vmaf.filename)));
  vmafs.forEach(({ filename, vmaf }) => {
    const [resolutionStr, bitrateStr] = filename.split('_');
    const [widthStr, heightStr] = resolutionStr.split('x');

    const width = parseInt(widthStr);
    const height = parseInt(heightStr);
    const bitrate = bitrates ? bitrates[filename] : parseInt(bitrateStr);
    const cpuTime = cpuTimes ? cpuTimes[filename] : undefined

    if (filterFunction(bitrate, { width, height }, vmaf)) {
      if (pairs.has(bitrate)) {
        pairs.get(bitrate)?.push({ resolution: { width, height }, vmaf, cpuTime });
      } else {
        pairs.set(bitrate, [{ resolution: { width, height }, vmaf, cpuTime }]);
      }
    }

    logger.info(`Finished loading VMAF ${counter}/${vmafs.length}.`);
    counter += 1;
  });
  return pairs;
}

async function getCpuTimes(vmafFiles: string[]) {
  const cpuTimes: Record<string,{realTime: number, cpuTime: number}> = {};
  for (const filename of vmafFiles) {
    cpuTimes[path.basename(filename)] = await getCpuTime(filename);
  }
  return cpuTimes;
}

async function getCpuTime(file: string) {
  let timeFile = file.replace("_vmaf.json", ".mp4.pass1-cpu-time.txt");
  if (!fileExists(timeFile)) {
    // Look in parent folder
    timeFile = path.resolve(path.dirname(timeFile), `../${path.basename(timeFile)}`);
  }
  if (!fileExists(timeFile)) {
    throw new Error(`Unable to find corresponding cpu-time file for vmaf file: ${file}`);
  }
  const metadata = JSON.parse(fs.readFileSync(timeFile));
  const realTime = metadata.realTime as number;
  const cpuUserMode = metadata.cpuUserMode as number;
  const cpuKernelMode = metadata.cpuKernelMode as number;
  console.log(`Got time data realTime: ${realTime}, cpuUserMode: ${cpuUserMode}, cpuKernelMode: ${cpuKernelMode} from file ${timeFile}`);
  return {realTime, cpuTime: cpuUserMode+cpuKernelMode};
}

async function getBitrates(filenames: string[]): Promise<Record<string,number>> {
  const bitrates: Record<string,number> = {};
  for (const filename of filenames) {
    bitrates[path.basename(filename)] = await getBitrate(filename);
  }
  return bitrates;
}

async function getBitrate(vmafFile) {
    let mp4File = vmafFile.replace("_vmaf.json", ".mp4");
    if (!fileExists(mp4File)) {
      // Look in parent folder
      mp4File = path.resolve(path.dirname(mp4File), `../${path.basename(mp4File)}`);
    }
    if (!fileExists(mp4File)) {
      throw new Error(`Unable to find corresponding mp4 for vmaf file ${vmafFile}`);
    }
    const metadata: {streams: any[]} = await runFfprobe(mp4File) as any;
    const bitrate = metadata.streams[0].bit_rate;
    console.log(`Probed bitrate ${bitrate} from file ${mp4File}`);
    return bitrate;
}

function fileExists(file) {
  return fs.existsSync(file);
}

async function runFfprobe(file) {
  return new Promise((resolve,reject) => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    })
  })
}