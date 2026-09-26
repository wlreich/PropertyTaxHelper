#!/usr/bin/env node
import {pathToFileURL} from 'node:url';
import {validatePublishedNeighborhood} from './published-release-contract.mjs';

export async function checkReleaseContract(env=process.env,fetchRequest=fetch) {
  if(env.VERCEL_ENV!=='production' && env.RELEASE_CONTRACT_CHECK!=='1') return 'Skipped release contract outside production.';
  const url=env.SUPABASE_URL?.trim().replace(/\/$/,'');
  const key=env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if(!url || !key) throw new Error('Production release contract requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  const response=await fetchRequest(`${url}/rest/v1/rpc/property_neighborhood_analysis`,{
    method:'POST',
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({p_id:'736302',p_phase:null,p_year:null}),
    signal:AbortSignal.timeout(30_000),
  });
  if(!response.ok) throw new Error(`Production release RPC returned HTTP ${response.status}.`);
  const result=validatePublishedNeighborhood(await response.json());
  if(result.failures.length) throw new Error(`Production release contract failed:\n- ${result.failures.join('\n- ')}`);
  return `Production release contract passed (${result.eligiblePropertyCount} eligible homes observed).`;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { console.log(await checkReleaseContract()); }
  catch(error) { console.error(error); process.exitCode=1; }
}
