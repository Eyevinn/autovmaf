import fs from 'fs';
import analyzeBruteForce from './analysis/brute-force';
import AWSPipeline from './pipelines/aws/aws-pipeline';
import { loadPipeline, loadPipelineFromObjects } from './load-pipeline';
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

/** Describes a ABR-analysis job and can be used to create jobs using the createJob()-function. */
export type JobDescription = {
  /** This will name the folder in which to put the files. */
  name: string;

  /** Path to a YAML-file that defines the pipeline. See `examples/pipeline.yml` for an example AWS-pipeline. */
  pipeline: string;

  /** Path to a JSON-file that defines how the reference should be encoded. When using AWS, this is a MediaConvert configuration. For local pipelines, this is key-value pairs that will be passed as command line arguments to FFmpeg. See an example for AWS at `examples/encoding-profile.json`.  */
  encodingProfile: string;

  /** Path to the reference video to analyze. Normally a local path, but when using AWS, this can also be an S3-URI. */
  reference: string;

  /** A list of VMAF-models to use in evaluation. This can be HD, MobileHD and UHD. HD by default. */
  models?: ('HD' | 'PhoneHD' | 'UHD')[];

  /** A list of resolutions to test. By default it will test all resolutions in the example ABR-ladder provided by Apple in the [HLS Authoring Spec](https://developer.apple.com/documentation/http_live_streaming/hls_authoring_specification_for_apple_devices). */
  resolutions?: Resolution[];

  /** A list of bitrates to test. By default a list of bitrates between 150 kbit/s to 9000 kbit/s. */
  bitrates?: number[];

  /** The method to use when analyzing the videos. Either `bruteForce` or `walkTheHull`. By default `bruteForce`. NOTE: `walkTheHull` is not implemented at the moment. */
  method?: 'bruteForce' | 'walkTheHull';
};

/**
 * Creates a analysis job according to a job description.
 *
 * @example **Example of creating a job from a job description.**
 * ```javascript
 * const { createJob, qualityAnalysisModelToString } = require('@eyevinn/autovmaf');
 *
 * const abrLadder = await = createJob({
 *   name: "hello",
 *   pipeline: "pipeline.yml",
 *   encodingProfile: "profile.json",
 *   reference: "reference.mp4",
 *   models: ["HD", "PhoneHD"],
 *   resolutions: [{ width: 1280, height: 720 }],
 *   bitrates: [600000],
 *   method: "bruteForce"
 * });
 * ```
 * @example **Example of creating a job from a YAML-file.**
 * ```javascript
 * const { createJob, JobDescription } = require('@eyevinn/autovmaf');
 * const YAML = require('yaml');
 * const fs = require('fs');
 *
 * const parseResolutions = resolutions => {
 * resolutions.map(resolutionStr => ({
 *    width: parseInt(resolutionStr.split('x')[0]),
 *    height: parseInt(resolutionStr.split('x')[1]),
 *   }));
 * };
 *
 * const jobFile = fs.readFileSync('job.yml', 'utf-8');
 * const jobData = YAML.parse(jobFile);
 * const job = {
 *   ...jobData,
 *   resolutions: jobData['resolutions'] !== undefined ? parseResolutions(jobData['resolutions']) : undefined,
 * };
 *
 * createJob(job);
 * ```
 *
 * @param description An object that describes the job to create.
 */
export default async function createJob(description: JobDescription, pipelineData?: any, encodingProfileData?: any) {
  logger.info(`Creating job ${description.name}.`);

  let pipeline: any = undefined;
  if (pipelineData && encodingProfileData) {
    pipeline = (await loadPipelineFromObjects(pipelineData, encodingProfileData)) as AWSPipeline;
  } else {
    pipeline = (await loadPipeline(description.pipeline, description.encodingProfile)) as AWSPipeline;
  }

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

  if (description.method === 'walkTheHull') {
    await analyzeWalkTheHull();
  } else {
    await analyzeBruteForce(description.name, reference, pipeline, {
      bitrates: description.bitrates,
      resolutions: description.resolutions,
      concurrency: true,
      models,
      filterFunction:
        description.bitrates !== undefined && description.resolutions !== undefined ? _ => true : undefined,
    });
  }

  logger.info('Finished analysis!');
}
