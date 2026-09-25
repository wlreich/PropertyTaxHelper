import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentOutcome, nextYearCap } from '../src/lib/assessment-outcome.ts';
import { fixtureHistory } from '../../tools/property-search/history-fixture.mjs';
const initial = {...fixtureHistory.snapshots[1], tax_year:2026, roll_stage:'preliminary', market_value:1611803, assessed_value:1353650, exemptions:['HS']};
const final = {...initial, roll_stage:'certified', market_value:1285275, assessed_value:1285275};
test('Paw Print cap arithmetic and next-year ceiling use assessed base',()=>{
 const r=assessmentOutcome(final,initial);
 assert.equal(r.marketReduction,326528);assert.equal(r.capExcluded,258153);assert.equal(r.assessedReduction,68375);assert.equal(r.reconciles,true);
 const outlook=nextYearCap(final,initial);
 assert.equal(outlook.base,1285275);assert.equal(outlook.ceiling,1413803);assert.equal(outlook.year,2027);
 assert.equal(outlook.explanation,'Your final assessed value is $68,375 below the capped amount on your preliminary appraisal. That final value becomes the starting point for next year’s homestead cap.');
 assert.match(nextYearCap(final,initial,true,'report').explanation,/finished \$68,375 below the proposal/);
});
test('supplemental values use completed assessment math without manufacturing a missing proposal',()=>{
  const supplemental={...final,roll_stage:'supplemental'};
  assert.equal(assessmentOutcome(supplemental,initial).marketReduction,326528);
  assert.equal(nextYearCap(supplemental,initial).base,1285275);
  assert.equal(assessmentOutcome(supplemental),null);
  assert.equal(assessmentOutcome(supplemental,{...initial,tax_year:2025}),null);
});
test('reduction above cap does not lower assessment or future base',()=>{
 const capped={...final,market_value:1450000,assessed_value:1353650};
 assert.equal(assessmentOutcome(capped,initial).assessedReduction,0);
 assert.equal(nextYearCap(capped,initial).explanation,'Your market value fell, but your assessed value did not change. This reduction does not lower next year’s starting point.');
 assert.equal(nextYearCap(capped,initial).base,1353650);
});
test('changed threshold is not attributed wholly to market reduction',()=>{
 const changed={...final,market_value:1450000,assessed_value:1300000};
 assert.equal(assessmentOutcome(changed,initial).reconciles,false);
 assert.match(assessmentOutcome(changed,initial).explanation,/other assessment updates/);
 assert.equal(assessmentOutcome(changed,initial).overviewExplanation,'Your recorded assessed value also fell $53,650 from the preliminary assessed value. The available records do not isolate how much came from the value change versus other assessment updates.');
 assert.equal(nextYearCap(changed,initial).explanation,'Your final assessed value is $53,650 lower than on your preliminary appraisal. That final value becomes next year’s starting point.');
});
test('missing, invalid, preliminary, zero-base and non-homestead values are not projected',()=>{
 for(const s of [{...final,market_value:null},{...final,assessed_value:NaN},{...final,assessed_value:2000000},{...final,assessed_value:0},initial,{...final,exemptions:[],entities:[]}]) assert.equal(nextYearCap(s,initial),null);
 assert.equal(nextYearCap(final,initial,false),null);
 assert.equal(assessmentOutcome(final,{...initial,tax_year:2025}),null);
 assert.equal(assessmentOutcome(final,{...initial,assessed_value:null}),null);
 assert.equal(nextYearCap(final).base,1285275);
 assert.doesNotMatch(nextYearCap(final).explanation,/finished.*below/);
 assert.equal(nextYearCap(final).explanation,'Your 2026 assessed value is the starting point for next year’s homestead cap. The cap limits assessment growth; it does not establish whether market value is accurate.');
});

test('equal market and assessed values do not imply the cap reduced assessment',()=>{
 const start={...initial,market_value:600000,assessed_value:600000};
 const end={...final,market_value:500000,assessed_value:500000};
 const r=assessmentOutcome(end,start);
 assert.equal(r.capExcluded,0);
 assert.doesNotMatch(r.explanation,/cap already excluded/);
 assert.match(r.explanation,/assessed value also fell \$100,000/);
});
