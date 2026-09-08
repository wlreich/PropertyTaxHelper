-- Browser downloads do not provide machine-observed source download timestamps.
-- Keep them unknown rather than substituting the later storage retrieval time.
alter table tcad_ingest.acquisitions
  alter column download_started_at drop not null,
  alter column downloaded_at drop not null;

alter table tcad_ingest.acquisitions add constraint acquisition_download_evidence
check (
  (coalesce(receipt ->> 'version', '') = '1'
    and download_started_at is not null and downloaded_at is not null)
  or
  (coalesce(receipt ->> 'version', '') = '2'
    and coalesce(receipt ->> 'acquisition_method', '') = 'manual_upload'
    and download_started_at is null and downloaded_at is null)
);

-- Existing columns and permissions stay in place; new evidence is appended.
create or replace view tcad_ingest.release_chronology with (security_invoker = true) as
select d.id as dataset_id, d.tax_year, d.roll_stage, d.supplement_number_raw,
       d.export_run_time_raw, d.archive_sha256, d.source_url,
       a.receipt_sha256, a.publisher_published_on, a.publication_evidence,
       a.download_started_at, a.downloaded_at, a.http_last_modified_raw,
       d.created_at as first_import_registered_at, d.status,
       case when a.receipt_sha256 is not null then
         coalesce(a.receipt ->> 'acquisition_method', 'direct_download') end as acquisition_method,
       a.receipt ->> 'browser_downloaded_on_reported' as browser_downloaded_on_reported,
       a.receipt ->> 'storage_uploaded_at' as storage_uploaded_at,
       a.receipt ->> 'storage_retrieval_started_at' as storage_retrieval_started_at,
       a.receipt ->> 'storage_retrieved_at' as storage_retrieved_at,
       a.receipt ->> 'uploaded_object_uri' as uploaded_object_uri
from tcad_ingest.datasets d
left join tcad_ingest.acquisitions a on a.archive_sha256 = d.archive_sha256;
