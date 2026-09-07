#!/usr/bin/env python3
"""Manually invoked GitHub job: archive/validate first, import approved bytes later."""
import argparse
import json
import os
import signal
from pathlib import Path
import tempfile
from types import SimpleNamespace
from urllib.parse import urlsplit

import ingest_tcad as ingest
from archive_storage import ArchiveStorage, BUCKET, PROJECT_REF, archive_key, receipt_key, checksum
from chronology import read_receipt, utc_now
from download_tcad import download


class JobError(Exception):
    pass


def official_source(value):
    url=urlsplit(value)
    if (url.scheme!='https' or url.hostname not in ('traviscad.org','www.traviscad.org')
        or url.username or url.password or url.port not in (None,443) or url.query or url.fragment
        or not url.path.lower().endswith('.zip')):
        raise JobError('Use a direct HTTPS ZIP URL from traviscad.org without query parameters')
    return value


def settings():
    mode=os.environ.get('INPUT_MODE','validate')
    if mode not in ('validate','import'):
        raise JobError('Choose validate or import')
    year=int(os.environ.get('INPUT_TAX_YEAR','2026'))
    stage=os.environ.get('INPUT_ROLL_STAGE','certified')
    encoding=os.environ.get('INPUT_ENCODING','ascii')
    if year not in range(1900,2201) or stage not in ('preliminary','certified','supplemental'):
        raise JobError('Invalid year or roll stage')
    if encoding not in ('ascii','utf-8','cp1252'):
        raise JobError('Invalid encoding')
    result={'mode':mode,'year':year,'stage':stage,'encoding':encoding}
    if mode=='validate':
        result['source_url']=official_source(os.environ.get('INPUT_SOURCE_URL',''))
        result['published_on']=os.environ.get('INPUT_PUBLISHED_ON') or None
        result['publication_evidence']=os.environ.get('INPUT_PUBLICATION_EVIDENCE') or None
    else:
        if os.environ.get('INPUT_IMPORT_APPROVED')!='true':
            raise JobError('Review the validation report, official layout and database capacity before approving import')
        result['archive_sha']=checksum(os.environ.get('INPUT_ARCHIVE_SHA256',''))
        result['receipt_sha']=checksum(os.environ.get('INPUT_RECEIPT_SHA256',''))
    return result


def database_connection():
    import psycopg
    from psycopg.conninfo import conninfo_to_dict
    dsn=os.environ.get('TCAD_DATABASE_URL','')
    config=conninfo_to_dict(dsn)
    host=config.get('host','')
    user=config.get('user','')
    pooler=host.endswith('.pooler.supabase.com') and user==f'tcad_ingestion_job.{PROJECT_REF}'
    direct=host==f'db.{PROJECT_REF}.supabase.co' and user=='tcad_ingestion_job'
    if not (pooler or direct) or config.get('port','5432')!='5432' or config.get('dbname')!='postgres':
        raise JobError('Use this project’s dedicated loader login and direct/session connection on port 5432')
    if config.get('sslmode') not in ('require','verify-ca','verify-full'):
        raise JobError('The database connection must require TLS')
    return psycopg.connect(dsn,autocommit=True,connect_timeout=20)


def database_preflight(connection):
    row=connection.execute("""select current_user, r.rolsuper, r.rolbypassrls,
      pg_has_role(current_user,'tcad_loader','MEMBER'), pg_database_size(current_database())
      from pg_roles r where r.rolname=current_user""").fetchone()
    if row is None or row[0]!='tcad_ingestion_job' or row[1] or row[2] or not row[3]:
        raise JobError('Use the restricted tcad_ingestion_job login')
    connection.execute('select id from tcad_ingest.import_attempts limit 0')
    return {'database_bytes_before':row[4]}


def private_bucket(connection,archive_bytes=None):
    row=connection.execute('select public,file_size_limit from storage.buckets where id=%s',(BUCKET,)).fetchone()
    if row is None or row[0] is not False:
        raise JobError('The tcad-archives bucket must exist and be private')
    if archive_bytes is not None and row[1] is not None and archive_bytes>row[1]:
        raise JobError('Archive exceeds the configured bucket file limit')


