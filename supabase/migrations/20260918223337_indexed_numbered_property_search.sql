-- Public LIKE/trigram predicates cannot be pushed ahead of the release RLS
-- policy. A bytewise B-tree range uses built-in leakproof comparisons instead.
-- Normalized addresses contain only A-Z, 0-9 and spaces: [house + space,
-- house + ! ) is exactly the house-number prefix, including its separator.
-- UNION ALL branches also retain indexed property-ID lookup in generic plans.
-- Keep all RLS policies, invoker privileges and public result allowlists intact.
set lock_timeout = '5s';
create index property_search_number_prefix_idx
 on public.property_search_documents(dataset_id, search_text collate "C");
reset lock_timeout;

-- Filter house and street numbers before parsing candidate addresses.
create or replace function public.search_property_parcels_v2(p_query text,p_page integer default 0,p_show_all boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' set statement_timeout='5s'
as $$
declare q text; parts jsonb; anchor text; fuzzy_anchor text; release_id uuid; result jsonb; matches jsonb; suggestions boolean:=false; previous_threshold text;
begin
 if p_show_all is null or p_query is null or length(p_query)>120 or p_page is null or p_page<0 or p_page>249 then
  raise exception 'Invalid search parameters' using errcode='22023';
 end if;
 q:=public.normalize_property_address(replace(p_query,'#',' UNIT ')); parts:=public.search_address_parts(q);
 if length(q)<3 or cardinality(string_to_array(q,' '))>8 or (not exists(
  select 1 from unnest(string_to_array(q,' ')) t where length(t)>=3) and not (
   (parts->>'direction' is not null or parts->>'suffix' is not null) and parts->'street'->>0 ~ '^[0-9]{2,}$')) then
  raise exception 'Enter at least three letters or digits; use at most eight address parts' using errcode='22023';
 end if;
 select dataset_id into release_id from public.property_search_state where singleton;
 if release_id is null then return jsonb_build_object('available',false,'items','[]'::jsonb,'has_more',false); end if;
 select value into anchor from jsonb_array_elements_text(parts->'street') order by length(value) desc,value limit 1;
 anchor:=coalesce(parts->>'house',anchor,q);
 select value into fuzzy_anchor from jsonb_array_elements_text(parts->'street') where value ~ '^[A-Z]{5,}$' order by length(value) desc,value limit 1;
 -- Keep each candidate branch separate so a pooled session's generic plan can
 -- use the primary key or bytewise address range without scanning every row.
 with candidates as materialized (
  select d.* from (
   select d.* from public.property_search_documents d
    where d.dataset_id=release_id and d.property_id=ltrim(q,'0')
   union all
   select d.* from public.property_search_documents d
    where d.dataset_id=release_id and parts->>'house' is not null
     and d.search_text collate "C" >= (parts->>'house')||' '
     and d.search_text collate "C" < (parts->>'house')||'!'
     and d.property_id<>ltrim(q,'0')
   union all
   select d.* from public.property_search_documents d
    where d.dataset_id=release_id and parts->>'house' is null
     and d.search_text like '%'||anchor||'%'
     and (anchor !~ '^[0-9]+$' or d.search_text ~ ('(^| )'||anchor||'(ST|ND|RD|TH)?( |$)'))
     and d.property_id<>ltrim(q,'0')
  ) d where p_show_all or not d.is_parkland or d.property_id=ltrim(q,'0')
 ), ranked as materialized (
  select d.*,case when property_id=ltrim(q,'0') then -1 else public.search_address_rank(q,address,city,postal_code) end rank from candidates d
 ), selected as (
  select * from ranked where rank is not null order by rank,search_text,property_id limit 21 offset p_page*20
 ) select coalesce(jsonb_agg(to_jsonb(s) order by rank,search_text,property_id),'[]'::jsonb) into matches from selected s;
 -- Never replace an exhausted later page with spelling suggestions.
 if jsonb_array_length(matches)=0 and p_page=0 and fuzzy_anchor is not null then
  -- Load pg_trgm before setting its user parameter in a fresh pooled session.
  perform extensions.word_similarity('','');
  previous_threshold:=current_setting('pg_trgm.word_similarity_threshold');
  perform set_config('pg_trgm.word_similarity_threshold','0.15',true);
  with candidates as materialized (
   select d.* from public.property_search_documents d where d.dataset_id=release_id
    and (p_show_all or not d.is_parkland) and parts->>'house' is not null
    and d.search_text collate "C" >= (parts->>'house')||' '
    and d.search_text collate "C" < (parts->>'house')||'!'
   union all
   select d.* from public.property_search_documents d where d.dataset_id=release_id
    and (p_show_all or not d.is_parkland) and parts->>'house' is null
    and d.search_text operator(extensions.%>) fuzzy_anchor
  ), ranked as materialized (
   select d.*,public.search_address_rank(q,address,city,postal_code,true) rank from candidates d
  ), selected as (
   select * from ranked where rank>=10 order by rank,search_text,property_id limit 5
  ) select coalesce(jsonb_agg(to_jsonb(s) order by rank,search_text,property_id),'[]'::jsonb) into matches from selected s;
  perform set_config('pg_trgm.word_similarity_threshold',previous_threshold,true);
  suggestions:=jsonb_array_length(matches)>0;
 end if;
 select jsonb_build_object('available',true,'match_mode',case when suggestions then 'possible' else 'standard' end,
  'items',coalesce(jsonb_agg(jsonb_build_object('property_id',v->'property_id','address',v->'address','city',v->'city',
   'postal_code',v->'postal_code','is_parkland',v->'is_parkland','property_type',v->'property_type',
   'market_value',v->'market_value','values_under_review',v->'values_under_review') order by n) filter(where n<=20),'[]'::jsonb),
  'has_more',jsonb_array_length(matches)>20 and p_page<249,'limit_reached',jsonb_array_length(matches)>20 and p_page=249)
 into result from jsonb_array_elements(matches) with ordinality e(v,n);
 return result || (select jsonb_build_object('tax_year',tax_year,'roll_stage',roll_stage,'export_time_raw',export_time_raw)
  from public.property_releases where dataset_id=release_id);
end $$;
notify pgrst,'reload schema';

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

  with candidates as (
    select d.* from public.property_search_documents d
    where d.dataset_id = release_id and d.property_id = ltrim(q, '0')
    union all
    select d.* from public.property_search_documents d
    where d.dataset_id = release_id and house_part is not null
      and d.search_text collate "C" >= house_part || ' '
      and d.search_text collate "C" < house_part || '!'
      and d.property_id <> ltrim(q, '0')
    union all
    select d.* from public.property_search_documents d
    where d.dataset_id = release_id and house_part is null
      and d.search_text like '%' || q || '%'
      and d.property_id <> ltrim(q, '0')
  ), selected as (
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
    from candidates d
    where (p_show_all or not d.is_parkland or d.property_id = ltrim(q, '0'))
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
