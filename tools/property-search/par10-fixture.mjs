import { par9Reference } from './par9-reference-fixture.mjs';
// Synthetic variations for conditional copy and layout stress, never production data.
export function par10Fixture(id) {
  if (!['999010','999011','999012','999013','999014','999015','999016','999017'].includes(id)) return null;
  const result = structuredClone(par9Reference);
  const profile = result.overview.profile.property;
  profile.property_id = id;
  profile.address = '10 SYNTHETIC QA STREET';
  const current = result.overview.history.snapshots.find(s => s.tax_year === 2026 && s.roll_stage === 'certified');
  const preliminary = result.overview.history.snapshots.find(s => s.tax_year === 2026 && s.roll_stage === 'preliminary');
  const previous = result.overview.history.snapshots.find(s => s.tax_year === 2025 && s.roll_stage === 'certified');
  const setCurrentValues = (market,assessed) => {
    current.market_value=market;current.assessed_value=assessed;
    current.entities.forEach(entity=>{entity.taxable_value=Math.max(0,assessed-Object.values(entity.exemptions).reduce((sum,value)=>sum+value,0));});
  };
  if (id === '999010') {
    current.market_value = 123456789; current.assessed_value = 100000000;
    current.entities = [{code:'QA', name:'Synthetic school district with an intentionally long authority name', taxable_value:99800000, exemptions:{HS:200000}}];
    current.components.push({id:'long',improvement_id:'long-building',code:'CUSTOM',description:'A separately valued detached workshop and covered outdoor entertaining structure with an intentionally long feature name',area:4000,value:12345678,class_code:null,year_built:null});
  } else if (id === '999011') current.market_value = current.assessed_value;
  else if (id === '999012') { current.exemptions = []; current.entities = []; }
  else if (id === '999013') { current.market_value = null; current.assessed_value = null; current.components = []; current.entities = []; }
  else {
    preliminary.market_value=1611803;preliminary.assessed_value=1353650;
    previous.market_value=1290000;
    if(id==='999014') {
      setCurrentValues(1285275,1285275);
      result.overview.history.protest_observations=[{dataset_id:'synthetic-par51-protest',tax_year:2026,export_date:'2026-05-08',export_time_raw:null,protest_flag:true,arb_case_listed:true,arb_agent_listed:false,arb_agent_name:null,arb_status_codes:['EF']}];
    } else if(id==='999015') setCurrentValues(1450000,1353650);
    else if(id==='999016') setCurrentValues(1450000,1300000);
    else {
      result.overview.history.snapshots=result.overview.history.snapshots.filter(s=>s!==preliminary);
      setCurrentValues(1285275,1285275);
    }
  }
  profile.market_value = current.market_value; profile.assessed_value = current.assessed_value;
  return result;
}
