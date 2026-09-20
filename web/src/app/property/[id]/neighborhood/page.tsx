import Link from 'next/link';
import {notFound} from 'next/navigation';
import {SiteHeader,SiteFooter} from '@/components/site-shell';
import {PropertyNavigation} from '@/components/property-navigation';
import {NeighborhoodAnalysisView} from '@/components/neighborhood-analysis-view';
import {NeighborhoodDisclosure} from '@/components/neighborhood-disclosure';
import {getNeighborhoodAnalysis} from '@/lib/supabase/neighborhood-analysis';
import {getSeasonCalendar} from '@/lib/supabase/admin';
import {activeSeason} from '@/lib/seasons';
import {validPropertyId} from '@/lib/property-comparisons';
import '../property-overview.css';
import './neighborhood.css';
export const maxDuration=30;
export const metadata={title:'Your neighborhood | ParcelSavvy'};
export default async function NeighborhoodPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!validPropertyId(id))notFound();
 const calendar=await getSeasonCalendar(),season=calendar?activeSeason(calendar):null;
 const result=await getNeighborhoodAnalysis(id,season);
 if(result.status==='missing_property')notFound();
 if(result.status!=='ok')return <><SiteHeader/><main id="main-content" className="main-shell profile-shell"><h1>Your neighborhood</h1><PropertyNavigation propertyId={id} active="neighborhood"/><div className="notice"><h2>{result.status==='missing_area'?'No market area is recorded for this property':result.status==='missing_snapshot'?'Neighborhood records are not available yet':'Neighborhood data is temporarily unavailable'}</h2><p>Open the property overview or try again later.</p><Link href={`/property/${id}`}>Property overview</Link></div></main><SiteFooter/></>;
 const {data:d,analysis}=result;
 return <><SiteHeader/><main id="main-content" className="main-shell profile-shell neighborhood-page"><p className="neighborhood-context"><Link href={`/property/${id}`}>← Property overview</Link> / {d.subject.address} · {d.subject.living_area?.toLocaleString('en-US')??'Unreported'} sq ft · Class {d.subject.class_code??'not reported'}</p><PropertyNavigation propertyId={id} active="neighborhood"/><div className="neighborhood-title"><h1>Your neighborhood, in context.</h1><Link className="action-button neighborhood-print-link" href={`/property/${id}/neighborhood/print`}>Print / save PDF</Link></div><div className="neighborhood-group"><p>Appraisal District group <strong>{d.neighborhood}</strong> · {d.homes.length.toLocaleString('en-US')} single-family homes</p><NeighborhoodDisclosure title="About this group"><p>The Appraisal District grouping may differ from the named subdivision. Subdivision on record: {d.subdivision??'Not reported'}. The analysis includes homes with usable residential building and market-value records.</p></NeighborhoodDisclosure></div><NeighborhoodAnalysisView data={d} analysis={analysis} season={season}/></main><SiteFooter/></>;
}
