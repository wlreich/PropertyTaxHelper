# Marketing automation and light advertising plan

Status: light advertising approach approved in conversation; marketing strategy and implementation backlog proposed for review.
Prepared: 2026-09-07.
Scope: Travis County MVP. This document records requirements; it does not activate campaigns, create accounts, authorize spending, or deploy website changes.

## Objective and operating model

Attract Travis County homeowners with useful local property-tax information, give them a reason to return, and convert a small subset to paid research reports or appropriate referrals. Initial professional outreach targets real estate agents and small landlords. Keep public education useful without requiring a purchase.

The operating target, after setup and stabilization, is a 15-20 minute weekly owner review and a 30 minute monthly performance review. This is a design target, not a guarantee; launch introductions, account setup, unusual data issues, and customer support are additional work. The system should report actual owner time so we can simplify channels that consume it.

The acquisition sequence is: useful guide or neighborhood analysis -> free property lookup -> optional subscription or saved property -> relevant update -> paid report preview -> purchase or disclosed referral.

Email supports retention and conversion. It does not acquire the first subscribers by itself. Search and social traffic are uncertain, and an empty social account is not a launch distribution plan.

## Confirmed advertising requirements

- One optional placement on eligible public guides, neighborhood analyses, and free property overviews. On a property page it appears below the main analysis.
- Maximum one placement per mobile page.
- Interactive maps, comparison tables, search controls, paid reports, downloads, accounts, and checkout remain ad-free.
- Reserve space before an ad loads. No popups, sticky overlays, full-screen interruptions, autoplay video, or ad content resembling a search result or download button.
- Clearly label advertisements. Sponsorship never changes comparable selection, scores, findings, or provider recommendations.
- Start with one or two sponsors rotating through the same placement. Network ads are an optional later test after eligibility and performance review.
- Store sponsor creative, destination URL, accessible text, placement, start/end dates, disclosure label, and active/paused state. Expired or paused campaigns must stop serving; an unfilled slot should not show a broken placeholder.
- Use aggregate impression and click reports. Do not give sponsors visitor contact details or saved-property activity by default.
- Record impressions and clicks separately from affiliate commissions and paid reports so revenue is not counted twice.
- The earlier $100-$250 monthly sponsorship range is a price-testing hypothesis, not contracted revenue. Provider signup and campaign activation require separate implementation and authorization.

## Channel priorities

| Priority | Channel | What we build or produce | Automation | Remaining human work |
| --- | --- | --- | --- | --- |
| 1 | Organic search | A small set of original guides and useful neighborhood/market-area pages | Refresh verified data, update eligible sitemaps, generate drafts and monitor search queries | Approve page templates and new factual or legal claims |
| 1 | Opt-in email | Launch signup, welcome sequence, local digest, later data-release alerts | Subscription confirmation, approved sequences, segmentation, unsubscribe handling, delivery reports | Approve new campaign content and exceptions |
| 2 | Agent and neighborhood partners | Shareable analysis, a short demonstration, tracked links, one standard sharing kit | Generate partner assets and summarize attributed visits/conversions | Initial introductions and permission to share; no automated cold messages |
| 3 | Owned social accounts | One Facebook brand page and one LinkedIn brand page initially | Repurpose approved material into scheduled posts | Review a small batch; handle genuine replies requiring judgment |
| Later | Paid acquisition | A capped experiment after conversion economics exist | Reporting and explicit budget controls | Approve creative, spending cap, and stop criteria |

Do not create separate daily content programs for every platform. Reddit, Nextdoor, Facebook groups, and neighborhood newsletters may help at launch, but participation follows each community's rules and requires authorized, human-directed sharing. No automated promotional replies, mass direct messages, fabricated community personas, purchased mailing lists, or unsolicited owner outreach sourced from appraisal rolls.

## Search and content plan

Begin with six evergreen guides and approximately 10 substantial area pages once data quality supports them. The counts are manageable pilot targets, not guaranteed traffic requirements.

