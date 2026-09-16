import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { Unavailable } from "@/components/site-shell";
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

const homeownerQuestions = [
  "Did my value change after the preliminary appraisal?",
  "Is a protest recorded, and did the value go down?",
  "How does my home compare with similar properties?",
  "What happened to other homes in my TCAD market area?",
  "Are my property facts and exemptions recorded correctly?",
];

function HomeFooter() {
  return (
    <footer className={styles.homeFooter}>
      <div className={styles.footerGrid}>
        <div className={styles.footerIdentity}>
          <p className={styles.footerBrand}>ParcelSavvy.org</p>
          <p>
            Independent property-assessment context for Travis County
            homeowners. Values reflect selected public TCAD releases and are
            not a tax bill.
          </p>
        </div>
        <div>
          <h2>Explore</h2>
          <nav aria-label="Explore ParcelSavvy">
            <Link href="/#property-search">Property search</Link>
            <Link href="/#evidence">Data &amp; methodology</Link>
            <Link href="/#questions">Homeowner questions</Link>
          </nav>
        </div>
        <div>
          <h2>ParcelSavvy</h2>
          <nav aria-label="About ParcelSavvy">
            <Link href="/#about">About ParcelSavvy</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/report-data-issue">Report a data issue</Link>
            <Link href="/support">Support ParcelSavvy</Link>
          </nav>
        </div>
        <div>
          <h2>Legal &amp; access</h2>
          <nav aria-label="Legal and access">
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of use</Link>
            <Link href="/accessibility">Accessibility</Link>
            <a
              href="https://traviscad.org/propertysearch/"
              target="_blank"
              rel="noreferrer"
            >
              Official TCAD search ↗
            </a>
          </nav>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© 2026 Systems &amp; Sense LLC. All rights reserved.</span>
        <span>
          A missing protest entry does not rule out a protest. Official TCAD
          records and notices control.
        </span>
      </div>
    </footer>
  );
}

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
    <div className={styles.page}>
      <header className={styles.headerBand}>
        <div className={styles.headerInner}>
          <Link
            href="/"
            className={styles.wordmark}
            aria-label="ParcelSavvy home"
          >
            <BrandLogo />
          </Link>
          <nav className={styles.mainNav} aria-label="Main navigation">
            <Link href="/#property-search">Search</Link>
            <Link href="/#about">About</Link>
            <Link className={styles.supportNavLink} href="/#support">
              Support us
            </Link>
          </nav>
          <span className={styles.county}>TRAVIS COUNTY, TEXAS</span>
        </div>
      </header>

      <main id="main-content">
        <section
          className={`${styles.hero}${q ? ` ${styles.heroWithResults}` : ""}`}
          aria-labelledby="home-heading"
        >
          <div className={styles.heroCopy}>
            {!q && (
              <p className={styles.eyebrow}>
                Travis County property assessments, explained
              </p>
            )}
            <h1 id="home-heading">
              {q
                ? "Search Travis County property records"
                : "What happened to your property appraisal?"}
            </h1>
            {!q && (
              <p className={styles.heroDescription}>
                See how TCAD valued your home, what changed between preliminary
                and certified values, how your property compares, and what may
                deserve a closer look.
              </p>
            )}
            <div id="property-search" className={styles.searchArea}>
              <SearchForm key={q} query={q} />
            </div>
          </div>

          {!q && (
            <aside
              className={styles.preview}
              aria-label="Illustrative property result"
            >
              <div className={styles.previewHeader}>
                <div>
                  <p className={styles.previewLabel}>Your appraisal story</p>
                  <h2>2026 certified result</h2>
                </div>
                <p className={styles.exampleLabel}>Illustrative example</p>
              </div>
              <div className={styles.previewValue}>
                <span>Certified market value</span>
                <strong>$612,000</strong>
                <p>↓ $38,000 from preliminary</p>
              </div>
              <dl className={styles.previewGrid}>
                <div>
                  <dt>Protest record</dt>
                  <dd>Found</dd>
                </div>
                <div>
                  <dt>Neighborhood position</dt>
                  <dd>Above 62% of homes</dd>
                </div>
                <div>
                  <dt>Compared with 2025</dt>
                  <dd>$21,000 lower</dd>
                </div>
                <div>
                  <dt>Next useful check</dt>
                  <dd>Compare similar homes</dd>
                </div>
              </dl>
            </aside>
          )}
        </section>

        {q && error && (
          <div className={`${styles.resultsShell} notice`} role="alert">
            <h2>Let’s narrow that down</h2>
            <p>{error}</p>
          </div>
        )}
        {result && result.status !== "ok" && (
          <div className={styles.resultsShell}>
            <Unavailable />
          </div>
        )}
        {result?.status === "ok" && (
          <section
            className={`${styles.resultsShell} results-section`}
            aria-labelledby="results-heading"
          >
            <div className="section-heading">
              <div>
                <h2 id="results-heading">
                  {result.data.match_mode === "possible"
                    ? "Possible matches"
                    : "Matching properties"}
                </h2>
                <p>
                  {result.data.match_mode === "possible"
                    ? "Possible matches"
                    : "Matches"}{" "}
                  for “{q}” ·{" "}
                  {result.data.items.length
                    ? `Showing ${page * 20 + 1}–${page * 20 + result.data.items.length}${result.data.has_more ? "; more results available" : ""}`
                    : "No matches on this page"}
                </p>
              </div>
              <span className="release-badge">
                Source: TCAD · {result.data.tax_year} {result.data.roll_stage}
              </span>
            </div>
            {result.data.match_mode === "possible" && (
              <p>
                No exact address matches found. These addresses have a similar
                street spelling. Check the stored address before choosing a
                property.
              </p>
            )}
            <p className={styles.sourceNote}>
              {result.data.export_time_raw
                ? `TCAD export: ${result.data.export_time_raw}`
                : "Export date not reported in this release."}
            </p>
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
              <>
                <div className={styles.resultColumns}>
                  <span>Property</span>
                  <TermDefinition term="TCAD market value">
                    TCAD’s estimate of what the property would sell for as of
                    January 1 of the source year. It is not your tax bill.
                  </TermDefinition>
                  <span aria-hidden="true" />
                </div>
                <ul className="result-list">
                  {result.data.items.map((property) => (
                    <li key={property.property_id}>
                      <Link
                        className="result-card"
                        href={propertyUrl(property.property_id, q, page)}
                        prefetch={false}
                      >
                        <div className="result-address">
                          <h3>{property.address}</h3>
                          <p className="result-meta">
                            {[property.city, property.postal_code]
                              .filter(Boolean)
                              .join(", ") || "Travis County, TX"}
                            <span aria-hidden="true"> · </span>
                            ID {property.property_id}{" "}
                            <span aria-hidden="true">·</span>{" "}
                            {propertyType(property.property_type)}
                            {property.is_parkland && (
                              <span className={styles.parklandBadge}>
                                Parkland
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="result-value">
                          <span className={styles.valueLabel}>
                            TCAD market value
                          </span>
                          <strong>
                            {property.market_value === null &&
                            property.values_under_review
                              ? "Under review"
                              : currency(property.market_value)}
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
                    <Link
                      href={resultsUrl(q, page - 1)}
                      prefetch={false}
                    >
                      ← Previous
                    </Link>
                  )}
                </div>
                <span>Page {page + 1}</span>
                <div>
                  {result.data.has_more && (
                    <Link
                      href={resultsUrl(q, page + 1)}
                      prefetch={false}
                    >
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

        {!q && (
          <>
            <section
              className={styles.seasonCallout}
              aria-label="Current assessment release"
            >
              <div>
                <strong>2026 certified results are available</strong>
                <p>
                  Compare preliminary and certified values, see available
                  protest records, and understand what happened across your TCAD
                  market area.
                </p>
              </div>
              <span>Current through Jul 18, 2026</span>
            </section>

            <section
              id="questions"
              className={styles.questions}
              aria-labelledby="questions-heading"
            >
              <div>
                <p className={styles.eyebrow}>Designed for homeowners</p>
                <h2 id="questions-heading">
                  Start with the questions you actually have.
                </h2>
                <p className={styles.questionsCopy}>
                  Clear answers, visible source dates, and candid limits—without
                  requiring you to become a property-tax expert first.
                </p>
              </div>
              <ul>
                {homeownerQuestions.map((question) => (
                  <li key={question}>
                    <span aria-hidden="true">?</span>
                    {question}
                  </li>
                ))}
              </ul>
            </section>

            <section
              id="support"
              className={styles.support}
              aria-labelledby="support-heading"
            >
              <div>
                <p className={styles.eyebrow}>Homeowner-supported</p>
                <h2 id="support-heading">
                  Useful property information shouldn’t disappear behind a
                  paywall.
                </h2>
                <p className={styles.supportCopy}>
                  ParcelSavvy keeps its core homeowner tools available without
                  requiring a subscription. If the site helped you understand
                  your appraisal, optional support can help cover public-data
                  processing, hosting, and continued development.
                </p>
                <p className={styles.supportPrinciple}>
                  Use everything first. Support it only if you find it valuable.
                </p>
              </div>
              <aside className={styles.supportBox}>
                <h3>Help keep ParcelSavvy open</h3>
                <p>
                  A small contribution can help maintain the data and build the
                  next homeowner tools. Access will not depend on payment.
                </p>
                <Link
                  href="/support"
                  className={styles.supportButton}
                  aria-describedby="support-tax-note"
                >
                  Support ParcelSavvy
                </Link>
                <small id="support-tax-note">
                  Optional contributions are not charitable donations and are
                  not tax-deductible.
                </small>
              </aside>
            </section>

            <section
              id="about"
              className={styles.trust}
              aria-labelledby="trust-heading"
            >
              <div id="evidence">
                <p className={styles.eyebrow}>Independent by design</p>
                <h2 id="trust-heading">
                  Built for homeowners, not property-tax insiders.
                </h2>
                <p>
                  ParcelSavvy connects public TCAD records and explains what
                  they mean—so you can review your appraisal with more
                  confidence.
                </p>
              </div>
              <ul className={styles.trustList}>
                <li>Independent of TCAD</li>
                <li>Plain-language explanations</li>
                <li>No pressure or promises</li>
              </ul>
            </section>

            <section className={styles.finalCallout}>
              <div>
                <h2>Know your property. Understand your assessment.</h2>
                <p>Start with an address or TCAD property ID.</p>
              </div>
              <Link
                className={`${styles.primaryLink} action-button`}
                href="/#property-search"
              >
                Search my property ↑
              </Link>
            </section>
          </>
        )}
      </main>
      <HomeFooter />
    </div>
  );
}
