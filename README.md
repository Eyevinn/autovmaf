# Eyevinn AutoVMAF

Toolkit to automatically encode multiple bitrates and perform automated VMAF measurements on all of them. 

By optimizing ABR-ladders for specific content, you will make sure to not have wasteful rungs and this has been shown to [cut bandwidth usage in half](https://dev.to/video/automating-video-analysis-to-cut-your-streaming-bandwidth-usage-in-half-5hk1).

## Usage

Only possible to run in AWS at the moment. You will need a running ECS cluster with a task definition configured to run [easyvmaf-s3](https://github.com/Eyevinn/easyvmaf_s3).

### Installation

```
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
  const { createJob, qualityAnalysisModelToString } = require('@eyevinn/autovmaf');
 
  const vmafScores = await = createJob({
    name: "MyVMAFmeasurements",
    pipeline: "pipeline.yml",
    encodingProfile: "profile.json",
    reference: "reference.mp4",
    models: ["HD", "PhoneHD"],                       // optional
    resolutions: [{ width: 1280, height: 720 }],     // optional
    bitrates: [600000],                              // optional
    method: "bruteForce"                             // optional
  });
```

When creating a job, you can specify:

 * **Name**
    -  This will name the folder in which to put the files.
 * **Pipeline**
    * Path to a YAML-file that defines the pipeline. See [`examples/pipeline.yml`](examples/pipeline.yml) for an example AWS-pipeline. _Currently only AWS is supported._
 * **Encoding Profile**
    * Path to a JSON-file that defines how the reference should be encoded. When using AWS, this is a MediaConvert configuration. For local pipelines, this is key-value pairs that will be passed as command line arguments to FFmpeg. See an example for AWS at [`examples/encoding-profile.json`](examples/encoding-profile.json). 
 * **Reference**
    * Path to the reference video to analyze. Normally a local path, but when using AWS, this can also be an S3-URI.
 * **Models** (optional)
    * A list of VMAF-models to use in evaluation. This can be HD, MobileHD and UHD. HD by default.
 * **Resolutions** (optional)
    * A list of resolutions to test. By default it will test all resolutions in the example ABR-ladder provided by Apple in the [HLS Authoring Spec](https://developer.apple.com/documentation/http_live_streaming/hls_authoring_specification_for_apple_devices).
 * **Bitrates** (optional)
    * A list of bitrates to test. By default a list of bitrates between 150 kbit/s to 9000 kbit/s.
 * **Method** (optional)
    * The method to use when analyzing the videos. Either `bruteForce` or `walkTheHull`. By default `bruteForce`. NOTE: `walkTheHull` is not implemented at the moment.

### Create job using yaml

```typescript
const { createJob, JobDescription } = require('@eyevinn/autovmaf');
const YAML = require('yaml');
const fs = require('fs');
const parseResolutions = resolutions => {
resolutions.map(resolutionStr => ({
   width: parseInt(resolutionStr.split('x')[0]),
   height: parseInt(resolutionStr.split('x')[1]),
  }));
};
const jobFile = fs.readFileSync('job.yml', 'utf-8');
const jobData = YAML.parse(jobFile);
const job = {
  ...jobData,
  resolutions: jobData['resolutions'] !== undefined ?rseResolutions(jobData['resolutions']) : undefined,
};
createJob(job);
```

**An example of creating a job from a YAML-file can be seen in the [`examples`-folder](examples/).**

### Read VMAF-scores

Using `getVmaf()`, you can read VMAF-scores from a JSON-file or a directory of JSON-files. This works on both local paths as well as S3-URIs with a "s3://"-prefix.

Example:

```javascript
const vmafFiles = await getVmaf('s3://path/to/vmaf/');

vmafFiles.forEach(file => {
  console.log(file.filename + ': ' + file.vmaf);
});
```


# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!