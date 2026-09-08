"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resultsUrl } from "@/lib/property-search";

export function SearchForm({ query = "", showAll = false }: { query?: string; showAll?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="search-form"
      action="/"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const q = String(
          new FormData(event.currentTarget).get("q") ?? "",
        ).trim();
        const includeAll = new FormData(event.currentTarget).get("all") === "1";
        startTransition(() => router.push(resultsUrl(q, 0, includeAll)));
      }}
      aria-busy={pending}
    >
      <label htmlFor="address-search">Property address or property ID</label>
      <div className="search-controls">
        <input
          id="address-search"
          name="q"
          type="search"
          key={query}
          defaultValue={query}
          required
          maxLength={120}
          placeholder="Try a street name or a partial address"
          autoComplete="street-address"
          aria-describedby="search-help"
        />
        <button type="submit" disabled={pending}>
          {pending ? "Searching…" : "Find my property"}
          <span aria-hidden="true"> ↗</span>
        </button>
      </div>
      <p id="search-help">
        A full address isn’t required. Start with a street name, or add a house
        number to narrow your results.
      </p>
      <label className="parcel-filter">
        <input
          type="checkbox" name="all" value="1"
          key={`${query}:${showAll}`} defaultChecked={showAll}
          disabled={pending} aria-describedby="parcel-filter-help"
          onChange={(event) => { if (query) event.currentTarget.form?.requestSubmit(); }}
        />
        Show all parcels
      </label>
      <p id="parcel-filter-help">Includes identified parkland. Property ID searches always include it.</p>
    </form>
  );
}
