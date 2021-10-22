import getVmaf from '../src/get-vmaf';

describe('vmaf', () => {
  it('Gets VMAF score from local file', async () => {
    const vmaf = await getVmaf('test/resources/vmaf.json');
    expect(vmaf).toEqual(85.628489);
  });
});
