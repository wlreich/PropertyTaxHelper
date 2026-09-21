import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonSummary,matchProperty,suggestions,selectedIds,candidatePool,candidatePage} from '../src/lib/property-comparisons.ts';
import {snapshotLabel} from '../src/lib/property-history.ts';
import {comparisonEvidence} from '../src/lib/comparison-evidence.ts';
import {getComparisons,parseComparison} from '../src/lib/supabase/comparisons.ts';
const base={property_id:'100',address:'SUBJECT',city:'CITY',property_type:'R',market_value:1285275,land_value:100000,land_acres:1,living_area:4410,class_code:'R3',year_built:2014,neighborhood:'T2450',main_buildings:1};
const comp=(id,value,changes={})=>({...base,property_id:id,market_value:value,...changes});
test('median excludes subject and duplicates, handles odd/even, zero, missing and direction',()=>{
 const a=comp('101',1240000),b=comp('102',1310000),c=comp('103',1195000);
 const s=comparisonSummary(base,[base,a,a,b,c]);assert.equal(s.count,3);assert.equal(s.median,1240000);assert.equal(s.difference,45275);assert.equal(s.percent.toFixed(1),'3.7');
 assert.equal(comparisonSummary(base,[a,b]).median,1275000);
 assert.equal(comparisonSummary(base,[comp('1',1400000)]).difference,-114725);
 assert.equal(comparisonSummary(base,[comp('1',null)]).median,null);
 assert.equal(comparisonSummary(base,[]).difference,null);
 assert.equal(comparisonSummary(base,[comp('1',0)]).percent,null);
 assert.equal(comparisonSummary(base,[comp('1',0)]).median,0);
 assert.equal(comparisonSummary({...base,market_value:null},[a]).difference,null);
});
test('possible tiers use inclusive bounds without assuming missing condition, class steps or building facts',()=>{
 assert.equal(matchProperty(base,comp('1',1,{living_area:4454.1,year_built:2016})).tier,0);
 assert.equal(matchProperty(base,comp('1',1,{living_area:4454.2})).tier,1);
 assert.equal(matchProperty(base,comp('1',1,{living_area:4851,year_built:2024})).tier,2);
 for(const changes of [{living_area:null},{year_built:null},{class_code:null},{class_code:'R4'},{neighborhood:'OTHER'},{property_type:'B'}])assert.equal(matchProperty(base,comp('1',1,changes)).tier,null);
 const high=comp('2',2000000,{living_area:4410}),low=comp('1',100000,{living_area:4500});
 assert.equal(suggestions({subject:base,candidates:[low,high]})[0].property_id,'2');
 assert.deepEqual(selectedIds('0101,101,100,NaN,../x,0'),['101','100']);
});
test('invalid comparison requests do not reach database; response parser strips additional fields',async()=>{
 let calls=0;const f=async()=>{calls++;throw Error('unexpected');};
 for(const [id,source,ids,q,page] of [['x',null,[],'',0],['100','bad',[],'',0],['100',null,Array(11).fill('101'),'',0],['100',null,[],'a',0],['100',null,[],'',-1]])assert.equal((await getComparisons(id,source,ids,q,page,{},f)).status,'invalid');
 assert.equal(calls,0);
 const release={dataset_id:'11111111-1111-4111-8111-111111111111',tax_year:2026,roll_stage:'certified',export_date:'2026-07-18'};
 const raw={available:true,status:'ok',anchor_id:release.dataset_id,release,releases:[release],subject:{...base,owner_name:'PRIVATE'},candidates:[],selected:[],matches:[],candidate_limit_reached:false,search_has_more:false};
 const parsed=parseComparison(raw,'100');assert.ok(parsed);assert.equal('owner_name' in parsed.subject,false);
 assert.equal(parseComparison({...raw,subject:{...base,market_value:-1}},'100'),null);
 assert.equal(parseComparison({...raw,releases:[]},'100'),null);
});

