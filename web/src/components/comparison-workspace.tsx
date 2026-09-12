"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useRef,useState,type FormEvent} from "react";
import {comparisonMethod,comparisonSummary,matchProperty,suggestions,type ComparisonData,type ComparisonProperty} from "@/lib/property-comparisons";
import {currency,parseSearch} from "@/lib/property-search";
import {PropertySectionLink} from "./property-section-link";
import {AdjustedComparisons} from "./adjusted-comparisons";

const number=(n:number|null,unit="")=>n===null?"Not reported":`${n.toLocaleString("en-US",{maximumFractionDigits:4})}${unit}`;
function Match({subject,property}:{subject:ComparisonProperty;property:ComparisonProperty}) {
  const match=matchProperty(subject,property);
  return <><span className="comparison-tier">{match.tier===null?"Review differences":`Possible Tier ${match.tier}`}</span><span className="comparison-small">Not fully verified</span></>;
}
export function ComparisonWorkspace({data,initialIds,initialView="reported"}:{data:ComparisonData;initialIds:string[]|null;initialView?:"reported"|"adjusted"}) {
  const router=useRouter();
  const [view,setView]=useState(initialView);
  const suggestionsHeading=useRef<HTMLHeadingElement>(null);
  function changeView(next:"reported"|"adjusted",edit=false) {
    setView(next);
    const url=new URL(window.location.href);
    url.searchParams.set("view",next);
    url.searchParams.set("release",data.release.dataset_id);
    url.searchParams.set("selected",selected.map(p=>p.property_id).join(","));
    window.history.replaceState(window.history.state,"",url);
    if(edit)requestAnimationFrame(()=>{suggestionsHeading.current?.focus();suggestionsHeading.current?.scrollIntoView({block:"start"});});
  }
  const recommended=suggestions(data);
  const [selected,setSelected]=useState<ComparisonProperty[]>(initialIds===null?recommended.slice(0,3):data.selected);
  const [tier,setTier]=useState("all"),[sort,setSort]=useState("match"),[showAll,setShowAll]=useState(false);
  const [query,setQuery]=useState(""),[submitted,setSubmitted]=useState(""),[searchPage,setSearchPage]=useState(0);
  const [matches,setMatches]=useState<ComparisonProperty[]>([]),[hasMore,setHasMore]=useState(false),[searched,setSearched]=useState(false);
  const [busy,setBusy]=useState(false),[searchError,setSearchError]=useState("");
  const [message,setMessage]=useState(initialIds && data.selected.length<initialIds.length?"Some saved selections are unavailable in this release and were left out.":"");
  const requestNumber=useRef(0);
  const summary=comparisonSummary(data.subject,selected);
  const filtered=recommended.filter(p=>tier==="all"||String(matchProperty(data.subject,p).tier)===tier).sort((a,b)=>sort==="value"?(a.market_value??Infinity)-(b.market_value??Infinity):0);
  const visible=showAll?filtered:filtered.slice(0,4);
  function updateSelection(items:ComparisonProperty[],notice="") {
    setSelected(items);setMessage(notice);
    const url=new URL(window.location.href);
    url.searchParams.set("release",data.release.dataset_id);
    url.searchParams.set("selected",items.map(p=>p.property_id).join(","));
    window.history.replaceState(window.history.state,"",url);
  }
  function toggle(property:ComparisonProperty) {
    if(selected.some(p=>p.property_id===property.property_id))updateSelection(selected.filter(p=>p.property_id!==property.property_id),`${property.address} removed.`);
    else if(selected.length<10)updateSelection([...selected,property],`${property.address} added.`);
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
    const params=new URLSearchParams({release:source,selected:selected.map(p=>p.property_id).join(","),view});
    router.push(`/property/${data.subject.property_id}/compare?${params}`);
  }
  function candidateRow(p:ComparisonProperty) {
    const checked=selected.some(x=>x.property_id===p.property_id),match=matchProperty(data.subject,p);
    return <tr key={p.property_id}>
      <td><label className="comparison-checkbox"><input type="checkbox" aria-label={`Select ${p.address} (${p.property_id})`} checked={checked} disabled={!checked&&selected.length>=10} onChange={()=>toggle(p)}/></label></td>
      <th scope="row"><Link href={`/property/${p.property_id}`}>{p.address}</Link><span className="comparison-small">{number(p.living_area," sq ft")} · {p.year_built??"Not reported"} · {p.class_code??"Class not reported"}</span></th>
      <td><Match subject={data.subject} property={p}/></td><td className="comparison-money">{currency(p.market_value)}</td>
      <td><span>{match.reasons.slice(0,2).join(" · ")}</span><span className="comparison-small">{match.reasons.slice(2).join(" · ")}</span></td>
    </tr>;
  }
  return <>
    <div className="comparison-title"><div><h2>Compare your assessment</h2><p>{view==="reported"?"Start with similar properties, then build your own comparison set.":"See how similar properties compare after estimated adjustments."}</p></div>
      <label className="comparison-release">Assessment release<select value={data.release.dataset_id} onChange={e=>releaseChange(e.target.value)}>{data.releases.map(r=><option key={r.dataset_id} value={r.dataset_id}>{r.tax_year} · {r.roll_stage} · {r.export_date??"Date not reported"}</option>)}</select></label>
    </div>
    <div className="comparison-view-controls"><div className="comparison-view-switch" role="group" aria-label="Comparison values"><button aria-pressed={view==="reported"} onClick={()=>changeView("reported")}>Reported values</button><button aria-pressed={view==="adjusted"} onClick={()=>changeView("adjusted")}>Adjusted to your property</button></div>{view==="adjusted"&&<button className="comparison-add-link" onClick={()=>changeView("reported",true)}>Edit comparison set ({selected.length})</button>}</div>
    <div className="comparison-modes"><strong>Assessment comparisons</strong><span>Sales comparisons · Coming later</span></div>
    <div className="comparison-guidance"><div><strong>Using TCAD’s documented 2026 comparison criteria</strong><p>Possible tiers use recorded size, age, class, and market area. Condition, state classification, and full eligibility are unverified.</p>{data.release.tax_year!==comparisonMethod.year&&<p><strong>{data.release.tax_year} rules have not been verified. These are the 2026 criteria.</strong></p>}</div><PropertySectionLink target="comparison-rules-heading">How the rules work</PropertySectionLink></div>
    <div hidden={view!=="reported"}>
    <div className="comparison-workspace">
      <section className="comparison-card comparison-suggestions" aria-labelledby="suggestions-heading">
        <div className="comparison-card-heading"><h3 id="suggestions-heading" ref={suggestionsHeading} tabIndex={-1}>Suggested properties</h3><p>Showing {visible.length} of {filtered.length} suggestions · Market area {data.subject.neighborhood??"not reported"}</p></div>
        <div className="comparison-controls"><label>Possible match tier<select value={tier} onChange={e=>{setTier(e.target.value);setShowAll(false);}}><option value="all">All possible tiers</option>{comparisonMethod.tiers.map(t=><option key={t.tier} value={t.tier}>Possible Tier {t.tier}</option>)}</select></label><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="match">Closest recorded match</option><option value="value">Lowest reported value</option></select></label><PropertySectionLink target="comparison-search-heading" className="comparison-add-link">+ Add by address or ID</PropertySectionLink></div>
        {data.candidate_limit_reached&&<p className="comparison-inline-note">This market area has more than 2,000 records. Suggestions use a limited set; use address search to explore beyond it.</p>}
        {visible.length>0&&<p className="comparison-small comparison-mobile-hint">Scroll the table sideways for values and match details.</p>}
        {visible.length?<div className="comparison-table-scroll" role="region" aria-label="Suggested property table" tabIndex={0}><table className="comparison-candidates"><thead><tr><th scope="col"><span className="comparison-sr-only">Select</span></th><th scope="col">Property</th><th scope="col">Match</th><th scope="col">TCAD market value</th><th scope="col">Why it matches</th></tr></thead><tbody>{visible.map(candidateRow)}</tbody></table></div>:<p className="comparison-inline-note">No suggestions match the available criteria{tier!=="all"?" and selected filter":""}. Add a property by address or ID to explore your own comparisons.</p>}
        {filtered.length>4&&<button className="comparison-text-button" onClick={()=>setShowAll(!showAll)}>{showAll?"Show fewer suggestions":`Show all ${filtered.length} suggestions`}</button>}
        <p className="comparison-inline-note">Suggestions favor similar recorded characteristics. They are not TCAD’s confirmed comparable list.</p>
        <details className="comparison-search"><summary id="comparison-search-heading">Add by address or property ID</summary>
          <form onSubmit={search}><label htmlFor="comparison-query">Property address or ID</label><div className="comparison-search-fields"><input id="comparison-query" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Street name, address, or property ID"/><button type="submit" disabled={busy}>{busy?"Searching…":"Search properties"}</button></div></form>
          <p className="comparison-small">Search uses current addresses and only includes properties with records in the selected release. Your property is excluded.</p>
          <div role="status" aria-live="polite">{searchError || (busy?"Finding properties…":searched?`${matches.length} properties found for ${submitted}.`:"")}</div>
          {matches.length>0&&<p className="comparison-small comparison-mobile-hint">Scroll the table sideways for values and match details.</p>}
          {matches.length>0&&<div className="comparison-table-scroll" role="region" aria-label="Property search results" tabIndex={0}><table className="comparison-candidates"><thead><tr><th scope="col"><span className="comparison-sr-only">Select</span></th><th scope="col">Property</th><th scope="col">Match</th><th scope="col">TCAD market value</th><th scope="col">Differences</th></tr></thead><tbody>{matches.map(candidateRow)}</tbody></table></div>}
          {searched&&!matches.length&&<p>No matching comparison records on this page. Try another address or the next page if available.</p>}
          {searched&&(searchPage>0||hasMore)&&<div className="comparison-pagination"><button disabled={busy||searchPage===0} onClick={()=>search(undefined,searchPage-1)}>Previous results</button><span>Page {searchPage+1}</span><button disabled={busy||!hasMore} onClick={()=>search(undefined,searchPage+1)}>Next results</button></div>}
        </details>
      </section>
      <aside className="comparison-selection" aria-labelledby="selection-heading"><div className="comparison-card"><h3 id="selection-heading">Your comparison set</h3><p>{selected.length} of 10 properties selected</p>
        <ul>{selected.map(p=><li key={p.property_id}><div><strong>{p.address}</strong><span className="comparison-small">{number(p.living_area," sq ft")} · {p.year_built??"Not reported"}</span><Match subject={data.subject} property={p}/></div><button aria-label={`Remove ${p.address} (${p.property_id})`} onClick={()=>toggle(p)}>×</button></li>)}</ul>
        {!selected.length&&<p>Select properties to see your comparison and median.</p>}
        <PropertySectionLink target="selected-comparison-heading" className="comparison-primary-link">Compare selected properties</PropertySectionLink>
        <button className="comparison-text-button" onClick={()=>updateSelection(recommended.slice(0,3),"Suggested set restored.")}>Restore suggested set</button>
        <button className="comparison-text-button" onClick={()=>updateSelection([],"All selections cleared.")}>Clear selections</button>
        <p className="comparison-small">Your selections are kept in this page’s link. Bookmark it to return to the same set.</p>
        <p role="status" className="comparison-small">{message}</p>
      </div><div className="comparison-selection-tip"><strong>Choose for similarity</strong><p>A lower assessment alone does not make a property a stronger comparison.</p></div></aside>
    </div>
    <section className="comparison-card comparison-results" aria-labelledby="selected-comparison-heading"><h3 id="selected-comparison-heading" tabIndex={-1}>Your selected properties, side by side</h3><p>Reported market values before adjustments.</p>
      <dl className="comparison-summary"><div><dt>Median of selected properties</dt><dd>{summary.median===null?"Select properties":currency(summary.median)}</dd></div><div><dt>Your property vs. median</dt><dd>{summary.difference===null?"Not available":summary.difference===0?"Same as median":`${currency(Math.abs(summary.difference))} ${summary.difference>0?"above":"below"}`}</dd>{summary.percent!==null&&<dd className="comparison-summary-percent">{Math.abs(summary.percent).toFixed(1)}% {summary.percent>0?"higher":summary.percent<0?"lower":"difference"}</dd>}</div></dl>
      <p className="comparison-small">Based on {summary.count} selected {summary.count===1?"property":"properties"} with reported values · Before adjustments · Your property is excluded from the median.{summary.missing>0?` ${summary.missing} with missing values left out.`:""}</p>
      {summary.count>0&&summary.count<3&&<p className="comparison-inline-note">A small selection gives limited context. Review more similar properties before drawing a conclusion.</p>}
      {selected.length>0?<><p className="comparison-small comparison-scroll-hint">Scroll the table sideways to see all selected properties.</p><div className="comparison-table-scroll" role="region" aria-label="Selected property comparison" tabIndex={0}><table className="comparison-grid"><thead><tr><th scope="col">Property facts</th><th scope="col" className="comparison-subject">Your property<br/>{data.subject.address}</th>{selected.map(p=><th scope="col" key={p.property_id}>{p.address}</th>)}</tr></thead><tbody>
        {([
          ["TCAD market value",(p:ComparisonProperty)=>currency(p.market_value)],
          ["Living area",(p:ComparisonProperty)=>number(p.living_area," sq ft")],
          ["Year built",(p:ComparisonProperty)=>p.year_built??"Not reported"],
          ["Construction class",(p:ComparisonProperty)=>p.class_code??"Not reported"],
          ["Market area",(p:ComparisonProperty)=>p.neighborhood??"Not reported"],
          ["Land value",(p:ComparisonProperty)=>currency(p.land_value)],
          ["Lot size",(p:ComparisonProperty)=>number(p.land_acres," acres")],
          ["Possible match tier",(p:ComparisonProperty)=>{const t=matchProperty(data.subject,p).tier;return p.property_id===data.subject.property_id?"Your property":t===null?"Review differences":`Possible Tier ${t}`;}],
          ["Condition / eligibility",()=>"Not verified"],
        ] as const).map(([label,render])=><tr key={label}><th scope="row">{label}</th>{[data.subject,...selected].map((p,i)=><td key={p.property_id} className={i===0?"comparison-subject":undefined}>{render(p)}</td>)}</tr>)}
      </tbody></table></div></>:<p className="comparison-inline-note">Choose properties above to build your comparison table.</p>}
      <p className="comparison-small">Source: TCAD {data.release.tax_year} {data.release.roll_stage} records · Exported {data.release.export_date??"date not reported"}. Differences in reported values alone do not establish overassessment or tax savings.</p>
    </section>
    </div>
    {view==="adjusted"&&<AdjustedComparisons subject={data.subject} selected={selected} release={data.release} peers={data.candidates}/>}
    <details className="comparison-card comparison-method"><summary id="comparison-rules-heading">How the rules work</summary><p>These comparison rules are based on TCAD’s 2026 Sale and Equity Grids methodology.</p>
      <p>Equity searches use the same market area and state classification. TCAD scores differences in condition, class, living area, and year built. These tiers describe progressively wider search criteria.</p>
      <div className="comparison-table-scroll" role="region" aria-label="TCAD equity tier criteria" tabIndex={0}><table><thead><tr><th scope="col">Tier</th><th scope="col">Living area</th><th scope="col">Condition</th><th scope="col">Class</th><th scope="col">Year built</th></tr></thead><tbody>{comparisonMethod.tiers.map(t=><tr key={t.tier}><th scope="row">{t.tier}</th><td>Within {t.area}%</td><td>{t.condition?`Within ${t.condition} ${t.condition===1?"step":"steps"}`:"Same"}</td><td>{t.classSteps?`Within ${t.classSteps} ${t.classSteps===1?"step":"steps"}`:"Same"}</td><td>Within {t.years} years</td></tr>)}</tbody></table></div>
      <p>TCAD’s documented score deducts 15 points per condition step (maximum 100), 20 per class step (maximum 100), 2 per 25 square feet (maximum 200), and 5 per 5 years (maximum 100). Eligibility also considers improvement type, undivided-interest children, inventory, affordable housing, class XX, and completion status.</p>
      <p><strong>What ParcelSavvy can check today:</strong> same market area, same recorded construction class, size and age tolerances. Suggestions are ordered by possible tier, then size difference, age difference, and property ID. This is a partial similarity check, not TCAD’s full score. We cannot verify condition, state classification, all exclusions, or class-step differences from these published records. Multiple living-area buildings are left out of suggestions when the primary improvement cannot be established.</p>
      <p>2026 rules remain explicitly labeled when you view another year. A property outside these suggestions may still be useful to explore; this page does not determine what an appraiser or hearing panel will accept.</p>
    </details>
    <details className="comparison-card comparison-method"><summary>Understand the adjustments</summary><p>A match tier helps select properties. An adjusted value asks what each comparable’s value would look like with your property’s characteristics.</p><p>TCAD’s documented formulas address land, construction class, depreciation, living area, non-living details, additional improvements, and neighborhood adjustments. For example, the land adjustment is the subject’s land value minus the comparable’s land value.</p><p>Switch to Adjusted to your property to see ParcelSavvy estimates using reported land value, living area, class, and year built. Size uses the comparable’s non-land assessment per square foot. Class and year-built differences use similar local properties from the selected release, excluding your home and the comparable being adjusted. Matching class, year, and market area have an assumed $0 adjustment. Condition and individual features are not separately priced. Expand each breakdown to see rates and assumptions. These estimates do not reproduce TCAD’s replacement-cost and depreciation schedules. Only available estimates enter the adjusted median; a difference in property value is not a tax saving.</p></details>
  </>;
}
