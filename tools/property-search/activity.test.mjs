import {fixtureDatabase} from './projection.test.mjs';
import {seedComparisons} from './comparison-fixture.mjs';
import {seedNeighborhood} from './neighborhood-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('activity reconciles transactions, retains unknowns, excludes private/future data and respects release RLS',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 const anchor='11111111-1111-4111-8111-111111111111',run='99999999-9999-4999-8999-999999999999';
 await db.query('select tcad_ingest.publish_property_search($1)',[anchor]);await seedComparisons(db);await seedNeighborhood(db);
 await db.exec(`update tcad_ingest.records set fields=fields||'{"deed_dt":"05-27-2026","deed_num":"2026123"}'::jsonb where dataset_id='${anchor}' and ltrim(prop_id,'0')='100';`);
 await db.query(`insert into tcad_ingest.activity_imports(id,dataset_id,archive_sha256,member_name,export_date,activity_year,parser_version,property_count,observation_count,observations_sha256,summary,status,completed_at)
 values($1,$2,repeat('a',64),'synthetic.json','2026-08-27',2026,'fixture',8,0,repeat('b',64),'{}','loading',null)`,[run,anchor]);
 const add=async(pid,kind,id,date,extra={})=>{
  const r={run_id:run,property_id:pid,kind,event_id:id,deed_id:kind==='deed'?id:null,event_date:date,date_raw:date,associated_properties:[pid],confidential:false,suppressed:false,multi_property:false,...extra};
  const keys=Object.keys(r);await db.query(`insert into tcad_ingest.activity_observations(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(r));
 };
 await add('100','deed','1','2026-05-27',{instrument:'2026123',filed_date:'2026-05-29'});
 await add('100','sale','18','2026-05-27',{instrument:'2026123'}); // Weaker sale must not displace the exact deed-ID match.
 await add('100','sale','2','2026-05-27',{deed_id:'1',sale_price:650000,adjusted_price:700000});
 await add('101','deed','14','2026-02-01',{instrument:'A14'});
 await add('101','sale','15','2026-02-02',{instrument:'A14',sale_price:510000});
 await add('101','deed','16','2026-01-01');await add('101','sale','17','2026-01-01',{sale_price:505000});
 await add('101','sale','3','2026-06-03'); // Recorded sale, price unreported.
 await add('120','sale','4','2026-04-01',{multi_property:true,associated_properties:['120','121'],sale_price:21000000});
 await add('121','deed','5','2026-06-01');
 await add('121','sale','6','2026-06-01',{confidential:true,sale_price:999999});
 await add('122','sale','7','2026-06-02',{suppressed:true,sale_price:999998});
 await add('122','sale','8','2026-06-03',{confidential:null,sale_price:999997});
 await add('123','deed','9','2026-12-31',{quarantine_reason:'future_date'});
 await add('103','sale','10','2026-06-01',{sale_price:999996});
 await add('120','deed','11','2026-03-01',{instrument:'X'});await add('120','deed','12','2026-03-01');await add('120','sale','13','2026-03-01',{instrument:'Y'});
 await db.query('update tcad_ingest.activity_imports set observation_count=(select count(*) from tcad_ingest.activity_observations where run_id=$1) where id=$1',[run]);
 // A loading source is unavailable, and only its completion fields are writable by the loader.
 await assert.rejects(db.query('select tcad_ingest.publish_property_activity(2026)'));
 await db.exec('set role tcad_loader');
 await assert.rejects(db.query("update tcad_ingest.activity_imports set parser_version='rewritten' where id=$1",[run]));
 await db.query("update tcad_ingest.activity_imports set status='complete',completed_at=now() where id=$1",[run]);
 await assert.rejects(db.query("update tcad_ingest.activity_imports set completed_at=now() where id=$1",[run]));
 await assert.rejects(add('100','deed','99','2026-06-01'));
 await db.exec('reset role');
 for(let i=0;i<2;i++)await db.query('select tcad_ingest.publish_property_activity(2026)');
 await db.exec('set role anon');
 const call=async(id='100',year=2026)=>(await db.query('select public.property_neighborhood_activity($1,$2) r',[id,year])).rows[0].r;
 const result=await call();assert.equal(result.status,'ok');assert.equal(result.neighborhood,'T2450');assert.deepEqual(result.years,[2026]);assert.equal(result.sources.sales_export_date,'2026-08-27');
 const own=result.rows.filter(r=>r.property_id==='100');assert.equal(own.length,2);const exact=own.find(r=>r.event_key==='s:2');assert.equal(exact.price,650000);assert.equal(exact.match_method,'deed_id');assert.equal(exact.filed_date,'2026-05-29');assert.equal(own.find(r=>r.event_key==='s:18').match_method,null);
 assert.equal(result.rows.find(r=>r.event_key==='s:15').match_method,'instrument');
 assert.equal(result.rows.find(r=>r.event_key==='s:17').match_method,'unique_date');
 assert.equal(result.rows.filter(r=>r.property_id==='101').length,3);
 const zero=result.rows.find(r=>r.event_key==='s:3');assert.equal(zero.status,'sale_recorded');assert.equal(zero.price,null);assert.equal(zero.price_status,'not_reported');
 const bundle=result.rows.find(r=>r.event_key==='s:4');assert.equal(bundle.price,null);assert.equal(bundle.price_status,'multi_property');
 assert.equal(result.rows.filter(r=>r.property_id==='120'&&r.activity_date==='2026-03-01').length,3); // Ambiguous date is not joined.
 assert.equal(result.rows.find(r=>r.property_id==='121').status,'deed_change');
 assert.equal(result.rows.some(r=>['122','123','103'].includes(r.property_id)),false);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes('99999'),false);
 assert.equal((await call('103')).status,'unavailable');assert.equal((await call('100',2025)).status,'unavailable');
 await assert.rejects(call('100',9000));await assert.rejects(db.query('select * from tcad_ingest.activity_observations'));
 await assert.rejects(db.query('select tcad_ingest.publish_property_activity(2026)'));
 await assert.rejects(db.query("delete from public.property_activity where property_id='100'"));
 await db.exec('reset role');
 // A newly hidden property cannot remain visible via direct table access or the RPC.
 await db.exec("update public.property_search_documents set values_under_review=true where property_id='120'; set role authenticated");
 assert.equal((await call()).rows.some(r=>r.property_id==='120'),false);
 assert.equal((await db.query("select count(*)::int n from public.property_activity where property_id='120'")).rows[0].n,0);
 await db.exec('reset role');
 // Completed provenance stays immutable even for accidental operator updates.
 await assert.rejects(db.query('update tcad_ingest.activity_imports set observation_count=observation_count+1 where id=$1',[run]));
 // A new partial import cannot be completed or replace the current public projection.
 const partial='88888888-8888-4888-8888-888888888888';
 await db.query("insert into tcad_ingest.activity_imports select $1,dataset_id,archive_sha256,member_name,export_date,activity_year,'partial',property_count,1,observations_sha256,summary,'loading',now(),null from tcad_ingest.activity_imports where id=$2",[partial,run]);
 await assert.rejects(db.query("update tcad_ingest.activity_imports set status='complete',completed_at=now() where id=$1",[partial]));

 assert.equal((await db.query('select count(*)::int n from public.property_activity')).rows[0].n,result.rows.length);
 const next='22222222-2222-4222-8222-222222222222';
 await db.query("insert into public.property_releases select $1,tax_year,roll_stage,export_time_raw,source_url,published_at from public.property_releases where dataset_id=$2",[next,anchor]);
 // The next release retains one public property, excludes a now-hidden property,
 // and has no matching activity import of its own.
 await db.query("insert into public.property_search_documents select $1,property_id,address,city,postal_code,property_type,search_text,market_value,appraised_value,assessed_value,land_value,improvement_value,land_acres,source_record_count,values_under_review,shared_ownership,improvement_records,land_segments,is_parkland,is_vacant_land from public.property_search_documents where dataset_id=$2 and property_id in ('100','120')",[next,anchor]);
 await db.query("update public.property_search_documents set values_under_review=true where dataset_id=$1 and property_id='120'",[next]);
 await db.query("insert into public.property_snapshot_profiles select $1,dataset_id,property_id,snapshot from public.property_snapshot_profiles where anchor_dataset_id=$2 and dataset_id=$2 and property_id in ('100','120')",[next,anchor]);
 await db.query('update public.property_search_state set dataset_id=$1',[next]);
 await db.exec('set role anon');
 assert.equal((await db.query('select count(*)::int n from public.property_activity')).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int n from public.property_activity where anchor_dataset_id=$1',[anchor])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from public.property_activity where property_id='120'")).rows[0].n,0);
 assert.deepEqual((await db.query('select activity_year from public.property_activity_releases')).rows.map(r=>r.activity_year),[2026]);
 assert.equal((await db.query('select appraisal_export_date::text as appraisal, sales_export_date::text as sales from public.property_activity_releases')).rows[0].sales,'2026-08-27');
 const carried=await call('100');assert.equal(carried.status,'ok');assert.equal(carried.neighborhood,'T2450');assert.equal(carried.rows.length,2);
 await assert.rejects(db.query('select tcad_ingest.carry_forward_property_activity($1,$2)',[anchor,next]));
 await db.exec('reset role');
 assert.equal((await db.query('select tcad_ingest.carry_forward_property_activity($1,$2) n',[anchor,next])).rows[0].n,0);
 const prepared='33333333-3333-4333-8333-333333333333';
 await db.query("insert into public.property_releases select $1,tax_year,roll_stage,export_time_raw,source_url,published_at from public.property_releases where dataset_id=$2",[prepared,anchor]);
 await db.query('insert into public.property_search_documents select $1,property_id,address,city,postal_code,property_type,search_text,market_value,appraised_value,assessed_value,land_value,improvement_value,land_acres,source_record_count,values_under_review,shared_ownership,improvement_records,land_segments,is_parkland,is_vacant_land from public.property_search_documents where dataset_id=$2 and property_id=\'100\'',[prepared,anchor]);
 await db.query('insert into public.property_activity_releases select $1,activity_year,appraisal_export_date,sales_export_date,import_id,now() from public.property_activity_releases where anchor_dataset_id=$2',[prepared,next]);
 await db.query("insert into public.property_activity select $1,activity_year,property_id,event_key,deed_date,sale_date,filed_date,instrument,deed_type,sale_type,sale_source,status,price,price_status,match_method,deed_source from public.property_activity where anchor_dataset_id=$2 and property_id='100' and event_key='s:2'",[prepared,next]);
 await db.query('update public.property_search_state set dataset_id=$1',[prepared]);
 await db.exec('set role anon');
 assert.equal((await db.query('select count(*)::int n from public.property_activity')).rows[0].n,1); // Never mix a prebuilt target with the carried source.
 await db.exec('reset role');
});

test('activity matching batches published inputs without truncation or private access',async t=>{
 const db=await fixtureDatabase();t.after(()=>db.close());
 const anchor='11111111-1111-4111-8111-111111111111';await db.query('select tcad_ingest.publish_property_search($1)',[anchor]);const {old}=await seedComparisons(db);
 // Cross the existing 32-item helper boundary with independently synthetic profiles.
 for(let i=0;i<36;i++){
  const id=String(3800+i);
  await db.query("insert into public.property_search_documents select dataset_id,$1,address,city,postal_code,property_type,public.normalize_property_address(address),market_value,appraised_value,assessed_value,land_value,improvement_value,land_acres,source_record_count,values_under_review,shared_ownership,improvement_records,land_segments,is_parkland from public.property_search_documents where property_id='120'",[id]);
  await db.query("insert into public.property_snapshot_profiles select anchor_dataset_id,dataset_id,$1,snapshot from public.property_snapshot_profiles where property_id='120' and dataset_id=$2",[id,anchor]);
 }
 await db.exec('set role anon');
 const call=async(id='100',source=anchor,ids=['120','123','103','999'])=>(await db.query('select public.property_activity_match_inputs($1,$2,$3) r',[id,source,ids])).rows[0].r;
 const r=await call();assert.equal(r.available,true);assert.equal(r.items.some(x=>x.property_id==='103'),false);assert.equal(r.items.some(x=>x.property_id==='999'),false);assert.equal(r.items.find(x=>x.property_id==='123').market_value,null);assert.ok(!JSON.stringify(r).includes('PRIVATE'));
 const comparison=(await db.query("select public.property_comparisons('100',$1,array['120']) r",[anchor])).rows[0].r;assert.deepEqual(r.items.find(x=>x.property_id==='120'),comparison.selected[0]);
 const costs=(await db.query("select public.property_comparison_costs($1,$1,array['100','120','123','103','999']) r",[anchor])).rows[0].r;assert.deepEqual(r.cost_chunks[0],costs);
 const many=await call('100',anchor,Array.from({length:36},(_,i)=>String(3800+i)));assert.equal(many.items.length,37);assert.equal(many.cost_chunks.length,2);assert.equal(many.cost_chunks.flatMap(c=>c.items).length,37);
 assert.equal((await call('100',old,['120'])).items.find(x=>x.property_id==='120').market_value,390000);
 assert.equal((await call('103')).available,false);assert.equal((await call('100','33333333-3333-4333-8333-333333333333')).available,false);await assert.rejects(call('100',anchor,Array(50001).fill('120')));await assert.rejects(db.query('select * from tcad_ingest.records'));
 await db.exec("reset role; update public.property_search_documents set values_under_review=true where property_id='120'; set role authenticated");assert.equal((await call()).items.some(x=>x.property_id==='120'),false);
 await db.exec("reset role; delete from public.property_search_state; set role anon");assert.equal((await call()).available,false);
});
