# PAR-10 implementation and QA — 2026-09-19

PR: https://github.com/wlreich/PropertyTaxHelper/pull/83

## Scope and behavior

Replaced the oversized value cards and scattered detail sections with the approved cap, value-driver and property-detail sections. The cap calculation uses the selected authority's own recorded exemptions and taxable value. Conditional copy distinguishes binding, nonbinding, unconfirmed eligibility, no recorded homestead and unavailable information. No simulator or new appraisal-limit calculation was added.

Land and improvements use the immediately prior certified year. The multiplier effect reuses the existing validated service and is explicitly separate from actual improvement-value change. Building classification, secondary-dwelling calculations, source ingestion and PAR-11 history design are unchanged.

Property details show four evenly spaced facts, construction/neighborhood context, two feature highlights and all recorded feature types in an accessible disclosure. Missing amounts are not zero; missing details are not physical removal; newly listed details are not proof of new construction; duplicate matches are withheld. Official record links include the property ID and displayed year.

## Figma and brand review

Design context and screenshots were retrieved and inspected for [full page 2:130](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=2-130), [cap 3:22](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=3-22), [drivers 3:176](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=3-176) and [details 3:184](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=3-184).

Adaptations use existing brand tokens: 32px desktop/16px mobile section padding, approved card radii and accessible colors, Manrope headings/metrics and Inter body text. Fact labels remain explicit; dropdown and disclosure targets are at least 44px. The authority selector and full feature disclosure provide acceptance-criteria functionality beyond the static Figma example. The primary comparison action uses the existing route.

Private Figma reference images are not republished in the public repository. Compare the application captures below with the linked design frames. This review covers PAR-10's three sections, not PAR-11's history redesign.

## Published reference data reconciliation

Visited the official Appraisal District search and opened property 736164, year 2026: https://travis.prodigycad.com/property-detail/736164/2026. Verified market $1,575,313; cap adjustment $197,959; assessed $1,377,354; land $384,639; improvements $1,190,674. The prior certified improvement value is $980,400, yielding a $210,274 increase. School exemptions total $203,000 in the published fixture, reconciling to official taxable value $1,174,354.

All five published authority values match the official record: Travis County $956,614; Healthcare District $904,883; ACC $1,288,580; Leander ISD $1,174,354; City of Leander $1,353,580. County exemptions total $420,740, distinct from school exemptions. The captured validated multiplier result is 1.46× → 1.78× with estimated effect +$214,054, distinct from the actual +$210,274 improvement change.

The browser reference fixture replays previously captured anonymous public RPC data. No owners, private credentials or bulk records were added. Synthetic IDs 999010–999013 exercise large values, long text, nonbinding cap, no recorded homestead and missing records.

## Validation

- Node 24.19.0; dependency install passed.
- `npm run verify --prefix web`: passed; 77 tests, lint, format, brand, production build and typecheck.
- `npm test --prefix tools/property-search`: 33 passed, including publication/access controls and market-factor reconciliation.
- Existing secondary-dwelling unit tests pass, including $627,149, ownership by improvement ID, and additional-building values counted once.
- `node tools/property-search/render-smoke.mjs`: passed.
- `git diff --check`: passed.
- [GitHub Actions run 35464829439](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35464829439): all checks passed at application commit `d4b67d26e2a76712a69a44ab3eba467f393cbb2d`. Chromium: **84 passed**, covering 375/768/1440 px, keyboard behavior, authority selection, accessibility, long text/large values, 200% enlarged text and narrow 200% zoom. The two annual-factor parser tests also passed.
- First browser run caught narrow 200% zoom overflow and a callout button overlap during screenshot review. Fixed grid shrink behavior, flexible currency columns, wrapping and button layout; added an explicit paragraph/button non-overlap assertion.
- The prior multiplier test used a snapshot with TEST01 and an adjustment for T2450. The revised test verifies mismatch suppression and the verified property 736164 factor result separately; neighborhood aggregate coverage remains intact.

## Acceptance evidence map

| Criterion | Evidence |
| --- | --- |
| Authority-specific calculation | Reference arithmetic unit test and browser authority switch; all five authorities reconcile |
| Exemptions, taxable values and unknowns | Visible compact lists, keyboard disclosure, null/zero/inconsistent-data tests |
| Approved cap callout and CTA | Binding-state assertions, reference captures and property-specific comparison link |
| Conditional cap guidance | Binding/nonbinding/no-homestead/unconfirmed/missing-data tests; prior assessed base assertion |
| Compact drivers and preserved methodology | $210,274 actual vs. $214,054 estimate assertion; existing comparison/database suite |
| Dynamic facts and features | Pool/spa plus full 12-feature disclosure; removed/new/null/duplicate tests and long-name synthetic case |
| Alignment and reflow | Three widths, enlarged text, narrow 200% zoom and screenshots |
| Official link and details | Live district record visited; URL assertion, authority and methodology keyboard checks |

Developer reference reviewed: [Texas Comptroller, Valuing Property](https://comptroller.texas.gov/taxes/property-tax/valuing-property.php), residence-homestead limitation section. Existing eligibility/data rules and recorded assessments remain authoritative; no next-year assessed value is invented.

## Preview and limits

Vercel reported the preview deployment Ready. Attempted browser review of https://property-tax-helper-git-codex-par-10-cap-dr-dd774d-wlreich-3996.vercel.app/property/736164 redirected to Vercel sign-in. Direct deployed-preview browser verification is blocked by authentication. The repeatable browser suite tests the production build against frozen public and synthetic fixtures; it does not establish that protected preview access succeeded.

The home workflow was previously disabled manually and was not re-enabled. No approved pixel-diff baselines were created or silently accepted. Existing property/search/compare browser checks run in the property-search workflow.


## Reviewed application screenshots

| Section | 375 px | 768 px | 1440 px |
| --- | --- | --- | --- |
| Cap and exemptions | [Mobile](cap-375.png) | [Tablet](cap-768.png) | [Desktop](cap-1440.png) |
| Value drivers | [Mobile](drivers-375.png) | [Tablet](drivers-768.png) | [Desktop](drivers-1440.png) |
| Property details | [Mobile](details-375.png) | [Tablet](details-768.png) | [Desktop](details-1440.png) |
| Long feature / large value stress | [Mobile](long-features-375.png) | [Tablet](long-features-768.png) | [Desktop](long-features-1440.png) |

Captures come from the passing run above. Compare the three reference sections with the Figma frame links; the long-feature case is synthetic layout stress. No new pixel-diff baseline is claimed.
