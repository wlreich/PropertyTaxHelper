-- Keep the numeric parser private and give it a fixed search path.
-- PL/pgSQL caches the expression without per-call SQL planning.
create or replace function tcad_ingest.profile_number(value text) returns numeric
language plpgsql immutable strict set search_path='' as $$
begin
 if trim(value) ~ '^-?[0-9]+([.][0-9]+)?$' then return trim(value)::numeric; end if;
 return null;
end $$;
revoke all on function tcad_ingest.profile_number(text) from public,anon,authenticated,service_role,tcad_loader;
