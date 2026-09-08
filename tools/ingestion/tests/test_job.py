import hashlib
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_ingest_tcad import ingest
from archive_storage import ArchiveStorage, StorageError, archive_key, receipt_key
from botocore.exceptions import ClientError
import run_job


class FakeS3:
    def __init__(self):
        self.objects={};self.uploads=0;self.bucket=False
    def head_bucket(self,**kwargs):
        if not self.bucket:raise ClientError({'Error':{'Code':'404'}},'HeadBucket')
    def create_bucket(self,**kwargs):self.bucket=True
    def head_object(self,Key,**kwargs):
        if Key not in self.objects:raise ClientError({'Error':{'Code':'404'}},'HeadObject')
        return {'ContentLength':len(self.objects[Key])}
    def get_object(self,Key,**kwargs):return {'Body':io.BytesIO(self.objects[Key]),'ContentLength':len(self.objects[Key])}
    def upload_file(self,Filename,Bucket,Key,**kwargs):
        self.uploads+=1;self.objects[Key]=Path(Filename).read_bytes()
    def download_file(self,Bucket,Key,Filename):Path(Filename).write_bytes(self.objects[Key])


class JobTests(unittest.TestCase):
    def test_archive_retention_verifies_bytes_and_reuses_identical_objects(self):
        client=FakeS3();store=ArchiveStorage(client)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'x.zip';path.write_bytes(b'full archive bytes')
            sha=ingest.digest(path);key=archive_key(sha)
            store.ensure_bucket();self.assertTrue(client.bucket)
            self.assertEqual(store.retain(path,key,sha,'application/zip'),f's3://tcad-archives/{key}')
            ArchiveStorage(client).retain(path,key,sha,'application/zip')
            self.assertEqual(client.uploads,1)
            client.objects[key]=b'corrupt'
            with self.assertRaises(StorageError):
                ArchiveStorage(client).retain(path,key,sha,'application/zip')
            self.assertEqual(client.uploads,1)

    def test_permission_errors_are_not_treated_as_missing_objects(self):
        client=FakeS3();client.head_object=lambda **kwargs:(_ for _ in ()).throw(ClientError({'Error':{'Code':'403'}},'HeadObject'))
        with self.assertRaises(ClientError):ArchiveStorage(client).exists('x')

    def test_download_rejects_corruption_and_local_overwrite(self):
        client=FakeS3();client.objects['x']=b'changed'
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'x.zip'
            with self.assertRaises(StorageError):ArchiveStorage(client).retrieve('x',path,'0'*64)
            with self.assertRaises(StorageError):ArchiveStorage(client).retrieve('x',path,hashlib.sha256(b'changed').hexdigest())

    def test_source_and_object_identifiers_reject_untrusted_destinations(self):
        for source in ['http://traviscad.org/x.zip','https://evil.test/x.zip','https://traviscad.org/x.zip?token=secret','https://user:pass@traviscad.org/x.zip']:
            with self.assertRaises(run_job.JobError):run_job.official_source(source)
        for sha in ['../file','not-a-hash','A'*64]:
            with self.assertRaises(StorageError):archive_key(sha)
        self.assertIn('/'+('1'*64)+'.json',receipt_key('0'*64,'1'*64))

    def test_import_requires_review_and_both_checksums(self):
        env={'INPUT_MODE':'import','INPUT_ARCHIVE_SHA256':'0'*64,'INPUT_RECEIPT_SHA256':'1'*64}
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaises(run_job.JobError):run_job.settings()
            os.environ['INPUT_IMPORT_APPROVED']='true'
            self.assertEqual(run_job.settings()['archive_sha'],'0'*64)
            os.environ['INPUT_RECEIPT_SHA256']=''
            with self.assertRaises(StorageError):run_job.settings()

    def test_database_rejects_wrong_project_role_tls_and_transaction_pooler(self):
        for dsn in ['postgresql://postgres:x@db.flnhdrkfaybruzlbixfy.supabase.co:5432/postgres?sslmode=require',
                    'postgresql://tcad_ingestion_job:x@db.flnhdrkfaybruzlbixfy.supabase.co:5432/postgres?sslmode=disable',
                    'postgresql://tcad_ingestion_job.flnhdrkfaybruzlbixfy:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require']:
            with patch.dict(os.environ,{'TCAD_DATABASE_URL':dsn}):
                with self.assertRaises(run_job.JobError):run_job.database_connection()

    def test_public_and_undersized_buckets_fail_preflight(self):
        class Connection:
            def __init__(self,row):self.row=row
            def execute(self,*args):return self
            def fetchone(self):return self.row
        for row,size in [(None,None),((True,None),None),((False,10),11)]:
            with self.assertRaises(run_job.JobError):run_job.private_bucket(Connection(row),size)
        run_job.private_bucket(Connection((False,None)),1000)
