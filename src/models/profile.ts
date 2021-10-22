export type Profile = {
  name: string;
  pipeline: 'local' | 'aws';
  pipelineConfiguration: string;
};
