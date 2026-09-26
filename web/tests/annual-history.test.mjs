import test from 'node:test';
import assert from 'node:assert/strict';
import { annualHistory, changeLabel, chartScale, capGapSummary } from '../src/lib/annual-history.ts';
import { parseHistory, protestEvidence } from '../src/lib/property-history.ts';
import { par11Reference, par11Fixture } from '../../tools/property-search/par11-fixture.mjs';
const snapshots = parseHistory(par11Reference.overview.history);

test('annual trend uses only explicitly eligible proposals; ledger comparisons stay separate',()=>{
  const rows=annualHistory([...snapshots].reverse());
  assert.deepEqual(rows.map(r=>r.year),[2026,2025]);
  assert.equal(rows[0].preliminary,1575313); assert.equal(rows[0].trendProposed,null); assert.equal(rows[0].market,1575313); assert.equal(rows[0].assessed,1377354);
  assert.equal(rows[1].preliminary,1365039); assert.equal(rows[1].market,1365039); assert.equal(rows[1].assessed,1252140);
  assert.equal(changeLabel(rows[0].annual),'+$210,274 / 15.4%');
  assert.equal(changeLabel(rows[1].annual),'Not available');
  assert.equal(changeLabel(rows[0].within),'Unchanged'); assert.equal(changeLabel(rows[1].within),'Unchanged');
  assert.match(capGapSummary(rows),/widened from \$112,899 in 2025 to \$197,959 in 2026/);
  const prepared=snapshots.map(s=>s.tax_year===2026&&s.roll_stage==='preliminary'?{...s,preliminary_baseline_eligible:true}:s);
  assert.equal(annualHistory(prepared)[0].trendProposed,1575313);
  const changed=snapshots.map(s=>s.dataset_id==='4cb28ab3-6d6b-4046-8b29-f25258195de1'?{...s,market_value:1400000}:s);
  assert.equal(annualHistory(changed)[1].preliminary,1400000);
  assert.equal(annualHistory(changed)[1].within.dollars,-34961);
});
test('property-specific conflicts and globally excluded interim records are never baseline replacements',()=>{
  const history=par11Fixture('999119').overview.history;
  const row=annualHistory(parseHistory(history))[1];
  assert.equal(row.preliminary,null); assert.equal(row.within,null);
  assert.equal(row.sources.length,3); // Excluded values remain dated detail records.
  assert.match(row.sources.find(s=>s.id==='3dbefa41-a640-410f-8703-3b89fcc20aaa').label,/interim snapshot/);
});
test('zero, one, five, six and nonconsecutive years have unique ordered rows without invented prior years',()=>{
  for(const [id,count] of [['999110',0],['999111',1],['999115',5],['999116',6],['999117',2]]) {
    const rows=annualHistory(parseHistory(par11Fixture(id).overview.history));
    assert.equal(rows.length,count); assert.equal(new Set(rows.map(r=>r.year)).size,count);
    if(count) assert.equal(rows[0].year,2026);
  }
  assert.equal(annualHistory(parseHistory(par11Fixture('999117').overview.history))[0].annual,null);
  assert.equal(annualHistory(parseHistory(par11Fixture('999116').overview.history)).at(-1).status,'Preliminary only');
  const rows=annualHistory(parseHistory(par11Fixture('999115').overview.history));
  assert.equal(rows[0].annual.dollars,25000);
});
test('preliminary-only current year has available preliminary values but no certified bars or annual comparison',()=>{
  const row=annualHistory(parseHistory(par11Fixture('999118').overview.history))[0];
  assert.equal(row.year,2027); assert.equal(row.status,'Preliminary only');
  assert.equal(row.preliminary,685000); assert.equal(row.afterCap,590000);
  assert.equal(row.market,null); assert.equal(row.assessed,null); assert.equal(row.annual,null); assert.equal(row.within,null);
});
test('unknown amounts/dates and zero bases remain explicit; axes include zero and bound every stage',()=>{
  const base=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
  const prior={...base,dataset_id:'prior',tax_year:2025,export_date:'2025-07-18',market_value:0,assessed_value:0};
  const rows=annualHistory([prior,{...base,market_value:20}]);
  assert.equal(changeLabel(rows[0].annual),'+$20');
  assert.equal(annualHistory([{...prior,market_value:null},base])[0].annual,null);
  assert.equal(annualHistory([{...prior,export_date:null},base])[0].annual,null);
  assert.equal(capGapSummary([{...rows[0],market:1,assessed:2},rows[1]]),null);
  for(const amounts of [[0,0,0],[1,2,3],[2000000,1575313,1377354],[123456789,100000000,90000000],[null,null,null]]) {
    const scale=chartScale([{...rows[0],trendProposed:amounts[0],market:amounts[1],assessed:amounts[2]}]);
    assert.equal(scale.ticks[0],0); assert.equal(scale.ticks.at(-1),scale.maximum);
    assert.ok(scale.maximum>0); assert.ok(amounts.every(n=>n===null||n<=scale.maximum));
  }
});
test('latest certified source wins once per year, with dated supplemental protest/agent evidence preserved',()=>{
  const base=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
  const supplemental={dataset_id:'protest',tax_year:2025,export_date:null,export_time_raw:null,protest_flag:true,arb_case_listed:true,arb_agent_listed:true,arb_agent_name:'SYNTHETIC AGENT',arb_status_codes:['EF']};
  const newer={...base,dataset_id:'new',export_date:'2026-08-01',market_value:1500000};
  const rows=annualHistory([newer,...snapshots],protestEvidence(snapshots,[supplemental]));
  assert.equal(rows.length,2); assert.equal(rows[0].market,1500000);
  assert.equal(rows[1].protests[0].agent,'SYNTHETIC AGENT'); assert.equal(rows[1].protests[0].date,'Export date not reported');
  assert.equal(rows[1].sources[0].date,'May 8, 2025');
});
test('later supplemental assessment is the final annual value and retains its source stage',()=>{
  const base=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
  const supplement={...base,dataset_id:'supplemental-valuation',roll_stage:'supplemental',export_date:'2026-08-26',market_value:1285275,assessed_value:1285275};
  const rows=annualHistory([...snapshots,supplement]);
  assert.equal(rows[0].status,'Supplemental');
  assert.equal(rows[0].market,1285275);
  assert.equal(rows[0].afterCap,1285275);
  assert.equal(rows[0].annual.dollars,1285275-rows[1].market);
  assert.equal(rows[0].within.dollars,1285275-rows[0].preliminary);
  assert.match(rows[0].sources.at(-1).label,/supplemental/);
  assert.equal(annualHistory(snapshots)[0].status,'Certified');
});
test('same-day supplemental export time wins regardless of dataset ID order',()=>{
  const base=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
  const earlier={...base,dataset_id:'z-certified',export_date:'2026-08-26',export_time_raw:'08/26/2026 09:00',market_value:1400000};
  const later={...base,dataset_id:'a-supplemental',roll_stage:'supplemental',export_date:'2026-08-26',export_time_raw:'08/26/2026 18:00',market_value:1285275};
  const row=annualHistory([...snapshots,earlier,later])[0];
  assert.equal(row.status,'Supplemental');
  assert.equal(row.market,1285275);
  assert.equal(row.sources.at(-1).id,'a-supplemental');
});

