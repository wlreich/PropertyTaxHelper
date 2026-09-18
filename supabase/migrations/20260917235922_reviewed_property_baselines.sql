-- Administrator-reviewed source pairs. Raw appeal values remain private.
create table tcad_ingest.preliminary_review_sources (
 dataset_id uuid not null references tcad_ingest.datasets(id),
 appeals_dataset_id uuid not null references tcad_ingest.datasets(id),
 primary key(dataset_id,appeals_dataset_id)
);
alter table tcad_ingest.preliminary_review_sources enable row level security;
revoke all on tcad_ingest.preliminary_review_sources from public,anon,authenticated,service_role,tcad_loader;

-- Missing or zero appeal values are not evidence against a baseline. Any positive
-- conflicting starting value is excluded conservatively; the dated history stays.
create function tcad_ingest.preliminary_value_conflicts(p_dataset uuid,p_property text,p_market numeric)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(
  select 1 from tcad_ingest.preliminary_review_sources r
  join tcad_ingest.datasets d on d.id=r.dataset_id
  join tcad_ingest.special_json_appeals a on a.dataset_id=r.appeals_dataset_id
   and a.property_id=ltrim(p_property,'0') and a.tax_year=d.tax_year
  where r.dataset_id=p_dataset and a.initial_appraised_value>0
   and a.initial_appraised_value is distinct from p_market
 )
$$;
revoke all on function tcad_ingest.preliminary_value_conflicts(uuid,text,numeric) from public,anon,authenticated,service_role,tcad_loader;

