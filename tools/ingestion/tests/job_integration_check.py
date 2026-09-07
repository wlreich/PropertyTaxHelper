"""Exercise archive/validate/import/retry against a disposable LOCAL PostgreSQL DB."""
import io
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit
from unittest.mock import patch
import psycopg
from test_ingest_tcad import ingest, make_archive
from test_job import FakeS3
from archive_storage import ArchiveStorage, archive_key, receipt_key
import run_job


def main():
    dsn=os.environ['TCAD_TEST_DATABASE_URL']
    if urlsplit(dsn).hostname not in ('localhost','127.0.0.1','::1'):
        raise RuntimeError('Use a disposable local database')
    repo=Path(__file__).resolve().parents[3]
    with psycopg.connect(dsn,autocommit=True) as c:
        c.execute('create role anon; create role authenticated; create role service_role bypassrls;')
        # No synthetic records enter a hosted project. This DB starts empty.
        for path in sorted((repo/'supabase/migrations').glob('*.sql')):
            c.execute(path.read_text())
        c.execute('create schema storage; create table storage.buckets(id text primary key,public boolean,file_size_limit bigint); alter table storage.buckets enable row level security;')
        original_setup=(repo/'tools/ingestion/provision-loader.sql').read_text()
        try:
            c.execute(original_setup)
            raise AssertionError('Unchanged password placeholder must not provision a login')
        except psycopg.errors.RaiseException:
            c.execute('rollback')
        assert c.execute("select count(*) from pg_roles where rolname='tcad_ingestion_job'").fetchone()[0]==0
        setup=original_setup.replace('REPLACE_WITH_A_NEW_32_OR_MORE_CHARACTER_PASSWORD','synthetic-local-test-password-not-a-real-secret')
        c.execute(setup)
        c.execute("insert into storage.buckets values ('tcad-archives',false,null)")
    job_dsn=psycopg.conninfo.make_conninfo(dsn,options='-c role=tcad_ingestion_job')
    os.environ['TCAD_DATABASE_URL']=job_dsn
    def connection():
        c=psycopg.connect(job_dsn,autocommit=True)
        c.execute('set role tcad_ingestion_job')
        return c
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory);source=root/'synthetic.zip';make_archive(source)
        class Response(io.BytesIO):
            headers={}
            def geturl(self):return 'https://traviscad.org/synthetic-test.zip'
        config={'mode':'validate','year':2026,'stage':'certified','encoding':'ascii',
                'source_url':'https://traviscad.org/synthetic-test.zip','published_on':None,'publication_evidence':None}
        client=FakeS3();storage=ArchiveStorage(client)
        validate_dir=root/'validate';validate_dir.mkdir();report={}
        with patch.object(run_job,'database_connection',connection),patch('download_tcad.urlopen',return_value=Response(source.read_bytes())):
            run_job.execute(config,report,storage,validate_dir)
        assert report['status']=='validated_and_archived' and report['row_count']==20
        assert report['serialized_fields_bytes']>0
        assert archive_key(report['archive_sha256']) in client.objects
        assert receipt_key(report['archive_sha256'],report['receipt_sha256']) in client.objects
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.records').fetchone()[0]==0
        config.update(mode='import',archive_sha=report['archive_sha256'],receipt_sha=report['receipt_sha256'])
        for attempt in range(2):
            work=root/f'import-{attempt}';work.mkdir();loaded={}
            with patch.object(run_job,'database_connection',connection):
                run_job.execute(config,loaded,ArchiveStorage(client),work)
            assert loaded['status']=='imported' and loaded['database_row_count']==20
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.datasets').fetchone()[0]==1
            assert c.execute('select count(*) from tcad_ingest.acquisitions').fetchone()[0]==1
            assert c.execute('select count(*) from tcad_ingest.import_attempts').fetchone()[0]==2
            location=c.execute('select archive_location from tcad_ingest.datasets').fetchone()[0]
            assert location==f"s3://tcad-archives/archives/{report['archive_sha256']}.zip"
            assert c.execute("select count(*) from tcad_ingest.import_history where outcome='succeeded'").fetchone()[0]==2
        assert client.uploads==2  # one ZIP and one receipt, reused on import/retry
    print('PASS: private archive + receipt, validation without inserts, full import, retry, durable URI and audit history')


if __name__=='__main__':main()
