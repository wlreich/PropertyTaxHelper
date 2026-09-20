"""Verify the shipped PDF's public content and linked sources (no browser required)."""
import json
import re
from pathlib import Path
from pypdf import PdfReader
from markdown_it import MarkdownIt
root = Path(__file__).resolve().parents[1]
guide = json.loads((root / 'src/content/protest-guide.json').read_text())
pdf = PdfReader(root / 'public/guides/ParcelSavvy-Protest-Guide.pdf')
text = '\n'.join(page.extract_text() for page in pdf.pages)
normalized = lambda value: re.sub(r'\s+', '', value.replace('→', '->'))
all_text = normalized('\n'.join('\n'.join(page.extract_text().splitlines()[2:]) for page in pdf.pages))
md = MarkdownIt('commonmark').enable('table')
blocks = guide['introduction'] + [{'markdown':guide['calendarStatus']['markdown']}] + [b for c in guide['chapters'] for s in c['sections'] for b in s['blocks']] + guide['disclaimer']['blocks']
for block in blocks:
    for token in md.parse(block['markdown']):
        if token.type == 'inline':
            plain = ''.join(t.content if t.type in ('text','code_inline') else ' ' if t.type in ('softbreak','hardbreak') else '' for t in token.children)
            assert normalized(plain) in all_text, plain[:100]
for chapter in guide['chapters']:
    assert normalized(chapter['title']) in all_text
for excluded in ['Editorial notes for ParcelSavvy', 'Draft for website content review', 'About this draft']:
    assert excluded not in text
assert guide['contentVersion'] in text and guide['reviewedDate'] in text
urls = set()
for index, page in enumerate(pdf.pages):
    assert list(page.mediabox) == [0, 0, 612, 792]
    assert len(page.extract_text()) > 150
    assert page.extract_text().splitlines()[1] == str(index + 1), f"Missing/wrong page number: {index + 1}"
    for ref in page.get('/Annots', []):
        annotation = ref.get_object()
        if annotation.get('/A', {}).get('/URI'):
            urls.add(annotation['/A']['/URI'])
for source in guide['sourceLinks']:
    assert source['url'] in urls, source['url']
print(f'PDF passed: {len(pdf.pages)} Letter pages, all public prose/tables and {len(urls)} source URLs preserved; editorial notes excluded.')

# The contents links must land on the chapter itself, not merely a valid page.
contents = [ref.get_object()['/Dest'] for ref in pdf.pages[0].get('/Annots', []) if '/Dest' in ref.get_object()]
assert len(contents) == len(guide['chapters'])
for chapter, destination in zip(guide['chapters'], contents):
    target = next((page for page in pdf.pages if page.indirect_reference == destination[0]), None)
    assert target is not None, chapter['title']
    assert normalized(chapter['title']) in normalized(target.extract_text()), chapter['title']
print('Contents destinations and consecutive page numbering passed.')
