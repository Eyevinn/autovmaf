import { Curl } from 'node-libcurl';
import { Resolution } from '../../models/resolution';
import { Pipeline } from '../pipeline';
import { EncorePipelineConfiguration } from './encore-pipeline-configuration';
import { QualityAnalysisModel, qualityAnalysisModelToString } from '../../models/quality-analysis-model';
import { EncoreInstance } from '../../models/encoreInstance';
import logger from '../../logger';

interface Response {
  status: number;
  body: string;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default class EncorePipeline implements Pipeline {

  configuration: EncorePipelineConfiguration;

  constructor(configuration: EncorePipelineConfiguration) {
    this.configuration = configuration;
  }

  async transcode(input: string, targetResolution: Resolution, targetBitrate: number, output: string, variables?: Record<string, string>): Promise<string> {
    const response: Response = await this.createEncoreInstance(this.configuration.apiAddress)
    logger.info(`createEncoreInstanceStatus: ${response.status}`);
    logger.debug(`createEncoreInstanceBody: ${response.body}`);
    const encoreInstance: EncoreInstance = JSON.parse(response.body);

    let pollAttempts: number = 0;
    while (true) {
      if (pollAttempts >= 5) {
        throw new Error("Exceeded maximum polling attempts");
      }
      await delay(5000);
      const getResponse: Response = await this.getEncoreInstance(encoreInstance.url);
      if (getResponse.status == 200) {
        const jobResponse: Response = await this.createEncoreJob(input, encoreInstance.resources.enqueueJob.url);
        logger.info(`createEncoreJobStatus: ${jobResponse.status}`);
        logger.debug(`createEncoreJobBody: ${jobResponse.body}`);
        break
      }
      pollAttempts += 1;
    }
    // TODO: Poll or check jobs are done and have been analyzed. Then deleteEncoreInstance(instanceId: string).
    return "todo"
  }

  async analyzeQuality(reference: string, distorted: string, output: string, model: QualityAnalysisModel): Promise<string> {
    return "todo"
  }

  async createEncoreInstance(apiAddress: string, curlInstance?: Curl): Promise<Response> {
    const url = `${apiAddress}`;
    const headers = [
      'accept: application/json',
      `x-jwt: Bearer ${this.configuration.token}`,
      'Content-Type: application/json',
    ];
    const data = JSON.stringify({
      "name": this.configuration.instanceId,
      "profile": this.configuration.profile,
    });

    return new Promise<Response>((resolve) => {
      if (curlInstance === undefined){
        curlInstance = new Curl();
      }
      curlInstance.setOpt('URL', url);
      curlInstance.setOpt('HTTPHEADER', headers);
      curlInstance.setOpt('POSTFIELDS', data);

      curlInstance.on('end', function (statusCode: number, body: string | Buffer) {
        resolve({ status: statusCode, body: body.toString() });
        this.close();
      });
      curlInstance.on('error', curlInstance.close.bind(curlInstance));
      curlInstance.perform();
    })
  }

  async getEncoreInstance(instanceUrl: string, curlInstance?: Curl): Promise<Response> {
    const url = instanceUrl;
    const headers = [
      'accept: application/json',
      `x-jwt: Bearer ${this.configuration.token}`,
      'Content-Type: application/json',
    ];

    return new Promise<Response>((resolve) => {
      if (curlInstance === undefined){
        curlInstance = new Curl();
      }
      curlInstance.setOpt('URL', url);
      curlInstance.setOpt('HTTPHEADER', headers);
      curlInstance.setOpt('CUSTOMREQUEST', 'GET');

      curlInstance.on('end', function (statusCode: number, body: string | Buffer) {
        resolve({ status: statusCode, body: body.toString() });
        this.close();
      });
      curlInstance.on('error', curlInstance.close.bind(curlInstance));
      curlInstance.perform();
    })
  }

  async deleteEncoreInstance(apiAddress: string, instanceId: string, curlInstance?: Curl): Promise<boolean> {
    if (curlInstance === undefined){
      curlInstance = new Curl();
    }
    const url = `${apiAddress}/encoreinstance/${instanceId}`;
    const headers = [
      'accept: application/json',
      `x-jwt: Bearer ${this.configuration.token}`,
      'Content-Type: application/json',
    ];

    curlInstance.setOpt('URL', url);
    curlInstance.setOpt('HTTPHEADER', headers);
    curlInstance.setOpt('CUSTOMREQUEST', 'DELETE');

    curlInstance.on('end', function (statusCode) {
      logger.info(statusCode);
      this.close();
    });

    curlInstance.on('error', curlInstance.close.bind(curlInstance));
    curlInstance.perform();

    return true
  }

  async createEncoreJob(input: string, enqueueJobUrl: string, curlInstance?: Curl): Promise<Response> {
    const url = enqueueJobUrl;
    const headers = [
      'accept: application/json',
      `x-jwt: Bearer ${this.configuration.token}`,
      'Content-Type: application/json',
    ];
    const data = JSON.stringify({
      "profile": this.configuration.profile,
      "outputFolder": this.configuration.outputFolder,
      "baseName": this.configuration.baseName,
      "inputs": [
        {
          "uri": input,
          "type": "AudioVideo"
        }
      ],
      "duration": this.configuration.duration,
      "priority": this.configuration.priority
    });

    return new Promise<Response>((resolve) => {
      if (curlInstance === undefined){
        curlInstance = new Curl();
      }
      curlInstance.setOpt('URL', url);
      curlInstance.setOpt('HTTPHEADER', headers);
      curlInstance.setOpt('POSTFIELDS', data);

      curlInstance.on('end', function (statusCode: number, body: string | Buffer) {
        resolve({ status: statusCode, body: body.toString() });
        this.close();
      });
      curlInstance.on('error', curlInstance.close.bind(curlInstance));
      curlInstance.perform();
    })
  }
}