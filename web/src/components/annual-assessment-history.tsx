'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { capGapSummary, chartScale, changeLabel, type AnnualYear } from '@/lib/annual-history';
import { currency } from '@/lib/property-search';

const amount = (value: number | null) => value === null ? 'Not available' : currency(value);
const columns = ['Proposed market', 'Certified market', 'Change from proposal', 'After cap', 'Protest record'];
const protestStatus = (row: AnnualYear, unavailable: boolean) => row.protests.some(p => p.recorded) ? 'Recorded' : unavailable ? 'Unavailable' : row.within && row.within.dollars < 0 ? 'Reduction only' : 'Not found';

function YearDetails({row, protestsUnavailable}: {row: AnnualYear; protestsUnavailable: boolean}) {
  return <div className="annual-year-details">
    <h2 id="annual-dialog-heading">{row.year} assessment &amp; protest record</h2>
    <p className="annual-detail-summary">Market change from proposal: <strong>{changeLabel(row.within)}</strong>. Value change, not tax savings.</p>
    {row.outcome?.explanation && <p className="current-assessment-impact">{row.outcome.explanation}</p>}
    <table className="annual-detail-comparison"><caption className="visually-hidden">{row.year} proposed and certified values</caption>
      <thead><tr><th scope="col">Value</th><th scope="col">Proposed</th><th scope="col">Certified</th></tr></thead>
      <tbody>{([
        ['Market', row.preliminary, row.market], ['After cap', row.preliminaryAssessed, row.assessed],
        ['Land', row.preliminaryLand, row.certifiedLand], ['Home & improvements', row.preliminaryImprovements, row.certifiedImprovements],
      ] as const).map(([label, before, after]) => <tr key={label}><th scope="row">{label}</th><td>{amount(before)}</td><td>{amount(after)}</td></tr>)}</tbody>
    </table>
    <p className="overview-note">Certified change from {row.year - 1}: market {changeLabel(row.annual)}; assessed {changeLabel(row.annualAssessed)}.</p>
    <p><strong>Protest record: {protestStatus(row, protestsUnavailable)}</strong>{row.within && row.within.dollars < 0 && !row.protests.some(p => p.recorded) && ' · A reduction does not establish that a protest was filed.'}</p>
    <p className="overview-note">The records do not establish what caused a reduction or who handled the case.</p>
    <details className="annual-record-disclosure"><summary>Assessment records &amp; exemptions</summary>
    <div className="annual-source-list">
      {row.sources.map(source => <section key={source.id} aria-label={`${source.label} · ${source.date}`}>
        <h3>{source.label}</h3>
        <p className="overview-note">Source date: {source.date}{source.rawDate && <span> · Date and time as supplied: {source.rawDate}</span>}</p>
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
    </details>
    <details className="annual-record-disclosure"><summary>Dated protest and agent records</summary>
    {protestsUnavailable && <p>Some protest records are temporarily unavailable.</p>}
    {row.protests.length ? <ul>{row.protests.map(p => <li key={p.id}>
      {p.basis} · {p.date}
      {p.agent ? ` · ${p.agent}` : ' · Agent not identified'}
      {p.codes.length > 0 && ` · Appraisal District status: ${p.codes.join(', ')}`}
    </li>)}</ul> : !protestsUnavailable && <p>No protest found in available records for {row.year}.</p>}
    <p className="overview-note">A missing entry does not rule out a protest. Agent assignments do not confirm who handled a case. Status codes are shown as supplied; their definitions have not been verified. The values shown here are not tax bills.</p>
    </details>
  </div>;
}


type HistoryState = {rows: AnnualYear[]; unavailable: boolean; protestsUnavailable: boolean; openYear: (year: number, trigger: HTMLElement) => void};
const HistoryContext = createContext<HistoryState | null>(null);
function useHistory() {
  const value = useContext(HistoryContext);
  if (!value) throw new Error('Annual history requires its provider');
  return value;
}

export function AnnualHistoryProvider({rows, unavailable, protestsUnavailable, children}: Omit<HistoryState, 'openYear'> & {children: ReactNode}) {
  const [year, setYear] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const row = rows.find(r => r.year === year);
  useEffect(() => {
    if (!row || !dialog.current) return;
    dialog.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [row]);
  const openYear = (selected: number, source: HTMLElement) => { trigger.current = source; setYear(selected); };
  const closed = () => { setYear(null); trigger.current?.focus({preventScroll: true}); };
  return <HistoryContext.Provider value={{rows, unavailable, protestsUnavailable, openYear}}>
    {children}
    {row && <dialog ref={dialog} className="annual-dialog" aria-labelledby="annual-dialog-heading" onClose={closed}>
      <div className="annual-dialog-toolbar"><button type="button" className="annual-year-toggle" onClick={() => dialog.current?.close()}>Close record <span aria-hidden="true">×</span></button></div>
      <YearDetails row={row} protestsUnavailable={protestsUnavailable} />
    </dialog>}
  </HistoryContext.Provider>;
}

export function CurrentYearRecord({year}: {year: number}) {
  const {rows, openYear} = useHistory();
  if (!rows.some(row => row.year === year)) return null;
  return <button type="button" className="current-record-link" aria-haspopup="dialog" onClick={e => openYear(year, e.currentTarget)}>View {year} assessment &amp; protest record</button>;
}

export function AnnualAssessmentHistory() {
  const {rows, unavailable, protestsUnavailable, openYear} = useHistory();
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(rows.length / 5) - 1);
  const activePage = Math.min(page, lastPage);
  const visible = rows.slice(activePage * 5, activePage * 5 + 5);
  const plotted = [...visible].reverse().filter(row => row.market !== null || row.assessed !== null);
  const scale = chartScale(plotted);
  const gap = capGapSummary(visible);
  return <section className="overview-section property-section annual-history" aria-labelledby="history-heading">
    <p className="eyebrow">Your property over time</p>
    <h2 id="history-heading" tabIndex={-1}>Assessment &amp; protest history</h2>
    <p className="overview-note">Values and protest records together, year by year. Select a year for the full record.</p>
    {unavailable && rows.length > 0 && <p>Some assessment history is temporarily unavailable. Available protest and assessment records are shown below.</p>}
    {unavailable && !rows.length ? <p>Assessment history is temporarily unavailable. Try again in a few minutes.</p> : !rows.length ?
      <p>No annual assessment records are available for this property yet.</p> : <>
      <table className="annual-table" role="table">
        <caption className="visually-hidden">Annual assessment values, newest year first</caption>
        <thead role="rowgroup"><tr role="row"><th scope="col" id="annual-year" role="columnheader">Year</th>{columns.map((label, i) => <th key={label} scope="col" id={`annual-col-${i}`} role="columnheader">{label}</th>)}</tr></thead>
        <tbody role="rowgroup">{visible.map(row => {
          const values = [amount(row.preliminary), amount(row.market), changeLabel(row.within), amount(row.afterCap), protestStatus(row, protestsUnavailable)];
          return <tr key={row.year} role="row" className="annual-value-row" data-year={row.year}>
            <th scope="row" role="rowheader" id={`annual-year-${row.year}`}><button type="button" className="annual-year-toggle" aria-label={`View ${row.year} details`} aria-haspopup="dialog" onClick={e => openYear(row.year, e.currentTarget)}>{row.year}<span aria-hidden="true">→</span></button>{row.status !== 'Certified' && <span className="annual-status">{row.status}</span>}<span className="annual-mobile-protest"><span className="visually-hidden">Protest: </span>{protestStatus(row, protestsUnavailable)}</span></th>
            {values.map((value, i) => <td key={columns[i]} role="cell" headers={`annual-year-${row.year} annual-col-${i}`}><span className="annual-mobile-label" aria-hidden="true">{columns[i]}</span><span className="annual-cell-value">{i === 2 ? <><span className="annual-change-full">{value}</span><span className="annual-change-mobile">{row.within && row.within.dollars !== 0 && row.within.percent !== null ? `${Math.abs(row.within.percent).toFixed(1)}% ${row.within.dollars < 0 ? 'lower' : 'higher'}` : value}</span></> : value}{i === 3 && row.afterCapStatus && <span className="annual-status">{row.afterCapStatus}</span>}</span></td>)}
          </tr>;
        })}</tbody>
      </table>
      <p className="overview-note">Change compares proposed with certified market value, not tax savings. A missing protest entry does not rule out a protest.</p>
      {visible.some(row => protestStatus(row, protestsUnavailable) === 'Reduction only') && <p className="overview-note">“Reduction only” means the value fell without a protest found in available records; it does not establish the cause.</p>}
      <p className="annual-mobile-protest-help">Protest status appears under each year. Open a year for proposed values, assessed values and the full record.</p>
      <div className="annual-pagination">
        <p role="status">Showing {visible.at(-1)?.year}{visible.length > 1 ? `–${visible[0].year}` : ''} · {rows.length} {rows.length === 1 ? 'year' : 'years'} available{rows.length > 5 ? ` · Page ${activePage + 1} of ${lastPage + 1}` : ''}</p>
        {rows.length > 5 && <nav aria-label="History pages"><button type="button" className="annual-earlier" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Newer years</button><button type="button" className="annual-earlier" disabled={activePage === lastPage} onClick={() => setPage(activePage + 1)}>Older years</button></nav>}
      </div>
      <details className="annual-trend"><summary>View certified trend for these years</summary>
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
      </details>
    </>}
  </section>;
}
