"""Run only against a disposable local PostgreSQL database with the migration applied."""
import os
from pathlib import Path
import tempfile
from unittest.mock import patch
from urllib.parse import urlsplit
import psycopg
from test_ingest_tcad import ingest, make_archive, arguments


def main():
    dsn = os.environ['TCAD_TEST_DATABASE_URL']
    if urlsplit(dsn).hostname not in ('localhost','127.0.0.1','::1'):
        raise RuntimeError('Integration checks require a disposable local database')
    os.environ['TCAD_DATABASE_URL'] = psycopg.conninfo.make_conninfo(dsn, options='-c role=tcad_loader')
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory);path=root/'synthetic.zip';make_archive(path,repetitions={'Improvement':101})
        args=arguments(path,load=True,expected_sha256=ingest.digest(path),archive_store=root/'retained')
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
            assert c.execute('select count(*) from tcad_ingest.property where dataset_id=%s',(dataset_id,)).fetchone()[0]==0
            assert c.execute("select count(*) from tcad_ingest.files where dataset_id=%s and record_type='Improvement'",(dataset_id,)).fetchone()[0]==0
        result=ingest.run(args)
        assert result['status']=='ready' and result['dataset_id']==str(dataset_id)
        assert any(x.get('resumed') for x in result['files'].values())
        retry=ingest.run(args)
        assert all(x['resumed'] for x in retry['files'].values())
        with psycopg.connect(dsn,autocommit=True) as c:
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
            c.execute('reset role')
        print('PASS: all 20 text types loaded; failed file rolled back; retry resumed without duplicates; private access and ready-only views verified.')


if __name__=='__main__':
    main()
