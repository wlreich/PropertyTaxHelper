# ParcelSavvy brand reference

The approved source is [ParcelSavvy_Brand_Guide.pdf](ParcelSavvy_Brand_Guide.pdf), version 1.0, September 2026, supplied by Wendy. Its hash is recorded in assets.sha256.json. This document set translates all 19 pages into development rules.

- **BRAND.md**: strategy, identity, visual standards, token contract and implementation decisions.
- **COPY_GUIDE.md**: voice, terminology and screen-specific writing rules.
- **UI_CHECKLIST.md**: feature/PR completion checklist.
- **assets.sha256.json**: locked source PDF, vector logo extracts and licensed font files.
- **VERIFICATION.md**: execution results and limitations for this implementation.

Root AGENTS.md automatically directs future Codex tasks to the brand references; web/AGENTS.md repeats the pointer for UI tasks. Components and tokens are the implementation source of truth; the approved PDF governs design intent. A conflict should be documented and resolved explicitly, not silently replaced with a new theme.

## Development commands

From web/:

- `npm ci`
- `npm run verify` — brand checks, ESLint, application tests, production build and type check.
- `npm run test:brand-browser` — real-browser accessibility, font/color/layout assertions, functional search/filter/tooltip checks and screenshots at 375, 768 and 1440 px. Install Chromium with `npx playwright install --with-deps chromium` in a supported test environment first. Uses local synthetic data only.
- `npm run brand:visual:update` — create/review candidate screenshot baselines.
- `npm run brand:visual` — compare against approved committed baselines. First requires baselines; do not treat missing baselines as a passing regression check.

From repository root: `npm ci --prefix tools/property-search --ignore-scripts`, `npm test --prefix tools/property-search`, `node tools/property-search/render-smoke.mjs`.

The normal property-search CI workflow includes brand checks and browser steps that uploads responsive screenshots. Pixel comparison is an explicit separate command until a human has approved the first baseline set. Static checks are not a substitute for a browser accessibility audit or responsive inspection.

## Changes and exceptions

Propose changes in a PR with a reason, source/decision, affected tokens/components, responsive screenshots and contrast evidence. Wendy approves changes to identity or product positioning. Routine implementation follows existing repository authorization. Update docs, token values, assets/hashes and tests together. Do not change a hash merely to conceal an accidental logo edit.

The active product is ParcelSavvy; historical repo/package/service identifiers can remain `PropertyTaxHelper` for compatibility. Existing production access/security instructions still apply. This work does not rename hosting projects or domains.
