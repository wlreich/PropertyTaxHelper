# PAR-36: overview checklist removal

Prepared on September 21, 2026 from main 7212f772361d534ef61ae4eeaf4d7674dcdd2afa.

Removed the legacy next-steps checklist, street CTA and disclosures. Removed only their unused styles, imports and street helper. Retained property facts, feature records, cap/exemptions, subject-aware comparison/neighborhood actions and Protest Guide links. The seasonal preparation link now points to the existing guide instead of a deleted anchor.

Reproduced the legacy section on https://property-tax-helper.vercel.app/property/736164 before editing. Read approved Figma node EdxFjIcxiEfKxM6gbwoW7o / 2:130. Reviewed local reference screenshots at 375 and 1440px and print media: no gap, overflow or orphan section; current approved components, typography and colors retained. No intentional brand exceptions.

Validation:
- npm ci: passed.
- npm run verify: passed; 104 unit tests, lint, build, typecheck, PDF/content/brand/format checks.
- Existing property.spec.ts: all four tests passed at 375, 768 and 1440px after removing assertions that explicitly expected the deleted disclosure (12 cases total).
- Existing reference fixture: 736164; full-page captures visually inspected. Accessibility checks passed.
- Additional temporary browser check: print-media capture and property-specific guide navigation passed; temporary test was removed, no redundant test suite added.
- Local browser used the available Chromium executable because downloading Playwright's bundled browser was blocked. This is local evidence, not GitHub CI.

Delivery blocked: automatic approval review rejected GitHub create_tree twice, including after verifying the repository is public, owned by wlreich and writable. Review requested explicit user authorization to publish the changes to wlreich/PropertyTaxHelper. No remote branch/PR, merge or deployment occurred. Required GitHub CI remains pending publication.
