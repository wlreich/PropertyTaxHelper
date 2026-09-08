-- TCAD Legacy 8.0.33 LandDetail.size_acres has four implied decimal places.
-- Property.land_acres is the sum in that same fixed-width representation.
-- https://traviscad.org/wp-content/largefiles/Website_Legacy8.0.33-AppraisalExportLayout_06182026.zip
-- Preserve raw source strings; convert only the curated website acreage.
select pg_advisory_xact_lock(837142);
create or replace function tcad_ingest.search_acres(value text) returns numeric
language sql immutable strict set search_path='' as $$
 select case
  when trim(value) ~ '^[0-9]+$' then trim(value)::numeric / 10000
  when trim(value) ~ '^[0-9]+[.][0-9]{1,4}$' then trim(value)::numeric
  else null end
$$;
revoke all on function tcad_ingest.search_acres(text) from public,anon,authenticated,service_role,tcad_loader;

create or replace function tcad_ingest.publish_property_search(p_dataset_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d record; published_count bigint;
begin
 perform pg_advisory_xact_lock(837142);
 select * into d from tcad_ingest.datasets where id=p_dataset_id and status='ready';
 if not found then raise exception 'Only a ready release can be published'; end if;
 if (select count(*) from tcad_ingest.files where dataset_id=p_dataset_id and record_type is not null and status='complete')<>20 then
  raise exception 'The release must contain all 20 completed text files';
 end if;
 -- Temporary working tables are private to this connection and transaction.
 create temporary table search_source on commit drop as
 select ltrim(r.prop_id,'0') as property_id,x.* from tcad_ingest.records r
 join tcad_ingest.files f using(dataset_id,member_name)
 cross join lateral jsonb_to_record(r.fields) as x(
  udi_group text,partial_owner text,ownership_pct text,
  py_confidential_flag text,jan1_confidential_flag text,appr_confidential_flag text,
  situs_num text,situs_street_prefx text,situs_street text,situs_street_suffix text,situs_unit text,situs_city text,situs_zip text,
  prop_type_cd text,market_value text,appraised_val text,assessed_val text,
  land_hstd_val text,land_non_hstd_val text,imprv_hstd_val text,imprv_non_hstd_val text,land_acres text)
 where r.dataset_id=p_dataset_id and f.record_type='Property' and r.prop_val_yr::integer=d.tax_year;
 -- Block the whole ID / shared physical group if any associated source record is confidential or unknown.
 create temporary table search_blocked on commit drop as
 select property_id as id from pg_temp.search_source where
  not coalesce(py_confidential_flag='F' and jan1_confidential_flag='F' and appr_confidential_flag='F',false)
 union select nullif(ltrim(udi_group,'0'),'') from pg_temp.search_source where
  not coalesce(py_confidential_flag='F' and jan1_confidential_flag='F' and appr_confidential_flag='F',false);
 create index on pg_temp.search_blocked(id);
 create temporary table search_children on commit drop as
 select ltrim(r.prop_id,'0') as id,f.record_type,count(*)::integer n
 from tcad_ingest.records r join tcad_ingest.files f using(dataset_id,member_name)
 where r.dataset_id=p_dataset_id and f.record_type in ('Improvement','LandDetail')
   and r.prop_val_yr::integer=d.tax_year
 group by 1,2;
 create index on pg_temp.search_children(id,record_type);
 insert into public.property_releases(dataset_id,tax_year,roll_stage,export_time_raw,source_url)
 values(d.id,d.tax_year,d.roll_stage,d.export_run_time_raw,d.source_url)
 on conflict(dataset_id) do update set published_at=clock_timestamp();
 delete from public.property_search_documents where dataset_id=p_dataset_id;
 insert into public.property_search_documents
 with base as (
  select p.*,nullif(ltrim(p.udi_group,'0'),'') as group_id,
   trim(concat_ws(' ',nullif(situs_num,''),nullif(situs_street_prefx,''),nullif(situs_street,''),
     nullif(situs_street_suffix,''),case when nullif(situs_unit,'') is not null then 'UNIT '||situs_unit end)) as address,
   coalesce(partial_owner='T',false) or coalesce(tcad_ingest.search_number(ownership_pct)<>100,false) as shared
  from pg_temp.search_source p
 ), grouped as (
  select property_id,min(address) address,coalesce(min(situs_city),'') city,coalesce(min(situs_zip),'') postal_code,
   coalesce(min(prop_type_cd),'') property_type,count(*)::integer source_records,bool_or(shared) shared,
   min(group_id) group_id,
   bool_or(shared) or count(distinct market_value)>1 or count(distinct appraised_val)>1 or count(distinct assessed_val)>1 as review,
   case when not bool_or(shared) and count(market_value)=count(*) and count(distinct market_value)=1 then tcad_ingest.search_number(min(market_value)) end market,
   case when not bool_or(shared) and count(appraised_val)=count(*) and count(distinct appraised_val)=1 then tcad_ingest.search_number(min(appraised_val)) end appraised,
   case when not bool_or(shared) and count(assessed_val)=count(*) and count(distinct assessed_val)=1 then tcad_ingest.search_number(min(assessed_val)) end assessed,
   case when not bool_or(shared) and count(land_hstd_val)=count(*) and count(land_non_hstd_val)=count(*)
     and count(distinct land_hstd_val)=1 and count(distinct land_non_hstd_val)=1
     then tcad_ingest.search_number(min(land_hstd_val))+tcad_ingest.search_number(min(land_non_hstd_val)) end land,
   case when not bool_or(shared) and count(imprv_hstd_val)=count(*) and count(imprv_non_hstd_val)=count(*)
     and count(distinct imprv_hstd_val)=1 and count(distinct imprv_non_hstd_val)=1
     then tcad_ingest.search_number(min(imprv_hstd_val))+tcad_ingest.search_number(min(imprv_non_hstd_val)) end improvements,
   case when not bool_or(shared) and count(land_acres)=count(*) and count(distinct land_acres)=1 then tcad_ingest.search_acres(min(land_acres)) end acres
  from base
  group by property_id
  having property_id ~ '^[0-9]{1,12}$' and count(distinct address)=1 and min(address)<>''
   and bool_and(nullif(situs_street,'') is not null)
   and bool_and(coalesce(py_confidential_flag='F' and jan1_confidential_flag='F' and appr_confidential_flag='F',false))
   and count(distinct group_id)<=1
 )
 select d.id,g.property_id,g.address,g.city,g.postal_code,g.property_type,
  public.normalize_property_address(concat_ws(' ',g.address,g.city,g.postal_code)),
  g.market,g.appraised,g.assessed,g.land,g.improvements,g.acres,g.source_records,g.review,g.shared,
  coalesce((select sum(n) from pg_temp.search_children c where c.id in (g.property_id,g.group_id) and c.record_type='Improvement'),0)::integer,
  coalesce((select sum(n) from pg_temp.search_children c where c.id in (g.property_id,g.group_id) and c.record_type='LandDetail'),0)::integer
 from grouped g where not exists(select 1 from pg_temp.search_blocked b where b.id in(g.property_id,g.group_id));
 get diagnostics published_count = row_count;
 if published_count=0 then raise exception 'No eligible properties; publication rolled back'; end if;
 insert into public.property_search_state(singleton,dataset_id) values(true,d.id)
 on conflict(singleton) do update set dataset_id=excluded.dataset_id;
 analyze public.property_search_documents;
 return jsonb_build_object('published_properties',published_count,'dataset_id',d.id);
end $$;
revoke all on function tcad_ingest.search_number(text),tcad_ingest.publish_property_search(uuid) from public,anon,authenticated,service_role,tcad_loader;

-- Repair existing published documents from source, never by dividing already
-- corrected values. Reapplying this repair therefore cannot rescale twice.
-- Keep withheld acreage withheld and leave all other fields untouched.
with source_acres as (
 select r.dataset_id,ltrim(r.prop_id,'0') property_id,
  case when count(r.fields->>'land_acres')=count(*)
   and count(distinct r.fields->>'land_acres')=1
   then tcad_ingest.search_acres(min(r.fields->>'land_acres')) end acres
 from public.property_releases p
 join tcad_ingest.files f on f.dataset_id=p.dataset_id and f.record_type='Property'
 join tcad_ingest.records r on r.dataset_id=f.dataset_id and r.member_name=f.member_name
 where r.prop_val_yr::integer=p.tax_year
 group by r.dataset_id,ltrim(r.prop_id,'0')
)
update public.property_search_documents d set land_acres=s.acres
from source_acres s
where d.dataset_id=s.dataset_id and d.property_id=s.property_id
 and d.land_acres is not null and d.land_acres is distinct from s.acres;
