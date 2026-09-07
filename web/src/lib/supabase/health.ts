import "server-only";
import { createClient } from "@supabase/supabase-js";

type Configuration = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export type DatabaseHealth = "ok" | "not_configured" | "unavailable";

export async function checkDatabaseHealth(
  config: Configuration,
  fetchRequest: typeof fetch = fetch,
): Promise<DatabaseHealth> {
  const url = config.SUPABASE_URL?.trim();
  const key = config.SUPABASE_PUBLISHABLE_KEY?.trim();

  // This probe needs only a publishable key, never privileged database access.
  if (!url || !key?.startsWith("sb_publishable_")) return "not_configured";

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
      .rpc("database_health", undefined, { get: true })
      .abortSignal(AbortSignal.timeout(5000));

    return !error && data === 1 ? "ok" : "unavailable";
  } catch {
    // Never return upstream error details, URLs, or credentials to callers.
    return "unavailable";
  }
}
