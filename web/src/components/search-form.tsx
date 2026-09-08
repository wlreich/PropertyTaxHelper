"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resultsUrl } from "@/lib/property-search";

export function SearchForm({ query = "" }: { query?: string }) {
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
        startTransition(() => router.push(resultsUrl(q)));
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
    </form>
  );
}
