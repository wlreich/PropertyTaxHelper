import test from 'node:test';
import assert from 'node:assert/strict';
import {assessmentSummary,agentsForYear,seasonOutcome,annualExplanation,featureHighlights,streetSearch,historySequence} from '../src/lib/homeowner-insights.ts';
import {parseHistory,parseProtestObservations} from '../src/lib/property-history.ts';
import {fixtureHistory} from '../../tools/property-search/history-fixture.mjs';
const [previous,initial,current]=parseHistory(fixtureHistory);
const evidence=parseProtestObservations(fixtureHistory);
test('opening summary distinguishes a seasonal decrease from an annual increase without treating unavailable values as zero',()=>{
 const result=assessmentSummary(current,initial,previous);
 assert.equal(result.value,450000);
 assert.equal(result.proposed.dollars,-100000);
 assert.equal(result.annual.dollars,50000);
 assert.equal(assessmentSummary({...current,market_value:null},initial,previous),null);
 assert.equal(assessmentSummary(undefined,initial,previous),null);
 assert.equal(assessmentSummary({...current,market_value:0},initial,previous).value,0);
 assert.equal(assessmentSummary(current,undefined,undefined).proposed,null);
 assert.equal(assessmentSummary(current,undefined,undefined).annual,null);
 assert.equal(assessmentSummary(current,{...initial,tax_year:2025},previous).proposed,null);
 assert.equal(assessmentSummary(current,{...initial,export_date:null},previous).proposed,null);
 assert.equal(assessmentSummary(current,{...initial,export_date:current.export_date},previous).proposed,null);
 assert.equal(assessmentSummary(initial,initial,previous).proposed,null);
 assert.equal(assessmentSummary(current,initial,{...previous,tax_year:2024}).annual,null);
 assert.equal(assessmentSummary(current,initial,{...previous,market_value:0}).annual.percent,null);
});
test('result card names only assigned agents for the relevant year, retaining distinct dates and names',()=>{
 const record=evidence[0];
 const agents=agentsForYear([
  record,record,{...record,export_date:'2026-04-02'},
  {...record,arb_agent_name:'SECOND FIRM',export_date:null},
  {...record,arb_agent_name:'PAST FIRM',tax_year:2025},
  {...record,arb_agent_name:'UNLINKED FIRM',arb_agent_listed:false},
  {...record,arb_agent_name:null},
 ],2026);
 assert.deepEqual(agents,[
  {name:'FIXTURE TAX PARTNERS',dates:['2026-04-02','2026-04-29']},
  {name:'SECOND FIRM',dates:[null]},
 ]);
 assert.deepEqual(agentsForYear([],2026),[]);
});
test('promising outcome requires substantial reduction, certified comparison and a protest in the same period/year',()=>{
 assert.equal(seasonOutcome(current,initial,evidence).observedProtest,true);
 for(const change of [{tax_year:2025},{export_date:'2026-03-01'},{export_date:'2026-08-01'},{export_date:null},{protest_flag:false,arb_case_listed:false}]) {
  assert.equal(seasonOutcome(current,initial,[{...evidence[0],...change}]).observedProtest,false);
 }
 assert.equal(seasonOutcome({...current,roll_stage:'preliminary'},initial,evidence),null);
 assert.equal(seasonOutcome({...current,market_value:549900},initial,evidence),null);
 assert.equal(seasonOutcome({...current,market_value:600000},initial,evidence),null);
 assert.equal(seasonOutcome(current,{...initial,market_value:null},evidence),null);
 assert.equal(seasonOutcome(current,{...initial,export_date:current.export_date},evidence),null);
 assert.equal(seasonOutcome({...current,market_value:0},initial,evidence).change.percent,-100);
 assert.equal(seasonOutcome({...current,market_value:550000},initial,evidence,{...current.entities[0],taxable_value:200000}).label,'Leander ISD taxable value');
});
test('annual explanation separates market and taxable direction and only attributes exemption effects when amounts reconcile',()=>{
 const old={...previous,market_value:500000,assessed_value:400000,entities:[{code:'69',name:'SCHOOL ISD',taxable_value:300000,exemptions:{HS:100000}}]};
 const now={...current,market_value:490000,assessed_value:450000};
 const entity={code:'69',name:'SCHOOL ISD',taxable_value:310000,exemptions:{HS:140000}};
 const result=annualExplanation(now,old,entity);
 assert.equal(result.headline,'Market value fell, but taxable value rose');
 assert.match(result.explanation,/Larger recorded exemptions/);
 assert.doesNotMatch(annualExplanation(now,old,{...entity,exemptions:{HS:99}}).explanation,/Larger recorded/);
 assert.equal(annualExplanation(now,undefined,entity),null);
 assert.equal(annualExplanation({...now,market_value:null},old,entity),null);
 assert.match(annualExplanation({...now,market_value:500000},old,entity).headline,/held steady/);
});
test('feature summaries distinguish missing, changed and ambiguous details and preserve zero',()=>{
 assert.ok(featureHighlights(current,initial,previous).some(x=>x.value==='No longer separately listed'));
 const spa=initial.components.find(c=>c.code==='605');
 assert.ok(featureHighlights({...current,components:[...current.components,{...spa,area:2}]},initial,previous).some(x=>x.value==='Details changed'));
 assert.ok(featureHighlights({...current,components:[...current.components,spa,spa]},initial,previous).some(x=>x.value==='More than one matching detail'));
 assert.ok(featureHighlights({...current,components:[{...spa,value:0}]},initial,previous).some(x=>x.value==='$0'));
});
test('history and street discovery are bounded and do not pretend every nearby property is comparable',()=>{
 assert.equal(historySequence(current,initial,previous).length,3);
 assert.equal(historySequence(undefined,undefined,undefined).length,0);
 assert.equal(streetSearch('123 N OAK ST UNIT 5'),'N OAK ST');
 assert.equal(streetSearch('PAW PRINT'),null);
 assert.equal(streetSearch('1 A'),null);
});
test('agent names are an explicit allowlist and require a recorded assignment',()=>{
 assert.equal(evidence[0].arb_agent_name,'FIXTURE TAX PARTNERS');
 assert.equal(parseProtestObservations({protest_observations:[{...evidence[0],arb_agent_listed:false}]}),null);
 assert.equal(parseHistory({snapshots:[{...current,arb_agent_name:'WRONG',arb_agent_listed:false}]}),null);
 const parsed=parseProtestObservations({protest_observations:[{...evidence[0],agent_addr_line1:'PRIVATE'}]});
 assert.ok(!JSON.stringify(parsed).includes('PRIVATE'));
});
