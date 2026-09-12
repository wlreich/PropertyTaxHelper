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

// Anonymous numerical fixtures from TCAD's 2026 worked grids.
import {calculateTcadAdjustments,estimatePercentGood} from '../src/lib/tcad-method.ts';
import {parseCostRecords,primaryBuilding} from '../src/lib/tcad-costs.ts';
const s={market:1611803,land:357492,area:4410,classCode:'R3',mainRcn:573291/.91,mainRcnld:573291,percentGood:91,nonliving:131378,secondary:0,mass:1.78};
const examples=[
 [4418.5,90,564681,736289,1967632,435042,221996,-1214,5646,-40230,-335344,1632288],
 [4414.5,90,567951,703618,1468418,215978,0,-642,5679,-4289,142262,1610680],
 [4416,92,578938,644311,1681265,534391,0,-857,-5789,66005,-117540,1563725],
 [4420,95,621410,813272,1690942,243318,0,-1428,-24856,-60484,27406,1718348],
 [4376,88,547574,604507,1470704,394682,0,4856,16427,74445,58538,1529242],
 [4446.5,88,557799,626935,1342225,226281,0,-5214,16733,62242,204972,1547197],
 [4379.5,91,570113,711267,1599025,332970,0,4356,0,-9776,19102,1618127],
 [4449,91,582016,669895,1663544,471131,0,-5571,0,43499,-75711,1587833],
 [4365,90,559118,695171,1457370,219966,0,6428,5591,-4675,144870,1602240],
 [4435,90,563641,732200,1768388,465072,0,-3571,5636,-37181,-142696,1625692],
];
const compInput=([area,percentGood,mainRcnld,detail,market,land,secondary])=>({...s,area,percentGood,mainRcnld,mainRcn:mainRcnld/(percentGood/100),nonliving:detail-mainRcnld,market,land,secondary});
test('all ten TCAD equity grids reproduce lines, indicated values and median',()=>{
 const values=examples.map((e)=>{
  const c=compInput(e),r=calculateTcadAdjustments(s,c),a=r.amounts;
  assert.equal(r.subjectRate,142.85);
  assert.deepEqual([a['Living area'],a['Percent good'],a['Non-living details']],[e[7],e[8],e[9]]);
  assert.equal(a['Construction class'],0);assert.equal(a.Neighborhood,0);
  const total=Object.values(a).reduce((x,y)=>x+y,0);
  assert.equal(total,e[10]);assert.equal(c.market+total,e[11]);return c.market+total;
 }).sort((a,b)=>a-b);
 assert.equal((values[4]+values[5])/2,1606460);
});
test('general example reproduces class, depreciation, size, features, land and total',()=>{
 const r=calculateTcadAdjustments({...s,area:1570,classCode:'R5',mainRcn:113.12*1570,percentGood:90,nonliving:32886,land:382199,mass:1.99},
 {...s,area:1524,classCode:'R4',mainRcn:205344,mainRcnld:162222,percentGood:79,nonliving:13781,land:381384,market:666509,mass:1.99});
 assert.deepEqual(Object.values(r.amounts),[815,5203,-32948,17844,19105,0,0]);
 assert.equal(r.start+Object.values(r.amounts).reduce((a,b)=>a+b),676528);
});
test('sales grids use supplied adjusted sale prices and reproduce both indicated values',()=>{
 for(const [c,price,expected] of [
 [{...s,area:4399,classCode:'R4',percentGood:90,mainRcnld:424136,mainRcn:424136/.90,nonliving:516722-424136,land:366869},1381306,1573664],
 [{...s,area:4204,percentGood:96,mainRcnld:589067,mainRcn:589067/.96,nonliving:725589-589067,land:210783,secondary:29235},1698528,1810832]]) {
  const r=calculateTcadAdjustments(s,c,'sales',price);
  assert.equal(r.start+Object.values(r.amounts).reduce((a,b)=>a+b),expected);
 }
 assert.equal(calculateTcadAdjustments(s,s,'sales').start,null);
});
const building=(changes={})=>({id:'main',type_code:'01',state_code:'A1',reported_value:1230176,detail_value:691110,main_value:573291,main_area:4410,class_code:'R3',year_built:2014,depreciation_year:2014,floors:2,complete:true,features:[{code:'1ST',description:'Main area',value:573291},{code:'GAR',description:'Garage and other non-living details',value:117819}],...changes});
const home={...subject,property_type:'R',neighborhood:'N1',costs:{property_id:'1',tax_year:2026,improvements:[building()]}};
const other={...comparable,market_value:1337500,land_value:215978,property_type:'R',neighborhood:'N1',costs:{property_id:'2',tax_year:2026,improvements:[building({reported_value:1252440,detail_value:703618,main_value:567951,main_area:4414.5,year_built:2013,depreciation_year:2013})]}};
test('corrected release estimate does not reintroduce a removed feature',()=>{
 const current=propertyAdjustments({...home,land_value:357492},other);
 assert.equal(current.adjustedValue,1466203);
 assert.deepEqual(current.lines.map(l=>l.amount),[141514,-642,0,5679,-17848,0,0]);
 const older=propertyAdjustments({...home,land_value:357492,costs:{...home.costs,improvements:[building({detail_value:704669,reported_value:1254311,features:[...building().features,{code:'SPA',description:'Spa',value:13559}]})]}},{...other,market_value:1468418});
 assert.equal(older.adjustedValue,1610680);
 assert.equal(propertyAdjustments({...home,costs:{...home.costs,tax_year:2025}},other).adjustedValue,null);
 assert.equal(propertyAdjustments({...home,market_value:9000000},other).adjustedValue,propertyAdjustments(home,other).adjustedValue);
});
test('highest improvement and secondary values are counted once; incomplete costs remain unknown',()=>{
 const secondary=building({id:'second',reported_value:221996,detail_value:124717,main_value:124717,main_area:920});
 const property={...other,costs:{...other.costs,improvements:[secondary,...other.costs.improvements]}};
 assert.equal(primaryBuilding(property.costs).id,'main');
 assert.equal(propertyAdjustments(home,property).lines.find(l=>l.factor==='Additional improvements').amount,-221996);
 assert.equal(propertyAdjustments({...home,costs:{...home.costs,improvements:[building({complete:false})]}},other).adjustedValue,null);
});
test('percent good estimates label interpolation, year fallback, cross-class proxy and future calibration',()=>{
 assert.equal(estimatePercentGood('R3',2026,2014,2000).value,91);
 assert.equal(estimatePercentGood('R3',2026,null,2013).value,90);
 assert.equal(estimatePercentGood('R3',2026,2016,2016).value,93);
 assert.match(estimatePercentGood('R2',2026,1900,1900).basis,/proxy.*extrapolated/);
 assert.match(estimatePercentGood('R3',2027,2014,2014).basis,/2026 calibration/);
 assert.equal(estimatePercentGood('R3',2026,null,null),null);
 assert.equal(estimatePercentGood('R3',2026,2027,2027),null);
 assert.equal(estimatePercentGood('XX',2026,2014,2014),null);
});
test('cost parser binds releases, rejects duplicates, and removes unapproved fields',()=>{
 const record={...home.costs,owner_name:'PRIVATE'};
 const envelope={anchor_id:'a',source_id:'s',items:[record]};
 assert.equal(parseCostRecords(envelope,'a','wrong',2026),null);
 assert.equal(parseCostRecords(envelope,'a','s',2025),null);
 assert.equal(parseCostRecords({...envelope,items:[record,record]},'a','s',2026),null);
 const parsed=parseCostRecords(envelope,'a','s',2026);
 assert.ok(parsed);assert.equal(JSON.stringify(parsed).includes('PRIVATE'),false);
});
