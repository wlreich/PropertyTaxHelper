import { CurrentAssessment } from "./current-assessment";
import { propertySource } from '@/lib/property-source';
import { selectCurrentAssessment } from "@/lib/current-assessment";
import { CapAndExemptions } from './cap-and-exemptions';
import { annualReviewGuideHref } from '@/content/guide-navigation';
import { ValueDrivers, RecordedPropertyDetails } from './property-value-details';
import { capModel } from '@/lib/property-sections';
import type {MarketAdjustment} from '@/lib/market-adjustments';
import Link from "next/link";
import { InterimChange } from "./homeowner-story";
import { PropertySectionLink } from "./property-section-link";
import { PropertyNavigation } from "./property-navigation";
import { SeasonNotice } from "./season-notice";
import type { SeasonContext } from "@/lib/seasons";
import { AnnualAssessmentHistory, AnnualHistoryProvider } from "./annual-assessment-history";
import { annualHistory } from "@/lib/annual-history";
import {
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
  searchContext = "",
}: {
  property: Property;
  marketAdjustment?: MarketAdjustment | null;
  snapshots: Snapshot[];
  historyUnavailable: boolean;
  protests?: ProtestObservation[];
  protestsUnavailable?: boolean;
  season?: SeasonContext | null;
  searchContext?: string;
}) {
  const current = selectCurrentAssessment(p, snapshots);
  const source = propertySource(p);
  const printParams = new URLSearchParams(searchContext);
  printParams.set("release",current.dataset_id);
  const previous = current ? annualBaseline(snapshots, current) : undefined;
  const initial = current ? preliminaryBaseline(snapshots, current) : undefined;
  const facts = propertyFacts(current);
  const evidence = protestEvidence(snapshots, protests);
  const historyRows = annualHistory(snapshots, evidence);
  return (
    <AnnualHistoryProvider key={p.property_id} rows={historyRows} unavailable={historyUnavailable} protestsUnavailable={protestsUnavailable}>
      <div className="profile-heading overview-heading">
        <div>
          <h1>{p.address}</h1>
          <p>{[p.city, p.postal_code].filter(Boolean).join(", ")} · Appraisal District #{p.property_id}</p>
        </div>

        <Link className="overview-secondary-action" href={`/property/${p.property_id}/print?${printParams}`}>Print / save property report</Link>
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
          <SeasonNotice propertyId={p.property_id} season={season} current={current} recordYear={p.tax_year} evidence={evidence} />
          <InterimChange current={current} initial={initial} />
          {(historyUnavailable || snapshots.length === 0) && (
            <div className="notice">
              <h2>
                {historyUnavailable
                  ? "Assessment history is temporarily unavailable"
                  : "More comparison data needed"}
              </h2>
              <p>
                {historyUnavailable
                  ? "The current property values are shown above. Try again in a few minutes for history and detailed records."
                  : "Detailed comparisons for this record have not been published or are withheld because the source cannot be reconciled safely."}
              </p>
            </div>
          )}
          <CapAndExemptions model={capModel(current, previous, !historyUnavailable && snapshots.some(s => s.dataset_id === current.dataset_id), initial)} propertyId={p.property_id} annualReviewHref={annualReviewGuideHref(p.property_id)} />
          <ValueDrivers current={current} previous={previous} adjustment={marketAdjustment} propertyId={p.property_id} />
          <RecordedPropertyDetails current={current} previous={previous} propertyId={p.property_id} />
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
              <Link href="/support">Support ParcelSavvy ↗</Link>
            </div>
          </section>
          <AnnualAssessmentHistory />
          <section className="overview-source">
            <p>Latest assessment shown: {snapshotLabel(current)} record · {current.export_date ? dateLabel(current.export_date) : current.export_time_raw ?? "Source date not reported"}.</p>
            <p className="overview-source-links"><a href={source.parcelHref}>Official Appraisal District property record ({p.tax_year}) ↗</a><Link href={`/report-data-issue?property=${p.property_id}`}>Report a data issue</Link></p>
            <details className="homeowner-details"><summary id="about-records-heading">About these assessment records</summary>
            <p>ParcelSavvy uses dated Appraisal District releases. The District may correct records later, and preliminary and final values can differ. Missing or withheld records remain unavailable; ParcelSavvy does not treat them as zero.</p>
            <p><a href={source.downloadHref}>{source.downloadLabel} ↗</a><br />{source.description}</p>
            </details>
          </section>
        </div>
      </div>
    </AnnualHistoryProvider>
  );
}
