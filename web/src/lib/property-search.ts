// Shared input rules and presentation helpers. No database configuration here.
const abbreviations: Record<string, string> = {
  STREET: "ST",
  ROAD: "RD",
  AVENUE: "AVE",
  BOULEVARD: "BLVD",
  DRIVE: "DR",
  LANE: "LN",
  COURT: "CT",
  CIRCLE: "CIR",
  TRAIL: "TRL",
  PARKWAY: "PKWY",
  HIGHWAY: "HWY",
  PLACE: "PL",
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  APARTMENT: "UNIT",
  APT: "UNIT",
  SUITE: "UNIT",
  STE: "UNIT",
};
export function normalizeAddress(query: string) {
  return query
    .replace(/#/g, " UNIT ")
    .toUpperCase()
    .replace(/['.]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/ +/)
    .map((p) => abbreviations[p] ?? p)
    .join(" ");
}
// Only recognize a state after a distinct street + known local city, or in
// explicitly comma-separated street, city, state input. Keep city and ZIP in
// the query so an out-of-area address cannot become an unrelated local match.
export function searchAddressQuery(query: string) {
  const q = query.trim().replace(/\s+/g, " ");
  const separated = q.match(/^(.+),\s*([A-Za-z][A-Za-z .'-]+),\s*(TX|Texas)(\s+\d{5}(?:-\d{4})?)?\s*$/i);
  if (separated && /\d/.test(separated[1])) {
    return `${separated[1]} ${separated[2]}${separated[4] ?? ""}`;
  }
  return q.replace(
    /^(\d+\s+.+?)[, ]+((?:Austin|Leander|Cedar Park|Round Rock|Pflugerville|Lago Vista|Lakeway|Bee Cave|Manor|Del Valle|Spicewood|Jonestown|Volente|West Lake Hills|Rollingwood|Sunset Valley|Briarcliff|Point Venture|Webberville))[, ]+(?:TX|Texas)(\s+\d{5}(?:-\d{4})?)?\s*$/i,
    "$1 $2$3",
  );
}

export function noResultsGuidance(query: string) {
  return /^\d+$/.test(query.trim())
    ? "Check the property ID or try a street address."
    : "Try just the street name, remove a unit number, or check the spelling. Some properties do not have a searchable address.";
}

export function parseSearch(query: string, page = "0") {
  const q = query.trim().replace(/\s+/g, " ");
  const parts = normalizeAddress(searchAddressQuery(q)).split(" ");
  const numberedStreet = parts.length > 1 && /^(?:(?:N|S|E|W|NE|NW|SE|SW) )?\d{2,}(?: (?:ST|RD|AVE|BLVD|DR|LN|CT|CIR|TRL|PKWY|HWY|PL|TER|WAY|LOOP|CV))?$/.test(parts.join(" "));
  const error =
    !q
      ? "Enter an address or property ID."
      : q.length > 120 || parts.length > 8
      ? "Use a shorter address: up to 120 characters and eight address parts."
      : !parts.some((part) => part.length >= 3) && !numberedStreet
        ? "Enter at least three letters or digits together, such as part of a street name."
        : null;
  const parsedPage = /^\d{1,3}$/.test(page) ? Number(page) : 0;
  return { q, page: Math.min(parsedPage, 249), error };
}

export function resultsUrl(q: string, page = 0, showAll = false) {
  const params = new URLSearchParams({ q });
  if (page) params.set("page", String(page));
  if (showAll) params.set("all", "1");
  return `/?${params}`;
}
export function propertyUrl(id: string, q: string, page: number, showAll = false) {
  const params = new URLSearchParams({ q, page: String(page) });
  if (showAll) params.set("all", "1");
  return `/property/${encodeURIComponent(id)}?${params}`;
}
export function currency(value: number | null) {
  return value === null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}
export function propertyType(code: string) {
  return (
    (
      {
        R: "Real property",
        P: "Personal property",
        MH: "Manufactured home",
        M: "Manufactured home",
        MN: "Mineral property",
      } as Record<string, string>
    )[code] ?? "Property"
  );
}
