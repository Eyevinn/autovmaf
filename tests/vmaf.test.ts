import getAnalysisData from '../src/get-analysis-data';

describe('vmaf', () => {
  it('Gets VMAF score from local file', async () => {
    const vmaf = await getAnalysisData('tests/resources/vmaf.json');
    expect(vmaf.vmafList[0].vmafScores.vmaf).toEqual(85.628489);
  });
});
