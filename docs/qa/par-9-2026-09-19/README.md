# PAR-9 recovery and verification — 2026-09-19

PR: https://github.com/wlreich/PropertyTaxHelper/pull/82

## What was repaired

The original PR constructed an ISO export date by slicing a US-format raw timestamp. On properties without detailed history, date formatting threw `RangeError: Invalid time value`, removing the property page and its search-return link. Raw export dates now support validated ISO and month/day/year forms; invalid or absent dates remain unknown. A focused regression covers the original sparse property and query/page preservation.

Current assessment selection now compares property-specific release chronology, including same-day corrections and newer preliminary years, while preserving withheld values. Missing values are never replaced by another release's values. The hero distinguishes prior-year changes, comparable proposed-to-certified changes, pending outcomes, recorded protest evidence, possible inferred protest evidence and identified agents.

## Figma review and scope

Inspected the approved full frame [2:130](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=2-130) and primary hero [3:12](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=3-12) using design context and screenshots.

Implemented PAR-9's header, three-route property navigation, navy current-assessment hero, subsequent section links, context/donation card and dated source information. Reused BrandLogo, shared header/footer, semantic tokens, Manrope/Inter, definitions and existing destinations. Intentional brand adaptations: approved logo artwork, existing accessible text colors and 12px card-radius token, rather than the mockup's text wordmark and 16px radius. Secondary context action remains visually subordinate per brand guidance.

**This is not full-page Figma approval.** The detailed cap/value-driver/property-detail redesign belongs to PAR-10; the annual chart/table redesign belongs to PAR-11. Their existing working sections remain on the same page. Both issues remain separate, pending work.

The private Figma reference screenshot was inspected but is not republished here. Automatic approval review rejected public upload of that private design asset; use the linked Figma frames for the reference. Application screenshots are included below; reference images remain in Figma.

## Published-data check

Read the existing public RPCs under the anonymous database role for property 736164 (3709 LAJITAS), without modifying the database. The 2026 certified record dated July 18 reports market $1,575,313 and assessed $1,377,354. The 2025 certified baseline reports $1,365,039 and $1,252,140 respectively. Changes are +$210,274 / 15.4% and +$125,214 / 10.0%. The eligible April 2, 2026 preliminary market value matches certification, so the proposed-to-certified reduction is $0. These agree with the Figma example. A narrow frozen fixture for this single public property is in `tools/property-search/par9-reference-fixture.mjs` for repeatable browser comparison. It includes only published profile/history fields and this property’s market adjustment; no owners, credentials or bulk records. The complete RPC response remains temporary. This is a replay of captured public data, not a claim that the protected deployed preview was browser-tested.

## Local validation

- Dependency install: passed (Node 24.19.0).
- `npm run verify --prefix web`: passed, including format, brand, lint, 72 unit tests, build and typecheck.
- `npm test --prefix tools/property-search`: 33 passed.
- `node tools/property-search/render-smoke.mjs`: passed, including the original search-return failure.
- Local Playwright: blocked by unavailable Chromium and download timeout. No local responsive/accessibility pass is claimed.
- GitHub browser checks: see the dated run links below. GitHub successfully installs Chromium, so the local browser-install limitation does not block CI verification.

Automated cases cover raw/malformed dates, missing comparisons, newer preliminary years, later corrections, withheld values, rising/falling/unchanged values, absent homestead, pending outcomes, recorded/inferred protest evidence and named agents. Browser assertions cover hero order, 1200px desktop width, subject-preserving links, source date, keyboard section links, enlarged text, accessibility and search Back/Forward state.

## Acceptance evidence

| Area | Evidence |
| --- | --- |
| Shell, navigation and hero | Browser tests at 375, 768 and 1440px check hero order, three property routes, section keyboard navigation, 1200px desktop content and meaningful destinations. |
| Assessment chronology and season | Unit tests exercise newer preliminary years, same-day corrections, absent next-year data and preliminary records during post-protest season. Calendar dates never manufacture certification. |
| Amounts and narrative | Reference property 736164 reproduces Figma values; synthetic properties cover recorded protests/identified agents, inferred reduction, no record, pending certification, no cap and sparse data. Missing values remain unavailable. |
| Context, donation and sources | Links retain subject ID; donation uses existing support route; displayed export date comes from selected record; shared footer and source disclaimers remain. |
| Responsive and accessible | Axe checks, keyboard links, tooltip positioning, 200% zoom and overflow assertions run in Chromium. Final run outcome is recorded below. |
| Home compatibility | 81 Chromium tests passed at three widths in [home run 35461519393](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35461519393), including restored query/page and initial pageshow timing. |

## Application screenshots

Captured in GitHub Actions from the committed application and a frozen replay of public property 736164. These are application renders, not Figma exports or screenshots of the protected Vercel deployment. Source: [run 35461519391](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35461519391), application commit `d5c6f3c3064dd6e264e87d308b010e474f5e4b1a`. All three reference-property cases passed in that run; its separate 200% zoom failure was subsequently repaired. The normal-width captures remain representative; later changes only add wrapping at enlarged text sizes and clarify unavailable protest records.

| Width | Hero | Context/donation | Full page |
| --- | --- | --- | --- |
| 1440 | [Hero](reference-1440-hero.png) | [Context](reference-1440-context.png) | [Page](reference-1440-page.png) |
| 768 | [Hero](reference-768-hero.png) | [Context](reference-768-context.png) | [Page](reference-768-page.png) |
| 375 | [Hero](reference-375-hero.png) | [Context](reference-375-context.png) | [Page](reference-375-page.png) |

Visual review: the navy hero, headline, metric columns, reference amounts, context actions and donation hierarchy agree with the PAR-9 portions of the approved frame, with the brand adaptations above. Metrics stack on mobile; labels remain readable. Full-page captures show existing PAR-10/PAR-11 sections, not their future redesign.

## Remaining limitations

- The [Vercel branch preview](https://property-tax-helper-git-codex-linear-mentio-e3bb17-wlreich-3996.vercel.app/property/736164) redirects to Vercel sign-in in this browser session. Authenticated deployed-preview verification remains blocked. Access controls were not changed.
- The private Figma screenshot could not be published publicly because automatic approval review rejected that upload. Figma was successfully inspected; linked frames plus application screenshots provide the review evidence.
- PR workflows run Chromium at three widths. Firefox/WebKit and deployed home smoke are separate main/nightly/manual checks, not claimed here.
- PAR-9 remains In Progress and the PR remains draft pending deployed-preview/review completion; PAR-10 and PAR-11 remain separate work.

## Passing recovery checks

Application commit: `4d2c6db37493a527e3c7949c364d6702a112f0e3`.

- [Property search checks — run 35462190382](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35462190382): **passed**. Includes format, brand, lint, 72 unit tests, build, typecheck, market-factor parser tests, 33 database tests, rendered-page smoke and **75 Chromium browser tests**. The 375px / 200% zoom regression now passes.
- [Home regression — run 35461815748](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35461815748): **81 passed**, on `3f99650350c8ac98fa0744501b4a56970312e949`. The subsequent application change only adds wrapping to the property context card; GitHub reports the Home page regression workflow was manually disabled at 18:43 UTC, so no home run was triggered for later commits. That setting was preserved; the 81-test pass is evidence for the earlier commit, not a final-head home run.
- Vercel reported the recovery branch deployment successful. This is build/deployment status, not authenticated browser verification.

This evidence commit adds documentation and screenshots only. Current PR checks are the authoritative status for its final head; prior failed runs remain historical evidence of the issues corrected above.
