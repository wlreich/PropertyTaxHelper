import history from './par11-reference-history.json' with { type: 'json' };
import { par9Reference } from './par9-reference-fixture.mjs';

// Public property_history RPC captured 2026-09-19. No owners or private appeal
// values. Other IDs below are explicitly synthetic normalized-history cases.
export const par11Reference = structuredClone(par9Reference);
par11Reference.overview.history = history;
export function par11Fixture(id) {
  if (id === '736164') return par11Reference;
  if (!['999110','999111','999115','999116','999117','999118','999119'].includes(id)) return null;
  const result = structuredClone(par11Reference);
  const base = history.snapshots.find(s => s.tax_year === 2026 && s.roll_stage === 'certified');
  const makeYear = year => {
    const certified = {...structuredClone(base), dataset_id:`synthetic-certified-${year}`, tax_year:year,
      export_date:`${year}-07-18`, export_time_raw:`07/18/${year} 12:00`, market_value:500000+(year-2020)*25000,
      assessed_value:450000+(year-2020)*20000, protest_flag:false, arb_case_listed:false, arb_agent_listed:false};
    const preliminary = {...structuredClone(certified), dataset_id:`synthetic-preliminary-${year}`, roll_stage:'preliminary', export_date:`${year}-04-02`, export_time_raw:`04/02/${year} 12:00`, preliminary_baseline_eligible:true, market_value:certified.market_value+10000};
    return [preliminary, certified];
  };
  const years = id === '999110' ? [] : id === '999111' ? [2026] : id === '999115' ? [2022,2023,2024,2025,2026] : id === '999117' ? [2024,2026] : [2021,2022,2023,2024,2025,2026];
  result.overview.history = {snapshots:years.flatMap(makeYear), protest_observations:[]};
  if (id === '999118') result.overview.history.snapshots = [...makeYear(2026),makeYear(2027)[0]];
  if (id === '999119') {
    result.overview.history = structuredClone(history);
    result.overview.history.snapshots.find(s => s.dataset_id === '4cb28ab3-6d6b-4046-8b29-f25258195de1').preliminary_baseline_eligible = false;
  }
  const profile = result.overview.profile.property;
  profile.property_id=id; profile.address='11 SYNTHETIC HISTORY STREET';
  const latest = result.overview.history.snapshots.at(-1);
  if (latest) for (const key of ['tax_year','roll_stage','export_time_raw','market_value','assessed_value','land_value','improvement_value']) profile[key]=latest[key];
  result.adjustment=null;
  return result;
}
