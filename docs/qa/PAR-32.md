# PAR-32: shared activity evidence windows

Base: f1a37acd9708a4d138419e3e2c3af97581e2716d. Figma 94:151 inspected through design context and screenshot. Implements the target-year/date controls from that concept; listing enrichment remains out of scope.

A shared validated target appraisal year and inclusive research window now feeds neighborhood activity, comparison deed clues, selected CSV exports and the existing neighborhood print route. Default dates are the preceding calendar year; post-season neighborhood preparation defaults to the next appraisal year. Explicit date choices survive comparison view, selection and release navigation. Assessment releases still control assessment values independently.

The existing annual anonymous RPC is reused, with at most five calendar years requested. No database migration, permission change, ingestion, new service, listing data or valuation formula change. Missing published years, temporary failures, partial coverage, deed/sale dates and source export dates remain distinct. Only a deed date inside the chosen window becomes a comparison deed clue, even if a sale date brought the transaction into the neighborhood list. Exact transaction keys deduplicate results. Selected records outside a property-type filter remain in the export; outside-window/unavailable selections are explicitly disclosed and excluded.

Production read-only preflight: the active public activity release has only 2026, appraisal export 2026-07-18 and supplemental export 2026-08-27. A 2026 target defaults to 2025 research and must show unavailable coverage. A 2027 target defaults to the partially covered 2026 window.

Coverage:
- Existing activity parser tests retain unknown/invalid-date, source privacy/allowlist, duplicate and price guardrails.
- Three PAR-32 cases in property-activity.test.mjs cover year/date validation; Jan 1/Dec 31 inclusivity; planned future end/partial coverage; missing vs failed years; deed/sale disagreement; deduplication; CSV and comparison parity; bounded reuse of published annual RPCs.
- Existing property-comparisons.test.mjs preserves prior-year defaults and no inferred prices.
- Existing activity browser test checks keyboard selection, responsive layout and CSV. One added desktop journey covers custom dates, selected/filter state, print/return, comparison view changes and unavailable prior-year coverage.
- The added print section is scope/shortlist parity only. PAR-29 still owns the broader neighborhood PDF pagination/redesign.

Local validation: npm ci; npm run verify (107 unit tests, lint/build/typecheck, brand/format/guide checks) passed. Focused activity/comparison tests: 12 passed. Render smoke passed. Activity keyboard/accessibility/responsive checks passed at 375, 768 and 1440 px. The custom-date/CSV/print/return/comparison journey passed with an alternate Chromium runtime outside the repository after the standard download timed out. Desktop/mobile screenshots and the added PDF shortlist were visually inspected: the changed section is readable, unclipped and matches dates/filter/selection. An existing methodology/disclaimer overlap above it remains part of PAR-29’s report-pagination scope. Initial CI exposed a date-application race and an obsolete dropdown-count assertion; shortlist controls now wait for date navigation, and the assertion checks the new form. Final required CI and production delivery evidence are recorded in PR #101 / Linear.

Brand review: shared tokens, existing fonts and approved logo retained; controls have visible labels and use the existing action style. No intentional brand exceptions. Visual review passed; production evidence is recorded with delivery.

Review hardening: date controls wait for hydration; excluded saved selections remain clearable; unavailable analyses skip activity work; the PDF link preserves dates/filter/selection. Unknown season context retains the current appraisal year. Current activity neighborhoods are resolved per property because historical groups can differ; latest responses are reused and remaining annual window loads are shared per active neighborhood. The three affected routes allow 90 seconds for the existing 15-second bounded calls (up to 60 seconds for neighborhood/print and 75 seconds for comparison), including rendering margin.
