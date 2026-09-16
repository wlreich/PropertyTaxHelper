-- Public TCAD schedules only. Parcel calculations use the existing RLS projections.
create table public.market_adjustment_sources (
 tax_year integer primary key check(tax_year between 2000 and 2200),
 filename text not null check(filename ~ '^[0-9]{4}_Market_Adjustments[.]pdf$'),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 row_count integer not null check(row_count>0),
 imported_at timestamptz not null default now()
);
create table public.neighborhood_market_adjustments (
 tax_year integer not null references public.market_adjustment_sources(tax_year),
 neighborhood text not null check(length(neighborhood) between 1 and 100),
 factor_percent numeric not null check(factor_percent>0 and factor_percent<=10000),
 source_page integer not null check(source_page>0),
 primary key(tax_year,neighborhood)
);
alter table public.market_adjustment_sources enable row level security;
alter table public.neighborhood_market_adjustments enable row level security;
create policy market_adjustment_sources_read on public.market_adjustment_sources for select to anon,authenticated using(true);
create policy neighborhood_market_adjustments_read on public.neighborhood_market_adjustments for select to anon,authenticated using(true);
revoke all on public.market_adjustment_sources,public.neighborhood_market_adjustments from anon,authenticated;
grant select on public.market_adjustment_sources,public.neighborhood_market_adjustments to anon,authenticated;

-- The rounding check guards against overrides and inapplicable component schedules.
-- No certified value is substituted for a preliminary value.
create function public.market_adjustment_effect(p_pre jsonb,p_prior jsonb,p_old_pre jsonb,p_code text,p_factor numeric,p_old_factor numeric)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare base numeric; value numeric; old_value numeric; reason text; effect numeric; actual numeric; comp jsonb;
begin
 if p_pre is null then reason:='missing_preliminary';
 elsif p_pre->>'neighborhood' is distinct from p_code or p_prior->>'neighborhood' is distinct from p_code then reason:='unmatched_neighborhood';
 elsif p_factor is null or p_old_factor is null or p_factor<=0 or p_old_factor<=0 then reason:='missing_factor';
 else
  comp:=p_pre->'components';
  if jsonb_typeof(comp) is distinct from 'array' then reason:='unverified_components';
  elsif jsonb_array_length(comp)=0 or exists(select 1 from jsonb_array_elements(comp) c where jsonb_typeof(c->'value') is distinct from 'number' or (c->>'value')::numeric<0)
   then reason:='unverified_components';
  elsif (public.neighborhood_floor_area(p_pre)->>'buildings')::integer is distinct from 1 then reason:='unverified_buildings';
  elsif jsonb_typeof(p_pre->'improvement_value') is distinct from 'number' then reason:='unverified_components';
  else
   select sum((c->>'value')::numeric) into base from jsonb_array_elements(comp) c;
   value:=(p_pre->>'improvement_value')::numeric;
   if base<=0 or value<=0 or abs(round(base*p_factor)-value)>1 then reason:='does_not_reconcile';
   else effect:=round(base*p_factor)-round(base*p_old_factor);reason:='ok'; end if;
  end if;
 end if;
 if p_pre->>'neighborhood'=p_code and p_old_pre->>'neighborhood'=p_code
  and jsonb_typeof(p_pre->'improvement_value')='number' and jsonb_typeof(p_old_pre->'improvement_value')='number' then
  actual:=(p_pre->>'improvement_value')::numeric-(p_old_pre->>'improvement_value')::numeric;
 end if;
 return jsonb_build_object('status',reason,'effect',effect,'actual_change',actual,'preliminary_date',p_pre->>'export_date','prior_preliminary_date',p_old_pre->>'export_date');
end $$;
revoke all on function public.market_adjustment_effect(jsonb,jsonb,jsonb,text,numeric,numeric) from public;
grant execute on function public.market_adjustment_effect(jsonb,jsonb,jsonb,text,numeric,numeric) to anon,authenticated;

