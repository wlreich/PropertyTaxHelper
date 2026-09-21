# PAR-37: source-confirmed vacant lots in residential discovery

Prepared September 21, 2026, against main 7212f772361d534ef61ae4eeaf4d7674dcdd2afa.

## Source evidence and root cause

Read the loaded 2026 certified release `2d8b3a87-c402-4630-8231-5a1f26597631` through read-only database queries. Both reported IDs were present in `suggest_property_parcels('high lonesome',8,false)`. Public `R` means real property, not residential; the current discovery predicate only excludes explicit parkland.

| Property | Verified source evidence | Outcome |
| --- | --- | --- |
| 736081 | HIGH LONESOME; $660; Property and LandDetail state C1; no Improvement record; not explicit parkland | Exclude from address discovery |
| 736083 | HIGH LONESOME; $1,520,591; A1 land/improvement; Improvement type 01, 1 FAM DWELLING | Preserve despite missing house number |
| 736086 | 1402 HIGH LONESOME; A1; two 1 FAM DWELLING records | Preserve |

The same release's StateCode dictionary defines C1 as VACANT LOT / VACANT LOTS AND TRACTS and A1 as SINGLE FAMILY RESIDENCE. No claim is made that 736081 is a right-of-way or park. Public submitted `high lonesome` search paginates; its first page contains eligible homes including 736086. Actual source-backed fields are sanitized into the fixture; owner/contact data are not copied.

## Implementation and coverage map

1. Source-backed reproduction: `residential-search-fixture.mjs` and the PAR-37 test in `home-regression.test.mjs` reproduce 736081 appearing before migration, then verify its removal after migration. Both upgrading existing publication and publishing fresh data are covered.
2. Eligibility: source C1 with no improvement excludes; A1/A2/A4/B2 and unknown/null classifications stay; missing descriptions and low/zero assessed values stay; contradictory Improvement child evidence stays. Existing $35 parkland/non-parkland cases are reused. No price cutoff or house-number requirement.
3. Before limits: 25 excluded prefix matches precede 25 eligible homes. Actual SQL returns 8 suggestions and 20 first-page results, then 5 results, without excluded IDs or ordering changes. Exhausted next page remains empty.
4. Parity/fallback: street-first, numbered address, typo fallback, all-ineligible empty states, parkland toggle and exact ID tested against real SQL functions. Existing input normalization/number boundaries/access-control tests retained.
5. Browser journey: existing home suite extended with one PAR-37 test; type street, keep unnumbered residence 736083, choose 736086 by keyboard, verify destination, submitted results and direct ID. The fixture server runs the actual changed SQL; it does not mock prefiltered responses. Existing full-address/Back/keyboard journeys reused.
6. Performance: `node tools/property-search/benchmark-residential-search.mjs 491220` compares actual old/new RPCs on 491,220 synthetic records, as anon with RLS and force_generic_plan; median of three warm samples after one warm-up. Existing number-prefix index remains in the EXPLAIN plan. This is local PGlite evidence, not production latency.

| Query | Before ms | After ms |
| --- | ---: | ---: |
| House suggestions | 3.11 | 2.69 |
| Selective street suggestions | 275.25 | 271.98 |
| Exact ID suggestions | 1.32 | 1.68 |
| Numbered address | 42.11 | 37.01 |
| Exact ID search | 1.71 | 1.30 |
| Numbered typo | 91.75 | 78.50 |

## Delivery limits

No production migration has been applied. Automatic approval review rejected publishing prepared code to the existing GitHub repository and requested explicit user approval for that destination. Required remote CI and post-deployment live verification therefore remain pending. Do not mark this ticket Done until publication, migration, CI and live checks are complete.

The migration takes the existing publication advisory lock, prepares classifications before acquiring the projection ALTER lock, preserves invoker functions/RLS/field allowlists, and changes discovery only. It must not overlap another publication. It adds no service, paid resource, confidential data or access grants. Brand/UI components are unchanged.

## Completed local checks

- `npm ci` for web and database harness: passed.
- `npm run verify` in web: passed, including 104 unit tests, lint, build, typecheck, brand/format and guide checks.
- `npm test --prefix tools/property-search`: 36 passed; migration backfill refinement then verified with the two focused home SQL tests (both passed).
- Existing home/search Playwright suite at desktop 1440px: 28 passed, including timing/debounce/race/error coverage and PAR-37 keyboard journey. Local Chromium executable used; no cross-browser or production timing claim.
- Targeted benchmark and indexed-plan assertion: passed, values above.
- `git diff --check`: passed.
