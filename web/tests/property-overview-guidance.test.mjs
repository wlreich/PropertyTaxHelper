import test from 'node:test';
import assert from 'node:assert/strict';
import { annualReviewCopy, annualReviewPrompt } from '../src/lib/property-overview-guidance.ts';

const season = {
  config: {
    county: 'travis', tax_year: 2027, starts_on: '2027-04-02', filing_deadline: '2027-05-15',
    post_starts_on: '2027-08-01', deadline_source: 'https://traviscad.org/protests', verified_on: '2027-04-01',
    mode: 'automatic', manual_phase: null, published: true, revision: 1,
  },
  phase: 'preliminary',
};

test('verified current preliminary season uses the filing-window prompt', () => {
  assert.deepEqual(
    annualReviewPrompt({ tax_year: 2027, roll_stage: 'preliminary' }, season, false, '2027-05-15'),
    { variant: 'active', copy: annualReviewCopy.active },
  );
  for (const changed of [
    { phase: 'protest' },
    { config: { ...season.config, verified_on: null } },
    { config: { ...season.config, deadline_source: null } },
    { config: { ...season.config, published: false } },
  ]) {
    const context = { ...season, ...changed, config: { ...season.config, ...(changed.config ?? {}) } };
    assert.equal(annualReviewPrompt({ tax_year: 2027, roll_stage: 'preliminary' }, context, false, '2027-05-15').variant, 'neutral');
  }
  assert.equal(annualReviewPrompt({ tax_year: 2027, roll_stage: 'preliminary' }, season, false, '2027-05-16').variant, 'neutral');
  assert.equal(annualReviewPrompt({ tax_year: 2027, roll_stage: 'preliminary' }, season, true, '2027-05-15').variant, 'neutral');
});

test('certified post-season record uses the next-year prompt without promising a repeat result', () => {
  const result = annualReviewPrompt(
    { tax_year: 2027, roll_stage: 'certified' },
    { ...season, phase: 'post' },
    false,
    '2027-09-01',
  );
  assert.deepEqual(result, { variant: 'certified', copy: annualReviewCopy.certified });
  assert.doesNotMatch(result.copy, /guarantee|tax savings|caused/i);
});

test('missing season, stale record, post-deadline preliminary, and unavailable data stay neutral', () => {
  const post = { ...season, phase: 'post' };
  for (const [record, context, unavailable] of [
    [{ tax_year: 2027, roll_stage: 'preliminary' }, null, false],
    [{ tax_year: 2026, roll_stage: 'certified' }, post, false],
    [{ tax_year: 2027, roll_stage: 'preliminary' }, post, false],
    [{ tax_year: 2027, roll_stage: 'certified' }, post, true],
  ]) {
    assert.deepEqual(annualReviewPrompt(record, context, unavailable, '2027-09-01'), { variant: 'neutral', copy: annualReviewCopy.neutral });
  }
});
