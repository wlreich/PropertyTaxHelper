-- PAR-38: one bounded request for the complete activity set, using the same
-- published snapshots and scoped cost helper as the comparison page.
create function public.property_activity_match_inputs(p_id text,p_source uuid,p_ids text[])
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='10s' as $$
declare anchor uuid; ids text[]; batch text[]; chunks jsonb:='[]'; items jsonb; chunk jsonb;
begin
 if p_id is null or p_id !~ '^[0-9]{1,12}$' or p_source is null or p_ids is null or cardinality(p_ids)>50000
  or exists(select 1 from unnest(p_ids) x where x is null or x !~ '^[0-9]{1,12}$') then
  raise exception 'Invalid matching parameters' using errcode='22023'; end if;
 select dataset_id into anchor from public.property_search_state where singleton;
 if anchor is null or not exists(select 1 from public.property_snapshot_profiles s
  join public.property_search_documents d on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
  where s.anchor_dataset_id=anchor and s.dataset_id=p_source and s.property_id=ltrim(p_id,'0')
   and not d.shared_ownership and not d.values_under_review and not d.is_parkland) then
  return jsonb_build_object('available',false); end if;
 select array_agg(distinct ltrim(x,'0') order by ltrim(x,'0')) into ids from unnest(p_ids||array[p_id]) x;
 select coalesce(jsonb_agg(public.property_comparison_item(d.property_id,d.address,d.city,d.property_type,s.snapshot) order by d.property_id),'[]') into items
 from public.property_snapshot_profiles s join public.property_search_documents d
 on d.dataset_id=s.anchor_dataset_id and d.property_id=s.property_id
 where s.anchor_dataset_id=anchor and s.dataset_id=p_source and s.property_id=any(ids)
 and not d.shared_ownership and not d.values_under_review and not d.is_parkland;
 -- Preserve the existing 32-ID cost limit and its visibility gates. No new
 -- definer privileges or raw ingestion access are introduced by this wrapper.
 for i in 0..(cardinality(ids)-1)/32 loop
  batch:=ids[i*32+1:least(i*32+32,cardinality(ids))];
  chunk:=public.property_comparison_costs(anchor,p_source,batch);
  chunks:=chunks||jsonb_build_array(chunk);
 end loop;
 return jsonb_build_object('available',true,'anchor_id',anchor,'source_id',p_source,'subject_id',ltrim(p_id,'0'),'items',items,'cost_chunks',chunks);
end $$;
revoke all on function public.property_activity_match_inputs(text,uuid,text[]) from public;
grant execute on function public.property_activity_match_inputs(text,uuid,text[]) to anon,authenticated;
