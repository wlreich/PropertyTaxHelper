-- Bounded public projection of non-personal appraisal inputs, from the requested
-- published source only. No grants to raw tables and no cache/publication backfill.
create schema parcel_comparison;
revoke all on schema parcel_comparison from public;
grant usage on schema parcel_comparison to anon,authenticated;

-- Definer is necessary to read private ingestion records. Anonymous access is
-- intentional: authorization is the already-public snapshot and active release,
-- checked explicitly before any source lookup. The raw record is never returned.
create function parcel_comparison.cost_inputs(p_anchor uuid,p_source uuid,p_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb;
begin
 if p_anchor is null or p_source is null or p_ids is null or cardinality(p_ids)>32
  or exists(select 1 from unnest(p_ids) x where x is null or x !~ '^[0-9]{1,12}$') then
  raise exception 'Invalid adjustment parameters' using errcode='22023'; end if;
 if not exists(select 1 from public.property_search_state where singleton and dataset_id=p_anchor) then
  return jsonb_build_object('anchor_id',null,'source_id',p_source,'items','[]'::jsonb); end if;
 with visible as materialized (
  select s.property_id,(s.snapshot->>'tax_year')::int tax_year
  from public.property_snapshot_profiles s join public.property_search_documents d
   on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
  join tcad_ingest.datasets src on src.id=s.dataset_id and src.status='ready'
  where s.anchor_dataset_id=p_anchor and s.dataset_id=p_source and s.property_id=any(p_ids)
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 ), raw as materialized (
  select v.property_id,v.tax_year,f.record_type,r.fields from visible v
  join tcad_ingest.records r on r.dataset_id=p_source and r.prop_id in (v.property_id,lpad(v.property_id,12,'0'))
  join tcad_ingest.files f on f.dataset_id=r.dataset_id and f.member_name=r.member_name
  where f.status='complete' and f.record_type in ('Improvement','ImprovementDetail')
   and ltrim(r.prop_val_yr,'0')=v.tax_year::text
 ), details as (
  select property_id,fields->>'imprv_id' imp,
   count(*) n,count(distinct fields->>'imprv_det_id') unique_n,
   count(*) filter(where tcad_ingest.profile_number(fields->>'imprv_det_val') is null
    or (fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD') and (tcad_ingest.profile_number(fields->>'imprv_det_area') is null or nullif(fields->>'imprv_det_class_cd','') is null))) missing,
   sum(tcad_ingest.profile_number(fields->>'imprv_det_val')) detail_value,
   count(*) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) floors,
   sum(tcad_ingest.profile_number(fields->>'imprv_det_val')) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) main_value,
   sum(tcad_ingest.profile_number(fields->>'imprv_det_area')) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) main_area,
   min(nullif(fields->>'imprv_det_class_cd','')) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) class_code,
   count(distinct nullif(fields->>'imprv_det_class_cd','')) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) classes,
   min(tcad_ingest.profile_number(fields->>'yr_built')) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) year_built,
   min(nullif(tcad_ingest.profile_number(fields->>'depreciation_yr'),0)) filter(where fields->>'imprv_det_type_cd' in ('1ST','2ND','3RD')) depreciation_year,
   jsonb_agg(jsonb_build_object('code',fields->>'imprv_det_type_cd','description',coalesce(left(fields->>'imprv_det_type_desc',120),''),
    'value',tcad_ingest.profile_number(fields->>'imprv_det_val')) order by fields->>'imprv_det_id') feature_values
  from raw where record_type='ImprovementDetail' group by property_id,fields->>'imprv_id'
 ), buildings as (
  select r.property_id,r.tax_year,r.fields->>'imprv_id' imp,
   r.fields->>'imprv_type_cd' type_code,r.fields->>'imprv_state_cd' state_code,
   tcad_ingest.profile_number(r.fields->>'imprv_val') reported_value,d.n,d.unique_n,d.missing,d.detail_value,d.floors,d.main_value,d.main_area,d.class_code,d.classes,d.year_built,d.depreciation_year,d.feature_values,
   count(*) over(partition by r.property_id,r.fields->>'imprv_id') occurrences
  from raw r left join details d on d.property_id=r.property_id and d.imp=r.fields->>'imprv_id'
  where record_type='Improvement'
 ), aggregated as (
  select v.property_id,v.tax_year,coalesce((select jsonb_agg(jsonb_build_object(
   'id',b.imp,'type_code',b.type_code,'state_code',b.state_code,'reported_value',b.reported_value,
   'detail_value',b.detail_value,'main_value',b.main_value,'main_area',b.main_area,'class_code',case when b.classes=1 then b.class_code end,
   'year_built',b.year_built,'depreciation_year',b.depreciation_year,'floors',coalesce(b.floors,0),
   'complete',coalesce(b.missing=0 and b.n=b.unique_n and b.occurrences=1 and b.reported_value>=0,false),
   'features',coalesce(b.feature_values,'[]'::jsonb)) order by b.reported_value desc nulls last,b.imp)
   from buildings b where b.property_id=v.property_id),'[]'::jsonb) improvements
  from visible v
 ) select coalesce(jsonb_agg(jsonb_build_object('property_id',property_id,'tax_year',tax_year,'improvements',improvements) order by property_id),'[]'::jsonb) into result from aggregated;
 return jsonb_build_object('anchor_id',p_anchor,'source_id',p_source,'items',result);
