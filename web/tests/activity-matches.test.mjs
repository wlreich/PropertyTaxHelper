import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonMatch,matchProperty,tierNames,matchingQualification} from '../src/lib/property-comparisons.ts';
import {getActivityMatches} from '../src/lib/supabase/activity-matches.ts';
import {activityRows,activityWindowCsv,activityKey,parseActivity} from '../src/lib/property-activity.ts';
import {activityViewFixture} from '../../tools/property-search/activity-view-fixture.mjs';
const subject={property_id:'100',address:'SYNTHETIC',city:'CITY',property_type:'single_family',market_value:400000,land_value:100000,land_acres:1,living_area:2000,class_code:'R3',year_built:2014,neighborhood:'T2450',main_buildings:1};
const comp=(changes={})=>({...subject,property_id:'120',...changes});
const source='11111111-1111-4111-8111-111111111111';
test('shared descriptions distinguish ranked, missing, complete nonmatch and no subject',()=>{
 const c=comp({living_area:2080,year_built:2016}),m=matchProperty(subject,c),shown=comparisonMatch(subject,c);
 assert.equal(shown.label,`Tier ${m.tier} · ${tierNames[m.tier]}`);assert.equal(shown.description,m.reasons.slice(2).join(' · '));
 assert.equal(comparisonMatch(subject,comp({living_area:null})).label,'Not enough information to compare.');
 for(const changes of [{living_area:3000},{property_type:'other'},{class_code:'R6'}])assert.equal(comparisonMatch(subject,comp(changes)).label,'Review differences');
 assert.equal(comparisonMatch(null,c).state,'no_subject');assert.equal(comparisonMatch({...subject,living_area:3000},c).state,'nonmatch');
 assert.ok(matchingQualification(2025).startsWith('2025 matching tolerances have not been verified. Suggestions use the 2026 size and age tolerances.'));
});
test('closest sort ranks the complete eligible set, preserves stable ties and selected export rows',()=>{
 const annual=parseActivity(activityViewFixture()),rows=annual.rows.map((r,i)=>({...r,property_id:String(200+i),event_key:'j:'+i}));
 rows.push({...rows[2],event_key:'j:extra'});
 const data={rows},matches=Object.fromEntries(rows.map(r=>[r.property_id,{rank:3}]));matches['206']={rank:0};matches['204']={rank:99};matches['201']={rank:100};
 const ordered=activityRows(data,'all','closest',matches);assert.equal(ordered[0].property_id,'206');assert.equal(ordered.at(-1).property_id,'201');assert.equal(ordered.at(-2).property_id,'204');assert.deepEqual(ordered.filter(r=>r.property_id==='202').map(r=>r.event_key),['j:2','j:extra']);assert.equal(ordered[1].property_id,'200');
 assert.equal(activityRows(data,'single_family','closest',matches).some(r=>r.property_type!=='single_family'),false);
 const selected=new Set([activityKey(rows[0]),activityKey(rows[6])]);const windowed={...data,window:{targetYear:2027,start:'2026-01-01',end:'2026-12-31'},datasets:[{...annual,rows}],missingYears:[],failedYears:[],neighborhood:'T2450'};
 for(const sort of ['newest','closest']){const csv=activityWindowCsv(windowed,selected,'single_family',sort,matches);assert.equal(csv.split('\r\n').filter(Boolean).length,3);for(const id of ['200','206'])assert.ok(csv.includes('"'+id+'"'));}
});
test('one POST batches inputs, uses shared primary-building refinement and rejects stale context',async()=>{
 let calls=0;const cost={property_id:'120',tax_year:2026,market_land_value:100000,improvements:[{id:'1',type_code:'01',state_code:'A1',reported_value:300000,detail_value:300000,main_value:300000,main_area:2000,class_code:'R3',year_built:2014,depreciation_year:2014,floors:1,complete:true,features:[]}]};
 const raw={available:true,anchor_id:source,source_id:source,subject_id:'100',items:[subject,comp({living_area:3000})],cost_chunks:[{anchor_id:source,source_id:source,items:[cost]}]};
 const config={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
 const fetcher=async(url,init)=>{calls++;assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body).p_ids,['120','999']);return new Response(JSON.stringify(raw),{status:200});};
 const result=await getActivityMatches('100',source,2026,['120','999','120'],config,fetcher);assert.equal(calls,1);assert.equal(result.items['120'].rank,0);assert.equal(result.items['999'].state,'unavailable');
 raw.source_id='22222222-2222-4222-8222-222222222222';assert.equal(await getActivityMatches('100',source,2026,['120','999'],config,fetcher),null);
 raw.source_id=source;raw.subject_id='101';assert.equal(await getActivityMatches('100',source,2026,['120','999'],config,fetcher),null);
});
