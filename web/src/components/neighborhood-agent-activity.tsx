import type {neighborhoodAnalysis,NeighborhoodAnalysisData} from '@/lib/neighborhood-analysis';
import {dateLabel} from '@/lib/property-history';

type Analysis=ReturnType<typeof neighborhoodAnalysis>;
const count=(value:number)=>value.toLocaleString('en-US');
const money=(value:number|null)=>value===null?'Not available':value.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const percent=(value:number|null)=>value===null?'Not available':`${value.toFixed(1)}%`;

export function NeighborhoodAgentActivity({data,analysis}:{data:NeighborhoodAnalysisData;analysis:Analysis}) {
 const panels=analysis.agentActivity;
 const scale=Math.max(0,...panels.flatMap(panel=>panel.rows.map(row=>row.propertyCount)));
 return <section className="neighborhood-panel neighborhood-agent-activity" aria-labelledby="agent-activity-heading">
  <header><h2 id="agent-activity-heading">Protest agent activity in this market area</h2><p className="neighborhood-agent-context">{data.neighborhood} · {panels.length===2?'Two most recent certified years':panels.length===1?'Most recent certified year':'Completed certified years'}</p><p>Each year shows up to five named agents with the most properties. Smaller groups are combined; homes without an agent name appear separately. Bars show property counts on one shared scale.</p></header>
  {panels.length?<><div className={`neighborhood-agent-panels${panels.length===1?' neighborhood-agent-panels-single':''}`}>
   {panels.map(panel=><article className="neighborhood-agent-panel" key={panel.certified.dataset_id} aria-labelledby={`agent-panel-${panel.certified.tax_year}`}>
    <header><h3 id={`agent-panel-${panel.certified.tax_year}`}>{panel.certified.tax_year} {panel.certified.roll_stage} appraisal</h3><p>{count(panel.activityCount)} homes with identified protest activity · certified values exported {dateLabel(panel.certified.export_date)}</p></header>
    <div className="neighborhood-agent-table" role="table" aria-label={`${panel.certified.tax_year} certified protest agent activity`}>
     <div className="neighborhood-agent-table-head" role="row">
      <span role="columnheader">Agent named in records</span><span role="columnheader">Properties</span><span role="columnheader">Median drop</span><span role="columnheader">Median %</span>
     </div>
     <div role="rowgroup">
      {panel.rows.map(row=><div className={`neighborhood-agent-row neighborhood-agent-row-${row.kind}`} role="row" key={`${row.kind}:${row.label}`}>
       <strong role="rowheader">{row.label}</strong>
       <div className="neighborhood-agent-count" role="cell"><span className="neighborhood-agent-mobile-label">Homes</span><span className="neighborhood-agent-bar" role="img" aria-label={`${count(row.propertyCount)} properties on a shared scale with a maximum of ${count(scale)} properties`}><span style={{width:`${scale?row.propertyCount/scale*100:0}%`}}/></span><strong>{count(row.propertyCount)}</strong></div>
       <div className="neighborhood-agent-result" role="cell"><span className="neighborhood-agent-mobile-label">Median drop</span><strong>{money(row.medianReduction)}</strong></div>
       <div className="neighborhood-agent-result" role="cell"><span className="neighborhood-agent-mobile-label">Median %</span><strong>{percent(row.medianPercent)}</strong><small>{row.reducedCount?`${count(row.reducedCount)} reduced`:'No reduced homes'}</small></div>
      </div>)}
     </div>
    </div>
   </article>)}
  </div><aside className="neighborhood-agent-note" aria-labelledby="agent-note-heading"><h3 id="agent-note-heading">How to read this</h3><p>Agent names come from TCAD records. Median reductions include only properties whose recorded market value fell; they are not a rating of an agent’s effectiveness. “No agent identified” does not establish who handled the protest.</p><p>Activity includes recorded protests and reductions that may indicate a protest. Names use the latest available export for each year.</p></aside></>:<div className="neighborhood-agent-unavailable"><strong>Not available</strong><p>A completed proposed-to-certified pair is needed to show protest agent activity.</p></div>}
 </section>;
}
