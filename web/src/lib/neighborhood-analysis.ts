import { median, usable, percentage, summarizeGroup, neighborhoodSummary, type Neighborhood, type Home, type Cap } from './neighborhood.ts';
import type { ComparisonRelease } from './property-comparisons.ts';

export type AnnualHome = {
  property_id: string; market: number | null; area: number | null;
  exclusion: 'baseline_ineligible' | 'different_neighborhood' | 'unusable_value' | null;
  protested: boolean;
};
export type AnnualPeriod = { release: ComparisonRelease; homes: AnnualHome[]; caps: Cap[] };
export type NeighborhoodAnalysisData = Neighborhood & { annual_periods: AnnualPeriod[] };
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
  const outcomes = periods.filter(p => p.release.roll_stage === 'certified').flatMap(certified => {
    const preliminary = find(certified.release.tax_year, 'preliminary');
    if (!preliminary?.release.export_date || !certified.release.export_date || preliminary.release.export_date >= certified.release.export_date) return [];
    const pre = index(preliminary), cert = index(certified);
    const homes: Home[] = data.homes.map(h => {
      const p = pre.get(h.property_id), c = cert.get(h.property_id);
      const proposed = valid(p) ? p.market : null, final = valid(c) ? c.market : null;
      return { ...h, preliminary: proposed, certified: final, certified_area: c?.area ?? null,
        protested: !!p?.protested || !!c?.protested || proposed !== null && final !== null && final < proposed };
    });
    const caps = preliminary.caps;
    const protested = homes.filter(h => h.protested);
    return [{ preliminary: preliminary.release, certified: certified.release, capSource: preliminary.release,
      all: summarizeGroup(homes, caps), protested: summarizeGroup(protested, caps),
      other: summarizeGroup(homes.filter(h => !h.protested), caps), participation: share(protested.length, homes.length) }];
  }).reverse();
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
  const completedCurrentYear = current.roll_stage !== 'preliminary' && currentCertified;
  const currentOutcome = outcomes.find(o => o.certified.tax_year === current.tax_year) ?? null;
  const story = {
    year: current.tax_year,
    start: compare(previousCertified, currentPreliminary),
    outcome: current.roll_stage === 'preliminary' ? outcomes[0] ?? null : currentOutcome,
    final: completedCurrentYear ? {
      release: current,
      median: currentSummary.median,
      valueCount: currentSummary.valueCount,
      versusProposal: compare(currentPreliminary, currentCertified),
      versusPriorCertified: reversedCertifiedChanges.find(x => x.current.dataset_id === currentCertified.release.dataset_id) ?? null,
    } : null,
  };
  return { current, currentSummary, latestOutcome: outcomes[0] ?? null, outcomes, story,
    certifiedChanges: reversedCertifiedChanges, preliminaryChanges: preliminaryChanges.reverse(),
    carryForward: carryForward.reverse(), coverage, minimumPatternSample: MIN_PATTERN_SAMPLE };
}
