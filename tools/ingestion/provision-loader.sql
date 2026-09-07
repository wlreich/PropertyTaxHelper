-- Run once in the Supabase SQL editor, after replacing the placeholder locally.
-- Choose a NEW password with at least 32 letters/digits. Never paste it in chat.
-- This is operational login provisioning, not a schema migration.
begin;
do $setup$
declare
  job_password text := 'REPLACE_WITH_A_NEW_32_OR_MORE_CHARACTER_PASSWORD';
begin
  if job_password like 'REPLACE_%' or length(job_password) < 32 then
    raise exception 'Replace the password placeholder locally before running';
  end if;
  if exists(select 1 from pg_roles where rolname='tcad_ingestion_job') then
    raise exception 'The login already exists; do not overwrite credentials';
  end if;
  execute format('create role tcad_ingestion_job login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls connection limit 3 password %L',job_password);
end
$setup$;
grant tcad_loader to tcad_ingestion_job;
-- Read only this bucket's settings to reject public or undersized archive buckets.
grant usage on schema storage to tcad_loader;
grant select(id, public, file_size_limit) on storage.buckets to tcad_loader;
create policy tcad_loader_archive_bucket_metadata on storage.buckets
for select to tcad_loader using (id='tcad-archives');
commit;
