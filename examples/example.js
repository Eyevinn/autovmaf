const { createJob } = require('@eyevinn/autovmaf');
const YAML = require('yaml');
const fs = require('fs');

const parseResolutions = (resolutions) => {
  return resolutions.map((resolution) => {
    const [width, height] = resolution.split('x');
    return { width: parseInt(width), height: parseInt(height) };
  });
};

const jobFile = fs.readFileSync('job.yml', 'utf-8');
const jobData = YAML.parse(jobFile);

jobData.resolutions = jobData['resolutions']
  ? parseResolutions(jobData.resolutions)
  : undefined;

createJob(jobData);
