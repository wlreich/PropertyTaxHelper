"""Regression coverage for the user-supplied 8.0.32 workbook and version routing."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from test_ingest_tcad import ingest, make_row, arguments, SHORT_NAMES


class LayoutVersionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.path = self.root / 'source.zip'

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, version, header_version=None, short=True):
        layout, sha = ingest.read_layout(ingest.SUPPORTED_LAYOUTS[version])
        with zipfile.ZipFile(self.path, 'w') as archive:
            for pattern, spec in layout['files'].items():
                name = (SHORT_NAMES[spec['worksheet']] + '.TXT' if short
                        else pattern.replace('*', '2026-04-02_000001'))
                archive.writestr(name, make_row(spec, {'export_version': header_version or version}))
        return layout, sha

    def test_both_versions_select_their_own_layout_and_report_checksum(self):
        for version, count in [('8.0.0.32', 1014), ('8.0.0.33', 1030)]:
            for short in [True, False]:
                layout, sha = self.archive(version, short=short)
                result = ingest.run(arguments(self.path))
                self.assertEqual(result['status'], 'validated')
                self.assertEqual(result['export_version'], version)
                self.assertEqual(result['layout_sha256'], sha)
                self.assertEqual(sum(len(s['fields']) for s in layout['files'].values()), count)
                self.assertEqual(sum(f['rows'] for f in result['files'].values()), 20)

    def test_documented_widths_and_unchanged_header(self):
        old, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.32'])
        new, _ = ingest.read_layout()
        widths = {'Property': (9812, 9922, 8), 'PropertyEntity': (3081, 3141, 4),
                  'EntityTotals': (2437, 2491, 4)}
        for pattern, spec in old['files'].items():
            newer = new['files'][pattern]
            if spec['worksheet'] in widths:
                before, after, added = widths[spec['worksheet']]
                self.assertEqual(spec['record_length'], before)
                self.assertEqual(newer['record_length'], after)
                self.assertEqual(spec['fields'], newer['fields'][:-added])
            else:
                self.assertEqual(spec, newer)

    def test_wrong_version_lengths_fail_instead_of_truncating_or_padding(self):
        for actual, claimed in [('8.0.0.32', '8.0.0.33'), ('8.0.0.33', '8.0.0.32')]:
            self.archive(actual, header_version=claimed)
            with self.assertRaises(ingest.ArchiveValidationError) as caught:
                ingest.run(arguments(self.path))
            self.assertEqual({f['record_type'] for f in caught.exception.report['validation_failures']},
                             {'Property', 'PropertyEntity', 'EntityTotals'})

    def test_property_offsets_keep_identity_blanks_and_new_exemptions_separate(self):
        # These offsets are taken directly from the supplied workbooks.
        for version, size in [('8.0.0.32', 9812), ('8.0.0.33', 9922)]:
            layout, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS[version])
            spec = next(s for s in layout['files'].values() if s['worksheet'] == 'Property')
            raw = bytearray(b' ' * size)
            raw[0:12] = b'000000736302'
            if version == '8.0.0.33':
                raw[9812:9813] = b'T'
                raw[9813:9817] = b'2026'
                raw[9867:9868] = b'F'
            parsed = ingest.parse_record(bytes(raw), spec)
            expected = {'prop_id': '000000736302'}
            if version == '8.0.0.33':
                expected.update(afhs_exempt='T', afhs_qualify_yr='2026', lgcc_exempt='F')
            self.assertEqual(parsed, expected)

    def test_import_uses_selected_layout_after_archive_retention(self):
        for version in ingest.SUPPORTED_LAYOUTS:
            layout, sha = self.archive(version)
            args = arguments(self.path, load=True, expected_sha256=ingest.digest(self.path),
                             archive_store=self.root / 'retained')
            with patch.object(ingest, 'load_postgres', return_value={'status': 'ready'}) as loader:
                result = ingest.run_validated(args)
                selected = loader.call_args.args
                self.assertEqual(selected[2]['export_version'], version)
                self.assertEqual(selected[3], sha)
                self.assertEqual(next(s for _, s in selected[1] if s['worksheet'] == 'Property'),
                                 next(s for s in layout['files'].values() if s['worksheet'] == 'Property'))
                self.assertEqual(result['export_version'], version)

    def test_unsupported_version_diagnostic_is_safe(self):
        for version, label in [('8.0.0.31', '8.0.0.31'), ('PRIVATE!', 'missing or malformed')]:
            self.archive('8.0.0.32', header_version=version)
            with self.assertRaises(ingest.ValidationError) as caught:
                ingest.run(arguments(self.path))
            self.assertIn(label, str(caught.exception))
            self.assertNotIn('PRIVATE!', str(caught.exception))

    def test_empty_or_multiple_headers_remain_invalid(self):
        layout, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.32'])
        for count in [0, 2]:
            with zipfile.ZipFile(self.path, 'w') as archive:
                for spec in layout['files'].values():
                    raw = make_row(spec, {'export_version': '8.0.0.32'})
                    archive.writestr(SHORT_NAMES[spec['worksheet']] + '.TXT',
                                     raw * (count if spec['worksheet'] == 'Header' else 1))
            with self.assertRaisesRegex(ingest.ValidationError, 'exactly one record'):
                ingest.run(arguments(self.path))


if __name__ == '__main__':
    unittest.main()
