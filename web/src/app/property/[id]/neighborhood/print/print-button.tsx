'use client';

export function PrintButton() {
 return <button type="button" onClick={async()=>{await document.fonts.ready;window.print();}}>Print or save as PDF</button>;
}
