# Sound effects

Every sound in the game is synthesized here in Python, then reviewed by ear in a
local staging page before anything is copied into the app.

```bash
bun run sfx:render    # uv run tools/sfx/synth.py: render every candidate into tools/sfx/out/
bun run sfx:review    # python3 tools/sfx/serve.py: review at http://localhost:8765
bun run sfx:promote   # python3 tools/sfx/promote.py: copy approved sounds into the game
```

`synth.py` needs [uv](https://docs.astral.sh/uv/) (it pulls in numpy and scipy).
`serve.py` and `promote.py` use only the standard library. To listen on a phone,
run `python3 tools/sfx/serve.py --host 0.0.0.0` and open the machine's LAN
address on port 8765.

## Files

| File | What it is |
| --- | --- |
| `sounds.py` | The catalog: each game event that could get a sound (when it fires, the game hook, the intended feel, a loudness target) and its candidate variants. |
| `dsp.py` | The synthesizer toolkit: noise, filters, card foley (taps, soft landings, slides, flicks, riffles), mallets, plucks, creaks, bubbles, seamless loops, a synthetic room, and loudness mastering. |
| `compufart.py` | A Python port of the physical fart model from Alex M. Fink's [CompuFart](https://github.com/alexmfink/compufart) (MIT, licence kept in the file). Used by the Skitgubbe sting. |
| `synth.py` | Renders the catalog to `out/` (gitignored) with `out/manifest.json`. `synth.py tie burn` re-renders just those events. |
| `staging.html` | The review page, served by `serve.py`. |
| `review.json` | Your verdicts (committed): status, the approved variant and its sha256, and notes for Claude. |
| `promote.py` | Copies each approved variant to `packages/web/static/sfx/<event>.wav` and writes `manifest.json` there. |

## How review works

- Variants of one sound are loudness-matched, so you compare character rather than
  volume. Levels between sounds are deliberate (see `loudness` in `sounds.py`).
- Renders are deterministic (seeded per event/variant): an untouched recipe gives
  a byte-identical file, so its approval stays valid.
- Approval is pinned to the file's sha256. If a recipe changes after you approved
  it, the page warns you and `promote.py` refuses to copy it until you re-approve.
- Each batch of new variants is a review **round** (`round=` on the variant in
  `sounds.py`). Each box lists variants in the order they arrived, with a
  divider where each later round starts (the newest, "New in round N", in gold);
  a sound that is entirely new is tagged with its round, and each round has a
  filter.
- After a verdict, variants that Claude adds or changes are marked **changed**
  until you play them, and a sound marked "Needs work" shows **Updated**.
- Loop sounds (`loop=True`, like the card drag) get a drag pad on the page: drag
  the card and the loop follows your pointer speed, exactly as the game should
  (the mapping is the `DRAG` constants in `staging.html`).
- "In context" plays scripted moments of play, using the approved (or currently
  selected) variants, and skips sounds marked "No sound here".

## In the game

`promote.py` writes the approved files and `packages/web/static/sfx/manifest.json`.
`packages/web/src/lib/audio/sfx.ts` plays them (and lists every id the game
uses: a test checks it matches the manifest), `roomSounds.ts` decides which game
state changes play what, and the drag loop's speed mapping (`DRAG`) mirrors the
one in `staging.html`. Some sounds deliberately stand in for others: Strö plays
Card played, Plocka plays Card drawn. Sounds marked "No sound here" (You win the
trick, Trump revealed) are simply never played.

## Sound design rules

- **Subtle first.** Frequent sounds (playing, drawing, selecting) are short and
  quiet. The rarer the moment, the more presence it gets; the Skitgubbe slam is
  the one loud sound.
- **Phone speakers have no bass.** Nothing below about 500 Hz survives, so every
  sound needs its identity in the mid range. The page flags variants that lose
  more than 6 dB on a phone.
- **No machine-gun repetition.** Events with `vary=True` should get a slightly
  different pitch (±4 %) and level (±1.5 dB) each time they play in the game;
  the page's "Humanize" toggle previews this.

Output is 16-bit 44.1 kHz mono WAV, which every browser and Android WebView
decodes.
