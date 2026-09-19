import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { generateGuide, sourceUrl, outputUrl } from '../scripts/generate-protest-guide.mjs';

const source = await readFile(sourceUrl, 'utf8');
const guide = JSON.parse(await readFile(outputUrl, 'utf8'));
const sections = [...guide.chapters.flatMap((chapter) => chapter.sections), guide.disclaimer];

test('all 17 approved sections survive exactly once, including tables, templates and hearing account', () => {
  assert.deepEqual(sections.map((section) => section.sourceSection), Array.from({ length: 17 }, (_, i) => i + 1));
  const originals = source.split(/^## /m).slice(1, 18);
  sections.forEach((section, index) => {
    const [heading, ...body] = originals[index].split('\n');
    let exported = section.blocks.map((block) => block.markdown).join('\n\n');
    if (index === 2) exported = `${guide.calendarStatus.markdown}\n\n${exported}`;
    assert.equal(`${section.sourceSection} ${section.title}`, heading);
    assert.equal(exported, body.join('\n').trim(), `Source section ${index + 1} changed`);
  });
});

test('chapter mapping, anchors and disclaimer are stable', () => {
  assert.deepEqual(guide.chapters.map((chapter) => [chapter.id, chapter.sections.map((section) => section.sourceSection)]), [
    ['tax-system', [1]], ['annual-review', [2]], ['timeline-deadlines', [3]],
    ['working-with-agent', [4, 5]], ['diy-evidence', [6, 7, 8, 9, 10]],
    ['informal-review-records', [11, 12]], ['arb-hearing', [13, 14]], ['decisions-appeals', [15, 16]],
  ]);
  const ids = [...guide.chapters.map((chapter) => chapter.anchor), ...sections.map((section) => section.id), ...sections.flatMap((section) => section.blocks.map((block) => block.id))];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(guide.disclaimer.sourceSection, 17);
});

test('public export preserves source URLs and excludes internal instructions', () => {
  const urls = [...source.split('\n## Editorial notes')[0].matchAll(/https:\/\/[^<>\s)]+/g)].map((match) => match[0]);
  assert.deepEqual(guide.sourceLinks.map((link) => link.url), urls);
  assert.doesNotMatch(JSON.stringify(guide), /About this draft|Draft for website content review|Editorial notes|Recommended site structure|Publication review/);
  assert.equal(guide.reviewedDate, '2026-09-19');
  assert.deepEqual(guide.calendarStatus.confirmedOperatingDates, []);
  assert.match(guide.calendarStatus.markdown, /2027/);
  assert.doesNotMatch(guide.chapters[2].sections[0].blocks.map((block) => block.markdown).join('\n'), /2026|2027/);
});

test('committed export is reproducible and fails closed on incomplete sources', () => {
  assert.deepEqual(generateGuide(source), guide);
  assert.throws(() => generateGuide(source.replace('## 8 ', '## 7 ')), /exactly once/);
  assert.throws(() => generateGuide(source.split('## 17 ')[0]), /editorial boundary/);
  assert.throws(() => generateGuide(source.replace('## 17 ', '### 17 ')), /exactly once/);
  assert.throws(() => generateGuide(source.replace('**About this draft:**', '**Changed editorial boundary:**')), /introduction/);
});
