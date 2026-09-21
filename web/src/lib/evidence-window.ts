import {validDate} from './seasons.ts';
import type {ActivityData,ActivityRow} from './property-activity.ts';
export type EvidenceWindow={targetYear:number;start:string;end:string};
export type EvidenceQuery=Record<string,string|string[]|undefined>;
export type WindowActivity={window:EvidenceWindow;datasets:ActivityData[];years:number[];missingYears:number[];failedYears:number[];rows:ActivityRow[];neighborhood:string|null};
export function defaultEvidenceWindow(targetYear:number):EvidenceWindow{return {targetYear,start:`${targetYear-1}-01-01`,end:`${targetYear-1}-12-31`};}
export function evidenceWindowError(w:EvidenceWindow):string|null{
 if(!Number.isInteger(w.targetYear)||w.targetYear<1901||w.targetYear>2200)return 'Enter a target appraisal year from 1901 to 2200.';
 if(!validDate(w.start)||!validDate(w.end)||w.start<'1900-01-01'||w.end>'2200-12-31'||w.start>w.end)return 'Enter valid start and end dates, with the start on or before the end.';
 if(Number(w.end.slice(0,4))-Number(w.start.slice(0,4))>4)return 'Choose a research window spanning no more than five calendar years.';
 return null;
}
export function readEvidenceWindow(query:EvidenceQuery,defaultYear:number){
 const legacy=typeof query.activityYear==='string'&&/^\d{4}$/.test(query.activityYear)?Number(query.activityYear)+1:defaultYear;
 const target=query.targetYear===undefined?legacy:typeof query.targetYear==='string'&&/^\d{4}$/.test(query.targetYear)?Number(query.targetYear):NaN;
 const defaults=defaultEvidenceWindow(target);
 const window={targetYear:target,start:query.evidenceStart===undefined?defaults.start:typeof query.evidenceStart==='string'?query.evidenceStart:'',end:query.evidenceEnd===undefined?defaults.end:typeof query.evidenceEnd==='string'?query.evidenceEnd:''};
 return {window,error:evidenceWindowError(window)};
}
export function evidenceParams(w:EvidenceWindow){return new URLSearchParams({targetYear:String(w.targetYear),evidenceStart:w.start,evidenceEnd:w.end});}
export function evidenceYears(w:EvidenceWindow){return Array.from({length:Number(w.end.slice(0,4))-Number(w.start.slice(0,4))+1},(_,i)=>Number(w.start.slice(0,4))+i);}
export function inEvidenceWindow(date:string|null,w:EvidenceWindow){return date!==null&&validDate(date)&&date>=w.start&&date<=w.end;}
export function windowActivity(window:EvidenceWindow,datasets:ActivityData[],years:number[],failedYears:number[]=[]):WindowActivity{
 const seen=new Set<string>();const rows=datasets.flatMap(d=>d.rows).filter(r=>{
  if(!inEvidenceWindow(r.deed_date,window)&&!inEvidenceWindow(r.sale_date,window))return false;
  const key=r.property_id+':'+r.event_key;if(seen.has(key))return false;seen.add(key);return true;
 });
 return {window,datasets,years,failedYears,missingYears:evidenceYears(window).filter(y=>!years.includes(y)),rows,neighborhood:datasets[0]?.neighborhood??null};
}
export function evidenceCoverage(data:WindowActivity):string{
 const pieces=data.datasets.map(d=>{const through=[`${d.year}-12-31`,[d.sources.appraisal_export_date,d.sources.sales_export_date].sort().at(-1)!].sort()[0];return `${d.year}: records available through ${through}${through<[data.window.end,`${d.year}-12-31`].sort()[0]?' (later dates are not covered)':''}; source exports: appraisal ${d.sources.appraisal_export_date}, supplemental ${d.sources.sales_export_date}`;});
 if(data.missingYears.length)pieces.push(`Coverage unavailable for ${data.missingYears.join(', ')}`);
 if(data.failedYears.length)pieces.push(`Activity temporarily unavailable for ${data.failedYears.join(', ')}`);
 return pieces.length?pieces.join('. '):'Activity coverage is unavailable';
}
export function activitySelection(value:unknown):Set<string>{
 if(typeof value!=='string'||value.length>50000)return new Set();
 try{const keys:unknown=JSON.parse(value);return new Set(Array.isArray(keys)&&keys.length<=100&&keys.every(k=>typeof k==='string'&&k.length<=520)?keys:[]);}catch{return new Set();}
}
