import { par9Reference } from './par9-reference-fixture.mjs';
// Synthetic variations for conditional copy and layout stress, never production data.
export function par10Fixture(id) {
  if (!['999010','999011','999012','999013'].includes(id)) return null;
  const result = structuredClone(par9Reference);
  const profile = result.overview.profile.property;
  profile.property_id = id;
  profile.address = '10 SYNTHETIC QA STREET';
  const current = result.overview.history.snapshots.find(s => s.tax_year === 2026 && s.roll_stage === 'certified');
  if (id === '999010') {
    current.market_value = 123456789; current.assessed_value = 100000000;
    current.entities = [{code:'QA', name:'Synthetic school district with an intentionally long authority name', taxable_value:99800000, exemptions:{HS:200000}}];
    current.components.push({id:'long',improvement_id:'long-building',code:'CUSTOM',description:'A separately valued detached workshop and covered outdoor entertaining structure with an intentionally long feature name',area:4000,value:12345678,class_code:null,year_built:null});
  } else if (id === '999011') current.market_value = current.assessed_value;
  else if (id === '999012') { current.exemptions = []; current.entities = []; }
  else { current.market_value = null; current.assessed_value = null; current.components = []; current.entities = []; }
  profile.market_value = current.market_value; profile.assessed_value = current.assessed_value;
  return result;
}
