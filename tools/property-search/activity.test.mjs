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
 values($1,$2,repeat('a',64),'synthetic.json','2026-08-27',2026,'fixture',8,0,repeat('b',64),'{}','complete',now())`,[run,anchor]);
 const add=async(pid,kind,id,date,extra={})=>{
  const r={run_id:run,property_id:pid,kind,event_id:id,deed_id:kind==='deed'?id:null,event_date:date,date_raw:date,associated_properties:[pid],confidential:false,suppressed:false,multi_property:false,...extra};
  const keys=Object.keys(r);await db.query(`insert into tcad_ingest.activity_observations(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(r));
 };
 await add('100','deed','1','2026-05-27',{instrument:'2026123',filed_date:'2026-05-29'});
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
 await add('120','deed','11','2026-03-01');await add('120','deed','12','2026-03-01');await add('120','sale','13','2026-03-01');
 await db.query('update tcad_ingest.activity_imports set observation_count=(select count(*) from tcad_ingest.activity_observations where run_id=$1) where id=$1',[run]);
 for(let i=0;i<2;i++)await db.query('select tcad_ingest.publish_property_activity(2026)');
 await db.exec('set role anon');
 const call=async(id='100',year=2026)=>(await db.query('select public.property_neighborhood_activity($1,$2) r',[id,year])).rows[0].r;
 const result=await call();assert.equal(result.status,'ok');assert.equal(result.neighborhood,'T2450');assert.deepEqual(result.years,[2026]);assert.equal(result.sources.sales_export_date,'2026-08-27');
 const own=result.rows.filter(r=>r.property_id==='100');assert.equal(own.length,1);assert.equal(own[0].price,650000);assert.equal(own[0].match_method,'deed_id');assert.equal(own[0].filed_date,'2026-05-29');
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
 // A partial source fails publication and leaves the prior projection unchanged.
 await db.query('update tcad_ingest.activity_imports set observation_count=observation_count+1 where id=$1',[run]);
 await assert.rejects(db.query('select tcad_ingest.publish_property_activity(2026)'));
 assert.equal((await db.query('select count(*)::int n from public.property_activity')).rows[0].n,result.rows.length);
 await db.query("insert into public.property_releases select '22222222-2222-4222-8222-222222222222',tax_year,roll_stage,export_time_raw,source_url,published_at from public.property_releases where dataset_id=$1",[anchor]);
 await db.exec("update public.property_search_state set dataset_id='22222222-2222-4222-8222-222222222222'; set role anon");
 assert.equal((await db.query('select count(*)::int n from public.property_activity')).rows[0].n,0);
});
