-- Additive contract for PAR-20. The existing page/print RPC remains unchanged.
-- Reuse the v4 population boundary, RLS, private cap helper and multiplier model.
create function public.property_neighborhood_analysis(p_id text, p_phase text default null, p_year integer default null)
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='25s' as $$
declare
 anchor uuid; chosen uuid; releases jsonb; result jsonb; ids text[]; cutoff text;
 selected_year integer; selected_stage text; period jsonb; period_id uuid;
 rows jsonb; caps jsonb; periods jsonb:='[]';
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' or (p_phase is not null and p_phase not in ('preliminary','protest','post'))
  or (p_year is not null and p_year not between 1900 and 2200) then
  raise exception 'Invalid neighborhood analysis parameters' using errcode='22023';
 end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 if anchor is null then return jsonb_build_object('available',false); end if;
 -- Subject visibility is checked before any neighborhood lookup.
 if not exists(select 1 from public.property_search_documents d where d.dataset_id=anchor and d.property_id=ltrim(p_id,'0')
  and not d.shared_ownership and not d.values_under_review and not d.is_parkland) then
  return jsonb_build_object('available',true,'status','missing_property');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('dataset_id',s.dataset_id,'tax_year',s.snapshot->'tax_year',
  'roll_stage',s.snapshot->'roll_stage','export_date',s.snapshot->'export_date',
  'preliminary_baseline_eligible',s.snapshot->'preliminary_baseline_eligible')),'[]') into releases
 from public.property_snapshot_profiles s where s.anchor_dataset_id=anchor and s.property_id=ltrim(p_id,'0');
 if jsonb_array_length(releases)>100 then return jsonb_build_object('available',true,'status','too_many_releases'); end if;
 -- Latest available year at/before the active season; stage preference only
 -- applies to that season's year. If data lags, preserve its actual stage/year.
 select (r->>'dataset_id')::uuid into chosen from jsonb_array_elements(releases) r
 where r->>'roll_stage' in ('preliminary','certified') and r->>'export_date' is not null
  and (p_year is null or (r->>'tax_year')::integer<=p_year)
  and (r->>'roll_stage'<>'preliminary' or r->>'preliminary_baseline_eligible' is distinct from 'false')
 order by (r->>'tax_year')::integer desc,
  case when p_year=(r->>'tax_year')::integer and p_phase in ('preliminary','protest') then (r->>'roll_stage'='preliminary')::int
   else (r->>'roll_stage'='certified')::int end desc,
  r->>'export_date' desc,r->>'dataset_id' limit 1;
 if chosen is null then return jsonb_build_object('available',true,'status','missing_snapshot'); end if;
 result:=public.property_neighborhood_v4(p_id,chosen);
 if result->>'status' is distinct from 'ok' then return result; end if;
 select r->>'export_date',(r->>'tax_year')::integer,r->>'roll_stage' into cutoff,selected_year,selected_stage
 from jsonb_array_elements(releases) r where r->>'dataset_id'=chosen::text;
 select coalesce(array_agg(h->>'property_id'),array[]::text[]) into ids from jsonb_array_elements(result->'homes') h;
 -- One indexed, bounded read per canonical release, not one request per home.
 -- Earliest eligible preliminary and latest certified; no later/future snapshots
 -- in a current preliminary view. A missing baseline is never replaced by certified.
 for period in
  select r from (
   select r,row_number() over(partition by r->>'tax_year',r->>'roll_stage' order by
    case when r->>'roll_stage'='preliminary' then r->>'export_date' end asc,
    case when r->>'roll_stage'='certified' then r->>'export_date' end desc,r->>'dataset_id') rank
   from jsonb_array_elements(releases) r
   where r->>'roll_stage' in ('preliminary','certified') and r->>'export_date'<=cutoff
    and (r->>'tax_year')::integer<=selected_year
    and not(selected_stage='preliminary' and r->>'roll_stage'='certified' and (r->>'tax_year')::integer=selected_year)
    and (r->>'roll_stage'<>'preliminary' or r->>'preliminary_baseline_eligible' is distinct from 'false')
  ) ranked where rank=1 order by (r->>'tax_year')::integer,r->>'roll_stage'
 loop
  period_id:=(period->>'dataset_id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object('property_id',s.property_id,'market',s.snapshot->'market_value',
   'area',public.neighborhood_floor_area(s.snapshot)->'area',
   'exclusion',case when s.snapshot->>'neighborhood' is distinct from result->>'neighborhood' then 'different_neighborhood'
    when period->>'roll_stage'='preliminary' and s.snapshot->>'preliminary_baseline_eligible'='false' then 'baseline_ineligible'
    when s.snapshot->>'market_value' is null or (s.snapshot->>'market_value')::numeric<1000 then 'unusable_value' end,
   'protested',coalesce(s.snapshot->>'protest_flag'='true',false) or coalesce(s.snapshot->>'arb_case_listed'='true',false)
    or exists(select 1 from public.property_protest_observations o where o.anchor_dataset_id=anchor and o.property_id=s.property_id
     and o.tax_year=(period->>'tax_year')::integer and (o.protest_flag is true or o.arb_case_listed))
   ) order by s.property_id),'[]') into rows
  from public.property_snapshot_profiles s where s.anchor_dataset_id=anchor and s.dataset_id=period_id and s.property_id=any(ids);
  caps:=case when period->>'roll_stage'='preliminary' then parcel_comparison.cap_inputs(anchor,period_id,ids) else '[]'::jsonb end;
  periods:=periods||jsonb_build_array(jsonb_build_object('release',period-'preliminary_baseline_eligible','homes',rows,'caps',caps));
 end loop;
 return result||jsonb_build_object('annual_periods',periods);
end $$;
revoke all on function public.property_neighborhood_analysis(text,text,integer) from public;
grant execute on function public.property_neighborhood_analysis(text,text,integer) to anon,authenticated;
