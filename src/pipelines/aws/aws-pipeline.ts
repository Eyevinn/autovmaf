import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import {
  CreateJobCommand,
  CreateJobCommandOutput,
  GetJobCommand,
  MediaConvertClient
} from '@aws-sdk/client-mediaconvert';
import {
  HeadObjectCommand,
  GetObjectCommand,
  S3Client,
  waitUntilObjectExists,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Resolution } from '../../models/resolution';
import { JobStatus } from '../../models/aws-jobstatus';
import { Pipeline } from '../pipeline';
import { AWSPipelineConfiguration } from './aws-pipeline-configuration';
import fs from 'fs';
import path from 'path';
import { Upload } from '@aws-sdk/lib-storage';
import { fromIni } from '@aws-sdk/credential-providers';
import {
  QualityAnalysisModel,
  qualityAnalysisModelToString
} from '../../models/quality-analysis-model';
import logger from '../../logger';
import { runFfprobe } from '../../pairVmaf';
import { delay } from '../../utils';

export function isS3URI(url: string): boolean {
  try {
    const inputUrl = new URL(url);
    return inputUrl.protocol === 's3:';
  } catch {
    return false;
  }
}

export default class AWSPipeline implements Pipeline {
  configuration: AWSPipelineConfiguration;
  private s3: S3Client;
  private mediaConvert: MediaConvertClient;
  private ecs: ECSClient;
  private static readonly MAX_WAIT_TIME_S = 28800; //Max wait time for AWS resources is 28800 seconds (8 hours).
  private static readonly MEDIACONVERT_CHECK_JOB_INTERVAL_MS = 10000; //Check status of mediaconvert job interval in seconds.

  constructor(configuration: AWSPipelineConfiguration) {
    this.configuration = configuration;
    this.s3 = new S3Client({});
    this.mediaConvert = new MediaConvertClient({
      endpoint: configuration.mediaConvertEndpoint
    });
    this.ecs = new ECSClient({});
  }

  async uploadToS3(
    localFilename: string,
    targetBucket: string,
    targetFilename: string
  ) {
    const fileStream = fs.createReadStream(localFilename);
    const upload = new Upload({
      client: this.s3,
      params: { Bucket: targetBucket, Key: targetFilename, Body: fileStream }
    });

    const round = (percent: number) => Math.round(percent * 100) / 100;

    upload.on('httpUploadProgress', (progress) => {
      const percent =
        progress.loaded && progress.total
          ? round((progress.loaded / progress.total) * 100)
          : 0;
      logger.info(`Uploading ${localFilename}: ${percent}%`);
    });

    await upload.done();
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    try {
      await this.s3.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getMediaConvertJobStatus(jobId: string): Promise<string | undefined> {
    try {
      const command = new GetJobCommand({ Id: jobId });
      const response = await this.mediaConvert.send(command);
      if (response.Job?.Status === JobStatus.ERROR) {
        logger.error(`Job ${jobId} error ${response.Job?.ErrorMessage}`);
      } else if (response.Job?.Status === JobStatus.CANCELED) {
        logger.error(`Job ${jobId} ${response.Job?.Status}`);
      }
      return response.Job?.Status;
    } catch (error) {
      logger.error(`Error getting job ${jobId}: ${error}`);
      return undefined;
    }
  }

  async loopGetJobStatusUntilFinished(
    jobId: string
  ): Promise<string | undefined> {
    let status: string | undefined = await this.getMediaConvertJobStatus(jobId);
    while (
      status !== JobStatus.COMPLETE &&
      status !== JobStatus.ERROR &&
      status !== JobStatus.CANCELED &&
      status !== undefined
    ) {
      logger.debug(`Job ${jobId} status: ${status}. Waiting...`);
      status = await this.getMediaConvertJobStatus(jobId);
      await delay(AWSPipeline.MEDIACONVERT_CHECK_JOB_INTERVAL_MS);
    }
    return status;
  }

  async waitForObjectInS3(S3Bucket: string, S3Key: string): Promise<boolean> {
    try {
      await waitUntilObjectExists(
        { client: this.s3, maxWaitTime: AWSPipeline.MAX_WAIT_TIME_S },
        { Bucket: S3Bucket, Key: S3Key }
      );
      return true;
    } catch (error) {
      logger.error(
        `Error waiting for object ${S3Key} in bucket ${S3Bucket}: \n Error: ${error}`
      );
      return false;
    }
  }

  async uploadIfNeeded(
    filename: string,
    bucket: string,
    targetDir: string,
    targetFilename: string = path.basename(filename)
  ): Promise<string> {
    let newFilename: string;

    if (isS3URI(filename)) {
      newFilename = filename;
    } else {
      const key = targetDir + '/' + targetFilename;
      if (!(await this.fileExists(bucket, key))) {
        logger.info('Uploading reference file...');
        await this.uploadToS3(filename, bucket, key);
      }
      newFilename = 's3://' + bucket + '/' + key;
    }

    return newFilename;
  }

  stringReplacement(input: string, search: string, replacement: string) {
    return input.split(search).join(replacement);
  }

  async generatePresignedUrl(
    bucketName: string,
    keyPath: string,
    expiresIn: number
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: keyPath
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn });
    return url;
  }

