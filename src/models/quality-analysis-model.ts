export enum QualityAnalysisModel {
  PhoneHD,
  HD,
  UHD,
}

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

export function stringToQualityAnalysisModel(model: string): QualityAnalysisModel {
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
