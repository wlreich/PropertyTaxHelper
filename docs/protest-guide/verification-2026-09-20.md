# PAR-16 integrated guide verification

Verified September 20, 2026 against main `6a0cfece6b6a4b48ccca34aa806ffca6a0324d3b`, after PAR-14, PAR-15, PAR-17 and PAR-18 were merged. Guide content version remains `2026-09-19.1`, reviewed September 19, 2026. This checks implementation fidelity, not a new legal review.

## Approved references

Opened and inspected the [desktop Figma frame](https://www.figma.com/design/AAWVk4RQ17hdojTQmNM20L?node-id=2-156), [mobile Figma frame](https://www.figma.com/design/AAWVk4RQ17hdojTQmNM20L?node-id=3-262), and the [complete Linear source document](https://linear.app/parcelsavvy/document/protest-guide-complete-content-and-implementation-source-september-3ba2e71feae0). The shared application logo, fonts and semantic colors remain authoritative. The full source chapters, rather than abbreviated mockup copy, are rendered.

## Repeatable coverage and actual results

The existing Playwright suites and Property search checks workflow own these checks; no additional suite or scheduler was introduced.

| Check | Local result |
| --- | --- |
| `protest-guide.spec.ts`, 320/390/768/1440 px | 20 passed |
| `guide-entry.spec.ts`, mobile and desktop projects | 6 passed, 2 intentional project skips; its layout case also checks 320/390/768/1440 px |
| PDF extraction, source URLs, contents destinations and page numbering | Passed, 20 US Letter pages and 23 source URLs |
| ESLint, TypeScript, format and brand checks | Passed |

Browser checks use the existing deterministic `tools/property-search/preview-data.mjs` fixture service and a production build. Local Chromium used a temporary executable override because the normal browser download was unavailable; that override is not committed. CI uses the repository's normal Playwright Chromium installation and runs the full build, unit, database, rendered-page and browser gates.

Repeat using the documented dependencies and commands:

```sh
npm ci --prefix web
npm run verify --prefix web
python3 -m pip install pypdf==6.10.0 markdown-it-py==4.2.0
python3 web/scripts/test-guide-pdf.py
cd web
npx playwright install --with-deps chromium
npm run test:guide-browser
npx playwright test --config=playwright.brand.config.ts tests/brand/guide-entry.spec.ts
```

Coverage includes all eight chapters, keyboard activation/focus and expanded state, desktop active navigation, fragment reload/history, source links, 320 px overflow, 200% text and zoom, and usability without JavaScript. Entry checks cover home navigation and education links, submitted-search Back behavior, property return context, the annual-review anchor and unchanged primary comparison subject.

Both PDF actions deliver the same content-hashed PDF with the expected response type and filename, without authentication or payment, while leaving the guide open. Extraction checks cover every public paragraph and table cell, all chapter headings, content version, examples, cap caveats, agent fees, realtor and records-request templates, ARB packet, qualified founder account and appeals. Editorial instructions are excluded. Added assertions verify consecutive page numbers and that every contents link targets its actual chapter.

## Visual evidence and manual PDF inspection

The existing GitHub Actions `parcelsavvy-brand-review` artifact retains `guide-report`, `guide-test-results`, `brand-report` and `brand-test-results`. At both 1440 and 390 px, the guide suite captures `guide-initial.png` and the added `guide-hearing-expanded.png`, plus `hearing-roles.png`, `founder-note.png`, `download-panel.png`, `guide-table.png` and `guide-enlarged-text.png`. Entry screenshots cover the home and property paths.

Inspected desktop and mobile initial screenshots and detailed hearing-role/founder captures against the approved frames: hierarchy, chapter spacing, responsive role columns, qualified founder callout and shared shell agree with the implementation contract. The expanded ARB capture includes the complete source content. Browser assertions check focus, sticky-header anchor clearance and accessible names; axe checks pass in the exercised states.

Rendered and visually inspected all 20 PDF pages in color. Also inspected a grayscale contact sheet of all pages and full-size grayscale examples of the cap table and founder callout. Text, headings, underlined links, table borders and the founder box remain distinguishable. All six tables fit within page margins without split rows; no clipped text, overlap, broken glyphs or stranded headings were observed. Intentional whitespace at chapter ends is retained. The title, contents, reviewed/version text and consecutive footers are present. Automated annotation checks confirm every source URL and all eight contents destinations: pages 2, 3, 5, 6, 8, 13, 15 and 18.

No integration defect requiring guide UI, substantive copy or PDF regeneration was found. No external government-site availability is required by these regression tests. Final PR, CI and deployment links are recorded on PAR-16.
