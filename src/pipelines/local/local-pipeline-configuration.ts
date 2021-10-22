export type LocalPipelineConfiguration = {
  ffmpegPath: string;
  pythonPath: string;
  easyVmafPath: string;
  ffmpegEncoder: 'libx264' | 'h264_videotoolbox';
  ffmpegOptions: { [key: string]: string };
};
