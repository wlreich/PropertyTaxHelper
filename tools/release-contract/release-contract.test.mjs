import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMigrationParity } from './check-migration-parity.mjs';
import { validatePublishedNeighborhood } from './contract.mjs';

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

test('migration gate distinguishes missing versions from known version drift', async () => {
  const missing = await checkMigrationParity('20260925222242\n');
  assert.match(missing.failures[0], /missing migration 20260925223030/);
  const drift = await checkMigrationParity('20260925203301\n');
  assert.match(drift.failures[0], /version drift.*20260925203301.*20260925223030/);
  assert.deepEqual((await checkMigrationParity('20260925223030\n')).failures, []);
});
