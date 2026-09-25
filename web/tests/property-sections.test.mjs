import test from 'node:test';
import assert from 'node:assert/strict';
import { annualChange, capModel, factorEffectContent, factorEligibilityNote, hasPreliminaryValueDriverExplanation, preliminaryValueDriverComparison, preliminaryValueDriverSummary, propertyFeatures, valueDriverSummary } from '../src/lib/property-sections.ts';
import { par9Reference } from '../../tools/property-search/par9-reference-fixture.mjs';
import { reference as par28Reference } from '../../tools/property-search/par28-reference.mjs';
import { parseHistory } from '../src/lib/property-history.ts';
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
  assert.equal(m.capExplanation, 'If your home qualified for a homestead exemption last year and this year, the cap generally limits increases in its appraised value to 10%, plus new improvements. Its market value can still rise more.');
  assert.equal(m.accuracyGuidance, 'The cap limits increases in assessed value. It does not tell you whether the Appraisal District’s market value is right.');
});
test('binding, nonbinding, unconfirmed eligibility and no homestead have distinct guidance', () => {
  assert.equal(capModel({ ...current, market_value: current.assessed_value }, previous).state, 'nonbinding');
  const noHS = { ...current, exemptions: [], entities: [] };
  assert.equal(capModel(noHS, previous).state, 'no-homestead');
  assert.doesNotMatch(capModel(noHS, previous).paragraphs.join(' '), /Your cap limits|next year's cap/);
  const newHS = capModel({ ...current, market_value: current.assessed_value }, { ...previous, exemptions: [], entities: [] });
  assert.equal(newHS.state, 'eligibility-unconfirmed');
  assert.equal(newHS.outlook, null);
  assert.equal(newHS.capExplanation, null);
  assert.equal(newHS.accuracyGuidance, null);
  assert.equal(newHS.priorAssessed, null);
  const newBindingHS = capModel(current, { ...previous, exemptions: [], entities: [] });
  assert.equal(newBindingHS.state, 'eligibility-unconfirmed');
  assert.equal(newBindingHS.outlook, null);
  assert.equal(capModel({ ...current, market_value: current.assessed_value }).state, 'eligibility-unconfirmed');
  assert.equal(capModel({ ...current, roll_stage:'preliminary' }, previous).accuracyGuidance, null);
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
test('Value drivers uses the first explicitly eligible preliminary pair instead of certified outcomes', () => {
  const list = parseHistory(par28Reference.overview.history);
  const result = preliminaryValueDriverComparison(list, 2026);
  assert.equal(result.status, 'ok');
  assert.equal(result.previous.export_date, '2025-05-08');
  assert.equal(result.current.export_date, '2026-04-02');
  assert.equal(result.previous.improvement_value, 800000);
  assert.equal(result.current.improvement_value, 1000000);
  assert.notEqual(result.current.improvement_value, list.find(s => s.tax_year === 2026 && s.roll_stage === 'certified').improvement_value);
  assert.equal(preliminaryValueDriverSummary(result), 'Land stayed the same. The preliminary value of your home and other features rose by $200,000 from last year.');
  assert.equal(hasPreliminaryValueDriverExplanation(result.current, result), true);
  assert.equal(hasPreliminaryValueDriverExplanation(list.find(s => s.tax_year === 2026 && s.roll_stage === 'certified'), result), true);
  assert.equal(hasPreliminaryValueDriverExplanation({...result.current, dataset_id:'later-interim', preliminary_baseline_eligible:false}, result), false);
});
test('Value drivers treats absent eligibility and unusable components as unavailable without changing history fallback', () => {
  const list = parseHistory(par28Reference.overview.history);
  const unknown = list.map(s => s.roll_stage === 'preliminary' ? {...s, preliminary_baseline_eligible:undefined} : s);
  assert.match(preliminaryValueDriverSummary(preliminaryValueDriverComparison(unknown, 2026)), /not confirmed for both 2025 and 2026/);
  const missing = list.map(s => s.tax_year === 2025 && s.roll_stage === 'preliminary' && s.preliminary_baseline_eligible === true ? {...s, improvement_value:null} : s);
  assert.match(preliminaryValueDriverSummary(preliminaryValueDriverComparison(missing, 2026)), /values are missing/);
  const moved = list.map(s => s.tax_year === 2025 && s.roll_stage === 'preliminary' ? {...s, neighborhood:'OTHER'} : s);
  assert.match(preliminaryValueDriverSummary(preliminaryValueDriverComparison(moved, 2026)), /same market area is not confirmed/);
});
test('preliminary summary adapts to rising, falling and unchanged land and home values', () => {
  const list = parseHistory(par28Reference.overview.history);
  const original = preliminaryValueDriverComparison(list, 2026);
  assert.equal(original.status, 'ok');
  const withCurrent = values => ({status:'ok', previous:original.previous, current:{...original.current,...values}});
  assert.equal(preliminaryValueDriverSummary(withCurrent({land_value:250000, improvement_value:700000})), 'Land rose by $50,000. The preliminary value of your home and other features fell by $100,000 from last year.');
  assert.equal(preliminaryValueDriverSummary(withCurrent({land_value:150000, improvement_value:800000})), 'Land fell by $50,000. The preliminary value of your home and other features stayed the same from last year.');
});
test('factor effect content preserves signs, zero and proportional factor segments', () => {
  const positive = factorEffectContent(2026, 1.5, 1.8, 120000);
  assert.match(positive.intro, /estimated \+\$120,000/);
  assert.equal(positive.previousDifferenceWidth, 0);
  assert.ok(Math.abs(positive.sharedWidth - 83.33333333333334) < 0.0001);
  assert.ok(Math.abs(positive.currentDifferenceWidth - 16.666666666666668) < 0.0001);
  const negative = factorEffectContent(2026, 1.8, 1.5, -40000);
  assert.match(negative.intro, /estimated −\$40,000/);
  assert.ok(negative.previousDifferenceWidth > 0);
  assert.equal(negative.currentDifferenceWidth, 0);
  const zero = factorEffectContent(2026, 1.5, 1.5, 0);
  assert.match(zero.intro, /estimated \$0/);
  assert.equal(zero.sharedWidth, 100);
  assert.equal(factorEffectContent(2026, 1.5, 1.8, null), null);
});
test('factor eligibility note reports only source dates that exist', () => {
  assert.equal(factorEligibilityNote(2026, '2026-04-02', '2025-05-08'), 'Eligibility checked against preliminary records dated May 8, 2025 and Apr 2, 2026. The supported factor estimate holds the 2026 building inputs constant.');
  assert.equal(factorEligibilityNote(2026, '2026-04-02', null), 'Eligibility checked against the current-year preliminary record dated Apr 2, 2026. The supported factor estimate holds the 2026 building inputs constant.');
  assert.equal(factorEligibilityNote(2026, null, '2025-05-08'), null);
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
