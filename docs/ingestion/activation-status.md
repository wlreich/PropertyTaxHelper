# Ingestion activation status

The SQL approved in PR #8 was applied to Supabase project `flnhdrkfaybruzlbixfy` on 2026-09-07 after PRs #7 and #8 were merged. Both deployed migration statements were compared byte-for-byte with the merged SQL and match.

The Supabase migration tool assigned execution-time versions:

| Migration | Applied version |
| --- | --- |
| database_health | 20260907202107 |
| tcad_ingestion_foundation | 20260907212540 |
| tcad_source_chronology | 20260907212551 |

This PR aligns Git filenames with the applied versions, preserving SQL unchanged. Do not reapply the creation statements. Automatic approval review rejected rewriting database migration-history versions; no history rows were changed. The filename alignment preserves the original execution history.

Hosted verification: six tables with RLS enabled, 22 views using security_invoker, website roles denied schema access, loader unable to update import_events, and no Supabase security advisor notices. Records and import history are empty. There has been no real county load.

Remaining activation: a long-running ingestion job, durable private archive storage, a dedicated loader login with securely configured credentials, and full-archive/layout validation with database capacity review. The current importer expects a persistent filesystem archive directory; a cloud bucket integration requires implementation. Vercel does not run these imports and no website deployment is needed for the schema.
