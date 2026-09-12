import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustmentFactors, propertyAdjustments, totalAdjustments, adjustmentSummary} from '../src/lib/property-adjustments.ts';

const subject={property_id:'1',market_value:1400000,land_value:250000};
const comparable={property_id:'2',market_value:1250000,land_value:200000};
const completeLines=(amounts)=>adjustmentFactors.map((factor,i)=>({factor,amount:amounts[i]??0,explanation:'Synthetic calculation',inputs:[]}));

test('land adjustment has the subject-to-comparable direction and never masquerades as a complete value',()=>{
 const result=propertyAdjustments(subject,comparable);
 assert.equal(result.lines[0].amount,50000);
 assert.equal(result.landSubtotal,1300000);
 assert.equal(result.adjustedValue,null);
 assert.equal(result.total,null);
 assert.equal(result.lines.filter(l=>l.amount===null).length,4);
 const negative=propertyAdjustments({...subject,land_value:150000},comparable);
 assert.equal(negative.lines[0].amount,-50000);
 assert.equal(negative.landSubtotal,1200000);
});
test('missing land or reported values remain unknown, while a verified zero land difference is preserved',()=>{
 for(const land_value of [null,NaN,Infinity,-1]) {
  const result=propertyAdjustments({...subject,land_value},comparable);
  assert.equal(result.lines[0].amount,null);
  assert.equal(result.landSubtotal,null);
 }
 assert.equal(propertyAdjustments(subject,{...comparable,land_value:null}).landSubtotal,null);
 assert.equal(propertyAdjustments(subject,{...comparable,market_value:null}).landSubtotal,null);
 assert.equal(propertyAdjustments(subject,{...comparable,land_value:250000}).lines[0].amount,0);
 assert.equal(propertyAdjustments({...subject,land_value:0},{...comparable,land_value:0,market_value:0}).landSubtotal,0);
 assert.equal(propertyAdjustments({...subject,land_value:0},{...comparable,market_value:10}).landSubtotal,null);
});
test('totals require each factor exactly once, including explicit zeroes; invalid estimates are withheld',()=>{
 const lines=completeLines([50000,20000,0,-10000,0,-10000,0]);
 assert.deepEqual(totalAdjustments(1250000,lines),{total:50000,adjustedValue:1300000});
 for(const invalid of [lines.slice(1),[...lines,lines[0]],lines.map((l,i)=>i===1?{...l,amount:null}:l),lines.map((l,i)=>i===1?{...l,amount:Infinity}:l)]) {
  assert.equal(totalAdjustments(1250000,invalid).adjustedValue,null);
 }
 assert.equal(totalAdjustments(null,lines).adjustedValue,null);
 assert.equal(totalAdjustments(1,completeLines([-50])).adjustedValue,null);
 assert.equal(totalAdjustments(0,completeLines([])).adjustedValue,0);
});
test('adjusted medians use complete comparisons only, exclude subject and duplicates, and track the paired reported median',()=>{
 const result=(id,reported,amount)=>({property:{...comparable,property_id:id,market_value:reported},...totalAdjustments(reported,completeLines([amount])),lines:completeLines([amount]),landSubtotal:null});
 const a=result('2',1250000,50000),b=result('3',1350000,-10000),c=result('4',1280000,40000);
 const partial=propertyAdjustments(subject,{...comparable,property_id:'5',market_value:1});
 const summary=adjustmentSummary(subject,[a,b,c,a,partial,result('1',1400000,0)]);
 assert.equal(summary.count,3);
 assert.equal(summary.excluded,1);
 assert.equal(summary.median,1320000);
 assert.equal(summary.difference,80000);
 assert.equal(summary.percent.toFixed(1),'6.1');
 assert.equal(summary.pairedReportedMedian,1280000);
 assert.equal(adjustmentSummary(subject,[a,b]).median,1320000);
 assert.equal(adjustmentSummary(subject,[partial]).median,null);
 assert.equal(adjustmentSummary(subject,[]).median,null);
 assert.equal(adjustmentSummary(subject,[result('2',0,0)]).percent,null);
});

const home={...subject,address:'Subject',city:'Austin',property_type:'R',land_acres:1,neighborhood:'N1',living_area:4000,class_code:'R3',year_built:2015,main_buildings:1};
const comp={...home,...comparable,living_area:4200,year_built:2010};
const peers=Array.from({length:14},(_,i)=>({...home,property_id:String(100+i),living_area:4000,year_built:2005+i,land_value:100000,market_value:100000+4000*200*Math.exp(.01*(2005+i-2010))}));
test('same facts produce explicit estimate assumptions, and size uses only the comparable non-land rate',()=>{
 const r=propertyAdjustments(home,{...comp,year_built:2015});
 assert.equal(r.lines.find(l=>l.factor==='Living area').amount,-50000);
 assert.equal(r.lines.find(l=>l.factor==='Year built').amount,0);
 assert.equal(r.lines.find(l=>l.factor==='Construction class').amount,0);
 assert.equal(r.adjustedValue,1250000);
 assert.match(r.lines.find(l=>l.factor==='Additional improvements').explanation,/not separately priced/);
 assert.equal(propertyAdjustments({...home,market_value:9000000},{...comp,year_built:2015}).adjustedValue,r.adjustedValue);
});
test('independent same-release peers estimate age in both directions without including the subject assessment',()=>{
 const r=propertyAdjustments(home,comp,[home,comp,...peers]);
 assert.equal(r.lines.find(l=>l.factor==='Year built').amount,51271.10);
 assert.equal(r.adjustedValue,1301271.10);
 assert.equal(propertyAdjustments({...home,market_value:9000000},comp,[{...home,market_value:1},comp,...peers]).adjustedValue,r.adjustedValue);
 assert.ok(propertyAdjustments({...home,year_built:2005},comp,peers).lines.find(l=>l.factor==='Year built').amount<0);
 assert.equal(propertyAdjustments(home,comp,peers.slice(0,7)).adjustedValue,null);
 assert.equal(propertyAdjustments(home,comp,peers.flatMap(p=>Array(2).fill(p))).adjustedValue,r.adjustedValue);
 assert.equal(propertyAdjustments(home,comp,peers.map(p=>({...p,neighborhood:'Other'}))).adjustedValue,null);
});
test('class differences use observed peer rates, not numeric class-code guesses',()=>{
 const groups=['R3','R4'].flatMap(class_code=>Array.from({length:6},(_,i)=>({...home,property_id:`${class_code==='R3'?200:300+i}${i}`,class_code,year_built:2015,land_value:100000,market_value:100000+4000*(class_code==='R3'?200:250)})));
 const r=propertyAdjustments(home,{...comp,class_code:'R4',year_built:2015},groups);
 assert.equal(r.lines.find(l=>l.factor==='Construction class').amount,-200000);
 assert.equal(r.adjustedValue,1050000);
 assert.equal(propertyAdjustments(home,{...comp,class_code:'R4',year_built:2015},[]).adjustedValue,null);
});
test('missing facts and incompatible properties cannot manufacture complete estimates',()=>{
 for(const change of [{living_area:null},{living_area:0},{year_built:null},{class_code:null},{class_code:'XX'},{neighborhood:null},{main_buildings:2}]) {
  assert.equal(propertyAdjustments({...home,...change},comp,peers).adjustedValue,null);
 }
 for(const change of [{property_type:'C'},{neighborhood:'Other'},{living_area:0},{land_value:2000000},{market_value:null},{main_buildings:2}]) {
  assert.equal(propertyAdjustments(home,{...comp,...change},peers).adjustedValue,null);
 }
});
