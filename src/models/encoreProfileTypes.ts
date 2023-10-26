export type EncoreEncodeType = {
    type: string;
    suffix: string;
    twoPass: boolean;
    height: number;
    params: { [key: string]: string };
  }
  
export type EncoreProgramProfile = {
  name: string;
  description: string;
  scaling: string;
  encodes: EncoreEncodeType[];
}