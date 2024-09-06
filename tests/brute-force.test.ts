import {
  jobWithBitratesAndRangeSet,
  defaultFilterFunction,
  jobWithoutBitrates,
  jobWithoutBitratesAndRange,
  jobWithBitratesAndMinRangeSet,
  jobWithBitratesAndMaxRangeSet,
  defaultBitrates,
  defaultResolutions,
  numberOfDefaultBitratesAfterDefaultFilter
} from './resources/brute-force.test.data';
import { preparePairs } from '../src/analysis/brute-force';
import { Resolution } from '../src/models/resolution';
import { BitrateRange, JobDescription } from '../src';
import { BitrateResolutionPair } from '../src/models/bitrate-resolution-pair';

describe('preparePairs', () => {
  test('with bitrates and range set should filter out resolutions outside of range', () => {
    const testData = prepareTestData(jobWithBitratesAndRangeSet);

    testData.pairs.forEach((pair) => {
      expect(pair.bitrate).toBeGreaterThanOrEqual(getMinBitrate(testData));
      expect(pair.bitrate).toBeLessThanOrEqual(getMaxBitrate(testData));
    });
  });

  test('with bitrates and min range set should filter out resolutions below range', () => {
    const testData = prepareTestData(jobWithBitratesAndMinRangeSet);

    testData.pairs.forEach((pair) => {
      expect(pair.bitrate).toBeGreaterThanOrEqual(getMinBitrate(testData));
      expect(pair.bitrate).toBeLessThanOrEqual(getMaxBitrate(testData));
    });
    expect(testData.pairs.length).toEqual(2);
  });

  test('with bitrates and max range set should filter out resolutions above range', () => {
    const testData = prepareTestData(jobWithBitratesAndMaxRangeSet);

    testData.pairs.forEach((pair) => {
      expect(pair.bitrate).toBeGreaterThanOrEqual(getMinBitrate(testData));
      expect(pair.bitrate).toBeLessThanOrEqual(getMaxBitrate(testData));
    });
    expect(testData.pairs.length).toEqual(2);
  });

  test('without bitrates but range set should filter out resolutions outside of range', () => {
    const testData = prepareTestData(jobWithoutBitrates);

    testData.pairs.forEach((pair) => {
      expect(pair.bitrate).toBeGreaterThanOrEqual(getMinBitrate(testData));
      expect(pair.bitrate).toBeLessThanOrEqual(getMaxBitrate(testData));
    });
  });

  test('without bitrates and range set should not filter out any bitrates', () => {
    const testData = prepareTestData(jobWithoutBitratesAndRange);
    expect(testData.pairs.length).toEqual(
      numberOfDefaultBitratesAfterDefaultFilter
    );
  });
});

function prepareTestData(jobDescription: JobDescription): {
  pairs: BitrateResolutionPair[];
  range: BitrateRange;
} {
  const resolutions: Resolution[] =
    jobDescription.resolutions != undefined
      ? jobDescription.resolutions
      : defaultResolutions;
  const bitrates =
    jobDescription.bitrates != undefined
      ? jobDescription.bitrates
      : defaultBitrates;
  const range: BitrateRange =
    resolutions[0].range != undefined
      ? resolutions[0].range
      : { min: 0, max: 90000000 };

  return {
    pairs: preparePairs(resolutions, bitrates, defaultFilterFunction),
    range: range
  };
}

function getMinBitrate(testData): number {
  return testData.range.min !== undefined ? testData.range.min : 0;
}

function getMaxBitrate(testData): number {
  return testData.range.max !== undefined ? testData.range.max : 90000000;
}
