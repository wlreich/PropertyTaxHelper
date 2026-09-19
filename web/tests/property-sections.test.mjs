import test from 'node:test';
import assert from 'node:assert/strict';
import { capModel, propertyFeatures, valueDriverSummary, annualChange } from '../src/lib/property-sections.ts';
import { par9Reference } from '../../tools/property-search/par9-reference-fixture.mjs';
const snapshots = par9Reference.overview.history.snapshots;
const current = snapshots.find(s => s.tax_year === 2026 && s.roll_stage === 'certified');
const previous = snapshots.find(s => s.tax_year === 2025 && s.roll_stage === 'certified');
test('reference calculation reconciles independently for every authority', () => {
  const m = capModel(current, previous);
  assert.equal(m.difference, 197959);
  assert.equal(m.state, 'binding');
  assert.equal(m.title, 'Your cap helps. Keep reviewing.');
  const school = m.authorities.find(a => a.code === '69');
  assert.equal(school.exemptions, 203000);
  assert.equal(school.taxable, 1174354);
  for (const a of m.authorities) { assert.equal(a.reconciles, true); assert.equal(m.assessed - a.exemptions, a.taxable); }
  assert.equal(m.authorities.find(a => a.code === '03').exemptions, 420740);
  assert.equal(m.priorAssessed, 1252140);
  assert.notEqual(m.priorAssessed, previous.market_value);
});
test('binding, nonbinding, unconfirmed eligibility and no homestead have distinct guidance', () => {
  assert.equal(capModel({ ...current, market_value: current.assessed_value }, previous).state, 'nonbinding');
  const noHS = { ...current, exemptions: [], entities: [] };
  assert.equal(capModel(noHS, previous).state, 'no-homestead');
  assert.doesNotMatch(capModel(noHS, previous).paragraphs.join(' '), /Your cap limits|next year's cap/);
  const newHS = capModel({ ...current, market_value: current.assessed_value }, { ...previous, exemptions: [], entities: [] });
  assert.equal(newHS.state, 'eligibility-unconfirmed');
  assert.equal(newHS.priorAssessed, null);
  assert.equal(capModel({ ...current, market_value: current.assessed_value }).state, 'eligibility-unconfirmed');
  // Newly recorded features must not be interpreted as qualifying new improvements
  // or used to recalculate the district's reported assessed value.
  const improved = capModel({ ...current, assessed_value: 1450000 }, previous);
  assert.equal(improved.assessed, 1450000);
  assert.equal(improved.difference, 125313);
});
test('missing, inconsistent and zero data remain distinct', () => {
  for (const s of [{ ...current, market_value: null }, { ...current, assessed_value: null }, { ...current, assessed_value: current.market_value + 1 }]) {
    assert.equal(capModel(s, previous).state, 'unavailable'); assert.equal(capModel(s, previous).difference, null);
  }
  assert.equal(capModel(current, previous, false).state, 'unavailable');
  const m = capModel({ ...current, entities: [{code:'a',name:'A',taxable_value:null,exemptions:{}},{code:'b',name:'B',taxable_value:1,exemptions:{}},{code:'c',name:'C',taxable_value:current.assessed_value,exemptions:{}}] }, previous);
  assert.equal(m.authorities[0].exemptions, null); assert.equal(m.authorities[0].taxable, null);
  assert.equal(m.authorities[1].exemptions, null); assert.equal(m.authorities[1].reconciles, false);
  assert.equal(m.authorities[2].exemptions, 0); assert.equal(m.authorities[2].reconciles, true);
  const zero = capModel({ ...current, assessed_value:0,entities:[{code:'z',name:'Z',taxable_value:0,exemptions:{EX:2000000}}] }, previous);
  assert.equal(zero.authorities[0].reconciles, true);
});
test('drivers use actual annual values, not the multiplier-only estimate', () => {
  assert.match(valueDriverSummary(current, previous), /Land stayed the same/);
  assert.equal(annualChange(previous.improvement_value, current.improvement_value, 2025), '↑ $210,274 vs. 2025');
  assert.equal(par9Reference.adjustment.homes[0].effect, 214054);
  assert.match(annualChange(null, 12, 2025), /unavailable/);
  assert.match(valueDriverSummary({ ...current, land_value:null }, previous), /not available/);
});
test('features are dynamic and comparisons remain cautious for absent, new and ambiguous details', () => {
  const list = propertyFeatures(current, previous);
  assert.equal(list[0].label, 'Concrete pool'); assert.equal(list[0].value, '$42,809'); assert.match(list[0].change, /10,966/);
  assert.equal(list[1].label, 'Concrete spa'); assert.match(list[1].change, /149/);
  assert.ok(list.some(f => /Fireplace/.test(f.label)));
  const pool = current.components.find(c => c.code === '604');
  const removed = propertyFeatures({ ...current, components:current.components.filter(c => c.code !== '604') }, previous).find(f => f.label === 'Concrete pool');
  assert.equal(removed.value, 'No longer separately listed'); assert.match(removed.change, /Not proof of physical removal/);
  const fresh = propertyFeatures({ ...current, components:[{...pool,code:'CUSTOM',description:'Long custom feature'}] }, previous).find(f => /Long Custom/.test(f.label));
  assert.match(fresh.change, /Newly listed; not proof of new construction/);
  const unknown = propertyFeatures({ ...current, components:[{...pool,value:null}] }, previous).find(f => f.label === 'Concrete pool');
  assert.equal(unknown.value, 'Not reported'); assert.match(unknown.change, /unavailable/);
  const duplicate = propertyFeatures({ ...current, components:[pool,{...pool,id:'other',improvement_id:'secondary-dwelling'}] }, previous).find(f => f.label === 'Concrete pool');
  assert.equal(duplicate.value, 'Multiple recorded details'); assert.match(duplicate.change, /withheld/);
});
