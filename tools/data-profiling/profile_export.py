#!/usr/bin/env python3
"""Read-only, streaming profiler for ZIP-packaged appraisal exports."""

from __future__ import annotations

import argparse
import codecs
import fnmatch
import hashlib
import json
import sqlite3
import tempfile
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Iterator

CHUNK_SIZE = 4 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_lines(source: BinaryIO) -> Iterator[tuple[bytes, str]]:
    """Yield content bytes and the observed line ending without loading the file."""
    pending = b""
    while chunk := source.read(CHUNK_SIZE):
        data = pending + chunk
        pieces = data.splitlines(keepends=True)
        pending = b""
        if pieces and (not pieces[-1].endswith((b"\n", b"\r")) or data.endswith(b"\r")):
            pending = pieces.pop()
        for piece in pieces:
            if piece.endswith(b"\r\n"):
                yield piece[:-2], "CRLF"
            elif piece.endswith(b"\n"):
                yield piece[:-1], "LF"
            elif piece.endswith(b"\r"):
                yield piece[:-1], "CR"
            else:
                yield piece, "none"
    if pending:
        yield pending, "none"


def detect_encoding(sample: bytes) -> str:
    if sample.startswith(b"\xef\xbb\xbf"):
        return "UTF-8 with BOM"
    if all(byte < 128 for byte in sample):
        return "ASCII-compatible (sample contains only 7-bit bytes)"
    try:
        sample.decode("utf-8", errors="strict")
        return "UTF-8 (sample-valid)"
    except UnicodeDecodeError:
        return "Windows-1252-compatible (sample is not valid UTF-8)"


def matching_layout(name: str, layout_map: dict) -> dict:
    for pattern, rule in layout_map.get("files", {}).items():
        if fnmatch.fnmatch(name.upper(), pattern.upper()):
            return {"pattern": pattern, **rule}
    return {}


class KeyAuditor:
    """Exact duplicate counts over SHA-256 key digests using bounded memory."""

    def __init__(self) -> None:
        handle = tempfile.NamedTemporaryFile(prefix="profile-keys-", suffix=".sqlite3", delete=False)
        self.path = Path(handle.name)
        handle.close()
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA journal_mode=OFF")
        self.db.execute("PRAGMA synchronous=OFF")
        self.db.execute(
            "CREATE TABLE seen (audit TEXT NOT NULL, digest BLOB NOT NULL, n INTEGER NOT NULL, "
            "PRIMARY KEY (audit, digest)) WITHOUT ROWID"
        )

    def add_batch(self, audit: str, digests: list[bytes]) -> None:
        self.db.executemany(
            "INSERT INTO seen(audit,digest,n) VALUES(?,?,1) "
            "ON CONFLICT(audit,digest) DO UPDATE SET n=n+1",
            ((audit, digest) for digest in digests),
        )

    def summary(self, audit: str) -> dict[str, int]:
        unique, duplicates = self.db.execute(
            "SELECT COUNT(*), COALESCE(SUM(n-1),0) FROM seen WHERE audit=?", (audit,)
        ).fetchone()
        return {"unique_key_count": unique, "duplicate_key_record_count": duplicates}

    def close(self) -> None:
        self.db.close()
        self.path.unlink(missing_ok=True)


