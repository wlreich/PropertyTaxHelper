# Combined property overview

The approved combined design adds a navy facts column, primary values, dated history,
change explanations, separately valued features, and exemptions by taxing entity.
No personal notes are included. Approved ParcelSavvy logo, fonts, tokens, and the
hover/focus/tap `TermDefinition` component are reused.

## Data and privacy

`property_profile` remains the source of active-release headline values. The new
`property_history` RPC reads only `public.property_snapshot_profiles` under RLS;
website requests never use privileged credentials or read the raw import schema.
The same RPC also returns separately curated supplemental protest observations; see
`docs/ingestion/protest-imports.md` for the required publication step. They appear
in the navy Protest evidence section and never enter valuation baselines or totals.

An administrator explicitly prepares snapshots with
`tcad_ingest.publish_property_snapshots(dataset_uuid, after_property_id, batch_size)`.
The function only accepts a ready dataset with 20 completed files and publishes a
strict allowlist. It never changes the active search release. Run successive batches
using the returned `next` cursor until `processed` is zero; retain cursors separately
for each dataset. Batches are atomic and repeatable. If an uncertain request result
requires recovery, repeating that same cursor is safe. Suggested batch size: 10,000.
Only run one publisher per dataset. The function supports at most 50,000 per batch.
Run `ANALYZE public.property_snapshot_profiles` after completing publication.

### Durable background preparation

For a full catalog, initialize administrator-only `tcad_ingest.property_snapshot_jobs`
rows with the active anchor, source dataset and a verified cursor (or the empty
cursor for a new publication). `processed` counts current property IDs examined,
including withheld or absent snapshots; use the projection table for published counts.
Give the current release the first priority so current facts become available first.

Run `tcad_ingest.advance_property_snapshot_jobs(10000)` through the single
`parcelsavvy-property-snapshot-backfill` Supabase Cron job, every 30 seconds.
One batch and its cursor commit together. A publication error rolls back that batch
and marks the job failed with its SQLSTATE; an administrator can correct the cause
and reset the status to queued without changing its cursor. A changed active search
release pauses the job. Once no queued/running work remains, the runner unschedules
its own named Cron job. It analyzes the public projection when a dataset completes.
The queue, scheduler runner and raw data remain inaccessible to public roles.

Inspect queue status and `cron.job_run_details` after starting the job. Completion
requires all intended queue rows to be complete; an idle scheduler can also mean
jobs are failed or paused. Do not infer completion solely from the scheduler stopping.

The projection is tied to the active search dataset and only exposes currently
searchable properties. A new active release requires rebuilding its profiles.
Historical records must independently have all three confidentiality flags set to F,
full ownership, no shared group, and exactly one property source row. Layout 8.0.0.30 has no ownership percentage; only for that verified version, the explicit non-partial-owner flag and other checks provide the ownership gate. Missing percentages in later formats remain withheld. Ambiguous
records are withheld, including duplicate owner records. Public access is read-only.
No owner names, contact details, agent contact records, legal descriptions or
raw JSON reach the page. Agent status requires an ARB agent ID linked to the same
snapshot's agent directory. ARB cases must match the property and tax year.

Exemptions are derived from true property exemption flags and positive entity
exemption amounts. Homestead local/state amounts are not added to the already-totalled
homestead amount. TCAD's administrative entity 0A is excluded. Duplicate entity
records are withheld. Unknown exemption codes retain their TCAD code rather than a
guessed definition. Values remain null when unreported.

## Comparison rules

- Headline comparisons use the immediately preceding tax year's latest dated
  certified snapshot; missing years are not interpolated.
- Within-year callouts use the earliest dated preliminary snapshot before the
  active snapshot. Every comparison names its period.
- Attention threshold: absolute change at least $25,000, or at least 10% and $10,000.
  This is a product review threshold, not statistical significance or proof of error.
  Color is paired with direction, amount, period and an explanation.
