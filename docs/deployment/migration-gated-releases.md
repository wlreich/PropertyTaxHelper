# Database contract gate for web releases

The ParcelSavvy account currently has one Supabase project and no separate staging database. Vercel Git deployment remains enabled. A production Vercel build calls the published `property_neighborhood_analysis` RPC with the existing server-side `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` before `next build`. If required response fields are absent or invalid, the build fails and the existing live deployment stays in place. Local, CI and identified preview builds use fixture tests and do not require live credentials. If Vercel does not expose its environment indicator, the build fails closed by running the contract check. No new GitHub or Vercel secrets are needed.

## Migration reconciliation

The agent-activity SQL was originally committed as `20260925203301_neighborhood_agent_activity.sql`, but production recorded the exact applied SQL as `20260925223030`. The repository file is renamed to `20260925223030_neighborhood_agent_activity.sql` without changing its SQL body. Do not apply it again to production. `tools/release-contract/check-migration-parity.mjs` and `required-migrations.json` distinguish a missing version from that known history drift when supplied a target environment's migration history. Before releasing a new database-dependent feature, use the normal reviewed migration process and verify the recorded target version; do not treat a committed SQL file as proof that it ran.

## Release order

1. Apply and verify reviewed database migrations for the target environment. For this incident, production already has `20260925223030`.
2. Run the focused release contract fixtures and ordinary required PR checks. The contract validator checks the fields actually consumed by the website, including agent assignment entries; it does not freeze the current 571-home count.
3. Merge only after review and required checks pass. Vercel's existing Git integration starts the deployment. On production builds, `web/scripts/check-release-contract.mjs` makes a read-only anon RPC request for property 736302 using the existing server environment. Missing config, HTTP errors, invalid stage/source/population, missing `agent_assignments`, or malformed entries fail the build before promotion.
4. Inspect the production deployment and screen/print neighborhood panels after release. The build gate checks the database contract, while rendered layout and pagination remain covered by the browser/PDF CI and release review.

The local test fixture exercises successful, missing-field, unavailable-RPC and missing-config outcomes. The production build check can be exercised against a safe fixture endpoint with `RELEASE_CONTRACT_CHECK=1`; do not point test deployments at live credentials merely to satisfy a test.

## Failure and rollback

- A failed build leaves the prior production deployment serving traffic. Inspect the named missing field or RPC error, apply the reviewed migration, and retry the same commit.
- The app retains its visible unavailable fallback and logs `Neighborhood release contract failure` when a runtime response later drifts. A production rollback can promote the last known-good web deployment while the additive database contract remains available.
- Do not remove a field required by a deployed web version. Any database rollback needs a separate reviewed forward change and compatibility check.

This build guard verifies the live response contract. It does not independently query the private `supabase_migrations` history from Vercel. The parity tool remains available to the migration operator for exact version checks; a fully automatic version-history gate across separate staging and production environments requires that infrastructure and credentials to exist first.