def profile_text_entry(
    archive: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    rule: dict,
    auditor: KeyAuditor | None,
) -> dict:
    lengths: Counter[int] = Counter()
    endings: Counter[str] = Counter()
    delimiter_counts: Counter[int] = Counter()
    blank_lines = nul_lines = 0
    all_ascii = True
    utf8_valid = True
    utf8_decoder = codecs.getincrementaldecoder("utf-8")("strict")
    trailing_delimiter_rows = 0
    sample = bytearray()
    expected_length = rule.get("record_length")
    delimiter = rule.get("delimiter")
    delimiter_bytes = delimiter.encode("ascii") if delimiter else None
    malformed = 0
    key_rules = rule.get("key_audits", []) if auditor else []
    blank_keys = {key["name"]: 0 for key in key_rules}
    batches: dict[str, list[bytes]] = {key["name"]: [] for key in key_rules}

    with archive.open(info, "r") as source:
        for line, ending in iter_lines(source):
            endings[ending] += 1
            lengths[len(line)] += 1
            blank_lines += not line
            nul_lines += b"\x00" in line
            all_ascii = all_ascii and line.isascii()
            if utf8_valid:
                try:
                    utf8_decoder.decode(line + b"\n", final=False)
                except UnicodeDecodeError:
                    utf8_valid = False
            if len(sample) < 65536:
                sample.extend(line[: 65536 - len(sample)])
            if expected_length is not None and len(line) != expected_length:
                malformed += 1
            if delimiter_bytes:
                columns = line.count(delimiter_bytes) + 1
                if rule.get("allow_trailing_empty") and line.endswith(delimiter_bytes):
                    columns -= 1
                    trailing_delimiter_rows += 1
                delimiter_counts[columns] += 1
                expected_columns = rule.get("expected_columns")
                if expected_columns is not None and columns != expected_columns:
                    malformed += 1
            for key in key_rules:
                parts = [line[field["start"] - 1 : field["end"]].strip() for field in key["fields"]]
                if any(not part for part in parts):
                    blank_keys[key["name"]] += 1
                digest = hashlib.sha256(b"\x1f".join(parts)).digest()
                batch = batches[key["name"]]
                batch.append(digest)
                if len(batch) >= 10000:
                    auditor.add_batch(f"{info.filename}:{key['name']}", batch)
                    batch.clear()

    if utf8_valid:
        try:
            utf8_decoder.decode(b"", final=True)
        except UnicodeDecodeError:
            utf8_valid = False

    key_results = []
    for key in key_rules:
        name = key["name"]
        if batches[name]:
            auditor.add_batch(f"{info.filename}:{name}", batches[name])
        key_results.append(
            {
                "name": name,
                "status": key.get("status", "candidate"),
                "fields": [field["name"] for field in key["fields"]],
                "blank_key_record_count": blank_keys[name],
                **auditor.summary(f"{info.filename}:{name}"),
            }
        )

    row_count = sum(lengths.values())
    mode_length = lengths.most_common(1)[0][0] if lengths else None
    dominant_columns = delimiter_counts.most_common(1)[0][0] if delimiter_counts else None
    return {
        "format": rule.get("format", "text"),
        "encoding": (
            "ASCII (entire file contains only 7-bit bytes)"
            if all_ascii
            else "UTF-8 (entire file is valid)"
            if utf8_valid
            else "Windows-1252-compatible (file contains bytes invalid under UTF-8)"
        ),
        "row_count": row_count,
        "line_endings": dict(sorted(endings.items())),
        "blank_line_count": blank_lines,
        "nul_containing_line_count": nul_lines,
        "record_length": {
            "expected": expected_length,
            "minimum": min(lengths, default=None),
            "maximum": max(lengths, default=None),
            "mode": mode_length,
            "distinct_count": len(lengths),
            "top_counts": [{"length": length, "rows": count} for length, count in lengths.most_common(10)],
            "consistent": len(lengths) == 1,
        },
        "delimiter_columns": (
            {
                "delimiter": "TAB" if delimiter == "\t" else delimiter,
                "expected": rule.get("expected_columns"),
                "mode": dominant_columns,
                "distinct_count": len(delimiter_counts),
                "top_counts": [
                    {"columns": columns, "rows": count} for columns, count in delimiter_counts.most_common(10)
                ],
                "trailing_delimiter_row_count": trailing_delimiter_rows,
            }
            if delimiter_bytes
            else None
        ),
        "malformed_record_count": malformed,
        "key_audits": key_results,
    }


def profile_archive(archive_path: Path, layout_map: dict, audit_keys: bool) -> dict:
    result = {
        "tool_version": "1.0.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "archive": {
            "path": str(archive_path),
            "filename": archive_path.name,
            "byte_size": archive_path.stat().st_size,
            "sha256": sha256_file(archive_path),
        },
        "layout_map": {
            "name": layout_map.get("name"),
            "source": layout_map.get("source"),
        },
        "entries": [],
    }
    auditor = KeyAuditor() if audit_keys else None
    try:
        with zipfile.ZipFile(archive_path, "r") as archive:
            names = [info.filename for info in archive.infolist()]
            duplicate_names = sorted(name for name, count in Counter(names).items() if count > 1)
            result["archive"]["entry_count"] = len(names)
            result["archive"]["duplicate_entry_names"] = duplicate_names
            result["archive"]["zip_test"] = archive.testzip()
            for info in archive.infolist():
                rule = matching_layout(info.filename, layout_map)
                entry = {
                    "filename": info.filename,
                    "byte_size": info.file_size,
                    "compressed_byte_size": info.compress_size,
                    "crc32": f"{info.CRC:08x}",
                    "zip_timestamp_unzoned": datetime(*info.date_time).isoformat(),
                    "layout_pattern": rule.get("pattern"),
                    "layout_worksheet": rule.get("worksheet"),
                    "business_purpose": rule.get("business_purpose"),
                }
                if info.is_dir():
                    entry["format"] = "directory"
                elif rule.get("format") == "binary" or info.filename.lower().endswith(".pdf"):
                    entry["format"] = "binary"
                    entry["profile_note"] = "Binary entry was inventoried but not parsed as records."
                else:
                    entry.update(profile_text_entry(archive, info, rule, auditor))
                result["entries"].append(entry)
    finally:
        if auditor:
            auditor.close()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="ZIP archive to profile read-only")
    parser.add_argument("--layout-map", type=Path, help="JSON map of expected formats and keys")
    parser.add_argument("--output", type=Path, help="JSON output path; defaults to stdout")
    parser.add_argument(
        "--audit-keys",
        action="store_true",
        help="Count blank and duplicate configured keys using a temporary SQLite index of SHA-256 digests",
    )
    args = parser.parse_args()
    if not args.archive.is_file():
        parser.error(f"archive not found: {args.archive}")
    layout_map = json.loads(args.layout_map.read_text(encoding="utf-8")) if args.layout_map else {}
    profile = profile_archive(args.archive.resolve(), layout_map, args.audit_keys)
    rendered = json.dumps(profile, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8", newline="\n")
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
