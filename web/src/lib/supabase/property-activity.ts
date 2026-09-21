import 'server-only';
import {rpc} from './properties.ts';
import {parseActivity} from '../property-activity.ts';
import {validPropertyId} from '../property-comparisons.ts';
export async function getPropertyActivity(id:string,year:number|null=null){
 if(!validPropertyId(id))return null;
 return parseActivity(await rpc('property_neighborhood_activity',{p_id:id,...(year===null?{}:{p_year:year})},{SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetch));
}

// Reuse the bounded, privacy-filtered annual RPC. Missing coverage never becomes
// an empty successful year. No source records or access rules are changed.
export async function getWindowActivity(id:string,window:import('../evidence-window.ts').EvidenceWindow){
 const {evidenceWindowError,evidenceYears,windowActivity}=await import('../evidence-window.ts');
 if(evidenceWindowError(window))return null;
 const latest=await getPropertyActivity(id);
 if(!latest)return null;
 const requested=evidenceYears(window).filter(y=>latest.years.includes(y));
 const results=await Promise.all(requested.map(y=>y===latest.year?latest:getPropertyActivity(id,y)));
 // Mixed neighborhoods indicate a publication changed during this request.
 if(results.some(d=>d&&d.neighborhood!==latest.neighborhood))return null;
 if(results.some((d,i)=>d&&d.year!==requested[i]))return null;
 return {...windowActivity(window,results.filter((d):d is NonNullable<typeof d>=>d!==null),latest.years,requested.filter((_,i)=>!results[i])),neighborhood:latest.neighborhood};
}
