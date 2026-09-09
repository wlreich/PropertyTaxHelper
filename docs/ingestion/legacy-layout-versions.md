# TCAD export layout versions

The importer selects a pinned layout from the export header, supporting
`8.0.0.32` and `8.0.0.33`. Unknown versions fail closed. Both workbooks have
the same 244-byte header and the same 20 file types. Selection occurs before
version-dependent records are parsed; fixed-width length checks remain exact.
Reports include the selected export version, layout name, and layout checksum.

## Verified source and differences

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
Parser version is now `1.2.0`; parser version is part of dataset identity, so do
not reimport an already loaded July archive merely to apply this change.

## Verification

Run `python -m unittest discover -s tools/ingestion/tests -v`.
Version-specific tests exercise both filename conventions, layout checksums,
documented field boundaries, blank preservation, malformed and unsupported
headers, mismatched record lengths, and selection at the loader boundary.
The existing CI PostgreSQL integration checks cover persistence and retries.
No user interface or brand assets change.
