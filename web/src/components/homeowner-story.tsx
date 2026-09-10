import Link from "next/link";
import { TermDefinition } from "./term-definition";
import { currency, resultsUrl } from "@/lib/property-search";
import { annualExplanation, seasonOutcome, historySequence, featureHighlights, streetSearch } from "@/lib/homeowner-insights";
import { dateLabel, type Snapshot, type Entity, type ProtestObservation } from "@/lib/property-history";

type Context = {current?:Snapshot;previous?:Snapshot;initial?:Snapshot;entity?:Entity;evidence:ProtestObservation[]};
export function AssessmentExplanation({current,previous,initial,entity,evidence}:Context) {
  const annual=annualExplanation(current,previous,entity);
  const season=seasonOutcome(current,initial,evidence,entity);
  return <>
    {annual && <section className="homeowner-explanation" aria-labelledby="explanation-heading">
      <p className="eyebrow">Your assessment, explained</p>
      <h2 id="explanation-heading">{annual.headline}</h2>
      <p>{annual.summary}</p>
      {annual.explanation && <p>{annual.explanation}</p>}
    </section>}
    {season && <section className={`overview-insight${season.observedProtest ? " homeowner-positive" : ""}`} aria-labelledby="change-heading">
      <p className="eyebrow">{current!.tax_year} · Proposed to certified</p>
      <h2 id="change-heading">{season.headline}</h2>
      <p className="homeowner-result">{currency(Math.abs(season.change.dollars))} lower{season.change.percent !== null && <span> · {Math.abs(season.change.percent).toFixed(1)}% decrease</span>}</p>
      <p>{season.label} fell between {season.period}.{season.observedProtest ? ` A protest was also recorded for ${current!.tax_year} during that period.` : ""}</p>
      <p className="overview-note">{season.observedProtest ? "Encouraging evidence, though these records do not confirm what caused the reduction. " : "The records do not establish what caused the reduction. "}This is a change in value, not tax savings.</p>
      {season.observedProtest && <a className="homeowner-text-link" href="#representation-heading">Review the protest record</a>}
    </section>}
  </>;
}
export function AssessmentSequence({current,initial,previous}:Omit<Context,"entity"|"evidence">) {
  const stages=historySequence(current,initial,previous);
  if (!stages.length) return null;
  const maximum=Math.max(...stages.map(s=>s.snapshot.market_value ?? 0));
  const landUnchanged=initial && current && initial.land_value!==null && initial.land_value===current.land_value;
  const improvementDrop=landUnchanged && initial && current && initial.market_value!==null && current.market_value!==null && initial.improvement_value!==null && current.improvement_value!==null && initial.market_value>current.market_value && Math.abs((initial.market_value-current.market_value)-(initial.improvement_value-current.improvement_value))<1;
  return <>
    <p className="overview-muted">Market value at each point in the assessment process.</p>
    <ol className="homeowner-timeline">
      {stages.map(({snapshot:s,label})=><li key={s.dataset_id}>
        <span>{label}</span><strong>{currency(s.market_value)}</strong><time dateTime={s.export_date ?? undefined}>{dateLabel(s.export_date)}</time>
        {s.market_value !== null && <span className="homeowner-bar-track" aria-hidden="true"><span style={{width:`${maximum>0 ? ((s.market_value ?? 0)/maximum)*100 : 0}%`}} /></span>}
      </li>)}
    </ol>
    {landUnchanged && <p className="overview-note">Land value stayed the same from proposed to certified.{improvementDrop ? " The market-value decrease came from the improvement value." : ""}</p>}
    <p className="overview-note">Certified is the dated record shown here; later corrections may still occur.</p>
  </>;
}
export function FeatureHighlights({current,initial,previous}:Omit<Context,"entity"|"evidence">) {
  const items=featureHighlights(current,initial,previous);
  return items.length ? <ul className="homeowner-feature-highlights">{items.map(x=><li key={x.key}><h3>{x.name}</h3><strong>{x.value}</strong><p>{x.detail}</p></li>)}</ul> : null;
}
export function Representation({evidence,year,unavailable}:{evidence:ProtestObservation[];year:number;unavailable:boolean}) {
  const years=[...new Set(evidence.map(s=>s.tax_year))].sort((a,b)=>b-a);
  if (!years.includes(year)) years.unshift(year);
  return <section className="overview-section" aria-labelledby="representation-heading">
    <h2 id="representation-heading">Protests & representation</h2>
    <ul className="homeowner-representation">{years.map(y=>{
      const records=evidence.filter(s=>s.tax_year===y);
      const positive=records.some(s=>s.protest_flag||s.arb_case_listed);
      const named=records.filter(s=>s.arb_agent_name);
      const names=[...new Set(named.map(s=>s.arb_agent_name!))];
      const assignment=records.some(s=>s.arb_agent_listed);
      return <li key={y}>
        <h3>{y} <span>{positive ? "Protest recorded" : unavailable ? "Protest history unavailable" : "No protest found in available records"}</span></h3>
        {names.length ? <p><strong>{names.join(" · ")}</strong><br />{names.length>1 ? "Different agents appear across the dated records." : "Agent named in the records."} {named.length>0 && dateLabel(named[0].export_date)}</p>
          : <p>{assignment ? "Agent assignment recorded; name unavailable." : "Agent not identified in the available records."}</p>}
      </li>;
    })}</ul>
    <p className="overview-note">Historical records may not reflect today’s status. A missing entry does not mean no protest was filed; an agent assignment does not confirm who handled the case.</p>
    {unavailable && <p className="overview-note">Some protest records are temporarily unavailable. Try again in a few minutes.</p>}
    {evidence.length>0 && <details className="homeowner-details"><summary>View source records</summary>
      <ul className="overview-protest-observations">{evidence.map(s=><li key={`${s.dataset_id}:${s.tax_year}`}>
        <strong>{s.tax_year} tax year · {dateLabel(s.export_date)}</strong>
        <span>{s.protest_flag && s.arb_case_listed ? "Protest flag and ARB case listed" : s.arb_case_listed ? "ARB case listed" : s.protest_flag ? "Protest flag recorded" : "Agent assignment recorded"}</span>
        {s.arb_status_codes.length>0 && <span>TCAD status code: {s.arb_status_codes.join(", ")}</span>}
        <span>{s.arb_agent_name ?? (s.arb_agent_listed ? "Agent assignment recorded; name unavailable" : "Agent not identified")}</span>
      </li>)}</ul><p className="overview-note">Status codes are shown as supplied; their definitions have not been verified. A later missing entry does not erase earlier evidence.</p>
    </details>}
    <details className="homeowner-details"><summary>Questions worth asking your agent</summary>
      <ul className="homeowner-checklist"><li>Which property facts or comparable properties supported the case?</li><li>What value was agreed to or ordered? Can I see that document?</li><li>How was my fee calculated, and how does it relate to actual tax savings?</li><li>Is there anything I should document before next year?</li></ul>
    </details>
  </section>;
}
export function HomeownerNextSteps({address}:{address:string}) {
  const street=streetSearch(address);
  return <section className="overview-section homeowner-next" aria-labelledby="next-heading">
    <h2 id="next-heading">What would you check next?</h2>
    <p>Start with your own property, then look around. These are useful checks whether you work with an agent or prepare your own case.</p>
    <ol className="homeowner-checklist">
      <li><a href="#property-facts-heading">Check the basics</a><span>Living area, land size and construction class: does the record describe your home?</span></li>
      <li><a href="#features-heading">Review separately valued features</a><span>Look for an incorrect pool, spa or other detail. Gather dated photos or documents for anything you question.</span></li>
      <li><a href="#exemptions-heading">Check your exemptions</a><span>Review what is recorded and the taxable value for each taxing authority.</span></li>
      <li><strong>Look for a fair comparison</strong><span>Start with the same TCAD neighborhood group, then similar size, age, construction and land. A nearby home is not automatically comparable.</span></li>
    </ol>
    {street && <Link className="homeowner-primary-link" href={resultsUrl(street)}>Browse my street</Link>}
    <details className="homeowner-details"><summary>Could I prepare my own protest?</summary>
      <p>Start by identifying a specific issue you can support: an incorrect property detail, documented condition, or a well-chosen comparison. Organize the evidence and the value you believe it supports.</p>
      <p><TermDefinition term="Sales and assessment comparisons">Sales help evaluate market value. Assessment comparisons examine how similar properties are appraised. They support different questions; keep the evidence separate.</TermDefinition></p>
      <p><a className="homeowner-text-link" href="https://traviscad.org/protests/">Read TCAD’s protest process and current requirements ↗</a></p>
    </details>
  </section>;
}
