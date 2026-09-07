-- Keep publisher clocks, ZIP clocks, acquisition observations and processing
-- history distinct. Unknown timezones/dates stay unknown.
alter table tcad_ingest.datasets
  add column export_run_time_raw text generated always as (header ->> 'run_date_time') stored,
  add column supplement_number_raw text generated always as (header ->> 'supplement_number') stored;
alter table tcad_ingest.files
  add column zip_modified_raw jsonb,
  add column zip_modified_local timestamp without time zone;

create table tcad_ingest.acquisitions (
  receipt_sha256 text primary key check (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  archive_sha256 text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  source_url text not null,
  download_started_at timestamptz not null,
  downloaded_at timestamptz not null,
  publisher_published_on date,
  publication_evidence text,
  http_last_modified_raw text,
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  recorded_at timestamptz not null default clock_timestamp(),
  check (downloaded_at >= download_started_at),
  check ((publisher_published_on is null) = (publication_evidence is null))
);
create index acquisitions_archive_idx on tcad_ingest.acquisitions(archive_sha256, downloaded_at);

-- Both tables are append-only for the loader. A failed or repeated invocation
-- gets a new attempt; earlier outcomes cannot be rewritten by retry.
create table tcad_ingest.import_attempts (
  id uuid primary key,
  started_at timestamptz not null default clock_timestamp(),
  source_url text not null,
  archive_filename text not null,
  tax_year integer not null,
  roll_stage text not null,
  parser_version text not null,
  source_encoding text not null
);
create table tcad_ingest.import_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references tcad_ingest.import_attempts(id),
  occurred_at timestamptz not null default clock_timestamp(),
  event_type text not null check (event_type in ('archive_verified','dataset_selected','succeeded','failed')),
  dataset_id uuid references tcad_ingest.datasets(id),
  acquisition_receipt_sha256 text references tcad_ingest.acquisitions(receipt_sha256),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);
create index import_events_attempt_idx on tcad_ingest.import_events(attempt_id, id);
create index import_events_dataset_idx on tcad_ingest.import_events(dataset_id) where dataset_id is not null;
create index import_events_acquisition_idx on tcad_ingest.import_events(acquisition_receipt_sha256)
where acquisition_receipt_sha256 is not null;
create unique index import_events_terminal_idx on tcad_ingest.import_events(attempt_id)
where event_type in ('succeeded','failed');

alter table tcad_ingest.acquisitions enable row level security;
alter table tcad_ingest.import_attempts enable row level security;
alter table tcad_ingest.import_events enable row level security;
create policy loader_acquisitions on tcad_ingest.acquisitions to tcad_loader using (true) with check (true);
create policy loader_attempts on tcad_ingest.import_attempts to tcad_loader using (true) with check (true);
create policy loader_events on tcad_ingest.import_events to tcad_loader using (true) with check (true);
revoke all on tcad_ingest.acquisitions, tcad_ingest.import_attempts, tcad_ingest.import_events
from public, anon, authenticated, service_role;
grant select, insert on tcad_ingest.acquisitions, tcad_ingest.import_attempts, tcad_ingest.import_events to tcad_loader;
grant usage on sequence tcad_ingest.import_events_id_seq to tcad_loader;

create view tcad_ingest.import_history with (security_invoker = true) as
select a.*, coalesce(terminal.event_type,'unfinished') as outcome,
       terminal.occurred_at as finished_at, terminal.details as outcome_details,
       selected.dataset_id, verified.acquisition_receipt_sha256,
       verified.details ->> 'archive_sha256' as archive_sha256
from tcad_ingest.import_attempts a
left join lateral (select e.* from tcad_ingest.import_events e where e.attempt_id=a.id
  and e.event_type in ('succeeded','failed') order by e.id desc limit 1) terminal on true
left join lateral (select e.dataset_id from tcad_ingest.import_events e where e.attempt_id=a.id
  and e.event_type='dataset_selected' order by e.id desc limit 1) selected on true
left join lateral (select e.* from tcad_ingest.import_events e where e.attempt_id=a.id
  and e.event_type='archive_verified' order by e.id desc limit 1) verified on true;
grant select on tcad_ingest.import_history to tcad_loader;

-- One row per acquired observation of a release; a release without a receipt
-- still appears with unknown download/publication fields.
create view tcad_ingest.release_chronology with (security_invoker = true) as
select d.id as dataset_id, d.tax_year, d.roll_stage, d.supplement_number_raw,
       d.export_run_time_raw, d.archive_sha256, d.source_url,
       a.receipt_sha256, a.publisher_published_on, a.publication_evidence,
       a.download_started_at, a.downloaded_at, a.http_last_modified_raw,
       d.created_at as first_import_registered_at, d.status
from tcad_ingest.datasets d
left join tcad_ingest.acquisitions a on a.archive_sha256 = d.archive_sha256;
grant select on tcad_ingest.release_chronology to tcad_loader;
