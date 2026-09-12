-- Preserve the v2 population and access rules while bounding profile reads.
create or replace function public.property_neighborhood_v2(p_id text,p_source uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='15s' as $$
declare base jsonb; types jsonb; ids text[]; refined jsonb; retained jsonb; exclusions jsonb; caps jsonb; subject_area jsonb; snapshots jsonb; cert_areas jsonb;
begin
 base:=public.property_neighborhood(p_id,p_source);
 if base->>'status' is distinct from 'ok' then return base; end if;
 select coalesce(array_agg(h->>'property_id'),array[]::text[]) into ids from jsonb_array_elements(base->'homes') h;
 -- Fetch each release with a bounded indexed ID lookup before joining JSON.
 -- Joining JSON rows directly to RLS-protected profiles can scan the full release.
 select coalesce(jsonb_object_agg(property_id,snapshot),'{}') into snapshots
 from public.property_snapshot_profiles
 where anchor_dataset_id=(base->>'anchor_id')::uuid and dataset_id=(base->>'source_id')::uuid and property_id=any(ids);
 if base->>'certified_id'=base->>'source_id' then
  select coalesce(jsonb_object_agg(key,public.neighborhood_floor_area(value)->'area'),'{}') into cert_areas from jsonb_each(snapshots);
 elsif base->>'certified_id' is not null then
  select coalesce(jsonb_object_agg(property_id,public.neighborhood_floor_area(snapshot)->'area'),'{}') into cert_areas
  from public.property_snapshot_profiles
  where anchor_dataset_id=(base->>'anchor_id')::uuid and dataset_id=(base->>'certified_id')::uuid and property_id=any(ids);
 else cert_areas:='{}'; end if;
 types:=parcel_comparison.neighborhood_types((base->>'anchor_id')::uuid,(base->>'source_id')::uuid,ids);
 with facts as (
  select h,snapshots->(h->>'property_id') snapshot,t->>'state_code' state_code,t->>'land_code' land_code,
   public.neighborhood_floor_area(snapshots->(h->>'property_id')) floor_area
  from jsonb_array_elements(base->'homes') h
  left join lateral (select t from jsonb_array_elements(types) t where t->>'property_id'=h->>'property_id') t on true
 ), classified as (
  select *,case
   when (snapshot->>'improvement_value')::numeric=0 then 'land_only'
   when state_code is null then 'unverified_type'
   when state_code<>'A1' then 'other_type'
   when snapshot->>'improvement_value' is null or (snapshot->>'improvement_value')::numeric<0 then 'unverified_improvements'
   when snapshot->>'market_value' is null or (snapshot->>'market_value')::numeric<1000 then 'unusable_value'
   end reason from facts
 ) select coalesce(jsonb_agg(jsonb_build_object('home',h,'reason',reason,'state_code',state_code,'land_code',land_code,'floor_area',floor_area)),'[]') into refined from classified;
 select coalesce(jsonb_agg((x->'home')||jsonb_build_object('area',x->'floor_area'->'area',
   'certified_area',cert_areas->(x->'home'->>'property_id')) order by x->'home'->>'property_id'),'[]') into retained
 from jsonb_array_elements(refined) x
 where x->>'reason' is null;
 select coalesce(jsonb_agg(jsonb_build_object('property_id',x->'home'->>'property_id','reason',x->>'reason') order by x->'home'->>'property_id'),'[]') into exclusions
 from jsonb_array_elements(refined) x where x->>'reason' is not null;
 select coalesce(jsonb_agg(c),'[]') into caps from jsonb_array_elements(base->'caps') c
 where exists(select 1 from jsonb_array_elements(retained) h where h->>'property_id'=c->>'property_id');
 select public.neighborhood_floor_area(s.snapshot) into subject_area from public.property_snapshot_profiles s
 where s.anchor_dataset_id=(base->>'anchor_id')::uuid and s.dataset_id=(base->>'source_id')::uuid and s.property_id=base->'subject'->>'property_id';
 return base||jsonb_build_object('homes',retained,'caps',caps,
  'subject',(base->'subject')||jsonb_build_object('living_area',subject_area->'area'),
  'population',jsonb_build_object('candidate_count',cardinality(ids),'excluded',exclusions,
   'land_code_mismatch',(select count(*) from jsonb_array_elements(refined) x where x->>'reason' is null and x->>'land_code' is not null and x->>'land_code'<>'A1'),
   'multiple_buildings',(select count(*) from jsonb_array_elements(refined) x where x->>'reason' is null and (x->'floor_area'->>'buildings')::int>1)));
end $$;
revoke all on function public.property_neighborhood_v2(text,uuid) from public;
grant execute on function public.property_neighborhood_v2(text,uuid) to anon,authenticated;
