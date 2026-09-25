import { countyToday, officialSource, validDate, type SeasonContext } from './seasons.ts';
import type { Snapshot } from './property-history.ts';

export const annualReviewCopy = {
  active: 'Check your property details and compare similar homes. If the evidence supports a different value, file a protest by the deadline on your notice. You can do it yourself or use an agent.',
  certified: 'Review next year’s preliminary appraisal when it arrives, even if this year’s value was reduced. Check the details and comparisons again before deciding whether to protest.',
  neutral: 'When your next appraisal notice arrives, check its deadline, property details and comparable homes. Protest if your evidence supports a different value.',
} as const;

export type AnnualReviewVariant = keyof typeof annualReviewCopy;

export function annualReviewPrompt(
  current: Pick<Snapshot, 'tax_year' | 'roll_stage'>,
  season: SeasonContext | null,
  unavailable = false,
  today = countyToday(),
) {
  const config = season?.config;
  const sameYear = config?.tax_year === current.tax_year;
  const verifiedOpenWindow = !unavailable &&
    current.roll_stage === 'preliminary' &&
    sameYear &&
    season?.phase === 'preliminary' &&
    config?.published === true &&
    validDate(config.starts_on) && config.starts_on <= today &&
    validDate(config.filing_deadline) && today <= config.filing_deadline &&
    officialSource(config.deadline_source) &&
    validDate(config.verified_on) && config.verified_on <= today;
  const finalRecordInKnownSeason = !unavailable &&
    sameYear &&
    (current.roll_stage === 'certified' || current.roll_stage === 'supplemental') &&
    (season?.phase === 'protest' || season?.phase === 'post');
  const variant: AnnualReviewVariant = verifiedOpenWindow
    ? 'active'
    : finalRecordInKnownSeason
      ? 'certified'
      : 'neutral';
  return { variant, copy: annualReviewCopy[variant] };
}