Initial guide topics:
1. How to read a Travis County appraisal notice.
2. Market value, net appraised value, and taxable value explained.
3. How TCAD selects comparable properties.
4. Construction class and condition codes explained.
5. How to compare similar properties using appraisal data.
6. A property-tax protest preparation checklist linking to current official resources.

Verify tax rules, dates, and process statements against current official sources before approving their copy. Display the reviewed date.

Area pages should contain useful original analysis: available appraisal history, distribution of values, matched-property changes where valid, property-type filters, methodology, data dates, sample sizes, and a clear route to property lookup. A TCAD market area and a familiar neighborhood are not automatically identical; use a verified geographic mapping and label boundaries accurately.

Start by indexing the useful guides and area pages. Do not automatically index every parcel, filter combination, or sparse generated page. Account pages, private evidence, and personalized reports must not become search landing pages. Use access control for private content; search directives alone do not protect it.

Each indexable page needs a stable URL, accurate title and description, canonical URL, internal links, readable content, source dates, and an informative sharing preview. Sitemap last-modified dates change when the content materially changes, not every time a job runs. A sitemap assists discovery and does not guarantee indexing or ranking.

Content quality is the reason to automate from the data. Generating many near-identical pages without additional value is not the strategy.

## Turn one analysis into several useful outputs

A validated data release or approved evergreen explanation produces:
- One canonical website page.
- One accurate chart or compact visual derived from the same facts.
- Two short channel-specific social drafts linking to the page.
- One digest item.
- An optional partner sharing card with a tracked link.

AI may draft explanations from supplied facts. Calculations come from tested data queries, not language-model arithmetic. Every numerical claim retains a source release, cohort definition, sample size, and calculation reference. Do not infer tax savings from appraisal changes or call unexplained value changes protest outcomes.

Preserve distinctions among tax years and notice/certified/supplemental stages. For year-over-year claims, compare consistent property cohorts and stages; flag splits, merges, new construction, and boundary changes. A change in a neighborhood median is not automatically the change experienced by its typical continuing homeowner.

## Cadence

- Outside the spring appraisal period: one useful monthly email digest and up to two social posts per week per selected channel.
- During the spring appraisal period: up to two digest/educational campaigns per month, plus relevant opt-in data alerts.
- Create new data stories when validated new information exists. Use approved evergreen material when there is no new data; skip a post rather than invent novelty.
- Review tax-year deadlines from official sources each season before scheduling. Do not apply one generic deadline to every owner without the relevant notice-date information.
- Subscribe users to a specific purpose they understand. A launch waitlist does not silently become every available marketing list.

## Automation and approval boundaries

All items below describe future application behavior after the corresponding accounts, channels, templates, audience, and activation have been explicitly authorized.

| Work | Intended behavior |
| --- | --- |
| Data validation, aggregation, chart rendering, draft generation, link tagging, and reporting | Automatic |
| Refresh existing approved page templates with validated facts | Automatic after publishing controls are activated; hold if checks fail |
| Welcome emails and approved recurring templates to confirmed subscribers | Automatic after activation; enforce opt-out and sending limits |
| New prose, savings claims, deadline changes, or substantive interpretation | Review before publishing |
| Social distribution | Send only exact approved content to approved owned channels |
| Partner outreach, community posts, paid promotion, sponsor commitments | Explicit owner authorization; prepare drafts and assets first |

Suggested content states: draft -> checks passed -> approved -> scheduled -> published, with held/failed states and a global pause control. Revisions to approved content invalidate approval. Record the approved version, target channel, intended audience, and scheduled date.

A repeated job must not publish or email the same item twice. Use a stable content/release/audience key, record delivery status, and reconcile uncertain provider outcomes before retrying. Failed validation, unavailable source data, expired claims, or a disabled integration should hold distribution and appear in one exception digest.

