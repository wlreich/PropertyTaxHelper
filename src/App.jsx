import { useRef, useState } from "react";
import { searchProperties } from "./data/properties";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.75" />
      <path d="m16 16 4.25 4.25" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m3.5 10.5 8.5-7 8.5 7" />
      <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function PropertyCard({ property }) {
  const isIncrease = property.valueChange > 0;

  return (
    <article className="property-card">
      <div className="property-card__top">
        <div className="property-icon">
          <HomeIcon />
        </div>
        <div>
          <p className="eyebrow">
            {property.type} · {property.county}
          </p>
          <h3>{property.address}</h3>
          <p className="property-location">
            {property.city}, {property.state} {property.zip}
          </p>
        </div>
      </div>

      <dl className="property-stats">
        <div>
          <dt>{property.year} market value</dt>
          <dd>{currency.format(property.marketValue)}</dd>
          <span className={isIncrease ? "change change--up" : "change change--down"}>
            {isIncrease ? "↑" : "↓"} {Math.abs(property.valueChange)}% from last year
          </span>
        </div>
        <div>
          <dt>Assessed value</dt>
          <dd>{currency.format(property.assessedValue)}</dd>
          <span>After exemptions and caps</span>
        </div>
        <div>
          <dt>Estimated annual tax</dt>
          <dd>{currency.format(property.annualTax)}</dd>
          <span>{property.taxRate}% combined rate</span>
        </div>
      </dl>

      <div className="property-card__footer">
        <div>
          <span>Owner on record</span>
          <strong>{property.owner}</strong>
        </div>
        <div>
          <span>Property ID</span>
          <strong>{property.id}</strong>
        </div>
        <button className="text-button" type="button">
          View valuation details <ArrowIcon />
        </button>
      </div>
    </article>
  );
}

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const resultsRef = useRef(null);

  const runSearch = (searchQuery) => {
    const normalizedQuery = searchQuery.trim();

    if (!normalizedQuery) {
      setError("Enter an address, owner name, or property ID to search.");
      setResults(null);
      return;
    }

    setError("");
    setResults(searchProperties(normalizedQuery));
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  const useExample = (example) => {
    setQuery(example);
    runSearch(example);
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#" aria-label="ClearValue home">
          <span className="brand__mark">
            <HomeIcon />
          </span>
          <span>Clear<span>Value</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#why-clearvalue">Why ClearValue</a>
          <a className="nav-cta" href="#search">
            Search a property
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero__glow hero__glow--one" />
          <div className="hero__glow hero__glow--two" />
          <div className="hero__content">
            <div className="status-pill">
              <span /> Public records, made understandable
            </div>
            <h1>
              Know what your home is <em>really</em> worth.
            </h1>
            <p className="hero__lede">
              Search local property records, understand your valuation, and spot
              changes that could affect your tax bill.
            </p>

            <div className="search-panel" id="search">
              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="property-search">Find your property</label>
                <div className={error ? "search-box search-box--error" : "search-box"}>
                  <span className="search-box__icon">
                    <SearchIcon />
                  </span>
                  <input
                    id="property-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Enter an address, owner, or property ID"
                    aria-describedby={error ? "search-error" : "search-help"}
                  />
                  <button type="submit">
                    Search <ArrowIcon />
                  </button>
                </div>
                {error ? (
                  <p className="search-error" id="search-error" role="alert">
                    {error}
                  </p>
                ) : (
                  <p className="search-help" id="search-help">
                    Try an example:{" "}
                    <button type="button" onClick={() => useExample("1601 Elm Street")}>
                      1601 Elm Street
                    </button>
                    <span aria-hidden="true"> · </span>
                    <button type="button" onClick={() => useExample("Morgan Lee")}>
                      Morgan Lee
                    </button>
                  </p>
                )}
              </form>
              <div className="data-note">
                <span>DEMO</span>
                This experience uses sample property records.
              </div>
            </div>

            <div className="trust-row" aria-label="Product benefits">
              <span>✓ No sign-up required</span>
              <span>✓ Free property search</span>
              <span>✓ Plain-language insights</span>
            </div>
          </div>
        </section>

        {results !== null && (
          <section className="results-section" ref={resultsRef} aria-live="polite">
            <div className="section-heading">
              <p className="eyebrow">Search results</p>
              <h2>
                {results.length
                  ? `${results.length} ${results.length === 1 ? "property" : "properties"} found`
                  : "No matching properties"}
              </h2>
              <p>
                {results.length
                  ? "Review the latest sample appraisal data below."
                  : `We couldn't find a sample record matching “${query.trim()}”. Try “Austin” or one of the examples above.`}
              </p>
            </div>
            <div className="results-list">
              {results.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </section>
        )}

        <section className="how-it-works" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">A clearer starting point</p>
            <h2>From public record to useful insight</h2>
            <p>We organize the details that matter, without the appraisal-district jargon.</p>
          </div>
          <div className="steps">
            <article>
              <span>01</span>
              <div className="step-icon"><SearchIcon /></div>
              <h3>Find your record</h3>
              <p>Search by address, owner name, or the property ID from your appraisal notice.</p>
            </article>
            <article>
              <span>02</span>
              <div className="step-icon chart-icon" aria-hidden="true">
                <i /><i /><i />
              </div>
              <h3>Understand the numbers</h3>
              <p>See market value, assessed value, and estimated tax in one straightforward view.</p>
            </article>
            <article>
              <span>03</span>
              <div className="step-icon check-icon" aria-hidden="true">✓</div>
              <h3>Decide what comes next</h3>
              <p>Spot valuation changes and gather the context you need to make an informed decision.</p>
            </article>
          </div>
        </section>

        <section className="explanation" id="why-clearvalue">
          <div>
            <p className="eyebrow">Why ClearValue</p>
            <h2>Your property record shouldn’t require a translator.</h2>
          </div>
          <p>
            Appraisal notices can be dense and confusing. ClearValue turns public data
            into a focused summary, so homeowners can understand the numbers before
            deciding whether to take action.
          </p>
        </section>
      </main>

      <footer>
        <a className="brand brand--footer" href="#" aria-label="ClearValue home">
          <span className="brand__mark"><HomeIcon /></span>
          <span>Clear<span>Value</span></span>
        </a>
        <p>Sample data only. Not tax or legal advice.</p>
        <p>© 2026 ClearValue</p>
      </footer>
    </>
  );
}

export default App;
