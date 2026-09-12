import "server-only";
import { rpc } from "./properties.ts";
import { validPropertyId, validSource, suggestions, type ComparisonData, type ComparisonProperty, type ComparisonRelease } from "../property-comparisons.ts";
import { parseSearch } from "../property-search.ts";
import { parseCostRecords, withCosts } from "../tcad-costs.ts";
const object=(v:unknown):v is Record<string,unknown>=>typeof v==="object" && v!==null && !Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==="string" && v.length<=250;
const nullableText=(v:unknown)=>v===null||text(v);
const amount=(v:unknown)=>v===null || typeof v==="number" && Number.isFinite(v) && v>=0;
function property(v:unknown):ComparisonProperty|null {
  if(!object(v)||!text(v.property_id)||!validPropertyId(v.property_id)||![v.address,v.city,v.property_type].every(text)
    ||![v.market_value,v.land_value,v.land_acres,v.living_area,v.year_built].every(amount)
    ||![v.neighborhood,v.class_code].every(nullableText)||!Number.isSafeInteger(v.main_buildings)||Number(v.main_buildings)<0) return null;
  return {property_id:v.property_id,address:v.address as string,city:v.city as string,property_type:v.property_type as string,
    market_value:v.market_value as number|null,land_value:v.land_value as number|null,land_acres:v.land_acres as number|null,
    neighborhood:v.neighborhood as string|null,living_area:v.living_area as number|null,class_code:v.class_code as string|null,
    year_built:v.year_built as number|null,main_buildings:v.main_buildings as number};
}
function release(v:unknown):ComparisonRelease|null {
  if(!object(v)||!text(v.dataset_id)||!validSource(v.dataset_id)||!Number.isInteger(v.tax_year)||Number(v.tax_year)<1900||Number(v.tax_year)>2200
    ||!["preliminary","certified","supplemental"].includes(String(v.roll_stage))
    ||!(v.export_date===null||typeof v.export_date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v.export_date))) return null;
  return {dataset_id:v.dataset_id,tax_year:v.tax_year as number,roll_stage:v.roll_stage as string,export_date:v.export_date as string|null};
}
export function parseComparison(value:unknown,id:string):ComparisonData|null {
  if(!object(value)||value.available!==true||value.status!=="ok"||!text(value.anchor_id)||!validSource(value.anchor_id))return null;
  const subject=property(value.subject), current=release(value.release);
  if(!subject||subject.property_id!==String(Number(id))||!current||!Array.isArray(value.releases)||value.releases.length>100)return null;
  const releases=value.releases.map(release);
  if(releases.some(r=>!r)||!releases.some(r=>r?.dataset_id===current.dataset_id))return null;
  const lists:ComparisonProperty[][]=[];
  for(const [key,max] of [["candidates",2001],["selected",10],["matches",20]] as const){
    const list=value[key]; if(!Array.isArray(list)||list.length>max)return null;
    const parsed=list.map(property);if(parsed.some(p=>!p)||new Set(parsed.map(p=>p!.property_id)).size!==parsed.length)return null;
    lists.push(parsed as ComparisonProperty[]);
  }
  if(typeof value.candidate_limit_reached!=="boolean"||typeof value.search_has_more!=="boolean")return null;
  return {anchor_id:value.anchor_id,subject,release:current,releases:releases as ComparisonRelease[],candidates:lists[0].slice(0,2000),selected:lists[1],matches:lists[2],candidate_limit_reached:value.candidate_limit_reached,search_has_more:value.search_has_more};
}
export async function getComparisons(id:string,source:string|null=null,selected:string[]=[],query="",page=0,
  config={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetchRequest:typeof fetch=fetch) {
  if(!validPropertyId(id)||source!==null&&!validSource(source)||selected.length>10||!selected.every(validPropertyId)||query!==""&&parseSearch(query).error||!Number.isInteger(page)||page<0||page>249)return {status:"invalid" as const};
  const v=await rpc("property_comparisons",{p_id:id,...(source?{p_source:source}:{}),p_selected:selected,p_query:query,p_page:page},config,fetchRequest);
  if(object(v)&&v.available===true&&v.status==="missing_property")return {status:"not_found" as const};
  if(object(v)&&v.available===true&&v.status==="missing_snapshot")return {status:"missing_snapshot" as const};
  const data=parseComparison(v,id);
  if(!data) return {status:"unavailable" as const};
  const ids=[...new Set([data.subject,...data.selected,...data.matches,...suggestions(data)].map(p=>p.property_id))].slice(0,32);
  const costs=await rpc("property_comparison_costs",{p_anchor:data.anchor_id,p_source:data.release.dataset_id,p_ids:ids},config,fetchRequest);
  const records=parseCostRecords(costs,data.anchor_id,data.release.dataset_id,data.release.tax_year);
  if(records) {
    const byId=new Map(records.map(r=>[r.property_id,r]));
    const enrich=(p:ComparisonProperty)=>withCosts(p,byId.get(p.property_id));
    data.subject=enrich(data.subject); data.candidates=data.candidates.map(enrich); data.selected=data.selected.map(enrich);data.matches=data.matches.map(enrich);
    // Primary-building refinement can change suggestion order. Hydrate newly
    // suggested properties too, so selecting any visible suggestion has costs.
    const newlySuggested=suggestions(data).filter(p=>!ids.includes(p.property_id)).map(p=>p.property_id);
    if(newlySuggested.length) {
      const extra=await rpc("property_comparison_costs",{p_anchor:data.anchor_id,p_source:data.release.dataset_id,p_ids:newlySuggested},config,fetchRequest);
      const parsed=parseCostRecords(extra,data.anchor_id,data.release.dataset_id,data.release.tax_year);
      if(parsed) {for(const record of parsed) byId.set(record.property_id,record);data.candidates=data.candidates.map(enrich);}
    }
  }
  return {status:"ok" as const,data};
}
