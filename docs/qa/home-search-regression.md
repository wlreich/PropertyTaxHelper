# Home and search regression

This is the repeatable QA entry point. The `Home page regression` GitHub Actions workflow executes Playwright against synthetic data and the public deployed site. Application changes for the September 19 findings are being developed separately in Linear PAR-5, PAR-6, PAR-7 and PAR-8.

## Active-development cadence

| Trigger | Checks |
| --- | --- |
| Relevant pull request | Synthetic home/search, Chromium at 375, 768 and 1440 CSS px; existing Property search checks still run independently |
| Relevant merge to main | Synthetic suite at all three Chromium widths, Firefox desktop and WebKit at mobile width |
| Successful Production deployment | GET-only smoke against `https://property-tax-helper.vercel.app` at 375 and 1440 px |
| Every night, 08:17 UTC | Full synthetic browser matrix plus deployed smoke (03:17 CDT / 02:17 CST) |
| Actions → Home page regression → Run workflow | Same full synthetic matrix and deployed smoke, on demand |
| Weekly and before a release | Human review of screenshots, all copy/alignment, real mobile keyboard, screen reader and remaining manual cases |

The nightly schedule becomes active once this workflow is on `main`. GitHub schedules can be delayed, and public-repository schedules can be disabled after 60 days without repository activity. Check the Actions page for a recent run; this is regression testing, not uptime monitoring. GitHub's own Actions notification settings determine who receives failure notifications. No Slack/email messages or automatic Linear issue creation are configured.

Deployment events are limited to the verified Vercel `Production` environment. The public alias is intentionally used because immutable preview/deployment URLs can require authentication. The report records the triggering deployment SHA, but does not claim that a mutable alias is an immutable build. If another deployment occurs during a run, rerun against the settled alias. No Vercel bypass credentials are needed.

## Run locally

Use Node 24. From the repository root:

```bash
npm ci --prefix web
npm ci --prefix tools/property-search --ignore-scripts
npm run build --prefix web
cd web
npx playwright install --with-deps chromium firefox webkit
npm run test:home
# Fast targeted run:
npm run test:home -- --project=chromium-1440
# Deployed read-only checks; no local server/database required:
npm run test:home:smoke
# Review the reports:
npx playwright show-report home-report
npx playwright show-report smoke-report
```

`HOME_BASE_URL=https://your-public-origin.example npm run test:home:smoke` selects an alternate HTTPS origin. The synthetic suite always starts the existing local fixture RPC and a production Next build on loopback ports 4055 and 3058; it cannot switch to a deployed database through HOME_BASE_URL. Those ports must be free. No production keys are used. Browser downloads/system dependencies are required locally; GitHub's Ubuntu runner installs them automatically.

## What runs automatically

The home config reuses `tests/brand/search.spec.ts`: main copy/branding, initial/results/fuzzy/empty states, real synthetic address normalization, keyboard suggestion selection, tooltips, source display, support/information links, axe checks, 200% font enlargement and horizontal overflow. `tests/regression/home.spec.ts` adds text inventory, dialog dismissal/focus, ID identity, source labels, drilldown/Back, invalid/overlong input and end-of-pagination recovery.

`tests/regression/search-timing.spec.ts` adds deterministic timing and failure checks:

| Case | Contract |
| --- | --- |
| T01 | Configured 300ms debounce; a rapid burst dispatches only the final query |
| T02 | Short input and clear-before-debounce dispatch no request |
| T03 | An older request returned after the newer request cannot overwrite suggestions |
| T04 | Clear during an in-flight request keeps suggestions closed |
| T05 | HTTP 503, malformed payload and network failure preserve manual search; editing recovers |
| T06 | Equivalent normalized query reuses cache; Escape dismisses and retains focus |
| T07 | A held search navigation exposes busy/disabled state, then settles to the correct results |