Start with a review packet and manual scheduling of approved drafts if that is quicker than building integrations. Automate transfer to providers after the pilot works. We do not need a large custom marketing administration system for launch.

## Opt-in email implementation

- Provide an inline form after a useful result or article, plus a launch signup if public property lookup is not ready.
- Initially collect email, subscription purpose, and optional market area or audience interest. Do not require property ownership or a marketing subscription for basic public lookup.
- Use confirmation, consent timestamps, a verified sender domain, unsubscribe links, suppression of unsubscribed/bounced contacts, and an accessible way to change preferences.
- Keep marketing enrollment separate from account creation and paid-report delivery.
- Launch with a short approved welcome sequence: confirmation/welcome and a useful guide or demonstration.
- Send the area digest only when there is relevant approved content.
- Add saved-property release alerts after property lookup, release chronology, and user/property associations are validated.
- Do not send exact addresses, owner names, private reports, or evidence-packet contents to advertising services or general campaign analytics. Public campaign tracking should use content/area/campaign identifiers instead.
- Set sending-frequency caps across automated and editorial campaigns so simultaneous triggers do not overwhelm subscribers.

## Initial tools and budget

Recommendations are candidates, not purchases or configured integrations.

| Need | Proposed starting tool | Current verified detail and limit |
| --- | --- | --- |
| Search visibility | Google Search Console and generated sitemap | Verify the final production domain; monitor eligible pages and actual search queries |
| Email | MailerLite | Free plan currently lists 250 subscribers, 2,500 emails/month, and three active automations; five steps per automation |
| Social scheduling | Buffer | Free plan currently lists three channels and 10 queued posts per channel, plus API access |
| Formal social approval permissions | Buffer Team, only if needed | Native approval workflows require Team; the Free plan does not enforce this review workflow |
| Reporting | Existing project analytics plus campaign attribution | Choose the minimal event collection needed to measure visits, signups, and purchases |

For a pilot, target $0-$30/month in incremental marketing software and content-generation costs, with a metered generation cap. This is a planning allowance, excludes site infrastructure and labor, and is not an approved spend. Free tiers have limits and may not support every planned integration. Recheck pricing and feature availability at provisioning time; MailerLite currently lists Comfort starting at $12/month, and Buffer Team lists $10/channel/month billed annually.

Begin with one email provider and one social scheduler. Defer a separate CRM, paid SEO suite, advertising agency, and additional workflow platform until a measurable need appears.

## Launch and learning sequence

### Stage 1: While ingestion is being validated
- Preserve this ad policy and marketing backlog.
- Prepare guide outlines, area-page design, signup language, campaign taxonomy, and approved content templates.
- Identify the production domain and owned accounts to connect. Do not invent a final brand or launch date.
- Prepare a sample partner sharing kit. No outreach is sent by this planning task.

### Stage 2: After public data and lookup work end to end
- Publish the initial useful pages through the normal deployment approval process.
- Activate the confirmed opt-in welcome sequence and search measurement.
- Give a small beta group a real lookup/report workflow. Capture confusion and missing answers.
- Seek three to five initial agent or neighborhood partners through authorized introductions. Provide one ready-to-share page and tracked link; do not ask them to manufacture promotional content.
- Scheduling posts on an owned account is supplemental distribution; initial partner sharing supplies a concrete route to first visitors.

### Stage 3: First 30-90 days after launch
- Run the small content cadence and weekly approval packet.
- Use actual search queries and beta questions to choose the next pages.
- Review conversion and effort monthly. Improve the best page and channel before adding another channel.
- Request public-sharing permission before publishing customer stories; avoid claims of savings until supported.
- Test a single sponsorship once there is measured audience information. Do not guarantee leads.

### Stage 4: After conversion and margin evidence
- Validate a paid-report offer and renewal interest.
- Consider a separately approved paid-acquisition test with a hard cap and stop rule.
- Reinvest based on contribution after variable costs and support effort, not pageviews alone.
- The next full spring appraisal season is a planning opportunity, not a committed release date.

