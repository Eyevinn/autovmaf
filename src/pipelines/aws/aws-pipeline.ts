import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import {
  CreateJobCommand,
  MediaConvertClient
} from '@aws-sdk/client-mediaconvert';
import {
  HeadObjectCommand,
  GetObjectCommand,
  S3Client,
  waitUntilObjectExists
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Resolution } from '../../models/resolution';
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
  private static readonly MAX_WAIT_TIME = 28800; //Max wait time for AWS resources is 28800 seconds (8 hours).

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

  async waitForObjectInS3(S3Bucket: string, S3Key: string): Promise<boolean> {
    try {
      await waitUntilObjectExists(
        { client: this.s3, maxWaitTime: AWSPipeline.MAX_WAIT_TIME },
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
    key: string,
    expiresIn: number
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn });
    return url;
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

    //Handle pipelineVariables given in the JobDescription
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        settingsStr = this.stringReplacement(
          settingsStr,
          '${' + `${key}` + '}',
          value
        );
      });
    }

    const settings = JSON.parse(settingsStr);
    logger.debug('Settings Json: ' + JSON.stringify(settings));

    if (
      await this.fileExists(outputBucket, `${outputFolder}/${outputObject}`)
    ) {
      // File has already been transcoded.
      return outputURI;
    }

    // Transcode
    logger.info('Transcoding ' + inputFilename + ' to ' + outputURI + '...');
    try {
      await this.mediaConvert.send(
        new CreateJobCommand({
          Role: this.configuration.mediaConvertRole,
          Settings: settings
        })
      );
    } catch (error) {
      logger.error(
        `Error transcoding ${inputFilename} to ${outputURI}: \n Error: ${error}`
      );
      throw error;
    }

    const s3Status = await this.waitForObjectInS3(
      outputBucket,
      `${outputFolder}/${outputObject}`
    );
    if (!s3Status) return '';
    if (variables ? variables['QVBR'] : undefined) {
      const url = this.generatePresignedUrl(outputBucket, outputObject, 5);
      const metadata = await runFfprobe(url);
      const outputMetadataFilename = outputObject.replace(
        '.mp4',
        '_metadata.json'
      );
      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: outputBucket,
          Key: outputMetadataFilename,
          Body: JSON.stringify(metadata)
        }
      });
      await upload.done();
    }

    logger.info('Finished transcoding ' + inputFilename + '.');
    return outputURI;
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

    let credentials: any = {};
    if (process.env.LOAD_CREDENTIALS_FROM_ENV) {
      logger.debug('Loading credentials from environment variables');
      credentials['accessKeyId'] = process.env.AWS_ACCESS_KEY_ID;
      credentials['secretAccessKey'] = process.env.AWS_SECRET_ACCESS_KEY;
    } else {
      logger.debug('Loading credentials from ~/.aws/credentials');
      const credentialProvider = fromIni();
      credentials = await credentialProvider();
    }

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
            { key: 'ReferenceFile', value: referenceFilename },
            { key: 'Output', value: outputObject }
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
                ],
                environment: [
                  {
                    name: 'AWS_ACCESS_KEY_ID',
                    value: credentials.accessKeyId
                  },
                  {
                    name: 'AWS_SECRET_ACCESS_KEY',
                    value: credentials.secretAccessKey
                  }
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

    logger.info(`Finished analyzing ${distorted}.`);

    return outputURI;
  }
}
