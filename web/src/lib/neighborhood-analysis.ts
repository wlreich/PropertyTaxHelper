import { median, usable, percentage, summarizeGroup, neighborhoodSummary, type Neighborhood, type Home, type Cap } from './neighborhood.ts';
import type { ComparisonRelease } from './property-comparisons.ts';

export type AnnualHome = {
  property_id: string; market: number | null; area: number | null;
  exclusion: 'baseline_ineligible' | 'different_neighborhood' | 'unusable_value' | null;
  protested: boolean;
};
export type AnnualPeriod = { release: ComparisonRelease; homes: AnnualHome[]; caps: Cap[] };
export type AgentAssignment = {
  property_id: string;
  tax_year: number;
  agent_name: string | null;
  status: 'named' | 'ambiguous';
};
export type NeighborhoodAnalysisData = Neighborhood & { annual_periods: AnnualPeriod[]; agent_assignments: AgentAssignment[] };
export const MIN_PATTERN_SAMPLE = 10;

// Percentages are available to consumers, but small cohorts should lead with counts.
function share(count: number, total: number) {
  return { count, total, percent: percentage(count, total), smallSample: total > 0 && total < MIN_PATTERN_SAMPLE };
}
function index(period: AnnualPeriod | undefined) {
  const rows = new Map<string, AnnualHome>();
  for (const home of period?.homes ?? []) {
    if (rows.has(home.property_id)) throw new Error('Duplicate annual property');
    rows.set(home.property_id, home);
  }
  return rows;
}
const valid = (h: AnnualHome | undefined): h is AnnualHome & { market: number } => !!h && h.exclusion === null && usable(h.market);