- A zero baseline has no percentage; missing values never become zero.
- Taxable values always name an entity. They are tax bases, not tax bills.
- Features match by TCAD type, description and recorded area/quantity. Multiple
  matching detail rows are not guessed; size changes appear as separate entries.
  An absent component is “Not listed,” not zero or proof of physical removal.
- Living area sums identified floor rows for a single improvement only; bedroom,
  bathroom and feature quantities never enter that total. Multi-building facts are
  withheld rather than presented as the characteristics of one home.
- Protest evidence is historical. No flag/case is never interpreted as proof that
  no protest occurred. Positive observations are retained across loaded snapshots.

## Verification

Run `npm run verify --prefix web`, `npm test --prefix tools/property-search`,
`node tools/property-search/render-smoke.mjs`, and
`npm run test:brand-browser --prefix web` after installing Chromium.
The GitHub check runs responsive/accessibility tests at 375, 768 and 1440 pixels and
retains screenshots for review. All committed browser fixtures are synthetic.

## Homeowner iteration and named agents

The overview leads with the dated market value and separate preliminary-to-certified and
prior-certified-year comparisons. Missing comparisons remain unavailable and zero remains a
valid value. Preliminary or supplemental records are never labeled certified. The adjacent
“Looks like a successful protest!” result requires a substantial negative change (existing
attention threshold), same-year preliminary and certified records with known ordered dates,
and a positive protest observation dated within that period. Agent assignment alone, another
year, an unknown observation date or a protest first observed after certification cannot trigger
that message. The visible qualification distinguishes a valuation change from tax savings and
does not attribute the change to the protest or agent.

The result card explicitly names assigned agents from the same tax year, retaining all distinct
names and observation dates. Prior-year agents are not credited to the current year. Missing
names are stated explicitly, and multiple agents are not collapsed into an inferred case handler.
The value cards explain market, capped and taxable values in visible copy, identify the selected
authority, and link to its full authority table. That link opens the details and moves keyboard
focus to its summary. Other page sections and mobile sidebar ordering are unchanged in this pass.

Annual explanations name the taxing authority. An explanation that larger exemptions softened
an increase is used only when both years' exemption totals reconcile to assessed minus taxable
value. Otherwise the explanation stays general. The timeline bars share a zero baseline and
show market value only. Missing amounts are not plotted as zero. Certified is not labeled final.

The default view summarizes pool/spa features, distinguishes a changed detail from a detail no
longer listed, and leaves ambiguous matches uncombined. Complete history, feature tables,
entity exemption amounts and source status codes remain in keyboard-accessible details elements.
Homeowner review actions link to facts, features, exemptions and a street-name search. Street
browsing is not presented as a matched comparable set. Similar-property matching and agent
leaderboards remain separate later work. No personal notes, fees calculator or inferred savings.

Wendy explicitly authorized displaying recorded agent names. The separate
`tcad_ingest.publish_property_agent_names(dataset_uuid, after_property_id, batch_size)` publisher
adds only `agent_name` from a unique same-source directory ID. Run it after ordinary snapshot or
protest publication, for each ready full/protest dataset. It processes only previously eligible
agent assignments (and prior names needing revalidation); save `next` and `anchor` and continue
until `processed=0`. Batches are repeatable, bounded at 50,000 and do not modify valuations.
Start over if the active anchor changes. Analyze `public.property_agent_names` after completion.

The publisher independently rechecks same-year Property uniqueness, source confidentiality,
ownership, current eligibility and the published agent assignment. Unknown names stay null;
duplicate directory IDs cannot supply a name. RLS also requires that the corresponding published
snapshot/observation still allows the assignment, so withdrawn/withheld projection rows hide
names immediately. Raw contacts and addresses remain private. Public website calls are still
security-invoker reads with publishable credentials; no raw-table access was added.

Names appear with their observation year/date, not as a claim of current representation or case
handling. If multiple names occur in a year they remain visible with source details. Absence is
"Agent not identified in the available records," not a claim the owner had no agent.
