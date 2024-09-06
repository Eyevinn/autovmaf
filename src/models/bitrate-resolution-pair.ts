import { Resolution } from './resolution';

export type BitrateResolutionPair = {
  resolution: Resolution;
  bitrate: number;
  pipelineVariables?: { [key: string]: string };
};
