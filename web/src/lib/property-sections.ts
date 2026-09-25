import { comparison, componentKey, componentName, dateLabel, entityDisplayName, exemptionName, type Snapshot } from './property-history.ts';
import { nextYearCap } from './assessment-outcome.ts';
import { currency } from './property-search.ts';

const hasHomestead = (s: Snapshot | undefined) => Boolean(s && (s.exemptions.includes('HS') || s.entities.some(e => Object.hasOwn(e.exemptions, 'HS'))));
const review = "Review your assessment every year. Consider a protest when property details or comparable values support it, even if this year's tax bill may not change.";

export function capModel(current: Snapshot, previous?: Snapshot, available = true, initial?: Snapshot, presentation: 'overview' | 'report' = 'overview') {
  const market = current.market_value, assessed = current.assessed_value;
  const difference = market !== null && assessed !== null && assessed <= market ? market - assessed : null;
  const homestead = available && hasHomestead(current);
  const priorHomestead = previous?.tax_year === current.tax_year - 1 && hasHomestead(previous);
  const state = !available || difference === null ? 'unavailable' : !homestead ? 'no-homestead' : !priorHomestead ? 'eligibility-unconfirmed' : difference > 0 ? 'binding' : 'nonbinding';
  const title = state === 'binding' ? 'Your cap helps. Keep reviewing.' : state === 'unavailable' ? 'More cap information needed.' : state === 'eligibility-unconfirmed' ? 'Check when your cap takes effect.' : 'Keep reviewing your market value.';
  const paragraphs = state === 'binding' ? [
    'Your assessed value is below your market value because the cap is limiting this assessment.', review,
    "A reduction below your capped assessed value can also lower the starting point for next year's cap.",
  ] : state === 'nonbinding' ? [
    'Your recorded assessed value equals your market value, so the cap is not reducing this assessment.', review,
    "A supported reduction can lower assessed value and the starting point for next year's cap, subject to continued eligibility and qualifying new improvements.",
  ] : state === 'no-homestead' ? [
    'No residence homestead exemption is listed in these records. A homestead cap has not been established here. Other appraisal limitations may apply.', review,
  ] : state === 'eligibility-unconfirmed' ? [
    'A homestead exemption is recorded, but the available records do not establish an active cap. The homestead limit generally begins in the year after qualification.', review,
  ] : [
    'The available records do not establish how an appraisal cap affects this assessment. Missing values are not zero.', review,
  ];
  const authorities = current.entities.map(e => {
    const entries = Object.entries(e.exemptions);
    // An absent exemption breakdown is not evidence of a $0 deduction.
    const exemptions = entries.length ? entries.reduce((total, [, value]) => total + value, 0) : assessed !== null && e.taxable_value === assessed ? 0 : null;
    const calculated = assessed !== null && exemptions !== null ? Math.max(0, assessed - exemptions) : null;
    const reconciles = calculated !== null && e.taxable_value !== null && Math.abs(calculated - e.taxable_value) <= 1;
    return { code: e.code, name: entityDisplayName(e), taxable: e.taxable_value, exemptions, reconciles,
      entries: entries.map(([code, value]) => ({ code, label: exemptionName(code).replace('TCAD', 'Appraisal District'), value })) };
  });
  const capExplanation = available && homestead && priorHomestead
    ? 'If your home qualified for a homestead exemption last year and this year, the cap generally limits increases in its appraised value to 10%, plus new improvements. Its market value can still rise more.'
    : null;
  const accuracyGuidance = available && homestead && priorHomestead && difference !== null && current.roll_stage !== 'preliminary'
    ? 'The cap limits increases in assessed value. It does not tell you whether the Appraisal District’s market value is right.'
    : null;
  return { market, assessed, difference, homestead, state, title, paragraphs, capExplanation, accuracyGuidance, authorities, outlook: nextYearCap(current, initial, available && (state === 'binding' || state === 'nonbinding'), presentation),
    defaultAuthority: authorities.find(e => /\bISD\b|SCHOOL/i.test(e.name))?.code ?? authorities[0]?.code ?? '',
    exemptionNames: [...new Set([...current.exemptions, ...current.entities.flatMap(e => Object.keys(e.exemptions))])].map(c => exemptionName(c).replace('TCAD', 'Appraisal District')),
    priorAssessed: priorHomestead ? previous?.assessed_value ?? null : null,
    priorYear: priorHomestead ? previous?.tax_year ?? null : null,
  };
}
export type CapModel = ReturnType<typeof capModel>;

