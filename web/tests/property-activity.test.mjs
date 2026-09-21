import test from 'node:test';
import assert from 'node:assert/strict';
import {parseActivity,activityRows,activityCsv,activityKey} from '../src/lib/property-activity.ts';
import {activityViewFixture} from '../../tools/property-search/activity-view-fixture.mjs';
test('activity contract rejects misleading prices, dates and duplicate events; strips extras',()=>{
 const raw=activityViewFixture();raw.rows[0].owner_name='PRIVATE';const data=parseActivity(raw);assert.ok(data);assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
 assert.equal(data.rows.length,7);assert.equal(new Set(data.rows.map(r=>r.property_id)).size,6);
 for(const change of [r=>{r.rows[0].price=0;},r=>{r.rows[1].price=null;},r=>{r.rows[0].deed_date='2026-12-31';r.rows[0].activity_date='2026-12-31';},r=>{r.rows.push(r.rows[0]);},r=>{r.rows[2].sale_date=null;},r=>{r.rows[0].deed_source=null;},r=>{r.rows[0].activity_date='2026-02-30';}]){const bad=activityViewFixture();change(bad);assert.equal(parseActivity(bad),null);}
 assert.equal(parseActivity({status:'unavailable'}),null);assert.deepEqual(parseActivity(activityViewFixture('9204')).rows,[]);
 assert.equal(activityRows(data,'land','newest').length,1);assert.equal(activityRows(data,'all','oldest')[0].activity_date,'2026-05-25');
});
test('shortlist keeps only selections, price caveats and provenance; neutralizes spreadsheet formulas',()=>{
 const data=parseActivity(activityViewFixture());data.rows[0].address='=SUM(1,2)';data.rows[0].city='Town, \"North\"';
 const csv=activityCsv(data,new Set([activityKey(data.rows[0]),activityKey(data.rows[3])]));
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=SUM(1,2)\""));assert.ok(csv.includes('"Town, ""North"""'));
 assert.ok(csv.includes('Sale unconfirmed'));assert.ok(csv.includes('Not allocated to this property'));assert.ok(csv.includes('2026-07-18'));assert.ok(csv.includes('2026-08-27'));assert.ok(csv.includes('Confirm whether this was an arm’s-length sale'));
 assert.ok(!csv.includes('650000'));assert.equal(csv.split('\r\n').filter(Boolean).length,3);
});

test('activity loader omits an absent optional year from GET RPC parameters',async()=>{
 const {getPropertyActivity}=await import('../src/lib/supabase/property-activity.ts');
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY,fetch:globalThis.fetch};
 process.env.SUPABASE_URL='http://127.0.0.1:4055';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';
 try{
  globalThis.fetch=async input=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   assert.notEqual(url.searchParams.get('p_year'),'null');
   return new Response(JSON.stringify(activityViewFixture('100',url.searchParams.get('p_year'))),{status:200,headers:{'Content-Type':'application/json'}});
  };
  assert.equal((await getPropertyActivity('100')).year,2026);
  assert.equal((await getPropertyActivity('100',2025)).year,2025);
 }finally{
  if(previous.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previous.url;
  if(previous.key===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=previous.key;
  globalThis.fetch=previous.fetch;
 }
});

