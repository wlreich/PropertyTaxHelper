# Shared protest guide content

PAR-13 imports the complete approved Linear issue snapshot into `source-2026-09-19.md`. That file is the canonical editorial source, including internal notes. It must never be served as the public download.

The public contract is `web/src/content/protest-guide.json`. Next.js consumers can import `protestGuide` and its readonly types from `web/src/content/protest-guide.ts`; a PDF process can read the same JSON without React or Linear access. No runtime network request or additional dependency is required.

## Rendering contract

1. Render the title, reviewed date and introduction.
2. Render the eight chapters in array order, using `anchor` for chapter links and `number` for display.
3. Render sections and their ordered blocks in order. Blocks contain trusted editorial GitHub-flavored Markdown: tables, numbered lists, quotes, links and emphasis must survive in both formats. Do not execute MDX or enable raw HTML. Block IDs identify locations within this version; chapter and section IDs are stable across versions.
4. Insert `calendarStatus.markdown` immediately before section 03's blocks. This dated status is separate from the recurring calendar. `confirmedOperatingDates` is intentionally empty: no confirmed 2027 schedule is available. Never calculate or advertise a live filing window from the recurring table.
5. Render `disclaimer` visibly after the chapters in both formats. It is source section 17, not an internal note.
6. Preserve inline citations. `sourceLinks` also exposes citation labels and URLs at section, chapter and guide level, in source order (including repeated references).

`reviewedDate` is the supplied research date, not the build date or a claim of legal review. `contentVersion` identifies editorial releases; `schemaVersion` identifies the contract shape. `sourceSha256` ties the export to the exact source snapshot. Renderers must consume this contract instead of keeping their own copies of the prose.

Content version `2026-09-19.2` is a September 24 copy revision that clarifies rebuilding-cost terminology in the comparable-sales guidance. The reviewed date remains September 19 because this revision did not perform a new comprehensive legal or source review.

## Maintenance

Edit the canonical source, update version/research metadata in `web/scripts/generate-protest-guide.mjs` when appropriate, then run from `web/`:

```sh
npm run guide:generate
npm run verify
```

Commit both source and generated output. `guide:check` rejects stale exports. Unit tests reconstruct every public section and compare it with the source, including the dated calendar paragraph. They also validate the mapping, links, exclusion boundary and incomplete-source failures. The generator deliberately fails if numbered sections or editorial delimiters change unexpectedly.

Only the draft-review masthead, “About this draft” paragraph and final editorial notes are excluded. Public opening copy and all 17 source sections are retained. The hypothetical-example qualification remains in section 17 and in individual examples. No substantive claims were rewritten.

## Implementation source check — September 19, 2026

Targeted checks during implementation found no material discrepancy in the deadline statements reviewed:

| Official source | Checked against the draft |
| --- | --- |
| [Travis protest process](https://traviscad.org/protests) | Ordinary May 15 / 30-day notice rule; evidence and informal sequence |
| [Travis informal process](https://traviscad.org/informals) | One phone/video meeting; expected offer within 10 business days |
| [Texas exemptions](https://comptroller.texas.gov/taxes/property-tax/exemptions/) | General application deadline before May 1; examples are hypothetical exemption amounts |
| [Travis ARB hearings](https://traviscad.org/arbhearings) | Independent panel and District representative; typical local hearing season and short hearing format |
| [Texas protests and appeals](https://comptroller.texas.gov/taxes/property-tax/protests/) | Court 60 days; SOAH notice 30 days and deposit within 90 days, subject to eligibility |
| [Regular binding arbitration](https://comptroller.texas.gov/taxes/property-tax/arbitration/index.php) | 60-day request deadline and eligibility/payment conditions |
| [Limited binding arbitration](https://comptroller.texas.gov/taxes/property-tax/arbitration/limited-binding.php) | Procedural remedy and requested evidence disclosure distinction |

These checks are not a new comprehensive legal review or verification of a 2027 schedule. Follow the source's annual maintenance notes before a later season. Current exemption amounts do not replace the explicitly hypothetical arithmetic examples.

## Scope and brand review

Content only: page rendering belongs to PAR-14; printable PDF rendering belongs to PAR-15. No UI or visual check is claimed. Copy preserves the approved Appraisal District terminology, neutral agent discussion, confidentiality guidance, cap caveats and absence of promised outcomes. The founder's first-person ARB account is an explicit user-approved exception to the general brand preference against personal founder history; it remains identified as one person's experience.

## Responsive page and printable PDF (PAR-14 / PAR-15)

`/protest-guide` renders the entire public contract on the server. Native disclosures remain usable without JavaScript; enhancement opens hearing chapter 07 on desktop and keeps mobile chapters initially collapsed. Chapter fragments open the requested content on initial navigation, reload, and history navigation. The sticky desktop sidebar tracks the visible chapter. Home/footer links and the property tools link lead here; the `property` query parameter preserves a validated property-overview return link.

The shared site shell, approved logo, Manrope/Inter fonts and semantic colors remain authoritative over the mockup's text wordmark and raw palette. Green emphasizes educational headings; functional links use Action Blue. All eight chapters retain complete text rather than mockup summaries. Tables scroll only inside labeled keyboard-focusable regions. The founder account remains the expressly approved, qualified exception documented above.

Both PDF placements import `guide-download.ts`, which reads a content-hashed manifest for cache-safe links. The committed public asset is `web/public/guides/ParcelSavvy-Protest-Guide.pdf`: a complete, searchable US Letter PDF with linked contents, official citations, page numbers and the original reviewed date. This is not a browser-print substitute. A same-origin download filename and inline response support saving on desktop and mobile PDF viewing/sharing.

To update the PDF after source edits, from the repository root:

```sh
python3 -m pip install -r web/scripts/guide-pdf-requirements.txt
npm run guide:generate --prefix web
npm run guide:pdf --prefix web
npm run verify --prefix web
python3 -m pip install pypdf==6.10.0
python3 web/scripts/test-guide-pdf.py
```

Review every rendered PDF page after generation. Commit the PDF and `protest-guide-pdf.json` together. `guide:pdf:check` verifies content, renderer, dependency and font hashes plus the actual PDF hash; website verification rejects stale output without needing Python in the Vercel runtime. Python is only a maintainer/build-time generation dependency. The PDF uses the repository's licensed fonts; arrow glyphs unavailable in the Latin font subset use equivalent ASCII arrows. CI verifies every public paragraph/table cell and citation survived extraction, including the founder note and hypothetical examples, and rejects editorial notes.

Run `npm run test:guide-browser --prefix web` after a production build for the focused 320/390/768/1440 px guide suite. The existing brand suite still covers home/search/property regressions. Reports are retained as GitHub Actions artifacts. See the [PAR-16 integrated verification record](verification-2026-09-20.md) for entry-path, accessibility, visual and complete PDF inspection evidence and repeatable commands.
