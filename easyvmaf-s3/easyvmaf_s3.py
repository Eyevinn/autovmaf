import boto3
import argparse
import os
import subprocess

parser = argparse.ArgumentParser(description='Run easyVMAF on file in S3-bucket.')
parser.add_argument('-r', type=str, help="The s3-url of the reference input. Example: s3://input-bucket/reference.mp4", dest="reference_input", required=True)
parser.add_argument('-d', type=str, help="The s3-url of the distorted input. Example: s3://input-bucket/distorted.mp4", dest="distorted_input", required=True)
parser.add_argument('-o', type=str, help="The s3-url of the output. This file will be created Example: s3://output-bucket/file_vmaf.json", dest="output", required=True)
parser.add_argument("--phone", action='store_true', help="Whether or not to use the phone model for VMAF analysis.")
parser.add_argument("--model", type=str, help="The VMAF-model to use. Either HD or 4K.")

args = parser.parse_args()

reference_input_bucket, reference_input_object = args.reference_input.split('/',2)[-1].split('/',1)
distorted_input_bucket, distorted_input_object = args.distorted_input.split('/',2)[-1].split('/',1)
output_bucket, output_object = args.output.split('/',2)[-1].split('/',1)

reference_file = "reference.mp4"
distorted_file = "distorted.mp4"

s3 = boto3.client('s3')
s3.download_file(reference_input_bucket, reference_input_object, reference_file)
s3.download_file(distorted_input_bucket, distorted_input_object, distorted_file)

additional_args = []
if args.phone:
    additional_args.append("-phone")
if args.model:
    additional_args.append("-model")
    additional_args.append(args.model)

subprocess.call(["python3", "easyVmaf.py", "-r", reference_file, "-d", distorted_file] + additional_args)

output_file = os.path.splitext(distorted_file)[0] + "_vmaf.json"

response = s3.upload_file(output_file, output_bucket, output_object)