create or replace function tcad_ingest.publish_property_snapshots(p_dataset uuid,p_after text default '',p_limit integer default 2000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; anchor uuid; ids text[]; raw_ids text[]; inserted integer; source_date text; lap timestamptz := clock_timestamp(); timings jsonb := '{}';
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
 source_date:=case when d.export_run_time_raw ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' then
  substr(d.export_run_time_raw,7,4)||'-'||substr(d.export_run_time_raw,1,2)||'-'||substr(d.export_run_time_raw,4,2) end;
 timings:=timings || jsonb_build_object('selection',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create temporary table profile_records on commit drop as
 select ltrim(r.prop_id,'0') id,f.record_type,
 case when f.record_type='Property' then (select jsonb_object_agg(key,value) from jsonb_each_text(r.fields) where key in
 ('market_value','assessed_val','land_hstd_val','land_non_hstd_val','imprv_hstd_val','imprv_non_hstd_val','land_acres','hood_cd','arb_protest_flag','arb_agent_id','py_confidential_flag','jan1_confidential_flag','appr_confidential_flag','partial_owner','ownership_pct','udi_group')
 or (right(key,7)='_exempt' and value='T'))
 when f.record_type='PropertyEntity' then (select jsonb_object_agg(key,value) from jsonb_each_text(r.fields) where key in ('entity_cd','entity_name','taxable_val')
 or (right(key,4)='_amt' and key not in ('hs_local_amt','hs_state_amt') and ltrim(value,'0.')<>''))
 else r.fields end as fields
 from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset and r.prop_id=any(raw_ids)
 and ltrim(r.prop_val_yr,'0')=d.tax_year::text
 and f.record_type in ('Property','PropertyEntity','ImprovementDetail','ARB');
 timings:=timings || jsonb_build_object('source',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create index on pg_temp.profile_records(id,record_type);
 create temporary table profile_agents on commit drop as
 select distinct nullif(ltrim(r.fields->>'agent_id','0'),'') id from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset and f.record_type='Agent';
 create index on pg_temp.profile_agents(id);
 analyze pg_temp.profile_records;
 timings:=timings || jsonb_build_object('indexes',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 delete from public.property_snapshot_profiles where anchor_dataset_id=anchor and dataset_id=p_dataset and property_id=any(ids);
 timings:=timings || jsonb_build_object('delete',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 insert into public.property_snapshot_profiles
 select anchor,p_dataset,p.id,jsonb_build_object(
  'dataset_id',p_dataset,'tax_year',d.tax_year,'roll_stage',d.roll_stage,'export_date',source_date,'export_time_raw',d.export_run_time_raw,
  'preliminary_baseline_eligible',not d.preliminary_baseline_excluded
   and not tcad_ingest.preliminary_value_conflicts(p_dataset,p.id,tcad_ingest.profile_number(p.fields->>'market_value')),
  'valuation_note',d.valuation_note,
  'market_value',tcad_ingest.profile_number(p.fields->>'market_value'),
  'assessed_value',tcad_ingest.profile_number(p.fields->>'assessed_val'),
  'land_value',tcad_ingest.profile_number(p.fields->>'land_hstd_val')+tcad_ingest.profile_number(p.fields->>'land_non_hstd_val'),
  'improvement_value',tcad_ingest.profile_number(p.fields->>'imprv_hstd_val')+tcad_ingest.profile_number(p.fields->>'imprv_non_hstd_val'),
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
   'class_code',nullif(c.fields->>'imprv_det_class_cd',''),'year_built',tcad_ingest.profile_number(c.fields->>'yr_built'),
   'area',tcad_ingest.profile_number(c.fields->>'imprv_det_area'),'value',tcad_ingest.profile_number(c.fields->>'imprv_det_val'))
   order by c.fields->>'imprv_det_id') from pg_temp.profile_records c where c.id=p.id and c.record_type='ImprovementDetail'),'[]'::jsonb),
  'entities',coalesce((select jsonb_agg(jsonb_build_object('code',e.fields->>'entity_cd','name',e.fields->>'entity_name',
   'taxable_value',tcad_ingest.profile_number(e.fields->>'taxable_val'),
   'exemptions',coalesce((select jsonb_object_agg(upper(left(key,length(key)-4)),tcad_ingest.profile_number(value))
    from jsonb_each_text(e.fields) where right(key,4)='_amt' and key not in ('hs_local_amt','hs_state_amt') and tcad_ingest.profile_number(value)>0),'{}'::jsonb))
   order by e.fields->>'entity_cd') from pg_temp.profile_records e where e.id=p.id and e.record_type='PropertyEntity'
   and nullif(e.fields->>'entity_cd','') is not null and e.fields->>'entity_cd'<>'0A'
   and not exists(select 1 from pg_temp.profile_records e2 where e2.id=e.id and e2.record_type='PropertyEntity'
    and e2.fields->>'entity_cd'=e.fields->>'entity_cd' group by e2.fields->>'entity_cd' having count(*)>1)),'[]'::jsonb))
 from pg_temp.profile_records p join public.property_search_documents visible on visible.dataset_id=anchor and visible.property_id=p.id
 where p.record_type='Property' and not visible.shared_ownership and not visible.values_under_review
 and p.fields->>'py_confidential_flag'='F' and p.fields->>'jan1_confidential_flag'='F' and p.fields->>'appr_confidential_flag'='F'
 and p.fields->>'partial_owner'='F' and (tcad_ingest.profile_number(p.fields->>'ownership_pct')=100
  or (d.header->>'export_version'='8.0.0.30' and not (p.fields ? 'ownership_pct')))
 and nullif(ltrim(p.fields->>'udi_group','0'),'') is null
 and (select count(*) from pg_temp.profile_records p2 where p2.id=p.id and p2.record_type='Property')=1;
 get diagnostics inserted=row_count;
 drop table pg_temp.profile_records;
 drop table pg_temp.profile_agents;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,'next',ids[cardinality(ids)],'timings',timings || jsonb_build_object('projection',extract(epoch from clock_timestamp()-lap)));
