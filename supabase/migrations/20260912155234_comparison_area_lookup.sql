-- RLS prevents an expression on snapshot JSON from being pushed into the old index.
-- Store only the existing public market-area key separately; keep the identical visibility fence.
create table public.property_comparison_areas (
 anchor_dataset_id uuid not null,
 dataset_id uuid not null,
 property_id text not null,
 neighborhood text,
 primary key(anchor_dataset_id,dataset_id,property_id),
 foreign key(anchor_dataset_id,property_id,dataset_id) references public.property_snapshot_profiles(anchor_dataset_id,property_id,dataset_id) on delete cascade
);
alter table public.property_comparison_areas enable row level security;
revoke all on public.property_comparison_areas from public,anon,authenticated;
grant select on public.property_comparison_areas to anon,authenticated;
create policy visible_comparison_areas on public.property_comparison_areas for select to anon,authenticated
 using(anchor_dataset_id=(select dataset_id from public.property_search_state where singleton)
 and exists(select 1 from public.property_search_documents d where d.dataset_id=anchor_dataset_id and d.property_id=property_comparison_areas.property_id and not d.shared_ownership and not d.values_under_review));
create index property_comparison_neighborhood_idx on public.property_comparison_areas(anchor_dataset_id,dataset_id,neighborhood,property_id);
create function tcad_ingest.sync_comparison_area() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.property_comparison_areas values(new.anchor_dataset_id,new.dataset_id,new.property_id,new.snapshot->>'neighborhood')
 on conflict(anchor_dataset_id,dataset_id,property_id) do update set neighborhood=excluded.neighborhood;
 return new;
end $$;
revoke all on function tcad_ingest.sync_comparison_area() from public,anon,authenticated;
create trigger comparison_area_sync after insert or update of snapshot on public.property_snapshot_profiles
 for each row execute function tcad_ingest.sync_comparison_area();
insert into public.property_comparison_areas
 select anchor_dataset_id,dataset_id,property_id,snapshot->>'neighborhood' from public.property_snapshot_profiles;
analyze public.property_comparison_areas;
drop index public.property_comparison_area_idx;

create or replace function public.property_comparisons(p_id text,p_source uuid default null,p_selected text[] default array[]::text[],p_query text default '',p_page integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='10s' as $$
declare anchor uuid; rel record; subject_doc record; subject_snapshot jsonb; source_id uuid; releases jsonb;
 subject_item jsonb; candidates jsonb:='[]'; chosen jsonb:='[]'; matches jsonb:='[]'; search_result jsonb;
 source_meta jsonb; q text:=coalesce(p_query,'');
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' or coalesce(cardinality(p_selected),0)>10
  or exists(select 1 from unnest(p_selected) x where x is null or x !~ '^[0-9]{1,12}$')
  or length(q)>120 or p_page is null or p_page not between 0 and 249 then
  raise exception 'Invalid comparison parameters' using errcode='22023';
 end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 if anchor is null then return jsonb_build_object('available',false); end if;
 select * into rel from public.property_releases where dataset_id=anchor;
 select * into subject_doc from public.property_search_documents where dataset_id=anchor and property_id=ltrim(p_id,'0')
  and not shared_ownership and not values_under_review and not is_parkland;
 if not found then return jsonb_build_object('available',true,'status','missing_property'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('dataset_id',dataset_id,'tax_year',snapshot->'tax_year','roll_stage',snapshot->'roll_stage',
  'export_date',snapshot->'export_date') order by snapshot->>'tax_year' desc,snapshot->>'export_date' desc,dataset_id),'[]') into releases
 from public.property_snapshot_profiles where anchor_dataset_id=anchor and property_id=subject_doc.property_id;
 if p_source is null then
  select dataset_id,snapshot into source_id,subject_snapshot from public.property_snapshot_profiles
  where anchor_dataset_id=anchor and property_id=subject_doc.property_id and (snapshot->>'tax_year')::int=rel.tax_year
   and snapshot->>'roll_stage'=rel.roll_stage and (snapshot->>'export_time_raw') is not distinct from rel.export_time_raw limit 1;
 else
  select dataset_id,snapshot into source_id,subject_snapshot from public.property_snapshot_profiles
  where anchor_dataset_id=anchor and property_id=subject_doc.property_id and dataset_id=p_source;
 end if;
 if source_id is null then return jsonb_build_object('available',true,'status','missing_snapshot'); end if;
 source_meta:=jsonb_build_object('dataset_id',source_id,'tax_year',subject_snapshot->'tax_year','roll_stage',subject_snapshot->'roll_stage','export_date',subject_snapshot->'export_date');
 subject_item:=public.property_comparison_item(subject_doc.property_id,subject_doc.address,subject_doc.city,subject_doc.property_type,subject_snapshot);
 if q='' then
  select coalesce(jsonb_agg(item order by property_id),'[]') into candidates from (
   select s.property_id,public.property_comparison_item(d.property_id,d.address,d.city,d.property_type,s.snapshot) item
   from public.property_comparison_areas a
   join public.property_snapshot_profiles s on s.anchor_dataset_id=a.anchor_dataset_id and s.dataset_id=a.dataset_id and s.property_id=a.property_id
   join public.property_search_documents d on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
   where s.anchor_dataset_id=anchor and s.dataset_id=source_id
    and a.neighborhood=subject_snapshot->>'neighborhood'
    and s.property_id<>subject_doc.property_id and d.property_type=subject_doc.property_type
    and not d.shared_ownership and not d.values_under_review and not d.is_parkland
   order by s.property_id limit 2001
  ) c;
 else
  search_result:=public.search_property_parcels(q,p_page,false);
  select coalesce(jsonb_agg(public.property_comparison_item(d.property_id,d.address,d.city,d.property_type,s.snapshot) order by e.ord),'[]') into matches
  from jsonb_array_elements(search_result->'items') with ordinality e(item,ord)
  join public.property_search_documents d on d.dataset_id=anchor and d.property_id=e.item->>'property_id'
  join public.property_snapshot_profiles s on s.anchor_dataset_id=anchor and s.property_id=d.property_id and s.dataset_id=source_id
  where d.property_id<>subject_doc.property_id and not d.shared_ownership and not d.values_under_review and not d.is_parkland;
 end if;
 select coalesce(jsonb_agg(public.property_comparison_item(d.property_id,d.address,d.city,d.property_type,s.snapshot) order by d.property_id),'[]') into chosen
 from public.property_search_documents d join public.property_snapshot_profiles s
  on s.anchor_dataset_id=d.dataset_id and s.property_id=d.property_id and s.dataset_id=source_id
 where d.dataset_id=anchor and d.property_id=any(p_selected) and d.property_id<>subject_doc.property_id
  and not d.shared_ownership and not d.values_under_review and not d.is_parkland;
 return jsonb_build_object('available',true,'status','ok','anchor_id',anchor,'release',source_meta,'releases',releases,'subject',subject_item,
  'candidates',candidates,'candidate_limit_reached',jsonb_array_length(candidates)>2000,'selected',chosen,'matches',matches,
  'search_has_more',coalesce((search_result->>'has_more')::boolean,false));
end $$;
revoke all on function public.property_comparisons(text,uuid,text[],text,integer) from public;
grant execute on function public.property_comparisons(text,uuid,text[],text,integer) to anon,authenticated;
