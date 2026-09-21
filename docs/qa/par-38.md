# PAR-38 activity match evidence

September 21, 2026. Activity rows show the same shared match label and friendly description as comparison results, beneath address/property ID. Shared thresholds and primary-building refinement are unchanged. Missing inputs have an explicit unavailable state; complete nonmatches retain Review differences. Transaction evidence and price qualifiers remain separate.

Closest match sorts the complete eligible set before the five-row limit: tier/rank, newest activity, numeric property ID, stable record key. Nonmatches and unavailable inputs follow ranked properties. Default sorting stays newest. Filters, selected record IDs, CSV fields and property links are preserved. Expand/collapse labels identify the sort. Similarity is keyed to subject and appraisal release, independently of research dates; prior-year matching uses the existing qualification verbatim.

The new security-invoker RPC is a single POST per activity context. It reads the existing published snapshot allowlist and calls the existing scoped 32-ID cost helper in batches. The bound covers five annual activity sets (50,000 distinct IDs); no property is silently truncated. Active-release RLS, hidden/shared/parkland exclusions and private-ingestion restrictions remain intact. Costs never reach client props: only shared match labels, descriptions and rank do. A failed/unusable response leaves all activity rows visible with unavailable match information.

Focused validation:

- Three model/API tests cover shared description agreement, missing/no-subject/nonmatch states, a stronger candidate beyond the first five, deterministic ties, unavailable-last ordering, filtered and selected CSV parity, one POST, primary-building refinement, and rejection of stale subject/release payloads. Existing comparison threshold tests are reused.
- Two activity database tests cover existing transaction privacy plus batch-boundary completeness, selected-release joins, missing rows/values, comparison input parity, no raw access, newly hidden records and inactive publication.
- Local full website verification passed 113 tests plus lint/build/type/brand checks before the already-delivered PAR-28 merge; final required CI covers the combined branch. Final lint/build and rendered-page smoke passed.
- Focused browser suite: 10 passed, 8 intentional viewport skips. One desktop journey checks default/switch sort with a filter, retained selection, selected CSV records, property link and exact comparison description. One 375px journey checks keyboard sort/selection, axe and no overflow. Existing activity/date and comparison checks passed at their prescribed widths. Desktop and mobile synthetic screenshots were visually reviewed and are attached by the browser suite.

Brand: shared comparison classes, semantic colors, Inter/Manrope, text tier meaning, wrapped mobile descriptions and visible keyboard focus. No logo changes, new feeds/imports, valuation formulas or verified full Appraisal District-score claims. Match columns remain outside CSV/PDF scope. Production migration/deployment status and CI evidence are recorded in Linear when delivered; local evidence alone is not deployment.
