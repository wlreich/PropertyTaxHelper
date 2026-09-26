-- Rank a single alphabetic street prefix from parsed street tokens. This
-- preserves the existing order without reparsing the query and running the
-- full address ranker for thousands of candidates on every keystroke.
-- Numbered streets, addresses with house numbers, and multi-part queries keep
-- the established matching path below.
create or replace function public.suggest_property_parcels(
  p_query text,
  p_limit integer default 8,
  p_show_all boolean default false
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
set statement_timeout = '6s'
as $$
declare
  q text;
  parts jsonb;
  candidate_parts jsonb;
  query_tokens text[];
  tail_part text;
  base_query text;
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
  query_tokens := string_to_array(q, ' ');
  tail_part := query_tokens[cardinality(query_tokens)];
  if cardinality(query_tokens) > 1 then
    base_query := array_to_string(query_tokens[1:cardinality(query_tokens) - 1], ' ');
  end if;
  candidate_parts := case
    when tail_part ~ '^[0-9]{1,5}$' and cardinality(query_tokens) >= 3
      then public.search_address_parts(base_query)
    else parts
  end;

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
  from jsonb_array_elements_text(candidate_parts -> 'street')
  order by length(value) desc, value
  limit 1;

  if house_part is null and q ~ '^[A-Z]{3,}$' then
    with ranked as materialized (
      select d.property_id, d.address, d.city, d.postal_code,
        d.is_parkland, d.search_text,
        case when d.search_text like q || '%' then 0 else 1 end as prefix_rank,
        case when street.matched is not null then
          (case when street.matched = q then 0 else 1 end)
            + (case when street.token_count = 1 then 0 else 1 end)
        end as rank
      from public.property_search_documents d
      cross join lateral (
        select count(*) as token_count,
          (array_agg(token order by position)
            filter (where token like q || '%'))[1] as matched
        from jsonb_array_elements_text(public.search_address_parts(d.address) -> 'street')
          with ordinality as tokens(token, position)
      ) street
      where d.dataset_id = release_id
        and (d.search_text like q || '%' or d.search_text like '% ' || q || '%')
        and (p_show_all or not d.is_parkland)
        and not d.is_vacant_land
    ), selected as (
      select jsonb_build_object(
        'property_id', property_id, 'address', address,
        'city', city, 'postal_code', postal_code,
        'is_parkland', is_parkland
      ) as item, prefix_rank, rank, search_text, property_id
      from ranked
      order by prefix_rank, rank nulls last, search_text, property_id
      limit p_limit + 1
    )
    select coalesce(
      jsonb_agg(item order by prefix_rank, rank nulls last, search_text, property_id),
      '[]'::jsonb
    ) into matches from selected;
  else
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
      end as rank,
      case
        when d.property_id = ltrim(q, '0') then -1
        when d.search_text like q || '%' then 0
        when house_part is null and (' ' || d.search_text) like '% ' || q || '%' then 1
        when tail_part ~ '^[0-9]{1,5}$'
          and base_query is not null
          and d.postal_code like tail_part || '%'
          and public.search_address_rank(base_query, d.address, d.city, d.postal_code) is not null then 1
        else 2
      end as prefix_rank
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
      prefix_rank,
      rank,
      search_text,
      property_id
    from ranked
    where rank is not null or prefix_rank < 2
    order by prefix_rank, rank nulls last, search_text, property_id
    limit p_limit + 1
  )
  select coalesce(
    jsonb_agg(item order by prefix_rank, rank nulls last, search_text, property_id),
    '[]'::jsonb
  )
  into matches
  from selected;
  end if;

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
