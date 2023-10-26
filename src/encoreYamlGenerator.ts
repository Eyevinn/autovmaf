import * as fs from 'fs';
import YAML from 'yaml';
import { Resolution } from '../src/models/resolution';

export class EncoreYAMLGenerator {


  /**
   * Creates an Encore YAML profile that contains transcoding instructions.
   * @param inlineProfile YAML profile to use for transcoding.
   * @param resolutions Resolutions that are to be generated.
   * @param bitRates Bit rates that are to be generated for each resolution.
   */
  createProfile(inlineProfile: string, resolutions: Resolution[], bitRates: number[]): string {

    const inlineProfileObject = YAML.parse(inlineProfile);
    let profiles: string[] = [];
  
    resolutions.forEach(resolution => {
      bitRates.forEach(bitRate => {
        const encoding = this.modifyEncoreProfileAttributes(inlineProfileObject.encodes[0], resolution, bitRate);
        profiles.push(encoding)
      })
    });
  
    let i = 0;
    profiles.forEach(encodingProfile => {
      inlineProfileObject.encodes[i] = encodingProfile;
      i++;
    })
  
    const profile = YAML.stringify(inlineProfileObject);
    this.saveToFile("test_output_profile.yml", profile);
  
    return profile
  }

  /**
   * Modifies an Encore YAML profile with new values for target resolution and bitrate.
   * @param profileEncodesObject The encodes attribute object of the encore YAML profile being used.
   * @param resolutions Resolutions that are to be generated.
   * @param bitRates Bit rates that are to be generated for each resolution.
   */
  modifyEncoreProfileAttributes(profileEncodesObject: any, resolution: Resolution, bitRate: number): string {

    if(!profileEncodesObject){
      throw new Error('encodes object missing');
    }
    const data = profileEncodesObject;

    data.height = resolution.height;
    data.width = resolution.width;
    data.params['b:v'] = bitRate;
    data.params['maxrate'] = resolution.range?.max;
    data.params['minrate'] = resolution.range?.min;

    const updatedYAML = YAML.stringify(data);

    return updatedYAML;
}

  /**
   * Saves an Encore YAML profile to a file. Mostly for testing.
   * @param filePath The path where to write the file.
   * @param yaml The yaml-structured content.
   */
  saveToFile(filePath: string, yaml: string) {
    fs.writeFileSync(filePath, yaml);
  }
}