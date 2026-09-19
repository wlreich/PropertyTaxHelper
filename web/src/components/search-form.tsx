"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { noResultsGuidance, parseSearch, propertyUrl, resultsUrl } from "@/lib/property-search";

type Suggestion = {
  property_id: string;
  address: string;
  city: string;
  postal_code: string;
  is_parkland: boolean;
};

type SuggestionState = {
  status: "idle" | "loading" | "success" | "error";
  items: Suggestion[];
  hasMore: boolean;
};

const idleSuggestions: SuggestionState = {
  status: "idle",
  items: [],
  hasMore: false,
};

function parseSuggestionResponse(
  value: unknown,
): Omit<SuggestionState, "status"> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const response = value as Record<string, unknown>;
  if (
    response.status !== "ok" ||
    !Array.isArray(response.items) ||
    response.items.length > 8 ||
    typeof response.has_more !== "boolean"
  )
    return null;
  const items = response.items.filter((item): item is Suggestion => {
    if (typeof item !== "object" || item === null || Array.isArray(item))
      return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.property_id === "string" &&
      /^\d{1,12}$/.test(candidate.property_id) &&
      typeof candidate.address === "string" &&
      typeof candidate.city === "string" &&
      typeof candidate.postal_code === "string" &&
      typeof candidate.is_parkland === "boolean"
    );
  });
  return items.length === response.items.length
    ? { items, hasMore: response.has_more }
    : null;
}

