-- Correct only bounded comparison inputs; preserve selected release and existing public-access gates.
-- Market land includes agricultural market value, never agricultural use value.
create or replace function parcel_comparison.cost_inputs(p_anchor uuid,p_source uuid,p_ids text[])
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
  where f.status='complete' and f.record_type in ('Property','Improvement','ImprovementDetail')
   and ltrim(r.prop_val_yr,'0')=v.tax_year::text
 ), land_rows as (
  select property_id,
   tcad_ingest.profile_number(fields->>'land_hstd_val') hstd,
   tcad_ingest.profile_number(fields->>'land_non_hstd_val') non_hstd,
   tcad_ingest.profile_number(fields->>'ag_market') ag_market
  from raw where record_type='Property'
 ), land as (
  -- All components must be reported and nonnegative. Conflicting duplicate
  -- Property rows remain unknown rather than choosing one or substituting zero.
  select property_id,case when bool_and(hstd is not null and non_hstd is not null and ag_market is not null
    and hstd>=0 and non_hstd>=0 and ag_market>=0)
    and count(distinct (hstd,non_hstd,ag_market))=1
    then min(hstd+non_hstd+ag_market) end market_land_value
  from land_rows group by property_id
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
 ) select coalesce(jsonb_agg(jsonb_build_object('property_id',property_id,'tax_year',tax_year,'market_land_value',(select l.market_land_value from land l where l.property_id=aggregated.property_id),'improvements',improvements) order by property_id),'[]'::jsonb) into result from aggregated;
 return jsonb_build_object('anchor_id',p_anchor,'source_id',p_source,'items',result);
end $$;
revoke all on function parcel_comparison.cost_inputs(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function parcel_comparison.cost_inputs(uuid,uuid,text[]) to anon,authenticated;
