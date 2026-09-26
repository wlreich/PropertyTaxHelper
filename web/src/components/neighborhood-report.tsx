import {type neighborhoodAnalysis,type NeighborhoodAnalysisData} from '@/lib/neighborhood-analysis';
import {adjustmentSummary} from '@/lib/market-adjustments';
import {dateLabel} from '@/lib/property-history';
import {currency} from '@/lib/property-search';
import {NeighborhoodAgentActivity} from './neighborhood-agent-activity';
import {NeighborhoodStory} from './neighborhood-analysis-view';

type Analysis=ReturnType<typeof neighborhoodAnalysis>;
type Outcome=Analysis['outcomes'][number];
const count=(n:number)=>n.toLocaleString('en-US');
const money=(n:number|null|undefined)=>n==null?'Not available':currency(n);
const pct=(n:number|null|undefined)=>n==null?'Not available':`${n>0?'+':''}${n.toFixed(1)}%`;
const ratio=(s:{count:number;total:number})=>s.total?`${count(s.count)} / ${count(s.total)}`:'Not available';

function ReportCapProgression({outcome:o}:{outcome:Outcome}) {
 const cap=o.capProgression,year=o.certified.tax_year,started=cap.startedAbove.count;
 const subset=(value:number)=>started?`${count(value)} of those ${count(started)}`:'Not available';
 return <section className="nbr-cap-progression" aria-labelledby="nbr-cap-progression-heading">
  <header><h3 id="nbr-cap-progression-heading">What happened with the cap?</h3><p>Homes with identified protest activity, matched {year} preliminary and certified market values, and a usable recorded preliminary cap.</p></header>
  {cap.usableCount?<><ol aria-label={`${year} cap outcome stages`}><li><strong>{count(started)} of {count(cap.usableCount)}</strong><span>Started above the {year} preliminary cap</span></li><li><strong>{subset(cap.reduced.count)}</strong><span>Received a {year} proposed-to-certified market-value reduction</span></li><li><strong>{subset(cap.finishedBelow.count)}</strong><span>Finished below the {year} preliminary capped assessed-value threshold</span></li></ol><p className="nbr-note">{started?`These stages follow the same ${count(started)} homes that started above the cap. `:'No homes in the usable cohort started above the cap, so later stages are not available. '}The {count(cap.usableCount)}-home denominator includes only homes with matched {year} preliminary and certified market values and a usable recorded preliminary cap.</p></>:<div className="nbr-cap-unavailable"><strong>Not available</strong><p>No homes with identified protest activity have both {year} preliminary and certified market values and a usable recorded preliminary cap.</p></div>}
 </section>;
}

function ReportOutcome({analysis:a,group}:{analysis:Analysis;group:string}) {
 const o=a.latestOutcome;
 return <section className="nbr-outcome" aria-labelledby="nbr-outcome-heading"><h2 id="nbr-outcome-heading">{o?`What changed during ${o.certified.tax_year}`:'Annual outcomes'}</h2>{o?<>
  <p className="nbr-note">Proposed → certified values · {count(o.all.count)} homes in Appraisal District group {group}</p>
  <p className="nbr-outcome-lead"><strong>{money(o.all.medianReduction)}{o.all.medianReduction!==null?' typical reduction':''}</strong><br/>The median reduction is calculated among {count(o.all.reduced.count)} reduced homes. Median individual percentage reduction: {o.all.medianPercent===null?'Not available':`${o.all.medianPercent.toFixed(1)}%`}.</p>
  <dl className="nbr-outcome-rows"><div><dt>Protest activity identified</dt><dd>{ratio(o.participation)}</dd></div><div><dt>Homes receiving a reduction</dt><dd>{ratio(o.all.reduced)}</dd></div><div><dt>Reduced below the recorded cap</dt><dd>{o.all.crossed.total?ratio(o.all.crossed):'Not available'}</dd></div></dl>
  <p className="nbr-note">Identified activity includes public protest records and activity inferred from proposed-to-certified reductions. Records may be incomplete; an absent entry does not establish that no protest occurred.</p>
  <p className="nbr-note">Reduction counts use homes with both proposed and certified values. The cap result uses reduced homes that started above their recorded {o.capSource.tax_year} preliminary cap with a valid threshold; its denominator can differ.</p>
  <ReportCapProgression outcome={o}/>
  {a.outcomes.slice(1).map(outcome=><p className="nbr-prior-outcome" key={outcome.certified.dataset_id}>{outcome.certified.tax_year}: {count(outcome.all.reduced.count)} of {count(outcome.all.reduced.total)} paired homes reduced; median reduction {money(outcome.all.medianReduction)}.</p>)}
 </>:<p>Completed proposed and certified values are needed. Missing outcomes are not zero reductions.</p>}</section>;
}

