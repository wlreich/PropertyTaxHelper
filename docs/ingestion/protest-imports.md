# Protest-season imports

Upload the original full TCAD ZIP to the existing private `incoming/` folder.
Choose the protest modes in **TCAD data import**; no manual extraction is required.
The ZIP is retained byte-for-byte, but only Header, Property, ARB and Agent are
validated and loaded. Other documented members are inventoried, marked
`not_validated_or_loaded` in the aggregate report, and kept only in the archive.
The ZIP's directory still undergoes duplicate, path, type and size checks.
A ZIP with just the four required files also works; loose ARB-only ingestion is
not supported by this workflow. Unknown layouts and missing required files fail.

## Validate, then import

First run on `main`:

| Input | Value |
| --- | --- |
| Mode | `validate_protests_uploaded` |
| Private upload path | Actual `incoming/<original-or-distinct-name>.zip` |
| Original filename | TCAD's original archive filename, or blank if unknown |
| Source URL | Actual direct TCAD URL, or blank when unknown |
| Tax year | Header's appraisal year |
| Roll stage | Publisher's label, or `unknown` if unavailable |
| Encoding | `ascii`, unless the source specifies otherwise |
| Archive checksum | Optional independently computed ZIP SHA-256 |
| Receipt checksum | Blank |
| Import approved | Unchecked |
| Download/publication dates and evidence | Blank unless independently known |

Validation preserves the ZIP and its receipt but inserts no property records.
Review `import_scope: protests`, the export header's `export_run_time_raw`, the
four selected files, ARB `record_year_counts`, row counts and serialized size.
The Property file is still large: this mode saves the other 16 text files, not
all property storage. Check remaining database capacity before loading.

Then run on `main` with mode `import_protests`, the same tax year, roll stage and
encoding, both SHA-256 values from successful validation, and import approval
checked. Source/upload/date inputs are unused in this second step. The importer
retrieves the archived bytes and validates all four selected files again before
inserting records. A full-import validation receipt can identify the same bytes,
but use protest validation first so the reviewed storage estimate matches scope.

Retry a failed import with the same parameters. Each file is transactional;
completed files are skipped and the failed file restarts without duplicate rows.
A failure during post-load verification does not undo committed files. Retrying
reuses them and repeats bounded exact row-count verification. Check the final
report for `status: imported` and `database_row_count` matching `row_count`.

## Identity and chronology

`tcad_ingest.datasets.import_scope` and `import_attempts.import_scope` distinguish
`full` from `protests`; this is independent of the publisher's `roll_stage`.
Original filename and download URL may both be unknown: their receipt fields
remain null. The checksum, private upload URI, byte count and storage retrieval
timestamps identify the actual uploaded bytes. The publisher reference page is
explicitly a reference, never an invented original download URL.

Protest modes accept `roll_stage: unknown`; full valuation modes still require
a known stage. Do not substitute the renamed upload filename for an unknown
original filename or infer a stage from the export date. If better provenance
is found later, preserve the original observation rather than silently relabeling
an existing dataset.

The unique dataset identity includes archive, layout, parser, encoding and scope.
The same ZIP can therefore be loaded once per scope and retried independently.
The original archive object is reused. Existing datasets default to `full` and
keep their IDs; the full parser version remains 1.3.1 because field mapping and
full-import behavior have not changed.

Raw records, including source statuses and agent assignments, are preserved as
text in the existing private tables. ARB can contain cases for earlier appraisal
years: retain each row's `prop_val_yr`, never relabel it as the archive year.
Use `(dataset_id, prop_id, prop_val_yr)` for case/property matching, normalizing
numeric padding. `geo_id`, `ref_id1` and `ref_id2` are cross-checks.
Property `arb_agent_id` links to Agent `agent_id` within the same dataset;
ARB does not contain an agent ID. A correspondence assignment does not prove
who filed a protest. Earlier-year cases do not acquire the current year's agent
assignment by inference. Header, ZIP-member clock, acquisition time and any
operator-reported dates remain distinct; no filename date becomes a verified
export date. An unknown source date remains unknown.

## Publication and the property overview

Ingestion preserves private evidence. An administrator then reviews the header,
case/property/agent links and confidentiality before publishing it. It does not
switch the active search release or add valuation comparison snapshots.

Run `tcad_ingest.publish_property_protests(dataset_uuid, after_property_id, batch_size)`
for a ready protest import with all four required files complete. Start at the empty
cursor, save the returned `next` and `anchor`, then continue until `processed` is zero.
Use 10,000 properties per batch initially, up to 50,000 after measuring performance.
Only run one publisher per dataset and stop if the active anchor changes; start again
from the empty cursor for the new anchor. Each batch is atomic and repeatable, so an
uncertain result can safely be retried with the same cursor. Run
`ANALYZE public.property_protest_observations` when publication finishes.

The publisher stores a small allowlist of positive observations in
`public.property_protest_observations`: property/year/source identity, header date,
protest flag, ARB presence, source status codes and a linked-agent boolean. It requires
an unambiguous same-source Property row with all three confidentiality flags false,
full ownership and no shared group, plus current public eligibility. ARB must match
property ID and appraisal year; conflicting supplied geo/reference IDs are withheld.
An agent ID must match exactly one normalized ID in that dataset's Agent file.
Earlier-year ARB cases remain private when the archive has no same-year Property row;
we never attach the archive year's agent to an older case or relabel its appraisal year.

`property_history` returns these observations separately from valuation snapshots.
The overview combines their positive evidence with the existing full snapshots and
shows each observation's tax year and export date. Later absence never means no protest,
withdrawal or resolution. Status codes remain untranslated pending verified definitions.
An agent assignment alone is not labeled a protest. No owner names or owner/agent contacts,
raw fields or privileged database access are added to website requests.
After this publication, run the separate `publish_property_agent_names` batches described
in `docs/property-overview.md` to include the expressly approved recorded agent name.
It rechecks source eligibility and publishes no directory address or contact fields. Public RLS
requires the same active search anchor and current property eligibility on every read.

After every new protest import, run this reviewed publication step; ingestion alone
does not activate the website history. A later source gets its own dataset and cannot
erase positive observations in earlier datasets. Re-publishing one source removes any
of its observations that no longer satisfy confidentiality or ambiguity checks.

## Verification

`python -m unittest discover -s tools/ingestion/tests -v` covers mode selection,
all three layouts, selected/skipped files, unsafe archives, malformed required
files, mixed appraisal years and provenance/approval requirements.
`tests/job_integration_check.py` runs against disposable PostgreSQL in PR CI and
before the production workflow receives credentials. It exercises validation
without records, both scopes on one archive, interrupted-file rollback, retry,
private access and rejection by both valuation publishers.

No user-facing UI or brand assets change in this importer update.
