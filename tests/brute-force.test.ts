import { 
    jobWithBitratesAndRangeSet, 
    defaultFilterFunction, 
    jobWithoutBitrates, 
    jobWithoutBitratesAndRange, 
    defaultBitrates,
    defaultResolutions,
    numberOfDefaultBitratesAfterDefaultFilter
} from "./resources/brute-force.test.data";
import { preparePairs } from '../src/analysis/brute-force';
import { Resolution } from "../src/models/resolution";
import { BitrateRange, JobDescription } from "../src";
import { BitrateResolutionPair } from '../src/models/bitrate-resolution-pair';

describe('preparePairs', () => {
    test('with bitrates and range set should filter out resolutions outside of range', () => {
        let testData = prepareTestData(jobWithBitratesAndRangeSet);
        
        testData.pairs.forEach(pair => {
            expect(pair.bitrate).toBeGreaterThanOrEqual(testData.range.min);
            expect(pair.bitrate).toBeLessThanOrEqual(testData.range.max);
        })
    });

    test('without bitrates but range set should filter out resolutions outside of range', () => {
        let testData = prepareTestData(jobWithoutBitrates);
        
        testData.pairs.forEach(pair => {
            expect(pair.bitrate).toBeGreaterThanOrEqual(testData.range.min);
            expect(pair.bitrate).toBeLessThanOrEqual(testData.range.max);
        })
    });

    test('without bitrates and range set should not filter out any bitrates', () => {
        let testData = prepareTestData(jobWithoutBitratesAndRange);
        console.log(testData.pairs);
        expect(testData.pairs.length).toEqual(numberOfDefaultBitratesAfterDefaultFilter);
    });

  });

function prepareTestData(jobDescription: JobDescription): {pairs: BitrateResolutionPair[], range: BitrateRange} {
    let resolutions: Resolution[] = jobDescription.resolutions != undefined ? jobDescription.resolutions : defaultResolutions;
    let bitrates = jobDescription.bitrates != undefined ? jobDescription.bitrates : defaultBitrates;
    let range: BitrateRange = resolutions[0].range != undefined ? resolutions[0].range : {min: 0, max: 0};
    return {pairs: preparePairs(resolutions, bitrates, defaultFilterFunction), range: range};
}