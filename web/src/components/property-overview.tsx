import { CurrentAssessment } from "./current-assessment";
import { selectCurrentAssessment } from "@/lib/current-assessment";
import { CapAndExemptions } from './cap-and-exemptions';
import { ValueDrivers, RecordedPropertyDetails } from './property-value-details';
import { capModel } from '@/lib/property-sections';
import type {MarketAdjustment} from '@/lib/market-adjustments';
import Link from "next/link";
import { ProtestResult, InterimChange, AssessmentSequence, Representation, HomeownerNextSteps } from "./homeowner-story";
import { PropertySectionLink } from "./property-section-link";
import { PropertyNavigation } from "./property-navigation";
import { priorSeasonResult } from "@/lib/homeowner-insights";
import { SeasonNotice } from "./season-notice";
import type { SeasonContext } from "@/lib/seasons";
import { currency } from "@/lib/property-search";
import {
  entityDisplayName,
  annualBaseline,
  preliminaryBaseline,
  dateLabel,
  snapshotLabel,
  propertyFacts,
  protestEvidence,
  type ProtestObservation,
  type Snapshot,
} from "@/lib/property-history";
import type { Property } from "@/lib/supabase/properties";

const amount = (n: number | null | undefined, unit = "") => n == null ? "Not reported" : `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}${unit}`;
export function PropertyOverview({
  property: p,
  marketAdjustment = null,
  snapshots,
  historyUnavailable,
  protests = [],
  protestsUnavailable = false,
  season = null,
}: {
  property: Property;
  marketAdjustment?: MarketAdjustment | null;
  snapshots: Snapshot[];
  historyUnavailable: boolean;
  protests?: ProtestObservation[];
  protestsUnavailable?: boolean;
  season?: SeasonContext | null;
}) {
  const current = selectCurrentAssessment(p, snapshots);
  const previous = current ? annualBaseline(snapshots, current) : undefined;
  const initial = current ? preliminaryBaseline(snapshots, current) : undefined;
  const facts = propertyFacts(current);
  const entity =
    current?.entities.find((e) => /\bISD\b|SCHOOL/i.test(e.name)) ??
    current?.entities[0];
  const evidence = protestEvidence(snapshots, protests);
  const historical = priorSeasonResult(snapshots, season?.config.tax_year ?? p.tax_year);
  return (
    <>
      <div className="profile-heading overview-heading">
        <div>
          <h1>{p.address}</h1>
          <p>{[p.city, p.postal_code].filter(Boolean).join(", ")} · Appraisal District #{p.property_id}</p>
        </div>

      </div>
      {p.values_under_review && (
        <div className="notice">
          <h2>Some values need further review</h2>
          <p>
            Shared ownership or differing source values prevent reliable
            comparisons. Unreconciled amounts are withheld.
          </p>
        </div>
      )}
      <dl className="overview-quick-facts" aria-label="Key property facts">
        {[
          ["Living area", amount(facts.livingArea, " sq ft")],
          ["Lot size", amount(current.land_acres, " acres")],
          ["Year built", facts.yearBuilt ?? "Not reported"],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <PropertyNavigation propertyId={p.property_id} />
      <CurrentAssessment current={current} snapshots={snapshots} evidence={evidence} season={season} unavailable={historyUnavailable || protestsUnavailable} />
      <nav className="overview-section-nav" aria-label="Property sections">
        <span className="overview-section-nav-label">On this page</span>
        <PropertySectionLink target="exemptions-heading">Cap &amp; exemptions</PropertySectionLink>
        <PropertySectionLink target="market-adjustment-heading">Value drivers</PropertySectionLink>
        <PropertySectionLink target="property-facts-heading">Property details</PropertySectionLink>
        <PropertySectionLink target="history-heading">History</PropertySectionLink>
      </nav>
      <div className="overview-layout">
        <div className="overview-content">
          <SeasonNotice season={season} current={current} recordYear={p.tax_year} evidence={evidence} />
          <InterimChange current={current} initial={initial} />
          <ProtestResult current={current} initial={initial} entity={entity} evidence={evidence} />
          {(historyUnavailable || snapshots.length === 0) && (
            <div className="notice">
              <h2>
                {historyUnavailable
                  ? "Snapshot comparisons are temporarily unavailable"
                  : "More comparison data needed"}
              </h2>
              <p>
                {historyUnavailable
                  ? "The current property values are shown above. Try again in a few minutes for history and detailed records."
                  : "Detailed comparisons for this record have not been published or are withheld because the source cannot be reconciled safely."}
              </p>
            </div>
          )}
          <CapAndExemptions model={capModel(current, previous, !historyUnavailable && snapshots.some(s => s.dataset_id === current.dataset_id))} propertyId={p.property_id} />
          <ValueDrivers current={current} previous={previous} adjustment={marketAdjustment} propertyId={p.property_id} />
          <RecordedPropertyDetails current={current} previous={previous} propertyId={p.property_id} />
          <section
            className="overview-section"
            aria-labelledby="history-heading"
          >
            <div className="section-heading">
              <h2 id="history-heading" tabIndex={-1}>Assessment history</h2>
            </div>
            <AssessmentSequence current={current} previous={previous} initial={initial} />
            {snapshots.length ? (
              <details className="homeowner-details"><summary>View all assessment values</summary>
              <div className="overview-table-wrap">
                <table className="overview-table">
                  <caption>Values as recorded in each Appraisal District export</caption>
                  <thead>
                    <tr>
                      <th scope="col">Value</th>
                      {snapshots.map((s) => (
                        <th key={s.dataset_id} scope="col">
                          {snapshotLabel(s)}
                          <span>{dateLabel(s.export_date)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        "market_value",
                        "assessed_value",
                        "land_value",
                        "improvement_value",
                      ] as const
                    ).map((key, i) => (
                      <tr
                        key={key}
                        className={
                          i === 0 ? "overview-row-highlight" : undefined
                        }
                      >
                        <th scope="row">
                          {
                            [
                              "Market value",
                              "Value after cap",
                              "Land value",
                              "Improvement value",
                            ][i]
                          }
                        </th>
                        {snapshots.map((s) => (
                          <td
                            key={s.dataset_id}
                            data-label={`${snapshotLabel(s)} · ${dateLabel(s.export_date)}`}
                          >
                            {currency(s[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {entity && (
                      <tr>
                        <th scope="row">
                          Taxable · {entityDisplayName(entity)}
                        </th>
                        {snapshots.map((s) => (
                          <td
                            key={s.dataset_id}
                            data-label={`${snapshotLabel(s)} · ${dateLabel(s.export_date)}`}
                          >
                            {currency(
                              s.entities.find((e) => e.code === entity.code)
                                ?.taxable_value ?? null,
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </details>
            ) : (
              <p>No comparable snapshots available.</p>
            )}
          </section>
          {historical.current && historical.current.dataset_id !== current?.dataset_id && <ProtestResult current={historical.current} initial={historical.initial} evidence={evidence} historical />}
          <Representation evidence={evidence} year={current.tax_year} unavailable={protestsUnavailable} />
          <HomeownerNextSteps address={p.address} />
          <section className="overview-context" aria-labelledby="context-heading">
            <h2 id="context-heading">Put your assessment in context</h2>
            <p>Compare homes with similar size, age, construction and land.{current.neighborhood ? ` Start with your Appraisal District neighborhood group, ${current.neighborhood}.` : ' Start with the available neighborhood records.'}</p>
            <div className="overview-context-actions">
              <Link className="action-button" href={`/property/${p.property_id}/compare`}>Compare similar properties</Link>
              <Link className="overview-secondary-action" href={`/property/${p.property_id}/neighborhood`}>Explore my neighborhood</Link>
            </div>
            <div className="overview-donation">
              <h3>A clearer picture, for every homeowner.</h3>
              <p>If this helped you understand your assessment, help keep ParcelSavvy free.</p>
              <Link href="/support">Make a donation ↗</Link>
            </div>
          </section>
          <section className="overview-source">
            <p>Latest assessment shown: {snapshotLabel(current)} record · {current.export_date ? dateLabel(current.export_date) : current.export_time_raw ?? "Export date not reported"}. Later Appraisal District corrections may exist.</p>
            <details className="homeowner-details"><summary id="about-records-heading">Sources &amp; calculation details</summary>
            <p>These dated Appraisal District records may not reflect today’s property or protest status. Preliminary values can change; a missing protest entry does not establish whether a protest was filed, and an agent assignment does not confirm who handled the case.</p>
            <p>
              Later corrections may appear in Appraisal District’s live records. Export times
              are shown as supplied without an assumed timezone. Only available,
              comparable snapshots are shown; missing records are not treated as
              zero.
            </p>
            <p>Feature values are shown as recorded and may not add up to the main improvement total. A later missing record does not erase earlier evidence.</p>
            <p>Bold changes are at least $25,000, or at least 10% and $10,000. Size alone does not establish an error. Positive emphasis is reserved for a qualified preliminary-to-certified reduction with recorded protest evidence.</p>
            <a href="https://traviscad.org/propertysearch/">
              Check Appraisal District’s current records ↗
            </a>
            <span> · </span>
            <a href={p.source_url}>Appraisal District source ↗</a>
            <span> · </span>
            <Link href={`/report-data-issue?property=${p.property_id}`}>Something looks wrong? Report a data issue</Link>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
