import test from 'node:test';
import assert from 'node:assert/strict';
import {neighborhoodAnalysis} from '../src/lib/neighborhood-analysis.ts';
import {perFoot} from '../src/lib/neighborhood.ts';

const release=(year,stage)=>({dataset_id:`${year}-${stage}`,tax_year:year,roll_stage:stage,export_date:`${year}-${stage==='certified'?'07-18':'04-02'}`});
const period=(year,stage,values)=>({release:release(year,stage),caps:[],homes:values.map((market,i)=>({property_id:String(i+1),market,area:1000,exclusion:market===null?'unusable_value':null,protested:false}))});
function data(periods,count=periods[0].homes.length){
 const current=periods.at(-1);
 return {source_id:current.release.dataset_id,releases:periods.map(p=>p.release),subject:{property_id:'1',market_value:100000,living_area:1000},
  homes:Array.from({length:count},(_,i)=>({property_id:String(i+1),market:100000,area:1000,preliminary:null,certified:null,certified_area:null,prior:null,protested:false,entities:[]})),caps:[],annual_periods:periods,agent_assignments:[]};
}
test('10% boundary and return buckets use exact values, not rounded percentages',()=>{
 const p=period(2025,'preliminary',Array(6).fill(100000));
 const c=period(2025,'certified',[90000,90001,80000,80000,80000,80000]);
 const n=period(2026,'preliminary',[100000,150000,100001,90000,80000,70000]);
 const result=neighborhoodAnalysis(data([p,c,n])).carryForward[0];
 assert.equal(result.reducedCount,5);assert.equal(result.full.count,2);assert.equal(result.partial.count,1);assert.equal(result.noReturn.count,2);
 assert.equal(result.full.percent,40);assert.equal(result.full.smallSample,true);
 assert.equal(result.full.count+result.partial.count+result.noReturn.count,result.reducedCount);
});
test('eligibility, missing values and missing properties keep one honest matched denominator',()=>{
 const p=period(2025,'preliminary',[100000,100000,100000,100000]);
 p.homes[1].exclusion='baseline_ineligible';p.homes[2].exclusion='different_neighborhood';
 const n=period(2026,'preliminary',[110000,110000,110000]);
 const result=neighborhoodAnalysis(data([p,n],4));
 assert.equal(result.preliminaryChanges[0].matchedCount,1);assert.equal(result.preliminaryChanges[0].excludedCount,3);
 assert.equal(result.preliminaryChanges[0].higher.count,1);assert.equal(result.carryForward.length,0);
 assert.equal(result.coverage[0].exclusions.baseline_ineligible,1);assert.equal(result.coverage[1].missingCount,1);
});
test('three-stage comparisons keep distinct matched populations when cohorts are unequal',()=>{
 const prior=period(2025,'certified',[1000,2000,3000,null]);
 const proposed=period(2026,'preliminary',[1100,2200,null,4400]);
 const final=period(2026,'certified',[1200,null,3600,4800]);
 const story=neighborhoodAnalysis(data([prior,proposed,final],4)).story;
 assert.equal(story.start.matchedCount,2);assert.equal(story.start.excludedCount,2);assert.ok(Math.abs(story.start.percent-10)<1e-9);
 assert.equal(story.final.versusProposal.matchedCount,2);assert.equal(story.final.versusProposal.excludedCount,2);
 assert.equal(story.final.versusProposal.percent,(3000/2750-1)*100);
 assert.equal(story.final.versusPriorCertified.matchedCount,2);assert.equal(story.final.versusPriorCertified.excludedCount,2);
 assert.ok(Math.abs(story.final.versusPriorCertified.percent-20)<1e-9);
});
test('no pairs and no qualifying reductions produce null percentages, not fabricated zeros',()=>{
 const p=period(2025,'preliminary',[null]),c=period(2025,'certified',[100000]),n=period(2026,'preliminary',[110000]);
 let s=neighborhoodAnalysis(data([p,c,n]));
 assert.equal(s.preliminaryChanges[0].medianIndividualPercent,null);assert.equal(s.preliminaryChanges[0].higher.percent,null);assert.equal(s.carryForward[0].full.percent,null);
 assert.equal(s.story.start.matchedCount,1);assert.equal(s.story.start.smallSample,true);
 p.homes[0]={...p.homes[0],market:100000,exclusion:null};
 s=neighborhoodAnalysis(data([p,c,n]));assert.equal(s.carryForward[0].reducedCount,0);assert.equal(s.carryForward[0].full.percent,null);
 assert.equal(perFoot(100000,0),null);assert.equal(perFoot(100000,Infinity),null);assert.equal(perFoot(100000,NaN),null);
});
test('three-stage comparisons preserve unavailable zero and small denominators',()=>{
 const prior=period(2025,'certified',[null,null]);
 const proposed=period(2026,'preliminary',[1200,null]);
 const final=period(2026,'certified',[1300,1400]);
 const story=neighborhoodAnalysis(data([prior,proposed,final],2)).story;
 assert.equal(story.start.matchedCount,0);assert.equal(story.start.percent,null);assert.equal(story.start.smallSample,false);
 assert.equal(story.final.versusProposal.matchedCount,1);assert.equal(story.final.versusProposal.smallSample,true);
 assert.equal(story.final.versusProposal.percent,(1300/1200-1)*100);
 assert.equal(story.final.versusPriorCertified.matchedCount,0);assert.equal(story.final.versusPriorCertified.percent,null);
 const absent=neighborhoodAnalysis(data([period(2026,'certified',[1300,1400])],2)).story;
 assert.equal(absent.start,null);assert.equal(absent.final.versusProposal,null);assert.equal(absent.final.versusPriorCertified,null);
 const priorPre=period(2025,'preliminary',[1500,1600]),priorFinal=period(2025,'certified',[1400,1500]),currentFinal=period(2026,'certified',[1600,1700]);
 const noStaleOutcome=neighborhoodAnalysis(data([priorPre,priorFinal,currentFinal],2)).story;
 assert.equal(noStaleOutcome.outcome,null);assert.notEqual(noStaleOutcome.final,null);
});
test('final proposal comparison rejects a preliminary release that is not earlier than certification',()=>{
 const proposed=period(2026,'preliminary',[1200,1300]);
 const final=period(2026,'certified',[1100,1250]);
 proposed.release.export_date=final.release.export_date;
 const story=neighborhoodAnalysis(data([proposed,final],2)).story;
 assert.notEqual(story.final,null);assert.equal(story.outcome,null);assert.equal(story.final.versusProposal,null);
});
test('change of certified medians differs from median individual proposed changes',()=>{
 const a=[1000,100000,200000],b=[2000,100000,300000];
 const s=neighborhoodAnalysis(data([period(2025,'preliminary',a),period(2025,'certified',a),period(2026,'preliminary',b),period(2026,'certified',b)]));
 assert.equal(s.certifiedChanges[0].percent,0);assert.equal(s.preliminaryChanges[0].medianIndividualPercent,50);
 assert.equal(s.story.start.percent,0);assert.notEqual(s.story.start.percent,s.preliminaryChanges[0].medianIndividualPercent);
});
test('latest completed outcomes retain their own year, conditional caps and inferred activity',()=>{
 const p=period(2025,'preliminary',[150000,150000,150000,150000]);
 p.caps=[{property_id:'1',eligible:true,above:true,threshold:100000},{property_id:'2',eligible:true,above:true,threshold:100000},{property_id:'3',eligible:null,above:null,threshold:null}];
 const c=period(2025,'certified',[90000,100000,80000,150000]),n=period(2026,'preliminary',[160000,160000,160000,160000]);
 const s=neighborhoodAnalysis(data([p,c,n]));
 assert.equal(s.current.tax_year,2026);assert.equal(s.latestOutcome.certified.tax_year,2025);assert.equal(s.latestOutcome.capSource.dataset_id,p.release.dataset_id);
 assert.equal(s.latestOutcome.all.crossed.total,2);assert.equal(s.latestOutcome.all.crossed.count,1);assert.equal(s.latestOutcome.participation.count,3);
 assert.equal(s.latestOutcome.all.shares.crossed.total,4);
 assert.equal(s.story.year,2026);assert.equal(s.story.outcome.certified.tax_year,2025);assert.equal(s.story.final,null);
});
test('cap progression keeps the reconciled 319 to 315 to 297 to 77 cohort',()=>{
 const p=period(2026,'preliminary',Array(319).fill(150000));
 const c=period(2026,'certified',Array.from({length:319},(_,i)=>i<77?90000:i<297?120000:i<315?150000:140000));
 p.homes.forEach(h=>{h.protested=true;});
 p.caps=p.homes.map((h,i)=>i<315?{property_id:h.property_id,eligible:true,above:true,threshold:100000}:{property_id:h.property_id,eligible:true,above:false,threshold:null});
 const progression=neighborhoodAnalysis(data([p,c])).latestOutcome.capProgression;
 assert.equal(progression.usableCount,319);
 assert.deepEqual({count:progression.startedAbove.count,total:progression.startedAbove.total},{count:315,total:319});
 assert.deepEqual({count:progression.reduced.count,total:progression.reduced.total},{count:297,total:315});
 assert.deepEqual({count:progression.finishedBelow.count,total:progression.finishedBelow.total},{count:77,total:315});
});
test('cap progression excludes inapplicable, unreconciled and unpaired records without treating missing as zero',()=>{
 const p=period(2026,'preliminary',[150000,150000,150000,80000,150000,150000,null,150000,150000]);
 const c=period(2026,'certified',[100000,100000,100000,70000,100000,100000,90000,null,90000]);
 p.homes.forEach(h=>{h.protested=true;});
 p.caps=[
  {property_id:'1',eligible:true,above:true,threshold:100000}, // Final equals the threshold: not below.
  {property_id:'2',eligible:false,above:null,threshold:null}, // No homestead recorded.
  {property_id:'3',eligible:false,above:null,threshold:null}, // Newly qualified in this year.
  {property_id:'4',eligible:true,above:false,threshold:null}, // Eligible, but the cap was not binding.
  {property_id:'5',eligible:null,above:null,threshold:null}, // Unknown cap inputs.
  {property_id:'6',eligible:true,above:true,threshold:null}, // Unreconciled source cap figures.
  {property_id:'7',eligible:true,above:true,threshold:100000}, // Missing preliminary value.
  {property_id:'8',eligible:true,above:true,threshold:100000}, // Missing certified value.
  {property_id:'9',eligible:true,above:true,threshold:100000},
 ];
 const progression=neighborhoodAnalysis(data([p,c],9)).latestOutcome.capProgression;
 assert.equal(progression.usableCount,3);assert.deepEqual([progression.startedAbove.count,progression.startedAbove.total],[2,3]);
 assert.deepEqual([progression.reduced.count,progression.reduced.total],[2,2]);assert.deepEqual([progression.finishedBelow.count,progression.finishedBelow.total],[1,2]);
 const zeroP=period(2027,'preliminary',[150000]),zeroC=period(2027,'certified',[100000]);zeroP.homes[0].protested=true;
 zeroP.caps=[{property_id:'1',eligible:false,above:null,threshold:null}];
 const zero=neighborhoodAnalysis(data([zeroP,zeroC])).latestOutcome.capProgression;
 assert.equal(zero.usableCount,0);assert.equal(zero.startedAbove.percent,null);assert.equal(zero.reduced.percent,null);assert.equal(zero.finishedBelow.percent,null);
 const changedP=period(2028,'preliminary',[150000,150000]),changedC=period(2028,'certified',[90000,150000]);changedP.homes.forEach(h=>{h.protested=true;});
 changedP.caps=changedP.homes.map(h=>({property_id:h.property_id,eligible:true,above:true,threshold:100000}));
 const changed=neighborhoodAnalysis(data([changedP,changedC])).latestOutcome;
 assert.equal(changed.certified.tax_year,2028);assert.deepEqual([changed.capProgression.usableCount,changed.capProgression.startedAbove.count,changed.capProgression.reduced.count,changed.capProgression.finishedBelow.count],[2,2,1,1]);
});
test('additional years append pairs, gaps do not become one-year comparisons, and duplicates fail closed',()=>{
 const p=period(2025,'preliminary',Array(10).fill(100000)),c=period(2025,'certified',Array(10).fill(80000)),n=period(2026,'preliminary',Array(10).fill(110000));
 const d=data([p,c,n,period(2027,'preliminary',Array(10).fill(120000)),period(2029,'preliminary',Array(10).fill(130000))]);
 const s=neighborhoodAnalysis(d);assert.equal(s.preliminaryChanges.length,2);assert.equal(s.carryForward[0].full.smallSample,false);
 assert.equal(s.preliminaryChanges[0].current.tax_year,2027);
 d.homes.push(d.homes[0]);assert.throws(()=>neighborhoodAnalysis(d),/Duplicate/);
});
test('agent activity uses two dynamic completed years, deterministic top five, other, ambiguous and unnamed groups',()=>{
 const p25=period(2025,'preliminary',Array(12).fill(100000)),c25=period(2025,'certified',Array(12).fill(90000));
 const p26=period(2026,'preliminary',Array(12).fill(200000)),c26=period(2026,'certified',Array(12).fill(180000));
 const d=data([p25,c25,p26,c26],12);
 const names=['ALPHA TAX','BETA TAX','CHARLIE TAX','DELTA TAX','ECHO TAX','FOXTROT TAX','GOLF TAX','HOTEL TAX'];
 d.agent_assignments=[
  ...names.map((agent_name,i)=>({property_id:String(i+1),tax_year:2026,agent_name,status:'named'})),
  {property_id:'9',tax_year:2026,agent_name:'Alpha-Tax',status:'named'},
  {property_id:'10',tax_year:2026,agent_name:'ALPHA TAX',status:'named'},
  {property_id:'11',tax_year:2026,agent_name:null,status:'ambiguous'},
  ...Array.from({length:6},(_,i)=>({property_id:String(i+1),tax_year:2025,agent_name:`${String.fromCharCode(90-i)} TAX`,status:'named'})),
 ];
 const panels=neighborhoodAnalysis(d).agentActivity;
 assert.deepEqual(panels.map(x=>x.certified.tax_year),[2026,2025]);
 assert.equal(panels[0].activityCount,12);
 assert.deepEqual(panels[0].rows.slice(0,5).map(x=>x.label),['Alpha Tax','Beta Tax','Charlie Tax','Delta Tax','Echo Tax']);
 assert.deepEqual(panels[0].rows.map(x=>[x.kind,x.propertyCount,x.reducedCount]),[
  ['named',3,3],['named',1,1],['named',1,1],['named',1,1],['named',1,1],['other',3,3],['ambiguous',1,1],['none',1,1],
 ]);
 assert.equal(panels[0].rows.find(x=>x.kind==='other').label,'Other agents (3)');
 assert.equal(panels[0].rows[0].medianReduction,20000);assert.equal(panels[0].rows[0].medianPercent,10);
 assert.deepEqual(panels[1].rows.slice(0,5).map(x=>x.label),['U Tax','V Tax','W Tax','X Tax','Y Tax']);
});
test('agent medians use only positive paired reductions while recorded and inferred activity still count once',()=>{
 const p=period(2026,'preliminary',[200000,200000,200000,200000,200000]);
 const c=period(2026,'certified',[150000,200000,210000,null,190000]);
 p.homes[1].protested=true;p.homes[2].protested=true;p.homes[3].protested=true;
 const d=data([p,c],5);d.agent_assignments=[1,2,3,4].map(i=>({property_id:String(i),tax_year:2026,agent_name:'SAMPLE AGENT',status:'named'}));
 const panel=neighborhoodAnalysis(d).agentActivity[0],named=panel.rows[0],unnamed=panel.rows[1];
 assert.equal(panel.activityCount,5);assert.deepEqual([named.propertyCount,named.reducedCount],[4,1]);
 assert.equal(named.medianReduction,50000);assert.equal(named.medianPercent,25);
 assert.deepEqual([unnamed.kind,unnamed.propertyCount,unnamed.reducedCount],['none',1,1]);
});
test('agent activity requires completed pairs and keeps unavailable reduction medians explicit',()=>{
 const p25=period(2025,'preliminary',[100000,100000]),c25=period(2025,'certified',[100000,110000]);
 p25.homes[0].protested=true;c25.homes[1].protested=true;
 const p26=period(2026,'preliminary',[120000,120000]);
 const d=data([p25,c25,p26],2);d.agent_assignments=[{property_id:'1',tax_year:2025,agent_name:'SAMPLE AGENT',status:'named'}];
 const panel=neighborhoodAnalysis(d).agentActivity;
 assert.equal(panel.length,1);assert.equal(panel[0].certified.tax_year,2025);
 assert.deepEqual(panel[0].rows.map(row=>[row.kind,row.reducedCount,row.medianReduction,row.medianPercent]),[
  ['named',0,null,null],['none',0,null,null],
 ]);
 assert.deepEqual(neighborhoodAnalysis(data([p26],2)).agentActivity,[]);
});
