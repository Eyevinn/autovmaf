#!/usr/bin/env node

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
        .command(['* <source>'], 'run transcode and vmaf for videofile source', (yargs) => {
            return yargs
                .positional('source', { type: 'string', describe: 'SOURCEFILE', demandOption: true })
                .options({
                    resolutions: { type: 'string', description: 'List of resolutions, ie 1920x1080,1280x720...' },
                    bitrates: { type: 'string', description: 'List of bitrates, ie 800k,1000k,...' },
                    name: { type: 'string', description: 'Name for this autovmaf run', default: 'MyVMAFMeasurements' },
                    models: { type: 'string', description: 'List of VMAF Models to use', default: 'HD' },
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

async function transcodeAndAnalyse(argv) {
    const reference: string = argv.source;
    const { pythonPath, ffmpegPath, easyVmafPath } = await getExecutablePaths();
    const ffmpegOptions = parseFFmpegOptions(argv['ffmpeg-options']) || {};

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
}

async function getExecutablePaths() {
    const pythonPath = process.env.PYTHON_PATH || await which("python");
    const ffmpegPath = process.env.FFMPEG_PATH || await which("ffmpeg");
    const easyVmafPath = process.env.EASYVMAF_PATH;
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