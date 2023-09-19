// import { EncorePipelineConfiguration } from '../src/pipelines/encore/encore-pipeline-configuration';
// import { EncorePipeline } from '../src/pipelines/encore/encore-pipeline';
// import { EncoreInstance } from '../src/models/encoreInstance';

// const configuration: EncorePipelineConfiguration = {
//   apiAddress: 'https://api-encore.stage.osaas.io',
//   token: 'myToken',
//   instanceId: 'myInstance',
//   profile: 'myProfile',
//   outputFolder: '/outputFolderPath',
//   baseName: '_demo',
//   inputs: ['sourcePath'],
//   duration: 30,
//   priority: 1,
//   encorePollingInterval_ms: 30000,
//   encoreInstancePostCreationDelay_ms: 10000
// };

// const myInstance: EncoreInstance = {
//   name: "name",
//   url: "https://dummy.stage.osaas.io/encoreinstance/myInstance",
//   profilesUrl: "profilesUrl",
//   resources: {
//     license: {
//       url: "url"
//     },
//     enqueueJob: {
//       url: "https://dummy.encore.stage.osaas.io/encoreJobs",
//       method: "method"
//     },
//     listJobs: {
//       url: "url",
//       method: "method"
//     }
//   }
// };

// const pipeline = new EncorePipeline(configuration);

// describe('createEncoreInstance', () => {
//   it('should make a POST request with the correct URL, headers, and body', async () => {

//     const expectedResponse = { success: true };

//     const mockFetch = jest.fn().mockResolvedValue(expectedResponse);
//     jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

//     await pipeline.createEncoreInstance(configuration.apiAddress, configuration.token, configuration.instanceId, configuration.profile);

//     const url = `${configuration.apiAddress}/encoreinstance`;
//     const headerObj = {
//       'accept': 'application/json',
//       'x-jwt': `Bearer ${pipeline.configuration.token}`,
//       'Content-Type': 'application/json',
//     };
//     const headers = new Headers(headerObj);
//     const data = JSON.stringify({
//       "name": pipeline.configuration.instanceId,
//       "profile": pipeline.configuration.profile,
//     });

//     expect(global.fetch).toHaveBeenCalledWith(expect.objectContaining({ url: url }));
//   });
// });

// describe('deleteEncoreInstance', () => {
//   it('should make a DELETE request with the correct URL, headers, and body', async () => {

//     const mockResponse = {
//       then: jest.fn()
//     };
//     const mockFetch = jest.fn().mockResolvedValue(mockResponse);
//     jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

//     await pipeline.deleteEncoreInstance(myInstance);

//     const url = myInstance.url;
//     expect(mockResponse.then).toHaveBeenCalledTimes(1);
//     expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ url: url }));
//     //TODO: same as other tests
//   });
// });

// describe('createEncoreJob', () => {
//   it('should make a POST request with the correct URL, headers, and body', async () => {

//     const mockResponse = {
//       then: jest.fn()
//     };
//     const mockFetch = jest.fn().mockResolvedValue(mockResponse);
//     jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

//     await pipeline.createEncoreJob(myInstance, configuration.inputs[0]);

//     const url = myInstance.resources.enqueueJob.url;
//     expect(mockResponse.then).toHaveBeenCalledTimes(1);
//     expect(mockFetch).toHaveBeenCalledWith(expect.objectContaining({ url: url }));
//     //TODO: same as other tests
//   });
// });