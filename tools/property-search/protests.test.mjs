import { fixtureDatabase } from './projection.test.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const anchor='11111111-1111-4111-8111-111111111111';
const source='22222222-2222-4222-8222-222222222222';
const later='33333333-3333-4333-8333-333333333333';
test('protest evidence: exact year/source links, privacy, retries, later absence and public access',async t=>{
 const db=await fixtureDatabase(); t.after(()=>db.close());
 await db.query('select tcad_ingest.publish_property_search($1)',[anchor]);
 async function dataset(id,hash,date){
  await db.query(`insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,import_scope,completed_at)
   values($1,repeat($2,64),repeat('b',64),'fixture','ascii',2026,'unknown','https://traviscad.org/publicinformation/','fixture',jsonb_build_object('export_version','8.0.0.32','run_date_time',$3::text),'ready','protests',now())`,[id,hash,date]);
  for(const type of ['Header','Property','ARB','Agent']) await db.query(`insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status) values($1,$2,$2,0,repeat('c',64),'complete')`,[id,type]);
 }
 await dataset(source,'d','04/29/2026 22:20'); await dataset(later,'e','07/08/2026 10:00');
 let row=0;
 const fields={py_confidential_flag:'F',jan1_confidential_flag:'F',appr_confidential_flag:'F',partial_owner:'F',ownership_pct:'100.00',udi_group:'000000000000',arb_protest_flag:'F',arb_agent_id:'0',geo_id:'G',ref_id1:'R1',ref_id2:'R2',owner_name:'PRIVATE OWNER'};
 const add=(type,id,data,year='02026',ds=source)=>db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) values($1,$2,$3,$4,$5,$6)`,[ds,type,++row,id===null?null:String(id).padStart(12,'0'),year,data]);
 for(const id of [101,102,103,104,106,110,200,201,202,203,204,205,206,207,208,209,210]) await add('Property',id,{...fields});
 await add('Property',200,{...fields}); // Duplicate owner rows are ambiguous.
 await add('Agent',null,{agent_id:'0007',agent_name:'FIXTURE TAX ADVISERS',phone:'PRIVATE PHONE'});
 await add('Agent',null,{agent_id:'0008'},'02026',later); // Wrong dataset cannot supply an agent link.
 await add('ARB',101,{arb_status:'EF',geo_id:'G',ref_id1:'R1',ref_id2:'R2'});
 await add('ARB',110,{arb_status:'PRIOR'},'02025'); // Current property row cannot authorize prior-year evidence.
 await add('ARB',201,{arb_status:'WRONG',geo_id:'OTHER'}); // Cross-check conflict.
 await add('ARB',202,{arb_status:'PS',geo_id:'G'},'02026'); // ARB alone is positive even with F property flag.
 await add('ARB',203,{arb_status:'EF'});
 await add('ARB',204,{arb_status:'EF'});
 await add('ARB',205,{arb_status:'EF'});
 await add('ARB',206,{arb_status:'EF'});
 await add('ARB',207,{arb_status:'EF'});
 await add('ARB',208,{arb_status:'EF'});
 await add('ARB',209,{arb_status:'EF'});
 await add('ARB',210,{arb_status:'EF'});
 for(const [id,changes] of [[101,{arb_protest_flag:'T',arb_agent_id:'0007'}],[200,{arb_protest_flag:'T'}],[110,{arb_agent_id:'0008'}],[201,{arb_agent_id:'0007'}],
  [203,{py_confidential_flag:'T'}],[204,{jan1_confidential_flag:null}],[205,{appr_confidential_flag:'T'}],[206,{partial_owner:'T'}],[207,{ownership_pct:'50'}],[208,{udi_group:'123'}],[209,{ownership_pct:null}]])
  await db.query(`update tcad_ingest.records set fields=fields||$1::jsonb where dataset_id=$2 and member_name='Property' and prop_id=$3`,[JSON.stringify(changes),source,String(id).padStart(12,'0')]);
 const publish=(ds=source,after='',limit=50000)=>db.query('select tcad_ingest.publish_property_protests($1,$2,$3) result',[ds,after,limit]);
 const history=async id=>(await db.query('select public.property_history($1) result',[String(id)])).rows[0].result;
 await assert.rejects(publish(anchor),/Only complete ready protest/);
 await assert.rejects(publish(source,'',0),/Invalid batch size/);
 const first=(await publish(source,'',2)).rows[0].result;
 await publish(source,first.next);
 await db.query('select tcad_ingest.publish_property_agent_names($1)',[source]);
 const obs=(await history(101)).protest_observations;
 assert.equal(obs[0].arb_agent_name,'FIXTURE TAX ADVISERS');
 assert.equal((await history(201)).protest_observations[0].arb_agent_name,'FIXTURE TAX ADVISERS');
 await db.query('select tcad_ingest.publish_property_agent_names($1)',[source]);
 assert.equal(obs.length,1); assert.equal(obs[0].tax_year,2026); assert.equal(obs[0].export_date,'2026-04-29');
 assert.equal(obs[0].protest_flag,true); assert.equal(obs[0].arb_case_listed,true); assert.equal(obs[0].arb_agent_listed,true); assert.deepEqual(obs[0].arb_status_codes,['EF']);
 assert.deepEqual((await history(101)).snapshots,[]); // No valuation publication.
 assert.equal((await history(202)).protest_observations[0].protest_flag,false);
 assert.equal((await history(201)).protest_observations[0].arb_case_listed,false);
 assert.equal((await history(201)).protest_observations[0].arb_agent_listed,true); // Agent alone is not a protest.
 for(const id of [100,102,103,104,106,110,200,203,204,205,206,207,208,209]) assert.deepEqual((await history(id)).protest_observations,[],String(id));
 await publish(); assert.deepEqual((await history(101)).protest_observations,obs);
 await add('Property',101,{...fields},'02026',later); await publish(later);
 assert.deepEqual((await history(101)).protest_observations,obs); // Later absence never erases evidence.
 await db.exec(`create function pg_temp.stop_protests() returns trigger language plpgsql as $$ begin raise exception 'synthetic publication failure'; end $$;
 create trigger stop_protests before insert on public.property_protest_observations for each row execute function pg_temp.stop_protests();`);
 await assert.rejects(publish(),/synthetic publication failure/);
 assert.deepEqual((await history(101)).protest_observations,obs); // Delete/insert rolled back together.
 await db.exec('drop trigger stop_protests on public.property_protest_observations');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  assert.deepEqual((await history('000101')).protest_observations,obs);
  assert.ok(!JSON.stringify(await history(101)).includes('PRIVATE'));
  assert.deepEqual((await history('bad')).protest_observations,[]);
  await assert.rejects(publish(),/permission denied/);
  await assert.rejects(db.query('select tcad_ingest.publish_property_agent_names($1)',[source]),/permission denied/);
  await assert.rejects(db.exec('delete from public.property_agent_names'),/permission denied/);
  await assert.rejects(db.exec('delete from public.property_protest_observations'),/permission denied/);
  await assert.rejects(db.exec('select fields from tcad_ingest.records'),/permission denied/);
  await db.exec('reset role');
 }
 await db.query(`update tcad_ingest.records set fields=fields||'{"py_confidential_flag":"T"}' where dataset_id=$1 and member_name='Property' and prop_id='000000000101'`,[source]);
 await publish(); assert.deepEqual((await history(101)).protest_observations,[]);
 await db.exec('set role anon');
 assert.equal((await db.query("select count(*)::int n from public.property_agent_names where property_id='101'")).rows[0].n,0);
 await db.exec('reset role');
 await db.query('select tcad_ingest.publish_property_agent_names($1)',[source]);
 assert.equal((await db.query("select count(*)::int n from public.property_agent_names where property_id='101'")).rows[0].n,0);
 await db.exec(`update public.property_search_documents set values_under_review=true where property_id='202'; set role anon`);
 assert.deepEqual((await history(202)).protest_observations,[]);
 await db.exec('reset role; delete from public.property_search_state; set role anon');
 assert.deepEqual((await history(201)).protest_observations,[]);
 await db.exec('reset role');
});
