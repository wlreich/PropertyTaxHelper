import 'server-only';
import {rpc} from './properties.ts';
import {parseActivity} from '../property-activity.ts';
import {validPropertyId} from '../property-comparisons.ts';
export async function getPropertyActivity(id:string,year:number|null=null){
 if(!validPropertyId(id))return null;
 return parseActivity(await rpc('property_neighborhood_activity',{p_id:id,...(year===null?{}:{p_year:year})},{SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetch));
}