export function SearchForm({ query = "" }: { query?: string }) {
  const router = useRouter();
  const listboxId = useId();
  const input = useRef<HTMLInputElement>(null);
  const editedBeforeRestore = useRef(false);
  const cache = useRef(new Map<string, Omit<SuggestionState, "status">>());
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(query);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState(idleSuggestions);
  const [validationError, setValidationError] = useState<string | null>(null);
  const validSuggestionQuery = dirty && !parseSearch(value).error;

  useEffect(() => {
    // History belongs to this entry, not to a persistent session-wide search.
    const restore = () => {
      const saved = window.history.state?.parcelSavvySearchQuery;
      if (typeof saved === "string") setValue(saved);
      setOpen(false);
      setDirty(false);
      setActiveIndex(-1);
      setSuggestions(idleSuggestions);
      setValidationError(null);
    };
    // Hydration or the initial pageshow must not erase a query already being typed.
    if (!editedBeforeRestore.current) restore();
    const restoreCachedPage = (event: PageTransitionEvent) => {
      if (event.persisted) restore();
    };
    if (window.location.hash === "#property-search") input.current?.focus({ preventScroll: true });
    window.addEventListener("popstate", restore);
    window.addEventListener("pageshow", restoreCachedPage);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pageshow", restoreCachedPage);
    };
  }, []);

  const rememberQuery = (nextValue: string) => {
    window.history.replaceState(
      { ...window.history.state, parcelSavvySearchQuery: nextValue },
      "",
      window.location.href,
    );
  };

  useEffect(() => {
    if (!validSuggestionQuery) return;
    const q = value.trim().replace(/\s+/g, " ");
    const cacheKey = q.toUpperCase();
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setSuggestions({ status: "success", ...cached });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q });
      try {
        const response = await fetch(`/api/search/suggestions?${params}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const parsed = response.ok
          ? parseSuggestionResponse(await response.json())
          : null;
        if (!parsed) throw new Error("Invalid suggestion response");
        if (controller.signal.aborted) return;
        if (cache.current.size >= 30) {
          const oldest = cache.current.keys().next().value;
          if (oldest) cache.current.delete(oldest);
        }
        cache.current.set(cacheKey, parsed);
        setSuggestions({ status: "success", ...parsed });
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions({ status: "error", items: [], hasMore: false });
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [validSuggestionQuery, value]);

  const chooseSuggestion = (suggestion: Suggestion) => {
    rememberQuery(value);
    setOpen(false);
    setDirty(false);
    setActiveIndex(-1);
    setSuggestions(idleSuggestions);
    startTransition(() =>
      router.push(propertyUrl(suggestion.property_id, value.trim(), 0)),
    );
  };

  const statusMessage =
    suggestions.status === "loading"
      ? "Finding matching addresses…"
      : suggestions.status === "error"
        ? "Suggestions are temporarily unavailable. You can still search."
        : suggestions.status === "success" && suggestions.items.length === 0
          ? `No matching properties found. ${noResultsGuidance(value)}`
          : suggestions.status === "success"
            ? `${suggestions.items.length} address suggestion${suggestions.items.length === 1 ? "" : "s"} available.`
            : "";
  const showSuggestions = open && validSuggestionQuery;

  return (
    <form
      className="search-form"
      action="/"
      method="get"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const { q, error } = parseSearch(String(formData.get("q") ?? ""));
        setOpen(false);
        setDirty(false);
        setActiveIndex(-1);
        setSuggestions(idleSuggestions);
        setValidationError(error);
        if (error) {
          input.current?.focus();
          return;
        }
        startTransition(() => router.push(resultsUrl(q)));
      }}
      aria-busy={pending}
    >
      <label htmlFor="address-search">
        Property address or property ID
      </label>
      <div className="search-controls">
        <div className="search-combobox">
          <input
            id="address-search"
            ref={input}
            name="q"
            type="search"
            value={value}
            required
            maxLength={120}
            placeholder="Enter an address or property ID"
            autoComplete="off"
            aria-describedby={`search-help search-suggestion-status${validationError ? " search-error" : ""}`}
            aria-invalid={!!validationError}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showSuggestions}
            aria-activedescendant={
              showSuggestions && activeIndex >= 0
                ? `${listboxId}-option-${activeIndex}`
                : undefined
            }
            onFocus={() => {
              if (validSuggestionQuery && suggestions.status !== "idle")
                setOpen(true);
            }}
            onBlur={() => {
              // Keep the mobile submit target stable until its click completes,
              // but never let an old blur close a newly focused search.
              window.setTimeout(() => {
                if (document.activeElement !== input.current) setOpen(false);
              }, 100);
            }}
            onChange={(event) => {
              editedBeforeRestore.current = true;
              const nextValue = event.currentTarget.value;
              const valid = !parseSearch(nextValue).error;
              setValue(nextValue);
              rememberQuery(nextValue);
              setValidationError(null);
              setDirty(true);
              setOpen(valid);
              setActiveIndex(-1);
              setSuggestions(
                valid
                  ? { status: "loading", items: [], hasMore: false }
                  : idleSuggestions,
              );
            }}
            onKeyDown={(event) => {
              if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                suggestions.items.length > 0
              ) {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) => {
                  if (event.key === "ArrowDown")
                    return current < suggestions.items.length - 1
                      ? current + 1
                      : 0;
                  return current > 0
                    ? current - 1
                    : suggestions.items.length - 1;
                });
              } else if (
                event.key === "Enter" &&
                showSuggestions &&
                activeIndex >= 0
              ) {
                event.preventDefault();
                chooseSuggestion(suggestions.items[activeIndex]);
              } else if (event.key === "Escape" && showSuggestions) {
                event.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
              }
            }}
          />
          {showSuggestions && (
            <div
              id={listboxId}
              className="search-suggestions"
              role={suggestions.items.length > 0 ? "listbox" : undefined}
              aria-label={
                suggestions.items.length > 0
                  ? "Matching property addresses"
                  : undefined
              }
            >
              {suggestions.status === "success" &&
                suggestions.items.map((suggestion, index) => (
                  <button
                    id={`${listboxId}-option-${index}`}
                    className="search-suggestion"
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                    key={suggestion.property_id}
                    onPointerDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => chooseSuggestion(suggestion)}
                  >
                    <span className="suggestion-address">
                      {suggestion.address}
                    </span>
                    <span className="suggestion-meta">
                      {[suggestion.city, suggestion.postal_code]
                        .filter(Boolean)
                        .join(" ")}
                      {` · Property ID ${suggestion.property_id}`}
                      {suggestion.is_parkland ? " · Parkland" : ""}
                    </span>
                  </button>
                ))}
              {suggestions.status !== "success" ||
              suggestions.items.length === 0 ? (
                <p className="suggestion-message">{statusMessage}</p>
              ) : null}
              {suggestions.status === "success" && suggestions.hasMore ? (
                <p className="suggestion-more">
                  Keep typing to narrow the list, or search to see all matches.
                </p>
              ) : null}
            </div>
          )}
        </div>
        <button type="submit" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </button>
      </div>
      {validationError && <p id="search-error" role="alert">{validationError}</p>}
      <p
        id="search-suggestion-status"
        className="visually-hidden"
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>
      <p id="search-help">
        A partial address works, too.
      </p>
    </form>
  );
}
