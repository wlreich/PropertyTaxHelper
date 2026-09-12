import {fixtureDatabase} from './projection.test.mjs';
import {seedComparisons} from './comparison-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
test('comparisons use one published source, preserve RLS, reject unsafe input and handle release switching',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
 const {anchor,old}=await seedComparisons(db);
 const call=async(source=null,ids=[],q='',page=0)=>(await db.query('select public.property_comparisons($1,$2,$3,$4,$5) result',['100',source,ids,q,page])).rows[0].result;
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  const r=await call();assert.equal(r.status,'ok');assert.equal(r.subject.living_area,2000);assert.equal(r.release.dataset_id,anchor);
  assert.equal(r.candidates.some(p=>['100','102','103'].includes(p.property_id)),false);
  assert.equal(r.candidates.find(p=>p.property_id==='120').market_value,400000);
  assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
  assert.equal((await db.query("select count(*)::int n from public.property_comparison_areas where property_id in ('102','103')")).rows[0].n,0);
  const historic=await call(old,['120','121']);assert.equal(historic.subject.market_value,420000);assert.equal(historic.selected.length,1);assert.equal(historic.selected[0].market_value,390000);
  assert.equal((await call('99999999-9999-4999-8999-999999999999')).status,'missing_snapshot');
  assert.equal((await call(null,[],'PINE')).matches[0].market_value,null);
  assert.equal((await call(null,['100','120','120','102','103'])).selected.length,1);
  assert.equal((await db.query("select public.property_comparisons('103') r")).rows[0].r.status,'missing_property');
  await assert.rejects(call(null,Array(11).fill('120')),/Invalid comparison/);
  await assert.rejects(call(null,[],'Oak',-1),/Invalid comparison/);
  await db.exec('reset role');
 }
 const mixed={components:[{code:'1ST',improvement_id:'1',area:1000,class_code:'R3',year_built:2014},{code:'1ST',improvement_id:'2',area:2000,class_code:'R3',year_built:2014}]};
 const fact=(await db.query("select public.property_comparison_item('1','A','C','R',$1) result",[mixed])).rows[0].result;
 assert.equal(fact.living_area,null);assert.equal(fact.class_code,null);
 // An inactive release remains inaccessible even when an ID is supplied explicitly.
 await db.exec('delete from public.property_search_state; set role anon');
 assert.equal((await call(anchor,['120'])).available,false);
 assert.equal((await db.query('select count(*)::int n from public.property_comparison_areas')).rows[0].n,0);
});

test('adjustment projection is bounded, source-specific, and hides private properties and fields',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
 const {anchor,old}=await seedComparisons(db);
 const cost=async(source=anchor,ids=['100','120','102','103'],active=anchor)=>(await db.query('select public.property_comparison_costs($1,$2,$3) r',[active,source,ids])).rows[0].r;
 await db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,'cost-details.txt',99,'100','2025',$2)`,[old,{imprv_id:'1',imprv_det_id:'extra',imprv_det_val:'13559',imprv_det_type_cd:'SPA',imprv_det_type_desc:'Spa'}]);
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  const r=await cost();assert.deepEqual(r.items.map(x=>x.property_id),['100','120']);
  assert.equal(r.items[0].improvements[0].main_value,350000);
  assert.equal(r.items[0].improvements[0].complete,true);
  assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(r).includes('SPA'),false);
  assert.ok(JSON.stringify(await cost(old)).includes('SPA'));
  assert.equal((await cost(old,['121'])).items.length,0);
  assert.equal((await cost(anchor,['120'],old)).items.length,0);
  await assert.rejects(cost(anchor,Array(33).fill('100')),/Invalid adjustment/);
  await assert.rejects(cost(anchor,['100 or 1=1']),/Invalid adjustment/);
  await assert.rejects(db.query('select * from tcad_ingest.records limit 1'),/permission denied/);
  await db.exec('reset role');
 }
 await db.query("update tcad_ingest.datasets set status='loading' where id=$1",[old]);
 await db.exec('set role anon');assert.equal((await cost(old)).items.length,0);await db.exec('reset role');
 await db.exec('delete from public.property_search_state; set role anon');
 assert.equal((await cost()).items.length,0);
});
