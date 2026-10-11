# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy==2.3.3", "scipy==1.16.2"]
# ///
"""Render the sound catalog (sounds.py) into out/ for the staging page.

    uv run tools/sfx/synth.py                  # render everything
    uv run tools/sfx/synth.py card_play tie    # re-render just these events

Renders are deterministic (seeded per event/variant), so an unchanged recipe
always produces a byte-identical file and keeps its approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import wave
import zlib
from pathlib import Path

import numpy as np

import dsp
from sounds import CATEGORIES, EVENTS, SEQUENCES, Event

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'out'
ID = re.compile(r'^[a-z0-9_]{1,64}$')


def validate() -> None:
    events = {}
    for ev in EVENTS:
        assert ID.match(ev.id), f'bad event id {ev.id!r}'
        assert ev.id not in events, f'duplicate event {ev.id!r}'
        assert ev.category in CATEGORIES, f'{ev.id}: unknown category {ev.category!r}'
        assert ev.variants, f'{ev.id}: no variants'
        ids = [v.id for v in ev.variants]
        assert len(set(ids)) == len(ids), f'{ev.id}: duplicate variant ids'
        assert all(ID.match(i) for i in ids), f'{ev.id}: bad variant id'
        events[ev.id] = ev
    for seq in SEQUENCES:
        for step in seq.steps:
            assert step[0] in events, f'sequence {seq.id}: unknown event {step[0]!r}'


def wav_path(ev: Event, variant_id: str) -> Path:
    return OUT / 'audio' / ev.id / f'{variant_id}.wav'


def render(ev: Event) -> None:
    for v in ev.variants:
        rng = np.random.default_rng(zlib.crc32(f'{ev.id}/{v.id}'.encode()))
        x = dsp.master(v.render(rng), ev.loudness, loop=ev.loop)
        dsp.write_wav(wav_path(ev, v.id), x, rng)


def describe(path: Path) -> dict:
    data = path.read_bytes()
    with wave.open(str(path), 'rb') as w:
        frames = w.readframes(w.getnframes())
    x = np.frombuffer(frames, dtype='<i2').astype(float) / 32768
    return {
        'file': path.relative_to(OUT).as_posix(),
        'sha256': hashlib.sha256(data).hexdigest(),
        'duration': round(len(x) / dsp.SR, 3),
        'peakDb': round(dsp.peak_db(x), 1),
        'loudnessDb': round(dsp.loudness_db(x), 1),
        # Phone speakers reproduce next to nothing below ~500 Hz.
        'phoneLossDb': round(dsp.loudness_db(x) - dsp.loudness_db(dsp.highpass(x, 500, 4)), 1),
        'bytes': len(data),
    }


def step(raw: tuple) -> dict:
    event_id, at, gain_db, rate, hold = (*raw, *(0.0, 1.0, 1.0)[len(raw) - 2:])  # fill defaults
    return {'event': event_id, 'at': round(at, 3), 'gainDb': gain_db, 'rate': rate, 'hold': hold}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('events', nargs='*', help='event ids to re-render (default: all)')
    args = parser.parse_args()

    validate()
    known = {ev.id for ev in EVENTS}
    unknown = [e for e in args.events if e not in known]
    if unknown:
        parser.error(f"unknown event(s): {', '.join(unknown)}")

    if not args.events and (OUT / 'audio').exists():
        shutil.rmtree(OUT / 'audio')  # full render: drop files of removed variants
    for ev in EVENTS:
        missing = any(not wav_path(ev, v.id).exists() for v in ev.variants)
        if not args.events or ev.id in args.events or missing:
            print(f'rendering {ev.id}', flush=True)
            render(ev)

    manifest = {
        'sampleRate': dsp.SR,
        'round': max(v.round for ev in EVENTS for v in ev.variants),
        'categories': CATEGORIES,
        'events': [{
            'id': ev.id, 'title': ev.title, 'category': ev.category, 'trigger': ev.trigger,
            'hook': ev.hook, 'intent': ev.intent, 'loudness': ev.loudness, 'vary': ev.vary,
            'optional': ev.optional, 'loop': ev.loop,
            'variants': [{'id': v.id, 'label': v.label, 'notes': v.notes, 'round': v.round,
                          **describe(wav_path(ev, v.id))}
                         for v in ev.variants],
        } for ev in EVENTS],
        'sequences': [{'id': s.id, 'title': s.title, 'description': s.description,
                       'steps': [step(raw) for raw in s.steps]} for s in SEQUENCES],
    }
    OUT.mkdir(exist_ok=True)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

    print(f"\n{'sound':<34}{'length':>8}{'peak':>8}{'loud':>8}")
    for ev in manifest['events']:
        for v in ev['variants']:
            print(f"{ev['id'] + '/' + v['id']:<34}{v['duration']:>7.2f}s{v['peakDb']:>8}{v['loudnessDb']:>8}")
    total = sum(v['bytes'] for ev in manifest['events'] for v in ev['variants'])
    print(f'\n{sum(len(ev.variants) for ev in EVENTS)} files, {total / 1024:.0f} KiB -> {OUT}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
