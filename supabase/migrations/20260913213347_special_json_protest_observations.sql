-- Store a privacy-minimized projection of TCAD's Protax Special JSON export.
-- Valuation releases remain authoritative for property values; this source only
-- contributes positive protest observations to the combined evidence model.
alter table tcad_ingest.datasets drop constraint datasets_import_scope_check;
alter table tcad_ingest.datasets add constraint datasets_import_scope_check
  check (import_scope in ('full','protests','special_protests'));
alter table tcad_ingest.import_attempts drop constraint import_attempts_import_scope_check;
alter table tcad_ingest.import_attempts add constraint import_attempts_import_scope_check
  check (import_scope in ('full','protests','special_protests'));
alter table tcad_ingest.datasets drop constraint datasets_roll_stage_check;
alter table tcad_ingest.datasets add constraint datasets_roll_stage_check check (
  (roll_stage in ('preliminary','certified','supplemental')
   and (import_scope<>'special_protests' or roll_stage='supplemental'))
  or (roll_stage='unknown' and import_scope='protests')
);

create table tcad_ingest.special_json_properties (
  dataset_id uuid not null references tcad_ingest.datasets(id),
  row_number bigint not null check(row_number>0),
  property_id text not null check(property_id~'^[1-9][0-9]{0,11}$'),
  tax_year integer not null check(tax_year between 1900 and 2200),
  appeal_count integer not null check(appeal_count between 0 and 100),
  primary key(dataset_id,row_number),
  unique(dataset_id,property_id,tax_year)
);
create table tcad_ingest.special_json_appeals (
  dataset_id uuid not null,
  property_row_number bigint not null,
  appeal_index integer not null check(appeal_index between 1 and 100),
  property_id text not null check(property_id~'^[1-9][0-9]{0,11}$'),
  tax_year integer not null check(tax_year between 1900 and 2200),
  appeal_id bigint not null check(appeal_id>0),
  appeal_status text not null check(appeal_status~'^[A-Za-z0-9_-]{1,40}$'),
  appeal_type text not null check(appeal_type~'^[A-Za-z0-9_-]{1,40}$'),
  appealed_by_type text check(appealed_by_type~'^[A-Za-z0-9_-]{1,40}$'),
  informal boolean not null,
  finalized boolean not null,
  initial_appraised_value numeric check(initial_appraised_value between 0 and 1000000000000000),
  notice_appraised_value numeric check(notice_appraised_value between 0 and 1000000000000000),
  final_appraised_value numeric check(final_appraised_value between 0 and 1000000000000000),
  informal_adjustment_value numeric check(informal_adjustment_value between 0 and 1000000000000000),
  formal_adjustment_value numeric check(formal_adjustment_value between 0 and 1000000000000000),
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  primary key(dataset_id,property_row_number,appeal_index),
  unique(dataset_id,appeal_id),
  foreign key(dataset_id,property_row_number)
    references tcad_ingest.special_json_properties(dataset_id,row_number)
);
create index special_json_properties_positive_idx
  on tcad_ingest.special_json_properties(dataset_id,property_id) where appeal_count>0;
create index special_json_appeals_property_idx
  on tcad_ingest.special_json_appeals(dataset_id,property_id,tax_year);

alter table tcad_ingest.special_json_properties enable row level security;
alter table tcad_ingest.special_json_appeals enable row level security;
create policy loader_special_json_properties on tcad_ingest.special_json_properties
  to tcad_loader using(true) with check(true);
create policy loader_special_json_appeals on tcad_ingest.special_json_appeals
  to tcad_loader using(true) with check(true);
grant select,insert on tcad_ingest.special_json_properties,tcad_ingest.special_json_appeals to tcad_loader;
revoke all on tcad_ingest.special_json_properties,tcad_ingest.special_json_appeals
  from public,anon,authenticated,service_role;

comment on table tcad_ingest.special_json_properties is
  'One minimal coverage row per parcel in a validated TCAD Protax Special JSON snapshot.';
comment on table tcad_ingest.special_json_appeals is
  'Allowlisted private appeal facts; excludes owners, contacts, evidence and free-form appraiser/claimant comments.';

create function tcad_ingest.project_special_json_protests(
  p_dataset uuid,p_anchor uuid,p_after text default '',p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; ids text[]; inserted integer; source_date text;
begin
 if p_limit not between 1 and 50000 then raise exception 'Invalid batch size'; end if;
 perform pg_advisory_xact_lock(hashtext('special_json_protests'),hashtext(p_dataset::text));
 select * into d from tcad_ingest.datasets where id=p_dataset and status='ready'
  and import_scope='special_protests' and roll_stage='supplemental';
 if not found or (select count(*) from tcad_ingest.files where dataset_id=p_dataset
   and record_type='SpecialJSON' and status='complete')<>1 then
  raise exception 'Only a complete ready Special JSON protest import can be published';
 end if;
 if p_anchor is null then raise exception 'A property-search anchor is required'; end if;
 select max(a.publisher_published_on)::text into source_date
 from tcad_ingest.acquisitions a where a.archive_sha256=d.archive_sha256
  and a.publisher_published_on is not null and a.publication_evidence is not null;
 select array_agg(property_id order by property_id) into ids from (
  select p.property_id from tcad_ingest.special_json_properties p
  join public.property_search_documents v on v.dataset_id=p_anchor and v.property_id=p.property_id
  where p.dataset_id=p_dataset and p.tax_year=d.tax_year and p.appeal_count>0
   and p.property_id>p_after and not v.shared_ownership and not v.values_under_review
  order by p.property_id limit p_limit) q;
 if ids is null then return jsonb_build_object('processed',0,'published',0,'next',p_after,'anchor',p_anchor); end if;
 delete from public.property_protest_observations where anchor_dataset_id=p_anchor
  and dataset_id=p_dataset and property_id=any(ids);
 insert into public.property_protest_observations
  (anchor_dataset_id,dataset_id,property_id,tax_year,export_date,export_time_raw,
   protest_flag,arb_case_listed,arb_status_codes,arb_agent_listed)
 select p_anchor,p_dataset,p.property_id,p.tax_year,source_date,null,true,false,'{}'::text[],false
 from tcad_ingest.special_json_properties p
 where p.dataset_id=p_dataset and p.property_id=any(ids) and p.tax_year=d.tax_year
  and p.appeal_count=(select count(*) from tcad_ingest.special_json_appeals a
   where a.dataset_id=p.dataset_id and a.property_row_number=p.row_number)
  and p.appeal_count>0;
 get diagnostics inserted=row_count;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,
  'next',ids[cardinality(ids)],'anchor',p_anchor);
