import Link from "next/link";
import {notFound} from "next/navigation";
import {SiteHeader,SiteFooter} from "@/components/site-shell";
import {PropertyNavigation} from "@/components/property-navigation";
import {ComparisonWorkspace} from "@/components/comparison-workspace";
import {getComparisons} from "@/lib/supabase/comparisons";
import {getComparisonActivities} from "@/lib/supabase/property-activity";
import {comparisonEvidence,type ComparisonEvidence} from "@/lib/comparison-evidence";
import {candidatePool,defaultComparisonRelease,selectedIds,validPropertyId} from "@/lib/property-comparisons";
import {getSeasonCalendar} from "@/lib/supabase/admin";
import {activeSeason} from "@/lib/seasons";
import "../property-overview.css";
import "./comparison.css";
import {defaultEvidenceWindow} from "@/lib/evidence-window";
// Comparison/cost lookups and the two activity phases are independently bounded.
export const maxDuration=90;
export default async function ComparePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params,search=await searchParams;
  if(!validPropertyId(id))notFound();
  const source=typeof search.release==="string"?search.release:null;
  const view=search.view==="adjusted"?"adjusted":"reported";
  const step=search.step==="select"?"select":search.step==="results"||view==="adjusted"?"results":"select";
  const selection=typeof search.selected==="string"?selectedIds(search.selected):null;
  const [initialResult,calendar]=await Promise.all([getComparisons(id,source,selection??[]),getSeasonCalendar()]);
  let result=initialResult;
  let releaseNotice:string|null=null;
  if(!source&&initialResult.status==='ok') {
    const choice=defaultComparisonRelease(initialResult.data.releases,calendar?activeSeason(calendar):null);
    if(choice.release&&choice.release.dataset_id!==initialResult.data.release.dataset_id) {
      const preferred=await getComparisons(id,choice.release.dataset_id,selection??[]);
      if(preferred.status==='ok'&&preferred.data.anchor_id===initialResult.data.anchor_id)result=preferred;
    }
    releaseNotice=choice.notice;
  }
  if(result.status==="not_found")notFound();
  const evidence:Record<string,ComparisonEvidence>={};
  if(result.status==='ok'&&step==='results') {
    const window=defaultEvidenceWindow(result.data.release.tax_year);
    const properties=selection===null?candidatePool(result.data).slice(0,3):result.data.selected;
    // Activity resolves current neighborhoods; historical release groups cannot safely share a representative.
    const records=await getComparisonActivities(properties.map(p=>p.property_id),window);
    for(const [propertyId,data] of records)evidence[propertyId]=comparisonEvidence(data,propertyId,window);
  }
  return <><SiteHeader/><main id="main-content" className="main-shell profile-shell comparison-page">
    <Link href={`/property/${id}`} className="back-link">← Back to property overview</Link>
    {result.status==="ok"?<>
      <div className="comparison-property-heading"><div><p className="eyebrow">Appraisal District property {id}</p><h1>{result.data.subject.address}</h1><p>Your property · {result.data.subject.city} · Reported market value <strong>{result.data.subject.market_value===null?"Not reported":result.data.subject.market_value.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})}</strong></p></div>
      <dl className="comparison-quick-facts">{[["Living area",result.data.subject.living_area===null?"Not reported":`${result.data.subject.living_area.toLocaleString()} sq ft`],["Year built",result.data.subject.year_built??"Not reported"],["Construction class",result.data.subject.class_code??"Not reported"],["Lot size",result.data.subject.land_acres===null?"Not reported":`${result.data.subject.land_acres.toLocaleString()} acres`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
      <PropertyNavigation propertyId={id} active="compare"/>
      {Object.values(evidence).some(item=>!item.available)&&<p className="comparison-inline-note">Ownership-change coverage is unavailable for some selected properties. Missing records do not establish that no ownership change occurred.</p>}
      <ComparisonWorkspace releaseNotice={releaseNotice} key={`${id}:${result.data.anchor_id}:${result.data.release.dataset_id}:${view}:${(selection ?? candidatePool(result.data).slice(0,3).map(property=>property.property_id)).join(",")}`} evidence={evidence} focusTarget={typeof search.focus==="string"?search.focus:undefined} data={result.data} initialIds={selection} initialView={view} initialStep={step}/>
    </>:<><h1>Compare properties</h1><PropertyNavigation propertyId={id} active="compare"/><div className="notice"><h2>{result.status==="missing_snapshot"?"Comparison records are not available for this release":result.status==="invalid"?"Check the comparison link":"Comparisons are temporarily unavailable"}</h2><p>{result.status==="missing_snapshot"?"Choose the latest published records or return to your property overview.":"Try opening the comparison page again from your property overview."}</p><Link href={`/property/${id}/compare`}>Open latest comparison records</Link></div></>}
  </main><SiteFooter/></>;
}
