# Validate a ZIP downloaded in your browser

Use this when TCAD's download works in your browser but refuses the GitHub job.
Keep the original ZIP intact. Do not unzip it or upload its individual contents.

## 1. Upload directly to your private storage

1. Keep the original downloaded filename locally. Make a copy named `2026-certified.zip` for this upload. If Windows hides file extensions, rename only the visible name to `2026-certified` so you do not create `.zip.zip`.
2. Open [TaxTransparency in Supabase](https://supabase.com/dashboard/project/flnhdrkfaybruzlbixfy).
3. Select **Storage**, then open the existing **tcad-archives** bucket. It must remain **Private**.
4. Create a folder named **incoming** and open it.
5. Click **Upload files** (or drag the ZIP into that folder), select `2026-certified.zip`, and wait for the completed upload to appear.
6. The object path will be `incoming/2026-certified.zip`. Confirm the displayed size is close to your local compressed file size.

If that name already exists, use a new name such as `2026-certified-2.zip` and use the matching path in the next step. Do not overwrite a previous upload.

A roughly 512 MB ZIP fits this workflow's 2 GiB manual-upload limit. Supabase's project-wide upload limit must also allow it. If the dashboard reports a file-size limit error, open **Storage settings** and check the global file-size limit set in the original setup guide (2048 MB). Pro supports a configurable limit above this size. No new account, public bucket, or credentials are required. [Supabase file limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

If the upload itself fails, keep the ZIP and note the dashboard's error. Do not make the bucket public to resolve an upload error.

## 2. Merge the upload workflow PR

The new mode appears after its PR is merged. Its included migration allows unknown source download times for explicitly marked manual-upload receipts and adds storage transfer evidence to the chronology view. Apply that reviewed migration before the first **import** of a manual upload. Validation can run before that migration because it inserts no property or acquisition records.

## 3. Start a new validation run

Open [TCAD data import](https://github.com/wlreich/PropertyTaxHelper/actions/workflows/tcad-import.yml), select **Run workflow**, and use these settings:

| Input | Value |
| --- | --- |
| Branch | `main` |
| mode | `validate_uploaded` |
| source_url | The original official TCAD ZIP URL shown below |
| uploaded_archive_key | `incoming/2026-certified.zip` |
| browser_downloaded_on | Your browser download date as `YYYY-MM-DD`, if known; otherwise blank |
| tax_year | `2026` |
| roll_stage | `certified` |
| encoding | `ascii` |
| archive_sha256 | Leave blank, or supply a SHA-256 computed from your local ZIP for an additional comparison |
| receipt_sha256 | Blank |
| import_approved | Unchecked |
| published_on / publication_evidence | Blank unless supported by publisher evidence |

Original source URL for the July certified export:

```text
https://traviscad.org/wp-content/largefiles/2026%20Certified%20Appraisal%20Export%20Supp%200_07182026.zip
```

Click **Run workflow**. This mode reads the uploaded ZIP from private storage and makes no request to TCAD. The supplied source URL is provenance reported by the operator; it is not independently authenticated as the origin of manually uploaded bytes.

The workflow streams the object, checks its byte count, calculates its SHA-256, preserves the archive and receipt under checksum-based names, reads the preserved objects back to verify hashes, and validates all documented members and ZIP CRCs. An optional local SHA-256 proves the uploaded bytes match your local file. Without it, the first computed checksum identifies the bytes received from your private bucket.

## Dates and next steps

The browser download date is explicitly labeled **reported** and has day precision. The exact original download start/end times and HTTP last-modified header stay unknown. Storage object modification/upload evidence and the job's retrieval timestamps are recorded separately. The original filename date is not treated as a publication date. ZIP member times and TCAD export header dates are still preserved.

Revalidating the same staged object creates a new retrieval receipt but reuses an identical preserved archive. Import uses the exact archive and receipt checksums from the reviewed validation report, so later changes to `incoming/` do not change an approved import.

After validation completes, review the aggregate report and database capacity before approving any import. Keep the local ZIP and private staged copy until the preserved archive is verified. No automatic deletion is performed. The acquisition migration requires separate application after review; merging code alone does not apply it to Supabase.
