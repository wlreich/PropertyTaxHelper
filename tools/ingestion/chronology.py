"""Explicit source chronology; never infer acquisition times from filesystem dates."""
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re

PUBLISHER_REFERENCE_PAGE = 'https://traviscad.org/publicinformation/'


def reported_filename(value):
    """Operator-reported original basename; never a path or a date assertion."""
    if (not isinstance(value, str) or not 1 <= len(value) <= 200
            or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9 ._()-]*', value)
            or '..' in value or value != value.strip()):
        raise ValueError('Provide the original archive filename only, without folders or URLs')
    return value


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
    if receipt.get('version') not in (1, 2) or receipt.get('archive_sha256') != archive_sha or receipt.get('source_url') != source_url:
        raise ValueError('Receipt does not identify this source URL and archive checksum')
    if receipt['version'] == 1:
        started = aware_time(receipt['download_started_at'])
        finished = aware_time(receipt['downloaded_at'])
        if finished < started:
            raise ValueError('Download completion precedes its start')
    else:
        filename = receipt.get('original_filename_reported')
        if filename is not None:
            reported_filename(filename)
        if receipt.get('source_url_kind') == 'publisher_reference_page':
            if (receipt.get('source_url') != PUBLISHER_REFERENCE_PAGE
                    or receipt.get('download_url_reported') is not None):
                raise ValueError('Unknown download URLs require the publisher reference page without an invented download URL')
        if (receipt.get('acquisition_method') != 'manual_upload'
                or receipt['download_started_at'] is not None
                or receipt['downloaded_at'] is not None
                or receipt.get('resolved_url') is not None
                or receipt.get('http_last_modified_raw') is not None):
            raise ValueError('Manual uploads must not invent source download metadata')
        started = aware_time(receipt['storage_retrieval_started_at'])
        finished = aware_time(receipt['storage_retrieved_at'])
        if finished < started:
            raise ValueError('Storage retrieval completion precedes its start')
        uploaded = receipt.get('storage_uploaded_at')
        if uploaded is not None:
            aware_time(uploaded)
        if not re.fullmatch(r's3://tcad-archives/incoming/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.zip', receipt['uploaded_object_uri']) or '..' in receipt['uploaded_object_uri']:
            raise ValueError('Invalid private upload object URI')
        if type(receipt.get('archive_bytes')) is not int or receipt['archive_bytes'] <= 0:
            raise ValueError('Manual receipt requires the retrieved byte count')
        reported_date = receipt.get('browser_downloaded_on_reported')
        if reported_date is not None:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', reported_date):
                raise ValueError('Browser download dates require YYYY-MM-DD')
            date.fromisoformat(reported_date)
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
