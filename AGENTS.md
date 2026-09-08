# Project instructions

- The active website is `web/`: Next.js, React, TypeScript, and Tailwind CSS, intended for Vercel.
- Supabase is the intended database. Do not claim the app is connected until its actual connection has been implemented and verified.
- `temp-app/` is a legacy Laravel prototype; preserve it unless a task explicitly requests changes there.
- Prepare changes in a branch and pull request, run the relevant checks, and verify the result. Wendy authorizes routine production changes within the agreed task scope, including merges, deployments, migrations, and publication of reviewed non-confidential property data; do not request a separate production approval.
- Ask Wendy before destructive or irreversible actions, creating/rotating/exposing credentials, weakening access controls, expanding sensitive-data exposure, incurring material new costs, or making major product or architecture decisions. This preference does not override platform/tool approval requirements or branch protections.
- Run `npm ci`, `npm run lint`, and `npm run build` from `web/` when validating website changes.
- Keep credentials and downloaded bulk property records out of git. Do not put privileged Supabase keys in browser code or variables prefixed with `NEXT_PUBLIC_`.

## ParcelSavvy Brand Requirements

Before changing user-facing UI or copy, read `docs/brand/BRAND.md` and `docs/brand/COPY_GUIDE.md`; finish with `docs/brand/UI_CHECKLIST.md`.

- Product: **ParcelSavvy**. Tagline: **Know your property. Understand your assessment.**
- Reuse approved logo assets and `BrandLogo`; preserve proportions, colors, composition and clear space.
- Use Manrope for headings/metrics and Inter for body/interface text. Use the semantic tokens in `web/src/styles/tokens.css` for colors, typography, spacing, borders, radii, shadows and focus.
- Action Blue is for functional links/controls. Savvy Blue and Insight Coral are supporting accents, subject to the documented contrast rules.
- Reuse shared UI foundations, including `SearchForm`, `SiteHeader`/`SiteFooter`, and `TermDefinition`. Keep results compact and divided.
- Be clear, calm, curious, candid, empowering and evidence-led. Use the approved name/tagline; never infer overassessment or promise savings without evidence.
- Run applicable lint, type, unit, brand, accessibility and responsive checks. Review search at 375, 768 and 1440 px. Never describe unrun visual checks as passed.
- Include a short brand-compliance summary and disclose intentional exceptions in completion notes. See `docs/brand/README.md` for commands and review process.
