-- Publish the agent's recorded name only for an already eligible property/year.
-- Addresses, phone numbers and other directory fields stay private.
create table public.property_agent_names (
 anchor_dataset_id uuid not null references public.property_releases(dataset_id),
 dataset_id uuid not null,
 property_id text not null,
 tax_year integer not null check(tax_year between 1900 and 2200),
 agent_name text not null check(length(agent_name) between 1 and 200),
 primary key(anchor_dataset_id,property_id,dataset_id,tax_year)
);
alter table public.property_agent_names enable row level security;
revoke all on public.property_agent_names from public,anon,authenticated;
grant select on public.property_agent_names to anon,authenticated;
create policy visible_property_agent_names on public.property_agent_names for select to anon,authenticated
 using(anchor_dataset_id=(select dataset_id from public.property_search_state where singleton)
 and exists(select 1 from public.property_search_documents d where d.dataset_id=anchor_dataset_id
  and d.property_id=property_agent_names.property_id and not d.shared_ownership and not d.values_under_review)
 and (exists(select 1 from public.property_snapshot_profiles s where s.anchor_dataset_id=property_agent_names.anchor_dataset_id
  and s.dataset_id=property_agent_names.dataset_id and s.property_id=property_agent_names.property_id
  and s.snapshot->>'tax_year'=property_agent_names.tax_year::text and s.snapshot->>'arb_agent_listed'='true')
 or exists(select 1 from public.property_protest_observations o where o.anchor_dataset_id=property_agent_names.anchor_dataset_id
  and o.dataset_id=property_agent_names.dataset_id and o.property_id=property_agent_names.property_id
  and o.tax_year=property_agent_names.tax_year and o.arb_agent_listed)));

create or replace function public.property_history(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'snapshots',coalesce((select jsonb_agg(s.snapshot || jsonb_build_object('arb_agent_name',n.agent_name) order by
  (s.snapshot->>'tax_year')::integer,s.snapshot->>'export_date',s.dataset_id)
 from public.property_snapshot_profiles s left join public.property_agent_names n
 on n.anchor_dataset_id=s.anchor_dataset_id and n.dataset_id=s.dataset_id and n.property_id=s.property_id
 and n.tax_year::text=s.snapshot->>'tax_year'
 where s.property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb),
 'protest_observations',coalesce((select jsonb_agg(jsonb_build_object(
  'dataset_id',o.dataset_id,'tax_year',o.tax_year,'export_date',o.export_date,'export_time_raw',o.export_time_raw,
  'protest_flag',o.protest_flag,'arb_case_listed',o.arb_case_listed,'arb_status_codes',o.arb_status_codes,
  'arb_agent_listed',o.arb_agent_listed,'arb_agent_name',n.agent_name) order by o.tax_year,o.export_date,o.dataset_id)
 from public.property_protest_observations o left join public.property_agent_names n
 on n.anchor_dataset_id=o.anchor_dataset_id and n.dataset_id=o.dataset_id and n.property_id=o.property_id and n.tax_year=o.tax_year
 where o.property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'),'[]'::jsonb))
$$;
revoke all on function public.property_history(text) from public;
grant execute on function public.property_history(text) to anon,authenticated;

create index property_snapshot_named_agent_candidates on public.property_snapshot_profiles(anchor_dataset_id,dataset_id,property_id) where snapshot->>'arb_agent_listed'='true';
create index property_protest_named_agent_candidates on public.property_protest_observations(anchor_dataset_id,dataset_id,property_id) where arb_agent_listed;

create function tcad_ingest.publish_property_agent_names(p_dataset uuid,p_after text default '',p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d record; anchor uuid; ids text[]; raw_ids text[]; inserted integer; property_member text; agent_member text;
begin
 if p_limit not between 1 and 50000 then raise exception 'Invalid batch size'; end if;
 perform pg_advisory_xact_lock(hashtext('property_agent_names'),hashtext(p_dataset::text));
 select * into d from tcad_ingest.datasets where id=p_dataset and status='ready';
 if not found or (select count(*) from tcad_ingest.files where dataset_id=p_dataset and record_type is not null and status='complete')
  <>(case when d.import_scope='protests' then 4 else 20 end) then raise exception 'Only complete ready datasets can be published'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
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
 create temporary table name_properties on commit drop as
 select ltrim(prop_id,'0') id,(select jsonb_object_agg(key,value) from jsonb_each_text(fields) where key in
 ('arb_agent_id','py_confidential_flag','jan1_confidential_flag','appr_confidential_flag','partial_owner','ownership_pct','udi_group')) fields
 from tcad_ingest.records where dataset_id=p_dataset and member_name=property_member and prop_id=any(raw_ids) and ltrim(prop_val_yr,'0')=d.tax_year::text;
 create index on pg_temp.name_properties(id);
 analyze pg_temp.name_properties;
 create temporary table name_agents on commit drop as
 select nullif(ltrim(fields->>'agent_id','0'),'') id,min(nullif(btrim(fields->>'agent_name'),'')) name
 from tcad_ingest.records where dataset_id=p_dataset and member_name=agent_member
 group by nullif(ltrim(fields->>'agent_id','0'),'') having count(*)=1;
 create index on pg_temp.name_agents(id);
 delete from public.property_agent_names where anchor_dataset_id=anchor and dataset_id=p_dataset and property_id=any(ids);
 insert into public.property_agent_names
 select anchor,p_dataset,p.id,d.tax_year,a.name from pg_temp.name_properties p
 join pg_temp.name_agents a on a.id=nullif(ltrim(p.fields->>'arb_agent_id','0'),'')
 join public.property_search_documents v on v.dataset_id=anchor and v.property_id=p.id
 where not v.shared_ownership and not v.values_under_review
 and length(a.name) between 1 and 200 and a.name !~ '[[:cntrl:]]'
 and p.fields->>'py_confidential_flag'='F' and p.fields->>'jan1_confidential_flag'='F' and p.fields->>'appr_confidential_flag'='F'
 and p.fields->>'partial_owner'='F' and (tcad_ingest.profile_number(p.fields->>'ownership_pct')=100
  or (d.header->>'export_version'='8.0.0.30' and not (p.fields ? 'ownership_pct')))
 and nullif(ltrim(p.fields->>'udi_group','0'),'') is null
 and (select count(*) from pg_temp.name_properties p2 where p2.id=p.id)=1
 and (exists(select 1 from public.property_snapshot_profiles s where s.anchor_dataset_id=anchor and s.dataset_id=p_dataset and s.property_id=p.id
  and s.snapshot->>'tax_year'=d.tax_year::text and s.snapshot->>'arb_agent_listed'='true')
 or exists(select 1 from public.property_protest_observations o where o.anchor_dataset_id=anchor and o.dataset_id=p_dataset and o.property_id=p.id
  and o.tax_year=d.tax_year and o.arb_agent_listed));
 get diagnostics inserted=row_count;
 drop table pg_temp.name_properties;
 drop table pg_temp.name_agents;
 return jsonb_build_object('processed',cardinality(ids),'published',inserted,'next',ids[cardinality(ids)],'anchor',anchor);
end $$;
revoke all on function tcad_ingest.publish_property_agent_names(uuid,text,integer) from public,anon,authenticated,service_role,tcad_loader;
