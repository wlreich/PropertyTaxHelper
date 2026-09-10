import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader, SiteFooter, Unavailable } from "@/components/site-shell";
import { PropertyOverview } from "@/components/property-overview";
import { parseSearch, resultsUrl } from "@/lib/property-search";
import { getProperty, getPropertyHistory } from "@/lib/supabase/properties";
import "./property-overview.css";
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
  const [result, history] = await Promise.all([
    getProperty(id),
    getPropertyHistory(id),
  ]);
  if (result.status === "not_found" || result.status === "invalid") notFound();
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        className="main-shell profile-shell combined-profile"
      >
        <Link
          className="back-link"
          href={q ? resultsUrl(q, page, search.all === "1") : "/"}
        >
          ← {q ? "Back to search results" : "Search properties"}
        </Link>
        {result.status === "ok" ? (
          <PropertyOverview
            property={result.data}
            snapshots={history.status === "ok" ? history.data : []}
            historyUnavailable={history.status !== "ok"}
          />
        ) : (
          <Unavailable />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
