import type { Metadata } from "next";
import Link from "next/link";
import { InformationPage, informationStyles as styles } from "@/components/information-page";
import { appraisalDistrict } from "@/lib/appraisal-district";

export const metadata: Metadata = { title: "Data & methodology | ParcelSavvy" };

export default function MethodologyPage() {
  return <InformationPage
    eyebrow="Understand the evidence"
    title="Data & methodology"
    intro="Where the numbers come from, what our comparisons mean, and what the records cannot tell us."
    updated="September 19, 2026"
  >
    <nav aria-label="On this page">
      <a href="#sources">Sources and dates</a>{" · "}
      <a href="#values">Understanding values</a>{" · "}
      <a href="#comparisons">Comparisons</a>{" · "}
      <a href="#protests">Protest evidence</a>
    </nav>
    <section id="sources" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources and dates</h2>
      <p>ParcelSavvy uses public Travis Central Appraisal District (TCAD) appraisal exports, property and improvement records, protest supplements, and published appraisal schedules. We are independent of TCAD. Its official records remain the place to verify your property.</p>
      <p>The source inventory checked on September 19, 2026 includes:</p>
      <dl className={styles.contactList}>
        <div><dt>2026 values</dt><dd>April 2 preliminary export and July 18 certified export. Search results use the certified release. The export timestamp is shown with the results.</dd></div>
        <div><dt>2025 history</dt><dd>May 8 preliminary, July 3 interim, and July 19 certified exports. The July 3 file is labeled preliminary in the source, but may already contain protest changes, so it is not used as the original proposed value. May 8 values that conflict with a recorded appeal starting value are also excluded from preliminary comparisons.</dd></div>
        <div><dt>Supplemental protest evidence</dt><dd>2025 and 2026 protest supplements, including public observations dated April 29 and September 13, 2026, plus records without a reported export date. These update protest evidence; they do not replace the July 18 certified values.</dd></div>
        <div><dt>Comparison inputs</dt><dd>Selected-year property and improvement records, TCAD’s 2026 sale and equity adjustment methodology, and published 2025 and 2026 class/age depreciation schedules. Methods and assumptions are shown beside the comparison grid.</dd></div>
      </dl>
      <p>A source date describes that file or observation, not the date a protest happened. It is not a universal “current through” date for the entire site. Coverage varies by property, and a missing year or record is not evidence that nothing happened. Use the source labels on each property for the records available there.</p>
    </section>
    <section id="values" aria-labelledby="values-heading">
      <h2 id="values-heading">Market value is not your tax bill</h2>
      <ul>
        <li><strong>Market value:</strong> TCAD’s estimate of the property’s value as of January 1 of the appraisal year.</li>
        <li><strong>Capped/appraised value:</strong> a qualifying appraisal limit can hold the value used for taxation below market value. The residence homestead limit generally uses the lower of market value or the prior year’s appraised value plus 10%, plus qualifying new improvements. Eligibility and timing matter.</li>
        <li><strong>Exemptions and taxable value:</strong> exemptions reduce the value subject to tax for an eligible owner. Amounts can differ by taxing unit, so there may be several taxable values for one property.</li>
        <li><strong>Tax bill:</strong> the amount charged depends on taxable values, adopted tax rates, and any applicable tax limitations. A change in market value alone does not establish the change in your bill.</li>
      </ul>
      <p>Read the <a href="https://comptroller.texas.gov/taxes/property-tax/valuing-property.php">Texas Comptroller’s explanation of property values and appraisal limits</a> and <a href="https://comptroller.texas.gov/taxes/property-tax/exemptions/">property tax exemptions</a>. ParcelSavvy’s source labels distinguish recorded amounts from estimates.</p>
    </section>
    <section id="comparisons" aria-labelledby="comparisons-heading">
      <h2 id="comparisons-heading">How comparisons work</h2>
      <p>Open a property and choose <strong>Compare properties</strong>. Suggested properties use the recorded market area, construction class, living area, and age. A nearby property is not automatically a suitable comparable. Our matching is a partial check, not TCAD’s complete selection process.</p>
      <p>Equity comparisons start with the comparable’s market assessment, then adjust for differences in land, living area, construction class, depreciation, non-living features, additional improvements, and neighborhood multiplier. Each adjustment makes the comparable more like the subject property. The median summarizes the selected properties with complete adjustment inputs; it is not an appraisal or a guaranteed protest outcome.</p>
      <p>Improvement IDs determine how structures and features are grouped. A pool or porch attached to an additional improvement stays with that improvement; it is not counted again with the primary building.</p>
      <div className={styles.notice}>
        <h3>What is estimated or unavailable?</h3>
        <p>Physical condition is not reported in these inputs. Depreciation estimates use the selected year’s published class/age schedule and assume average condition. Actual year built substitutes when depreciation year is missing. Unsupported years or missing required costs remain unknown. Equal neighborhood factors may be assumed within the same recorded market area when a factor cannot be recovered.</p>
        <p>These assumptions are visible in the grid’s details. Sales calculations require an explicitly supplied adjusted sale price; we do not turn assessments into sale prices or guess missing sale adjustments. A different market-area multiplier adjustment has formula tests, but has not been reconciled against an observed nonzero worked example.</p>
      </div>
    </section>
    <section id="protests" aria-labelledby="protests-heading">
      <h2 id="protests-heading">Protest records, reductions, and savings</h2>
      <p><strong>Recorded evidence</strong> comes from a protest flag, an appraisal review board case, or a supplemental protest record. An agent listed for a year does not prove that agent handled a particular case.</p>
      <p><strong>Inferred observations</strong> are different: neighborhood protest metrics also include properties whose eligible preliminary market value fell before certification, even if a protest record is missing. A reduction can have other causes. Read the population and denominator notes alongside neighborhood metrics; these groups do not establish that protesting caused the difference.</p>
      <p>A property may show a recorded protest with no reduction, or a reduction without a recorded protest. “Looks like a successful protest” indicates a reduction alongside recorded evidence, not proof of causation. Missing evidence is not proof that no protest was filed.</p>
      <p><strong>A value reduction is not tax savings.</strong> If market value remains above the capped value, a market reduction may leave the current taxable value unchanged. Exemptions and tax rates also affect the bill. ParcelSavvy does not promise savings.</p>
    </section>
    <section aria-labelledby="verify-heading">
      <h2 id="verify-heading">Verify a record or report a problem</h2>
      <p><a href={appraisalDistrict.propertySearchUrl} target="_blank" rel="noreferrer">Open TCAD’s official property search ↗</a> for the district’s records. If a value, exemption, address, or source label looks wrong, <Link href="/report-data-issue">report a data issue</Link> with the property ID and the source you are comparing.</p>
      <p>Unavailable or conflicting values remain unknown rather than becoming zero. Confidential records are excluded from public search, and address searches omit identified parkland. An exact property ID can still find a published park parcel.</p>
    </section>
  </InformationPage>;
}
