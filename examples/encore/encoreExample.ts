import { EncorePipelineConfiguration } from '../../src/pipelines/encore/encore-pipeline-configuration';
import { EncorePipeline } from '../../src/pipelines/encore/encore-pipeline';
import fs from 'fs';

async function transcodeInputsAndAnalyze() {

  const inlineProfile = fs.readFileSync('encoreProfile.yml', 'utf8');

    const configuration: EncorePipelineConfiguration = {
      apiAddress: "https://api-encore.stage.osaas.io",
      token: "",
      instanceId: "dummy",
      profilesUrl: "profilesUrl",
      inlineProfile: inlineProfile,
      outputFolder: "/usercontent/demo",
      baseName: "_demo",
      input: "https://testcontent.eyevinn.technology/mp4/stswe-tvplus-promo.mp4",
      duration: 120,
      priority: 0,
      encorePollingInterval_ms: 30000,
      encoreInstancePostCreationDelay_ms: 10000
    };

    const resolutions = [{ 
      width: 1280,
      height: 720,
      range: { 
        min: 500000,
        max: 600000
      }
   }];

   const bitrates = [
   500000,
   600000,
   800000
 ]

    const pipeline: EncorePipeline = new EncorePipeline(configuration);
    await pipeline.transcode(configuration.input, { width: 0, height: 0}, 0, "output", undefined, configuration.inlineProfile, resolutions, bitrates);  
    }

transcodeInputsAndAnalyze();