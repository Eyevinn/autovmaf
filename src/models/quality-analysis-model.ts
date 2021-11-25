/**
 * An enum representing the 3 supported quality analysis models by [VMAF](https://github.com/Netflix/vmaf).
 */
export enum QualityAnalysisModel {
  PhoneHD,
  HD,
  UHD,
}

/**
 * Converts from a QualityAnalysisModel-enum to a readable string.
 * @param model The model to convert.
 * @returns A readable string of the model name.
 */
export function qualityAnalysisModelToString(model: QualityAnalysisModel): string {
  if (model === QualityAnalysisModel.HD) {
    return 'HD';
  } else if (model === QualityAnalysisModel.PhoneHD) {
    return 'PhoneHD';
  } else if (model === QualityAnalysisModel.UHD) {
    return 'UHD';
  } else {
    return 'HD';
  }
}

/**
 * Converts from a string to a QualityAnalysisModel-enum.
 * @param model The string to convert. Can be either "HD", "PhoneHD", or "UHD".
 * @returns A QualityAnalysisModel-enum depending on the input string.
 */
export function stringToQualityAnalysisModel(model: 'HD' | 'PhoneHD' | 'UHD'): QualityAnalysisModel {
  if (model === 'HD') {
    return QualityAnalysisModel.HD;
  } else if (model === 'PhoneHD') {
    return QualityAnalysisModel.PhoneHD;
  } else if (model === 'UHD') {
    return QualityAnalysisModel.UHD;
  } else {
    return QualityAnalysisModel.HD;
  }
}