end $$;
revoke all on function tcad_ingest.publish_property_snapshots(uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;

create or replace function tcad_ingest.prepare_property_snapshots(p_dataset uuid,p_anchor uuid,p_after text default '',p_limit integer default 2000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; anchor uuid; ids text[]; raw_ids text[]; inserted integer; source_date text; lap timestamptz := clock_timestamp(); timings jsonb := '{}';
begin
 if p_limit not between 1 and 50000 then raise exception 'Invalid batch size'; end if;
 perform pg_advisory_xact_lock(hashtext('property_snapshots'),hashtext(p_dataset::text));
 select * into d from tcad_ingest.datasets where id=p_dataset and status='ready';
 if not found or (select count(*) from tcad_ingest.files where dataset_id=p_dataset and record_type is not null and status='complete')<>20 then
  raise exception 'Only complete ready datasets can be published'; end if;
 anchor:=p_anchor;
 if exists(select 1 from public.property_search_state where dataset_id=anchor) then raise exception 'Cannot prepare the active release'; end if;
 if anchor is null then raise exception 'Publish the search release first'; end if;
 select array_agg(property_id order by property_id) into ids from (
  select property_id from public.property_search_documents where dataset_id=anchor and property_id>p_after
  order by property_id limit p_limit) q;
 if ids is null then return jsonb_build_object('processed',0,'published',0,'next',p_after); end if;
 select array_agg(v) into raw_ids from (select unnest(ids) v union select lpad(unnest(ids),12,'0')) q;
 source_date:=case when d.export_run_time_raw ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' then
  substr(d.export_run_time_raw,7,4)||'-'||substr(d.export_run_time_raw,1,2)||'-'||substr(d.export_run_time_raw,4,2) end;
 timings:=timings || jsonb_build_object('selection',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create temporary table profile_records on commit drop as
 select ltrim(r.prop_id,'0') id,f.record_type,
 case when f.record_type='Property' then (select jsonb_object_agg(key,value) from jsonb_each_text(r.fields) where key in
 ('market_value','assessed_val','land_hstd_val','land_non_hstd_val','imprv_hstd_val','imprv_non_hstd_val','land_acres','hood_cd','arb_protest_flag','arb_agent_id','py_confidential_flag','jan1_confidential_flag','appr_confidential_flag','partial_owner','ownership_pct','udi_group')
 or (right(key,7)='_exempt' and value='T'))
 when f.record_type='PropertyEntity' then (select jsonb_object_agg(key,value) from jsonb_each_text(r.fields) where key in ('entity_cd','entity_name','taxable_val')
 or (right(key,4)='_amt' and key not in ('hs_local_amt','hs_state_amt') and ltrim(value,'0.')<>''))
 else r.fields end as fields
 from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset and r.prop_id=any(raw_ids)
 and ltrim(r.prop_val_yr,'0')=d.tax_year::text
 and f.record_type in ('Property','PropertyEntity','ImprovementDetail','ARB');
 timings:=timings || jsonb_build_object('source',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create index on pg_temp.profile_records(id,record_type);
 create temporary table profile_agents on commit drop as
 select distinct nullif(ltrim(r.fields->>'agent_id','0'),'') id from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset and f.record_type='Agent';
 create index on pg_temp.profile_agents(id);
 analyze pg_temp.profile_records;
 timings:=timings || jsonb_build_object('indexes',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 delete from public.property_snapshot_profiles where anchor_dataset_id=anchor and dataset_id=p_dataset and property_id=any(ids);
 timings:=timings || jsonb_build_object('delete',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 insert into public.property_snapshot_profiles
 select anchor,p_dataset,p.id,jsonb_build_object(
  'dataset_id',p_dataset,'tax_year',d.tax_year,'roll_stage',d.roll_stage,'export_date',source_date,'export_time_raw',d.export_run_time_raw,
  'preliminary_baseline_eligible',not d.preliminary_baseline_excluded
   and not tcad_ingest.preliminary_value_conflicts(p_dataset,p.id,tcad_ingest.profile_number(p.fields->>'market_value')),
  'valuation_note',d.valuation_note,
  'market_value',tcad_ingest.profile_number(p.fields->>'market_value'),
  'assessed_value',tcad_ingest.profile_number(p.fields->>'assessed_val'),
  'land_value',tcad_ingest.profile_number(p.fields->>'land_hstd_val')+tcad_ingest.profile_number(p.fields->>'land_non_hstd_val'),
  'improvement_value',tcad_ingest.profile_number(p.fields->>'imprv_hstd_val')+tcad_ingest.profile_number(p.fields->>'imprv_non_hstd_val'),
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
   'class_code',nullif(c.fields->>'imprv_det_class_cd',''),'year_built',tcad_ingest.profile_number(c.fields->>'yr_built'),
   'area',tcad_ingest.profile_number(c.fields->>'imprv_det_area'),'value',tcad_ingest.profile_number(c.fields->>'imprv_det_val'))
   order by c.fields->>'imprv_det_id') from pg_temp.profile_records c where c.id=p.id and c.record_type='ImprovementDetail'),'[]'::jsonb),
  'entities',coalesce((select jsonb_agg(jsonb_build_object('code',e.fields->>'entity_cd','name',e.fields->>'entity_name',
   'taxable_value',tcad_ingest.profile_number(e.fields->>'taxable_val'),
   'exemptions',coalesce((select jsonb_object_agg(upper(left(key,length(key)-4)),tcad_ingest.profile_number(value))
    from jsonb_each_text(e.fields) where right(key,4)='_amt' and key not in ('hs_local_amt','hs_state_amt') and tcad_ingest.profile_number(value)>0),'{}'::jsonb))
   order by e.fields->>'entity_cd') from pg_temp.profile_records e where e.id=p.id and e.record_type='PropertyEntity'
   and nullif(e.fields->>'entity_cd','') is not null and e.fields->>'entity_cd'<>'0A'
   and not exists(select 1 from pg_temp.profile_records e2 where e2.id=e.id and e2.record_type='PropertyEntity'
    and e2.fields->>'entity_cd'=e.fields->>'entity_cd' group by e2.fields->>'entity_cd' having count(*)>1)),'[]'::jsonb))
 from pg_temp.profile_records p join public.property_search_documents visible on visible.dataset_id=anchor and visible.property_id=p.id
 where p.record_type='Property' and not visible.shared_ownership and not visible.values_under_review
 and p.fields->>'py_confidential_flag'='F' and p.fields->>'jan1_confidential_flag'='F' and p.fields->>'appr_confidential_flag'='F'
 and p.fields->>'partial_owner'='F' and (tcad_ingest.profile_number(p.fields->>'ownership_pct')=100
  or (d.header->>'export_version'='8.0.0.30' and not (p.fields ? 'ownership_pct')))
 and nullif(ltrim(p.fields->>'udi_group','0'),'') is null
 and (select count(*) from pg_temp.profile_records p2 where p2.id=p.id and p2.record_type='Property')=1;
 get diagnostics inserted=row_count;
 drop table pg_temp.profile_records;
 drop table pg_temp.profile_agents;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,'next',ids[cardinality(ids)],'timings',timings || jsonb_build_object('projection',extract(epoch from clock_timestamp()-lap)));
end $$;
revoke all on function tcad_ingest.prepare_property_snapshots(uuid,uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;

create or replace function public.property_neighborhood(p_id text,p_source uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='15s' as $$
declare anchor uuid; doc record; current_snapshot jsonb; source_id uuid; releases jsonb;
 pre_id uuid; cert_id uuid; prior_id uuid; ids text[]; homes jsonb; caps jsonb:='[]';
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' then raise exception 'Invalid property' using errcode='22023'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 if anchor is null then return jsonb_build_object('available',false); end if;
 select * into doc from public.property_search_documents where dataset_id=anchor and property_id=ltrim(p_id,'0')
  and not shared_ownership and not values_under_review and not is_parkland;
 if not found then return jsonb_build_object('available',true,'status','missing_property'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('dataset_id',s.dataset_id,'tax_year',s.snapshot->'tax_year','roll_stage',s.snapshot->'roll_stage','export_date',s.snapshot->'export_date','preliminary_baseline_eligible',s.snapshot->'preliminary_baseline_eligible')
  order by s.snapshot->>'tax_year' desc,s.snapshot->>'export_date' desc,s.dataset_id),'[]') into releases
 from public.property_snapshot_profiles s where s.anchor_dataset_id=anchor and s.property_id=doc.property_id;
 select s.dataset_id,s.snapshot into source_id,current_snapshot from public.property_snapshot_profiles s
 join public.property_releases r on r.dataset_id=anchor
 where s.anchor_dataset_id=anchor and s.property_id=doc.property_id and
  (case when p_source is not null then s.dataset_id=p_source else (s.snapshot->>'tax_year')::int=r.tax_year
   and s.snapshot->>'roll_stage'=r.roll_stage and (s.snapshot->>'export_time_raw') is not distinct from r.export_time_raw end)
 order by s.dataset_id limit 1;
 if source_id is null then return jsonb_build_object('available',true,'status','missing_snapshot'); end if;
 if nullif(current_snapshot->>'neighborhood','') is null then return jsonb_build_object('available',true,'status','missing_area'); end if;
 -- Metadata comes only from published subject releases. No future valuation is
 -- introduced into a preliminary-release view. Earliest preliminary, latest certified.
 select (e->>'dataset_id')::uuid into pre_id from jsonb_array_elements(releases) e
 where e->>'tax_year'=current_snapshot->>'tax_year' and e->>'roll_stage'='preliminary' and e->>'preliminary_baseline_eligible' is distinct from 'false'
  and e->>'export_date'<=current_snapshot->>'export_date' order by e->>'export_date',e->>'dataset_id' limit 1;
 select (e->>'dataset_id')::uuid into cert_id from jsonb_array_elements(releases) e
 where e->>'tax_year'=current_snapshot->>'tax_year' and e->>'roll_stage'='certified'
  and e->>'export_date'<=current_snapshot->>'export_date' order by e->>'export_date' desc,e->>'dataset_id' limit 1;
 if pre_id is not null and cert_id is not null and
  (select e->>'export_date' from jsonb_array_elements(releases) e where e->>'dataset_id'=pre_id::text)>=
  (select e->>'export_date' from jsonb_array_elements(releases) e where e->>'dataset_id'=cert_id::text) then cert_id:=null; end if;
 select (e->>'dataset_id')::uuid into prior_id from jsonb_array_elements(releases) e
 where (e->>'tax_year')::int=(current_snapshot->>'tax_year')::int-1 and e->>'roll_stage'='certified'
 order by e->>'export_date' desc nulls last,e->>'dataset_id' limit 1;
 select array_agg(property_id) into ids from (
  select a.property_id from public.property_comparison_areas a
  join public.property_snapshot_profiles s on s.anchor_dataset_id=a.anchor_dataset_id and s.dataset_id=a.dataset_id and s.property_id=a.property_id
  join public.property_search_documents d on d.dataset_id=a.anchor_dataset_id and d.property_id=a.property_id
  where a.anchor_dataset_id=anchor and a.dataset_id=source_id and a.neighborhood=current_snapshot->>'neighborhood'
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland
   and exists(select 1 from jsonb_array_elements(coalesce(s.snapshot->'components','[]')) c
    where c->>'code' in ('1ST','2ND','3RD') and c->>'class_code' ~ '^R[1-6]')
  order by a.property_id limit 10001
 ) population;
 if coalesce(cardinality(ids),0)>10000 then return jsonb_build_object('available',true,'status','area_too_large'); end if;
 if pre_id is not null then caps:=parcel_comparison.cap_inputs(anchor,pre_id,coalesce(ids,array[]::text[])); end if;
 select coalesce(jsonb_agg(jsonb_build_object('property_id',s.property_id,
  'market',s.snapshot->'market_value','area',facts->'living_area',
  'preliminary',p.snapshot->'market_value','certified',c.snapshot->'market_value',
  'certified_area',public.property_comparison_item(s.property_id,'','','',c.snapshot)->'living_area',
  'prior',y.snapshot->'market_value',
  'protested',exists(select 1 from public.property_protest_observations o where o.anchor_dataset_id=anchor and o.property_id=s.property_id
    and o.tax_year=(current_snapshot->>'tax_year')::int and (o.protest_flag is true or o.arb_case_listed))
   or exists(select 1 from public.property_snapshot_profiles x where x.anchor_dataset_id=anchor and x.property_id=s.property_id
    and x.snapshot->>'tax_year'=current_snapshot->>'tax_year' and (x.snapshot->>'protest_flag'='true' or x.snapshot->>'arb_case_listed'='true')),
  'entities',coalesce((select jsonb_agg(jsonb_build_object('code',e->>'code','name',e->>'name')) from jsonb_array_elements(coalesce(s.snapshot->'entities','[]')) e),'[]')
 ) order by s.property_id),'[]') into homes
 from public.property_snapshot_profiles s
 cross join lateral (select public.property_comparison_item(s.property_id,'','','',s.snapshot) facts) f
 left join public.property_snapshot_profiles p on p.anchor_dataset_id=anchor and p.property_id=s.property_id and p.dataset_id=pre_id
  and p.snapshot->>'preliminary_baseline_eligible' is distinct from 'false'
 left join public.property_snapshot_profiles c on c.anchor_dataset_id=anchor and c.property_id=s.property_id and c.dataset_id=cert_id
 left join public.property_snapshot_profiles y on y.anchor_dataset_id=anchor and y.property_id=s.property_id and y.dataset_id=prior_id
 where s.anchor_dataset_id=anchor and s.dataset_id=source_id and s.property_id=any(ids);
 return jsonb_build_object('available',true,'status','ok','anchor_id',anchor,'source_id',source_id,'releases',releases,
  'preliminary_id',pre_id,'certified_id',cert_id,'prior_id',prior_id,'neighborhood',current_snapshot->>'neighborhood',
  'subject',public.property_comparison_item(doc.property_id,doc.address,doc.city,doc.property_type,current_snapshot),
  'homes',homes,'caps',caps);
end $$;
revoke all on function public.property_neighborhood(text,uuid) from public;
grant execute on function public.property_neighborhood(text,uuid) to anon,authenticated;
