#!/usr/bin/env python3
"""Comprehensive TCAD archive validation and resumable private PostgreSQL loading."""
from __future__ import annotations
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tempfile
import uuid
import zipfile

from chronology import read_receipt, zip_clock, utc_now

PARSER_VERSION = '1.1.1'
MAX_RECORD_BYTES = 16 * 1024 * 1024
LAYOUT_PATH = Path(__file__).with_name('tcad-layout.json')


class ValidationError(Exception):
    """Messages contain structural metadata only, never source field values."""


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_layout(path=LAYOUT_PATH):
    payload = Path(path).read_bytes()
    layout = json.loads(payload)
    return layout, hashlib.sha256(payload).hexdigest()


def inventory(archive, layout):
    members, matched, names = [], set(), set()
    for item in archive.infolist():
        name = PurePosixPath(item.filename)
        if name.is_absolute() or '..' in name.parts or '\\' in item.filename:
            raise ValidationError('Unsafe archive member path')
        if item.is_dir():
            continue
        if item.filename.casefold() in names:
            raise ValidationError('Duplicate archive member name')
        names.add(item.filename.casefold())
        matches = [(p, s) for p, s in layout['files'].items()
                   if (fnmatch.fnmatchcase(name.name.upper(), p.upper())
                       or name.name.upper() in {alias.upper() for alias in s.get('filename_aliases', [])})]
        if len(matches) > 1:
            raise ValidationError('Ambiguous member layout')
        if matches:
            pattern, spec = matches[0]
            if pattern in matched:
                raise ValidationError('More than one member for a documented file type')
            matched.add(pattern)
        elif name.suffix.lower() == '.pdf':
            spec = None  # Binary documents are hashed and retained in the original ZIP.
        else:
            raise ValidationError('Undocumented member type: update the layout before loading')
        members.append((item, spec))
    if matched != set(layout['files']):
        raise ValidationError('Archive is missing one or more of the 20 documented text files')
    if sum(i.file_size for i, _ in members) > 100 * 1024**3:
        raise ValidationError('Archive exceeds the 100 GiB uncompressed validation limit')
    return members


def parse_record(raw, spec, encoding='ascii'):
    if b'\x00' in raw:
        raise ValidationError('NUL byte cannot be stored in PostgreSQL text')
    if spec['format'] == 'fixed-width':
        if len(raw) != spec['record_length']:
            raise ValidationError('Fixed-width record length mismatch')
        values = [raw[f['start'] - 1:f['end']].decode(encoding) for f in spec['fields']]
    else:
        values = raw.decode('utf-8').split('\t')
        if len(values) == len(spec['fields']) + 1 and values[-1] == '':
            values.pop()
        if len(values) != len(spec['fields']):
            raise ValidationError('Tab-delimited field count mismatch')
    # All nonblank fields, including contact fields and filler slots, are retained.
    # Exact padding, blanks, bytes and line endings remain in the archived ZIP.
    return {field['name']: value.strip() for field, value in zip(spec['fields'], values)
            if value.strip()}


def scan_member(archive, item, spec, year, encoding, consume=None):
    hasher, count, serialized_bytes = hashlib.sha256(), 0, 0
    with archive.open(item) as stream:
        if spec is None:
            while chunk := stream.read(1024 * 1024):
                hasher.update(chunk)
        else:
            while raw := stream.readline(MAX_RECORD_BYTES + 3):
                count += 1
                hasher.update(raw)
                if len(raw) > MAX_RECORD_BYTES + 2:
                    raise ValidationError(f'{spec["worksheet"]} row {count}: record exceeds size limit')
                raw = raw.removesuffix(b'\n').removesuffix(b'\r')
                try:
                    fields = parse_record(raw, spec, encoding)
                    record_year = fields.get('prop_val_yr')
                    if record_year and int(record_year) != year:
                        raise ValidationError('Record year differs from the declared dataset year')
                except (UnicodeError, ValueError, ValidationError) as error:
                    raise ValidationError(f'{spec["worksheet"]} row {count}: invalid encoding, width, fields, or year') from error
                if consume:
                    consume(count, fields)
                else:
                    serialized_bytes += len(json.dumps(fields,ensure_ascii=False).encode('utf-8'))
    return {'sha256': hasher.hexdigest(), 'rows': count,
            'uncompressed_bytes': item.file_size, 'serialized_fields_bytes':serialized_bytes,
            'record_type': spec['worksheet'] if spec else 'archive_only_pdf', **zip_clock(item)}


