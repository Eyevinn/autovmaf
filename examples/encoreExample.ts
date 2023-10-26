import { EncorePipelineConfiguration } from '../src/pipelines/encore/encore-pipeline-configuration';
import { EncorePipeline, delay } from '../src/pipelines/encore/encore-pipeline';
import { EncoreInstance } from '../src/models/encoreInstance';

async function transcodeInputsAndAnalyze() {

    const configuration: EncorePipelineConfiguration = {
      apiAddress: "https://api-encore.stage.osaas.io",
      token: "",
      instanceId: "dummy",
      profile: "program",
      outputFolder: "/usercontent/demo",
      baseName: "_demo",
      inputs: ["https://testcontent.eyevinn.technology/mp4/stswe-tvplus-promo.mp4"],
      duration: 120,
      priority: 0,
      encorePollingInterval_ms: 30000,
      encoreInstancePostCreationDelay_ms: 10000
    };  
  
    const pipeline: EncorePipeline = new EncorePipeline(configuration);
    const instance: EncoreInstance = await pipeline.createEncoreInstance(configuration.apiAddress, configuration.token, configuration.instanceId, configuration.profile);
    await delay(pipeline.configuration.encoreInstancePostCreationDelay_ms); // Delay required to allow instance to be created before calling it
    await pipeline.runTranscodeThenAnalyze(instance);
    
    }
  
    transcodeInputsAndAnalyze();