import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMarketAdjustment} from '../src/lib/market-adjustments.ts';
import {parseProperty} from '../src/lib/supabase/properties.ts';
import {buildPropertyReport,reportRowParts} from '../src/lib/property-report.ts';
import {parseHistory,parseProtestObservations} from '../src/lib/property-history.ts';
import {par28Fixture} from '../../tools/property-search/par28-fixture.mjs';
const input=id=>{const r=par28Fixture(id),p=parseProperty(r.overview.profile,id);assert.equal(p.status,'ok');return {property:p.data,snapshots:parseHistory(r.overview.history),protests:parseProtestObservations(r.overview.history),adjustment:parseMarketAdjustment(r.adjustment),reportDate:'2026-09-21'};};
const rows=r=>r.sections.flatMap(s=>s.blocks.flatMap(b=>b.kind==='table'?b.rows:[]));
test('report reuses normalized synthetic outcome, cap, inventory and provenance',()=>{
 const r=buildPropertyReport(input('999283')),text=JSON.stringify(r);assert.equal(r.releaseLabel,'2026 certified');
 for(const token of ['$950,000','$200,000','−$50,000','$1,045,000','+$120,000','2025 interim snapshot','Not proof of physical removal'])assert.ok(text.includes(token),token);
 assert.equal(rows(r).filter(x=>x.id.startsWith('feature-')&&!x.id.startsWith('feature-change-')).length,11);
 assert.equal(rows(r).filter(x=>x.id.startsWith('history-')).length,2);
 assert.equal(rows(r).filter(x=>x.id.startsWith('authority-')).length,5);
 const missing=buildPropertyReport({...input('999283'),release:'missing'});assert.equal(missing,null);
 const prior=buildPropertyReport({...input('999283'),release:input('999283').snapshots.find(s=>s.tax_year===2025&&s.roll_stage==='certified').dataset_id});assert.equal(prior.year,2025);assert.equal(rows(prior).filter(x=>x.id.startsWith('history-')).length,1);
});
test('dense inventory and all available years survive without clipping or a five-year limit',()=>{
 const dense=buildPropertyReport(input('999280')),long=buildPropertyReport(input('999281'));
 assert.equal(rows(dense).filter(x=>/^feature-\d/.test(x.id)).length,26);
 const history=rows(long).filter(x=>x.id.startsWith('history-'));assert.equal(history.length,26);assert.equal(new Set(history.map(x=>x.id)).size,26);assert.ok(!history.some(x=>x.id==='history-2010'));
 assert.equal(history.find(x=>x.id==='history-2018').cells[4],'Not available');
 const pieces=reportRowParts({id:'long',cells:['L'.repeat(1600),'$1'],note:'N'.repeat(3000)});
 assert.ok(pieces.length>1);assert.ok(pieces.every(p=>p.cells[0].length<=240));assert.equal(pieces.map(p=>p.cells[0]).join(''),'L'.repeat(1600));assert.equal(pieces.map(p=>p.note??'').join(''),'N'.repeat(3000));
});
test('sparse and withheld records never acquire a certified outcome, cap ceiling or neighborhood median',()=>{
 const sparse=buildPropertyReport(input('999282'));assert.ok(sparse.compact);assert.equal(sparse.stage,'preliminary');assert.doesNotMatch(JSON.stringify(sparse),/Conditional 10% ceiling/);
 const i=input('999283');i.property.values_under_review=true;i.property.market_value=null;i.property.assessed_value=null;i.property.land_value=null;i.property.improvement_value=null;
 const r=buildPropertyReport(i);assert.ok(JSON.stringify(r).includes('Values need further review'));assert.ok(!JSON.stringify(r).includes('$950,000'));
 assert.equal(buildPropertyReport({...i,release:i.snapshots[0].dataset_id}),null);
});

test('historical reports exclude later-year and later-release protest observations',()=>{
 const i=input('999283'),prior=i.snapshots.find(s=>s.tax_year===2025&&s.roll_stage==='certified');
 const observation={dataset_id:'future-protest',tax_year:2025,export_date:'2025-12-31',export_time_raw:null,protest_flag:true,arb_case_listed:false,arb_agent_listed:true,arb_agent_name:'Future-only agent',arb_status_codes:[]};
 const baseline=buildPropertyReport({...i,release:prior.dataset_id,protests:[]});
 const actual=buildPropertyReport({...i,release:prior.dataset_id,protests:[observation,{...observation,dataset_id:'next-year',tax_year:2026}]});
 assert.deepEqual(actual,baseline);
});
