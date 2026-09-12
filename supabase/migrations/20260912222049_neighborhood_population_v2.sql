-- Additive endpoint: the previous website keeps its existing response until release.
-- State codes are sourced from the selected published release, behind the same
-- non-personal, visibility-checked private-source boundary as cap/cost inputs.
create function parcel_comparison.neighborhood_types(p_anchor uuid,p_source uuid,p_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb;
begin
 if p_anchor is null or p_source is null or p_ids is null or cardinality(p_ids)>10000
  or exists(select 1 from unnest(p_ids) x where x is null or x !~ '^[0-9]{1,12}$') then
  raise exception 'Invalid neighborhood type parameters' using errcode='22023'; end if;
 if not exists(select 1 from public.property_search_state where singleton and dataset_id=p_anchor) then return '[]'; end if;
 with visible as materialized (
  select s.property_id,(s.snapshot->>'tax_year')::int tax_year
  from public.property_snapshot_profiles s
  join public.property_search_documents d on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
  join tcad_ingest.datasets src on src.id=s.dataset_id and src.status='ready'
  where s.anchor_dataset_id=p_anchor and s.dataset_id=p_source and s.property_id=any(p_ids)
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 ), raw as materialized (
  select v.property_id,nullif(btrim(r.fields->>'imprv_state_cd'),'') state_code,
   nullif(btrim(r.fields->>'land_state_cd'),'') land_code
  from visible v join tcad_ingest.records r on r.dataset_id=p_source
   and r.prop_id in(v.property_id,lpad(v.property_id,12,'0'))
  join tcad_ingest.files f on f.dataset_id=r.dataset_id and f.member_name=r.member_name
  where f.record_type='Property' and f.status='complete' and ltrim(r.prop_val_yr,'0')=v.tax_year::text
 ), checked as (
  select property_id,
   case when count(state_code)=count(*) and count(distinct state_code)=1 then min(state_code) end state_code,
   case when count(land_code)=count(*) and count(distinct land_code)=1 then min(land_code) end land_code
  from raw group by property_id
 ) select coalesce(jsonb_agg(jsonb_build_object('property_id',property_id,'state_code',state_code,'land_code',land_code)),'[]') into result from checked;
 return result;
end $$;
revoke all on function parcel_comparison.neighborhood_types(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function parcel_comparison.neighborhood_types(uuid,uuid,text[]) to anon,authenticated;

-- Whole-property market value uses recorded residential floor area across buildings.
-- Zero-valued floor records do not supply living area; unknown facts stay unknown.
create function public.neighborhood_floor_area(p_snapshot jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 with floors as (
  select c from jsonb_array_elements(coalesce(p_snapshot->'components','[]')) c
  where c->>'code' in('1ST','2ND','3RD') and c->>'class_code' ~ '^R[1-6]'
 ), valid as (
  select c from floors where (c->>'value')::numeric>0
 ) select jsonb_build_object('area',case
  when not exists(select 1 from floors where c->>'value' is null)
   and count(*)>0 and count(c->>'area')=count(*) and count(c->>'improvement_id')=count(*)
   and bool_and((c->>'area')::numeric>0)
  then sum((c->>'area')::numeric) end,
  'buildings',count(distinct c->>'improvement_id')) from valid
$$;
revoke all on function public.neighborhood_floor_area(jsonb) from public;
grant execute on function public.neighborhood_floor_area(jsonb) to anon,authenticated;

create function public.property_neighborhood_v2(p_id text,p_source uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='15s' as $$
declare base jsonb; types jsonb; ids text[]; refined jsonb; retained jsonb; exclusions jsonb; caps jsonb; subject_area jsonb;
begin
 base:=public.property_neighborhood(p_id,p_source);
 if base->>'status' is distinct from 'ok' then return base; end if;
 select coalesce(array_agg(h->>'property_id'),array[]::text[]) into ids from jsonb_array_elements(base->'homes') h;
 types:=parcel_comparison.neighborhood_types((base->>'anchor_id')::uuid,(base->>'source_id')::uuid,ids);
 with facts as (
  select h,s.snapshot,t->>'state_code' state_code,t->>'land_code' land_code,
   public.neighborhood_floor_area(s.snapshot) floor_area
  from jsonb_array_elements(base->'homes') h
  join public.property_snapshot_profiles s on s.anchor_dataset_id=(base->>'anchor_id')::uuid
   and s.dataset_id=(base->>'source_id')::uuid and s.property_id=h->>'property_id'
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
   'certified_area',public.neighborhood_floor_area(c.snapshot)->'area') order by x->'home'->>'property_id'),'[]') into retained
 from jsonb_array_elements(refined) x
 left join public.property_snapshot_profiles c on c.anchor_dataset_id=(base->>'anchor_id')::uuid
  and c.dataset_id=(base->>'certified_id')::uuid and c.property_id=x->'home'->>'property_id'
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