export function annualChange(before: number | null | undefined, after: number | null | undefined, year?: number) {
  const change = comparison(before, after);
  if (!change || !year) return 'Prior-year comparison unavailable';
  return change.dollars === 0 ? `Unchanged from ${year}` : `${change.dollars > 0 ? '↑' : '↓'} ${currency(Math.abs(change.dollars))} vs. ${year}`;
}

export type PreliminaryValueDriverComparison =
  | { status: 'ok'; current: Snapshot; previous: Snapshot }
  | { status: 'unavailable'; reason: string };

const comparablePreliminary = (snapshots: Snapshot[], year: number) => snapshots
  .filter(s => s.tax_year === year && s.roll_stage === 'preliminary' && s.preliminary_baseline_eligible === true && s.export_date)
  .sort((a, b) => a.export_date!.localeCompare(b.export_date!) || a.dataset_id.localeCompare(b.dataset_id))[0];

/**
 * A strict, Value-drivers-only pair. Unlike the broader history fallback, an
 * absent eligibility flag is unknown and cannot become a preliminary baseline.
 */
export function preliminaryValueDriverComparison(snapshots: Snapshot[], currentYear: number): PreliminaryValueDriverComparison {
  const current = comparablePreliminary(snapshots, currentYear);
  const previous = comparablePreliminary(snapshots, currentYear - 1);
  if (!current || !previous) return {
    status: 'unavailable',
    reason: `A comparable preliminary record is not confirmed for both ${currentYear - 1} and ${currentYear}. Certified values are not substituted here.`,
  };
  if (!current.neighborhood || current.neighborhood !== previous.neighborhood) return {
    status: 'unavailable',
    reason: 'The same market area is not confirmed in both preliminary records. Certified values are not substituted here.',
  };
  if ([current.land_value, current.improvement_value, previous.land_value, previous.improvement_value].some(value => value === null)) return {
    status: 'unavailable',
    reason: 'Land or home-and-features values are missing from a comparable preliminary record. Missing values are not treated as zero.',
  };
  return { status: 'ok', current, previous };
}

export function hasPreliminaryValueDriverExplanation(current: Snapshot, comparison: PreliminaryValueDriverComparison) {
  return comparison.status === 'ok'
    && (current.roll_stage !== 'preliminary' || current.dataset_id === comparison.current.dataset_id);
}

const preliminaryDirection = (before: number, after: number) => {
  const difference = after - before;
  return difference === 0 ? 'stayed the same' : `${difference > 0 ? 'rose' : 'fell'} by ${currency(Math.abs(difference))}`;
};

export function preliminaryValueDriverSummary(comparison: PreliminaryValueDriverComparison) {
  if (comparison.status === 'unavailable') return comparison.reason;
  return `Land ${preliminaryDirection(comparison.previous.land_value!, comparison.current.land_value!)}. The preliminary value of your home and other features ${preliminaryDirection(comparison.previous.improvement_value!, comparison.current.improvement_value!)} from last year.`;
}

