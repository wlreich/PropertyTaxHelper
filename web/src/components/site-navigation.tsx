import Link from 'next/link';
import { SearchEntryLink } from './search-entry-link';

/** One shared set of destinations, with native keyboard-accessible mobile disclosure. */
export function SiteNavigation({ home = false }: { home?: boolean }) {
  const links = <>
    {home ? <SearchEntryLink>Search</SearchEntryLink> : <Link href="/">Search properties</Link>}
    <Link href="/protest-guide">Protest Guide</Link>
    {home && <Link href="/#about">About</Link>}
    <Link href={home ? '/#support' : '/support'}>{home ? 'Support us' : 'Support ParcelSavvy'}</Link>
  </>;
  return <nav className="site-navigation" aria-label={home ? 'Main navigation' : 'Site navigation'}>
    <div className="site-navigation-desktop">{links}</div>
    <details className="site-navigation-mobile">
      <summary>Menu</summary>
      <div className="site-navigation-links">{links}</div>
    </details>
  </nav>;
}
