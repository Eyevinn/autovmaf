# Eyevinn AutoVMAF

Toolkit to automatically generate optimized ABR-ladders for a video using video quality analysis. This is done through [a method developed by Netflix](https://netflixtechblog.com/per-title-encode-optimization-7e99442b62a2) to analyze video to find optimal encodes to provide viewers with the best video quality for their specific viewing conditions.

By optimizing ABR-ladders for specific content, you will make sure to not have wasteful rungs and this has been shown to [cut bandwidth usage in half](https://dev.to/video/automating-video-analysis-to-cut-your-streaming-bandwidth-usage-in-half-5hk1).

## Usage

### Generate ABR-ladder

To generate an ABR-ladder, you will need to define a job which can be created with the `createJob()`-function. When creating a job, you can specify:

 * Name
    * This will name the folder in which to put the files.
 * Pipeline
    * Path to a YAML-file that defines the pipeline. See `examples/pipeline.yml` for an example AWS-pipeline.
 * Encoding Profile
    * Path to a JSON-file that defines how the reference should be encoded. When using AWS, this is a MediaConvert configuration. For local pipelines, this is key-value pairs that will be passed as command line arguments to FFmpeg. See an example for AWS at `examples/encoding-profile.json`. 
 * Reference
    * Path to the reference video to analyze. Normally a local path, but when using AWS, this can also be an S3-URI.
 * Models (optional)
    * A list of VMAF-models to use in evaluation. This can be HD, MobileHD and UHD. HD by default.
 * Resolutions (optional)
    * A list of resolutions to test. By default it will test all resolutions in the example ABR-ladder provided by Apple in the [HLS Authoring Spec](https://developer.apple.com/documentation/http_live_streaming/hls_authoring_specification_for_apple_devices).
 * Bitrates (optional)
    * A list of bitrates to test. By default a list of bitrates between 150 kbit/s to 9000 kbit/s.
 * Output (optional)
    * If this parameter is defined, the finished ABR-ladder will be exported to a CSV-file with this name.
 * Method (optional)
    * The method to use when analyzing the videos. Either `bruteForce` or `walkTheHull`. By default `bruteForce`. NOTE: `walkTheHull` is not implemented at the moment.

**An example of creating a job from a YAML-file can be seen in the `examples`-folder.**

A few environment variables can be set. These are:

```bash
LOAD_CREDENTIALS_FROM_ENV=true //Load AWS credentials from environment variables
```

### Read VMAF-scores

Using `getVmaf()`, you can read VMAF-scores from a JSON-file or a directory of JSON-files. This works on both local paths as well as S3-URIs with a "s3://"-prefix.

Example:

```javascript
const vmafFiles = await getVmaf('s3://path/to/vmaf/');

vmafFiles.forEach(file => {
  console.log(file.filename + ': ' + file.vmaf);
});
```
