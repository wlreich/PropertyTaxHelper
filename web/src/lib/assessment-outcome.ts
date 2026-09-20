import type { Snapshot } from './property-history.ts';
import { currency } from './property-search.ts';

const homestead = (s: Snapshot) => s.exemptions.includes('HS') || s.entities.some(e => Object.hasOwn(e.exemptions, 'HS'));
const usable = (s: Snapshot) => s.market_value !== null && s.assessed_value !== null &&
  Number.isFinite(s.market_value) && Number.isFinite(s.assessed_value) &&
  s.market_value > 0 && s.assessed_value >= 0 && s.assessed_value <= s.market_value;

// The caller supplies the existing, provenance-checked preliminary baseline.
// Do not attribute every assessed change to market movement: a changed cap or
// eligibility can also change assessment. Decompose only a reconciled pair.
export function assessmentOutcome(current: Snapshot, initial?: Snapshot) {
  if (!initial || current.roll_stage !== 'certified' || initial.roll_stage !== 'preliminary' ||
    initial.tax_year !== current.tax_year || !usable(initial) || !usable(current)) return null;
  const marketReduction = initial.market_value! - current.market_value!;
  const assessedReduction = initial.assessed_value! - current.assessed_value!;
  const capExcluded = homestead(initial) && homestead(current) ? initial.market_value! - initial.assessed_value! : null;
  const reconciles = capExcluded !== null &&
    Math.abs(current.assessed_value! - Math.min(current.market_value!, initial.assessed_value!)) <= 1;
  let explanation: string | null = null;
  if (marketReduction > 0 && reconciles) {
    explanation = assessedReduction > 0
      ? `The cap already excluded ${currency(capExcluded)} of your proposed market value. The lower final value reduced your assessed value another ${currency(assessedReduction)}.`
      : `Your market value fell ${currency(marketReduction)}, but remained at or above the cap. Your assessed value stayed at ${currency(current.assessed_value)}; this reduction did not lower the starting point for next year’s cap.`;
  } else if (marketReduction > 0) {
    explanation = assessedReduction > 0
      ? `Your recorded assessed value also fell ${currency(assessedReduction)} from the proposal. The available records do not isolate how much came from the value change versus other assessment updates.`
      : assessedReduction === 0 ? 'The market-value reduction did not change your recorded assessed value.'
      : 'Market value fell, but recorded assessed value rose. Other assessment changes may affect the result.';
  }
  return { marketReduction, assessedReduction, capExcluded, reconciles, explanation };
}

export function nextYearCap(current: Snapshot, initial?: Snapshot, available = true) {
  if (!available || current.roll_stage !== 'certified' || !homestead(current) || !usable(current) || current.assessed_value === 0) return null;
  const outcome = assessmentOutcome(current, initial);
  const reduced = outcome !== null && outcome.assessedReduction > 0;
  const unchangedAfterReduction = outcome !== null && outcome.marketReduction > 0 && outcome.assessedReduction === 0;
  return {
    year: current.tax_year + 1, base: current.assessed_value!, ceiling: Math.round(current.assessed_value! * 1.1),
    title: reduced ? 'A lower starting point for next year' : 'Your starting point for next year',
    explanation: reduced
      ? `Your assessed value finished ${currency(outcome.assessedReduction)} below the proposal. That lower value becomes the starting point for next year’s homestead cap.`
      : unchangedAfterReduction
        ? 'Your market value fell, but your assessed value stayed the same. This reduction did not lower the starting point for next year’s cap.'
        : `Your ${current.tax_year} assessed value is the starting point for next year’s homestead cap. The cap limits assessment growth; it does not establish whether market value is accurate.`,
  };
}