def check_header(archive, members, layout, year, encoding):
    item, spec = next((i, s) for i, s in members if s and s['worksheet'] == 'Header')
    rows = []
    scan_member(archive, item, spec, year, encoding, lambda _, f: rows.append(f))
    if len(rows) != 1:
        raise ValidationError('Header must contain exactly one record')
    header = rows[0]
    if header.get('appraisal_year') != str(year):
        raise ValidationError('Header appraisal year does not match --year')
    if header.get('export_version') != layout['expected_export_version']:
        raise ValidationError('Export version is not supported by this pinned layout')
    # Retain NO VALUES if present; full ingestion is valid even for that variant.
    # Do not infer preliminary/certified status from supplement number zero.
    return header


def retain_archive(source, store, expected_sha):
    store = Path(store).resolve()
    store.mkdir(parents=True, exist_ok=True)
    target = store / (expected_sha + '.zip')
    if target.exists():
        if digest(target) != expected_sha:
            raise ValidationError('Existing archived object has the wrong checksum')
        return target
    fd, temporary = tempfile.mkstemp(prefix='.tcad-', dir=store)
    try:
        with os.fdopen(fd, 'wb') as output, Path(source).open('rb') as stream:
            shutil.copyfileobj(stream, output, 1024 * 1024)
            output.flush()
            os.fsync(output.fileno())
        if digest(temporary) != expected_sha:
            raise ValidationError('Archive changed while being retained')
        try:
            os.link(temporary, target)  # Never overwrite an existing archive.
        except FileExistsError:
            if digest(target) != expected_sha:
                raise ValidationError('Concurrent archive retention checksum conflict')
        return target
    finally:
        Path(temporary).unlink(missing_ok=True)


