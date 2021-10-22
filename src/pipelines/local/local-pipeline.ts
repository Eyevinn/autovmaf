import { Resolution } from '../../models/resolution';
import { Pipeline } from '../pipeline';
import { LocalPipelineConfiguration } from './local-pipeline-configuration';
import ffmpeg from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { QualityAnalysisModel } from '../../models/quality-analysis-model';
import logger from '../../logger';

const ffmpegAsync = async (command: ffmpeg.FfmpegCommand, onProgress: (info: any) => void) => {
  return new Promise<void>((resolve, reject) => {
    command
      .on('progress', onProgress)
      .on('end', () => {
        resolve();
      })
      .on('error', error => {
        reject(error);
      })
      .run();
  });
};

export default class LocalPipeline implements Pipeline {
  private configuration: LocalPipelineConfiguration;

  constructor(configuration: LocalPipelineConfiguration) {
    this.configuration = configuration;
  }

  async transcode(input: string, targetResolution: Resolution, targetBitrate: number, output: string): Promise<string> {
    const directory = path.dirname(output);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const encodingArguments = {
      '-vf': `scale=${targetResolution.width}:${targetResolution.height}`,
      '-c:v': this.configuration.ffmpegEncoder,

      '-b:v': targetBitrate.toString(),
      '-maxrate': targetBitrate.toString(),
      '-bufsize': (targetBitrate * 2).toString(),
    };

    const ffmpegOptions = Object.entries(Object.assign({}, encodingArguments, this.configuration.ffmpegOptions)).flat();

    await ffmpegAsync(
      ffmpeg(input)
        .addOptions(ffmpegOptions)
        .addOptions(['-pass', '1'])
        .addOutput('/dev/null')
        .outputFormat('mp4'),
      info => {
        logger.info(`Transcoding ${output}: Pass 1 progress: ${Math.round(info.percent * 100) / 100}%`);
      }
    );

    await ffmpegAsync(
      ffmpeg(input)
        .addOptions(ffmpegOptions)
        .addOptions(['-pass', '2'])
        .addOutput(output),
      info => {
        logger.info(`Transcoding ${output}: Pass 2 progress: ${Math.round(info.percent * 100) / 100}%`);
      }
    );

    return output;
  }

  async analyzeQuality(
    reference: string,
    distorted: string,
    output: string,
    model: QualityAnalysisModel
  ): Promise<string> {
    const directory = path.dirname(output);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }

    let additionalArgs: string[];
    switch (model) {
      case QualityAnalysisModel.HD:
        additionalArgs = ['-model', 'HD'];
        break;
      case QualityAnalysisModel.PhoneHD:
        additionalArgs = ['-model', 'HD', '-phone'];
        break;
      case QualityAnalysisModel.UHD:
        additionalArgs = ['-model', '4K'];
        break;
    }

    execSync(
      [
        this.configuration.pythonPath,
        this.configuration.easyVmafPath,
        '-r',
        reference,
        '-d',
        distorted,
        '-endsync',
        ...additionalArgs,
      ].join(' ')
    );

    const distortedDetails = path.parse(distorted);
    const vmafFilename = distortedDetails.dir + '/' + distortedDetails.name + '_vmaf.json';
    fs.renameSync(vmafFilename, output);

    return output;
  }
}
