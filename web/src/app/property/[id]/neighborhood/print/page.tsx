import Link from 'next/link';
import {notFound} from 'next/navigation';
import {BrandLogo} from '@/components/brand-logo';
import {getNeighborhood} from '@/lib/supabase/neighborhood';
import {neighborhoodSummary} from '@/lib/neighborhood';
import {validPropertyId} from '@/lib/property-comparisons';
import {dateLabel} from '@/lib/property-history';
import {PrintButton} from './print-button';
import './print.css';

export const maxDuration=30;
export const metadata={title:'Printable neighborhood report | ParcelSavvy',robots:{index:false,follow:false}};
const money=(n:number|null)=>n===null?'Not available':n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const pct=(n:number|null)=>n===null?'Not available':`${n.toFixed(1)}%`;
const count=(n:number)=>n.toLocaleString('en-US');
const homes=(n:number)=>`${count(n)} ${n===1?'home':'homes'}`;

function ReportFooter({page}:{page:number}) {
 return <footer><span>parcelsavvy.org</span><span>Independent of Travis Central Appraisal District</span><span>Page {page} of 2</span></footer>;
}
function Position({label,value,percentile}:{label:string;value:string;percentile:number|null}) {
 const position=percentile===null?null:Math.min(100,Math.max(0,percentile));
 return <div className="print-position"><div><h3>{label}</h3><strong>{value}</strong></div>{position===null?<p>Position not available</p>:<><div className="print-position-track" role="img" aria-label={`${label}: ${pct(percentile)} of included homes have a lower value`}><span style={{left:`${position}%`}}/></div><p>{pct(percentile)} of included homes have a lower value.</p></>}</div>;
}

