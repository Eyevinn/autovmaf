export type EncoreJobs = {
  _embedded: {
    encoreJobs: EncoreJob[];
  };
  _links: {
    self: any;
    profile: any;
    search: any;
  };
  page: any;
};

export type EncoreJob = {
  id: string;
  externalId: string;
  profile: string;
  outputFolder: string;
  baseName: string;
  createdDate: Date;
  progressCallbackUri: string;
  priority: number;
  message: string;
  progress: number;
  speed: string;
  startedDate: Date;
  completedDate: Date;
  debugOverlay: boolean;
  logContext: any;
  seekTo: string;
  duration: number;
  thumbnailTime: string;
  inputs: any[];
  output: Output[];
  status: string;
  _links: {
    self: {
      href: string;
    };
    encoreJob: {
      href: string;
    };
  };
};

export type Output = {
  file: string;
  fileSize: number;
  format: string;
  overallBitrate: number;
  duration: number;
  videoStreams: any[];
  audioStreams: any[];
  type: string;
};
