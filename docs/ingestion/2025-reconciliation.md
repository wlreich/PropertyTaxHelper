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

## Additional sources in progress

- `incoming/2025 Preliminary Special export Supp 0 07032025.zip` (3,488,064,271 bytes). Validation run 35266772822: initial transfer failed with ProtocolError; one retry started. No interpretation of its contents until validation succeeds.
- `incoming/2025 Preliminary Appraisal Export Supp 0_05082025.zip` (485,750,073 bytes). Validation run 35267680860 queued. Candidate earlier baseline; verify values and header before use.

The active 2026 certified search release must stay active. These imports add history and evidence; they must not switch the site to a 2025 current valuation.
