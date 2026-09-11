import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSeasons } from "../seasons";

export const adminCookie = "ps-admin-session";
export function databaseClient(token?: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) throw new Error("Database unavailable");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) }),
    },
  });
}
export async function requireAdmin() {
  const token = (await cookies()).get(adminCookie)?.value;
  if (!token) redirect("/admin/login");
  let client;
  try {
    client = databaseClient(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) redirect("/admin/login?notice=expired");
  } catch (error) {
    // Preserve Next.js navigation exceptions; only handle database/network failures here.
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin/login?notice=unavailable");
  }
  const { error } = await client.rpc("admin_access");
  if (error) redirect("/admin/login?notice=access");
  return client;
}
export async function getSeasonCalendar() {
  try {
    const { data, error } = await databaseClient().rpc("season_calendar", {}, { get: true });
    return error ? null : parseSeasons(data);
  } catch { return null; }
}
