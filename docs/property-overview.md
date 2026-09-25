# Combined property overview

The overview leads with the current assessment, followed by cap/exemptions,
compact value drivers, property facts/features, and dated history on the same page.
No personal notes are included. Approved ParcelSavvy logo, fonts, tokens, and the
hover/focus/tap `TermDefinition` component are reused.

## PAR-10 sections

`property-sections.ts` derives conditional cap guidance and compact feature/change
labels from the existing normalized snapshot contract. It does not calculate a new
appraisal limit or change the validated comparison/secondary-improvement model.
The cap calculation displays the district's reported assessed value and the selected
authority's own exemption amounts and taxable value. Missing exemption breakdowns
remain unknown unless the recorded assessed and taxable amounts establish zero;
unreconciled amounts receive an explanation instead of invented deductions.

The cap disclosure explains the prior capped assessed base, effective-year eligibility,
and qualifying new improvements. No hypothetical market-value simulator is included.
The value drivers compare against the immediately preceding certified tax year;
the separately labeled multiplier effect retains its original preliminary-model inputs.

Property facts use the existing building-aware helper. Features are dynamic, with
two highlights and a complete compact disclosure. Missing records do not prove
physical removal; newly listed features do not prove new construction. Duplicate
type/area matches across buildings are not merged. The official-record destination
uses the current property ID and displayed tax year.

Browser regression: `web/tests/brand/property-sections.spec.ts`. The reference
property uses a frozen public-data fixture; conditional and layout-stress cases
are explicitly synthetic. Run with the brand browser suite at 375/768/1440 px.

## PAR-11 annual history

`annual-history.ts` groups normalized valuation snapshots and protest observations
by actual tax year. It selects the latest certified record and earliest eligible,
dated preliminary record before that certification, preserving the publisher's
property-specific exclusions. Annual changes require the immediately preceding
year's dated certified record; gaps never substitute an older year or a within-year
comparison. Unknown amounts/dates remain unavailable and a zero prior amount has
no invented percentage change.

`AnnualAssessmentHistory` keeps the current assessment untouched while expanding
yearly details. Explicitly eligible proposed, final market and matching certified
assessed values share a zero-based dynamic scale. Preliminary-only years retain
their proposed stage while final stages are pending; certified years with no
supported proposal mark that stage unavailable. Up to five loaded years appear
initially, with earlier chart/table entries expandable on the same page. Mobile
rows retain table semantics and explicit field labels.
Source timestamps, authority exemptions, and dated protest/agent evidence remain
available within each year. No archive ingestion or database rule changes are
part of this feature.

The frozen `par11-reference-history.json` captures the public history RPC for
property 736164 on September 19, 2026, including May 8's eligible 2025 preliminary
record and July 3's excluded interim record. Additional fixture IDs are synthetic.
Regression: `annual-history.test.mjs` and `brand/annual-history.spec.ts`.

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
- A protest is recorded when any available same-year snapshot has a positive TCAD
  protest flag or a matching ARB case. The flag can preserve an informal-resolution
  protest that never produced an ARB case. An agent assignment alone is representation
  evidence, not proof of a protest, and later negative or absent fields never erase an
  earlier positive observation.

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
value. Otherwise the explanation stays general. The timeline bars share a zero baseline and show
the supported proposal, final market value and matching assessed value as separate levels. Missing
amounts are not plotted as zero. A cap is named only when the same-year records support it;
otherwise the third stage remains “Assessed value.”

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
