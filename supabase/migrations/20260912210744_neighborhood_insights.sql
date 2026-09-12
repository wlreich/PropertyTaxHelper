-- Public, non-personal cap facts only. Reuse the existing private-source boundary:
-- active anchor + published snapshot + ready source + visibility checks before lookup.
-- No raw table grants; no owner, exemption amounts, or agent fields are returned.
create function parcel_comparison.cap_inputs(p_anchor uuid,p_source uuid,p_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare result jsonb;
begin
 if p_anchor is null or p_source is null or p_ids is null or cardinality(p_ids)>10000
  or exists(select 1 from unnest(p_ids) x where x is null or x !~ '^[0-9]{1,12}$') then
  raise exception 'Invalid cap parameters' using errcode='22023'; end if;
 if not exists(select 1 from public.property_search_state where singleton and dataset_id=p_anchor) then return '[]'; end if;
 with visible as materialized (
  select s.property_id,(s.snapshot->>'tax_year')::int tax_year from public.property_snapshot_profiles s
  join public.property_search_documents d on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
  join tcad_ingest.datasets src on src.id=s.dataset_id and src.status='ready'
  where s.anchor_dataset_id=p_anchor and s.dataset_id=p_source and s.property_id=any(p_ids)
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 ), raw as (
  select v.property_id,v.tax_year,r.fields,count(*) over(partition by v.property_id) n
  from visible v join tcad_ingest.files f on f.dataset_id=p_source and f.record_type='Property' and f.status='complete'
  join tcad_ingest.records r on r.dataset_id=p_source and r.member_name=f.member_name
   and r.prop_id in (v.property_id,lpad(v.property_id,12,'0')) and ltrim(r.prop_val_yr,'0')=v.tax_year::text
 ), facts as (
  select property_id,fields->>'hs_exempt' hs,tax_year,
   tcad_ingest.profile_number(fields->>'hs_qualify_yr') qualify,
   tcad_ingest.profile_number(fields->>'ten_percent_cap') loss,
   tcad_ingest.profile_number(fields->>'market_value') market,
   tcad_ingest.profile_number(fields->>'assessed_val') assessed,
   tcad_ingest.profile_number(fields->>'appraised_val') appraised,
   tcad_ingest.profile_number(fields->>'nhs_cap_loss') nhs
  from raw where n=1
 ), checked as (
  select *,market>0 and assessed>0 and appraised=market and loss>=0 and abs(market-assessed-loss)<=1 and coalesce(nhs,0)=0 consistent
  from facts
 ) select coalesce(jsonb_agg(jsonb_build_object('property_id',property_id,
   'eligible',case when consistent and hs='T' and (loss>0 or qualify between 1900 and tax_year-1) then true
     when hs='F' or (consistent and hs='T' and qualify>=tax_year and loss=0) then false end,
   'above',case when consistent and hs='T' and (loss>0 or qualify between 1900 and tax_year-1) then loss>0 end,
   'threshold',case when consistent and hs='T' and loss>0 then assessed end)),'[]') into result from checked;
 return result;
end $$;
revoke all on function parcel_comparison.cap_inputs(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function parcel_comparison.cap_inputs(uuid,uuid,text[]) to anon,authenticated;

create function public.property_neighborhood(p_id text,p_source uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='15s' as $$
declare anchor uuid; doc record; current_snapshot jsonb; source_id uuid; releases jsonb;
 pre_id uuid; cert_id uuid; prior_id uuid; ids text[]; homes jsonb; caps jsonb:='[]';
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' then raise exception 'Invalid property' using errcode='22023'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 if anchor is null then return jsonb_build_object('available',false); end if;
 select * into doc from public.property_search_documents where dataset_id=anchor and property_id=ltrim(p_id,'0')
  and not shared_ownership and not values_under_review and not is_parkland;
 if not found then return jsonb_build_object('available',true,'status','missing_property'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('dataset_id',s.dataset_id,'tax_year',s.snapshot->'tax_year','roll_stage',s.snapshot->'roll_stage','export_date',s.snapshot->'export_date')
  order by s.snapshot->>'tax_year' desc,s.snapshot->>'export_date' desc,s.dataset_id),'[]') into releases
 from public.property_snapshot_profiles s where s.anchor_dataset_id=anchor and s.property_id=doc.property_id;
 select s.dataset_id,s.snapshot into source_id,current_snapshot from public.property_snapshot_profiles s
 join public.property_releases r on r.dataset_id=anchor
 where s.anchor_dataset_id=anchor and s.property_id=doc.property_id and
  (case when p_source is not null then s.dataset_id=p_source else (s.snapshot->>'tax_year')::int=r.tax_year
   and s.snapshot->>'roll_stage'=r.roll_stage and (s.snapshot->>'export_time_raw') is not distinct from r.export_time_raw end)
 order by s.dataset_id limit 1;
 if source_id is null then return jsonb_build_object('available',true,'status','missing_snapshot'); end if;
 if nullif(current_snapshot->>'neighborhood','') is null then return jsonb_build_object('available',true,'status','missing_area'); end if;
 -- Metadata comes only from published subject releases. No future valuation is
 -- introduced into a preliminary-release view. Earliest preliminary, latest certified.
 select (e->>'dataset_id')::uuid into pre_id from jsonb_array_elements(releases) e
 where e->>'tax_year'=current_snapshot->>'tax_year' and e->>'roll_stage'='preliminary'
  and e->>'export_date'<=current_snapshot->>'export_date' order by e->>'export_date',e->>'dataset_id' limit 1;
 select (e->>'dataset_id')::uuid into cert_id from jsonb_array_elements(releases) e
 where e->>'tax_year'=current_snapshot->>'tax_year' and e->>'roll_stage'='certified'
  and e->>'export_date'<=current_snapshot->>'export_date' order by e->>'export_date' desc,e->>'dataset_id' limit 1;
 if pre_id is not null and cert_id is not null and
  (select e->>'export_date' from jsonb_array_elements(releases) e where e->>'dataset_id'=pre_id::text)>=
  (select e->>'export_date' from jsonb_array_elements(releases) e where e->>'dataset_id'=cert_id::text) then cert_id:=null; end if;
 select (e->>'dataset_id')::uuid into prior_id from jsonb_array_elements(releases) e
 where (e->>'tax_year')::int=(current_snapshot->>'tax_year')::int-1 and e->>'roll_stage'='certified'
 order by e->>'export_date' desc nulls last,e->>'dataset_id' limit 1;
 select array_agg(property_id) into ids from (
  select a.property_id from public.property_comparison_areas a
  join public.property_snapshot_profiles s on s.anchor_dataset_id=a.anchor_dataset_id and s.dataset_id=a.dataset_id and s.property_id=a.property_id
  join public.property_search_documents d on d.dataset_id=a.anchor_dataset_id and d.property_id=a.property_id
  where a.anchor_dataset_id=anchor and a.dataset_id=source_id and a.neighborhood=current_snapshot->>'neighborhood'
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland
   and exists(select 1 from jsonb_array_elements(coalesce(s.snapshot->'components','[]')) c
    where c->>'code' in ('1ST','2ND','3RD') and c->>'class_code' ~ '^R[1-6]')
  order by a.property_id limit 10001
 ) population;
 if coalesce(cardinality(ids),0)>10000 then return jsonb_build_object('available',true,'status','area_too_large'); end if;
 if pre_id is not null then caps:=parcel_comparison.cap_inputs(anchor,pre_id,coalesce(ids,array[]::text[])); end if;
 select coalesce(jsonb_agg(jsonb_build_object('property_id',s.property_id,
  'market',s.snapshot->'market_value','area',facts->'living_area',
  'preliminary',p.snapshot->'market_value','certified',c.snapshot->'market_value',
  'certified_area',public.property_comparison_item(s.property_id,'','','',c.snapshot)->'living_area',
  'prior',y.snapshot->'market_value',
  'protested',exists(select 1 from public.property_protest_observations o where o.anchor_dataset_id=anchor and o.property_id=s.property_id
    and o.tax_year=(current_snapshot->>'tax_year')::int and (o.protest_flag is true or o.arb_case_listed))
   or exists(select 1 from public.property_snapshot_profiles x where x.anchor_dataset_id=anchor and x.property_id=s.property_id
    and x.snapshot->>'tax_year'=current_snapshot->>'tax_year' and (x.snapshot->>'protest_flag'='true' or x.snapshot->>'arb_case_listed'='true')),
  'entities',coalesce((select jsonb_agg(jsonb_build_object('code',e->>'code','name',e->>'name')) from jsonb_array_elements(coalesce(s.snapshot->'entities','[]')) e),'[]')
 ) order by s.property_id),'[]') into homes
 from public.property_snapshot_profiles s
 cross join lateral (select public.property_comparison_item(s.property_id,'','','',s.snapshot) facts) f
 left join public.property_snapshot_profiles p on p.anchor_dataset_id=anchor and p.property_id=s.property_id and p.dataset_id=pre_id
 left join public.property_snapshot_profiles c on c.anchor_dataset_id=anchor and c.property_id=s.property_id and c.dataset_id=cert_id
 left join public.property_snapshot_profiles y on y.anchor_dataset_id=anchor and y.property_id=s.property_id and y.dataset_id=prior_id
 where s.anchor_dataset_id=anchor and s.dataset_id=source_id and s.property_id=any(ids);
 return jsonb_build_object('available',true,'status','ok','anchor_id',anchor,'source_id',source_id,'releases',releases,
  'preliminary_id',pre_id,'certified_id',cert_id,'prior_id',prior_id,'neighborhood',current_snapshot->>'neighborhood',
  'subject',public.property_comparison_item(doc.property_id,doc.address,doc.city,doc.property_type,current_snapshot),
  'homes',homes,'caps',caps);
end $$;
revoke all on function public.property_neighborhood(text,uuid) from public;
grant execute on function public.property_neighborhood(text,uuid) to anon,authenticated;
