"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminCookie, databaseClient, requireAdmin } from "@/lib/supabase/admin";
import { seasonProblems, type Season } from "@/lib/seasons";

export async function signIn(_previous: string | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (email.length > 254 || password.length > 1024 || !email || !password) return "Enter your administrator email and password.";
  try {
    const client = databaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return "Sign-in failed. Check your email and password, then try again.";
    const authorized = await databaseClient(data.session.access_token).rpc("admin_access");
    if (authorized.error) {
      await client.auth.signOut();
      return "This account does not have administrator access.";
    }
    (await cookies()).set(adminCookie, data.session.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin",
      maxAge: Math.min(data.session.expires_in, 3600),
    });
  } catch { return "Sign-in is temporarily unavailable. Please try again."; }
  redirect("/admin");
}
export async function signOut() {
  const store = await cookies();
  const token = store.get(adminCookie)?.value;
  if (token) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000), cache: "no-store" });
    } catch { /* Always remove this browser's session even if the upstream is unavailable. */ }
  }
  store.delete({ name: adminCookie, path: "/admin" });
  redirect("/admin/login");
}
export type SaveResult = { message: string; saved?: Season } | null;
export async function saveSeason(_previous: SaveResult, form: FormData): Promise<SaveResult> {
  const client = await requireAdmin();
  const nullable = (name: string) => String(form.get(name) ?? "").trim() || null;
  const config: Season = {
    county: "travis", tax_year: Number(form.get("tax_year")), starts_on: nullable("starts_on"),
    filing_deadline: nullable("filing_deadline"), post_starts_on: nullable("post_starts_on"),
    deadline_source: nullable("deadline_source"), verified_on: nullable("verified_on"),
    mode: String(form.get("mode")) as Season["mode"], manual_phase: nullable("manual_phase") as Season["manual_phase"],
    published: form.get("publish") === "yes", revision: Number(form.get("revision")),
  };
  const problems = seasonProblems(config);
  if (!Number.isInteger(config.revision) || config.revision < 0) problems.push("Reload the season before saving.");
  if (problems.length) return { message: problems.join(" ") };
  const { data, error } = await client.rpc("admin_save_season", { p_config: config, p_revision: config.revision });
  if (error) return { message: error.code === "40001" ? "Someone updated this season. Reload before saving your changes." : "The season could not be saved. Check the dates and source, then try again." };
  revalidatePath("/admin");
  return { message: config.published ? "Season published." : "Draft saved. Public guidance is unchanged.", saved: data as Season };
}
export async function releaseAction(form: FormData) {
  const client = await requireAdmin();
  const action = String(form.get("action"));
  const id = String(form.get("id"));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) redirect("/admin?notice=invalid");
  const operation = action === "prepare" ? "admin_prepare_release" : action === "publish" ? "admin_publish_release" : action === "retry" ? "admin_retry_release" : null;
  if (!operation) redirect("/admin?notice=invalid");
  const args = action === "prepare" ? { p_dataset: id } : action === "publish" ? { p_preparation: id, p_acknowledge: form.get("acknowledge") === "yes" } : { p_preparation: id };
  const { error } = await client.rpc(operation, args);
  revalidatePath("/admin");
  redirect(error ? "/admin?notice=release-error" : `/admin?notice=${action}`);
}
