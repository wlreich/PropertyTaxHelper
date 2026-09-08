# ParcelSavvy feature and PR checklist

## Identity and layout
- [ ] Read BRAND.md and COPY_GUIDE.md; the approved name and tagline are correct.
- [ ] Use BrandLogo and an approved, unaltered asset with clear space and minimum size.
- [ ] Use semantic tokens, Manrope headings and Inter body/interface text.
- [ ] One primary action; compact divided results; aligned values and explicit units.
- [ ] No dead navigation or claims about unbuilt features.

## Evidence and copy
- [ ] Every conclusion follows from available evidence; missing/withheld values are not zero.
- [ ] Source, year/stage and known date are present; unknown dates stay unknown.
- [ ] Values are not mislabeled as taxes; no invented history, confidence, comparisons or savings.
- [ ] Terms are explained where needed; important limitations remain visible.
- [ ] Ads/affiliate relationships, if approved, are disclosed at the relevant placement.

## Accessibility and responsive behavior
- [ ] Visible labels, sensible heading order, landmark/skip link and meaningful accessible names.
- [ ] Keyboard focus is visible and unclipped; links/buttons/checkboxes work without a mouse.
- [ ] Definitions work on hover/focus/touch and dismiss with Escape; color is not the only cue.
- [ ] Normal text meets 4.5:1; meaningful controls/large text meet 3:1.
- [ ] Review at 375, 768, 1440 px and 200% zoom; no horizontal overflow or clipped values.
- [ ] Touch targets are at least 44 px; reduced motion is respected.
- [ ] Check initial/results/empty/error/loading states, long addresses and large values.

## Completion
- [ ] npm run verify passes; database/rendered-page tests pass when relevant.
- [ ] Browser accessibility/layout checks run; review responsive captures before accepting visual baselines.
- [ ] Run brand:visual against reviewed baselines when present; never silently update snapshots.
- [ ] State what was run, passed, failed or blocked; do not claim visual verification from HTML tests.
- [ ] Summarize brand compliance and intentional exceptions; preserve original instructions.
- [ ] Follow the current user's publishing authorization; local preparation is not deployment.
