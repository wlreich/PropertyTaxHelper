import {adjustmentReasons,adjustmentSummary,type MarketAdjustment} from '@/lib/market-adjustments';
import './market-adjustment-panel.css';
const money=(n:number|null)=>n===null?'Not available':`${n>0?'+':n<0?'−':''}${Math.abs(n).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})}`;
const multiplier=(n:number)=>`${n.toLocaleString('en-US',{maximumFractionDigits:4})}×`;
export function MarketAdjustmentPanel({data,propertyId,neighborhood=false}:{data:MarketAdjustment|null;propertyId:string;neighborhood?:boolean}) {
  if(!data)return <section className="market-adjustment-panel" id="market-adjustment" aria-labelledby="market-adjustment-heading"><h2 id="market-adjustment-heading" tabIndex={-1}>Neighborhood market adjustment</h2><p>Market-adjustment data is not available for this property right now.</p></section>;
  const s=adjustmentSummary(data),home=data.homes.find(h=>h.property_id===propertyId);
  return <section className="market-adjustment-panel" id="market-adjustment" aria-labelledby="market-adjustment-heading">
    <p className="eyebrow">{data.year} · MARKET AREA {data.neighborhood}</p>
    <h2 id="market-adjustment-heading" tabIndex={-1}>Neighborhood market adjustment</h2>
    <p><strong>Your home’s appraisal depends partly on where it is.</strong></p>
    <p>TCAD starts by estimating what it would cost to rebuild your house, with a reduction for its age and condition. It then uses sales it selects from your neighborhood to adjust that starting estimate to better reflect what buyers are paying.</p>
    <p>That neighborhood adjustment is expressed as a multiplier. For example, if the starting estimate is <strong>$200,000</strong>, a multiplier of <strong>1.50</strong> raises it to <strong>$300,000</strong>. Land is valued separately.</p>
    <p><strong>When the multiplier goes up, your appraisal can increase even if nothing about your home has changed.</strong> ParcelSavvy estimates how much that change alone added to or subtracted from your home’s preliminary appraisal.</p>
    <dl className="market-adjustment-metrics">
      <div><dt>Change in multiplier</dt><dd>{s.previous&&s.current?`${multiplier(s.previous.factor)} → ${multiplier(s.current.factor)}`:'Not available'}</dd><dd className="market-adjustment-note">{s.percent===null?'Both annual schedules are needed.':`${s.percent>0?'+':''}${s.percent.toFixed(1)}% from ${data.year-1} to ${data.year}`}</dd></div>
      {neighborhood&&<div><dt>Median estimated effect across matched homes</dt><dd>{money(s.median)}</dd><dd className="market-adjustment-note">{s.count.toLocaleString()} of {s.total.toLocaleString()} included homes qualify for this estimate.</dd></div>}
      <div><dt>Estimated change caused by the neighborhood adjustment</dt><dd>{money(home?.effect??null)}</dd><dd className="market-adjustment-note">{home?.effect!=null?'Changing only the neighborhood multiplier, with current-year preliminary inputs held fixed.':home?adjustmentReasons[home.status]:'Your home is outside the included population.'}</dd></div>
      {!neighborhood&&<div><dt>Actual preliminary improvement change</dt><dd>{money(home?.actual_change??null)}</dd><dd className="market-adjustment-note">{home?.actual_change!=null?`${data.year-1} preliminary → ${data.year} preliminary`:'Original preliminary improvement values in the same neighborhood are needed for both years. Later snapshots that may include protest changes are excluded.'}</dd></div>}
    </dl>
    <h3>Multiplier history</h3>
    {data.history.length?<div className="market-adjustment-history" role="region" aria-label="Neighborhood multiplier history" tabIndex={0}><table><thead><tr><th scope="col">Year</th><th scope="col">Multiplier</th><th scope="col">District source</th></tr></thead><tbody>{data.history.map(h=><tr key={h.year}><th scope="row">{h.year}</th><td>{multiplier(h.factor)}</td><td><a href={`/data/tcad/${h.filename}#page=${h.page}`}>{h.year} schedule, p. {h.page}</a></td></tr>)}</tbody></table></div>:<p>No schedule has been matched to this exact market-area code.</p>}
    <details><summary>How this estimate works and what is covered</summary>
      <p>We compare the first eligible dated preliminary snapshot for this tax year with the same model using the previous year’s multiplier. All other current-year inputs stay fixed. The estimate is the difference between those two rounded model values. We include a home only when its component values and current multiplier reproduce its recorded preliminary improvement value within $1 and one residential building is verified.</p>
      <p>Matched homes must have a residential improvement in the prior-year records and appear under the same market-area code in both years. Neighborhood codes are matched exactly; renamed areas and boundary changes have not been crosswalked. History starts with the available 2025 and 2026 schedules. A missing year is not treated as an unchanged multiplier.</p>
      {neighborhood&&<><p>The median uses each qualifying home’s individual dollar estimate, including decreases and zero changes. It describes the matched homes shown in the count; it is not a countywide or whole-neighborhood total.</p>{s.excluded.length>0&&<ul>{s.excluded.map(x=><li key={x.reason}>{x.count.toLocaleString()} {x.count===1?'home':'homes'}: {x.label.toLowerCase()}</li>)}</ul>}</>}
      {home?.preliminary_date&&<p>Your preliminary snapshot: {home.preliminary_date}{home.prior_preliminary_date?`; prior preliminary: ${home.prior_preliminary_date}`:''}.</p>}
      <p>This estimates the effect on modeled improvement value. It is not a change in land value, a tax bill, or potential tax savings. Building costs, depreciation, property details and overrides can also change the recorded value. The estimated effect can exceed the net annual increase when other changes offset it.</p>
      <p>Source files: {data.history.map(h=>h.filename).join(", ")||"No exact-code match"}.</p>
      <p>Sources: TCAD annual market-adjustment schedules identified above and the published property snapshots. <a href="/data/tcad/2026_Residential_Valuation_Manual.pdf#page=8">TCAD’s 2026 residential valuation manual, p. 8</a> describes the sales comparison used to set these adjustments; this analysis does not reconstruct the district’s selected sales or prove an appraisal is incorrect.</p>
    </details>
  </section>;
}
