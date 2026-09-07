# TCAD ingestion

See [the operator guide](../../docs/ingestion/tcad-comprehensive.md).

- `ingest_tcad.py`: comprehensive ZIP validation by default; explicit `--load` enables resumable PostgreSQL COPY.
- `tcad-layout.json`: all 20 source layouts and all 1,030 documented positions, with workbook provenance.
- `requirements.txt`: pinned load-time PostgreSQL driver. Dry-run and unit tests use only the Python standard library.
- `tests/`: synthetic validation and isolated database integration checks.

No source data, credentials or full archives belong in this directory or Git.

For chronology, use `download_tcad.py` to acquire a ZIP with a receipt, then pass `--receipt` to the importer. The operator guide explains unknown dates, private release views and append-only attempt history.

For the operational GitHub workflow and credential setup, follow [Run the first import](../../docs/ingestion/run-first-import.md). Install `requirements-job.txt` to run all tests, including the Storage adapter tests.
