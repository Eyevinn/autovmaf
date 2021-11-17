import fs from 'fs';
import YAML from 'yaml';
import analyze from './analyze';
import {
  QualityAnalysisModel,
  qualityAnalysisModelToString,
  stringToQualityAnalysisModel,
} from './models/quality-analysis-model';
import AWSPipeline from './pipelines/aws/aws-pipeline';
import Papa from 'papaparse';
import logger from './logger';

type Job = {
  name: string;
  pipeline: string;
  encodingProfile: string;
  reference: string;
  models?: ('HD' | 'PhoneHD' | 'UHD')[];
  resolutions?: string[];
  bitrates?: number[];
  concurrency: boolean;
  output?: string;
};

type PipelineProfile = {
  aws?: {
    s3Bucket: string;
    mediaConvertRole: string;
    mediaConvertEndpoint: string;
    ecsSubnet: string;
    ecsSecurityGroup: string;
    ecsContainerName: string;
    ecsCluster: string;
    ecsTaskDefinition: string;
  };
};

export default async function runJob(filename: string) {
  const jobFile = fs.readFileSync(filename, 'utf-8');
  const jobData = YAML.parse(jobFile);
  const job = jobData as Job;

  const encodingProfileFile = fs.readFileSync(job.encodingProfile, 'utf-8');
  const encodingProfileData = JSON.parse(encodingProfileFile);

  const pipelineFile = fs.readFileSync(job.pipeline, 'utf-8');
  const pipelineData = YAML.parse(pipelineFile);
  const pipelineProfile = pipelineData as PipelineProfile;

  if (pipelineProfile.aws !== undefined) {
    logger.info(`Running ${filename} on AWS...`);

    const pipeline = new AWSPipeline({ ...pipelineProfile.aws, mediaConvertSettings: encodingProfileData });

    let models: QualityAnalysisModel[];
    if (job.models === undefined) {
      models = [QualityAnalysisModel.HD];
    } else {
      models = job.models.map(modelStr => stringToQualityAnalysisModel(modelStr));
    }

    logger.info('Uploading reference file...');
    const reference = await pipeline.uploadIfNeeded(
      job.reference,
      pipelineProfile.aws.s3Bucket,
      job.name,
      'reference.mp4'
    );

    const modelLadders = await analyze(job.name, reference, pipeline, {
      bitrates: job.bitrates,
      resolutions: job.resolutions?.map(resolutionStr => ({
        width: parseInt(resolutionStr.split('x')[0]),
        height: parseInt(resolutionStr.split('x')[1]),
      })),
      concurrency: job.concurrency,
      models,
      filterFunction: job.bitrates !== undefined && job.resolutions !== undefined ? _ => true : undefined,
    });

    if (job.output !== undefined) {
      for (const modelLadder of modelLadders) {
        const modelStr = qualityAnalysisModelToString(modelLadder.model);
        const outputFilename = job.output + '_' + modelStr + '.csv';
        logger.info(`Writing results to ${outputFilename}...`);

        const ladder = modelLadder.ladder;

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
  }
}
