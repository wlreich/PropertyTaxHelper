# Website

Next.js App Router, React, TypeScript, and Tailwind CSS. Vercel project Root Directory: `web`.

```sh
npm ci
npm run dev
npm run lint
npm run build
```

The homepage is a coming-soon page. `GET /api/health` returns an application health response only. These work without environment settings. `GET /api/health/database` separately tests Supabase connectivity once its migration and environment settings are configured; see [Supabase connection](../docs/supabase-connection.md). Run `npm test` to check connection failure handling.

See [Vercel setup](../docs/vercel-setup.md) for the remaining account and deployment work.
