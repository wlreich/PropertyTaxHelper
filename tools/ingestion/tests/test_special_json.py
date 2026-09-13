import json
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import sys
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ingest_tcad_special as special
import run_job


def appeal(appeal_id=10, property_id=101, year=2026, **overrides):
    value = {
        "appealID": appeal_id,
        "pID": property_id,
        "pYear": year,
        "appealStatus": "ORDT",
        "appealType": "P",
        "appealedByType": "O",
        "informal": 1,
        "finalized": 1,
        "initialAppraisedValue": 500000,
        "noticeAppraisedValue": 500000,
        "finalAppraisedValue": 450000,
        "informalDecisionAdjustmentValue": 50000,
        "formalDecisionAdjustmentValue": 0,
        "decisionAuthority": "N/A",
        "finalizedDt": "2026-07-01T12:00:00",
        "claimantComments": "PRIVATE COMMENT MUST NOT BE RETAINED",
        "appealAssignedTo": "PRIVATE STAFF NAME",
    }
    value.update(overrides)
    return value


def properties():
    return [
        {"pID": 100, "pYear": 2026, "owners": [{"name": "PRIVATE OWNER"}], "appeals": []},
        {"pID": 101, "pYear": 2026, "owners": [{"name": "PRIVATE OWNER"}], "appeals": [appeal()]},
        {"pID": "000102", "pYear": 2026, "appeals": [appeal(11, 102, informal=0,
          initialAppraisedValue=400000, finalAppraisedValue=400000, appealStatus="EF_AS")]},
    ]


def make_zip(path, payload=None, extra=None, name="Travis-protaxExport-20260827.json"):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
        archive.writestr(name, json.dumps(properties() if payload is None else payload))
        if extra:
            archive.writestr(extra, "x")


class SpecialJsonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "special.zip"

    def args(self):
        return SimpleNamespace(archive=self.path, year=2026, roll_stage="supplemental",
          source_url="https://traviscad.org/publicinformation/", encoding="utf-8",
          expected_sha256=None, receipt=None, archive_store=None, archive_backend=None,
          load=False, import_scope="special_protests")

    def test_streams_properties_and_keeps_only_allowlisted_appeal_fields(self):
        make_zip(self.path)
        captured = []
        with zipfile.ZipFile(self.path) as archive:
            item = special.select_member(archive)
            summary = special.scan_member(archive, item, 2026,
              lambda prop, appeals: captured.append((prop, appeals)))
        self.assertEqual(summary["rows"], 3)
        self.assertEqual(summary["properties_with_appeals"], 2)
        self.assertEqual(summary["appeals"], 2)
        self.assertEqual(summary["appeal_status_counts"], {"EF_AS": 1, "ORDT": 1})
        self.assertEqual(summary["informal_appeals"], 1)
        self.assertEqual(summary["finalized_appeals"], 2)
        self.assertEqual(summary["initial_to_final_appraised_value"],
                         {"reduced": 1, "unchanged": 1, "increased": 0})
        self.assertEqual(captured[2][0]["property_id"], "102")
        serialized = json.dumps(captured, default=str)
        self.assertNotIn("PRIVATE", serialized)
        self.assertNotIn("owners", serialized)
        result = special.run(self.args())
        self.assertEqual(result["status"], "validated")
        self.assertEqual(result["source_member_date_raw"], "20260827")
        self.assertIsNone(result["export_run_time_raw"])

    def test_preserves_bounded_printable_source_status_text(self):
        make_zip(self.path, [{"pID": 1, "pYear": 2026,
          "appeals": [appeal(10, 1, appealStatus="ARB Hearing/Set (Informal)")]}])
        with zipfile.ZipFile(self.path) as archive:
            item = special.select_member(archive)
            captured = []
            special.scan_member(archive, item, 2026,
              lambda prop, appeals: captured.extend(appeals))
        self.assertEqual(captured[0]["appeal_status"], "ARB Hearing/Set (Informal)")

    def test_rejects_non_array_multiple_members_and_unsafe_identity_links(self):
        cases = [
          ({"pID": 1}, None, "top level"),
          (properties(), "extra.txt", "exactly one JSON"),
          ([{"pID": 1, "pYear": 2025, "appeals": []}], None, "Property year"),
          ([{"pID": 1, "pYear": 2026, "appeals": [appeal(pID=2)]}], None, "identifier differs"),
          ([{"pID": 1, "pYear": 2026, "appeals": [appeal(appealStatus="bad\ncode", pID=1)]}], None, "unsupported code text"),
          ([{"pID": 1, "pYear": 2026, "appeals": []}, {"pID": "01", "pYear": 2026, "appeals": []}], None, "duplicate property"),
          ([{"pID": 1, "pYear": 2026, "appeals": [appeal(10, 1)]},
            {"pID": 2, "pYear": 2026, "appeals": [appeal(10, 2)]}], None,
           "duplicate appeal identifier"),
        ]
        for payload, extra, message in cases:
            with self.subTest(message=message):
                make_zip(self.path, payload, extra)
                with self.assertRaisesRegex(special.ValidationError, message):
                    special.run(self.args())

    def test_special_workflow_requires_supplemental_utf8_and_accepts_uploaded_name_spaces(self):
        env = {"INPUT_MODE": "validate_special_uploaded", "INPUT_TAX_YEAR": "2026",
          "INPUT_ROLL_STAGE": "supplemental", "INPUT_ENCODING": "utf-8",
          "INPUT_UPLOADED_ARCHIVE_KEY": "incoming/2026 Special export Supp 2 08292026.zip"}
        with patch.dict(os.environ, env, clear=True):
            config = run_job.settings()
            self.assertEqual(config["import_scope"], "special_protests")
            self.assertEqual(config["uploaded_key"], env["INPUT_UPLOADED_ARCHIVE_KEY"])
            os.environ["INPUT_ENCODING"] = "ascii"
            with self.assertRaisesRegex(run_job.JobError, "UTF-8"):
                run_job.settings()
            os.environ["INPUT_ENCODING"] = "utf-8"
            os.environ["INPUT_ROLL_STAGE"] = "certified"
            with self.assertRaises(run_job.JobError):
                run_job.settings()
        env.update(INPUT_MODE="import_special", INPUT_ARCHIVE_SHA256="a"*64,
                   INPUT_RECEIPT_SHA256="b"*64, INPUT_IMPORT_APPROVED="true")
        with patch.dict(os.environ, env, clear=True):
            self.assertEqual(run_job.settings()["import_scope"], "special_protests")


if __name__ == "__main__":
    unittest.main()
