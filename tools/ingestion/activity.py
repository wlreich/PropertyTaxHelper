#!/usr/bin/env python3
"""Allowlisted, year-scoped TCAD deed/sale extraction. No changes to protest imports."""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import date
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import uuid
import zipfile
import ijson
from ingest_tcad_special import select_member, property_id, ValidationError

VERSION = 'activity-1.0.0'
COLUMNS = ('property_id','kind','event_id','deed_id','event_date','date_raw','filed_date','instrument','type_code','qualification','source_of_sale','sale_price','adjusted_price','confidential','confidential_code','suppressed','suppression_code','multi_property','associated_properties','quarantine_reason','run_id')
NAMESPACE = uuid.UUID('df84d79f-1aa4-4c8c-a2a5-1916973870fe')


def parse_date(value):
    if value is None or value == '':
        return None
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}(?: 00:00:00)?', value):
        raise ValueError('Invalid transaction date')
    return date.fromisoformat(value[:10])


def price(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValidationError('Sale price must be numeric or null')
    n = Decimal(str(value))
    if not n.is_finite() or n < 0 or n > Decimal('1000000000000000') or n != n.quantize(Decimal('.01')):
        raise ValidationError('Invalid sale price')
    return str(n) if n > 0 else None


def text(value):
    if value is None or value == '':
        return None
    if not isinstance(value, str) or len(value) > 500 or re.search(r'[\x00-\x1f\x7f]', value):
        raise ValidationError('Invalid coded text')
    return value.strip() or None


def flag(value):
    if value is None:
        return None
    if value in (0, 1) and isinstance(value, (bool, int)):
        return bool(value)
    raise ValidationError('Invalid flag')


def associations(value, pid):
    if value is None:
        return [pid]
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
    except (ValueError, TypeError) as e:
        raise ValidationError('Invalid property associations') from e
    if not isinstance(parsed, list) or not parsed or len(parsed) > 10000:
        raise ValidationError('Invalid property associations')
    ids = sorted({property_id(x, 'associated property') for x in parsed})
    if pid not in ids:
        raise ValidationError('Parent property missing from associations')
    return ids


def observations(obj, year, exported):
    pid = property_id(obj.get('pID'), 'property pID')
    if obj.get('pYear') != year:
        raise ValidationError('Property year differs from declared year')
    result = []
    for kind, key, dt_key, id_key in [('deed', 'deeds', 'deedDt', 'deedID'), ('sale', 'sales', 'saleDt', 'saleID')]:
        items = obj.get(key)
        if not isinstance(items, list) or len(items) > 10000:
            raise ValidationError('Expected bounded deed/sale array')
        for item in items:
            if not isinstance(item, dict):
                raise ValidationError('Expected transaction object')
            raw = item.get(dt_key)
            # Preserve malformed target-year dates for quarantine, but don't import unrelated years.
            if not isinstance(raw, str) or not raw.startswith(str(year) + '-'):
                continue
            if property_id(item.get('pID'), 'transaction pID') != pid:
                raise ValidationError('Transaction belongs to another property')
            event_id = property_id(item.get(id_key), id_key)
            quarantine = None
            try:
                event_date = parse_date(raw)
            except ValueError:
                event_date = None
                quarantine = 'invalid_date'
            if event_date and event_date > exported:
                quarantine = 'future_date'
            try:
                filed = parse_date(item.get('fileDt')) if kind == 'deed' else None
            except ValueError:
                filed = None
            linked = associations(item.get('properties'), pid)
            deed_id = property_id(item['deedID'], 'deedID') if item.get('deedID') is not None else None
            record = dict(property_id=pid, kind=kind, event_id=event_id, deed_id=deed_id,
                event_date=event_date.isoformat() if event_date else None, date_raw=raw,
                filed_date=filed.isoformat() if filed else None, instrument=text(item.get('instrumentNum')),
                type_code=text(item.get('deedType' if kind == 'deed' else 'saleType')),
                qualification=text(item.get('saleQualify')) if kind == 'sale' else None,
                source_of_sale=text(item.get('sourceOfSale')) if kind == 'sale' else None,
                sale_price=price(item.get('salePrice')) if kind == 'sale' else None,
                adjusted_price=price(item.get('salePriceAdjusted')) if kind == 'sale' else None,
                confidential=flag(item.get('confidentialSale')) if kind == 'sale' else None,
                confidential_code=text(item.get('confidentialCode')) if kind == 'sale' else None,
                suppressed=flag(item.get('reportSupressFromReport')) if kind == 'sale' else None,
                suppression_code=text(item.get('reportSupressCode')) if kind == 'sale' else None,
                multi_property=(flag(item.get('multiProperty')) if kind == 'sale' else False),
                associated_properties=linked, quarantine_reason=quarantine)
            result.append(record)
    if len({(r['kind'], r['event_id']) for r in result}) != len(result):
        raise ValidationError('Duplicate event identifier on property')
    return result


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def extract(archive_path, dataset_id, expected_sha, year, output):
    uuid.UUID(dataset_id)
    if not re.fullmatch('[0-9a-f]{64}', expected_sha) or digest(archive_path) != expected_sha:
        raise ValidationError('Archive checksum does not match the approved dataset')
    output = Path(output)
    summary_path = output.with_suffix('.summary.json')
    if output.exists() or summary_path.exists():
        raise ValidationError('Output already exists; use a new destination')
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix('.partial')
    counts = Counter(); seen = set(); sale_ids = set(); priced_ids = set()
    try:
        with zipfile.ZipFile(archive_path) as archive:
            member = select_member(archive)
            match = re.search(r'protaxExport-(\d{8})\.json$', member.filename)
            if not match:
                raise ValidationError('Export date not present in member name')
            exported = date.fromisoformat(match[1])
            run_id = str(uuid.uuid5(NAMESPACE, f'{dataset_id}:{expected_sha}:{year}:{VERSION}'))
            with archive.open(member) as raw, tmp.open('x') as dest:
                for row, obj in enumerate(ijson.items(raw, 'item'), 1):
                    pid = property_id(obj.get('pID'), 'pID')
                    if pid in seen:
                        raise ValidationError('Duplicate property in archive')
                    seen.add(pid)
                    for event in observations(obj, year, exported):
                        event['run_id'] = run_id
                        dest.write(json.dumps(event, separators=(',', ':')) + '\n')
                        counts[event['kind']] += 1
                        if event['quarantine_reason']:
                            counts[event['quarantine_reason']] += 1
                        if event['kind'] == 'sale':
                            sale_ids.add(event['event_id'])
                            if event['sale_price'] is not None:
                                counts['priced_occurrences'] += 1
                                priced_ids.add(event['event_id'])
                    if row % 50000 == 0:
                        print(json.dumps({'properties': row, **counts}), flush=True)
                # zipfile validates the entire member CRC at EOF; ijson must also reach the closing array.
            summary = dict(run_id=run_id, dataset_id=dataset_id, archive_sha256=expected_sha,
                member_name=member.filename, export_date=exported.isoformat(), activity_year=year,
                parser_version=VERSION, property_count=len(seen), observation_count=sum(counts[k] for k in ('sale','deed')),
                counts=dict(counts), sale_ids=len(sale_ids), priced_sale_ids=len(priced_ids),
                member_crc32=f'{member.CRC:08x}', member_bytes=member.file_size,
                observations_sha256=digest(tmp))
        os.replace(tmp, output)
        summary_path.write_text(json.dumps(summary, indent=2))
        return summary
    except BaseException:
        tmp.unlink(missing_ok=True)
        # No completed summary means no loadable import.
        raise


def load(connection, path):
    """Atomically import a completed extraction; repeat runs are safe no-ops."""
    from psycopg.types.json import Jsonb
    path = Path(path); summary = json.loads(path.with_suffix('.summary.json').read_text())
    if digest(path) != summary['observations_sha256']:
        raise ValidationError('Extraction checksum mismatch')
    with connection.transaction():
        connection.execute('select pg_advisory_xact_lock(hashtextextended(%s,0))', (summary['run_id'],))
        source = connection.execute('select archive_sha256,status from tcad_ingest.datasets where id=%s', (summary['dataset_id'],)).fetchone()
        if source != (summary['archive_sha256'], 'ready'):
            raise ValidationError('Source is not the approved ready dataset')
        existing = connection.execute('select status,observations_sha256 from tcad_ingest.activity_imports where id=%s', (summary['run_id'],)).fetchone()
        if existing:
            if existing != ('complete', summary['observations_sha256']):
                raise ValidationError('Conflicting import; inspect before retrying')
            return summary
        connection.execute('''insert into tcad_ingest.activity_imports
            (id,dataset_id,archive_sha256,member_name,export_date,activity_year,parser_version,property_count,observation_count,observations_sha256,summary,status)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'loading')''',
            tuple(summary[k] for k in ['run_id','dataset_id','archive_sha256','member_name','export_date','activity_year','parser_version','property_count','observation_count','observations_sha256']) + (Jsonb(summary),))
        count = 0
        sql = 'insert into tcad_ingest.activity_observations (' + ','.join(COLUMNS) + ') values (' + ','.join(['%s']*len(COLUMNS)) + ')'
        # Bounded parameterized batches honor RLS; COPY FROM does not support RLS tables.
        with path.open() as f, connection.cursor() as cursor:
            batch = []
            for line in f:
                item = json.loads(line)
                if set(item) != set(COLUMNS) or item['run_id'] != summary['run_id']:
                    raise ValidationError('Observation schema or run mismatch')
                batch.append(tuple(item[k] for k in COLUMNS));count += 1
                if len(batch) == 500:
                    cursor.executemany(sql, batch);batch = []
            if batch:
                cursor.executemany(sql, batch)
        if count != summary['observation_count']:
            raise ValidationError('Observation count mismatch')
        connection.execute("update tcad_ingest.activity_imports set status='complete',completed_at=now() where id=%s", (summary['run_id'],))
    return summary


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive');p.add_argument('--archive-sha256');p.add_argument('--dataset-id')
    p.add_argument('--year', type=int);p.add_argument('--output', required=True)
    p.add_argument('--load', action='store_true', help='Load a previously completed extraction using TCAD_DATABASE_URL')
    p.add_argument('--stored-archive', action='store_true', help='Retrieve immutable archive from configured private TCAD storage')
    a = p.parse_args()
    if a.load:
        import psycopg
        with psycopg.connect(os.environ['TCAD_DATABASE_URL']) as conn:
            print(json.dumps(load(conn, a.output), indent=2))
    elif a.stored_archive:
        from archive_storage import ArchiveStorage, archive_key
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'source.zip'
            ArchiveStorage.from_environment().retrieve(archive_key(a.archive_sha256), source, a.archive_sha256)
            print(json.dumps(extract(source, a.dataset_id, a.archive_sha256, a.year, a.output), indent=2))
    else:
        print(json.dumps(extract(a.archive, a.dataset_id, a.archive_sha256, a.year, a.output), indent=2))

if __name__ == '__main__':
    main()
