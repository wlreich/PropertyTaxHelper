import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { SiteFooter, Unavailable } from "@/components/site-shell";
import { BrandLogo } from "@/components/brand-logo";
import { TermDefinition } from "@/components/term-definition";
import styles from "./search-page.module.css";
import {
  parseSearch,
  currency,
  propertyType,
  propertyUrl,
  resultsUrl,
} from "@/lib/property-search";
import { searchProperties } from "@/lib/supabase/properties";

export const maxDuration = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { q, page, error } = parseSearch(
    typeof params.q === "string" ? params.q : "",
    typeof params.page === "string" ? params.page : "0",
  );
  const showAll = params.all === "1";
  const result = q && !error ? await searchProperties(q, page, undefined, undefined, showAll) : null;
  return (
    <div className={styles.page}>
      <header className={styles.headerBand}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmark} aria-label="ParcelSavvy home"><BrandLogo /></Link>
          <nav aria-label="Main navigation">
            <Link href="/" aria-current="page" className={styles.activeLink}>Search</Link>
          </nav>
          <span className={styles.county}>TRAVIS COUNTY, TEXAS</span>
        </div>
      </header>
      <main id="main-content" className="main-shell">
        <section className="search-hero">
          <div className={styles.heroGrid}>
            <div>
              <h1>Know your property.<br />Understand your assessment.</h1>
              <p className="hero-description">Search Travis County property records and understand the values behind your assessment.</p>
            </div>

          </div>
          <SearchForm query={q} showAll={showAll} />
        </section>
        {!q && (
          <section
            className="intro-grid"
            aria-label="How property search works"
          >
            <div>
              <span className="step-number">01</span>
              <h2>Start with what you know</h2>
              <p>A street name or partial address is enough to begin.</p>
            </div>
            <div>
              <span className="step-number">02</span>
              <h2>Find the right property</h2>
              <p>
                Compare matching addresses, then choose a property from the
                list.
              </p>
            </div>
            <div>
              <span className="step-number">03</span>
              <h2>See the source values</h2>
              <p>
                Review the assessment and land details with their source year.
              </p>
            </div>
          </section>
        )}
        {q && error && (
          <div className="notice" role="alert">
            <h2>Let’s narrow that down</h2>
            <p>{error}</p>
          </div>
        )}
        {result && result.status !== "ok" && <Unavailable />}
        {result?.status === "ok" && (
          <section
            className="results-section"
            aria-labelledby="results-heading"
          >
            <div className="section-heading">
              <div>
                <h2 id="results-heading">Matching properties</h2>
                <p>
                  Matches for “{q}” · {" "}
                  {result.data.items.length
                    ? `Showing ${page * 20 + 1}–${page * 20 + result.data.items.length}${result.data.has_more ? "; more results available" : ""}`
                    : "No matches on this page"}
                </p>
              </div>
              <span className="release-badge">
                Source: TCAD · {result.data.tax_year} {result.data.roll_stage}
              </span>
            </div>
            <p className={styles.sourceNote}>{result.data.export_time_raw ? `TCAD export: ${result.data.export_time_raw}` : "Export date not reported in this release."}</p>
            {!result.data.items.length ? (
              <div className="empty-state">
                <h3>
                  {page
                    ? "You’ve reached the end of these results"
                    : "No matching addresses found"}
                </h3>
                <p>
                  {page
                    ? "Return to the first page or try another address."
                    : "Try just the street name, remove a unit number, or check the spelling. You can also select “Show all parcels” to include identified parkland. Some properties do not have a searchable address."}
                </p>
                {page > 0 && (
                  <Link className="text-link" href={resultsUrl(q, 0, showAll)}>
                    Return to first page →
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className={styles.resultColumns}>
                  <span>Property</span><TermDefinition term="TCAD market value">TCAD’s estimate of what the property would sell for as of January 1 of the source year. It is not your tax bill.</TermDefinition><span aria-hidden="true" />
                </div>
                <ul className="result-list">
                  {result.data.items.map((p) => (
                    <li key={p.property_id}>
                      <Link
                        className="result-card"
                        href={propertyUrl(p.property_id, q, page, showAll)}
                        prefetch={false}
                      >
                        <div className="result-address">
                          <h3>{p.address}</h3>
                          <p className="result-meta">
                            {[p.city, p.postal_code].filter(Boolean).join(", ") ||
                              "Travis County, TX"}
                            <span aria-hidden="true"> · </span>
                            ID {p.property_id}{" "}
                            <span aria-hidden="true">·</span>{" "}
                            {propertyType(p.property_type)}
                            {p.is_parkland && <span className={styles.parklandBadge}>Parkland</span>}
                          </p>
                        </div>
                        <div className="result-value">
                          <span className={styles.valueLabel}>TCAD market value</span>
                          <strong>
                            {p.market_value === null && p.values_under_review
                              ? "Under review"
                              : currency(p.market_value)}
                          </strong>
                        </div>
                        <span className="result-arrow" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {(page > 0 || result.data.has_more) && (
              <nav className="pagination" aria-label="Search result pages">
                <div>
                  {page > 0 && (
                    <Link href={resultsUrl(q, page - 1, showAll)} prefetch={false}>
                      ← Previous
                    </Link>
                  )}
                </div>
                <span>Page {page + 1}</span>
                <div>
                  {result.data.has_more && (
                    <Link href={resultsUrl(q, page + 1, showAll)} prefetch={false}>
                      Next →
                    </Link>
                  )}
                </div>
              </nav>
            )}
            {result.data.limit_reached && (
              <p className="notice">
                There are more matches. Add a house number or more of the street
                name to narrow your search.
              </p>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
