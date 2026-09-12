# Neighborhood population, second pass

The Neighborhood page calls `property_neighborhood_v2`. The original endpoint remains compatible with the previous website during deployment.

## Population

Start with published, visible properties in the subject's selected-release market area that have residential R1–R6 first-, second-, or third-floor details. Existing confidentiality, shared-ownership, value-review, and parkland restrictions remain enforced.

Include A1 improvement classification, positive property-level improvement value, and market value at least $1,000. Type codes come from the selected release's Property records, using a visibility-checked, bounded private-schema helper. An inconsistent or missing improvement State Code stays unverified. Identical duplicate classifications do not multiply properties.

Exclude, in order, zero improvement value (land-only valuation), unverified type, other type, unavailable improvement value, and unusable market value. Each excluded public property has one reason. No source records are deleted. These are suitability checks, not assertions that excluded values or reductions are erroneous. Selected-release membership can change between releases; earlier paired records do not establish unchanged property characteristics.

An A1 improvement with a different land code stays included when it meets the remaining requirements. Construction class, home size, homestead status, and multiple residential buildings do not themselves disqualify an A1 property. Publication still requires existing source visibility checks.

## Area and percentages

Whole-property market value is divided by the total recorded area of positive-valued residential floor details across buildings. Floor codes are 1ST, 2ND, and 3RD with R1–R6 classes. Zero-valued floors are omitted. Missing floor value, area, or improvement ID makes the area unavailable; no missing value becomes zero. Garages, porches, and other details are not counted as living area. This is separate from the primary-building area used on the comparable-property page.

All three headline percentages use the same included-property count. Within each protest-table column, percentages use all included properties in that column. Cap counts explicitly say verified; unresolved cap status is disclosed. Conditional cap percentages retain their distinct meaning in expanded coverage details. Missing preliminary/certified pairs are disclosed and never classified as unchanged. Average reductions still use reduced properties only.

## Validation

2026 certified T2450: 574 residential-floor candidates, 571 included, three land-only exclusions (830878, 830922, 861583), one retained land-code mismatch. All 571 have usable area; 31 have positive-valued residential floors across multiple buildings (the prior 32 count included a zero-valued secondary floor record).

Recomputed median market value: $1,341,357. Median neighborhood value per square foot: $342.7138836772983. Observed reductions: 343; recorded protests: 273. The 77 verified cap crossings remain unchanged. Average reduction: $185,558.2274 (12.2212%, averaging individual reduction percentages).

The eight unresolved cap combinations are outside this population change; their special homestead/non-homestead loss treatment still needs reconciliation. They remain included in the neighborhood population and explicitly unverified for cap outcomes.

Tests cover release-specific classifications, land-only and other-type exclusion, mixed land-code retention, multiple buildings, zero-valued floors, missing area, duplicate protests, common headline denominators, malformed responses, and private-source access. No private fields or raw-table grants are added.
