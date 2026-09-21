'use client';
import {useState,useTransition,type FormEvent} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {defaultEvidenceWindow,evidenceWindowError,type EvidenceWindow} from '@/lib/evidence-window';
export function EvidenceWindowControls({window,error,onNavigate,busy=false}:{window:EvidenceWindow;error?:string|null;onNavigate?:(url:string)=>void;busy?:boolean}){
 const router=useRouter(),path=usePathname(),query=useSearchParams();
 const [targetYear,setYear]=useState(String(window.targetYear)),[start,setStart]=useState(window.start),[end,setEnd]=useState(window.end),[message,setMessage]=useState(error??'');
 const [pending,transition]=useTransition();
 function submit(e:FormEvent){e.preventDefault();const next={targetYear:Number(targetYear),start,end},problem=evidenceWindowError(next);setMessage(problem??'');if(problem)return;
  const params=new URLSearchParams(query.toString());params.set('targetYear',targetYear);params.set('evidenceStart',start);params.set('evidenceEnd',end);params.delete('activityYear');
  const url=`${path}?${params}${path.endsWith('/neighborhood')?'#recent-activity':''}`;
  transition(()=>onNavigate?onNavigate(url):router.push(url,{scroll:false}));
 }
 return <form className="evidence-window" onSubmit={submit} aria-label="Evidence research window" aria-busy={pending||busy}>
  <div className="evidence-fields"><label>Preparing for<input name="targetYear" type="number" min="1901" max="2200" required value={targetYear} onChange={e=>{setYear(e.target.value);const year=Number(e.target.value);if(Number.isInteger(year)&&year>=1901&&year<=2200){const w=defaultEvidenceWindow(year);setStart(w.start);setEnd(w.end);}}}/></label>
  <label>Evidence start<input name="evidenceStart" type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label><label>Evidence end<input name="evidenceEnd" type="date" required value={end} onChange={e=>setEnd(e.target.value)}/></label><button className="action-button" disabled={pending||busy}>Apply dates</button></div>
  <p>Starts with the preceding calendar year. You can edit the dates; this is a research window, not a rule about which evidence can be used.</p>
  {message&&<p role="alert">{message}</p>}
 </form>;
}
