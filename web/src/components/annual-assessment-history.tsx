'use client';

import { Fragment, useState } from 'react';
import { capGapSummary, chartScale, changeLabel, type AnnualYear } from '@/lib/annual-history';
import { currency } from '@/lib/property-search';

const amount = (value: number | null) => value === null ? 'Not available' : currency(value);
const columns = ['Preliminary market', 'Certified market', 'Annual change', 'After cap', 'Prelim → final'];

function YearDetails({row, protestsUnavailable}: {row: AnnualYear; protestsUnavailable: boolean}) {
  return <div className="annual-year-details">
    <h3>{row.year} recorded details</h3>
    <div className="annual-source-list">
      {row.sources.map(source => <section key={source.id} aria-label={`${source.label} · ${source.date}`}>
        <h4>{source.label}</h4>
        <p className="overview-note">Source date: {source.date}{source.rawDate && <span> · Export timestamp: {source.rawDate}</span>}</p>
        <dl className="annual-source-values">
          {[['Market value', source.market], ['After cap', source.assessed], ['Land', source.land], ['Home & improvements', source.improvements]].map(([name, value]) =>
            <div key={String(name)}><dt>{name}</dt><dd>{amount(value as number | null)}</dd></div>)}
        </dl>
        <p>Recorded exemptions: {source.exemptions.length ? source.exemptions.join(' · ') : 'Not reported'}</p>
        {source.authorities.length > 0 && <dl className="annual-authorities">{source.authorities.map(authority =>
          <div key={authority.code}><dt>{authority.name}</dt><dd>Taxable value: {amount(authority.taxable)}</dd><dd>{authority.exemptions.length ? authority.exemptions.map(e => `${e.name}: ${currency(e.value)}`).join(' · ') : 'Exemption amounts not reported'}</dd></div>)}</dl>}
      </section>)}
      {!row.sources.length && <p>Valuation records are not available for this year.</p>}
    </div>
    <h4>Protest and agent records</h4>
    {protestsUnavailable && <p>Some protest records are temporarily unavailable.</p>}
    {row.protests.length ? <ul>{row.protests.map(p => <li key={p.id}>
      {p.recorded ? 'Protest recorded' : 'Agent assignment recorded'} · {p.date}
      {p.agent ? ` · ${p.agent}` : ' · Agent not identified'}
      {p.codes.length > 0 && ` · Appraisal District status: ${p.codes.join(', ')}`}
    </li>)}</ul> : !protestsUnavailable && <p>No protest found in available records for {row.year}.</p>}
    <p className="overview-note">A missing entry does not rule out a protest. Agent assignments do not confirm who handled a case. These are dated records, not tax bills.</p>
  </div>;
}

