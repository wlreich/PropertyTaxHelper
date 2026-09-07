# Website-to-Supabase connection

The application now has two independent health routes:

| Route | What it checks |
| --- | --- |
| `/api/health` | Website runtime only; no database request |
| `/api/health/database` | Vercel server → Supabase Data API → a read-only Postgres function |

The database route calls `public.database_health()` with the Supabase JavaScript client and a publishable key. The function executes `select 1`; it has no table access, parameters, or writes. It runs as the caller (`security invoker`). This confirms connectivity, not property data availability, authentication, or access policies on future tables.

## Database activation status

Applied to TaxTransparency on 2026-09-07 as migration `20260907202107` (`database_health`). A query under the `anon` role returned `1`. The committed filename matches the recorded Supabase version; do not reapply this migration to that project. The deployed website-to-database request still needs verification.

## Activation for a new environment

1. Review and merge this PR.
2. Apply `supabase/migrations/20260907202107_database_health.sql` to the intended Supabase project through the migration workflow. This PR does not apply it automatically. If using Codex's `apply_migration` tool, confirm the version it records and reconcile the committed migration filename with that version before a later CLI migration push; do not apply the function creation twice.
3. In Vercel's `property-tax-helper` project, add the following environment variables for **Production**. Use a separate non-production Supabase project for general Preview/Development access when those environments are established; do not copy production settings into all previews.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://flnhdrkfaybruzlbixfy.supabase.co` for the existing TaxTransparency project |
| `SUPABASE_PUBLISHABLE_KEY` | The same project's publishable key beginning `sb_publishable_`, from Supabase Project Settings → API Keys |

The server intentionally accepts only publishable keys. Do not use a `service_role`, `sb_secret_`, database password, or legacy anon JWT for this probe. Enter the key directly into Vercel, not into git or a chat message. Values are read at runtime on the server and are not browser environment variables.

4. After Wendy approves deployment, manually deploy the merged commit. Vercel's environment changes apply to new deployments. Automatic Git deployments remain disabled by the existing configuration.
5. Visit `/api/health/database` on the new deployment while signed into Vercel if deployment protection requires it.

Expected successful response (HTTP 200):

```json
{"status":"ok","database":"ok"}
```

The route returns HTTP 503 with `database: "not_configured"` if either setting is absent or a non-publishable key was supplied. It returns HTTP 503 with `database: "unavailable"` for a rejected key, invalid URL, missing function, unexpected result, or unreachable database. Requests use a five-second abort deadline and no-store caching. Upstream error details and credentials are never returned.

## Verification and rollback

After applying the migration, verify it under the role used by publishable-key requests:

```sql
begin;
set local role anon;
select public.database_health(); -- expected: 1
rollback;
```

The deployed route must also succeed; a SQL check alone does not prove the Vercel environment settings or Data API connection.

For rollback, revert the website change and remove its environment settings. The function may then be removed through a reviewed migration with `drop function public.database_health();`. It owns no data.

## Local checks

From `web/`: `npm ci`, `npm test`, `npm run lint`, and `npm run build`. Unit tests exercise real client request construction with simulated HTTP responses, missing settings, bad keys, upstream failures, and unexpected results; they do not replace a live end-to-end check.

For local integration testing, copy `web/.env.example` to `web/.env.local` and configure a non-production project where the migration has been applied.

References: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc), [Vercel environment variables](https://vercel.com/docs/environment-variables).
