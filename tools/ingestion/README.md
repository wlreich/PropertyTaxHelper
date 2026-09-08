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

For chronology, use `download_tcad.py` to acquire a ZIP with a receipt, then pass `--receipt` to the importer. The operator guide explains unknown dates, private release views and append-only attempt history.

For the operational GitHub workflow and credential setup, follow [Run the first import](../../docs/ingestion/run-first-import.md). Install `requirements-job.txt` to run all tests, including the Storage adapter tests.
