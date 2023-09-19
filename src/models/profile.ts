export type Profile = {
  name: string;
  pipeline: 'local' | 'aws' | 'encore';
  pipelineConfiguration: string;
};
