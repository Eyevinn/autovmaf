import { QualityAnalysisModel } from '../models/quality-analysis-model';
import { Resolution } from '../models/resolution';

/**
 * Abstract class for a pipeline which can be used for transcoding and analysis.
 */
export abstract class Pipeline {
  // Output should contain file ending. Directory in output should be created if it does not exist.
  abstract transcode(
    input: string,
    targetResolution: Resolution,
    targetBitrate: number,
    output: string,
    variables?: Record<string, string>
  ): Promise<string>;
  // Output should contain file ending. Directory in output should be created if it does not exist.
  abstract analyzeQuality(
    reference: string,
    distorted: string,
    output: string,
    model: QualityAnalysisModel
  ): Promise<string>;
}
