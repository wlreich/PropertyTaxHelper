import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { appraisalDistrict } from "@/lib/appraisal-district";
export function SiteHeader({ propertyOverview = false }: { propertyOverview?: boolean }) {
  return (
    <header className={`site-header${propertyOverview ? " overview-site-header" : ""}`}>
      <Link href="/" className="brand" aria-label="ParcelSavvy home"><BrandLogo /></Link>
      <span className="county-label">TRAVIS COUNTY, TEXAS</span>
      {propertyOverview && <nav aria-label="Site navigation"><Link href="/">Search properties</Link><Link href="/support">Support ParcelSavvy</Link></nav>}
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Know your property. Understand your assessment.</p>
      <p>
        Independent of Travis Central Appraisal District. Values reflect the
        selected source release and are not a tax bill.
      </p>
      <nav aria-label="ParcelSavvy information">
        <Link href="/protest-guide">Protest Guide</Link>
        <Link href="/methodology">Data &amp; methodology</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/report-data-issue">Report a data issue</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/accessibility">Accessibility</Link>
      </nav>
      <p>ParcelSavvy is operated by Systems &amp; Sense LLC.</p>
    </footer>
  );
}
export function Unavailable() {
  return (
    <div className="notice" role="status">
      <h2>Property search is temporarily unavailable</h2>
      <p>
        Please try again in a few minutes. You can also use{" "}
        <a href={appraisalDistrict.propertySearchUrl}>
          the Appraisal District’s official property search
        </a>
        .
      </p>
    </div>
  );
}