## Measurement and decision rules

The weekly owner packet should show:
- Qualified visits by search, partner, email, and social source.
- Property lookup starts and successful results.
- Confirmed email subscriptions and returning visitors.
- Report previews, checkout starts, purchases, refunds, and contribution when available.
- Ad/sponsor/affiliate revenue separately.
- Pages or campaigns needing review, failed automations, and time spent.

Suggested events: guide_view, area_view, property_lookup_started, property_lookup_succeeded, email_subscription_confirmed, report_previewed, checkout_started, purchase_completed, sponsor_impression, sponsor_click, affiliate_click. Record only the minimum data needed; raw property-search strings and email addresses do not belong in campaign parameters.

Starter learning goals, not forecasts:
- First 30 days: establish source attribution; obtain 25 confirmed subscribers and three active sharing partners.
- First 90 days: target 100 confirmed subscribers and 10 paid-report purchases once the report is available.
- Track conversion denominators explicitly, such as purchases/report previews and confirmed signups/eligible visits. Small samples are directional.
- After a channel has run for a reasonable pilot period, reduce or stop it if it consumes owner time and produces no qualified visits, subscriptions, or purchases.
- Monitor mobile usability and report conversion during ad tests. Revenue from ads must not obscure the cost of lost report purchases.

## Build backlog and acceptance criteria

| ID | Priority / dependency | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| MKT-01 | Foundation | Record the ad placement policy and an inactive sponsor slot specification | Desktop/mobile placement review; interactive and paid views excluded |
| MKT-02 | Before public launch | Canonical URLs, accurate metadata, sharing previews, sitemap, indexability rules | Eligible public pages render useful content; private/filter pages excluded; timestamps reflect real changes |
| MKT-03 | Before list activation | Inline opt-in, confirmation, preferences, unsubscribe and suppression | A test subscriber can opt in, receive approved content, unsubscribe, and stay suppressed on retries |
| MKT-04 | Before public launch | Campaign attribution and minimal funnel events | One test visit can be followed from tracked link to a confirmed signup or test purchase without exposing contact/property data in analytics |
| MKT-05 | After validated public data | Reusable area analysis and fact package | Source/cohort/sample/date recorded; mixed-stage comparisons and insufficient data held |
| MKT-06 | After templates approved | Draft packet, versioned approvals, scheduled distribution, pause and retry controls | Editing invalidates approval; reruns do not duplicate publication; pause blocks sends |
| MKT-07 | After first release pilot | Relevant area/saved-property notifications | Only eligible subscribed users receive one alert per approved release; no alert for unchanged data |
| MKT-08 | After usable demo | Standard partner sharing kit and tracked links | Partner can share one clear link without custom campaign work |
| MKT-09 | After measured audience | Sponsor rotation, expiry, disclosure, and reporting | One active slot maximum; expired ads removed; analytical output independent of sponsor |
| MKT-10 | After baseline measurement | Weekly exception/performance packet | One short review view includes failures, meaningful outcomes, and time cost |

These are acceptance criteria for later implementation. This planning change does not implement them, alter ingestion, configure external credentials, start automation schedules, or deploy to production.

## Sources checked on 2026-09-07

- [Google, generative AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [Google, spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google, sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Buffer pricing](https://buffer.com/pricing)
- [Buffer draft approval requirements](https://support.buffer.com/en-us/articles/managing-and-approving-draft-posts-57li7M8tDA)
- [MailerLite pricing](https://www.mailerlite.com/pricing)
- [MailerLite automation limits](https://www.mailerlite.com/features/automation)
- [Google AdSense placement options](https://support.google.com/adsense/answer/7037624)
- [Google publisher policies](https://support.google.com/adsense/answer/10502938)
- [FTC advertising disclosures](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses)
