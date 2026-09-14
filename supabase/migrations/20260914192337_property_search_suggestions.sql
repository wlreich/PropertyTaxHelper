-- Fast, capped address suggestions for the public typeahead. This intentionally
-- avoids the full search ranker, which is reserved for submitted searches.
create or replace function public.suggest_property_parcels(
  p_query text,
  p_limit integer default 8,
  p_show_all boolean default false
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
set statement_timeout = '2s'
as $$
declare
  q text;
  parts jsonb;
  house_part text;
  unit_part text;
  direction_part text;
  suffix_part text;
  street_parts text[];
  release_id uuid;
  matches jsonb;
begin
  if p_query is null
    or p_show_all is null
    or p_limit is null
    or p_limit < 1
    or p_limit > 8
    or length(p_query) > 120
  then
    raise exception 'Invalid suggestion parameters' using errcode = '22023';
  end if;

  q := public.normalize_property_address(replace(p_query, '#', ' UNIT '));
  parts := public.search_address_parts(q);

  if length(q) < 3
    or cardinality(string_to_array(q, ' ')) > 8
    or not exists (
      select 1
      from unnest(string_to_array(q, ' ')) token
      where length(token) >= 3
    )
  then
    raise exception 'Enter at least three letters or digits; use at most eight address parts'
      using errcode = '22023';
  end if;

  select dataset_id
  into release_id
  from public.property_search_state
  where singleton;

  if release_id is null then
    return jsonb_build_object('available', false, 'items', '[]'::jsonb, 'has_more', false);
  end if;

  house_part := parts ->> 'house';
  unit_part := parts ->> 'unit';
  direction_part := parts ->> 'direction';
  suffix_part := parts ->> 'suffix';
  select coalesce(array_agg(value), array[]::text[])
  into street_parts
  from jsonb_array_elements_text(parts -> 'street');

  with selected as (
    select
      jsonb_build_object(
        'property_id', d.property_id,
        'address', d.address,
        'city', d.city,
        'postal_code', d.postal_code,
        'is_parkland', d.is_parkland
      ) as item,
      case
        when d.property_id = ltrim(q, '0') then 0
        when d.search_text like q || '%' then 1
        else 2
      end as rank,
      d.search_text,
      d.property_id
    from public.property_search_documents d
    where d.dataset_id = release_id
      and (p_show_all or not d.is_parkland or d.property_id = ltrim(q, '0'))
      and (
        d.property_id = ltrim(q, '0')
        or (
          house_part is null
          and d.search_text like '%' || q || '%'
        )
        or (
          house_part is not null
          and d.search_text like house_part || ' %'
          and not exists (
            select 1
            from unnest(street_parts) token
            where d.search_text not like '% ' || token || '%'
          )
          and (direction_part is null or d.search_text like '% ' || direction_part || ' %')
          and (suffix_part is null or d.search_text like '% ' || suffix_part || ' %')
          and (unit_part is null or d.search_text like '% UNIT ' || unit_part || ' %')
        )
      )
    order by rank, d.search_text, d.property_id
    limit p_limit + 1
  )
  select coalesce(jsonb_agg(item order by rank, search_text, property_id), '[]'::jsonb)
  into matches
  from selected;

  return jsonb_build_object(
    'available', true,
    'items', (
      select coalesce(jsonb_agg(value order by position), '[]'::jsonb)
      from jsonb_array_elements(matches) with ordinality result(value, position)
      where position <= p_limit
    ),
    'has_more', jsonb_array_length(matches) > p_limit
  );
end
$$;

revoke all on function public.suggest_property_parcels(text, integer, boolean) from public;
grant execute on function public.suggest_property_parcels(text, integer, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
