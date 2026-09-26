import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMigrationParity } from './check-migration-parity.mjs';
import { validatePublishedNeighborhood } from './contract.mjs';
import { readFile } from 'node:fs/promises';

const release = { dataset_id: '11111111-1111-4111-8111-111111111111', tax_year: 2026, roll_stage: 'certified', export_date: '2026-07-18' };
const fixture = {
  status: 'ok', source_id: release.dataset_id, neighborhood: 'T2450', agent_assignments: [],
  annual_periods: [{ release, homes: [], caps: [] }],
  homes: Array.from({ length: 571 }, (_, index) => ({ property_id: String(700000 + index) })),
  population: { candidate_count: 575, excluded: Array.from({ length: 4 }, (_, index) => ({ property_id: `x${index}`, reason: 'fixture' })) },
};

test('fixture records the observed 571 result without freezing the live smoke check', () => {
  const result = validatePublishedNeighborhood(fixture);
  assert.deepEqual(result.failures, []);
  assert.equal(result.eligiblePropertyCount, 571);
});

test('missing required agent field is an explicit contract failure', () => {
  const { agent_assignments, ...missing } = fixture;
  assert.deepEqual(validatePublishedNeighborhood(missing).failures, ['required field agent_assignments must be an array']);
});

test('malformed, unknown-home and duplicate agent assignments fail the release gate', () => {
  const malformed = structuredClone(fixture);
  malformed.agent_assignments = [{ property_id: malformed.homes[0].property_id, tax_year: 2026, status: 'named', agent_name: null }];
  assert.match(validatePublishedNeighborhood(malformed).failures[0], /agent_assignments\[0\]/);
  const unknown = structuredClone(fixture);
  unknown.agent_assignments = [{ property_id: '999999', tax_year: 2026, status: 'ambiguous', agent_name: null }];
  assert.match(validatePublishedNeighborhood(unknown).failures[0], /agent_assignments\[0\]/);
  const duplicate = structuredClone(fixture);
  duplicate.agent_assignments = Array(2).fill({ property_id: duplicate.homes[0].property_id, tax_year: 2026, status: 'named', agent_name: 'Fixture Agent' });
  assert.match(validatePublishedNeighborhood(duplicate).failures[0], /agent_assignments\[1\]/);
});

test('migration gate distinguishes missing versions from known version drift', async () => {
  const missing = await checkMigrationParity('20260925222242\n');
  assert.match(missing.failures[0], /missing migration 20260925223030/);
  const drift = await checkMigrationParity('20260925203301\n');
  assert.match(drift.failures[0], /version drift.*20260925203301.*20260925223030/);
  assert.deepEqual((await checkMigrationParity('20260925223030\n')).failures, []);
});

test('Vercel Git deployment invokes the production contract before building', async () => {
  const config = JSON.parse(await readFile(new URL('../../web/vercel.json', import.meta.url), 'utf8'));
  const pkg = JSON.parse(await readFile(new URL('../../web/package.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled, true);
  assert.match(config.buildCommand, /RELEASE_CONTRACT_CHECK=1 npm run build/);
  assert.match(config.buildCommand, /\$VERCEL_ENV.*preview/);
  assert.match(pkg.scripts.build, /^node --experimental-strip-types --conditions=react-server scripts\/check-release-contract\.mjs && next build$/);
});
