-- Private, additive source observations. No public access or raw property payloads.
create table tcad_ingest.activity_imports (
 id uuid primary key, dataset_id uuid not null references tcad_ingest.datasets(id),
 archive_sha256 text not null check(archive_sha256 ~ '^[0-9a-f]{64}$'),
 member_name text not null, export_date date not null,
 activity_year integer not null check(activity_year between 1900 and 2200),
 parser_version text not null, property_count integer not null check(property_count>=0),
 observation_count integer not null check(observation_count>=0),
 observations_sha256 text not null check(observations_sha256 ~ '^[0-9a-f]{64}$'),
 summary jsonb not null, status text not null check(status in('loading','complete')),
 created_at timestamptz not null default now(), completed_at timestamptz,
 unique(dataset_id,activity_year,parser_version),
 check((status='complete')=(completed_at is not null))
);
create table tcad_ingest.activity_observations (
 run_id uuid not null references tcad_ingest.activity_imports(id),
 property_id text not null check(property_id ~ '^[1-9][0-9]{0,11}$'),
 kind text not null check(kind in('deed','sale')),
 event_id text not null check(event_id ~ '^[1-9][0-9]{0,11}$'),
 deed_id text, event_date date, date_raw text not null, filed_date date,
 instrument text, type_code text, qualification text, source_of_sale text,
 sale_price numeric(18,2) check(sale_price>0), adjusted_price numeric(18,2) check(adjusted_price>0),
 confidential boolean, confidential_code text, suppressed boolean, suppression_code text,
 multi_property boolean, associated_properties text[] not null,
 quarantine_reason text check(quarantine_reason in('invalid_date','future_date')),
 primary key(run_id,property_id,kind,event_id),
 check(property_id=any(associated_properties)),
 check(event_date is not null or quarantine_reason='invalid_date'),
 check(kind='sale' or (sale_price is null and adjusted_price is null))
);
create index activity_observations_property on tcad_ingest.activity_observations(property_id,run_id);
alter table tcad_ingest.activity_imports enable row level security;
alter table tcad_ingest.activity_observations enable row level security;
revoke all on tcad_ingest.activity_imports,tcad_ingest.activity_observations from public,anon,authenticated;
-- Reuse the dedicated importer role without expanding access to other tables.
grant select,insert,update on tcad_ingest.activity_imports to tcad_loader;
grant select,insert on tcad_ingest.activity_observations to tcad_loader;
create policy activity_imports_loader on tcad_ingest.activity_imports to tcad_loader using(true) with check(true);
create policy activity_observations_loader on tcad_ingest.activity_observations to tcad_loader using(true) with check(true);
