# TCAD adjustment method

ParcelSavvy follows TCAD's 2026 Sale and Equity Grids calculations, checked against TCAD's residential equity worked example and numerical equity/sales grids. Public copy attributes the method to TCAD. It does not refer to a homeowner's records request or evidence submission.

## Record mapping

Use the selected source dataset and year for every input. Choose the highest-valued Improvement using `imprv_val`. Detail codes `1ST`, `2ND`, `3RD` supply its main area, class and year. Detail `imprv_det_val` is depreciated cost before the neighborhood multiplier, not replacement cost new. Sum remaining details for non-living features. Sum other Improvement totals for the secondary adjustment; those totals already include their multipliers. Do not price the same feature in both groups.

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

- The export does not supply percent good. Estimate from construction class and age using the age/percent-good pairs in TCAD's worked examples. Prefer depreciation year, otherwise actual year built. Assume average condition and no additional depreciation factors. Grade Factor A is not treated as condition A.
- R3 observations: age 6:96%, 8:95%, 11:92%, 12:91%, 13:90%, 15:88%, 16:88%. R4 observations: 12:90%, 22:79%. R5 observation: 11:90%.
- Age zero:100% is an assumption. Interpolate between observations. Beyond observed ages, extrapolate using the average slope between first and last nonzero-age observations (R5 uses age zero). Bound estimates to 20–100%. The 20% floor is an approximation, not a documented TCAD minimum. R1/R2/R6 use R3 as an explicitly labeled proxy. These sparse examples are not a complete district schedule and do not establish individual property condition.
- Reconstruct main RCN as main RCNLD / (estimated percent good / 100). Use a 100% main-area factor, matching the worked cases.
- Where a neighborhood factor cannot be recovered, equal factors may be assumed within the same reported market area. Different market areas need recovered factors.
- The 2026 calibration remains identified when used for another tax year. Calibration data is centralized in `web/src/lib/tcad-method.ts`.

Corrections follow their release: a feature removed in newer source records does not reappear in newer estimates, and historical records remain unchanged. An empty complete secondary inventory means no secondary improvement is recorded, not a physical inspection. Missing core costs remain unknown. Totals and medians require every applicable line, with one clear disclaimer above the grid and assumptions inside expandable details.

## Regression coverage

Anonymous numerical fixtures reproduce ten equity indicated values and the $1,606,460 median, the separate $676,528 worked equity example, and sales indications of $1,573,664 and $1,810,832. Source mapping tests cover primary/secondary separation, release correction, public visibility, private-field exclusion, request bounds, and missing/inactive releases. These establish formula agreement with the supplied examples, not accuracy of every estimated percent-good input.
