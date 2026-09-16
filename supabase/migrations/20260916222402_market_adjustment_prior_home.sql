-- Vacant prior-year parcels are not matched homes, even when their code matches.
create or replace function public.market_adjustment_effect(p_pre jsonb,p_prior jsonb,p_old_pre jsonb,p_code text,p_factor numeric,p_old_factor numeric)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare base numeric; value numeric; old_value numeric; reason text; effect numeric; actual numeric; comp jsonb;
begin
 if p_pre is null then reason:='missing_preliminary';
 elsif p_pre->>'neighborhood' is distinct from p_code or p_prior->>'neighborhood' is distinct from p_code then reason:='unmatched_neighborhood';
 elsif jsonb_typeof(p_prior->'improvement_value') is distinct from 'number' or (p_prior->>'improvement_value')::numeric<=0 or coalesce((public.neighborhood_floor_area(p_prior)->>'buildings')::integer,0)<1 then reason:='missing_prior_home';
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
