const { createJob, JobDescription } = require('@eyevinn/autoabr');
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
  resolutions: jobData['resolutions'] !== undefined ? parseResolutions(jobData['resolutions']) : undefined,
};

createJob(job);
