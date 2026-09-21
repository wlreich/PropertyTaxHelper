import { exportDate } from './current-assessment.ts';
import { dateLabel } from './property-history.ts';
import type { Property } from './supabase/properties.ts';

// Describe the linked export's release, which can differ from the latest history snapshot.
export function propertySource(p: Pick<Property, 'property_id' | 'tax_year' | 'roll_stage' | 'export_time_raw' | 'source_url'>) {
  const date = exportDate(p.export_time_raw);
  return {
    parcelHref: `https://travis.prodigycad.com/property-detail/${encodeURIComponent(p.property_id)}/${p.tax_year}`,
    downloadHref: p.source_url,
    downloadLabel: /\.zip(?:[?#]|$)/i.test(p.source_url) ? 'Download source appraisal export (ZIP)' : 'View source appraisal export',
    description: `${p.tax_year} ${p.roll_stage} countywide appraisal export · ${date ? dateLabel(date) : p.export_time_raw ?? 'Export date not reported'}`,
  };
}
