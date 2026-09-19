# PAR-5, PAR-6, PAR-8, PAR-7 implementation evidence

Date: September 19, 2026. Requested implementation order: PAR-5 → PAR-6 → PAR-8 → PAR-7.

Base commit: `a05c1b4` (main). Local branch: `codex/home-regression-par-5-6-8-7`.

## Publication status

Initial local checkpoint: automatic approval review blocked publication pending explicit approval. Wendy subsequently approved publishing this branch and its QA evidence to the public GitHub repository. Publication and browser verification are now proceeding; the results below remain the local checkpoint until a follow-up records completed browser checks. Do not mark the Linear issues Done before acceptance verification.

## Baseline reproduction

Observed at https://property-tax-helper.vercel.app/ in cloud Chrome on September 19:

- Full address `1104 Paw Print, Leander, TX 78641` produced no suggestions and no submitted matches; `1104 Paw Print` returned 736302.
- Activating the lower search CTA left focus on its anchor instead of the input.
- Selecting 1102 Paw via keyboard opened 736303; browser Back returned a blank input.
- Data & methodology led to the introductory trust section instead of methodology content.
- Results header text was visibly misaligned and the footer arrow was orphaned.

Baseline deployed commit was not verified. The local base commit above must not be represented as the confirmed deployed build.

![Before changes: result headings and footer](before-results.jpg)

## Implemented changes

| Issue | Changes | Verification still required |
| --- | --- | --- |
| PAR-5 | Shared contextual TX/Texas normalization at both server lookup boundaries; preserve city/ZIP constraints and legitimate Texas street names; inline trimmed blank validation; numeric-ID recovery guidance; service failures remain distinct. | Post-change browser suggestions, keyboard/mobile submission, blank no-request assertions, and no new console/hydration errors. |
| PAR-6 | Input focus from all three home search-entry links; reduced-motion-aware scrolling; draft stored only in current history entry, including clear; close popup/reset selection on restoration. | Browser Back/Forward, in-app return, refresh, pagination, delayed-response/clear races, keyboard and reduced-motion/mobile behavior. |
| PAR-8 | Dedicated /methodology using existing InformationPage; both footer variants link there; verified source inventory, values/caps/exemptions, comparison assumptions, recorded vs inferred protest evidence, no tax-savings promises; home date scoped to certified export. | Rendered accessibility/mobile/heading navigation, click-through and Back checks against the new build. |
| PAR-7 | Align header text using the shared baseline; keep external arrow with final word while allowing the label to wrap; retain tooltip hit target. | Text alignment ≤1 px, value alignment, tooltip pointer/keyboard/Escape, responsive widths and 200% enlargement; after screenshots. |

## Executed checks

- `npm ci` in web: passed.
- `npm run verify --prefix web`: passed. Formatting, brand, lint, 68 unit tests, production build, TypeScript.
- `npm test --prefix tools/property-search`: 33/33 passed, including publication/privacy/access controls and new actual-SQL address regression.
- `node tools/property-search/render-smoke.mjs`: passed. Home, suggestions API, matching, pagination, profile, return, neighborhood, printable report, missing/invalid states, CSS, and leakage assertions.
- Follow-up lint and typecheck after browser-test refinements: passed.
- New parser/service tests validate both RPC inputs, blank no-request behavior, legitimate Texas street names and query-specific guidance.
- New SQL fixtures exercise both actual search functions with the specified address variants, exact ID, typo, units, numbered streets, and negative cases. Financial fixture values are synthetic.

### Read-only live database checks

The normalized strings below were passed to existing deployed search functions. This verifies the database behavior for the new parser output, not deployment of the new application code.

| Query | Submitted result IDs | Suggestion IDs |
| --- | --- | --- |
| 1104 Paw Print Leander 78641 | 736302 | 736302 |
| 1104 Paw Print Leander | 736302 | 736302 |
| 736302 | 736302 | 736302 |
| 1104 Paw Print Houston 77001 | none | none |
| 1104 Paw Print Leander 99999 | none | none |
| 1905 West 36th Street Unit B | 799047 | 799047 |
| 1905 W 36 St #B | 799047 | 799047 |
| 1104 Paw Prnit | 736302 | none, as expected for exact typeahead |

The local SQL test separately confirms the typo is returned with `match_mode=possible`.

## Repeatable browser suite, not yet executed

`web/tests/brand/home-regression.spec.ts` adds eight tests to the existing `npm run test:brand-browser` suite. The existing pull-request workflow installs Chromium and captures reports/screenshots. Tests cover real local SQL fixtures, controlled delayed suggestion responses, clear and supersession, query/history, page-two return, focus, methodology, tooltip, measured text alignment, wrapping/overflow, and 200% text enlargement. Configured projects use 375, 768 and 1440 CSS px with reduced motion; the layout test additionally checks 320, 390, 1024 and 1363 px.

No new browser tests have run. Responsive emulation is not real-device validation. Real iOS/Android browser and assistive-technology checks remain unavailable in this environment. No latency SLA is claimed.

After approval: push this branch, open the PR, run the existing workflow, fix any failures, verify the preview against live records, capture after screenshots, update issue-specific evidence, and merge/deploy only after required checks pass under the repository's standing authorization.

## PAR-8 copy provenance and limits

- Read-only metadata from ready TCAD datasets: 2025 May 8 preliminary, July 3 interim (excluded as baseline), July 19 certified; 2026 April 2 preliminary and July 18 certified.
- Current public protest observations include dates April 29 and September 13, 2026, plus undated 2025/2026 supplements. These are observation/source dates, not protest event dates and not a universal valuation-current-through date.
- May 8 conflict exclusions and July 3 interim treatment verified against dataset valuation notes and `isPreliminaryBaseline`/history implementation.
- `docs/tcad-adjustment-method.md`, `web/src/lib/tcad-method.ts`, `property-adjustments.ts`, comparison UI and neighborhood/protest logic establish implemented formulas and limitations. No new model, sale prices or source values were invented.
- [Texas Comptroller: Valuing Property](https://comptroller.texas.gov/taxes/property-tax/valuing-property.php) and [Property Tax Exemptions](https://comptroller.texas.gov/taxes/property-tax/exemptions/) checked for definitions, homestead-limit qualification, exemption/taxable-value distinction.
- [TCAD official property search](https://traviscad.org/propertysearch/) checked. Internal reporting path already exists. External page availability was checked, not an end-to-end filing or record-correction process.

The inventory is explicitly dated September 19, 2026. Future ingestion should update that inventory and continue to show per-property source labels. Do not describe it as dynamically refreshed.

## Brand review

Uses existing logos, font system, semantic tokens, InformationPage and shared search controls. Keeps the approved home layout and compact result rows. Copy is homeowner-focused and distinguishes facts, inference, estimated inputs and taxes. No intentional brand exception. Automated brand checks passed; post-change browser visual/accessibility approval remains pending.
