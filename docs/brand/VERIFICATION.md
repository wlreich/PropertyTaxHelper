# ParcelSavvy implementation verification

Prepared 2026-09-08 against repository main c45aa0855b21f3aeb5e49ee5e6815afdcc8d25e7.

## Passed locally

- Formatting hygiene: final newlines and no trailing whitespace.
- Brand checks: semantic colors and fonts, asset hashes, text and control contrast, focus declarations and prohibited copy.
- ESLint and TypeScript.
- All 16 application tests, including request failures, partial address search, pagination, privacy and all-parcels behavior.
- Optimized Next.js production build using the bundled local Manrope and Inter fonts.
- Built-server checks with synthetic data: branded title/logo/tagline, term definition markup, TCAD source label, exact/partial/multiple results, pagination, parkland toggle, profile return links, confidential 404, empty/invalid results and no credential or owner-data leakage.
- Browser test collection: three projects at 375, 768 and 1440 px. Collection alone does not execute those tests.
- Manual React review: data fetching stays on the server; only the small interactive definition component is client-side; font declarations remain at module scope; no new client data fetch or sensitive serialized payload.
- Approved vector logo extraction inspected for fidelity to the supplied PDF; typography files carry their SIL Open Font Licenses.

## Not yet verified

The supported session browser blocks local preview navigation with ERR_BLOCKED_BY_CLIENT. Therefore responsive screenshots, interactive keyboard/touch behavior and the real-browser axe audit have not run here. The added CI steps execute those checks and upload screenshots when this work is published. No pixel baselines have yet been approved; the separate visual comparison command requires them. Static contrast and rendered HTML checks are not a substitute for these browser checks.

No production deployment has been changed. The workspace is a partial source checkout without Git metadata, so it has no branch/commit status. The attached implementation request explicitly prohibits committing or pushing without a separate request. Wendy subsequently authorized publication with “Publish the branding.” This file records the pre-publication local verification; the pull request and its CI run provide the publication verification.

## Source limitations and intentional exceptions

- The PDF supplies vector artwork, which was extracted without rebuilding the wordmark. Separate designer master assets and an approved reversed horizontal lockup were not supplied. The white header uses the approved primary lockup; these missing variants do not block it.
- The standalone approved mark supplies the favicon; this is the documented exception to the 24 px mark minimum in browser chrome.
- Savvy Blue on white is approximately 2.93:1, below even the 3:1 large-text threshold. It is decorative on white; Action Blue is used for functional text and primary buttons.
- Shared colors, fonts, logo and focus treatment update the property profile safely. Its existing structure and detailed type sizes remain; a broader profile redesign is outside this request.
- Historical repository, package, route and health-service identifiers remain for compatibility.
- The project has no full code formatter configured. The added formatting command checks whitespace hygiene; ESLint remains the code-style gate.
- Existing npm environment and Node module-type warnings appeared. They did not fail validation and were not changed as unrelated configuration.

## Review and publication

Review the local change bundle and the approved guide. After an explicit publish request, apply this change set to a current Git checkout, reconcile any intervening changes, run the browser CI and inspect its three screenshots before production publication.
