import { Resolution } from '../../models/resolution';
import { Pipeline } from '../pipeline';
import { LocalPipelineConfiguration } from './local-pipeline-configuration';
import ffmpeg from 'fluent-ffmpeg';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { devNull } from 'os';
import { QualityAnalysisModel } from '../../models/quality-analysis-model';
import logger from '../../logger';

const ffmpegAsync = async (
  command: ffmpeg.FfmpegCommand,
  onProgress: (info: { percent: number }) => void
) => {
  return new Promise<void>((resolve, reject) => {
    command
      .on('start', (cmdLine) => console.log(`Starting ffmpeg: ${cmdLine}`))
      .on('progress', onProgress)
      .on('end', () => {
        resolve();
      })
      .on('error', (error) => {
        reject(error);
      })
      .run();
  });
};

const timeFormat = `{
  "cmd": "%C",
  "realTime": "%E",
  "cpuUserMode": %U,
  "cpuKernelMode": %S
}`;

export default class LocalPipeline implements Pipeline {
  private configuration: LocalPipelineConfiguration;

  constructor(configuration: LocalPipelineConfiguration) {
    this.configuration = configuration;
  }

  async transcode(
    input: string,
    targetResolution: Resolution,
    targetBitrate: number,
    output: string,
    variables?: Record<string, string>
  ): Promise<string> {
    console.log(input);
    const directory = path.dirname(output);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const baseEncodingArguments = {
      '-vf': `scale=${targetResolution.width}:${targetResolution.height}`,
      '-c:v': this.configuration.ffmpegEncoder
    };

    if (!this.configuration.skipDefaultOptions) {
      baseEncodingArguments['-b:v'] = targetBitrate.toString();
      baseEncodingArguments['-maxrate'] = targetBitrate.toString();
      baseEncodingArguments['-bufsize'] = (targetBitrate * 2).toString();
    }

    const ffmpegOptionsWithVariableSubstituted = {
      ...this.configuration.ffmpegOptions
    };
    if (variables) {
      Object.entries(this.configuration.ffmpegOptions).forEach(
        ([key, value]) => {
          //let value = this.configuration.ffmpegOptions[key];
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          Object.entries(variables!).forEach(([k, v]) => {
            value = value.replace('${' + `${k}` + '}', v);
          });
          ffmpegOptionsWithVariableSubstituted[key] = value;
        }
      );
    }

    const ffmpegOptions = Object.entries(
      Object.assign(
        {},
        baseEncodingArguments,
        ffmpegOptionsWithVariableSubstituted
      )
    ).flat();

    logger.info(`ffmpegOptions: ${JSON.stringify(ffmpegOptions)}`);
    await ffmpegAsync(
      ffmpeg({
        source: input,
        measureCpu: {
          output: `${output}.pass1-cpu-time.txt`,
          format: timeFormat
        }
      })
        .addOptions(ffmpegOptions)
        .addOptions(this.configuration.singlePass ? [] : ['-pass', '1'])
        .addOutput(
          this.configuration.singlePass === undefined ? devNull : output
        )
        .outputFormat('mp4'),
      (info) => {
        logger.info(
          `Transcoding ${output}: Pass 1 progress: ${Math.round(info.percent * 100) / 100}%`
        );
      }
    );

    if (!this.configuration.singlePass) {
      await ffmpegAsync(
        ffmpeg({
          source: input,
          measureCpu: {
            output: `${output}.pass2-cpu-time.txt`,
            format: timeFormat
          }
        })
          .addOptions(ffmpegOptions)
          .addOptions(['-pass', '2'])
          .addOutput(output),
        (info) => {
          logger.info(
            `Transcoding ${output}: Pass 2 progress: ${Math.round(info.percent * 100) / 100}%`
          );
        }
      );
    }
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

    additionalArgs.push(
      ...Object.entries(this.configuration.easyVmafExtraArgs || {}).flat()
    );

    logger.info('Running quality analysis on ' + distorted);
    execSync(
      [
        this.configuration.pythonPath,
        this.configuration.easyVmafPath,
        '-r',
        reference,
        '-d',
        distorted,
        '-endsync',
        ...additionalArgs
      ].join(' ')
    );

    logger.info('Finished analyzing ' + distorted);

    const distortedDetails = path.parse(distorted);
    const vmafFilename =
      distortedDetails.dir + '/' + distortedDetails.name + '_vmaf.json';
    fs.renameSync(vmafFilename, output);

    return output;
  }
}
