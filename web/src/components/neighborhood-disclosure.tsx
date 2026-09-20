'use client';
import {useState, type ReactNode} from 'react';
export function NeighborhoodDisclosure({title,children,open=false}:{title:string;children:ReactNode;open?:boolean}) {
 const [expanded,setExpanded]=useState(open);
 return <details className="neighborhood-details" open={expanded} onToggle={e=>setExpanded(e.currentTarget.open)}><summary aria-expanded={expanded}>{title}</summary><div>{children}</div></details>;
}
