#!/usr/bin/env node

import { promises as fs } from 'fs';
import YAML from 'yaml';
import * as path from 'path';
import createJob, { JobDescription } from './create-job';
import which from 'which';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import logger from './logger';
import suggestLadder from './suggest-ladder';
import ObjectsToCsv from 'objects-to-csv';
import { pairVmafWithResolutionAndBitrate } from './pairVmaf';
import { VmafBitratePair } from './models/vmaf-bitrate-pair';
import { loadPipeline } from './load-pipeline';
import {
  QualityAnalysisModel,
  stringToQualityAnalysisModel
} from './models/quality-analysis-model';

class ValidationError extends Error {
  constructor(message) {
    super(message);
  }
}

async function run() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('autovmaf')
    .fail(function (msg, err, yargs) {
      console.error(yargs.help());
      console.error();
      if (err instanceof ValidationError) {
        console.error(err.message);
      } else if (err) {
        throw err;
      } else {
        console.error(msg);
      }
      process.exit(1);
    })
    .command(
      ['* [source]'],
      'run transcode and vmaf analysis for videofile source',
      (yargs) => {
        return yargs
          .positional('source', { type: 'string', describe: 'SOURCEFILE' })
          .options({
            resolutions: {
              type: 'string',
              description: 'List of resolutions, ie 1920x1080,1280x720...'
            },
            bitrates: {
              type: 'string',
              description: 'List of bitrates, ie 800k,1000k,...'
            },
            name: { type: 'string', description: 'Name for this autovmaf run' },
            models: {
              type: 'string',
              description: 'List of VMAF Models to use'
            },
            job: { type: 'string', description: 'File with job definition' },
            saveAsCsv: {
              type: 'boolean',
              description:
                'Save VMAF measurements as a .csv file in addition to a JSON file',
              default: false
            },
            skipTranscode: {
              type: 'boolean',
              description:
                'Skip transcode and run vmaf on already transcoded files',
              default: false
            },
            skipExisting: {
              type: 'boolean',
              description: 'Skip transcode for already transcoded files',
              default: true
            },
            probeBitrate: {
              type: 'boolean',
              description: 'Read bitrate of transcoded file with ffprobe',
              default: false
            },
            parallel: {
              type: 'boolean',
              description:
                'Run multiple encodes / vmaf measurements in parallel',
              default: false
            },
            skipVmaf: {
              type: 'boolean',
              description: 'Skip VMAF measurement',
              default: false
            },
            'ffmpeg-options': {
              type: 'string',
              description:
                'List of options to pass to ffmpeg, on the form key1=value1:key2=value2'
            }
          });
      },
      transcodeAndAnalyse
    )
    .command(
      'suggest-ladder <folder>',
      'Suggest bitrate ladder given vmaf results',
      (yargs) => {
        return yargs.positional('folder', {
          type: 'string',
          describe: 'Folder with vmaf measurement results',
          demandOption: true
        });
      },
      runSuggestLadder
    )
    .command(
      'export-csv <folder>',
      'Export Vmaf results as csv',
      (yargs) => {
        return yargs
          .positional('folder', {
            type: 'string',
            describe: 'Folder with vmaf measurement results',
            demandOption: true
          })
          .options({
            probeBitrate: {
              type: 'boolean',
              description: 'Read bitrate of transcoded file with ffprobe',
              default: false
            },
            variables: {
              type: 'string',
              description: 'List of variables to include as columns in csv'
            }
          });
      },
      exportWmafResultToCsv
    )
    .command(
      'vmaf',
      'Use pipeline to run VMAF for the given distorted and reference files',
      (yargs) => {
        return yargs.options({
          pipeline: {
            type: 'string',
            description: 'Path to pipeline file',
            required: true
          },
          reference: {
            type: 'string',
            description: 'Uri or path to reference file',
            required: true
          },
          distorted: {
            type: 'string',
            description: 'Uri or path to distorted file',
            required: true
          },
          model: {
            type: 'string',
            description: 'VMAF model to use',
            default: 'HD'
          }
        });
      },
      runVmaf
    )
    .help()
    .parse();
}

