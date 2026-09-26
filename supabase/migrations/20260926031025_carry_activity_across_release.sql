-- Activity is curated against a search release. Preserve its recorded source
-- dates and visibility rules when the administrator publishes a new release.
-- A later reviewed activity import may rebuild this projection for that anchor.
create function tcad_ingest.carry_forward_property_activity(p_from uuid,p_to uuid) returns integer
 language plpgsql security definer set search_path='' set statement_timeout='30s' as $$
declare copied integer;
begin
 if p_from is null or p_to is null or p_from=p_to then return 0; end if;
 if not exists(select 1 from public.property_search_state where dataset_id=p_to) then
  raise exception 'Activity target is not the active search release';
 end if;
 insert into public.property_activity_releases
 (anchor_dataset_id,activity_year,appraisal_export_date,sales_export_date,import_id,published_at)
 select p_to,r.activity_year,r.appraisal_export_date,r.sales_export_date,r.import_id,now()
 from public.property_activity_releases r where r.anchor_dataset_id=p_from
 on conflict(anchor_dataset_id,activity_year) do nothing;

 insert into public.property_activity
 (anchor_dataset_id,activity_year,property_id,event_key,deed_date,sale_date,filed_date,instrument,
  deed_type,sale_type,sale_source,status,price,price_status,match_method,deed_source)
 select p_to,a.activity_year,a.property_id,a.event_key,a.deed_date,a.sale_date,a.filed_date,a.instrument,
  a.deed_type,a.sale_type,a.sale_source,a.status,a.price,a.price_status,a.match_method,a.deed_source
 from public.property_activity a join public.property_search_documents d
  on d.dataset_id=p_to and d.property_id=a.property_id
 where a.anchor_dataset_id=p_from and not d.shared_ownership and not d.values_under_review and not d.is_parkland
 on conflict(anchor_dataset_id,activity_year,property_id,event_key) do nothing;
 get diagnostics copied=row_count;
 return copied;
end $$;
revoke all on function tcad_ingest.carry_forward_property_activity(uuid,uuid) from public,anon,authenticated,service_role,tcad_loader;

create function tcad_ingest.carry_activity_on_release_switch() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.dataset_id is distinct from old.dataset_id then
  perform tcad_ingest.carry_forward_property_activity(old.dataset_id,new.dataset_id);
 end if;
 return new;
end $$;
revoke all on function tcad_ingest.carry_activity_on_release_switch() from public,anon,authenticated,service_role,tcad_loader;
create trigger carry_activity_on_release_switch after update of dataset_id on public.property_search_state
 for each row execute function tcad_ingest.carry_activity_on_release_switch();
