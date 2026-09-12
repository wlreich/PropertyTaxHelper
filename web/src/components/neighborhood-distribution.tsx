'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {distribution} from '@/lib/neighborhood';
type Distribution=ReturnType<typeof distribution>;
const money=(n:number|null)=>n===null?'Not available':n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
export function NeighborhoodDistribution({market,area,compareHref}:{market:Distribution;area:Distribution;compareHref:string}) {
 const [mode,setMode]=useState<'market'|'area'>('market');const d=mode==='market'?market:area;
 const pos=(n:number)=>(d.max===d.min?50:Math.max(0,Math.min(100,(n-d.min)/(d.max-d.min)*100)));
 const peak=Math.max(1,...d.bins.map(b=>b.count));
 return <section className="neighborhood-panel" aria-labelledby="distribution-heading">
  <div className="neighborhood-section-heading"><h2 id="distribution-heading">Where your home fits</h2><div className="neighborhood-toggle" role="group" aria-label="Distribution measure">
   <button type="button" aria-pressed={mode==='market'} onClick={()=>setMode('market')}>Market value</button><button type="button" aria-pressed={mode==='area'} onClick={()=>setMode('area')}>Value per sq. ft.</button>
  </div></div>
  <div className="neighborhood-distribution-layout"><div>
   <div className="neighborhood-chart-labels" aria-live="polite"><span className="median-label">Neighborhood median <strong>{money(d.median)}</strong></span><span className="home-label">Your home <strong>{money(d.subject)}</strong></span></div>
   {d.bins.length?<><div className="neighborhood-histogram" role="img" aria-label={`${mode==='market'?'Market value':'Value per square foot'} distribution of ${d.count} homes. Median ${money(d.median)}; your home ${money(d.subject)}.`}>
    <div className="neighborhood-bars">{d.bins.map((b,i)=><div key={i} style={{height:`${b.count/peak*100}%`}} title={`${money(b.low)}–${money(b.high)}: ${b.count} homes`}/>)}</div>
    {d.median!==null&&<span className="neighborhood-marker median-marker" style={{left:`${pos(d.median)}%`}}/>}
    {d.subject!==null&&<span className="neighborhood-marker home-marker" style={{left:`${pos(d.subject)}%`}}/>}
   </div><div className="neighborhood-chart-range"><span>{money(d.min)}</span><span>{money(d.max)}</span></div></>:<p>No usable values are recorded for this measure.</p>}
   <details className="neighborhood-chart-data"><summary>View distribution counts</summary><ul>{d.bins.map((b,i)=><li key={i}>{money(b.low)}–{money(b.high)}: {b.count} homes</li>)}</ul><p>Equal-width value ranges; the final range includes its upper boundary.</p></details>
  </div><aside className="neighborhood-position"><p aria-live="polite"><strong>{d.percentile===null?'Your position is not available for this measure.':`Your home’s ${mode==='market'?'value':'value per sq. ft.'} is higher than ${d.percentile.toFixed(1)}% of neighborhood homes.`}</strong></p><p>Home size and features affect this position. Being above the median alone does not establish overassessment.</p><Link className="neighborhood-secondary-link" href={compareHref}>Compare similar properties</Link></aside></div>
 </section>;
}
