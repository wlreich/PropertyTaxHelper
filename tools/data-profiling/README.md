# Appraisal export profiler

`profile_export.py` produces deterministic, objective metrics from a ZIP archive without extracting or modifying its source files. It reads one bounded chunk at a time. Optional key audits keep only SHA-256 digests in a temporary SQLite database and delete that database when the run ends; they never write identifiers or raw records to the report.

## Usage

From the repository root:

```powershell
python tools/data-profiling/profile_export.py `
  "data/local/tcad/2026-preliminary/2026 Preliminary Appraisal Export Supp 0_07072026.zip" `
  --layout-map tools/data-profiling/tcad-legacy-8.0.33-2026-preliminary.json `
  --audit-keys `
  --output data/profiling-output/tcad-2026-preliminary-profile.json
```

The output records the package SHA-256, ZIP integrity result, every archive entry, sizes, CRC-32, row count, encoding classification, line endings, record-length distribution, malformed-record count, and configured duplicate/blank key counts. For tab-delimited files it also reports field-count consistency and any uniform trailing delimiter permitted by the matching official layout map.

## Safety and reproducibility

- Source archives are opened read-only and never extracted or rewritten.
- Memory use is bounded by the chunk size, one record, counters, and small key batches.
- Duplicate checks use a disk-backed temporary index of irreversible SHA-256 key digests.
- Output contains aggregate metrics only. Keep local profiler output ignored until it has been reviewed for publication.
- The layout map is versioned and must be regenerated or reviewed against each matching official annual layout. Do not reuse its positions as a different year's defaults.
