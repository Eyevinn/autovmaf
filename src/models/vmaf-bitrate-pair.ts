import { Resolution } from './resolution';

export type VmafBitratePair = {
  // Target bitrate, in case of VBR or CBR transcoding
  targetBitrate: number;
  // Actual bitrate as read with ffprobe
  actualBitrate: number;
  resolution: Resolution;
  vmaf?: number;
  vmafHd?: number;
  vmafHdPhone?: number;
  variables: Record<string, string>;
  cpuTime?: {
    realTime: number;
    cpuTime: number;
  };
  vmafFile: string;
};
