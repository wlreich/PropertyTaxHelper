import "server-only";
import { parseHistory, parseProtestObservations, type Snapshot, type ProtestObservation } from "../property-history.ts";
import { DATABASE_REQUEST_TIMEOUT_MS } from "./request-policy.ts";
import { createClient } from "@supabase/supabase-js";
import { parseSearch } from "../property-search.ts";

type Config = { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };
export type SearchItem = {
  property_id: string;
  address: string;
  city: string;
  postal_code: string;
  property_type: string;
  market_value: number | null;
  values_under_review: boolean;
};
export type Release = {
  tax_year: number;
  roll_stage: string;
  export_time_raw: string | null;
};
export type SearchResults = Release & {
  items: (SearchItem & { is_parkland: boolean })[];
  has_more: boolean;
  limit_reached: boolean;
};
export type Property = SearchItem &
  Release & {
    appraised_value: number | null;
    assessed_value: number | null;
    land_value: number | null;
    improvement_value: number | null;
    land_acres: number | null;
    source_record_count: number;
    shared_ownership: boolean;
    improvement_records: number;
    land_segments: number;
    source_url: string;
  };
type Result<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" | "invalid" | "not_found" };
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const amount = (v: unknown): v is number | null =>
  v === null || (typeof v === "number" && Number.isFinite(v));
const integer = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function item(v: unknown): v is SearchItem & Record<string, unknown> {
  return (
    object(v) &&
    typeof v.property_id === "string" &&
    /^\d{1,12}$/.test(v.property_id) &&
    [v.address, v.city, v.postal_code, v.property_type].every(
      (x) => typeof x === "string",
    ) &&
    amount(v.market_value) &&
    typeof v.values_under_review === "boolean"
  );
}
function release(v: unknown): v is Release & Record<string, unknown> {
  return (
    object(v) &&
    integer(v.tax_year) &&
    v.tax_year >= 1900 &&
    v.tax_year <= 2200 &&
    typeof v.roll_stage === "string" &&
    (v.export_time_raw === null || typeof v.export_time_raw === "string")
  );
}
function sourceUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      ["traviscad.org", "www.traviscad.org"].includes(u.hostname) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
async function rpc(
  name: string,
  args: Record<string, string | number | boolean>,
  config: Config,
  fetchRequest: typeof fetch,
): Promise<unknown> {
  const url = config.SUPABASE_URL?.trim(),
    key = config.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key?.startsWith("sb_publishable_")) return null;
  try {
    const client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetchRequest(input, { ...init, cache: "no-store" }),
      },
    });
    const { data, error } = await client
      .rpc(name, args, { get: true })
      .abortSignal(AbortSignal.timeout(DATABASE_REQUEST_TIMEOUT_MS));
    return error ? null : data;
  } catch {
    return null;
  } // Keep upstream errors and configuration out of the response.
}
export async function searchProperties(
  q: string,
  page: number,
  config: Config = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  fetchRequest: typeof fetch = fetch,
  showAll = false,
): Promise<Result<SearchResults>> {
  if (parseSearch(q).error || !Number.isInteger(page) || page < 0 || page > 249)
    return { status: "invalid" };
  const v = await rpc(
    "search_property_parcels",
    { p_query: q, p_page: page, p_show_all: showAll },
    config,
    fetchRequest,
  );
  if (
    !object(v) ||
    v.available !== true ||
    !release(v) ||
    !Array.isArray(v.items) ||
    v.items.length > 20 ||
    !v.items.every(item) ||
    !v.items.every((x) => typeof x.is_parkland === "boolean") ||
    typeof v.has_more !== "boolean" ||
    typeof v.limit_reached !== "boolean"
  )
    return { status: "unavailable" };
  return {
    status: "ok",
    data: {
      tax_year: v.tax_year,
      roll_stage: v.roll_stage,
      export_time_raw: v.export_time_raw,
      items: v.items.map((x) => ({
        property_id: x.property_id,
        address: x.address,
        city: x.city,
        postal_code: x.postal_code,
        property_type: x.property_type,
        market_value: x.market_value,
        values_under_review: x.values_under_review,
        is_parkland: x.is_parkland as boolean,
      })),
      has_more: v.has_more,
      limit_reached: v.limit_reached,
    },
  };
}
export async function getProperty(
  id: string,
  config: Config = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  fetchRequest: typeof fetch = fetch,
): Promise<Result<Property>> {
  if (!/^\d{1,12}$/.test(id)) return { status: "not_found" };
  const v = await rpc("property_profile", { p_id: id }, config, fetchRequest);
  if (!object(v) || v.available !== true) return { status: "unavailable" };
  if (v.property === null) return { status: "not_found" };
  const p = v.property;
  if (
    !item(p) ||
    !release(p) ||
    !object(p) ||
    p.property_id !== id.replace(/^0+/, "") ||
    ![
      p.appraised_value,
      p.assessed_value,
      p.land_value,
      p.improvement_value,
      p.land_acres,
    ].every(amount) ||
    ![p.source_record_count, p.improvement_records, p.land_segments].every(
      integer,
    ) ||
    typeof p.shared_ownership !== "boolean" ||
    !sourceUrl(p.source_url)
  )
    return { status: "unavailable" };
  // Only this explicit list can reach the page, even if an RPC adds other fields later.
  return {
    status: "ok",
    data: {
      property_id: p.property_id,
      address: p.address,
      city: p.city,
      postal_code: p.postal_code,
      property_type: p.property_type,
      market_value: p.market_value,
      values_under_review: p.values_under_review,
      tax_year: p.tax_year,
      roll_stage: p.roll_stage,
      export_time_raw: p.export_time_raw,
      appraised_value: p.appraised_value as number | null,
      assessed_value: p.assessed_value as number | null,
      land_value: p.land_value as number | null,
      improvement_value: p.improvement_value as number | null,
      land_acres: p.land_acres as number | null,
      source_record_count: p.source_record_count as number,
      improvement_records: p.improvement_records as number,
      land_segments: p.land_segments as number,
      shared_ownership: p.shared_ownership,
      source_url: p.source_url,
    },
  };
}

export async function getPropertyHistory(
  id: string,
  config: Config = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  fetchRequest: typeof fetch = fetch,
): Promise<Result<Snapshot[]> & { protests?: ProtestObservation[]; protestsUnavailable?: boolean }> {
  if (!/^\d{1,12}$/.test(id)) return { status: "invalid" };
  const payload = await rpc("property_history", { p_id: id }, config, fetchRequest);
  const snapshots = parseHistory(payload);
  const protests = parseProtestObservations(payload);
  return snapshots === null
    ? { status: "unavailable" }
    : { status: "ok", data: snapshots, protests: protests ?? [], protestsUnavailable: protests === null };
}
