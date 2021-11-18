import { QualityAnalysisModel } from '../models/quality-analysis-model';
import { BitrateResolutionVMAF } from '../models/bitrate-resolution-vmaf';

export default async function analyzeWalkTheHull(): Promise<
  { model: QualityAnalysisModel; optimalLadder: BitrateResolutionVMAF[] }[]
> {
  // TODO: Implement walk the hull https://mux.com/blog/per-title-encoding-scale/
  return [];
}
