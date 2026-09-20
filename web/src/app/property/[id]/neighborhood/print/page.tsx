import Link from 'next/link';
import {notFound} from 'next/navigation';
import {BrandLogo} from '@/components/brand-logo';
import {NeighborhoodAnalysisView} from '@/components/neighborhood-analysis-view';
import {getNeighborhoodAnalysis} from '@/lib/supabase/neighborhood-analysis';
import {getSeasonCalendar} from '@/lib/supabase/admin';
import {activeSeason} from '@/lib/seasons';
import {validPropertyId} from '@/lib/property-comparisons';
import {PrintButton} from './print-button';
import {NEIGHBORHOOD_METHOD_VERSION,SITE_URL} from '@/lib/site';
import '../neighborhood.css';
import './print.css';
export const maxDuration=30;
export const metadata={title:'Printable neighborhood report | ParcelSavvy',robots:{index:false,follow:false}};
export default async function NeighborhoodPrintPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!validPropertyId(id))notFound();
 const calendar=await getSeasonCalendar(),season=calendar?activeSeason(calendar):null;
 const result=await getNeighborhoodAnalysis(id,season);
 if(result.status==='missing_property')notFound();
 if(result.status!=='ok')return <main id="main-content" className="print-unavailable"><h1>Neighborhood report unavailable</h1><p>The neighborhood analysis could not be loaded.</p><Link href={`/property/${id}/neighborhood`}>Return to the neighborhood page</Link></main>;
 const {data:d,analysis}=result,backHref=`/property/${id}/neighborhood`;
 return <main id="main-content" className="neighborhood-print-preview"><div className="print-toolbar"><Link href={backHref}>← Back to neighborhood analysis</Link><PrintButton/></div><article className="neighborhood-page print-report"><header className="print-header"><BrandLogo/><p>Neighborhood report · {analysis.current.tax_year} {analysis.current.roll_stage}</p></header><h1>Your neighborhood, in context.</h1><p>{d.subject.address} · Property {id} · {d.subject.living_area?.toLocaleString('en-US')??'Unreported'} sq ft · Class {d.subject.class_code??'not reported'}</p><p>Appraisal District group {d.neighborhood} · {d.homes.length.toLocaleString('en-US')} single-family homes · Subdivision: {d.subdivision??'Not reported'}</p><NeighborhoodAnalysisView data={d} analysis={analysis} season={season} print/><footer className="print-report-footer"><p>Generated {new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'America/Chicago'}).format(new Date())} · Method {NEIGHBORHOOD_METHOD_VERSION}</p><p>Live analysis: <a href={`${SITE_URL}${backHref}`}>{`${SITE_URL}${backHref}`}</a></p></footer></article></main>;
}
