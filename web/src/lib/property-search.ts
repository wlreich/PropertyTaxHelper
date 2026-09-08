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
    .toUpperCase()
    .replace(/['.]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/ +/)
    .map((p) => abbreviations[p] ?? p)
    .join(" ");
}
export function parseSearch(query: string, page = "0") {
  const q = query.trim().replace(/\s+/g, " ");
  const parts = normalizeAddress(q).split(" ");
  const error =
    q.length > 120 || parts.length > 8
      ? "Use a shorter address: up to 120 characters and eight address parts."
      : !parts.some((part) => part.length >= 3)
        ? "Enter at least three letters or digits together, such as part of a street name."
        : null;
  const parsedPage = /^\d{1,3}$/.test(page) ? Number(page) : 0;
  return { q, page: Math.min(parsedPage, 249), error };
}

export function resultsUrl(q: string, page = 0) {
  const params = new URLSearchParams({ q });
  if (page) params.set("page", String(page));
  return `/?${params}`;
}
export function propertyUrl(id: string, q: string, page: number) {
  const params = new URLSearchParams({ q, page: String(page) });
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
