import type {ActivityData} from './property-activity.ts';
import {defaultEvidenceWindow,windowActivity,inEvidenceWindow,evidenceCoverage,type WindowActivity,type EvidenceWindow} from './evidence-window.ts';
export type ComparisonEvidence = {start:string;end:string;coverage:string|null;deedDate:string|null;available:boolean;targetYear:number};
export function comparisonEvidence(data:ActivityData|WindowActivity|null,propertyId:string,target:number|EvidenceWindow):ComparisonEvidence {
 const window=typeof target==='number'?defaultEvidenceWindow(target):target;
 const scoped=data&&('datasets' in data?data:windowActivity(window,data.year>=Number(window.start.slice(0,4))&&data.year<=Number(window.end.slice(0,4))?[data]:[],[data.year]));
 const rows=scoped?.rows.filter(r=>r.property_id===propertyId&&inEvidenceWindow(r.deed_date,window)).sort((a,b)=>b.deed_date!.localeCompare(a.deed_date!))??[];
 return {start:window.start,end:window.end,targetYear:window.targetYear,coverage:scoped?evidenceCoverage(scoped):null,deedDate:rows[0]?.deed_date??null,available:!!scoped?.datasets.length};
}
