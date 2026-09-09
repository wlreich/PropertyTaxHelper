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

SB12 has no `prop_val_yr` in 8.0.30. Preserve its `calc_year` and `freeze_yr`;
do not synthesize a property appraisal year from either. Its release year is
available through the parent dataset. Missing later-version fields remain absent.
An optional trailing tab in an 18-column row can resemble a blank 19th column;
header selection and exact widths in the other three files still reject an
archive claiming the wrong supported version.

The reported July 20, 2025 certified archive has not yet been validated against
this implementation. Start a new `validate_uploaded` run on `main`, using its
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
The 8.0.32 change used parser `1.2.0`; 8.0.30 support advances it to `1.3.0`.
Parser version is part of dataset identity, so do not reimport an already loaded
April or July archive merely to apply this change.

## Verification

Run `python -m unittest discover -s tools/ingestion/tests -v`.
Version-specific tests exercise both filename conventions, layout checksums,
documented field boundaries, blank preservation, malformed and unsupported
headers, mismatched record lengths, and selection at the loader boundary.
The existing CI PostgreSQL integration checks cover persistence and retries.
No user interface or brand assets change.
