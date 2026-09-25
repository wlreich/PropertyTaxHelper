import 'server-only';
import { rpc } from './properties.ts';
import { parseNeighborhood } from './neighborhood.ts';
import { validPropertyId } from '../property-comparisons.ts';
import { validDate, type SeasonContext } from '../seasons.ts';
import { neighborhoodAnalysis, type AgentAssignment, type AnnualPeriod, type AnnualHome, type NeighborhoodAnalysisData } from '../neighborhood-analysis.ts';
import type { Cap } from '../neighborhood.ts';

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const amount = (v: unknown): v is number | null => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0;
const money = (v: unknown): v is number | null => amount(v) && (v === null || Number.isSafeInteger(v));
const nullableBool = (v: unknown) => v === null || typeof v === 'boolean';

export function parseNeighborhoodAnalysis(value: unknown, id: string): NeighborhoodAnalysisData | null {
  const base = parseNeighborhood(value, id);
  if (!base || !object(value) || !Array.isArray(value.annual_periods) || value.annual_periods.length > 100 || !Array.isArray(value.agent_assignments)) return null;
  const ids = new Set(base.homes.map(h => h.property_id));
  const current = base.releases.find(r => r.dataset_id === base.source_id)!;
  if (!validDate(current.export_date)) return null;
  const keys = new Set<string>(), periods: AnnualPeriod[] = [];
  for (const raw of value.annual_periods) {
    if (!object(raw) || !object(raw.release)) return null;
    const releaseId = raw.release.dataset_id;
    const release = base.releases.find(r => r.dataset_id === releaseId);
    if (!release || !['preliminary', 'certified'].includes(release.roll_stage) ||
      release.tax_year !== raw.release.tax_year || release.roll_stage !== raw.release.roll_stage || release.export_date !== raw.release.export_date ||
      !validDate(release.export_date) || release.export_date > current.export_date || release.tax_year > current.tax_year ||
      current.roll_stage === 'preliminary' && release.tax_year === current.tax_year && release.roll_stage === 'certified') return null;
    const key = `${release.tax_year}:${release.roll_stage}`;
    if (keys.has(key)) return null;
    keys.add(key);
    if (!Array.isArray(raw.homes) || raw.homes.length > ids.size || !Array.isArray(raw.caps) || raw.caps.length > ids.size) return null;
    const seen = new Set<string>(), homes: AnnualHome[] = [], caps: Cap[] = [];
    for (const h of raw.homes) {
      if (!object(h) || typeof h.property_id !== 'string' || !ids.has(h.property_id) || seen.has(h.property_id) ||
        !money(h.market) || !amount(h.area) || typeof h.protested !== 'boolean' ||
        ![null, 'baseline_ineligible', 'different_neighborhood', 'unusable_value'].includes(h.exclusion as string | null) ||
        h.exclusion === null && (h.market === null || h.market < 1000)) return null;
      seen.add(h.property_id);
      homes.push({ property_id: h.property_id, market: h.market, area: h.area, protested: h.protested, exclusion: h.exclusion as AnnualHome['exclusion'] });
    }
    const capIds = new Set<string>();
    for (const c of raw.caps) {
      if (!object(c) || typeof c.property_id !== 'string' || !ids.has(c.property_id) || capIds.has(c.property_id) ||
        !nullableBool(c.eligible) || !nullableBool(c.above) || !amount(c.threshold) ||
        c.threshold !== null && (c.eligible !== true || c.above !== true || c.threshold <= 0)) return null;
      capIds.add(c.property_id);
      caps.push({ property_id: c.property_id, eligible: c.eligible as boolean | null, above: c.above as boolean | null, threshold: c.threshold });
    }
    if (release.roll_stage !== 'preliminary' && caps.length) return null;
    periods.push({ release, homes, caps });
  }
  if (value.agent_assignments.length > ids.size * 100) return null;
  const assignmentKeys = new Set<string>(), agentAssignments: AgentAssignment[] = [];
  for (const raw of value.agent_assignments) {
    if (!object(raw) || typeof raw.property_id !== 'string' || !ids.has(raw.property_id) ||
      typeof raw.tax_year !== 'number' || !Number.isInteger(raw.tax_year) || raw.tax_year < 1900 || raw.tax_year > current.tax_year ||
      !['named', 'ambiguous'].includes(String(raw.status))) return null;
    const status = raw.status as AgentAssignment['status'];
    if (status === 'named' && (typeof raw.agent_name !== 'string' || raw.agent_name.trim() !== raw.agent_name || raw.agent_name.length < 1 || raw.agent_name.length > 200 || /[\u0000-\u001f\u007f]/.test(raw.agent_name)) ||
      status === 'ambiguous' && raw.agent_name !== null) return null;
    const key = `${raw.tax_year}:${raw.property_id}`;
    if (assignmentKeys.has(key)) return null;
    assignmentKeys.add(key);
    agentAssignments.push({ property_id: raw.property_id, tax_year: raw.tax_year, agent_name: raw.agent_name as string | null, status });
  }
  return { ...base, annual_periods: periods, agent_assignments: agentAssignments };
}

// Both the redesigned page and print route consume this exact contract. Pass the
// same activeSeason(getSeasonCalendar()) context already used by the overview.
export async function getNeighborhoodAnalysis(id: string, season: SeasonContext | null = null) {
  if (!validPropertyId(id)) return { status: 'invalid' as const };
  const value = await rpc('property_neighborhood_analysis', {
    p_id: id, p_phase: season?.phase ?? null, p_year: season?.config.tax_year ?? null,
  }, { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY }, fetch);
  if (object(value) && value.available === true && ['missing_property', 'missing_snapshot', 'missing_area', 'area_too_large', 'too_many_releases'].includes(String(value.status))) {
    return { status: value.status as 'missing_property' | 'missing_snapshot' | 'missing_area' | 'area_too_large' | 'too_many_releases' };
  }
  const data = parseNeighborhoodAnalysis(value, id);
  return data ? { status: 'ok' as const, data, analysis: neighborhoodAnalysis(data) } : { status: 'unavailable' as const };
}
