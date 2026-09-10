"""Selective imports must preserve evidence without claiming a full release."""
import os
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch
import zipfile

from test_ingest_tcad import ingest, arguments, make_archive, make_row, SHORT_NAMES
from test_job import run_job


class ProtestImportTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'source.zip'

    def test_all_supported_versions_select_only_four_types(self):
        for version, layout_path in ingest.SUPPORTED_LAYOUTS.items():
            layout, sha = ingest.read_layout(layout_path)
            for short in (True, False):
                with zipfile.ZipFile(self.path, 'w') as archive:
                    for pattern, spec in layout['files'].items():
                        name = SHORT_NAMES[spec['worksheet']] + '.TXT' if short else pattern.replace('*', '2026-export')
                        archive.writestr(name, make_row(spec, {'export_version': version}))
                    archive.writestr('totals.pdf', b'not parsed for protests')
                result = ingest.run(arguments(self.path, import_scope='protests'))
                self.assertEqual(result['import_scope'], 'protests')
                self.assertEqual(result['layout_sha256'], sha)
                self.assertEqual({f['record_type'] for f in result['files'].values()}, ingest.PROTEST_RECORD_TYPES)
                self.assertEqual(result['members_checked'], 4)
                self.assertEqual(len(result['skipped_members']), 17)
                self.assertTrue(all(m['status'] == 'not_validated_or_loaded' for m in result['skipped_members']))

    def test_unselected_content_is_not_opened_but_still_requires_safe_inventory(self):
        make_archive(self.path, overrides={'Improvement': {'prop_val_yr': 'BAD!'}})
        scan = ingest.scan_member
        def selected_only(archive, item, spec, *args, **kwargs):
            self.assertIn(spec['worksheet'], ingest.PROTEST_RECORD_TYPES)
            return scan(archive, item, spec, *args, **kwargs)
        with patch.object(ingest, 'scan_member', selected_only):
            self.assertEqual(ingest.run(arguments(self.path, import_scope='protests'))['status'], 'validated')
        with self.assertRaises(ingest.ArchiveValidationError):
            ingest.run(arguments(self.path))
        for extra in ({'../ignored.pdf': b'x'}, {'OTHER.TXT': b'x'}, {'ARB.TXT': b'x'}):
            make_archive(self.path, extra=extra)
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path, import_scope='protests'))

    def test_required_members_and_malformed_selected_rows_fail(self):
        for record_type in ingest.PROTEST_RECORD_TYPES:
            make_archive(self.path, omit=record_type)
            with self.assertRaises(ingest.ValidationError):
                ingest.run(arguments(self.path, import_scope='protests'))
        for record_type in ('Property','ARB','Agent'):
            make_archive(self.path, short_names=True, omit=record_type,
                         extra={SHORT_NAMES[record_type] + '.TXT': b'bad length\n'})
            with self.assertRaises(ingest.ArchiveValidationError):
                ingest.run(arguments(self.path, import_scope='protests'))

    def test_four_file_zip_is_selective_only_and_preserves_case_years_and_dates(self):
        layout, _ = ingest.read_layout()
        with zipfile.ZipFile(self.path, 'w') as archive:
            for spec in layout['files'].values():
                if spec['worksheet'] in ingest.PROTEST_RECORD_TYPES:
                    raw = make_row(spec, {'run_date_time': '05/29/2026 18:30'})
                    if spec['worksheet'] == 'ARB':
                        raw += make_row(spec, {'prop_val_yr': '02025', 'arb_status': 'EF_RS'})
                    archive.writestr(SHORT_NAMES[spec['worksheet']] + '.TXT', raw)
        result = ingest.run(arguments(self.path, import_scope='protests'))
        self.assertEqual(result['export_run_time_raw'], '05/29/2026 18:30')
        self.assertEqual(result['files']['ARB.TXT']['record_year_counts'], {'2026':1, '2025':1})
        with self.assertRaises(ingest.ValidationError):
            ingest.run(arguments(self.path))
        with self.assertRaisesRegex(ingest.ValidationError, 'Invalid import scope'):
            ingest.run(arguments(self.path, import_scope='arb_only'))

    def test_workflow_modes_keep_approval_provenance_and_checksum_requirements(self):
        with patch.dict(os.environ, {'INPUT_MODE':'validate_protests_uploaded',
                                      'INPUT_ORIGINAL_FILENAME':'2026 Preliminary Export',
                                      'INPUT_UPLOADED_ARCHIVE_KEY':'incoming/protests.zip'}, clear=True):
            config = run_job.settings()
            self.assertEqual(config['import_scope'], 'protests')
            self.assertEqual(config['uploaded_key'], 'incoming/protests.zip')
            self.assertEqual(config['source_url_kind'], 'publisher_reference_page')
        for mode in ('import', 'import_protests'):
            with patch.dict(os.environ, {'INPUT_MODE':mode,'INPUT_ARCHIVE_SHA256':'a'*64,
                                         'INPUT_RECEIPT_SHA256':'b'*64}, clear=True):
                with self.assertRaises(run_job.JobError):
                    run_job.settings()
                os.environ['INPUT_IMPORT_APPROVED'] = 'true'
                config = run_job.settings()
                self.assertEqual(config['import_scope'], 'protests' if mode.endswith('protests') else 'full')
