import { QualityAnalysisModel } from '../models/quality-analysis-model';
import { Resolution } from '../models/resolution';

export abstract class Pipeline {
  // Output should contain file ending. Directory in output should be created if it does not exist.
  abstract transcode(
    input: string,
    targetResolution: Resolution,
    targetBitrate: number,
    output: string
  ): Promise<string>;
  // Output should contain file ending. Directory in output should be created if it does not exist.
  abstract analyzeQuality(
    reference: string,
    distorted: string,
    output: string,
    model: QualityAnalysisModel
  ): Promise<string>;
}
