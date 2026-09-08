# Project instructions

- The active website is `web/`: Next.js, React, TypeScript, and Tailwind CSS, intended for Vercel.
- Supabase is the intended database. Do not claim the app is connected until its actual connection has been implemented and verified.
- `temp-app/` is a legacy Laravel prototype; preserve it unless a task explicitly requests changes there.
- Prepare changes in a branch and pull request, run the relevant checks, and verify the result. Wendy authorizes routine production changes within the agreed task scope, including merges, deployments, migrations, and publication of reviewed non-confidential property data; do not request a separate production approval.
- Ask Wendy before destructive or irreversible actions, creating/rotating/exposing credentials, weakening access controls, expanding sensitive-data exposure, incurring material new costs, or making major product or architecture decisions. This preference does not override platform/tool approval requirements or branch protections.
- Run `npm ci`, `npm run lint`, and `npm run build` from `web/` when validating website changes.
- Keep credentials and downloaded bulk property records out of git. Do not put privileged Supabase keys in browser code or variables prefixed with `NEXT_PUBLIC_`.
