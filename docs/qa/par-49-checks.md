# PAR-49 validation recovery and regression assessment

Reviewed September 24, 2026. PR #119; original head `a27c42a`.

## Findings

The workflow named **Property search checks** is the website's general validation gate. It runs on changes under `web/**` and related sources, not every repository PR. It covers build/types, unit tests, brand rules, guide integrity, database/access controls, rendered pages, comparisons, reports, accessibility, and guide browser flows.

The most recent 50 repository workflow runs contain 37 executions of this workflow across 15 branches (September 21–24): **32 passed, 5 failed**, all on their first run attempt. Median elapsed time was **5.03 minutes**. This is a bounded sample of runs, not a per-PR failure rate or proof of flakiness. Different commits on the same branch count separately.

| Failed run | Observed cause | Interpretation |
| --- | --- | --- |
| [35949295641](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35949295641) | PAR-49: old comparison sentence expected at three widths; A4 neighborhood report 4→5 pages and property report 8→9 | Stale copy assertion plus useful print-layout failures; all search cases passed |
| [35827994045](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35827994045) | Guide chapter keyboard test expected expanded state, received collapsed | Test can read pre-hydration state and send Enter before client initialization; add explicit readiness assertion |
| [35820683581](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35820683581) | Guide-entry test expected old navigation link wording | Stale copy expectation, subsequently corrected |
| [35794896955](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35794896955) | Long comparison-selection journey exceeded its 30-second test budget | Timing failure outside search; inspect behavior rather than assuming product failure |
| [35761014844](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35761014844) | Keyboard selection reached property 736083 instead of expected 736086 at three widths | Search-selection contract mismatch worth investigating; later search work corrected ranking/expectations |

The separate **Home page regression** workflow is currently **disabled manually** in GitHub. Its YAML describes PR, main, nightly and production-deployment checks, but those are not currently executing. This recovery does not change that setting or claim nightly coverage is active.

## Decision

Retain the existing PR gate and its search checks. The observed failures do not support disabling them, adding blanket retries, or raising every timeout. A five-minute gate caught actual print overflow in the affected feature. Keep exact page budgets here because the extra neighborhood page contained only trailing source notes, not meaningful new report content.

Preserve the workflow/job names and trigger paths, avoiding disruption to any external check references. Add an always-run summary that names each validation area and its outcome. Browser logs/artifacts identify the actual failing spec. Broader workflow splitting can be evaluated separately if runtime or failure evidence justifies it.

## Corrections

- Update the comparison assertion for the approved `other buildings` wording.
- Tighten repeated print explanations while keeping depreciation, land separation, recorded-value versus rebuilding-cost distinctions, source year, denominators and isolated-effect limitations. No font shrinking, row truncation, formula changes or page-budget relaxation.
- Wait for the guide's initialized `aria-expanded` state before keyboard interaction in the affected test. Keep the separate no-JavaScript behavior test. No guide content/PDF regeneration or PAR-50 implementation.
- Publish a validation-area summary even when an earlier step fails; do not mark skipped checks as passed.

## Verification

Local verification passed: comparison and market-factor browser cases at 375/768/1440, supported/unavailable states, keyboard/axe/reflow, narrow print/Back journeys, the corrected guide interaction at all four widths, and final property/neighborhood PDF tests. A4 budgets are restored to 8 and 4 pages; Letter budgets remain 7/9/9/1 for property fixtures and 2/5 for neighborhood fixtures. PDF text assertions retain inventory/history/shortlist rows, and rendered page review confirms readable values, source notes and page furniture. The full website verification command passed. Final CI/review/deployment links are recorded on PR #119 and PAR-49. Local browser setup uses an external temporary Chromium 153 binary because the standard Playwright CDN download was truncated in the executor; this does not change repository dependencies or CI browser configuration. Required GitHub checks use the pinned Playwright browser as before.
