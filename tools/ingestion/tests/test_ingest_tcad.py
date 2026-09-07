import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import sys
import unittest
import zipfile

MODULE = Path(__file__).resolve().parents[1] / 'ingest_tcad.py'
sys.path.insert(0,str(MODULE.parent))
spec = importlib.util.spec_from_file_location('ingest_tcad', MODULE)
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)
LAYOUT, _ = ingest.read_layout()


def make_row(spec, overrides=None):
    fields = {f['name']: '1' for f in spec['fields']}
    fields.update(prop_id='000001', prop_val_yr='2026', appraisal_year='2026',
                  export_version='8.0.0.33', supplement_number='0000',
                  sketch_object='{"synthetic":true}')
    fields.update(overrides or {})
    if spec['format'] == 'fixed-width':
        raw = bytearray(b' ' * spec['record_length'])
        for field in spec['fields']:
            value = fields[field['name']].encode('ascii')
            width = field['end'] - field['start'] + 1
            assert len(value) <= width
            raw[field['start']-1:field['end']] = value.ljust(width)
        return bytes(raw) + b'\r\n'
    return ('\t'.join(fields[f['name']] for f in spec['fields']) + '\t\r\n').encode('utf-8')


def make_archive(path, overrides=None, omit=None, extra=None, repetitions=None):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for pattern, spec in LAYOUT['files'].items():
            if spec['worksheet'] == omit:
                continue
            raw = make_row(spec,(overrides or {}).get(spec['worksheet']))
            z.writestr(pattern.replace('*','2026-07-08_2026'),raw * (repetitions or {}).get(spec['worksheet'],1))
        z.writestr('exportTotals.pdf',b'%PDF synthetic fixture')
        for name, raw in (extra or {}).items():
            z.writestr(name, raw)


def arguments(path, **values):
    args = dict(archive=path,year=2026,roll_stage='preliminary',source_url='https://example.test/synthetic.zip',
                encoding='ascii',expected_sha256=None,archive_store=None,load=False)
    args.update(values)
    return argparse.Namespace(**args)


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.path = self.root / 'source.zip'
        make_archive(self.path)

    def tearDown(self):
        self.temporary.cleanup()

    def test_every_documented_field_and_file_is_preserved(self):
        total = 0
        for spec in LAYOUT['files'].values():
            values = ingest.parse_record(make_row(spec)[:-2],spec)
            self.assertEqual(set(values),{f['name'] for f in spec['fields']})
            if 'prop_id' in values:
                self.assertEqual(values['prop_id'],'000001')
            total += len(values)
        self.assertEqual(total,1030)
        result = ingest.run(arguments(self.path))
        self.assertEqual(len(result['files']),21)
        self.assertEqual(sum(x['rows'] for x in result['files'].values()),20)
        self.assertEqual(result['roll_stage'],'preliminary')  # Supplement 0 is not reclassified.
        self.assertNotIn('000001',json.dumps(result))

    def test_duplicate_filler_labels_have_distinct_positions(self):
        spec = next(s for s in LAYOUT['files'].values() if s['worksheet']=='Property')
        self.assertEqual(len(spec['fields']),len({f['name'] for f in spec['fields']}))
        self.assertGreater(len([f for f in spec['fields'] if f['name'].startswith('filler')]),1)

    def test_dry_run_does_not_require_database_or_copy_archive(self):
        result = ingest.run(arguments(self.path))
        self.assertEqual(result['status'],'validated')
        self.assertEqual(list(self.root.iterdir()),[self.path])

    def test_unsupported_version_and_wrong_year_are_rejected(self):
        for field, value in [('export_version','9.0'),('appraisal_year','2025')]:
            make_archive(self.path, {'Header':{field:value}})
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path))

    def test_missing_unknown_and_unsafe_members_are_rejected(self):
        for kwargs in [dict(omit='Agent'),dict(extra={'unknown.txt':b'x'}),dict(extra={'../escape.pdf':b'x'}),
                       dict(extra={'second_APPRAISAL_INFO.TXT':b'x'})]:
            make_archive(self.path,**kwargs)
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path))

    def test_width_column_count_and_encoding_errors_are_rejected(self):
        fixed = next(s for s in LAYOUT['files'].values() if s['worksheet']=='Property')
        tab = next(s for s in LAYOUT['files'].values() if s['worksheet']=='Sketches')
        for raw, spec in [(b'x',fixed),(b'\xff'*fixed['record_length'],fixed),(b'1\t2',tab)]:
            with self.assertRaises((ingest.ValidationError,UnicodeError)):
                ingest.parse_record(raw,spec)

    def test_large_utf8_sketch_and_optional_trailing_tab(self):
        spec = next(s for s in LAYOUT['files'].values() if s['worksheet']=='Sketches')
        row = '1\t2026\t1\t1\tEnhanced\t\t' + json.dumps({'note':'é'*10000},ensure_ascii=False)
        a = ingest.parse_record(row.encode(),spec)
        b = ingest.parse_record((row+'\t').encode(),spec)
        self.assertEqual(a,b)
        self.assertEqual(json.loads(a['sketch_object'])['note'],'é'*10000)

    def test_checksum_and_load_preconditions(self):
        with self.assertRaises(ingest.ValidationError):
            ingest.run(arguments(self.path,expected_sha256='0'*64))
        with self.assertRaises(ingest.ValidationError):
            ingest.run(arguments(self.path,load=True))

    def test_retention_is_idempotent_and_rejects_corruption(self):
        sha = ingest.digest(self.path)
        destination = ingest.retain_archive(self.path,self.root/'archive',sha)
        self.assertEqual(destination.read_bytes(),self.path.read_bytes())
        self.assertEqual(ingest.retain_archive(self.path,self.root/'archive',sha),destination)
        destination.write_bytes(b'corrupt')
        with self.assertRaises(ingest.ValidationError):
            ingest.retain_archive(self.path,self.root/'archive',sha)


if __name__ == '__main__':
    unittest.main()
