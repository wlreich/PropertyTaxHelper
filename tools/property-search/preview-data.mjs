// Local browser verification only. Synthetic records and authentication, loopback only.
import {fixtureHistory} from './history-fixture.mjs';
import {createServer} from 'node:http';
import {fixtureDatabase} from './projection.test.mjs';
const db=await fixtureDatabase({parklandFixtures:true});
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', session='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
await db.query("select tcad_ingest.publish_property_search('11111111-1111-4111-8111-111111111111')");
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
   const call=async(sql,values=[]) => (await db.query(sql,values)).rows[0].result;
   let result;
   const route=url.pathname.replace('/rest/v1/rpc/','');
   if(route==='search_property_parcels')result=await call('select public.search_property_parcels($1,$2,$3) result',[args.p_query,Number(args.p_page),args.p_show_all===true||args.p_show_all==='true']);
   else if(route==='property_profile')result=await call('select public.property_profile($1) result',[args.p_id]);
   else if(route==='property_history')result=args.p_id==='100'?fixtureHistory:{snapshots:[]};
   else if(route==='property_overview_bundle')result={profile:await call('select public.property_profile($1) result',[args.p_id]),history:args.p_id==='100'?fixtureHistory:{snapshots:[]}};
   else if(route==='season_calendar')result=await call('select public.season_calendar() result');
   else if(route==='admin_access')result=await call('select public.admin_access() result');
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
