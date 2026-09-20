import { comparison, componentKey, componentName, entityDisplayName, exemptionName, type Snapshot } from './property-history.ts';
import { nextYearCap } from './assessment-outcome.ts';
import { currency } from './property-search.ts';

const hasHomestead = (s: Snapshot | undefined) => Boolean(s && (s.exemptions.includes('HS') || s.entities.some(e => Object.hasOwn(e.exemptions, 'HS'))));
const review = "Review your assessment every year. Consider a protest when property details or comparable values support it, even if this year's tax bill may not change.";

export function capModel(current: Snapshot, previous?: Snapshot, available = true, initial?: Snapshot) {
  const market = current.market_value, assessed = current.assessed_value;
  const difference = market !== null && assessed !== null && assessed <= market ? market - assessed : null;
  const homestead = available && hasHomestead(current);
  const priorHomestead = previous?.tax_year === current.tax_year - 1 && hasHomestead(previous);
  const state = !available || difference === null ? 'unavailable' : !homestead ? 'no-homestead' : difference > 0 ? 'binding' : priorHomestead ? 'nonbinding' : 'eligibility-unconfirmed';
  const title = state === 'binding' ? 'Your cap helps. Keep reviewing.' : state === 'unavailable' ? 'More cap information needed.' : state === 'eligibility-unconfirmed' ? 'Check when your cap takes effect.' : 'Keep reviewing your market value.';
  const paragraphs = state === 'binding' ? [
    'Your cap limits growth in assessed value; it does not confirm that your market value is accurate.', review,
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
  return { market, assessed, difference, homestead, state, title, paragraphs, authorities, outlook: nextYearCap(current, initial, available),
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

export function valueDriverSummary(current: Snapshot, previous?: Snapshot) {
  const land = comparison(previous?.land_value, current.land_value);
  const home = comparison(previous?.improvement_value, current.improvement_value);
  if (!land || !home) return 'Land and improvement values are shown separately. A complete prior-year comparison is not available.';
  if (land.dollars === 0 && home.dollars !== 0) return `Land stayed the same. The recorded ${home.dollars > 0 ? 'increase' : 'decrease'} was in your home and improvements.`;
  if (land.dollars === 0 && home.dollars === 0) return 'Land and improvement values stayed the same.';
  return `Land value ${land.dollars > 0 ? 'rose' : 'fell'}. Home and improvement values ${home.dollars === 0 ? 'stayed the same' : home.dollars > 0 ? 'rose' : 'fell'}.`;
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
