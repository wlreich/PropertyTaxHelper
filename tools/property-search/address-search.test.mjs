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

test('indexed numeric searches preserve release isolation, boundaries and pagination in pooled plans', async () => {
 const db=await fixtureDatabase();
 try {
  await db.exec("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
  await seedAddressSearch(db);
  const add=async(id,address,extra={})=>db.query(`insert into public.property_search_documents
   select (jsonb_populate_record(null::public.property_search_documents,to_jsonb(d)||$1::jsonb)).*
   from public.property_search_documents d where property_id='100'`,
   [JSON.stringify({property_id:id,address,search_text:`${address} FIXTURE CITY 78700`,...extra})]);
  await add('1104','1104 EXACT ST',{is_parkland:true});
  await add('991001','11040 WRONG ST');
  await add('991002','1104A WRONG ST');
  await add('991003','1104 PARK ST',{is_parkland:true});
  for(let i=0;i<42;i++) await add(String(992000+i),`2500 PAGE ${String(i).padStart(2,'0')} ST`);
  const hidden='22222222-2222-4222-8222-222222222222';
  await db.query(`insert into public.property_releases(dataset_id,tax_year,roll_stage,source_url)
   values($1,2025,'preliminary','https://traviscad.org/fixture')`,[hidden]);
  await add('993000','1104 HIDDEN ST',{dataset_id:hidden});
  for(const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}; set plan_cache_mode=force_generic_plan`);
   const search=async(q,page=0)=>(await db.query('select public.search_property_parcels_v2($1,$2,false) result',[q,page])).rows[0].result;
   const suggest=async(q,all=false)=>(await db.query('select public.suggest_property_parcels($1,8,$2) result',[q,all])).rows[0].result;
   for(const run of [search,suggest]) {
    // Exact ID stays first even for parkland, with no duplicate address match.
    const result=await run('1104');
    const ids=result.items.map(x=>x.property_id);
    assert.equal(ids[0],'1104');
    assert.equal(ids.filter(x=>x==='1104').length,1);
    assert.ok(!ids.some(x=>['991001','991002','991003','993000'].includes(x)));
    assert.equal((await run('993000')).items.length,0);
    assert.equal((await run('1104 Hidden')).items.length,0);
    assert.equal((await run('0001104')).items[0].property_id,'1104');
   }
   assert.ok((await suggest('1104 Park',true)).items.some(x=>x.property_id==='991003'));
   const pages=await Promise.all([0,1,2].map(page=>search('2500 Page',page)));
   assert.deepEqual(pages.map(x=>x.items.length),[20,20,2]);
   assert.deepEqual(pages.map(x=>x.has_more),[true,true,false]);
   assert.equal(new Set(pages.flatMap(x=>x.items.map(y=>y.property_id))).size,42);
   await db.exec('reset role');
  }
 } finally {await db.close();}
});
