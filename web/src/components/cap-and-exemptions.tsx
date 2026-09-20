"use client";

import { useState } from 'react';
import Link from 'next/link';
import { currency } from '@/lib/property-search';
import type { CapModel } from '@/lib/property-sections';

export function CapAndExemptions({ model, annualReviewHref }: { model: CapModel; propertyId: string; annualReviewHref: string }) {
  const [selected, setSelected] = useState(model.defaultAuthority);
  const authority = model.authorities.find(a => a.code === selected) ?? model.authorities[0];
  const deduction = (value: number | null) => value === null ? 'Not reported' : `${value > 0 ? '− ' : ''}${currency(value)}`;
  return <section className="overview-section property-section cap-section" aria-labelledby="exemptions-heading">
    <h2 id="exemptions-heading" tabIndex={-1}>What is the cap doing for you?</h2>
    <div className="cap-columns">
      <div>
        <dl className="cap-calculation" aria-label="Market to taxable value calculation">
          <div><dt>Appraisal District market value</dt><dd>{currency(model.market)}</dd></div>
          <div><dt>{model.homestead ? 'Value excluded by the cap' : 'Recorded assessment reduction'}</dt><dd>{deduction(model.difference)}</dd></div>
          <div className="calculation-total"><dt>Assessed value before exemptions</dt><dd>{currency(model.assessed)}</dd></div>
          <div className="calculation-divider"><dt>{authority ? `${authority.name} exemptions` : 'Authority exemptions'}</dt><dd>{deduction(authority?.exemptions ?? null)}</dd></div>
          <div className="calculation-total"><dt>{authority ? `${authority.name} taxable value` : 'Taxable value'}</dt><dd>{currency(authority?.taxable ?? null)}</dd></div>
        </dl>
        {authority && !authority.reconciles && <p className="overview-note">The recorded taxable value cannot be fully reconciled from the available exemption amounts. Other reductions or incomplete records may affect it.</p>}
        {model.authorities.length > 1 && <div className="authority-choice"><label htmlFor="calculation-authority">Calculation authority</label><select id="calculation-authority" value={authority?.code} onChange={e => setSelected(e.target.value)}>{model.authorities.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}</select></div>}
      </div>
      <aside className="cap-guidance" aria-labelledby="cap-guidance-heading">
        <h3 id="cap-guidance-heading">{model.outlook?.title ?? model.title}</h3>
        {model.outlook ? <>
          <p>{model.outlook.explanation}</p>
          <dl className="cap-outlook-values">
            <div><dt>{model.outlook.year} starting value</dt><dd>{currency(model.outlook.base)}</dd></div>
            <div><dt>{model.outlook.year} ceiling under the 10% cap</dt><dd>{currency(model.outlook.ceiling)}</dd></div>
          </dl>
          <p className="overview-note">Assumes continued eligibility and no qualifying new improvements. A ceiling, not a prediction or tax bill; assessed value can be lower if market value is lower.</p>
        </> : model.paragraphs.map(p => <p key={p}>{p}</p>)}
        <Link className="action-button" href={annualReviewHref}>Why review every year?</Link>
      </aside>
    </div>
    <p className="recorded-exemptions">Recorded exemptions: {model.exemptionNames.length ? model.exemptionNames.join(' · ') : model.state === 'unavailable' ? 'Not available' : 'None listed'}</p>
    <h3 className="authority-heading">Taxable values by authority</h3>
    {model.authorities.length ? <dl className="authority-values">{model.authorities.map(a => <div key={a.code}><dt>{a.name}</dt><dd>{currency(a.taxable)}</dd></div>)}</dl> : <p>Taxing authority values are not available.</p>}
    <p className="overview-note">These are values used for taxation, not tax bills. Rates and any applicable tax ceilings also matter.</p>
    <details className="section-disclosure" id="taxing-authorities">
      <summary id="taxing-authorities-heading">View exemption details</summary>
      <p>Each authority applies its own exemptions. Amounts shown are reductions in taxable value, not tax savings.</p>
      <div className="exemption-breakdowns">{model.authorities.map(a => <div key={a.code}><h4>{a.name}</h4>{a.entries.length ? <dl>{a.entries.map(e => <div key={e.code}><dt>{e.label}</dt><dd>{currency(e.value)}</dd></div>)}</dl> : <p>No exemption amounts reported.</p>}</div>)}</div>
      <p>A qualifying homestead cap uses the prior capped assessed value, plus up to 10% and qualifying new improvements. It does not start from prior uncapped market value. Eligibility and the effective year matter.</p>
      {model.priorAssessed !== null && <p>Recorded {model.priorYear} assessed value before exemptions: {currency(model.priorAssessed)}. A complete next-year limit also requires eligibility and new-improvement information.</p>}
      <p>A market-value reduction that remains above the capped assessed value does not lower the starting point for next year’s cap.</p>
    </details>
  </section>;
}
