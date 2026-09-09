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

    def archive(self, version, header_version=None, short=True, year=2026):
        layout, sha = ingest.read_layout(ingest.SUPPORTED_LAYOUTS[version])
        with zipfile.ZipFile(self.path, 'w') as archive:
            for pattern, spec in layout['files'].items():
                name = (SHORT_NAMES[spec['worksheet']] + '.TXT' if short
                        else pattern.replace('*', f'{year}-07-20_000001'))
                archive.writestr(name, make_row(spec, {'export_version': header_version or version,
                                                      'appraisal_year': str(year),
                                                      'prop_val_yr': str(year)}))
        return layout, sha

    def test_all_versions_select_their_own_layout_and_report_checksum(self):
        for version, count in [('8.0.0.30', 929), ('8.0.0.32', 1014), ('8.0.0.33', 1030)]:
            for short in [True, False]:
                layout, sha = self.archive(version, short=short)
                result = ingest.run(arguments(self.path))
                self.assertEqual(result['status'], 'validated')
                self.assertEqual(result['export_version'], version)
                self.assertEqual(result['layout_sha256'], sha)
                self.assertEqual(sum(len(s['fields']) for s in layout['files'].values()), count)
                self.assertEqual(sum(f['rows'] for f in result['files'].values()), 20)

    def test_2025_certified_8030_validates_with_both_filename_conventions(self):
        for short in [True, False]:
            self.archive('8.0.0.30', short=short, year=2025)
            result = ingest.run(arguments(self.path, year=2025, roll_stage='certified'))
            self.assertEqual(result['status'], 'validated')
            self.assertEqual(result['tax_year'], 2025)
            self.assertEqual(result['roll_stage'], 'certified')
            with self.assertRaisesRegex(ingest.ValidationError, 'Header appraisal year'):
                ingest.run(arguments(self.path, year=2026))

    def test_8030_reserved_offsets_are_not_newer_ownership_or_mineral_fields(self):
        layout, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.30'])
        spec = next(s for s in layout['files'].values() if s['worksheet'] == 'Property')
        raw = bytearray(b' ' * 9247)
        raw[0:12] = b'000000736302'
        raw[3993:3996] = b'123'
        raw[4227:4230] = b'ABC'
        self.assertEqual(ingest.parse_record(bytes(raw), spec), {
            'prop_id': '000000736302', 'filler__3994': '123', 'filler__4228': 'ABC'})

    def test_8030_documented_widths_and_full_field_coverage(self):
        old, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.30'])
        newer, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.32'])
        changed = {'Property': (9247, 446), 'PropertyEntity': (2750, 186),
                   'EntityTotals': (2140, 153), 'SB12': (None, 18)}
        for pattern, spec in old['files'].items():
            if spec['worksheet'] in changed:
                width, count = changed[spec['worksheet']]
                self.assertEqual(spec.get('record_length'), width)
                self.assertEqual(len(spec['fields']), count)
            else:
                self.assertEqual(spec, newer['files'][pattern])
            self.assertEqual(len({f['name'] for f in spec['fields']}), len(spec['fields']))
            if spec['format'] == 'fixed-width':
                cursor = 1
                for field in spec['fields']:
                    self.assertEqual(field['start'], cursor)
                    cursor = field['end'] + 1
                self.assertEqual(cursor - 1, spec['record_length'])

    def test_8030_sb12_has_no_fabricated_property_year(self):
        layout, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.30'])
        spec = next(s for s in layout['files'].values() if s['worksheet'] == 'SB12')
        raw = make_row(spec, {'calc_year': '2023', 'freeze_yr': '2021'})
        parsed = ingest.parse_record(raw.rstrip(b'\r\n'), spec)
        self.assertEqual(parsed['calc_year'], '2023')
        self.assertEqual(parsed['freeze_yr'], '2021')
        self.assertNotIn('prop_val_yr', parsed)

    def test_8030_mismatched_layout_rejects_changed_files(self):
        for actual, claimed in [('8.0.0.30', '8.0.0.32'), ('8.0.0.32', '8.0.0.30')]:
            self.archive(actual, header_version=claimed)
            with self.assertRaises(ingest.ArchiveValidationError) as caught:
                ingest.run(arguments(self.path))
            expected = {'Property', 'PropertyEntity', 'EntityTotals'}
            # An optional trailing tab in .30 can look like a blank 19th column
            # in .32. The three exact fixed-width checks still reject the ZIP.
            # The observed .30 SB12 extension now accepts the later 19-column
            # record. It does not relax any of the fixed-width file checks.
            self.assertEqual({f['record_type'] for f in caught.exception.report['validation_failures']},
                             expected)

    def test_8030_sb12_extension_preserves_fields_and_validates_year(self):
        layout, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.30'])
        spec = next(s for s in layout['files'].values() if s['worksheet'] == 'SB12')
        raw = make_row(spec, {'calc_year': '2023', 'freeze_yr': '2021',
                              'calc_compression_amt': '0', 'entity_name': ''}).rstrip(b'\r\n')[:-1]
        ordinary = ingest.parse_record(raw, spec)
        for suffix in [b'', b'\t']:
            self.assertEqual(ingest.parse_record(raw + suffix, spec), ordinary)
            parsed = ingest.parse_record(raw + b'\t2025' + suffix, spec)
            self.assertEqual(parsed, {**ordinary, 'prop_val_yr': '2025'})
            self.assertEqual(ingest.validate_record_year(parsed, spec, 2025), 2025)
            with self.assertRaisesRegex(ingest.ValidationError, 'declared dataset year'):
                ingest.validate_record_year(parsed, spec, 2026)
        self.assertEqual(len(spec['fields']), 18)  # parsing never mutates the schema

    def test_8030_sb12_extension_rejects_unknown_columns_and_malformed_years(self):
        layout, _ = ingest.read_layout(ingest.SUPPORTED_LAYOUTS['8.0.0.30'])
        spec = next(s for s in layout['files'].values() if s['worksheet'] == 'SB12')
        raw = make_row(spec).rstrip(b'\r\n')[:-1]
        for suffix in [b'\tPRIVATE!', b'\t25', b'\t20x5\t', b'\t\t',
                       b'\t2025\textra', b'\t2025\t\t']:
            with self.subTest(suffix=suffix), self.assertRaises(ingest.ValidationError) as caught:
                ingest.parse_record(raw + suffix, spec)
            self.assertNotIn('PRIVATE!', str(caught.exception))

    def test_8030_extended_sb12_scans_and_reaches_the_loader(self):
        layout, sha = self.archive('8.0.0.30', year=2025)
        # Rewrite the synthetic archive with the observed SB12 shape.
        with zipfile.ZipFile(self.path, 'r') as archive:
            contents = {item.filename: archive.read(item) for item in archive.infolist()}
        contents['SB12.TXT'] = contents['SB12.TXT'].removesuffix(b'\t\r\n') + b'\t2025\t\r\n'
        with zipfile.ZipFile(self.path, 'w') as archive:
            for name, raw in contents.items():
                archive.writestr(name, raw)
        args = arguments(self.path, year=2025, roll_stage='certified')
        result = ingest.run(args)
        sb12 = next(f for f in result['files'].values() if f['record_type'] == 'SB12')
        self.assertEqual(sb12['record_year_counts'], {'2025': 1})
        captured = []
        def loader(archive, members, *unused):
            item, spec = next((i, s) for i, s in members if s['worksheet'] == 'SB12')
            ingest.scan_member(archive, item, spec, 2025, 'ascii', lambda _, f: captured.append(f))
            return {'status': 'ready'}
        args.load = True
        args.expected_sha256 = ingest.digest(self.path)
        args.archive_store = self.root / 'retained'
        with patch.object(ingest, 'load_postgres', side_effect=loader):
            ingest.run_validated(args)
        self.assertEqual(captured[0]['prop_val_yr'], '2025')

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
