import 'server-only';
import {rpc} from './properties.ts';
import {parseActivity,type ActivityData} from '../property-activity.ts';
import {validPropertyId} from '../property-comparisons.ts';
export async function getPropertyActivity(id:string,year:number|null=null){
 if(!validPropertyId(id))return null;
 return parseActivity(await rpc('property_neighborhood_activity',{p_id:id,...(year===null?{}:{p_year:year})},{SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetch));
}

// Reuse the bounded, privacy-filtered annual RPC. Missing coverage never becomes
// an empty successful year. No source records or access rules are changed.
export async function getWindowActivity(id:string,window:import('../evidence-window.ts').EvidenceWindow,latestData?:ActivityData|null){
 const {evidenceWindowError,evidenceYears,windowActivity}=await import('../evidence-window.ts');
 if(evidenceWindowError(window))return null;
 const latest=latestData===undefined?await getPropertyActivity(id):latestData;
 if(!latest)return null;
 const requested=evidenceYears(window).filter(y=>latest.years.includes(y));
 const results=await Promise.all(requested.map(y=>y===latest.year?latest:getPropertyActivity(id,y)));
 // Mixed neighborhoods indicate a publication changed during this request.
 if(results.some(d=>d&&d.neighborhood!==latest.neighborhood))return null;
 if(results.some((d,i)=>d&&d.year!==requested[i]))return null;
 return {...windowActivity(window,results.filter((d):d is NonNullable<typeof d>=>d!==null),latest.years,requested.filter((_,i)=>!results[i])),neighborhood:latest.neighborhood};
}

// Resolve current activity areas first; historical comparison groups may differ.
// Reuse the latest responses and load each area's remaining years only once.
export async function getComparisonActivities(ids:string[],window:import('../evidence-window.ts').EvidenceWindow){
 const latest=await Promise.all(ids.map(id=>getPropertyActivity(id)));
 const groups=new Map<string,{id:string;data:ActivityData}>();
 latest.forEach((data,i)=>{if(data&&!groups.has(data.neighborhood))groups.set(data.neighborhood,{id:ids[i],data});});
 const windows=new Map(await Promise.all([...groups].map(async([area,{id,data}])=>[area,await getWindowActivity(id,window,data)] as const)));
 return new Map(ids.map((id,i)=>[id,latest[i]?windows.get(latest[i]!.neighborhood)??null:null]));
}
