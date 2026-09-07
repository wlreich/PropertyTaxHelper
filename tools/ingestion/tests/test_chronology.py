import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
from test_ingest_tcad import ingest, make_archive, arguments
from chronology import read_receipt, zip_clock
from download_tcad import download


def receipt_for(path, source_url='https://example.test/synthetic.zip', **values):
    receipt={'version':1,'archive_sha256':ingest.digest(path),'source_url':source_url,
             'download_started_at':'2026-09-07T09:00:00-05:00',
             'downloaded_at':'2026-09-07T14:02:00+00:00',
             'publisher_published_on':'2026-07-18',
             'publication_evidence':'Publisher release label: certified July 18, 2026',
             'http_last_modified_raw':'Sun, 19 Jul 2026 01:00:00 GMT'}
    receipt.update(values)
    target=Path(str(path)+'.receipt.json');target.write_text(json.dumps(receipt))
    return target


class ChronologyTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory();self.root=Path(self.temporary.name)
        self.path=self.root/'synthetic.zip';make_archive(self.path)

    def tearDown(self):
        self.temporary.cleanup()

    def test_acquisition_and_publication_are_distinct(self):
        receipt=receipt_for(self.path)
        result=ingest.run(arguments(self.path,receipt=receipt))
        self.assertEqual(result['acquisition']['publisher_published_on'],'2026-07-18')
        self.assertEqual(result['acquisition']['downloaded_at'],'2026-09-07T14:02:00+00:00')
        self.assertNotEqual(result['validation_started_at'],result['acquisition']['downloaded_at'])

    def test_unknown_dates_remain_unknown(self):
        result=ingest.run(arguments(self.path))
        self.assertIsNone(result['acquisition'])
        receipt=receipt_for(self.path,publisher_published_on=None,publication_evidence=None)
        self.assertIsNone(read_receipt(receipt,ingest.digest(self.path),'https://example.test/synthetic.zip')['receipt']['publisher_published_on'])

    def test_receipt_rejects_wrong_identity_naive_times_and_unsupported_dates(self):
        for changes in [{'archive_sha256':'0'*64},{'source_url':'https://example.test/other'},
                        {'downloaded_at':'2026-09-07T14:02:00'},
                        {'downloaded_at':'2026-09-07T13:59:00Z'},
                        {'publication_evidence':None},{'publisher_published_on':'2026-02-30'}]:
            receipt=receipt_for(self.path,**changes)
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path,receipt=receipt))

    def test_zip_clock_keeps_unknown_timezone_and_invalid_raw_date(self):
        item=zipfile.ZipInfo('data.txt',(2026,7,18,13,45,2))
        self.assertEqual(zip_clock(item),{'zip_modified_raw':[2026,7,18,13,45,2],
                                        'zip_modified_local':'2026-07-18T13:45:02'})
        item.date_time=(2026,0,0,13,45,2)
        self.assertIsNone(zip_clock(item)['zip_modified_local'])
        self.assertEqual(zip_clock(item)['zip_modified_raw'],[2026,0,0,13,45,2])

    def test_downloader_records_clock_and_header_without_inventing_publication(self):
        class Response(io.BytesIO):
            headers={'Last-Modified':'Sun, 19 Jul 2026 01:00:00 GMT'}
            def geturl(self): return 'https://example.test/synthetic.zip'
        output=self.root/'downloaded.zip'
        with patch('download_tcad.urlopen',return_value=Response(self.path.read_bytes())):
            receipt=download('https://example.test/synthetic.zip',output)
        details=read_receipt(receipt,ingest.digest(output),'https://example.test/synthetic.zip')['receipt']
        self.assertIsNone(details['publisher_published_on'])
        self.assertEqual(details['http_last_modified_raw'],Response.headers['Last-Modified'])
        with self.assertRaises(ValueError):
            download('https://example.test/synthetic.zip',output)
        self.assertEqual(output.read_bytes(),self.path.read_bytes())
