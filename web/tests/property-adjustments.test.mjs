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
 assert.equal(result.lines.filter(l=>l.amount===null).length,6);
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
