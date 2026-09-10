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
        # The same source can also arrive through a private manual upload.
        client.objects['incoming/synthetic.zip']=source.read_bytes()
        config.update(mode='validate_uploaded', uploaded_key='incoming/synthetic.zip',
                      expected_upload_sha=None, browser_downloaded_on='2026-09-07')
        work=root/'uploaded';work.mkdir();uploaded={}
        with patch.object(run_job,'database_connection',connection), \
             patch.object(run_job,'download',side_effect=AssertionError('No source HTTP request')):
            run_job.execute(config,uploaded,ArchiveStorage(client),work)
        assert uploaded['status']=='validated_and_archived' and uploaded['row_count']==20
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.import_attempts').fetchone()[0]==2
        config.update(mode='import',archive_sha=uploaded['archive_sha256'],receipt_sha=uploaded['receipt_sha256'])
        for attempt in range(2):
            work=root/f'uploaded-import-{attempt}';work.mkdir();loaded={}
            with patch.object(run_job,'database_connection',connection):
                run_job.execute(config,loaded,ArchiveStorage(client),work)
            assert loaded['database_row_count']==20
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.datasets').fetchone()[0]==1
            assert c.execute('select count(*) from tcad_ingest.records').fetchone()[0]==20
            assert c.execute('select count(*) from tcad_ingest.acquisitions').fetchone()[0]==2
            row=c.execute("select download_started_at, downloaded_at, acquisition_method, browser_downloaded_on_reported, storage_retrieved_at from tcad_ingest.release_chronology where acquisition_method='manual_upload'").fetchone()
            assert row[:4]==(None,None,'manual_upload','2026-09-07') and row[4] is not None
            assert c.execute("select count(*) from tcad_ingest.release_chronology where acquisition_method='direct_download' and downloaded_at is not null").fetchone()[0]==1
            assert c.execute("select count(*) from tcad_ingest.import_history where outcome='succeeded'").fetchone()[0]==4
            assert c.execute("select relrowsecurity from pg_class where oid='tcad_ingest.acquisitions'::regclass").fetchone()[0]
            assert 'security_invoker=true' in c.execute("select reloptions from pg_class where oid='tcad_ingest.release_chronology'::regclass").fetchone()[0]
        # The same archive gets independent full and protest dataset identities.
        config.update(mode='validate_protests_uploaded',stage='unknown',
                      source_url=run_job.PUBLISHER_REFERENCE_PAGE,
                      source_url_kind='publisher_reference_page',original_filename_reported=None)
        work=root/'protest-validate';work.mkdir();protest_validation={}
        with patch.object(run_job,'database_connection',connection):
            run_job.execute(config,protest_validation,ArchiveStorage(client),work)
        assert protest_validation['roll_stage']=='unknown'
        assert protest_validation['manual_acquisition']['original_filename_reported'] is None
        assert protest_validation['manual_acquisition']['download_url_reported'] is None
        assert protest_validation['row_count']==4
        assert protest_validation['validation']['members_checked']==4
        assert len(protest_validation['validation']['skipped_members'])==17
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.datasets').fetchone()[0]==1
            full_id=c.execute("select id from tcad_ingest.datasets where import_scope='full'").fetchone()[0]
        config.update(mode='import_protests',archive_sha=protest_validation['archive_sha256'],
                      receipt_sha=protest_validation['receipt_sha256'])
        # Fail after an Agent row is inserted, so that file must roll back while
        # earlier files stay committed and the full dataset remains untouched.
        original_scan=run_job.ingest.scan_member
        def fail_agent(archive,item,spec,year,encoding,consume=None):
            result=original_scan(archive,item,spec,year,encoding,consume)
            if consume is not None and spec['worksheet']=='Agent':
                raise RuntimeError('Synthetic protest import interruption')
            return result
        work=root/'protest-fail';work.mkdir()
        with patch.object(run_job,'database_connection',connection), patch.object(run_job.ingest,'scan_member',fail_agent):
            try:
                run_job.execute(config,{},ArchiveStorage(client),work)
                raise AssertionError('Expected interrupted file')
            except RuntimeError as error:
                assert str(error)=='Synthetic protest import interruption'
        with psycopg.connect(dsn,autocommit=True) as c:
            protest_id,status=c.execute("select id,status from tcad_ingest.datasets where import_scope='protests'").fetchone()
            assert status=='failed' and protest_id!=full_id
            assert c.execute('select count(*) from tcad_ingest.files where dataset_id=%s',(protest_id,)).fetchone()[0]==3
            assert c.execute("select count(*) from tcad_ingest.files where dataset_id=%s and record_type='Agent'",(protest_id,)).fetchone()[0]==0
            assert c.execute('select status from tcad_ingest.datasets where id=%s',(full_id,)).fetchone()[0]=='ready'
        for attempt in range(2):
            work=root/f'protest-import-{attempt}';work.mkdir();loaded={}
            with patch.object(run_job,'database_connection',connection):
                run_job.execute(config,loaded,ArchiveStorage(client),work)
            assert loaded['database_row_count']==4 and loaded['import_scope']=='protests'
            assert loaded['import']['dataset_id']==str(protest_id)
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.datasets').fetchone()[0]==2
            assert c.execute('select count(*) from tcad_ingest.records').fetchone()[0]==24
            assert c.execute("select count(*) from tcad_ingest.import_attempts where import_scope='protests'").fetchone()[0]==3
            types={row[0] for row in c.execute('select record_type from tcad_ingest.files where dataset_id=%s',(protest_id,))}
            assert types==ingest.PROTEST_RECORD_TYPES
            assert c.execute('select roll_stage from tcad_ingest.datasets where id=%s',(protest_id,)).fetchone()[0]=='unknown'
            # Database constraints enforce the same rule as the CLI: full
            # valuation imports cannot use the unknown stage.
            try:
                c.execute("update tcad_ingest.datasets set roll_stage='unknown' where id=%s",(full_id,))
                raise AssertionError('Unknown stage allowed for full valuation release')
            except psycopg.errors.CheckViolation:
                pass
            # Both public publishers must refuse a selective observation dataset.
            for function in ('publish_property_search','publish_property_snapshots'):
                try:
                    c.execute('select tcad_ingest.'+function+'(%s)',(protest_id,))
                    raise AssertionError('Selective data published as valuations')
                except psycopg.errors.RaiseException:
                    pass
            for role in ('anon','authenticated','service_role'):
                c.execute('set role '+role)
                try:
                    c.execute('select * from tcad_ingest.records where dataset_id=%s',(protest_id,))
                    raise AssertionError('Raw protest data became public')
                except psycopg.errors.InsufficientPrivilege:
                    pass
                c.execute('reset role')
        # The original full mode still selects its original dataset after a
        # protest load. Neither order of imports can duplicate/corrupt the other.
        config.update(mode='import',stage='certified',
                      archive_sha=uploaded['archive_sha256'],receipt_sha=uploaded['receipt_sha256'])
        work=root/'full-after-protests';work.mkdir();loaded={}
        with patch.object(run_job,'database_connection',connection):
            run_job.execute(config,loaded,ArchiveStorage(client),work)
        assert loaded['import']['dataset_id']==str(full_id) and loaded['database_row_count']==20
    print('PASS: private archive + receipt, validation without inserts, full import, retry, durable URI and audit history')


if __name__=='__main__':main()
