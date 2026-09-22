-- Keep street-first numbered-address suggestions aligned with submitted search.
-- Examples such as "west 36" and "w 36th" normalize to short components that
-- are valid together even though neither token independently has three chars.
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
  street_anchor text;
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
    or (
      not exists (
        select 1
        from unnest(string_to_array(q, ' ')) token
        where length(token) >= 3
      )
      and not (
        (parts ->> 'direction' is not null or parts ->> 'suffix' is not null)
        and parts -> 'street' ->> 0 ~ '^[0-9]{2,}$'
      )
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
  select value
  into street_anchor
  from jsonb_array_elements_text(parts -> 'street')
  order by length(value) desc, value
  limit 1;

  with candidates as materialized (
    select d.*
    from public.property_search_documents d
    where d.dataset_id = release_id
      and d.property_id = ltrim(q, '0')

    union all

    select d.*
    from public.property_search_documents d
    where d.dataset_id = release_id
      and house_part is not null
      and d.search_text collate "C" >= house_part || ' '
      and d.search_text collate "C" < house_part || '!'
      and d.property_id <> ltrim(q, '0')

    union all

    select d.*
    from public.property_search_documents d
    where d.dataset_id = release_id
      and house_part is null
      and street_anchor is not null
      and (
        (
          street_anchor ~ '^[0-9]+$'
          and (
            d.search_text like '% ' || street_anchor || ' %'
            or d.search_text like '% ' || street_anchor || 'ST %'
            or d.search_text like '% ' || street_anchor || 'ND %'
            or d.search_text like '% ' || street_anchor || 'RD %'
            or d.search_text like '% ' || street_anchor || 'TH %'
          )
        )
        or (
          street_anchor !~ '^[0-9]+$'
          and d.search_text like '%' || street_anchor || '%'
        )
      )
      and d.property_id <> ltrim(q, '0')
  ), ranked as materialized (
    select
      d.*,
      case
        when d.property_id = ltrim(q, '0') then -1
        else public.search_address_rank(q, d.address, d.city, d.postal_code)
      end as rank
    from candidates d
    where (((p_show_all or not d.is_parkland) and not d.is_vacant_land)
      or d.property_id = ltrim(q, '0'))
  ), selected as (
    select
      jsonb_build_object(
        'property_id', property_id,
        'address', address,
        'city', city,
        'postal_code', postal_code,
        'is_parkland', is_parkland
      ) as item,
      rank,
      search_text,
      property_id
    from ranked
    where rank is not null
    order by rank, search_text, property_id
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
