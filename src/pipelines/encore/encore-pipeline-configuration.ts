export type EncorePipelineConfiguration = {
    apiAddress: string;
    token: string;
    instanceId: string;
    profilesUrl: string;
    inlineProfile: string;
    outputFolder: string;
    baseName: string;
    input: string;
    duration: number;
    priority: number;
    encorePollingInterval_ms: number;
    encoreInstancePostCreationDelay_ms: number
  };