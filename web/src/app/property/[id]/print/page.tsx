import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getPropertyOverview} from '@/lib/supabase/properties';
import {getMarketAdjustment} from '@/lib/supabase/market-adjustments';
import {getNeighborhoodAnalysis} from '@/lib/supabase/neighborhood-analysis';
import {getSeasonCalendar} from '@/lib/supabase/admin';
import {activeSeason} from '@/lib/seasons';
import {validPropertyId} from '@/lib/property-comparisons';
import {buildPropertyReport,reportNeighborhood} from '@/lib/property-report';
import {PropertyReportView} from '@/components/property-report-view';
import {PropertyPrintControls} from './print-controls';
import './print.css';
export const maxDuration=60;
export const metadata={title:'Your Home & Assessment Report | ParcelSavvy',robots:{index:false,follow:false}};
export default async function PropertyPrintPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params,search=await searchParams;
  if(!validPropertyId(id))notFound();
  const [overview,adjustment,calendar]=await Promise.all([getPropertyOverview(id),getMarketAdjustment(id),getSeasonCalendar()]);
  if(overview.property.status==='not_found'||overview.property.status==='invalid')notFound();
  const backParams=new URLSearchParams();
  for(const key of ['q','page','all'])if(typeof search[key]==='string')backParams.set(key,search[key]);
  const back=`/property/${id}${backParams.size ? `?${backParams}` : ''}`;
  if(overview.property.status!=='ok')return <main id="main-content" className="property-print-unavailable"><h1>Property report unavailable</h1><p>The property record could not be loaded. Please try again.</p><Link href={back}>Return to property overview</Link></main>;
  const group=await getNeighborhoodAnalysis(id,calendar ? activeSeason(calendar) : null);
  const report=buildPropertyReport({...overview,property:overview.property.data,adjustment,neighborhood:group.status==='ok' ? reportNeighborhood(group.data) : null,release:typeof search.release==='string' ? search.release : undefined,reportDate:new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'})});
  if(!report)return <main id="main-content" className="property-print-unavailable"><h1>Requested assessment unavailable</h1><p>The selected release is no longer available for this property. Return to the overview to choose the current report.</p><Link href={back}>Return to property overview</Link></main>;
  return <main id="main-content" className="property-print-preview"><div className="property-print-toolbar"><Link href={back}>← Return to property overview</Link><PropertyPrintControls/></div><PropertyReportView report={report}/></main>;
}
