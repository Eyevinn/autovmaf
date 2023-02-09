#!/usr/bin/env node

import {promises as fs} from 'fs';
import YAML from 'yaml';
import * as path from 'path';
import createJob, { JobDescription } from './create-job';
import which from 'which';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import logger from './logger';
import suggestLadder from './suggest-ladder';
import { string } from 'yargs';
import { ObjectVersion } from '@aws-sdk/client-s3';

async function run() {

    const argv = await yargs(hideBin(process.argv))
        .scriptName('autovmaf')
        .command(['* [source]'], 'run transcode and vmaf for videofile source', (yargs) => {
            return yargs
                .positional('source', { type: 'string', describe: 'SOURCEFILE'})
                .options({
                    resolutions: { type: 'string', description: 'List of resolutions, ie 1920x1080,1280x720...' },
                    bitrates: { type: 'string', description: 'List of bitrates, ie 800k,1000k,...' },
                    name: { type: 'string', description: 'Name for this autovmaf run', default: 'MyVMAFMeasurements' },
                    models: { type: 'string', description: 'List of VMAF Models to use', default: 'HD' },
                    job: { type: 'string', description: 'File with job definition' },
                    'ffmpeg-options': { type: 'string', description: 'List of options to pass to ffmpeg, on the form key1=value1:key2=value2' }
                })
        }, transcodeAndAnalyse)
        .command('suggest-ladder <folder>', 'Suggest bitrate ladder given vmaf results', (yargs) => {
            return yargs
                .positional('folder', { type: 'string', describe: 'Folder with vmaf measurement results', demandOption: true });
        }, runSuggestLadder)

        .parse();
}

async function runSuggestLadder(argv) {
    const ladder = await suggestLadder(argv.folder);
    console.log(`ladder: ${ladder}`);
    ladder.forEach((rung) => {
        console.log(rung);
    });
}

async function readJobDefintion(file) {
    const text = await fs.readFile(file, {encoding: 'utf-8'})
    const extension = path.extname(file);
    const definition = ['.yml', '.yaml'].includes(extension.toLowerCase()) ?
        YAML.parse(text) : JSON.parse(text);
    definition.name = definition.name || path.basename(file, extension)
    return definition;
}

async function transcodeAndAnalyse(argv) {
    const job: any = argv.job ? await readJobDefintion(argv.job) : {}
    if (argv.source) {
        job.reference = argv.source;
    }
    if (argv.reference) {
        job.reference = argv.reference;
    }
    if (argv.models) {
        job.models = argv.models.split(',')
    }
    if (argv.resolutions) {
        job.resolutions = parseResolutions(argv.resolutions);
    }
    if (argv.bitrates) {
        job.bitrates = parseBitrates(argv.bitrates);
    }
    if (!job.pipeline) {
        job.pipeline = {
            ffmpegEncoder: "libx264"
        }
    }
    if (argv['ffmpeg-options']) {
        job.pipeline.ffmpegOptions = parseFFmpegOptions(argv['ffmpeg-options']);
    }

    //const reference: string = argv.source;
    const { pythonPath, ffmpegPath, easyVmafPath } = await getExecutablePaths();
    job.pipeline.pythonPath = job.pipeline.pythonPath || pythonPath;
    job.pipeline.ffmpegPath = job.pipeline.ffmpegPath || ffmpegPath;
    job.pipeline.easyVmafPath = job.pipeline.easyVmafPath || easyVmafPath;
    job.method = job.method || "bruteForce";

    //console.log('job: ', job);
    
    const vmafScores = await createJob(job as JobDescription);
    //const ffmpegOptions = parseFFmpegOptions(argv['ffmpeg-options']) || {};
/*
    const pipeline = {
        local: {
            ffmpegPath,
            pythonPath,
            easyVmafPath,
            ffmpegEncoder: "libx264"
        }
    };

    const bitrates = parseBitrates(argv.bitrates);
    const resolutions = parseResolutions(argv.resolutions);

    const vmafScores = await createJob({
        name: argv.name,
        pipeline: "",
        reference: reference,
        models: argv.models.split[','],
        resolutions: resolutions,
        bitrates: bitrates,
        method: "bruteForce"
    } as JobDescription, pipeline, ffmpegOptions, false);
    */
}

async function getExecutablePaths() {
    const pythonPath = process.env.PYTHON_PATH || await which("python");
    const ffmpegPath = process.env.FFMPEG_PATH || await which("ffmpeg");
    const easyVmafPath = process.env.EASYVMAF_PATH || await which("easyVmaf");
    if (!pythonPath) {
        throw new Error("python not found in path and environment variable PYTHON_PATH not set");
    }
    if (!ffmpegPath) {
        throw new Error("ffmpeg not found in path and environment variable FFMPEG_PATH not set");
    }
    if (!easyVmafPath) {
        throw new Error("Environment variable EASYVMAF_PATH not set");
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
    return bitrates.split(',')
        .map(bitrateStr => 
            bitrateStr.replace(/[Kk]$/, '000')
                .replace(/[mM]$/, '000000'))
        .map(b => parseInt(b, 10));
}

function parseResolutions(resolutions: string | undefined) {
    if (typeof resolutions == 'undefined') {
        return undefined;
    }
    return resolutions.split(',').map(r => {
        const [width, height] = r.split('x');
        return {
            width: parseInt(width),
            height: parseInt(height)
        }
    })
}

run().then(() => console.log("done"));