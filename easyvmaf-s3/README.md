# easyvmaf-s3

This is a simple Docker-image that can be used to run easyVmaf from files in an S3-bucket.

## Usage

### Build the image

```
docker build . -t easyvmaf-s3
```

### Start a container

```
docker run --rm -e AWS_ACCESS_KEY_ID=X -e AWS_SECRET_ACCESS_KEY=X easyvmaf-s3 -r s3://videos/reference.mp4 -d s3://videos/640x360_750000.mp4 -o s3://videos/640x360_750000_vmaf.json
```

See `easyvmaf_s3.py --help` for more details.