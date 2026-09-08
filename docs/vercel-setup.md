# Vercel setup and release policy

The active website is `web/`, built with Next.js and hosted on Vercel. Supabase `TaxTransparency` is the database; `temp-app/` is a preserved legacy prototype.

## Project settings

| Setting | Value |
| --- | --- |
| Git repository | `wlreich/PropertyTaxHelper` |
| Root directory | `web` |
| Framework | Next.js |
| Node.js | 24.x |
| Install/build/output | Framework defaults; committed npm lockfile |
| Production branch | Verify `main` in the Vercel project |
| Environment variables | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |

Enter environment values directly through the hosting settings. Never commit secrets or use a privileged database key in the website. `/api/health` checks the website runtime; `/api/health/database` also checks a database request.

## Routine releases

On September 8, 2026, Wendy authorized routine production changes within the agreed task scope without a separate approval. Root `AGENTS.md` records the policy and its exceptions. Continue to use branches, PRs, relevant tests and post-deployment verification. Do not bypass branch protections or platform/tool approval requirements.

`web/vercel.json` enables automatic Git deployments. With the existing Vercel Git integration, branch pushes can produce previews and merges to the configured production branch can deploy production. Database changes required by new website code must be applied and verified before that merge. A configuration file does not itself prove the account integration, production branch, deployment, or domain assignment is correct: verify the resulting deployment when access is available.

The Vercel connector currently returns no teams and rejects access to the `property-tax-helper` project. This account-access limitation must not be mistaken for a deployment failure. GitHub commit checks can provide deployment evidence when the integration reports it, but live-page verification is still required.

## Codex setup

Install dependencies with `cd web && npm ci`; run lint, tests and the production build for website changes. No separate routine production approval is required. Any old environment description that says otherwise is superseded by Wendy's September 8 instruction and root `AGENTS.md`.

References: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration), [promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment).
