import { Resolution } from './resolution';

export type VmafBitratePair = {
  resolution: Resolution;
  vmaf?: number;
  vmafHd?: number;
  vmafHdPhone?: number;
  qvbr: number | null;
  cpuTime?: {
    realTime: number;
    cpuTime: number;
  };
  vmafFile: string;
};