export function NeighborhoodReport({data:d,analysis:a}:{data:NeighborhoodAnalysisData;analysis:Analysis}) {
 const s=a.currentSummary,r=a.current;
 const m=d.market_adjustment?adjustmentSummary(d.market_adjustment):null;
 const distribution=s.marketDistribution,bins=distribution.bins.flatMap((b,i,all)=>i%2?[]:[{low:b.low,high:all[i+1]?.high??b.high,count:b.count+(all[i+1]?.count??0)}]),peak=Math.max(1,...bins.map(b=>b.count));
 return <div className="neighborhood-report-content">
  <section className="nbr-summary" aria-label="Current neighborhood position">
   <NeighborhoodStory analysis={a} print/>
   <table className="nbr-table nbr-position"><colgroup><col style={{width:'34%'}}/><col style={{width:'22%'}}/><col style={{width:'22%'}}/><col style={{width:'22%'}}/></colgroup><caption><h2>Where your home sits</h2><p>Same-period values: {r.tax_year} {r.roll_stage} · {dateLabel(r.export_date)}. This group is not a matched comparable set.</p></caption><thead><tr><th>Measure</th><th>Your home</th><th>Group median</th><th>Difference</th></tr></thead><tbody>{[['Market value',s.marketDistribution],['Market value / living sq ft',s.areaDistribution]].map(([name,v])=>{const x=v as typeof distribution;return <tr key={String(name)}><th scope="row">{String(name)}<small>{count(x.count)} eligible homes</small></th><td>{money(x.subject)}</td><td>{money(x.median)}</td><td>{x.subject!==null&&x.median!==null&&x.median>0?pct((x.subject/x.median-1)*100):'Not available'}</td></tr>;})}</tbody></table>
   {bins.length?<figure className="nbr-chart"><figcaption>Market-value distribution · {count(distribution.count)} homes</figcaption><ul className="sr-only" aria-label="Market-value ranges">{bins.map((b,i)=><li key={i}>{money(b.low)} to {money(b.high)}{i===bins.length-1?', inclusive':', upper boundary excluded'}: {count(b.count)} homes</li>)}</ul><div className="nbr-bars" aria-hidden="true">{bins.map((b,i)=><div key={i}><span>{count(b.count)}</span><i style={{height:`${b.count/peak*78}px`}}/></div>)}</div><div className="nbr-range"><span>{money(distribution.min)}</span><span>Market value, including land</span><span>{money(distribution.max)}</span></div><p>Adjacent equal-width bins are combined; the last includes its upper boundary. Differences can reflect size, land, condition and features.</p></figure>:<p>No usable distribution is available. Missing values are not zero.</p>}
   <ReportOutcome analysis={a} group={d.neighborhood}/>
  </section>
  <NeighborhoodAgentActivity data={d} analysis={a}/>
  <section className="nbr-history"><h2>Neighborhood history &amp; valuation context</h2>
   {a.preliminaryChanges.length?<table className="nbr-table"><thead><tr><th>Proposal years</th><th>Median individual change</th><th>Higher proposals</th><th>Eligible matches</th></tr></thead><tbody>{a.preliminaryChanges.map(x=><tr key={x.current.dataset_id}><th scope="row">{x.prior.tax_year} → {x.current.tax_year}</th><td>{pct(x.medianIndividualPercent)}</td><td>{ratio(x.higher)}</td><td>{count(x.matchedCount)} / {count(x.baseCount)}</td></tr>)}</tbody></table>:<p>Two consecutive preliminary years are needed for proposal changes.</p>}
   {a.carryForward.map(x=><div className="nbr-callout" key={x.current.dataset_id}><h3>Did {x.prior.tax_year} reductions carry forward?</h3><p>{x.reducedCount?`${count(x.full.count)} / ${count(x.reducedCount)} homes reduced at least 10% returned to or above their prior proposal in ${x.current.tax_year}; ${count(x.partial.count)} partly returned and ${count(x.noReturn.count)} did not.`:'No qualifying reduction with all three values is available.'} {count(x.matchedCount)} eligible matches; {count(x.excludedCount)} excluded or unavailable. A review signal, not proof of an incorrect value.</p></div>)}
   {!a.carryForward.length&&<p>Prior proposed and certified values plus the following proposal are needed to assess carry-forward.</p>}
   <div className="nbr-multiplier"><h3>Market-area multiplier: {m?.previous&&m.current?`${m.previous.factor}× → ${m.current.factor}×`:'Not available'}</h3><p>The Appraisal District applies this factor to estimated rebuilding cost after accounting for age and condition. Land is separate. {m?`${d.market_adjustment!.year} isolated effect: ${money(m.median)} estimated median (${count(m.count)} eligible / ${count(m.total)} included homes).`:'Matched preliminary inputs and published annual factors are unavailable.'} Other inputs are held fixed; this is not necessarily the total annual change or tax savings.</p>{d.market_adjustment&&<p className="nbr-note">{d.market_adjustment.history.map(x=>`${x.year}: ${x.filename}, page ${x.page}`).join(' · ')}</p>}</div>
  </section>
 </div>;
}

export function NeighborhoodReportSources({analysis:a}:{analysis:Analysis}) {
 return <section className="nbr-sources"><h2>Source coverage &amp; limits</h2><p>{a.coverage.map(c=>`${c.release.tax_year} ${c.release.roll_stage}, ${dateLabel(c.release.export_date)}: ${count(c.eligibleCount)} / ${count(c.baseCount)} eligible`).join(' · ')||'Historical release coverage unavailable.'}</p><p>Pairs use eligible matches in the current Appraisal District group; conflicting baselines, changed groups and unusable values are excluded. Historical proposals use the first eligible preliminary baseline, and certified values use the latest eligible certified release. The displayed current median uses its own current eligible population and can differ from a matched-pair median.</p><p>Available exports may omit records, and later Appraisal District corrections may not appear here. Missing values and zero denominators are unavailable, not zero. Values precede exemptions and are not taxes. A deed change is not proof of a sale; a recorded protest, inferred reduction or agent name does not establish causation. ParcelSavvy is independent of the Appraisal District. Verify official records.</p></section>;
}
