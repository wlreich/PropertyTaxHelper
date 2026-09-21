import {activityKey,activityRows,activityTypes,activityStatus,activityPrice,type ActivityFilter} from '@/lib/property-activity';
import {activitySelection,evidenceCoverage,type WindowActivity,type EvidenceWindow,type EvidenceQuery} from '@/lib/evidence-window';
export function ActivityShortlistPrint({data,window,query}:{data:WindowActivity|null;window:EvidenceWindow;query:EvidenceQuery}){
 const selected=activitySelection(query.activitySelected),type=typeof query.activityType==='string'&&Object.hasOwn(activityTypes,query.activityType)?query.activityType as ActivityFilter:'all';
 const sort=typeof query.activitySort==='string'&&['newest','oldest','address'].includes(query.activitySort)?query.activitySort:'newest';
 const chosen=data?activityRows(data,'all',sort).filter(r=>selected.has(activityKey(r))):[];
 return <section className="neighborhood-panel activity-print" aria-labelledby="shortlist-heading"><h2 id="shortlist-heading">Evidence research &amp; selected shortlist</h2>
 <p>Preparing for {window.targetYear} · Evidence window: {window.start}–{window.end}</p>
 <p>Filter: {activityTypes[type]} · Sort: {sort}. Selected records outside the property-type filter are retained.</p>
 <p>{data?evidenceCoverage(data):'Activity coverage is unavailable'}. Coverage is incomplete; a transfer is not proof of a sale.</p>
 {chosen.length?<table><colgroup><col style={{width:'40%'}}/><col style={{width:'28%'}}/><col style={{width:'32%'}}/></colgroup><thead><tr><th scope="col">Property</th><th scope="col">Transaction dates</th><th scope="col">Record / price</th></tr></thead><tbody>{chosen.map(r=><tr key={activityKey(r)}><th scope="row">{r.address}<br/>Property {r.property_id}</th><td>Deed: {r.deed_date??'Not reported'}<br/>Sale: {r.sale_date??'Not reported'}</td><td>{activityStatus(r)}<br/>Sale price: {activityPrice(r)}</td></tr>)}</tbody></table>:<p>No available records selected for this window. This does not mean no properties sold.</p>}
 {selected.size>chosen.length&&<p>Some saved selections are outside this window or unavailable; they are not included in this shortlist.</p>}
 <p>Export dates are not transaction dates. Ask a realtor to confirm the transaction, sale date and price, concessions, condition, and comparability. Listing dates are not available in these records.</p>
 </section>;
}
