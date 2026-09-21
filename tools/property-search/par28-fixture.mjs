import {reference} from './par28-reference.mjs';
// All records and neighborhood cohorts below are synthetic pagination cases.
export function par28Fixture(id) {
 if(!['999283','999280','999281','999282'].includes(id))return null;
 const r=structuredClone(reference),p=r.overview.profile.property,h=r.overview.history;
 p.property_id=id;
 if(id==='999283')return r;
 p.address=id==='999280'?'28 SYNTHETIC DENSE INVENTORY STREET':id==='999281'?'28 SYNTHETIC LONG HISTORY STREET':'28 SYNTHETIC LIMITED RECORD STREET';
 r.adjustment=null;h.protest_observations=[];
 const base=h.snapshots.at(-1);
 if(id==='999280') {
  base.components=Array.from({length:26},(_,i)=>({id:`detail-${i}`,improvement_id:String(i<6?1:i<18?2:3),code:`QA${i}`,description:`Feature ${String(i+1).padStart(2,'0')} — ${i===15?'Detached workshop with partially finished interior and covered walkway '.repeat(12):'Recorded structure with a long descriptive classification'}`,class_code:i<18?'R3':null,year_built:2014+i%8,area:100+i*13,value:i===25?123456789:12000+i*1000}));
 } else if(id==='999281') {
  h.snapshots=Array.from({length:26},(_,i)=>2026-i-(i>15?1:0)).flatMap(year=>{
   const c={...structuredClone(base),dataset_id:`report-certified-${year}`,tax_year:year,export_date:`${year}-07-18`,export_time_raw:`07/18/${year} 12:00`,market_value:500000+(year-2000)*14000,assessed_value:490000+(year-2000)*14000,components:[],entities:[]};
   const pre={...structuredClone(c),dataset_id:`report-proposed-${year}`,roll_stage:'preliminary',export_date:`${year}-04-02`,market_value:c.market_value+25000,preliminary_baseline_eligible:year!==2018};
   return year===2009?[c]:[pre,c];
  });
 } else {
  Object.assign(base,{roll_stage:'preliminary',export_date:'2026-04-02',export_time_raw:'04/02/2026 12:00',market_value:425000,assessed_value:null,land_value:null,improvement_value:null,land_acres:null,exemptions:[],entities:[],components:[{id:'floor',improvement_id:'1',code:'1ST',description:'Living area',area:1800,year_built:2006,class_code:null,value:null}]});h.snapshots=[base];
 }
 const latest=h.snapshots.filter(s=>s.tax_year===2026).at(-1);
 for(const key of ['tax_year','roll_stage','export_time_raw','market_value','assessed_value','land_value','improvement_value','land_acres'])p[key]=latest[key];
 return r;
}
export function par28Neighborhood(data,id) {
 if(id!=='999283'||!data?.homes)return {available:true,status:'missing_area'};
 const r=structuredClone(data),source=reference.overview.history.snapshots.at(-1).dataset_id;
 const old=r.source_id;r.source_id=source;for(const k of ['preliminary_id','certified_id','prior_id'])if(r[k]===old)r[k]=source;r.subject={...r.subject,property_id:id,address:'28 SYNTHETIC REFERENCE STREET',market_value:950000,living_area:3200};
 r.releases.forEach(x=>{if(x.dataset_id===old)x.dataset_id=source;});r.annual_periods.forEach(x=>{if(x.release.dataset_id===old)x.release.dataset_id=source;});
 r.neighborhood='SYNTHETIC QA COHORT';r.subject.neighborhood=r.neighborhood;
 return r;
}
