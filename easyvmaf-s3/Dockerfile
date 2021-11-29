FROM gfdavila/easyvmaf:1.2
RUN pip3 install boto3
WORKDIR  /app/easyVmaf-${easyVmaf_version}
COPY easyvmaf_s3.py easyvmaf_s3.py
ENTRYPOINT [ "python3", "easyvmaf_s3.py" ]

