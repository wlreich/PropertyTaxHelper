'use client';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
export function NeighborhoodPrintLink({propertyId,evidenceQuery}:{propertyId:string;evidenceQuery:string}){const query=useSearchParams(),scope=new URLSearchParams(query.toString());for(const [key,value] of new URLSearchParams(evidenceQuery))scope.set(key,value);return <Link className="action-button neighborhood-print-link" href={`/property/${propertyId}/neighborhood/print?${scope}`}>Print / save PDF</Link>;}
