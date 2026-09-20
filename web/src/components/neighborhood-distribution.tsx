'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {distribution} from '@/lib/neighborhood';
import {NeighborhoodDisclosure} from './neighborhood-disclosure';
type Distribution=ReturnType<typeof distribution>;
const money=(n:number|null)=>n===null?'Not available':n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
export function NeighborhoodDistribution({market,area,compareHref,print=false}:{market:Distribution;area:Distribution;compareHref:string;print?:boolean}) {
 const [mode,setMode]=useState<'market'|'area'>('market');
 function chart(d:Distribution,measure:'market'|'area') {
  const unit=measure==='area'?' / sq ft':'';
  const pos=(n:number)=>d.max===d.min?50:Math.max(0,Math.min(100,(n-d.min)/(d.max-d.min)*100));
  const peak=Math.max(1,...d.bins.map(b=>b.count));
  const difference=d.subject!==null&&d.median!==null&&d.median>0?(d.subject/d.median-1)*100:null;
  return <div className="neighborhood-chart" key={measure}>
   <p className="neighborhood-subject-value">Your home: {money(d.subject)}{d.subject!==null?unit:''}{difference!==null&&<> · {difference===0?'At the median':`${Math.abs(difference).toFixed(1)}% ${difference>0?'above':'below'} the median`}</>}</p>
   <p className="neighborhood-note">Neighborhood median: {money(d.median)}{d.median!==null?unit:''} · {d.count} homes</p>
   {d.bins.length?<><div className="neighborhood-histogram" role="img" aria-label={`${measure==='market'?'Market value':'Value per square foot'} distribution of ${d.count} homes. Median ${money(d.median)}${unit}; your home ${money(d.subject)}${unit}. Bars show home counts; the labeled line marks your home.`}>
    <span className="neighborhood-chart-unit">Number of homes · peak {peak}</span>
    <div className="neighborhood-bars">{d.bins.map((b,i)=><div key={i} style={{height:`${b.count/peak*100}%`}} title={`${money(b.low)}–${money(b.high)}${unit}: ${b.count} homes`}/>)}</div>
    {d.subject!==null&&<span className={`neighborhood-marker home-marker${pos(d.subject)>70?' marker-end':''}`} style={{left:`${pos(d.subject)}%`}}><span>Your home{d.subject<d.min||d.subject>d.max?' (outside range)':''}</span></span>}
   </div><div className="neighborhood-chart-range"><span>{money(d.min)}</span><span>{money((d.min+d.max)/2)}</span><span>{money(d.max)}</span></div><p className="neighborhood-note">{measure==='market'?'Market value, including land':'Market value per square foot, including land'}</p></>:<p>No usable values are recorded for this measure.</p>}
   <p>{d.percentile===null?'Your position is not available for this measure.':`Your ${measure==='market'?'value':'value per square foot'} is higher than ${d.percentile.toFixed(1)}% of this group.`} Differences in size, land and property features can explain part of that gap.</p>
   {!print&&<NeighborhoodDisclosure title="View distribution counts"><ul>{d.bins.map((b,i)=><li key={i}>{money(b.low)}–{money(b.high)}{unit}: {b.count} homes</li>)}</ul><p>Equal-width ranges; the final range includes its upper boundary.</p></NeighborhoodDisclosure>}
  </div>;
 }
 return <section className="neighborhood-panel neighborhood-distribution" aria-labelledby="distribution-heading">
  <h2 id="distribution-heading">Where your home sits</h2>
  {!print&&<div className="neighborhood-toggle" role="group" aria-label="Distribution measure"><button type="button" aria-pressed={mode==='market'} onClick={()=>setMode('market')}>Market value</button><button type="button" aria-pressed={mode==='area'} onClick={()=>setMode('area')}>Value per sq. ft.</button></div>}
  <div aria-live={print?undefined:'polite'}>{print?<>{chart(market,'market')}{chart(area,'area')}</>:chart(mode==='market'?market:area,mode)}</div>
  {!print&&<Link href={compareHref}>Find homes like yours →</Link>}
 </section>;
}
