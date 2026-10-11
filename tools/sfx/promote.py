"""Copy approved sounds from the staging area into the game.

    python3 tools/sfx/promote.py --dry-run   # show what would change
    python3 tools/sfx/promote.py

Each approved event's chosen variant is copied to
packages/web/static/sfx/<event>.wav, after checking that the rendered file is
byte-identical to the one approved. Sounds that are no longer approved are
removed. packages/web/static/sfx/manifest.json lists what the game has.
Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'out'
DEST = ROOT.parents[1] / 'packages' / 'web' / 'static' / 'sfx'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    review = json.loads((ROOT / 'review.json').read_text()) if (ROOT / 'review.json').exists() else {}
    manifest = json.loads((OUT / 'manifest.json').read_text())
    events = {ev['id']: ev for ev in manifest['events']}

    sounds, problems = {}, []
    for event_id, entry in sorted(review.get('events', {}).items()):
        if entry.get('status') != 'approved':
            continue
        ev = events.get(event_id)
        variant = next((v for v in ev['variants'] if v['id'] == entry['variant']), None) if ev else None
        if not variant:
            problems.append(f"{event_id}: approved variant {entry['variant']!r} is no longer in the catalog")
            continue
        src = OUT / variant['file']
        if hashlib.sha256(src.read_bytes()).hexdigest() != entry['sha256']:
            problems.append(f'{event_id}/{variant["id"]}: file changed since it was approved; re-listen and re-approve')
            continue
        sounds[event_id] = {'file': f'{event_id}.wav', 'variant': variant['id'],
                            'sha256': entry['sha256'], 'vary': ev['vary'],
                            'loop': ev.get('loop', False)}

    if problems:
        print('Not promoting, fix these first:\n  ' + '\n  '.join(problems))
        return 1

    current = DEST / 'manifest.json'
    old = json.loads(current.read_text())['sounds'] if current.exists() else {}
    for event_id, sound in sounds.items():
        before = old.get(event_id, {}).get('sha256')
        if before != sound['sha256']:
            print(f"{'update' if before else 'add':>6}  {event_id} ({sound['variant']})")
        if not args.dry_run:
            DEST.mkdir(parents=True, exist_ok=True)
            variant_file = next(v['file'] for v in events[event_id]['variants'] if v['id'] == sound['variant'])
            shutil.copyfile(OUT / variant_file, DEST / sound['file'])
    for event_id in sorted(set(old) - set(sounds)):
        print(f'remove  {event_id}')
        if not args.dry_run:
            (DEST / old[event_id]['file']).unlink(missing_ok=True)

    if not args.dry_run:
        if sounds or old:
            DEST.mkdir(parents=True, exist_ok=True)
            current.write_text(json.dumps({'sounds': sounds}, indent='\t', sort_keys=True) + '\n')
        print(f'{len(sounds)} sound(s) in {DEST.relative_to(ROOT.parents[1])}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
