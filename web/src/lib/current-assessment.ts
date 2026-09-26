import { annualBaseline, comparison, exportDate, isFinalAssessment, preliminaryBaseline, releaseKey, type Snapshot, type ProtestObservation } from './property-history.ts';
import { assessmentOutcome } from './assessment-outcome.ts';
import { agentsForYear, assessmentSummary } from './homeowner-insights.ts';
import { type SeasonContext } from './seasons.ts';
import type { Property } from './supabase/properties.ts';

export { exportDate, releaseKey } from './property-history.ts';
export function selectCurrentAssessment(p: Property, snapshots: Snapshot[]) {
  const fallback: Snapshot = {
    dataset_id: `active-${p.property_id}`, tax_year: p.tax_year, roll_stage: p.roll_stage,
    export_date: exportDate(p.export_time_raw), export_time_raw: p.export_time_raw,
    market_value: p.market_value, assessed_value: p.assessed_value,
    land_value: p.land_value, improvement_value: p.improvement_value, land_acres: p.land_acres,
    neighborhood: null, protest_flag: null, arb_case_listed: false, arb_agent_listed: false,
    exemptions: [], components: [], entities: [],
  };
  if (p.values_under_review) return fallback;
  const ordered = [...snapshots].sort((a, b) => a.tax_year - b.tax_year || releaseKey(a).localeCompare(releaseKey(b)));
  const latest = ordered.at(-1);
  if (!latest || fallback.tax_year > latest.tax_year ||
    fallback.tax_year === latest.tax_year && releaseKey(fallback) > releaseKey(latest)) return fallback;
  return latest;
}
export function currentAssessmentStory(current: Snapshot, snapshots: Snapshot[], evidence: ProtestObservation[], season: SeasonContext | null, unavailable = false) {
  const ordered = [...snapshots].sort((a, b) => a.tax_year - b.tax_year || releaseKey(a).localeCompare(releaseKey(b)));
  const previous = annualBaseline(ordered, current);
  const initial = preliminaryBaseline(ordered, current);
  const summary = assessmentSummary(current, initial, previous);
  const annual = summary?.annual ?? null;
  const proposed = summary?.proposed ?? null;
  const assessed = previous ? comparison(previous.assessed_value, current.assessed_value) : null;
  const homestead = current.exemptions.includes('HS') || current.entities.some(e => Object.hasOwn(e.exemptions, 'HS'));
  const capped = homestead && current.market_value !== null && current.assessed_value !== null && current.assessed_value < current.market_value;
  const softened = capped && annual && assessed && annual.dollars > 0 && assessed.dollars >= 0 && annual.percent !== null && assessed.percent !== null && assessed.percent < annual.percent;
  const headline = !annual ? `Your ${current.tax_year} ${current.roll_stage} assessment` : annual.dollars === 0 ? 'Your market value held steady.' : `Your market value ${annual.dollars > 0 ? 'rose' : 'fell'}.${softened ? ' Your cap softened the increase.' : ''}`;
  const trend = annual ? annual.dollars === 0 ? `Market value is unchanged from ${previous!.tax_year}.` : `Market value ${annual.dollars > 0 ? 'increased' : 'decreased'}${annual.percent !== null ? ` ${Math.abs(annual.percent).toFixed(1)}%` : ''} from ${previous!.tax_year}.` : 'A comparable prior-year certified market value is not available.';
  const cap = softened ? ` The assessed value after your homestead cap increased ${assessed!.percent!.toFixed(1)}%.` : '';
  const finalLabel = current.roll_stage === 'supplemental' ? 'final' : 'certified';
  const outcome = proposed ? proposed.dollars === 0 ? `The proposed market value was unchanged in the ${finalLabel} record.` : `The ${finalLabel} market value is ${proposed.dollars < 0 ? 'lower' : 'higher'} than the proposed value.` : isFinalAssessment(current) ? 'A comparable preliminary value is not available.' : 'A certified result is not available for this assessment yet.';
  const recorded = evidence.some(e => e.tax_year === current.tax_year && (e.protest_flag || e.arb_case_listed));
  const protest = recorded ? 'Protest recorded' : proposed && proposed.dollars < 0 ? `Reduction evidence suggests a possible protest; ${unavailable ? 'protest records temporarily unavailable' : 'no protest record found'}` : unavailable ? 'Protest records temporarily unavailable' : 'No protest found in available records';
  const agents = agentsForYear(evidence, current.tax_year);
  const agentAssignmentRecorded = evidence.some(e => e.tax_year === current.tax_year && e.arb_agent_listed);
  const seasonNote = season && season.config.tax_year > current.tax_year ? `${season.config.tax_year} values are not available for this property yet. Showing the latest available ${current.tax_year} assessment.` : !isFinalAssessment(current) ? season?.phase === 'protest' && season.config.tax_year === current.tax_year ? 'Protest season is underway. The available records do not establish a final outcome for this property.' : 'Review the proposed value and property details. Pending results are not a zero-dollar reduction.' : null;
  const resultHeadline = recorded && proposed && proposed.dollars < 0 ? `Protest recorded. Value reduced ${proposed.percent !== null ? `${Math.abs(proposed.percent).toFixed(1)}%` : ''} from the proposal.` : headline;
  const overviewReductionPercent = recorded && proposed && proposed.dollars < 0 && proposed.percent !== null
    ? Math.abs(proposed.percent).toFixed(1)
    : null;
  const overviewNarrative = isFinalAssessment(current) && annual && annual.dollars < 0 && annual.percent !== null
    ? `Your ${current.tax_year} ${current.roll_stage} market value is ${Math.abs(annual.percent).toFixed(1)}% lower than in ${previous!.tax_year}.`
    : `${trend}${cap} ${outcome}`;
  return {
    previous, initial, annual, assessed, proposed, capped, recorded, agentAssignmentRecorded, evidenceUnavailable: unavailable,
    headline: resultHeadline, overviewReductionPercent,
    outcome: assessmentOutcome(current, initial),
    narrative: `${trend}${cap} ${outcome}`, overviewNarrative,
    protest, agents, seasonNote,
  };
}
