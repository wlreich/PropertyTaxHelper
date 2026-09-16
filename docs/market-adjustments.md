# Neighborhood market adjustments

The property overview and neighborhood analysis show exact-code annual TCAD multipliers, a reconciled property estimate, and a median of individual estimates for eligible matched homes. The existing neighborhood print report retains its two-page season-outcome layout; the new analysis is on the live pages.

## Sources and annual refresh

The requester approved publication of the 2025 and 2026 market-adjustment schedules and 2026 residential valuation manual. These exact source PDFs are distributed in `web/public/data/tcad`; the UI links to the relevant PDF pages. Annual rows retain the exact neighborhood code, factor as printed (percent), PDF page, file SHA-256, imported row count and import timestamp. Display multiplies the printed percentage by 0.01. A factor of 178 is 1.78×, not a 178% annual increase.

Initial import: 1,533 unique codes for 2025 and 1,545 for 2026. The 2026 PDF footer says “Total NBHDs” followed by 1,578; the supplied pages contain 1,545 factor rows. The importer stops before that footer and does not manufacture missing entries. Two 2026 codes contain internal spaces (`B N 1314MH`, `B S 1314MH`); those spaces are preserved. No renamed-code or boundary crosswalk was supplied or inferred.

To add a year:

1. Obtain and review the official annual PDF. Name it `YEAR_Market_Adjustments.pdf` in the operator’s source workspace.
2. Run `python3 tools/market-adjustments/import.py YEAR /path/to/YEAR_Market_Adjustments.pdf > /tmp/annual-factors.sql` (requires Poppler `pdftotext`). Review row count, source hash, page references and anomalous codes against the PDF.
3. Create a migration using `supabase migration new tcad_market_adjustments_YEAR`. Apply the reviewed annual inserts separately when source-data publication is authorized. Keep source contents out of version control unless separately approved. Existing annual editions fail on conflict; corrections require a separately reviewed migration and documented source provenance, never an automatic overwrite.
4. Run the parser, database and website checks, then apply the reviewed migration through the normal production workflow. The views pick up new years when the corresponding property snapshots are published.

## Estimate and eligibility

For the selected release's tax year, take each home's first available dated preliminary snapshot on or before the selected release. The prior-year membership match uses the latest available prior-year snapshot; its value is not used as a preliminary baseline.

A dollar estimate requires both annual factors, identical neighborhood codes in the selected, preliminary and prior-year snapshots, a residential improvement in the prior-year records, complete nonnegative component values, one residential main building, and a positive improvement total. Sum the preliminary component values to obtain B. Verify `abs(round(B × current_factor) − recorded_preliminary_improvement) <= 1`. Otherwise show the exclusion reason, not a dollar estimate.

Estimated effect is `round(B × current_factor) − round(B × previous_factor)`. This holds current-year property details, costs and depreciation fixed. It estimates the factor change's effect on improvements, not land, taxable value or taxes. Reconciliation is a guard against inapplicable schedules and overrides, not evidence that an appraisal is correct or incorrect.

The neighborhood median uses individual signed dollar effects, including decreases and zero changes. Display the eligible count against the existing neighborhood population; show exclusions by reason. A changed population or incomplete coverage must not be represented as a complete neighborhood total.

Actual annual improvement change requires both years' dated preliminary snapshots in the same market area. Certified and supplemental values are never substituted. The initial published data has no 2025 preliminary snapshot, so this measure is unavailable. An estimated factor effect may exceed the actual net increase when other inputs offset it.

Historical release selection never includes preliminary snapshots after the selected date or factor years after the selected tax year. Exact-code continuity does not establish unchanged geographic boundaries. Source publication dates are unknown; the annual schedules are not claimed to be dated preliminary releases.

## Access and validation

Schedule tables allow anonymous/authenticated SELECT only, with RLS. New RPCs are security invoker functions and read only the already-published RLS property projections. They do not expose private ingestion records or use service keys in the website. Property IDs and batches are bounded; neighborhood membership comes from the existing neighborhood RPC.

Tests cover the formula, increases/decreases/zero, null inputs, component overrides, multiple buildings, exact-code matching, missing prior preliminary values, historical release isolation, confidential-property exclusion, anonymous write denial, source references, median denominators, mobile layouts and accessibility. Fixtures are synthetic.
