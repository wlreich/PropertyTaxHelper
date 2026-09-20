import { comparison, dateLabel, entityDisplayName, exemptionName, isPreliminaryBaseline, preliminaryBaseline, snapshotLabel, type Snapshot, type ProtestObservation } from './property-history.ts';
import { assessmentOutcome } from './assessment-outcome.ts';
import { currency } from './property-search.ts';
import { validDate } from './seasons.ts';

export function changeLabel(change: ReturnType<typeof comparison>) {
  if (!change) return 'Not available';
  if (change.dollars === 0) return 'Unchanged';
  return `${change.dollars > 0 ? '+' : '−'}${currency(Math.abs(change.dollars))}${change.percent === null ? '' : ` / ${Math.abs(change.percent).toFixed(1)}%`}`;
}

// Consumes the already-normalized public history contract. The publisher owns
// property-specific baseline exclusions; no dataset/year overrides belong here.
export function annualHistory(snapshots: Snapshot[], evidence: ProtestObservation[] = []) {
  const ordered = [...snapshots].sort((a, b) => a.tax_year - b.tax_year ||
    (a.export_date ?? '').localeCompare(b.export_date ?? '') || a.dataset_id.localeCompare(b.dataset_id));
  const years = [...new Set([...ordered.map(s => s.tax_year), ...evidence.map(s => s.tax_year)])].sort((a, b) => b - a);
  const certified = new Map(years.map(year => [year, ordered.filter(s => s.tax_year === year && s.roll_stage === 'certified').at(-1)]));
  return years.map(year => {
    const sources = ordered.filter(s => s.tax_year === year);
    const final = certified.get(year);
    const prior = certified.get(year - 1);
    const dated = sources.filter(s => validDate(s.export_date));
    const preliminary = final && validDate(final.export_date) ? preliminaryBaseline(dated, final) : dated.find(isPreliminaryBaseline);
    const latest = final ?? sources.at(-1);
    const annual = final && prior && validDate(final.export_date) && validDate(prior.export_date) ? comparison(prior.market_value, final.market_value) : null;
    const within = final && validDate(final.export_date) && preliminary ? comparison(preliminary.market_value, final.market_value) : null;
    return {
      year, preliminary: preliminary?.market_value ?? null,
      preliminaryAssessed: preliminary?.assessed_value ?? null,
      preliminaryLand: preliminary?.land_value ?? null, preliminaryImprovements: preliminary?.improvement_value ?? null,
      certifiedLand: final?.land_value ?? null, certifiedImprovements: final?.improvement_value ?? null,
      outcome: final ? assessmentOutcome(final, preliminary) : null,
      annualAssessed: final && prior && validDate(final.export_date) && validDate(prior.export_date) ? comparison(prior.assessed_value, final.assessed_value) : null,
      market: final?.market_value ?? null, assessed: final?.assessed_value ?? null,
      afterCap: latest?.assessed_value ?? null,
      status: final ? 'Certified' : latest?.roll_stage === 'preliminary' ? 'Preliminary only' : latest ? 'Supplemental only' : 'Protest records only',
      afterCapStatus: final ? null : latest ? snapshotLabel(latest).replace(`${year} `, '') : null,
      annual, within,
      sources: sources.map(s => ({
        id: s.dataset_id, label: snapshotLabel(s), date: dateLabel(s.export_date), rawDate: s.export_time_raw,
        market: s.market_value, assessed: s.assessed_value, land: s.land_value, improvements: s.improvement_value,
        exemptions: [...new Set([...s.exemptions, ...s.entities.flatMap(e => Object.keys(e.exemptions))])].map(code => exemptionName(code).replace('TCAD', 'Appraisal District')),
        authorities: s.entities.map(e => ({code: e.code, name: entityDisplayName(e), taxable: e.taxable_value,
          exemptions: Object.entries(e.exemptions).map(([code, value]) => ({code, name: exemptionName(code).replace('TCAD', 'Appraisal District'), value}))})),
      })),
      protests: evidence.filter(e => e.tax_year === year).map(e => ({
        id: e.dataset_id, date: dateLabel(e.export_date),
        basis: e.protest_flag && e.arb_case_listed ? 'Protest flag and ARB case listed' : e.arb_case_listed ? 'ARB case listed' : e.protest_flag ? 'Protest flag recorded' : 'Agent assignment recorded', recorded: Boolean(e.protest_flag || e.arb_case_listed),
        agent: e.arb_agent_name ?? (e.arb_agent_listed ? 'Agent name not identified' : null),
        codes: e.arb_status_codes,
      })),
    };
  });
}
export type AnnualYear = ReturnType<typeof annualHistory>[number];

export function chartScale(rows: AnnualYear[]) {
  const maximum = Math.max(0, ...rows.flatMap(r => [r.market ?? 0, r.assessed ?? 0]));
  const rawStep = (maximum || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(n => n * magnitude).find(n => n >= rawStep)!;
  return {maximum: step * 4, ticks: [0, 1, 2, 3, 4].map(n => n * step)};
}
export function capGapSummary(rows: AnnualYear[]) {
  const usable = rows.filter(r => r.market !== null && r.assessed !== null && r.market >= r.assessed).sort((a, b) => a.year - b.year);
  if (usable.length < 2) return null;
  const first = usable[0], last = usable.at(-1)!;
  const before = first.market! - first.assessed!, after = last.market! - last.assessed!;
  return before === after ? `The gap between market and assessed value was ${currency(after)} in both ${first.year} and ${last.year}.` :
    `The gap between market and assessed value ${after > before ? 'widened' : 'narrowed'} from ${currency(before)} in ${first.year} to ${currency(after)} in ${last.year}.`;
}
