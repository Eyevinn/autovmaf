import { cleanupTagValue } from './aws-pipeline';

describe('test tag value replacement', () => {
  it('No illegal chars, returns same string', () => {
    const value = 'A-Za-z0-9_./=+:@ -';
    const tagValue = cleanupTagValue(value);
    expect(tagValue).toEqual(value);
  });

  it('Illegal chars, returns replaced string', () => {
    const value = "apa$bepa(cepa)depa!epa?fepa'gepa";
    const tagValue = cleanupTagValue(value);
    expect(tagValue).toEqual('apa_bepa_cepa_depa_epa_fepa_gepa');
  });
});
