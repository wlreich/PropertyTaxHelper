import { currency } from '@/lib/property-search';
import { currentAssessmentStory } from '@/lib/current-assessment';
import { isFinalAssessment, snapshotLabel, type Snapshot, type ProtestObservation } from '@/lib/property-history';
import type { SeasonContext } from '@/lib/seasons';
import { CurrentYearRecord } from './annual-assessment-history';
import { PropertySectionLink } from './property-section-link';
import { TermDefinition } from './term-definition';

function AnnualChange({ change, year }: { change: ReturnType<typeof currentAssessmentStory>['annual']; year?: number }) {
  if (!change) return <>Prior-year comparison unavailable</>;
  if (change.dollars === 0) return <>Unchanged vs. {year}</>;
  return <>{change.dollars > 0 ? '↑' : '↓'} {currency(Math.abs(change.dollars))}{change.percent !== null && <> · {Math.abs(change.percent).toFixed(1)}%</>} vs. {year}</>;
}
export function CurrentAssessment({current,snapshots,evidence,season,unavailable,preliminaryExplanationAvailable=false}: {current:Snapshot;snapshots:Snapshot[];evidence:ProtestObservation[];season:SeasonContext|null;unavailable:boolean;preliminaryExplanationAvailable?:boolean}) {
  const story = currentAssessmentStory(current,snapshots,evidence,season,unavailable);
  return <section className="current-assessment" aria-labelledby="current-assessment-heading">
    <p className="current-assessment-label">Current assessment <span>/</span> {snapshotLabel(current)}</p>
    <h2 id="current-assessment-heading">{story.overviewReductionPercent !== null ? <>
      Protest recorded. <span className="current-assessment-favorable"><span className="current-assessment-favorable-lead"><span className="current-assessment-favorable-arrow" aria-hidden="true">↓</span> Value</span> reduced {story.overviewReductionPercent}%</span> from your preliminary appraisal.
    </> : story.headline}</h2>
    <p>{story.overviewNarrative}</p>
    <dl className="current-assessment-metrics">
      <div><dt><TermDefinition term="Appraisal District market value">The Appraisal District’s recorded estimate of market value. It is not a tax bill or an independent sale-price estimate.</TermDefinition></dt><dd className="current-assessment-number">{currency(current.market_value)}</dd><dd><AnnualChange change={story.annual} year={story.previous?.tax_year}/></dd></div>
      <div><dt>{story.capped ? 'Assessed value after cap' : 'Assessed value before exemptions'}</dt><dd className="current-assessment-number">{currency(current.assessed_value)}</dd><dd><AnnualChange change={story.assessed} year={story.previous?.tax_year}/></dd></div>
      <div><dt>{story.proposed && story.proposed.dollars > 0 ? 'Increase from proposed' : 'Reduction from proposed'}</dt><dd className="current-assessment-number">{story.proposed ? currency(Math.abs(story.proposed.dollars)) : isFinalAssessment(current) ? 'Not available' : 'Pending'}</dd><dd>{story.proposed ? story.proposed.dollars === 0 ? `Proposed and ${current.roll_stage === 'supplemental' ? 'final' : 'certified'} values match` : `${story.proposed.percent !== null ? `${Math.abs(story.proposed.percent).toFixed(1)}% ${story.proposed.dollars < 0 ? 'lower' : 'higher'}. ` : ''}Value change, not tax savings.` : isFinalAssessment(current) ? 'Comparable preliminary value unavailable' : 'Certified result unavailable'}</dd></div>
    </dl>
    {preliminaryExplanationAvailable && <PropertySectionLink target="market-adjustment-heading" className="current-assessment-driver-link">See how the Appraisal District arrived at your preliminary value.</PropertySectionLink>}
    {story.outcome?.overviewExplanation && <p className="current-assessment-impact">{story.outcome.overviewExplanation}</p>}
    {story.recorded && story.agents.length === 0 ? <>
      <p className="current-assessment-evidence">Protest recorded - Agent not identified.</p>
      <p className="current-assessment-evidence">{story.evidenceUnavailable
        ? 'Agent information is temporarily unavailable.'
        : story.agentAssignmentRecorded
          ? 'An agent assignment is recorded, but the name is unavailable.'
          : 'This may indicate that the homeowner protested without an agent.'}</p>
    </> : <>
      <p className="current-assessment-evidence">{story.protest} · {story.agents.length ? `Agent${story.agents.length > 1 ? 's' : ''}: ${story.agents.map(a=>a.name).join(' · ')}` : 'Agent not identified'}</p>
      {(story.agents.length > 0 || story.proposed && story.proposed.dollars < 0) && <p className="current-assessment-evidence">The records do not establish what caused a reduction or who handled the case.</p>}
    </>}
    <CurrentYearRecord year={current.tax_year} />
    {story.seasonNote && <p className="current-assessment-season">{story.seasonNote}</p>}
  </section>;
}
