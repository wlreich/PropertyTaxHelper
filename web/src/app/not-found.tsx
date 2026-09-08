import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="main-shell empty-state">
        <p className="eyebrow">PROPERTY NOT FOUND</p>
        <h1>Let’s try another address</h1>
        <p>This property isn’t available in the current searchable release.</p>
        <Link className="text-link" href="/">
          Return to property search →
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
