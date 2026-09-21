import {validDate} from './seasons.ts';
import {SITE_URL} from './site.ts';
export type ActivityRow={
 property_id:string;event_key:string;address:string;city:string;property_type:'single_family'|'land'|'other';
 deed_date:string|null;sale_date:string|null;activity_date:string;filed_date:string|null;instrument:string|null;
 deed_type:string|null;sale_type:string|null;sale_source:string|null;status:'deed_change'|'sale_recorded';
 price:number|null;price_status:'reported'|'not_reported'|'multi_property';
 match_method:'deed_id'|'instrument'|'unique_date'|null;deed_source:'appraisal'|'supplemental'|null;
};
export type ActivityData={year:number;years:number[];neighborhood:string;sources:{appraisal_export_date:string;sales_export_date:string};rows:ActivityRow[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length<=500;
const date=(v:unknown):v is string=>typeof v==='string'&&validDate(v);
const year=(v:unknown):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=1900&&v<=2200;
export const activityKey=(r:ActivityRow)=>r.property_id+':'+r.event_key;
export const activityStatus=(r:ActivityRow)=>r.status==='deed_change'?'Deed change · Sale unconfirmed':'Sale recorded · Verify details';
export const activityPrice=(r:ActivityRow)=>r.price_status==='multi_property'?'Not allocated to this property':r.price===null?'Not reported':r.price.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0});
export const activityTypes={all:'All property types',single_family:'Single-family homes',land:'Land only',other:'Other / type not reported'};
export type ActivityFilter=keyof typeof activityTypes;
export function parseActivity(v:unknown):ActivityData|null{
 if(!object(v)||v.status!=='ok'||!year(v.year)||!Array.isArray(v.years)||v.years.length>301||!v.years.every(year)||new Set(v.years).size!==v.years.length||!v.years.includes(v.year)||!text(v.neighborhood)||!v.neighborhood||!object(v.sources)||!date(v.sources.appraisal_export_date)||!date(v.sources.sales_export_date)||!Array.isArray(v.rows)||v.rows.length>10000)return null;
 const seen=new Set<string>(),rows:ActivityRow[]=[];
 for(const r of v.rows){
  if(!object(r)||typeof r.property_id!=='string'||!/^[1-9][0-9]{0,11}$/.test(r.property_id)||!text(r.event_key)||!r.event_key||!text(r.address)||!text(r.city)||
   !['single_family','land','other'].includes(String(r.property_type))||!['deed_change','sale_recorded'].includes(String(r.status))||!['reported','not_reported','multi_property'].includes(String(r.price_status))||
   ![null,'deed_id','instrument','unique_date'].includes(r.match_method as string|null)||![null,'appraisal','supplemental'].includes(r.deed_source as string|null)||
   !['deed_type','sale_type','sale_source','instrument'].every(k=>r[k]===null||text(r[k]))||
   !['deed_date','sale_date','filed_date'].every(k=>r[k]===null||date(r[k]))||!date(r.activity_date)||r.activity_date!==(r.deed_date??r.sale_date)||r.activity_date.slice(0,4)!==String(v.year)||
   r.status==='sale_recorded'&&r.sale_date===null||r.status==='deed_change'&&(r.deed_date===null||r.sale_date!==null||r.price_status!=='not_reported')||
   (r.price_status==='reported'?typeof r.price!=='number'||!Number.isFinite(r.price)||r.price<=0||r.price>1e15:r.price!==null))return null;
  if(typeof r.deed_date==='string'&&(r.deed_source===null||r.deed_date>(r.deed_source==='appraisal'?v.sources.appraisal_export_date:v.sources.sales_export_date))||
   typeof r.sale_date==='string'&&(r.sale_date>v.sources.sales_export_date||r.sale_date.slice(0,4)!==String(v.year)))return null;
  const row=r as ActivityRow,key=activityKey(row);if(seen.has(key))return null;seen.add(key);
  // Explicit allowlist: additional RPC fields never become client props or exports.
  rows.push({property_id:row.property_id,event_key:row.event_key,address:row.address,city:row.city,property_type:row.property_type,
   deed_date:row.deed_date,sale_date:row.sale_date,activity_date:row.activity_date,filed_date:row.filed_date,instrument:row.instrument,
   deed_type:row.deed_type,sale_type:row.sale_type,sale_source:row.sale_source,status:row.status,price:row.price,price_status:row.price_status,match_method:row.match_method,deed_source:row.deed_source});
 }
 return {year:v.year,years:v.years,neighborhood:v.neighborhood,sources:{appraisal_export_date:v.sources.appraisal_export_date,sales_export_date:v.sources.sales_export_date},rows};
}
export function activityRows(data:Pick<ActivityData,'rows'>,type:ActivityFilter,sort:string){
 return data.rows.filter(r=>type==='all'||r.property_type===type).sort((a,b)=>(sort==='address'?a.address.localeCompare(b.address,'en',{numeric:true}):(sort==='oldest'?1:-1)*a.activity_date.localeCompare(b.activity_date))||activityKey(a).localeCompare(activityKey(b)));
}
const cell=(value:string|number|null)=>{
 let s=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
export function activityCsv(data:ActivityData,selected:Set<string>){
 const header=['Property ID','Address','City','Neighborhood','Activity year','Deed date','Sale date','Filing date','Record status','Sale price reported by TCAD','Price availability','Instrument','Deed source','Appraisal export','Supplemental export','Property link','Ask a realtor'];
 const rows=data.rows.filter(r=>selected.has(activityKey(r))).map(r=>[r.property_id,r.address,r.city,data.neighborhood,data.year,r.deed_date,r.sale_date,r.filed_date,activityStatus(r),r.price,r.price_status==='reported'?'TCAD-reported; verify':activityPrice(r),r.instrument,r.deed_source,data.sources.appraisal_export_date,data.sources.sales_export_date,SITE_URL.replace(/\/$/,'')+'/property/'+r.property_id,'Confirm whether this was an arm’s-length sale, closing date and price, concessions, condition, and comparability. Coverage is incomplete; a nearby property is not automatically a comparable.']);
 return '\uFEFF'+[header,...rows].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}

export function activityWindowCsv(data:import('./evidence-window.ts').WindowActivity,selected:Set<string>,type:ActivityFilter='all',sort='newest'){
 const header=['Target appraisal year','Evidence start','Evidence end','Property filter','Sort order','Coverage unavailable years','Temporarily unavailable years','Property ID','Address','City','Neighborhood','Activity year','Deed date','Sale date','Filing date','Record status','Sale price reported by Appraisal District','Price availability','Instrument','Deed source','Appraisal export','Supplemental export','Property link','Ask a realtor'];
 const rows=activityRows(data,'all',sort).filter(r=>selected.has(activityKey(r))).map(r=>{
  const source=data.datasets.find(d=>d.rows.some(x=>activityKey(x)===activityKey(r)));
  return [data.window.targetYear,data.window.start,data.window.end,activityTypes[type],sort,data.missingYears.join('; '),data.failedYears.join('; '),r.property_id,r.address,r.city,data.neighborhood,source?.year??null,r.deed_date,r.sale_date,r.filed_date,activityStatus(r),r.price,r.price_status==='reported'?'Appraisal District-reported; verify':activityPrice(r),r.instrument,r.deed_source,source?.sources.appraisal_export_date??null,source?.sources.sales_export_date??null,SITE_URL.replace(/\/$/,'')+'/property/'+r.property_id,'Confirm whether this was an arm’s-length sale, closing date and price, concessions, condition, and comparability. Export dates are not transaction dates. Coverage is incomplete.'];
 });
 return '\uFEFF'+[header,...rows].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
