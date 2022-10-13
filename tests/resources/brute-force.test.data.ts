import { JobDescription } from '../../src/create-job';
import { BitrateResolutionPair } from '../../src/models/bitrate-resolution-pair';
import { Resolution } from '../../src/models/resolution';

export const defaultFilterFunction: (pair: BitrateResolutionPair) => boolean = ({ bitrate, resolution }) =>
  bitrate >= resolution.width * resolution.height * 0.3 && bitrate <= resolution.width * resolution.height * 8;

export const numberOfDefaultBitratesAfterDefaultFilter = 27;

export const jobWithBitratesAndRangeSet: JobDescription = {
    name: "test-job",
    pipeline: "pipeline.yml",
    encodingProfile: "profile.json",
    reference: "reference.mp4",
    models: ["HD", "PhoneHD"],
    resolutions: [{ width: 1280, height: 720, range: {min: 400000, max: 600000}} ],
    bitrates: [400000, 600000, 800000],
    method: "bruteForce"
  };  

export const jobWithoutBitrates: JobDescription = {
    name: "test-job",
    pipeline: "pipeline.yml",
    encodingProfile: "profile.json",
    reference: "reference.mp4",
    models: ["HD", "PhoneHD"],
    resolutions: [{ width: 1280, height: 720, range: {min: 400000, max: 600000}} ],
    bitrates: undefined,
    method: "bruteForce"
  };

export const jobWithoutBitratesAndRange: JobDescription = {
    name: "test-job",
    pipeline: "pipeline.yml",
    encodingProfile: "profile.json",
    reference: "reference.mp4",
    models: ["HD", "PhoneHD"],
    resolutions: [{ width: 1280, height: 720, range: undefined} ],
    bitrates: undefined,
    method: "bruteForce"
  };

  export const jobWithBitratesAndMinRangeSet: JobDescription = {
    name: "test-job",
    pipeline: "pipeline.yml",
    encodingProfile: "profile.json",
    reference: "reference.mp4",
    models: ["HD", "PhoneHD"],
    resolutions: [{ width: 1280, height: 720, range: {min: 600000, max: undefined}} ],
    bitrates: [400000, 600000, 800000],
    method: "bruteForce"
  }; 

  export const jobWithBitratesAndMaxRangeSet: JobDescription = {
    name: "test-job",
    pipeline: "pipeline.yml",
    encodingProfile: "profile.json",
    reference: "reference.mp4",
    models: ["HD", "PhoneHD"],
    resolutions: [{ width: 1280, height: 720, range: {min: undefined, max: 600000}} ],
    bitrates: [400000, 600000, 800000],
    method: "bruteForce"
  }; 


export const defaultBitrates = [
    150000,
    300000,
    400000,
    500000,
    600000,
    700000,
    800000,
    900000,
    1000000,
    1200000,
    1400000,
    1600000,
    1800000,
    2000000,
    2200000,
    2400000,
    2600000,
    2800000,
    3000000,
    3400000,
    3800000,
    4200000,
    4600000,
    5000000,
    5500000,
    6000000,
    6500000,
    7000000,
    7500000,
    8000000,
    8500000,
    9000000,
  ];

export const defaultResolutions: Resolution[] = [
    { width: 640, height: 360, range: undefined},
    { width: 768, height: 432, range: undefined},
    { width: 960, height: 540, range: undefined},
    { width: 1280, height: 720, range: undefined},
    { width: 1920, height: 1080, range: undefined},
  ];