import * as fs from 'fs';
import { EncoreEncodeType, EncoreProgramProfile } from './models/encoreProfileTypes';

export class EncoreYAMLGenerator {
  generateYAML(profile: EncoreProgramProfile): string {
    const yamlContent = `
name: ${profile.name}
description: ${profile.description}
scaling: ${profile.scaling}
encodes:
${profile.encodes
      .map((encode) => `
  - type: ${encode.type}
    suffix: ${encode.suffix}
    twoPass: ${encode.twoPass}
    height: ${encode.height}
    params:${Object.entries(encode.params)
        .map(([key, value]) => `
      ${key}: ${value}`)
        .join('')}
`)
      .join('')}
`;

    return yamlContent;
  }

  createEncodeObject(
    type: string,
    suffix: string,
    twoPass: boolean,
    height: number,
    params: { [key: string]: string }
  ): EncoreEncodeType {
    return {
      type,
      suffix,
      twoPass,
      height,
      params,
    };
  }

  saveToFile(profile: EncoreProgramProfile, filePath: string) {
    const generatedYAML = this.generateYAML(profile);
    fs.writeFileSync(filePath, generatedYAML);
  }
}


// Example usage:
function example() {
  const yamlGenerator = new EncoreYAMLGenerator();

  const encodeObject = yamlGenerator.createEncodeObject('X264Encode', '_x264_3100', true, 1080, {
      'b:v': '3100k',
      maxrate: '4700k',
      bufsize: '6200k',
      r: '25',
      fps_mode: 'cfr',
      pix_fmt: 'yuv420p',
      force_key_frames: 'expr:not(mod(n,96))',
      preset: 'medium',
    });

  const encodeObjects: EncoreEncodeType[] = [];
  encodeObjects.push(encodeObject); 

  const programProfile: EncoreProgramProfile = {
    name: 'encoreProgram',
    description: 'Program profile',
    scaling: 'bicubic',
    encodes: encodeObjects,
  };

  yamlGenerator.saveToFile(programProfile, 'encoreProfile.yml');
}