import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { parseSeasons } from "@/lib/seasons";
import { releaseAction, signOut } from "./actions";
import { SeasonEditor } from "./season-editor";
type Dataset = { id: string; tax_year: number; roll_stage: string; export_time_raw: string | null; import_scope: string };
type Preparation = { id: string; source_dataset: string; state: string; created_at: string; warnings: string[]; steps: { kind: string; complete: boolean; published_count: number }[] };
type Dashboard = { seasons: unknown; active: { dataset_id: string; tax_year: number; roll_stage: string }; datasets: Dataset[]; preparations: Preparation[]; audit: { id: number; at: string; action: string }[] };
const noticeText: Record<string, string> = { prepare: "Preparation started. The live site is unchanged. Refresh to check progress.", publish: "The prepared release is now live.", retry: "Preparation resumed from its saved progress.", "release-error": "The release could not be changed. Check that preparation is complete, the source is not older than the active release, and no newer sources arrived during preparation. Prepare again if the active release changed.", invalid: "Choose a valid release." };
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const client = await requireAdmin();
  const { data, error } = await client.rpc("admin_dashboard");
  if (error || !data) return <><h1>Administration</h1><p>Administration is temporarily unavailable. <Link href="/admin">Try again</Link>.</p></>;
  const dashboard = data as Dashboard;
  const seasons = parseSeasons(dashboard.seasons);
  const { notice } = await searchParams;
  return <>
    <div className="admin-actions"><h1>Administration</h1><form action={signOut}><button>Sign out</button></form></div>
    {notice && <p role="status">{noticeText[notice] ?? "Review the current settings below."}</p>}
    {seasons ? <SeasonEditor seasons={seasons} /> : <p>Season settings could not be loaded safely. Please try again.</p>}
    <section className="admin-section">
      <h2>Published assessment release</h2>
      <p><strong>{dashboard.active.tax_year} {dashboard.active.roll_stage}</strong> is live. <Link href={`/admin/preview?release=${dashboard.active.dataset_id}`}>Preview property</Link></p>
      <p>Prepare a release to collect its values, earlier assessments, protest observations, and agent names. The live site switches only when you publish the completed preparation. To add newly imported history, prepare the current valuation source again.</p>
      <form action={releaseAction} className="admin-form">
        <input type="hidden" name="action" value="prepare" />
        <label>Valuation source<select name="id" required defaultValue=""><option value="" disabled>Choose an imported valuation release</option>{dashboard.datasets.filter(d => d.import_scope === "full").map(d => <option key={d.id} value={d.id} disabled={d.tax_year < dashboard.active.tax_year || d.tax_year === dashboard.active.tax_year && d.roll_stage === "preliminary" && dashboard.active.roll_stage !== "preliminary"}>{d.tax_year} {d.roll_stage} · {d.export_time_raw ?? "Date unavailable"}</option>)}</select></label>
        <button className="action-button" disabled={dashboard.preparations.some(p => p.state === "preparing")}>Prepare release</button>
      </form>
      <p><Link href="/admin">Refresh preparation status</Link></p>
      <ul className="admin-list">{dashboard.preparations.map(p => {
        const source = dashboard.datasets.find(d => d.id === p.source_dataset);
        return <li key={p.id}><h3>{source?.tax_year} {source?.roll_stage} · {p.state}</h3>
          <p>{p.steps.filter(s => s.complete).length} of {p.steps.length} preparation steps complete.</p>
          <dl><div><dt>Searchable properties</dt><dd>{p.steps.filter(s => s.kind === "search").reduce((n, s) => n + s.published_count, 0).toLocaleString()}</dd></div><div><dt>Historical valuation records</dt><dd>{p.steps.filter(s => s.kind === "snapshot").reduce((n, s) => n + s.published_count, 0).toLocaleString()}</dd></div></dl>
          {p.warnings.length > 0 && <ul>{p.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
          {p.state === "ready" && <><p><Link href={`/admin/preview?release=${p.id}`}>Preview property</Link></p><form action={releaseAction} className="admin-form"><input type="hidden" name="action" value="publish" /><input type="hidden" name="id" value={p.id} />{p.warnings.length > 0 && <label className="admin-check"><input type="checkbox" name="acknowledge" value="yes" required />I reviewed the missing comparisons.</label>}<button className="action-button">Publish prepared release</button></form></>}
          {p.state === "failed" && <form action={releaseAction}><input type="hidden" name="action" value="retry" /><input type="hidden" name="id" value={p.id} /><p>The last batch failed. Completed work is retained and the live release is unchanged.</p><button>Resume preparation</button></form>}
        </li>;
      })}</ul>
    </section>
    <section className="admin-section"><h2>Recent changes</h2><ul className="admin-list">{dashboard.audit.map(a => <li key={a.id}><time dateTime={a.at}>{new Date(a.at).toLocaleString("en-US", { timeZone: "America/Chicago" })} Central</time> · {a.action.replaceAll("_", " ")}</li>)}</ul></section>
  </>;
}
