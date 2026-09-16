import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeGroup,distribution,neighborhoodSummary} from '../src/lib/neighborhood.ts';
const home=(id,pre,cert)=>({property_id:id,market:cert,area:1000,preliminary:pre,certified:cert,certified_area:1000,prior:null,protested:false,entities:[]});
test('cap equality, missing inputs and percent denominators stay distinct',()=>{
 const homes=[home('1',150000,90000),home('2',150000,100000),home('3',null,80000),home('4',200000,220000),home('5',35,10),home('6',80000,70000)];
 const caps=[{property_id:'1',eligible:true,above:true,threshold:100000},{property_id:'2',eligible:true,above:true,threshold:100000},{property_id:'6',eligible:true,above:false,threshold:null}];
 const s=summarizeGroup(homes,caps);
 assert.equal(s.above.total,3);assert.equal(s.above.count,2);assert.equal(s.reduced.total,4);assert.equal(s.reduced.count,3);
 assert.equal(s.crossed.total,2);assert.equal(s.crossed.count,1);assert.equal(s.crossed.percent,50);assert.equal(s.missingPair,2);
 assert.equal(s.averageReduction,40000);assert.ok(Math.abs(s.averagePercent-(40+100/3+12.5)/3)<1e-9);
 assert.equal(s.medianReduction,50000);assert.ok(Math.abs(s.medianPercent-100/3)<1e-9);
});
test('distribution counts ties strictly and handles empty and uniform populations',()=>{
 assert.equal(distribution([100,200,200,300],200).percentile,25);
 assert.equal(distribution([100,100],100).bins[0].count,2);
 assert.equal(distribution([],null).percentile,null);
 assert.equal(distribution([100,200,300],200).bins.reduce((n,b)=>n+b.count,0),3);
});
test('median per foot is median of ratios and never ratio of totals',()=>{
 const homes=[{...home('1',null,100000),area:100},{...home('2',null,200000),area:2000},{...home('3',null,300000),area:3000}];
 const s=neighborhoodSummary({subject:{property_id:'1',market_value:100000,living_area:100},homes,caps:[]});
 assert.equal(s.medianPerFoot,100);assert.equal(s.median,200000);assert.equal(s.difference,-100000);
});
