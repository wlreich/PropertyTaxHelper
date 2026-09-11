# Seasonal administration

ParcelSavvy has three recurring county/year phases: preliminary protest season (the general filing window is open), protest season (hearings and decisions), and post-protest season. A county phase is not an individual case status or a valuation roll stage.

## Administration

Visit `/admin`. The first version uses Supabase email/password authentication with verified email, an explicit `parcel_admin.members` user-ID allowlist, and a live Supabase session. No public signup or self-enrollment grants administration. Every action and preview authenticates on the server and again in the database. There are no service-role credentials in the website. The session cookie is HttpOnly, Secure in production, SameSite Strict, scoped to `/admin`, and expires within one hour. Sign out revokes the upstream session and clears the browser cookie.

Initial account setup requires the owner's chosen email and an actual verified Supabase Auth account. An infrastructure administrator adds that account's ID to `parcel_admin.members`; never infer it from an unverified email, user-editable metadata, or the first person who signs in. Do not create or transmit credentials without the owner's authorization. The release ships with no administrators enrolled. The public site remains functional.

## Seasons and drafts

- The supported county is Travis County; all date boundaries use America/Chicago.
- The filing day remains in the preliminary phase. Protest season starts at county midnight the next day; post-season begins on its configured date.
- Automatic mode requires a season start, deadline, post-season start, an official source URL, and a verification date. It does not infer next year's dates from this year.
- Manual mode uses the selected phase beginning on the configured season start. Future configurations do not displace the current season before that start.
- Save draft writes only the private draft. Publish season replaces the public configuration atomically, with optimistic revision checking. Source and dates are validated again in the database.
- The initial 2026 configuration uses the owner's explicitly stated post-protest phase. No unverified filing deadline or future-season date was populated.
- Season changes do not change the active valuation source. Calendar transitions require no new import and reads are uncached. A page already open updates its guidance on navigation/reload.
- General deadlines are labeled as general and linked to the recorded official source; individual notices may differ.
- Preview guidance uses unsaved settings. Full property preview uses the selected active/ready release and the chosen phase/year, with an explicit simulation banner. It cannot change public data.

## Safe publication

Ingestion still produces ready raw datasets. It never changes the live release. Choose a valuation source and **Prepare release** to create a new candidate release ID, including when refreshing the same source after importing historical data.

1. The private preparation records the expected active release and all ready full/protest sources through the target tax year.
2. A single private `parcelsavvy-release-preparation` Cron worker runs one committed batch every 30 seconds, with a five-minute statement limit. Search preparation uses the existing full projection; subsequent snapshots, protest observations and agent names are batched. The worker stops scheduling when no work remains.
3. The candidate uses the same field allowlists, confidentiality and ownership checks as the existing publishers. Public RLS continues to expose only the active release. Candidate records stay private.
4. A failed batch rolls back its writes and cursor together. Resume continues from saved progress. An active-release change prevents resuming against a stale baseline; prepare again.
5. When ready, preview a property and review missing-comparison warnings. Missing prior certified/preliminary datasets require explicit acknowledgement; missing current details or incomplete jobs block publication.
6. Publish checks the expected active release, source readiness, completed steps and sources imported since preparation. It switches the public pointer and records an audit event in one transaction. No year or phase is changed.

Older valuation sources cannot become current by accident. Import them as history and prepare the current source again. A preliminary release cannot replace a certified/supplemental release for the same year. A new tax year may start with preliminary records normally.

New `prepare_property_*` functions accept an explicit candidate anchor and retain the tested source eligibility rules. Older administrator-only publishers remain for operational compatibility, but the web admin never calls their immediate-activation path. Do not use the legacy publisher for routine rollovers.

The property overview reads profile and history in one stable database statement to avoid mixed releases during activation. Missing records stay missing; publication does not invent case outcomes, agent names or zero values. Historical result cards remain tied to their original year. An in-season value decrease never produces a certified success claim.

## Verification

`npm run verify --prefix web`, `npm test --prefix tools/property-search`, `node tools/property-search/render-smoke.mjs`, and `npm run test:brand-browser --prefix web` cover calendar boundaries, the $1.4M scenario, prior-year comparisons, draft isolation, authorization, batch rollback/resume, private candidates, atomic activation, keyboard use and responsive pages. Browser authentication uses a loopback-only synthetic fixture; it does not claim to verify the owner's as-yet-unconfigured real account.

Security advisor informational findings for private administrator tables with RLS and no policies are intentional deny-by-default protection. Only narrowly granted, authenticated private functions access them; raw tables and the worker cannot be invoked by website roles.
