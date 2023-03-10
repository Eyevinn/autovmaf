import fs from 'fs';
import YAML from 'yaml';
import LocalPipeline from './pipelines/local/local-pipeline';
import AWSPipeline from './pipelines/aws/aws-pipeline';
import { Pipeline } from './pipelines/pipeline';
import logger from './logger';
import { LocalPipelineConfiguration } from './pipelines/local/local-pipeline-configuration';

/**
 * An object representing a pipeline profile.
 */
export type PipelineProfile = {
  /** If this is defined, this profile will use AWS. */
  aws?: {
    inputBucket: string;
    outputBucket: string;
    mediaConvertRole: string;
    mediaConvertEndpoint: string;
    ecsSubnet: string;
    ecsSecurityGroup: string;
    ecsContainerName: string;
    ecsCluster: string;
    ecsTaskDefinition: string;
  };

  /** If this is defined, this profile will use the local pipeline. */
  local?: {
    easyVmafPath: string;
    ffmpegPath: string;
    pythonPath: string;
    ffmpegEncoder: 'libx264' | 'h264_videotoolbox';
  };
};

/**
 * Loads a pipeline from a YAML file and an encoding profile from a JSON file.
 * @param pipelineFilename The local path to the pipeline YAML.
 * @param encodingProfile The local path to the encoding profile JSON. If left undefined, the encoding profile will be set to an empty object.
 * @returns A pipeline that can be used to transcode or analyze videos with.
 */
async function loadPipeline(pipelineFilename: string, encodingProfile?: string): Promise<Pipeline> {
  let encodingProfileData = {};
  if (encodingProfile !== undefined) {
    const encodingProfileFile = fs.readFileSync(encodingProfile, 'utf-8');
    encodingProfileData = JSON.parse(encodingProfileFile);
  }

  const pipelineFile = fs.readFileSync(pipelineFilename, 'utf-8');
  const pipelineData = YAML.parse(pipelineFile);
  const pipelineProfile = pipelineData as PipelineProfile;

  if (pipelineProfile.aws !== undefined) {
    return new AWSPipeline({ ...pipelineProfile.aws, mediaConvertSettings: encodingProfileData });
  } else if (pipelineProfile.local !== undefined) {
    return new LocalPipeline({ ...pipelineProfile.local, ffmpegOptions: encodingProfileData });
  } else {
    throw new Error(`Invalid pipeline: ${JSON.stringify(pipelineProfile)}`);
  }
}

/**
 * Loads a pipeline  and an encoding profile from a JSON object.
 * @param pipelineData The object containing the pipeline data.
 * @param encodingProfile The encoding profile JSON object. If left undefined, the encoding profile will be set to an empty object.
 * @returns A pipeline that can be used to transcode or analyze videos with.
 */
async function loadPipelineFromObjects(pipelineData: any, encodingProfileData?: any): Promise<Pipeline> {
  const pipelineProfile = pipelineData as PipelineProfile;

  if (!encodingProfileData) {
    encodingProfileData = {};
  }

  if (pipelineProfile.aws !== undefined) {
    return new AWSPipeline({ ...pipelineProfile.aws, mediaConvertSettings: encodingProfileData });
  } else if (pipelineProfile.local !== undefined) {
    return new LocalPipeline({ ...pipelineProfile.local, ffmpegOptions: encodingProfileData });
  } else {
    throw new Error(`Invalid pipeline: ${JSON.stringify(pipelineProfile)}`);
  }
}

export { loadPipeline, loadPipelineFromObjects };
