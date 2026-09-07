#!/usr/bin/env python3
"""Download a complete archive and write a checksum-bound acquisition receipt."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from urllib.request import urlopen
from urllib.parse import urlsplit
from chronology import utc_now, read_receipt


def download(source_url, output, published_on=None, evidence=None):
    if urlsplit(source_url).scheme != 'https':
        raise ValueError('Use an HTTPS source URL')
    output = Path(output)
    receipt_path = output.with_name(output.name + '.receipt.json')
    if output.exists() or receipt_path.exists():
        raise ValueError('Use a new output filename for each acquisition')
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=output.parent, prefix='.tcad-download-')
    temp_receipt = None
    linked = False
    try:
        started = utc_now()
        hasher = hashlib.sha256()
        with os.fdopen(fd,'wb') as target, urlopen(source_url, timeout=60) as response:
            final_url = response.geturl()
            if urlsplit(final_url).scheme != 'https':
                raise ValueError('Download redirected away from HTTPS')
            while chunk := response.read(1024 * 1024):
                target.write(chunk); hasher.update(chunk)
            target.flush(); os.fsync(target.fileno())
            receipt = {'version':1, 'source_url':source_url, 'resolved_url':final_url,
                       'archive_sha256':hasher.hexdigest(), 'download_started_at':started,
                       'downloaded_at':utc_now(),
                       'http_last_modified_raw':response.headers.get('Last-Modified'),
                       'publisher_published_on':published_on, 'publication_evidence':evidence}
        fd, temp_receipt = tempfile.mkstemp(dir=output.parent, prefix='.tcad-receipt-')
        with os.fdopen(fd,'w') as target:
            json.dump(receipt,target,indent=2);target.write('\n')
            target.flush();os.fsync(target.fileno())
        read_receipt(temp_receipt,receipt['archive_sha256'],source_url)
        os.link(temporary,output);linked=True
        os.link(temp_receipt,receipt_path)
        return receipt_path
    except Exception:
        if linked:
            output.unlink(missing_ok=True)
        raise
    finally:
        Path(temporary).unlink(missing_ok=True)
        if temp_receipt:
            Path(temp_receipt).unlink(missing_ok=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-url',required=True)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--published-on',help='Publisher-confirmed YYYY-MM-DD; omit if unknown')
    parser.add_argument('--publication-evidence',help='Publisher URL or quoted label supporting the date')
    args=parser.parse_args()
    try:
        print(download(args.source_url,args.output,args.published_on,args.publication_evidence))
    except Exception as error:
        print(json.dumps({'status':'failed','error':type(error).__name__}))
        raise SystemExit(1)
