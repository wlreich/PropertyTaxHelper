import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter, Unavailable } from "@/components/site-shell";
import {
  currency,
  parseSearch,
  propertyType,
  resultsUrl,
} from "@/lib/property-search";
import { getProperty } from "@/lib/supabase/properties";

export const maxDuration = 30;

export default async function PropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    search = await searchParams;
  const { q, page } = parseSearch(
    typeof search.q === "string" ? search.q : "",
    typeof search.page === "string" ? search.page : "0",
  );
  const result = await getProperty(id);
  if (result.status === "not_found" || result.status === "invalid") notFound();
  const p = result.status === "ok" ? result.data : null;
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="main-shell profile-shell">
        <Link className="back-link" href={q ? resultsUrl(q, page, search.all === "1") : "/"}>
          ← {q ? "Back to search results" : "Search properties"}
        </Link>
        {!p ? (
          <Unavailable />
        ) : (
          <>
            <div className="profile-heading">
              <div>
                <p className="eyebrow">PROPERTY RECORD · {p.property_id}</p>
                <h1>{p.address}</h1>
                <p>
                  {[p.city, p.postal_code].filter(Boolean).join(", ")}{" "}
                  <span className="muted">
                    · {propertyType(p.property_type)}
                  </span>
                </p>
              </div>
              <span className="release-badge">
                {p.tax_year} · {p.roll_stage}
              </span>
            </div>
            {p.values_under_review && (
              <div className="notice">
                <h2>Some values need further review</h2>
                <p>
                  This record includes shared ownership or differing source
                  values. Unreconciled amounts are withheld to avoid presenting
                  a partial share or double-counting a property’s value.
                </p>
              </div>
            )}
            <section aria-labelledby="values-heading">
              <div className="section-heading">
                <h2 id="values-heading">Assessment at a glance</h2>
                <span className="muted">{p.tax_year} source values</span>
              </div>
              <dl className="value-grid">
                <div className="value-card featured">
                  <dt>Market value</dt>
                  <dd>{currency(p.market_value)}</dd>
                  <dd className="value-description">
                    TCAD’s reported market value.
                  </dd>
                </div>
                <div className="value-card">
                  <dt>Appraised value</dt>
                  <dd>{currency(p.appraised_value)}</dd>
                  <dd className="value-description">
                    The appraised amount in the source record.
                  </dd>
                </div>
                <div className="value-card">
                  <dt>Assessed value</dt>
                  <dd>{currency(p.assessed_value)}</dd>
                  <dd className="value-description">
                    The assessed amount in the source record.
                  </dd>
                </div>
              </dl>
            </section>
            <div className="profile-grid">
              <section
                className="detail-panel"
                aria-labelledby="details-heading"
              >
                <p className="eyebrow">PROPERTY DETAILS</p>
                <h2 id="details-heading">Land & improvements</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Land value</dt>
                    <dd>{currency(p.land_value)}</dd>
                  </div>
                  <div>
                    <dt>Improvement value</dt>
                    <dd>{currency(p.improvement_value)}</dd>
                  </div>
                  <div>
                    <dt>Land area</dt>
                    <dd>
                      {p.land_acres === null
                        ? "Not reported"
                        : `${p.land_acres.toLocaleString("en-US", { maximumFractionDigits: 4 })} acres`}
                    </dd>
                  </div>
                  <div>
                    <dt>Improvement records</dt>
                    <dd>{p.improvement_records.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Land segments</dt>
                    <dd>{p.land_segments.toLocaleString()}</dd>
                  </div>
                </dl>
                <p className="fine-print">
                  Improvement records can include multiple structures or
                  features. These counts do not represent bedrooms, homes, or
                  living area.
                </p>
              </section>
              <section
                className="detail-panel source-panel"
                aria-labelledby="source-heading"
              >
                <p className="eyebrow">KNOW THE SOURCE</p>
                <h2 id="source-heading">A record with a date</h2>
                <dl className="detail-list">
                  <div>
                    <dt>Tax year</dt>
                    <dd>{p.tax_year}</dd>
                  </div>
                  <div>
                    <dt>Release</dt>
                    <dd className="capitalize">{p.roll_stage}</dd>
                  </div>
                  <div>
                    <dt>Export time, as reported</dt>
                    <dd>{p.export_time_raw ?? "Not reported"}</dd>
                  </div>
                </dl>
                <p className="fine-print">
                  This is a snapshot of the imported TCAD release. Later
                  corrections may appear in TCAD’s live records. Export time is
                  shown as supplied, without an assumed timezone.
                </p>
                <a
                  className="text-link"
                  href="https://traviscad.org/propertysearch/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Check TCAD’s current records ↗
                </a>
                <a className="source-download" href={p.source_url}>
                  Original TCAD source archive (large ZIP) ↗
                </a>
              </section>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
