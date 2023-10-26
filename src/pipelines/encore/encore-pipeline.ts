import AWSPipeline from '../aws/aws-pipeline';
import { AWSPipelineConfiguration } from '../aws/aws-pipeline-configuration';
import { EncoreInstance } from '../../models/encoreInstance';
import { EncoreJobs, EncoreJob } from '../../models/encoreJobs';
import { EncorePipelineConfiguration } from './encore-pipeline-configuration';
import { EncoreYAMLGenerator } from '../../encoreYamlGenerator';
import { Pipeline } from '../pipeline';
import { Resolution } from '../../models/resolution';
import { QualityAnalysisModel } from '../../models/quality-analysis-model';
import logger from '../../logger';
import fs from 'fs';
//const ISOBoxer = require('codem-isoboxer');
const { Readable } = require('stream'); //Typescript import library contains different functions. 
//If someone knows how to achieve the same functionality in Typescript syntax let me know.
const { finished } = require('stream/promises'); //Same as above.

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EncorePipeline implements Pipeline {

  configuration: EncorePipelineConfiguration;
  private awsConf: AWSPipelineConfiguration;
  private awsPipe: AWSPipeline;

  constructor(configuration: EncorePipelineConfiguration) {
    this.configuration = configuration;
    this.awsConf = {
      inputBucket: "vmaf-files-incoming",
      outputBucket: "vmaf-files",
      mediaConvertRole: "",
      mediaConvertSettings: "",
      mediaConvertEndpoint: "",
      ecsSubnet: "subnet-05d98882c13408e16",
      ecsSecurityGroup: "sg-0e444b67a747bf739",
      ecsContainerName: "easyvmaf-s3",
      ecsCluster: "vmaf-runner",
      ecsTaskDefinition: "easyvmaf-s3:3"
    };
    this.awsPipe = new AWSPipeline(this.awsConf);
  }

  async transcode(input: string, targetResolution: Resolution, targetBitrate: number, output: string, variables?: Record<string, string>, inlineProfile?: string, resolutions?: Resolution[], bitRates?: number[]): Promise<string> {

    if (!(inlineProfile && resolutions && bitRates)) {
      throw new Error('No inline profile in encore transcode');
    }

    const instance: EncoreInstance | undefined = await this.createEncoreInstance(this.configuration.apiAddress, this.configuration.token, this.configuration.instanceId, this.configuration.profilesUrl);
    await delay(this.configuration.encoreInstancePostCreationDelay_ms); // Delay required to allow instance to be created before calling it
    if (!instance) {
      throw new Error('undefined instance');
    }
    const yamlGenerator = new EncoreYAMLGenerator();
    const transcodingProfile = yamlGenerator.createProfile(inlineProfile, resolutions, bitRates);
    await this.runTranscodeThenPollUntilFinished(instance, transcodingProfile);
    await this.deleteEncoreInstance(instance, this.configuration.apiAddress);
    return output
  }

  async analyzeQuality(reference: string, distorted: string, output: string, model: QualityAnalysisModel): Promise<string> {

    return await this.awsPipe.analyzeQuality(reference, distorted, output, model);
  }

  /**
   * Creates an Encore Instance, waits, then attempts to enqueue a transcode job.
   * @param apiAddress The api address.
   * @param token api token.
   * @param instanceId The Encore Instance that will enqueue the transcode job.
   * @param profile The transcode profile.
   */
  async createEncoreInstance(apiAddress: string, token: string, instanceId: string, profilesUrl: string): Promise<EncoreInstance | undefined> {

    const url = `${apiAddress}/encoreinstance`;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const headers = new Headers(headerObj);
    const data = JSON.stringify({
      "name": instanceId,
      "profilesUrl": profilesUrl,
    });

    const request = new Request(url, {
      method: "POST",
      headers: headers,
      body: data,
    });

    return fetch(request).then(response => {
      logger.info(`Create Encore Instance Status: ${response.status}`);
      if (response.status == 200) {
        return response.json();
      }
      else {
        throw new Error('Instance creation failed');
      }
    }).catch(error => {
      logger.error(`Create Encore Instance ${error}`);
    });
  }

  /**
   * Attempts to delete an Encore Instance.
   * @param encoreInstance The Encore Instance to be deleted.
   */
  async deleteEncoreInstance(encoreInstance: EncoreInstance, apiAddress: string): Promise<void> {

    const url = `${apiAddress}/encoreinstance/${encoreInstance.name}`;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${this.configuration.token}`,
    };
    const headers = new Headers(headerObj);

    const request = new Request(url, {
      method: "DELETE",
      headers: headers,
    });

    fetch(request).then(response => {
      if (response.status == 204) {
        logger.info(`Successfully deleted encore instance`);
      }
    })
      .catch(error => {
        logger.error(`Delete Encore Instance ${error}`);
      });
  }

  /**
   * Attempts to enqueue a transcode job to an Encore Instance.
   * @param encoreInstance The Encore Instance were the job should be enqueued.
   * @param input The https address of the media file to be enqueued.
   */
  async createEncoreJob(encoreInstance: EncoreInstance, input: string, transcodeProfile: string): Promise<EncoreJob> {

    const url = encoreInstance.resources.enqueueJob.url;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${this.configuration.token}`,
      'Content-Type': 'application/json',
    };
    const headers = new Headers(headerObj);
    const data = JSON.stringify({
      "inlineProfile": transcodeProfile,
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

    const request = new Request(url, {
      method: "POST",
      headers: headers,
      body: data,
    });

    return fetch(request).then(response => {
      logger.info(`Create Encore Job Status: ${response.status}`);
      if (response.status == 201) {
        return response.json();
      }
      else {
        throw new Error('Job creation failed');
      }
    })
      .catch(error => {
        logger.error(`Create Encore Job ${error}`);
      });
  }

  /**
   * Polls the encore api until all enqueued jobs have reached a SUCCESSFUL state
   *  and are downloaded or have FAILED.
   * @param encoreInstance The Encore Instance were the jobs have been queued.
   * @param enqueuedJobIds List of jobs that are expected to be transcoded.
   */
  async pollUntilAllJobsCompleted(encoreInstance: EncoreInstance, enqueuedJobIds: string[]): Promise<void> {
    logger.info("polling until successful job")
    let pollCounter = 0;
    let pollInterval_ms = this.configuration.encorePollingInterval_ms;
    while (true) {
      logger.info(`Enqueued jobs: ${enqueuedJobIds}`);
      if (enqueuedJobIds.length < 1 || enqueuedJobIds === undefined) {
        break
      }
      const jobsResponse: EncoreJobs = await this.getEncoreJobs(encoreInstance);
      const jobs: EncoreJob[] = jobsResponse._embedded.encoreJobs;
      if (jobs.length < 1 || jobs === undefined) {
        logger.info("getEncoreJobs returned empty list");
        break
      }
      await this.downloadSuccessfulJobs(encoreInstance, enqueuedJobIds, jobs);

      //Increase poll interval if repeatedly polling, up until 20 minutes.
      if (pollCounter > 2) {
        pollInterval_ms += Math.round(pollInterval_ms) * 2;
        pollCounter = 0;
      }
      if (pollInterval_ms <= 1200000) {
        pollCounter++;
      }
      await delay(pollInterval_ms);
    }
  }

  /**
   * Download enqueued jobs that have reached a SUCCESSFUL state.
   * @param encoreInstance The Encore Instance were the jobs have been queued.
   * @param enqueuedJobIds List of jobs that are expected to be transcoded.
   * @param jobs List of EncoreJobs that have been successfully transcoded.
   */
  async downloadSuccessfulJobs(encoreInstance: EncoreInstance, enqueuedJobIds: string[], jobs: EncoreJob[]){

    for (let job of jobs) {
      logger.info(`Encore Job Transcoding Status: ${job.status}`);
      const jobShouldBeProcessed: number = enqueuedJobIds.indexOf(job.id);
      if (job.status === "SUCCESSFUL" && jobShouldBeProcessed != -1) {
        for (let successfulTranscoding of job.output) {
          let filePath: string = successfulTranscoding.file;
          let url: string = `${encoreInstance.url}${filePath}`;;
          if (filePath[0] == "/") {
            const trimmedInstanceUrl: string = encoreInstance.url.substring(0, encoreInstance.url.length - 1);
            // Remove final '/' in url to enable combining with filename path
            const url: string = `${trimmedInstanceUrl}${filePath}`;
            const splitFilename = filePath.split("/");
            filePath = splitFilename[splitFilename.length - 1];
          }
          await this.downloadFile(url, filePath);
        }
        enqueuedJobIds.splice(jobShouldBeProcessed, 1);
      }
      else if (job.status === "FAILED") {
        enqueuedJobIds.splice(jobShouldBeProcessed, 1);
      }
    }
  }

  /**
   * Attempts to get all jobs for an Encore Instance.
   * @param encoreInstance The Encore Instance to get jobs from.
   */
  async getEncoreJobs(encoreInstance: EncoreInstance): Promise<EncoreJobs> {
    const url = encoreInstance.resources.listJobs.url;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${this.configuration.token}`,
    };
    const headers = new Headers(headerObj);

    const request = new Request(url, {
      method: "GET",
      headers: headers,
    });

    return fetch(request).then(response => {
      logger.info(`GET Encore Jobs Status: ${response.status}`);
      if (response.status == 200) {
        return response.json();
      }
    })
      .catch(error => {
        logger.error(`Get Encore Jobs ${error}`);
      });
  }

  /**
   * Download a finished transcode job using a url address.
   * @param url The file url to download.
   * @param filename The filename that should be given to the downloaded file.
   */
  async downloadFile(url: string, filename: string): Promise<string> {
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${this.configuration.token}`,
      'Content-Type': 'application/json',
    };
    const headers = new Headers(headerObj);

    const request = new Request(url, {
      headers: headers,
    });

    logger.info(`File to download: ${filename}`);
    const dir: string = `./${this.configuration.baseName}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug('Directory created:', dir);
    }
    const destinationPath: string = `${dir}/${filename}`;
    const stream = fs.createWriteStream(destinationPath);
    const { body } = await fetch(request);
    await finished(Readable.fromWeb(body).pipe(stream));
    return filename;
  }

  async runTranscodeThenPollUntilFinished(instance: EncoreInstance, transcodeProfile: string): Promise<void> {

    let jobIds: string[] = [];
    let input = this.configuration.input;

    const job: EncoreJob = await this.createEncoreJob(instance, input, transcodeProfile);
    if (!job) {
      return
    }
    jobIds.push(job.id);
    const referenceFilename: string = `reference.mp4`;
    await this.downloadFile(input, referenceFilename);
    await this.pollUntilAllJobsCompleted(instance, jobIds);

    // for (let input of this.configuration.inputs) {
    //   const job: EncoreJob = await this.createEncoreJob(instance, input);
    //   jobIds.push(job.id);
    //   const referenceFilename: string = `${job.id}_reference.mp4`;
    //   references.push(referenceFilename);
    //   await this.downloadFile(input, referenceFilename);
    //   await this.pollUntilAllJobsCompleted(instance, jobIds);

    //   const dir: string = `./${this.configuration.baseName}`;
    //   fs.readdir(dir, (err, files) => {
    //     files.forEach(file => {
    //       if (file.includes(".mp4") && !file.includes("reference")) {
    //         const arrayBuffer = new Uint8Array(fs.readFileSync(`${dir}/${file}`)).buffer;
    //         const parsedFile = ISOBoxer.parseBuffer(arrayBuffer);
    //         const hdlrs = parsedFile.fetchAll('hdlr');
    //         let isVideo: boolean = false;
    //         hdlrs.forEach(hldr => {
    //           if (hldr.handler_type == "vide") {
    //             logger.debug(`Contains video track: ${file}`);
    //             isVideo = true;
    //           }
    //         })
    //         if (isVideo) {
    //           logger.info(`Analyzing quality using: ${file}`);
    //           this.analyzeQuality(`./${this.configuration.baseName}/${referenceFilename}`, `${dir}/${file}`, `OSAAS_Encore_workdir/output_${file}.json`, QualityAnalysisModel.HD)
    //         }
    //       }
    //     });
    //   });
    // }
  }
}