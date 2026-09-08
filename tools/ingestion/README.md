# TCAD ingestion

See [the operator guide](../../docs/ingestion/tcad-comprehensive.md).

- `ingest_tcad.py`: comprehensive ZIP validation by default; explicit `--load` enables resumable PostgreSQL COPY.
- `tcad-layout.json`: all 20 source layouts and all 1,030 documented positions, with workbook provenance.
- `requirements.txt`: pinned load-time PostgreSQL driver. Dry-run and unit tests use only the Python standard library.
- `tests/`: synthetic validation and isolated database integration checks.

No source data, credentials or full archives belong in this directory or Git.

Archive validation recognizes both filename conventions in the layout workbook:
date/dataset-prefixed long names and the exact short names recorded under
`filename_aliases` in `tcad-layout.json`. `SKETCH_INFO.TXT`, observed in the July
2026 certified archive listing, also maps to the Sketches layout alongside the
workbook's `SKETCH.TXT`. Matching ignores case and preserves original member paths.
Aliases select the same field layouts; all 20 record types are still required,
and duplicate types across either naming convention are rejected. Full county
content validation is still required before approving an import.

The archive's header identifies the release year. The workbook describes ARB,
Lawsuit and Arbitration as active-case lists, which can contain earlier appraisal
years: retain their original `prop_val_yr` without rewriting it to the release year.
Active-case years from 1900 through the release year are accepted; malformed and
future years are rejected. Other record types keep
the existing release-year equality check. Validation reports include aggregate
`record_year_counts` for each file and distinguish structural errors without
printing source field values.

After inventory and header validation, dry runs check every member, reporting the
first structural failure in each affected file and keeping summaries for files
that passed. A failed file is not reported as fully scanned. Any failure keeps
the workflow failed and blocks its import step. Inventory/header errors still
stop immediately because the archive's structure or release is unverified.
The workflow logs per-file progress and saves the aggregate failures in its report;
no source rows are printed. Direct database loads retain their fail-fast behavior.

For chronology, use `download_tcad.py` to acquire a ZIP with a receipt, then pass `--receipt` to the importer. The operator guide explains unknown dates, private release views and append-only attempt history.

For the operational GitHub workflow and credential setup, follow [Run the first import](../../docs/ingestion/run-first-import.md). Install `requirements-job.txt` to run all tests, including the Storage adapter tests.
