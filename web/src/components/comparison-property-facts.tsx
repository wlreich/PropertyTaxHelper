import '@/styles/comparison-match.css';
import {comparisonMatch,type ComparisonProperty} from '@/lib/property-comparisons';
import {primaryBuilding} from '@/lib/tcad-costs';
import {currency} from '@/lib/property-search';
import type {ComparisonEvidence} from '@/lib/comparison-evidence';

export function ComparisonFacts({subject,property}:{subject:ComparisonProperty;property:ComparisonProperty}) {
 const match=comparisonMatch(subject,property),main=primaryBuilding(property.costs);
 const extras=main?property.costs!.improvements.filter(b=>b.id!==main.id):[];
 return <><span className="comparison-tier">{match.label}</span>
  <span className="comparison-small">{match.description}</span>
  {extras.length>0&&<strong className="comparison-structure">{extras.map(b=>`Additional structure${b.main_area!==null&&b.main_area>0?` · ${b.main_area.toLocaleString('en-US')} sq ft`:''}`).join('; ')}</strong>}
  {!main&&property.main_buildings>1&&<strong className="comparison-structure">Multiple living-area buildings recorded</strong>}</>;
}
export function DeedClue({evidence}:{evidence:ComparisonEvidence|undefined}) {
 if(!evidence?.deedDate)return null;
 return <details className="comparison-deed"><summary>Ownership change · {evidence.deedDate}</summary><p className="comparison-small">Recorded date: {evidence.deedDate}. This ownership record does not confirm that the property was sold. Ownership records checked for the calendar year before the {evidence.targetYear} assessment release: {evidence.start}–{evidence.end}.{evidence.coverage?` Source coverage: ${evidence.coverage}.`:''}</p></details>;
}
export const valueDifference=(n:number|null)=>n===null?'Not available':n===0?'Same as median':`${currency(Math.abs(n))} ${n>0?'above':'below'}`;
export function ComparisonSummary({value,median,difference,percent,adjusted=false}:{value:number|null;median:number|null;difference:number|null;percent:number|null;adjusted?:boolean}) {
 return <><h3 className="comparison-conclusion">{difference===null?'More information is needed for a comparison':difference===0?`Your value equals the ${adjusted?'adjusted ':''}median`:`Your value is ${percent!==null?`${Math.abs(percent).toFixed(1)}% `:''}${difference>0?'above':'below'} ${adjusted?'the adjusted median':'these homes’ median'}`}</h3>
 <dl className="comparison-summary"><div><dt>Your market value</dt><dd>{currency(value)}</dd></div><div><dt>{adjusted?'Estimated adjusted median':'Selected median'}</dt><dd>{median===null?'Not available':currency(median)}</dd></div><div><dt>Difference</dt><dd>{valueDifference(difference)}</dd></div></dl></>;
}
