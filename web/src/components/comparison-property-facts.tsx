import {matchProperty,tierNames,type ComparisonProperty} from '@/lib/property-comparisons';
import {primaryBuilding} from '@/lib/tcad-costs';
import {currency} from '@/lib/property-search';
import type {ComparisonEvidence} from '@/lib/comparison-evidence';

export function ComparisonFacts({subject,property}:{subject:ComparisonProperty;property:ComparisonProperty}) {
 const match=matchProperty(subject,property),main=primaryBuilding(property.costs);
 const extras=main?property.costs!.improvements.filter(b=>b.id!==main.id):[];
 return <><span className="comparison-tier">{match.tier===null?'Review differences':`Tier ${match.tier} · ${tierNames[match.tier]}`}</span>
  <span className="comparison-small">{match.reasons.slice(2).join(' · ')}</span>
  {extras.length>0&&<strong className="comparison-structure">{extras.map(b=>`Additional structure${b.main_area!==null&&b.main_area>0?` · ${b.main_area.toLocaleString('en-US')} sq ft`:''}`).join('; ')}</strong>}
  {!main&&property.main_buildings>1&&<strong className="comparison-structure">Multiple living-area buildings recorded</strong>}</>;
}
export function DeedClue({evidence}:{evidence:ComparisonEvidence|undefined}) {
 if(!evidence)return null;
 return <span className="comparison-small comparison-deed">{evidence.deedDate?`Deed change recorded ${evidence.deedDate}. A transfer clue, not proof of an arm’s-length sale.`:evidence.available?'No deed change found in the available window; coverage is incomplete.':'Deed evidence is unavailable for this window.'} Research window: {evidence.start}–{evidence.end}.{evidence.coverage?` Source coverage: ${evidence.coverage}; research dates are separate from the appraisal release.`:''}</span>;
}
export const valueDifference=(n:number|null)=>n===null?'Not available':n===0?'Same as median':`${currency(Math.abs(n))} ${n>0?'above':'below'}`;
export function ComparisonSummary({value,median,difference,percent,adjusted=false}:{value:number|null;median:number|null;difference:number|null;percent:number|null;adjusted?:boolean}) {
 return <><h4 className="comparison-conclusion">{difference===null?'More information is needed for a comparison':difference===0?`Your value equals the ${adjusted?'adjusted ':''}median`:`Your value is ${percent!==null?`${Math.abs(percent).toFixed(1)}% `:''}${difference>0?'above':'below'} ${adjusted?'the adjusted median':'these homes’ median'}`}</h4>
 <dl className="comparison-summary"><div><dt>Your market value</dt><dd>{currency(value)}</dd></div><div><dt>{adjusted?'Estimated adjusted median':'Selected median'}</dt><dd>{median===null?'Not available':currency(median)}</dd></div><div><dt>Difference</dt><dd>{valueDifference(difference)}</dd></div></dl></>;
}