end $$;
revoke all on function tcad_ingest.project_special_json_protests(uuid,uuid,text,integer)
 from public,anon,authenticated,service_role,tcad_loader;

create function tcad_ingest.publish_special_json_protests(
  p_dataset uuid,p_after text default '',p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare anchor uuid;
begin
 select dataset_id into anchor from public.property_search_state where singleton;
 return tcad_ingest.project_special_json_protests(p_dataset,anchor,p_after,p_limit);
end $$;
revoke all on function tcad_ingest.publish_special_json_protests(uuid,text,integer)
 from public,anon,authenticated,service_role,tcad_loader;

create function tcad_ingest.prepare_special_json_protests(
  p_dataset uuid,p_anchor uuid,p_after text default '',p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.property_search_state where dataset_id=p_anchor) then
  raise exception 'Cannot prepare the active release';
 end if;
 return tcad_ingest.project_special_json_protests(p_dataset,p_anchor,p_after,p_limit);
end $$;
revoke all on function tcad_ingest.prepare_special_json_protests(uuid,uuid,text,integer)
 from public,anon,authenticated,service_role,tcad_loader;

alter table parcel_admin.steps drop constraint steps_kind_check;
alter table parcel_admin.steps add constraint steps_kind_check
  check(kind in ('search','snapshot','protests','special_protests','agents'));

create or replace function parcel_admin.prepare_release(p_dataset uuid) returns uuid
language plpgsql security definer set search_path='' as $$
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
  raise exception 'An older source belongs in history, not the current release';
 end if;
 insert into parcel_admin.preparations(source_dataset,expected_active,created_by)
  values(p_dataset,current_release.dataset_id,actor) returning id into prep;
 insert into parcel_admin.steps(preparation,source_dataset,kind,priority) values(prep,p_dataset,'search',0);
 insert into parcel_admin.steps(preparation,source_dataset,kind,priority)
 select prep,d.id,case d.import_scope when 'full' then 'snapshot'
   when 'protests' then 'protests' else 'special_protests' end,
  case when d.id=p_dataset then 1 else 2 end
 from tcad_ingest.datasets d where d.status='ready' and d.tax_year<=source.tax_year
  and d.import_scope in ('full','protests','special_protests');
 insert into parcel_admin.steps(preparation,source_dataset,kind,priority)
 select prep,d.id,'agents',3 from tcad_ingest.datasets d where d.status='ready'
  and d.tax_year<=source.tax_year and d.import_scope in ('full','protests');
 insert into parcel_admin.audit(actor,action,details)
  values(actor,'prepare_release',jsonb_build_object('preparation',prep,'source',p_dataset));
 perform parcel_admin.schedule_preparation();
 return prep;
end $$;

create or replace function parcel_admin.advance_preparation(p_limit integer default 2000)
returns jsonb language plpgsql security invoker set search_path='' as $$
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
    when 'special_protests' then tcad_ingest.prepare_special_json_protests(step.source_dataset,prep.id,step.after_id,p_limit)
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

create or replace function parcel_admin.publish_release(p_preparation uuid,p_acknowledge boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from tcad_ingest.datasets d where status='ready' and tax_year<=source.tax_year
  and import_scope in ('full','protests','special_protests')
  and not exists(select 1 from parcel_admin.steps s where s.preparation=prep.id and s.source_dataset=d.id)) then
  raise exception 'New sources arrived; prepare again to retain history';
 end if;
 if jsonb_array_length(parcel_admin.release_warnings(prep.id))>0 and not p_acknowledge then raise exception 'Review the missing comparisons before publishing'; end if;
 update public.property_search_state set dataset_id=prep.id where singleton;
 update parcel_admin.preparations set state='published',published_at=now() where id=prep.id;
 insert into parcel_admin.audit(actor,action,details)
  values(actor,'publish_release',jsonb_build_object('before',prep.expected_active,'after',prep.id,
   'source',prep.source_dataset,'warnings',parcel_admin.release_warnings(prep.id),'acknowledged',p_acknowledge));
 return prep.id;
end $$;

revoke all on function parcel_admin.prepare_release(uuid),parcel_admin.advance_preparation(integer),
 parcel_admin.publish_release(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function parcel_admin.prepare_release(uuid),parcel_admin.publish_release(uuid,boolean) to authenticated;
