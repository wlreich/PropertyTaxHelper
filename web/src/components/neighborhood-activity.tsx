'use client';
import Link from 'next/link';
import {comparisonMatch,comparisonMethod,matchingQualification,unavailableComparison} from '@/lib/property-comparisons';
import type {ActivityMatches} from '@/lib/supabase/activity-matches';
import '@/styles/comparison-match.css';
import {useState,useTransition} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {EvidenceWindowControls} from './evidence-window-controls';
import {evidenceParams,evidenceCoverage,activitySelection,type WindowActivity,type EvidenceWindow} from '@/lib/evidence-window';
import {dateLabel} from '@/lib/property-history';
import {activityKey,activityStatus,activityPrice,activityRows,activityWindowCsv,activityTypes,type ActivityFilter} from '@/lib/property-activity';

export function NeighborhoodActivity({data,propertyId,window,error,matches=null,sourceId,releaseLabel}:{data:WindowActivity|null;propertyId:string;window:EvidenceWindow;error?:string|null;matches?:ActivityMatches|null;sourceId?:string;releaseLabel?:string}){
 const query=useSearchParams(),router=useRouter();
 const [type,setType]=useState<ActivityFilter>(Object.hasOwn(activityTypes,query.get('activityType')??'all')?query.get('activityType') as ActivityFilter??'all':'all'),[sort,setSort]=useState(['newest','oldest','address',...(propertyId?['closest']:[])].includes(query.get('activitySort')??'')?query.get('activitySort')!:'newest');
 const [expanded,setExpanded]=useState(false),[selected,setSelected]=useState<Set<string>>(activitySelection(query.get('activitySelected')));
 const [pending,transition]=useTransition(),[notice,setNotice]=useState('');
 function remember(nextType=type,nextSort=sort,nextSelected=selected){const params=new URLSearchParams(query.toString());for(const [key,value] of evidenceParams(window))params.set(key,value);params.set('activityType',nextType);params.set('activitySort',nextSort);params.set('activitySelected',JSON.stringify([...nextSelected]));globalThis.history.replaceState(null,'',`?${params}#recent-activity`);}
 const controls=<EvidenceWindowControls key={JSON.stringify(window)} window={window} error={error} busy={pending} onNavigate={url=>transition(()=>router.push(url,{scroll:false}))}/>;
 if(!data||error)return <section id="recent-activity" className="neighborhood-panel neighborhood-activity" aria-labelledby="activity-heading"><h2 id="activity-heading">Recent sales &amp; ownership changes</h2>{controls}<p>Property activity is not available for this view. This does not mean no properties sold.</p><Link href={'/property/'+propertyId+'/neighborhood#recent-activity'}>Try the latest available activity</Link></section>;
 const currentMatches=matches?.subjectId===propertyId&&matches.sourceId===sourceId?matches:null;
 const matchItems=currentMatches?.items??{};
 const rows=activityRows(data,type,sort,matchItems),shown=expanded?rows:rows.slice(0,5),propertyCount=new Set(rows.map(r=>r.property_id)).size;
 const visibleKeys=new Set(rows.map(activityKey));
 const chosen=data.rows.filter(r=>selected.has(activityKey(r))),selectedProperties=new Set(chosen.map(r=>r.property_id)).size;
 function toggle(key:string){const next=new Set(selected);if(next.has(key))next.delete(key);else if(next.size<100)next.add(key);else {setNotice('Select up to 100 transaction records for one shortlist.');return;}setSelected(next);remember(type,sort,next);setNotice('');}
 function download(){
  if(!data||!chosen.length)return;
  const url=URL.createObjectURL(new Blob([activityWindowCsv(data,selected,type,sort,matchItems)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='ParcelSavvy-'+(data.neighborhood??'activity').replace(/[^a-z0-9_-]/gi,'')+'-'+window.targetYear+'-realtor-shortlist.csv';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Shortlist downloaded as CSV. Share it with a realtor to verify the transactions.');
 }
 return <section id="recent-activity" className="neighborhood-panel neighborhood-activity" aria-labelledby="activity-heading" aria-busy={pending}>
  <h2 id="activity-heading">Recent sales &amp; ownership changes</h2>
  {controls}
  <p id="activity-coverage-note" className="activity-coverage">{evidenceCoverage(data)}. Coverage is incomplete; export dates are not transaction dates.</p>
  {(data.missingYears.length>0||data.failedYears.length>0)&&<p>Unavailable years do not mean no properties sold.</p>}
  <p className="activity-count" aria-describedby="activity-coverage-note activity-record-note">{propertyCount.toLocaleString('en-US')} {propertyCount===1?'property':'properties'} with recorded activity in this window · {data.neighborhood??'Neighborhood'} · {activityTypes[type]}</p>
  <p id="activity-record-note" className="neighborhood-note">Includes records with a deed or sale date in the window; their other dates may fall outside it. Find properties to ask a realtor about. A deed change can be a sale or another kind of transfer.<br/>{rows.every(r=>r.price===null)?'Individual sale prices are not reported for these candidates; ask a realtor to confirm the transaction and price.':'Available prices are reported by Appraisal District. Ask a realtor to verify the sale, price, and circumstances.'}</p>
  {propertyId?<p className="neighborhood-note">Similarity uses your home’s {releaseLabel??'selected appraisal release'}, separately from the research dates. Tiers describe size, age, class and market-area similarities; they are not verified full Appraisal District scores.</p>:<p>Select a property to compare.</p>}
  {currentMatches&&currentMatches.year!==comparisonMethod.year&&<p className="neighborhood-note">{matchingQualification(currentMatches.year)}</p>}
  <div className="activity-controls">

   <label><span className="sr-only">Property type</span><select aria-label="Property type" value={type} disabled={pending} onChange={e=>{setType(e.target.value as ActivityFilter);remember(e.target.value as ActivityFilter);setExpanded(false);}}>{Object.entries(activityTypes).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
   <label><span className="sr-only">Sort activity</span><select aria-label="Sort activity" value={sort} disabled={pending} onChange={e=>{setSort(e.target.value);remember(type,e.target.value);}}><option value="newest">Newest activity first</option><option value="oldest">Oldest activity first</option><option value="address">Address</option>{propertyId&&<option value="closest">Closest match to your home</option>}</select></label>
  </div>
  <p className="sr-only" role="status">{pending?'Loading property activity…':propertyCount+' properties; '+rows.length+' transaction records.'}</p>
  {rows.length?<table className="activity-table" aria-label="Recent property activity"><thead><tr><th scope="col">Property / select for shortlist</th><th scope="col">Deed / sale date</th><th scope="col">What the record tells us</th><th scope="col">Sale price</th></tr></thead>
   <tbody>{shown.map(r=><tr key={activityKey(r)} className={selected.has(activityKey(r))?'activity-selected':''}>
    <th scope="row"><div className="activity-property"><label className="activity-check"><input type="checkbox" disabled={pending} checked={selected.has(activityKey(r))} onChange={()=>toggle(activityKey(r))} aria-label={'Select '+r.address+', '+dateLabel(r.activity_date)}/></label><div><Link href={'/property/'+r.property_id}>{r.address||'Property '+r.property_id}</Link><span>Property {r.property_id}</span><div className="activity-match" aria-label="Property similarity"><span className="comparison-tier">{(propertyId?matchItems[r.property_id]??unavailableComparison:comparisonMatch(null,null)).label}</span><span className="comparison-small">{(propertyId?matchItems[r.property_id]??unavailableComparison:comparisonMatch(null,null)).description}</span></div></div></div></th>
    <td><span>{r.deed_date?'Deed':'Sale'}: </span>{dateLabel(r.activity_date)}{r.sale_date&&r.deed_date&&r.sale_date!==r.deed_date&&<small>Sale: {dateLabel(r.sale_date)}</small>}</td>
    <td><span className="activity-status">{activityStatus(r)}</span></td>
    <td><span className="activity-mobile-label">Sale price: </span>{activityPrice(r)}{r.price!==null&&<small>Appraisal District-reported</small>}{r.price_status==='multi_property'&&<small>Multi-property sale</small>}</td>
   </tr>)}</tbody></table>:<div className="activity-empty"><p>No matching activity appears in these records. Coverage is incomplete.</p>{type!=='all'&&<button className="activity-link" onClick={()=>{setType('all');remember('all');}}>Show all property types</button>}</div>}
  <div className="activity-shortlist"><div><p role="status">{selectedProperties} {selectedProperties===1?'property':'properties'} selected{chosen.length!==selectedProperties?' · '+chosen.length+' records':''}</p><p>Ask a realtor to confirm the sale and price.</p>{chosen.some(r=>!visibleKeys.has(activityKey(r)))&&<p>Includes selections outside this filter.</p>}</div>
   <button className="action-button" disabled={!chosen.length||pending} onClick={download}>Download realtor shortlist</button>
   <button className="activity-link" disabled={!selected.size||pending} onClick={()=>{setSelected(new Set());remember(type,sort,new Set());setNotice('Selection cleared.');}}>Clear selection</button>
  </div>
  {selected.size>chosen.length&&<p role="status">Some saved selections are outside this window or unavailable and are excluded from this export.</p>}
  <Link href={`/property/${propertyId}/compare?${evidenceParams(window)}`}>Compare properties using this evidence window</Link>
  {notice&&<p className="neighborhood-note" role="status">{notice}</p>}
  <div className="activity-pagination"><p>Showing {shown.length} of {rows.length} transaction records</p>{rows.length>5&&<button className="activity-link" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Show first five'+(sort==='closest'?' closest matches':sort==='oldest'?' oldest records':sort==='address'?' by address':' newest records'):'View all '+rows.length+' →'+(sort==='closest'?' · closest matches first':sort==='oldest'?' · oldest first':sort==='address'?' · by address':' · newest first')}</button>}</div>
  {data.datasets.map(d=><p key={d.year} className="activity-source">{d.year} activity sources: Appraisal District export {dateLabel(d.sources.appraisal_export_date)}; supplemental deed and sale export {dateLabel(d.sources.sales_export_date)}.</p>)}
  <p className="activity-source">Nearby properties are not automatically comparable.</p>
 </section>;
}
