import type {ActivityData} from './property-activity.ts';
export type ComparisonEvidence = {start:string;end:string;coverage:string|null;deedDate:string|null;available:boolean};
// Research dates are independent of appraisal releases. Only the preceding
// calendar year is shown; later transfers never enter an earlier interpretation.
export function comparisonEvidence(data:ActivityData|null,propertyId:string,appraisalYear:number):ComparisonEvidence {
 const year=appraisalYear-1,start=`${year}-01-01`,end=`${year}-12-31`;
 if(!data||data.year!==year)return {start,end,coverage:null,deedDate:null,available:false};
 const rows=data.rows.filter(r=>r.property_id===propertyId&&r.deed_date!==null&&r.deed_date>=start&&r.deed_date<=end)
  .sort((a,b)=>b.deed_date!.localeCompare(a.deed_date!));
 return {start,end,coverage:`appraisal ${data.sources.appraisal_export_date}, supplemental ${data.sources.sales_export_date}`,deedDate:rows[0]?.deed_date??null,available:true};
}
