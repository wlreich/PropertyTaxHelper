import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const sourceUrl = new URL('../../docs/protest-guide/source-2026-09-19.md', import.meta.url);
export const outputUrl = new URL('../src/content/protest-guide.json', import.meta.url);
const mapping = [
  ['tax-system', 'How the Texas property tax system works', [1]],
  ['annual-review', 'Why review and protest every year', [2]],
  ['timeline-deadlines', 'Timeline and deadlines', [3]],
  ['working-with-agent', 'Working with an agent', [4, 5]],
  ['diy-evidence', 'Build a strong DIY case', [6, 7, 8, 9, 10]],
  ['informal-review-records', 'Informal review and information requests', [11, 12]],
  ['arb-hearing', 'Your ARB hearing', [13, 14]],
  ['decisions-appeals', 'After the decision', [15, 16]],
];

function links(markdown) {
  return [...markdown.matchAll(/\[([^\]\n]+)\]\(<?(https:\/\/[^\s<>]+?)>?\)/g)]
    .map((match) => ({ label: match[1], url: match[2] }));
}

// Keep Markdown intact, including whole lists and tables. Renderers own typography.
function blocks(markdown, prefix) {
  return markdown.trim().split(/\n\n(?=### )/).map((text, index) => ({
    id: `${prefix}-block-${index + 1}`, markdown: text,
  }));
}

export function generateGuide(source) {
  const boundary = '\n## Editorial notes for ParcelSavvy\n';
  if (source.split(boundary).length !== 2) throw new Error('Missing or repeated editorial boundary');
  const publicSource = source.split(boundary)[0];
  const headings = [...publicSource.matchAll(/^## (\d+) (.+)$/gm)];
  if (headings.length !== 17 || headings.some((h, i) => Number(h[1]) !== i + 1)) {
    throw new Error('Expected source sections 1–17 exactly once in order');
  }
  const sections = headings.map((heading, index) => {
    const markdown = publicSource.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim();
    if (!markdown) throw new Error(`Empty section ${heading[1]}`);
    const id = `section-${heading[1].padStart(2, '0')}`;
    return { id, sourceSection: Number(heading[1]), title: heading[2], blocks: blocks(markdown, id), sourceLinks: links(markdown) };
  });
  const intro = publicSource.slice(0, headings[0].index).trim().split(/\n\n/);
  if (!intro[0].startsWith('# ') || !intro[1].startsWith('Draft for website content review') || !intro.at(-1).startsWith('**About this draft:**')) {
    throw new Error('Unexpected introduction; review public/editorial boundaries');
  }
  // The dated status is separate from the recurring planning calendar.
  const calendar = sections[2].blocks[0];
  const [statusMarkdown, ...calendarBody] = calendar.markdown.split('\n\n');
  if (!statusMarkdown.includes('2026') || !statusMarkdown.includes('2027') || !calendarBody.length) {
    throw new Error('Expected separate dated calendar status');
  }
  calendar.markdown = calendarBody.join('\n\n');
  const guide = {
    schemaVersion: 1,
    contentVersion: '2026-09-19.2',
    reviewedDate: '2026-09-19',
    title: intro[0].slice(2),
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    introduction: blocks(intro.slice(2, -1).join('\n\n'), 'introduction'),
    calendarStatus: { asOfDate: '2026-09-19', sourceSection: 3, placement: 'before-section-03', markdown: statusMarkdown, confirmedOperatingDates: [] },
    chapters: mapping.map(([id, title, numbers], index) => ({
      id, anchor: id, number: String(index + 1).padStart(2, '0'), title,
      sections: numbers.map((number) => sections[number - 1]),
      sourceLinks: numbers.flatMap((number) => sections[number - 1].sourceLinks),
    })),
    disclaimer: sections[16],
    sourceLinks: links(publicSource),
  };
  if (/Editorial notes for ParcelSavvy|About this draft|Draft for website content review/.test(JSON.stringify(guide))) {
    throw new Error('Editorial content entered public export');
  }
  return guide;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const expected = `${JSON.stringify(generateGuide(await readFile(sourceUrl, 'utf8')), null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if (await readFile(outputUrl, 'utf8') !== expected) throw new Error('Guide export is stale; run npm run guide:generate');
    console.log('Guide source and public export match.');
  } else {
    await mkdir(new URL('.', outputUrl), { recursive: true });
    await writeFile(outputUrl, expected);
    console.log('Generated shared public guide content.');
  }
}
