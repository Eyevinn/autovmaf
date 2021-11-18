import fs from 'fs';
import analyzeBruteForce from './analysis/brute-force';
import AWSPipeline from './pipelines/aws/aws-pipeline';
import loadPipeline from './load-pipeline';
import {
  QualityAnalysisModel,
  qualityAnalysisModelToString,
  stringToQualityAnalysisModel,
} from './models/quality-analysis-model';
import logger from './logger';
import Papa from 'papaparse';
import { Resolution } from './models/resolution';
import analyzeWalkTheHull from './analysis/walk-the-hull';
import { BitrateResolutionVMAF } from './models/bitrate-resolution-vmaf';

export type JobDescription = {
  name: string;
  pipeline: string;
  encodingProfile: string;
  reference: string;
  models?: ('HD' | 'PhoneHD' | 'UHD')[];
  resolutions?: Resolution[];
  bitrates?: number[];
  output?: string;
  method?: 'bruteForce' | 'walkTheHull';
};

/**
 * Creates a analysis job according to a job description.
 *
 * @param description An object that describes the job to create.
 * @returns The optimal ladder for each model.
 */
export default async function createJob(
  description: JobDescription
): Promise<{ model: QualityAnalysisModel; optimalLadder: BitrateResolutionVMAF[] }[]> {
  logger.info(`Creating job ${description.name}.`);

  const pipeline = (await loadPipeline(description.pipeline, description.encodingProfile)) as AWSPipeline;

  if (pipeline === undefined) {
    // Only works on AWS.
    throw new Error('Not implemented.');
  }

  let models: QualityAnalysisModel[];
  if (description.models === undefined) {
    models = [QualityAnalysisModel.HD];
  } else {
    models = description.models.map(modelStr => stringToQualityAnalysisModel(modelStr));
  }

  logger.info('Uploading reference file...');
  const reference = await pipeline.uploadIfNeeded(
    description.reference,
    pipeline.configuration.s3Bucket,
    description.name,
    'reference.mp4'
  );

  let modelLadders: {
    model: QualityAnalysisModel;
    optimalLadder: BitrateResolutionVMAF[];
  }[] = [];

  if (description.method === 'walkTheHull') {
    modelLadders = await analyzeWalkTheHull();
  } else {
    const data = await analyzeBruteForce(description.name, reference, pipeline, {
      bitrates: description.bitrates,
      resolutions: description.resolutions,
      concurrency: true,
      models,
      filterFunction:
        description.bitrates !== undefined && description.resolutions !== undefined ? _ => true : undefined,
    });
    modelLadders = data;
  }

  if (description.output !== undefined) {
    for (const modelLadder of modelLadders) {
      const modelStr = qualityAnalysisModelToString(modelLadder.model);
      const outputFilename = description.output + '_' + modelStr + '.csv';
      logger.info(`Writing results to ${outputFilename}...`);

      const ladder = modelLadder.optimalLadder;

      const csv = Papa.unparse(
        ladder.map(rung => ({
          bitrate: rung.bitrate,
          resolution: `${rung.resolution.width}x${rung.resolution.height}`,
          vmaf: rung.vmaf,
        }))
      );

      fs.writeFileSync(outputFilename, csv);
    }
  }

  logger.info('Finished analysis!');

  return modelLadders;
}