def load_postgres(archive, members, header, layout_sha, archive_sha, archived_path, args, connection, attempt_id):
    import psycopg
    from psycopg.types.json import Jsonb
    lock_key = int.from_bytes(hashlib.sha256((archive_sha + layout_sha + PARSER_VERSION + args.encoding).encode()).digest()[:8], 'big', signed=True)
    summary = {}
    if not connection.execute('select pg_try_advisory_lock(%s)', (lock_key,)).fetchone()[0]:
        raise ValidationError('Another loader is already processing this dataset')
    row = connection.execute('''select id, tax_year, roll_stage, source_url from tcad_ingest.datasets
      where archive_sha256=%s and layout_sha256=%s and parser_version=%s and source_encoding=%s''',
      (archive_sha, layout_sha, PARSER_VERSION, args.encoding)).fetchone()
    if row:
        dataset_id = row[0]
        if row[1:] != (args.year, args.roll_stage, args.source_url):
            raise ValidationError('Existing dataset metadata differs; do not relabel a release')
    else:
        dataset_id = uuid.uuid4()
        connection.execute('''insert into tcad_ingest.datasets
          (id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,source_url,archive_location,header)
          values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
          (dataset_id, archive_sha, layout_sha, PARSER_VERSION, args.encoding, args.year, args.roll_stage,
           args.source_url, str(archived_path), Jsonb(header)))
    record_event(connection, attempt_id, 'dataset_selected', dataset_id=dataset_id)
    try:
        connection.execute("update tcad_ingest.datasets set status='loading', completed_at=null, last_error=null where id=%s", (dataset_id,))
        for item, spec in members:
            previous = connection.execute('''select sha256,row_count,uncompressed_bytes,status from tcad_ingest.files
              where dataset_id=%s and member_name=%s''', (dataset_id, item.filename)).fetchone()
            if previous:
                if previous[3] != 'complete' or previous[2] != item.file_size:
                    raise ValidationError('Stored member state is inconsistent; investigate before retry')
                summary[item.filename] = {'rows': previous[1], 'sha256': previous[0], 'resumed': True}
                continue
            # One transaction per file. Insert or parse failure rolls the entire file back.
            with connection.transaction():
                connection.execute('''insert into tcad_ingest.files
                  (dataset_id,member_name,record_type,uncompressed_bytes,zip_modified_raw,zip_modified_local) values (%s,%s,%s,%s,%s,%s)''',
                  (dataset_id,item.filename,spec['worksheet'] if spec else None,item.file_size,
                   Jsonb(zip_clock(item)['zip_modified_raw']),zip_clock(item)['zip_modified_local']))
                if spec:
                    # COPY FROM is unavailable on RLS-protected tables. Psycopg
                    # pipelines each executemany batch while retaining RLS checks.
                    batch, batch_bytes = [], 0
                    with connection.cursor() as cursor:
                        def flush():
                            nonlocal batch_bytes
                            if batch:
                                cursor.executemany('insert into tcad_ingest.records\n                                      (dataset_id,member_name,row_number,prop_id,prop_val_yr,fields)\n                                      values (%s,%s,%s,%s,%s,%s)', batch)
                                batch.clear()
                                batch_bytes = 0
                        def consume(number, fields):
                            nonlocal batch_bytes
                            batch.append((dataset_id,item.filename,number,fields.get('prop_id'),
                                          fields.get('prop_val_yr'),Jsonb(fields)))
                            batch_bytes += sum(len(k) + len(v) for k,v in fields.items())
                            if len(batch) >= 100 or batch_bytes >= 1024 * 1024:
                                flush()
                        result = scan_member(archive,item,spec,args.year,args.encoding,consume)
                        flush()
                else:
                    result = scan_member(archive,item,spec,args.year,args.encoding)
                connection.execute("""update tcad_ingest.files set status='complete',sha256=%s,row_count=%s
                  where dataset_id=%s and member_name=%s""",
                  (result['sha256'],result['rows'],dataset_id,item.filename))
                summary[item.filename] = result
        connection.execute("update tcad_ingest.datasets set status='ready',completed_at=now() where id=%s", (dataset_id,))
    except Exception as error:
        try:
            connection.execute("update tcad_ingest.datasets set status='failed',last_error=%s where id=%s",
                               (type(error).__name__,dataset_id))
        except psycopg.Error:
            # A lost connection can leave the dataset loading; views hide it.
            # Preserve the original failure rather than masking it.
            pass
        raise
    return {'dataset_id': str(dataset_id), 'files': summary, 'status': 'ready'}


def run_validated(args, connection=None, attempt_id=None):
    layout, layout_sha = read_layout()
    archive_sha = digest(args.archive)
    if args.expected_sha256 and archive_sha != args.expected_sha256.lower():
        raise ValidationError('Archive SHA-256 does not match the approved checksum')
    try:
        observation = read_receipt(getattr(args,'receipt',None),archive_sha,args.source_url)
    except (ValueError,KeyError,TypeError) as error:
        raise ValidationError('Invalid acquisition receipt: check checksum, URL, dates and evidence') from error
    if connection:
        receipt_sha = record_acquisition(connection,observation)
        record_event(connection,attempt_id,'archive_verified',
                     acquisition_receipt_sha256=receipt_sha,details={'archive_sha256':archive_sha})
    path = Path(args.archive)
    if args.load:
        if not args.expected_sha256 or not (args.archive_store or getattr(args,'archive_backend',None)):
            raise ValidationError('--load requires --expected-sha256 and --archive-store')
        backend=getattr(args,'archive_backend',None)
        if backend:
            from archive_storage import archive_key,receipt_key
            if not args.receipt:
                raise ValidationError('Cloud archive loads require an acquisition receipt')
            archived_location=backend.retain(path,archive_key(archive_sha),archive_sha,'application/zip')
            receipt_sha=digest(args.receipt)
            backend.retain(args.receipt,receipt_key(archive_sha,receipt_sha),receipt_sha,'application/json')
        else:
            path = retain_archive(path, args.archive_store, archive_sha)
            archived_location=path
    with zipfile.ZipFile(path) as archive:
        members = inventory(archive,layout)
        header = check_header(archive,members,layout,args.year,args.encoding)
        if args.load:
            result = load_postgres(archive,members,header,layout_sha,archive_sha,archived_location,args,connection,attempt_id)
        else:
            result = {'status': 'validated', 'files': {
              item.filename: scan_member(archive,item,spec,args.year,args.encoding) for item,spec in members}}
    return {'parser_version':PARSER_VERSION,'archive_sha256':archive_sha,'layout_sha256':layout_sha,
            'tax_year':args.year,'roll_stage':args.roll_stage,
            'acquisition':observation['receipt'] if observation else None,**result}


def record_event(connection, attempt_id, event_type, dataset_id=None,
                 acquisition_receipt_sha256=None, details=None):
    from psycopg.types.json import Jsonb
    connection.execute('insert into tcad_ingest.import_events\n      (attempt_id,event_type,dataset_id,acquisition_receipt_sha256,details) values (%s,%s,%s,%s,%s)',
      (attempt_id,event_type,dataset_id,acquisition_receipt_sha256,Jsonb(details or {})))


def record_acquisition(connection, observation):
    if observation is None:
        return None
    from psycopg.types.json import Jsonb
    receipt, sha = observation['receipt'], observation['receipt_sha256']
    connection.execute('insert into tcad_ingest.acquisitions\n      (receipt_sha256,archive_sha256,source_url,download_started_at,downloaded_at,\n       publisher_published_on,publication_evidence,http_last_modified_raw,receipt)\n      values (%s,%s,%s,%s,%s,%s,%s,%s,%s) on conflict (receipt_sha256) do nothing',
      (sha,receipt['archive_sha256'],receipt['source_url'],receipt['download_started_at'],
       receipt['downloaded_at'],receipt.get('publisher_published_on'),receipt.get('publication_evidence'),
       receipt.get('http_last_modified_raw'),Jsonb(receipt)))
    return sha


def run(args):
    if not args.load:
        started = utc_now()
        result = run_validated(args)
        return {**result,'validation_started_at':started,'validation_completed_at':utc_now()}
    if not args.expected_sha256 or not (args.archive_store or getattr(args,'archive_backend',None)):
        raise ValidationError('--load requires --expected-sha256 and --archive-store')
    import psycopg
    dsn = os.environ.get('TCAD_DATABASE_URL')
    if not dsn:
        raise ValidationError('Set TCAD_DATABASE_URL in the ingestion environment')
    with psycopg.connect(dsn,autocommit=True,connect_timeout=15) as connection:
        attempt_id = uuid.uuid4()
        connection.execute('insert into tcad_ingest.import_attempts\n          (id,source_url,archive_filename,tax_year,roll_stage,parser_version,source_encoding)\n          values (%s,%s,%s,%s,%s,%s,%s)',
          (attempt_id,args.source_url,Path(args.archive).name,args.year,args.roll_stage,PARSER_VERSION,args.encoding))
        try:
            result = run_validated(args,connection,attempt_id)
            record_event(connection,attempt_id,'succeeded',dataset_id=result['dataset_id'],
                         details={'resumed_files':sum(bool(f.get('resumed')) for f in result['files'].values())})
        except BaseException as error:
            try:
                record_event(connection,attempt_id,'failed',details={'error_type':type(error).__name__})
            except psycopg.Error:
                # An unavailable connection leaves an honest unfinished attempt.
                pass
            raise
    return {**result,'attempt_id':str(attempt_id)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--year', required=True, type=int, choices=range(1900,2201), metavar='YEAR')
    parser.add_argument('--roll-stage', required=True, choices=['preliminary','certified','supplemental'])
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--encoding', default='ascii', choices=['ascii','utf-8','cp1252'], help='Fixed-width encoding; tab files use UTF-8')
    parser.add_argument('--expected-sha256')
    parser.add_argument('--receipt', type=Path, help='Checksum-bound acquisition receipt; omit for unknown download dates')
    parser.add_argument('--archive-store', type=Path, help='Persistent private filesystem directory for complete source ZIPs')
    parser.add_argument('--load', action='store_true', help='Write to PostgreSQL; omission means validation only')
    args = parser.parse_args()
    try:
        result = run(args)
    except Exception as error:
        message = str(error) if isinstance(error,ValidationError) else type(error).__name__
        print(json.dumps({'status':'failed','error':message}),file=sys.stderr)
        return 1
    print(json.dumps(result,indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
