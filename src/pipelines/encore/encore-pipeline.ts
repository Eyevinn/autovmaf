import { Curl } from 'node-libcurl';
import { Resolution } from '../../models/resolution';
import { Pipeline } from '../pipeline';
import { EncorePipelineConfiguration } from './encore-pipeline-configuration';
import { QualityAnalysisModel, qualityAnalysisModelToString } from '../../models/quality-analysis-model';
import { EncoreInstance } from '../../models/encoreInstance';
import logger from '../../logger';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default class EncorePipeline implements Pipeline {

  configuration: EncorePipelineConfiguration;

  constructor(configuration: EncorePipelineConfiguration) {
    this.configuration = configuration;
  }

  async transcode(input: string, targetResolution: Resolution, targetBitrate: number, output: string, variables?: Record<string, string>, encoreInstance?: EncoreInstance): Promise<string> {
    return "todo"
  }

  async analyzeQuality(reference: string, distorted: string, output: string, model: QualityAnalysisModel): Promise<string> {
    return "todo"
  }

  async createEncoreInstance(apiAddress: string, token: string, instanceId: string, profile: string): Promise<any> {

    const url = `${apiAddress}/encoreinstance`;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const headers = new Headers(headerObj);
    const data = JSON.stringify({
      "name": instanceId,
      "profile": profile,
    });

    const request = new Request(url, {
      method: "POST",
      headers: headers,
      body: data,
    });

    fetch(request).then(response => {
      logger.info(`Create Encore Instance Status: ${response.status}`);
      return response.json()
    })
      .then(data => {
        const encoreInstance: EncoreInstance = data;
        return encoreInstance;
      }).then(encoreInstance => {
        logger.info(encoreInstance.name);
        setTimeout(() => {
          this.createEncoreJob(encoreInstance);
        }, 5000);
      })
      .catch(error => {
        logger.error(error);
      });
  }

  async createEncoreJob(encoreInstance: EncoreInstance): Promise<any> {

    const url = encoreInstance.resources.enqueueJob.url;
    logger.info(url);
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${this.configuration.token}`,
      'Content-Type': 'application/json',
    };
    const headers = new Headers(headerObj);
    const data = JSON.stringify({
      "profile": this.configuration.profile,
      "outputFolder": this.configuration.outputFolder,
      "baseName": this.configuration.baseName,
      "inputs": [
        {
          "uri": this.configuration.inputs[0],
          "type": "AudioVideo"
        }
      ],
      "duration": this.configuration.duration,
      "priority": this.configuration.priority
    });

    const request = new Request(url, {
      method: "POST",
      headers: headers,
      body: data,
    });

    logger.info(await request.text());

    fetch(request).then(response => {
      logger.info(`Create Encore Job Status: ${response.status}`);
    })
    .catch(error => {
        logger.error(error);
      });
  }
}