def execute(config,report,storage,work):
    # Preflight is read-only apart from creating the private archive bucket.
    with database_connection() as connection:
        report.update(database_preflight(connection))
        storage.ensure_bucket()
        private_bucket(connection)
    archive=work/'source.zip'
    receipt=work/'source.zip.receipt.json'
    if config['mode']=='validate':
        receipt=download(config['source_url'],archive,config['published_on'],config['publication_evidence'])
        sha=ingest.digest(archive);receipt_sha=ingest.digest(receipt)
    else:
        sha=config['archive_sha'];receipt_sha=config['receipt_sha']
        storage.retrieve(archive_key(sha),archive,sha)
        storage.retrieve(receipt_key(sha,receipt_sha),receipt,receipt_sha)
    evidence=json.loads(receipt.read_text())
    source_url=official_source(evidence['source_url'])
    read_receipt(receipt,sha,source_url)
    with database_connection() as connection:
        private_bucket(connection,archive.stat().st_size)
    report.update(archive_sha256=sha,receipt_sha256=receipt_sha,archive_bytes=archive.stat().st_size,
                  source_url=source_url,tax_year=config['year'],roll_stage=config['stage'],encoding=config['encoding'])
    report['archive_location']=storage.retain(archive,archive_key(sha),sha,'application/zip')
    report['receipt_location']=storage.retain(receipt,receipt_key(sha,receipt_sha),receipt_sha,'application/json')
    args=SimpleNamespace(archive=archive,year=config['year'],roll_stage=config['stage'],source_url=source_url,
                         encoding=config['encoding'],expected_sha256=sha,receipt=receipt,
                         archive_store=None,archive_backend=storage,load=False)
    # Validate the complete archive before any record inserts, including on import.
    validation=ingest.run(args)
    report['validation']=validation
    report['row_count']=sum(f['rows'] for f in validation['files'].values())
    report['uncompressed_bytes']=sum(f['uncompressed_bytes'] for f in validation['files'].values())
    report['serialized_fields_bytes']=sum(f.get('serialized_fields_bytes',0) for f in validation['files'].values())
    if config['mode']=='import':
        args.load=True
        result=ingest.run(args)
        report['import']={'attempt_id':result['attempt_id'],'dataset_id':result['dataset_id'],'status':result['status']}
        # Confirm actual DB row count, not just the parser's report.
        with database_connection() as connection:
            actual=connection.execute('select count(*) from tcad_ingest.records where dataset_id=%s',(result['dataset_id'],)).fetchone()[0]
            if actual!=report['row_count']:
                raise JobError('Post-load row count differs from the validated archive')
            report['database_row_count']=actual
    report['status']='imported' if config['mode']=='import' else 'validated_and_archived'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',required=True,type=Path)
    args=parser.parse_args()
    report={'started_at':utc_now(),'git_sha':os.environ.get('GITHUB_SHA'),'run_id':os.environ.get('GITHUB_RUN_ID')}
    code=0
    def interrupted(signum, frame):
        raise InterruptedError('Job interrupted')
    signal.signal(signal.SIGTERM,interrupted)
    try:
        config=settings();report['mode']=config['mode']
        with tempfile.TemporaryDirectory(prefix='tcad-job-') as directory:
            execute(config,report,ArchiveStorage.from_environment(),Path(directory))
    except BaseException as error:
        report['status']='failed';report['error_type']=type(error).__name__
        # These application errors are structural; driver/HTTP errors may contain secrets.
        if isinstance(error,(JobError,ingest.ValidationError)):
            report['error']=str(error)
        code=1
    finally:
        report['finished_at']=utc_now()
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({k:report[k] for k in ('status','error_type','error','archive_sha256','receipt_sha256','row_count') if k in report}))
    return code


if __name__=='__main__':
    raise SystemExit(main())
