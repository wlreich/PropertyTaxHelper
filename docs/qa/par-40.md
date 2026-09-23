# PAR-40: persistent comparison breakdown

Implemented from main `fabbb64` on 2026-09-22 (America/Chicago). Scope is the comparison results layout and inspection state; calculation, matching, ownership and evidence-window modules are unchanged.

## Approved references and layout

Inspected Figma design context and screenshots before implementation: [1440 desktop](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=143-152), [1280 laptop](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=144-203), [390 mobile](https://www.figma.com/design/EdxFjIcxiEfKxM6gbwoW7o?node-id=145-235).

The results container switches at **64rem of available content width**: a 27.5rem detail column, 1.5rem gap and at least 35rem for readable comparison rows. With the comparison shell this is a 1104px viewport at the default text size. Container-relative sizing accounts for enlarged text; this is not device detection. Below 36rem viewport height, normal inline scrolling is also used. The site header is in normal flow, so the sticky pane uses a 16px top margin and at most the viewport height minus 32px.

One keyed detail region stays in DOM reading order directly after the inspected property. CSS places it in the right column when space allows. Switching properties preserves its DOM identity and page scroll while resetting factor scroll. Resizing neither duplicates nor remounts the region. The fixed header contains identity, values and Close; all factors, their inputs, disclosures and provenance remain reachable below it.

The comparison page uses the approved 1360px desktop content limit, with 40px desktop outer margins and the existing 18px mobile margins. Removing the redundant results-card inset gives mobile rows 354px at a 390px viewport (4px narrower than the static study to preserve the site's mobile shell). The shared site shell/header, subject summary, release controls, research dates and evidence notes retain their behavior. Approved semantic tokens, Manrope/Inter and the existing logo are reused. Intentional differences from the cropped static studies: all seven real factors and explicit incomplete-result qualifications are present, the actual property addresses replace mock values, and all method disclosures work. No new colors, assets, global defaults, calculation rules, migrations or third-party requests.

## State and accessibility

- Inspection is separate from the applied selection and lives above the draft editor. Cancel retains it; Apply clears it even when the chosen IDs did not change. The page boundary is keyed by subject, publication anchor, release, mode and applied IDs. Default recommendations and their explicit URL representation share the same key.
- A → B updates the same nonmodal region. Repeated A is idempotent. Reported/Adjusted, subject/release changes and changed selections cannot display an old inspection. Back and saved URLs still resolve their own selection and release.
- Controls expose address, expanded state and a valid region association. Explicit open/switch focuses the heading. Close and scoped Escape return focus to the matching trigger, with a comparison-heading fallback. Escape outside the region or in a control with its own Escape behavior is untouched.
- Methodology disclosures retain their state across resizing. The desktop factor region is keyboard-scrollable. Inline details use document scrolling. No dialog, inert background, focus trap, body lock or new per-click loading path.
- Existing PAR-39 ownership disclosures and PAR-32 coverage/date-window behavior are reused without changes.

## Verification

- `npm run verify`: passed, including all **117 unit tests**, guide source/PDF integrity, formatting, brand/contrast checks, lint, production build and type checking. Production build and the affected static gates were rerun after corrections.
- Focused browser suite: **16 passed, 11 intentionally skipped** across the existing 375/768/1440 projects. New journeys run once in the 1440 project and set the viewport explicitly, avoiding a redundant test matrix. Command: `npx playwright test --config=playwright.brand.config.ts '(comparison-pane|comparisons|[\\/]adjustments)\.spec\.ts' --workers=1 --reporter=list` from `web`.
- Desktop: closed → A → B → closed; stable region identity/page scroll; factor-scroll reset; idempotence; normal keyboard navigation; scoped Escape/focus return; Edit Apply/Cancel including removed property; mode/release resets; Back and subject navigation.
- Mobile: inline placement after the inspected property, switching, Close/focus, and open-disclosure/focus/DOM continuity across desktop/mobile resize.
- Rendered header totals, every signed factor amount, every input and each method explanation compared directly with existing `propertyAdjustments` output for ordinary, secondary-improvement, withheld and 2025 cases. Existing formula tests remain authoritative; no independent calculation implementation was added.
- Existing empty/one-property and ten-property selection-limit coverage reused. Mixed ownership-present/absent/unavailable fixtures passed in both modes and the detail region. The new long-address synthetic property stays outside the recommendation pool.
- Layout checks: 1440×1000, 1280×720, 390×844, 768×1000 and 1103/1105×900 on either side of the breakpoint. Full detail scroll range reached; no page overflow. Enlarged text checks include 200% at 375px with a secondary-improvement equation and 1280px reflow. Focused axe WCAG A/AA checks passed.
- Review corrected grid-track spacing and wrapping of the full equation at enlarged mobile text size. Initial test synchronization issues were corrected. Windows sandboxed browser assertions completed but process teardown stalled; the final suite ran with cleanup permissions and exited successfully.

Reviewed synthetic-data captures: [desktop 1440](par-40/desktop-1440.png), [short laptop 1280×720](par-40/laptop-1280.png), [mobile 390](par-40/mobile-390.png). The blue factor-region outline demonstrates keyboard focus. Screenshots are generated by `comparison-pane.spec.ts` and attached to its Playwright output. The PR/Linear record links the final CI/review/deployment outcome. CI and production publication are separate from this local verification; do not infer deployment from a successful local build.

Brand checklist: identity/assets, semantic typography/colors, clear value units, visible limitations/provenance, named regions, focus/touch access and responsive reflow checked. No monetization or free-core change. No private homeowner evidence or credentials were introduced.
