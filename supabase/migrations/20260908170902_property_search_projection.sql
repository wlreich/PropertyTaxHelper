-- Curated website data. Raw ownership, contact and exemption records stay private.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create function public.normalize_property_address(value text) returns text
language sql immutable strict parallel safe set search_path = '' as $$
 select string_agg(case word
   when 'STREET' then 'ST' when 'ROAD' then 'RD' when 'AVENUE' then 'AVE'
   when 'BOULEVARD' then 'BLVD' when 'DRIVE' then 'DR' when 'LANE' then 'LN'
   when 'COURT' then 'CT' when 'CIRCLE' then 'CIR' when 'TRAIL' then 'TRL'
   when 'PARKWAY' then 'PKWY' when 'HIGHWAY' then 'HWY' when 'PLACE' then 'PL'
   when 'NORTH' then 'N' when 'SOUTH' then 'S' when 'EAST' then 'E' when 'WEST' then 'W'
   when 'APARTMENT' then 'UNIT' when 'APT' then 'UNIT' when 'SUITE' then 'UNIT' when 'STE' then 'UNIT'
   else word end, ' ' order by ord)
 from unnest(regexp_split_to_array(trim(regexp_replace(
   replace(replace(upper(value),'''',''),'.',''), '[^A-Z0-9]+',' ','g')), ' +')) with ordinality t(word,ord)
 where word <> ''
$$;

create table public.property_releases (
 dataset_id uuid primary key,
 tax_year integer not null,
 roll_stage text not null,
 export_time_raw text,
 source_url text not null,
 published_at timestamptz not null default clock_timestamp()
);
create table public.property_search_state (
 singleton boolean primary key default true check(singleton),
 dataset_id uuid not null references public.property_releases
);
create table public.property_search_documents (
 dataset_id uuid not null references public.property_releases,
 property_id text not null check(property_id ~ '^[0-9]{1,12}$'),
 address text not null,
 city text not null,
 postal_code text not null,
 property_type text not null,
 search_text text not null,
 market_value numeric,
 appraised_value numeric,
 assessed_value numeric,
 land_value numeric,
 improvement_value numeric,
 land_acres numeric,
 source_record_count integer not null,
 values_under_review boolean not null,
 shared_ownership boolean not null,
 improvement_records integer not null,
 land_segments integer not null,
 primary key(dataset_id,property_id)
);
create index property_search_address_idx on public.property_search_documents using gin(search_text extensions.gin_trgm_ops);

alter table public.property_releases enable row level security;
alter table public.property_search_state enable row level security;
alter table public.property_search_documents enable row level security;
create policy current_search_state on public.property_search_state for select to anon,authenticated using(true);
create policy current_property_release on public.property_releases for select to anon,authenticated
 using(dataset_id=(select dataset_id from public.property_search_state where singleton));
create policy current_property_documents on public.property_search_documents for select to anon,authenticated
 using(dataset_id=(select dataset_id from public.property_search_state where singleton));
revoke all on public.property_releases,public.property_search_state,public.property_search_documents from public,anon,authenticated;
grant select on public.property_releases,public.property_search_state,public.property_search_documents to anon,authenticated;

create function public.search_properties(p_query text,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' set statement_timeout='5s' as $$
declare q text; tokens text[]; anchor text; release_id uuid; result jsonb;
begin
 if p_query is null or length(p_query)>120 or p_page is null or p_page<0 or p_page>249 then
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
   where d.dataset_id=release_id and (
     d.property_id=ltrim(q,'0') or (d.search_text like '%'||anchor||'%' and not exists(
       select 1 from unnest(tokens) t where case when t ~ '^[0-9]+$'
         then not ((' '||d.search_text||' ') like '% '||t||' %')
         else d.search_text not like '%'||t||'%' end)))
   order by rank,d.search_text,d.property_id limit 21 offset p_page*20
 ), numbered as(select *,row_number() over(order by rank,search_text,property_id) n from matches)
 select jsonb_build_object('available',true,'items',coalesce(jsonb_agg(jsonb_build_object(
   'property_id',property_id,'address',address,'city',city,'postal_code',postal_code,
   'property_type',property_type,'market_value',market_value,'values_under_review',values_under_review)
   order by rank,search_text,property_id) filter(where n<=20),'[]'::jsonb),
   'has_more',count(*)>20 and p_page<249,'limit_reached',count(*)>20 and p_page=249) into result from numbered;
 return result || (select jsonb_build_object('tax_year',tax_year,'roll_stage',roll_stage,'export_time_raw',export_time_raw)
   from public.property_releases where dataset_id=release_id);
end $$;

create function public.property_profile(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('available',exists(select 1 from public.property_search_state),
 'property',(select jsonb_build_object(
   'property_id',d.property_id,'address',d.address,'city',d.city,'postal_code',d.postal_code,'property_type',d.property_type,
   'market_value',d.market_value,'appraised_value',d.appraised_value,'assessed_value',d.assessed_value,
   'land_value',d.land_value,'improvement_value',d.improvement_value,'land_acres',d.land_acres,
   'source_record_count',d.source_record_count,'values_under_review',d.values_under_review,
   'shared_ownership',d.shared_ownership,'improvement_records',d.improvement_records,'land_segments',d.land_segments,
   'tax_year',r.tax_year,'roll_stage',r.roll_stage,'export_time_raw',r.export_time_raw,'source_url',r.source_url)
 from public.property_search_documents d join public.property_releases r using(dataset_id)
 join public.property_search_state s using(dataset_id)
 where d.property_id=ltrim(p_id,'0') and p_id ~ '^[0-9]{1,12}$'))
$$;
revoke all on function public.search_properties(text,integer),public.property_profile(text),public.normalize_property_address(text) from public;
grant execute on function public.search_properties(text,integer),public.property_profile(text),public.normalize_property_address(text) to anon,authenticated;

-- Administrator-only publication. No elevated code runs on a website request.
create function tcad_ingest.search_number(value text) returns numeric
language sql immutable strict set search_path='' as $$
 select case when trim(value) ~ '^-?[0-9]+([.][0-9]+)?$' then trim(value)::numeric end
$$;
create function tcad_ingest.publish_property_search(p_dataset_id uuid) returns jsonb
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
   case when not bool_or(shared) and count(land_acres)=count(*) and count(distinct land_acres)=1 then tcad_ingest.search_number(min(land_acres)) end acres
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
