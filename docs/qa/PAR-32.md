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

Local validation: npm ci; npm run verify (107 unit tests, lint/build/typecheck, brand/format/guide checks) passed. Focused activity/comparison tests: 12 passed. Render smoke passed. Browser/PDF validation and required GitHub CI will be recorded in the PR/Linear release evidence. The standard local Playwright browser download timed out; a temporary alternate browser runtime is being used outside the repository.

Brand review: shared tokens, existing fonts and approved logo retained; controls have visible labels and use the existing action style. No intentional brand exceptions. Final visual and production evidence will be recorded with delivery.
