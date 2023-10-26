import { Resolution } from '../../models/resolution';
import { Pipeline } from '../pipeline';
import AWSPipeline from '../aws/aws-pipeline';
import { AWSPipelineConfiguration } from '../aws/aws-pipeline-configuration';
import { EncorePipelineConfiguration } from './encore-pipeline-configuration';
import { QualityAnalysisModel } from '../../models/quality-analysis-model';
import { EncoreInstance } from '../../models/encoreInstance';
import { EncoreJobs, EncoreJob } from '../../models/encoreJobs';
import logger from '../../logger';
import fs from 'fs';
const ISOBoxer = require('codem-isoboxer');
const { Readable } = require('stream'); //Typescript import library contains different functions. 
//If someone knows how to achieve the same functionality in Typescript syntax let me know.
const { finished } = require('stream/promises'); //Same as above.

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EncorePipeline implements Pipeline {

  configuration: EncorePipelineConfiguration;

  constructor(configuration: EncorePipelineConfiguration) {
    this.configuration = configuration;
  }

  async transcode(input: string, targetResolution: Resolution, targetBitrate: number, output: string, variables?: Record<string, string>): Promise<string> {
    return "todo"
  }

  async analyzeQuality(reference: string, distorted: string, output: string, model: QualityAnalysisModel): Promise<string> {

    const AWSConf: AWSPipelineConfiguration = {
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

    const awsPipe = new AWSPipeline(AWSConf);
    const result: string = await awsPipe.analyzeQuality(reference, distorted, output, model)
    return result
  }

  /**
   * Creates an Encore Instance, waits for 5000ms, then attempts to enqueue a transcode job.
   * @param apiAddress The api address .
   * @param token api token.
   * @param instanceId The Encore Instance that will enqueue the transcode job.
   * @param profile The transcode profile.
   */
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

    return fetch(request).then(response => {
      logger.info(`Create Encore Instance Status: ${response.status}`);
      if (response.status == 200) {
        return response.json();
      }
      else {
        throw new Error('Instance creation failed');
      }
    }).catch(error => {
      logger.error(error);
    });
  }

  /**
   * Attempts to delete an Encore Instance.
   * @param encoreInstance The Encore Instance to be deleted.
   */
  async deleteEncoreInstance(encoreInstance: EncoreInstance): Promise<void> {

    const url = encoreInstance.url;
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
      logger.info(`Delete Encore Instance Status: ${response.status}`);
    })
      .catch(error => {
        logger.error(error);
      });
  }

  /**
   * Attempts to enqueue a transcode job to an Encore Instance.
   * @param encoreInstance The Encore Instance were the job should be enqueued.
   * @param mediaFileAddress The https address of the media file to be enqueued.
   */
  async createEncoreJob(encoreInstance: EncoreInstance, mediaFileAddress: string): Promise<any> {

    const url = encoreInstance.resources.enqueueJob.url;
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
          "uri": mediaFileAddress,
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
        logger.error(error);
      });
  }

  /**
   * Polls the encore api until all enqueued jobs have reached a SUCCESSFUL state
   *  and been downloaded or have FAILED.
   * @param encoreInstance The Encore Instance were the jobs have been queued.
   * @param enqueuedJobIds List of jobs that are expected to be transcoded.
   */
  async pollUntilAllJobsCompleted(encoreInstance: EncoreInstance, enqueuedJobIds: string[]): Promise<any> {
    logger.info("polling until successful job")
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
      for (let job of jobs) {
        logger.info(`Encore Job Transcoding Status: ${job.status}`);
        const jobShouldBeProcessed: number = enqueuedJobIds.indexOf(job.id);
        if (job.status === "SUCCESSFUL" && jobShouldBeProcessed != -1) {
          for (let outputObj of job.output) {
            let filePath: string = outputObj.file;
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
      await delay(this.configuration.encorePollingInterval_ms);
    }
  }

  /**
   * Attempts to get all jobs for an Encore Instance.
   * @param encoreInstance The Encore Instance to get jobs from.
   */
  async getEncoreJobs(encoreInstance: EncoreInstance): Promise<any> {
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
        logger.error(error);
      });
  }

  /**
   * Download a finished transcode job using a url address.
   * @param url The file url to download.
   * @param filename The filename that should be given to the downloaded file.
   */
  async downloadFile(url: string, filename: string): Promise<any> {
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

  async runTranscodeThenAnalyze(instance: EncoreInstance) {

    let jobIds: string[] = [];
    let references: string[] = [];

    for (let input of this.configuration.inputs) {
      const job: EncoreJob = await this.createEncoreJob(instance, input);
      jobIds.push(job.id);
      const referenceFilename: string = `${job.id}_reference.mp4`;
      references.push(referenceFilename);
      await this.downloadFile(input, referenceFilename);
      await this.pollUntilAllJobsCompleted(instance, jobIds);

      const dir: string = `./${this.configuration.baseName}`;
      fs.readdir(dir, (err, files) => {
        files.forEach(file => {
          if (file.includes(".mp4") && !file.includes("reference")) {
            const arrayBuffer = new Uint8Array(fs.readFileSync(`${dir}/${file}`)).buffer;
            const parsedFile = ISOBoxer.parseBuffer(arrayBuffer);
            const hdlrs = parsedFile.fetchAll('hdlr');
            let isVideo: boolean = false;
            hdlrs.forEach(hldr => {
              if (hldr.handler_type == "vide") {
                logger.debug(`Contains video track: ${file}`);
                isVideo = true;
              }
            })
            if (isVideo) {
              logger.info(`Analyzing quality using: ${file}`);
              this.analyzeQuality(`./${this.configuration.baseName}/${referenceFilename}`, `${dir}/${file}`, `OSAAS_Encore_workdir/output_${file}.json`, QualityAnalysisModel.HD)
            }
          }
        });
      });
    }
  }
}