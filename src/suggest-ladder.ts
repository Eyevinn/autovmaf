import { Resolution } from './models/resolution';
import { BitrateResolutionVMAF } from './models/bitrate-resolution-vmaf';
import { pairVmafWithResolutionAndBitrate } from './pairVmaf';
import { JsonVmafScores } from './models/json-vmaf-scores';
import { VmafBitratePair } from './models/vmaf-bitrate-pair';

interface LadderAndVmafPairs {
  ladder: BitrateResolutionVMAF[];
  pairs: Map<number, VmafBitratePair[]>;
}

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
  filterFunction: (
    bitrate: number,
    resolution: Resolution,
    vmafScores: JsonVmafScores
  ) => boolean = () => true,
  includeAllBitrates = false,
  onProgress: (
    index: number,
    filename: string,
    total: number
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ) => void = () => {},
  model = 'vmafHd'
): Promise<LadderAndVmafPairs> {
  const pairs: Map<number, VmafBitratePair[]> = (
    await pairVmafWithResolutionAndBitrate(
      directoryWithVmafFiles,
      filterFunction,
      onProgress
    )
  ).reduce<Map<number, VmafBitratePair[]>>((map, pair) => {
    const list = map.get(pair.targetBitrate) ?? [];
    list.push(pair);
    map.set(pair.targetBitrate, list);
    return map;
  }, new Map());
  const optimal: { resolution: Resolution; vmaf: number; bitrate: number }[] =
    [];

  // Get optimal resolution for each bitrate
  pairs.forEach((bitrateVmafPairs, bitrate) => {
    let bestVmaf = 0;
    let bestResolution: Resolution | undefined;

    for (const pair of bitrateVmafPairs) {
      const vmaf = pair[model] ? pair[model] : NaN;
      if (vmaf > bestVmaf) {
        bestVmaf = vmaf;
        bestResolution = pair.resolution;
      }
    }
    if (bestResolution !== undefined) {
      optimal.push({
        bitrate: bitrate,
        resolution: bestResolution,
        vmaf: bestVmaf
      });
    }
  });

  if (includeAllBitrates) {
    return { ladder: optimal.sort((a, b) => a.bitrate - b.bitrate), pairs };
  }

  const ladder: { resolution: Resolution; vmaf: number; bitrate: number }[] =
    [];
  optimal
    .sort((a, b) => b.bitrate - a.bitrate)
    .forEach((pair) => {
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

  return { ladder: ladder.reverse(), pairs };
}
