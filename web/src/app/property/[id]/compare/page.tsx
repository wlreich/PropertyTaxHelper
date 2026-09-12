import Link from "next/link";
import {notFound} from "next/navigation";
import {SiteHeader,SiteFooter} from "@/components/site-shell";
import {PropertyNavigation} from "@/components/property-navigation";
import {ComparisonWorkspace} from "@/components/comparison-workspace";
import {getComparisons} from "@/lib/supabase/comparisons";
import {selectedIds,validPropertyId} from "@/lib/property-comparisons";
import "../property-overview.css";
import "./comparison.css";
export const maxDuration=30;
export default async function ComparePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params,search=await searchParams;
  if(!validPropertyId(id))notFound();
  const source=typeof search.release==="string"?search.release:null;
  const selection=typeof search.selected==="string"?selectedIds(search.selected):null;
  const result=await getComparisons(id,source,selection??[]);
  if(result.status==="not_found")notFound();
  return <><SiteHeader/><main id="main-content" className="main-shell profile-shell comparison-page">
    <Link href={`/property/${id}`} className="back-link">← Back to property overview</Link>
    {result.status==="ok"?<>
      <div className="comparison-property-heading"><div><p className="eyebrow">TCAD PROPERTY {id}</p><h1>{result.data.subject.address}</h1><p>Your property · {result.data.subject.city}</p></div>
      <dl className="comparison-quick-facts">{[["Living area",result.data.subject.living_area===null?"Not reported":`${result.data.subject.living_area.toLocaleString()} sq ft`],["Year built",result.data.subject.year_built??"Not reported"],["Construction class",result.data.subject.class_code??"Not reported"],["Lot size",result.data.subject.land_acres===null?"Not reported":`${result.data.subject.land_acres.toLocaleString()} acres`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
      <PropertyNavigation propertyId={id} active="compare"/>
      <ComparisonWorkspace key={`${result.data.anchor_id}:${result.data.release.dataset_id}`} data={result.data} initialIds={selection}/>
    </>:<><h1>Compare properties</h1><PropertyNavigation propertyId={id} active="compare"/><div className="notice"><h2>{result.status==="missing_snapshot"?"Comparison records are not available for this release":result.status==="invalid"?"Check the comparison link":"Comparisons are temporarily unavailable"}</h2><p>{result.status==="missing_snapshot"?"Choose the latest published records or return to your property overview.":"Try opening the comparison page again from your property overview."}</p><Link href={`/property/${id}/compare`}>Open latest comparison records</Link></div></>}
  </main><SiteFooter/></>;
}
