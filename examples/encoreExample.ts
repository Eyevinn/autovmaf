import { EncorePipelineConfiguration } from '../src/pipelines/encore/encore-pipeline-configuration';
import { JobDescription } from '../src/create-job';
import createJob from '../src/create-job';

const configuration: EncorePipelineConfiguration = {
  apiAddress: "https://api-encore.stage.osaas.io",
  token: "",
  instanceId: "dummy",
  profile: "program",
  outputFolder: "/usercontent/demo",
  baseName: "_demo_job",
  inputs: ["https://testcontent.eyevinn.technology/mp4/stswe-tvplus-promo.mp4"],
  duration: 5,
  priority: 0,
  encorePollingInterval_ms: 60000,
  encoreInstancePostCreationDelay_ms: 10000
};

const job: JobDescription = {
  name: "oliver_testjob",
  pipeline: configuration,
  encodingProfile: configuration.profile,
  reference: configuration.inputs[0]
}

createJob(job);