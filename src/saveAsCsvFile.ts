import logger from './logger';
import { Resolution } from "./models/resolution";


export async function savePairedVmafScoresAsCsvFile(fileName: string, pairedVmaf: Map<number, {resolution: Resolution, vmaf: number,}[]>) {
  logger.info(fileName);
  logger.info(JSON.stringify(pairedVmaf));
}