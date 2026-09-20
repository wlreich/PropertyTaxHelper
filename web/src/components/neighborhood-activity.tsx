'use client';
import Link from 'next/link';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {dateLabel} from '@/lib/property-history';
import {activityKey,activityStatus,activityPrice,activityRows,activityCsv,activityTypes,type ActivityData,type ActivityFilter} from '@/lib/property-activity';

export function NeighborhoodActivity({data,propertyId}:{data:ActivityData|null;propertyId:string}){
 const router=useRouter(),[type,setType]=useState<ActivityFilter>('all'),[sort,setSort]=useState('newest');
 const [expanded,setExpanded]=useState(false),[selected,setSelected]=useState<Set<string>>(new Set());
 const [pending,startTransition]=useTransition(),[notice,setNotice]=useState('');
 if(!data)return <section id="recent-activity" className="neighborhood-panel neighborhood-activity" aria-labelledby="activity-heading"><h2 id="activity-heading">Recent sales &amp; ownership changes</h2><p>Property activity is not available for this view. This does not mean no properties sold.</p><Link href={'/property/'+propertyId+'/neighborhood#recent-activity'}>Try the latest available activity</Link></section>;
 const rows=activityRows(data,type,sort),shown=expanded?rows:rows.slice(0,5),propertyCount=new Set(rows.map(r=>r.property_id)).size;
 const visibleKeys=new Set(rows.map(activityKey));
 const chosen=data.rows.filter(r=>selected.has(activityKey(r))),selectedProperties=new Set(chosen.map(r=>r.property_id)).size;
 function toggle(key:string){setSelected(old=>{const next=new Set(old);if(next.has(key))next.delete(key);else next.add(key);return next;});setNotice('');}
 function download(){
  if(!data||!chosen.length)return;
  const url=URL.createObjectURL(new Blob([activityCsv(data,selected)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='ParcelSavvy-'+data.neighborhood.replace(/[^a-z0-9_-]/gi,'')+'-'+data.year+'-realtor-shortlist.csv';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Shortlist downloaded as CSV. Share it with a realtor to verify the transactions.');
 }
 return <section id="recent-activity" className="neighborhood-panel neighborhood-activity" aria-labelledby="activity-heading" aria-busy={pending}>
  <h2 id="activity-heading">Recent sales &amp; ownership changes</h2>
  <p className="activity-count">{propertyCount.toLocaleString('en-US')} {propertyCount===1?'property':'properties'} with {data.year} recorded activity in {data.neighborhood} · {activityTypes[type]}</p>
  <p className="neighborhood-note">Find properties to ask a realtor about. A deed change can be a sale or another kind of transfer.<br/>{rows.every(r=>r.price===null)?'Individual sale prices are not reported for these candidates; ask a realtor to confirm the transaction and price.':'Available prices are reported by TCAD. Ask a realtor to verify the sale, price, and circumstances.'}</p>
  <div className="activity-controls">
   <label><span className="sr-only">Activity year</span><select aria-label="Activity year" value={data.year} disabled={pending} onChange={e=>startTransition(()=>router.replace('/property/'+propertyId+'/neighborhood?activityYear='+e.target.value+'#recent-activity',{scroll:false}))}>{data.years.map(y=><option key={y} value={y}>Year: {y}</option>)}</select></label>
   <label><span className="sr-only">Property type</span><select aria-label="Property type" value={type} disabled={pending} onChange={e=>{setType(e.target.value as ActivityFilter);setExpanded(false);}}>{Object.entries(activityTypes).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
   <label><span className="sr-only">Sort activity</span><select aria-label="Sort activity" value={sort} disabled={pending} onChange={e=>setSort(e.target.value)}><option value="newest">Newest activity first</option><option value="oldest">Oldest activity first</option><option value="address">Address</option></select></label>
  </div>
  <p className="sr-only" role="status">{pending?'Loading property activity…':propertyCount+' properties; '+rows.length+' transaction records.'}</p>
  {rows.length?<table className="activity-table" aria-label="Recent property activity"><thead><tr><th scope="col">Property / select for shortlist</th><th scope="col">Deed / sale date</th><th scope="col">What the record tells us</th><th scope="col">Sale price</th></tr></thead>
   <tbody>{shown.map(r=><tr key={activityKey(r)} className={selected.has(activityKey(r))?'activity-selected':''}>
    <th scope="row"><div className="activity-property"><label className="activity-check"><input type="checkbox" checked={selected.has(activityKey(r))} onChange={()=>toggle(activityKey(r))} aria-label={'Select '+r.address+', '+dateLabel(r.activity_date)}/></label><div><Link href={'/property/'+r.property_id}>{r.address||'Property '+r.property_id}</Link><span>Property {r.property_id}</span></div></div></th>
    <td><span>{r.deed_date?'Deed':'Sale'}: </span>{dateLabel(r.activity_date)}{r.sale_date&&r.deed_date&&r.sale_date!==r.deed_date&&<small>Sale: {dateLabel(r.sale_date)}</small>}</td>
    <td><span className="activity-status">{activityStatus(r)}</span></td>
    <td><span className="activity-mobile-label">Sale price: </span>{activityPrice(r)}{r.price!==null&&<small>TCAD-reported</small>}{r.price_status==='multi_property'&&<small>Multi-property sale</small>}</td>
   </tr>)}</tbody></table>:<div className="activity-empty"><p>No matching activity appears in these records. Coverage is incomplete.</p>{type!=='all'&&<button className="activity-link" onClick={()=>setType('all')}>Show all property types</button>}</div>}
  <div className="activity-shortlist"><div><p role="status">{selectedProperties} {selectedProperties===1?'property':'properties'} selected{chosen.length!==selectedProperties?' · '+chosen.length+' records':''}</p><p>Ask a realtor to confirm the sale and price.</p>{chosen.some(r=>!visibleKeys.has(activityKey(r)))&&<p>Includes selections outside this filter.</p>}</div>
   <button className="action-button" disabled={!chosen.length||pending} onClick={download}>Download realtor shortlist</button>
   <button className="activity-link" disabled={!chosen.length} onClick={()=>{setSelected(new Set());setNotice('Selection cleared.');}}>Clear selection</button>
  </div>
  {notice&&<p className="neighborhood-note" role="status">{notice}</p>}
  <div className="activity-pagination"><p>Showing {shown.length} of {rows.length} transaction records</p>{rows.length>5&&<button className="activity-link" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Show first five':'View all '+rows.length+' →'}</button>}</div>
  <p className="activity-source">TCAD appraisal export: {dateLabel(data.sources.appraisal_export_date)}. Supplemental deed and sale records: {dateLabel(data.sources.sales_export_date)}.<br/>Covers available records, not every sale. Nearby properties are not automatically comparable.</p>
 </section>;
}
