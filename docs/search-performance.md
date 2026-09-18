# Search performance: September 18, 2026

This is the first change in the shared property-search PR. Keep the PR open and
do not apply its database migration until Wendy is ready to release the batch.

## Findings

Search reads `property_search_documents`, not the imported raw records or history
tables. The current projection still has 491,220 properties. Additional historical
imports have not multiplied search results or enlarged this projection.

Public-role query plans showed whole-table scans. The existing trigram index is
usable as the administrator, but LIKE predicates cannot move ahead of the release
RLS policy for a public caller. One read-only comparison returned the same 132
matches in about 167 ms as `anon` versus 5.5 ms as the administrator. Testing only
as the administrator therefore misrepresents the website's query performance.

HTTP requests from the investigation environment took roughly 6–9 seconds, but
even the landing page without a database search took 5.8 seconds. These timings
include environment/network/platform effects and do not establish a database-only
cause for all perceived latency.

## Change

Migration `20260918223337_indexed_numbered_property_search.sql` adds a B-tree on
dataset and bytewise normalized address. Searches with a house number use a range
containing precisely that house number plus its space separator. For example,
`1104 ` through (excluding) `1104!` includes `1104 PAW PRINT`, but excludes
`11040 …` and `1104A …`.

Separate UNION ALL branches let PostgreSQL use the property-ID primary key and
the address range even with a generic pooled query plan. Duplicate exact-ID rows
are excluded from the address branch. Both typeahead and submitted searches use
this path; numbered typo fallback does too.

RLS, SECURITY INVOKER, publication, active release, ranking, privacy exclusions,
parkland behavior, public response fields and pagination retain their existing
rules. No website UI/copy/assets change; brand and responsive presentation are
unchanged. Street-only matching still uses the existing substring/typo path and
can scan the projection. This is a scoped improvement, not a full-text search
redesign or an end-to-end latency guarantee.

## Reproduction

```sh
npm ci --prefix tools/property-search --ignore-scripts
npm test --prefix tools/property-search
node tools/property-search/benchmark-numbered-search.mjs 491220
```

The benchmark creates synthetic records locally, calls the actual before/after
RPCs as `anon` with RLS enabled and `force_generic_plan`, compares complete JSON
responses, and checks use of the new index. Timings are medians of three calls
after one warm-up per case. PGlite, synthetic address distribution and warm reads
differ from hosted PostgreSQL; measure production separately after release.

Observed local run with 491,220 synthetic properties:

| Query | Before (ms) | After (ms) |
|---|---:|---:|
| House-number suggestions | 265.26 | 3.31 |
| Exact-ID suggestions | 285.13 | 1.45 |
| Submitted numbered address | 378.03 | 43.65 |
| Submitted exact ID | 313.87 | 1.32 |
| Numbered address with one typo | 659.16 | 79.07 |
| Broad street suggestions matching every synthetic row | 2562.84 | 2556.57 |

All before/after responses matched. The deliberately broad street case shows
the remaining scan cost; it does not represent a typical selective street name.

Regression tests cover anonymous/authenticated callers, inactive-release
isolation, confidential records, ordinal/typo/unit matching, leading-zero IDs,
numeric boundaries, duplicate suppression, parkland handling and pagination.

## Release verification

Once the batch is approved, apply the migration through the normal Supabase
migration process. The ordinary index build permits reads but holds writes to
the search projection while it builds; do not overlap a publication. Its five
second lock-acquisition timeout avoids waiting indefinitely behind another
writer. Index build duration is not bounded by that lock timeout.

Check migration success and active dataset, then measure the RPCs as `anon`,
including numeric/address, street-only and typo searches. Verify the website's
typing suggestions, submitted search and property navigation separately. No
reimport, republishing, paid search service or new credentials are needed.
