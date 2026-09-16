import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustmentSummary,parseMarketAdjustment} from '../src/lib/market-adjustments.ts';
const home=(id,effect)=>({property_id:String(id),status:effect===null?'missing_preliminary':'ok',effect,actual_change:null,preliminary_date:effect===null?null:'2026-04-02',prior_preliminary_date:null});
const data={year:2026,neighborhood:'TEST',history:[],homes:[home(1,-10000),home(2,0),home(3,40000),home(4,null)]};
test('median uses individual signed effects including zero; excludes unavailable',()=>{
 assert.ok(parseMarketAdjustment(data));
 assert.equal(adjustmentSummary(data).median,0);
 assert.equal(adjustmentSummary(data).count,3);
 assert.equal(adjustmentSummary(data).total,4);
 assert.equal(adjustmentSummary({...data,homes:[]}).median,null);
 assert.equal(adjustmentSummary({...data,homes:[home(1,-10000),home(2,40000)]}).median,15000);
});
test('invalid history, future years, duplicate homes, non-finite values fail closed',()=>{
 const h={year:2026,factor:1.5,page:1,filename:'2026_Market_Adjustments.pdf',sha256:'a'.repeat(64)};
 assert.ok(parseMarketAdjustment({...data,history:[h]}));
 for(const history of [[{...h,factor:0}],[{...h,year:2027}],[h,h],[{...h,filename:'../../x'}]])assert.equal(parseMarketAdjustment({...data,history}),null);
 assert.equal(parseMarketAdjustment({...data,homes:[home(1,1),home(1,2)]}),null);
 assert.equal(parseMarketAdjustment({...data,homes:[home(1,NaN)]}),null);
});
