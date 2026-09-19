'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Chapter = { anchor: string; number: string; title: string; content: ReactNode };

export function GuideChapters({ chapters, introduction, closing }: { chapters: Chapter[]; introduction: ReactNode; closing: ReactNode }) {
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState('');
  const [enhanced, setEnhanced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const anchors = chapters.map(chapter => chapter.anchor).join('|');

  useEffect(() => {
    const valid = anchors.split('|');
    let frame = 0;
    function followHash(initial = false) {
      const id = window.location.hash.slice(1);
      const target = valid.includes(id) ? id : null;
      frame = requestAnimationFrame(() => {
        setEnhanced(true);
        if (target) {
          pending.current = target;
          setOpened(previous => new Set(previous).add(target));
          setActive(target);
        } else if (initial && window.matchMedia('(min-width: 901px)').matches) {
          setOpened(new Set([valid[6]]));
        }
      });
    }
    followHash(true);
    const onHistory = () => followHash();
    window.addEventListener('hashchange', onHistory);
    window.addEventListener('popstate', onHistory);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('popstate', onHistory);
    };
  }, [anchors]);

  useEffect(() => {
    if (!pending.current) return;
    const heading = document.getElementById(`${pending.current}-toggle`);
    pending.current = null;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [opened]);

  useEffect(() => {
    let frame = 0;
    const header = document.querySelector('.guide-page .site-header');
    function updateHeader() {
      root.current?.style.setProperty('--guide-header-offset', `${(header?.getBoundingClientRect().height ?? 0) + 24}px`);
    }
    const observer = new ResizeObserver(updateHeader);
    if (header) observer.observe(header);
    updateHeader();
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = (header?.getBoundingClientRect().height ?? 0) + 60;
        const sections = Array.from(root.current?.querySelectorAll<HTMLDetailsElement>('.guide-chapter') ?? []);
        const current = sections.find(section => {
          const rect = section.getBoundingClientRect();
          return rect.top <= offset && rect.bottom > offset;
        });
        if (current) setActive(current.id);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  function navigate(anchor: string) {
    // Native fragments preserve query/back context and work before hydration.
    if (window.location.hash !== `#${anchor}`) window.history.pushState(null, '', `#${anchor}`);
    pending.current = anchor;
    setOpened(previous => new Set(previous).add(anchor));
    setActive(anchor);
  }

  function toggle(anchor: string) {
    const details = document.getElementById(anchor);
    if (opened.has(anchor) && details?.contains(document.activeElement)) document.getElementById(`${anchor}-toggle`)?.focus({ preventScroll: true });
    setOpened(previous => {
      const next = new Set(previous);
      if (next.has(anchor)) next.delete(anchor); else next.add(anchor);
      return next;
    });
  }

  return <div className="guide-reading" ref={root}>
    <aside className="guide-sidebar">
      <nav aria-label="Guide chapters"><h2>In this guide</h2><ol>{chapters.map(chapter => <li key={chapter.anchor}><a href={`#${chapter.anchor}`} aria-current={active === chapter.anchor ? 'location' : undefined} onClick={event => { event.preventDefault(); navigate(chapter.anchor); }}><span>{chapter.number}</span>{chapter.title}</a></li>)}</ol></nav>
      <div className="guide-deadline"><strong>Start with your notice</strong><p>Confirm your own filing deadline. Do not wait for perfect evidence to start preparing.</p></div>
    </aside>
    <div className="guide-content">
      {introduction}
      <section aria-labelledby="explore-guide"><h2 id="explore-guide">Explore the guide</h2><p>Read in order, or open the chapter you need.</p>
        <div className="guide-chapters">{chapters.map(chapter => <details key={chapter.anchor} id={chapter.anchor} className={`guide-chapter${chapter.number === '07' ? ' guide-hearing' : ''}`} open={opened.has(chapter.anchor)}>
          <summary id={`${chapter.anchor}-toggle`} aria-expanded={enhanced ? opened.has(chapter.anchor) : undefined} aria-controls={`${chapter.anchor}-content`} onClick={event => { event.preventDefault(); toggle(chapter.anchor); }}><h3><span>{chapter.number}</span>{chapter.title}</h3><span className="guide-disclosure" aria-hidden="true" /></summary>
          <div id={`${chapter.anchor}-content`} className="guide-chapter-body">{chapter.content}</div>
        </details>)}</div>
      </section>
      {closing}
    </div>
  </div>;
}
