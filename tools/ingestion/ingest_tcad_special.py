#!/usr/bin/env python3
"""Stream TCAD Protax Special JSON and retain only protest observations."""
from __future__ import annotations

from collections import Counter
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import uuid
import zipfile

import ijson

import ingest_tcad as legacy
from chronology import read_receipt, utc_now, zip_clock


PARSER_VERSION = "special-json-1.0.0"
LAYOUT_PATH = Path(__file__).with_name("tcad-special-json-layout.json")
IMPORT_SCOPE = "special_protests"
MAX_UNCOMPRESSED_BYTES = 100 * 1024**3
MAX_APPEALS_PER_PROPERTY = 100
CODE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
DECISION_FIELDS = (
    "informalDecisionValueAdjustment",
    "formalDecisionValueAdjustment",
    "decision",
    "decisionAuthority",
    "decisionReason",
    "informalDt",
    "docketDt",
    "hearingLetterDt",
    "finalizedDt",
)

ValidationError = legacy.ValidationError


class HashingReader:
    def __init__(self, stream):
        self.stream = stream
        self.hasher = hashlib.sha256()
        self.bytes_read = 0

    def read(self, size=-1):
        value = self.stream.read(size)
        self.hasher.update(value)
        self.bytes_read += len(value)
        return value


def layout():
    payload = LAYOUT_PATH.read_bytes()
    return json.loads(payload), hashlib.sha256(payload).hexdigest()


def select_member(archive):
    files = []
    names = set()
    for item in archive.infolist():
        name = PurePosixPath(item.filename)
        if name.is_absolute() or ".." in name.parts or "\\" in item.filename:
            raise ValidationError("Unsafe archive member path")
        if item.is_dir():
            continue
        if item.filename.casefold() in names:
            raise ValidationError("Duplicate archive member name")
        names.add(item.filename.casefold())
        files.append(item)
    if len(files) != 1 or PurePosixPath(files[0].filename).suffix.lower() != ".json":
        raise ValidationError("Special export must contain exactly one JSON member")
    item = files[0]
    if item.flag_bits & 1:
        raise ValidationError("Encrypted ZIP members are not supported")
    if not 0 < item.file_size <= MAX_UNCOMPRESSED_BYTES:
        raise ValidationError("Special JSON member must be nonempty and no larger than 100 GiB")
    with archive.open(item) as stream:
        probe = stream.read(4096)
    first = probe.lstrip()[:1]
    if first != b"[":
        raise ValidationError("Special JSON top level must be an array")
    return item


def property_id(value, label):
    if isinstance(value, bool):
        raise ValidationError(label + " must be a positive numeric identifier")
    if isinstance(value, int):
        text = str(value)
    elif isinstance(value, str) and re.fullmatch(r"[0-9]{1,12}", value):
        text = value
    else:
        raise ValidationError(label + " must be a positive numeric identifier")
    normalized = text.lstrip("0")
    if not normalized or len(normalized) > 12:
        raise ValidationError(label + " must be a positive numeric identifier")
    return normalized


def integer(value, label, minimum=0):
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValidationError(label + " must be an integer")
    return value


def flag(value, label):
    if value in (0, 1) and not isinstance(value, bool):
        return bool(value)
    if isinstance(value, bool):
        return value
    raise ValidationError(label + " must be zero or one")


def code(value, label, required=False):
    if value is None and not required:
        return None
    if not isinstance(value, str) or not CODE.fullmatch(value):
        raise ValidationError(label + " contains an unsupported code")
    return value


def amount(value, label):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValidationError(label + " must be a nonnegative number")
    number = Decimal(str(value))
    if not number.is_finite() or number < 0 or number > Decimal("1000000000000000"):
        raise ValidationError(label + " must be a nonnegative number")
    return number


