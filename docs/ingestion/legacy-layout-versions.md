# TCAD export layout versions

The importer selects a pinned layout from the export header, supporting
`8.0.0.30`, `8.0.0.32` and `8.0.0.33`. Unknown versions fail closed. All three workbooks have
the same 244-byte header and the same 20 file types. Selection occurs before
version-dependent records are parsed; fixed-width length checks remain exact.
Reports include the selected export version, layout name, and layout checksum.

## Verified source and differences

### Legacy 8.0.30

The user supplied `Website_Legacy8.0.30-AppraisalExportLayout (4)(1).zip`,
containing `Legacy8.0.30-AppraisalExportLayout.xlsx` and its PDF. Its original
download URL is unknown. `tcad-layout-8.0.30.json` records both source filenames
and SHA-256 checksums. Workbook SHA-256:
`feece2b504985f383fef554837354164c8c5177ae585a042c9d2157a8cf5bcb1`.

All 20 worksheets were reconciled to the pinned schema: 929 field positions.
Sixteen file layouts match 8.0.32 exactly. Four differ:

| File type | 8.0.30 | 8.0.32 |
| --- | ---: | ---: |
| Property | 9,247 bytes / 446 fields | 9,812 bytes / 485 fields |
| PropertyEntity | 2,750 bytes / 186 fields | 3,081 bytes / 209 fields |
| EntityTotals | 2,140 bytes / 153 fields | 2,437 bytes / 175 fields |
| SB12 | 18 tab-separated columns | 19 tab-separated columns |

This is not only a shorter-record variant. Property bytes 3,994–4,027 and
4,228–4,247 are reserved in 8.0.30; later layouts use these areas for
`ownership_pct` and `mineral_lease_id`. The old layout preserves their raw text
under position-specific filler names and does not assign newer meanings.
Fixed-width positions use the workbook's Start/End columns: the older
PropertyEntity `freeze_ceiling_override` Length cell is inconsistent, while
Start/End define a contiguous one-byte field.

The documented 18-column SB12 has no `prop_val_yr` in 8.0.30. Preserve its `calc_year` and `freeze_yr`;
do not synthesize a property appraisal year from either. Its release year is
available through the parent dataset. Missing later-version fields remain absent.
An optional trailing tab in an 18-column row can resemble a blank 19th column;
header selection and exact widths in the other three files still reject an
archive claiming the wrong supported version.

#### Observed July 2025 SB12 extension (parser 1.3.1)

Validation run `34383395296` passed the other 19 text files but rejected SB12
row 1 as 18 expected fields versus 20 split values. The user then supplied
`SB12.TXT` from `2025 Certified Appraisal Export Supp 0_07202025`.
All 324,242 rows contain the 18 documented columns, the later documented
`prop_val_yr` column (`2025` throughout), and one trailing tab.
File SHA-256: `4e12cbab2b66c7c5567e6c19100f9083aeb1c762e72ce1cffe1f67ac64a402e3`.
The raw file is private and is not committed.

Parser 1.3.1 accepts this specific 19-column SB12 variation with or without
one trailing delimiter, alongside the documented 18-column rows. It preserves
the appended year, requires four digits, and checks it against the dataset year.
It does not infer that year from `calc_year` or `freeze_yr`, truncate unknown
columns, relax other file counts, or modify the pinned workbook schemas.
The validation report's SB12 `record_year_counts` identifies the observed years.
Every supplied row was verified against the documented 19-column mapping and
the normal file scanner. All 52 importer unit tests passed, including loader
callback preservation and malformed/extra-column rejection.

Start a **new** `validate_uploaded` run on `main` with
`incoming/2025-certified.zip`, original filename
`2025 Certified Appraisal Export Supp 0_07202025`, year `2025`, certified stage,
ASCII encoding, and import approval unchecked. Rerunning the old failed run
uses its old commit. Use the new successful report's archive and receipt hashes
for import; the full archive has not yet passed validation with this correction.

The July 20, 2025 certified archive still requires full validation against
this correction. Start a new `validate_uploaded` run on `main`, using its
actual private upload key, tax year `2025`, roll stage `certified`, encoding
`ascii`, and import approval unchecked. Record the actual source filename and
leave unknown URL/date evidence blank. The archive header must confirm the year
and supported version; the reported filename date is not verified provenance.
Use successful validation's archive/layout hashes for the subsequent import.
This compatibility change alone loads no records and does not publish a new
website release. Review archive validation and capacity before the full load.

### Legacy 8.0.32 to 8.0.33

