import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureDatabase} from './projection.test.mjs';
import {seedAddressSearch} from './address-search-fixture.mjs';
test('address variants and guarded spelling suggestions run through the public RPC', async () => {
 const db=await fixtureDatabase();
 try {
  await db.exec("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
  await seedAddressSearch(db);
  await db.exec('set role anon');
  const search=async(q,page=0)=>(await db.query('select public.search_property_parcels_v2($1,$2,false) result',[q,page])).rows[0].result;
  const suggest=async(q,limit=8,all=false)=>(await db.query('select public.suggest_property_parcels($1,$2,$3) result',[q,limit,all])).rows[0].result;
  const broadSuggestions=await suggest('1104');
  assert.equal(broadSuggestions.items.length,8);
  assert.equal(broadSuggestions.has_more,true);
  assert.ok(broadSuggestions.items.every(x=>x.address.startsWith('1104 ')));
  assert.deepEqual((await suggest('1104 Cedar')).items.map(x=>x.property_id),['990016']);
  assert.ok((await suggest('1800 36')).items.some(x=>x.property_id==='990000'));
  for(const q of ['1800 West 36th Street','1800 W 36 ST','1800 W 36th St.']) {
   const r=await search(q); assert.equal(r.match_mode,'standard');
   assert.deepEqual(r.items.map(x=>x.property_id),['990000','990006','990007']);
  }
  for(const q of ['W 36 ST','West 36th Street','36th Street']) assert.ok((await search(q)).items.some(x=>x.property_id==='990000'));
  assert.deepEqual((await search('300 TESTING Street')).items.map(x=>x.property_id),['990008']);
  assert.ok(!(await search('1800 W 36th Street')).items.some(x=>['990001','990002','990003','990004','990005'].includes(x.property_id)));
  for(const q of ['700 Paw Prnit Drive Apt 2','700 Paw Prnit Dr #2','Paw Prnit']) {
   const r=await search(q); assert.equal(r.match_mode,'possible'); assert.ok(r.items.length<=5);
   assert.ok(r.items.some(x=>x.property_id==='990010'));
   if(q.startsWith('700')) assert.deepEqual(r.items.map(x=>x.property_id),['990010']);
  }
  assert.equal((await search('700 Paw Print Drive Unit 2')).match_mode,'standard');
  assert.equal((await search('700 Paw Prnit Drive Unit 4')).items.length,0);
  assert.equal((await search('702 Paw Prnit Drive Unit 2')).items.length,0);
  assert.equal((await search('700 Pwa Prnit Drive')).items.length,0);
  assert.equal((await search('700 Paw Prnit Drive',1)).items.length,0);
  assert.equal((await search('000990000')).items[0].property_id,'990000');
  assert.ok(!(await search('36th Street')).items.some(x=>x.property_id==='990013'));
  assert.equal((await search('123 Secret')).items.length,0);
 } finally {await db.close();}
});
