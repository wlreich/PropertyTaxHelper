-- A subdivision description is a subject-property fact, not a label for the
-- appraisal district market area. Keep the private source tables behind a
-- bounded helper and expose only the single public description.
create index records_abstract_subdivision_code_lookup
on tcad_ingest.records(dataset_id,(fields->>'abs_subdv_cd'))
where fields ? 'abs_subdv_desc';

create function parcel_comparison.subject_subdivision(p_anchor uuid,p_source uuid,p_id text)
returns text language plpgsql stable security definer set search_path='' set statement_timeout='4s' as $$
declare subdivision_code text; subdivision_description text;
begin
 if p_anchor is null or p_source is null or p_id is null or p_id !~ '^[0-9]{1,12}$' then
  raise exception 'Invalid subdivision parameters' using errcode='22023';
 end if;
 if not exists(
  select 1 from public.property_search_state st
  join public.property_snapshot_profiles s on s.anchor_dataset_id=st.dataset_id and s.dataset_id=p_source and s.property_id=p_id
  join public.property_search_documents d on d.dataset_id=st.dataset_id and d.property_id=s.property_id
  join tcad_ingest.datasets src on src.id=s.dataset_id and src.status='ready'
  where st.singleton and st.dataset_id=p_anchor
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 ) then return null; end if;
 select case when count(distinct nullif(r.fields->>'abs_subdv_cd',''))=1
  then min(nullif(r.fields->>'abs_subdv_cd','')) end into subdivision_code
 from public.property_snapshot_profiles s
 join tcad_ingest.files f on f.dataset_id=s.dataset_id and f.record_type='Property' and f.status='complete'
 join tcad_ingest.records r on r.dataset_id=f.dataset_id and r.member_name=f.member_name
  and r.prop_id in (s.property_id,lpad(s.property_id,12,'0'))
  and ltrim(r.prop_val_yr,'0')=s.snapshot->>'tax_year'
 where s.anchor_dataset_id=p_anchor and s.dataset_id=p_source and s.property_id=p_id
  and nullif(r.fields->>'abs_subdv_cd','') is not null;
 if subdivision_code is null then return null; end if;
 select case when count(distinct nullif(r.fields->>'abs_subdv_desc',''))=1
  then min(nullif(r.fields->>'abs_subdv_desc','')) end into subdivision_description
 from tcad_ingest.files f
 join tcad_ingest.records r on r.dataset_id=f.dataset_id and r.member_name=f.member_name
 where f.dataset_id=p_source and f.record_type='AbstractSubdivision' and f.status='complete'
  and r.fields->>'abs_subdv_cd'=subdivision_code
  and nullif(r.fields->>'abs_subdv_desc','') is not null;
 return subdivision_description;
end $$;
revoke all on function parcel_comparison.subject_subdivision(uuid,uuid,text) from public,anon,authenticated;
grant execute on function parcel_comparison.subject_subdivision(uuid,uuid,text) to anon,authenticated;

create function public.property_neighborhood_v3(p_id text,p_source uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='20s' as $$
declare result jsonb; subdivision text;
begin
 result:=public.property_neighborhood_v2(p_id,p_source);
 if result->>'status' is distinct from 'ok' then return result; end if;
 subdivision:=parcel_comparison.subject_subdivision(
  (result->>'anchor_id')::uuid,
  (result->>'source_id')::uuid,
  result->'subject'->>'property_id'
 );
 return result||jsonb_build_object('subdivision',subdivision);
end $$;
revoke all on function public.property_neighborhood_v3(text,uuid) from public;
grant execute on function public.property_neighborhood_v3(text,uuid) to anon,authenticated;
