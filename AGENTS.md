# Project instructions

- The active website is `web/`: Next.js, React, TypeScript, and Tailwind CSS, intended for Vercel.
- Supabase is the intended database. Do not claim the app is connected until its actual connection has been implemented and verified.
- `temp-app/` is a legacy Laravel prototype; preserve it unless a task explicitly requests changes there.
- Prepare changes in a branch and pull request. Production deployment requires Wendy's approval.
- Run `npm ci`, `npm run lint`, and `npm run build` from `web/` when validating website changes.
- Keep credentials and downloaded bulk property records out of git. Do not put privileged Supabase keys in browser code or variables prefixed with `NEXT_PUBLIC_`.
