"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { comparisonSummary, type ComparisonProperty, type ComparisonRelease } from "@/lib/property-comparisons";
import { adjustmentSummary, propertyAdjustments } from "@/lib/property-adjustments";
import { tcadMethod } from "@/lib/tcad-method";
import { currency } from "@/lib/property-search";
import { ComparisonFacts, ComparisonSummary, DeedClue } from "./comparison-property-facts";
import type { ComparisonEvidence } from "@/lib/comparison-evidence";
import { ADJUSTMENT_METHOD_VERSION } from "@/lib/site";
import { snapshotLabel } from '@/lib/property-history';

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency(Math.abs(value))}`;
export type ComparisonInspection = { propertyId: string; methods: string[] };

export function AdjustedComparisons({ subject, selected, release, evidence, inspection, setInspection }: {
  subject: ComparisonProperty; selected: ComparisonProperty[]; release: ComparisonRelease; evidence: Record<string,ComparisonEvidence>;
  inspection: ComparisonInspection | null; setInspection: (value: ComparisonInspection | null) => void;
}) {
  const results = useMemo(() => selected.map(property => propertyAdjustments(subject, property, release.tax_year)), [subject, selected, release.tax_year]);
  const expanded = inspection?.propertyId;
  const heading = useRef<HTMLHeadingElement>(null), detailScroll = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef(false);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (detailScroll.current) detailScroll.current.scrollTop = 0;
    if (focusOnOpen.current) {
      const pane = heading.current?.closest('.comparison-detail');
      heading.current?.focus({preventScroll: !!pane && getComputedStyle(pane).position === 'sticky'});
      focusOnOpen.current = false;
    }
  }, [expanded]);
  const result=results.find(r=>r.property.property_id===expanded);
  const reported = comparisonSummary(subject, selected);
  const adjusted = adjustmentSummary(subject, results);
  function inspect(propertyId: string) {
    if (propertyId === expanded) return;
    focusOnOpen.current = true;
    setInspection({propertyId, methods: []});
  }
  function close() {
    const trigger = document.getElementById(`inspect-property-${expanded}`);
    const pane = heading.current?.closest('.comparison-detail');
    setInspection(null);
    (trigger ?? comparisonHeading.current)?.focus({preventScroll: !!pane && getComputedStyle(pane).position === 'sticky'});
  }
  // Stable sibling keys preserve the same pane DOM when it moves after a new row.
  // CSS places that one region in the right column when sufficient width is available.
  const rows = results.map((r, index) => <article key={r.property.property_id} className={`comparison-compact-row${expanded === r.property.property_id ? ' comparison-inspected' : ''}`} style={{'--comparison-row': index + 2} as CSSProperties} aria-label={r.property.address}>
    <div><Link className="comparison-property-link" href={`/property/${r.property.property_id}`}>{r.property.address}</Link><ComparisonFacts subject={subject} property={r.property}/><DeedClue evidence={evidence[r.property.property_id]}/>
      <button id={`inspect-property-${r.property.property_id}`} className="comparison-expand" aria-expanded={expanded === r.property.property_id} aria-controls={expanded === r.property.property_id ? 'adjustment-breakdown' : undefined} onClick={() => inspect(r.property.property_id)}>View breakdown<span className="comparison-sr-only"> · {r.property.address}</span> →</button>
    </div>
    <dl className="comparison-row-values"><div><dt>Reported value</dt><dd>{currency(r.property.market_value)}</dd></div><div><dt>Net adjustment</dt><dd>{r.total === null ? 'Not available' : signed(r.total)}</dd></div><div className="comparison-row-estimate"><dt>Estimated adjusted value</dt><dd>{r.adjustedValue === null ? <><span className="comparison-partial-label">Partial calculation</span><span className="comparison-small">Not available</span></> : currency(r.adjustedValue)}</dd></div></dl>
  </article>);
  if (result) rows.splice(results.indexOf(result) + 1, 0,
    <section key="breakdown" id="adjustment-breakdown" className="comparison-detail" aria-labelledby="adjustment-breakdown-heading" onKeyDown={event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if ((event.target as HTMLElement).closest('input, select, textarea, [role="combobox"], [role="listbox"], [role="menu"]')) return;
      event.preventDefault(); event.stopPropagation(); close();
    }}>
      <div className="comparison-detail-header">
        <div className="comparison-detail-toolbar"><span>Adjustment breakdown</span><button className="comparison-text-button" onClick={close}>Close breakdown ×</button></div>
        <h4 id="adjustment-breakdown-heading" ref={heading} tabIndex={-1}><span className="comparison-sr-only">Adjustment breakdown · </span>{result.property.address}</h4>
        <dl className="comparison-detail-values"><div><dt>Reported value</dt><dd>{currency(result.property.market_value)}</dd></div><div><dt>Net adjustment</dt><dd>{result.total === null ? 'Not available' : signed(result.total)}</dd></div><div><dt>Estimated adjusted value</dt><dd>{result.adjustedValue === null ? 'Not available · partial calculation' : currency(result.adjustedValue)}</dd></div></dl>
      </div>
      <div className="comparison-detail-scroll" ref={detailScroll} tabIndex={0} role="region" aria-label="Adjustment factors and sources">
        <DeedClue evidence={evidence[result.property.property_id]}/>
        {result.lines.map(line => <div className="comparison-factor" key={line.factor}>
          <div className="comparison-factor-heading"><h5>{line.factor}</h5><strong>{line.amount === null ? 'Not estimated' : signed(line.amount)}</strong></div>
          <dl className="comparison-calculation-inputs">{line.inputs.map(input => <div key={input.label}><dt>{input.label}</dt><dd>{input.value === null || input.value === undefined ? "Not reported" : typeof input.value === "string" ? input.value : input.unit === "year" ? String(input.value) : input.unit === "number" ? input.value.toLocaleString("en-US", {maximumFractionDigits: 2}) : currency(input.value)}</dd></div>)}</dl>
          <details open={inspection?.methods.includes(line.factor) ?? false} onToggle={event => {
            if (!inspection) return;
            const open = event.currentTarget.open;
            if (open === inspection.methods.includes(line.factor)) return;
            setInspection({...inspection, methods: open ? [...inspection.methods, line.factor] : inspection.methods.filter(factor => factor !== line.factor)});
          }}><summary>How this is calculated<span className="comparison-sr-only"> · {line.factor}</span></summary><p>{line.explanation}</p></details>
        </div>)}
        <div className="comparison-detail-result"><strong>{result.adjustedValue === null ? "Subtotal of available adjustments" : "Estimated adjusted value"}</strong><p className="comparison-money">{result.adjustedValue === null ? currency(result.partialSubtotal) : `${currency(result.property.market_value)} ${result.total! < 0 ? "−" : "+"} ${currency(Math.abs(result.total!))} = ${currency(result.adjustedValue)}`}</p>{result.adjustedValue === null && <p>Excluded from the adjusted median. Some required inputs are unavailable or these building types and construction classes are not supported by this calculation.</p>}</div>
        <Link className="comparison-text-button" href={`/property/${result.property.property_id}`}>View property records</Link>
        <p className="comparison-adjusted-note">Source: Appraisal District {snapshotLabel(release)} records · Exported {release.export_date ?? 'date not reported'}. Method {ADJUSTMENT_METHOD_VERSION} · {tcadMethod.version}. Not an official appraisal. Values are not tax savings.</p>
      </div>
    </section>);
  return <section className="comparison-card comparison-adjusted" aria-labelledby="adjusted-comparison-heading">
    <h3 ref={comparisonHeading} className="comparison-sr-only" id="adjusted-comparison-heading" tabIndex={-1}>ParcelSavvy estimated adjusted values</h3>

    <ComparisonSummary value={subject.market_value} median={adjusted.median} difference={adjusted.difference} percent={adjusted.percent} adjusted/>
    <p className="comparison-small">Reported median before adjustments: {currency(reported.median)} · {reported.count} properties.</p>
    <p className="comparison-adjusted-note" role="status">{selected.length === 0 ? "Edit the comparison set to choose properties for adjustment." : `${adjusted.count} of ${results.length} selected properties have estimated adjusted values. ${adjusted.excluded ? `${adjusted.excluded} properties without an estimate are excluded from the adjusted median.` : "Both medians use the same properties."}`} Your property is excluded from both medians.{reported.missing > 0 ? ` ${reported.missing} missing reported values are also excluded from the reported median.` : ""}</p>
    {adjusted.count > 0 && adjusted.excluded > 0 && <p className="comparison-adjusted-note">The medians use different sets. For the {adjusted.count} {adjusted.count === 1 ? "property with an estimate" : "properties with estimates"}, the reported median is {currency(adjusted.pairedReportedMedian)}.</p>}
    {adjusted.count > 0 && adjusted.count < 3 && <p className="comparison-inline-note">A small selection gives limited context. Review more similar properties before drawing a conclusion.</p>}
    <p className="comparison-sr-only" role="status">{result ? `Showing adjustment breakdown for ${result.property.address}.` : ''}</p>
    {selected.length > 0 && <div className={`comparison-inspection-grid${result ? ' comparison-inspection-open' : ''}`} style={{'--comparison-row-count': results.length + 1} as CSSProperties}>
      <div className="comparison-compact-labels" aria-hidden="true"><span>Property / match</span><span>Reported → estimated adjusted</span></div>
      {rows}
    </div>}
    {selected.length>0&&adjusted.count===0&&<p className="comparison-inline-note">No complete estimates are available for this set. Open a breakdown to review missing inputs, or use Reported values.</p>}
    <p className="comparison-adjusted-note">Source: Appraisal District {snapshotLabel(release)} records · Exported {release.export_date ?? "date not reported"}. Estimate method: {tcadMethod.version} · {ADJUSTMENT_METHOD_VERSION}.</p>
  </section>;
}
