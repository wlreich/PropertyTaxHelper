# Repeatable ParcelSavvy home + search regression, v1.0

## Purpose and boundary
Run after any change to the home page, search parser, autocomplete, search API, result layout, shared navigation/footer, styles, or source-release selection. This suite covers home → search → correct property → return to results. It does not certify all property calculations, all TCAD records, legal text or security. Reconcile source data separately. Keep this suite versioned with the project when integrating it into the build workflow.

## Start every run
1. Record run ID, UTC start/end, tester, base URL, deployment/commit if available, suite version, browser/version, viewport/device, network profile, active phase, source year/release/export timestamp, and known issues.
2. Use a stable deployment for the duration. Check for a deployment change at the end; split the run if the build changes. Do not treat different deployments as one timing sample.
3. Open a new browser context. Record whether browser cache is fresh. Backend cold/warm state is separate and may be unknown. Do not claim to force server cold starts by clearing browser cache.
4. Validate fixtures against the current selected source. Preserve identity assertions; refresh year-specific value expectations only after independent data validation. Never weaken expectations just to turn a failure green.
5. Copy run-template.csv, preserving every test ID. Enter PASS, FAIL, PARTIAL, BLOCKED, NOT RUN or NOT APPLICABLE. Record evidence and defects; never count an unrun case as a pass.

## Fixtures
| Query / identity | Purpose | Baseline observation, not permanent value assertion |
|---|---|---|
| 1104 Paw Print / 736302 | Address/ID equivalence, normalized inputs, full address | 2026 certified $1,285,275 |
| 1102 Paw Print / 736303 | Latest-query and keyboard-selection identity | Opened correct property |
| 1402 High Lonesome / 736086 | Second prefix for rapid switching | Prefix 1402 High also returned 122005 (1402 THE HIGH RD); do not assume only one result |
| 1905 W 36 St Unit B / 799047 | Unit B versus unit A | 2026 certified $771,983 |
| West 36th Street / W 36 St | Synonyms, ordinal, multi-page results | First ID 121385; 38 results over 2 pages in this release |
| zzzzqaunmatched999 / 999999999 | Address and ID no-match paths | Empty results; keep sentinel validity under review |
| Approved parks / nominal-value / missing-data fixtures | Exclusion and null handling | Must be supplied from authoritative data before these cases can pass |

## Execution levels
- **Smoke, every build (~10–15 minutes once automated):** all rows tagged Smoke. Includes exact/ID, pasted full address, fuzzy, no match, keyboard and mouse suggestions, rapid edits, pagination, property return and footer methodology.
- **Full regression, before release (~60–90 minutes manual, excluding extended timing/device lab):** every row in regression-cases.csv. Run desktop plus device/browser matrix. Retest all known findings.
- **Extended timing and resilience, after search/data/infrastructure changes:** run the protocol below and controlled failure/race cases in an isolated environment. Record real duration rather than treating estimates as an SLA.
- **Production post-deploy smoke (~5 minutes):** base page, exact ID/address, suggestion selection, result return and support link destination. Low request volume; no test feedback or payment transaction.

## Timing protocol and proposed internal budgets
These are proposed product targets, not existing service commitments or measured percentile results. Confirm them with the team and version changes. A warm cache hit must be reported separately from a request that reaches the server.

| Measure | Start → end | Proposed target / handling |
|---|---|---|
| Typed input feedback | Key event → painted input value | ≤100 ms in normal profile |
| Pending feedback | Submit → visible/programmatic loading indication | ≤150 ms when work remains pending |
| Debounce | Last key event → suggestion request dispatched | Agreed 250–350 ms interval; verify configured value, not an assumed constant |
| Suggestions | Last key event → correct final options painted | Warm p95 ≤1 s; fresh-session p95 ≤2 s |
| Submitted search | Click/Enter → correct result/empty state painted and usable | Warm p95 ≤2 s; fresh-session p95 ≤3 s |
| Slow mobile profile | Same end-to-end measures | Suggested p95 ≤5 s; no stale rows or frozen controls |
| Long wait / timeout | Submit or request → recovery | Helpful still-working notice by 5 s; bounded timeout and retry by 15 s, subject to agreed service behavior |
| Race correctness | Ordered input + deliberately out-of-order completion | Zero stale-result wins; final query alone controls selection and navigation |

