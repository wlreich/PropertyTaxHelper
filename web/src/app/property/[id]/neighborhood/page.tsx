import Link from 'next/link';
import {snapshotLabel,dateLabel} from '@/lib/property-history';
import {getActivityMatches} from '@/lib/supabase/activity-matches';
import {readEvidenceWindow,evidenceParams,type EvidenceQuery} from '@/lib/evidence-window';
import {NeighborhoodPrintLink} from '@/components/neighborhood-print-link';
import '@/styles/evidence-window.css';
import {NeighborhoodActivity} from '@/components/neighborhood-activity';
import {getWindowActivity} from '@/lib/supabase/property-activity';
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
// Calendar, analysis and the two bounded activity phases each allow 15 seconds.
export const maxDuration=90;
export const metadata={title:'Your neighborhood | ParcelSavvy'};
export default async function NeighborhoodPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<EvidenceQuery>}) {
 const {id}=await params;if(!validPropertyId(id))notFound();
 const calendar=await getSeasonCalendar(),season=calendar?activeSeason(calendar):null;
 const query=await searchParams;
 const result=await getNeighborhoodAnalysis(id,season);
 const defaultYear=season?season.config.tax_year+(season.phase==='post'?1:0):result.status==='ok'?result.analysis.current.tax_year:new Date().getUTCFullYear();
 const {window,error}=readEvidenceWindow(query,defaultYear);
 if(result.status==='missing_property')notFound();
 if(result.status!=='ok')return <><SiteHeader/><main id="main-content" className="main-shell profile-shell"><h1>Your neighborhood</h1><PropertyNavigation propertyId={id} active="neighborhood" evidenceQuery={error?'':evidenceParams(window).toString()}/><div className="notice"><h2>{result.status==='missing_area'?'No market area is recorded for this property':result.status==='missing_snapshot'?'Neighborhood records are not available yet':'Neighborhood data is temporarily unavailable'}</h2><p>Open the property overview or try again later.</p><Link href={`/property/${id}`}>Property overview</Link></div></main><SiteFooter/></>;
 const activity=error?null:await getWindowActivity(id,window);
 const {data:d,analysis}=result;
 const matches=activity?.rows.length?await getActivityMatches(id,analysis.current.dataset_id,analysis.current.tax_year,activity.rows.map(r=>r.property_id)):null;
 return <><SiteHeader/><main id="main-content" className="main-shell profile-shell neighborhood-page"><p className="neighborhood-context"><Link href={`/property/${id}`}>← Property overview</Link> / {d.subject.address} · {d.subject.living_area?.toLocaleString('en-US')??'Unreported'} sq ft · Class {d.subject.class_code??'not reported'}</p><PropertyNavigation propertyId={id} active="neighborhood" evidenceQuery={error?'':evidenceParams(window).toString()}/><div className="neighborhood-title"><h1>Your neighborhood, in context.</h1><NeighborhoodPrintLink propertyId={id} evidenceQuery={error?'':evidenceParams(window).toString()}/></div><div className="neighborhood-group"><p>Appraisal District group <strong>{d.neighborhood}</strong> · {d.homes.length.toLocaleString('en-US')} single-family homes</p><NeighborhoodDisclosure title="About this group"><p>The Appraisal District grouping may differ from the named subdivision. Subdivision on record: {d.subdivision??'Not reported'}. The analysis includes homes with usable residential building and market-value records.</p></NeighborhoodDisclosure></div><NeighborhoodAnalysisView data={d} analysis={analysis} season={season} activity={<NeighborhoodActivity key={JSON.stringify([id,analysis.current.dataset_id,window])} matches={matches} releaseLabel={`${snapshotLabel(analysis.current)} appraisal release · ${dateLabel(analysis.current.export_date)}`} sourceId={analysis.current.dataset_id} data={activity} propertyId={id} window={window} error={error}/>}/></main><SiteFooter/></>;
}
