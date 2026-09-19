import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'src/content/protest-guide-pdf.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
for (const [file, expected] of Object.entries(manifest.inputs)) {
  if (hash(await readFile(resolve(root, file))) !== expected) throw new Error(`PDF input changed: ${file}. Run npm run guide:pdf and commit the PDF and manifest.`);
}
const pdf = await readFile(resolve(root, 'public/guides/ParcelSavvy-Protest-Guide.pdf'));
if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')) || hash(pdf) !== manifest.sha256) throw new Error('Missing or changed guide PDF; regenerate the reviewed artifact.');
const guide = JSON.parse(await readFile(resolve(root, 'src/content/protest-guide.json'), 'utf8'));
if (guide.contentVersion !== manifest.contentVersion || guide.reviewedDate !== manifest.reviewedDate) throw new Error('PDF content metadata is stale.');
console.log(`PDF verified: shared content ${manifest.contentVersion}, all input and output hashes match.`);
