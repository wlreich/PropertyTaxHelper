import 'server-only';
import {rpc} from './properties.ts';
import {parseComparisonProperty} from './comparisons.ts';
import {parseCostRecords,withCosts,type CostRecord} from '../tcad-costs.ts';
import {comparisonMatch,validPropertyId,validSource,type MatchDescription} from '../property-comparisons.ts';
export type ActivityMatches={subjectId:string;sourceId:string;year:number;items:Record<string,MatchDescription>};
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export async function getActivityMatches(subjectId:string,sourceId:string,year:number,ids:string[],config={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetchRequest:typeof fetch=fetch):Promise<ActivityMatches|null>{
 const requested=[...new Set(ids)];
 if(!validPropertyId(subjectId)||!validSource(sourceId)||requested.length>50000||!requested.every(validPropertyId))return null;
 const v=await rpc('property_activity_match_inputs',{p_id:subjectId,p_source:sourceId,p_ids:requested},config,fetchRequest,'POST');
 if(!object(v)||v.available!==true||v.subject_id!==String(Number(subjectId))||v.source_id!==sourceId||typeof v.anchor_id!=='string'||!validSource(v.anchor_id)||!Array.isArray(v.items)||v.items.length>50001||!Array.isArray(v.cost_chunks)||v.cost_chunks.length>1563)return null;
 const properties=v.items.map(parseComparisonProperty);
 if(properties.some(p=>!p)||new Set(properties.map(p=>p!.property_id)).size!==properties.length)return null;
 const records:CostRecord[]=[];
 for(const chunk of v.cost_chunks){const parsed=parseCostRecords(chunk,v.anchor_id,sourceId,year);if(!parsed)return null;records.push(...parsed);}
 if(new Set(records.map(r=>r.property_id)).size!==records.length)return null;
 const costs=new Map(records.map(r=>[r.property_id,r]));
 const byId=new Map(properties.map(p=>[p!.property_id,withCosts(p!,costs.get(p!.property_id))]));
 const subject=byId.get(String(Number(subjectId)));if(!subject)return null;
 return {subjectId,sourceId,year,items:Object.fromEntries(requested.map(id=>[id,comparisonMatch(subject,byId.get(id))]))};
}
