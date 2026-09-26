#!/usr/bin/env node
import { validatePublishedNeighborhood } from './contract.mjs';

const required = name => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value.replace(/\/$/, ''); };
const supabaseUrl = required('RELEASE_SUPABASE_URL');
const key = required('RELEASE_SUPABASE_PUBLISHABLE_KEY');
const baseUrl = process.env.RELEASE_WEB_BASE_URL?.replace(/\/$/, '');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const response = await fetch(`${supabaseUrl}/rest/v1/rpc/property_neighborhood_analysis`, {
  method: 'POST', headers, body: JSON.stringify({ p_id: '736302', p_phase: null, p_year: null }), signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`release RPC returned HTTP ${response.status}`);
const result = validatePublishedNeighborhood(await response.json());
if (result.failures.length) throw new Error(`published-release contract failed:\n- ${result.failures.join('\n- ')}`);
console.log(`Published RPC contract passed with ${result.eligiblePropertyCount} eligible properties (observed, not frozen).`);

if (!baseUrl) console.log('Database contract passed; RELEASE_WEB_BASE_URL was not set, so rendered-panel checks were deferred.');
for (const [label, path, markers] of baseUrl ? [
  ['screen', '/property/736302/neighborhood', ['Your neighborhood, in context.', 'Appraisal District group']],
  ['printable', '/property/736302/neighborhood/print', ['Printable neighborhood report', 'Neighborhood report']],
] : []) {
  const page = await fetch(`${baseUrl}${path}`, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const html = await page.text();
  if (!page.ok || /Neighborhood (data is temporarily unavailable|report unavailable)/i.test(html) || !markers.some(marker => html.includes(marker)))
    throw new Error(`${label} neighborhood panel did not render (HTTP ${page.status})`);
  console.log(`${label} neighborhood panel rendered.`);
}
