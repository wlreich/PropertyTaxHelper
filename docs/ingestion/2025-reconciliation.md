# 2025 source reconciliation

## Reviewed July 3 full export

- Source: `2025 Preliminary Appraisal Export Supp 0_07032025.zip`.
- Dataset: `3dbefa41-a640-410f-8703-3b89fcc20aaa`.
- Archive SHA-256: `653d3628b8e3bef5912abebbb16afc47fef1f7bd18d952271f858f54d5261be1`.
- Export header: July 3, 2025 at 12:49; publisher roll label remains preliminary.
- Import workflow 35243824315 succeeded; all 21 archive members complete and manifest total 12,401,125 rows, including 487,025 Property rows.
- ARB has 138,861 unique 2025 properties. Of these, 112,220 are absent from the certified 2025 ARB file and 26,641 are present in both. This is a raw-source comparison, not the public eligible-home count.
- Deterministic sample: every 1,000th Property row plus properties 736302 and 830900. All 489 rows matched certified records; 395 market values were unchanged and 94 declined between July 3 and certification. Sample covers 327 neighborhood codes, including nonresidential records; it is not a countywide reduction estimate.
- Property 736302: July and certified market value $1,290,000, land $357,492, improvements $932,508; no July/certified ARB row or property protest flag. Absence does not establish that no protest occurred.
- Property 830900: July and certified market value $1,434,652, land $471,131, improvements $963,521.

## Interpretation

A publisher's preliminary roll label does not establish that every value is an original notice. This July release is retained as dated interim history, with its source label intact, and explicitly excluded from original-notice comparisons. No reductions before July 3 can be recovered by comparing July 3 with certified values alone.

The migration adds reviewed baseline-exclusion metadata and propagates it through both publication paths. Property summaries, prior-season outcomes, neighborhood cap/reduction metrics, and market-adjustment comparisons exclude flagged interim baselines. It does not suppress protest evidence or property characteristics. Earlier, eligible snapshots remain selectable when acquired. Existing privacy filters and public grants are unchanged.

## Special export: imported and reconciled

- `incoming/2025 Preliminary Special export Supp 0 07032025.zip` (3,488,064,271 bytes).
- Validation run 35266772822 passed on attempt 2 after an initial transfer ProtocolError. Import run 35268741042 succeeded; dataset `a87579fc-2e85-4f05-a3a5-3f384f8fce51` ready September 17 at 20:33:29 UTC.
- Archive SHA-256: `5b746b3d9d2cf2ab97d843f526d14586a6f7046be6b3d62a3c3e540b2b1f5ac1`; receipt SHA-256: `3ab05b2ee012d9524c5552731e8a73e8368718de9200f17a593972486700e55c`.
- Validated member `Travis-protaxExport-20250703.json`: 486,948 property coverage rows, 207,730 appeals for 207,644 properties, all 2025. The importer classifies this protest-only source as supplemental; the reported source filename remains intact. Member-date evidence is retained separately; the independently confirmed publication date is unknown.
- Compared with the July standard ARB file: 138,475 properties in both, 69,169 special-only, 386 standard-only. Keep both sources.
- Published 206,347 positive protest observations for eligible current properties; 68,217 add positive evidence beyond existing 2025 snapshot and protest observations. Missing special records do not negate other evidence.
- Property 736302 has a finalized informal appeal: initial appraised value $1,388,329; final appraised value $1,290,000; finalized timestamp June 21, 2025 at 10:07:18. The $98,329 difference is an appraisal-value change, not tax savings. Its notice-value field is zero and is not usable as a notice baseline. Property 830900 has no special appeal record.
- Public publication uses the existing positive-evidence projection. Private appeal values and decision details have not been added to the public API.

## May preliminary: validated, full load pending capacity review

- `incoming/2025 Preliminary Appraisal Export Supp 0_05082025.zip` (485,750,073 bytes).
- Validation run 35267680860 succeeded: all 21 members, 12,406,975 total rows, 487,068 Property rows. Export header confirms May 8, 2025 at 22:47, year 2025, format 8.0.0.30. No skipped members or validation failures.
- Archive SHA-256: `8f8d07b2fb6a5b088a03ef137b779fd9e3fb5fba5312339ad6525c76a9a9a977`; receipt SHA-256: `743a7ea834fcee0745039580214b3f65cf9690ba0f3326aa92c56b8701748ab3`.
- Uncompressed archive content: 16,123,317,696 bytes; serialized fields: 26,829,783,277 bytes. These are not PostgreSQL storage estimates. Current database usage after July publication and special import is approximately 53.0 GB decimal, plus 1.24 GB WAL; allocated disk capacity is not exposed by the connected tools, and the dashboard requires sign-in. Verify disk allocation/headroom before the next full county load.
- Once capacity is verified, dispatch `import` on main with the above hashes, tax year 2025, stage preliminary, encoding ascii. Compare its values with special appeal initial/notice values and later snapshots before treating it as an original-notice baseline. Earlier timing alone is not proof that every value is unchanged from notice.

## Publication and verification

- PR #73 merged as `72692f01e2c6cd3cc524f081c215d6bcb630a53e`; Vercel production deployment succeeded.
- Migration `interim_valuation_baselines` applied as database version `20260917200858` (repository file `20260917195021_interim_valuation_baselines.sql`). Existing July rows were annotated too; one publication batch already waiting during migration was re-annotated afterward.
- July snapshot job completed at 20:47 UTC: 491,220 current property IDs processed. Final verified total: 480,731 eligible history profiles, all carrying `preliminary_baseline_eligible=false`.
- July agent-name publication completed: 182,347 eligible names, with a zero-remaining-records completion check. No contact-directory fields were published.
- Web verification, database publication/access-control tests, importer checks, rendered-page tests, and responsive/accessibility checks passed. Search captures reviewed at 375, 768 and 1440 px; existing ParcelSavvy layout, typography and colors preserved, with no brand exceptions.
- Live property 736302 shows July's history explanation, unavailable original 2025 preliminary comparison, and 2025 protest recorded after special publication. Its 2026 market-adjustment estimate remains +$225,494. Live T2450 neighborhood remains 571 homes, with +$201,570 median estimated multiplier effect across 538 qualifying homes.
- The live 2025 certified T2450 view has 569 homes, 314 with protest activity identified, and correctly reports an incomplete preliminary comparison rather than treating July as original notices.

The active 2026 certified search release must stay active. These imports add history and evidence; they must not switch the site to a 2025 current valuation.
