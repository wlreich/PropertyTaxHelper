import Link from 'next/link';
import {readEvidenceWindow,evidenceParams,type EvidenceQuery} from '@/lib/evidence-window';
import {getWindowActivity} from '@/lib/supabase/property-activity';
import {ActivityShortlistPrint} from '@/components/activity-shortlist-print';
import {notFound} from 'next/navigation';
import {BrandLogo} from '@/components/brand-logo';
import {NeighborhoodReport,NeighborhoodReportSources} from '@/components/neighborhood-report';
import {getNeighborhoodAnalysis} from '@/lib/supabase/neighborhood-analysis';
import {getSeasonCalendar} from '@/lib/supabase/admin';
import {activeSeason} from '@/lib/seasons';
import {validPropertyId} from '@/lib/property-comparisons';
import {PrintButton} from './print-button';
import {NEIGHBORHOOD_METHOD_VERSION,SITE_URL} from '@/lib/site';
import '../neighborhood.css';
import './print.css';
// Calendar, analysis and the two bounded activity phases each allow 15 seconds.
export const maxDuration=90;
export const metadata={title:'Printable neighborhood report | ParcelSavvy',robots:{index:false,follow:false}};
export default async function NeighborhoodPrintPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<EvidenceQuery>}) {
 const {id}=await params;if(!validPropertyId(id))notFound();
 const calendar=await getSeasonCalendar(),season=calendar?activeSeason(calendar):null;
 const result=await getNeighborhoodAnalysis(id,season);
 if(result.status==='missing_property')notFound();
 if(result.status!=='ok')return <main id="main-content" className="print-unavailable"><h1>Neighborhood report unavailable</h1><p>The neighborhood analysis could not be loaded.</p><Link href={`/property/${id}/neighborhood`}>Return to the neighborhood page</Link></main>;
 const {data:d,analysis}=result,query=await searchParams;
 const {window,error}=readEvidenceWindow(query,season?season.config.tax_year+(season.phase==='post'?1:0):analysis.current.tax_year);
 const scope=error?new URLSearchParams():evidenceParams(window);
 for(const key of ['activityType','activitySort','activitySelected'])if(typeof query[key]==='string')scope.set(key,query[key]);
 const backHref=`/property/${id}/neighborhood?${scope}`;
 const activity=error?null:await getWindowActivity(id,window);
 return <main id="main-content" className="neighborhood-print-preview"><div className="print-toolbar"><Link href={backHref}>← Back to neighborhood analysis</Link><PrintButton/></div><article className="neighborhood-page print-report"><style>{`@page {@bottom-left {content: ${JSON.stringify(`Property ${id} | ${analysis.current.tax_year} ${analysis.current.roll_stage}`)};}}`}</style><header className="print-header"><BrandLogo/><p>Neighborhood report · {analysis.current.tax_year} {analysis.current.roll_stage}</p></header><h1>Your neighborhood, in context.</h1><p>{d.subject.address} · Property {id} · {d.subject.living_area?.toLocaleString('en-US')??'Unreported'} sq ft · Class {d.subject.class_code??'not reported'}</p><p>Appraisal District group {d.neighborhood} · {d.homes.length.toLocaleString('en-US')} single-family homes · Subdivision: {d.subdivision??'Not reported'}</p><NeighborhoodReport data={d} analysis={analysis}/>{error?<p role="alert">{error} Return to the neighborhood page to choose a valid evidence window.</p>:<ActivityShortlistPrint data={activity} window={window} query={query}/>}<NeighborhoodReportSources analysis={analysis}/><footer className="print-report-footer"><p>Generated {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'America/Chicago'}).format(new Date())} · Method {NEIGHBORHOOD_METHOD_VERSION}<br/>Live analysis: <a href={`${SITE_URL}${backHref}`}>{`${SITE_URL}/property/${id}/neighborhood`}</a></p></footer></article></main>;
}
