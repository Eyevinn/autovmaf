import { QualityAnalysisModel } from '../src/models/quality-analysis-model';
import { EncorePipelineConfiguration } from '../src/pipelines/encore/encore-pipeline-configuration';
import EncorePipeline from '../src/pipelines/encore/encore-pipeline';
import { Curl } from 'node-libcurl';

const pipelineSettings: EncorePipelineConfiguration = {
  apiAddress: 'https://api-encore.stage.osaas.io',
  token: 'myToken',
  instanceId: 'myInstance',
  profile: 'myProfile',
  outputFolder: 'outputFolderPath',
  baseName: 'baseName',
  inputs: ['sourcePath'],
  duration: 30,
  priority: 1
};

const pipeline = new EncorePipeline(pipelineSettings);

describe('createEncoreInstance', () => {
  it('should send a POST request with the correct URL, headers, and data', async () => {
    const apiAddress = `${pipelineSettings.apiAddress}/encoreinstance/`;
    const curlInstance: Curl = new Curl();
    const setOptSpy = jest.spyOn(curlInstance, 'setOpt');
    const onSpy = jest.spyOn(curlInstance, 'on');
    const performSpy = jest.spyOn(curlInstance, 'perform');

    await pipeline.createEncoreInstance(apiAddress, curlInstance);

    expect(setOptSpy).toHaveBeenCalledTimes(3);
    expect(setOptSpy.mock.calls).toEqual([
      ['URL', apiAddress],
      ['HTTPHEADER', [
        'accept: application/json',
        `x-jwt: Bearer ${pipeline.configuration.token}`,
        'Content-Type: application/json',
      ]],
      ['POSTFIELDS', JSON.stringify({
        name: pipeline.configuration.instanceId,
        profile: pipeline.configuration.profile,
      })]
    ]);
    expect(onSpy).toHaveBeenCalledTimes(2);
    expect(performSpy).toHaveBeenCalledTimes(1);
  });
});

describe('getEncoreInstance', () => {
  it('should send a GET request with the correct URL, headers, and data', async () => {
    const apiAddress = `${pipelineSettings.apiAddress}/encoreinstance/`;
    const curlInstance: Curl = new Curl();
    const setOptSpy = jest.spyOn(curlInstance, 'setOpt');
    const onSpy = jest.spyOn(curlInstance, 'on');
    const performSpy = jest.spyOn(curlInstance, 'perform');

    await pipeline.getEncoreInstance(apiAddress, curlInstance);

    expect(setOptSpy).toHaveBeenCalledTimes(3);
    expect(setOptSpy.mock.calls).toEqual([
      ['URL', apiAddress],
      ['HTTPHEADER', [
        'accept: application/json',
        `x-jwt: Bearer ${pipeline.configuration.token}`,
        'Content-Type: application/json',
      ]],
      ['CUSTOMREQUEST', 'GET']
    ]);
    expect(onSpy).toHaveBeenCalledTimes(2);
    expect(performSpy).toHaveBeenCalledTimes(1);
  });
});

describe('deleteEncoreInstance', () => {
  it('should send a DELETE request with the correct URL, headers, and data', async () => {
    const instanceId: string = 'myInstanceId'
    const apiAddress = `${pipelineSettings.apiAddress}/encoreinstance/`;
    const curlInstance: Curl = new Curl();
    const setOptSpy = jest.spyOn(curlInstance, 'setOpt');
    const onSpy = jest.spyOn(curlInstance, 'on');
    const performSpy = jest.spyOn(curlInstance, 'perform');

    await pipeline.deleteEncoreInstance(apiAddress, instanceId, curlInstance);

    expect(setOptSpy).toHaveBeenCalledTimes(3);
    expect(setOptSpy.mock.calls).toEqual([
      ['URL', `${apiAddress}/encoreinstance/${instanceId}`],
      ['HTTPHEADER', [
        'accept: application/json',
        `x-jwt: Bearer ${pipeline.configuration.token}`,
        'Content-Type: application/json',
      ]],
      ['CUSTOMREQUEST', 'DELETE']
    ]);
    expect(onSpy).toHaveBeenCalledTimes(2);
    expect(performSpy).toHaveBeenCalledTimes(1);
  });
});

describe('enqueueJob', () => {
  it('should send a POST request with the correct URL, headers, and data', async () => {
    const instanceId: string = 'myInstanceId'
    const apiAddress = `${pipelineSettings.apiAddress}/encoreinstance/${instanceId}/jobs`;
    const curlInstance: Curl = new Curl();
    const data = JSON.stringify({
      "profile": pipeline.configuration.profile,
      "outputFolder": pipeline.configuration.outputFolder,
      "baseName": pipeline.configuration.baseName,
      "inputs": [
        {
          "uri": pipeline.configuration.inputs[0],
          "type": "AudioVideo"
        }
      ],
      "duration": pipeline.configuration.duration,
      "priority": pipeline.configuration.priority
    });
    const setOptSpy = jest.spyOn(curlInstance, 'setOpt');
    const onSpy = jest.spyOn(curlInstance, 'on');
    const performSpy = jest.spyOn(curlInstance, 'perform');

    await pipeline.createEncoreJob(pipeline.configuration.inputs[0], apiAddress, curlInstance);

    expect(setOptSpy).toHaveBeenCalledTimes(3);
    expect(setOptSpy.mock.calls).toEqual([
      ['URL', `${apiAddress}`],
      ['HTTPHEADER', [
        'accept: application/json',
        `x-jwt: Bearer ${pipeline.configuration.token}`,
        'Content-Type: application/json',
      ]],
      ['POSTFIELDS', data]
    ]);
    expect(onSpy).toHaveBeenCalledTimes(2);
    expect(performSpy).toHaveBeenCalledTimes(1);
  });
});

