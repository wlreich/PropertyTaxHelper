import test from 'node:test';
import assert from 'node:assert/strict';
import {checkReleaseContract} from '../scripts/check-release-contract.mjs';

const fixture={
  status:'ok',source_id:'11111111-1111-4111-8111-111111111111',neighborhood:'T2450',
  homes:[{property_id:'736302'}],agent_assignments:[],
  annual_periods:[{release:{tax_year:2026,roll_stage:'certified',export_date:'2026-07-18'},homes:[],caps:[]}],
  population:{candidate_count:1,excluded:[]},
};
const env={VERCEL_ENV:'production',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture-key'};

test('local and preview builds do not depend on the live database',async()=>{
  assert.match(await checkReleaseContract({},()=>{throw Error('unexpected fetch');}),/Skipped/);
  assert.match(await checkReleaseContract({VERCEL_ENV:'preview'},()=>{throw Error('unexpected fetch');}),/Skipped/);
});

test('production build fails closed on missing configuration or RPC fields',async()=>{
  await assert.rejects(checkReleaseContract({VERCEL_ENV:'production'},()=>{}),/requires SUPABASE_URL/);
  const missing=structuredClone(fixture);
  delete missing.agent_assignments;
  await assert.rejects(checkReleaseContract(env,async()=>({ok:true,json:async()=>missing})),/agent_assignments/);
  await assert.rejects(checkReleaseContract(env,async()=>({ok:false,status:503})),/HTTP 503/);
});

test('production build reads the existing public RPC and accepts a valid contract',async()=>{
  const fetchRequest=async(url,options)=>{
    assert.equal(url,'https://fixture.supabase.co/rest/v1/rpc/property_neighborhood_analysis');
    assert.equal(options.headers.apikey,'fixture-key');
    assert.deepEqual(JSON.parse(options.body),{p_id:'736302',p_phase:null,p_year:null});
    return {ok:true,json:async()=>fixture};
  };
  assert.match(await checkReleaseContract(env,fetchRequest),/passed/);
});
