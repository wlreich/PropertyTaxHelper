import io
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "profile_export.py"
SPEC = importlib.util.spec_from_file_location("profile_export", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
detect_encoding = MODULE.detect_encoding
iter_lines = MODULE.iter_lines
profile_archive = MODULE.profile_archive


class ProfileExportTests(unittest.TestCase):
    def test_iter_lines_preserves_line_ending_types(self):
        rows = list(iter_lines(io.BytesIO(b"abc\r\ndef\nghi\rjkl")))
        self.assertEqual(rows, [(b"abc", "CRLF"), (b"def", "LF"), (b"ghi", "CR"), (b"jkl", "none")])

    def test_iter_lines_handles_crlf_across_chunk_boundary(self):
        original = MODULE.CHUNK_SIZE
        MODULE.CHUNK_SIZE = 4
        try:
            rows = list(iter_lines(io.BytesIO(b"abc\r\ndef\r\n")))
        finally:
            MODULE.CHUNK_SIZE = original
        self.assertEqual(rows, [(b"abc", "CRLF"), (b"def", "CRLF")])

    def test_profiles_synthetic_fixed_width_records(self):
        with tempfile.TemporaryDirectory() as temp:
            archive_path = Path(temp) / "synthetic.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("SYNTHETIC.TXT", b"0012026\r\n0012026\r\n0022026\r\n")
            layout = {
                "name": "synthetic",
                "files": {
                    "SYNTHETIC.TXT": {
                        "format": "fixed-width",
                        "record_length": 7,
                        "key_audits": [
                            {
                                "name": "synthetic_key",
                                "status": "confirmed",
                                "fields": [
                                    {"name": "id", "start": 1, "end": 3},
                                    {"name": "year", "start": 4, "end": 7},
                                ],
                            }
                        ],
                    }
                },
            }
            result = profile_archive(archive_path, layout, audit_keys=True)
            entry = result["entries"][0]
            self.assertEqual(entry["row_count"], 3)
            self.assertEqual(entry["malformed_record_count"], 0)
            self.assertEqual(entry["key_audits"][0]["duplicate_key_record_count"], 1)

    def test_detects_ascii_sample(self):
        self.assertIn("ASCII", detect_encoding(b"plain text"))


if __name__ == "__main__":
    unittest.main()
