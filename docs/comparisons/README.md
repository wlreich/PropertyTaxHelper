# Property comparisons — first version

Route: `/property/:id/compare`. Current-source suggestions and manual address/ID search use the public snapshot projection. Homeowners can change published releases, select up to ten properties, and bookmark a URL containing only source and selected IDs. Reload resolves those IDs again against public records; no property records are stored in browser storage.

## Method and source

Comparison rules are based on TCAD's 2026 Sale and Equity Grids methodology. The tier criteria are transcribed in `web/src/lib/property-comparisons.ts`. Attribute the rules to TCAD and their applicable year; keep individual records requests and personal protest materials out of product copy.

Selection criteria and monetary adjustments are distinct. The published ingestion fields do not provide condition codes, state classification in the public snapshot, completion/eligibility checks, full replacement costs/depreciation, or neighborhood mass-adjustment inputs. The adjusted view offers a separate, explicitly labeled ParcelSavvy estimate from reported facts and independent local assessment patterns. It does not claim to reconstruct unavailable TCAD cost schedules.

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

### ParcelSavvy estimate v1

The grid carries one visible qualification; expanded rows show actual facts, rates, and assumptions. The estimate uses the selected release's fixed candidate pool, independent of the homeowner's selected set. Both subject and comparable are excluded from rate estimation. Changing the subject's assessed improvement value cannot change the comparable's estimate.

- Land: subject minus comparable reported land value.
- Size: living-area difference × (comparable market value − comparable land value) / comparable living area. This is an assessed, blended non-land rate including ancillary improvements, not replacement cost or a marginal construction cost.
- Class: equal known class codes assume zero. Otherwise use the ratio of median non-land unit values for each class among at least five peers per class, within 15% of subject size and three years of comparable age. No class ordering is inferred from codes.
- Year built: equal known years assume zero. Otherwise use the median log-unit-value slope across same-class local pairs within 5% of each other's size and 3–30 years apart. Peers are within 15% of subject size; use up to the nearest 80 by size (property ID tie-break), requiring eight distinct participating homes and six pairs. Apply exp(slope × subject-minus-comparable years) to the size- and class-normalized improvement value. This describes assessment patterns, not causal depreciation or inspected condition. Slopes may be negative.
- Matching market area assumes zero separate neighborhood adjustment. Different/unknown market areas or property types do not receive a complete estimate.
- Non-living details and additional improvements explicitly assume no **separate** adjustment; their value is carried in the blended base. Missing features are never asserted absent. Unpriced pools, outbuildings, renovations, and condition differences are disclosed in the main qualification and breakdown.

Numeric guardrails (ParcelSavvy limits, not TCAD rules): absolute annual log slope at most 0.05; class and age multipliers between 0.5 and 2; subject/comparable year difference at most 30. Unsupported rates remain unavailable, never clamped. Require positive area, positive non-land value, and one main building. Missing core facts remain unavailable. Independent peer sample counts are visible. The existing 2,000-record market-area scan cap remains disclosed in the comparison workspace.

Size and subsequent adjustments use unrounded base values, with each line rounded to cents before summing. Reported values and subject value stay unchanged. The median includes estimates with every model factor resolved, including explicit assumptions; it is not labeled a complete TCAD calculation. Subtotals without supported core factors are excluded. Counts and a paired reported median identify differing sets. Duplicates and the subject are excluded.

Tests cover adjustment direction, comparable-only size pricing, independence from subject assessment, observed age/class rates, sample thresholds, duplicate peers, unknown facts, incompatible properties, total and median arithmetic. Browser checks cover available and unavailable estimates together, formatting of units and years, keyboard expansion, bookmarks, releases, empty sets, accessibility, enlarged text and responsive layouts.
