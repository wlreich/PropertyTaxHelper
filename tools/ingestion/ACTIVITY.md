# Deed and sale observations

The activity importer is independent of the existing protest importer. It retains
only an allowlist for one calendar year. Deeds are leads, not confirmed sales.
Private names, notes, deed consideration and loan amounts are never extracted.

Use the existing approved special-JSON dataset ID and archive SHA256. The ZIP must
contain one complete JSON array; its checksum, member CRC and JSON ending are
validated. The export date comes from the member name, not the upload date.

```sh
python tools/ingestion/activity.py --stored-archive \
  --dataset-id DATASET_UUID --archive-sha256 ARCHIVE_SHA256 \
  --year 2026 --output /private/work/activity-2026.jsonl
# Or use --archive /private/work/source.zip instead of --stored-archive.
python tools/ingestion/activity.py --load --output /private/work/activity-2026.jsonl
```

Storage retrieval uses the existing `TCAD_STORAGE_*` environment configuration.
Loading uses `TCAD_DATABASE_URL` and the existing loader role. Apply the additive
migration first. Keep extracted files and credentials outside the repository.
Review the aggregate summary before loading. CLI load validates the extraction
checksum and source dataset, holds an advisory lock, and uses one transaction;
failed loads publish nothing. Identical completed runs are safe no-ops. Retry a
failed transaction with the same files; investigate conflicting identities rather
than deleting history. No web access to either private table is granted.

An authorized SQL operator may stage the exact same allowlisted records with a
`loading` import, validating extracted SHA256/counts and duplicate keys, then set
`complete` and `completed_at` together only after all records are present. Public
projection must consume completed imports only. This path supports environments
with SQL connector access but no direct database credentials. Interrupted staged
runs remain unpublished and may resume by primary key, without changing their
source identity. Never issue privileged endpoints or public Storage policies to
make an import easier.

Original/adjusted prices remain separate. Zero becomes unavailable. Future and
invalid dates are quarantined. Confidential/suppressed flags and parcel groups
must be respected by the public projection. Re-run for each reviewed new source
release/year, then refresh the activity projection as documented in its migration.

## Publish neighborhood activity

After a complete, reviewed import and the publication migration, a database
operator runs `select tcad_ingest.publish_property_activity(2026);`. This is an
atomic, repeatable rebuild for the active appraisal release and newest complete
JSON import for that year. Run it again after changing the active appraisal release
or importing a newer source. Incomplete imports never replace published data.

The release-switch trigger carries the already curated activity into a newly
published search release, limited to properties still visible in that release.
It retains the original appraisal and supplemental export dates; this is a
continuity measure, not a claim that the new appraisal export was scanned for
additional deeds. Refresh the projection from reviewed sources when a new
activity import or an appraisal-source-compatible publisher is available.
The public neighborhood activity RPC uses the newest visible appraisal source
within a prepared release for its market-area group and property types; a
preparation ID is an anchor, not a raw appraisal source ID.

The public RPC `property_neighborhood_activity(property_id, year)` returns a
bounded (10,000 maximum) activity list for the active district neighborhood,
available years, and separate appraisal/JSON export dates. Empty lists mean no
matching records in these sources, not that no sales occurred. The activity
population includes all visible property types and differs from valuation metrics.

Matching uses property ID plus deed ID, then an instrument without a conflicting
deed ID, then an unambiguous date without conflicting identifiers. Unmatched
transactions remain separate. Supplemental deeds replace repeat appraisal deeds
with the same instrument; nothing deduplicates solely by property ID. Recorded
sales are not asserted to be verified arm’s-length comparables. Confidential,
suppressed, unknown-privacy and future-dated sale observations are excluded.
Multi-property prices and unknown parcel allocations are withheld. Prices are
never inferred from consideration, listing prices or assessed values.
