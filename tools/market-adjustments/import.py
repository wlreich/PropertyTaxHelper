"""Validate a TCAD factor PDF and emit a reviewable, transactional annual SQL import.
Usage: python3 tools/market-adjustments/import.py YEAR PDF > annual.sql
Requires pdftotext. Exact neighborhood codes are preserved; no inferred crosswalks.
"""
import hashlib, json, re, subprocess, sys
from pathlib import Path

def parse(text):
    rows = []
    seen = set()
    body = text.split("Total NBHDs")[0]
    for page, content in enumerate(body.split("\f"), 1):
        for line in content.splitlines():
            if not line.strip() or any(x in line for x in ["Current Market", "Adjustment", "NBHD"]):
                continue
            match = re.fullmatch(r"\s*(.+?)\s+(\d+(?:\.\d+)?)\s*", line)
            if not match:
                raise ValueError(f"Unrecognized row on page {page}: {line!r}")
            code, raw = match.groups()
            if code in seen or not re.search('[A-Za-z]', code) or not 0 < float(raw) <= 10000:
                raise ValueError(f"Invalid or duplicate code/factor: {code!r}")
            seen.add(code)
            rows.append({"neighborhood": code, "factor_percent": raw, "page": page})
    if not rows:
        raise ValueError("No factors found")
    return rows

def sql(year, pdf):
    if not 2000 <= year <= 2200:
        raise ValueError("Invalid year")
    if pdf.name != f'{year}_Market_Adjustments.pdf':
        raise ValueError('Source filename must match the tax year')
    rows = parse(subprocess.check_output(['pdftotext', '-layout', str(pdf), '-'], text=True))
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    quote = lambda s: "'" + str(s).replace("'", "''") + "'"
    # Immutable annual editions: conflicts fail rather than silently overwriting history.
    out = [f"-- TCAD {year}; {len(rows)} exact codes; sha256 {sha}", "begin;",
           f"insert into public.market_adjustment_sources(tax_year,filename,sha256,row_count) values ({year},{quote(pdf.name)},{quote(sha)},{len(rows)});",
           "insert into public.neighborhood_market_adjustments(tax_year,neighborhood,factor_percent,source_page) values"]
    out.append(',\n'.join(f"({year},{quote(x['neighborhood'])},{x['factor_percent']},{x['page']})" for x in rows) + ';')
    out.append('commit;')
    return '\n'.join(out) + '\n'

if __name__ == '__main__':
    print(sql(int(sys.argv[1]), Path(sys.argv[2])), end='')
