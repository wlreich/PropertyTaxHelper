-- Private administrator identities; no self-enrollment or public write access.
create schema parcel_admin;
revoke all on schema parcel_admin from public;
grant usage on schema parcel_admin to authenticated;
create table parcel_admin.members (user_id uuid primary key references auth.users(id), created_at timestamptz not null default now());
create table parcel_admin.audit (id bigint generated always as identity primary key, at timestamptz not null default now(), actor uuid, action text not null, details jsonb not null);
alter table parcel_admin.members enable row level security;
alter table parcel_admin.audit enable row level security;
revoke all on all tables in schema parcel_admin from public,anon,authenticated,service_role;
create function parcel_admin.require_admin() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from parcel_admin.members m join auth.users u on u.id=m.user_id
  where m.user_id=actor and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false))
  or not exists(select 1 from auth.sessions s where s.user_id=actor and s.id::text=auth.jwt()->>'session_id') then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 return actor;
end $$;
revoke all on function parcel_admin.require_admin() from public,anon,authenticated;

create table public.assessment_seasons (
 county text not null check(county='travis'), tax_year integer not null check(tax_year between 1900 and 2200),
 starts_on date, filing_deadline date, post_starts_on date, deadline_source text, verified_on date,
 mode text not null default 'automatic' check(mode in ('automatic','manual')),
 manual_phase text check(manual_phase in ('preliminary','protest','post')),
 published boolean not null default false, revision integer not null default 1,
 primary key(county,tax_year),
 check(starts_on is null or extract(year from starts_on)=tax_year),
 check(starts_on is null or filing_deadline is null or starts_on<=filing_deadline),
 check(filing_deadline is null or post_starts_on is null or filing_deadline<post_starts_on),
 check(deadline_source is null or deadline_source ~ '^https://(www[.])?traviscad[.]org(/|$)' or deadline_source ~ '^https://comptroller[.]texas[.]gov(/|$)'),
 check(not published or (starts_on is not null and (mode='manual' and manual_phase is not null or mode='automatic' and filing_deadline is not null and post_starts_on is not null and deadline_source is not null and verified_on is not null))),
 check(not published or filing_deadline is null or deadline_source is not null and verified_on is not null)
);
alter table public.assessment_seasons enable row level security;
revoke all on public.assessment_seasons from public,anon,authenticated,service_role;
grant select on public.assessment_seasons to anon,authenticated;
create policy published_seasons on public.assessment_seasons for select to anon,authenticated using(published);
create function public.season_calendar() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(s) order by tax_year),'[]') from public.assessment_seasons s;
$$;
revoke all on function public.season_calendar() from public;
grant execute on function public.season_calendar() to anon,authenticated;
-- Initial phase explicitly supplied by the product owner; no deadline is invented.
insert into public.assessment_seasons(county,tax_year,starts_on,mode,manual_phase,published)
values('travis',2026,'2026-09-11','manual','post',true);
insert into parcel_admin.audit(action,details) values('initial_season','{"year":2026,"phase":"post","basis":"Product owner confirmed post-protest season; dates not yet configured"}');

create table parcel_admin.season_drafts (like public.assessment_seasons including all);
alter table parcel_admin.season_drafts enable row level security;
revoke all on parcel_admin.season_drafts from public,anon,authenticated,service_role;

