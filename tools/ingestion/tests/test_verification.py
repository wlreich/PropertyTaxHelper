"""Execute verification SQL against real rows; PostgreSQL gate covers isolation/RLS."""
from contextlib import nullcontext
import sqlite3
import unittest

from test_job import run_job


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript('''attach database ':memory:' as tcad_ingest;
            create table tcad_ingest.files(dataset_id text, member_name text, status text, row_count int,
                primary key(dataset_id,member_name));
            create table tcad_ingest.records(dataset_id text, member_name text,
                row_number int check(row_number>0), primary key(dataset_id,member_name,row_number));
            insert into tcad_ingest.files values ('target','PROP','complete',5),
                ('target','EMPTY','complete',0), ('target','PDF','complete',0);
            insert into tcad_ingest.records values ('target','PROP',1),('target','PROP',2),
                ('target','PROP',3),('target','PROP',4),('target','PROP',5),('other','PROP',1);''')
        self.files = {'PROP': {'rows': 5, 'record_type': 'Property'},
                      'EMPTY': {'rows': 0, 'record_type': 'ARB'},
                      'PDF': {'rows': 0, 'record_type': 'archive_only_pdf'}}
        db = self.db
        class Connection:
            def transaction(self): return nullcontext()
            def execute(self, sql, params=()):
                if sql == 'set transaction isolation level repeatable read, read only': return None
                return db.execute(sql.replace('%s', '?'), params)
        self.connection = Connection()

    def verify(self):
        return run_job.verify_database_rows(self.connection, 'target', self.files, batch_size=2)

    def test_exact_count_across_ranges_and_empty_files_ignores_other_dataset(self):
        self.assertEqual(self.verify(), 5)

    def test_missing_middle_row_fails_even_with_matching_manifest(self):
        self.db.execute("delete from tcad_ingest.records where dataset_id='target' and row_number=3")
        with self.assertRaisesRegex(run_job.JobError, 'record range'): self.verify()

    def test_surplus_row_cannot_compensate_for_a_missing_row(self):
        self.db.execute("update tcad_ingest.records set row_number=6 where dataset_id='target' and row_number=3")
        with self.assertRaises(run_job.JobError): self.verify()

    def test_extra_record_after_expected_end_fails(self):
        self.db.execute("insert into tcad_ingest.records values ('target','PROP',99)")
        with self.assertRaisesRegex(run_job.JobError, 'exceed'): self.verify()

    def test_record_in_expected_empty_file_fails(self):
        self.db.execute("insert into tcad_ingest.records values ('target','EMPTY',1)")
        with self.assertRaisesRegex(run_job.JobError, 'exceed'): self.verify()

    def test_unexpected_file_manifest_fails(self):
        self.db.execute("insert into tcad_ingest.files values ('target','UNEXPECTED','complete',0)")
        with self.assertRaisesRegex(run_job.JobError, 'inventory'): self.verify()

    def test_missing_file_manifest_fails(self):
        self.db.execute("delete from tcad_ingest.files where member_name='EMPTY'")
        with self.assertRaisesRegex(run_job.JobError, 'inventory'): self.verify()

    def test_incomplete_or_incorrect_manifest_fails(self):
        for update in ["status='loading'", 'row_count=4']:
            with self.subTest(update=update):
                self.db.execute("update tcad_ingest.files set " + update + " where member_name='PROP'")
                with self.assertRaisesRegex(run_job.JobError, 'manifest'): self.verify()
                self.db.execute("update tcad_ingest.files set status='complete',row_count=5 where member_name='PROP'")
