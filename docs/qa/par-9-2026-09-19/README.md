# PAR-9 recovery and verification — 2026-09-19

PR: https://github.com/wlreich/PropertyTaxHelper/pull/82

## What was repaired

The original PR constructed an ISO export date by slicing a US-format raw timestamp. On properties without detailed history, date formatting threw `RangeError: Invalid time value`, removing the property page and its search-return link. Raw export dates now support validated ISO and month/day/year forms; invalid or absent dates remain unknown. A focused regression covers the original sparse property and query/page preservation.

Current assessment selection now compares property-specific release chronology, including same-day corrections and newer preliminary years, while preserving withheld values. Missing values are never replaced by another release's values. The hero distinguishes prior-year changes, comparable proposed-to-certified changes, pending outcomes, recorded protest evidence, possible inferred protest evidence and identified agents.

## Figma review and scope

Inspected the approved full frame [2:130](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=2-130) and primary hero [3:12](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=3-12) using design context and screenshots.

Implemented PAR-9's header, three-route property navigation, navy current-assessment hero, subsequent section links, context/donation card and dated source information. Reused BrandLogo, shared header/footer, semantic tokens, Manrope/Inter, definitions and existing destinations. Intentional brand adaptations: approved logo artwork, existing accessible text colors and 12px card-radius token, rather than the mockup's text wordmark and 16px radius. Secondary context action remains visually subordinate per brand guidance.

**This is not full-page Figma approval.** The detailed cap/value-driver/property-detail redesign belongs to PAR-10; the annual chart/table redesign belongs to PAR-11. Their existing working sections remain on the same page. Both issues remain separate, pending work.

The private Figma reference screenshot was inspected but is not republished here. Automatic approval review rejected public upload of that private design asset; use the linked Figma frames for the reference. Application screenshots will be included with the browser evidence.

## Published-data check

Read the existing public RPCs under the anonymous database role for property 736164 (3709 LAJITAS), without modifying the database. The 2026 certified record dated July 18 reports market $1,575,313 and assessed $1,377,354. The 2025 certified baseline reports $1,365,039 and $1,252,140 respectively. Changes are +$210,274 / 15.4% and +$125,214 / 10.0%. The eligible April 2, 2026 preliminary market value matches certification, so the proposed-to-certified reduction is $0. These agree with the Figma example. Full public RPC responses were retained only temporarily for local verification, not committed.

## Local validation

- Dependency install: passed (Node 24.19.0).
- `npm run verify --prefix web`: passed, including format, brand, lint, 72 unit tests, build and typecheck.
- `npm test --prefix tools/property-search`: 33 passed.
- `node tools/property-search/render-smoke.mjs`: passed, including the original search-return failure.
- Local Playwright: blocked by unavailable Chromium and download timeout. No local responsive/accessibility pass is claimed.
- GitHub browser checks and screenshots: pending on the published recovery commit.

Automated cases cover raw/malformed dates, missing comparisons, newer preliminary years, later corrections, withheld values, rising/falling/unchanged values, absent homestead, pending outcomes, recorded/inferred protest evidence and named agents. Browser assertions cover hero order, 1200px desktop width, subject-preserving links, source date, keyboard section links, enlarged text, accessibility and search Back/Forward state.
