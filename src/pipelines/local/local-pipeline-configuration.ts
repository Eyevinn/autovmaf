export type LocalPipelineConfiguration = {
  ffmpegPath: string;
  pythonPath: string;
  easyVmafPath: string;
  ffmpegEncoder: 'libx264' | 'h264_videotoolbox';
  skipDefaultOptions?: boolean;
  ffmpegOptions: { [key: string]: string };
  singlePass?: boolean;
  easyVmafExtraArgs?: { [key: string]: string };
};
