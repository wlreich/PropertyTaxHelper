import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureDatabase } from './projection.test.mjs';
import { seedHomeRegression } from './home-regression-fixture.mjs';
import { searchAddressQuery } from '../../web/src/lib/property-search.ts';

test('PAR-5: normalized input returns only eligible matches through both actual SQL functions', async () => {
  const db = await fixtureDatabase();
  try {
    await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
    await seedHomeRegression(db);
    await db.exec('set role anon');
    const result = async (q, suggestions = false) => (await db.query(
      suggestions ? 'select public.suggest_property_parcels($1,8,false) result' : 'select public.search_property_parcels_v2($1,0,false) result',
      [searchAddressQuery(q)],
    )).rows[0].result;
    for (const q of [
      '1104 Paw Print', '1104 Paw Print,', '1104 Paw Print Leander',
      '1104 Paw Print 78641', '1104 Paw Print Leander 78641',
      '1104 Paw Print, Leander, TX 78641', '1104 Paw Print Leander TX',
      '1104 Paw Print Leander Texas', '1104 Paw Print, Leander, Texas 78641', '736302',
    ]) for (const suggestions of [false, true]) {
      assert.deepEqual((await result(q, suggestions)).items.map(x=>x.property_id), ['736302'], `${q}: suggestions=${suggestions}`);
    }
    for (const q of ['1104 Paw Print, Houston, TX 77001', '1104 Paw Print Leander TX 99999', '1104 Paw Print Leander CA 78641', '1105 Paw Print Leander TX', '999999999']) {
      for (const suggestions of [false, true]) assert.deepEqual((await result(q,suggestions)).items, [], q);
    }
    for (const q of ['1905 West 36th Street Unit B', '1905 W 36 St #B']) {
      assert.deepEqual((await result(q)).items.map(x=>x.property_id), ['799047']);
    }
    const typo=await result('1104 Paw Prnit');
    assert.equal(typo.match_mode, 'possible');
    assert.deepEqual(typo.items.map(x=>x.property_id), ['736302']);
    assert.deepEqual((await result('123 Texas St')).items.map(x=>x.property_id), ['990100']);
  } finally { await db.close(); }
});
