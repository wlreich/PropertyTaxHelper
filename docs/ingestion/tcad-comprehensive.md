# Comprehensive TCAD ingestion

## Scope

Ingest every documented source field from all 20 text members, including owner/contact fields, taxing entities, exemptions, improvements, land, sketches, protests, lawsuits, arbitration, mobile homes, deferrals, and SB12. Binary PDFs remain in the complete archived ZIP and receive their own checksum in the manifest.

This is the private source layer. It is not a public property-search API or an appraisal model. No source field is silently discarded because the first website screen does not use it.

## Database objects

| Object | Purpose |
| --- | --- |
| `tcad_ingest.datasets` | Immutable release identity: archive/layout checksums, parser version, encoding, year, roll stage, source URL, archive location, header metadata, completion status |
| `tcad_ingest.files` | Every ZIP member, its checksum, uncompressed bytes, row count, record type and completion status |
| `tcad_ingest.records` | Every text row, source row number, indexed property ID/year where supplied, and every nonblank field as text in JSONB |
| 20 views, including `property`, `property_entity`, `improvement`, `improvement_detail`, `land_detail`, `sketches`, and `sb12` | Convenient per-file access that exposes only fully completed datasets |

All objects are in the private `tcad_ingest` schema. RLS is enabled on the tables. Website roles (`anon`, `authenticated`, `service_role`) receive no access. The migration creates a `tcad_loader` role with no login and narrowly scoped ingestion privileges; an operator must provision a separate login inheriting that role. Do not expose this schema in Supabase's Data API. Owner identities and addresses belong in this restricted source layer, not logs or public endpoints.

The `fields` object keeps source values as strings, including identifiers with leading zeros. Surrounding whitespace is trimmed and blank fields are omitted. Original whitespace, blank slots, exact record bytes, PDFs and line endings remain recoverable from the archived ZIP. Repeated filler labels have position-specific keys in the layout map. Sketch JSON is preserved as source text, without an assumed feature interpretation.

A source row is identified by dataset, member and row number. Duplicate property IDs are retained, including multiple-owner rows. No unconfirmed owner-key relationship is enforced. A neighborhood code is not labeled a market area, and no living-area/condition rules are inferred. Typed analytics tables and homeowner-facing projections can be added separately without losing source data.

## Source and layout provenance

TCAD's [public information page](https://traviscad.org/publicinformation), checked 2026-09-07, links:

- [Certified July 2026 export](https://traviscad.org/wp-content/largefiles/2026%20Certified%20Appraisal%20Export%20Supp%200_07182026.zip)
- [Supplemental export](https://traviscad.org/wp-content/largefiles/travis_SUPP%20333_2026_WEBSITE%20EXPORT_Renamed.zip)
- [Legacy8.0.33 layout archive](https://traviscad.org/wp-content/largefiles/Website_Legacy8.0.33-AppraisalExportLayout_06182026.zip)

The pinned `tools/ingestion/tcad-layout.json` contains all 20 worksheets and 1,030 field positions. It was compiled from Wendy's saved `Legacy8.0.33-AppraisalExportLayout.xlsx`, SHA-256 `23379b8abef57886a7b6204bab952de7a4535b211a437d9483882dfdf288ed6b`. That workbook's fixed record lengths agree with the repository's earlier preliminary-export analysis. The current ZIP download was denied to this execution environment; byte-for-byte equivalence with today's linked workbook has not been asserted.

The parser accepts header export version `8.0.0.33` and checks every fixed record's byte length and every tab record's field count. Before the first real load, validate the chosen full archive and confirm that the currently published layout matches this pinned map. Structural checks are not a substitute for comparing changed field definitions. A new layout requires a reviewed map and therefore a new layout hash; it never silently replaces a prior dataset's interpretation.

The older preliminary package is a separate release. Roll stage is supplied explicitly from the publisher's label and is never inferred from supplement number zero. Certified and supplemental files must not overwrite each other.

## Operator workflow

The importer runs as a Python job outside the Vercel website. It uses a direct or session-pooler PostgreSQL connection, not a publishable API key or a transaction-pooler connection. Session affinity is required for its advisory lock. No schedule or cloud worker has been provisioned by this change.

1. Review and apply the committed `tcad_ingestion_foundation` and `tcad_source_chronology` migrations in order. Ensure migration versions in Git and Supabase agree before using CLI migration push. PR #7 separately reconciles the earlier database-health migration.
2. Provision the ingestion login inheriting `tcad_loader`, with credentials held by the ingestion job. Set `TCAD_DATABASE_URL` with TLS enabled (`sslmode=require` or stronger). Never paste or commit that connection string, or give it to browser code.
3. Download the complete chosen official ZIP to a private location. Retain a copy on durable private storage. The implemented archive store is a filesystem directory on a persistent volume; this PR does not upload to Supabase Storage, R2, or another cloud bucket. A temporary workstation/runner directory is not a durable archive.
4. Validate the complete archive with the command below. This reads all members, verifies ZIP member CRCs and layout structure, and reports only aggregate metadata and checksums. It makes no database connection.

```sh
python tools/ingestion/ingest_tcad.py \
  --archive /private/downloads/tcad-2026-certified.zip \
  --year 2026 --roll-stage certified \
  --source-url 'https://traviscad.org/wp-content/largefiles/2026%20Certified%20Appraisal%20Export%20Supp%200_07182026.zip'
```

5. Review validation output, available database capacity and the intended target database. The older preliminary archive expands to about 18 GB; full JSONB rows and indexes have different storage requirements. Do not assume the initial Supabase disk allocation will fit a comprehensive county load. Plan capacity before authorizing the first full load; synthetic tests are not a storage benchmark.
6. Install the pinned driver in the job's virtual environment: `python -m pip install -r tools/ingestion/requirements.txt`. Set `TCAD_DATABASE_URL` securely, then repeat the command with `--load --expected-sha256 <checksum-from-approved-validation> --archive-store /persistent/private/tcad`.

`--load` first retains the complete ZIP under its content hash, refusing to overwrite conflicting bytes. All original files, including PDFs, are retained. The importer then loads every documented row through bounded, pipelined INSERT batches that respect row-level security. The parser streams records and flushes a batch at 100 rows or approximately 1 MiB of field text; an individual sketch can be larger. The default fixed-width encoding is ASCII, matching the previously profiled release. A reviewed alternative can be selected with `--encoding utf-8` or `--encoding cp1252`; tab-delimited members use UTF-8.

## Failure and retry behavior

Each file is one database transaction. Parse, encoding, CRC or database failure rolls back that file. Previously completed files remain staged, and the dataset is marked failed. A process termination may leave status loading; either state is hidden by the per-file views. Retry with the identical archive, layout, encoding and command to skip already committed files. An advisory lock prevents two loaders processing the same release simultaneously. No property-level deduplication occurs.

Once every text member and PDF completes, the dataset becomes ready. In this context ready means fully ingested, not approved for public comparisons. The importer does not validate appraisal totals or infer property-to-UDI/owner business relationships.

The importer rejects missing documented files, unknown file types, duplicate members, unsupported header versions, wrong years, malformed records and checksum mismatches. It retains failed archives for diagnosis. Failures are reported without row contents or connection strings. No bulk deletion or replacement is implemented.

## Validation

Fourteen parser/archive/chronology unit tests pass. The loader integration check also passes against PGlite through its PostgreSQL socket adapter, with test-only adjustments for the adapter’s shared-session/prepared-statement limitations. It verifies a failed file after a batch was inserted, rollback, resume, repeat loading, restricted-role writes and private views. A native PostgreSQL run could not start in this environment because only the root OS user is mapped; hosted Supabase and full-size ingestion remain unverified.

```sh
python -m unittest discover -s tools/ingestion/tests -v
```

The synthetic fixtures cover all 1,030 mapped fields, all 20 text members, PDFs, repeated filler names, leading-zero IDs, tab handling, large UTF-8 sketches, missing files, invalid widths/encoding, bad years/versions and archive retention.

`tests/integration_check.py` additionally exercises real psycopg inserts under the restricted loader role, per-file rollback, resumable loading, duplicate prevention, RLS permissions and ready-only views against a disposable local PostgreSQL database. It requires `TCAD_TEST_DATABASE_URL` pointing to localhost and the migration already applied; it refuses remote database URLs.

The first real county archive, throughput, disk requirements, long-running worker, durable cloud archive storage and production credentials remain activation work. No real property records have been loaded by this PR.


## Source chronology and import audit

The chronology migration adds three private tables (`acquisitions`, `import_attempts`, `import_events`) and the `release_chronology` and `import_history` views. These tables are append-only for the loader: it cannot update or delete historical observations or outcomes. All use RLS and remain inaccessible to website roles.

| Clock or version | Storage and interpretation |
| --- | --- |
| Tax year, roll stage, supplement | Separate release identifiers; supplement retains original text |
| TCAD export run date/time | `datasets.export_run_time_raw`, generated from the preserved header; no guessed format or timezone |
| Publisher publication date | `acquisitions.publisher_published_on` is a date, with mandatory `publication_evidence`; unknown stays NULL |
| HTTP Last-Modified | Raw response header kept separately; it is not treated as a publication date |
| Download start/completion | Explicit offset-bearing timestamps in the receipt; stored as `timestamptz`, independent of import time |
| ZIP member modification | Original six-part timestamp plus `timestamp without time zone`; timezone remains unknown. Invalid calendar values retain raw components and have a NULL parsed timestamp |
| Import attempt | A new ID and database start timestamp on every admitted `--load` invocation, plus append-only verification/selection/outcome events |

Publication evidence is an operator-supplied publisher URL or release label; the downloader does not invent or independently authenticate it. Dates embedded in filenames and local filesystem modification times are never substituted for publication/download dates. The exact receipt retains the original offset strings. A corrected receipt or later download produces a new observation without overwriting earlier evidence. An identical receipt reused on retry creates no duplicate acquisition.

Use the downloader for future acquisitions:

```sh
python tools/ingestion/download_tcad.py \
  --source-url 'https://traviscad.org/wp-content/largefiles/2026%20Certified%20Appraisal%20Export%20Supp%200_07182026.zip' \
  --output /persistent/private/downloads/tcad-2026-certified.zip
```

It streams the archive and writes `tcad-2026-certified.zip.receipt.json` beside it, with a checksum, resolved URL, download timestamps and available HTTP Last-Modified. Both files are private and existing output names are rejected. Add `--published-on YYYY-MM-DD --publication-evidence 'publisher URL or label'` only when the publication date is confirmed. Retain the ZIP and receipt together. A process termination between their final writes can leave a ZIP without a receipt; its acquisition date remains unknown until independently established, rather than inferred from filesystem metadata.

Pass `--receipt /persistent/private/downloads/tcad-2026-certified.zip.receipt.json` to both validation and load commands. The importer verifies that its URL and archive checksum match, requires timezone offsets for download timestamps, checks date ordering, and retains the receipt in `acquisitions`. Older files without a trustworthy receipt can still be ingested with NULL acquisition/publication dates. Do not fabricate a receipt using today's import time as an earlier download time.

`import_history` preserves each failure, successful load and repeat invocation separately, including errors before dataset creation, such as a checksum mismatch. Error entries contain exception types, not source rows or credentials. Attempts lacking a terminal event are labeled **unfinished**: this can mean running, abruptly stopped, or disconnected; no finish time is invented. Invalid CLI/configuration or failure to connect/register an attempt can only be reported by the invoking process, so retain job logs as well. Dry runs remain database-free and return validation timestamps in their report.

Use `release_chronology` for release/acquisition history, and `import_history ORDER BY started_at, id` for processing history. Sort publisher dates and acquisition dates separately; a late download of an older release must not make it appear to be a newer release. There is no property-level effective-date inference. Completeness means all releases actually acquired; obtaining missing historical releases remains necessary.

Chronology validation includes unknown dates, offset handling, evidence requirements, receipt identity checks, ZIP clocks, automatic download receipts, failures and retries, re-acquisition of identical bytes, unfinished attempts, and denied update/delete access to historical records. The same local-adapter limitation described above applies; production is still unchanged.