test('same-day earlier eligible proposal remains paired with the completed release',()=>{
  const final=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
  const proposal={...final,dataset_id:'same-day-proposal',roll_stage:'preliminary',preliminary_baseline_eligible:true,export_time_raw:'2026-07-18 08:00:00',market_value:1800000};
  const completed={...final,dataset_id:'same-day-final',export_date:'2026-07-18',export_time_raw:'2026-07-18 12:00:00',market_value:1600000};
  const row=annualHistory([proposal,completed])[0];
  assert.equal(row.trendProposed,1800000);assert.equal(row.market,1600000);
});

test('year detail values share the eligible baseline and preserve protest-only years',()=>{
 const rows=annualHistory(snapshots);
 assert.equal(rows[0].preliminaryAssessed,1377354);
 assert.equal(rows[0].annualAssessed.dollars,125214);
 const evidence={dataset_id:'older-protest',tax_year:2020,export_date:'2020-05-01',export_time_raw:null,protest_flag:true,arb_case_listed:true,arb_agent_listed:false,arb_agent_name:null,arb_status_codes:['EF']};
 const old=annualHistory(snapshots,[evidence]).at(-1);
 assert.equal(old.year,2020);assert.equal(old.status,'Protest records only');
 assert.equal(old.market,null);assert.equal(old.preliminaryAssessed,null);assert.equal(old.outcome,null);
 assert.equal(old.protests[0].recorded,true);
 const excluded=annualHistory(parseHistory(par11Fixture('999119').overview.history))[1];
 assert.equal(excluded.preliminaryAssessed,null);assert.equal(excluded.outcome,null);
});

test('valuation stages keep eligible proposals, matching certified values and cap evidence together',()=>{
 const proposal=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='preliminary');
 const certified=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
 const eligible={...proposal,dataset_id:'eligible-proposal',preliminary_baseline_eligible:true,market_value:1800000,assessed_value:1400000};
 const olderFinal={...certified,dataset_id:'older-final',export_date:'2026-07-01',market_value:1500000,assessed_value:1300000};
 const matchingFinal={...certified,dataset_id:'matching-final',export_date:'2026-08-01',market_value:1600000,assessed_value:1350000};
 const row=annualHistory([eligible,matchingFinal,olderFinal])[0];
 assert.equal(row.trendProposed,1800000);
 assert.equal(row.market,1600000);
 assert.equal(row.assessed,1350000);
 assert.equal(row.within.dollars,-200000);
 assert.equal(row.assessedAfterCap,true);
 assert.equal(chartScale([row]).maximum,2000000);

 const below=annualHistory([{...eligible,market_value:1500000},{...matchingFinal,market_value:1600000}])[0];
 assert.equal(below.within.dollars,100000);

 const noCapProposal={...eligible,exemptions:[],entities:[],market_value:600000,assessed_value:600000};
 const noCapFinal={...matchingFinal,exemptions:[],entities:[],market_value:550000,assessed_value:550000};
 assert.equal(annualHistory([noCapProposal,noCapFinal])[0].assessedAfterCap,false);
});

test('preliminary-only, certified-only, excluded and unknown proposal stages stay distinct',()=>{
 const proposal=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='preliminary');
 const certified=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
 const preliminaryOnly=annualHistory([{...proposal,preliminary_baseline_eligible:true}])[0];
 assert.equal(preliminaryOnly.trendProposed,1575313);assert.equal(preliminaryOnly.market,null);assert.equal(preliminaryOnly.assessed,null);
 const certifiedOnly=annualHistory([certified])[0];
 assert.equal(certifiedOnly.trendProposed,null);assert.equal(certifiedOnly.market,1575313);assert.equal(certifiedOnly.assessed,1377354);
 for(const preliminary_baseline_eligible of [false,undefined]) {
   const row=annualHistory([{...proposal,preliminary_baseline_eligible},certified])[0];
   assert.equal(row.trendProposed,null);assert.equal(row.assessedAfterCap,false);
 }
});
