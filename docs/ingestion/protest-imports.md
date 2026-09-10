# Protest-season imports

Upload the original full TCAD ZIP to the existing private `incoming/` folder.
Choose the protest modes in **TCAD data import**; no manual extraction is required.
The ZIP is retained byte-for-byte, but only Header, Property, ARB and Agent are
validated and loaded. Other documented members are inventoried, marked
`not_validated_or_loaded` in the aggregate report, and kept only in the archive.
The ZIP's directory still undergoes duplicate, path, type and size checks.
A ZIP with just the four required files also works; loose ARB-only ingestion is
not supported by this workflow. Unknown layouts and missing required files fail.

## Validate, then import

First run on `main`:

| Input | Value |
| --- | --- |
| Mode | `validate_protests_uploaded` |
| Private upload path | Actual `incoming/<original-or-distinct-name>.zip` |
| Original filename | TCAD's original archive filename |
| Source URL | Actual direct TCAD URL, or blank when unknown |
| Tax year | Header's appraisal year |
| Roll stage | Publisher's preliminary/certified/supplemental label |
| Encoding | `ascii`, unless the source specifies otherwise |
| Archive checksum | Optional independently computed ZIP SHA-256 |
| Receipt checksum | Blank |
| Import approved | Unchecked |
| Download/publication dates and evidence | Blank unless independently known |

Validation preserves the ZIP and its receipt but inserts no property records.
Review `import_scope: protests`, the export header's `export_run_time_raw`, the
four selected files, ARB `record_year_counts`, row counts and serialized size.
The Property file is still large: this mode saves the other 16 text files, not
all property storage. Check remaining database capacity before loading.

Then run on `main` with mode `import_protests`, the same tax year, roll stage and
encoding, both SHA-256 values from successful validation, and import approval
checked. Source/upload/date inputs are unused in this second step. The importer
retrieves the archived bytes and validates all four selected files again before
inserting records. A full-import validation receipt can identify the same bytes,
but use protest validation first so the reviewed storage estimate matches scope.

Retry a failed import with the same parameters. Each file is transactional;
completed files are skipped and the failed file restarts without duplicate rows.
A failure during post-load verification does not undo committed files. Retrying
reuses them and repeats bounded exact row-count verification. Check the final
report for `status: imported` and `database_row_count` matching `row_count`.

## Identity and chronology

`tcad_ingest.datasets.import_scope` and `import_attempts.import_scope` distinguish
`full` from `protests`; this is independent of the publisher's `roll_stage`.
The unique dataset identity includes archive, layout, parser, encoding and scope.
The same ZIP can therefore be loaded once per scope and retried independently.
The original archive object is reused. Existing datasets default to `full` and
keep their IDs; the full parser version remains 1.3.1 because field mapping and
full-import behavior have not changed.

Raw records, including source statuses and agent assignments, are preserved as
text in the existing private tables. ARB can contain cases for earlier appraisal
years: retain each row's `prop_val_yr`, never relabel it as the archive year.
Use `(dataset_id, prop_id, prop_val_yr)` for case/property matching, normalizing
numeric padding. `geo_id`, `ref_id1` and `ref_id2` are cross-checks.
Property `arb_agent_id` links to Agent `agent_id` within the same dataset;
ARB does not contain an agent ID. A correspondence assignment does not prove
who filed a protest. Earlier-year cases do not acquire the current year's agent
assignment by inference. Header, ZIP-member clock, acquisition time and any
operator-reported dates remain distinct; no filename date becomes a verified
export date. An unknown source date remains unknown.

## Publication boundary

This change loads private evidence only. It does not switch the active search
release, create valuation snapshots, schedule collection, or update the public
protest display. Existing public valuation publishers reject these four-file
imports because they require 20 completed text files. Public read permissions
and confidentiality protections remain unchanged.

After the first real selective import, inspect its property/case/agent links and
source dates before adding a separate curated protest-history publisher and UI
integration. Retain positive observations across snapshots; later absence never
means no protest, withdrawal or resolution. Verify TCAD's status dictionary
before translating codes. Publication must check same-source confidentiality
and current public eligibility and must not expose owner/agent contact data.

## Verification

`python -m unittest discover -s tools/ingestion/tests -v` covers mode selection,
all three layouts, selected/skipped files, unsafe archives, malformed required
files, mixed appraisal years and provenance/approval requirements.
`tests/job_integration_check.py` runs against disposable PostgreSQL in PR CI and
before the production workflow receives credentials. It exercises validation
without records, both scopes on one archive, interrupted-file rollback, retry,
private access and rejection by both valuation publishers.

No user-facing UI or brand assets change in this importer update.
