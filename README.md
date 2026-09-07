# PropertyTaxHelper

Property tax transparency for Travis County homeowners.

The current website foundation is **Next.js (React and TypeScript) with Tailwind CSS**, hosted on **Vercel**. **Supabase** is the database. An optional database health route is prepared; activation requires its migration, environment settings, and an approved deployment. Property search is not available yet.

## Repository layout

- `web/`: current website; use this as Vercel's Root Directory.
- `temp-app/`: earlier Laravel prototype, retained for reference.
- `docs/vercel-setup.md`: account setup, preview validation, and release steps.
- `docs/supabase-connection.md`: database connection activation and verification.
- `supabase/migrations/`: reviewed database changes; never applied automatically by the website build.

## Local development

Use Node.js 24 and npm.

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000. Validate changes with `npm run lint` and `npm run build` from `web/`.

Changes should be reviewed in pull requests. Production deployment requires Wendy's approval. Automatic Vercel Git deployments are initially disabled by `web/vercel.json`; this does not block manual deployments or replace Vercel account permissions.
