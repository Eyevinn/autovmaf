import { Resolution } from './resolution';

export type VmafBitratePair = {
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
