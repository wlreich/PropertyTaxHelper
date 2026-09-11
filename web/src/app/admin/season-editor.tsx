"use client";
import { useActionState, useState } from "react";
import { saveSeason, type SaveResult } from "./actions";
import { countyToday, phaseNames, phases, seasonProblems, type Phase, type Season } from "@/lib/seasons";
import { SeasonNotice } from "@/components/season-notice";

function blank(year: number): Season {
  return { county: "travis", tax_year: year, starts_on: null, filing_deadline: null, post_starts_on: null, deadline_source: null, verified_on: null, mode: "automatic", manual_phase: null, published: false, revision: 0 };
}
export function SeasonEditor({ seasons }: { seasons: Season[] }) {
  const [config, setConfig] = useState<Season>(seasons[0] ?? blank(new Date().getFullYear()));
  const [phase, setPhase] = useState<Phase>("preliminary");
  const [result, action, pending] = useActionState(async (previous: SaveResult, form: FormData) => {
    const next = await saveSeason(previous, form);
    if (next?.saved) setConfig(next.saved);
    return next;
  }, null);
  const update = (key: keyof Season, value: string) => setConfig(s => ({ ...s, [key]: value || null }));
  const errors = seasonProblems({ ...config, published: true });
  return <section className="admin-section">
    <h2>Season calendar</h2>
    <p>Dates use Travis County time. The filing deadline remains part of the open window; the hearing phase begins the following day. Saving a draft leaves public guidance unchanged.</p>
    <form action={action} className="admin-form">
      <input type="hidden" name="revision" value={config.revision} />
      <div className="admin-fields">
        <label>County<input value="Travis County, Texas" readOnly /></label>
        <label>Tax year<input name="tax_year" type="number" min={1900} max={2200} value={config.tax_year} onChange={e => { const year = Number(e.target.value); setConfig(seasons.find(s => s.tax_year === year) ?? blank(year)); }} required /></label>
        <label>Assessment release / season start<input name="starts_on" type="date" value={config.starts_on ?? ""} onChange={e => update("starts_on", e.target.value)} /></label>
        <label>General filing deadline<input name="filing_deadline" type="date" value={config.filing_deadline ?? ""} onChange={e => update("filing_deadline", e.target.value)} /></label>
        <label>Post-season starts<input name="post_starts_on" type="date" value={config.post_starts_on ?? ""} onChange={e => update("post_starts_on", e.target.value)} /></label>
        <label>Deadline verified on<input name="verified_on" type="date" max={countyToday()} value={config.verified_on ?? ""} onChange={e => update("verified_on", e.target.value)} /></label>
        <label>Official deadline source<input name="deadline_source" type="url" maxLength={2048} value={config.deadline_source ?? ""} onChange={e => update("deadline_source", e.target.value)} placeholder="https://traviscad.org/…" /></label>
        <label>Transitions<select name="mode" value={config.mode} onChange={e => update("mode", e.target.value)}><option value="automatic">Automatic by date</option><option value="manual">Manual override</option></select></label>
        <label>Manual phase<select name="manual_phase" value={config.manual_phase ?? ""} onChange={e => update("manual_phase", e.target.value)}><option value="">Choose a phase</option>{phases.map(p => <option key={p} value={p}>{phaseNames[p]}</option>)}</select></label>
      </div>
      <p className="overview-note">Automatic mode needs all phase dates and a verified official deadline. A future year starts on its configured release date. Publishing a season does not publish assessment data.</p>
      {errors.length > 0 && <div aria-label="Before publishing"><strong>Before publishing</strong><ul>{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></div>}
      <div className="admin-actions">
        <button name="publish" value="no" disabled={pending}>Save draft</button>
        <button className="action-button" name="publish" value="yes" disabled={pending || errors.length > 0}>{pending ? "Saving…" : "Publish season"}</button>
      </div>
      <p role="status">{result?.message}</p>
    </form>
    <div className="admin-preview">
      <h3>Preview guidance</h3>
      <p>This preview uses your unsaved settings. It does not change the public site or claim that new property records are available.</p>
      <div className="admin-actions" role="group" aria-label="Preview phase">{phases.map(p => <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPhase(p)}>{phaseNames[p]}</button>)}</div>
      <SeasonNotice season={{ config: { ...config, deadline_source: errors.some(e => e.includes("source")) ? null : config.deadline_source }, phase }} />
      <p>Use “Preview property” below to see the full overview with the active or a prepared release.</p>
    </div>
  </section>;
}
