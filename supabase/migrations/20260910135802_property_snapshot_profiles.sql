-- Curated, date-stamped property histories. No privileged code runs on a website request.
create table public.property_snapshot_profiles (
 anchor_dataset_id uuid not null references public.property_releases(dataset_id),
 dataset_id uuid not null,
 property_id text not null,
 snapshot jsonb not null,
 primary key(anchor_dataset_id,property_id,dataset_id)
);
alter table public.property_snapshot_profiles enable row level security;
revoke all on public.property_snapshot_profiles from public,anon,authenticated;
grant select on public.property_snapshot_profiles to anon,authenticated;
create policy visible_property_snapshots on public.property_snapshot_profiles for select to anon,authenticated
 using(anchor_dataset_id=(select dataset_id from public.property_search_state where singleton)
 and exists(select 1 from public.property_search_documents d where d.dataset_id=anchor_dataset_id
  and d.property_id=property_snapshot_profiles.property_id and not d.shared_ownership and not d.values_under_review));

create function public.property_history(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('snapshots',coalesce((select jsonb_agg(snapshot order by
  (snapshot->>'tax_year')::integer,snapshot->>'export_date',dataset_id)
 from public.property_snapshot_profiles where property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb))
$$;
revoke all on function public.property_history(text) from public;
grant execute on function public.property_history(text) to anon,authenticated;

-- Explicit administrator publication, resumable by current property ID, bounded per transaction.
-- Historical shared groups and ambiguous owner records are withheld conservatively.
create function tcad_ingest.publish_property_snapshots(p_dataset uuid,p_after text default '',p_limit integer default 2000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; anchor uuid; ids text[]; raw_ids text[]; inserted integer; source_date text;
begin
 if p_limit not between 1 and 50000 then raise exception 'Invalid batch size'; end if;
 perform pg_advisory_xact_lock(hashtext('property_snapshots'),hashtext(p_dataset::text));
 select * into d from tcad_ingest.datasets where id=p_dataset and status='ready';
 if not found or (select count(*) from tcad_ingest.files where dataset_id=p_dataset and record_type is not null and status='complete')<>20 then
  raise exception 'Only complete ready datasets can be published'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 if anchor is null then raise exception 'Publish the search release first'; end if;
 select array_agg(property_id order by property_id) into ids from (
  select property_id from public.property_search_documents where dataset_id=anchor and property_id>p_after
  order by property_id limit p_limit) q;
 if ids is null then return jsonb_build_object('processed',0,'published',0,'next',p_after); end if;
 select array_agg(v) into raw_ids from (select unnest(ids) v union select lpad(unnest(ids),12,'0')) q;
 source_date:=case when d.export_run_time_raw ~ '^\d{2}/\d{2}/\d{4}' then
  substr(d.export_run_time_raw,7,4)||'-'||substr(d.export_run_time_raw,1,2)||'-'||substr(d.export_run_time_raw,4,2) end;
 create temporary table profile_records on commit drop as
 select ltrim(r.prop_id,'0') id,f.record_type,r.fields
 from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset and r.prop_id=any(raw_ids)
 and ltrim(r.prop_val_yr,'0')=d.tax_year::text
 and f.record_type in ('Property','PropertyEntity','ImprovementDetail','ARB');
 create index on pg_temp.profile_records(id,record_type);
 create temporary table profile_agents on commit drop as
 select distinct nullif(ltrim(r.fields->>'agent_id','0'),'') id from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset and f.record_type='Agent';
 create index on pg_temp.profile_agents(id);
 analyze pg_temp.profile_records;
 delete from public.property_snapshot_profiles where anchor_dataset_id=anchor and dataset_id=p_dataset and property_id=any(ids);
 insert into public.property_snapshot_profiles
 select anchor,p_dataset,p.id,jsonb_build_object(
  'dataset_id',p_dataset,'tax_year',d.tax_year,'roll_stage',d.roll_stage,'export_date',source_date,'export_time_raw',d.export_run_time_raw,
  'market_value',tcad_ingest.search_number(p.fields->>'market_value'),
  'assessed_value',tcad_ingest.search_number(p.fields->>'assessed_val'),
  'land_value',tcad_ingest.search_number(p.fields->>'land_hstd_val')+tcad_ingest.search_number(p.fields->>'land_non_hstd_val'),
  'improvement_value',tcad_ingest.search_number(p.fields->>'imprv_hstd_val')+tcad_ingest.search_number(p.fields->>'imprv_non_hstd_val'),
  'land_acres',tcad_ingest.search_acres(p.fields->>'land_acres'),
  'neighborhood',nullif(p.fields->>'hood_cd',''),
  'protest_flag',case p.fields->>'arb_protest_flag' when 'T' then true when 'F' then false end,
  'arb_case_listed',exists(select 1 from pg_temp.profile_records a where a.id=p.id and a.record_type='ARB'),
  'arb_agent_listed',exists(select 1 from pg_temp.profile_agents a where a.id=nullif(ltrim(p.fields->>'arb_agent_id','0'),'')),
  'exemptions',coalesce((select jsonb_agg(upper(left(key,length(key)-7)) order by key)
   from jsonb_each_text(p.fields) where right(key,7)='_exempt' and value='T'),'[]'::jsonb),
  'components',coalesce((select jsonb_agg(jsonb_build_object(
   'id',nullif(ltrim(c.fields->>'imprv_det_id','0'),''),'improvement_id',nullif(ltrim(c.fields->>'imprv_id','0'),''),
   'code',coalesce(c.fields->>'imprv_det_type_cd',''),'description',coalesce(c.fields->>'imprv_det_type_desc',''),
   'class_code',nullif(c.fields->>'imprv_det_class_cd',''),'year_built',tcad_ingest.search_number(c.fields->>'yr_built'),
   'area',tcad_ingest.search_number(c.fields->>'imprv_det_area'),'value',tcad_ingest.search_number(c.fields->>'imprv_det_val'))
   order by c.fields->>'imprv_det_id') from pg_temp.profile_records c where c.id=p.id and c.record_type='ImprovementDetail'),'[]'::jsonb),
  'entities',coalesce((select jsonb_agg(jsonb_build_object('code',e.fields->>'entity_cd','name',e.fields->>'entity_name',
   'taxable_value',tcad_ingest.search_number(e.fields->>'taxable_val'),
   'exemptions',coalesce((select jsonb_object_agg(upper(left(key,length(key)-4)),tcad_ingest.search_number(value))
    from jsonb_each_text(e.fields) where right(key,4)='_amt' and key not in ('hs_local_amt','hs_state_amt') and tcad_ingest.search_number(value)>0),'{}'::jsonb))
   order by e.fields->>'entity_cd') from pg_temp.profile_records e where e.id=p.id and e.record_type='PropertyEntity'
   and nullif(e.fields->>'entity_cd','') is not null and e.fields->>'entity_cd'<>'0A'
   and not exists(select 1 from pg_temp.profile_records e2 where e2.id=e.id and e2.record_type='PropertyEntity'
    and e2.fields->>'entity_cd'=e.fields->>'entity_cd' group by e2.fields->>'entity_cd' having count(*)>1)),'[]'::jsonb))
 from pg_temp.profile_records p join public.property_search_documents visible on visible.dataset_id=anchor and visible.property_id=p.id
 where p.record_type='Property' and not visible.shared_ownership and not visible.values_under_review
 and p.fields->>'py_confidential_flag'='F' and p.fields->>'jan1_confidential_flag'='F' and p.fields->>'appr_confidential_flag'='F'
 and p.fields->>'partial_owner'='F' and tcad_ingest.search_number(p.fields->>'ownership_pct')=100
 and nullif(ltrim(p.fields->>'udi_group','0'),'') is null
 and (select count(*) from pg_temp.profile_records p2 where p2.id=p.id and p2.record_type='Property')=1;
 get diagnostics inserted=row_count;
 drop table pg_temp.profile_records;
 drop table pg_temp.profile_agents;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,'next',ids[cardinality(ids)]);
end $$;
revoke all on function tcad_ingest.publish_property_snapshots(uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;
