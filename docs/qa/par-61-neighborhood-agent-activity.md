# PAR-61 neighborhood agent activity verification

## Active-release reconciliation

Read-only verification on September 25, 2026 used the published active pointer for T2450 (`2d8b3a87-c402-4630-8231-5a1f26597631`, exported July 18, 2026). The canonical neighborhood cohort contained 571 homes and completed eligible 2025 and 2026 preliminary-to-certified pairs.

- 2026: 371 homes with identified activity; 51 had no published agent name at the active cutoff.
- 2025: 316 homes with identified activity; 38 had no published agent name at the active cutoff.
- The 12 T2450 properties with different 2026 names across exports each resolved to one later nonblank name at or before the active cutoff. No latest-date conflict remained in this set.
- The top-five composition and the `Other agents` group were recomputed from the active release. No QA count is hardcoded in application code or fixtures as a production expectation.

The reconciliation was read-only. Data preparation and the unpublished August export were not used as the live source and were not a merge gate.

## Selection, normalization and ties

The RPC returns at most one assignment for each visible property and tax year. It uses the latest nonblank published name available at the active release cutoff. If two different normalized names occur on the same latest export date, the assignment is marked `ambiguous`; the page places it in `Agent name unclear` instead of choosing one.

Normalization is deliberately conservative: Unicode compatibility normalization in the model, trim, case folding, and removal of ASCII spacing and punctuation for the comparison key. A non-ASCII-only name keeps its folded text as a fallback instead of collapsing to an empty key. No corporate alias, representative-to-firm mapping, acquisition history, or inferred relationship is applied without source evidence. Display casing does not change the grouping key.

Named groups sort by distinct-property count descending, then normalized name ascending. This makes the fifth-place tie deterministic. A property is counted once per year. `Other agents (N)` reports the number of remaining normalized named groups, while `No agent identified` remains separate and does not mean owner-filed.

Reduction medians use only homes with valid paired values and a positive proposed-to-certified market-value reduction. Dollar and individual percentage medians are calculated separately from those homes; the reduced-home sample count is displayed. Missing pairs, unchanged values, increases, and zero denominators do not become zero reductions.