const agentKey = (name: string) => {
  const normalized = name.normalize('NFKC').trim();
  return normalized.replace(/[^a-z0-9]+/gi, '').toLocaleUpperCase('en-US') || normalized.toLocaleUpperCase('en-US');
};
const agentLabel = (name: string) => name.normalize('NFKC').trim().toLocaleLowerCase('en-US')
  .replace(/(^|[\s,.-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('en-US')}`)
  .replace(/\bOconnor\b/g, 'OConnor');
type ActivityHome = { property_id: string; preliminary: number | null; certified: number | null };
type AgentGroup = { key: string; label: string; kind: 'named' | 'ambiguous' | 'none'; homes: ActivityHome[] };
function summarizeAgentGroup(group: AgentGroup, label = group.label, kind: AgentGroup['kind'] | 'other' = group.kind, agentCount = 1) {
  const reduced = group.homes.filter(h => usable(h.preliminary) && usable(h.certified) && h.certified < h.preliminary);
  return { kind, label, agentCount, propertyCount: group.homes.length, reducedCount: reduced.length,
    medianReduction: median(reduced.map(h => h.preliminary! - h.certified!)),
    medianPercent: median(reduced.map(h => (h.preliminary! - h.certified!) / h.preliminary! * 100)) };
}
function agentActivityYear(data: NeighborhoodAnalysisData, preliminary: AnnualPeriod, certified: AnnualPeriod) {
  const pre = index(preliminary), cert = index(certified), year = certified.release.tax_year;
  const assignments = new Map(data.agent_assignments.filter(a => a.tax_year === year).map(a => [a.property_id, a]));
  const groups = new Map<string, AgentGroup>();
  for (const home of data.homes) {
    const p = pre.get(home.property_id), c = cert.get(home.property_id);
    const proposed = valid(p) ? p.market : null, final = valid(c) ? c.market : null;
    if (!(p?.protested || c?.protested || proposed !== null && final !== null && final < proposed)) continue;
    const assignment = assignments.get(home.property_id);
    const kind = assignment?.status === 'ambiguous' ? 'ambiguous' : assignment?.agent_name ? 'named' : 'none';
    const normalized = kind === 'named' ? agentKey(assignment!.agent_name!) : kind;
    const key = kind === 'named' && normalized ? `named:${normalized}` : kind;
    const label = kind === 'named' ? agentLabel(assignment!.agent_name!) : kind === 'ambiguous' ? 'Agent name unclear' : 'No agent identified';
    const group = groups.get(key) ?? { key, label, kind, homes: [] };
    group.label = [group.label, label].sort((a, b) => a.localeCompare(b))[0];
    group.homes.push({ property_id: home.property_id, preliminary: proposed, certified: final });
    groups.set(key, group);
  }
  const named = [...groups.values()].filter(g => g.kind === 'named')
    .sort((a, b) => b.homes.length - a.homes.length || a.key.localeCompare(b.key));
  const top = named.slice(0, 5).map(g => summarizeAgentGroup(g));
  const rest = named.slice(5);
  if (rest.length) top.push(summarizeAgentGroup({ key: 'other', label: '', kind: 'named', homes: rest.flatMap(g => g.homes) }, `Other agents (${rest.length})`, 'other', rest.length));
  const ambiguous = groups.get('ambiguous'), unnamed = groups.get('none');
  if (ambiguous) top.push(summarizeAgentGroup(ambiguous));
  if (unnamed) top.push(summarizeAgentGroup(unnamed));
  return { preliminary: preliminary.release, certified: certified.release,
    activityCount: [...groups.values()].reduce((total, group) => total + group.homes.length, 0), rows: top };
}

function capProgression(homes: Home[], caps: Cap[]) {
  const byId = new Map(caps.map(cap => [cap.property_id, cap]));
  // The usable denominator is one matched preliminary/certified population.
  // An eligible, non-binding cap is still a usable comparison; unknown,
  // inapplicable, unreconciled, or unpaired records are excluded.
  const usableComparisons = homes.filter(home => {
    const cap = byId.get(home.property_id);
    if (!home.protested || !usable(home.preliminary) || !usable(home.certified) || cap?.eligible !== true) return false;
    return cap.above === false || cap.above === true && cap.threshold !== null && cap.threshold > 0 && home.preliminary >= cap.threshold;
  });
  const startedAbove = usableComparisons.filter(home => {
    const cap = byId.get(home.property_id)!;
    return cap.above === true && cap.threshold !== null && cap.threshold > 0 && home.preliminary! >= cap.threshold;
  });
  const reduced = startedAbove.filter(home => home.certified! < home.preliminary!);
  const finishedBelow = startedAbove.filter(home => home.certified! < byId.get(home.property_id)!.threshold!);
  return {
    usableCount: usableComparisons.length,
    startedAbove: share(startedAbove.length, usableComparisons.length),
    reduced: share(reduced.length, startedAbove.length),
    finishedBelow: share(finishedBelow.length, startedAbove.length),
  };
}

export function neighborhoodAnalysis(data: NeighborhoodAnalysisData) {
  const ids = data.homes.map(h => h.property_id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate neighborhood property');
  const periods = [...data.annual_periods].sort((a, b) => a.release.tax_year - b.release.tax_year);
  const find = (year: number, stage: string) => periods.find(p => p.release.tax_year === year && p.release.roll_stage === stage);
  const compare = (prior: AnnualPeriod | undefined, current: AnnualPeriod | undefined) => {
    if (!prior || !current) return null;
    const before = index(prior), after = index(current);
    const matched = ids.filter(id => valid(before.get(id)) && valid(after.get(id)));
    const priorMedian = median(matched.map(id => before.get(id)!.market!));
    const currentMedian = median(matched.map(id => after.get(id)!.market!));
    return { prior: prior.release, current: current.release, baseCount: ids.length, matchedCount: matched.length,
      excludedCount: ids.length - matched.length, smallSample: matched.length > 0 && matched.length < MIN_PATTERN_SAMPLE,
      priorMedian, currentMedian,
      percent: priorMedian !== null && currentMedian !== null ? (currentMedian / priorMedian - 1) * 100 : null };
  };
  const preliminaryChanges = [], carryForward = [], certifiedChanges = [];
  for (const next of periods) {
    const year = next.release.tax_year, stage = next.release.roll_stage;
    const prior = find(year - 1, stage);
    if (!prior) continue;
    if (stage === 'certified') {
      certifiedChanges.push(compare(prior, next)!);
      continue;
    }
    if (stage !== 'preliminary') continue;
    const before = index(prior), after = index(next);
    const matched = ids.filter(id => valid(before.get(id)) && valid(after.get(id)));
    const coverage = { baseCount: ids.length, matchedCount: matched.length, excludedCount: ids.length - matched.length };
    preliminaryChanges.push({ prior: prior.release, current: next.release, ...coverage,
      medianIndividualPercent: median(matched.map(id => (after.get(id)!.market! / before.get(id)!.market! - 1) * 100)),
      higher: share(matched.filter(id => after.get(id)!.market! > before.get(id)!.market!).length, matched.length) });
    const certified = find(year - 1, 'certified');
    if (!certified || !prior.release.export_date || !certified.release.export_date || prior.release.export_date >= certified.release.export_date) continue;
    const final = index(certified);
    const complete = matched.filter(id => valid(final.get(id)));
    // Exported market values are whole dollars. Cross multiplication avoids a
    // rounded percentage deciding whether the exact 10% boundary is included.
    const reduced = complete.filter(id => BigInt(final.get(id)!.market!) * BigInt(10) <= BigInt(before.get(id)!.market!) * BigInt(9));
    const full = reduced.filter(id => after.get(id)!.market! >= before.get(id)!.market!).length;
    const partial = reduced.filter(id => after.get(id)!.market! > final.get(id)!.market! && after.get(id)!.market! < before.get(id)!.market!).length;
    carryForward.push({ prior: prior.release, certified: certified.release, current: next.release, thresholdPercent: 10,
      baseCount: ids.length, matchedCount: complete.length, excludedCount: ids.length - complete.length,
      reducedCount: reduced.length, full: share(full, reduced.length), partial: share(partial, reduced.length),
      noReturn: share(reduced.length - full - partial, reduced.length) });
  }
  const current = data.releases.find(r => r.dataset_id === data.source_id)!;
  // Only complete, chronologically valid preliminary/certified pairs are outcomes.
  const completedPairs = periods.filter(p => p.release.roll_stage === 'certified').flatMap(certified => {
    const preliminary = find(certified.release.tax_year, 'preliminary');
    if (!preliminary?.release.export_date || !certified.release.export_date || preliminary.release.export_date >= certified.release.export_date) return [];
    const pre = index(preliminary), cert = index(certified);
    const homes: Home[] = data.homes.map(h => {
      const p = pre.get(h.property_id), c = cert.get(h.property_id);
      const proposed = valid(p) ? p.market : null, final = valid(c) ? c.market : null;
      return { ...h, preliminary: proposed, certified: final, certified_area: c?.area ?? null,
        protested: !!p?.protested || !!c?.protested || proposed !== null && final !== null && final < proposed };
    });
    return [{ preliminary, certified, homes }];
  });
  const outcomes = completedPairs.map(({ preliminary, certified, homes }) => {
    const caps = preliminary.caps;
    const protested = homes.filter(h => h.protested);
    return { preliminary: preliminary.release, certified: certified.release, capSource: preliminary.release,
      all: summarizeGroup(homes, caps), protested: summarizeGroup(protested, caps),
      other: summarizeGroup(homes.filter(h => !h.protested), caps), participation: share(protested.length, homes.length),
      capProgression: capProgression(homes, caps) };
  }).reverse();
  const agentActivity = completedPairs.map(({ preliminary, certified }) => agentActivityYear(data, preliminary, certified)).reverse().slice(0, 2);
  const coverage = periods.map(p => ({ release: p.release, baseCount: ids.length,
    missingCount: ids.length - p.homes.length,
    eligibleCount: p.homes.filter(valid).length,
    exclusions: { baseline_ineligible: p.homes.filter(h => h.exclusion === 'baseline_ineligible').length,
      different_neighborhood: p.homes.filter(h => h.exclusion === 'different_neighborhood').length,
      unusable_value: p.homes.filter(h => h.exclusion === 'unusable_value').length } }));
  const currentSummary = neighborhoodSummary(data);
  const currentPreliminary = find(current.tax_year, 'preliminary');
  const currentCertified = find(current.tax_year, 'certified');
  const previousCertified = find(current.tax_year - 1, 'certified');
  const reversedCertifiedChanges = certifiedChanges.reverse();
  const currentOutcome = outcomes.find(o => o.certified.tax_year === current.tax_year) ?? null;
  // Current comparisons must use the exact active-release cohort and values.
  // A supplemental release must not be labeled with, or compared as though it
  // were, the older certified snapshot retained for protest-season analysis.
  const currentPeriod: AnnualPeriod = { release: current, caps: [], homes: data.homes.map(home => ({
    property_id: home.property_id, market: home.market, area: home.area, protested: home.protested,
    exclusion: usable(home.market) ? null : 'unusable_value',
  })) };
  const finalPeriod = current.roll_stage === 'supplemental' ? currentPeriod : currentCertified;
  const completedCurrentYear = current.roll_stage !== 'preliminary' && finalPeriod;
  const proposalToFinal = currentPreliminary && finalPeriod && currentPreliminary.release.export_date && finalPeriod.release.export_date
    && currentPreliminary.release.export_date < finalPeriod.release.export_date ? compare(currentPreliminary, finalPeriod) : null;
  const story = {
    year: current.tax_year,
    start: compare(previousCertified, currentPreliminary),
    outcome: current.roll_stage === 'preliminary' ? outcomes[0] ?? null : currentOutcome,
    final: completedCurrentYear ? {
      release: current,
      median: currentSummary.median,
      valueCount: currentSummary.valueCount,
      versusProposal: proposalToFinal,
      versusPriorCertified: compare(previousCertified, finalPeriod),
    } : null,
  };
  return { current, currentSummary, latestOutcome: outcomes[0] ?? null, outcomes, agentActivity, story,
    certifiedChanges: reversedCertifiedChanges, preliminaryChanges: preliminaryChanges.reverse(),
    carryForward: carryForward.reverse(), coverage, minimumPatternSample: MIN_PATTERN_SAMPLE };
}
