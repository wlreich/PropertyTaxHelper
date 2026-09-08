-- Classify only the explicit TCAD legal-description designation. Raw text stays private.
select pg_advisory_xact_lock(837142);
create or replace function tcad_ingest.is_explicit_parkland(description text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(description ~* '\(\s*PARKLAND\s*\)',false)
$$;
revoke all on function tcad_ingest.is_explicit_parkland(text) from public,anon,authenticated,service_role,tcad_loader;

-- Compute source classifications before acquiring the brief table-alter lock.
create temporary table parkland_classifications on commit drop as
 select r.dataset_id,ltrim(r.prop_id,'0') property_id,
  bool_and(tcad_ingest.is_explicit_parkland(r.fields->>'legal_desc')) is_parkland
 from public.property_releases p
 join tcad_ingest.files f on f.dataset_id=p.dataset_id and f.record_type='Property'
 join tcad_ingest.records r on r.dataset_id=f.dataset_id and r.member_name=f.member_name
 where r.prop_val_yr::integer=p.tax_year
 group by r.dataset_id,ltrim(r.prop_id,'0');
alter table public.property_search_documents add column if not exists is_parkland boolean not null default false;

create or replace function public.search_property_parcels(p_query text,p_page integer default 0,p_show_all boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' set statement_timeout='5s' as $$
declare q text; tokens text[]; anchor text; release_id uuid; result jsonb;
begin
 if p_show_all is null or p_query is null or length(p_query)>120 or p_page is null or p_page<0 or p_page>249 then
  raise exception 'Invalid search parameters' using errcode='22023';
 end if;
 q:=public.normalize_property_address(p_query);
 tokens:=string_to_array(q,' ');
 select t into anchor from unnest(tokens) t order by length(t) desc,t limit 1;
 if q is null or length(q)<3 or coalesce(length(anchor),0)<3 or cardinality(tokens)>8 then
  raise exception 'Enter at least three letters or digits; use at most eight address parts' using errcode='22023';
 end if;
 select dataset_id into release_id from public.property_search_state where singleton;
 if release_id is null then return jsonb_build_object('available',false,'items','[]'::jsonb,'has_more',false); end if;
 with matches as (
   select d.*,case when d.property_id=ltrim(q,'0') or public.normalize_property_address(d.address)=q then 0
     when d.search_text like q||'%' then 1 else 2 end as rank
   from public.property_search_documents d
   where d.dataset_id=release_id and (p_show_all or not d.is_parkland or d.property_id=ltrim(q,'0')) and (
     d.property_id=ltrim(q,'0') or (d.search_text like '%'||anchor||'%' and not exists(
       select 1 from unnest(tokens) t where case when t ~ '^[0-9]+$'
         then not ((' '||d.search_text||' ') like '% '||t||' %')
         else d.search_text not like '%'||t||'%' end)))
   order by rank,d.search_text,d.property_id limit 21 offset p_page*20
 ), numbered as(select *,row_number() over(order by rank,search_text,property_id) n from matches)
 select jsonb_build_object('available',true,'items',coalesce(jsonb_agg(jsonb_build_object(
   'property_id',property_id,'address',address,'city',city,'postal_code',postal_code,
   'is_parkland',is_parkland,'property_type',property_type,'market_value',market_value,'values_under_review',values_under_review)
   order by rank,search_text,property_id) filter(where n<=20),'[]'::jsonb),
   'has_more',count(*)>20 and p_page<249,'limit_reached',count(*)>20 and p_page=249) into result from numbered;
 return result || (select jsonb_build_object('tax_year',tax_year,'roll_stage',roll_stage,'export_time_raw',export_time_raw)
   from public.property_releases where dataset_id=release_id);
end $$;

-- The existing two-argument RPC remains unchanged for deployment compatibility.
revoke all on function public.search_property_parcels(text,integer,boolean) from public;
grant execute on function public.search_property_parcels(text,integer,boolean) to anon,authenticated;

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
  legal_desc text,prop_type_cd text,market_value text,appraised_val text,assessed_val text,
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
   bool_and(tcad_ingest.is_explicit_parkland(legal_desc)) is_parkland,
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
  coalesce((select sum(n) from pg_temp.search_children c where c.id in (g.property_id,g.group_id) and c.record_type='LandDetail'),0)::integer,
  g.is_parkland
 from grouped g where not exists(select 1 from pg_temp.search_blocked b where b.id in(g.property_id,g.group_id));
 get diagnostics published_count = row_count;
 if published_count=0 then raise exception 'No eligible properties; publication rolled back'; end if;
 insert into public.property_search_state(singleton,dataset_id) values(true,d.id)
 on conflict(singleton) do update set dataset_id=excluded.dataset_id;
 analyze public.property_search_documents;
 return jsonb_build_object('published_properties',published_count,'dataset_id',d.id);
end $$;
revoke all on function tcad_ingest.search_number(text),tcad_ingest.publish_property_search(uuid) from public,anon,authenticated,service_role,tcad_loader;

-- Update only changed public flags; source descriptions remain private.
update public.property_search_documents d set is_parkland=c.is_parkland
from pg_temp.parkland_classifications c where d.dataset_id=c.dataset_id and d.property_id=c.property_id
 and d.is_parkland is distinct from c.is_parkland;
notify pgrst, 'reload schema';
