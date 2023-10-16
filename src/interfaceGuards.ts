import { EncorePipelineConfiguration } from "./pipelines/encore/encore-pipeline-configuration";
import { LocalPipelineConfiguration } from "./pipelines/local/local-pipeline-configuration";

export function instanceOfLocalPipelineConfiguration(object: any): object is LocalPipelineConfiguration {
  return (typeof object === 'object' &&
  'ffmpegPath' in object && 'pythonPath' in object && 'easyVmafPath' in object &&
   'ffmpegEncoder' in object && 'ffmpegOptions' in object);
}
  
export function instanceOfEncorePipelineConfiguration(object: any): object is EncorePipelineConfiguration {
  return (typeof object === 'object' &&
  'apiAddress' in object && 'token' in object && 'instanceId' in object &&
   'profile' in object && 'outputFolder' in object && 'baseName' in object &&
   'inputs' in object && 'duration' in object && 'priority' in object &&
   'encorePollingInterval_ms' in object && 'encoreInstancePostCreationDelay_ms' in object);
}