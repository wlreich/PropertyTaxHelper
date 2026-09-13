-- Address-aware matching over the existing public, privacy-filtered projection.
-- Allow public search to resolve the installed trigram operator; no table access is added.
grant usage on schema extensions to anon,authenticated;
-- Keep the ingestion normalizer unchanged: existing and future search_text agree.
create or replace function public.search_address_parts(input text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare
 t text[]:=string_to_array(public.normalize_property_address(replace(input,'#',' UNIT ')),' ');
 h text; u text; dir text; suffix text; pos integer; i integer;
 suffixes constant text[]:=array['ST','RD','AVE','BLVD','DR','LN','CT','CIR','TRL','PKWY','HWY','PL','TER','WAY','LOOP','CV'];
begin
 pos:=array_position(t,'UNIT');
 if pos is not null then u:=array_to_string(t[pos+1:cardinality(t)],' '); t:=t[1:pos-1]; end if;
 if t[1] ~ '^[0-9]+[A-Z]?$' and (cardinality(t)=1 or not(t[2]=any(suffixes))) then h:=t[1]; t:=t[2:cardinality(t)]; end if;
 if cardinality(t)>1 and t[1]=any(array['N','S','E','W','NE','NW','SE','SW']) then dir:=t[1]; t:=t[2:cardinality(t)]; end if;
 if cardinality(t)>1 and t[cardinality(t)]=any(array['N','S','E','W','NE','NW','SE','SW']) then
  dir:=coalesce(dir,t[cardinality(t)]); t:=t[1:cardinality(t)-1];
 end if;
 if cardinality(t)>1 and t[cardinality(t)]=any(suffixes) then suffix:=t[cardinality(t)]; t:=t[1:cardinality(t)-1]; end if;
 for i in 1..coalesce(cardinality(t),0) loop t[i]:=regexp_replace(t[i],'^([0-9]+)(ST|ND|RD|TH)$','\1'); end loop;
 return jsonb_build_object('house',h,'unit',u,'direction',dir,'suffix',suffix,'street',to_jsonb(coalesce(t,array[]::text[])));
end $$;

-- Exactly one insertion, deletion, substitution, or adjacent transposition.
-- Never apply to identifiers, short words, or strings containing digits.
create or replace function public.search_one_typo(a text,b text) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare i integer:=1; la integer:=length(a); lb integer:=length(b);
begin
 if a !~ '^[A-Z]{5,}$' or b !~ '^[A-Z]{5,}$' or abs(la-lb)>1 or a=b then return false; end if;
 while i<=least(la,lb) and substr(a,i,1)=substr(b,i,1) loop i:=i+1; end loop;
 if la=lb then
  return substr(a,i+1)=substr(b,i+1) or
   (substr(a,i,1)=substr(b,i+1,1) and substr(a,i+1,1)=substr(b,i,1) and substr(a,i+2)=substr(b,i+2));
 elsif la>lb then return substr(a,i+1)=substr(b,i);
 else return substr(a,i)=substr(b,i+1); end if;
end $$;

create or replace function public.search_address_rank(input text,address text,city text,zip text,allow_typo boolean default false) returns integer
language plpgsql immutable security invoker set search_path='' as $$
declare q text:=public.normalize_property_address(replace(input,'#',' UNIT ')); c text:=public.normalize_property_address(city);
 qp jsonb; dp jsonb:=public.search_address_parts(address); qt text[]; dt text[]; token text; candidate text;
 score integer:=0; typos integer:=0; matched boolean; idx integer; used integer[]:=array[]::integer[];
begin
 -- City and ZIP are optional, but when supplied must agree with the record.
 if nullif(zip,'') is not null and q like '% '||zip then q:=left(q,length(q)-length(zip)-1); end if;
 if nullif(c,'') is not null and q like '% '||c then q:=left(q,length(q)-length(c)-1); end if;
 qp:=public.search_address_parts(q);
 foreach token in array array['house','unit'] loop
  if qp->>token is not null and (qp->>token) is distinct from (dp->>token) then return null; end if;
 end loop;
 foreach token in array array['direction','suffix'] loop
  if qp->>token is not null then
   if dp->>token is null then score:=score+case when token='direction' then 3 else 2 end;
   elsif (qp->>token)<>(dp->>token) then return null; end if;
  end if;
 end loop;
 select coalesce(array_agg(value),array[]::text[]) into qt from jsonb_array_elements_text(qp->'street');
 select coalesce(array_agg(value),array[]::text[]) into dt from jsonb_array_elements_text(dp->'street');
 if cardinality(qt)=0 and qp->>'house' is null then return null; end if;
 foreach token in array qt loop
  matched:=false;
  for idx in 1..cardinality(dt) loop
   if idx=any(used) then continue; end if;
   candidate:=dt[idx];
   if token=candidate or (token ~ '^[A-Z]{3,}$' and candidate like token||'%') then
    used:=array_append(used,idx); matched:=true;
    if token<>candidate then score:=score+1; end if;
    exit;
   end if;
  end loop;
  if not matched and allow_typo and typos=0 then
   for idx in 1..cardinality(dt) loop
    if not(idx=any(used)) and public.search_one_typo(token,dt[idx]) then
     used:=array_append(used,idx); matched:=true; typos:=1; exit;
    end if;
   end loop;
  end if;
  if not matched then return null; end if;
 end loop;
 return score+typos*10+case when cardinality(qt)=cardinality(dt) then 0 else 1 end;
end $$;

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
   and (d.property_id=ltrim(q,'0') or d.search_text like '%'||anchor||'%')
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
revoke all on function public.search_address_parts(text),public.search_one_typo(text,text),public.search_address_rank(text,text,text,text,boolean) from public;
grant execute on function public.search_address_parts(text),public.search_one_typo(text,text),public.search_address_rank(text,text,text,text,boolean) to anon,authenticated;
revoke all on function public.search_property_parcels_v2(text,integer,boolean) from public;
grant execute on function public.search_property_parcels_v2(text,integer,boolean) to anon,authenticated;
notify pgrst,'reload schema';
