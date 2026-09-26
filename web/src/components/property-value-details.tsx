import Link from 'next/link';
import { currency } from '@/lib/property-search';
import { annualChange, factorEffectContent, factorEligibilityNote, preliminaryValueDriverComparison, preliminaryValueDriverSummary, propertyFeatures } from '@/lib/property-sections';
import { constructionClasses, dateLabel, propertyFacts, type Snapshot } from '@/lib/property-history';
import { adjustmentReasons, adjustmentSummary, type MarketAdjustment } from '@/lib/market-adjustments';

export function ValueDrivers({ current, snapshots, adjustment, propertyId }: { current: Snapshot; snapshots: Snapshot[]; adjustment: MarketAdjustment | null; propertyId: string }) {
  const data = adjustment?.year === current.tax_year && adjustment.neighborhood === current.neighborhood ? adjustment : null;
  const summary = data ? adjustmentSummary(data) : null;
  const home = data?.homes.find(h => h.property_id === propertyId);
  const comparison = preliminaryValueDriverComparison(snapshots, current.tax_year);
  const pair = comparison.status === 'ok' ? comparison : null;
  const factor = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}×`;
  const effect = home?.status === 'ok' ? home.effect : null;
  const factorEffect = factorEffectContent(current.tax_year, summary?.previous?.factor, summary?.current?.factor, effect);
  const factorEligibility = factorEligibilityNote(current.tax_year, home?.preliminary_date ?? null, home?.prior_preliminary_date ?? null);
  return <section className="overview-section property-section" id="market-adjustment" aria-labelledby="market-adjustment-heading">
    <h2 id="market-adjustment-heading" tabIndex={-1}>{pair ? `Why did your ${current.tax_year} preliminary appraisal change from last year?` : `What changed in the ${current.tax_year} preliminary appraisal?`}</h2>
    {pair && <p className="value-driver-baseline">{current.tax_year} preliminary compared with {current.tax_year - 1} preliminary.</p>}
    {pair && <p className="overview-note">Records used: {dateLabel(pair.previous.export_date)} preliminary and {dateLabel(pair.current.export_date)} preliminary.</p>}
    <p>{preliminaryValueDriverSummary(comparison)}</p>
    <p>The Appraisal District uses recent area sales to set a multiplier for estimated rebuilding cost after accounting for age and condition. Land is valued separately.</p>
    <dl className="value-driver-columns">
      <div><dt>Land</dt><dd className="driver-value">{pair ? currency(pair.current.land_value) : 'Not available'}</dd><dd>{pair ? annualChange(pair.previous.land_value, pair.current.land_value, pair.previous.tax_year) : 'Preliminary comparison unavailable'}</dd></div>
      <div><dt>Home &amp; other features</dt><dd className="driver-value">{pair ? currency(pair.current.improvement_value) : 'Not available'}</dd><dd>{pair ? annualChange(pair.previous.improvement_value, pair.current.improvement_value, pair.previous.tax_year) : 'Preliminary comparison unavailable'}</dd></div>
      <div><dt>Market-area multiplier</dt><dd className="driver-value">{summary?.previous && summary.current ? `${factor(summary.previous.factor)} → ${factor(summary.current.factor)}` : 'Not available'}</dd><dd>Estimated effect: {effect === null || effect === undefined ? 'Not available' : `${effect > 0 ? '+' : effect < 0 ? '−' : ''}${currency(Math.abs(effect))}`}</dd></div>
    </dl>
    <p className="overview-note">Home &amp; other features is recorded non-land value, not rebuilding cost. The multiplier&apos;s estimated effect is one part of the preliminary appraisal, not the total annual change or tax savings.</p>
    <details className="section-disclosure factor-effect-disclosure"><summary>See the multiplier&apos;s effect on this home.</summary>
      <p>Most homes don&apos;t sell each year. The Appraisal District compares its estimates with recent sales in your market area, then uses a multiplier to adjust the estimated value of homes and other features across that area. Land is valued separately. This describes the market-modified cost method; some residential properties use an automated sales-comparison model instead.</p>
      {factorEffect ? <>
        <p>{factorEffect.intro}</p>
        <p>{factorEffect.boundary}</p>
        <figure className="factor-comparison" role="img" aria-label={factorEffect.alternative}>
          <figcaption>Same {current.tax_year} building inputs in both estimates. Only the multiplier changes.</figcaption>
          <div className="factor-comparison-row">
            <span>With {current.tax_year - 1} factor</span>
            <span className="factor-bar-track" aria-hidden="true"><span className="factor-bar-base" style={{ width: `${factorEffect.sharedWidth}%` }} />{factorEffect.previousDifferenceWidth > 0 && <span className="factor-bar-difference" style={{ width: `${factorEffect.previousDifferenceWidth}%` }} />}</span>
            <strong>{summary?.previous ? factor(summary.previous.factor) : 'Not available'}</strong>
          </div>
          <div className="factor-comparison-row">
            <span>With {current.tax_year} factor</span>
            <span className="factor-bar-track" aria-hidden="true"><span className="factor-bar-base" style={{ width: `${factorEffect.sharedWidth}%` }} />{factorEffect.currentDifferenceWidth > 0 && <span className="factor-bar-difference" style={{ width: `${factorEffect.currentDifferenceWidth}%` }} />}</span>
            <strong>{summary?.current ? factor(summary.current.factor) : 'Not available'}</strong>
          </div>
          <p className="factor-comparison-result"><span>Estimated effect of the factor change</span><strong>{factorEffect.signedEffect}</strong></p>
          <p className="factor-comparison-note">Land is separate. This is one part of the preliminary appraisal, not the total year-over-year change or tax savings.</p>
        </figure>
      </> : <p>A property-specific factor estimate is unavailable: {home && home.status !== 'ok' ? adjustmentReasons[home.status].toLowerCase() : 'a supported cost estimate and both annual factors are needed'}.</p>}
      <p>ParcelSavvy uses the first eligible preliminary record for {data?.year ?? current.tax_year}. It holds the supported current-year rebuilding-cost inputs constant and changes only the multiplier. A home qualifies only when a residential building is verified and those inputs reproduce the Appraisal District&apos;s recorded preliminary value of the home and other features within $1. Incomplete or unreconciled inputs are excluded rather than treated as zero.</p>
      {summary?.previous && summary.current && <p>Multiplier comparison: {summary.previous.year} {factor(summary.previous.factor)} to {summary.current.year} {factor(summary.current.factor)}, market area {data?.neighborhood}.</p>}
      {factorEligibility && <p>{factorEligibility}</p>}
      {home && home.status !== 'ok' && <p>Estimate unavailable: {adjustmentReasons[home.status]}.</p>}
      <p>Rebuilding costs, depreciation, property details, land and overrides can also change the recorded value. Those changes can offset or add to the multiplier effect. Missing years are not treated as unchanged multipliers.</p>
      {data && <ul>{data.history.map(h => <li key={h.year}><a href={`/data/tcad/${h.filename}#page=${h.page}`}>{h.year} Appraisal District multiplier schedule, p. {h.page}</a></li>)}</ul>}
      <p>See the <a className="section-disclosure-link" href="https://traviscad.org/wp-content/uploads/2026_Mass-Appraisal-Report.pdf#page=13">2026 Mass Appraisal Report, page 13</a> for the residential valuation method.</p>
      <p><Link className="section-disclosure-link" href="/methodology#market-adjustments">Read Data &amp; methodology</Link> for source, eligibility and limitation details.</p>
    </details>
  </section>;
}

