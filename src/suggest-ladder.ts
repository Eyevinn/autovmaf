import { Resolution } from './models/resolution';
import logger from './logger';
import { BitrateResolutionVMAF } from './models/bitrate-resolution-vmaf';
import { getVmaf } from '.';
import { pairVmafWithResolutionAndBitrate } from './pairVmaf';

/**
 * Suggests an optimal ABR-ladder from a directory of VMAF-files. Only supports loading from S3 at the moment.
 *
 * @param directoryWithVmafFiles URI to the directory with VMAF-files.
 * @param filterFunction Optional function to filter values from the analysis.
 * @param includeAllBitrates If true, return optimal resolutions for all bitrates.
 * @returns Returns the optimal ladder.
 */
export default async function suggestLadder(
  directoryWithVmafFiles: string,
  filterFunction: (bitrate: number, resolution: Resolution, vmaf: number) => boolean = () => true,
  includeAllBitrates: boolean = false,
  onProgress: (index: number, filename: string, total: number) => void = () => {}
): Promise<BitrateResolutionVMAF[]> {
  const pairs = await pairVmafWithResolutionAndBitrate(directoryWithVmafFiles, filterFunction, onProgress);
  // let pairs = new Map<number, { resolution: Resolution; vmaf: number }[]>();
  let optimal: { resolution: Resolution; vmaf: number; bitrate: number }[] = [];

  // logger.info('Loading VMAF data...');
  // const vmafs = await getVmaf(directoryWithVmafFiles, onProgress);
  // let counter = 1;
  // vmafs.forEach(({ filename, vmaf }) => {
  //   const [resolutionStr, bitrateStr] = filename.split('_');
  //   const [widthStr, heightStr] = resolutionStr.split('x');

  //   const width = parseInt(widthStr);
  //   const height = parseInt(heightStr);
  //   const bitrate = parseInt(bitrateStr);

  //   if (filterFunction(bitrate, { width, height }, vmaf)) {
  //     if (pairs.has(bitrate)) {
  //       pairs.get(bitrate)?.push({ resolution: { width, height }, vmaf });
  //     } else {
  //       pairs.set(bitrate, [{ resolution: { width, height }, vmaf }]);
  //     }
  //   }

  //   logger.info(`Finished loading VMAF ${counter}/${vmafs.length}.`);
  //   counter += 1;
  // });

  // Get optimal resolution for each bitrate
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

  if (includeAllBitrates) {
    return optimal.sort((a, b) => a.bitrate - b.bitrate);
  }

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
