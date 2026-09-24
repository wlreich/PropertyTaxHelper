import Link from 'next/link';
import { currency } from '@/lib/property-search';
import { annualChange, propertyFeatures, valueDriverSummary } from '@/lib/property-sections';
import { constructionClasses, propertyFacts, type Snapshot } from '@/lib/property-history';
import { adjustmentReasons, adjustmentSummary, type MarketAdjustment } from '@/lib/market-adjustments';

export function ValueDrivers({ current, previous, adjustment, propertyId }: { current: Snapshot; previous?: Snapshot; adjustment: MarketAdjustment | null; propertyId: string }) {
  const data = adjustment?.year === current.tax_year && adjustment.neighborhood === current.neighborhood ? adjustment : null;
  const summary = data ? adjustmentSummary(data) : null;
  const home = data?.homes.find(h => h.property_id === propertyId);
  const factor = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}×`;
  const effect = home?.status === 'ok' ? home.effect : null;
  const effectSentence = effect === null || effect === undefined
    ? 'A supported cost estimate and both annual factors are needed to estimate the factor’s dollar effect.'
    : effect === 0
      ? `Using the ${data?.year ?? current.tax_year} supported cost estimate, the factor change has an estimated $0 effect on your modeled market value compared with keeping the previous year’s factor.`
      : `Using the ${data?.year ?? current.tax_year} supported cost estimate, the factor change ${effect > 0 ? 'adds' : 'subtracts'} approximately ${currency(Math.abs(effect))} ${effect > 0 ? 'to' : 'from'} your modeled market value compared with keeping the previous year’s factor.`;
  return <section className="overview-section property-section" id="market-adjustment" aria-labelledby="market-adjustment-heading">
    <h2 id="market-adjustment-heading" tabIndex={-1}>Why did your value change?</h2>
    <p>{valueDriverSummary(current, previous)}</p>
    <p>The district estimates the cost of rebuilding your home and features such as garages and pools, then reduces that estimate for age and condition. The Appraisal District applies a neighborhood factor to that rebuilding cost after depreciation. Land is valued separately. ParcelSavvy estimates how changing the factor affects your home&apos;s modeled value, keeping the other inputs the same.</p>
    <dl className="value-driver-columns">
      <div><dt>Land</dt><dd className="driver-value">{currency(current.land_value)}</dd><dd>{annualChange(previous?.land_value, current.land_value, previous?.tax_year)}</dd></div>
      <div><dt>Home &amp; other features</dt><dd className="driver-value">{currency(current.improvement_value)}</dd><dd>{annualChange(previous?.improvement_value, current.improvement_value, previous?.tax_year)}</dd></div>
      <div><dt>Market-area multiplier</dt><dd className="driver-value">{summary?.previous && summary.current ? `${factor(summary.previous.factor)} → ${factor(summary.current.factor)}` : 'Not available'}</dd><dd>Estimated effect: {effect === null || effect === undefined ? 'Not available' : `${effect > 0 ? '+' : effect < 0 ? '−' : ''}${currency(Math.abs(effect))}`}</dd></div>
    </dl>
    <p className="overview-note">Home &amp; other features is the Appraisal District&apos;s recorded non-land value after applicable factors. It is not the rebuilding-cost estimate.</p>
    <p className="overview-note">{effectSentence} {summary?.previous && summary.current ? `${summary.previous.year} ${factor(summary.previous.factor)} → ${summary.current.year} ${factor(summary.current.factor)}. ` : ''}Land and other input changes are separate. This isolates the factor’s contribution; it is not necessarily the total annual change or tax savings.</p>
    <details className="section-disclosure"><summary>How the estimate works</summary>
      <p>ParcelSavvy uses the first eligible preliminary record for {data?.year ?? current.tax_year}. It holds the supported current-year rebuilding-cost inputs constant and changes only the multiplier. A home qualifies only when a residential building is verified and those inputs reproduce the Appraisal District&apos;s recorded preliminary value of the home and other features within $1. Incomplete or unreconciled inputs are excluded rather than treated as zero.</p>
      {summary?.previous && summary.current && <p>Multiplier comparison: {summary.previous.year} {factor(summary.previous.factor)} to {summary.current.year} {factor(summary.current.factor)}, market area {data?.neighborhood}.</p>}
      {home?.preliminary_date && <p>Inputs from the {home.preliminary_date} preliminary record. The columns above use the current {current.tax_year} {current.roll_stage} record{previous ? ` against ${previous.tax_year} certified values` : ''}.</p>}
      {home && home.status !== 'ok' && <p>Estimate unavailable: {adjustmentReasons[home.status]}.</p>}
      <p>Rebuilding costs, depreciation, property details, land and overrides can also change the recorded value. Those changes can offset or add to the multiplier effect. Missing years are not treated as unchanged multipliers.</p>
      {data && <ul>{data.history.map(h => <li key={h.year}><a href={`/data/tcad/${h.filename}#page=${h.page}`}>{h.year} Appraisal District multiplier schedule, p. {h.page}</a></li>)}</ul>}
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