export function RecordedPropertyDetails({ current, previous, propertyId }: { current: Snapshot; previous?: Snapshot; propertyId: string }) {
  const facts = propertyFacts(current), features = propertyFeatures(current, previous);
  const number = (n: number | null) => n === null ? 'Not reported' : n.toLocaleString('en-US');
  const feature = (f: typeof features[number]) => <div className="property-feature" key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd><dd>{f.change}</dd></div>;
  return <section className="overview-section property-section" id="property-details" aria-labelledby="property-facts-heading">
    <h2 id="property-facts-heading" tabIndex={-1}>Does the Appraisal District describe your home correctly?</h2>
    <dl className="property-primary-facts">
      <div><dt>Bedrooms</dt><dd>{number(facts.bedrooms)}</dd></div>
      <div><dt>Bathrooms</dt><dd>{number(facts.fullBaths)} full + {number(facts.halfBaths)} half</dd></div>
      <div><dt>Attached garage</dt><dd>{facts.garage === null ? 'Not reported' : `${number(facts.garage)} sq ft`}</dd></div>
      <div><dt>Year built</dt><dd>{facts.yearBuilt ?? 'Not reported'}</dd></div>
    </dl>
    <div className="property-classification"><p>Construction class {facts.classCode ?? 'not reported'}{facts.classCode && constructionClasses[facts.classCode] ? `: ${constructionClasses[facts.classCode].replace('TCAD', 'Appraisal District')}` : ''}</p><p>Neighborhood group {current.neighborhood ?? 'not reported'}</p></div>
    <div className="property-feature-columns">
      <dl className="property-feature-highlights" aria-label="Separately valued features">{features.slice(0, 2).map(feature)}{!features.length && <div><dt>Feature records</dt><dd>No separately valued features available.</dd></div>}</dl>
      <div className="property-correction"><p>Something look wrong?</p><a href={`https://travis.prodigycad.com/property-detail/${encodeURIComponent(propertyId)}/${current.tax_year}`}>Check the full property record ↗</a><p>Keep photos or documents for corrections.</p></div>
    </div>
    {features.length > 2 && <details className="section-disclosure"><summary>View all separately valued features ({features.length})</summary><dl className="property-feature-list">{features.map(feature)}</dl></details>}
    <p className="overview-note">Feature values are recorded details and may not add up to the Appraisal District&apos;s total value of the home and other features. That recorded non-land value is not a rebuilding-cost estimate. Missing details are not zero-dollar valuations.</p>
    <details className="section-disclosure"><summary>About construction class and neighborhood</summary><p>Construction class describes building quality, not current condition. Separate buildings can have different classes; ambiguous facts are not combined into a single home.</p><p>The Appraisal District groups properties to study value patterns. A shared neighborhood code is a starting point for comparison, not proof that homes should have the same value.</p><a href="https://traviscad.org/wp-content/uploads/Single-Family-Construction.pdf">Appraisal District construction class definitions ↗</a></details>
  </section>;
}
