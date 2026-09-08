import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { SiteHeader, SiteFooter, Unavailable } from "@/components/site-shell";
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
  const result = q && !error ? await searchProperties(q, page) : null;
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="main-shell">
        <section className={`search-hero ${q ? "compact" : ""}`}>
          <p className="eyebrow">
            <span className="status-dot" /> YOUR PROPERTY, IN CONTEXT
          </p>
          <h1>
            Start with an address.
            <br />
            <span>Understand your property.</span>
          </h1>
          <p className="hero-description">
            Find Travis County property records and explore the values behind
            your assessment.
          </p>
          <SearchForm query={q} />
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
                <p className="eyebrow">PROPERTY RESULTS</p>
                <h2 id="results-heading">Matches for “{q}”</h2>
                <p>
                  {result.data.items.length
                    ? `Showing ${page * 20 + 1}–${page * 20 + result.data.items.length}${result.data.has_more ? "; more results available" : ""}`
                    : "No matches on this page"}
                </p>
              </div>
              <span className="release-badge">
                {result.data.tax_year} · {result.data.roll_stage}
              </span>
            </div>
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
                    : "Try just the street name, remove a unit number, or check the spelling. Some properties do not have a searchable address."}
                </p>
                {page > 0 && (
                  <Link className="text-link" href={resultsUrl(q)}>
                    Return to first page →
                  </Link>
                )}
              </div>
            ) : (
              <ul className="result-list">
                {result.data.items.map((p) => (
                  <li key={p.property_id}>
                    <Link
                      className="result-card"
                      href={propertyUrl(p.property_id, q, page)}
                      prefetch={false}
                    >
                      <span className="property-mark" aria-hidden="true">
                        ⌂
                      </span>
                      <div className="result-address">
                        <h3>{p.address}</h3>
                        <p>
                          {[p.city, p.postal_code].filter(Boolean).join(", ") ||
                            "Travis County, TX"}
                        </p>
                        <span className="result-meta">
                          Property ID {p.property_id}{" "}
                          <span aria-hidden="true">·</span>{" "}
                          {propertyType(p.property_type)}
                        </span>
                      </div>
                      <div className="result-value">
                        <span>TCAD market value</span>
                        <strong>
                          {p.market_value === null && p.values_under_review
                            ? "Under review"
                            : currency(p.market_value)}
                        </strong>
                      </div>
                      <span className="result-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {(page > 0 || result.data.has_more) && (
              <nav className="pagination" aria-label="Search result pages">
                <div>
                  {page > 0 && (
                    <Link href={resultsUrl(q, page - 1)} prefetch={false}>
                      ← Previous
                    </Link>
                  )}
                </div>
                <span>Page {page + 1}</span>
                <div>
                  {result.data.has_more && (
                    <Link href={resultsUrl(q, page + 1)} prefetch={false}>
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
    </>
  );
}
