"""Local server for the SFX staging page: serves the rendered sounds and records your verdicts.

    python3 tools/sfx/serve.py                 # http://localhost:8765
    python3 tools/sfx/serve.py --host 0.0.0.0  # also reachable from a phone on the LAN

Verdicts and notes are written to tools/sfx/review.json (committed), which is
what promote.py and Claude read. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
REVIEW = ROOT / 'review.json'
ID = re.compile(r'^[a-z0-9_]{1,64}$')
SHA = re.compile(r'^[0-9a-f]{64}$')
STATUSES = {'pending', 'approved', 'revise', 'rejected'}
MAX_BODY = 64 * 1024
lock = threading.Lock()


def load_review() -> dict:
    if not REVIEW.exists():
        return {'events': {}}
    return json.loads(REVIEW.read_text())


def save_review(review: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=ROOT, prefix='.review-', suffix='.json')
    with os.fdopen(fd, 'w') as f:
        json.dump(review, f, indent=2, sort_keys=True, ensure_ascii=False)
        f.write('\n')
    os.replace(tmp, REVIEW)


def clean_entry(body: dict) -> dict:
    """Validate a verdict from the page; raises ValueError with a readable reason."""
    status = body.get('status')
    if status not in STATUSES:
        raise ValueError(f'status must be one of {sorted(STATUSES)}')
    entry: dict = {'status': status}
    variant, sha = body.get('variant'), body.get('sha256')
    if variant is not None:
        if not isinstance(variant, str) or not ID.match(variant):
            raise ValueError('bad variant id')
        entry['variant'] = variant
    if sha is not None:
        if not isinstance(sha, str) or not SHA.match(sha):
            raise ValueError('bad sha256')
        entry['sha256'] = sha
    if status == 'approved' and not (variant and sha):
        raise ValueError('approving needs a variant and its sha256')
    notes = body.get('notes', '')
    if not isinstance(notes, str) or len(notes) > 4000:
        raise ValueError('notes must be a string of at most 4000 characters')
    if notes.strip():
        entry['notes'] = notes.strip()
    # The variants as they were at your last verdict, so the page can flag what changed since.
    seen = body.get('seen', {})
    if not isinstance(seen, dict) or not all(
            isinstance(k, str) and ID.match(k) and isinstance(v, str) and SHA.match(v)
            for k, v in seen.items()):
        raise ValueError('seen must map variant ids to sha256s')
    if seen:
        entry['seen'] = seen
    entry['updatedAt'] = datetime.now(timezone.utc).isoformat(timespec='seconds')
    return entry


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_json(self, status: int, payload) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = posixpath.normpath(unquote(self.path.split('?', 1)[0]))
        if path == '/api/review':
            with lock:
                return self.send_json(HTTPStatus.OK, load_review())
        if path == '/':
            self.path = '/staging.html'
        elif path != '/staging.html' and not path.startswith('/out/'):
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_PUT(self):
        match = re.fullmatch(r'/api/review/([a-z0-9_]{1,64})', self.path)
        if not match:
            return self.send_error(HTTPStatus.NOT_FOUND)
        length = int(self.headers.get('Content-Length') or 0)
        if not 0 < length <= MAX_BODY:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'bad body size'})
        try:
            entry = clean_entry(json.loads(self.rfile.read(length)))
        except (ValueError, json.JSONDecodeError, AttributeError) as e:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': str(e)})
        with lock:
            review = load_review()
            events = review.setdefault('events', {})
            if entry['status'] == 'pending' and 'notes' not in entry:
                events.pop(match[1], None)  # back to a clean slate
            else:
                events[match[1]] = entry
            save_review(review)
        return self.send_json(HTTPStatus.OK, review)

    def log_message(self, format, *args):
        if self.command == 'PUT':  # keep the console to verdicts, not every file fetch
            super().log_message(format, *args)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    if not (ROOT / 'out' / 'manifest.json').exists():
        print('No sounds rendered yet. Run: uv run tools/sfx/synth.py')
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'SFX staging page: http://localhost:{args.port}/  (Ctrl+C to stop)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
