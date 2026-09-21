'use client';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
export function NeighborhoodPrintLink({propertyId}:{propertyId:string}){const query=useSearchParams();return <Link className="action-button neighborhood-print-link" href={`/property/${propertyId}/neighborhood/print?${query}`}>Print / save PDF</Link>;}
