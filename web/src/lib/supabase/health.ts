import "server-only";
import { DATABASE_REQUEST_TIMEOUT_MS } from "./request-policy.ts";
import { createClient } from "@supabase/supabase-js";

type Configuration = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export type DatabaseHealth = "ok" | "not_configured" | "unavailable";
export type DatabaseHealthReason =
  | "missing_configuration"
  | "unsupported_key_type"
  | "invalid_project_url"
  | "key_rejected"
  | "access_denied"
  | "health_function_missing"
  | "endpoint_not_found"
  | "request_timed_out"
  | "database_timed_out"
  | "network_error"
  | "rate_limited"
  | "service_unavailable"
  | "unexpected_response"
  | "upstream_failure";
export type DatabaseHealthResult = {
  database: DatabaseHealth;
  reason?: DatabaseHealthReason;
};

export async function diagnoseDatabaseHealth(
  config: Configuration,
  fetchRequest: typeof fetch = fetch,
): Promise<DatabaseHealthResult> {
  const url = config.SUPABASE_URL?.trim();
  const key = config.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key)
    return { database: "not_configured", reason: "missing_configuration" };
  if (!key.startsWith("sb_publishable_"))
    return { database: "not_configured", reason: "unsupported_key_type" };
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      return { database: "unavailable", reason: "invalid_project_url" };
  } catch {
    return { database: "unavailable", reason: "invalid_project_url" };
  }

  const signal = AbortSignal.timeout(DATABASE_REQUEST_TIMEOUT_MS);
  let transportFailure: DatabaseHealthReason | undefined;
  try {
    const client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          try {
            return await fetchRequest(input, { ...init, cache: "no-store" });
          } catch (error) {
            transportFailure =
              error instanceof Error &&
              ["AbortError", "TimeoutError"].includes(error.name)
                ? "request_timed_out"
                : "network_error";
            throw error;
          }
        },
      },
    });
    const { data, error, status } = await client
      .rpc("database_health", undefined, { get: true })
      .abortSignal(signal);
    if (!error && data === 1) return { database: "ok" };
    let reason: DatabaseHealthReason;
    if (status === 401) reason = "key_rejected";
    else if (status === 403 || error?.code === "42501")
      reason = "access_denied";
    else if (error?.code === "PGRST202") reason = "health_function_missing";
    else if (status === 404) reason = "endpoint_not_found";
    else if (error?.code === "57014") reason = "database_timed_out";
    else if (status === 429) reason = "rate_limited";
    else if (transportFailure) reason = transportFailure;
    else if (signal.aborted) reason = "request_timed_out";
    else if (status >= 500) reason = "service_unavailable";
    else if (!error) reason = "unexpected_response";
    else reason = "upstream_failure";
    // Only fixed reason codes leave this module, never upstream details or settings.
    return { database: "unavailable", reason };
  } catch {
    return {
      database: "unavailable",
      reason:
        transportFailure ??
        (signal.aborted ? "request_timed_out" : "upstream_failure"),
    };
  }
}

export async function checkDatabaseHealth(
  config: Configuration,
  fetchRequest: typeof fetch = fetch,
): Promise<DatabaseHealth> {
  return (await diagnoseDatabaseHealth(config, fetchRequest)).database;
}
