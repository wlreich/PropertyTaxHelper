import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from test_ingest_tcad import ingest, make_archive
from test_job import FakeS3
from archive_storage import ArchiveStorage, StorageError, uploaded_key, MAX_UPLOADED_ARCHIVE_BYTES
from chronology import read_receipt, PUBLISHER_REFERENCE_PAGE
import run_job


class UploadedArchiveTests(unittest.TestCase):
    def test_unknown_url_requires_filename_and_never_relaxes_direct_downloads(self):
        env = {**self.environment(), 'INPUT_SOURCE_URL': ''}
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(run_job.JobError): run_job.settings()
            os.environ['INPUT_ORIGINAL_FILENAME'] = '2026 Preliminary Appraisal Export Supp 0_04022026'
            config = run_job.settings()
            self.assertEqual(config['source_url'], PUBLISHER_REFERENCE_PAGE)
            self.assertEqual(config['source_url_kind'], 'publisher_reference_page')
            os.environ['INPUT_MODE'] = 'validate'
            with self.assertRaises(run_job.JobError): run_job.settings()
            os.environ['INPUT_MODE'] = 'validate_uploaded'
            for source in ['https://evil.test/x.zip', PUBLISHER_REFERENCE_PAGE]:
                os.environ['INPUT_SOURCE_URL'] = source
                with self.assertRaises(run_job.JobError): run_job.settings()
            os.environ['INPUT_SOURCE_URL'] = ''
            for filename in ['../a.zip', 'folder/a.zip', 'https://traviscad.org/a.zip', 'a\n.zip']:
                os.environ['INPUT_ORIGINAL_FILENAME'] = filename
                with self.assertRaises(run_job.JobError): run_job.settings()

    def test_unknown_url_validation_retains_evidence_and_import_uses_same_receipt(self):
        filename = '2026 Preliminary Appraisal Export Supp 0_04022026'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); source = root/'synthetic.zip'; make_archive(source)
            client = FakeS3(); client.objects['incoming/2026-certified.zip'] = source.read_bytes()
            env = {**self.environment(), 'INPUT_SOURCE_URL': '', 'INPUT_ORIGINAL_FILENAME': filename}
            with patch.dict(os.environ, env, clear=True): config = run_job.settings()
            work = root/'validate'; work.mkdir(); report = {}
            with patch.object(run_job, 'database_connection', return_value=MagicMock()), \
                 patch.object(run_job, 'database_preflight', return_value={}), \
                 patch.object(run_job, 'private_bucket'), \
                 patch.object(run_job, 'download', side_effect=AssertionError('No HTTP download')), \
                 patch.object(ingest, 'load_postgres', side_effect=AssertionError('No validation inserts')):
                run_job.execute(config, report, ArchiveStorage(client), work)
            self.assertEqual(report['status'], 'validated_and_archived')
            evidence = json.loads((work/'source.zip.receipt.json').read_text())
            self.assertEqual(evidence['original_filename_reported'], filename)
            self.assertEqual(evidence['source_url'], PUBLISHER_REFERENCE_PAGE)
            for key in ['download_url_reported', 'downloaded_at', 'browser_downloaded_on_reported',
                        'publisher_published_on', 'publication_evidence']:
                self.assertIsNone(evidence[key])
            # Recheck the same checksum-addressed receipt along the import path.
            # Stop at the loader boundary; real DB import/retry is covered by integration_check.
            config.update(mode='import', archive_sha=report['archive_sha256'], receipt_sha=report['receipt_sha256'])
            work = root/'import'; work.mkdir()
            reached_loader = []
            def loader(*args, **kwargs):
                reached_loader.append(True)
                raise RuntimeError('Reached loader boundary')
            with patch.object(run_job, 'database_connection', return_value=MagicMock()), \
                 patch.object(run_job, 'database_preflight', return_value={}), \
                 patch.object(run_job, 'private_bucket'), patch('psycopg.connect', side_effect=loader), \
                 patch.dict(os.environ, {'TCAD_DATABASE_URL': 'postgresql://localhost/synthetic-unused'}):
                with self.assertRaisesRegex(RuntimeError, 'Reached loader boundary'):
                    run_job.execute(config, {}, ArchiveStorage(client), work)
            self.assertEqual(reached_loader, [True])
            for field, value in [('source_url', 'https://evil.test/'),
                                 ('original_filename_reported', None),
                                 ('download_url_reported', 'https://traviscad.org/guessed.zip')]:
                bad = {**evidence, field: value}; path = root/'bad.json'; path.write_text(json.dumps(bad))
                with self.assertRaises(ValueError):
                    read_receipt(path, evidence['archive_sha256'], bad['source_url'])

    def environment(self):
        return {'INPUT_MODE':'validate_uploaded', 'INPUT_SOURCE_URL':'https://traviscad.org/test.zip',
                'INPUT_UPLOADED_ARCHIVE_KEY':'incoming/2026-certified.zip'}

    def test_upload_settings_cannot_target_other_buckets_or_arbitrary_keys(self):
        for key in ['archives/a.zip', 'incoming/../a.zip', 'incoming/a..zip',
                    's3://other/incoming/a.zip', 'incoming/a.zip?token=x', 'incoming/folder/a.zip']:
            with self.assertRaises(StorageError): uploaded_key(key)
        with patch.dict(os.environ, self.environment(), clear=True):
            self.assertEqual(run_job.settings()['mode'], 'validate_uploaded')
            os.environ['INPUT_BROWSER_DOWNLOADED_ON']='2026-02-30'
            with self.assertRaises(run_job.JobError): run_job.settings()

    def test_full_upload_validation_never_downloads_from_tcad_or_loads_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); source=root/'synthetic.zip'; make_archive(source)
            client=FakeS3(); client.objects['incoming/2026-certified.zip']=source.read_bytes()
            with patch.dict(os.environ, self.environment(), clear=True): config=run_job.settings()
            for attempt in range(2):
                work=root/str(attempt); work.mkdir(); report={}
                with patch.object(run_job,'database_connection',return_value=MagicMock()), \
                     patch.object(run_job,'database_preflight',return_value={'database_bytes_before':0}), \
                     patch.object(run_job,'private_bucket'), \
                     patch.object(run_job,'download',side_effect=AssertionError('No TCAD request allowed')), \
                     patch.object(ingest,'load_postgres',side_effect=AssertionError('Validation cannot load rows')):
                    run_job.execute(config,report,ArchiveStorage(client),work)
                self.assertEqual(report['status'],'validated_and_archived')
                self.assertEqual(report['row_count'],20)
                receipt=json.loads((work/'source.zip.receipt.json').read_text())
                self.assertIsNone(receipt['download_started_at'])
                self.assertIsNone(receipt['downloaded_at'])
                self.assertIsNone(receipt['browser_downloaded_on_reported'])
                self.assertIsNone(receipt['http_last_modified_raw'])
                self.assertEqual(receipt['acquisition_method'],'manual_upload')
                self.assertEqual(receipt['archive_sha256'],ingest.digest(source))
                self.assertEqual(client.objects['incoming/2026-certified.zip'],source.read_bytes())
            self.assertEqual(len([k for k in client.objects if k.startswith('archives/')]),1)

    def test_upload_rejects_checksum_mismatch_partial_transfer_and_oversize(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); client=FakeS3(); client.objects['incoming/a.zip']=b'abc'
            with self.assertRaises(StorageError):
                ArchiveStorage(client).retrieve_upload('incoming/a.zip',root/'bad.zip','0'*64)
            for index,size in enumerate([4,MAX_UPLOADED_ARCHIVE_BYTES+1,0]):
                client.get_object=lambda **kwargs:{'Body':io.BytesIO(b'abc'),'ContentLength':size}
                with self.assertRaises(StorageError):
                    ArchiveStorage(client).retrieve_upload('incoming/a.zip',root/f'partial{index}.zip')
            path=root/'existing.zip';path.write_bytes(b'existing')
            client=FakeS3();client.objects['incoming/a.zip']=b'abc'
            with self.assertRaises(FileExistsError):ArchiveStorage(client).retrieve_upload('incoming/a.zip',path)
            self.assertEqual(path.read_bytes(),b'existing')

    def test_failed_validation_saves_all_file_failures_and_blocks_import(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'synthetic.zip'
            make_archive(source, overrides={'Property': {'prop_val_yr': 'PRIV!'},
                                             'Lawsuit': {'prop_val_yr': '02027'}})
            client = FakeS3()
            client.objects['incoming/2026-certified.zip'] = source.read_bytes()
            output = io.StringIO()
            report = root / 'report.json'
            with patch.dict(os.environ, self.environment(), clear=True), \
                 patch('sys.argv', ['run_job', '--report', str(report)]), \
                 patch.object(ArchiveStorage, 'from_environment', return_value=ArchiveStorage(client)), \
                 patch.object(run_job, 'database_connection', return_value=MagicMock()), \
                 patch.object(run_job, 'database_preflight', return_value={}), \
                 patch.object(run_job, 'private_bucket'), \
                 patch.object(ingest, 'load_postgres') as loader, contextlib.redirect_stdout(output):
                self.assertEqual(run_job.main(), 1)
                loader.assert_not_called()
                first_report = json.loads(report.read_text())
                os.environ.update(INPUT_MODE='import', INPUT_IMPORT_APPROVED='true',
                                  INPUT_ARCHIVE_SHA256=first_report['archive_sha256'],
                                  INPUT_RECEIPT_SHA256=first_report['receipt_sha256'])
                self.assertEqual(run_job.main(), 1)
                loader.assert_not_called()
            data = json.loads(report.read_text())
            self.assertEqual(data['status'], 'failed')
            self.assertEqual(data['validation']['members_checked'], 21)
            self.assertEqual(len(data['validation_failures']), 2)
            self.assertIn('archive_location', data)
            self.assertNotIn('row_count', data)  # A failed scan cannot report a complete archive total.
            self.assertNotIn('PRIV!', report.read_text() + output.getvalue())

    def test_manual_receipt_rejects_invented_source_dates_and_preserves_reported_date(self):
        receipt={'version':2,'archive_sha256':'0'*64,'source_url':'https://traviscad.org/test.zip',
                 'acquisition_method':'manual_upload','download_started_at':None,'downloaded_at':None,
                 'storage_retrieval_started_at':'2026-09-08T00:00:00+00:00',
                 'storage_retrieved_at':'2026-09-08T00:01:00+00:00',
                 'storage_uploaded_at':'2026-09-07T23:59:00+00:00',
                 'uploaded_object_uri':'s3://tcad-archives/incoming/a.zip','archive_bytes':123,
                 'browser_downloaded_on_reported':'2026-09-07'}
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'receipt.json';path.write_text(json.dumps(receipt))
            parsed=read_receipt(path,'0'*64,receipt['source_url'])['receipt']
            self.assertEqual(parsed['browser_downloaded_on_reported'],'2026-09-07')
            for key,value in [('downloaded_at','2026-09-08T00:01:00+00:00'),
                              ('http_last_modified_raw','a date'),('acquisition_method','direct_download'),
                              ('storage_retrieved_at','2026-09-08T00:01:00'),
                              ('browser_downloaded_on_reported','2026-02-30')]:
                path.write_text(json.dumps({**receipt,key:value}))
                with self.assertRaises((ValueError,TypeError)):read_receipt(path,'0'*64,receipt['source_url'])

    def test_http_report_excludes_sensitive_exception_details(self):
        def fail(config,report,storage,work):
            report['phase']='source_download'
            raise HTTPError('https://example.invalid/SECRET_URL',403,'SECRET_REASON',
                            {'Authorization':'SECRET_HEADER'},io.BytesIO(b'SECRET_BODY'))
        with tempfile.TemporaryDirectory() as directory:
            report=Path(directory)/'report.json'; output=io.StringIO()
            with patch('sys.argv',['run_job','--report',str(report)]), \
                 patch.object(run_job,'settings',return_value={'mode':'validate'}), \
                 patch.object(ArchiveStorage,'from_environment',return_value=object()), \
                 patch.object(run_job,'execute',side_effect=fail),contextlib.redirect_stdout(output):
                self.assertEqual(run_job.main(),1)
            data=json.loads(report.read_text())
            self.assertEqual(data['http_status'],403)
            self.assertEqual(data['phase'],'source_download')
            self.assertNotIn('SECRET',report.read_text()+output.getvalue())
