-- Review corrections: immutable completed imports and conservative matching.
revoke update on tcad_ingest.activity_imports from tcad_loader;
grant update(status,completed_at) on tcad_ingest.activity_imports to tcad_loader;
create policy activity_imports_start_loading on tcad_ingest.activity_imports as restrictive for insert to tcad_loader with check(status='loading' and completed_at is null);
create function tcad_ingest.guard_activity_completion() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if old.status='complete' then raise exception 'Completed activity imports are immutable' using errcode='55000'; end if;
 if new.status='complete' and (select count(*) from tcad_ingest.activity_observations where run_id=new.id)<>new.observation_count then
  raise exception 'Cannot complete partial activity observations' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function tcad_ingest.guard_activity_completion() from public,anon,authenticated,service_role,tcad_loader;
create trigger immutable_activity_import before update on tcad_ingest.activity_imports for each row execute function tcad_ingest.guard_activity_completion();
create function tcad_ingest.guard_activity_insert() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare state text;
begin
 select status into state from tcad_ingest.activity_imports where id=new.run_id for share;
 if state is distinct from 'loading' then raise exception 'Activity observations require a loading import' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function tcad_ingest.guard_activity_insert() from public,anon,authenticated,service_role,tcad_loader;
create trigger sealed_activity_observations before insert on tcad_ingest.activity_observations for each row execute function tcad_ingest.guard_activity_insert();

create or replace function tcad_ingest.publish_property_activity(p_year integer) returns jsonb
 language plpgsql security definer set search_path='' set statement_timeout='120s' as $$
