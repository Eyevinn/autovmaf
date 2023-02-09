import getVmaf from './get-vmaf';
import logger from './logger';
import { Resolution } from './models/resolution';

export async function pairVmafWithResolutionAndBitrate(
  directoryWithVmafFiles: string, 
  filterFunction: (bitrate: number, resolution: Resolution, vmaf: number) => boolean = () => true,
  onProgress: (index: number, filename: string, total: number) => void = () => {}) {

  let pairs = new Map<number, { resolution: Resolution; vmaf: number }[]>();
  logger.info('Loading VMAF data...');
  const vmafs = await getVmaf(directoryWithVmafFiles, onProgress);
  let counter = 1;
  vmafs.forEach(({ filename, vmaf }) => {
    const [resolutionStr, bitrateStr] = filename.split('_');
    const [widthStr, heightStr] = resolutionStr.split('x');

    const width = parseInt(widthStr);
    const height = parseInt(heightStr);
    const bitrate = parseInt(bitrateStr);

    if (filterFunction(bitrate, { width, height }, vmaf)) {
      if (pairs.has(bitrate)) {
        pairs.get(bitrate)?.push({ resolution: { width, height }, vmaf });
      } else {
        pairs.set(bitrate, [{ resolution: { width, height }, vmaf }]);
      }
    }


    logger.info(`Finished loading VMAF ${counter}/${vmafs.length}.`);
    counter += 1;
  });
  return pairs;
}