test('failed cost projection never falls back to incomplete snapshot land',async()=>{
 const release={dataset_id:'11111111-1111-4111-8111-111111111111',tax_year:2026,roll_stage:'certified',export_date:'2026-07-18'};
 const raw={available:true,status:'ok',anchor_id:release.dataset_id,release,releases:[release],subject:base,candidates:[comp('120',400000)],selected:[comp('120',400000)],matches:[],candidate_limit_reached:false,search_has_more:false};
 const fetcher=async url=>new Response(JSON.stringify(new URL(String(url)).pathname.endsWith('/property_comparisons')?raw:null),{status:200});
 const result=await getComparisons('100',null,['120'],'',0,{SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},fetcher);
 assert.equal(result.status,'ok');
 assert.equal(result.data.subject.land_value,null);
 assert.equal(result.data.selected[0].land_value,null);
 assert.equal(result.data.candidates[0].land_value,null);
 assert.equal(result.data.selected[0].market_value,400000);
});


test('tier filtering uses the entire unique pool before sorting and pagination',()=>{
 const close=Array.from({length:23},(_,i)=>comp(String(200+i),500000+i));
 const wider=Array.from({length:12},(_,i)=>comp(String(300+i),400000+i,{living_area:4600}));
 const pool=candidatePool({subject:base,candidates:[base,...wider,...close,close[0],comp('999',null),comp('998',1,{class_code:'XX'})]});
 assert.equal(pool.length,35);
 assert.equal(matchProperty(base,pool[0]).tier,0);
 const page=candidatePage(base,pool,'1','value',0);
 assert.equal(page.total,12);assert.deepEqual(page.counts,[23,12,0,0,0,0,0,0]);
 assert.equal(page.items.length,10);assert.equal(page.items[0].property_id,'300');
 assert.equal(candidatePage(base,pool,'1','value',1).items.length,2);
 assert.equal(candidatePage(base,pool,'7','match',0).total,0);
 assert.equal(candidatePage(base,pool,'all','match',2).items[3].property_id,'300');
 const noClosest=candidatePool({subject:base,candidates:wider});
 assert.equal(matchProperty(base,noClosest[0]).tier,1);
 assert.equal(candidatePage(base,[],'all','match',0).total,0);
});

test('comparison deed clues use prior-year events, explicit coverage, and never infer prices',()=>{
 const data={year:2025,sources:{appraisal_export_date:'2026-07-18',sales_export_date:'2026-08-27'},rows:[{property_id:'120',deed_date:'2025-06-20',price:650000},{property_id:'120',deed_date:'2026-01-02',price:900000}]};
 const e=comparisonEvidence(data,'120',2026);
 assert.equal(e.deedDate,'2025-06-20');assert.equal(e.start,'2025-01-01');assert.equal(e.end,'2025-12-31');
 assert.match(e.coverage,/2026-07-18/);assert.match(e.coverage,/2026-08-27/);assert.equal('price' in e,false);
 assert.equal(comparisonEvidence(data,'121',2026).deedDate,null);
 assert.equal(comparisonEvidence(data,'120',2025).available,false);
 assert.equal(comparisonEvidence(null,'120',2026).available,false);
});

test('comparison parser preserves baseline/interim metadata for the shared history label',()=>{
 const release={dataset_id:'11111111-1111-4111-8111-111111111111',tax_year:2025,roll_stage:'preliminary',export_date:'2025-07-03',preliminary_baseline_eligible:false};
 const raw={available:true,status:'ok',anchor_id:release.dataset_id,release,releases:[release],subject:base,candidates:[],selected:[],matches:[],candidate_limit_reached:false,search_has_more:false};
 const parsed=parseComparison(raw,'100');
 assert.equal(snapshotLabel(parsed.release),'2025 interim snapshot');
 assert.equal(snapshotLabel(parsed.releases[0]),'2025 interim snapshot');
 assert.equal(snapshotLabel({...parsed.release,preliminary_baseline_eligible:true}),'2025 preliminary');
 assert.equal(snapshotLabel({tax_year:2026,roll_stage:'certified'}),'2026 certified');
 assert.equal(parseComparison({...raw,release:{...release,preliminary_baseline_eligible:'false'}},'100'),null);
});
