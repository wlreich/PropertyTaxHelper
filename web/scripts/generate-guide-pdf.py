"""Deterministic build-time PDF from the public PAR-13 contract. No network access."""
import hashlib
import html
import json
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont as Font
from fontTools.varLib.instancer import instantiateVariableFont
from markdown_it import MarkdownIt
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / 'src/content/protest-guide.json'
OUT = ROOT / 'public/guides/ParcelSavvy-Protest-Guide.pdf'
MANIFEST = ROOT / 'src/content/protest-guide-pdf.json'
GUIDE = json.loads(CONTENT.read_text())
rl_config.invariant = 1
NAVY = colors.HexColor('#0b2d4d')
INK = colors.HexColor('#173042')
MUTED = colors.HexColor('#52697a')
BLUE = colors.HexColor('#1769aa')
BORDER = colors.HexColor('#d7e1e8')
SKY = colors.HexColor('#f6f9fc')
WIDTH = 504
md = MarkdownIt('commonmark', {'html': False}).enable('table')


def register_fonts(directory):
    for name, filename, weight in [('Body', 'inter-latin-wght-normal.woff2', 400), ('BodyBold', 'inter-latin-wght-normal.woff2', 600), ('Heading', 'manrope-latin-wght-normal.woff2', 700)]:
        font = instantiateVariableFont(Font(ROOT / 'fonts' / filename), {'wght': weight}, inplace=True)
        font.flavor = None
        target = Path(directory) / f'{name}.ttf'
        font.save(target)
        pdfmetrics.registerFont(TTFont(name, target))
    pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')


BODY = ParagraphStyle('Body', fontName='Body', fontSize=10.5, leading=14, textColor=INK, spaceAfter=7, allowWidows=0, allowOrphans=0)
SMALL = ParagraphStyle('Small', parent=BODY, fontSize=9, leading=12, spaceAfter=5)
TITLE = ParagraphStyle('Title', parent=BODY, fontName='Heading', fontSize=28, leading=34, textColor=NAVY, spaceAfter=18)
H1 = ParagraphStyle('Chapter', parent=BODY, fontName='Heading', fontSize=22, leading=28, textColor=NAVY, spaceAfter=16, keepWithNext=True)
H2 = ParagraphStyle('Section', parent=H1, fontSize=15, leading=20, spaceBefore=10, spaceAfter=10)
H3 = ParagraphStyle('Subsection', parent=H2, fontSize=12, leading=17)
CELL = ParagraphStyle('Cell', parent=SMALL, fontSize=9, leading=12, spaceAfter=0)
FOUNDER = ParagraphStyle('Founder', parent=BODY, borderColor=BORDER, borderWidth=1, borderPadding=10, backColor=SKY, spaceBefore=12, spaceAfter=16)


def inline(tokens):
    output = []
    for token in tokens or []:
        kind = token.type
        if kind in ('text', 'code_inline'):
            output.append(html.escape(token.content.replace('→', '->')))
        elif kind in ('softbreak', 'hardbreak'):
            output.append(' ' if kind == 'softbreak' else '<br/>')
        elif kind in ('strong_open', 'strong_close'):
            output.append('<b>' if kind.endswith('open') else '</b>')
        elif kind in ('em_open', 'em_close'):
            output.append('<i>' if kind.endswith('open') else '</i>')
        elif kind == 'link_open':
            url = token.attrGet('href')
            if not url.startswith(('https://', 'http://')):
                raise ValueError(f'Unsupported link: {url}')
            output.append(f'<a href="{html.escape(url, quote=True)}" color="#1769aa"><u>')
        elif kind == 'link_close':
            output.append('</u></a>')
        else:
            raise ValueError(f'Unsupported inline token: {kind}')
    return ''.join(output)


