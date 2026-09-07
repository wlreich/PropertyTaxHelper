# Vercel setup

## Intended connections

| Component | Service | State at preparation |
| --- | --- | --- |
| Source code | GitHub `wlreich/PropertyTaxHelper` | Repository readable and writable through the connected GitHub app |
| Coding environment | Codex `PropertyTaxHelper` | Environment created; a coding task has not yet been run there |
| Website hosting | Vercel | Plugin connected; project and deployment still need verification |
| Database | Supabase `TaxTransparency` | Project healthy and read-only SQL succeeded; application wiring is still pending |

Cloudflare is not needed to host this website. The previous `temp-app/` Laravel prototype is not the Vercel application.

## Project settings

After reviewing the foundation PR, configure the Vercel project with:

| Setting | Value |
| --- | --- |
| Git repository | `wlreich/PropertyTaxHelper` |
| Root Directory | `web` |
| Framework Preset | Next.js |
| Node.js version | 24.x |
| Install Command | Default (using the committed npm lockfile) |
| Build Command | Default (`next build`, or `npm run build`) |
| Output Directory | Next.js default; do not set a static output folder |
| Environment variables | None required for this starter |

The `web` directory must exist on the branch selected for deployment. Until the PR is merged, use its branch for any approved preview; `main` still contains only the older prototype.

Creating/importing a project through Vercel can immediately deploy it. Review the target branch and deployment environment before selecting Deploy. Do not publish to production without Wendy's approval.

## Preview and release

`web/vercel.json` sets `git.deploymentEnabled` to `false`. This prevents automatic Git-triggered deployments for branches containing that configuration. It does not prevent manual deployment, protect other branches without the file, or establish an account-level approval gate.

Once the project is configured, create an explicitly approved preview deployment from the foundation branch. Check the homepage and `/api/health`. The health response proves only that the website runtime responds; no database request is made.

Before enabling continuous deployment, review Vercel production branch tracking, automatic domain assignment, project access, and GitHub branch protection with Wendy. Production promotion is a separate approval step. Nothing in this PR publishes the site.

## Supabase wiring remains a separate change

The Supabase account connection lets Codex inspect the database. It does not automatically supply credentials to Vercel or connect this application. Add only the environment variables required by the eventual data/auth implementation through Vercel's environment settings; never commit secrets. Validate real application queries and access policies before treating the end-to-end connection as complete.

## Codex setup after merge

The Codex environment points at this repository. Its setup must install dependencies from `web/` (`cd web && npm ci`) once this branch is available, and a first coding task should verify lint and build. Environment creation alone does not verify a successful task.

References: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration), [promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment), [Next.js installation](https://nextjs.org/docs/app/getting-started/installation).
