# TCAD 2026 preliminary appraisal export inventory

## Scope and handling

This inventory covers the official Travis Central Appraisal District (TCAD) 2026 Preliminary Appraisal Roll Export and the layout archive linked beside it. The raw archives and extracted layout documents are stored under `data/local/tcad/2026-preliminary/`, which is excluded from Git. The aggregate profiler output is stored under the ignored `data/profiling-output/` directory. No raw property record, homeowner name, PID, or private case artifact is reproduced here.

Profile run: `2026-07-20T22:27:55.229463+00:00`, profiler version `1.0.0`. ZIP integrity testing returned no failing entry. Exact line counts are reported where a text member could be streamed; they satisfy the requested approximate-row-count requirement without loading an export member into memory.

## Official sources and download metadata

| Item | Official source page | Linked file | Displayed title | Tax year | Roll stage | Publication context | Posted/update date | Downloaded UTC | Bytes | SHA-256 |
|---|---|---|---|---:|---|---|---|---|---:|---|
| Appraisal export | [TCAD Public Information](https://traviscad.org/publicinformation) | [Official ZIP](https://traviscad.org/wp-content/largefiles/2026%20Preliminary%20Appraisal%20Export%20Supp%200_07072026.zip) | 2026 Preliminary Appraisal Roll Export | 2026 | Preliminary | `PUBLICLY AVAILABLE DATA` → `OTHER EXPORTS`; the export header says `Appraisal Export - 2026`, year `2026`, supplement `0000`, value option blank, and run time `07/07/2026 22:25`. | No update date is visibly displayed. Page metadata records `2026-07-13T19:25:50+00:00`; the file response reported `Last-Modified: 2026-07-08T12:36:47Z`. | 2026-07-20T22:11:38.099Z | 661,127,212 | `d94b97f54044a43e02075c99e804d7049ed8aad7c9e8ef1683d5dc53f6b8b2e5` |
| Matching layout archive | [TCAD Public Information](https://traviscad.org/publicinformation) | [Official ZIP](https://traviscad.org/wp-content/largefiles/Website_Legacy8.0.33-AppraisalExportLayout_06182026.zip) | Export Layouts | 2026 publication context; workbook is not labeled by tax year | Matching layout supplied with the preliminary export | `PUBLICLY AVAILABLE DATA` → `EXPORT LAYOUT FILE EXPLANATION` immediately above the 2026 export. | No update date is visibly displayed. The filename carries `06182026`; the file response reported `Last-Modified: 2026-07-08T12:35:52Z`. | 2026-07-20T22:11:38.332Z | 248,399 | `c51352d2eba2f436c82b88ad156ebcc9a1d9c7fd546aee06bcfc83e69d61535b` |

The layout archive contains the original files `Legacy8.0.33-AppraisalExportLayout.pdf` (169,427 bytes) and `Legacy8.0.33-AppraisalExportLayout.xlsx` (106,638 bytes). Their ZIP member timestamps are June 2, 2026, without timezone information. The workbook contains 20 worksheets: `Header`, `Property`, `PropertyEntity`, `EntityTotals`, `AbstractSubdivision`, `StateCode`, `Improvement`, `ImprovementDetail`, `ImprovementDetailAttributes`, `LandDetail`, `Agent`, `ARB`, `Lawsuit`, `Entity`, `CountryCode`, `Arbitration`, `MobileHome`, `Deferral`, `Sketches`, and `SB12`.

## Package inventory

The ZIP contains 21 entries totaling 17,992,662,953 uncompressed bytes. All 20 text members use CRLF on every record. Fixed-width lengths below exclude CRLF. `Sketches` and `SB12` are expressly tab-delimited in the official workbook, so their variable byte lengths are expected; every row has the documented logical field count plus a uniform trailing tab.

| Package file | Bytes | Rows | Encoding | Record length / structure | Consistency and malformed rows | Layout worksheet | Likely business purpose |
|---|---:|---:|---|---|---|---|---|
| `2026-07-08_2026_APPRAISAL_HEADER.TXT` | 246 | 1 | ASCII | 244 fixed | Consistent; 0 malformed | `Header` | Export run, year, supplement, producer/version, and value-presence metadata |
| `2026-07-08_2026_APPRAISAL_INFO.TXT` | 4,891,797,624 | 492,926 | ASCII | 9,922 fixed | Consistent; 0 malformed | `Property` | Property, situs, legal, owner, classification, exemption, and roll-level value data |
| `2026-07-08_2026_APPRAISAL_ENTITY_INFO.TXT` | 9,834,066,697 | 3,128,879 | ASCII | 3,141 fixed | Consistent; 0 malformed | `PropertyEntity` | Property-owner associations with taxing entities, exemptions, and entity-level values |
| `2026-07-08_2026_APPRAISAL_ENTITY_TOTALS.TXT` | 560,925 | 225 | ASCII | 2,491 fixed | Consistent; 0 malformed | `EntityTotals` | Aggregate value and exemption totals by taxing entity |
| `2026-07-08_2026_APPRAISAL_ABSTRACT_SUBDV.TXT` | 1,475,396 | 28,373 | ASCII | 50 fixed | Consistent; 0 malformed | `AbstractSubdivision` | Abstract or subdivision code descriptions |
| `2026-07-08_2026_APPRAISAL_STATE_CODE.TXT` | 5,715 | 45 | ASCII | 125 fixed | Consistent; 0 malformed | `StateCode` | Local-to-state property classification code reference |
| `2026-07-08_2026_APPRAISAL_ARB.TXT` | 21,494,238 | 166,622 | ASCII | 127 fixed | Consistent; 0 malformed | `ARB` | ARB status and reference identifiers by property/year |
| `2026-07-08_2026_APPRAISAL_ENTITY.TXT` | 5,586 | 294 | ASCII | 17 fixed | Consistent; 0 malformed | `Entity` | Taxing-entity identifier/code lookup |
| `2026-07-08_2026_APPRAISAL_MOBILE_HOME_INFO.TXT` | 15,638,880 | 16,816 | ASCII | 928 fixed | Consistent; 0 malformed | `MobileHome` | Mobile-home identifiers and attributes |
| `2026-07-08_2026_APPRAISAL_AGENT.TXT` | 754,680 | 1,986 | ASCII | 378 fixed | Consistent; 0 malformed | `Agent` | Agent identifiers and contact data |
| `2026-07-08_2026_APPRAISAL_LAWSUIT.TXT` | 858,109 | 7,211 | ASCII | 117 fixed | Consistent; 0 malformed | `Lawsuit` | Property/year lawsuit references |
| `2026-07-08_2026_ARBITRATION_LAWSUIT.TXT` | 4,760 | 40 | ASCII | 117 fixed | Consistent; 0 malformed | `Arbitration` | Property/year arbitration references |
| `2026-07-08_2026_APPRAISAL_IMPROVEMENT_INFO.TXT` | 52,779,304 | 454,994 | ASCII | 114 fixed | Consistent; 0 malformed | `Improvement` | Improvement identifiers, types, homesite flags, and values |
| `2026-07-08_2026_APPRAISAL_IMPROVEMENT_DETAIL.TXT` | 2,065,558,560 | 3,310,190 | ASCII | 622 fixed | Consistent; 0 malformed | `ImprovementDetail` | Detail type, class, year, area, value, and an officially unused sketch filler |
| `2026-07-08_2026_APPRAISAL_IMPROVEMENT_DETAIL_ATTR.TXT` | 232,207,141 | 2,609,069 | ASCII | 87 fixed | Consistent; 0 malformed | `ImprovementDetailAttributes` | Coded features attached to improvement details |
| `2026-07-08_2026_APPRAISAL_LAND_DETAIL.TXT` | 89,535,249 | 445,449 | ASCII | 199 fixed | Consistent; 0 malformed | `LandDetail` | Land segments, sizes, methods, classes, values, and homesite allocation |
| `2026-07-08_2026_APPRAISAL_TAX_DEFERRAL_INFO.TXT` | 755,744 | 3,344 | ASCII | 224 fixed | Consistent; 0 malformed | `Deferral` | Tax-deferral records for specified exemptions |
| `2026-07-08_2026_APPRAISAL_COUNTRY_CODE.TXT` | 13,965 | 245 | ASCII | 55 fixed | Consistent; 0 malformed | `CountryCode` | Country code lookup |
| `2026-07-08_2026_APPRAISAL_SKETCH_INFO.TXT` | 757,935,585 | 1,612,845 | UTF-8 | Variable 45–6,104,783 bytes; mode 66; 7 tab-delimited fields | 10,780 byte lengths by design; all rows have 7 logical fields and a trailing tab; 0 malformed | `Sketches` | Legacy directional sketches or enhanced JSON sketches |
| `2026-07-08_2026_APPRAISAL_SB12.TXT` | 26,277,654 | 233,033 | ASCII | Variable 90–130 bytes; mode 119; 19 tab-delimited fields | 41 byte lengths by design; all rows have 19 logical fields and a trailing tab; 0 malformed | `SB12` | SB 12 compression calculation details |
| `55c40f68-7a88-11f1-9dee-0242ac11000a_exportTotals.pdf` | 936,895 | n/a | Binary PDF | n/a | ZIP integrity passed; no record schema | No worksheet | Inferred from filename: export totals report; content interpretation was not required for this source inventory |

## Confirmed Findings

- TCAD is the publisher, and the public page explicitly labels the package **2026 Preliminary Appraisal Roll Export**.
- The export header confirms appraisal year `2026`, supplement `0000`, a blank `Value Option` (the layout says blank means values are included), TP version `8.1.33.23`, and export version `8.0.0.33`.
- Every ZIP member listed above has a matching official workbook worksheet except the export-totals PDF. The workbook defines fixed-width start/end positions for 18 members and explicitly defines `Sketches` and `SB12` as tab-delimited.
- Every fixed-width record matched its official worksheet's terminal end position. All configured malformed-record counts are zero.
- ZIP integrity passed, no archive entry name is duplicated, and no expected worksheet-backed text member is missing.
- Exact hashed-key audits found zero blank keys and zero duplicate keys for 492,926 candidate property-owner-roll keys, 454,994 improvement keys, 3,310,190 improvement-detail keys, 2,609,069 candidate attribute keys, 445,449 candidate land-segment keys, and 166,622 candidate ARB property/year keys. The audit stored only SHA-256 digests in a deleted temporary database.
- The official relationship notes define these joins:
  - improvement to property on `(property.prop_id = improvement.prop_id OR property.udi_group = improvement.prop_id)` plus year;
  - detail to improvement on property ID + year + improvement ID;
  - attribute to detail on property ID + year + improvement ID + detail ID;
  - land to property on `(property.prop_id = land.prop_id OR property.udi_group = land.prop_id)` plus year;
  - property-entity to property on property ID + year + supplement number + owner ID.
- The layout defines the natural row identifiers for improvement (`prop_id`, `prop_val_yr`, `imprv_id`) and detail (`prop_id`, `prop_val_yr`, `imprv_id`, `imprv_det_id`). These also match the repository's confirmed join invariants.

## Inferred Findings

- Candidate primary keys, supported by field structure and zero duplicates in this package but not expressly declared as database constraints, are:
  - Property: `prop_id` + `prop_val_yr` + `sup_num` + `py_owner_id`;
  - ARB: `prop_id` + `prop_val_yr`;
  - Land: `prop_id` + `prop_val_yr` + `land_seg_id`;
  - Improvement detail attribute: `prop_id` + `prop_val_yr` + `imprv_id` + `imprv_det_id` + `imprv_attr_id`.
- `APPRAISAL_INFO`, `APPRAISAL_IMPROVEMENT_INFO`, `APPRAISAL_IMPROVEMENT_DETAIL`, and `APPRAISAL_LAND_DETAIL` are the likely minimum factual sources for an address-first homeowner summary. `APPRAISAL_STATE_CODE` is a small supporting lookup. `APPRAISAL_IMPROVEMENT_DETAIL_ATTR` is likely needed for feature-level comparison only after its codes are interpreted from an authoritative source. `APPRAISAL_ARB` is optional for status display and must retain its source date because status may change.
- The layout's `hood_cd` is explicitly a **neighborhood code**. It must not be relabeled as “market area” without a separate authoritative mapping or documentation.
- The source page's placement of the layout immediately above the 2026 package, the exact reconciliation of all fixed widths, and the header export version support treating this workbook as the matching schema. The differing labels `Legacy8.0.33` and header `8.0.0.33` still require human confirmation before parser release.

## Open Questions

- The source page calls the package preliminary, while the layout describes supplement number zero as representing certified data. Parser and product copy must treat the page's roll stage as authoritative for this download and obtain TCAD clarification before generalizing supplement zero into a roll-stage rule.
- The Property worksheet's programmer note names `owner_id` as part of the distinguishing key, but the field list contains `py_owner_id`, `jan1_owner_id`, and `appr_owner_id` rather than a literal `owner_id`. Confirm whether `py_owner_id` is the intended join to `PropertyEntity.owner_id`.
- Confirm with TCAD that layout label `Legacy8.0.33` is intended for an export whose header reports export version `8.0.0.33` and TP version `8.1.33.23`.
- Which authoritative 2026 source maps a property to the market area used in the historical comparison workflow? The workbook contains `hood_cd` but no field named or described as market area.
- Which improvement types and detail types are eligible dwelling/floor components for the 2026 homeowner comparison area? The layout supplies codes and descriptions but does not define the selection rule.
- Which attribute code, if any, is an authoritative 2026 condition or grade measure? Do not equate a label such as Grade Factor with condition without separate direction.
- The approved target PID allowlist for the founding-case subject and known 2026 comparables is not present in this repository. It must come from an approved, access-controlled case artifact and must not be added to committed fixtures or logs.
- Referential integrity/orphan counts across candidate foreign keys were not asserted by this structural run. Add a disk-backed orphan audit after the owner-key ambiguity and the controlled target list are resolved.
- The totals PDF was inventoried but not interpreted. Determine whether it is needed as a run-level reconciliation control before importer implementation.

## Text-preservation rules

At ingestion, retain the original record and preserve these as text even where the layout calls them integer or numeric: property ID, appraisal year, supplement number, owner IDs and owner-sequence values, UDI group, entity ID/code, geographic and reference IDs, improvement/detail/attribute/land-segment IDs, all fields ending in `_cd`, class/type/method/status/flag values, situs number/unit/ZIP, country/state codes, and mobile-home serial/HUD identifiers. Parse money, area, acreage, percentages, and years into typed normalized fields only after raw text passes validation; never discard the raw slice.

Owner names, owner mailing addresses, agent contact fields, and other person-linked public fields are not required for the first homeowner summary and should be excluded from controlled extracts and application logs by default.

## Recommended minimum subset for controlled ingestion

For the founding-case subject and known 2026 comparables, use a PID allowlist held outside version control and stream-filter only the following members, in this order:

1. `APPRAISAL_HEADER.TXT` — run/year/version/value-presence gate.
2. `APPRAISAL_INFO.TXT` — year, real-property type, situs, legal description, neighborhood code, state codes, and roll values; omit owner/contact fields from downstream outputs.
3. `APPRAISAL_IMPROVEMENT_INFO.TXT` — select the highest-valued eligible dwelling improvement after the eligibility rule is confirmed.
4. `APPRAISAL_IMPROVEMENT_DETAIL.TXT` — detail type, class, year built, area, and detail value; sum only confirmed eligible floor details.
5. `APPRAISAL_LAND_DETAIL.TXT` — land segments, sizes, classes, and values.
6. `APPRAISAL_STATE_CODE.TXT` — translate state property codes without changing their raw text.
7. `APPRAISAL_IMPROVEMENT_DETAIL_ATTR.TXT` — include only if an authoritative interpretation of required feature/grade codes is approved.
8. `APPRAISAL_ARB.TXT` — include only when dated protest/ARB status is part of the experience; absence must remain absence, not “unchanged.”

Do not ingest `Sketches`, `SB12`, owner/agent contact data, entity tax calculations, lawsuits, arbitration, mobile-home data, or deferrals for the first homeowner property-summary experience unless a separately reviewed requirement establishes their necessity. Reconcile the subject and every known comparable on PID, year, situs, area, class, year built, land, improvement, and market value before publishing any comparison.
