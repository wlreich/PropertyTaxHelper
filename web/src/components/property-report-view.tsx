import { BrandLogo } from './brand-logo';
import { Fragment, type ReactNode } from 'react';
import { currency } from '@/lib/property-search';
import { dateLabel } from '@/lib/property-history';
import { reportRowParts, type PropertyReport, type ReportBlock } from '@/lib/property-report';

function Block({block,lead}:{block:ReportBlock;lead?:ReactNode}) {
  if(block.kind==='note')return <div className={`report-note${block.emphasis ? ' report-callout' : ''}${block.positive ? ' report-callout-positive' : ''}`}>{block.title && <h3>{block.title}</h3>}<p>{block.text}</p>{block.links?.length && <p className="report-note-links">{block.links.map((link,i)=><Fragment key={link.href}>{i>0&&<span aria-hidden="true"> · </span>}<a href={link.href}>{link.label}: {link.href}</a></Fragment>)}</p>}</div>;
  if(block.kind==='chart') {
    const maximum=Math.ceil(Math.max(block.subject,block.median,1)/100000)*100000;
    return <figure className="report-chart"><figcaption>Market value compared with the median</figcaption>{[['Your home',block.subject],['Neighborhood median',block.median]].map(([label,value])=><div className="report-bar-row" key={label}><span>{label}</span><span className="report-bar-track"><span style={{width:`${Number(value)/maximum*100}%`}}/></span><strong>{currency(Number(value))}</strong></div>)}<p>Both bars start at $0. Full scale: {currency(maximum)}. Labels remain readable without color.</p></figure>;
  }
  const rows=block.rows.flatMap(reportRowParts);
  if(!rows.length)return null;
  const renderRow=(r:typeof rows[number])=><Fragment key={r.id}><tr data-report-record={r.continued ? undefined : r.id} data-report-continuation={r.continued || undefined}>{r.cells.map((cell,i)=>i===0 ? <th key={i} scope="row">{r.continued && <small>Detail continued · </small>}{cell}</th> : <td key={i}>{cell}</td>)}</tr>{r.note && <tr><td className="report-row-note" colSpan={block.columns.length}>{r.note}</td></tr>}</Fragment>;
  const table=(items:typeof rows)=><table className={`report-table report-columns-${block.columns.length}`} aria-label={block.title}><colgroup>{(block.columns.length===2 ? [65,35] : block.columns.length===3 ? [44,28,28] : block.columns.length===4 ? [40,20,20,20] : [16,21,21,21,21]).map((width,i)=><col key={i} style={{width:`${width}%`}}/>)}</colgroup><thead><tr className="report-table-context"><th colSpan={block.columns.length}>{block.title}</th></tr><tr>{block.columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead>{items.map(r=><tbody className="report-record" key={r.id}>{renderRow(r)}</tbody>)}</table>;
  const firstCount=rows.length<=8&&rows.reduce((n,r)=>n+r.cells.join('').length+(r.note?.length??0),0)<420?rows.length:2;
  return <div className="report-table-wrap" role="region" aria-label={block.title} tabIndex={0}><div className="report-table-start">{lead}{table(rows.slice(0,firstCount))}</div>{rows.length>firstCount&&<div className="report-table-rest">{table(rows.slice(firstCount))}</div>}</div>;
}

export function PropertyReportView({report:r}:{report:PropertyReport}) {
  const identity=`Property ${r.propertyId} | ${r.releaseLabel}`;
  return <article className={`property-report${r.compact ? ' report-compact' : ''}`} aria-label="Your Home & Assessment Report" data-report-property={r.propertyId} data-report-year={r.year}>
    <style>{`@page { @bottom-left { content: ${JSON.stringify(identity)}; } }`}</style>
    <header className="report-heading"><BrandLogo/><p className="report-kicker">Your Home &amp; Assessment Report</p><h1>{r.address}</h1><p>{r.location} · Appraisal District #{r.propertyId}<br/>{r.releaseLabel} assessment · Prepared {dateLabel(r.reportDate)}</p></header>
    {r.sections.map((section,i)=>{
      const firstTable=section.blocks.findIndex(b=>b.kind==='table'&&b.rows.length>0);
      const heading=<h2 id={`report-${section.id}`}>{section.title}</h2>;
      return <section className={`report-section${i===0 ? ' report-opening' : ''}`} key={section.id} aria-labelledby={`report-${section.id}`}>
        {firstTable>=0 ? <Block block={section.blocks[firstTable]} lead={<>{heading}{section.blocks.slice(0,firstTable).map((b,j)=><Block key={j} block={b}/>)}</>}/> : <div className="report-section-lead">{heading}{section.blocks[0]&&<Block block={section.blocks[0]}/>}</div>}
        {section.blocks.slice(firstTable>=0?firstTable+1:1).map((block,j)=><Block key={j} block={block}/>)}
      </section>;
    })}
  </article>;
}