Wendy supplied `Website_Legacy8.0.32-AppraisalExportLayout.zip`, containing
`TP_Legacy8.0.32-AppraisalExportLayout.xlsx` and its PDF. The original download
URL is unknown and is not reconstructed. The pinned JSON records the source
filenames and SHA-256 checksums. Workbook SHA-256:
`f0269a37267aed8ac8d28289d2b454a2c50c536ef16fe1a5bcc38b9898affeb9`.

All 20 worksheets were compared against the supplied 8.0.33 workbook. Its
fixed-width field names and offsets were also reconciled to the existing
`tcad-layout.json`. There are 1,014 positions in 8.0.32 and 1,030 in 8.0.33.

| File type | 8.0.32 bytes | 8.0.33 bytes | Fields appended in 8.0.33 |
| --- | ---: | ---: | --- |
| Property | 9,812 | 9,922 | 8: AFHS/LGCC exemption flags, qualifying years, and proration dates |
| PropertyEntity | 3,081 | 3,141 | 4: AFHS/LGCC amounts and allocation factors |
| EntityTotals | 2,437 | 2,491 | 4: AFHS/LGCC counts and amounts |

AFHS is Animal Feed Held for Sale; LGCC is Landfill-Generated Gas Conversion
Facility. The other 17 layouts, including header, land, improvements, sketches,
and SB12, are unchanged. Existing positions do not shift. Missing newer fields
are absent, not fabricated as zero. Source numeric strings and implied decimal
handling remain unchanged.

## April 2 validation

The separately supplied `APPR_HDR.TXT` identifies export format `8.0.0.32`,
tax year `2026`, and export clock `04/02/2026 22:24`. This is the export clock,
not an independently confirmed publication date or download date.

After this change is merged, start a **new** TCAD data import workflow on
`main`; rerunning an old failed run reuses its old commit.

| Input | Value |
| --- | --- |
| mode | `validate_uploaded` |
| uploaded_archive_key | `incoming/2026-Preliminary04022026.zip` |
| original_filename | `2026 Preliminary Appraisal Export Supp 0_04022026` |
| tax_year | `2026` |
| roll_stage | `preliminary` |
| encoding | `ascii` |
| source_url, checksums, dates/evidence | Blank unless independently known |
| import_approved | Unchecked |

Full-archive validation and database capacity review are still required before
importing the historical snapshot. Validation does not insert property records.
This code change does not import April data or switch the public website release.
The 8.0.32 change used parser `1.2.0`; 8.0.30 support used `1.3.0`, followed by
the observed SB12 compatibility correction in `1.3.1`.
Parser version is part of dataset identity, so do not reimport an already loaded
April or July archive merely to apply this change.

## Verification

### Recovery from a final count timeout

The 2025 import run `34409791912` committed all files and marked dataset
`39edc24e-5857-44c0-a099-a6e4b0576ec8` ready at `2026-09-09 23:14:45 UTC`.
The import audit recorded success. The workflow then failed with `QueryCanceled`
at `23:16:45 UTC` in its separate dataset-wide `count(*)` verification. File
manifests total 12,388,214 records across 20 text files, plus the archived PDF.
This failure did not roll back the completed file transactions.

`run_job.py` now verifies exact row counts in ranges of at most 50,000 rows
using the existing `(dataset_id, member_name, row_number)` primary key.
It checks the complete manifest against validation, counts each expected range,
and checks for surplus rows past each file's expected end. Positive row numbers
and primary-key uniqueness make missing and extra rows detectable. All checks
share a read-only, repeatable-read snapshot; database timeouts and RLS remain
unchanged. Progress and failures identify `database_verification` separately
from loading. The live query plan confirmed an index-only scan for a range,
and a 50,000-row range returned its exact count. Sixty local unit tests passed;
the import workflow runs the PostgreSQL integration gate before recovery.

Parser version remains `1.3.1`, so a new import run selects the same dataset
and skips committed files. Do not delete the dataset or re-upload the archive.
Start a **new** workflow on `main` with mode `import`, tax year `2025`, stage
`certified`, encoding `ascii`, and import approval checked, using:

- Archive SHA-256: `975f378c0512db6ac752eef53bb982c6aa3d74ee509a63ac1b0e88b103c94ac7`
- Receipt SHA-256: `9dd406b31272849cb52705c30f91630d01e39a12d94e5c00bbec5813b5949115`

Other source/upload/date inputs are unused in import mode. The job revalidates
the archive, resumes its existing dataset, and performs the corrected database
verification. Rerunning the old failed run would retain the old count query.
The 2026 public release is not changed by this recovery.

Run `python -m unittest discover -s tools/ingestion/tests -v`.
Version-specific tests exercise both filename conventions, layout checksums,
documented field boundaries, blank preservation, malformed and unsupported
headers, mismatched record lengths, and selection at the loader boundary.
The existing CI PostgreSQL integration checks cover persistence and retries.
No user interface or brand assets change.