import {defaultEvidenceWindow,readEvidenceWindow,evidenceWindowError,windowActivity,evidenceCoverage} from '../src/lib/evidence-window.ts';
import {activityWindowCsv} from '../src/lib/property-activity.ts';
import {comparisonEvidence} from '../src/lib/comparison-evidence.ts';
test('PAR-32 shared windows validate boundaries and distinguish future, missing and failed coverage',()=>{
 assert.deepEqual(defaultEvidenceWindow(2027),{targetYear:2027,start:'2026-01-01',end:'2026-12-31'});
 assert.equal(readEvidenceWindow({activityYear:'2025'},2027).window.targetYear,2026);
 for(const query of [{targetYear:['2027']},{targetYear:'x'},{targetYear:'1900'},{evidenceStart:'2026-02-30'},{evidenceStart:'2026-06-02',evidenceEnd:'2026-06-01'},{evidenceStart:'2020-01-01',evidenceEnd:'2026-12-31'}])assert.ok(readEvidenceWindow(query,2027).error);
 const window=defaultEvidenceWindow(2027),data=parseActivity(activityViewFixture());assert.equal(evidenceWindowError(window),null);
 assert.match(evidenceCoverage(windowActivity(window,[data],[2026])),/2026-08-27 \(later dates are not covered\)/);
 const unavailable=windowActivity(defaultEvidenceWindow(2026),[],[2026]);assert.deepEqual(unavailable.missingYears,[2025]);assert.match(evidenceCoverage(unavailable),/Coverage unavailable for 2025/);
 assert.match(evidenceCoverage(windowActivity(window,[],[2026],[2026])),/temporarily unavailable/);
});
test('PAR-32 inclusive date boundaries, distinct deed/sale dates, deduplication and export/clue parity',()=>{
 const data=parseActivity(activityViewFixture());
 data.rows=[{...data.rows[0],event_key:'jan',deed_date:'2026-01-01',activity_date:'2026-01-01'},
 {...data.rows[1],event_key:'dec',deed_date:'2026-12-31',sale_date:'2026-12-30',activity_date:'2026-12-31'},
 {...data.rows[1],event_key:'mismatch',deed_date:'2026-07-01',sale_date:'2026-06-30',activity_date:'2026-07-01'}];
 data.sources={appraisal_export_date:'2027-01-10',sales_export_date:'2027-01-10'};
 const all=windowActivity(defaultEvidenceWindow(2027),[data,data],[2026]);assert.equal(all.rows.length,3);assert.ok(all.rows.some(r=>r.deed_date==='2026-01-01'));assert.ok(all.rows.some(r=>r.deed_date==='2026-12-31'));
 const window={targetYear:2027,start:'2026-06-01',end:'2026-06-30'},narrow=windowActivity(window,[data],[2026]);assert.equal(narrow.rows.length,1);
 assert.equal(comparisonEvidence(narrow,'120',window).deedDate,null,'outside-window deed must not become a clue');assert.equal(comparisonEvidence(all,'120',all.window).deedDate,'2026-12-31');
 const csv=activityWindowCsv(narrow,new Set(narrow.rows.map(activityKey)),'land','oldest');for(const text of ['2027','2026-06-01','2026-06-30','2026-07-01','2027-01-10','Evidence start','Target appraisal year','Single-family homes','Land only','Retained outside filter','Yes'])assert.ok(csv.includes(text));assert.equal(csv.split('\r\n').filter(Boolean).length,2);
});
test('PAR-32 loader requests only published years and preserves missing coverage',async()=>{
 const {getWindowActivity}=await import('../src/lib/supabase/property-activity.ts');
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY,fetch:globalThis.fetch};process.env.SUPABASE_URL='http://127.0.0.1:4055';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';const calls=[];
 try{globalThis.fetch=async input=>{const url=new URL(input);calls.push(url.searchParams.get('p_year'));const raw=activityViewFixture('100',url.searchParams.get('p_year'));raw.years=[2026];return new Response(JSON.stringify(raw),{status:200});};
 const prior=await getWindowActivity('100',defaultEvidenceWindow(2026));assert.deepEqual(prior.missingYears,[2025]);assert.equal(prior.rows.length,0);assert.deepEqual(calls,[null]);calls.length=0;
 assert.equal((await getWindowActivity('100',defaultEvidenceWindow(2027))).rows.length,7);assert.deepEqual(calls,[null]);
 }finally{globalThis.fetch=previous.fetch;for(const [key,value] of [['SUPABASE_URL',previous.url],['SUPABASE_PUBLISHABLE_KEY',previous.key]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

test('PAR-32 comparison loads share annual data after resolving active neighborhoods',async()=>{
 const {getComparisonActivities}=await import('../src/lib/supabase/property-activity.ts');
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY,fetch:globalThis.fetch};process.env.SUPABASE_URL='http://127.0.0.1:4055';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';const calls=[];
 try{globalThis.fetch=async input=>{const url=new URL(input);calls.push(url.searchParams.get('p_year'));const raw=activityViewFixture('100',url.searchParams.get('p_year'));raw.years=[2025,2026];return new Response(JSON.stringify(raw),{status:200});};
 const records=await getComparisonActivities(['100','120'],defaultEvidenceWindow(2026));assert.equal(records.size,2);assert.strictEqual(records.get('100'),records.get('120'));assert.equal(records.get('100').datasets[0].year,2025);assert.deepEqual(calls,[null,null,'2025']);
 }finally{globalThis.fetch=previous.fetch;for(const [key,value] of [['SUPABASE_URL',previous.url],['SUPABASE_PUBLISHABLE_KEY',previous.key]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
