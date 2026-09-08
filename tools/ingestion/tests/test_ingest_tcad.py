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

# Filenames observed in the certified archive, independently of layout aliases.
SHORT_NAMES = dict(zip(
    ['Header', 'Property', 'PropertyEntity', 'EntityTotals', 'AbstractSubdivision',
     'StateCode', 'ARB', 'Entity', 'MobileHome', 'Agent', 'Lawsuit', 'Arbitration',
     'Improvement', 'ImprovementDetail', 'ImprovementDetailAttributes', 'LandDetail',
     'Deferral', 'CountryCode', 'Sketches', 'SB12'],
    ['APPR_HDR', 'PROP', 'PROP_ENT', 'TOTALS', 'ABS_SUBD', 'STATE_CD', 'ARB', 'ENTITY',
     'MOBILE_HOME_INFO', 'AGENT', 'LAWSUIT', 'ARBITRATION', 'IMP_INFO', 'IMP_DET',
     'IMP_ATR', 'LAND_DET', 'TAX_DEFERRAL_INFO', 'COUNTRY', 'SKETCH_INFO', 'SB12']))


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


def make_archive(path, overrides=None, omit=None, extra=None, repetitions=None, short_names=False):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for pattern, spec in LAYOUT['files'].items():
            if spec['worksheet'] == omit:
                continue
            raw = make_row(spec,(overrides or {}).get(spec['worksheet']))
            name = ('release/' + SHORT_NAMES[spec['worksheet']].lower() + '.txt'
                    if short_names else pattern.replace('*','2026-07-08_2026'))
            z.writestr(name,raw * (repetitions or {}).get(spec['worksheet'],1))
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

    def test_short_names_preserve_all_record_types_and_original_names(self):
        expected = ingest.run(arguments(self.path))
        make_archive(self.path, short_names=True)
        actual = ingest.run(arguments(self.path))
        def by_type(result):
            return {v['record_type']: (v['rows'], v['sha256']) for v in result['files'].values()}
        self.assertEqual(by_type(expected), by_type(actual))
        self.assertIn('release/prop.txt', actual['files'])
        self.assertEqual(len(actual['files']), 21)

    def test_workbook_sketch_alias_is_supported(self):
        make_archive(self.path, short_names=True, omit='Sketches',
                     extra={'SKETCH.TXT': make_row(next(s for s in LAYOUT['files'].values()
                                                      if s['worksheet'] == 'Sketches'))})
        result = ingest.run(arguments(self.path))
        self.assertEqual(result['files']['SKETCH.TXT']['record_type'], 'Sketches')

    def test_short_names_keep_duplicate_and_content_checks(self):
        for extra in [{'PROP.TXT': b'x'}, {'second_APPRAISAL_INFO.TXT': b'x'},
                      {'SKETCH.TXT': b'x'}, {'OTHER.TXT': b'x'}, {'../PROP.TXT': b'x'}]:
            make_archive(self.path, short_names=True, extra=extra)
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path))
        for kwargs in [dict(omit='Agent'), dict(overrides={'Header': {'export_version': '9.0'}}),
                       dict(overrides={'Property': {'prop_val_yr': '2025'}})]:
            make_archive(self.path, short_names=True, **kwargs)
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path))

    def test_dry_run_does_not_require_database_or_copy_archive(self):
        result = ingest.run(arguments(self.path))
        self.assertEqual(result['status'],'validated')
        self.assertEqual(list(self.root.iterdir()),[self.path])

    def test_unsupported_version_and_wrong_year_are_rejected(self):
        for field, value in [('export_version','9.0'),('appraisal_year','2025')]:
            make_archive(self.path, {'Header':{field:value}})
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path))

    def test_active_arb_cases_preserve_earlier_years_and_report_counts(self):
        spec = next(s for s in LAYOUT['files'].values() if s['worksheet'] == 'ARB')
        raw = b''.join(make_row(spec, {'prop_val_yr': year})
                       for year in ['02018', '02024', '02024', '02026'])
        make_archive(self.path, omit='ARB', extra={'ARB.TXT': raw})
        result = ingest.run(arguments(self.path))
        arb = result['files']['ARB.TXT']
        self.assertEqual(arb['rows'], 4)
        self.assertEqual(arb['record_year_counts'], {'2018': 1, '2024': 2, '2026': 1})
        preserved = []
        with zipfile.ZipFile(self.path) as archive:
            ingest.scan_member(archive, archive.getinfo('ARB.TXT'), spec, 2026, 'ascii',
                               lambda n, fields: preserved.append(fields['prop_val_yr']))
        self.assertEqual(preserved, ['02018', '02024', '02024', '02026'])

    def test_arb_year_exception_keeps_other_year_checks(self):
        for worksheet, value, message in [
            ('ARB', '02027', 'later than the release year'),
            ('ARB', '01899', 'outside the supported range'),
            ('ARB', 'PRIV!', 'not a valid integer'),
            ('Property', '02024', 'differs from the declared dataset year'),
            ('Improvement', '2024', 'differs from the declared dataset year'),
            ('Lawsuit', '02027', 'later than the release year'),
            ('Arbitration', 'PRIV!', 'not a valid integer')]:
            make_archive(self.path, overrides={worksheet: {'prop_val_yr': value}})
            with self.assertRaisesRegex(ingest.ValidationError, message) as caught:
                ingest.run(arguments(self.path))
            self.assertNotIn(value, str(caught.exception))

    def test_all_three_active_case_lists_keep_historical_years(self):
        overrides = {name: {'prop_val_yr': '02024'} for name in ['ARB', 'Lawsuit', 'Arbitration']}
        for short_names in [False, True]:
            make_archive(self.path, overrides=overrides, short_names=short_names)
            result = ingest.run(arguments(self.path))
            summaries = {v['record_type']: v for v in result['files'].values()}
            for name in overrides:
                self.assertEqual(summaries[name]['record_year_counts'], {'2024': 1})
            self.assertEqual(result['tax_year'], 2026)

    def test_validation_reports_multiple_failures_and_checks_later_files(self):
        make_archive(self.path, overrides={'Property': {'prop_val_yr': 'PRIV!'},
                                           'Lawsuit': {'prop_val_yr': '02027'}})
        updates = []
        with self.assertRaises(ingest.ArchiveValidationError) as caught:
            ingest.run(arguments(self.path, progress=updates.append))
        report = caught.exception.report
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['members_checked'], 21)
        self.assertEqual(len(report['files']), 19)
        self.assertEqual({f['record_type'] for f in report['validation_failures']}, {'Property', 'Lawsuit'})
        self.assertIn('SB12', {v['record_type'] for v in report['files'].values()})
        self.assertIn('validation_completed_at', report)
        self.assertEqual(sum(u['status'] == 'started' for u in updates), 21)
        self.assertEqual(sum(u['status'] == 'failed' for u in updates), 2)
        self.assertNotIn('PRIV!', json.dumps(report) + json.dumps(updates) + str(caught.exception))

    def test_structural_errors_are_specific_and_exclude_row_values(self):
        spec = next(s for s in LAYOUT['files'].values() if s['worksheet'] == 'ARB')
        good = make_row(spec)
        invalid = bytearray(good)
        invalid[0] = 255
        for raw, message in [(b'PRIVATE\r\n', 'expected 127 bytes, got 7'),
                             (bytes(invalid), 'invalid ascii encoding'),
                             (good.replace(b' ', b'\x00', 1), 'NUL byte')]:
            make_archive(self.path, omit='ARB', extra={'ARB.TXT': raw})
            with self.assertRaisesRegex(ingest.ValidationError, message) as caught:
                ingest.run(arguments(self.path))
            self.assertIn('ARB row 1:', str(caught.exception))
            self.assertNotIn('PRIVATE', str(caught.exception))

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
