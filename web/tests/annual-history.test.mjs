import test from 'node:test';
import assert from 'node:assert/strict';
import { annualHistory, changeLabel, chartScale, capGapSummary } from '../src/lib/annual-history.ts';
import { parseHistory, protestEvidence } from '../src/lib/property-history.ts';
import { par11Reference, par11Fixture } from '../../tools/property-search/par11-fixture.mjs';
const snapshots = parseHistory(par11Reference.overview.history);

test('annual reference uses May 8 eligible baseline, not July; annual and within-year changes stay separate',()=>{
  const rows=annualHistory([...snapshots].reverse());
  assert.deepEqual(rows.map(r=>r.year),[2026,2025]);
  assert.equal(rows[0].preliminary,1575313); assert.equal(rows[0].market,1575313); assert.equal(rows[0].assessed,1377354);
  assert.equal(rows[1].preliminary,1365039); assert.equal(rows[1].market,1365039); assert.equal(rows[1].assessed,1252140);
  assert.equal(changeLabel(rows[0].annual),'+$210,274 / 15.4%');
  assert.equal(changeLabel(rows[1].annual),'Not available');
  assert.equal(changeLabel(rows[0].within),'Unchanged'); assert.equal(changeLabel(rows[1].within),'Unchanged');
  assert.match(capGapSummary(rows),/widened from \$112,899 in 2025 to \$197,959 in 2026/);
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
  const rows=annualHistory(parseHistory(par11Fixture('999115').overview.history));
  assert.equal(rows[0].annual.dollars,25000);
});
test('preliminary-only current year has available preliminary values but no certified bars or annual comparison',()=>{
  const row=annualHistory(parseHistory(par11Fixture('999118').overview.history))[0];
  assert.equal(row.year,2027); assert.equal(row.status,'Preliminary only');
  assert.equal(row.preliminary,685000); assert.equal(row.afterCap,590000);
  assert.equal(row.market,null); assert.equal(row.assessed,null); assert.equal(row.annual,null); assert.equal(row.within,null);
});
test('unknown amounts/dates and zero bases remain explicit; axes include zero and bound every bar',()=>{
  const base=snapshots.find(s=>s.tax_year===2026&&s.roll_stage==='certified');
  const prior={...base,dataset_id:'prior',tax_year:2025,export_date:'2025-07-18',market_value:0,assessed_value:0};
  const rows=annualHistory([prior,{...base,market_value:20}]);
  assert.equal(changeLabel(rows[0].annual),'+$20');
  assert.equal(annualHistory([{...prior,market_value:null},base])[0].annual,null);
  assert.equal(annualHistory([{...prior,export_date:null},base])[0].annual,null);
  assert.equal(capGapSummary([{...rows[0],market:1,assessed:2},rows[1]]),null);
  for(const amounts of [[0,0],[1,2],[1575313,1377354],[123456789,100000000],[null,null]]) {
    const scale=chartScale([{...rows[0],market:amounts[0],assessed:amounts[1]}]);
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
