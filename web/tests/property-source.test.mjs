import test from 'node:test';
import assert from 'node:assert/strict';
import { propertySource } from '../src/lib/property-source.ts';

test('parcel links retain ID/year and archive labels describe their own dated release', () => {
  for (const year of [2025, 2026]) {
    const p = {property_id:'736302',tax_year:year,roll_stage:'certified',export_time_raw:`07/18/${year} 16:27`,source_url:`https://traviscad.org/export-${year}.zip`};
    const source = propertySource(p);
    assert.equal(source.parcelHref, `https://travis.prodigycad.com/property-detail/736302/${year}`);
    assert.equal(source.downloadHref, p.source_url);
    assert.equal(source.downloadLabel, 'Download source appraisal export (ZIP)');
    assert.equal(source.description, `${year} certified countywide appraisal export · Jul 18, ${year}`);
  }
  const missing = propertySource({property_id:'100',tax_year:2026,roll_stage:'preliminary',export_time_raw:null,source_url:'https://traviscad.org/publicinformation'});
  assert.equal(missing.downloadLabel, 'View source appraisal export');
  assert.match(missing.description, /Export date not reported/);
});
