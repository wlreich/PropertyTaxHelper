import Link from "next/link";
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-icon" aria-hidden="true">
          ⌂
        </span>
        Property Tax Helper
      </Link>
      <span className="county-label">TRAVIS COUNTY, TEXAS</span>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Public records. A clearer starting point.</p>
      <p>
        Independent of Travis Central Appraisal District. Values reflect the
        selected source release and are not a tax bill.
      </p>
      <a
        href="https://traviscad.org/propertysearch/"
        target="_blank"
        rel="noreferrer"
      >
        Visit the official TCAD search ↗
      </a>
    </footer>
  );
}
export function Unavailable() {
  return (
    <div className="notice" role="status">
      <h2>Property search is temporarily unavailable</h2>
      <p>
        Please try again in a few minutes. You can also use{" "}
        <a href="https://traviscad.org/propertysearch/">
          TCAD’s official property search
        </a>
        .
      </p>
    </div>
  );
}