def private_text(value, label):
    if value is None:
        return None
    if (not isinstance(value, str) or len(value) > 500
            or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", value)):
        raise ValidationError(label + " contains unsupported text")
    return value


def appeal_record(value, parent_id, year, index):
    if not isinstance(value, dict):
        raise ValidationError("Appeal entry must be an object")
    appeal_id = integer(value.get("appealID"), "appealID", 1)
    if property_id(value.get("pID"), "appeal pID") != parent_id:
        raise ValidationError("Appeal property identifier differs from its parent property")
    appeal_year = integer(value.get("pYear"), "appeal pYear", 1900)
    if appeal_year != year:
        raise ValidationError("Appeal year differs from the declared dataset year")
    details = {name: private_text(value.get(name), name)
               for name in DECISION_FIELDS if value.get(name) is not None}
    return {
        "appeal_index": index,
        "appeal_id": appeal_id,
        "appeal_status": code(value.get("appealStatus"), "appealStatus", True),
        "appeal_type": code(value.get("appealType"), "appealType", True),
        "appealed_by_type": code(value.get("appealedByType"), "appealedByType"),
        "informal": flag(value.get("informal"), "informal"),
        "finalized": flag(value.get("finalized"), "finalized"),
        "initial_appraised_value": amount(value.get("initialAppraisedValue"), "initialAppraisedValue"),
        "notice_appraised_value": amount(value.get("noticeAppraisedValue"), "noticeAppraisedValue"),
        "final_appraised_value": amount(value.get("finalAppraisedValue"), "finalAppraisedValue"),
        "informal_adjustment_value": amount(value.get("informalDecisionAdjustmentValue"), "informalDecisionAdjustmentValue"),
        "formal_adjustment_value": amount(value.get("formalDecisionAdjustmentValue"), "formalDecisionAdjustmentValue"),
        "details": details,
    }


def property_record(value, year, row_number):
    if not isinstance(value, dict):
        raise ValidationError(f"Property row {row_number}: entry must be an object")
    try:
        pid = property_id(value.get("pID"), "pID")
        property_year = integer(value.get("pYear"), "pYear", 1900)
        if property_year != year:
            raise ValidationError("Property year differs from the declared dataset year")
        appeals = value.get("appeals")
        if not isinstance(appeals, list) or len(appeals) > MAX_APPEALS_PER_PROPERTY:
            raise ValidationError("appeals must be an array with at most 100 entries")
        parsed = [appeal_record(appeal, pid, year, index)
                  for index, appeal in enumerate(appeals, 1)]
        if len({appeal["appeal_id"] for appeal in parsed}) != len(parsed):
            raise ValidationError("Duplicate appeal identifier within property")
        return {"row_number": row_number, "property_id": pid,
                "tax_year": property_year, "appeal_count": len(parsed)}, parsed
    except ValidationError as error:
        raise ValidationError(f"Property row {row_number}: {error}") from error


def scan_member(archive, item, year, consume=None):
    seen = set()
    seen_appeals = set()
    statuses = Counter()
    years = Counter()
    properties = properties_with_appeals = appeals_total = serialized_bytes = 0
    informal = finalized = reduced = unchanged = increased = 0
    try:
        with archive.open(item) as raw:
            stream = HashingReader(raw)
            for properties, source in enumerate(ijson.items(stream, "item"), 1):
                prop, appeals = property_record(source, year, properties)
                if prop["property_id"] in seen:
                    raise ValidationError(f"Property row {properties}: duplicate property identifier")
                seen.add(prop["property_id"])
                years[str(prop["tax_year"])] += 1
                if appeals:
                    properties_with_appeals += 1
                appeals_total += len(appeals)
                for appeal in appeals:
                    if appeal["appeal_id"] in seen_appeals:
                        raise ValidationError(
                            f"Property row {properties}: duplicate appeal identifier in export"
                        )
                    seen_appeals.add(appeal["appeal_id"])
                    statuses[appeal["appeal_status"]] += 1
                    informal += int(appeal["informal"])
                    finalized += int(appeal["finalized"])
                    before, after = appeal["initial_appraised_value"], appeal["final_appraised_value"]
                    if before is not None and after is not None:
                        if after < before:
                            reduced += 1
                        elif after == before:
                            unchanged += 1
                        else:
                            increased += 1
                    serialized_bytes += len(json.dumps(appeal["details"], ensure_ascii=False).encode("utf-8"))
                if consume:
                    consume(prop, appeals)
            if stream.bytes_read != item.file_size:
                raise ValidationError("Special JSON stream ended before the ZIP member")
    except (ijson.JSONError, UnicodeError, zipfile.BadZipFile, EOFError) as error:
        raise ValidationError("Special JSON or ZIP member is structurally invalid") from error
    if properties == 0:
        raise ValidationError("Special JSON contains no properties")
    return {
        "sha256": stream.hasher.hexdigest(),
        "rows": properties,
        "properties_with_appeals": properties_with_appeals,
        "appeals": appeals_total,
        "appeal_status_counts": dict(sorted(statuses.items())),
        "record_year_counts": dict(sorted(years.items())),
        "informal_appeals": informal,
        "finalized_appeals": finalized,
        "initial_to_final_appraised_value": {
            "reduced": reduced, "unchanged": unchanged, "increased": increased,
        },
        "uncompressed_bytes": item.file_size,
        "serialized_fields_bytes": serialized_bytes,
        "record_type": "SpecialJSON",
        **zip_clock(item),
    }


def header_for(item, schema):
    match = re.search(r"(?<![0-9])([0-9]{8})(?![0-9])", PurePosixPath(item.filename).name)
    return {
        "format": "protax-special-json",
        "layout_version": schema["layout_version"],
        "member_name": item.filename,
        "member_date_raw": match.group(1) if match else None,
        "zip_modified_raw": zip_clock(item)["zip_modified_raw"],
        "date_evidence_note": "Member filename and ZIP clock are retained as raw evidence, not asserted as publication time.",
    }


def load_postgres(archive, item, header, layout_sha, archive_sha, archived_path,
                  args, connection, attempt_id):
    import psycopg
    from psycopg.types.json import Jsonb

    lock_material = archive_sha + layout_sha + PARSER_VERSION + args.encoding + IMPORT_SCOPE
    lock_key = int.from_bytes(hashlib.sha256(lock_material.encode()).digest()[:8], "big", signed=True)
    if not connection.execute("select pg_try_advisory_lock(%s)", (lock_key,)).fetchone()[0]:
        raise ValidationError("Another loader is already processing this dataset")
    row = connection.execute("""select id,tax_year,roll_stage,source_url from tcad_ingest.datasets
      where archive_sha256=%s and layout_sha256=%s and parser_version=%s
      and source_encoding=%s and import_scope=%s""",
      (archive_sha, layout_sha, PARSER_VERSION, args.encoding, IMPORT_SCOPE)).fetchone()
    if row:
        dataset_id = row[0]
        if row[1:] != (args.year, args.roll_stage, args.source_url):
            raise ValidationError("Existing dataset metadata differs; do not relabel a release")
    else:
        dataset_id = uuid.uuid4()
        connection.execute("""insert into tcad_ingest.datasets
          (id,archive_sha256,layout_sha256,parser_version,source_encoding,tax_year,roll_stage,
           source_url,archive_location,header,import_scope)
          values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
          (dataset_id, archive_sha, layout_sha, PARSER_VERSION, args.encoding, args.year,
           args.roll_stage, args.source_url, str(archived_path), Jsonb(header), IMPORT_SCOPE))
    legacy.record_event(connection, attempt_id, "dataset_selected", dataset_id=dataset_id,
                        details={"import_scope": IMPORT_SCOPE})
    try:
        connection.execute("update tcad_ingest.datasets set status='loading',completed_at=null,last_error=null where id=%s", (dataset_id,))
        previous = connection.execute("""select sha256,row_count,uncompressed_bytes,status
          from tcad_ingest.files where dataset_id=%s and member_name=%s""",
          (dataset_id, item.filename)).fetchone()
        if previous:
            if previous[3] != "complete" or previous[2] != item.file_size:
                raise ValidationError("Stored member state is inconsistent; investigate before retry")
            summary = {item.filename: {"rows": previous[1], "sha256": previous[0], "resumed": True}}
        else:
            with connection.transaction():
                clock = zip_clock(item)
                connection.execute("""insert into tcad_ingest.files
                  (dataset_id,member_name,record_type,uncompressed_bytes,zip_modified_raw,zip_modified_local)
                  values (%s,%s,'SpecialJSON',%s,%s,%s)""",
                  (dataset_id, item.filename, item.file_size, Jsonb(clock["zip_modified_raw"]),
                   clock["zip_modified_local"]))
                property_batch, appeal_batch, batch_bytes = [], [], 0
                with connection.cursor() as cursor:
                    def flush():
                        nonlocal batch_bytes
                        if property_batch:
                            cursor.executemany("""insert into tcad_ingest.special_json_properties
                              (dataset_id,row_number,property_id,tax_year,appeal_count)
                              values (%s,%s,%s,%s,%s)""", property_batch)
                            property_batch.clear()
                        if appeal_batch:
                            cursor.executemany("""insert into tcad_ingest.special_json_appeals
                              (dataset_id,property_row_number,appeal_index,property_id,tax_year,appeal_id,
                               appeal_status,appeal_type,appealed_by_type,informal,finalized,
                               initial_appraised_value,notice_appraised_value,final_appraised_value,
                               informal_adjustment_value,formal_adjustment_value,details)
                              values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                              appeal_batch)
                            appeal_batch.clear()
                        batch_bytes = 0

                    def consume(prop, appeals):
                        nonlocal batch_bytes
                        property_batch.append((dataset_id, prop["row_number"], prop["property_id"],
                                               prop["tax_year"], prop["appeal_count"]))
                        for appeal in appeals:
                            appeal_batch.append((dataset_id, prop["row_number"], appeal["appeal_index"],
                              prop["property_id"], prop["tax_year"], appeal["appeal_id"],
                              appeal["appeal_status"], appeal["appeal_type"], appeal["appealed_by_type"],
                              appeal["informal"], appeal["finalized"], appeal["initial_appraised_value"],
                              appeal["notice_appraised_value"], appeal["final_appraised_value"],
                              appeal["informal_adjustment_value"], appeal["formal_adjustment_value"],
                              Jsonb(appeal["details"])))
                            batch_bytes += len(json.dumps(appeal["details"], ensure_ascii=False))
                        if len(property_batch) >= 500 or batch_bytes >= 1024 * 1024:
                            flush()

                    result = scan_member(archive, item, args.year, consume)
                    flush()
                connection.execute("""update tcad_ingest.files set status='complete',sha256=%s,row_count=%s
                  where dataset_id=%s and member_name=%s""",
                  (result["sha256"], result["rows"], dataset_id, item.filename))
                summary = {item.filename: result}
        connection.execute("update tcad_ingest.datasets set status='ready',completed_at=now() where id=%s", (dataset_id,))
    except Exception as error:
        try:
            connection.execute("update tcad_ingest.datasets set status='failed',last_error=%s where id=%s",
                               (type(error).__name__, dataset_id))
        except psycopg.Error:
            pass
        raise
    return {"dataset_id": str(dataset_id), "files": summary, "status": "ready"}


def run_validated(args, connection=None, attempt_id=None):
    if getattr(args, "import_scope", None) != IMPORT_SCOPE:
        raise ValidationError("Special JSON requires the special_protests import scope")
    if args.roll_stage != "supplemental" or args.encoding != "utf-8":
        raise ValidationError("Special JSON requires supplemental roll stage and UTF-8 encoding")
    archive_sha = legacy.digest(args.archive)
    if args.expected_sha256 and archive_sha != args.expected_sha256.lower():
        raise ValidationError("Archive SHA-256 does not match the approved checksum")
    try:
        observation = read_receipt(getattr(args, "receipt", None), archive_sha, args.source_url)
    except (ValueError, KeyError, TypeError) as error:
        raise ValidationError("Invalid acquisition receipt: check checksum, URL, dates and evidence") from error
    if connection:
        receipt_sha = legacy.record_acquisition(connection, observation)
        legacy.record_event(connection, attempt_id, "archive_verified",
                            acquisition_receipt_sha256=receipt_sha,
                            details={"archive_sha256": archive_sha})
    path = Path(args.archive)
    archived_location = None
    if args.load:
        if not args.expected_sha256 or not (args.archive_store or getattr(args, "archive_backend", None)):
            raise ValidationError("--load requires --expected-sha256 and --archive-store")
        backend = getattr(args, "archive_backend", None)
        if backend:
            from archive_storage import archive_key, receipt_key
            if not args.receipt:
                raise ValidationError("Cloud archive loads require an acquisition receipt")
            archived_location = backend.retain(path, archive_key(archive_sha), archive_sha, "application/zip")
            receipt_sha = legacy.digest(args.receipt)
            backend.retain(args.receipt, receipt_key(archive_sha, receipt_sha), receipt_sha, "application/json")
        else:
            path = legacy.retain_archive(path, args.archive_store, archive_sha)
            archived_location = path
    schema, layout_sha = layout()
    with zipfile.ZipFile(path) as archive:
        item = select_member(archive)
        header = header_for(item, schema)
        if args.load:
            result = load_postgres(archive, item, header, layout_sha, archive_sha,
                                   archived_location, args, connection, attempt_id)
        else:
            summary = scan_member(archive, item, args.year)
            result = {"status": "validated", "files": {item.filename: summary},
                      "members_checked": 1}
    return {
        "parser_version": PARSER_VERSION,
        "archive_sha256": archive_sha,
        "layout_sha256": layout_sha,
        "layout_name": schema["layout_name"],
        "tax_year": args.year,
        "roll_stage": args.roll_stage,
        "import_scope": IMPORT_SCOPE,
        "export_run_time_raw": None,
        "source_member_date_raw": header["member_date_raw"],
        "acquisition": observation["receipt"] if observation else None,
        **result,
    }


def run(args):
    if not args.load:
        started = utc_now()
        result = run_validated(args)
        return {**result, "validation_started_at": started,
                "validation_completed_at": utc_now()}
    if not args.expected_sha256 or not (args.archive_store or getattr(args, "archive_backend", None)):
        raise ValidationError("--load requires --expected-sha256 and --archive-store")
    import psycopg
    dsn = os.environ.get("TCAD_DATABASE_URL")
    if not dsn:
        raise ValidationError("Set TCAD_DATABASE_URL in the ingestion environment")
    with psycopg.connect(dsn, autocommit=True, connect_timeout=15) as connection:
        attempt_id = uuid.uuid4()
        connection.execute("""insert into tcad_ingest.import_attempts
          (id,source_url,archive_filename,tax_year,roll_stage,parser_version,source_encoding,import_scope)
          values (%s,%s,%s,%s,%s,%s,%s,%s)""",
          (attempt_id, args.source_url, Path(args.archive).name, args.year, args.roll_stage,
           PARSER_VERSION, args.encoding, IMPORT_SCOPE))
        try:
            result = run_validated(args, connection, attempt_id)
            legacy.record_event(connection, attempt_id, "succeeded", dataset_id=result["dataset_id"],
                                details={"resumed_files": sum(bool(f.get("resumed"))
                                         for f in result["files"].values())})
        except BaseException as error:
            try:
                legacy.record_event(connection, attempt_id, "failed",
                                    details={"error_type": type(error).__name__})
            except psycopg.Error:
                pass
            raise
    return {**result, "attempt_id": str(attempt_id)}


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--year", required=True, type=int, choices=range(1900, 2201), metavar="YEAR")
    parser.add_argument("--roll-stage", default="supplemental", choices=["supplemental"])
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--encoding", default="utf-8", choices=["utf-8"])
    parser.add_argument("--expected-sha256")
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--archive-store", type=Path)
    parser.add_argument("--load", action="store_true")
    args = parser.parse_args()
    args.import_scope = IMPORT_SCOPE
    try:
        result = run(args)
    except Exception as error:
        message = str(error) if isinstance(error, ValidationError) else type(error).__name__
        print(json.dumps({"status": "failed", "error": message}), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