  transcodedUriToMetadataUri(uri: string): string {
    const outputMetadataUri = uri.replace(path.extname(uri), '_metadata.json');
    return outputMetadataUri;
  }

  async transcode(
    input: string,
    targetResolution: Resolution,
    targetBitrate: number,
    output: string,
    variables?: Record<string, string>
  ): Promise<string> {
    const outputObject = output;
    const outputBucket = this.configuration.outputBucket;
    const outputFolder = 'encoded-files';
    const outputURI = `s3://${outputBucket}/${outputFolder}/${outputObject}`;

    // Upload if necessary
    const inputFilename = await this.uploadIfNeeded(
      input,
      this.configuration.inputBucket,
      path.dirname(outputObject)
    );

    // Parse settings
    let settingsStr = JSON.stringify(this.configuration.mediaConvertSettings);
    settingsStr = this.stringReplacement(
      settingsStr,
      '${INPUT}',
      inputFilename
    );
    settingsStr = this.stringReplacement(
      settingsStr,
      '${OUTPUT}',
      outputURI.replace(path.extname(outputURI), '')
    );
    settingsStr = this.stringReplacement(
      settingsStr,
      '${WIDTH}',
      targetResolution.width.toString()
    );
    settingsStr = this.stringReplacement(
      settingsStr,
      '${HEIGHT}',
      targetResolution.height.toString()
    );
    if (settingsStr.includes('${BITRATE}')) {
      settingsStr = this.stringReplacement(
        settingsStr,
        '${BITRATE}',
        targetBitrate.toString()
      );
    }

    // HEVC specific settings
    settingsStr = this.stringReplacement(
      settingsStr,
      '${HRDBUFFER}',
      (targetBitrate * 2).toString()
    );

    logger.debug(`variables: ${JSON.stringify(variables)}`);
    //Handle pipelineVariables given in the JobDescription
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const replace = '${' + `${key}` + '}';
        logger.debug(`Replacing ${replace} with ${value}`);
        settingsStr = this.stringReplacement(settingsStr, replace, value);
      });
    }

    const settings = JSON.parse(settingsStr);
    logger.debug('Settings Json: ' + JSON.stringify(settings));

    if (
      await this.fileExists(outputBucket, `${outputFolder}/${outputObject}`)
    ) {
      // File has already been transcoded.
      if (
        !(await this.fileExists(
          outputBucket,
          this.transcodedUriToMetadataUri(`${outputFolder}/${outputObject}`)
        ))
      ) {
        await this.probeMetadata(outputBucket, outputFolder, outputObject);
      }
      return outputURI;
    }

    // Transcode
    logger.info('Transcoding ' + inputFilename + ' to ' + outputURI + '...');
    let createJobResponse: CreateJobCommandOutput;
    try {
      const accelerationSettings = this.configuration.accelerationMode
        ? {
            AccelerationSettings: { Mode: this.configuration.accelerationMode }
          }
        : {};
      createJobResponse = await this.mediaConvert.send(
        new CreateJobCommand({
          Role: this.configuration.mediaConvertRole,
          Settings: settings,
          ...accelerationSettings
        })
      );
    } catch (error) {
      logger.error(
        `Error transcoding ${inputFilename} to ${outputURI}: \n Error: ${error}`
      );
      throw error;
    }
    if (!createJobResponse.Job?.Id) {
      logger.error(`No Job from create response ${inputFilename}`);
      return '';
    }
    const mediaConvertJobStatus = await this.loopGetJobStatusUntilFinished(
      createJobResponse.Job.Id
    );
    if (
      mediaConvertJobStatus === JobStatus.ERROR ||
      mediaConvertJobStatus === JobStatus.CANCELED ||
      mediaConvertJobStatus === undefined
    ) {
      return '';
    }
    await this.probeMetadata(outputBucket, outputFolder, outputObject);

    logger.info('Finished transcoding ' + inputFilename + '.');
    return outputURI;
  }

  private async probeMetadata(
    outputBucket: string,
    outputFolder: string,
    outputObject: string
  ) {
    const url = await this.generatePresignedUrl(
      outputBucket,
      `${outputFolder}/${outputObject}`,
      5
    );
    const metadata = await runFfprobe(url);
    const outputMetadataFilename =
      this.transcodedUriToMetadataUri(outputObject);
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: outputBucket,
        Key: `${outputFolder}/${outputMetadataFilename}`,
        Body: JSON.stringify(metadata)
      }
    });
    await upload.done();
  }

  async analyzeQuality(
    reference: string,
    distorted: string,
    output: string,
    model: QualityAnalysisModel
  ): Promise<string> {
    let outputFilename: string;
    if (isS3URI(output)) {
      const outputUrl = new URL(output);
      // Remove initial '/' in pathname
      outputFilename = outputUrl.pathname.substring(1);
    } else {
      outputFilename = output;
    }

    const outputBucket = this.configuration.outputBucket;
    const outputObject = outputFilename;
    const outputURI = `s3://${outputBucket}/results/${outputObject}`;

    if (await this.fileExists(outputBucket, `results/${outputObject}`)) {
      logger.info(`Quality analysis already done for ${outputURI}`);
      await this.copyMetadataFile(outputBucket, distorted, outputObject);
      return outputURI;
    }

    const referenceFilename = await this.uploadIfNeeded(
      reference,
      outputBucket,
      path.dirname(outputObject)
    );
    const distortedFilename = await this.uploadIfNeeded(
      distorted,
      outputBucket,
      path.dirname(outputObject)
    );

    let additionalArgs: string[] = [];
    switch (model) {
      case QualityAnalysisModel.HD:
        additionalArgs = ['--model', 'HD'];
        break;
      case QualityAnalysisModel.PhoneHD:
        additionalArgs = ['--model', 'HD', '--phone'];
        break;
      case QualityAnalysisModel.UHD:
        additionalArgs = ['--model', '4K'];
        break;
    }

    logger.info(
      `Running quality analysis on ${distorted} with ${qualityAnalysisModelToString(model)}-model...`
    );
    try {
      this.ecs.send(
        new RunTaskCommand({
          taskDefinition: this.configuration.ecsTaskDefinition,
          cluster: this.configuration.ecsCluster,
          launchType: 'FARGATE',
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: [this.configuration.ecsSubnet],
              securityGroups: [this.configuration.ecsSecurityGroup],
              assignPublicIp: 'ENABLED'
            }
          },
          tags: [
            { key: 'ReferenceFile', value: cleanupTagValue(referenceFilename) },
            { key: 'Output', value: cleanupTagValue(outputObject) }
          ],
          overrides: {
            containerOverrides: [
              {
                name: this.configuration.ecsContainerName,
                command: [
                  '-r',
                  referenceFilename,
                  '-d',
                  distortedFilename,
                  '-o',
                  outputURI,
                  ...additionalArgs
                ]
              }
            ]
          }
        })
      );
    } catch (error) {
      logger.error(`Error while starting quality analysis`);
      throw error;
    }

    const s3Status = await this.waitForObjectInS3(
      outputBucket,
      `results/${outputObject}`
    );
    if (!s3Status) return '';
    await this.copyMetadataFile(outputBucket, distortedFilename, outputObject);

    logger.info(`Finished analyzing ${distorted}.`);

    return outputURI;
  }

  private async copyMetadataFile(
    outputBucket: string,
    distortedFilename: string,
    outputObject: string
  ) {
    const key = `results/${outputObject}`.replace(
      '_vmaf.json',
      '_metadata.json'
    );
    if (await this.fileExists(outputBucket, key)) {
      logger.debug(`Metadata file already exists: ${key}`);
      return;
    }
    const input = {
      Bucket: outputBucket,
      CopySource: this.transcodedUriToMetadataUri(distortedFilename).replace(
        's3:/',
        ''
      ),
      Key: key
    };
    logger.debug(`Uploading metadata: ${JSON.stringify(input)}`);
    const command = new CopyObjectCommand(input);
    await this.s3.send(command);
  }
}

export function cleanupTagValue(tagValue: string) {
  return tagValue.replace(/[^A-Za-z0-9_./=+:@ -]/g, '_');
}
