-- A separate, allowlisted history of positive protest/agent observations.
-- Valuation snapshots and the active search release are never changed here.
create table public.property_protest_observations (
 anchor_dataset_id uuid not null references public.property_releases(dataset_id),
 dataset_id uuid not null,
 property_id text not null,
 tax_year integer not null check (tax_year between 1900 and 2200),
 export_date text,
 export_time_raw text,
 protest_flag boolean,
 arb_case_listed boolean not null,
 arb_status_codes text[] not null default '{}',
 arb_agent_listed boolean not null,
 primary key(anchor_dataset_id,property_id,dataset_id,tax_year),
 check (protest_flag is true or arb_case_listed or arb_agent_listed)
);
alter table public.property_protest_observations enable row level security;
revoke all on public.property_protest_observations from public,anon,authenticated;
grant select on public.property_protest_observations to anon,authenticated;
create policy visible_property_protests on public.property_protest_observations for select to anon,authenticated
 using(anchor_dataset_id=(select dataset_id from public.property_search_state where singleton)
 and exists(select 1 from public.property_search_documents d where d.dataset_id=anchor_dataset_id
  and d.property_id=property_protest_observations.property_id and not d.shared_ownership and not d.values_under_review));

create or replace function public.property_history(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'snapshots',coalesce((select jsonb_agg(snapshot order by
  (snapshot->>'tax_year')::integer,snapshot->>'export_date',dataset_id)
 from public.property_snapshot_profiles where property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb),
 'protest_observations',coalesce((select jsonb_agg(jsonb_build_object(
  'dataset_id',dataset_id,'tax_year',tax_year,'export_date',export_date,'export_time_raw',export_time_raw,
  'protest_flag',protest_flag,'arb_case_listed',arb_case_listed,'arb_status_codes',arb_status_codes,
  'arb_agent_listed',arb_agent_listed) order by tax_year,export_date,dataset_id)
 from public.property_protest_observations where property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb))
$$;
revoke all on function public.property_history(text) from public;
grant execute on function public.property_history(text) to anon,authenticated;

-- Administrator-only, atomic and repeatable batches. The caller saves the next cursor.
create function tcad_ingest.publish_property_protests(p_dataset uuid,p_after text default '',p_limit integer default 10000)
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
 select dataset_id into anchor from public.property_search_state where singleton;
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
revoke all on function tcad_ingest.publish_property_protests(uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;
