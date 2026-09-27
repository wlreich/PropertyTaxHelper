"use client";

import Link from 'next/link';
import { SearchEntryLink } from './search-entry-link';
import { SocialLinks } from './social-links';

function toggleMobileMenu(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const details = event.currentTarget.closest('details');
  if (!(details instanceof HTMLDetailsElement)) return;
  event.preventDefault();
  details.open = !details.open;
}

/** One shared set of destinations, with native keyboard-accessible mobile disclosure. */
export function SiteNavigation({ home = false }: { home?: boolean }) {
  const links = <>
    {home ? <SearchEntryLink>Search</SearchEntryLink> : <Link href="/">Search properties</Link>}
    <Link href="/protest-guide">Protest Guide</Link>
    {home && <Link href="/#about">About</Link>}
    <Link href={home ? '/#support' : '/support'}>{home ? 'Support us' : 'Support ParcelSavvy'}</Link>
  </>;
  return <nav className="site-navigation" aria-label={home ? 'Main navigation' : 'Site navigation'}>
    <div className="site-navigation-desktop">
      {links}
      <SocialLinks as="div" variant="icon-only" className="site-header-social-links" />
    </div>
    <details className="site-navigation-mobile">
      <summary onKeyDown={toggleMobileMenu}>Menu</summary>
      <div className="site-navigation-links">
        {links}
        <SocialLinks as="div" className="site-navigation-social-links" />
      </div>
    </details>
  </nav>;
}
