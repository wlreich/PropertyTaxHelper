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
});
