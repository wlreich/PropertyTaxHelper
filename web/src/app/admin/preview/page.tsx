import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { parseOverview } from "@/lib/supabase/properties";
import { PropertyOverview } from "@/components/property-overview";
import { phaseNames, phases, type Phase, type Season } from "@/lib/seasons";
import "../../property/[id]/property-overview.css";
export default async function Preview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const client = await requireAdmin();
  const params = await searchParams;
  const id = params.property ?? "736302";
  const release = params.release ?? "";
  const phase: Phase = phases.includes(params.phase as Phase) ? params.phase as Phase : "post";
  if (!/^[\da-f-]{36}$/i.test(release) || !/^\d{1,12}$/.test(id)) return <p>Choose a prepared release and valid property ID. <Link href="/admin">Back to administration</Link>.</p>;
  const { data, error } = await client.rpc("admin_preview_property", { p_anchor: release, p_id: id });
  const overview = parseOverview(data, id);
  if (error || overview.property.status !== "ok") return <p>This property is unavailable in the selected release, or the release is not ready. <Link href="/admin">Back to administration</Link>.</p>;
  const property = overview.property.data;
  const year = /^\d{4}$/.test(params.year ?? "") && Number(params.year) >= 1900 && Number(params.year) <= 2200 ? Number(params.year) : property.tax_year;
  const config: Season = { county: "travis", tax_year: year, starts_on: null, filing_deadline: null, post_starts_on: null, deadline_source: null, verified_on: null, mode: "manual", manual_phase: phase, published: false, revision: 0 };
  return <>
    <p><Link href="/admin">Back to administration</Link></p>
    <h1>Property preview</h1>
    <p className="admin-preview-banner">Preview only · Seasonal guidance is simulated. Values and agent records come from the selected release. This does not change the live site.</p>
    <form className="admin-form" method="get">
      <input type="hidden" name="release" value={release} />
      <div className="admin-fields"><label>Property ID<input name="property" defaultValue={id} pattern="[0-9]{1,12}" required /></label><label>Season year<input name="year" type="number" min={1900} max={2200} defaultValue={year} required /></label><label>Phase<select name="phase" defaultValue={phase}>{phases.map(p => <option key={p} value={p}>{phaseNames[p]}</option>)}</select></label></div>
      <button className="action-button">Update preview</button>
    </form>
    <div className="combined-profile"><PropertyOverview property={property} snapshots={overview.snapshots} protests={overview.protests} historyUnavailable={overview.historyUnavailable} protestsUnavailable={overview.protestsUnavailable} season={{ config, phase }} /></div>
  </>;
}
