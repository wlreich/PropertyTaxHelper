import 'server-only';
import {rpc} from './properties.ts';
import {validPropertyId,validSource} from '../property-comparisons.ts';
import {exclusionLabels,type Neighborhood,type Home,type Cap,type Population} from '../neighborhood.ts';
import type {ComparisonProperty,ComparisonRelease} from '../property-comparisons.ts';
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const amount=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
const nullableBool=(v:unknown)=>v===null||typeof v==='boolean';
export function parseNeighborhood(v:unknown,id:string):Neighborhood|null {
 if(!object(v)||v.available!==true||v.status!=='ok'||typeof v.anchor_id!=='string'||!validSource(v.anchor_id)||typeof v.source_id!=='string'||!validSource(v.source_id)
  ||typeof v.neighborhood!=='string'||v.neighborhood.length>100||!(v.subdivision===null||typeof v.subdivision==='string'&&v.subdivision.length<=250)||!object(v.subject)||v.subject.property_id!==String(Number(id))
  ||!Array.isArray(v.releases)||v.releases.length>100||!Array.isArray(v.homes)||v.homes.length>10000||!Array.isArray(v.caps)||v.caps.length>10000)return null;
 const releases:ComparisonRelease[]=[];
 for(const r of v.releases){if(!object(r)||typeof r.dataset_id!=='string'||!validSource(r.dataset_id)||!Number.isInteger(r.tax_year)||Number(r.tax_year)<1900||Number(r.tax_year)>2200||!['preliminary','certified','supplemental'].includes(String(r.roll_stage))||!(r.export_date===null||typeof r.export_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.export_date)))return null;
  releases.push({dataset_id:r.dataset_id,tax_year:r.tax_year as number,roll_stage:r.roll_stage as string,export_date:r.export_date as string|null});}
 if(new Set(releases.map(r=>r.dataset_id)).size!==releases.length||!releases.some(r=>r.dataset_id===v.source_id)||![v.preliminary_id,v.certified_id,v.prior_id].every(x=>x===null||releases.some(r=>r.dataset_id===x)))return null;
 const s=v.subject;
 if(![s.address,s.city,s.property_type].every(x=>typeof x==='string'&&x.length<250)||![s.market_value,s.land_value,s.land_acres,s.living_area,s.year_built].every(amount)||![s.neighborhood,s.class_code].every(x=>x===null||typeof x==='string')||!Number.isSafeInteger(s.main_buildings)||Number(s.main_buildings)<0)return null;
 const subject:ComparisonProperty={property_id:s.property_id as string,address:s.address as string,city:s.city as string,property_type:s.property_type as string,market_value:s.market_value as number|null,land_value:s.land_value as number|null,land_acres:s.land_acres as number|null,living_area:s.living_area as number|null,year_built:s.year_built as number|null,neighborhood:s.neighborhood as string|null,class_code:s.class_code as string|null,main_buildings:s.main_buildings as number};
 const homes:Home[]=[],caps:Cap[]=[];
 for(const h of v.homes){if(!object(h)||typeof h.property_id!=='string'||!validPropertyId(h.property_id)||![h.market,h.area,h.preliminary,h.certified,h.certified_area,h.prior].every(amount)||typeof h.protested!=='boolean'||!Array.isArray(h.entities)||h.entities.length>100)return null;
  const entities:{code:string;name:string}[]=[];
  for(const e of h.entities){if(!object(e)||typeof e.code!=='string'||e.code.length>30||typeof e.name!=='string'||e.name.length>250)return null;entities.push({code:e.code,name:e.name});}
  homes.push({property_id:h.property_id,market:h.market as number|null,area:h.area as number|null,preliminary:h.preliminary as number|null,certified:h.certified as number|null,certified_area:h.certified_area as number|null,prior:h.prior as number|null,protested:h.protested,entities});}
 for(const c of v.caps){if(!object(c)||typeof c.property_id!=='string'||!validPropertyId(c.property_id)||!nullableBool(c.eligible)||!nullableBool(c.above)||!amount(c.threshold)||!homes.some(h=>h.property_id===c.property_id))return null;
  if(c.threshold!==null&&(c.eligible!==true||c.above!==true||Number(c.threshold)<=0))return null;
  caps.push({property_id:c.property_id,eligible:c.eligible as boolean|null,above:c.above as boolean|null,threshold:c.threshold as number|null});}
 if(new Set(homes.map(h=>h.property_id)).size!==homes.length||new Set(caps.map(c=>c.property_id)).size!==caps.length)return null;
 const p=v.population;
 if(!object(p)||![p.candidate_count,p.land_code_mismatch,p.multiple_buildings].every(n=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000)||!Array.isArray(p.excluded)||p.excluded.length>10000)return null;
 const excluded:Population['excluded']=[];
 for(const e of p.excluded){if(!object(e)||typeof e.property_id!=='string'||!validPropertyId(e.property_id)||typeof e.reason!=='string'||!Object.hasOwn(exclusionLabels,e.reason)||homes.some(h=>h.property_id===e.property_id))return null;
  excluded.push({property_id:e.property_id,reason:e.reason as keyof typeof exclusionLabels});}
 if(new Set(excluded.map(e=>e.property_id)).size!==excluded.length||p.candidate_count!==homes.length+excluded.length||Number(p.land_code_mismatch)>homes.length||Number(p.multiple_buildings)>homes.length)return null;
 const population:Population={candidate_count:p.candidate_count as number,land_code_mismatch:p.land_code_mismatch as number,multiple_buildings:p.multiple_buildings as number,excluded};
 return {anchor_id:v.anchor_id,source_id:v.source_id,neighborhood:v.neighborhood,subdivision:v.subdivision as string|null,releases,preliminary_id:v.preliminary_id as string|null,certified_id:v.certified_id as string|null,prior_id:v.prior_id as string|null,subject,homes,caps,population};
}
export async function getNeighborhood(id:string,source:string|null=null) {
 if(!validPropertyId(id)||source!==null&&!validSource(source))return {status:'invalid' as const};
 const v=await rpc('property_neighborhood_v3',{p_id:id,...(source?{p_source:source}:{})},{SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetch);
 if(object(v)&&v.available===true&&['missing_property','missing_snapshot','missing_area','area_too_large'].includes(String(v.status)))return {status:v.status as 'missing_property'|'missing_snapshot'|'missing_area'|'area_too_large'};
 const data=parseNeighborhood(v,id);return data?{status:'ok' as const,data}:{status:'unavailable' as const};
}
