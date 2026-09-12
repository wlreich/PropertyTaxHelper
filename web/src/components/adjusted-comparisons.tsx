"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { comparisonSummary, type ComparisonProperty, type ComparisonRelease } from "@/lib/property-comparisons";
import { adjustmentSummary, propertyAdjustments } from "@/lib/property-adjustments";
import { currency } from "@/lib/property-search";
import { PropertySectionLink } from "./property-section-link";

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency(Math.abs(value))}`;
const difference = (value: number | null) => value === null ? "Not available" : value === 0 ? "Same as median" : `${currency(Math.abs(value))} ${value > 0 ? "above" : "below"}`;

export function AdjustedComparisons({ subject, selected, release, peers }: {
  subject: ComparisonProperty; selected: ComparisonProperty[]; release: ComparisonRelease; peers: ComparisonProperty[];
}) {
  const [expanded, setExpanded] = useState<string | null>(selected[0]?.property_id ?? null);
  const results = useMemo(() => selected.map(property => propertyAdjustments(subject, property, peers)), [subject, selected, peers]);
  const reported = comparisonSummary(subject, selected);
  const adjusted = adjustmentSummary(subject, results);
  return <section className="comparison-card comparison-adjusted" aria-labelledby="adjusted-comparison-heading">
    <h3 id="adjusted-comparison-heading" tabIndex={-1}>Your comparison at a glance</h3>
    <p className="comparison-adjusted-note">ParcelSavvy estimates use reported property facts and local assessment patterns, guided by TCAD’s comparison approach; they may differ from TCAD’s exact adjustments and do not separately price condition or individual features.</p>
    <p>Your property’s reported market value: <strong>{currency(subject.market_value)}</strong>. Your own value stays unchanged.</p>
    <dl className="comparison-summary comparison-adjusted-summary">
      <div><dt>Reported median</dt><dd>{reported.median === null ? "Not available" : currency(reported.median)}</dd><dd className="comparison-summary-percent">Before adjustments · {reported.count} properties</dd><dd className="comparison-summary-percent">Your property: {difference(reported.difference).toLowerCase()}{reported.percent !== null ? ` (${Math.abs(reported.percent).toFixed(1)}% ${reported.percent > 0 ? "higher" : reported.percent < 0 ? "lower" : "difference"})` : ""}</dd></div>
      <div><dt>Estimated adjusted median</dt><dd>{adjusted.median === null ? "Not available" : currency(adjusted.median)}</dd><dd className="comparison-summary-percent">{adjusted.count} {adjusted.count === 1 ? "estimate" : "estimates"}</dd></div>
      <div><dt>Your property vs. adjusted median</dt><dd>{difference(adjusted.difference)}</dd>{adjusted.percent !== null && <dd className="comparison-summary-percent">{Math.abs(adjusted.percent).toFixed(1)}% {adjusted.percent > 0 ? "higher" : adjusted.percent < 0 ? "lower" : "difference"}</dd>}</div>
    </dl>
    <p className="comparison-adjusted-note" role="status">{selected.length === 0 ? "Select comparison properties in Reported values to see their adjustment breakdowns." : `${adjusted.count} of ${results.length} selected properties have estimated adjusted values. ${adjusted.excluded ? `${adjusted.excluded} properties without an estimate are excluded from the adjusted median.` : "Both medians use the same properties."}`} Your property is excluded from both medians.{reported.missing > 0 ? ` ${reported.missing} missing reported values are also excluded from the reported median.` : ""}</p>
    {adjusted.count > 0 && adjusted.excluded > 0 && <p className="comparison-adjusted-note">The medians use different sets. For the {adjusted.count} {adjusted.count === 1 ? "property with an estimate" : "properties with estimates"}, the reported median is {currency(adjusted.pairedReportedMedian)}.</p>}
    {adjusted.count > 0 && adjusted.count < 3 && <p className="comparison-inline-note">A small selection gives limited context. Review more similar properties before drawing a conclusion.</p>}
    {selected.length > 0 && <>
      <div className="comparison-adjusted-heading"><h4>Adjusted comparisons</h4><PropertySectionLink target="comparison-rules-heading">How the rules work</PropertySectionLink></div>
      <p className="comparison-small comparison-mobile-hint">Scroll the table sideways to see all values.</p>
      <div className="comparison-table-scroll" role="region" aria-label="Adjusted property comparison" tabIndex={0}>
        <table className="comparison-adjustment-table"><thead><tr><th scope="col">Property</th><th scope="col">Reported value</th><th scope="col">Total adjustment</th><th scope="col">Estimated adjusted value</th></tr></thead><tbody>
          {results.map(result => <Fragment key={result.property.property_id}>
            <tr className={expanded === result.property.property_id ? "comparison-adjustment-active" : undefined}>
              <th scope="row"><button className="comparison-expand" aria-expanded={expanded === result.property.property_id} aria-controls={`adjustment-${result.property.property_id}`} onClick={() => setExpanded(expanded === result.property.property_id ? null : result.property.property_id)}><span aria-hidden="true">{expanded === result.property.property_id ? "▾" : "▸"}</span> Adjustment breakdown · {result.property.address}</button></th>
              <td className="comparison-money">{currency(result.property.market_value)}</td><td>{result.total === null ? "Not available" : signed(result.total)}</td><td>{result.adjustedValue === null ? <><span className="comparison-partial-label">Partial calculation</span><span className="comparison-adjusted-note">Not available</span></> : currency(result.adjustedValue)}</td>
            </tr>
            <tr id={`adjustment-${result.property.property_id}`} hidden={expanded !== result.property.property_id}><td colSpan={4} className="comparison-breakdown-cell">
              <div className="comparison-breakdown"><h5>Adjustment breakdown · {result.property.address}</h5>
                <table><caption className="comparison-sr-only">Adjustments for {result.property.address}</caption><thead><tr><th scope="col">Factor</th><th scope="col">Explanation and inputs</th><th scope="col">Adjustment</th></tr></thead><tbody>{result.lines.map(line => <tr key={line.factor}><th scope="row">{line.factor}</th><td>{line.explanation}{line.inputs.length > 0 && <dl className="comparison-calculation-inputs">{line.inputs.map(input => <div key={input.label}><dt>{input.label}</dt><dd>{input.value === null || input.value === undefined ? "Not reported" : typeof input.value === "string" ? input.value : input.unit === "year" ? String(input.value) : input.unit === "number" ? input.value.toLocaleString("en-US", {maximumFractionDigits: 2}) : currency(input.value)}</dd></div>)}</dl>}</td><td>{line.amount === null ? "Not estimated" : signed(line.amount)}</td></tr>)}</tbody></table>
                <div className="comparison-partial-result"><div><strong>{result.adjustedValue === null ? "Subtotal of available adjustments" : "Estimated adjusted value"}</strong><p className="comparison-money">{result.adjustedValue === null ? currency(result.partialSubtotal) : `${currency(result.property.market_value)} ${result.total! < 0 ? "−" : "+"} ${currency(Math.abs(result.total!))} = ${currency(result.adjustedValue)}`}</p></div>{result.adjustedValue === null && <p>Excluded from the adjusted median. Review the factors marked “Not estimated” and confirm the properties have the same type and market area.</p>}</div>
                <Link href={`/property/${result.property.property_id}`}>View property records</Link>
              </div>
            </td></tr>
          </Fragment>)}
          <tr className="comparison-adjustment-median"><th scope="row">Median</th><td>{currency(reported.median)}</td><td>—</td><td>{adjusted.median === null ? "Not available" : currency(adjusted.median)}</td></tr>
        </tbody></table>
      </div>
    </>}
    <p className="comparison-adjusted-note">Source: TCAD {release.tax_year} {release.roll_stage} records · Exported {release.export_date ?? "date not reported"}. Estimate method: ParcelSavvy v1. Values are not tax savings.</p>
  </section>;
}
