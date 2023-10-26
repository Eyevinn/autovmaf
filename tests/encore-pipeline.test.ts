import { EncorePipelineConfiguration } from '../src/pipelines/encore/encore-pipeline-configuration';
import { EncorePipeline } from '../src/pipelines/encore/encore-pipeline';
import { EncoreInstance } from '../src/models/encoreInstance';

const configuration: EncorePipelineConfiguration = {
  apiAddress: 'https://api-encore.stage.osaas.io',
  token: 'myToken',
  instanceId: 'myInstance',
  profile: 'myProfile',
  outputFolder: '/outputFolderPath',
  baseName: '_demo',
  inputs: ['sourcePath'],
  duration: 30,
  priority: 1,
  encorePollingInterval_ms: 30000,
  encoreInstancePostCreationDelay_ms: 10000
};

const myInstance: EncoreInstance = {
  name: "name",
  url: "https://dummy.stage.osaas.io/encoreinstance/myInstance",
  profilesUrl: "profilesUrl",
  resources: {
    license: {
      url: "url"
    },
    enqueueJob: {
      url: "https://dummy.encore.stage.osaas.io/encoreJobs",
      method: "method"
    },
    listJobs: {
      url: "url",
      method: "method"
    }
  }
};

const mockFetch = jest.fn();
const mockHeaders = jest.fn();
const mockJSONStringify = jest.fn();
(global as any).fetch = mockFetch;
(global as any).Headers = mockHeaders;
(global as any).JSON.stringify = mockJSONStringify;

const mockResponse = {};
mockFetch.mockResolvedValue({
  status: 200,
  json: jest.fn().mockResolvedValue(mockResponse),
});
beforeEach(() => {
  jest.clearAllMocks();
});

const pipeline = new EncorePipeline(configuration);

describe('createEncoreInstance', () => {
  it('should make a POST request with the correct URL, headers, and body', async () => {

    await pipeline.createEncoreInstance(configuration.apiAddress, configuration.token, configuration.instanceId, configuration.profile);

    const url = `${configuration.apiAddress}/encoreinstance`;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${pipeline.configuration.token}`,
      'Content-Type': 'application/json',
    };
    const data = {
      "name": pipeline.configuration.instanceId,
      "profile": pipeline.configuration.profile,
    };

    expect(JSON.stringify).toHaveBeenCalledWith(data);
    expect(Headers).toHaveBeenCalledWith(headerObj);
    expect(global.fetch).toHaveBeenCalledWith(expect.objectContaining({ url: url }));
    expect(JSON.stringify).toHaveBeenCalledTimes(1);
    expect(Headers).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

  });
});

describe('deleteEncoreInstance', () => {
  it('should make a DELETE request with the correct URL, headers, and body', async () => {

    await pipeline.deleteEncoreInstance(myInstance, pipeline.configuration.apiAddress);

    const url = `${pipeline.configuration.apiAddress}/encoreinstance/${myInstance.name}`;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${pipeline.configuration.token}`,
    };

    expect(Headers).toHaveBeenCalledWith(headerObj);
    expect(global.fetch).toHaveBeenCalledWith(expect.objectContaining({ url: url }));
    expect(Headers).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('createEncoreJob', () => {
  it('should make a POST request with the correct URL, headers, and body', async () => {

    await pipeline.createEncoreJob(myInstance, pipeline.configuration.inputs[0]);

    const url = myInstance.resources.enqueueJob.url;;
    const headerObj = {
      'accept': 'application/json',
      'x-jwt': `Bearer ${pipeline.configuration.token}`,
      'Content-Type': 'application/json',
    };
    const data = {
      "profile": pipeline.configuration.profile,
      "outputFolder": pipeline.configuration.outputFolder,
      "baseName": pipeline.configuration.baseName,
      "inputs": [
        {
          "uri":  pipeline.configuration.inputs[0],
          "type": "AudioVideo"
        }
      ],
      "duration": pipeline.configuration.duration,
      "priority": pipeline.configuration.priority
    };

    expect(JSON.stringify).toHaveBeenCalledWith(data);
    expect(Headers).toHaveBeenCalledWith(headerObj);
    expect(global.fetch).toHaveBeenCalledWith(expect.objectContaining({ url: url }));
    expect(JSON.stringify).toHaveBeenCalledTimes(1);
    expect(Headers).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});