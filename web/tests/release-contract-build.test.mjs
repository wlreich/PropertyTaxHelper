import test from 'node:test';
import assert from 'node:assert/strict';
import {checkReleaseContract} from '../scripts/check-release-contract.mjs';

const release={dataset_id:'11111111-1111-4111-8111-111111111111',tax_year:2026,roll_stage:'certified',export_date:'2026-07-18'};
const fixture={
  available:true,status:'ok',anchor_id:release.dataset_id,source_id:release.dataset_id,
  neighborhood:'T2450',subdivision:null,preliminary_id:null,certified_id:release.dataset_id,prior_id:null,
  subject:{property_id:'736302',address:'1104 PAW PRINT',city:'LEANDER',property_type:'A1',market_value:100000,
    land_value:10000,land_acres:1,living_area:1000,year_built:2000,neighborhood:'T2450',class_code:null,main_buildings:1},
  releases:[release],
  homes:[{property_id:'736302',market:100000,area:1000,preliminary:null,certified:100000,certified_area:1000,
    prior:null,protested:false,entities:[]}],caps:[],agent_assignments:[],
  annual_periods:[{release,homes:[{property_id:'736302',market:100000,area:1000,protested:false,exclusion:null}],caps:[]}],
  population:{candidate_count:1,land_code_mismatch:0,multiple_buildings:0,excluded:[]},market_adjustment:null,
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
  const malformed=structuredClone(fixture);
  malformed.annual_periods[0].homes=[{}];
  await assert.rejects(checkReleaseContract(env,async()=>({ok:true,json:async()=>malformed})),/page parser rejected/);
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
