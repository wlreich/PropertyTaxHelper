# Adjustment audit remediation — recommendations 1–3

Method: PS-ADJ-2026.2. Source: 2026 certified export (July 18), with separate published 2025 depreciation schedules for historical comparisons.

## Implemented

1. Bounded comparison RPC returns selected-source market land including `ag_market`. It excludes `ag_use`, requires reported nonnegative components, and returns unknown for conflicting duplicate rows. No raw-table grants, bulk backfill or snapshot rewrite.
2. Replace sparse depreciation curves with 912 published average-condition class/age rows across 2025 and 2026, using each year's official class associations. Embed schedule IDs, PDF page numbers and source hashes; commit a reproducible extractor. Unsupported years are unknown. Actual physical condition remains unreported and average condition is visibly assumed.
3. Withhold property estimates when either property has additional valued, unknown-valued or living-area improvement records. Preserve reported inventory and areas, mark affected adjustment lines as not estimated, suppress the partial subtotal and exclude the comparison from the adjusted median. This is a conservative safeguard, not a validated replacement grouping formula.

## Frozen audit replay

The original audit froze 24 subjects, 72 directed comparisons and 96 distinct properties before calculating adjustment outcomes. A read-only source check obtained all 96 market-land inputs. Existing audit files are retained separately; downloaded property records are not committed.

- All 91 applicable class/age lookups agree with independently extracted 2026 published schedule rows.
- 65 prior estimates become 29 estimates. 40 pairs trigger grouping review, including four already lacking estimates; three additional pairs remain unavailable for other reasons.
- All three 1402 High Lonesome comparisons are withheld. Its $627,149 source improvement value and 1,492 sq ft additional living area remain visible. No $44,717 sensitivity discount is applied.
- For property 961924, market land is $2,165,525 instead of $95,000. Land differences against 961903, 961932 and 961927 are respectively −$215,270, −$293,360 and +$380. Changes relative to the old land differences are −$72,770, −$264,860 and +$95,380.

## Regression coverage and limits

Tests reproduce TCAD's ten equity worked grids, one general equity example and two sales examples. Added regressions cover schedule class/year binding, old-age terminal values, missing-year withholding, market-land parsing, grouping exclusion and feature-regrouping invariance of eligibility. SQL tests exercise both public roles, privacy gates, release isolation, inactive releases, input bounds, zero/missing/negative agricultural values and duplicate conflicts.

Official multiple-building worked grids and a nonzero neighborhood-adjustment reconciliation case remain unavailable. These changes do not establish official appraisal accuracy. Comparison ranking and large-adjustment quality thresholds (recommendations 4–5) are outside this release. Other pages' historical land projections are not rewritten by this bounded comparison fix.

Brand review: existing components, tokens, typography and keyboard controls retained. Important limitations are visible in the breakdown; no tax-savings or official-appraisal claim added.
