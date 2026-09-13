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
 -- Materialize the candidates before parsing each address; the existing GIN index
 -- supplies substring candidates, including numeric ordinals in either format.
 with candidates as materialized (
  select d.* from public.property_search_documents d where d.dataset_id=release_id
   and (p_show_all or not d.is_parkland or d.property_id=ltrim(q,'0'))
   and (d.property_id=ltrim(q,'0') or (
    (parts->>'house' is not null and d.search_text like anchor||' %') or
    (parts->>'house' is null and d.search_text like '%'||anchor||'%'
     and (anchor !~ '^[0-9]+$' or d.search_text ~ ('(^| )'||anchor||'(ST|ND|RD|TH)?( |$)')))))
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
    and (p_show_all or not d.is_parkland)
    and (parts->>'house' is null or d.search_text like (parts->>'house')||' %')
    and (parts->>'house' is not null or d.search_text operator(extensions.%>) fuzzy_anchor)
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