async function runVmaf(argv) {
  const reference = argv.reference;
  const distorted = argv.distorted;
  const pipeline = await loadPipeline(argv.pipeline);
  const qualityFile = argv.distorted.replace(
    path.extname(argv.distorted),
    '_vmaf.json'
  );
  const model: QualityAnalysisModel = stringToQualityAnalysisModel(argv.model);
  const jobDescription = `${model},${reference},${distorted},${qualityFile}`;
  pipeline
    .analyzeQuality(reference, distorted, qualityFile, model)
    .then(() => {
      logger.info(`Finished VMAF measurement for ${jobDescription}`);
    })
    .catch((err) => {
      logger.error(`Error running VMAF for ${jobDescription}: ${err}`);
    });
  logger.info(`Started VMAF measurement for ${jobDescription}`);
}

async function runSuggestLadder(argv) {
  const { ladder, pairs } = await suggestLadder(argv.folder);
  logger.info(`ladder: ${ladder}`);
  ladder.forEach((rung) => {
    logger.info(rung);
  });
}

/*
async function ladderStats(argv) {
  logger.info('ladder stats', argv);
}
*/
async function findFoldersWithoutSubdirectories(
  folderPath: string
): Promise<string[]> {
  let foldersWithoutSubdirs: string[] = [];

  try {
    const files = await fs.readdir(folderPath);
    let hasSubdirectories = false;

    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        hasSubdirectories = true;
        // Recursively call the function
        const subFoldersWithoutSubdirs =
          await findFoldersWithoutSubdirectories(fullPath);
        foldersWithoutSubdirs = foldersWithoutSubdirs.concat(
          subFoldersWithoutSubdirs
        );
      }
    }

    if (!hasSubdirectories) {
      foldersWithoutSubdirs.push(folderPath);
    }
  } catch (err) {
    console.error(`Error reading directory ${folderPath}: ${err}`);
  }

  return foldersWithoutSubdirs;
}

async function exportWmafResultToCsv(argv) {
  const foldersWithoutSubdirectories = await findFoldersWithoutSubdirectories(
    argv.folder
  );
  for (const folder of foldersWithoutSubdirectories) {
    const pairs = (
      await pairVmafWithResolutionAndBitrate(
        folder,
        () => true,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},
        argv.probeBitrate
      )
    ).flatMap((resolutionVmaf: VmafBitratePair) => {
      const obj = {
        folder,
        filename: resolutionVmaf.vmafFile,
        resolution: `${resolutionVmaf.resolution.width}X${resolutionVmaf.resolution.height}`,
        vmaf: resolutionVmaf.vmaf,
        vmafHd: resolutionVmaf.vmafHd,
        vmafHdPhone: resolutionVmaf.vmafHdPhone,
        targetBitrate: resolutionVmaf.targetBitrate,
        actualBitrate: resolutionVmaf.actualBitrate,
        realTime: resolutionVmaf.cpuTime?.realTime,
        cpuTime: resolutionVmaf.cpuTime?.cpuTime,
        variables: Object.keys(resolutionVmaf.variables)
          .map((k) => `${k}=${resolutionVmaf.variables[k]}`)
          .join(':')
      };
      if (argv.variables) {
        for (const v of argv.variables.split(',')) {
          obj[v.toLowerCase()] = resolutionVmaf.variables[v] || '';
        }
      }
      return obj;
    });

    console.log(pairs);

    await new ObjectsToCsv(pairs).toDisk(`${argv.folder}/results.csv`, {
      allColumns: true,
      append: true
    });
  }
}

async function transcodeAndAnalyse(argv) {
  const job: any = await updateJobDefinition(argv);
  const models: string[] = job.models;
  logger.info('Running job: ', job);

  const vmafScores = await createJob(
    job as JobDescription,
    undefined,
    undefined,
    argv.parallel
  );

  logger.info(
    `saveAsCsv: ${job.saveAsCsv}, ` +
      (job.saveAsCsv
        ? `also saving results as a .csv file.`
        : `will not save results as a .csv file.`)
  );
  if (job.saveAsCsv) {
    models.forEach((model) =>
      exportWmafResultToCsv({
        folder: `${job.name}/${model}`,
        probeBitrate: argv.probeBitrate
      })
    );
  }
}