end $$;
revoke all on function parcel_comparison.cost_inputs(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function parcel_comparison.cost_inputs(uuid,uuid,text[]) to anon,authenticated;
create function public.property_comparison_costs(p_anchor uuid,p_source uuid,p_ids text[])
returns jsonb language sql stable security invoker set search_path='' as $$
 select parcel_comparison.cost_inputs(p_anchor,p_source,p_ids)
$$;
revoke all on function public.property_comparison_costs(uuid,uuid,text[]) from public;
grant execute on function public.property_comparison_costs(uuid,uuid,text[]) to anon,authenticated;

-- Candidate selection can identify the primary building from published detail
-- totals; selected properties are refined using actual improvement totals above.
create or replace function public.property_comparison_item(p_id text,p_address text,p_city text,p_type text,p_snapshot jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 with components as (select c from jsonb_array_elements(coalesce(p_snapshot->'components','[]'::jsonb)) c),
 groups as (
  select c->>'improvement_id' id,count(*)=count(c->>'value') complete,sum((c->>'value')::numeric) value,
   count(*) filter(where c->>'code' in ('1ST','2ND','3RD')) floors,
   sum((c->>'area')::numeric) filter(where c->>'code' in ('1ST','2ND','3RD')) area,
   case when count(distinct c->>'class_code') filter(where c->>'code' in ('1ST','2ND','3RD'))=1
    then min(c->>'class_code') filter(where c->>'code' in ('1ST','2ND','3RD')) end class_code,
   min((c->>'year_built')::numeric) filter(where c->>'code' in ('1ST','2ND','3RD')) year_built
  from components group by c->>'improvement_id'
 ), chosen as (select * from groups where floors>0 and id is not null and ((select bool_and(complete) from groups) or (select count(*) from groups where floors>0)=1)
  order by value desc nulls last,id limit 1)
 select jsonb_build_object('property_id',p_id,'address',p_address,'city',p_city,'property_type',p_type,
  'market_value',p_snapshot->'market_value','land_value',p_snapshot->'land_value','land_acres',p_snapshot->'land_acres',
  'neighborhood',p_snapshot->'neighborhood','living_area',(select area from chosen),
  'class_code',(select nullif(class_code,'') from chosen),'year_built',(select nullif(year_built,0) from chosen),
  'main_buildings',(select count(*) from groups where floors>0))
$$;
