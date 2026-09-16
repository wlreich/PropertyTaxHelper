import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('factor_import', Path(__file__).with_name('import.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class ImportTests(unittest.TestCase):
    def test_exact_codes_pages_and_footer(self):
        rows = module.parse('NBHD Current Market\n Adjustment\n T100 146\n\f B N 1314MH 100\nTotal NBHDs\n1578 999\n')
        self.assertEqual(rows, [{'neighborhood':'T100','factor_percent':'146','page':1}, {'neighborhood':'B N 1314MH','factor_percent':'100','page':2}])
    def test_reject_duplicate_malformed_empty_and_nonpositive(self):
        for text in ['T1 100\nT1 120', 'T1 something', '', 'T1 0', '123 123']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                module.parse(text)
if __name__ == '__main__':
    unittest.main()
