<div align="center">

# [<img src="https://raw.githubusercontent.com/Eyevinn/autovmaf/main/AutoVMAF.svg" alt="autovmaf" height="100">](https://github.com/eyevinn/autovmaf)

autovmaf - A toolkit to automatically encode multiple bitrates and perform automated VMAF measurements on all of them.

📖 **[Read the documentation](https://eyevinn.github.io/autovmaf/)** 👀

[Report a Bug](https://github.com/eyevinn/autovmaf/issues/new?assignees=&labels=bug&template=01_BUG_REPORT.md&title=bug%3A+)
·
[Request a Feature](https://github.com/eyevinn/autovmaf/issues/new?assignees=&labels=enhancement&template=02_FEATURE_REQUEST.md&title=feat%3A+)

[![license](https://img.shields.io/npm/v/@eyevinn/autovmaf?style=flat-square)](https://www.npmjs.com/package/@eyevinn/autovmaf)
[![license](https://img.shields.io/github/v/release/Eyevinn/autovmaf?style=flat-square)](https://github.com/Eyevinn/autovmaf/releases)
[![license](https://img.shields.io/github/license/eyevinn/autovmaf.svg?style=flat-square)](LICENSE)

[![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg?style=flat-square)](https://github.com/eyevinn/autovmaf/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
[![made with hearth by Eyevinn](https://img.shields.io/badge/made%20with%20%E2%99%A5%20by-Eyevinn-59cbe8.svg?style=flat-square)](https://github.com/eyevinn)

</div>

By optimizing ABR-ladders for specific content, you will make sure to not have wasteful rungs and this has been shown to [cut bandwidth usage in half](https://dev.to/video/automating-video-analysis-to-cut-your-streaming-bandwidth-usage-in-half-5hk1).

## Usage

Transcoding and VMAF analysis can either be run in AWS or locally. When running in aws, you will need a running ECS cluster with a task definition configured to run [easyvmaf-s3](https://github.com/Eyevinn/easyvmaf_s3).

### Installation

```bash
npm install --save @eyevinn/autovmaf
```

### Environment Variables

A few environment variables can be set. These are:

```bash
LOAD_CREDENTIALS_FROM_ENV=true   //Load AWS credentials from environment variables
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=ABCD...
AWS_SECRET_ACCESS_KEY=EFGH...
```

### Generate VMAF measurements

To generate VMAF measurements, you will need to define a job which can be created with the `createJob()`-function.

```typescript
const { createJob } = require('@eyevinn/autovmaf');

const vmafScores = await createJob({
  name: 'MyVMAFmeasurements',
  pipeline: 'pipeline.yml',
  encodingProfile: 'profile.json',
  reference: 'reference.mp4',
  models: ['HD', 'PhoneHD'], // optional
  resolutions: [
    {
      // optional
      width: 1280,
      height: 720,
      range: {
        // optional
        min: 500000,
        max: 600000
      }
    }
  ],
  bitrates: [
    // optional
    500000, 600000, 800000
  ],
  method: 'bruteForce' // optional
});
```

When creating a job, you can specify:

- **Name**
  - This will name the folder in which to put the files.
- **Pipeline**
  - Path to a YAML-file that defines the pipeline. See [`examples/pipeline.yml`](https://github.com/Eyevinn/autovmaf/blob/main/examples/aws/pipeline.yml) for an example AWS-pipeline.
  - When running locally, pipeline data can be inlined in the job definition.
- **Encoding Profile**
  - Path to a JSON-file that defines how the reference should be encoded. When using AWS, this is a MediaConvert configuration. See an example for AWS at [`examples/aws/encoding-profile.json`](https://github.com/Eyevinn/autovmaf/blob/main/examples/encoding-profile.json).
    For local pipelines, this is key-value pairs that will be passed as command line arguments to FFmpeg. If pipeline
    data is inlined in the job definition, encodingProfile can be omitted and key-value pairs can instead be set
    in the `ffmpegOptions` property of the pipeline object.
- **Reference**
  - Path to the reference video to analyze. Normally a local path, but when using AWS, this can also be an S3-URI.
- **Models** (optional)
  - A list of VMAF-models to use in evaluation. This can be HD, MobileHD and UHD. HD by default.
- **Resolutions** (optional)
  - A list of resolutions to test. By default it will test all resolutions in the example ABR-ladder provided by Apple in the [HLS Authoring Spec](https://developer.apple.com/documentation/http_live_streaming/hls_authoring_specification_for_apple_devices).
  - **Range** (optional)
    - A min and max bitrate for testing a specific resolution. Adding a range will filter out bitrates that are outside of the given range. It is disabled by default.
- **Bitrates** (optional)
  - A list of bitrates to test. By default a list of bitrates between 150 kbit/s to 9000 kbit/s.
- **Method** (optional)
  - The method to use when analyzing the videos. Either `bruteForce` or `walkTheHull`. By default `bruteForce`. NOTE: `walkTheHull` is not implemented at the moment.

### Create job using yaml

```typescript
const { createJob } = require('@eyevinn/autovmaf');
const YAML = require('yaml');
const fs = require('fs');
const parseResolutions = (resolutions) => {
  resolutions.map((resolutionStr) => ({
    width: parseInt(resolutionStr.split('x')[0]),
    height: parseInt(resolutionStr.split('x')[1])
  }));
};
const jobFile = fs.readFileSync('job.yml', 'utf-8');
const jobData = YAML.parse(jobFile);
const job = {
  ...jobData,
  resolutions:
    jobData['resolutions'] !== undefined
      ? parseResolutions(jobData['resolutions'])
      : undefined
};
createJob(job);
```

**An example of creating a job from a YAML-file can be seen in the [`examples-folder`](https://github.com/Eyevinn/autovmaf/tree/main/examples/).**

### Read VMAF-scores

Using `getVmaf()`, you can read VMAF-scores from a JSON-file or a directory of JSON-files. This works on both local paths as well as S3-URIs with a "s3://"-prefix.

Example:

```javascript
const vmafFiles = await getVmaf('s3://path/to/vmaf/');

vmafFiles.forEach((file) => {
  console.log(file.filename + ': ' + file.vmaf);
});
```

## CLI Usage

When running with the cli, all transcoding and vmaf analysis will be run locally.

### Requirements

- [easyVmaf](https://github.com/gdavila/easyVmaf)
- [FFmpeg](https://www.ffmpeg.org/) >= 5.0, compiled with libvmaf
- [Python](https://www.python.org) >= 3.0

### Global installation

Installing globally with `npm -g` will make the `autovmaf` command available in your path

```bash
npm install -g @eyevinn/autovmaf
```

### Environments variables

- `EASYVMAF_PATH` - needs to point to the file `easyVmaf.py` from your
  easyVmaf installation.
- `FFMPEG_PATH` - only needs to be set if ffmpeg is not in your path.
- `PYTHON_PATH` - only needs to be set if python is not in yur path.

### Command line options

Available command line options for the cli can be listed with the `--help` argument

```bash
autovmaf [source]

run transcode and vmaf analysis for videofile source

Commands:
  autovmaf [source]                 run transcode and vmaf analysis for
                                    videofile source                   [default]
  autovmaf suggest-ladder <folder>  Suggest bitrate ladder given vmaf results
  autovmaf export-csv <folder>      Export Vmaf results as csv

Positionals:
  source  SOURCEFILE                                                    [string]

Options:
  --version         Show version number                                [boolean]
  --help            Show help                                          [boolean]
  --resolutions     List of resolutions, ie 1920x1080,1280x720...       [string]
  --bitrates        List of bitrates, ie 800k,1000k,...                 [string]
  --name            Name for this autovmaf run                          [string]
  --models          List of VMAF Models to use                          [string]
  --job             File with job definition                            [string]
  --saveAsCsv       Save VMAF measurements as a .csv file in addition to a JSON
                    file                              [boolean] [default: false]
  --skipTranscode   Skip transcode and run vmaf on allready transcoded files
                                                      [boolean] [default: false]
  --skipExisting    Skip transcode for allready transcoded files
                                                       [boolean] [default: true]
  --probeBitrate    Read bitrate of transcoded file with ffprobe
                                                      [boolean] [default: false]
  --ffmpeg-options  List of options to pass to ffmpeg, on the form
                    key1=value1:key2=value2                             [string]
```

Output files will be stored in a folder corresponding to the argument given to the `--name` option.
If resolutions and/or bitrates are not specified default values will be used, [See above](#generate-vmaf-measurements).

### Providing job definition in a json or yaml file

With the `--job` option, a path to a yaml or json file with a job definition can be passed to to the cli. The values
defined in the file can be overriden with other commandline options. For instance the `reference` video defined
in the job file can be overridden by passing a source file on the command line.

#### Using variables in the job definition

It is possible to iterate over other variables than bitrate and resolutions when running a local encode. For
instance, to run transcode and vmaf analysis with x265 in CRF mode for a number of CRF values, a job definition
like below can be used (also available in [examples/local/local-job-crf.yaml](examples/local/local-job-crf.yaml))

```yaml
models:
  - HD
resolutions:
  - width: 1920
    height: 1080
bitrates:
  - 0
pipeline:
  ffmpegEncoder: libx265
  singlePass: true
  skipDefaultOptions: true
  ffmpegOptions:
    '-pix_fmt': 'yuv420p'
    '-preset': 'veryslow'
    '-x265-params': 'crf=%CRF%:scenecut=0:keyint=50:min-keyint=50:open-gop=0'
  easyVmafExtraArgs:
    '-threads': 20
pipelineVariables:
  CRF:
    - 22
    - 26
    - 30
    - 34
```

This will run transcode and vmaf analysis for CRF values 22,26,30, and 34. Variables are used in the ffmpeg options
by insterting `%VARIABLENAME%`. This string will then be subtituted with a value from the list of values from
`pipelineVariables.VARIABLENAME`. Note that when running CRF encode or other non-ABR mode, `skipDefaultOptions` must
be set to avoid injecting bitrate options to ffmpeg. Also note that the cli needs to be run with the `--probe-bitrate`
option to get the correct bitrate from the transcoded files.

### Generate VMAF measurements example

```bash
autovmaf --resolutions 1920x1080,1280x720,960x540 --bitrates 500k,800k,1200k,1600k,2000k,3000k,4000k --name my-autovmaf-test1 my-source-video.mp4
```

With the above command, when the run is finished transcoded files will be available in the folder `my-autovmaf-test1`, and vmaf-data in the folder `my-autovmaf-test1/HD`.

## Development

### Run tests

```bash
npm test
```

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at <work@eyevinn.se>!
