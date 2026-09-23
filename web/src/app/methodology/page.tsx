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
    updated={null}
    wide
  >
    <nav aria-label="On this page">
      <a href="#sources">Sources and methodology</a>{" · "}
      <a href="#values">Understanding values</a>{" · "}
      <a href="#comparisons">Comparisons</a>{" · "}
      <a href="#protests">Protest evidence</a>
    </nav>
    <section id="sources" className={styles.methodologySection} aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources and methodology</h2>
      <p>ParcelSavvy brings together public appraisal records to make property values, changes, and comparisons easier to understand. The details below explain where the information comes from, how we use it, and where its limits matter.</p>
      <div className={styles.methodologyCards}>
        <div className={styles.methodologyCard}>
          <h3>Where the data comes from</h3>
          <p>ParcelSavvy uses public records published by the Travis Central Appraisal District (TCAD), including appraisal exports, property and improvement details, protest-related records, deeds, and published appraisal schedules. We may combine records released at different points in the appraisal cycle to show how a property’s assessment changed over time.</p>
        </div>
        <div className={styles.methodologyCard}>
          <h3>How we use it</h3>
          <p>We organize the records into a clearer property history and use available characteristics such as location, size, age, land, and improvements to support property and neighborhood comparisons. When TCAD publishes adjustment schedules or methodology, we use them to help explain the district’s reported values.</p>
        </div>
      </div>
      <div className={styles.methodologyLimits}>
        <h3>What the data can and cannot tell you</h3>
        <p>Public records may be corrected, supplemented, or released on different schedules. Some results are estimates or observations derived from those records and are labeled accordingly. A value reduction does not necessarily equal tax savings, and a comparison is not a prediction of a protest outcome.</p>
        <p><strong>Where timing matters, ParcelSavvy shows the applicable source date with the property or result.</strong></p>
      </div>
      <div className={styles.officialCallout}>
        <div>
          <h3>Independent of the Appraisal District</h3>
          <p>ParcelSavvy does not create or change official appraisal records. TCAD’s records remain the official source for your property. Verify important details with the Appraisal District and report anything that appears incorrect.</p>
        </div>
        <div className={styles.methodologyActions}>
          <a className={styles.methodologyAction} href={appraisalDistrict.propertySearchUrl} target="_blank" rel="noreferrer" aria-label="Review official property records">Review official property records <span aria-hidden="true">→</span></a>
          <Link className={styles.methodologyAction} href="/report-data-issue" aria-label="Report a data issue">Report a data issue <span aria-hidden="true">→</span></Link>
        </div>
      </div>
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
      <p>If market value remains above the capped value, a market reduction may leave the current taxable value unchanged. Exemptions and tax rates also affect the bill. ParcelSavvy does not promise savings.</p>
    </section>
    <section aria-labelledby="availability-heading">
      <h2 id="availability-heading">Unavailable or conflicting records</h2>
      <p>Unavailable or conflicting values remain unknown rather than becoming zero. Confidential records are excluded from public search, and address searches omit identified parkland. An exact property ID can still find a published park parcel.</p>
    </section>
  </InformationPage>;
}
