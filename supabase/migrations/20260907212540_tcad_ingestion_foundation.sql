-- Private, comprehensive source ingestion. No homeowner API access is granted.
create schema tcad_ingest;
revoke all on schema tcad_ingest from public, anon, authenticated, service_role;
create role tcad_loader nologin;
grant usage on schema tcad_ingest to tcad_loader;

create table tcad_ingest.datasets (
  id uuid primary key,
  archive_sha256 text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  layout_sha256 text not null check (layout_sha256 ~ '^[0-9a-f]{64}$'),
  parser_version text not null,
  source_encoding text not null check (source_encoding in ('ascii','utf-8','cp1252')),
  tax_year integer not null check (tax_year between 1900 and 2200),
  roll_stage text not null check (roll_stage in ('preliminary','certified','supplemental')),
  source_url text not null,
  archive_location text not null,
  header jsonb not null check (jsonb_typeof(header) = 'object'),
  status text not null default 'loading' check (status in ('loading','ready','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (archive_sha256, layout_sha256, parser_version, source_encoding),
  check (status <> 'ready' or completed_at is not null)
);
create table tcad_ingest.files (
  dataset_id uuid not null references tcad_ingest.datasets(id),
  member_name text not null,
  record_type text,
  uncompressed_bytes bigint not null check (uncompressed_bytes >= 0),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  row_count bigint not null default 0 check (row_count >= 0),
  status text not null default 'loading' check (status in ('loading','complete')),
  primary key (dataset_id, member_name),
  check (status <> 'complete' or sha256 is not null)
);
create table tcad_ingest.records (
  dataset_id uuid not null,
  member_name text not null,
  row_number bigint not null check (row_number > 0),
  prop_id text,
  prop_val_yr text,
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  primary key (dataset_id, member_name, row_number),
  foreign key (dataset_id, member_name) references tcad_ingest.files(dataset_id, member_name)
);
-- Source row identity preserves duplicate property/owner records and leading zeros.
create index records_property_idx on tcad_ingest.records(dataset_id, prop_id)
where prop_id is not null;
create index files_type_idx on tcad_ingest.files(dataset_id, record_type);

alter table tcad_ingest.datasets enable row level security;
alter table tcad_ingest.files enable row level security;
alter table tcad_ingest.records enable row level security;
create policy loader_datasets on tcad_ingest.datasets to tcad_loader using (true) with check (true);
create policy loader_files on tcad_ingest.files to tcad_loader using (true) with check (true);
create policy loader_records on tcad_ingest.records to tcad_loader using (true) with check (true);
grant select, insert, update on tcad_ingest.datasets, tcad_ingest.files to tcad_loader;
grant select, insert on tcad_ingest.records to tcad_loader;
revoke all on all tables in schema tcad_ingest from public, anon, authenticated, service_role;

create view tcad_ingest.header with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Header' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.header to tcad_loader;

create view tcad_ingest.property with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Property' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.property to tcad_loader;

create view tcad_ingest.property_entity with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'PropertyEntity' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.property_entity to tcad_loader;

create view tcad_ingest.entity_totals with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'EntityTotals' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.entity_totals to tcad_loader;

create view tcad_ingest.abstract_subdivision with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'AbstractSubdivision' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.abstract_subdivision to tcad_loader;

create view tcad_ingest.state_code with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'StateCode' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.state_code to tcad_loader;

create view tcad_ingest.arb with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'ARB' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.arb to tcad_loader;

create view tcad_ingest.entity with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Entity' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.entity to tcad_loader;

create view tcad_ingest.mobile_home with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'MobileHome' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.mobile_home to tcad_loader;

create view tcad_ingest.agent with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Agent' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.agent to tcad_loader;

create view tcad_ingest.lawsuit with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Lawsuit' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.lawsuit to tcad_loader;

create view tcad_ingest.arbitration with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Arbitration' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.arbitration to tcad_loader;

create view tcad_ingest.improvement with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Improvement' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.improvement to tcad_loader;

create view tcad_ingest.improvement_detail with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'ImprovementDetail' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.improvement_detail to tcad_loader;

create view tcad_ingest.improvement_detail_attributes with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'ImprovementDetailAttributes' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.improvement_detail_attributes to tcad_loader;

create view tcad_ingest.land_detail with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'LandDetail' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.land_detail to tcad_loader;

create view tcad_ingest.deferral with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Deferral' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.deferral to tcad_loader;

create view tcad_ingest.country_code with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'CountryCode' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.country_code to tcad_loader;

create view tcad_ingest.sketches with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'Sketches' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.sketches to tcad_loader;

create view tcad_ingest.sb12 with (security_invoker = true) as
select r.* from tcad_ingest.records r
join tcad_ingest.files f using (dataset_id, member_name)
join tcad_ingest.datasets d on d.id = r.dataset_id
where f.record_type = 'SB12' and f.status = 'complete' and d.status = 'ready';
grant select on tcad_ingest.sb12 to tcad_loader;
