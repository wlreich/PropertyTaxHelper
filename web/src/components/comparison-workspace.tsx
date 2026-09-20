"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {comparisonMethod,comparisonSummary,matchProperty,candidatePool,candidatePage,tierNames,type ComparisonData,type ComparisonProperty} from "@/lib/property-comparisons";
import {currency,parseSearch} from "@/lib/property-search";
import {PropertySectionLink} from "./property-section-link";
import {AdjustedComparisons} from "./adjusted-comparisons";
import {ComparisonFacts,ComparisonSummary,DeedClue} from "./comparison-property-facts";
import type {ComparisonEvidence} from "@/lib/comparison-evidence";

const number=(n:number|null,unit="")=>n===null?"Not reported":`${n.toLocaleString("en-US",{maximumFractionDigits:4})}${unit}`;
function Match({subject,property}:{subject:ComparisonProperty;property:ComparisonProperty}) {
  const match=matchProperty(subject,property);
  return <span className="comparison-tier">{match.tier===null?"Review differences":`Tier ${match.tier}`}</span>;
}
export function ComparisonWorkspace({data,initialIds,initialView="reported",initialStep="select",evidence,focusTarget}:{data:ComparisonData;initialIds:string[]|null;initialView?:"reported"|"adjusted";initialStep?:"select"|"results";evidence:Record<string,ComparisonEvidence>;focusTarget?:string}) {
  const router=useRouter();
  const view=initialView;
  const recommended=useMemo(()=>candidatePool(data),[data]);
  const active=initialIds===null?recommended.slice(0,3):data.selected;
  const activeIds=initialIds??active.map(p=>p.property_id);
  const heading=useRef<HTMLHeadingElement>(null),editButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(initialStep==='select')heading.current?.focus();else if(focusTarget==='edit')editButton.current?.focus();},[initialStep,focusTarget]);
  function navigate(step:"select"|"results",ids:string[],nextView=view,focus="") {
    const params=new URLSearchParams({release:data.release.dataset_id,selected:ids.join(','),view:nextView,step});
    if(focus)params.set('focus',focus);
    router.push(`/property/${data.subject.property_id}/compare?${params}`);
  }
  function changeView(next:"reported"|"adjusted") {navigate('results',activeIds,next);}
  const [selected,setSelected]=useState<ComparisonProperty[]>(active);
  const [tier,setTier]=useState(recommended.length?String(matchProperty(data.subject,recommended[0]).tier):"all"),[sort,setSort]=useState("match"),[candidateIndex,setCandidateIndex]=useState(0);
  const [query,setQuery]=useState(""),[submitted,setSubmitted]=useState(""),[searchPage,setSearchPage]=useState(0);
  const [matches,setMatches]=useState<ComparisonProperty[]>([]),[hasMore,setHasMore]=useState(false),[searched,setSearched]=useState(false);
  const [busy,setBusy]=useState(false),[searchError,setSearchError]=useState("");
  const [message,setMessage]=useState(initialIds && data.selected.length<initialIds.length?"Some saved selections are unavailable in this release and were left out.":"");
  const requestNumber=useRef(0);
  const summary=comparisonSummary(data.subject,selected);
  const candidates=candidatePage(data.subject,recommended,tier,sort,candidateIndex);
  const visible=candidates.items;
  const selectedTier=comparisonMethod.tiers.find(t=>String(t.tier)===tier);
  function updateSelection(items:ComparisonProperty[],notice="") {
    setSelected(items);setMessage(notice);

  }
  function toggle(property:ComparisonProperty) {
    if(selected.some(p=>p.property_id===property.property_id))updateSelection(selected.filter(p=>p.property_id!==property.property_id),`${property.address} removed.`);
    else if(property.property_id!==data.subject.property_id&&selected.length<10)updateSelection([...selected,property],`${property.address} added.`);
    else setMessage("You can compare up to 10 properties. Remove one to add another.");
  }
  async function search(event?:FormEvent,page=0) {
    event?.preventDefault();
    const term=page?submitted:query.trim(),input=parseSearch(term);
    if(input.error){setSearchError(input.error);return;}
    const request=++requestNumber.current;
    setBusy(true);setSearchError("");setSearched(false);setMatches([]);
    try {
      const params=new URLSearchParams({source:data.release.dataset_id,q:term,page:String(page)});
      const response=await fetch(`/api/property/${data.subject.property_id}/comparisons?${params}`,{cache:"no-store",signal:AbortSignal.timeout(30000)});
      const result=await response.json();
      if(request!==requestNumber.current)return;
      if(!response.ok||result.status!=="ok")throw Error("search");
      const incoming=result.data as ComparisonData;
      if(incoming.anchor_id!==data.anchor_id || incoming.release.dataset_id!==data.release.dataset_id){setSearchError("The published records changed. Reload this page before adding properties.");return;}
      setMatches(incoming.matches);setHasMore(incoming.search_has_more);setSubmitted(term);setSearchPage(page);setSearched(true);
    } catch {if(request===requestNumber.current)setSearchError("Property search is temporarily unavailable. Try again.");}
    finally {if(request===requestNumber.current)setBusy(false);}
  }
  function releaseChange(source:string) {
    const params=new URLSearchParams({release:source,selected:activeIds.join(","),view,step:initialStep});
    router.push(`/property/${data.subject.property_id}/compare?${params}`);
  }
  function showResults() {navigate('results',selected.map(p=>p.property_id),view,'edit');}
  function editSelection() {navigate('select',activeIds);}
  function cancelSelection() {navigate('results',activeIds,view,'edit');}
  function candidateRow(p:ComparisonProperty) {
    const checked=selected.some(x=>x.property_id===p.property_id),match=matchProperty(data.subject,p);
    return <tr key={p.property_id} className={checked?"comparison-candidate-selected":undefined}>
      <td><label className="comparison-checkbox"><input type="checkbox" aria-label={`Select ${p.address} (${p.property_id})`} checked={checked} disabled={!checked&&selected.length>=10} onChange={()=>toggle(p)}/></label></td>
      <th scope="row"><Link href={`/property/${p.property_id}`}>{p.address}</Link><span className="comparison-small">{number(p.living_area," sq ft")} · {p.year_built??"Not reported"} · {p.class_code??"Class not reported"}</span></th>
      <td data-label="Match"><Match subject={data.subject} property={p}/></td><td data-label="Reported market" className="comparison-money">{currency(p.market_value)}</td>
      <td data-label="Recorded similarities"><span>{match.reasons.slice(0,2).join(" · ")}</span><span className="comparison-small">{match.reasons.slice(2).join(" · ")}</span></td>
    </tr>;
  }
  return <>
    <div className="comparison-title"><div><h2 ref={heading} tabIndex={-1}>{initialStep==="select"?"Choose homes to compare":"Compare similar homes"}</h2><p>{initialStep==="select"?"Edit your draft set. Apply it when you’re ready; Cancel keeps your active comparison.":`${selected.length} selected ${selected.length===1?"property":"properties"} compared with your home.`}</p></div>
      <label className="comparison-release">Assessment release<select value={data.release.dataset_id} onChange={e=>releaseChange(e.target.value)}>{data.releases.map(r=><option key={r.dataset_id} value={r.dataset_id}>{r.tax_year} · {r.roll_stage} · {r.export_date??"Date not reported"}</option>)}</select></label>
    </div>
    {initialStep==="results"&&<div className="comparison-view-controls"><div><span className="comparison-view-label">View values as</span><div className="comparison-view-switch" role="group" aria-label="Comparison values"><button aria-pressed={view==="reported"} onClick={()=>changeView("reported")}>Reported values</button><button aria-pressed={view==="adjusted"} onClick={()=>changeView("adjusted")}>Estimated adjusted values</button></div></div><div className="comparison-result-actions"><button ref={editButton} className="comparison-add-link" onClick={editSelection}>Edit selection ({active.length})</button></div></div>}
    {message&&<p role="status" className="comparison-inline-note">{message}</p>}
    {initialStep==="results"&&data.release.tax_year!==comparisonMethod.year&&<p className="comparison-inline-note"><strong>{data.release.tax_year} rules have not been verified; these estimates use the 2026 criteria.</strong></p>}
    {initialStep==="select"&&<><div className="comparison-guidance"><p>Suggestions use recorded market area, class, size, and age. ParcelSavvy cannot verify every Appraisal District eligibility factor.{data.release.tax_year!==comparisonMethod.year&&<> <strong>{data.release.tax_year} rules have not been verified; these are the 2026 criteria.</strong></>}</p><PropertySectionLink target="comparison-rules-heading">How matching works</PropertySectionLink></div>
    <div className="comparison-mobile-action"><span><strong>{selected.length}</strong> selected</span><button type="button" onClick={showResults}>Apply selection</button></div>
    <div className="comparison-workspace">
      <section className="comparison-card comparison-suggestions" aria-labelledby="suggestions-heading">
        <div className="comparison-card-heading"><h3 id="suggestions-heading" tabIndex={-1}>Suggested properties</h3><p>Showing {visible.length} of {candidates.total} suggestions · Market area {data.subject.neighborhood??"not reported"}</p></div>
        <div className="comparison-controls"><label>Similarity tier<select value={tier} onChange={e=>{setTier(e.target.value);setCandidateIndex(0);}}><option value="all">All tiers · Closest first ({recommended.length})</option>{comparisonMethod.tiers.map(t=><option key={t.tier} value={t.tier}>Tier {t.tier} · {tierNames[t.tier]} ({candidates.counts[t.tier]})</option>)}</select></label><label>Sort by<select value={sort} onChange={e=>{setSort(e.target.value);setCandidateIndex(0);}}><option value="match">Closest recorded match</option><option value="value">Lowest reported value</option></select></label><PropertySectionLink target="comparison-search-heading" className="comparison-add-link">+ Add by address or ID</PropertySectionLink></div>
        <p className="comparison-inline-note">{selectedTier?`Same recorded market area and class · living area within ${selectedTier.area}% · built within ${selectedTier.years} years.`:"All available tiers, ordered by closest recorded match unless sorted by value."} Each property appears in its closest qualifying tier. Condition and other eligibility factors remain unverified.</p>
        {data.candidate_limit_reached&&<p className="comparison-inline-note">This market area has more than 2,000 records. Tier counts and suggestions cover only the loaded candidate pool; use address search to explore beyond it.</p>}

        {visible.length?<div className="comparison-table-scroll" role="region" aria-label="Suggested property table" tabIndex={0}><table className="comparison-candidates comparison-rows" role="table"><thead><tr><th scope="col"><span className="comparison-sr-only">Select</span></th><th scope="col">Property</th><th scope="col">Match</th><th scope="col">TCAD market value</th><th scope="col">Why it matches</th></tr></thead><tbody>{visible.map(candidateRow)}</tbody></table></div>:<p className="comparison-inline-note">No suggestions match the available criteria{tier!=="all"?" and selected filter":""}. Add a property by address or ID to explore your own comparisons.</p>}
        {candidates.total>10&&<div className="comparison-pagination"><button disabled={candidateIndex===0} onClick={()=>setCandidateIndex(candidateIndex-1)}>Previous suggestions</button><span>Page {candidateIndex+1} of {Math.ceil(candidates.total/10)}</span><button disabled={(candidateIndex+1)*10>=candidates.total} onClick={()=>setCandidateIndex(candidateIndex+1)}>Next suggestions</button></div>}
        <p className="comparison-inline-note">Suggestions favor similar recorded characteristics. They are not TCAD’s confirmed comparable list.</p>
        <details className="comparison-search" open><summary id="comparison-search-heading">Add by address or property ID</summary>
          <form onSubmit={search}><label htmlFor="comparison-query">Property address or ID</label><div className="comparison-search-fields"><input id="comparison-query" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Street name, address, or property ID"/><button type="submit" disabled={busy}>{busy?"Searching…":"Search properties"}</button></div></form>
          <p className="comparison-small">Search uses current addresses and only includes properties with records in the selected release. Your property is excluded.</p>
          <div role="status" aria-live="polite">{searchError || (busy?"Finding properties…":searched?`${matches.length} properties found for ${submitted}.`:"")}</div>

          {matches.length>0&&<div className="comparison-table-scroll" role="region" aria-label="Property search results" tabIndex={0}><table className="comparison-candidates comparison-rows" role="table"><thead><tr><th scope="col"><span className="comparison-sr-only">Select</span></th><th scope="col">Property</th><th scope="col">Match</th><th scope="col">TCAD market value</th><th scope="col">Differences</th></tr></thead><tbody>{matches.map(candidateRow)}</tbody></table></div>}
          {searched&&!matches.length&&<p>No matching comparison records on this page. Try another address or the next page if available.</p>}
          {searched&&(searchPage>0||hasMore)&&<div className="comparison-pagination"><button disabled={busy||searchPage===0} onClick={()=>search(undefined,searchPage-1)}>Previous results</button><span>Page {searchPage+1}</span><button disabled={busy||!hasMore} onClick={()=>search(undefined,searchPage+1)}>Next results</button></div>}
        </details>
      </section>
      <aside className="comparison-selection" aria-labelledby="selection-heading"><div className="comparison-card"><h3 id="selection-heading">Your comparison set</h3><p>{selected.length} of 10 properties selected</p>
        <ul>{selected.map(p=><li key={p.property_id}><div><strong>{p.address}</strong><span className="comparison-small">{number(p.living_area," sq ft")} · {p.year_built??"Not reported"}</span></div><button aria-label={`Remove ${p.address} (${p.property_id})`} onClick={()=>toggle(p)}>×</button></li>)}</ul>
        {!selected.length&&<p>Select properties to see your comparison and median.</p>}
        <button type="button" className="comparison-primary-link" onClick={showResults}>Apply selection</button><button className="comparison-text-button" onClick={cancelSelection}>Cancel changes</button>
        <button className="comparison-text-button" onClick={()=>updateSelection(recommended.slice(0,3),"Suggested set restored.")}>Restore suggested set</button>
        <button className="comparison-text-button" onClick={()=>updateSelection([],"All selections cleared.")}>Clear selections</button>
        <p className="comparison-small">Applied selections are saved in the results link. Changing the assessment release resets unsaved edits.</p>
        {selected.length===10&&<p role="status" className="comparison-small">Ten-property limit reached. Remove one to add another.</p>}
      </div><div className="comparison-selection-tip"><strong>Choose for similarity</strong><p>A lower assessment alone does not make a property a stronger comparison.</p></div></aside>
    </div></>}
    {initialStep==="results"&&view==="reported"&&<section className="comparison-card comparison-results" aria-labelledby="selected-comparison-heading"><h3 className="comparison-sr-only" id="selected-comparison-heading">Reported comparison values</h3>
      <ComparisonSummary value={data.subject.market_value} median={summary.median} difference={summary.difference} percent={summary.percent}/>
      <p className="comparison-small">{summary.count} of {selected.length} selected properties have reported values. Your property is excluded from the median.{summary.missing>0?` ${summary.missing} missing values left out.`:''}</p>
      {summary.count>0&&summary.count<3&&<p className="comparison-inline-note">A small selection gives limited context. Review more similar properties before drawing a conclusion.</p>}
      {selected.length>0?<div role="region" aria-label="Selected property comparison"><table className="comparison-rows" role="table"><thead><tr><th scope="col">Property</th><th scope="col">Match / key differences</th><th scope="col">Reported market</th><th scope="col">Compared with your home</th></tr></thead><tbody>{selected.map(p=><tr key={p.property_id}>
        <th scope="row"><Link href={`/property/${p.property_id}`}>{p.address}</Link><span className="comparison-small">{number(p.living_area,' sq ft')} · Built {p.year_built??'year not reported'}</span><DeedClue evidence={evidence[p.property_id]}/></th>
        <td><ComparisonFacts subject={data.subject} property={p}/></td><td data-label="Reported market" className="comparison-money">{currency(p.market_value)}</td><td data-label="Compared with your home">{p.market_value===null||data.subject.market_value===null?'Not available':p.market_value===data.subject.market_value?'Same value':`${currency(Math.abs(p.market_value-data.subject.market_value))} ${p.market_value>data.subject.market_value?'higher':'lower'}`}</td>
      </tr>)}</tbody></table></div>:<p className="comparison-inline-note">No homes selected. Use Edit selection to build your comparison.</p>}
      <p className="comparison-small">Source: Appraisal District {data.release.tax_year} {data.release.roll_stage} records · Exported {data.release.export_date??'date not reported'}. Differences in reported values alone do not establish overassessment or tax savings.</p>
    </section>}
    {initialStep==="results"&&view==="adjusted"&&<AdjustedComparisons subject={data.subject} selected={selected} release={data.release} evidence={evidence}/>}
    {initialStep==="results"&&<section className="comparison-card comparison-results"><h3>Build evidence around meaningful differences</h3><p>Review recorded size, age, land and additional structures. Estimates help explain differences; they are not official appraisals.</p><Link className="comparison-text-button" href={`/protest-guide?property=${data.subject.property_id}`}>Review protest options →</Link></section>}
    <details className="comparison-card comparison-method"><summary id="comparison-rules-heading">How matching works</summary><p>These comparison rules are based on TCAD’s 2026 Sale and Equity Grids methodology.</p>
      <p>Equity searches use the same market area and state classification. TCAD scores differences in condition, class, living area, and year built. These tiers describe progressively wider search criteria.</p>
      <div className="comparison-table-scroll" role="region" aria-label="TCAD equity tier criteria" tabIndex={0}><table><thead><tr><th scope="col">Tier</th><th scope="col">Living area</th><th scope="col">Condition</th><th scope="col">Class</th><th scope="col">Year built</th></tr></thead><tbody>{comparisonMethod.tiers.map(t=><tr key={t.tier}><th scope="row">{t.tier}</th><td>Within {t.area}%</td><td>{t.condition?`Within ${t.condition} ${t.condition===1?"step":"steps"}`:"Same"}</td><td>{t.classSteps?`Within ${t.classSteps} ${t.classSteps===1?"step":"steps"}`:"Same"}</td><td>Within {t.years} years</td></tr>)}</tbody></table></div>
      <p>TCAD’s documented score deducts 15 points per condition step (maximum 100), 20 per class step (maximum 100), 2 per 25 square feet (maximum 200), and 5 per 5 years (maximum 100). Eligibility also considers improvement type, undivided-interest children, inventory, affordable housing, class XX, and completion status.</p>
      <p><strong>What ParcelSavvy can check today:</strong> same market area, same recorded construction class, size and age tolerances. Suggestions are ordered by tier, then size difference, age difference, and property ID. This is a partial similarity check, not TCAD’s full score. We cannot verify condition, state classification, all exclusions, or class-step differences from these published records. Multiple living-area buildings are left out of suggestions when the primary improvement cannot be established.</p>
      <p>2026 rules remain explicitly labeled when you view another year. A property outside these suggestions may still be useful to explore; this page does not determine what an appraiser or hearing panel will accept.</p>
    </details>
    <details className="comparison-card comparison-method"><summary>Understand the adjustments</summary><p>A similarity tier helps select properties. An adjusted value asks what each comparable’s value would look like with your property’s characteristics.</p><p>TCAD’s documented formulas address land, construction class, depreciation, living area, non-living details, additional improvements, and neighborhood adjustments. For example, the land adjustment is the subject’s land value minus the comparable’s land value.</p><p>Switch to Estimated adjusted values to see estimates following TCAD’s formulas. We use the highest-valued improvement for living area, class and depreciation; non-living details and other improvements are adjusted separately. Reported detail costs supply feature values. Where percent good is unavailable, we use TCAD’s published class and age schedule for the selected year, using the depreciation year or year built and assuming average condition. Actual condition and other depreciation adjustments are not reported in these inputs. Estimates are withheld if that year’s schedule is unavailable. Comparisons with additional improvement records needing review are excluded from adjusted estimates and medians; their reported values remain visible. Market land includes agricultural land at market value, not agricultural use value. Main-area replacement costs are reconstructed from depreciated costs and estimated percent good. The main-area factor is 100%. Equal reported classes receive $0, as in TCAD’s worked comparisons. Neighborhood multipliers are recovered from improvement totals; equal factors are assumed when a factor is missing within the same market area. Each adjustment is truncated to whole dollars after unit rates are rounded to cents. Expand a breakdown to inspect the inputs. Features reflect the selected release, including subsequent record corrections. Only available estimates enter the adjusted median; a difference in property value is not a tax saving.</p></details>
  </>;
}
