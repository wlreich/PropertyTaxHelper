# Property comparisons — first version

Route: `/property/:id/compare`. Current-source suggestions and manual address/ID search use the public snapshot projection. Homeowners can change published releases, select up to ten properties, and bookmark a URL containing only source and selected IDs. Reload resolves those IDs again against public records; no property records are stored in browser storage.

## Method and source

Comparison rules are based on TCAD's 2026 Sale and Equity Grids methodology. The tier criteria are transcribed in `web/src/lib/property-comparisons.ts`. Attribute the rules to TCAD and their applicable year; keep individual records requests and personal protest materials out of product copy.

Selection criteria and monetary adjustments are distinct. The published ingestion fields do not provide condition codes, state classification in the public snapshot, completion/eligibility checks, full replacement costs/depreciation, or neighborhood mass-adjustment inputs. These inputs are not inferred. The adjusted view calculates the supported land-value difference and shows the other factors as inputs needed. No complete estimate is published from partial inputs.

Suggestions require the same published neighborhood and construction class, known living area/year, a reported market value, and a possible tier within the documented size/year tolerances. Class XX is excluded. Multiple living-area improvement groups produce unknown living area/class/year, rather than guessing the highest-valued building. Every match is labeled **Possible Tier**, never confirmed. Matching a higher-tier size/age tolerance does not establish its condition/class/exclusion requirements. Class-step ordering is not inferred from strings. All eight documented tiers and scoring deductions are visible under How the rules work.

ParcelSavvy orders suggestions by possible tier, absolute relative area difference, age difference, then property ID. This is explicitly a partial similarity ordering, not the complete TCAD score. The default selected set is the first three, and up to ten are suggested. The market-area scan is bounded at 2,000 records; larger areas display a limitation and allow manual searches. Searching uses the current public address index but returns values/facts only from the selected historical source. Confidential, shared, parkland, and unresolved-value records remain excluded.

## Median

Deduplicate selections by property ID, exclude the subject, omit missing values, preserve reported zero, and take the middle value (or mean of the two middle values for an even count). Dollar difference = subject minus median. Percentage difference = dollar difference / median; a zero median has no percentage. Show count, omitted values, and a small-selection qualification. Everything is labeled **before adjustments**, with no tax-savings/overassessment conclusion.

## Annual rollover

Every comparison uses one source dataset within the active published anchor. Available releases come from that subject's public history. Default source must match the active year/stage/export, with no fallback to unrelated records. Manual-search results reject a changed publication anchor and ask for reload. An indexed market-area lookup contains only snapshot keys and the neighborhood code, with the same public visibility policies as snapshots. Its migration seeds existing snapshots; an insert/update trigger and cascading deletion maintain future publications automatically, without a new preparation worker. Years other than 2026 explicitly disclose use of the 2026 criteria.

Future verified method revisions should update the versioned method definition and tests. A year-specific methodology admin editor and the remaining monetary formulas await verified input mappings. Sales comparisons, Neighborhood, and Protest guide remain visibly unavailable.

## Verification

Unit cases cover medians and sign, missing/zero values, duplicates, inclusive tier boundaries, unknown facts, price-independent ranking, input bounds, and response allowlists. SQL tests cover anonymous/authenticated access, source isolation, missing history, private data, bounded inputs, and mixed-building facts. Browser tests cover entry from Overview, selection, bookmarking/reload, manual search, missing values, release switching, keyboard controls, accessibility, 200% text sizing, and 375/768/1440 layouts.

## Adjustment view

`?view=adjusted` opens the approved adjusted-comparison layout. Reported values remain the default selection workspace. The toggle, Edit comparison set action, saved selections and release changes preserve one consistent source. The reported property value remains visible and unchanged.

`property-adjustments.ts` computes land = subject land value minus comparable land value. If the comparable reported value and both land values are present, the breakdown shows the land-adjusted subtotal and its exact inputs. Missing land, missing reported value, invalid numbers or negative subtotals produce an unavailable result. Matching class codes, areas or market areas never manufacture zero adjustments for unsupported formulas. Non-living details and additional improvements are separately accounted for so neither can disappear from completeness checks.

Living area, construction class, depreciation, non-living details, additional improvements and neighborhood calculations currently remain unresolved for every public comparison. Full estimates and the adjusted median therefore display Not available in the current data. Partial subtotals are never included. This is an explicit first stage, not a reproduction of TCAD’s complete adjusted grid. Future formula adapters must supply every applicable factor, an explicit verified zero where appropriate, and calculation provenance before using the completeness aggregator; there is no public override or user-entered adjustment interface.

The aggregation utility deduplicates comparables, excludes the subject, requires complete finite results with reported values, and calculates the median plus subject-minus-median dollar and percentage differences. Zero median has no percentage. Each summary identifies its count; when the complete subset differs, a paired reported median makes that distinction visible. The 2026 method is labeled separately from the selected record year, with a non-2026 applicability qualification.

Adjustment tests cover signs, zero versus unknown, incomplete and duplicate factors, missing source values, negative outputs, median arithmetic, and changing subsets. Browser checks cover partial breakdowns, keyboard expansion, selection editing, bookmarks, release switching, empty selections, accessibility, enlarged text and responsive screenshots. Completed examples in unit tests are synthetic and are never supplied to public pages.
