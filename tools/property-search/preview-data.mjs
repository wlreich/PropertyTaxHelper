import {par28Fixture,par28Neighborhood} from './par28-fixture.mjs';
import {activityViewFixture} from './activity-view-fixture.mjs';
import {neighborhoodViewFixture} from './neighborhood-view-fixture.mjs';
import {par11Fixture} from './par11-fixture.mjs';
import {par10Fixture} from './par10-fixture.mjs';
import {seedMarketAdjustments} from './market-adjustment-fixture.mjs';
import {seedResidentialSource} from './residential-search-fixture.mjs';
import {seedHomeRegression} from './home-regression-fixture.mjs';
import {seedAddressSearch} from './address-search-fixture.mjs';
import {seedNeighborhood} from './neighborhood-fixture.mjs';
// Local browser verification only. Synthetic records and authentication, loopback only.
import {seedComparisons} from './comparison-fixture.mjs';
import {fixtureHistory,taxableOnlyHistory} from './history-fixture.mjs';
const historyFor = id => id === '100' ? fixtureHistory : id === '101' ? taxableOnlyHistory : {snapshots:[]};
import {createServer} from 'node:http';
import {fixtureDatabase} from './projection.test.mjs';
const db=await fixtureDatabase({parklandFixtures:true});
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', session='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await seedResidentialSource(db);
await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
await seedAddressSearch(db);
await seedHomeRegression(db);
await seedComparisons(db);
await seedNeighborhood(db);
await seedMarketAdjustments(db);
await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[actor]);
await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,actor]);
await db.query('insert into parcel_admin.members(user_id) values($1)',[actor]);
const user={id:actor,email:'admin@example.test',aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{}};
let queue=Promise.resolve();
createServer((req,res)=>{
 queue=queue.then(async()=>{
  const send=(status,result)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(result));
  try {
   const url=new URL(req.url,'http://127.0.0.1:4055');
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw Error('Body too large');}
   const args=req.method==='GET'?Object.fromEntries(url.searchParams):raw?JSON.parse(raw):{};
   const authenticated=req.headers.authorization==='Bearer fixture-admin-token';
   if(url.pathname==='/auth/v1/token')return args.email==='admin@example.test'&&args.password==='fixture-password'
    ?send(200,{access_token:'fixture-admin-token',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}):send(400,{message:'Invalid credentials'});
   if(url.pathname==='/auth/v1/user')return authenticated?send(200,user):send(401,{message:'Not authenticated'});
   if(url.pathname==='/auth/v1/logout')return send(204,null);
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[authenticated?actor:'',authenticated?JSON.stringify({session_id:session}):'{}']);
   await db.exec(authenticated?'set role authenticated':'set role anon');
   if(url.pathname==='/rest/v1/property_releases') {
    const releases=(await db.query('select tax_year,roll_stage,export_time_raw from public.property_releases order by published_at desc limit 1')).rows;
    return send(200,releases);
   }
   const call=async(sql,values=[]) => (await db.query(sql,values)).rows[0].result;
   let result;
   const route=url.pathname.replace('/rest/v1/rpc/','');
   const visualFixture=par28Fixture(args.p_id) ?? par11Fixture(args.p_id) ?? par10Fixture(args.p_id);
   if(visualFixture && ['property_overview_bundle','property_market_adjustment','property_profile','property_history'].includes(route)) {
    const reference={property_overview_bundle:visualFixture.overview,property_market_adjustment:visualFixture.adjustment,property_profile:visualFixture.overview.profile,property_history:visualFixture.overview.history};
    return send(200,reference[route]);
   }
   if(route==='property_activity_match_inputs')result=await call('select public.property_activity_match_inputs($1,$2,$3) result',[args.p_id,args.p_source,args.p_ids]);
   else if(route==='property_comparison_costs')result=await call('select public.property_comparison_costs($1,$2,$3) result',[args.p_anchor,args.p_source,typeof args.p_ids==='string'?args.p_ids.replace(/^[{]|[}]$/g,'').split(',').filter(Boolean):args.p_ids??[]]);
   else if(route==='property_market_adjustment')result=await call('select public.property_market_adjustment($1) result',[args.p_id]);
   else if(route==='property_neighborhood_activity')result=activityViewFixture(args.p_id,args.p_year??null);
   else if(route==='property_neighborhood_analysis' && par28Fixture(args.p_id))result=par28Neighborhood(await call('select public.property_neighborhood_analysis($1,$2,$3) result',['100',args.p_phase??null,args.p_year??null]),args.p_id);
   else if(route==='property_neighborhood_analysis')result=neighborhoodViewFixture(await call('select public.property_neighborhood_analysis($1,$2,$3) result',[/^(920[0-5]|9290)$/.test(args.p_id)?'100':args.p_id,args.p_phase??null,args.p_year??null]),args.p_id);
   else if(route==='property_neighborhood_v4')result=await call('select public.property_neighborhood_v4($1,$2) result',[args.p_id,args.p_source??null]);
   else if(route==='property_neighborhood_v3')result=await call('select public.property_neighborhood_v3($1,$2) result',[args.p_id,args.p_source??null]);
   else if(route==='property_comparisons')result=await call('select public.property_comparisons($1,$2,$3,$4,$5) result',[args.p_id,args.p_source??null,typeof args.p_selected==='string'?args.p_selected.replace(/^[{]|[}]$/g,'').split(',').filter(Boolean):args.p_selected??[],args.p_query??'',Number(args.p_page??0)]);
   else if(route==='search_property_parcels_v2')result=await call('select public.search_property_parcels_v2($1,$2,$3) result',[args.p_query,Number(args.p_page),args.p_show_all===true||args.p_show_all==='true']);
   else if(route==='suggest_property_parcels')result=await call('select public.suggest_property_parcels($1,$2,$3) result',[args.p_query,Number(args.p_limit),args.p_show_all===true||args.p_show_all==='true']);
   else if(route==='search_property_parcels')result=await call('select public.search_property_parcels($1,$2,$3) result',[args.p_query,Number(args.p_page),args.p_show_all===true||args.p_show_all==='true']);
   else if(route==='property_profile')result=await call('select public.property_profile($1) result',[args.p_id]);
   else if(route==='property_history')result=historyFor(args.p_id);
   else if(route==='property_overview_bundle')result={profile:await call('select public.property_profile($1) result',[args.p_id]),history:historyFor(args.p_id)};
   else if(route==='season_calendar')result=await call('select public.season_calendar() result');
   else if(route==='admin_access')result=await call('select public.admin_access() result');
   else if(route==='submit_feature_suggestion')result=await call('select public.submit_feature_suggestion($1,$2,$3) result',[args.p_submission_id,args.p_category,args.p_message]);
   else if(route==='admin_suggestions')result=await call('select public.admin_suggestions($1) result',[Number(args.p_page??0)]);
   else if(route==='admin_dashboard')result=await call('select public.admin_dashboard() result');
   else if(route==='admin_save_season')result=await call('select public.admin_save_season($1,$2) result',[args.p_config,args.p_revision]);
   else if(route==='admin_preview_property'){
    result=await call('select public.admin_preview_property($1,$2) result',[args.p_anchor,args.p_id]);
    if(args.p_id==='100')result.history=fixtureHistory;
   }
   else return send(404,{message:'Unknown fixture endpoint'});
   send(200,result);
  } catch(error) {send(400,{message:'Invalid fixture request',code:error.code??'fixture_error'});}
 }).catch(()=>{if(!res.headersSent)res.writeHead(500).end();});
}).listen(4055,'127.0.0.1',()=>console.log('Synthetic property RPC listening on loopback port 4055'));
