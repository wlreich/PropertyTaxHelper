-- A selective observation set must not share identity or retry progress with
-- a full valuation release from the same source ZIP. Existing releases stay full.
alter table tcad_ingest.datasets add column import_scope text not null default 'full'
  check (import_scope in ('full','protests'));
alter table tcad_ingest.import_attempts add column import_scope text not null default 'full'
  check (import_scope in ('full','protests'));

alter table tcad_ingest.datasets add constraint datasets_scoped_source_key
  unique (archive_sha256,layout_sha256,parser_version,source_encoding,import_scope);
do $$
declare old_key name;
begin
  select c.conname into strict old_key from pg_constraint c
  where c.conrelid='tcad_ingest.datasets'::regclass and c.contype='u'
    and (select array_agg(a.attname::text order by k.ordinality)
         from unnest(c.conkey) with ordinality k(attnum,ordinality)
         join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)
        = array['archive_sha256','layout_sha256','parser_version','source_encoding'];
  execute format('alter table tcad_ingest.datasets drop constraint %I',old_key);
end $$;

comment on column tcad_ingest.datasets.import_scope is
  'full: complete valuation export; protests: Header, Property, ARB and Agent only. Independent of publisher roll_stage.';
-- All data remains in the existing private schema under unchanged RLS/grants.
-- Public valuation publishers still require 20 completed text files and reject
-- the four-file protest datasets. No release is activated by this migration.
