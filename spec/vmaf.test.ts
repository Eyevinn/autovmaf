import getVmaf from '../src/get-vmaf';

describe('vmaf', () => {
  it('Gets VMAF score from local file', async () => {
    const vmaf = await getVmaf('spec/resources/vmaf.json');
    expect(vmaf[0].vmaf).toEqual(85.628489);
  });
});