export function AnnualAssessmentHistory({rows, unavailable, protestsUnavailable}: {rows: AnnualYear[]; unavailable: boolean; protestsUnavailable: boolean}) {
  const [showEarlier, setShowEarlier] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const visible = showEarlier ? rows : rows.slice(0, 5);
  const plotted = [...visible].reverse().filter(row => row.market !== null || row.assessed !== null);
  const scale = chartScale(plotted);
  const gap = capGapSummary(visible);
  return <section className="overview-section property-section annual-history" aria-labelledby="history-heading">
    <p className="eyebrow">Your property over time</p>
    <h2 id="history-heading" tabIndex={-1}>Your assessment over time</h2>
    <p className="overview-note">Track your market assessment and the value after the cap. Annual figures use certified records.</p>
    {unavailable ? <p>Assessment history is temporarily unavailable. Try again in a few minutes.</p> : !rows.length ?
      <p>No annual assessment records are available for this property yet.</p> : <>
      {plotted.length > 0 ? <figure className="annual-chart" aria-label="Annual certified market and assessed values">
        <figcaption className="annual-legend"><span><i className="annual-market-key" aria-hidden="true" />Appraisal District market value</span><span><i className="annual-assessed-key" aria-hidden="true" />Assessed value after cap</span></figcaption>
        <div className="annual-chart-rows">
          {plotted.map(row => <div className="annual-chart-year" key={row.year} data-chart-year={row.year}>
            <span className="annual-chart-label">{row.year}</span>
            <div className="annual-chart-pair">
              {([['Market value', row.market, 'market'], ['After cap', row.assessed, 'assessed']] as const).map(([name, value, kind]) =>
                <div className={`annual-chart-series annual-series-${kind}`} key={kind}>
                  <span className="visually-hidden">{row.year} certified {name}: </span>
                  <div className="annual-bar-track" aria-hidden="true"><span className="annual-bar" style={{width: `${(value ?? 0) / scale.maximum * 100}%`}} /></div>
                  <span className="annual-bar-value" style={{left: `calc(${(value ?? 0) / scale.maximum * 100}% + var(--space-3))`}}>{amount(value)}</span>
                </div>)}
            </div>
          </div>)}
        </div>
        <div className="annual-chart-axis" aria-hidden="true">{scale.ticks.map((value, i) => <span key={value} style={{left: `${i * 25}%`}}>{new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', notation:'compact', maximumFractionDigits:2}).format(value)}</span>)}</div>
        <p className="visually-hidden">Bars start at zero. Axis maximum: {currency(scale.maximum)}. Exact values are also in the annual table.</p>
      </figure> : <p>Certified values are not available to chart yet.</p>}
      {gap && <p className="annual-gap-summary">{gap}</p>}
      <table className="annual-table" role="table">
        <caption className="visually-hidden">Annual assessment values, newest year first</caption>
        <thead role="rowgroup"><tr role="row"><th scope="col" id="annual-year" role="columnheader">Year</th>{columns.map((label, i) => <th key={label} scope="col" id={`annual-col-${i}`} role="columnheader">{label}</th>)}</tr></thead>
        <tbody role="rowgroup">{visible.map(row => {
          const open = expanded.includes(row.year);
          const values = [amount(row.preliminary), amount(row.market), changeLabel(row.annual), amount(row.afterCap), changeLabel(row.within)];
          return <Fragment key={row.year}>
            <tr role="row" className="annual-value-row" data-year={row.year}>
              <th scope="row" role="rowheader" id={`annual-year-${row.year}`}><button type="button" className="annual-year-toggle" aria-label={`${open ? 'Collapse' : 'Expand'} ${row.year} details`} aria-expanded={open} aria-controls={`annual-details-${row.year}`} onClick={() => setExpanded(current => open ? current.filter(y => y !== row.year) : [...current, row.year])}>{row.year}<span aria-hidden="true">{open ? '−' : '+'}</span></button>{row.status !== 'Certified' && <span className="annual-status">{row.status}</span>}</th>
              {values.map((value, i) => <td key={columns[i]} role="cell" headers={`annual-year-${row.year} annual-col-${i}`}><span className="annual-mobile-label" aria-hidden="true">{columns[i]}</span><span className="annual-cell-value">{value}{i === 3 && row.afterCapStatus && <span className="annual-status">{row.afterCapStatus}</span>}</span></td>)}
            </tr>
            <tr role="row" id={`annual-details-${row.year}`} hidden={!open} className="annual-detail-row"><td role="cell" colSpan={6}>{open && <YearDetails row={row} protestsUnavailable={protestsUnavailable} />}</td></tr>
          </Fragment>;
        })}</tbody>
      </table>
      <p className="annual-expand-help">Expand a year for land, improvements, exemptions, protest records and source dates.</p>
      {rows.length > 5 && <button type="button" className="annual-earlier" aria-expanded={showEarlier} onClick={() => setShowEarlier(!showEarlier)}>{showEarlier ? 'Show latest five years' : 'Show earlier years'}</button>}
    </>}
  </section>;
}
