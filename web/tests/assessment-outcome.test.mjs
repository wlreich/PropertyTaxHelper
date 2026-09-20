import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentOutcome, nextYearCap } from '../src/lib/assessment-outcome.ts';
import { fixtureHistory } from '../../tools/property-search/history-fixture.mjs';
const initial = {...fixtureHistory.snapshots[1], tax_year:2026, roll_stage:'preliminary', market_value:1611803, assessed_value:1353650, exemptions:['HS']};
const final = {...initial, roll_stage:'certified', market_value:1285275, assessed_value:1285275};
test('Paw Print cap arithmetic and next-year ceiling use assessed base',()=>{
 const r=assessmentOutcome(final,initial);
 assert.equal(r.marketReduction,326528);assert.equal(r.capExcluded,258153);assert.equal(r.assessedReduction,68375);assert.equal(r.reconciles,true);
 assert.equal(nextYearCap(final,initial).base,1285275);assert.equal(nextYearCap(final,initial).ceiling,1413803);assert.equal(nextYearCap(final,initial).year,2027);
});
test('reduction above cap does not lower assessment or future base',()=>{
 const capped={...final,market_value:1450000,assessed_value:1353650};
 assert.equal(assessmentOutcome(capped,initial).assessedReduction,0);
 assert.match(nextYearCap(capped,initial).explanation,/did not lower/);
 assert.equal(nextYearCap(capped,initial).base,1353650);
});
test('changed threshold is not attributed wholly to market reduction',()=>{
 const changed={...final,market_value:1450000,assessed_value:1300000};
 assert.equal(assessmentOutcome(changed,initial).reconciles,false);
 assert.match(assessmentOutcome(changed,initial).explanation,/other assessment updates/);
});
test('missing, invalid, preliminary, zero-base and non-homestead values are not projected',()=>{
 for(const s of [{...final,market_value:null},{...final,assessed_value:NaN},{...final,assessed_value:2000000},{...final,assessed_value:0},initial,{...final,exemptions:[],entities:[]}]) assert.equal(nextYearCap(s,initial),null);
 assert.equal(nextYearCap(final,initial,false),null);
 assert.equal(assessmentOutcome(final,{...initial,tax_year:2025}),null);
 assert.equal(assessmentOutcome(final,{...initial,assessed_value:null}),null);
 assert.equal(nextYearCap(final).base,1285275);
 assert.doesNotMatch(nextYearCap(final).explanation,/finished.*below/);
});
