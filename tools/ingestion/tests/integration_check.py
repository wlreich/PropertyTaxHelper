"""Run only against a disposable local PostgreSQL database with the migration applied."""
import os
from datetime import timezone
from pathlib import Path
import tempfile
from unittest.mock import patch
from urllib.parse import urlsplit
import psycopg
from test_ingest_tcad import ingest, make_archive, arguments
from test_chronology import receipt_for


def main():
    dsn = os.environ['TCAD_TEST_DATABASE_URL']
    if urlsplit(dsn).hostname not in ('localhost','127.0.0.1','::1'):
        raise RuntimeError('Integration checks require a disposable local database')
    os.environ['TCAD_DATABASE_URL'] = psycopg.conninfo.make_conninfo(dsn, options='-c role=tcad_loader')
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory);path=root/'synthetic.zip';make_archive(path,repetitions={'Improvement':101})
        receipt=receipt_for(path)
        args=arguments(path,receipt=receipt,load=True,expected_sha256=ingest.digest(path),archive_store=root/'retained')
        original_scan=ingest.scan_member
        def failing_scan(archive,item,spec,*args,**kwargs):
            if spec and spec['worksheet']=='Improvement':
                original_scan(archive,item,spec,*args,**kwargs)
                raise RuntimeError('Synthetic transient input failure')
            return original_scan(archive,item,spec,*args,**kwargs)
        with patch.object(ingest,'scan_member',failing_scan):
            try:ingest.run(args);raise AssertionError('Failure was not surfaced')
            except RuntimeError as error:
                assert str(error)=='Synthetic transient input failure'
        with psycopg.connect(dsn,autocommit=True) as c:
            row=c.execute('select id,status from tcad_ingest.datasets where archive_sha256=%s',(args.expected_sha256,)).fetchone()
            assert row[1]=='failed';dataset_id=row[0]
            first_history=c.execute('select id,outcome,started_at,finished_at from tcad_ingest.import_history').fetchone()
            assert first_history[1]=='failed' and first_history[3]>=first_history[2]

            assert c.execute('select count(*) from tcad_ingest.property where dataset_id=%s',(dataset_id,)).fetchone()[0]==0
            assert c.execute("select count(*) from tcad_ingest.files where dataset_id=%s and record_type='Improvement'",(dataset_id,)).fetchone()[0]==0
        result=ingest.run(args)
        assert result['status']=='ready' and result['dataset_id']==str(dataset_id)
        assert any(x.get('resumed') for x in result['files'].values())
        retry=ingest.run(args)
        assert all(x['resumed'] for x in retry['files'].values())
        with psycopg.connect(dsn,autocommit=True) as c:
            history=c.execute('select id,outcome,started_at,finished_at from tcad_ingest.import_history order by started_at,id').fetchall()
            assert len(history)==3 and [x[1] for x in history]==['failed','succeeded','succeeded']
            assert history[0]==first_history
            assert len({x[0] for x in history})==3
            assert c.execute('select count(*) from tcad_ingest.acquisitions').fetchone()[0]==1
            acq=c.execute('select publisher_published_on,downloaded_at,http_last_modified_raw from tcad_ingest.acquisitions').fetchone()
            assert acq[0].isoformat()=='2026-07-18' and acq[1].astimezone(timezone.utc).hour==14
            assert acq[2]=='Sun, 19 Jul 2026 01:00:00 GMT'
            assert c.execute('select count(*) from tcad_ingest.files where zip_modified_local is not null and zip_modified_raw is not null').fetchone()[0]==21
            assert c.execute('select count(*) from tcad_ingest.records where dataset_id=%s',(dataset_id,)).fetchone()[0]==120
            for role in ['anon','authenticated','service_role']:
                c.execute('set role '+role)
                try:c.execute('select * from tcad_ingest.records');raise AssertionError('Unexpected access')
                except psycopg.errors.InsufficientPrivilege:pass
                c.execute('reset role')
            c.execute('set role tcad_loader')
            assert c.execute('select count(*) from tcad_ingest.property where dataset_id=%s',(dataset_id,)).fetchone()[0]==1
            c.execute("update tcad_ingest.datasets set status='failed' where id=%s",(dataset_id,))
            assert c.execute('select count(*) from tcad_ingest.property where dataset_id=%s',(dataset_id,)).fetchone()[0]==0
            c.execute("update tcad_ingest.datasets set status='ready' where id=%s",(dataset_id,))
            for table in ['acquisitions','import_attempts','import_events']:
                try:
                    c.execute('delete from tcad_ingest.'+table)
                    raise AssertionError('Loader can delete chronology')
                except psycopg.errors.InsufficientPrivilege:pass
                try:
                    c.execute('update tcad_ingest.'+table+' set '+('recorded_at=now()' if table=='acquisitions' else 'started_at=now()' if table=='import_attempts' else 'occurred_at=now()'))
                    raise AssertionError('Loader can rewrite chronology')
                except psycopg.errors.InsufficientPrivilege:pass
            c.execute('reset role')
        # A later download is a new acquisition of the same release, not a new dataset.
        args.receipt=receipt_for(path,download_started_at='2026-09-08T14:00:00Z',downloaded_at='2026-09-08T14:02:00Z')
        again=ingest.run(args)
        assert again['dataset_id']==str(dataset_id)
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.acquisitions').fetchone()[0]==2
            assert c.execute('select count(*) from tcad_ingest.release_chronology').fetchone()[0]==2
            assert c.execute('select count(*) from tcad_ingest.datasets').fetchone()[0]==1
            assert c.execute('select id,outcome,started_at,finished_at from tcad_ingest.import_history where id=%s',(first_history[0],)).fetchone()==first_history
            # A killed/disconnected process leaves a start, never an invented finish.
            import uuid
            unfinished=uuid.uuid4()
            c.execute("insert into tcad_ingest.import_attempts (id,source_url,archive_filename,tax_year,roll_stage,parser_version,source_encoding) values (%s,'https://example.test/test','test.zip',2026,'certified','1.1.0','ascii')",(unfinished,))
            assert c.execute('select outcome,finished_at from tcad_ingest.import_history where id=%s',(unfinished,)).fetchone()==('unfinished',None)
        # Hash/preflight failures are recorded once a DB attempt is admitted.
        bad_args=arguments(path,load=True,expected_sha256='0'*64,archive_store=root/'retained')
        try:ingest.run(bad_args);raise AssertionError('Expected checksum rejection')
        except ingest.ValidationError:pass
        with psycopg.connect(dsn,autocommit=True) as c:
            assert c.execute('select count(*) from tcad_ingest.import_history').fetchone()[0]==6
            latest=c.execute('select outcome,dataset_id from tcad_ingest.import_history order by started_at desc limit 1').fetchone()
            assert latest==('failed',None)
        print('PASS: all 20 text types loaded; failed file rolled back; retry resumed without duplicates; private access, ready-only views, source clocks and immutable attempt history verified.')


if __name__=='__main__':
    main()
