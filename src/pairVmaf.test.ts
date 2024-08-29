import { parseVmafFilename } from './pairVmaf';

describe('parseFilename', () => {
  it('basename only, should return resolution and bitrate', () => {
    expect(parseVmafFilename('1920x1080_0.mp4')).toEqual({
      width: 1920,
      height: 1080,
      bitrate: 0,
      variables: {}
    });
  });

  it('full path, should return resolution and bitrate', () => {
    expect(parseVmafFilename('/apa/bepa/1920x1080_0.mp4')).toEqual({
      width: 1920,
      height: 1080,
      bitrate: 0,
      variables: {}
    });
  });

  it('with variables, should return resolution, bitrate, and variables', () => {
    expect(
      parseVmafFilename('1920x1080_0_VAR1_value1_VAR2_value2_vmaf.json')
    ).toEqual({
      width: 1920,
      height: 1080,
      bitrate: 0,
      variables: {
        VAR1: 'value1',
        VAR2: 'value2'
      }
    });
  });

  it('with variables and generic file extension, should return resolution, bitrate, and variables', () => {
    expect(
      parseVmafFilename('1920x1080_0_VAR1_value1_VAR2_value2.mp4')
    ).toEqual({
      width: 1920,
      height: 1080,
      bitrate: 0,
      variables: {
        VAR1: 'value1',
        VAR2: 'value2'
      }
    });
  });
});
