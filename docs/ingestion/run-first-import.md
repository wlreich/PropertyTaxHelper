# Run the first TCAD import

The `TCAD data import` GitHub Actions workflow is manual and runs only from `main`. It has two stages: `validate` downloads and archives a full release without inserting property records; `import` loads the exact archive and receipt selected by their checksums. Merging this PR does not start either stage.

## One-time setup requiring Wendy's access

The connected GitHub app cannot write repository secrets, and the Supabase connector does not expose creation of S3 credentials. Complete these steps directly in the dashboards. No credentials should be pasted into ChatGPT, committed to Git, or added to Vercel.

### 1. Create the restricted loader login

Open the [TaxTransparency SQL editor](https://supabase.com/dashboard/project/flnhdrkfaybruzlbixfy/sql). Paste [`provision-loader.sql`](../../tools/ingestion/provision-loader.sql), replace its password placeholder with a new password of at least 32 letters/digits from your password manager, and run it once. The script refuses an unchanged placeholder or an existing login and rolls back on failure.

This creates `tcad_ingestion_job` with the existing `tcad_loader` privileges, no superuser/RLS-bypass/role-creation rights, and a three-connection limit. It also allows reading only the `tcad-archives` bucket's privacy and file-limit settings. It does not grant the job public API access or the ability to rewrite import history.

In Supabase **Connect**, select **Session pooler**, port **5432**. Build the following connection string using the displayed pooler hostname and the new job password:

```text
postgresql://tcad_ingestion_job.flnhdrkfaybruzlbixfy:YOUR_NEW_JOB_PASSWORD@YOUR_SESSION_POOLER_HOST:5432/postgres?sslmode=require
```

Use the job username above, not `postgres`. The 32-character alphanumeric password avoids URL-escaping problems. Transaction-pooler port 6543 is rejected because the importer uses session advisory locks. GitHub-hosted runners should use the session pooler for IPv4 connectivity.

### 2. Create Storage credentials and set the upload limit

In [TaxTransparency](https://supabase.com/dashboard/project/flnhdrkfaybruzlbixfy), open **Storage → Settings → S3**. Enable S3 if needed and generate a dedicated access-key pair for the ingestion job. Copy the **Access Key ID**, **Secret Access Key**, and **Region**.

These S3 credentials provide project-wide Storage access and bypass Storage RLS; Supabase does not scope this key pair to a single bucket. Keep them in GitHub Actions secrets and rotate them if exposed. The database credential remains separately restricted. See [Supabase S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).

Set Storage's global file-size limit to at least the chosen archive's size. **2 GB (2048 MB)** is a practical initial limit for the previously profiled roughly 661 MB ZIP; check the selected release if it is larger. Do not extract and upload the text files individually. The workflow creates `tcad-archives` through the S3 API if missing and checks that it is private before transferring source data. An existing public bucket causes a stop.

### 3. Add three GitHub secrets and one variable

In [repository Actions secrets](https://github.com/wlreich/PropertyTaxHelper/settings/secrets/actions), add:

| Secret name | Value |
| --- | --- |
| `TCAD_DATABASE_URL` | Dedicated loader connection string from step 1 |
| `TCAD_STORAGE_ACCESS_KEY_ID` | Storage S3 Access Key ID |
| `TCAD_STORAGE_SECRET_ACCESS_KEY` | Storage S3 Secret Access Key |

In [repository Actions variables](https://github.com/wlreich/PropertyTaxHelper/settings/variables/actions), add:

| Variable name | Value |
| --- | --- |
| `TCAD_STORAGE_REGION` | Exact Region shown in the Supabase S3 settings |

The endpoint and project ID are pinned in code. Workflow inputs cannot redirect Storage credentials to another endpoint. Only the final job step receives production secrets; parser and integration tests use a disposable local PostgreSQL database with synthetic records. The workflow runs no pull-request code and rejects dispatches on branches other than `main`. Repository administrators/collaborators who can change trusted workflow code remain part of the credential trust boundary.

## Browser download fallback

If TCAD refuses the GitHub download but the ZIP downloads in your browser, follow [Upload and validate a browser-downloaded ZIP](upload-downloaded-zip.md). This uses the same private storage and the new `validate_uploaded` mode. Preserve the complete ZIP and its source URL. No additional credentials are needed.

## First run: validate and archive

1. Merge the workflow PR. Open **GitHub → Actions → TCAD data import → Run workflow** and select branch `main`.
2. Leave `mode` set to **validate**.
3. Paste the direct official ZIP URL from [TCAD's public information page](https://traviscad.org/publicinformation). The certified URL discovered during setup was:

```text
https://traviscad.org/wp-content/largefiles/2026%20Certified%20Appraisal%20Export%20Supp%200_07182026.zip
```

4. Set year **2026**, roll stage **certified**, encoding **ascii** for that release. Leave archive/receipt checksums and `import_approved` blank/false. Publication date and evidence are optional; leave them blank if the publisher has not confirmed the date. A filename date is not automatically a publication date.
5. Run the workflow. It executes 21 unit tests and a disposable PostgreSQL 17 integration check, then checks the production login and bucket, downloads the ZIP, creates the acquisition receipt, archives both, reads stored bytes back to verify their hashes, and validates every source member.
6. Download the **tcad-report-…** artifact from the run. It contains `tcad-run.json` with status, archive and receipt checksums, row counts, file sizes, layout/parser hashes, date evidence and validation timestamps. It contains no property rows. Reports remain in GitHub for 30 days; archive ZIPs and receipts remain in private Supabase Storage.

The importer never extracts the full ZIP to the runner's disk. It streams records and uses bounded insert batches. Validation reports include the total serialized nonblank field bytes, which is useful for capacity planning but is **not** an exact PostgreSQL/JSONB/index size estimate. Review Supabase disk allocation/headroom and the current official layout before authorizing the full import. The stored database size alone does not establish available capacity.

## Second run: import the reviewed archive

Run the same workflow from `main` with:

- `mode`: **import**
- `archive_sha256` and `receipt_sha256`: exact values from the successful validation report
- `tax_year`, `roll_stage`, and `encoding`: the reviewed values
- `import_approved`: **true**, after reviewing the report, official layout, and database capacity

Source URL/publication inputs are unused in import mode; provenance comes from the archived receipt. The workflow retrieves the retained bytes, verifies both checksums and all rows again, then loads records using the dedicated login. The dataset's archive location is a durable `s3://tcad-archives/archives/<sha>.zip` reference, not a temporary runner directory. Successful completion requires the database row count to match the full validation report.

Concurrency is limited to one ingestion workflow, and the importer also locks each dataset. Retry using the same two checksums. Committed source files are skipped, previous attempts remain in the audit history, and no property-level deduplication occurs. A different acquisition receipt is retained separately without replacing earlier source dates.

## Limits and recovery

- The job stops after 330 minutes, below GitHub's hosted-runner six-hour maximum. Per-file transactions resume between completed files. If a single file cannot complete within that window, move that workload to a longer-running worker before attempting a full load; no county-scale throughput claim has been made yet. [GitHub limits](https://docs.github.com/en/actions/reference/limits).
- Failed downloads or Storage errors stop before database records are inserted. TCAD previously denied downloads from the ChatGPT execution environment; successful downloading from the GitHub runner remains to be verified. An HTTP failure is not evidence of a parser problem.
- If the bucket exists but is public, change it to private in Supabase before rerunning. If an object checksum conflicts, the code stops instead of overwriting it.
- Storage uses content-hash names and application-level no-overwrite checks. Supabase S3 does not support object versioning/object lock; privileged administrators or S3 credentials can still replace/delete objects. [S3 compatibility](https://supabase.com/docs/guides/storage/s3/compatibility).
- A stopped job can leave an unfinished audit attempt or multipart upload. Source files already committed stay staged; only complete datasets appear in the source views. Report artifacts may be absent after a forced runner shutdown, so retain GitHub run logs too.
- The exact stored receipt preserves acquisition timestamps. Cloud storage upload times are never substituted for the original download time.

## Verification performed before this PR

All 21 unit tests passed. The complete validate/archive/import/retry integration passed against PGlite's PostgreSQL socket adapter with test-only session adjustments and an in-memory S3 fake. It verified private-bucket checks, checksum checks, zero property inserts in validation mode, complete loading, duplicate-free retry, durable archive URI and preserved audit history. Native PostgreSQL 17 and real Supabase Storage are configured as subsequent checks, but have not run from this environment. The first GitHub dispatch performs the native PostgreSQL check before any production secrets are used.

No live loader password, S3 credentials or GitHub secrets were created by this PR. The first authorized validate run creates the bucket if needed. No property data has been imported into production.