1. Use instrumented browser automation in the repository/CI with supported network interception. Set network/CPU profiles explicitly (record actual bandwidth, latency and CPU factor; do not use a label such as Slow 4G without its configuration).
2. For each query class (exact address, ID, broad multi-result, fuzzy typo, no-match), run at least 20 warm repetitions. Use separate fresh-context repetitions for first-use behavior. Record backend cache state as unknown unless measured.
3. Timestamp in one clock domain. End on the expected query-specific content and enabled controls, not merely navigation, a successful HTTP response, an old heading, or a spinner disappearing. Collect request count, response status, duration, result identity and any errors.
4. For suggestions test fast (50 ms), normal (150 ms) and slow (500 ms) inter-key intervals. Measure both debounce delay and server/network/render latency. Confirm one final request for a fast burst and cancellation/ignore behavior for superseded queries.
5. Delay A, enter B, return B then A; assert B remains. Repeat with clear, Escape, Enter while pending, route change, and unit/ID inputs. Hold these tests to zero stale-selection tolerance.
6. Inject 500, 429, network disconnect and timeout separately for autocomplete and submitted search. Assert explicit errors, retained query, useful retry, and recovery. Never run artificial traffic/fault injection against production.
7. Export raw measurements. Report sample count, p50, nearest-rank p95, maximum, error rate and stale-result count by query/environment/cache class. Preserve outliers and failed requests; never silently drop them. Investigate >20% regression versus a comparable baseline even if the absolute target passes.
8. Initial-render metrics, input responsiveness and layout shift require dedicated instrumentation; this live run did not capture LCP, INP or CLS. Add these to the build dashboard if instrumentation is available.

## Visual and text regression
- Capture approved baselines for home top, question/support section, footer, suggestions (loading/one/eight/none), results (one/many/fuzzy/empty), pagination, tooltip and dialog.
- Use 320, 375/390, 768, 1024 and 1440 CSS widths plus actual iOS/Android keyboard states; desktop Chrome/Edge/Firefox and Safari. Record real device/browser versions.
- Compare all headings, body text, labels, buttons, helper messages, source dates, currency, disclaimers and footer text. Check left gutters, shared baselines, consistent line height, card padding, column edges, wrapping, orphan icons, focus outlines and disabled/loading-state widths.
- Verify 200% zoom, 400% reflow and increased text spacing. Check contrast and target sizes with appropriate tooling. A screenshot is not proof of screen-reader usability.
- Dynamic data may change. Mask only explicitly approved volatile values in visual snapshots; never mask source-year, phase, property identity, missing labels or known defect areas.
- Compare against copy-review.csv and home-copy.txt. The latter is a captured inventory, not a requirement to preserve every old word. Approved copy changes require intentional baseline updates.

## Release gates
- P1 = high-priority core-flow defect; P2 = material usability/content defect; P3 = polish or lower-impact inconsistency. Priority is not a claim of outage.
- No new P1 defects, zero wrong-property or stale-result navigation, smoke complete, known P1 normalization defect resolved or explicitly accepted by the product owner.
- Required device, accessibility, recovery and timing checks must pass for a full release sign-off. If unavailable, status is incomplete, not passed. Document a scoped waiver if the owner chooses to release.
- P2/P3 items need an owner and intended disposition. Verify fixes with their acceptance criteria plus the smoke suite; rerun the entire suite only when affected scope warrants it.

## Automation handoff
Use stable role/name locators where possible. Add stable test IDs only where repeated content prevents unambiguous selection. Split tests into independent fresh contexts; do not rely on the previous test's navigation. Parameterize BASE_URL and source fixtures. Use query-specific expected content and URL together to avoid passing on stale results. Use route mocking only in the isolated fixture environment. Store traces and screenshots on failure; include test ID and deployment in filenames. Data checks should verify IDs and selected release, not fragile rank unless ranking is a requirement.

This package contains a repeatable manual/agent test specification and templates. It is not an installed CI job or an executed automated Playwright suite.

## Reusable invocation
“Run ParcelSavvy Home + Search Regression v1.0 from this package against [BASE_URL], deployment [ID]. Execute [Smoke/Full/Extended]. Read known findings and current data fixtures first. Verify the home page and all copy/alignment, suggestions, search relevance, timing, empty/error states, pagination and return navigation. Use the specified browser/device/network matrix. Record PASS/FAIL/PARTIAL/BLOCKED/NOT RUN honestly with test IDs, evidence, timings and reproducible findings. Do not change application code or submit real feedback/payments. Save a dated report, populated results CSV and raw evidence, compare to the prior run, and report the release gate.”
