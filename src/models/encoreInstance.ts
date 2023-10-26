export type EncoreInstance = {
    name: string,
    url: string,
    profilesUrl: string,
    resources: {
      license: {
        url: string
      },
      enqueueJob: {
        url: string,
        method: string
      },
      listJobs: {
        url: string,
        method: string
      }
    }
  };