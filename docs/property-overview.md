# Combined property overview

The approved combined design adds a navy facts column, primary values, dated history,
change explanations, separately valued features, and exemptions by taxing entity.
No personal notes are included. Approved ParcelSavvy logo, fonts, tokens, and the
hover/focus/tap `TermDefinition` component are reused.

## Data and privacy

`property_profile` remains the source of active-release headline values. The new
`property_history` RPC reads only `public.property_snapshot_profiles` under RLS;
website requests never use privileged credentials or read the raw import schema.

An administrator explicitly prepares snapshots with
`tcad_ingest.publish_property_snapshots(dataset_uuid, after_property_id, batch_size)`.
The function only accepts a ready dataset with 20 completed files and publishes a
strict allowlist. It never changes the active search release. Run successive batches
using the returned `next` cursor until `processed` is zero; retain cursors separately
for each dataset. Batches are atomic and repeatable. If an uncertain request result
requires recovery, repeating that same cursor is safe. Suggested batch size: 10,000.
Only run one publisher per dataset. The function supports at most 50,000 per batch.
Run `ANALYZE public.property_snapshot_profiles` after completing publication.

The projection is tied to the active search dataset and only exposes currently
searchable properties. A new active release requires rebuilding its profiles.
Historical records must independently have all three confidentiality flags set to F,
full ownership, no shared group, and exactly one property source row. Ambiguous
records are withheld, including duplicate owner records. Public access is read-only.
No owner names, contact details, agent names/contact records, legal descriptions or
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
