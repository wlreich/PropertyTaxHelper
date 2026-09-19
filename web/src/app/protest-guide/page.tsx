import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { GuideChapters } from '@/components/guide-chapters';
import { GuideMarkdown } from '@/components/guide-markdown';
import { protestGuide } from '@/content/protest-guide';
import { guideDownload } from '@/content/guide-download';
import './protest-guide.css';

export const metadata: Metadata = { title: 'Homeowner Protest Guide | ParcelSavvy', description: 'Understand your appraisal, prepare evidence, and make your case, with or without an agent.' };

function DownloadGuide() {
  return <a className="action-button guide-download" href={guideDownload.href} download={guideDownload.filename}>Download printable PDF</a>;
}

function HearingRoles() {
  return <aside className="guide-hearing-roles" aria-labelledby="hearing-roles-title"><h4 id="hearing-roles-title">Know who is in the room.</h4><dl>
    <div><dt>You</dt><dd>Present your evidence and requested value.</dd></div>
    <div><dt>District representative</dt><dd>Presents and supports the District’s valuation.</dd></div>
    <div><dt>ARB panel</dt><dd>Independently evaluates both sides and decides.</dd></div>
  </dl><p><strong>Your audience is the panel.</strong></p></aside>;
}

export default async function ProtestGuidePage({ searchParams }: { searchParams: Promise<{ property?: string | string[] }> }) {
  const { property } = await searchParams;
  const propertyId = typeof property === 'string' && /^\d{1,12}$/.test(property) ? property : null;
  const date = new Date(`${protestGuide.reviewedDate}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return <div className="guide-page">
    <SiteHeader propertyOverview />
    <main id="main-content">
      <section className="guide-hero" aria-labelledby="guide-title"><div className="guide-container">
        {propertyId && <Link className="guide-back" href={`/property/${propertyId}`}>← Back to property overview</Link>}
        <p className="guide-eyebrow">The homeowner’s field guide / Travis County, Texas</p>
        <h1 id="guide-title">Your appraisal deserves<br className="guide-desktop-break" /> a second look.</h1>
        <p className="guide-deck">Understand the numbers. Build your evidence. Make your case.<br />A practical guide to protesting your property’s value, with or without an agent.</p>
        <div className="guide-actions"><DownloadGuide /><p>Free guide · No sign-up required</p></div>
        <p className="guide-reviewed">Content reviewed <time dateTime={protestGuide.reviewedDate}>{date}</time> · Educational guidance, not legal advice</p>
      </div></section>
      <div className="guide-container"><GuideChapters chapters={protestGuide.chapters.map(chapter => ({ anchor: chapter.anchor, number: chapter.number, title: chapter.title, content: <>
        {chapter.number === '07' && <HearingRoles />}
        {chapter.sections.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
          <h4 id={`${section.id}-heading`}>{section.title}</h4>
          {section.sourceSection === protestGuide.calendarStatus.sourceSection && <div className="guide-calendar-status"><GuideMarkdown markdown={protestGuide.calendarStatus.markdown} label="Calendar status" /></div>}
          {section.blocks.map(block => <GuideMarkdown key={block.id} markdown={block.markdown} label={section.title} />)}
        </section>)}
      </> }))} introduction={<section className="guide-introduction" aria-labelledby="annual-habit"><h2 id="annual-habit">Make this an annual habit.</h2><p className="guide-takeaway">The cap limits growth. It does not check the appraisal.</p>
        <p>Review your value every year and protest when the evidence supports it. A reduction may not change this year’s bill if your value stays above the cap, but an unsupported market value still deserves scrutiny.</p>
        <div className="guide-first-steps"><h3>Your first 15 minutes</h3><ol><li>Find your notice and confirm the filing deadline.</li><li>Check property details, exemptions and value history.</li><li>Identify the strongest evidence for a different value.</li></ol></div>
        {protestGuide.introduction.map(block => <GuideMarkdown key={block.id} markdown={block.markdown} label="Introduction" />)}
      </section>} closing={<section className="guide-print-panel" aria-labelledby="take-guide"><h2 id="take-guide">Take the guide with you.</h2><p>The complete guide, examples and preparation checklist. Formatted for reading offline and printing without the website navigation.</p><DownloadGuide /><p>Free access. No account required.</p></section>} /></div>
      <section className="guide-about" aria-labelledby="guide-disclaimer"><div className="guide-container"><h2 id="guide-disclaimer">{protestGuide.disclaimer.title}</h2>{protestGuide.disclaimer.blocks.map(block => <GuideMarkdown key={block.id} markdown={block.markdown} label="About this guide" />)}
        <nav aria-label="Official guide sources"><a href="https://comptroller.texas.gov/taxes/property-tax/">Texas Comptroller</a><a href="https://traviscad.org/protests">Travis Appraisal District</a><a href="https://traviscad.org/arbhearings">Travis ARB</a></nav>
        <p className="guide-reviewed">Content version {protestGuide.contentVersion} · Reviewed {date}</p>
      </div></section>
    </main>
    <SiteFooter />
  </div>;
}
