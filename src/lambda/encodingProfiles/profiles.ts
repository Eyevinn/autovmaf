const default_profile = {
  Inputs: [
    {
      TimecodeSource: "ZEROBASED",
      VideoSelector: {},
      FileInput: "$INPUT",
    },
  ],
  OutputGroups: [
    {
      Name: "File Group",
      OutputGroupSettings: {
        Type: "FILE_GROUP_SETTINGS",
        FileGroupSettings: {
          Destination: "$OUTPUT",
        },
      },
      Outputs: [
        {
          VideoDescription: {
            CodecSettings: {
              Codec: "H_264",
              H264Settings: {
                RateControlMode: "CBR",
                Bitrate: "$BITRATE",
                CodecProfile: "HIGH",
              },
            },
            Width: "$WIDTH",
            Height: "$HEIGHT",
          },
          ContainerSettings: {
            Container: "MP4",
            Mp4Settings: {},
          },
        },
      ],
    },
  ],
  TimecodeConfig: {
    Source: "ZEROBASED",
  },
};

const h265_profile = {
  Inputs: [
    {
      TimecodeSource: "ZEROBASED",
      VideoSelector: {},
      FileInput: "$INPUT",
    },
  ],
  OutputGroups: [
    {
      Name: "File Group",
      OutputGroupSettings: {
        Type: "FILE_GROUP_SETTINGS",
        FileGroupSettings: {
          Destination: "$OUTPUT",
        },
      },
      Outputs: [
        {
          VideoDescription: {
            CodecSettings: {
              Codec: "H_265",
              H265Settings: {
                GopBReference: "ENABLED",
                HrdBufferSize: "$HRDBUFFER",
                Bitrate: "$BITRATE",
                RateControlMode: "CBR",
                CodecProfile: "MAIN10_HIGH",
                AdaptiveQuantization: "AUTO",
                GopSizeUnits: "AUTO",
              },
            },
            Width: "$WIDTH",
            Height: "$HEIGHT",
          },
          ContainerSettings: {
            Container: "MP4",
            Mp4Settings: {},
          },
        },
      ],
    },
  ],
  TimecodeConfig: {
    Source: "ZEROBASED",
  },
};

export { default_profile, h265_profile };