create function public.market_adjustment_analysis(p_anchor uuid,p_source uuid,p_ids text[],p_subject text)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='15s' as $$
declare selected jsonb; yr integer; code text; cutoff text; factor numeric; old_factor numeric; history jsonb; results jsonb;
begin
 if coalesce(cardinality(p_ids),0)>10000 or exists(select 1 from unnest(p_ids) id where id !~ '^[0-9]{1,12}$') then
  raise exception 'Invalid property list' using errcode='22023'; end if;
 select s.snapshot into selected from public.property_search_state st
 join public.property_snapshot_profiles s on s.anchor_dataset_id=st.dataset_id and s.dataset_id=p_source and s.property_id=p_subject
 where st.singleton and st.dataset_id=p_anchor;
 if selected is null then return null; end if;
 yr:=(selected->>'tax_year')::integer;code:=selected->>'neighborhood';cutoff:=selected->>'export_date';
 select factor_percent/100 into factor from public.neighborhood_market_adjustments where tax_year=yr and neighborhood=code;
 select factor_percent/100 into old_factor from public.neighborhood_market_adjustments where tax_year=yr-1 and neighborhood=code;
 select coalesce(jsonb_agg(jsonb_build_object('year',f.tax_year,'factor',f.factor_percent/100,'page',f.source_page,'filename',s.filename,'sha256',s.sha256) order by f.tax_year),'[]') into history
 from public.neighborhood_market_adjustments f join public.market_adjustment_sources s using(tax_year) where f.neighborhood=code and f.tax_year<=yr;
 with ids as (select distinct unnest(p_ids) id), rows as (
 select ids.id,public.market_adjustment_effect(pre.snapshot,prior.snapshot,old_pre.snapshot,code,factor,old_factor) result
 from ids
 join public.property_snapshot_profiles current on current.anchor_dataset_id=p_anchor and current.dataset_id=p_source and current.property_id=ids.id and current.snapshot->>'neighborhood'=code
 left join lateral(select s.snapshot from public.property_snapshot_profiles s where s.anchor_dataset_id=p_anchor and s.property_id=ids.id and s.snapshot->>'tax_year'=yr::text and s.snapshot->>'roll_stage'='preliminary' and s.snapshot->>'export_date'<=cutoff order by s.snapshot->>'export_date',s.dataset_id limit 1) pre on true
 left join lateral(select s.snapshot from public.property_snapshot_profiles s where s.anchor_dataset_id=p_anchor and s.property_id=ids.id and s.snapshot->>'tax_year'=(yr-1)::text and s.snapshot->>'export_date'<=cutoff order by s.snapshot->>'export_date' desc,s.dataset_id limit 1) prior on true
 left join lateral(select s.snapshot from public.property_snapshot_profiles s where s.anchor_dataset_id=p_anchor and s.property_id=ids.id and s.snapshot->>'tax_year'=(yr-1)::text and s.snapshot->>'roll_stage'='preliminary' and s.snapshot->>'export_date'<=cutoff order by s.snapshot->>'export_date',s.dataset_id limit 1) old_pre on true
 ) select coalesce(jsonb_agg(jsonb_build_object('property_id',id)||result order by id),'[]') into results from rows;
 return jsonb_build_object('year',yr,'neighborhood',code,'history',history,'homes',results);
end $$;
revoke all on function public.market_adjustment_analysis(uuid,uuid,text[],text) from public;
grant execute on function public.market_adjustment_analysis(uuid,uuid,text[],text) to anon,authenticated;

create function public.property_market_adjustment(p_id text)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='15s' as $$
declare anchor uuid; source uuid;
begin
 if p_id !~ '^[0-9]{1,12}$' then return null; end if;
 p_id:=ltrim(p_id,'0');
 select st.dataset_id into anchor from public.property_search_state st where st.singleton;
 select s.dataset_id into source from public.property_snapshot_profiles s
 join public.property_search_documents d on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
 where s.anchor_dataset_id=anchor and s.property_id=p_id and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 order by (s.dataset_id=anchor) desc,s.snapshot->>'tax_year' desc,s.snapshot->>'export_date' desc limit 1;
 if source is null then return null; end if;
 return public.market_adjustment_analysis(anchor,source,array[p_id],p_id);
end $$;
revoke all on function public.property_market_adjustment(text) from public;
grant execute on function public.property_market_adjustment(text) to anon,authenticated;

create function public.property_neighborhood_v4(p_id text,p_source uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='25s' as $$
declare result jsonb; ids text[];
begin
 result:=public.property_neighborhood_v3(p_id,p_source);
 if result->>'status' is distinct from 'ok' then return result; end if;
 select array_agg(h->>'property_id') into ids from jsonb_array_elements(result->'homes') h;
 return result||jsonb_build_object('market_adjustment',public.market_adjustment_analysis((result->>'anchor_id')::uuid,(result->>'source_id')::uuid,ids,result->'subject'->>'property_id'));
end $$;
revoke all on function public.property_neighborhood_v4(text,uuid) from public;
grant execute on function public.property_neighborhood_v4(text,uuid) to anon,authenticated;
