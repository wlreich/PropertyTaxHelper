# Property search and first property profile

This change adds partial-address search, a selectable list of results, and a property profile to the Next.js website. It follows the search → results → record interaction of [TCAD's property search](https://traviscad.org/propertysearch/) and [current search portal](https://travis.prodigycad.com/property-search).

## Search behavior

- Enter a street name, part of a street name, house number plus street, or a property ID. A single match remains visible as a result to select.
- Matching ignores case and common punctuation. Common suffixes and directions normalize (Street/ST, Road/RD, North/N); apartment and suite normalize to UNIT. It is substring matching, not typo correction or an autocomplete service.
- Address parts can omit a direction or suffix. Numeric parts match whole words, so house number 123 does not match 1234. A numeric token may also match a unit or ZIP in the address.
- At least one normalized address part must have three characters. Input is limited to 120 characters/eight parts. Broad searches stop after 250 pages and ask the visitor to narrow the address.
- Results contain up to 20 properties with Previous/Next navigation. Exact ID/address matches rank first, then address-prefix matches, then other matches. Stable address/ID ordering prevents duplicates across pages within the same release.
- The address, query, and page are in shareable URLs. Opening a property preserves the search for the back link. Enter and the Search properties button both submit the form; a standard GET form remains available without JavaScript.
- Missing records, no matches, invalid input, and service outages have distinct messages. No property results are fabricated if the database is unavailable.

## Data checks completed on September 8, 2026

Read-only aggregate checks used the ready 2026 certified dataset `2d8b3a87-c402-4630-8231-5a1f26597631`, from successful import [34233143920](https://github.com/wlreich/PropertyTaxHelper/actions/runs/34233143920).

| Check | Observed result |
|---|---|
| Property source rows | 493,324 |
| Property tax year | All 493,324 rows normalize from source `02026` to 2026 |
| Distinct property IDs | 493,246; none missing |
| Repeated property IDs | 31 IDs / 78 extra rows; different owners, no differing situs addresses |
| Repeated IDs with differing market amounts | 17 |
| Source rows with a confidentiality flag set | 25 |
| Rows without a street name | 2,001 |
| Rows without a house number | 26,409; street-only addresses can still be searchable |
| Improvement records | 454,986; all join to a property ID or UDI group for 2026 |
| Land-detail records | 445,450; all join to a property ID or UDI group for 2026 |

These are raw aggregate counts, **not** a claimed publication count. The final searchable count is measured after approved publication; filters overlap. No source property rows or owner details are included in this repository.

## Mapping and ambiguity

The projection emits one row per dataset/property ID, never one row per owner. It does not sum repeated owner values. A value is shown only when its source field is present and agrees across the property's rows. Shared ownership amounts and land area are withheld pending reconciliation, rather than presenting a fractional interest as a whole property. Conflicting addresses or UDI groups exclude the property until reviewed.

| Display field | Source field(s) |
|---|---|
| Address | situs_num, situs_street_prefx, situs_street, situs_street_suffix, situs_unit |
| City / ZIP | situs_city / situs_zip |
| Market / appraised / assessed | market_value / appraised_val / assessed_val |
| Land value | land_hstd_val + land_non_hstd_val, only when consistent |
| Improvement value | imprv_hstd_val + imprv_non_hstd_val, only when consistent |
| Land area | land_acres, only when consistent and not shared ownership |
| Improvement / land counts | Child records matching property ID **or** UDI group and the release year |
| Release chronology | Dataset tax_year, roll_stage, export_run_time_raw; no assumed timezone |

Counts of improvement records do not mean homes, bedrooms, or living area. This first profile does not calculate taxes, savings, comparable sales, or exemptions. It links to TCAD's current records and the original source release.

## Access and publication

The raw `tcad_ingest` schema remains private. The three new public tables contain only curated address/assessment data. RLS permits anonymous/authenticated SELECT of the current release only. Public RPCs run as the caller (`SECURITY INVOKER`); they never elevate access to raw records. All three confidentiality flags must explicitly be F; any other value excludes the property and linked shared group. Owner names, contact details, exemption information and raw JSON never enter the projection.

The administrator-only `tcad_ingest.publish_property_search(uuid)` function requires a ready dataset and all 20 completed text files. It builds from the raw records, deduplicates IDs, excludes confidential/unknown flags and conflicting addresses, and switches the active release atomically. Failure leaves the prior published release intact. Publication can be repeated in a new transaction without duplicating records. Loader and website roles cannot execute it.

A trigram GIN index supports partial matching. The request only queries the small curated projection, not raw JSON. Requests have a five-second client abort, page/input bounds, and no response caching. The declared function timeout is defense in depth; it is not a substitute for measuring real hosted query duration or platform-level rate controls.

## Review and activation order

**No hosted migration, publication or production deployment was performed while preparing this PR.** Repository instructions reserve production changes for Wendy's approval. Merging can trigger Vercel's production deployment, so complete the approval and database sequence before merging this PR.

1. Wendy reviews the PR and approves the database migration/publication and production website change. A visual preview is still required; the remote browser could not open this session's local server.
2. After approval, Codex applies `20260908162847_property_search_projection.sql` through the Supabase migration process and verifies its recorded migration version. It introduces `pg_trgm`, three tables, policies, and functions but does not itself publish any records.
3. Codex publishes the ready release using the database administrator connection in a dedicated transaction:

   ```sql
   begin;
   set local statement_timeout = '15min';
   select tcad_ingest.publish_property_search('2d8b3a87-c402-4630-8231-5a1f26597631');
   commit;
   ```

   Use a connection whose command timeout accommodates the operation. The 15-minute setting is a ceiling, not an estimated runtime. Publication is a separate projection build and does not rerun the county import. Do not use the restricted loader credential, expose an administrator credential to the website, or paste credentials in chat. No new website credential is required.
4. Codex verifies publication counts, RLS, representative search/profile RPCs as `anon`, and hosted timings before the website is released. Recheck the Supabase security advisor. If publication or latency fails, keep the current website release and fix the projection first.
5. Configure the **Preview** environment with the existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` if needed. Review partial addresses, a multiple-result search, page navigation and return links on desktop and a narrow/mobile screen. Inspect console/hydration errors, keyboard focus, loading, empty results, and unavailable states. Then merge/promote only with Wendy's approval.

The website already uses these two settings for the database health check; privileged keys and new database passwords are unnecessary. The site continues to request no indexing (`noindex, nofollow`), but that is not access control. Publication intentionally makes the approved, non-confidential curated fields readable through the database API.

For later releases, validate/import first, review confidentiality/quality results, then explicitly publish the new dataset. Publication is not automatically coupled to ingestion. A rollback can switch `property_search_state.dataset_id` to a previously reviewed release; never restore a record known to have become confidential. Old projections remain inaccessible to public roles unless deliberately selected.

## Reproducible checks

Use Node 24 (matching the website):

```sh
cd web
npm ci
npm run lint
npm test
npm run build
cd ..
npm ci --prefix tools/property-search --ignore-scripts
npm test --prefix tools/property-search
node tools/property-search/render-smoke.mjs
```

`Property search checks` runs these gates on relevant pull requests without any secrets. The SQL checks execute all repository migrations in a local PostgreSQL-compatible PGlite engine with the actual `pg_trgm` extension and synthetic data. They cover deduplication, ambiguity, confidentiality/unknown flags/shared groups, child relationships/year filtering, partial matching, paging, role permissions, inactive releases and publication rollback. The index check demonstrates index availability; it is not a hosted performance benchmark.

The rendered-page check starts the production Next.js build and synthetic RPC service together, then requests the home, result and profile routes. Browser interaction, visual layout and production-scale timing remain separate review gates. To inspect the synthetic app locally, run `node tools/property-search/preview-data.mjs` and start the website with `SUPABASE_URL=http://127.0.0.1:4055` and `SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture`; these dummy values are for local testing only.
