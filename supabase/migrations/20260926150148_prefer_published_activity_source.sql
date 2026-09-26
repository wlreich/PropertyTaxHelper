-- A preparation publishes one authoritative full dataset, even when another
-- ready dataset has the same year, stage and export timestamp. Retain that
-- source ID on the public release so the invoker RPC never reads admin tables.
alter table public.property_releases add column source_dataset_id uuid;
update public.property_releases r set source_dataset_id=coalesce(
 (select p.source_dataset from parcel_admin.preparations p where p.id=r.dataset_id),r.dataset_id);

create function tcad_ingest.assign_release_source_dataset() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 new.source_dataset_id:=coalesce(
  (select p.source_dataset from parcel_admin.preparations p where p.id=new.dataset_id),new.dataset_id);
 return new;
end $$;
revoke all on function tcad_ingest.assign_release_source_dataset() from public,anon,authenticated,service_role,tcad_loader;
create trigger assign_release_source_dataset before insert on public.property_releases
 for each row execute function tcad_ingest.assign_release_source_dataset();
alter table public.property_releases alter column source_dataset_id set not null;

-- Select only the recorded published source within the active release. The
-- anchor itself is a preparation ID and has no profile source rows.
create or replace function public.property_neighborhood_activity(p_id text,p_year integer default null) returns jsonb
 language plpgsql stable security invoker set search_path='' set statement_timeout='10s' as $$
declare anchor uuid; source uuid; area text; yr integer; ids text[]; rows jsonb; sources jsonb; years jsonb; types jsonb;
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' or (p_year is not null and p_year not between 1900 and 2200) then raise exception 'Invalid activity parameters' using errcode='22023'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 select a.dataset_id,a.neighborhood into source,area from public.property_comparison_areas a
 join public.property_snapshot_profiles s on s.anchor_dataset_id=a.anchor_dataset_id and s.dataset_id=a.dataset_id and s.property_id=a.property_id
 join public.property_releases r on r.dataset_id=a.anchor_dataset_id
  and s.snapshot->>'tax_year'=r.tax_year::text
  and s.snapshot->>'roll_stage'=r.roll_stage
  and (s.snapshot->>'export_time_raw') is not distinct from r.export_time_raw
  and a.dataset_id=r.source_dataset_id
 join public.property_search_documents d on d.dataset_id=anchor and d.property_id=a.property_id
 where a.anchor_dataset_id=anchor and a.property_id=ltrim(p_id,'0')
 and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 order by a.dataset_id limit 1;
 if area is null then return jsonb_build_object('status','unavailable'); end if;
 select coalesce(jsonb_agg(activity_year order by activity_year desc),'[]'),coalesce(p_year,max(activity_year)) into years,yr from public.property_activity_releases where anchor_dataset_id=anchor;
 select jsonb_build_object('appraisal_export_date',appraisal_export_date,'sales_export_date',sales_export_date) into sources
 from public.property_activity_releases where anchor_dataset_id=anchor and activity_year=yr;
 if sources is null then return jsonb_build_object('status','unavailable'); end if;
 select array_agg(property_id) into ids from (select a.property_id from public.property_comparison_areas a
 join public.property_search_documents d on d.dataset_id=anchor and d.property_id=a.property_id
 where a.anchor_dataset_id=anchor and a.dataset_id=source and a.neighborhood=area
 and not d.shared_ownership and not d.values_under_review and not d.is_parkland order by a.property_id limit 10001) pop;
 if cardinality(ids)>10000 then return jsonb_build_object('status','area_too_large'); end if;
 types:=parcel_comparison.neighborhood_types(anchor,source,coalesce(ids,array[]::text[]));
 with type_rows as materialized (select t->>'property_id' property_id,t->>'state_code' state_code from jsonb_array_elements(types) t)
 select coalesce(jsonb_agg(to_jsonb(x) order by x.activity_date desc,x.property_id,x.event_key),'[]') into rows from (
 select a.property_id,a.event_key,d.address,d.city,
 case when (s.snapshot->>'improvement_value')::numeric=0 then 'land'
 when t.state_code='A1' then 'single_family' else 'other' end property_type,
 a.deed_date,a.sale_date,coalesce(a.deed_date,a.sale_date) activity_date,a.filed_date,a.instrument,a.deed_type,a.sale_type,a.sale_source,
 a.status,a.price,a.price_status,a.match_method,a.deed_source
 from public.property_activity a join public.property_search_documents d on d.dataset_id=anchor and d.property_id=a.property_id
 left join public.property_snapshot_profiles s on s.anchor_dataset_id=anchor and s.dataset_id=source and s.property_id=a.property_id
 left join type_rows t on t.property_id=a.property_id
 where a.anchor_dataset_id=anchor and a.activity_year=yr and a.property_id=any(ids)
 order by coalesce(a.deed_date,a.sale_date) desc,a.property_id,a.event_key limit 10001
 ) x;
 if jsonb_array_length(rows)>10000 then return jsonb_build_object('status','area_too_large'); end if;
 return jsonb_build_object('status','ok','year',yr,'years',years,'neighborhood',area,'sources',sources,'rows',rows);
end $$;
revoke all on function public.property_neighborhood_activity(text,integer) from public;
grant execute on function public.property_neighborhood_activity(text,integer) to anon,authenticated;
