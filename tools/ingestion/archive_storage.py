"""Private Supabase Storage archive backend using its S3-compatible API."""
import hashlib
import os
from pathlib import Path
import re

PROJECT_REF = 'flnhdrkfaybruzlbixfy'
BUCKET = 'tcad-archives'
ENDPOINT = f'https://{PROJECT_REF}.storage.supabase.co/storage/v1/s3'


class StorageError(Exception):
    pass


def checksum(value):
    if not isinstance(value,str) or not re.fullmatch('[0-9a-f]{64}',value):
        raise StorageError('A lowercase SHA-256 checksum is required')
    return value


def archive_key(sha):
    return f'archives/{checksum(sha)}.zip'


def receipt_key(archive_sha, receipt_sha):
    return f'receipts/{checksum(archive_sha)}/{checksum(receipt_sha)}.json'


class ArchiveStorage:
    def __init__(self,client):
        self.client=client
        self.verified={}

    @classmethod
    def from_environment(cls):
        import boto3
        from botocore.config import Config
        required=['TCAD_STORAGE_ACCESS_KEY_ID','TCAD_STORAGE_SECRET_ACCESS_KEY','TCAD_STORAGE_REGION']
        if any(not os.environ.get(key) for key in required):
            raise StorageError('Configure the Storage access key, secret key and region')
        client=boto3.client('s3',endpoint_url=ENDPOINT,
          region_name=os.environ['TCAD_STORAGE_REGION'],
          aws_access_key_id=os.environ['TCAD_STORAGE_ACCESS_KEY_ID'],
          aws_secret_access_key=os.environ['TCAD_STORAGE_SECRET_ACCESS_KEY'],
          config=Config(signature_version='s3v4',s3={'addressing_style':'path'},
                        request_checksum_calculation='when_required',
                        response_checksum_validation='when_required',
                        retries={'mode':'standard','max_attempts':4},connect_timeout=20,read_timeout=120))
        return cls(client)

    def ensure_bucket(self):
        from botocore.exceptions import ClientError
        try:
            self.client.head_bucket(Bucket=BUCKET)
        except ClientError as error:
            if error.response['Error']['Code'] not in ('404','NoSuchBucket','NotFound'):
                raise
            self.client.create_bucket(Bucket=BUCKET)

    def exists(self,key):
        from botocore.exceptions import ClientError
        try:
            self.client.head_object(Bucket=BUCKET,Key=key)
            return True
        except ClientError as error:
            if error.response['Error']['Code'] in ('404','NoSuchKey','NotFound'):
                return False
            raise

    def verify(self,key,expected_sha):
        response=self.client.get_object(Bucket=BUCKET,Key=key)
        hasher=hashlib.sha256()
        with response['Body'] as body:
            while chunk:=body.read(1024*1024):
                hasher.update(chunk)
        if hasher.hexdigest()!=expected_sha:
            raise StorageError('Stored object checksum mismatch; no overwrite was performed')

    def retain(self,path,key,expected_sha,content_type):
        from boto3.s3.transfer import TransferConfig
        path=Path(path)
        with path.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!=expected_sha:
                raise StorageError('Local object checksum mismatch')
        if self.verified.get(key)==expected_sha:
            return f's3://{BUCKET}/{key}'
        if not self.exists(key):
            self.client.upload_file(str(path),BUCKET,key,
              ExtraArgs={'ContentType':content_type},
              Config=TransferConfig(multipart_threshold=16*1024*1024,
                                    multipart_chunksize=16*1024*1024,max_concurrency=2))
        # Verify stored bytes, including already-existing objects, before loading.
        self.verify(key,expected_sha)
        self.verified[key]=expected_sha
        return f's3://{BUCKET}/{key}'

    def retrieve(self,key,path,expected_sha):
        path=Path(path)
        if path.exists():
            raise StorageError('Refusing to overwrite a local input file')
        self.client.download_file(BUCKET,key,str(path))
        with path.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!=expected_sha:
                raise StorageError('Downloaded archive or receipt checksum mismatch')
        self.verified[key]=expected_sha
        return path