create function parcel_admin.save_season(p_config jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; old_row public.assessment_seasons; new_row public.assessment_seasons;
begin
 actor:=parcel_admin.require_admin();
 perform pg_advisory_xact_lock(hashtext('assessment_seasons'));
 select * into new_row from jsonb_populate_record(null::public.assessment_seasons,p_config);
 if new_row.verified_on>(now() at time zone 'America/Chicago')::date then raise exception 'Verification cannot be in the future'; end if;
 select * into old_row from parcel_admin.season_drafts where county=new_row.county and tax_year=new_row.tax_year for update;
 if old_row.tax_year is null then select * into old_row from public.assessment_seasons where county=new_row.county and tax_year=new_row.tax_year for update; end if;
 if coalesce(old_row.revision,0)<>p_revision then raise exception 'Season changed; reload before saving' using errcode='40001'; end if;
 new_row.revision:=coalesce(old_row.revision,0)+1;
 if new_row.published then
 insert into public.assessment_seasons select new_row.* on conflict(county,tax_year) do update set
 starts_on=excluded.starts_on,filing_deadline=excluded.filing_deadline,post_starts_on=excluded.post_starts_on,
 deadline_source=excluded.deadline_source,verified_on=excluded.verified_on,mode=excluded.mode,manual_phase=excluded.manual_phase,published=excluded.published,revision=excluded.revision;
 delete from parcel_admin.season_drafts where county=new_row.county and tax_year=new_row.tax_year;
 else
 delete from parcel_admin.season_drafts where county=new_row.county and tax_year=new_row.tax_year;
 insert into parcel_admin.season_drafts select new_row.*;
 end if;
 insert into parcel_admin.audit(actor,action,details) values(actor,'save_season',jsonb_build_object('before',to_jsonb(old_row),'after',to_jsonb(new_row)));
 return to_jsonb(new_row);
end $$;

-- Every preparation uses a new release identity, even when refreshing the same source.
-- Current public RLS continues to expose only the active release throughout preparation.
create table parcel_admin.preparations (
 id uuid primary key default gen_random_uuid(), source_dataset uuid not null references tcad_ingest.datasets,
 expected_active uuid not null, state text not null default 'preparing' check(state in ('preparing','ready','failed','published')),
 created_at timestamptz not null default now(), created_by uuid, error_code text, published_at timestamptz
);
create table parcel_admin.steps (
 preparation uuid not null references parcel_admin.preparations, source_dataset uuid not null references tcad_ingest.datasets,
 kind text not null check(kind in ('search','snapshot','protests','agents')), priority integer not null,
 after_id text not null default '', processed bigint not null default 0, published_count bigint not null default 0,
 complete boolean not null default false, primary key(preparation,source_dataset,kind)
);
alter table parcel_admin.preparations enable row level security;
alter table parcel_admin.steps enable row level security;
revoke all on parcel_admin.preparations,parcel_admin.steps from public,anon,authenticated,service_role;

create function tcad_ingest.prepare_property_search(p_dataset_id uuid,p_anchor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d record; published_count bigint;
begin
 if exists(select 1 from public.property_search_state where dataset_id=p_anchor) then raise exception 'Cannot prepare the active release'; end if;
 perform pg_advisory_xact_lock(837142);
 select * into d from tcad_ingest.datasets where id=p_dataset_id and status='ready';
 if not found then raise exception 'Only a ready release can be published'; end if;
 if (select count(*) from tcad_ingest.files where dataset_id=p_dataset_id and record_type is not null and status='complete')<>20 then
  raise exception 'The release must contain all 20 completed text files';
 end if;
 -- Temporary working tables are private to this connection and transaction.
 create temporary table search_source on commit drop as
 select ltrim(r.prop_id,'0') as property_id,x.* from tcad_ingest.records r
 join tcad_ingest.files f using(dataset_id,member_name)
 cross join lateral jsonb_to_record(r.fields) as x(
  udi_group text,partial_owner text,ownership_pct text,
  py_confidential_flag text,jan1_confidential_flag text,appr_confidential_flag text,
  situs_num text,situs_street_prefx text,situs_street text,situs_street_suffix text,situs_unit text,situs_city text,situs_zip text,
  legal_desc text,prop_type_cd text,market_value text,appraised_val text,assessed_val text,
  land_hstd_val text,land_non_hstd_val text,imprv_hstd_val text,imprv_non_hstd_val text,land_acres text)
 where r.dataset_id=p_dataset_id and f.record_type='Property' and r.prop_val_yr::integer=d.tax_year;
 -- Block the whole ID / shared physical group if any associated source record is confidential or unknown.
 create temporary table search_blocked on commit drop as
 select property_id as id from pg_temp.search_source where
  not coalesce(py_confidential_flag='F' and jan1_confidential_flag='F' and appr_confidential_flag='F',false)
 union select nullif(ltrim(udi_group,'0'),'') from pg_temp.search_source where
  not coalesce(py_confidential_flag='F' and jan1_confidential_flag='F' and appr_confidential_flag='F',false);
 create index on pg_temp.search_blocked(id);
 create temporary table search_children on commit drop as
 select ltrim(r.prop_id,'0') as id,f.record_type,count(*)::integer n
 from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset_id and f.record_type in ('Improvement','LandDetail')
   and r.prop_val_yr::integer=d.tax_year
 group by 1,2;
 create index on pg_temp.search_children(id,record_type);
 insert into public.property_releases(dataset_id,tax_year,roll_stage,export_time_raw,source_url)
 values(p_anchor,d.tax_year,d.roll_stage,d.export_run_time_raw,d.source_url)
 on conflict(dataset_id) do update set published_at=clock_timestamp();
 delete from public.property_search_documents where dataset_id=p_anchor;
 insert into public.property_search_documents
 with base as (
  select p.*,nullif(ltrim(p.udi_group,'0'),'') as group_id,
   trim(concat_ws(' ',nullif(situs_num,''),nullif(situs_street_prefx,''),nullif(situs_street,''),
     nullif(situs_street_suffix,''),case when nullif(situs_unit,'') is not null then 'UNIT '||situs_unit end)) as address,
   coalesce(partial_owner='T',false) or coalesce(tcad_ingest.search_number(ownership_pct)<>100,false) as shared
  from pg_temp.search_source p
 ), grouped as (
  select property_id,min(address) address,coalesce(min(situs_city),'') city,coalesce(min(situs_zip),'') postal_code,
   coalesce(min(prop_type_cd),'') property_type,count(*)::integer source_records,bool_or(shared) shared,
   min(group_id) group_id,
   bool_and(tcad_ingest.is_explicit_parkland(legal_desc)) is_parkland,
   bool_or(shared) or count(distinct market_value)>1 or count(distinct appraised_val)>1 or count(distinct assessed_val)>1 as review,
   case when not bool_or(shared) and count(market_value)=count(*) and count(distinct market_value)=1 then tcad_ingest.search_number(min(market_value)) end market,
   case when not bool_or(shared) and count(appraised_val)=count(*) and count(distinct appraised_val)=1 then tcad_ingest.search_number(min(appraised_val)) end appraised,
   case when not bool_or(shared) and count(assessed_val)=count(*) and count(distinct assessed_val)=1 then tcad_ingest.search_number(min(assessed_val)) end assessed,
   case when not bool_or(shared) and count(land_hstd_val)=count(*) and count(land_non_hstd_val)=count(*)
     and count(distinct land_hstd_val)=1 and count(distinct land_non_hstd_val)=1
     then tcad_ingest.search_number(min(land_hstd_val))+tcad_ingest.search_number(min(land_non_hstd_val)) end land,
   case when not bool_or(shared) and count(imprv_hstd_val)=count(*) and count(imprv_non_hstd_val)=count(*)
     and count(distinct imprv_hstd_val)=1 and count(distinct imprv_non_hstd_val)=1
     then tcad_ingest.search_number(min(imprv_hstd_val))+tcad_ingest.search_number(min(imprv_non_hstd_val)) end improvements,
   case when not bool_or(shared) and count(land_acres)=count(*) and count(distinct land_acres)=1 then tcad_ingest.search_acres(min(land_acres)) end acres
  from base
  group by property_id
  having property_id ~ '^[0-9]{1,12}$' and count(distinct address)=1 and min(address)<>''
   and bool_and(nullif(situs_street,'') is not null)
   and bool_and(coalesce(py_confidential_flag='F' and jan1_confidential_flag='F' and appr_confidential_flag='F',false))
   and count(distinct group_id)<=1
 )
 select p_anchor,g.property_id,g.address,g.city,g.postal_code,g.property_type,
  public.normalize_property_address(concat_ws(' ',g.address,g.city,g.postal_code)),
  g.market,g.appraised,g.assessed,g.land,g.improvements,g.acres,g.source_records,g.review,g.shared,
  coalesce((select sum(n) from pg_temp.search_children c where c.id in (g.property_id,g.group_id) and c.record_type='Improvement'),0)::integer,
  coalesce((select sum(n) from pg_temp.search_children c where c.id in (g.property_id,g.group_id) and c.record_type='LandDetail'),0)::integer,
  g.is_parkland
 from grouped g where not exists(select 1 from pg_temp.search_blocked b where b.id in(g.property_id,g.group_id));
 get diagnostics published_count = row_count;
 if published_count=0 then raise exception 'No eligible properties; publication rolled back'; end if;
 -- Activation is separate and gated on completed preparation.
 analyze public.property_search_documents;
 return jsonb_build_object('published_properties',published_count,'dataset_id',p_anchor);
end $$;
revoke all on function tcad_ingest.prepare_property_search(uuid,uuid) from public,anon,authenticated,service_role,tcad_loader;

create function tcad_ingest.prepare_property_snapshots(p_dataset uuid,p_anchor uuid,p_after text default '',p_limit integer default 2000)
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
 source_date:=case when d.export_run_time_raw ~ '^\d{2}/\d{2}/\d{4}' then
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

create function tcad_ingest.prepare_property_protests(p_dataset uuid,p_anchor uuid,p_after text default '',p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; anchor uuid; ids text[]; raw_ids text[]; inserted integer; source_date text; property_member text; arb_member text; agent_member text;
begin
 if p_limit not between 1 and 50000 then raise exception 'Invalid batch size'; end if;
 perform pg_advisory_xact_lock(hashtext('property_protests'),hashtext(p_dataset::text));
 select * into d from tcad_ingest.datasets where id=p_dataset and status='ready' and import_scope='protests';
 if not found or (select count(*) from tcad_ingest.files where dataset_id=p_dataset and record_type is not null and status='complete')<>4
 or (select count(distinct record_type) from tcad_ingest.files where dataset_id=p_dataset and status='complete'
  and record_type in ('Header','Property','ARB','Agent'))<>4 then
  raise exception 'Only complete ready protest imports can be published'; end if;
 anchor:=p_anchor;
 if exists(select 1 from public.property_search_state where dataset_id=anchor) then raise exception 'Cannot prepare the active release'; end if;
 if anchor is null then raise exception 'Publish the search release first'; end if;
 select array_agg(property_id order by property_id) into ids from (
  select property_id from public.property_search_documents where dataset_id=anchor and property_id>p_after
  order by property_id limit p_limit) q;
 if ids is null then return jsonb_build_object('processed',0,'published',0,'next',p_after,'anchor',anchor); end if;
 select array_agg(v) into raw_ids from (select unnest(ids) v union select lpad(unnest(ids),12,'0')) q;
 select member_name into property_member from tcad_ingest.files where dataset_id=p_dataset and record_type='Property' and status='complete';
 select member_name into arb_member from tcad_ingest.files where dataset_id=p_dataset and record_type='ARB' and status='complete';
 select member_name into agent_member from tcad_ingest.files where dataset_id=p_dataset and record_type='Agent' and status='complete';
 source_date:=case when d.export_run_time_raw ~ '^\d{2}/\d{2}/\d{4}' then
  substr(d.export_run_time_raw,7,4)||'-'||substr(d.export_run_time_raw,1,2)||'-'||substr(d.export_run_time_raw,4,2) end;
 create temporary table protest_records on commit drop as
 select ltrim(r.prop_id,'0') id,ltrim(r.prop_val_yr,'0') record_year,r.member_name=property_member is_property,
 (select jsonb_object_agg(key,value) from jsonb_each_text(r.fields) where key in
 ('arb_protest_flag','arb_agent_id','arb_status','geo_id','ref_id1','ref_id2',
 'py_confidential_flag','jan1_confidential_flag','appr_confidential_flag','partial_owner','ownership_pct','udi_group')) fields
 from tcad_ingest.records r where r.dataset_id=p_dataset and r.prop_id=any(raw_ids)
 and r.member_name in (property_member,arb_member);
 create index on pg_temp.protest_records(id,record_year,is_property);
 analyze pg_temp.protest_records;
 create temporary table protest_agents on commit drop as
 select nullif(ltrim(r.fields->>'agent_id','0'),'') id from tcad_ingest.records r
 where r.dataset_id=p_dataset and r.member_name=agent_member
 group by nullif(ltrim(r.fields->>'agent_id','0'),'') having count(*)=1;
 create index on pg_temp.protest_agents(id);
 delete from public.property_protest_observations where anchor_dataset_id=anchor and dataset_id=p_dataset and property_id=any(ids);
 insert into public.property_protest_observations
 select anchor,p_dataset,p.id,p.record_year::integer,source_date,d.export_run_time_raw,
 case p.fields->>'arb_protest_flag' when 'T' then true when 'F' then false end,
 a.case_count>0,a.codes,agent.listed
 from pg_temp.protest_records p
 join public.property_search_documents visible on visible.dataset_id=anchor and visible.property_id=p.id
 cross join lateral (
  select count(*) case_count,coalesce(array_agg(distinct r.fields->>'arb_status' order by r.fields->>'arb_status')
   filter(where r.fields->>'arb_status' ~ '^[A-Za-z0-9_-]{1,20}$'),'{}'::text[]) codes
  from pg_temp.protest_records r where r.id=p.id and r.record_year=p.record_year and not r.is_property
  -- Identifiers corroborate the primary property/year match when both are supplied.
  and not exists(select 1 from unnest(array['geo_id','ref_id1','ref_id2']) k
   where nullif(r.fields->>k,'') is not null and nullif(p.fields->>k,'') is not null and r.fields->>k<>p.fields->>k)
 ) a
 cross join lateral (select exists(select 1 from pg_temp.protest_agents g where g.id=nullif(ltrim(p.fields->>'arb_agent_id','0'),'')) listed) agent
 where p.is_property and p.record_year=d.tax_year::text
 and not visible.shared_ownership and not visible.values_under_review
 and p.fields->>'py_confidential_flag'='F' and p.fields->>'jan1_confidential_flag'='F' and p.fields->>'appr_confidential_flag'='F'
 and p.fields->>'partial_owner'='F' and (tcad_ingest.profile_number(p.fields->>'ownership_pct')=100
  or (d.header->>'export_version'='8.0.0.30' and not (p.fields ? 'ownership_pct')))
 and nullif(ltrim(p.fields->>'udi_group','0'),'') is null
 and (select count(*) from pg_temp.protest_records p2 where p2.id=p.id and p2.record_year=p.record_year and p2.is_property)=1
 and (p.fields->>'arb_protest_flag'='T' or a.case_count>0 or agent.listed);
 get diagnostics inserted=row_count;
 drop table pg_temp.protest_records;
 drop table pg_temp.protest_agents;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,'next',ids[cardinality(ids)],'anchor',anchor);
end $$;
revoke all on function tcad_ingest.prepare_property_protests(uuid,uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;

create function tcad_ingest.prepare_property_agent_names(p_dataset uuid,p_anchor uuid,p_after text default '',p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; anchor uuid; ids text[]; raw_ids text[]; inserted integer; property_member text; agent_member text; lap timestamptz:=clock_timestamp(); timings jsonb:='{}';
begin
 if p_limit not between 1 and 50000 then raise exception 'Invalid batch size'; end if;
 perform pg_advisory_xact_lock(hashtext('property_agent_names'),hashtext(p_dataset::text));
 select * into d from tcad_ingest.datasets where id=p_dataset and status='ready';
 if not found or (select count(*) from tcad_ingest.files where dataset_id=p_dataset and record_type is not null and status='complete')
  <>(case when d.import_scope='protests' then 4 else 20 end) then raise exception 'Only complete ready datasets can be published'; end if;
 anchor:=p_anchor;
 if exists(select 1 from public.property_search_state where dataset_id=anchor) then raise exception 'Cannot prepare the active release'; end if;
 if anchor is null then raise exception 'Publish the search release first'; end if;
 -- Include existing names so re-publication removes names whose source is now withheld.
 select array_agg(property_id order by property_id) into ids from (
 select property_id from (
  select property_id from public.property_snapshot_profiles where anchor_dataset_id=anchor and dataset_id=p_dataset and snapshot->>'arb_agent_listed'='true'
  union select property_id from public.property_protest_observations where anchor_dataset_id=anchor and dataset_id=p_dataset and arb_agent_listed
  union select property_id from public.property_agent_names where anchor_dataset_id=anchor and dataset_id=p_dataset
 ) eligible where property_id>p_after order by property_id limit p_limit) q;
 if ids is null then return jsonb_build_object('processed',0,'published',0,'next',p_after,'anchor',anchor); end if;
 select array_agg(v) into raw_ids from (select unnest(ids) v union select lpad(unnest(ids),12,'0')) q;
 select member_name into property_member from tcad_ingest.files where dataset_id=p_dataset and record_type='Property' and status='complete';
 select member_name into agent_member from tcad_ingest.files where dataset_id=p_dataset and record_type='Agent' and status='complete';
 if property_member is null or agent_member is null then raise exception 'Property and Agent files are required'; end if;
 timings:=timings||jsonb_build_object('selection',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create temporary table name_properties on commit drop as
 select ltrim(prop_id,'0') id,(select jsonb_object_agg(key,value) from jsonb_each_text(fields) where key in
 ('arb_agent_id','py_confidential_flag','jan1_confidential_flag','appr_confidential_flag','partial_owner','ownership_pct','udi_group')) fields
 from unnest(raw_ids) wanted(raw_id) cross join lateral (
  select r.prop_id,r.fields from tcad_ingest.records r where r.dataset_id=p_dataset and r.prop_id=wanted.raw_id
   and r.member_name=property_member and ltrim(r.prop_val_yr,'0')=d.tax_year::text offset 0
 ) matched;
 timings:=timings||jsonb_build_object('source',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create index on pg_temp.name_properties(id);
 analyze pg_temp.name_properties;
 create temporary table name_agents on commit drop as
 select nullif(ltrim(fields->>'agent_id','0'),'') id,min(nullif(btrim(fields->>'agent_name'),'')) name
 from tcad_ingest.records where dataset_id=p_dataset and member_name=agent_member
 group by nullif(ltrim(fields->>'agent_id','0'),'') having count(*)=1;
 create index on pg_temp.name_agents(id);
 analyze pg_temp.name_agents;
 timings:=timings||jsonb_build_object('agents',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 delete from public.property_agent_names where anchor_dataset_id=anchor and dataset_id=p_dataset and property_id=any(ids);
 timings:=timings||jsonb_build_object('delete',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 create temporary table name_eligible on commit drop as
 select s.property_id from public.property_snapshot_profiles s where s.anchor_dataset_id=anchor and s.dataset_id=p_dataset
 and s.property_id=any(ids) and s.snapshot->>'tax_year'=d.tax_year::text and s.snapshot->>'arb_agent_listed'='true'
 union select o.property_id from public.property_protest_observations o where o.anchor_dataset_id=anchor and o.dataset_id=p_dataset
 and o.property_id=any(ids) and o.tax_year=d.tax_year and o.arb_agent_listed;
 create unique index on pg_temp.name_eligible(property_id);
 analyze pg_temp.name_eligible;
 timings:=timings||jsonb_build_object('eligibility',extract(epoch from clock_timestamp()-lap)); lap:=clock_timestamp();
 insert into public.property_agent_names
 select anchor,p_dataset,p.id,d.tax_year,a.name from pg_temp.name_properties p
 cross join lateral (select a.name from pg_temp.name_agents a
 where a.id=nullif(ltrim(p.fields->>'arb_agent_id','0'),'') offset 0) a
 cross join lateral (select e.property_id from pg_temp.name_eligible e where e.property_id=p.id offset 0) e
 cross join lateral (select v.shared_ownership,v.values_under_review from public.property_search_documents v
 where v.dataset_id=anchor and v.property_id=p.id offset 0) v
 where not v.shared_ownership and not v.values_under_review
 and length(a.name) between 1 and 200 and a.name !~ '[[:cntrl:]]'
 and p.fields->>'py_confidential_flag'='F' and p.fields->>'jan1_confidential_flag'='F' and p.fields->>'appr_confidential_flag'='F'
 and p.fields->>'partial_owner'='F' and (tcad_ingest.profile_number(p.fields->>'ownership_pct')=100
  or (d.header->>'export_version'='8.0.0.30' and not (p.fields ? 'ownership_pct')))
 and nullif(ltrim(p.fields->>'udi_group','0'),'') is null
 and (select count(*) from pg_temp.name_properties p2 where p2.id=p.id)=1;
 get diagnostics inserted=row_count;
 drop table pg_temp.name_properties;
 drop table pg_temp.name_agents;
 drop table pg_temp.name_eligible;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,'next',ids[cardinality(ids)],'anchor',anchor,'timings',timings||jsonb_build_object('publication',extract(epoch from clock_timestamp()-lap)));
end $$;
revoke all on function tcad_ingest.prepare_property_agent_names(uuid,uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;

create function parcel_admin.schedule_preparation() returns void language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $q$select cron.schedule('parcelsavvy-release-preparation','30 seconds',
   'set statement_timeout=''5min''; select parcel_admin.advance_preparation(2000)')$q$;
 end if;
end $$;

create function parcel_admin.prepare_release(p_dataset uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; current_release public.property_releases; source tcad_ingest.datasets; prep uuid;
begin
 actor:=parcel_admin.require_admin();
 perform pg_advisory_xact_lock(hashtext('release_preparation'));
 if exists(select 1 from parcel_admin.preparations where state='preparing') then raise exception 'A release is already being prepared'; end if;
 select r.* into current_release from public.property_releases r join public.property_search_state s using(dataset_id);
 select * into source from tcad_ingest.datasets where id=p_dataset and status='ready' and import_scope='full';
 if source.id is null or current_release.dataset_id is null then raise exception 'A complete valuation release is required'; end if;
 if source.roll_stage not in ('preliminary','certified','supplemental') or source.export_run_time_raw is null then raise exception 'Release stage and export date are required'; end if;
 if source.tax_year<current_release.tax_year or (source.tax_year=current_release.tax_year and
  (to_timestamp(source.export_run_time_raw,'MM/DD/YYYY HH24:MI')<to_timestamp(current_release.export_time_raw,'MM/DD/YYYY HH24:MI') or
  source.roll_stage='preliminary' and current_release.roll_stage in ('certified','supplemental'))) then
  raise exception 'An older source belongs in history, not the current release'; end if;
 insert into parcel_admin.preparations(source_dataset,expected_active,created_by) values(p_dataset,current_release.dataset_id,actor) returning id into prep;
 insert into parcel_admin.steps(preparation,source_dataset,kind,priority) values(prep,p_dataset,'search',0);
 insert into parcel_admin.steps(preparation,source_dataset,kind,priority)
 select prep,d.id,case when d.import_scope='full' then 'snapshot' else 'protests' end,case when d.id=p_dataset then 1 else 2 end
 from tcad_ingest.datasets d where d.status='ready' and d.tax_year<=source.tax_year and d.import_scope in ('full','protests');
 insert into parcel_admin.steps(preparation,source_dataset,kind,priority)
 select prep,d.id,'agents',3 from tcad_ingest.datasets d where d.status='ready' and d.tax_year<=source.tax_year and d.import_scope in ('full','protests');
 insert into parcel_admin.audit(actor,action,details) values(actor,'prepare_release',jsonb_build_object('preparation',prep,'source',p_dataset));
 perform parcel_admin.schedule_preparation();
 return prep;
end $$;

create function parcel_admin.advance_preparation(p_limit integer default 2000) returns jsonb language plpgsql security invoker set search_path='' as $$
declare prep parcel_admin.preparations; step parcel_admin.steps; result jsonb;
begin
 if p_limit not between 1 and 10000 then raise exception 'Invalid batch size'; end if;
 if not pg_try_advisory_xact_lock(hashtext('release_preparation')) then return '{"state":"busy"}'; end if;
 select * into prep from parcel_admin.preparations where state='preparing' order by created_at limit 1 for update;
 if prep.id is null then
  if exists(select 1 from pg_extension where extname='pg_cron') then
   execute $q$select cron.unschedule(jobid) from cron.job where jobname='parcelsavvy-release-preparation'$q$;
  end if;
  return '{"state":"idle"}';
 end if;
 begin
  if (select dataset_id from public.property_search_state where singleton)<>prep.expected_active then raise exception 'Active release changed' using errcode='40001'; end if;
  select * into step from parcel_admin.steps where preparation=prep.id and not complete order by priority,source_dataset limit 1 for update;
  if step.preparation is null then
   update parcel_admin.preparations set state='ready' where id=prep.id;
   insert into parcel_admin.audit(action,details) values('release_ready',jsonb_build_object('preparation',prep.id));
   return jsonb_build_object('state','ready','preparation',prep.id);
  end if;
  if step.kind='search' then
   result:=tcad_ingest.prepare_property_search(step.source_dataset,prep.id);
   update parcel_admin.steps set complete=true,published_count=(result->>'published_properties')::bigint where preparation=prep.id and kind='search';
  else
   result:=case step.kind
    when 'snapshot' then tcad_ingest.prepare_property_snapshots(step.source_dataset,prep.id,step.after_id,p_limit)
    when 'protests' then tcad_ingest.prepare_property_protests(step.source_dataset,prep.id,step.after_id,p_limit)
    when 'agents' then tcad_ingest.prepare_property_agent_names(step.source_dataset,prep.id,step.after_id,p_limit) end;
   update parcel_admin.steps set complete=(result->>'processed')::integer=0,after_id=result->>'next',
    processed=processed+(result->>'processed')::bigint,published_count=published_count+(result->>'published')::bigint
   where preparation=prep.id and source_dataset=step.source_dataset and kind=step.kind;
  end if;
 exception when query_canceled or others then
  update parcel_admin.preparations set state='failed',error_code=sqlstate where id=prep.id;
  insert into parcel_admin.audit(action,details) values('release_failed',jsonb_build_object('preparation',prep.id,'code',sqlstate));
  return jsonb_build_object('state','failed','code',sqlstate);
 end;
 return jsonb_build_object('state','preparing','kind',step.kind,'result',result);
end $$;

create function parcel_admin.release_warnings(p_preparation uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(array_remove(array[
  case when not exists(select 1 from parcel_admin.steps s join tcad_ingest.datasets h on h.id=s.source_dataset where s.preparation=p.id and s.kind='snapshot' and h.tax_year=d.tax_year-1 and h.roll_stage='certified') then 'Prior-year certified comparison is unavailable.' end,
  case when d.roll_stage in ('certified','supplemental') and not exists(select 1 from parcel_admin.steps s join tcad_ingest.datasets h on h.id=s.source_dataset where s.preparation=p.id and s.kind='snapshot' and h.tax_year=d.tax_year and h.roll_stage='preliminary') then 'The preliminary value for this year is unavailable.' end
 ],null)) from parcel_admin.preparations p join tcad_ingest.datasets d on d.id=p.source_dataset where p.id=p_preparation;
$$;

create function parcel_admin.publish_release(p_preparation uuid,p_acknowledge boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; prep parcel_admin.preparations; source tcad_ingest.datasets;
begin
 actor:=parcel_admin.require_admin();
 perform pg_advisory_xact_lock(hashtext('release_preparation'));
 perform pg_advisory_xact_lock(837142);
 select * into prep from parcel_admin.preparations where id=p_preparation for update;
 if prep.id is null or prep.state<>'ready' or exists(select 1 from parcel_admin.steps where preparation=prep.id and not complete) then raise exception 'Release preparation is not complete'; end if;
 if (select dataset_id from public.property_search_state where singleton)<>prep.expected_active then raise exception 'Active release changed; prepare again' using errcode='40001'; end if;
 select * into source from tcad_ingest.datasets where id=prep.source_dataset and status='ready';
 if source.id is null or not exists(select 1 from public.property_snapshot_profiles where anchor_dataset_id=prep.id and dataset_id=prep.source_dataset) then raise exception 'Current property details are missing'; end if;
 if exists(select 1 from parcel_admin.steps s join tcad_ingest.datasets d on d.id=s.source_dataset where s.preparation=prep.id and d.status<>'ready') then raise exception 'A source is no longer ready'; end if;
 if exists(select 1 from tcad_ingest.datasets d where status='ready' and tax_year<=source.tax_year and import_scope in ('full','protests') and not exists(select 1 from parcel_admin.steps s where s.preparation=prep.id and s.source_dataset=d.id)) then raise exception 'New sources arrived; prepare again to retain history'; end if;
 if jsonb_array_length(parcel_admin.release_warnings(prep.id))>0 and not p_acknowledge then raise exception 'Review the missing comparisons before publishing'; end if;
 update public.property_search_state set dataset_id=prep.id where singleton;
 update parcel_admin.preparations set state='published',published_at=now() where id=prep.id;
 insert into parcel_admin.audit(actor,action,details) values(actor,'publish_release',jsonb_build_object('before',prep.expected_active,'after',prep.id,'source',prep.source_dataset,'warnings',parcel_admin.release_warnings(prep.id),'acknowledged',p_acknowledge));
 return prep.id;
end $$;

create function parcel_admin.retry_release(p_preparation uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=parcel_admin.require_admin();
 perform pg_advisory_xact_lock(hashtext('release_preparation'));
 if exists(select 1 from parcel_admin.preparations where state='preparing') then raise exception 'A preparation is already running'; end if;
 update parcel_admin.preparations set state='preparing',error_code=null where id=p_preparation and state='failed' and expected_active=(select dataset_id from public.property_search_state where singleton);
 if not found then raise exception 'This preparation cannot resume; prepare a new release'; end if;
 insert into parcel_admin.audit(actor,action,details) values(actor,'retry_release',jsonb_build_object('preparation',p_preparation));
 perform parcel_admin.schedule_preparation();
end $$;

create function parcel_admin.dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform parcel_admin.require_admin();
 return jsonb_build_object(
 'seasons',(select coalesce(jsonb_agg(to_jsonb(s) order by tax_year desc),'[]') from (select * from parcel_admin.season_drafts union all select * from public.assessment_seasons a where not exists(select 1 from parcel_admin.season_drafts d where d.county=a.county and d.tax_year=a.tax_year)) s),
 'active',(select to_jsonb(r) from public.property_releases r join public.property_search_state s using(dataset_id)),
 'datasets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'tax_year',tax_year,'roll_stage',roll_stage,'export_time_raw',export_run_time_raw,'import_scope',import_scope) order by tax_year desc,export_run_time_raw desc),'[]') from tcad_ingest.datasets where status='ready'),
 'preparations',(select coalesce(jsonb_agg(q.item order by q.created_at desc),'[]') from (
  select p.created_at,to_jsonb(p)||jsonb_build_object('warnings',parcel_admin.release_warnings(p.id),'steps',(select jsonb_agg(to_jsonb(s) order by priority,source_dataset) from parcel_admin.steps s where s.preparation=p.id)) item
  from parcel_admin.preparations p order by p.created_at desc limit 10) q),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id desc),'[]') from (select id,at,action,details from parcel_admin.audit order by id desc limit 30) a));
end $$;

-- Public wrappers are invokers. Privileged implementations are narrowly scoped,
-- private, and authenticate the actor on every request, including preview/read.
revoke all on all functions in schema parcel_admin from public,anon,authenticated,service_role;
grant execute on function parcel_admin.require_admin(),parcel_admin.dashboard(),parcel_admin.save_season(jsonb,integer),parcel_admin.prepare_release(uuid),parcel_admin.publish_release(uuid,boolean),parcel_admin.retry_release(uuid) to authenticated;
create function public.admin_access() returns uuid language sql stable security invoker set search_path='' as $$ select parcel_admin.require_admin(); $$;
create function public.admin_dashboard() returns jsonb language sql stable security invoker set search_path='' as $$ select parcel_admin.dashboard(); $$;
create function public.admin_save_season(p_config jsonb,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$ select parcel_admin.save_season(p_config,p_revision); $$;
create function public.admin_prepare_release(p_dataset uuid) returns uuid language sql security invoker set search_path='' as $$ select parcel_admin.prepare_release(p_dataset); $$;
create function public.admin_publish_release(p_preparation uuid,p_acknowledge boolean default false) returns uuid language sql security invoker set search_path='' as $$ select parcel_admin.publish_release(p_preparation,p_acknowledge); $$;
create function public.admin_retry_release(p_preparation uuid) returns void language sql security invoker set search_path='' as $$ select parcel_admin.retry_release(p_preparation); $$;
revoke all on function public.admin_access(),public.admin_dashboard(),public.admin_save_season(jsonb,integer),public.admin_prepare_release(uuid),public.admin_publish_release(uuid,boolean),public.admin_retry_release(uuid) from public,anon;
grant execute on function public.admin_access(),public.admin_dashboard(),public.admin_save_season(jsonb,integer),public.admin_prepare_release(uuid),public.admin_publish_release(uuid,boolean),public.admin_retry_release(uuid) to authenticated;

-- A single statement prevents an activation between profile and history reads.
create function public.property_overview_bundle(p_id text) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('profile',public.property_profile(p_id),'history',public.property_history(p_id));
$$;
revoke all on function public.property_overview_bundle(text) from public;
grant execute on function public.property_overview_bundle(text) to anon,authenticated;
notify pgrst,'reload schema';

create function parcel_admin.preview_property(p_anchor uuid,p_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile jsonb; history jsonb;
begin
 perform parcel_admin.require_admin();
 if not exists(select 1 from public.property_search_state where dataset_id=p_anchor) and not exists(select 1 from parcel_admin.preparations where id=p_anchor and state='ready') then raise exception 'Preview requires a ready release'; end if;
profile:=(select jsonb_build_object('available',exists(select 1 from public.property_releases where dataset_id=p_anchor),
 'property',(select jsonb_build_object(
   'property_id',d.property_id,'address',d.address,'city',d.city,'postal_code',d.postal_code,'property_type',d.property_type,
   'market_value',d.market_value,'appraised_value',d.appraised_value,'assessed_value',d.assessed_value,
   'land_value',d.land_value,'improvement_value',d.improvement_value,'land_acres',d.land_acres,
   'source_record_count',d.source_record_count,'values_under_review',d.values_under_review,
   'shared_ownership',d.shared_ownership,'improvement_records',d.improvement_records,'land_segments',d.land_segments,
   'tax_year',r.tax_year,'roll_stage',r.roll_stage,'export_time_raw',r.export_time_raw,'source_url',r.source_url)
 from public.property_search_documents d join public.property_releases r using(dataset_id)

 where d.dataset_id=p_anchor and d.property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$')));
history:=(select jsonb_build_object(
 'snapshots',coalesce((select jsonb_agg(s.snapshot || jsonb_build_object('arb_agent_name',n.agent_name) order by
  (s.snapshot->>'tax_year')::integer,s.snapshot->>'export_date',s.dataset_id)
 from public.property_snapshot_profiles s left join public.property_agent_names n
 on n.anchor_dataset_id=s.anchor_dataset_id and n.dataset_id=s.dataset_id and n.property_id=s.property_id
 and n.tax_year::text=s.snapshot->>'tax_year'
 where s.anchor_dataset_id=p_anchor and s.property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb),
 'protest_observations',coalesce((select jsonb_agg(jsonb_build_object(
  'dataset_id',o.dataset_id,'tax_year',o.tax_year,'export_date',o.export_date,'export_time_raw',o.export_time_raw,
  'protest_flag',o.protest_flag,'arb_case_listed',o.arb_case_listed,'arb_status_codes',o.arb_status_codes,
  'arb_agent_listed',o.arb_agent_listed,'arb_agent_name',n.agent_name) order by o.tax_year,o.export_date,o.dataset_id)
 from public.property_protest_observations o left join public.property_agent_names n
 on n.anchor_dataset_id=o.anchor_dataset_id and n.dataset_id=o.dataset_id and n.property_id=o.property_id and n.tax_year=o.tax_year
 where o.anchor_dataset_id=p_anchor and o.property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb)));
return jsonb_build_object('profile',profile,'history',history);
end $$;
revoke all on function parcel_admin.preview_property(uuid,text) from public,anon,authenticated,service_role;
grant execute on function parcel_admin.preview_property(uuid,text) to authenticated;
create function public.admin_preview_property(p_anchor uuid,p_id text) returns jsonb language sql stable security invoker set search_path='' as $$ select parcel_admin.preview_property(p_anchor,p_id); $$;
revoke all on function public.admin_preview_property(uuid,text) from public,anon;
grant execute on function public.admin_preview_property(uuid,text) to authenticated;
notify pgrst,'reload schema';
