import fs from 'fs';
import YAML from 'yaml';
import { LocalPipeline } from '.';
import AWSPipeline from './pipelines/aws/aws-pipeline';
import { Pipeline } from './pipelines/pipeline';

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

  local?: {
    easyVmafPath: string;
    ffmpegPath: string;
    pythonPath: string;
    ffmpegEncoder: 'libx264' | 'h264_videotoolbox';
  };
};

export default async function loadPipeline(pipelineFilename: string, encodingProfile?: string): Promise<Pipeline> {
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
    throw new Error('Method not implemented.');
  }
}
