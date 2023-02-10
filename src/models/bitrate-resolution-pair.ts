import { Resolution } from './resolution';

export type BitrateResolutionPair = {
  resolution: Resolution;
  bitrate: number;
  ffmpegOptionVariables?: { [key: string]: string };
};