export default async function NeighborhoodPrintPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {id}=await params,search=await searchParams;if(!validPropertyId(id))notFound();
 const result=await getNeighborhood(id,typeof search.release==='string'?search.release:null);
 if(result.status==='missing_property')notFound();
 if(result.status!=='ok')return <main className="print-unavailable"><h1>Neighborhood report unavailable</h1><p>The selected appraisal data snapshot could not be loaded.</p><Link href={`/property/${id}/neighborhood`}>Return to the neighborhood page</Link></main>;
 const d=result.data,s=neighborhoodSummary(d),r=d.releases.find(x=>x.dataset_id===d.source_id)!;
 const pre=d.releases.find(x=>x.dataset_id===d.preliminary_id),cert=d.releases.find(x=>x.dataset_id===d.certified_id),complete=!!pre&&!!cert;
 const subjectPerFoot=d.subject.market_value!==null&&d.subject.living_area?d.subject.market_value/d.subject.living_area:null;
 const subjectAuthorities=s.entities.filter(e=>e.applies);
 const backHref=`/property/${id}/neighborhood?release=${d.source_id}`;
 return <main className="neighborhood-print-preview">
  <div className="print-toolbar"><Link href={backHref}>← Back to neighborhood analysis</Link><PrintButton/></div>
  <article className="print-sheet print-page-one">
   <header className="print-header"><BrandLogo/><div><span>Neighborhood report</span><strong>{r.tax_year} {r.roll_stage}</strong></div></header>
   <section className="print-hero"><p className="print-eyebrow">APPRAISAL DISTRICT PROPERTY {id}</p><h1>{d.subject.address}</h1><p>{d.subject.city} · {d.subject.living_area?.toLocaleString('en-US')??'Unreported'} sq. ft. · Built {d.subject.year_built??'not reported'} · Class {d.subject.class_code??'not reported'}</p></section>
   <section className="print-context" aria-label="Neighborhood identity"><div><span>Subdivision on record</span><strong>{d.subdivision??'Not reported'}</strong></div><div><span>Appraisal District market area</span><strong>{d.neighborhood}</strong></div><div><span>Appraisal data snapshot</span><strong>{r.tax_year} {r.roll_stage} · {dateLabel(r.export_date)}</strong></div></section>
   <section aria-labelledby="snapshot-heading"><div className="print-section-heading"><div><p>Neighborhood at a glance</p><h2 id="snapshot-heading">Appraisal data snapshot</h2></div><span>{homes(s.all.count)} included</span></div>
    <dl className="print-metrics"><div><dt>Median market value</dt><dd>{money(s.median)}</dd></div><div><dt>Your reported market value</dt><dd>{money(d.subject.market_value)}</dd></div><div><dt>Your home vs. median</dt><dd>{s.difference===null?'Not available':s.difference===0?'At the median':`${money(Math.abs(s.difference))} ${s.difference>0?'above':'below'}`}</dd></div><div><dt>Median value per sq. ft.</dt><dd>{money(s.medianPerFoot)}</dd></div></dl>
   </section>
   <section className="print-placement" aria-labelledby="placement-heading"><div className="print-section-heading"><div><p>Your position</p><h2 id="placement-heading">Where this home fits</h2></div></div><Position label="Market value" value={money(d.subject.market_value)} percentile={s.marketDistribution.percentile}/><Position label="Market value per sq. ft." value={money(subjectPerFoot)} percentile={s.areaDistribution.percentile}/><p className="print-note">Position shows the share of included homes with a strictly lower value. It does not by itself establish whether an appraisal is correct.</p></section>
   <section className="print-authorities" aria-labelledby="authorities-heading"><h2 id="authorities-heading">Taxing authorities recorded for this property</h2><p>{subjectAuthorities.length?subjectAuthorities.map(e=>e.name).join(' · '):'No taxing authorities are reported in this snapshot.'}</p></section>
   <ReportFooter page={1}/>
  </article>
  <article className="print-sheet print-page-two">
   <header className="print-header"><BrandLogo/><div><span>Neighborhood report</span><strong>{d.neighborhood}</strong></div></header>
   <section aria-labelledby="outcomes-heading"><div className="print-section-heading"><div><p>Before and after</p><h1 id="outcomes-heading">From preliminary values to {complete?'certified results':'available records'}</h1></div><span>{r.tax_year}</span></div>
    <div className="print-cap-definition"><h2>What does “the cap” mean?</h2><p>For an eligible homestead, the appraisal cap generally limits the appraised value to last year’s appraised value plus 10%, plus the value of qualifying new improvements. These results use the capped amount recorded in the preliminary Appraisal District data.</p></div>
    <div className="print-outcomes"><div><h2>Started above their recorded cap</h2><strong>{pre?homes(s.all.above.count):'Not available'}</strong><b>{pre?pct(s.all.shares.above.percent):'—'}</b><p>of {homes(s.all.count)}</p></div><div><h2>Values reduced from preliminary</h2><strong>{complete?homes(s.all.reduced.count):'Not available'}</strong><b>{complete?pct(s.all.shares.reduced.percent):'—'}</b><p>of {homes(s.all.count)}</p></div><div className="print-outcome-highlight"><h2>Reduced below their recorded cap</h2><strong>{complete?homes(s.all.crossed.count):'Not available'}</strong><b>{complete?pct(s.all.shares.crossed.percent):'—'}</b><p>of {homes(s.all.count)}</p></div></div>
   </section>
   {s.own&&<section className="print-own"><p>Your home</p><h2>{money(s.own.dollars)} below its preliminary capped amount</h2><p>From {money(s.own.threshold)} capped to {money(s.own.final)} certified. This is an appraisal result before exemptions, not tax-dollar savings.</p></section>}
   {complete&&s.all.crossed.total>0&&<section className="print-insight"><h2>What this means</h2><p><strong>{homes(s.all.crossed.count)}</strong> were reduced from above their recorded cap to below it—<strong>{pct(s.all.crossed.percent)}</strong> of the {homes(s.all.crossed.total)} where this comparison could be made. For those homes, the reduction lowered the value used before exemptions below the cap that was already limiting it.</p></section>}
   <section className="print-protest" aria-labelledby="protest-heading"><div className="print-section-heading"><div><p>Available public records</p><h2 id="protest-heading">Protest activity and reductions</h2></div></div><dl><div><dt>Homes with protest activity identified</dt><dd>{count(s.protested.count)} of {count(s.all.count)} · {pct(s.participation)}</dd></div><div><dt>Homes with reductions</dt><dd>{count(s.all.reduced.count)} · {pct(s.all.shares.reduced.percent)}</dd></div><div><dt>Average reduction among reduced homes</dt><dd>{complete?`${money(s.all.averageReduction)} · ${pct(s.all.averagePercent)}`:'Not available'}</dd></div></dl></section>
   <section className="print-about" aria-labelledby="about-heading"><h2 id="about-heading">About this analysis</h2><p>Source: Travis Central Appraisal District, {r.tax_year} {r.roll_stage} release dated {dateLabel(r.export_date)}. This analysis includes {count(s.all.count)} properties classified as single-family residential in Appraisal District market area {d.neighborhood} with usable building and market-value data. Market-area boundaries may differ from subdivision boundaries. Market values include land.</p><p>Cap comparisons appear only where public records identify an applicable homestead cap and support a preliminary-to-certified comparison. Eligibility changes and qualifying new improvements can affect the cap. Protest activity reflects the combined public records available for the tax year and may be incomplete. These are appraisal outcomes before exemptions, not estimates of tax savings.</p></section>
   <ReportFooter page={2}/>
  </article>
 </main>;
}
