import {fixtureDatabase} from './projection.test.mjs';
import {seedComparisons} from './comparison-fixture.mjs';
import {seedNeighborhood} from './neighborhood-fixture.mjs';
import {parseNeighborhood} from '../../web/src/lib/supabase/neighborhood.ts';
import {neighborhoodSummary} from '../../web/src/lib/neighborhood.ts';
import {parseNeighborhoodAnalysis} from '../../web/src/lib/supabase/neighborhood-analysis.ts';
import {neighborhoodAnalysis} from '../../web/src/lib/neighborhood-analysis.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
test('annual contract preserves population/RLS, canonical stages, chronology and validates payloads',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 const anchor='11111111-1111-4111-8111-111111111111';
 await db.query('select tcad_ingest.publish_property_search($1)',[anchor]);
 const {old}=await seedComparisons(db);const {pre}=await seedNeighborhood(db);
 const oldPre='55555555-5555-4555-8555-555555555555';
 await db.query(`insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,completed_at)
  select $1,repeat('5',64),layout_sha256,parser_version,source_encoding,2025,'preliminary',source_url,archive_location,header,status,completed_at from tcad_ingest.datasets where id=$2`,[oldPre,old]);
 await db.query(`insert into public.property_snapshot_profiles select anchor_dataset_id,$1::uuid,property_id,snapshot||jsonb_build_object('dataset_id',$1::text,'roll_stage','preliminary','export_date','2025-04-02','market_value',600000) from public.property_snapshot_profiles where anchor_dataset_id=$2 and dataset_id=$3`,[oldPre,anchor,old]);
 await db.query(`update public.property_snapshot_profiles set snapshot=snapshot||'{"preliminary_baseline_eligible":false}'::jsonb where dataset_id=$1 and property_id='120'`,[oldPre]);
 const sameDate='66666666-6666-4666-8666-666666666666';
 await db.query(`update public.property_snapshot_profiles set snapshot=snapshot||'{"arb_agent_listed":true}'::jsonb
  where dataset_id in ($1,$2) and property_id='100' or dataset_id=$2 and property_id in ('120','121')`,[pre,anchor]);
 await db.query(`insert into public.property_protest_observations(anchor_dataset_id,dataset_id,property_id,tax_year,export_date,protest_flag,arb_case_listed,arb_agent_listed)
  values($1,$2,'120',2026,'2026-07-18',true,true,true),($1,$2,'121',2026,'2026-07-18',true,true,true)`,[anchor,sameDate]);
 await db.query(`insert into public.property_agent_names(anchor_dataset_id,dataset_id,property_id,tax_year,agent_name) values
  ($1,$2,'100',2026,'EARLY AGENT'),($1,$1,'100',2026,'LATEST AGENT'),
  ($1,$1,'120',2026,'CONFLICT ONE'),($1,$3,'120',2026,'CONFLICT TWO'),
  ($1,$1,'121',2026,'ALPHA TAX'),($1,$3,'121',2026,'Alpha-Tax')`,[anchor,pre,sameDate]);
 await db.exec('set role anon');
 const call=async(phase=null,year=null,subject='100')=>(await db.query('select public.property_neighborhood_analysis($1,$2,$3) r',[subject,phase,year])).rows[0].r;
 const raw=await call('post',2026),parsed=parseNeighborhoodAnalysis(raw,'100');assert.ok(parsed);
 assert.deepEqual(parsed.agent_assignments.find(x=>x.property_id==='100'),{property_id:'100',tax_year:2026,agent_name:'LATEST AGENT',status:'named'});
 assert.deepEqual(parsed.agent_assignments.find(x=>x.property_id==='120'),{property_id:'120',tax_year:2026,agent_name:null,status:'ambiguous'});
 assert.equal(parsed.agent_assignments.find(x=>x.property_id==='121').status,'named');
 assert.match(parsed.agent_assignments.find(x=>x.property_id==='121').agent_name,/alpha.?tax/i);
 const legacy=parseNeighborhood((await db.query("select public.property_neighborhood_v4('100') r")).rows[0].r,'100');
 assert.deepEqual(parsed.homes,legacy.homes);assert.deepEqual(parsed.population,legacy.population);assert.deepEqual(parsed.market_adjustment,legacy.market_adjustment);
 const analysis=neighborhoodAnalysis(parsed);assert.equal(analysis.current.dataset_id,anchor);assert.equal(analysis.latestOutcome.certified.tax_year,2026);
 assert.equal(analysis.coverage.find(c=>c.release.dataset_id===oldPre).exclusions.baseline_ineligible,1);
 const conflicted=parseNeighborhoodAnalysis(await call('post',2026,'120'),'120');assert.ok(conflicted);
 assert.deepEqual(conflicted.annual_periods,parsed.annual_periods);
 assert.deepEqual(neighborhoodAnalysis(conflicted).carryForward,analysis.carryForward);
 // Parcel 121 has current data but no 2025 profiles; neighbors still supply history.
 const noHistory=parseNeighborhoodAnalysis(await call('post',2026,'121'),'121');assert.ok(noHistory);
 assert.deepEqual(noHistory.annual_periods,parsed.annual_periods);
 assert.deepEqual(neighborhoodAnalysis(noHistory).carryForward,analysis.carryForward);
 assert.deepEqual(neighborhoodAnalysis(noHistory).certifiedChanges,analysis.certifiedChanges);
 assert.equal((await db.query('select parcel_comparison.preliminary_release_eligible($1,$2,$3) eligible',[anchor,oldPre,'103'])).rows[0].eligible,false);
 assert.ok(analysis.carryForward.length);assert.equal(JSON.stringify(raw).includes('PRIVATE'),false);
 for(const phase of ['preliminary','protest']){
  const early=parseNeighborhoodAnalysis(await call(phase,2026),'100');assert.ok(early);assert.equal(early.source_id,pre);
  assert.equal(early.annual_periods.some(p=>p.release.tax_year===2026&&p.release.roll_stage==='certified'),false);
  assert.equal(neighborhoodAnalysis(early).latestOutcome.certified.tax_year,2025);
  assert.deepEqual(neighborhoodAnalysis(early).agentActivity.map(x=>x.certified.tax_year),[2025]);
 }
 assert.equal(parseNeighborhoodAnalysis(await call('preliminary',2027),'100').source_id,anchor); // Data lags season: honest certified fallback.
 const bad=structuredClone(raw);bad.annual_periods[0].homes.push(bad.annual_periods[0].homes[0]);assert.equal(parseNeighborhoodAnalysis(bad,'100'),null);
 const duplicateAgent=structuredClone(raw);duplicateAgent.agent_assignments.push(duplicateAgent.agent_assignments[0]);assert.equal(parseNeighborhoodAnalysis(duplicateAgent,'100'),null);
 const malformedAgent=structuredClone(raw);malformedAgent.agent_assignments[0].status='named';malformedAgent.agent_assignments[0].agent_name=null;assert.equal(parseNeighborhoodAnalysis(malformedAgent,'100'),null);
 const future=structuredClone(raw);future.annual_periods[0].release.tax_year=2029;assert.equal(parseNeighborhoodAnalysis(future,'100'),null);
 assert.equal((await db.query("select public.property_neighborhood_analysis('103') r")).rows[0].r.status,'missing_property');
 await assert.rejects(db.query('select * from tcad_ingest.records limit 1'));
 await assert.rejects(call('invalid',2026));
 await db.exec('reset role');
 await db.query('update tcad_ingest.datasets set preliminary_baseline_excluded=true where id=$1',[oldPre]);
 await db.exec('set role anon');
 assert.equal(parseNeighborhoodAnalysis(await call(),'100').annual_periods.some(p=>p.release.dataset_id===oldPre),false);
 await db.exec('reset role');
 await db.query('delete from public.property_snapshot_profiles where dataset_id=$1',[oldPre]);
 await db.exec('set role anon');
 const missing=neighborhoodAnalysis(parseNeighborhoodAnalysis(await call(),'100'));
 assert.equal(missing.carryForward.length,0);assert.equal(missing.preliminaryChanges.length,0);
 assert.deepEqual(missing.agentActivity.map(x=>x.certified.tax_year),[2026]);
});
test('conflicting preliminary values are excluded per home without removing homes or protest evidence',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 await db.query('select tcad_ingest.publish_property_search($1)',['11111111-1111-4111-8111-111111111111']);
 await seedComparisons(db);const {pre}=await seedNeighborhood(db);
 await db.query(`update public.property_snapshot_profiles set snapshot=snapshot||'{"preliminary_baseline_eligible":false}'::jsonb where dataset_id=$1 and property_id='120'`,[pre]);
 await db.exec('set role anon');
 const data=parseNeighborhood((await db.query("select public.property_neighborhood_v3('100') r")).rows[0].r,'100');
 assert.ok(data);
 const home=data.homes.find(h=>h.property_id==='120');
 assert.ok(home);assert.equal(home.preliminary,null);assert.equal(home.protested,true);assert.ok(home.certified>0);
 const summary=neighborhoodSummary(data);
 assert.equal(summary.all.reduced.total,2);assert.equal(summary.all.reduced.count,1);
 const conflicted=parseNeighborhoodAnalysis((await db.query("select public.property_neighborhood_analysis('120','preliminary',2026) r")).rows[0].r,'120');assert.ok(conflicted);
 assert.equal(conflicted.source_id,pre);
 assert.ok(conflicted.annual_periods.some(p=>p.release.dataset_id===pre));
 assert.equal(summary.all.above.total,2);assert.equal(summary.all.missingPair,data.homes.length-2);
});
test('neighborhood releases, cap outcomes, protest deduplication, and public visibility',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());await db.query('select tcad_ingest.publish_property_search($1)',['11111111-1111-4111-8111-111111111111']);const {old}=await seedComparisons(db);const {anchor,pre}=await seedNeighborhood(db);
 await db.exec('set role anon');
 const call=async(source=null)=>(await db.query('select public.property_neighborhood_v3($1,$2) r',['100',source])).rows[0].r;
 const raw=await call();const data=parseNeighborhood(raw,'100');assert.ok(data);
 assert.equal(data.subdivision,'GRAND MESA SECTION II');
 assert.equal(data.homes.some(h=>h.property_id==='102'||h.property_id==='103'),false);
 assert.equal(JSON.stringify(raw).includes('PRIVATE'),false);
 const s=neighborhoodSummary(data);
 assert.equal(s.all.above.count,2);assert.equal(s.all.above.total,3);
 assert.equal(s.all.reduced.count,2);assert.equal(s.all.reduced.total,3);
 assert.equal(s.all.crossed.count,1);assert.equal(s.all.crossed.total,2);
 assert.equal(s.own.dollars,50000);assert.equal(s.own.percent,10);
 assert.equal(s.protested.count,2);
 assert.equal(data.homes.find(h=>h.property_id==='120').protested,true); // Flag-only informal evidence counts despite a clean certified snapshot.
 assert.equal(data.homes.find(h=>h.property_id==='121').protested,false); // Agent assignment alone does not.
 assert.equal(s.protested.reduced.count,2);assert.equal(s.other.reduced.count,0);
 assert.equal(s.all.averageReduction,125000);
 assert.ok(s.entities.some(e=>e.code==='70'&&!e.applies));
 const early=parseNeighborhood(await call(pre),'100');assert.equal(early.certified_id,null);assert.equal(neighborhoodSummary(early).own,null);
 const historical=parseNeighborhood(await call(old),'100');assert.equal(historical.preliminary_id,null);assert.equal(neighborhoodSummary(historical).protested.count,0);
 assert.equal((await db.query("select public.property_neighborhood_v3('103') r")).rows[0].r.status,'missing_property');
 assert.equal((await db.query('select parcel_comparison.cap_inputs($1,$2,$3) r',[old,pre,['100']])).rows[0].r.length,0);
 await assert.rejects(db.query('select * from tcad_ingest.records limit 1'));
});
test('population v2 separates land-only and other types, retains mixed land coding, and sums residential buildings',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 await db.query('select tcad_ingest.publish_property_search($1)',['11111111-1111-4111-8111-111111111111']);
 const {old}=await seedComparisons(db);const {anchor,pre}=await seedNeighborhood(db);
 await db.query(`update public.property_snapshot_profiles set snapshot=snapshot||'{"improvement_value":0}'::jsonb where dataset_id=$1 and property_id='122'`,[anchor]);
 await db.query(`update tcad_ingest.records set fields=fields||'{"imprv_state_cd":"A4"}'::jsonb where dataset_id=$1 and prop_id='121' and member_name='neighborhood-types.txt'`,[anchor]);
 await db.query(`update tcad_ingest.records set fields=fields||'{"land_state_cd":"C1"}'::jsonb where dataset_id=$1 and prop_id='120' and member_name='neighborhood-types.txt'`,[anchor]);
 const additions=[{id:'2',improvement_id:'2',code:'1ST',class_code:'R3',area:500,value:50000},{id:'3',improvement_id:'3',code:'1ST',class_code:'R3',area:900,value:0}];
 await db.query(`update public.property_snapshot_profiles set snapshot=jsonb_set(snapshot,'{components}',(snapshot->'components')||$2::jsonb) where dataset_id=$1 and property_id='120'`,[anchor,JSON.stringify(additions)]);
 await db.exec('set role anon');
 const call=async(source=null)=>(await db.query('select public.property_neighborhood_v3($1,$2) r',['100',source])).rows[0].r;
 const raw=await call(),data=parseNeighborhood(raw,'100');assert.ok(data);
 assert.equal(data.homes.length,3);
 assert.equal(data.population.candidate_count,6);
 assert.deepEqual(data.population.excluded,[{property_id:'121',reason:'other_type'},{property_id:'122',reason:'land_only'},{property_id:'123',reason:'unverified_improvements'}]);
 assert.equal(data.population.land_code_mismatch,1);assert.equal(data.population.multiple_buildings,1);
 const mixed=data.homes.find(h=>h.property_id==='120');assert.equal(mixed.area,2500);assert.equal(mixed.certified_area,2500);
 assert.equal(data.caps.some(c=>c.property_id==='121'),false);
 const summary=neighborhoodSummary(data);assert.equal(summary.all.shares.above.total,3);assert.equal(summary.all.shares.reduced.total,3);assert.equal(summary.all.shares.crossed.total,3);
 assert.equal(JSON.stringify(raw).includes('PRIVATE'),false);
 assert.equal(parseNeighborhood({...raw,population:{...raw.population,candidate_count:99}},'100'),null);
 assert.equal(parseNeighborhood({...raw,population:{...raw.population,excluded:[{property_id:'100',reason:'land_only'}]}},'100'),null);
 const early=parseNeighborhood(await call(pre),'100');assert.ok(early.homes.some(h=>h.property_id==='121'));
 assert.ok(parseNeighborhood(await call(old),'100').homes.some(h=>h.property_id==='120'));
 assert.deepEqual((await db.query('select parcel_comparison.neighborhood_types($1,$2,$3) r',[old,anchor,['100']])).rows[0].r,[]);
 assert.deepEqual((await db.query('select parcel_comparison.neighborhood_types($1,$2,$3) r',[anchor,anchor,['102','103']])).rows[0].r,[]);
 await assert.rejects(db.query('select parcel_comparison.neighborhood_types($1,$2,$3)',[anchor,anchor,['bad-id']]));
 await assert.rejects(db.query('select * from tcad_ingest.records limit 1'));
 const area=async components=>(await db.query('select public.neighborhood_floor_area($1) r',[{components}])).rows[0].r.area;
 assert.equal(await area([{code:'1ST',class_code:'R3',improvement_id:'1',area:100,value:null}]),null);
 assert.equal(await area([{code:'1ST',class_code:'R3',improvement_id:'1',area:null,value:100}]),null);
});
