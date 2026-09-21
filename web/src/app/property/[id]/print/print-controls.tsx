'use client';

import {useEffect,useState} from 'react';
export function PropertyPrintControls() {
  const [ready,setReady]=useState(false);
  useEffect(()=>{let active=true;document.fonts.ready.then(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
  return <div className="property-print-actions"><button type="button" disabled={!ready} onClick={()=>window.print()}>Print / save PDF</button><p role="status">{ready ? 'Ready to print. Letter portrait recommended; A4 also supported. Choose Save as PDF in the print dialog.' : 'Preparing report fonts…'}</p></div>;
}
