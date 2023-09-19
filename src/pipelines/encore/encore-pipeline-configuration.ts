export type EncorePipelineConfiguration = {
    apiAddress: string;
    token: string;
    instanceId: string;
    profile: string;
    outputFolder: string;
    baseName: string;
    inputs: Array<string>;
    duration: number;
    priority: number;
  };