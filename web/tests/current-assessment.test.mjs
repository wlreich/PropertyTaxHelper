import test from 'node:test';
import assert from 'node:assert/strict';
import { exportDate, selectCurrentAssessment, currentAssessmentStory } from '../src/lib/current-assessment.ts';
import { dateLabel, protestEvidence } from '../src/lib/property-history.ts';
import { fixtureHistory } from '../../tools/property-search/history-fixture.mjs';
const [old, preliminary, final] = fixtureHistory.snapshots;
const profile = {...final,property_id:'100',export_time_raw:final.export_time_raw,values_under_review:false};
const evidence=protestEvidence(fixtureHistory.snapshots,fixtureHistory.protest_observations);

test('raw dates from sparse profiles never crash property rendering',()=>{
  for(const [raw,date] of [['07/18/2026 16:27','2026-07-18'],['2026-07-18T16:27:00','2026-07-18'],[null,null],['unknown',null],['02/30/2026 12:00',null]]) {
    assert.equal(exportDate(raw),date);
    assert.doesNotThrow(()=>dateLabel(selectCurrentAssessment({...profile,export_time_raw:raw},[]).export_date));
  }
  assert.equal(dateLabel('07/18/2026'),'Export date not reported');
  assert.equal(dateLabel('2026-02-30'),'Export date not reported');
});
test('selection respects property releases, same-day corrections and newest preliminary year',()=>{
  const corrected={...final,dataset_id:'correction',export_time_raw:'07/18/2026 18:00',market_value:430000};
  assert.equal(selectCurrentAssessment(profile,[corrected,old,final]).dataset_id,'correction');
  const next={...preliminary,dataset_id:'next',tax_year:2027,export_date:'2027-04-02',export_time_raw:'04/02/2027 12:00'};
  assert.equal(selectCurrentAssessment(profile,[next,final,old]).dataset_id,'next');
  assert.equal(selectCurrentAssessment({...profile,tax_year:2028,export_time_raw:'04/02/2028 12:00'},[next,final]).tax_year,2028);
  assert.equal(selectCurrentAssessment({...profile,values_under_review:true,market_value:null},[final]).market_value,null);
});
test('missing values remain unavailable; preliminary records never acquire final outcomes from season dates',()=>{
  const season={phase:'post',config:{tax_year:2027}};
  const next={...preliminary,tax_year:2027,export_date:'2027-04-02'};
  const story=currentAssessmentStory(next,[old,preliminary,final,next],evidence,season);
  assert.equal(story.proposed,null);
  assert.match(story.narrative,/certified result is not available/);
  const missing=currentAssessmentStory({...final,market_value:null,assessed_value:null},[old],[],null);
  assert.equal(missing.annual,null);assert.equal(missing.assessed,null);assert.equal(missing.proposed,null);
  assert.match(currentAssessmentStory(final,[old,preliminary,final],evidence,season).seasonNote,/2027 values are not available/);
});
test('hero separates recorded and inferred protest, agent attribution, rising/falling and uncapped values',()=>{
  const recorded=currentAssessmentStory(final,fixtureHistory.snapshots,evidence,null);
  assert.equal(recorded.proposed.dollars,-100000);assert.equal(recorded.protest,'Protest recorded');
  assert.equal(recorded.recorded,true);assert.equal(recorded.overviewReductionPercent,'18.2');
  assert.equal(recorded.agents[0].name,'FIXTURE TAX PARTNERS');
  assert.equal(recorded.agentAssignmentRecorded,true);assert.equal(recorded.evidenceUnavailable,false);
  const inferred=currentAssessmentStory(final,fixtureHistory.snapshots,[],null);
  assert.match(inferred.protest,/suggests a possible protest/);assert.equal(inferred.recorded,false);assert.equal(inferred.overviewReductionPercent,null);
  const unchanged=currentAssessmentStory({...final,market_value:preliminary.market_value},fixtureHistory.snapshots,[],null);
  assert.equal(unchanged.proposed.dollars,0);
  const noCap=currentAssessmentStory({...final,exemptions:[],entities:[]},fixtureHistory.snapshots,[],null);
  assert.equal(noCap.capped,false);assert.doesNotMatch(noCap.headline,/cap/);
  const falling=currentAssessmentStory({...final,market_value:300000},fixtureHistory.snapshots,[],null);
  assert.match(falling.headline,/fell/);
  const unavailable=currentAssessmentStory(final,[old],[],null,true);
  assert.equal(unavailable.protest,'Protest records temporarily unavailable');
  assert.match(currentAssessmentStory(final,fixtureHistory.snapshots,[],null,true).protest,/protest records temporarily unavailable/);
  const unnamed=currentAssessmentStory(final,fixtureHistory.snapshots,[{...evidence[0],arb_agent_name:null}],null);
  assert.equal(unnamed.agentAssignmentRecorded,true);assert.equal(unnamed.agents.length,0);
});
test('overview prior-year decrease copy is distinct from the preliminary-to-certified result',()=>{
  const prior={...old,market_value:452000};
  const story=currentAssessmentStory(final,[prior,preliminary,final],evidence,null);
  assert.equal(story.overviewNarrative,'Your 2026 certified market value is 0.4% lower than in 2025.');
  assert.match(story.narrative,/Market value decreased 0.4% from 2025/);
  assert.doesNotMatch(story.overviewNarrative,/proposed|preliminary/);
  const unavailable=currentAssessmentStory(final,[final],[],null);
  assert.match(unavailable.overviewNarrative,/prior-year certified market value is not available/);
});
