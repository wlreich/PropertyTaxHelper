import Link from "next/link";
import {notFound} from "next/navigation";
import {SiteHeader,SiteFooter} from "@/components/site-shell";
import {PropertyNavigation} from "@/components/property-navigation";
import {ComparisonWorkspace} from "@/components/comparison-workspace";
import {getComparisons} from "@/lib/supabase/comparisons";
import {getPropertyActivity} from "@/lib/supabase/property-activity";
import {comparisonEvidence,type ComparisonEvidence} from "@/lib/comparison-evidence";
import {candidatePool,selectedIds,validPropertyId} from "@/lib/property-comparisons";
import "../property-overview.css";
import "./comparison.css";
export const maxDuration=30;
export default async function ComparePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params,search=await searchParams;
  if(!validPropertyId(id))notFound();
  const source=typeof search.release==="string"?search.release:null;
  const view=search.view==="adjusted"?"adjusted":"reported";
  const step=search.step==="select"?"select":search.step==="results"||view==="adjusted"?"results":"select";
  const selection=typeof search.selected==="string"?selectedIds(search.selected):null;
  const result=await getComparisons(id,source,selection??[]);
  if(result.status==="not_found")notFound();
  const evidence:Record<string,ComparisonEvidence>={};
  if(result.status==='ok'&&step==='results') {
    const properties=selection===null?candidatePool(result.data).slice(0,3):result.data.selected;
    const groups=new Map([[result.data.subject.neighborhood??id,id]]);
    for(const p of properties)if(!groups.has(p.neighborhood??p.property_id))groups.set(p.neighborhood??p.property_id,p.property_id);
    const records=new Map(await Promise.all([...groups].map(async([area,propertyId])=>[area,await getPropertyActivity(propertyId,result.data.release.tax_year-1)] as const)));
    for(const p of properties)evidence[p.property_id]=comparisonEvidence(records.get(p.neighborhood??p.property_id)??null,p.property_id,result.data.release.tax_year);
  }
  return <><SiteHeader/><main id="main-content" className="main-shell profile-shell comparison-page">
    <Link href={`/property/${id}`} className="back-link">← Back to property overview</Link>
    {result.status==="ok"?<>
      <div className="comparison-property-heading"><div><p className="eyebrow">TCAD PROPERTY {id}</p><h1>{result.data.subject.address}</h1><p>Your property · {result.data.subject.city} · Reported market value <strong>{result.data.subject.market_value===null?"Not reported":result.data.subject.market_value.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})}</strong></p></div>
      <dl className="comparison-quick-facts">{[["Living area",result.data.subject.living_area===null?"Not reported":`${result.data.subject.living_area.toLocaleString()} sq ft`],["Year built",result.data.subject.year_built??"Not reported"],["Construction class",result.data.subject.class_code??"Not reported"],["Lot size",result.data.subject.land_acres===null?"Not reported":`${result.data.subject.land_acres.toLocaleString()} acres`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
      <PropertyNavigation propertyId={id} active="compare"/>
      <ComparisonWorkspace key={`${result.data.anchor_id}:${result.data.release.dataset_id}:${step}:${view}:${selection?.join(",")??"default"}`} evidence={evidence} focusTarget={typeof search.focus==="string"?search.focus:undefined} data={result.data} initialIds={selection} initialView={view} initialStep={step}/>
    </>:<><h1>Compare properties</h1><PropertyNavigation propertyId={id} active="compare"/><div className="notice"><h2>{result.status==="missing_snapshot"?"Comparison records are not available for this release":result.status==="invalid"?"Check the comparison link":"Comparisons are temporarily unavailable"}</h2><p>{result.status==="missing_snapshot"?"Choose the latest published records or return to your property overview.":"Try opening the comparison page again from your property overview."}</p><Link href={`/property/${id}/compare`}>Open latest comparison records</Link></div></>}
  </main><SiteFooter/></>;
}