export function factorEffectContent(year: number, previousFactor: number | null | undefined, currentFactor: number | null | undefined, effect: number | null | undefined) {
  if (previousFactor == null || currentFactor == null || effect == null || previousFactor <= 0 || currentFactor <= 0) return null;
  const signedEffect = `${effect > 0 ? '+' : effect < 0 ? '−' : ''}${currency(Math.abs(effect))}`;
  const maximum = Math.max(previousFactor, currentFactor);
  const sharedWidth = (Math.min(previousFactor, currentFactor) / maximum) * 100;
  const differenceWidth = (Math.abs(currentFactor - previousFactor) / maximum) * 100;
  const factor = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}×`;
  return {
    signedEffect,
    intro: `Using the same ${year} building inputs, ParcelSavvy calculated this home’s value with the ${year - 1} multiplier of ${factor(previousFactor)}, then with the ${year} multiplier of ${factor(currentFactor)}. The difference is an estimated ${signedEffect}. Land is separate.`,
    boundary: 'This is the multiplier’s estimated effect, not the total change in your appraisal. Building inputs and the final protest result can change the overall value too.',
    alternative: `Using the same ${year} building inputs, the ${year - 1} factor is ${factor(previousFactor)} and the ${year} factor is ${factor(currentFactor)}. The estimated factor effect is ${signedEffect}. Land is separate.`,
    sharedWidth,
    previousDifferenceWidth: previousFactor > currentFactor ? differenceWidth : 0,
    currentDifferenceWidth: currentFactor > previousFactor ? differenceWidth : 0,
  };
}

export function factorEligibilityNote(year: number, currentDate: string | null, previousDate: string | null) {
  if (!currentDate) return null;
  const source = previousDate
    ? `Eligibility checked against preliminary records dated ${dateLabel(previousDate)} and ${dateLabel(currentDate)}.`
    : `Eligibility checked against the current-year preliminary record dated ${dateLabel(currentDate)}.`;
  return `${source} The supported factor estimate holds the ${year} building inputs constant.`;
}

export function valueDriverSummary(current: Snapshot, previous?: Snapshot) {
  const land = comparison(previous?.land_value, current.land_value);
  const home = comparison(previous?.improvement_value, current.improvement_value);
  if (!land || !home) return 'Land and the value of the home and other features are shown separately. A complete prior-year comparison is not available.';
  if (land.dollars === 0 && home.dollars !== 0) return `Land stayed the same. The recorded ${home.dollars > 0 ? 'increase' : 'decrease'} was in the value of your home and other features.`;
  if (land.dollars === 0 && home.dollars === 0) return 'Land and the value of the home and other features stayed the same.';
  return `Land value ${land.dollars > 0 ? 'rose' : 'fell'}. The value of the home and other features ${home.dollars === 0 ? 'stayed the same' : home.dollars > 0 ? 'rose' : 'fell'}.`;
}

export function propertyFeatures(current: Snapshot, previous?: Snapshot) {
  const features = new Map<string, Snapshot['components'][number]>();
  for (const s of [previous, current]) for (const c of s?.components ?? []) {
    if (!['1ST', '2ND', '3RD', '250', '251', '252'].includes(c.code)) features.set(componentKey(c), c);
  }
  return [...features.values()].sort((a, b) => Number(/POOL|SPA/i.test(b.description)) - Number(/POOL|SPA/i.test(a.description)) || componentName(a).localeCompare(componentName(b)) || (a.area ?? 0) - (b.area ?? 0)).map(c => {
    // Detail/improvement IDs change between exports. Only a unique type/area match
    // is comparable; identical entries across buildings must never be merged.
    const now = current.components.filter(x => componentKey(x) === componentKey(c));
    const old = previous?.components.filter(x => componentKey(x) === componentKey(c)) ?? [];
    const ambiguous = now.length > 1 || old.length > 1;
    const name = c.code === '447' ? 'Concrete spa' : componentName(c);
    const label = ['011', '012', '041'].includes(c.code) && c.area !== null ? `${name} (${c.area.toLocaleString('en-US')} sq ft)` : name;
    return { key: componentKey(c), label,
      value: !current.components.length ? 'Current feature records unavailable' : ambiguous ? 'Multiple recorded details' : now.length ? currency(now[0].value) : 'No longer separately listed',
      change: !current.components.length ? 'The current record does not provide feature details.' : ambiguous ? 'Comparison withheld across matching details.' : !now.length ? `Previously ${currency(old[0]?.value ?? null)}${previous ? ` in ${previous.tax_year}` : ''}. Not proof of physical removal.` : !previous?.components.length ? 'Prior-year comparison unavailable' : !old.length ? 'Newly listed; not proof of new construction.' : annualChange(old[0].value, now[0].value, previous.tax_year),
    };
  });
}
