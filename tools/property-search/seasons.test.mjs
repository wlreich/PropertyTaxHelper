import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureDatabase} from './projection.test.mjs';
const source='11111111-1111-4111-8111-111111111111';
const next='22222222-2222-4222-8222-222222222222';
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const config={county:'travis',tax_year:2027,starts_on:'2027-04-02',filing_deadline:'2027-05-15',post_starts_on:'2027-08-01',deadline_source:'https://traviscad.org/protests',verified_on:'2026-09-11',mode:'automatic',manual_phase:null,published:false};
const value=async(db,sql,args=[]) => (await db.query(sql,args)).rows[0];
async function authorize(db) {
 await db.query('insert into auth.users(id,email_confirmed_at) values($1,now());',[actor]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,actor]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[actor,JSON.stringify({session_id:session})]);
}
test('administrator authorization, verified calendars, draft isolation, concurrency and audit',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 await db.exec('set role anon');
 for(const sql of ['select public.admin_dashboard()',"select public.admin_prepare_release('11111111-1111-4111-8111-111111111111')",'select * from parcel_admin.members']) await assert.rejects(db.query(sql));
 await db.exec('reset role');await authorize(db);
 await db.exec('set role authenticated');await assert.rejects(db.query('select public.admin_dashboard()'));
 await db.exec('reset role');await db.query('insert into parcel_admin.members(user_id) values($1)',[actor]);
 await db.exec('set role authenticated');
 await db.query('select public.admin_save_season($1,0)',[config]);
 assert.equal((await value(db,'select public.season_calendar() s')).s.length,1);
 await assert.rejects(db.query('select public.admin_save_season($1,0)',[config]));
 await assert.rejects(db.query('select public.admin_save_season($1,1)',[{...config,published:true,verified_on:null}]));
 await db.query('select public.admin_save_season($1,1)',[{...config,published:true}]);
 assert.equal((await value(db,'select public.season_calendar() s')).s.length,2);
 await db.query('select public.admin_save_season($1,2)',[{...config,filing_deadline:'2027-05-20'}]);
 assert.equal((await value(db,"select filing_deadline::text d from public.assessment_seasons where tax_year=2027")).d,'2027-05-15');
 const dashboard=(await value(db,'select public.admin_dashboard() d')).d;
 assert.equal(dashboard.seasons.find(s=>s.tax_year===2027).filing_deadline,'2027-05-20');
 assert.ok(dashboard.audit.length>=4);
 await assert.rejects(db.query('insert into parcel_admin.members(user_id) values(gen_random_uuid())'));
 await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[session]);await db.exec('set role authenticated');await assert.rejects(db.query('select public.admin_dashboard()'));
});
test('preparation keeps current release live, resumes failures, retains history and activates atomically',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());await authorize(db);
 await db.query('insert into parcel_admin.members(user_id) values($1)',[actor]);
 await db.query("update tcad_ingest.files set record_type='Agent' where dataset_id=$1 and member_name='3.txt'",[source]);
 await db.query('select tcad_ingest.publish_property_search($1)',[source]);
 await db.query('select tcad_ingest.publish_property_snapshots($1)',[source]);
 await db.query(`insert into tcad_ingest.datasets(id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header,status,completed_at)
 select $2,repeat('e',64),layout_sha256,parser_version,source_encoding,2027,'preliminary',source_url,archive_location,'{"run_date_time":"04/02/2027 12:00"}',status,completed_at from tcad_ingest.datasets where id=$1`,[source,next]);
 await db.query(`insert into tcad_ingest.files(dataset_id,member_name,record_type,uncompressed_bytes,sha256,status) select $2,member_name,record_type,uncompressed_bytes,sha256,status from tcad_ingest.files where dataset_id=$1`,[source,next]);
 await db.query(`insert into tcad_ingest.records(dataset_id,member_name,row_number,prop_id,prop_val_yr,fields) select $2,member_name,row_number,prop_id,'02027',fields || case when member_name='0.txt' then '{"market_value":"1400000"}'::jsonb else '{}'::jsonb end from tcad_ingest.records where dataset_id=$1`,[source,next]);
 await db.exec('set role authenticated');
 const prep=(await value(db,'select public.admin_prepare_release($1) id',[next])).id;
 await assert.rejects(db.query('select public.admin_publish_release($1,true)',[prep]));
 await assert.rejects(db.query("select public.admin_preview_property($1,'101')",[prep]));
 await db.exec('reset role');
 await db.query('select parcel_admin.advance_preparation(10000)');
 assert.equal((await value(db,'select dataset_id from public.property_search_state')).dataset_id,source);
 await db.exec('set role anon');
 assert.equal((await value(db,'select count(*)::integer n from public.property_releases')).n,1);
 assert.equal((await value(db,"select public.property_overview_bundle('101') b")).b.profile.property.tax_year,2026);
 await db.exec('reset role');
 // Fail exactly one batch; recovery must retain earlier committed search work.
 await db.exec("create function pg_temp.fail_batch() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$; create trigger fail_batch before insert on public.property_snapshot_profiles for each statement execute function pg_temp.fail_batch()");
 assert.equal((await value(db,'select parcel_admin.advance_preparation(10000) r')).r.state,'failed');
 assert.equal((await value(db,'select dataset_id from public.property_search_state')).dataset_id,source);
 await db.exec('drop trigger fail_batch on public.property_snapshot_profiles; set role authenticated');
 await db.query('select public.admin_retry_release($1)',[prep]);await db.exec('reset role');
 for(let i=0;i<30;i++){const result=(await value(db,'select parcel_admin.advance_preparation(10000) r')).r;assert.notEqual(result.state,'failed',JSON.stringify(result));if(result.state==='ready')break;}
 assert.equal((await value(db,'select state from parcel_admin.preparations where id=$1',[prep])).state,'ready');
 await db.exec('set role authenticated');
 const preview=(await value(db,"select public.admin_preview_property($1,'101') p",[prep])).p;
 assert.equal(preview.profile.property.market_value,1400000);assert.equal(preview.history.snapshots.length,2);
 assert.ok(!JSON.stringify(preview).includes('PRIVATE SYNTHETIC OWNER'));
 await db.query('select public.admin_publish_release($1,false)',[prep]);
 const bundle=(await value(db,"select public.property_overview_bundle('101') b")).b;
 assert.equal(bundle.profile.property.tax_year,2027);assert.equal(bundle.history.snapshots.length,2);
 await assert.rejects(db.query('select public.admin_prepare_release($1)',[source]));
 await assert.rejects(db.query('select public.admin_publish_release($1,true)',[prep]));
});