These IDs name automated contracts; they are not a claim that every similarly numbered row in the historical manual catalogue is automated. Synthetic data tests exercise the existing database migrations through the fixture harness. Live smoke checks real property identity 736302 and address 1104 Paw Print, numeric-ID search, unmatched search, suggestions, drilldown/Back, mobile-width layout, axe and uncaught JavaScript errors. Live cases do not freeze market values, ordering or source dates that can legitimately change. Requests other than GET/HEAD/OPTIONS are blocked in the live browser context.

## Timing interpretation

Controlled debounce/race tests use the Playwright clock and held responses; they do not rely on arbitrary sleeps or production latency. Live reports attach observed suggestion and submitted-search durations. Timers stop only after query-specific results/empty state are visible. Suggestions include debounce. Each test uses a fresh browser context; server/CDN cache state is unknown.

Initial review targets are 1s suggestions and 3s fresh-session submit. Exceeding them adds a `performance-review` annotation; the 10s availability assertion is a hard failure. This low-volume smoke is not a percentile study. Use the extended protocol in `manual-regression-plan.md` for at least 20 repetitions per query/cache class, p50/p95/max, controlled CPU/network and comparison with a reviewed baseline. Do not report these few nightly samples as p95 or silently relax thresholds to obtain green runs.

## Reports and failure handling

Open a run in GitHub Actions and download `home-regression-<run>-<attempt>` and/or `home-smoke-<run>-<attempt>`. Reports include HTML, JSON, JUnit, responsive captures, current home text, measurements, screenshots on failure and retained failure traces. Artifacts expire after 14 days. Retain selected release evidence longer when needed. There are no automatic retries, expected-failure annotations, skipped known defects, or automatic visual-baseline updates in the new tests.

For a failure: inspect the first error and trace, identify fixture versus live failure, reproduce the named test, then record the deployment/run link, viewport, expected/actual behavior and evidence in the owning Linear issue. Fix an app defect or a demonstrably incorrect test; a rerun alone does not resolve a reproducible defect. A live outage/data change and a synthetic regression should be triaged separately. PR workflow failure reports are visible checks; branch-protection requirements must be configured separately if these are to be enforced as merge gates.

## Manual coverage and known findings

`manual-regression-plan.md` preserves the full protocol. `baseline-2026-09-19/regression-cases.csv` is the historical 75-case result, not today's status. Start each human run from `run-template.csv`; do not overwrite the baseline. Evidence filenames in that baseline refer to the original dated QA package, not files in this repository.

| Remediation | Known findings | Automation handoff |
| --- | --- | --- |
| PAR-5 | Full pasted address with TX; whitespace-only submit; ID-specific empty wording | Owning fix must add normalization/validation/empty-copy assertions against its final contract |
| PAR-6 | CTA focus; restoring home typeahead query after Back | Owning fix must add focus and suggestion-origin navigation regression assertions |
| PAR-7 | Result heading alignment; footer arrow wrapping | Owning fix must add geometric assertions and reviewed captures at affected widths |
| PAR-8 | Methodology destination/content | Owning fix must verify destination meaning and source/limitations copy |

Passing this automation does not close those issues or certify all 75 manual cases. It adds coverage around the current application without weakening existing tests or asserting proposed app behavior before its separate fix lands. As each fix lands, include its spec in the home config when necessary and remove the corresponding manual coverage gap after verification.

Screenshots and text inventories are review evidence, not automatically approved visual baselines. Human review still covers semantic copy correctness, all text baselines/gutters/wrapping, the known alignment defects, actual iOS/Android keyboards, real screen-reader announcements, 400% zoom/text spacing, multi-page boundary datasets, timeout/rate-limit recovery, and statistical performance. WebKit at 375px is an engine/viewport check, not a real iPhone certification. Existing axe and 200% font checks do not replace those checks.

## Sources

- [Playwright configuration](https://playwright.dev/docs/test-configuration)
- [Playwright clock](https://playwright.dev/docs/clock)
- [GitHub workflow events and scheduled runs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
