# Property comparisons — first version

Route: `/property/:id/compare`. Current-source suggestions and manual address/ID search use the public snapshot projection. Homeowners can change published releases, select up to ten properties, and bookmark a URL containing only source and selected IDs. Reload resolves those IDs again against public records; no property records are stored in browser storage.

## Method and source

TCAD's 2026 Sale and Equity Grids methodology was supplied in a public-information response and reproduced in the owner's verified July 15, 2026 protest packet, Appendix D, pages 29–31. The private evidence packet is not copied to this repository. The tier criteria are transcribed in `web/src/lib/property-comparisons.ts`. The owner already verified the method during protest preparation.

Selection criteria and monetary adjustments are distinct. The published ingestion fields do not provide condition codes, state classification in the public snapshot, completion/eligibility checks, full replacement costs/depreciation, or neighborhood mass-adjustment inputs. This version does not infer them or calculate adjusted values.

Suggestions require the same published neighborhood and construction class, known living area/year, a reported market value, and a possible tier within the documented size/year tolerances. Class XX is excluded. Multiple living-area improvement groups produce unknown living area/class/year, rather than guessing the highest-valued building. Every match is labeled **Possible Tier**, never confirmed. Matching a higher-tier size/age tolerance does not establish its condition/class/exclusion requirements. Class-step ordering is not inferred from strings. All eight documented tiers and scoring deductions are visible under How the rules work.

ParcelSavvy orders suggestions by possible tier, absolute relative area difference, age difference, then property ID. This is explicitly a partial similarity ordering, not the complete TCAD score. The default selected set is the first three, and up to ten are suggested. The market-area scan is bounded at 2,000 records; larger areas display a limitation and allow manual searches. Searching uses the current public address index but returns values/facts only from the selected historical source. Confidential, shared, parkland, and unresolved-value records remain excluded.

## Median

Deduplicate selections by property ID, exclude the subject, omit missing values, preserve reported zero, and take the middle value (or mean of the two middle values for an even count). Dollar difference = subject minus median. Percentage difference = dollar difference / median; a zero median has no percentage. Show count, omitted values, and a small-selection qualification. Everything is labeled **before adjustments**, with no tax-savings/overassessment conclusion.

## Annual rollover

Every comparison uses one source dataset within the active published anchor. Available releases come from that subject's public history. Default source must match the active year/stage/export, with no fallback to unrelated records. Manual-search results reject a changed publication anchor and ask for reload. An indexed market-area lookup contains only snapshot keys and the neighborhood code, with the same public visibility policies as snapshots. Its migration seeds existing snapshots; an insert/update trigger and cascading deletion maintain future publications automatically, without a new preparation worker. Years other than 2026 explicitly disclose use of the 2026 criteria.

Future verified method revisions should update the versioned method definition and tests. A year-specific admin editor and adjusted-value calculations are outside this first version. Sales comparisons, Neighborhood, and Protest guide remain visibly unavailable.

## Verification

Unit cases cover medians and sign, missing/zero values, duplicates, inclusive tier boundaries, unknown facts, price-independent ranking, input bounds, and response allowlists. SQL tests cover anonymous/authenticated access, source isolation, missing history, private data, bounded inputs, and mixed-building facts. Browser tests cover entry from Overview, selection, bookmarking/reload, manual search, missing values, release switching, keyboard controls, accessibility, 200% text sizing, and 375/768/1440 layouts.