declare anchor uuid; run tcad_ingest.activity_imports; exported date; n integer;
begin
 if p_year is null or p_year not between 1900 and 2200 then raise exception 'Invalid activity year'; end if;
 perform pg_advisory_xact_lock(hashtextextended('publish_property_activity',0));
 select dataset_id into anchor from public.property_search_state where singleton;
 select i.* into run from tcad_ingest.activity_imports i join tcad_ingest.datasets d on d.id=i.dataset_id
 where i.activity_year=p_year and i.status='complete' and d.status='ready' and i.archive_sha256=d.archive_sha256
 order by i.export_date desc,i.completed_at desc,i.id limit 1;
 if anchor is null or run.id is null then raise exception 'Ready source and active release required'; end if;
 if (select count(*) from tcad_ingest.activity_observations where run_id=run.id)<>run.observation_count then raise exception 'Incomplete observations'; end if;
 select tcad_ingest.activity_date(replace(left(export_run_time_raw,10),'/','-')) into exported from tcad_ingest.datasets where id=anchor and status='ready';
 if exported is null then raise exception 'Appraisal export date required'; end if;
 -- One scan of the active appraisal records, excluding all confidentiality flags.
 create temporary table activity_legacy on commit drop as
 select distinct ltrim(r.prop_id,'0') property_id,tcad_ingest.activity_date(r.fields->>'deed_dt') deed_date,
  nullif(btrim(r.fields->>'deed_num'),'') instrument
 from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 join public.property_search_documents d on d.dataset_id=anchor and d.property_id=ltrim(r.prop_id,'0')
 where r.dataset_id=anchor and f.record_type='Property' and f.status='complete'
 and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 and r.fields->>'py_confidential_flag'='F' and r.fields->>'jan1_confidential_flag'='F' and r.fields->>'appr_confidential_flag'='F'
 and tcad_ingest.activity_date(r.fields->>'deed_dt') between make_date(p_year,1,1) and least(make_date(p_year,12,31),exported);
 create index on pg_temp.activity_legacy(property_id,instrument);
 create temporary table activity_source on commit drop as
 select o.* from tcad_ingest.activity_observations o join public.property_search_documents d
 on d.dataset_id=anchor and d.property_id=o.property_id
 where o.run_id=run.id and o.quarantine_reason is null and o.event_date<=run.export_date
 and extract(year from o.event_date)=p_year and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 and (o.kind='deed' or (o.confidential is false and o.suppressed is false and o.confidential_code is null and o.suppression_code is null));
 create index on pg_temp.activity_source(property_id,kind,event_date);
 -- The supplemental deed is authoritative when the same instrument appears twice.
 -- Date-only fallback is allowed only for a unique deed on that property/date.
 create temporary table activity_deeds on commit drop as
 select property_id,'j:'||event_id event_key,event_id deed_id,event_date deed_date,filed_date,instrument,type_code deed_type,'supplemental'::text deed_source
 from pg_temp.activity_source where kind='deed'
 union all
 select l.property_id,'a:'||l.deed_date::text||':'||coalesce(l.instrument,''),null,l.deed_date,null,l.instrument,null,'appraisal'
 from pg_temp.activity_legacy l where not exists(select 1 from pg_temp.activity_source j where j.kind='deed' and j.property_id=l.property_id
 and ((l.instrument is not null and l.instrument=j.instrument) or (l.instrument is null and l.deed_date=j.event_date
 and 1=(select count(*) from pg_temp.activity_source x where x.kind='deed' and x.property_id=l.property_id and x.event_date=l.deed_date))));
 create index on pg_temp.activity_deeds(property_id);
 create temporary table activity_links on commit drop as
 with candidates as (
 select d.property_id,d.event_key,s.event_id,
 case when s.deed_id=d.deed_id then 1 when s.instrument=d.instrument then 2 else 3 end priority
 from pg_temp.activity_deeds d join pg_temp.activity_source s on s.property_id=d.property_id and s.kind='sale'
 where (s.deed_id=d.deed_id or (s.deed_id is null and s.instrument=d.instrument) or
 (s.event_date=d.deed_date and s.deed_id is null and (s.instrument is null or d.instrument is null)
 and 1=(select count(*) from pg_temp.activity_deeds x where x.property_id=d.property_id and x.deed_date=d.deed_date)
 and 1=(select count(*) from pg_temp.activity_source x where x.kind='sale' and x.property_id=s.property_id and x.event_date=s.event_date)))
 ), best as (
 select *,min(priority) over(partition by property_id,event_id) best_sale,
 min(priority) over(partition by property_id,event_key) best_deed from candidates
 ), unique_links as (
 select *,count(*) over(partition by property_id,event_key) deeds,count(*) over(partition by property_id,event_id) sales from best where priority=best_sale and priority=best_deed
 ) select * from unique_links where deeds=1 and sales=1;
 insert into public.property_activity_releases values(anchor,p_year,exported,run.export_date,run.id,now())
 on conflict(anchor_dataset_id,activity_year) do update set appraisal_export_date=excluded.appraisal_export_date,sales_export_date=excluded.sales_export_date,import_id=excluded.import_id,published_at=excluded.published_at;
 delete from public.property_activity where anchor_dataset_id=anchor and activity_year=p_year;
 insert into public.property_activity
 select anchor,p_year,coalesce(d.property_id,s.property_id),coalesce('s:'||s.event_id,d.event_key),d.deed_date,s.event_date,d.filed_date,
 coalesce(d.instrument,s.instrument),d.deed_type,s.type_code,s.source_of_sale,
 case when s.event_id is not null then 'sale_recorded' else 'deed_change' end,
 case when s.multi_property is false and cardinality(s.associated_properties)=1 then s.sale_price end,
 case when s.multi_property is true or cardinality(s.associated_properties)>1 then 'multi_property'
 when s.multi_property is false and s.sale_price is not null then 'reported' else 'not_reported' end,
 case l.priority when 1 then 'deed_id' when 2 then 'instrument' when 3 then 'unique_date' end,d.deed_source
 from pg_temp.activity_deeds d left join pg_temp.activity_links l on l.property_id=d.property_id and l.event_key=d.event_key
 full join (select * from pg_temp.activity_source where kind='sale') s on s.property_id=l.property_id and s.event_id=l.event_id;
 get diagnostics n=row_count;
 drop table pg_temp.activity_links,pg_temp.activity_deeds,pg_temp.activity_source,pg_temp.activity_legacy;
 return jsonb_build_object('rows',n,'anchor_id',anchor,'year',p_year,'import_id',run.id);
