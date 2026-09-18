# Private visitor suggestions (MVP)

The homepage footer opens a small “Suggest a feature or metric” dialog. Visitors choose a feature or a number/comparison and enter 10–2,000 characters. No email or account is required. Submissions are private; no mail is sent and no public voting or approval workflow is implemented.

## Review

After deployment, sign in through `/admin`, then choose **Review visitor suggestions**. The inbox at `/admin/suggestions` is part of the Vercel-hosted website. Supabase stores the records durably; Vercel logs are not the inbox. Only an existing verified administrator with a live session can read them. Newest suggestions appear first in pages of 50. React renders the text without interpreting HTML.

## Release prerequisite

Apply `supabase/migrations/20260918230633_private_feature_suggestions.sql` before deploying this UI. This draft PR does not apply the migration to production. Without it, the form keeps the visitor’s text and reports that saving failed. No changes are made to appraisal records, ingestion, active releases, or administrator membership.

## Storage and safeguards

The private `parcel_feedback.suggestions` table stores an internal ID, a random retry token, category, message, and server timestamp. No name, email, address, or IP field is collected. Hosting infrastructure may still process normal request metadata as described in the privacy policy. Drafts exist only in page memory and are lost on reload/navigation. Successful submissions remain until an administrator removes them through an authorized database maintenance process; periodic review should remove suggestions no longer needed.

The public submission function uses invoker permissions and insert-only RLS. Visitors have no read, update, or delete grants. The admin read wrapper uses the existing private authorization function; it requires verified membership and a live session. Reads exclude retry tokens. Identical retries use the same token; unique constraints prevent duplicate inserts and never overwrite an existing suggestion. Editing a failed draft creates a new token.

The HTTP endpoint requires same-origin JSON and enforces an 8 KB streaming body limit. Both HTTP and SQL validate field sizes/types. A hidden honeypot filters simple automated posts. These controls are not bot protection or a durable rate limiter: the publishable database endpoint also supports insert-only submissions directly. Add stronger abuse controls if traffic warrants them; none is claimed here. Payloads and raw database errors are not logged by application code.

## Verification

Unit tests cover origin, malformed input, size bounds, honeypot handling and failure messages. SQL tests verify insert-only permissions, retry behavior, immutable server fields, administrator membership/session checks, and pagination. Browser tests submit into the real SQL fixture, check keyboard/Escape/focus return, preserve failed drafts, verify private inbox contents, and run accessibility/responsive checks at 375, 768 and 1440 px with enlarged text.