async function updateJobDefinition(argv) {
  const job: any = argv.job ? await readJobDefinition(argv.job) : {};
  job.skipTranscode = argv.skipTranscode;
  job.skipExisting = argv.skipExisting;
  job.skipVmaf = argv.skipVmaf;
  if (argv.source) {
    job.reference = argv.source;
  }
  if (argv.reference) {
    job.reference = argv.reference;
  }
  if (argv.models) {
    job.models = argv.models.split(',');
  }
  if (argv.resolutions) {
    job.resolutions = parseResolutions(argv.resolutions);
  }
  if (argv.bitrates) {
    job.bitrates = parseBitrates(argv.bitrates);
  }
  if (argv.name) {
    job.name = argv.name;
  }
  if (argv.saveAsCsv) {
    job.saveAsCsv = argv.saveAsCsv;
  }
  if (!job.pipeline) {
    job.pipeline = {
      ffmpegEncoder: 'libx264'
    };
  }
  if (argv['ffmpeg-options']) {
    job.pipeline.ffmpegOptions = {
      ...(job.pipeline.ffmpegOptions || {}),
      ...parseFFmpegOptions(argv['ffmpeg-options'])
    };
  }
  job.name = job.name || 'MyVmafMeasurements';
  job.models = job.models || ['HD'];
  if (!job.reference) {
    throw new ValidationError('No input file selected');
  }

  // TODO: Make conditional
  /*
  const { pythonPath, ffmpegPath, easyVmafPath } = await getExecutablePaths();
  job.pipeline.pythonPath = job.pipeline.pythonPath || pythonPath;
  job.pipeline.ffmpegPath = job.pipeline.ffmpegPath || ffmpegPath;
  job.pipeline.easyVmafPath = job.pipeline.easyVmafPath || easyVmafPath;
  logger.info('Python path: ', pythonPath);
  logger.info('FFmpeg path: ', ffmpegPath);
  logger.info('EasyVmaf path: ', easyVmafPath);

   */
  job.method = job.method || 'bruteForce';

  return job;
}

async function readJobDefinition(file) {
  const text = await fs.readFile(file, { encoding: 'utf-8' });
  const extension = path.extname(file);
  const definition = ['.yml', '.yaml'].includes(extension.toLowerCase())
    ? YAML.parse(text)
    : JSON.parse(text);
  definition.name = definition.name || path.basename(file, extension);
  const baseName = definition.name;
  let i = 1;
  while (await pathExists(definition.name)) {
    logger.info(definition.name);
    definition.name = `${baseName}-${i}`;
    i++;
  }
  return definition;
}

async function pathExists(path: string) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function getExecutablePaths() {
  const pythonPath = process.env.PYTHON_PATH || (await which('python'));
  const ffmpegPath = process.env.FFMPEG_PATH || (await which('ffmpeg'));
  const easyVmafPath = process.env.EASYVMAF_PATH;
  if (!pythonPath) {
    throw new Error(
      'python not found in path and environment variable PYTHON_PATH not set'
    );
  }
  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg not found in path and environment variable FFMPEG_PATH not set'
    );
  }
  if (!easyVmafPath) {
    throw new Error('Environment variable EASYVMAF_PATH not set');
  }
  return { pythonPath, ffmpegPath, easyVmafPath };
}

function parseFFmpegOptions(ffmpegOptions: string | undefined) {
  if (typeof ffmpegOptions == 'undefined') {
    return undefined;
  }
  return Object.fromEntries(
    ffmpegOptions.split(':').map((v) => {
      const [key, value] = v.split('=');
      return ['-' + key, value];
    })
  );
}

function parseBitrates(bitrates: string | undefined) {
  if (typeof bitrates == 'undefined') {
    return undefined;
  }
  return bitrates
    .split(',')
    .map((bitrateStr) =>
      bitrateStr.replace(/[Kk]$/, '000').replace(/[mM]$/, '000000')
    )
    .map((b) => parseInt(b, 10));
}

function parseResolutions(resolutions: string | undefined) {
  if (typeof resolutions == 'undefined') {
    return undefined;
  }
  return resolutions.split(',').map((r) => {
    const [width, height] = r.split('x');
    return {
      width: parseInt(width),
      height: parseInt(height)
    };
  });
}

run().then(() => logger.info('done'));
