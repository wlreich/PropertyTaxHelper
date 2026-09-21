"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { comparisonSummary, type ComparisonProperty, type ComparisonRelease } from "@/lib/property-comparisons";
import { adjustmentSummary, propertyAdjustments } from "@/lib/property-adjustments";
import { tcadMethod } from "@/lib/tcad-method";
import { currency } from "@/lib/property-search";
import { ComparisonFacts, ComparisonSummary, DeedClue } from "./comparison-property-facts";
import type { ComparisonEvidence } from "@/lib/comparison-evidence";
import { ADJUSTMENT_METHOD_VERSION } from "@/lib/site";
import { snapshotLabel } from '@/lib/property-history';

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency(Math.abs(value))}`;

export function AdjustedComparisons({ subject, selected, release, evidence }: {
  subject: ComparisonProperty; selected: ComparisonProperty[]; release: ComparisonRelease; evidence: Record<string,ComparisonEvidence>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const results = useMemo(() => selected.map(property => propertyAdjustments(subject, property, release.tax_year)), [subject, selected, release.tax_year]);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{if(expanded)dialog.current?.showModal();else trigger.current?.focus();},[expanded]);
  const result=results.find(r=>r.property.property_id===expanded);
  const reported = comparisonSummary(subject, selected);
  const adjusted = adjustmentSummary(subject, results);
  return <section className="comparison-card comparison-adjusted" aria-labelledby="adjusted-comparison-heading">
    <h3 className="comparison-sr-only" id="adjusted-comparison-heading" tabIndex={-1}>ParcelSavvy estimated adjusted values</h3>

    <ComparisonSummary value={subject.market_value} median={adjusted.median} difference={adjusted.difference} percent={adjusted.percent} adjusted/>
    <p className="comparison-small">Reported median before adjustments: {currency(reported.median)} · {reported.count} properties.</p>
    <p className="comparison-adjusted-note" role="status">{selected.length === 0 ? "Edit the comparison set to choose properties for adjustment." : `${adjusted.count} of ${results.length} selected properties have estimated adjusted values. ${adjusted.excluded ? `${adjusted.excluded} properties without an estimate are excluded from the adjusted median.` : "Both medians use the same properties."}`} Your property is excluded from both medians.{reported.missing > 0 ? ` ${reported.missing} missing reported values are also excluded from the reported median.` : ""}</p>
    {adjusted.count > 0 && adjusted.excluded > 0 && <p className="comparison-adjusted-note">The medians use different sets. For the {adjusted.count} {adjusted.count === 1 ? "property with an estimate" : "properties with estimates"}, the reported median is {currency(adjusted.pairedReportedMedian)}.</p>}
    {adjusted.count > 0 && adjusted.count < 3 && <p className="comparison-inline-note">A small selection gives limited context. Review more similar properties before drawing a conclusion.</p>}
    {selected.length>0&&<div role="region" aria-label="Adjusted property comparison"><table className="comparison-rows" role="table"><thead><tr><th scope="col">Property / match</th><th scope="col">Reported / net adjustment</th><th scope="col">Estimated adjusted</th><th scope="col">Details</th></tr></thead><tbody>
      {results.map(r=><tr key={r.property.property_id}><th scope="row"><Link href={`/property/${r.property.property_id}`}>{r.property.address}</Link><ComparisonFacts subject={subject} property={r.property}/><DeedClue evidence={evidence[r.property.property_id]}/></th>
       <td data-label="Reported / adjustment"><span>{currency(r.property.market_value)}</span><span className="comparison-small">Net adjustment: {r.total===null?'Not available':signed(r.total)}</span></td>
       <td data-label="Estimated adjusted" className="comparison-money">{r.adjustedValue===null?<><span className="comparison-partial-label">Partial calculation</span><span className="comparison-small">Not available</span></>:currency(r.adjustedValue)}</td>
       <td><button className="comparison-expand" aria-haspopup="dialog" aria-expanded={expanded===r.property.property_id} onClick={e=>{trigger.current=e.currentTarget;setExpanded(r.property.property_id);}}>View breakdown<span className="comparison-sr-only"> · {r.property.address}</span> →</button></td></tr>)}
    </tbody></table></div>}
    {selected.length>0&&adjusted.count===0&&<p className="comparison-inline-note">No complete estimates are available for this set. Open a breakdown to review missing inputs, or use Reported values.</p>}
    {result&&<dialog ref={dialog} className="comparison-dialog" aria-labelledby="adjustment-dialog-heading" onCancel={e=>{e.preventDefault();setExpanded(null);}} onClose={()=>setExpanded(null)}>
      <div className="comparison-dialog-toolbar"><button className="comparison-add-link" onClick={()=>setExpanded(null)}>Close breakdown ×</button></div>
              <div className="comparison-breakdown"><h4 id="adjustment-dialog-heading">Adjustment breakdown · {result.property.address}</h4><DeedClue evidence={evidence[result.property.property_id]}/>
                <table><caption className="comparison-sr-only">Adjustments for {result.property.address}</caption><thead><tr><th scope="col">Factor</th><th scope="col">Explanation and inputs</th><th scope="col">Adjustment</th></tr></thead><tbody>{result.lines.map(line => <tr key={line.factor}><th scope="row">{line.factor}</th><td>{line.explanation}{line.inputs.length > 0 && <dl className="comparison-calculation-inputs">{line.inputs.map(input => <div key={input.label}><dt>{input.label}</dt><dd>{input.value === null || input.value === undefined ? "Not reported" : typeof input.value === "string" ? input.value : input.unit === "year" ? String(input.value) : input.unit === "number" ? input.value.toLocaleString("en-US", {maximumFractionDigits: 2}) : currency(input.value)}</dd></div>)}</dl>}</td><td>{line.amount === null ? "Not estimated" : signed(line.amount)}</td></tr>)}</tbody></table>
                <div className="comparison-partial-result"><div><strong>{result.adjustedValue === null ? "Subtotal of available adjustments" : "Estimated adjusted value"}</strong><p className="comparison-money">{result.adjustedValue === null ? currency(result.partialSubtotal) : `${currency(result.property.market_value)} ${result.total! < 0 ? "−" : "+"} ${currency(Math.abs(result.total!))} = ${currency(result.adjustedValue)}`}</p></div>{result.adjustedValue === null && <p>Excluded from the adjusted median. Some required inputs are unavailable or these building types and construction classes are not supported by this calculation.</p>}</div>
                <Link href={`/property/${result.property.property_id}`}>View property records</Link>
              </div>
    </dialog>}
    <p className="comparison-adjusted-note"><strong>Not an official Appraisal District appraisal.</strong> Estimates follow the Appraisal District’s documented adjustment formulas using reported costs and features, with approximations where inputs are unavailable; the Appraisal District’s actual adjustments may differ. Method {ADJUSTMENT_METHOD_VERSION}.</p>
    <p className="comparison-adjusted-note">Source: Appraisal District {snapshotLabel(release)} records · Exported {release.export_date ?? "date not reported"}. Estimate method: {tcadMethod.version}. Values are not tax savings.</p>
  </section>;
}
