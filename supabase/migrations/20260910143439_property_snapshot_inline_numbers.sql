-- This pure expression references only pg_catalog and is safe to inline in the
-- administrator publisher (whose search_path is empty). Avoid per-field GUC pushes.
create or replace function tcad_ingest.profile_number(value text) returns numeric
language sql immutable strict as $$
 select case when pg_catalog.btrim(value) operator(pg_catalog.~) '^-?[0-9]+([.][0-9]+)?$'
 then pg_catalog.btrim(value)::numeric end
$$;
revoke all on function tcad_ingest.profile_number(text) from public,anon,authenticated,service_role,tcad_loader;
