import Link from "next/link";
import { SuggestionForm } from "@/components/suggestion-form";
import { SearchForm } from "@/components/search-form";
import { SearchEntryLink } from "@/components/search-entry-link";
import { Unavailable } from "@/components/site-shell";
import { BrandLogo } from "@/components/brand-logo";
import { TermDefinition } from "@/components/term-definition";
import styles from "./search-page.module.css";
import { appraisalDistrict } from "@/lib/appraisal-district";
import {
  parseSearch,
  currency,
  propertyType,
  propertyUrl,
  resultsUrl,
  noResultsGuidance,
} from "@/lib/property-search";
import { searchProperties } from "@/lib/supabase/properties";

export const maxDuration = 30;

const homeownerQuestions = [
  "Did my home’s value change after the first appraisal notice?",
  "Was a protest filed for my home, and was its value lowered?",
  "How does my home’s value compare with similar homes?",
  "What happened to home values in my local neighborhood?",
  "Are my home’s details and property tax exemptions correct?",
];

function HomeFooter() {
  return (
    <footer className={styles.homeFooter}>
      <div className={styles.footerGrid}>
        <div className={styles.footerIdentity}>
          <p className={styles.footerBrand}>ParcelSavvy.org</p>
          <p>
            Independent property-assessment context for Travis County
            homeowners. Values reflect selected public Appraisal District releases and are
            not a tax bill.
          </p>
        </div>
        <div>
          <h2>Explore</h2>
          <nav aria-label="Explore ParcelSavvy">
            <SearchEntryLink>Property search</SearchEntryLink>
            <Link href="/methodology">Data &amp; methodology</Link>
            <Link href="/protest-guide">Protest Guide</Link>
            <Link href="/#questions">Homeowner questions</Link>
          </nav>
        </div>
        <div>
          <h2>ParcelSavvy</h2>
          <nav aria-label="About ParcelSavvy">
            <Link href="/#about">About ParcelSavvy</Link>
            <Link href="/contact">Contact</Link>
            <SuggestionForm />
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
              href={appraisalDistrict.propertySearchUrl}
              target="_blank"
              rel="noreferrer"
            >
              Official Appraisal District <span className={styles.externalTail}>search ↗</span>
            </a>
          </nav>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <span>© 2026 Systems &amp; Sense LLC. All rights reserved.</span>
        <span>
          Official property records are available on{" "}
          <a href={appraisalDistrict.propertySearchUrl} target="_blank" rel="noreferrer">TCAD’s <span className={styles.externalTail}>website ↗</span></a>.
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
            <SearchEntryLink>Search</SearchEntryLink>
            <Link href="/#about">About</Link>
            <Link className={styles.supportNavLink} href="/#support">
              Support us
            </Link>
          </nav>
          <div className={styles.county}>
            <span>{appraisalDistrict.countyLabel}</span>
            <span className={styles.districtName}>
              County Appraisal District: {appraisalDistrict.name} ({appraisalDistrict.abbreviation})
            </span>
          </div>
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
                Property assessments, explained
              </p>
            )}
            <h1 id="home-heading">
              {q
                ? "Search Travis County property records"
                : "What happened to your property appraisal?"}
            </h1>
            {!q && (
              <p className={styles.heroDescription}>
                See how the Appraisal District valued your home, what changed,
                and how your property compares.
              </p>
            )}
            <div id="property-search" className={styles.searchArea}>
              <SearchForm key={q} query={q} />
            </div>
          </div>

          {!q && (
            <aside
              className={styles.preview}
              aria-labelledby="example-heading"
              aria-describedby="example-disclaimer"
            >
              <div className={styles.previewHeader}>
                <p className={styles.exampleLabel}>Example only</p>
                <p id="example-disclaimer" className={styles.exampleDescription}>
                  Fictional values to show what you can explore.
                </p>
                <h2 id="example-heading">An example appraisal story</h2>
              </div>
              <div className={styles.previewValue}>
                <span>2026 certified market value</span>
                <strong>$612,000</strong>
                <p>↓ $38,000 below preliminary</p>
              </div>
              <dl className={styles.previewGrid}>
                <div>
                  <dt>Protest record</dt>
                  <dd>Found</dd>
                </div>
                <div>
                  <dt>Compared with prior year</dt>
                  <dd>$21,000 lower</dd>
                </div>
              </dl>
              <p className={styles.exampleNextStep}>
                Search to see your own property.
              </p>
            </aside>
          )}
        </section>

        {typeof params.q === "string" && error && (
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
                Source: Appraisal District · {result.data.tax_year} {result.data.roll_stage}
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
                ? `Appraisal District export: ${result.data.export_time_raw}`
                : "Export date not reported in this release."}
            </p>
            {!result.data.items.length ? (
              <div className="empty-state">
                <h3>
                  {page
                    ? "You’ve reached the end of these results"
                    : "No matching properties found."}
                </h3>
                <p>
                  {page
                    ? "Return to the first page or try another address."
                    : noResultsGuidance(q)}
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
                  <TermDefinition term="Market value">
                    The Appraisal District’s estimate of what the property would sell for as of
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
                            Market value
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
                  protest records, and understand what happened across your
                  local neighborhood.
                </p>
              </div>
              <span>Certified value export: Jul 18, 2026</span>
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
                <h2 id="trust-heading">
                  Independent by design. Built for homeowners.
                </h2>
                <p>
                  ParcelSavvy brings public appraisal records together so you
                  can understand your assessment and decide what to explore next.
                </p>
              </div>
              <ul className={styles.trustList}>
                <li>
                  <h3>Independent perspective</h3>
                  <p>
                    We are not affiliated with the Appraisal District. We help
                    explain its public records.
                  </p>
                </li>
                <li>
                  <h3>Answers in plain language</h3>
                  <p>
                    See what changed, how nearby homes compare, and where the
                    records leave questions.
                  </p>
                </li>
                <li>
                  <h3>You decide what comes next</h3>
                  <p>
                    Explore the information at your own pace. No pressure to
                    protest and no promises of savings.
                  </p>
                </li>
              </ul>
            </section>

            <section className={styles.finalCallout}>
              <div>
                <h2>Know your property. Understand your assessment.</h2>
                <p>Start with an address or property ID.</p>
              </div>
              <SearchEntryLink
                className={`${styles.primaryLink} action-button`}
              >
                Search my property ↑
              </SearchEntryLink>
            </section>
          </>
        )}
      </main>
      <HomeFooter />
    </div>
  );
}
