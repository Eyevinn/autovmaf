import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { CreateJobCommand, MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { HeadObjectCommand, S3Client, waitUntilObjectExists } from '@aws-sdk/client-s3';
import { Resolution } from '../../models/resolution';
import { Pipeline } from '../pipeline';
import { AWSPipelineConfiguration } from './aws-pipeline-configuration';
import fs from 'fs';
import path from 'path';
import { Upload } from '@aws-sdk/lib-storage';
import { fromIni } from '@aws-sdk/credential-providers';
import { QualityAnalysisModel, qualityAnalysisModelToString } from '../../models/quality-analysis-model';
import logger from '../../logger';

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

  constructor(configuration: AWSPipelineConfiguration) {
    this.configuration = configuration;
    this.s3 = new S3Client({});
    this.mediaConvert = new MediaConvertClient({ endpoint: configuration.mediaConvertEndpoint });
    this.ecs = new ECSClient({});
  }

  async uploadToS3(localFilename: string, targetBucket: string, targetFilename: string) {
    const fileStream = fs.createReadStream(localFilename);
    const upload = new Upload({
      client: this.s3,
      params: { Bucket: targetBucket, Key: targetFilename, Body: fileStream },
    });

    const round = (percent: number) => Math.round(percent * 100) / 100;

    upload.on('httpUploadProgress', progress => {
      const percent = progress.loaded && progress.total ? round((progress.loaded / progress.total) * 100) : 0;
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
        await this.uploadToS3(filename, bucket, key);
      }
      newFilename = 's3://' + bucket + '/' + key;
    }

    return newFilename;
  }

  async transcode(input: string, targetResolution: Resolution, targetBitrate: number, output: string): Promise<string> {
    const outputBucket = this.configuration.s3Bucket;
    const outputObject = output;
    const outputURI = 's3://' + outputBucket + '/' + output;

    // Upload if necessary
    const inputFilename = await this.uploadIfNeeded(input, this.configuration.s3Bucket, path.dirname(outputObject));

    // Parse settings
    let settingsStr = JSON.stringify(this.configuration.mediaConvertSettings);

    settingsStr = settingsStr.replaceAll('$INPUT', inputFilename);
    settingsStr = settingsStr.replaceAll('$OUTPUT', outputURI.replace(path.extname(outputURI), ''));
    settingsStr = settingsStr.replaceAll('"$WIDTH"', targetResolution.width.toString());
    settingsStr = settingsStr.replaceAll('"$HEIGHT"', targetResolution.height.toString());
    settingsStr = settingsStr.replaceAll('"$BITRATE"', targetBitrate.toString());

    const settings = JSON.parse(settingsStr);

    if (await this.fileExists(outputBucket, output)) {
      // File has already been transcoded.
      return outputURI;
    }

    // Transcode
    logger.info('Transcoding ' + inputFilename + ' to ' + outputURI + '...');
    await this.mediaConvert.send(
      new CreateJobCommand({
        Role: this.configuration.mediaConvertRole,
        Settings: settings,
      })
    );

    // Wait until finished
    await waitUntilObjectExists({ client: this.s3, maxWaitTime: 3600 }, { Bucket: outputBucket, Key: outputObject });

    logger.info('Finished transcoding ' + inputFilename + '.');

    return outputURI;
  }

  async analyzeQuality(
    reference: string,
    distorted: string,
    output: string,
    model: QualityAnalysisModel
  ): Promise<string> {
    logger.info(`Running quality analysis on ${distorted} with ${qualityAnalysisModelToString(model)}-model...`);

    let outputFilename;
    if (isS3URI(output)) {
      const outputUrl = new URL(output);
      // Remove initial '/' in pathname
      outputFilename = outputUrl.pathname.substring(1);
    } else {
      outputFilename = output;
    }

    const outputBucket = this.configuration.s3Bucket;
    const outputObject = outputFilename;
    const outputURI = 's3://' + outputBucket + '/' + outputObject;

    const referenceFilename = await this.uploadIfNeeded(reference, outputBucket, path.dirname(outputObject));
    const distortedFilename = await this.uploadIfNeeded(distorted, outputBucket, path.dirname(outputObject));

    const credentialProvider = fromIni();
    const credentials = await credentialProvider();

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

    this.ecs.send(
      new RunTaskCommand({
        taskDefinition: this.configuration.ecsTaskDefinition,
        cluster: this.configuration.ecsCluster,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: [this.configuration.ecsSubnet],
            securityGroups: [this.configuration.ecsSecurityGroup],
            assignPublicIp: 'ENABLED',
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: this.configuration.ecsContainerName,
              command: ['-r', referenceFilename, '-d', distortedFilename, '-o', outputURI, ...additionalArgs],
              environment: [
                {
                  name: 'AWS_ACCESS_KEY_ID',
                  value: credentials.accessKeyId,
                },
                {
                  name: 'AWS_SECRET_ACCESS_KEY',
                  value: credentials.secretAccessKey,
                },
              ],
            },
          ],
        },
      })
    );

    await waitUntilObjectExists({ client: this.s3, maxWaitTime: 3600 }, { Bucket: outputBucket, Key: outputObject });

    logger.info(`Finished analyzing ${distorted}.`);

    return outputURI;
  }
}