end $$;
revoke all on function tcad_ingest.publish_property_activity(integer) from public,anon,authenticated,service_role,tcad_loader;

create or replace function public.property_neighborhood_activity(p_id text,p_year integer default null) returns jsonb
 language plpgsql stable security invoker set search_path='' set statement_timeout='10s' as $$
declare anchor uuid; area text; yr integer; ids text[]; rows jsonb; sources jsonb; years jsonb; types jsonb;
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' or (p_year is not null and p_year not between 1900 and 2200) then raise exception 'Invalid activity parameters' using errcode='22023'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 select a.neighborhood into area from public.property_comparison_areas a join public.property_search_documents d
 on d.dataset_id=anchor and d.property_id=a.property_id where a.anchor_dataset_id=anchor and a.dataset_id=anchor
 and a.property_id=ltrim(p_id,'0') and not d.shared_ownership and not d.values_under_review and not d.is_parkland;
 if area is null then return jsonb_build_object('status','unavailable'); end if;
 select coalesce(jsonb_agg(activity_year order by activity_year desc),'[]'),coalesce(p_year,max(activity_year)) into years,yr from public.property_activity_releases where anchor_dataset_id=anchor;
 select jsonb_build_object('appraisal_export_date',appraisal_export_date,'sales_export_date',sales_export_date) into sources
 from public.property_activity_releases where anchor_dataset_id=anchor and activity_year=yr;
 if sources is null then return jsonb_build_object('status','unavailable'); end if;
 select array_agg(property_id) into ids from (select a.property_id from public.property_comparison_areas a
 join public.property_search_documents d on d.dataset_id=anchor and d.property_id=a.property_id
 where a.anchor_dataset_id=anchor and a.dataset_id=anchor and a.neighborhood=area
 and not d.shared_ownership and not d.values_under_review and not d.is_parkland order by a.property_id limit 10001) pop;
 if cardinality(ids)>10000 then return jsonb_build_object('status','area_too_large'); end if;
 types:=parcel_comparison.neighborhood_types(anchor,anchor,coalesce(ids,array[]::text[]));
 with type_rows as materialized (select t->>'property_id' property_id,t->>'state_code' state_code from jsonb_array_elements(types) t)
 select coalesce(jsonb_agg(to_jsonb(x) order by x.activity_date desc,x.property_id,x.event_key),'[]') into rows from (
 select a.property_id,a.event_key,d.address,d.city,
 case when (s.snapshot->>'improvement_value')::numeric=0 then 'land'
 when t.state_code='A1' then 'single_family' else 'other' end property_type,
 a.deed_date,a.sale_date,coalesce(a.deed_date,a.sale_date) activity_date,a.filed_date,a.instrument,a.deed_type,a.sale_type,a.sale_source,
 a.status,a.price,a.price_status,a.match_method,a.deed_source
 from public.property_activity a join public.property_search_documents d on d.dataset_id=anchor and d.property_id=a.property_id
 left join public.property_snapshot_profiles s on s.anchor_dataset_id=anchor and s.dataset_id=anchor and s.property_id=a.property_id
 left join type_rows t on t.property_id=a.property_id
 where a.anchor_dataset_id=anchor and a.activity_year=yr and a.property_id=any(ids)
 order by coalesce(a.deed_date,a.sale_date) desc,a.property_id,a.event_key limit 10001
 ) x;
 if jsonb_array_length(rows)>10000 then return jsonb_build_object('status','area_too_large'); end if;
 return jsonb_build_object('status','ok','year',yr,'years',years,'neighborhood',area,'sources',sources,'rows',rows);
end $$;
revoke all on function public.property_neighborhood_activity(text,integer) from public;
grant execute on function public.property_neighborhood_activity(text,integer) to anon,authenticated;
