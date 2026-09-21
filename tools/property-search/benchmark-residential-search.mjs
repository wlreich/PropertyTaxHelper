// Synthetic data only. Run: node benchmark-residential-search.mjs [row-count]
// PAR-37 targeted comparison of the existing/fixed public RPCs in the same database, with RLS and generic plans.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';

const count=Number(process.argv[2] ?? 100000);
assert.ok(Number.isInteger(count) && count>=10000 && count<=1000000);
const migration=async name=>readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
const db=new PGlite({extensions:{pg_trgm}});
try {
 await db.exec('create role anon; create role authenticated; grant usage on schema public to anon,authenticated');
 const base=await migration('20260908170902_property_search_projection');
 await db.exec(base.slice(0,base.indexOf('create function public.search_properties')));
 await db.exec('alter table public.property_search_documents add column is_parkland boolean not null default false');
 for(const name of ['20260913154859_address_search_v2','20260913155642_address_search_candidates','20260914192337_property_search_suggestions','20260918223337_indexed_numbered_property_search']) await db.exec(await migration(name));
 await db.exec(`insert into public.property_releases(dataset_id,tax_year,roll_stage,source_url)
 values('11111111-1111-4111-8111-111111111111',2026,'certified','https://traviscad.org/fixture');
 insert into public.property_search_state values(true,'11111111-1111-4111-8111-111111111111');
 insert into public.property_search_documents(dataset_id,property_id,address,city,postal_code,property_type,search_text,
 source_record_count,values_under_review,shared_ownership,improvement_records,land_segments)
 select '11111111-1111-4111-8111-111111111111',(9000000+i)::text,
 (i%2000+1)||' SAMPLE '||(i/2000)||' ST','FIXTURE CITY','78700','R',
 (i%2000+1)||' SAMPLE '||(i/2000)||' ST FIXTURE CITY 78700',1,false,false,1,1
 from generate_series(1,${count}) i;
 analyze public.property_search_documents;
 set role anon; set plan_cache_mode=force_generic_plan;`);
 await db.exec("reset role; alter table public.property_search_documents add column is_vacant_land boolean not null default false; update public.property_search_documents set address='HIGH LONESOME',search_text='HIGH LONESOME',is_vacant_land=(property_id::bigint%12000=0) where property_id::bigint%6000=0; analyze public.property_search_documents; set role anon");
 const cases=[['suggest house','select public.suggest_property_parcels($1,8,false) result','1104'],
  ['suggest street','select public.suggest_property_parcels($1,8,false) result','HIGH LONESOME'],
  ['suggest ID','select public.suggest_property_parcels($1,8,false) result','9000100'],
  ['search address','select public.search_property_parcels_v2($1,0,false) result','1104 Sample 0 St'],
  ['search ID','select public.search_property_parcels_v2($1,0,false) result','9000100'],
  ['numbered typo','select public.search_property_parcels_v2($1,0,false) result','1104 Samlpe 0 St']];
 const measure=async()=>{
  const output=[];
  for(const [name,sql,q] of cases){
   const times=[];let result;
   for(let i=0;i<4;i++){
    const start=performance.now();
    result=(await db.query(sql,[q])).rows[0].result;
    if(i) times.push(performance.now()-start);
   }
   output.push({name,ms:times.sort((a,b)=>a-b)[1],result});
  }
  return output;
 };
 const before=await measure();
 await db.exec('reset role');
 const fix=await migration('20260921023946_residential_discovery_vacant_lots');
 await db.exec(fix.slice(fix.indexOf('create or replace function public.search_property_parcels('))); 
 await db.exec('analyze public.property_search_documents; set role anon');
 const after=await measure();
 for(let i=0;i<before.length;i++) {if(before[i].name==='suggest street') {assert.equal(after[i].result.items.length,8);assert.ok(after[i].result.items.every(x=>Number(x.property_id)%12000!==0));}else assert.deepEqual(after[i].result,before[i].result);}
 console.log(JSON.stringify({rows:count,role:'anon',plan:'force_generic_plan',synthetic:true,
  results:before.map((x,i)=>({query:x.name,before_ms:+x.ms.toFixed(2),after_ms:+after[i].ms.toFixed(2),speedup:+(x.ms/after[i].ms).toFixed(1)}))},null,2));
 const plan=(await db.query(`explain (analyze,format json) select property_id from public.property_search_documents
 where dataset_id='11111111-1111-4111-8111-111111111111'
 and not is_vacant_land and search_text collate "C">='1104 ' and search_text collate "C"<'1104!'`)).rows;
 assert.match(JSON.stringify(plan),/property_search_number_prefix_idx/);
 console.log('Verified indexed public lookup with row-level security enabled.');
} finally {await db.close();}
