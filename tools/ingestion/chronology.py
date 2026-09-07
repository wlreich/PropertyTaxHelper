"""Explicit source chronology; never infer acquisition times from filesystem dates."""
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def aware_time(value):
    parsed = datetime.fromisoformat(value)
    if parsed.utcoffset() is None:
        raise ValueError('Acquisition timestamps require an explicit UTC offset')
    return parsed


def read_receipt(path, archive_sha, source_url):
    if path is None:
        return None
    payload = Path(path).read_bytes()
    receipt = json.loads(payload)
    if receipt.get('version') != 1 or receipt.get('archive_sha256') != archive_sha or receipt.get('source_url') != source_url:
        raise ValueError('Receipt does not identify this source URL and archive checksum')
    started = aware_time(receipt['download_started_at'])
    finished = aware_time(receipt['downloaded_at'])
    if finished < started:
        raise ValueError('Download completion precedes its start')
    publication = receipt.get('publisher_published_on')
    evidence = receipt.get('publication_evidence')
    if bool(publication) != bool(evidence):
        raise ValueError('A publication date requires publisher evidence and vice versa')
    if publication:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', publication):
            raise ValueError('Publication dates require YYYY-MM-DD')
        date.fromisoformat(publication)
    return {'receipt_sha256':hashlib.sha256(payload).hexdigest(), 'receipt':receipt}


def zip_clock(item):
    raw = list(item.date_time)
    try:
        local = datetime(*raw).isoformat()
    except ValueError:
        local = None
    return {'zip_modified_raw':raw, 'zip_modified_local':local}
