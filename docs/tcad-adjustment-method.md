# TCAD adjustment method

ParcelSavvy follows TCAD's 2026 Sale and Equity Grids calculations, checked against TCAD's residential equity worked example and numerical equity/sales grids. Public copy attributes the method to TCAD. It does not refer to a homeowner's records request or evidence submission.

## Record mapping

Use the selected source dataset and year for every input. Choose the highest-valued Improvement using `imprv_val`. Detail codes `1ST`, `2ND`, `3RD` supply its main area, class and year. Detail `imprv_det_val` is depreciated cost before the neighborhood multiplier, not replacement cost new. Sum remaining details for non-living features. Sum other Improvement totals for the secondary adjustment; those totals already include their multipliers. Preserve the exported improvement IDs and their attached detail records, including any living area, garage, porch, pool or spa. A feature description does not determine which improvement owns it. Do not price the same feature in both groups.

Recover the primary neighborhood multiplier as Improvement value / summed detail values, rounded to four decimals. Use the raw Improvement total rather than the property's final improvement assessment, which may have an appraisal override.

## Formulas and rounding

Let S be the subject and C the comparable. RCN is replacement cost new; RCNLD is depreciated cost. Percent good is on a 0–100 scale. Round replacement-cost unit rates to cents before calculating adjustments, then truncate each adjustment toward zero to whole dollars.

| Adjustment | Formula |
| --- | --- |
| Land | S land − C land |
| Living area | (S area − C area) × S main RCN/SF × main-area factor |
| Class | (S main RCN/SF / C main RCN/SF − 1) × C main RCN; equal classes use zero, as in the worked grids |
| Percent good | (S percent good − C percent good) / 100 × C main RCNLD |
| Non-living details | S primary non-living RCNLD − C primary non-living RCNLD |
| Additional improvements | S secondary Improvement totals − C secondary Improvement totals |
| Neighborhood | (S multiplier − C multiplier) / C multiplier × (C starting value − C land) |

The equity starting value is the reported market assessment. Sales calculations require an explicitly supplied adjusted sale price; the engine does not infer sale prices from assessments or guess the raw-to-adjusted-sale-price transformation. The neighborhood expression uses adjusted sale price for sales and non-land market assessment as an equity adaptation. All available worked examples have equal multipliers, so nonzero neighborhood adjustments have formula coverage but no observed reconciliation case.

## Explicit approximations

- The export does not supply percent good or physical condition. Use the selected year's published class/age table with condition A (average) explicitly assumed. Prefer depreciation year, otherwise actual year built. Grade Factor A is not physical condition A. Other depreciation factors remain unmodeled.
- `web/src/lib/tcad-depreciation.ts` contains 912 class/age rows, independently extracted from the supplied 2025 and 2026 Pricing Schedules PDFs. `tools/extract-depreciation.py` reproduces it and embeds source SHA-256, schedule IDs, association pages and source pages. Each class uses its official association; no cross-class proxy, interpolation or extrapolation. Ages beyond individual rows use the published terminal 999 band. Unsupported source years return unknown.
- 2025 association 225694 (PDF page 1855): R6→225652, R5→225653, R4→225654, R3→225655, R1/R2→225656. 2026 association 231078 (page 1478): R6→231031, R5→231032, R4→231033, R3→231034, R1/R2→231035. The alternate unassociated R3 schedule is not used.
- Reconstruct main RCN as main RCNLD / (estimated percent good / 100). Use a 100% main-area factor, matching the worked cases.
- Where a neighborhood factor cannot be recovered, equal factors may be assumed within the same reported market area. Different market areas need recovered factors.
- Comparison market land is `land_hstd_val + land_non_hstd_val + ag_market` from the selected source's Property record. Never substitute `ag_use`. Missing, negative or conflicting components return unknown; identical duplicate rows are not summed. This bounded RPC correction does not rewrite historical snapshots or other pages' land projections.
- Additional improvements participate in estimates and medians when required inputs are available. Missing improvement values prevent primary selection and remain unknown. Multiple records do not trigger review flags. Do not relocate features between IDs: that changes TCAD's classification and is not a neutral sensitivity test.

Corrections follow their release: a feature removed in newer source records does not reappear in newer estimates, and historical records remain unchanged. An empty complete secondary inventory means no secondary improvement is recorded, not a physical inspection. Missing core costs remain unknown. Totals and medians require every applicable line, with one clear disclaimer above the grid and assumptions inside expandable details.

## Regression coverage

Anonymous numerical fixtures reproduce ten equity indicated values and the $1,606,460 median, the separate $676,528 worked equity example, and sales indications of $1,573,664 and $1,810,832. Source mapping tests cover primary/secondary separation, release correction, public visibility, private-field exclusion, request bounds, and missing/inactive releases. These establish formula agreement with the supplied examples, not accuracy of every estimated percent-good input.

## Secondary-improvement reconciliation (2026-09-19)

The supplied original TCAD methodology explicitly defines Segment Net Adjustment as the difference in additional-improvement RCNLD multiplied by each neighborhood mass improvement adjustment. The original nonzero equity grid uses -$221,996, matching $124,717 × 1.78 rounded to dollars; its indicated value is $1,632,288. This confirms the existing reported-value formula, rather than an unmultiplied detail-cost difference.

The investigated two-dwelling case reconciles $246,222 main-area details + $106,109 other attached details = $352,331; × 1.78 rounds to $627,149. Those attached details remain in the secondary improvement and are not counted again under primary non-living details. This supersedes the earlier grouping-withholding recommendation, not the independent land or depreciation corrections.
