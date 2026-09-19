# PAR-11 annual history — implementation and QA

PR: https://github.com/wlreich/PropertyTaxHelper/pull/84

## Delivered behavior

Annual history stays on the property overview. Certified market and assessed values share a dynamic zero-based scale; preliminary-only years have table rows without invented certified bars. One row per actual loaded year separates certified annual changes from within-year preliminary-to-final changes. The initial display includes up to the latest five years, with older loaded chart/table entries available through “Show earlier years.” Expanding a year preserves the current assessment and shows valuation details, authority-specific exemptions, protest/agent evidence and source dates.

No archive ingestion, database changes, baseline relaxation, or secondary-dwelling calculation changes were needed. Missing amounts, missing prior years and unavailable certification are not zero or “Unchanged.”

## Design review

Retrieved and inspected design context and screenshots for [full overview 2:130](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=2-130) and [annual history 4:5](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=4-5).

The implementation follows the approved hierarchy, paired horizontal bars, direct currency labels, gap summary, aligned numeric columns and compact expandable rows. Chart geometry is generated from actual values rather than reusing static example artwork. Narrow screens stack labeled table fields and put exact values below their bars. The chart's endpoint ticks correspond to its calculated maximum, including zero.

Brand adaptations reuse existing Manrope/Inter typography, 32px/16px section spacing, approved card radii and semantic Action Blue/Success colors. Success green is used as an accessible second chart series, with named legend entries and exact accessible text/table values; it is not a claim of tax savings. Expanded details reuse existing disclosure/card styling. Private Figma images are linked, not republished in the public repository.

## Live data verification

Read-only checks against the existing public `property_history` function verified the approved reference property's preliminary and certified snapshots, earliest eligible baseline, excluded interim source, and consistent results for normalized property IDs. The prior year's annual change remains unavailable when no immediately preceding certified record is loaded. Within-year comparisons remain separate from annual certified changes. These checks did not mutate the database.

The frozen reference fixture exercises existing public RPC behavior. Synthetic cases exercise empty, one-year, five-year, six-year, nonconsecutive, preliminary-only and property-conflict histories; no production archives were imported.

## Acceptance evidence

| Criteria | Evidence |
| --- | --- |
| 1–2: design, annual chart, certified-only values | Reference capture at 375/768/1440 px; exact chart labels, zero tick and scale bounds; preliminary-only 2027 has no certified bar |
| 3: separate comparisons and missing data | Unit/reference browser assertions for the calculated annual change, unavailable prior-year annual change, and unchanged within-year values |
| 4–5: correct eligible baseline | May-vs-July selection test, property-conflict fixture and unchanged database conflict/publication/access-control tests; live normalized-ID verification |
| 6: verified reference-year values | Read-only source check and exact unit/browser assertions |
| 7: inline yearly detail | Keyboard expansion/collapse; source dates, land/improvements, exemptions and protest details; current-assessment content preservation assertion |
| 8: extensible years | 0, 1, 2, 5, 6-year and nonconsecutive fixtures; earlier-year chart/table expansion, newest-first ordering, unique years |
| 9: obsolete controls/notes removed | No fixed year count, superscripts, preliminary source footnote, full-history link or coming-soon text |
| 10: alignment, accessibility, reflow | Right-aligned desktop column edges; semantic table and named disclosure buttons; axe, 200% text/zoom, chart-label separation and viewport bounds |

## Validation

- Node 24.19.0 dependency install passed.
- Website verification passed: 83 unit tests, lint, format, brand, production build and typecheck.
- 33 property-search/database tests passed, including privacy/publication rules and property-specific baseline conflicts.
- Render smoke passed, including search, property, neighborhood, compare, printable report and confidentiality behavior.
- Browser validation: **93 passed**, including axe, keyboard interaction, 375/768/1440 px, 200% enlarged text and 200% zoom. [Passing run 35467439496](https://github.com/wlreich/PropertyTaxHelper/actions/runs/35467439496), application/test commit `bae07fd068588e04028f73d0c56d422dc86023df`. Both annual market-factor parser tests also passed.
- Initial runs revealed a stylesheet-loading race in the test's rendered-text comparison; the stable-content assertion now tests whether expanding history changes the assessment data. Screenshot review also caught a wrapped endpoint tick; axis labels now remain intact, labels scale with enlarged text, and the regression checks label separation.

## Preview and limits

[Vercel preview](https://property-tax-helper-git-codex-par-11-assess-103bf3-wlreich-3996.vercel.app) was deployed but redirected this browser to Vercel sign-in. Direct deployed-preview browser verification remains blocked by authentication. The automated suite verifies the production build with frozen public/synthetic fixtures; it does not establish access to that protected preview.

No pixel-diff baseline was silently accepted. The existing disabled home schedule was not changed; the property-search workflow runs the existing home/search/property regression suite. This is implementation/PR evidence, not a production deployment claim.

## Visual evidence and publication limit

Nine application captures from the passing run were visually reviewed against the linked Figma reference: collapsed history, expanded annual details, and a synthetic six-year history at 375/768/1440 px. The expanded detail layout follows existing application styles.

Automatic approval review rejected a screenshot upload because it contained identifiable property and assessment details. No screenshot files are included in this QA commit. Publishing those images requires explicit user approval; the visual review itself is complete. Private Figma screenshots are not republished.
