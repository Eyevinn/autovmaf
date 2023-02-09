import logger from './logger';
import { Resolution } from "./models/resolution";


export async function savePairedVmafScoresAsCsvFile(fileName: string, pairedVmaf: Map<number, {resolution: Resolution, vmaf: number,}[]>) {
  console.log("-----------------------------------------------------------------------------------------");
  console.log(fileName);
  console.log(JSON.stringify(pairedVmaf));
  console.log("-----------------------------------------------------------------------------------------");
}