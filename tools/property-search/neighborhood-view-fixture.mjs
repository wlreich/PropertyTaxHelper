// Synthetic rendering variants only; production source selection remains in the RPC.
export function neighborhoodViewFixture(base,id) {
 if(!['9200','9201','9202','9203','9204','9205','9290'].includes(id))return base;
 const d=structuredClone(base),small=id==='9203',empty=id==='9204',pre=id==='9201',extra=id==='9202';
 d.subject.property_id=id;d.subject.address=id==='9290'?'290 LONG SYNTHETIC CYPRESS RIDGE NEIGHBORHOOD STREET NORTHWEST':'456 EXAMPLE LANE';d.subject.market_value=pre?600000:450000;
 const years=extra?[2024,2025,2026]:[2025,2026];
 d.releases=[];d.annual_periods=[];
 d.agent_assignments=[];
 d.homes=Array.from({length:empty?0:small?3:12},(_,i)=>({...structuredClone(base.homes[0]),property_id:i===0?id:String(9300+i),market:450000+i*10000,area:2000+i*50}));
 for(const year of years)for(const stage of ['preliminary','certified']) {
  if(pre&&year===2026&&stage==='certified')continue;
  const release={dataset_id:`${year}${stage==='preliminary'?'0000':'1111'}-1111-4111-8111-111111111111`,tax_year:year,roll_stage:stage,export_date:`${year}-${stage==='preliminary'?'04-02':'07-18'}`,preliminary_baseline_eligible:true};
  d.releases.push(release);
  const homes=d.homes.map((h,i)=>({property_id:h.property_id,market:stage==='preliminary'?600000+i*10000:450000+i*10000,area:h.area,protested:false,exclusion:null}));
  const caps=stage==='preliminary'?d.homes.map(h=>({property_id:h.property_id,eligible:true,above:true,threshold:550000})):[];
  d.annual_periods.push({release,homes,caps});
 }
 const fixtureAgents=['FIVE STONE PROPERTY TAX','OWNWELL INC','TEXAS PROTAX - ONTIVEROS ALEX','PLATINUM PROPERTY TAX','GILL, DENSON & COMPANY','TEXAS TAX PROTEST'];
 for(const year of years)for(const [i,home] of d.homes.entries())if(i<10)d.agent_assignments.push({property_id:home.property_id,tax_year:year,agent_name:fixtureAgents[Math.min(i,fixtureAgents.length-1)],status:'named'});
 const current=d.releases.at(-1);d.source_id=current.dataset_id;d.anchor_id=current.dataset_id;
 d.preliminary_id=d.releases.find(r=>r.tax_year===2026&&r.roll_stage==='preliminary').dataset_id;
 d.certified_id=pre?null:current.dataset_id;d.prior_id=d.releases.find(r=>r.tax_year===2025&&r.roll_stage==='certified').dataset_id;
 d.population={candidate_count:d.homes.length,excluded:[],land_code_mismatch:0,multiple_buildings:0};
 d.caps=d.annual_periods.find(p=>p.release.dataset_id===d.preliminary_id).caps;
 d.market_adjustment=empty?null:{...base.market_adjustment,homes:d.homes.map(h=>({...base.market_adjustment.homes[0],property_id:h.property_id}))};
 if(id==='9205'){
  for(const period of d.annual_periods){
   if(period.release.tax_year===2025&&period.release.roll_stage==='certified')for(const [i,h] of period.homes.entries())h.market=600000+i*10000;
   if(period.release.roll_stage==='preliminary')period.caps=period.homes.map(h=>({property_id:h.property_id,eligible:false,above:null,threshold:null}));
  }
  d.caps=d.annual_periods.find(p=>p.release.dataset_id===d.preliminary_id).caps;
 }
 if(empty){d.subject.living_area=null;d.subject.market_value=null;d.annual_periods=[];d.agent_assignments=[];}
 return d;
}
