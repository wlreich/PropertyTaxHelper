'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/** Keep query-specific context out of the static, no-JavaScript guide body. */
export function GuidePropertyBack() {
  const property = useSearchParams().get('property');
  if (!property || !/^\d{1,12}$/.test(property)) return null;
  return <Link className="guide-back" href={`/property/${property}`}>← Back to property overview</Link>;
}
