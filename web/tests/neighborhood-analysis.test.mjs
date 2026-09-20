import test from 'node:test';
import assert from 'node:assert/strict';
import {neighborhoodAnalysis} from '../src/lib/neighborhood-analysis.ts';
import {perFoot} from '../src/lib/neighborhood.ts';

const release=(year,stage)=>({dataset_id:`${year}-${stage}`,tax_year:year,roll_stage:stage,export_date:`${year}-${stage==='certified'?'07-18':'04-02'}`});
const period=(year,stage,values)=>({release:release(year,stage),caps:[],homes:values.map((market,i)=>({property_id:String(i+1),market,area:1000,exclusion:market===null?'unusable_value':null,protested:false}))});
function data(periods,count=periods[0].homes.length){
 const current=periods.at(-1);
 return {source_id:current.release.dataset_id,releases:periods.map(p=>p.release),subject:{property_id:'1',market_value:100000,living_area:1000},
  homes:Array.from({length:count},(_,i)=>({property_id:String(i+1),market:100000,area:1000,preliminary:null,certified:null,certified_area:null,prior:null,protested:false,entities:[]})),caps:[],annual_periods:periods};
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
test('no pairs and no qualifying reductions produce null percentages, not fabricated zeros',()=>{
 const p=period(2025,'preliminary',[null]),c=period(2025,'certified',[100000]),n=period(2026,'preliminary',[110000]);
 let s=neighborhoodAnalysis(data([p,c,n]));
 assert.equal(s.preliminaryChanges[0].medianIndividualPercent,null);assert.equal(s.preliminaryChanges[0].higher.percent,null);assert.equal(s.carryForward[0].full.percent,null);
 p.homes[0]={...p.homes[0],market:100000,exclusion:null};
 s=neighborhoodAnalysis(data([p,c,n]));assert.equal(s.carryForward[0].reducedCount,0);assert.equal(s.carryForward[0].full.percent,null);
 assert.equal(perFoot(100000,0),null);assert.equal(perFoot(100000,Infinity),null);assert.equal(perFoot(100000,NaN),null);
});
test('change of certified medians differs from median individual proposed changes',()=>{
 const a=[1000,100000,200000],b=[2000,100000,300000];
 const s=neighborhoodAnalysis(data([period(2025,'preliminary',a),period(2025,'certified',a),period(2026,'preliminary',b),period(2026,'certified',b)]));
 assert.equal(s.certifiedChanges[0].percent,0);assert.equal(s.preliminaryChanges[0].medianIndividualPercent,50);
});
test('latest completed outcomes retain their own year, conditional caps and inferred activity',()=>{
 const p=period(2025,'preliminary',[150000,150000,150000,150000]);
 p.caps=[{property_id:'1',eligible:true,above:true,threshold:100000},{property_id:'2',eligible:true,above:true,threshold:100000},{property_id:'3',eligible:null,above:null,threshold:null}];
 const c=period(2025,'certified',[90000,100000,80000,150000]),n=period(2026,'preliminary',[160000,160000,160000,160000]);
 const s=neighborhoodAnalysis(data([p,c,n]));
 assert.equal(s.current.tax_year,2026);assert.equal(s.latestOutcome.certified.tax_year,2025);assert.equal(s.latestOutcome.capSource.dataset_id,p.release.dataset_id);
 assert.equal(s.latestOutcome.all.crossed.total,2);assert.equal(s.latestOutcome.all.crossed.count,1);assert.equal(s.latestOutcome.participation.count,3);
 assert.equal(s.latestOutcome.all.shares.crossed.total,4);
});
test('additional years append pairs, gaps do not become one-year comparisons, and duplicates fail closed',()=>{
 const p=period(2025,'preliminary',Array(10).fill(100000)),c=period(2025,'certified',Array(10).fill(80000)),n=period(2026,'preliminary',Array(10).fill(110000));
 const d=data([p,c,n,period(2027,'preliminary',Array(10).fill(120000)),period(2029,'preliminary',Array(10).fill(130000))]);
 const s=neighborhoodAnalysis(d);assert.equal(s.preliminaryChanges.length,2);assert.equal(s.carryForward[0].full.smallSample,false);
 assert.equal(s.preliminaryChanges[0].current.tax_year,2027);
 d.homes.push(d.homes[0]);assert.throws(()=>neighborhoodAnalysis(d),/Duplicate/);
});
