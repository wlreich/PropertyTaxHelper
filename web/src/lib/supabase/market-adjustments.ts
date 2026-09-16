import 'server-only';
import {rpc} from './properties.ts';
import {validPropertyId} from '../property-comparisons.ts';
import {parseMarketAdjustment} from '../market-adjustments.ts';
export async function getMarketAdjustment(id:string) {
  if(!validPropertyId(id))return null;
  return parseMarketAdjustment(await rpc('property_market_adjustment',{p_id:id},{SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY},fetch));
}
