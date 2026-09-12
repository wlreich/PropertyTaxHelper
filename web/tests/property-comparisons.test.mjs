import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonSummary,matchProperty,suggestions,selectedIds} from '../src/lib/property-comparisons.ts';
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