def blocks(markdown):
    tokens = md.parse(markdown)
    result, lists = [], []
    index, bullet = 0, None
    while index < len(tokens):
        token = tokens[index]
        if token.type in ('bullet_list_open', 'ordered_list_open'):
            lists.append(int(token.attrGet('start') or 1) if token.type == 'ordered_list_open' else None)
        elif token.type in ('bullet_list_close', 'ordered_list_close'):
            lists.pop()
        elif token.type == 'list_item_open':
            bullet = '•' if lists[-1] is None else f'{lists[-1]}.'
            if lists[-1] is not None:
                lists[-1] += 1
        elif token.type == 'inline':
            previous = tokens[index - 1]
            style = H3 if previous.type == 'heading_open' else BODY
            if token.content.startswith('**From the founder'):
                style = FOUNDER
            if lists:
                style = ParagraphStyle('List', parent=BODY, leftIndent=17, bulletIndent=0)
            result.append(Paragraph(inline(token.children), style, bulletText=bullet))
            bullet = None
        elif token.type == 'table_open':
            rows, row, is_header = [], [], False
            index += 1
            while tokens[index].type != 'table_close':
                current = tokens[index]
                if current.type == 'thead_open':
                    is_header = True
                elif current.type == 'thead_close':
                    is_header = False
                elif current.type == 'tr_open':
                    row = []
                elif current.type == 'inline':
                    value = inline(current.children)
                    row.append(Paragraph(f'<b>{value}</b>' if is_header else value, CELL))
                elif current.type == 'tr_close':
                    rows.append(row)
                index += 1
            columns = len(rows[0])
            widths = [WIDTH * ratio for ratio in ([.34, .33, .33] if columns == 3 else [.37, .21, .21, .21])]
            table = Table(rows, colWidths=widths, repeatRows=1, hAlign='LEFT', spaceBefore=8, spaceAfter=14)
            table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), SKY), ('GRID', (0, 0), (-1, -1), .5, BORDER), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 7), ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
            result.append(table)
        elif token.type not in ('paragraph_open', 'paragraph_close', 'heading_open', 'heading_close', 'list_item_close'):
            raise ValueError(f'Unsupported block token: {token.type}')
        index += 1
    return result


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.line(54, 44, 558, 44)
    canvas.setFont('Body', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(54, 30, f'ParcelSavvy • Reviewed {GUIDE["reviewedDate"]} • Version {GUIDE["contentVersion"]}')
    canvas.drawRightString(558, 30, str(doc.page))
    canvas.restoreState()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        register_fonts(directory)
        story = [Paragraph(html.escape(GUIDE['title']), TITLE), Paragraph('Travis County, Texas', H2), Paragraph(f'Reviewed September 19, 2026 · Content version {GUIDE["contentVersion"]}', SMALL), Spacer(1, 15)]
        for block in GUIDE['introduction']:
            story.extend(blocks(block['markdown']))
        story.extend([Spacer(1, 12), Paragraph('In this guide', H2)])
        for chapter in GUIDE['chapters']:
            story.append(Paragraph(f'<a href="#{chapter["anchor"]}" color="#1769aa">{chapter["number"]}  {html.escape(chapter["title"])}</a>', BODY))
        story.append(Paragraph('Educational guidance, not legal, tax or appraisal advice. Examples are hypothetical. Follow your own notices and current requirements.', SMALL))
        for chapter in GUIDE['chapters']:
            story.extend([PageBreak(), Paragraph(f'<a name="{chapter["anchor"]}"/>{chapter["number"]}  {html.escape(chapter["title"])}', H1)])
            for section in chapter['sections']:
                story.append(Paragraph(html.escape(section['title']), H2))
                if section['sourceSection'] == GUIDE['calendarStatus']['sourceSection']:
                    story.extend(blocks(GUIDE['calendarStatus']['markdown']))
                for block in section['blocks']:
                    story.extend(blocks(block['markdown']))
        story.extend([PageBreak(), Paragraph(html.escape(GUIDE['disclaimer']['title']), H1)])
        for block in GUIDE['disclaimer']['blocks']:
            story.extend(blocks(block['markdown']))
        document = SimpleDocTemplate(str(OUT), pagesize=(612, 792), leftMargin=54, rightMargin=54, topMargin=44, bottomMargin=54, title=GUIDE['title'], author='ParcelSavvy', subject=f'Content {GUIDE["contentVersion"]}; reviewed {GUIDE["reviewedDate"]}')
        document.build(story, onFirstPage=footer, onLaterPages=footer)
    files = ['src/content/protest-guide.json', 'scripts/generate-guide-pdf.py', 'scripts/guide-pdf-requirements.txt', 'fonts/inter-latin-wght-normal.woff2', 'fonts/manrope-latin-wght-normal.woff2']
    manifest = {'contentVersion': GUIDE['contentVersion'], 'reviewedDate': GUIDE['reviewedDate'], 'sha256': hashlib.sha256(OUT.read_bytes()).hexdigest(), 'inputs': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files}}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Generated {OUT.name}: {OUT.stat().st_size} bytes')


if __name__ == '__main__':
    main()
