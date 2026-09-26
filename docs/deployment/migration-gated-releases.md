# Migration-gated website releases

Website releases that consume new database response fields must use the **Migration-gated web release** workflow. The workflow is intentionally separate from migration application: database DDL is reviewed and applied first, and the website is deployed only after the recorded migration version and the public read contract both pass.

## PAR-68 reconciliation evidence

The agent-activity SQL was originally committed as `20260925203301_neighborhood_agent_activity.sql`. Production evidence from the September 25, 2026 application records the exact SQL under version `20260925223030`. The repository file is therefore renamed to `20260925223030_neighborhood_agent_activity.sql`; its SQL body is unchanged. This aligns a new checkout with live history and does **not** apply, repeat, or reverse the `create or replace function` statement.

`tools/release-contract/required-migrations.json` records the required live version and the superseded repository version. The parity check fails distinctly when:

- `20260925223030` is absent (missing migration); or
- only `20260925203301` is recorded (known version drift).

For an environment with the old version, first verify that its installed `property_neighborhood_analysis` returns the required contract. Then repair only Supabase migration history, marking `20260925203301` reverted and `20260925223030` applied. Do not run the SQL again. History repair must be reviewed for that environment; the deployment workflow deliberately never edits migration history or applies DDL.

## Release order

1. Apply reviewed migrations to the target database using the normal database change process.
2. Run **Migration-gated web release** with `target: nonproduction`. The `release-nonproduction` GitHub environment must provide `RELEASE_DATABASE_URL`, `RELEASE_SUPABASE_PUBLISHABLE_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`, plus the nonproduction `RELEASE_SUPABASE_URL` variable. Never point this environment at production.
3. The first job reads `supabase_migrations.schema_migrations` and performs no writes. It requires version `20260925223030`, then calls `property_neighborhood_analysis` for property `736302` through the publishable API.
4. Only after that job succeeds does the second job build and deploy the web commit. It checks both the screen and printable neighborhood URLs on the resulting nonproduction deployment.
5. Preserve the successful run URL as deployment-order evidence. Review the application logs for no `Neighborhood release contract failure` entries.
6. After normal PR checks and review pass, merge. Run the same workflow from `main` with `target: production`. The production option is rejected on any other branch.

The live contract requires `status: ok`, a source UUID, usable annual periods, neighborhood `T2450`, a structurally valid nonempty eligible-home result, and `agent_assignments` as an array. The fixture records the observed count of 571 to detect validator regressions. The live gate reports its observed count but intentionally does not assert 571, so a legitimate published-data change does not freeze deployment.

## Failure and rollback behavior

- **Parity or pre-deployment contract failure:** no web deployment runs. Apply the missing reviewed migration or reconcile verified history, then rerun the gate. Do not bypass the job.
- **Missing required RPC field:** parsing fails closed. The screen/print route renders its existing visible unavailable state, while the server logs `Neighborhood release contract failure` with a field-specific reason and property ID. It never treats HTTP 200 alone as contract success.
- **Post-deployment smoke failure:** do not promote that deployment. Inspect the immutable deployment and database logs; keep the prior alias active.
- **Production web regression:** redeploy/promote the last known-good web commit. The additive database function contract remains in place, allowing application and database rollback decisions to stay independent.
- **Database rollback:** do not remove `agent_assignments` while any deployed web version requires it. A database rollback needs a separately reviewed forward migration and must pass the contract against the web version that will remain active.

The gate performs only public reads plus a migration-history read. It does not change the active property release, property calculations, access policies, or published counts.
