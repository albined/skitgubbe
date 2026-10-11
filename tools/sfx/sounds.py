"""The sound catalog: every game event that could get a sound, with candidate variants.

Each event lists where it would trigger in the game and the feel it is going
for; each variant is a recipe built from dsp.py. synth.py renders them all,
loudness-matched per event, for review in the staging page.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from compufart import terrance
from dsp import (CHIME, KALIMBA, WOOD, bubbles, card_tap, click, clicks_along, colored, creak,
                 env_perc, env_points, env_swell, flick, glide, grain, highpass, lowpass,
                 make_loop, mallet, mix, modal, n_samples, normalized, place, room, saw, shimmer,
                 sine, slide, smooth_noise, soft_clip, soft_land, svf, thump, time, white)

Recipe = Callable[[np.random.Generator], np.ndarray]


@dataclass
class Variant:
    id: str
    label: str
    notes: str
    render: Recipe
    round: int  # review round it was added in; the page groups and marks the newest


@dataclass
class Event:
    id: str
    title: str
    category: str
    trigger: str  # when it plays, in player terms
    hook: str  # where the game code would fire it
    intent: str  # what it should feel like
    loudness: float  # dB target (dsp.loudness_db); variants of one event are matched to it
    vary: bool = False  # frequent sound: the game should jitter pitch/gain per play
    optional: bool = False
    loop: bool = False  # a seamless texture the game loops and modulates, not a one-shot
    variants: list[Variant] = field(default_factory=list)

    def variant(self, id: str, label: str, notes: str, round: int = 1) -> Callable[[Recipe], Recipe]:
        def register(fn: Recipe) -> Recipe:
            self.variants.append(Variant(id, label, notes, fn, round))
            return fn
        return register


@dataclass
class Sequence:
    """A scripted moment of play, to judge sounds in context and against each other."""
    id: str
    title: str
    description: str
    # (event id, at seconds, gain dB = 0, playback rate = 1, held seconds for loops = 1)
    steps: list[tuple]


EVENTS: list[Event] = []


def event(**kwargs) -> Event:
    ev = Event(**kwargs)
    EVENTS.append(ev)
    return ev


CARDS = 'Cards'
TABLE = 'Tricks & table'
TURNS = 'Turns & phases'
ENDGAME = 'Endgame'
SOCIAL = 'Chat & feedback'
LOBBY = 'Lobby'
CATEGORIES = [CARDS, TABLE, TURNS, ENDGAME, SOCIAL, LOBBY]

_SEMITONES = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2,
              'G#': -1, 'A': 0, 'A#': 1, 'B': 2}


def hz(note: str) -> float:
    """'A4' -> 440.0"""
    return 440.0 * 2 ** ((_SEMITONES[note[:-1]] + 12 * (int(note[-1]) - 4)) / 12)


def small_room(x: np.ndarray, rng: np.random.Generator, wet: float = 0.06) -> np.ndarray:
    """Card foley: nearly dry, just enough room to not sound pasted on."""
    return room(x, rng, t60=0.25, wet=wet, damp=4500)


def hall(x: np.ndarray, rng: np.random.Generator, wet: float = 0.2, t60: float = 0.9) -> np.ndarray:
    """Musical cues: a softer, longer space."""
    return room(x, rng, t60=t60, wet=wet, damp=6000)


def band(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    """A gentle band: a steep top (softness lives there) and an easy bottom."""
    return highpass(lowpass(x, hi, 4), lo)


# ================================================================== cards

card_play = event(
    id='card_play', title='Card played', category=CARDS, loudness=-24, vary=True,
    trigger="A play lands on the table: your own at full level, opponents' about 6 dB softer. "
            "Strö uses it too. Also reused, quieter, as the Skitgubbe's cards fly into the fan "
            'at the end.',
    hook='a new tablePile batch, or a batch growing (Strö), in a stateUpdate; timed to the '
         'card-flight landing',
    intent='The most frequent sound in the game, so it must be short, soft and pleasant: '
           'a card settling onto felt, not hitting it.',
)


@card_play.variant('felt', 'Felt tap', 'A soft, damped landing with a breath of air just before it.')
def _(rng):
    air = slide(rng, 0.03, 1400, 2400, q=0.9, density=500, attack=0.028, release=0.004)
    tap = card_tap(rng, tone=2400, t60=0.04, body=140, body_db=-14)
    return small_room(mix([(air, 0, -18), (tap, 0.028, 0)]), rng)


@card_play.variant('crisp', 'Crisp snap', 'Brighter and quicker, with a papery snap on contact.')
def _(rng):
    return small_room(card_tap(rng, tone=6500, t60=0.022, body=190, body_db=-18, snap_db=-6,
                               low_cut=600), rng)


@card_play.variant('slide', 'Slide-in', 'The card skids briefly across the felt before settling.')
def _(rng):
    skid = slide(rng, 0.09, 1100, 1900, q=1.0, density=450, attack=0.03, release=0.02)
    tap = card_tap(rng, tone=2000, t60=0.035, body=150, body_db=-14)
    return small_room(mix([(skid, 0, -5), (tap, 0.075, -2)]), rng)


@card_play.variant('soft_felt', 'Soft felt',
                   'Felt tap with the edge taken off: the same sound, a slower attack and a '
                   'steeper roll-off of the highs.', round=2)
def _(rng):
    air = slide(rng, 0.03, 1200, 2000, q=0.9, density=500, attack=0.028, release=0.004)
    tap = card_tap(rng, tone=2000, t60=0.04, body=140, body_db=-14, attack=0.0025, order=4)
    return small_room(mix([(lowpass(air, 2500, 4), 0, -18), (tap, 0.028, 0)]), rng)


@card_play.variant('pad', 'Felt pad', 'Even more muffled: a gentle "pat" on a thick tablecloth.',
                   round=2)
def _(rng):
    return small_room(soft_land(rng, tone=900, attack=0.005, t60=0.06, body=200, body_db=-8,
                                air_db=-16), rng)


@card_play.variant('cushion', 'Air cushion',
                   'The soft "ffp" of a card landing flat and pushing the air out from under it.',
                   round=2)
def _(rng):
    return small_room(soft_land(rng, tone=1100, attack=0.004, t60=0.05, body=180, body_db=-12,
                                air_db=-5), rng)


@card_play.variant('velvet', 'Velvet', 'A soft pad with a faint papery texture, so it still '
                   'reads as a card.', round=2)
def _(rng):
    pad = soft_land(rng, tone=1200, attack=0.004, t60=0.05, body=180, body_db=-12)
    paper = slide(rng, 0.05, 1600, 1200, q=0.8, density=900, attack=0.004, release=0.04)
    return small_room(mix([(pad, 0, 0), (lowpass(paper, 3000, 4), 0, -14)]), rng)


@card_play.variant('felt_wood', 'Felt over wood',
                   'A muffled knock of the wooden table under the felt.', round=2)
def _(rng):
    knock = lowpass(modal(330, WOOD, 0.06, attack=0.004), 1400, 4)
    pad = soft_land(rng, tone=1000, attack=0.004, t60=0.04, body_db=None)
    return small_room(mix([(pad, 0, 0), (normalized(knock), 0, -5)]), rng)


card_draw = event(
    id='card_draw', title='Card drawn', category=CARDS, loudness=-28, vary=True,
    trigger='Phase 1: a replacement card slides from the deck into your hand, one per card, '
            'staggered like the animation. Plocka (picking up the oldest batch in Phase 2) uses '
            'it too.',
    hook='new deck-drawn ids in your hand (newCardRelativeIndices, 150 ms stagger); applyPickUp '
         'moving a batch into a hand',
    intent='Quieter than playing: the hand refilling should be felt more than heard.',
)


@card_draw.variant('slide', 'Quick slide', 'A short rising swipe off the deck.')
def _(rng):
    return small_room(slide(rng, 0.13, 1300, 2600, q=1.2, density=420, attack=0.03,
                            release=0.07), rng)


@card_draw.variant('flip', 'Slide + flip',
                   'The swipe, then a tiny flick as the card turns face up, like the animation.')
def _(rng):
    swipe = slide(rng, 0.1, 1300, 2300, q=1.2, density=420, attack=0.025, release=0.04)
    turn = flick(rng, 0.05, 900, 3200, snap_db=-8)
    return small_room(mix([(swipe, 0, 0), (turn, 0.085, -4)]), rng)


def soft_slide(rng, dur=0.14):
    """Quick slide made softer: a lower, broader band, smoother grain, gentler edges."""
    swipe = slide(rng, dur, 800, 1500, q=0.7, density=250, attack=0.04, release=0.07, floor=0.65)
    return lowpass(swipe, 3000, 4)


@card_draw.variant('soft', 'Soft slide', 'Quick slide, lower and smoother, with no papery edge.',
                   round=2)
def _(rng):
    return small_room(soft_slide(rng), rng)


@card_draw.variant('whisper', 'Whisper', 'Barely more than a breath of moving air.', round=2)
def _(rng):
    dur = 0.18
    air = highpass(lowpass(colored(dur, rng, 1.0), 1600, 4), 200) * env_swell(dur, 0.06, 0.11, 1.5)
    return small_room(air, rng)


@card_draw.variant('settle', 'Soft slide + settle',
                   'The soft slide, ending with the card settling into your hand.', round=2)
def _(rng):
    land = soft_land(rng, tone=900, attack=0.004, t60=0.035, body=220, body_db=-12)
    return small_room(mix([(soft_slide(rng, 0.12), 0, 0), (land, 0.105, -7)]), rng)


card_select = event(
    id='card_select', title='Card selected', category=CARDS, loudness=-34, vary=True,
    trigger='You tap a card in your hand to select or deselect it (deselect a little lower).',
    hook='RoomState.toggleSelect',
    intent='Barely-there tactile feedback, like a fingernail on a card edge.',
)


@card_select.variant('tick', 'Paper tick', 'A tiny, bright tick.')
def _(rng):
    return mix([(click(rng, 2800, 7000, 0.005), 0, 0),
                (thump(1900, 1500, 0.012, attack=0.0005, glide_time=0.006), 0, -14)])


@card_select.variant('wood', 'Soft wood click', 'A small, rounder woodblock click.')
def _(rng):
    return mallet(rng, 1250, t60=0.035, hardness=0.6, partials=WOOD)


@card_select.variant('soft_tick', 'Soft tick', 'Paper tick an octave lower, with a rounded attack.',
                     round=2)
def _(rng):
    return lowpass(click(rng, 900, 2200, 0.01, attack=0.0015), 2500, 4)


@card_select.variant('touch', 'Felt touch', 'A fingertip pressing the card: a tiny muffled pat.',
                     round=2)
def _(rng):
    return soft_land(rng, tone=1300, attack=0.002, t60=0.018, body=500, body_db=-10)


@card_select.variant('tock', 'Soft tock', 'A small, felt-covered wooden tock.', round=2)
def _(rng):
    return lowpass(mallet(rng, 700, t60=0.03, hardness=0.0, partials=WOOD), 2500, 4)


card_drag = event(
    id='card_drag', title='Card dragged', category=CARDS, loudness=-30, loop=True,
    trigger='While you drag a card, following how fast you move it: silent when you hold still, '
            'a soft whisper when you move. Dropping it on the table plays Card played.',
    hook='CardDragState.handlePointerMove while isDragging: loop gain and brightness follow '
         'pointer speed',
    intent='Tactile and nearly subliminal. It must never turn into a constant hiss.',
)


def drag_loop(rng, x):
    """Give a texture the slight unsteadiness of a hand; drop the filter warm-up; loop it."""
    wobble = 1 + 0.18 * smooth_noise(len(x), rng, 6)
    return make_loop((x * wobble)[n_samples(0.3):], 0.25)


@card_drag.variant('felt', 'Felt brush', 'A soft, even brush of card over felt.', round=2)
def _(rng):
    x = band(white(2.6, rng), 350, 2000) * grain(n_samples(2.6), rng, 1500, 0.001, 0.75)
    return drag_loop(rng, x)


@card_drag.variant('card', 'Card on felt', 'More card-like: a papery edge with a little body.',
                   round=2)
def _(rng):
    x = band(white(2.6, rng), 600, 2600) * grain(n_samples(2.6), rng, 500, 0.002, 0.5)
    tone = svf(x, 1100, 1.5, 'bp')
    return drag_loop(rng, x + 0.5 * normalized(tone) * np.max(np.abs(x)))


@card_drag.variant('pen', 'Pen on paper', 'Scratchier and finer, like a pencil sketching.',
                   round=2)
def _(rng):
    x = band(white(2.6, rng), 1200, 6000) * grain(n_samples(2.6), rng, 1200, 0.0006, 0.2)
    return drag_loop(rng, x)


@card_drag.variant('air', 'Air whisper', 'Just moving air, no texture at all: the most discreet.',
                   round=2)
def _(rng):
    return drag_loop(rng, band(colored(2.6, rng, 1.0), 250, 1400))


chance = event(
    id='chance', title='Chansa', category=CARDS, loudness=-25,
    trigger='Someone gambles on the top card of the deck: it flips and flies onto the table.',
    hook='lastChanceCardId is set on the new state',
    intent='A flip with a touch of suspense, distinct from a normal play.',
)


@chance.variant('flip', 'Flip snap', 'A quick turn-over "fwip", then the landing.')
def _(rng):
    turn = flick(rng, 0.08, 600, 2600, snap_db=-6)
    tap = card_tap(rng, tone=2200, t60=0.035, body=150, body_db=-14)
    return small_room(mix([(turn, 0, 0), (tap, 0.085, -2)]), rng)


@chance.variant('slow', 'Slow turn', 'The card flexes before it flips: a slightly drawn-out gamble.')
def _(rng):
    dur = 0.14
    flex = (svf(white(dur, rng), glide(500, 900, dur), 2.5, 'bp')
            * grain(n_samples(dur), rng, 900) * env_swell(dur, 0.11, 0.03))
    turn = flick(rng, 0.09, 800, 3000, snap_db=-6)
    tap = card_tap(rng, tone=2200, t60=0.035, body=150, body_db=-14)
    return small_room(mix([(normalized(flex), 0, -8), (turn, 0.1, 0), (tap, 0.2, -2)]), rng)


# ========================================================= tricks & table

trick_take = event(
    id='trick_take', title='Trick taken', category=TABLE, loudness=-25,
    trigger="Phase 1: after a round is decided, the table cards fly to the winner's badge.",
    hook="the 'T' cleanup move: phase-1 tablePile empties after trickWinnerId was set",
    intent='A gathering sweep. Neutral: it plays whoever wins; the win sting is only for you.',
)


def sweep(rng, count=5):
    layers = []
    for i in range(count):
        f0 = rng.uniform(1600, 2300)
        swipe = slide(rng, rng.uniform(0.12, 0.2), f0, f0 * 0.6, q=1.0, density=500,
                      attack=0.02, release=0.08)
        layers.append((swipe, i * 0.035 + rng.uniform(0, 0.02), -1.5 * i))
    return mix(layers)


@trick_take.variant('sweep', 'Gather sweep', 'Several cards swept together in one motion.')
def _(rng):
    return small_room(sweep(rng), rng)


@trick_take.variant('square', 'Sweep + square', 'The sweep, then the stack squared with a soft knock.')
def _(rng):
    squared = card_tap(rng, tone=1600, t60=0.06, body=160, body_db=-6)
    return small_room(mix([(sweep(rng), 0, 0), (squared, 0.3, -3)]), rng)


def soft_sweep(rng, count=4):
    """The gather sweep made gentle: lower, broader, smoother slides with soft edges."""
    layers = []
    for i in range(count):
        f0 = rng.uniform(900, 1300)
        swipe = slide(rng, rng.uniform(0.15, 0.22), f0, f0 * 0.7, q=0.7, density=250,
                      attack=0.04, release=0.1, floor=0.65)
        layers.append((swipe, i * 0.045 + rng.uniform(0, 0.02), -1.5 * i))
    return lowpass(mix(layers), 2500, 4)


@trick_take.variant('soft', 'Soft gather', 'The sweep, lower and smoother, with no papery edge.',
                    round=2)
def _(rng):
    return small_room(soft_sweep(rng), rng)


@trick_take.variant('brush', 'Palm brush',
                    'One soft swoosh, like brushing the cards across the felt with a palm.',
                    round=2)
def _(rng):
    dur = 0.38
    swoosh = svf(colored(dur, rng, 1.0), glide(1400, 700, dur), 0.6, 'bp')
    return small_room(lowpass(swoosh, 2200, 4) * env_swell(dur, 0.12, 0.26, 1.5), rng)


@trick_take.variant('settle', 'Soft gather + settle',
                    'The soft gather, then the stack settling down with a gentle pad.', round=2)
def _(rng):
    land = soft_land(rng, tone=900, attack=0.005, t60=0.05, body=180, body_db=-10)
    return small_room(mix([(soft_sweep(rng), 0, 0), (land, 0.28, -5)]), rng)


trick_win_you = event(
    id='trick_win_you', title='You win the trick', category=TABLE, loudness=-27,
    trigger='The moment a Phase 1 round is decided in your favour (the cards fly to you shortly after).',
    hook='trickWinnerId changes to your id',
    intent='A small private reward: two soft rising notes, nothing like a fanfare.',
)


@trick_win_you.variant('marimba', 'Marimba up', 'Two soft rising marimba notes (G5 to D6).')
def _(rng):
    return hall(mix([(mallet(rng, hz('G5'), 0.5, 0.35), 0, 0),
                     (mallet(rng, hz('D6'), 0.6, 0.35), 0.085, -1)]), rng, wet=0.18, t60=0.8)


@trick_win_you.variant('kalimba', 'Kalimba up',
                       'The same idea on a plucked kalimba tine (A5 to E6), a little sweeter.')
def _(rng):
    return hall(mix([(mallet(rng, hz('A5'), 0.7, 0.3, KALIMBA), 0, 0),
                     (mallet(rng, hz('E6'), 0.8, 0.3, KALIMBA), 0.09, -1)]), rng)


burn = event(
    id='burn', title='Table burned', category=TABLE, loudness=-24,
    trigger="Phase 2: every remaining player has a batch on the table, so it's cleared to the "
            'discard pile.',
    hook='phase-2 cleanup: tablePile empties and discardPile grows',
    intent='The table wiped clean: a satisfying release.',
)


def whoosh(rng, dur=0.6):
    air = svf(white(dur, rng), glide(2600, 380, dur), 1.3, 'bp') * env_swell(dur, 0.09, dur - 0.1, 1.5)
    body = lowpass(colored(dur, rng, 2.0), 500) * env_swell(dur, 0.12, dur - 0.12, 1.5)
    return mix([(normalized(air), 0, 0), (normalized(body), 0, -10)])


@burn.variant('whoosh', 'Whoosh away', 'A falling whoosh as the pile sweeps off to the discard.')
def _(rng):
    return room(whoosh(rng), rng, t60=0.5, wet=0.12)


@burn.variant('flutter', 'Flutter + whoosh',
              'Cards fluttering down, slowing as they settle, under a lighter whoosh.')
def _(rng):
    flutter = normalized(clicks_along(rng, 0.45, 8, 70, 'decel', 1500, 5000, fade=0.6))
    return room(mix([(flutter, 0, -3), (whoosh(rng, 0.45), 0, -4)]), rng, t60=0.5, wet=0.1)


@burn.variant('ember', 'Ember', 'A soft "fwoomp" with a few crackles, as if the cards really burn.')
def _(rng):
    dur = 0.4
    cutoff = np.interp(time(dur), [0, 0.06, dur], [180, 1400, 300])
    fwoomp = svf(colored(dur, rng, 1.0), cutoff, 0.9, 'lp') * env_swell(dur, 0.05, 0.33)
    crackle = clicks_along(rng, 0.55, 6, 40, 'decel', 2000, 7000, t60=(0.002, 0.005),
                           jitter=0.01, fade=0.5)
    return room(mix([(normalized(fwoomp), 0, 0), (normalized(crackle), 0.04, -9)]), rng,
                t60=0.5, wet=0.1)


# ========================================================= turns & phases

your_turn = event(
    id='your_turn', title='Your turn', category=TURNS, loudness=-23,
    trigger='The turn passes to you (not if it was already yours, and not during reconnect replay).',
    hook='activePlayerIdx moves onto you while status is playing',
    intent='Noticeable when you glance away, but friendly. It plays all game, so it must never nag.',
)


def knock(rng):
    tok = normalized(mallet(rng, 820, t60=0.05, hardness=0.7, partials=WOOD))
    return mix([(tok, 0, 0), (thump(210, 160, 0.08), 0, -4), (click(rng, 1500, 5000, 0.004), 0, -10)])


@your_turn.variant('knock', 'Knock-knock', 'Two knuckle knocks on the table edge: "your go".')
def _(rng):
    return room(mix([(knock(rng), 0, 0), (knock(rng), 0.13, -2)]), rng, t60=0.35, wet=0.1)


@your_turn.variant('marimba', 'Marimba fifth', 'Two soft marimba notes rising a fifth (D5 to A5).')
def _(rng):
    return hall(mix([(mallet(rng, hz('D5'), 0.6, 0.35), 0, 0),
                     (mallet(rng, hz('A5'), 0.7, 0.35), 0.12, -1)]), rng)


@your_turn.variant('bell', 'Soft bell', 'One gentle bell with a slow shimmer.')
def _(rng):
    return hall(mallet(rng, hz('A5'), 1.2, 0.3, CHIME, detune_hz=1.2), rng, wet=0.22, t60=1.1)


phase2_start = event(
    id='phase2_start', title='Phase 2 begins', category=TURNS, loudness=-24,
    trigger='The deck has run out: everyone gathers their won tricks and Phase 2 begins.',
    hook='phase goes from 1 to 2',
    intent='A clear chapter break: the cards gathered up and shuffled.',
)


def riffle(rng, dur=0.75):
    clicks = normalized(clicks_along(rng, dur, 18, 75, 'arch', 1600, 5500))
    bed = svf(white(dur, rng), 2600, 0.8, 'bp') * np.sin(np.pi * time(dur) / dur) ** 2
    return mix([(clicks, 0, 0), (normalized(bed), 0, -16)])


@phase2_start.variant('riffle', 'Riffle', 'A riffle shuffle, then the deck squared.')
def _(rng):
    square = card_tap(rng, tone=1700, t60=0.05, body=160, body_db=-8)
    return small_room(mix([(riffle(rng), 0, 0), (square, 0.8, -3)]), rng, wet=0.07)


@phase2_start.variant('bridge', 'Riffle + bridge',
                      'The riffle, then the cascading "bridge" as the halves fall together.')
def _(rng):
    cascade = normalized(clicks_along(rng, 0.32, 30, 110, 'accel', 2000, 6000,
                                      t60=(0.004, 0.008), fade=0.3))
    square = card_tap(rng, tone=1700, t60=0.05, body=160, body_db=-8)
    return small_room(mix([(riffle(rng, 0.7), 0, 0), (cascade, 0.82, -5), (square, 1.18, -3)]), rng,
                      wet=0.07)


trump_reveal = event(
    id='trump_reveal', title='Trump revealed', category=TURNS, loudness=-24,
    trigger='Right as Phase 2 begins: the hidden trump is turned face up and its suit becomes trump.',
    hook='trumpCard goes from null to a card',
    intent='A small "ooh": something special was hiding there all along.',
)


@trump_reveal.variant('glint', 'Flip + glint', 'The card flips over with a faint golden glint.')
def _(rng):
    turn = flick(rng, 0.08, 700, 2800, snap_db=-6)
    tap = card_tap(rng, tone=2200, t60=0.035, body=150, body_db=-14)
    glint = normalized(shimmer(rng, 0.35, 9, 3500, 8000, (0.15, 0.35)))
    return hall(mix([(turn, 0, 0), (tap, 0.085, -2), (glint, 0.09, -12)]), rng, wet=0.15)


@trump_reveal.variant('chime', 'Gold chime', 'A soft two-bell chime over a warm marimba note.')
def _(rng):
    return hall(mix([(mallet(rng, hz('E6'), 1.4, 0.3, CHIME, detune_hz=1.0), 0, 0),
                     (mallet(rng, hz('B6'), 1.2, 0.3, CHIME, detune_hz=1.3), 0.01, -4),
                     (mallet(rng, hz('E5'), 0.9, 0.25), 0, -6)]), rng, wet=0.25, t60=1.4)


# ================================================================ endgame

escape_you = event(
    id='escape_you', title='You escaped', category=ENDGAME, loudness=-21,
    trigger='Phase 2: you play your last card and are safe. Plays with your confetti.',
    hook='your isDone turns true (the same diff as updateEscapeCelebrations)',
    intent='The happiest sound in the game: warm and celebratory, but still short.',
)


@escape_you.variant('marimba', 'Marimba arpeggio', 'A rising C-major arpeggio, the top note left ringing.')
def _(rng):
    notes = [('C5', 0.6), ('E5', 0.6), ('G5', 0.6), ('C6', 1.0)]
    return hall(mix([(mallet(rng, hz(n), t60, 0.4), i * 0.075, 0 if i in (0, 3) else -1)
                     for i, (n, t60) in enumerate(notes)]), rng)


@escape_you.variant('bells', 'Bells + sparkle',
                    'The arpeggio on soft bells (G major), with a sparkle trailing off.')
def _(rng):
    bells = [(mallet(rng, hz(n), 1.0, 0.3, CHIME, detune_hz=0.8), i * 0.075, -0.5 * i)
             for i, n in enumerate(('G5', 'B5', 'D6', 'G6'))]
    sparkle = normalized(shimmer(rng, 0.5, 12, 4000, 9000, (0.15, 0.35)))
    return hall(mix(bells + [(sparkle, 0.25, -14)]), rng, wet=0.25, t60=1.1)


escape_other = event(
    id='escape_other', title='Someone else escaped', category=ENDGAME, loudness=-27,
    trigger='Phase 2: another player plays their last card and is out. Plays with their confetti.',
    hook="another player's isDone turns true",
    intent='Acknowledges it without celebrating; the pressure on you just went up.',
)


@escape_other.variant('pling', 'Soft pling', 'A single kalimba note.')
def _(rng):
    return hall(mallet(rng, hz('A5'), 0.8, 0.3, KALIMBA), rng)


@escape_other.variant('two', 'Two-note', 'A smaller cousin of the trick win: two quiet marimba notes.')
def _(rng):
    return hall(mix([(mallet(rng, hz('E5'), 0.5, 0.3), 0, 0),
                     (mallet(rng, hz('A5'), 0.6, 0.3), 0.09, -1)]), rng)


def escape_bells(rng, notes) -> np.ndarray:
    """The bell arpeggio from You escaped, without its sparkle."""
    bells = [(mallet(rng, hz(n), 1.0, 0.3, CHIME, detune_hz=0.8), i * 0.075, -0.5 * i)
             for i, n in enumerate(notes)]
    return hall(mix(bells), rng, wet=0.25, t60=1.1)


@escape_other.variant('bells', 'Bells, no sparkle',
                      'The bells from You escaped, without the sparkle (and quieter, as this sound '
                      'sits lower in the mix).', round=4)
def _(rng):
    return escape_bells(rng, ('G5', 'B5', 'D6', 'G6'))


@escape_other.variant('bells_short', 'Bells, no sparkle, shorter',
                      'The same, but three notes: it stops short of the top one, so it is less '
                      'of a win than your own escape.', round=4)
def _(rng):
    return escape_bells(rng, ('G5', 'B5', 'D6'))


skitgubbe_slam = event(
    id='skitgubbe_slam', title='Wanted poster slam', category=ENDGAME, loudness=-15,
    trigger='Game over: the Skitgubbe wanted poster slams down with the screen shake and dust.',
    hook='RoomState.handlePosterLanded',
    intent='The one big moment, allowed to be loud and physical. Phone speakers have no bass, '
           'so the impact also needs a mid-range slap.',
)


def dust(rng, dur=1.4):
    d = normalized(highpass(lowpass(colored(dur, rng, 1.0), 3000), 300))
    return d * env_points(dur, [(0, 0), (0.04, 1), (0.3, 0.5), (dur, 0)]) ** 2


@skitgubbe_slam.variant('slap', 'Paper slam',
                        'A big sheet slapped onto wood: a sharp slap, a thud, then settling dust.')
def _(rng):
    slap = highpass(lowpass(white(0.25, rng), 5000), 200) * env_perc(0.25, 0.001, 0.09)
    x = mix([(normalized(slap), 0, 0), (thump(95, 48, 0.35, glide_time=0.08), 0, -3),
             (thump(240, 160, 0.12), 0, -9), (dust(rng), 0.02, -18)])
    return room(soft_clip(normalized(x), 1.3), rng, t60=0.6, wet=0.12)


@skitgubbe_slam.variant('boom', 'Deep boom',
                        'Heavier and darker: a muffled slap over a low boom and rumble. Best on '
                        'headphones; a phone speaker loses much of the boom.')
def _(rng):
    slap = lowpass(white(0.25, rng), 2500) * env_perc(0.25, 0.001, 0.08)
    rumble = lowpass(colored(1.5, rng, 2.0), 400) * env_perc(1.5, 0.01, 1.2)
    # The sub boom is for headphones; the 180/320 Hz bodies are what a phone speaker plays.
    x = mix([(thump(70, 32, 0.7, glide_time=0.15), 0, -4), (thump(180, 110, 0.2), 0, -3),
             (thump(320, 220, 0.15), 0, -6), (normalized(slap), 0, -4),
             (normalized(rumble), 0, -12), (dust(rng), 0.03, -20)])
    return room(soft_clip(normalized(x), 2.0), rng, t60=0.7, wet=0.1)


skitgubbe_sting = event(
    id='skitgubbe_sting', title='Skitgubbe decided', category=ENDGAME, loudness=-23, optional=True,
    trigger='Game over: the last player left holding cards is the Skitgubbe, in the pause '
            'before the reveal.',
    hook="status turns 'ended' with an isSkitgubbe player (endGameStage becomes 'paused')",
    intent='Optional comedy for the loser: a sad "womp womp", now also in farty flavours. '
           'Skip it if it feels like too much.',
)


def trombone_note(freq: float, dur: float, vibrato: bool = False) -> np.ndarray:
    t = time(dur)
    f = np.full_like(t, freq)
    if vibrato:
        f = freq * (1 + 0.02 * np.clip((t - 0.15) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.5 * t))
    wah = np.interp(t, [0, 0.07, dur], [0.0, 1.0, 0.25])
    tone = svf(saw(f, dur), 350 + 1300 * wah, 1.8, 'lp')
    amp = env_points(dur, [(0, 0), (0.03, 1), (dur * 0.6, 0.8), (dur, 0)])
    return normalized(bandpass_voice(tone * amp))


def bandpass_voice(x: np.ndarray) -> np.ndarray:
    """Keep a muted brass voice in the band phone speakers actually reproduce."""
    return highpass(lowpass(x, 3000), 250)


@skitgubbe_sting.variant('womp', 'Sad trombone', 'A muted, quiet "womp womp womp wommmp".')
def _(rng):
    notes = [('G3', 0.0, 0.3), ('F#3', 0.32, 0.3), ('F3', 0.64, 0.3), ('E3', 0.96, 1.0)]
    return hall(mix([(trombone_note(hz(n), d, vibrato=(i == 3)), at, 0)
                     for i, (n, at, d) in enumerate(notes)]), rng, wet=0.12)


@skitgubbe_sting.variant('mallets', 'Falling mallets',
                         'Three slow marimba notes sinking a semitone at a time: sad, no joke.')
def _(rng):
    notes = [('B4', 0.7), ('A#4', 0.7), ('A4', 1.4)]
    return hall(mix([(mallet(rng, hz(n), t60, 0.3), i * 0.28, 0)
                     for i, (n, t60) in enumerate(notes)]), rng)


def fart(rng, pitch, pressure, pinch=0.5, cheek=0.5, strain=0.7, strain_intensity=0.5):
    """CompuFart's physical model (compufart.py) driven by pitch (Hz) and pressure (0..1) curves.

    The model is untuned: it comes out near 3.53 * sqrt(its frequency setting) Hz.
    """
    setting = (np.asarray(pitch, dtype=float) / 3.53) ** 2
    return terrance(rng, setting, np.asarray(pressure, dtype=float), pinch, cheek, strain,
                    strain_intensity)


def blow(dur, sustain=0.8, attack=0.005, decay=0.02, release=0.08) -> np.ndarray:
    """CompuFart's linear pressure envelope, with the release inside `dur`."""
    return env_points(dur, [(0, 0), (attack, 1), (attack + decay, sustain),
                            (dur - release, sustain), (dur, 0)])


def cushioned(x: np.ndarray, warmth_db: float = 9) -> np.ndarray:
    """Heard through trousers, not a microphone: a gentle top roll-off, no rumble, and a
    broad lift around 650 Hz so a phone speaker (no bass) still gets the 'blat'."""
    x = highpass(lowpass(x, 2500, 4), 50)
    return x + (10 ** (warmth_db / 20) - 1) * svf(x, 650, 0.7, 'bp')


# The sad trombone's melody, an octave down: low enough to be a proper "brrap".
WOMP = [('G2', 0.0, 0.32), ('F#2', 0.36, 0.32), ('F2', 0.72, 0.32), ('E2', 1.08, 1.15)]


def womp_fart(rng, freq, dur, last=False, wet=0.0) -> np.ndarray:
    """One note: scoop down into pitch and sag. The last one wobbles while the pressure
    runs out, so the model itself falters and sputters at the end."""
    t = time(dur)
    scoop = 2 ** (0.4 * np.exp(-t / 0.03))
    if last:
        wobble = 1 + 0.05 * np.clip((t - 0.25) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.5 * t)
        pitch = freq * scoop * np.interp(t, [0, 0.6, dur], [1.0, 0.95, 0.78]) * wobble
        pressure = np.interp(t, [0, 0.005, 0.025, 0.6, dur - 0.05, dur], [0, 1, 0.8, 0.75, 0.12, 0])
    else:
        pitch = freq * scoop * np.interp(t, [0, dur], [1.0, 0.96])
        pressure = blow(dur, release=0.06)
    strain = 0.7
    if wet:
        pressure = pressure * (1 + 0.3 * wet * smooth_noise(len(t), rng, 12))
        strain = 0.7 + 0.3 * wet
    return normalized(fart(rng, pitch, np.clip(pressure, 0, 1), strain=strain))


def wet_bubbles(rng, dur, density) -> np.ndarray:
    """Soft, low bubbles for the wet ones: rounded, never fizzy."""
    return lowpass(bubbles(rng, dur, density, 150, 600, (0.015, 0.04)), 1200, 4)


def glugs(rng, dur, rate=14.0, depth=0.8) -> tuple[np.ndarray, list[float]]:
    """Liquid briefly blocking the way: irregular dips in pressure, ~`rate` per second.

    Returns the pressure multiplier and the moments each dip clears (where a bubble pops).
    """
    n = n_samples(dur)
    mult = np.ones(n)
    t, clears = rng.uniform(0, 1 / rate), []
    while t < dur:
        width = rng.uniform(0.025, 0.05)
        dip = 1 - rng.uniform(0.5, 1.0) * depth * np.sin(np.pi * np.linspace(0, 1, n_samples(width)))
        i = n_samples(t)
        m = max(0, min(len(dip), n - i))
        mult[i:i + m] *= dip[:m]
        clears.append(t + width)
        t += width + rng.uniform(0.3, 1.7) / rate
    return mult, clears


def blub(rng) -> np.ndarray:
    """One low, round bubble popping as the flow clears."""
    d, f0 = rng.uniform(0.03, 0.06), rng.uniform(120, 260)
    return sine(glide(f0, f0 * rng.uniform(1.8, 2.6), d, d * 0.6), d) * env_perc(d, 0.003, d)


def gurgly_womp(rng, freq, dur, last=False) -> np.ndarray:
    """A womp note that glugs: womp_fart's contours, with the pressure stuttering through
    glugs (the model itself falters at each one) and a bubble where each clears."""
    t = time(dur)
    scoop = 2 ** (0.4 * np.exp(-t / 0.03))
    if last:
        wobble = 1 + 0.05 * np.clip((t - 0.25) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.5 * t)
        pitch = freq * scoop * np.interp(t, [0, 0.6, dur], [1.0, 0.95, 0.78]) * wobble
        pressure = np.interp(t, [0, 0.005, 0.025, 0.6, dur - 0.05, dur], [0, 1, 0.8, 0.75, 0.12, 0])
    else:
        pitch = freq * scoop * np.interp(t, [0, dur], [1.0, 0.96])
        pressure = blow(dur, release=0.06)
    mult, clears = glugs(rng, dur)
    voice = normalized(fart(rng, pitch * (1 + 0.06 * (1 - mult)), pressure * mult, strain=1.0))
    bubbles_out = np.zeros(len(voice) + n_samples(0.07))
    for at in clears:
        if at < dur and rng.random() < 0.7:
            place(bubbles_out, blub(rng), at, rng.uniform(0.5, 1.0))
    return mix([(voice, 0, 0), (normalized(bubbles_out), 0, -9)])


def pft(rng) -> np.ndarray:
    """A short, higher little 'pft': the afterthought."""
    return normalized(fart(rng, np.full(n_samples(0.12), 130.0), blow(0.12, release=0.05),
                           strain=1.0))


def womp_farts(rng, wet=0.0) -> np.ndarray:
    notes = [(womp_fart(rng, hz(n), d, i == len(WOMP) - 1, wet), at, 0)
             for i, (n, at, d) in enumerate(WOMP)]
    if wet:
        notes.append((normalized(wet_bubbles(rng, 2.2, 14 * wet)), 0.05, -16))
    return cushioned(mix(notes))


def bathroom(x, rng):
    """CompuFart suggests a reverb (its default is "Toilet Bowl"): a small, hard room."""
    return room(x, rng, t60=0.45, wet=0.12, damp=3500)


@skitgubbe_sting.variant('fart_womp', 'Womp-womp fart',
                         'The sad trombone melody, performed by a buttock: brrap brrap brrap '
                         'brrrrrapp, running out of air at the end.', round=2)
def _(rng):
    return bathroom(womp_farts(rng), rng)


@skitgubbe_sting.variant('classic', 'Classic',
                         "CompuFart's own default: one note that starts high and drops into a "
                         'long, rounded brrrrt.', round=2)
def _(rng):
    dur = 1.35
    t = time(dur)
    pitch_env = np.interp(t, [0, 0.005, 0.305], [0, 1, 0])  # +2 octaves, decaying in 0.3 s
    pitch = 90 * 2 ** (2 * pitch_env)
    pressure = env_points(dur, [(0, 0), (0.005, 1), (0.025, 0.8), (0.5, 0.8), (dur, 0)])
    return bathroom(cushioned(fart(rng, pitch, pressure)), rng)


@skitgubbe_sting.variant('wet', 'Wet one',
                         'No melody: one long, unsteady, gurgly fart and a little afterthought.',
                         round=2)
def _(rng):
    dur = 1.5
    t = time(dur)
    pitch = 80 * np.interp(t, [0, 0.1, 0.7, 1.2, dur], [1.3, 1.1, 1.0, 0.9, 0.75])
    pitch *= 1 + 0.08 * smooth_noise(len(t), rng, 4)
    pressure = env_points(dur, [(0, 0), (0.01, 1), (0.03, 0.8), (1.1, 0.7), (dur, 0)])
    pressure *= 1 + 0.35 * smooth_noise(len(t), rng, 10)
    main = normalized(fart(rng, pitch, np.clip(pressure, 0, 1), strain=1.0, strain_intensity=0.3))
    x = mix([(main, 0, 0), (pft(rng), 1.62, -6), (normalized(wet_bubbles(rng, 1.5, 18)), 0, -14)])
    return bathroom(cushioned(x), rng)


@skitgubbe_sting.variant('wet_womp', 'Wet womp',
                         'The womp-womp melody, but gurgly and unsteady throughout.', round=2)
def _(rng):
    return bathroom(womp_farts(rng, wet=0.8), rng)


@skitgubbe_sting.variant('gurgle_womp', 'Gurgly womp',
                         'Wet womp, wetter: a deeper gurgle bubbling through every note, then a '
                         'little "pft" afterthought once the air has run out.', round=3)
def _(rng):
    layers = [(gurgly_womp(rng, hz(n), d, i == len(WOMP) - 1), at, 0)
              for i, (n, at, d) in enumerate(WOMP)]
    end = WOMP[-1][1] + WOMP[-1][2]
    layers += [(pft(rng), end + 0.25, -5), (blub(rng), end + 0.33, -12)]
    return bathroom(cushioned(mix(layers)), rng)


@skitgubbe_sting.variant('cushion', 'Whoopee cushion',
                         'A tighter, squeakier fart deflating: pfweeee, sagging into a flutter.',
                         round=2)
def _(rng):
    dur = 1.3
    t = time(dur)
    pitch = np.interp(t, [0, 0.1, 0.9, dur], [230, 260, 160, 60])
    pressure = np.interp(t, [0, 0.01, 0.05, 0.9, 1.2, dur], [0, 1, 0.9, 0.6, 0.15, 0])
    voice = fart(rng, pitch, pressure, pinch=0.85, cheek=0.3)
    return bathroom(cushioned(voice), rng)


# ======================================================== chat & feedback

chat_pop = event(
    id='chat_pop', title='Chat bubble', category=SOCIAL, loudness=-28, vary=True,
    trigger="Another player's chat message or emote bubble pops up (not your own, and not old "
            'messages on reconnect).',
    hook="a 'chatMessage' from someone else (triggerBubble)",
    intent='A tiny, friendly pop. Emotes can come in bursts, so keep it light.',
)


@chat_pop.variant('bubble', 'Bubble pop', 'A soft rising "bloop".')
def _(rng):
    dur = 0.07
    return small_room(sine(glide(420, 1150, dur, 0.035), dur) * env_perc(dur, 0.003, 0.05), rng,
                      wet=0.08)


@chat_pop.variant('droplet', 'Droplet', 'A falling "plip", like a drop of water.')
def _(rng):
    dur = 0.08
    return small_room(sine(glide(1900, 1150, dur, 0.04), dur) * env_perc(dur, 0.002, 0.06), rng,
                      wet=0.08)


invalid = event(
    id='invalid', title='Not allowed', category=SOCIAL, loudness=-27,
    trigger='The server rejects a move (the red warning toast appears).',
    hook="an 'error' message on the socket",
    intent='A soft, dull "nope": informative, never scolding.',
)


@invalid.variant('bonk', 'Soft bonk', 'A muted, low wooden bonk.')
def _(rng):
    # Pitched higher than a real bonk would be: phone speakers drop everything below ~500 Hz.
    x = mix([(thump(440, 300, 0.12, attack=0.003, glide_time=0.06), 0, 0),
             (thump(880, 600, 0.07, attack=0.003, glide_time=0.06), 0, -8),
             (thump(1320, 900, 0.04, attack=0.003, glide_time=0.06), 0, -16),
             (click(rng, 800, 2500, 0.006), 0, -16)])
    return small_room(lowpass(x, 3000), rng)


@invalid.variant('tsk', 'Tsk-tsk', 'Two short, muted taps.')
def _(rng):
    taps = [card_tap(rng, tone=1400, t60=0.03, body=260, body_db=-6, low_cut=200) for _ in range(2)]
    return small_room(mix([(taps[0], 0, 0), (taps[1], 0.085, -2)]), rng)


# ================================================================== lobby

notice_board = event(
    id='notice_board', title='Notice board pushed', category=LOBBY, loudness=-24,
    trigger='In the lobby, when you push the hanging notice board. Harder pushes (lower down) '
            'should play louder.',
    hook='Room3DBackground: noticeBoard.hitTest() then push(); pushBoard() in the 2D fallback',
    intent='Playful and physical: a hand against a wooden board hanging on ropes.',
)

# Upper plank modes kept strong: the fundamental is below what a phone speaker can play.
PLANK = [(1.0, 1.0, 1.0), (2.41, 0.85, 0.6), (3.86, 0.55, 0.35), (5.3, 0.3, 0.2)]


def plank_knock(rng, f=240, soft=False, ring=0.22, neighbour_db: float | None = -6,
                neighbour_ring=0.16, slap_db=None) -> np.ndarray:
    """A palm against hanging planks: a wooden body, and the next plank rattling.

    How long the planks ring (and the neighbour beating against them) is what makes
    it sound hollow; a short ring, no neighbour and more hand slap make it solid.
    """
    body = modal(f, PLANK, ring, attack=0.006 if soft else 0.003)
    neighbour = modal(f * 1.13, PLANK, neighbour_ring, attack=0.003)
    slap = band(white(0.05, rng), 300, 1400 if soft else 2500) * env_perc(0.05, 0.002, 0.025)
    layers = [(normalized(body), 0, 0),
              (normalized(slap), 0, slap_db if slap_db is not None else (-12 if soft else -8))]
    if neighbour_db is not None:
        layers.insert(1, (normalized(neighbour), 0.007, neighbour_db))
    return mix(layers)


@notice_board.variant('knock', 'Wood thump', 'A palm on hanging planks: hollow, with a little rattle.',
                      round=2)
def _(rng):
    return room(plank_knock(rng), rng, t60=0.45, wet=0.12)


@notice_board.variant('creak', 'Thump + rope creak',
                      'The thump, then the ropes creaking as the board swings.', round=2)
def _(rng):
    return room(mix([(plank_knock(rng), 0, 0), (creak(rng, 0.55), 0.12, -12)]), rng, t60=0.45,
                wet=0.12)


@notice_board.variant('rustle', 'Thump + paper rustle',
                      'The thump, then the pinned poster fluttering as the board swings.', round=2)
def _(rng):
    dur = 0.7
    t = time(dur)
    swing = np.exp(-t / 0.25) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 2.2 * t)))
    paper = band(white(dur, rng), 1800, 6000) * grain(n_samples(dur), rng, 350, 0.0015, 0.2) * swing
    return room(mix([(plank_knock(rng), 0, 0), (normalized(paper), 0.03, -14)]), rng, t60=0.45,
                wet=0.12)


@notice_board.variant('bump', 'Soft bump',
                      'A gentler, more muffled push: kinder if people click it a lot.', round=2)
def _(rng):
    return room(lowpass(plank_knock(rng, 220, soft=True), 1600, 4), rng, t60=0.4, wet=0.1)


@notice_board.variant('less_hollow', 'Wood thump, less hollow',
                      'Wood thump with the ring halved and the rattling neighbour plank pushed back.',
                      round=4)
def _(rng):
    knock = plank_knock(rng, ring=0.11, neighbour_db=-12, neighbour_ring=0.08, slap_db=-6)
    return room(knock, rng, t60=0.35, wet=0.08)


@notice_board.variant('solid', 'Wood thump, solid',
                      'A short ring, no rattle, more of the hand, and a low body for weight.',
                      round=4)
def _(rng):
    knock = plank_knock(rng, ring=0.06, neighbour_db=None, slap_db=-4)
    return room(mix([(knock, 0, 0), (thump(170, 120, 0.08), 0, -6)]), rng, t60=0.3, wet=0.06)


@notice_board.variant('dull', 'Wood thump, solid and dull',
                      'About as solid as the one above, but duller: more palm, less wood.',
                      round=4)
def _(rng):
    knock = plank_knock(rng, ring=0.025, soft=True, neighbour_db=None, slap_db=-2)
    thud = band(white(0.09, rng), 60, 450) * env_perc(0.09, 0.003, 0.05)  # unpitched weight
    return room(mix([(knock, 0, 0), (normalized(thud), 0, -5)]), rng, t60=0.3, wet=0.05)


ui_button = event(
    id='ui_button', title='Button press', category=LOBBY, loudness=-34, vary=True,
    trigger='Pressing a button in the lobby, or in the room menus (chat, log, rulebook, emotes).',
    hook='one delegated click listener for buttons (gold-trimmed-btn and friends)',
    intent='Discreet confirmation that the press registered: no louder than selecting a card.',
)


@ui_button.variant('soft_click', 'Soft click', 'A small, rounded click.', round=2)
def _(rng):
    body = thump(950, 820, 0.015, attack=0.001, glide_time=0.008)
    return lowpass(mix([(click(rng, 1200, 3000, 0.006, attack=0.0008), 0, 0), (body, 0, -10)]),
                   4000, 4)


@ui_button.variant('tap', 'Muted tap', 'A fingertip on a soft surface.', round=2)
def _(rng):
    return soft_land(rng, tone=1500, attack=0.0015, t60=0.012, body=420, body_db=-12)


@ui_button.variant('tick', 'Wood tick', 'A tiny, warm wooden tick.', round=2)
def _(rng):
    return lowpass(mallet(rng, 1500, t60=0.025, hardness=0.3, partials=WOOD), 4000, 4)


@ui_button.variant('pop', 'Soft pop', 'A small, low bubble pop.', round=2)
def _(rng):
    dur = 0.04
    return sine(glide(650, 1000, dur, 0.02), dur) * env_perc(dur, 0.002, 0.03)


# ============================================================== sequences

OPPONENT = -6  # dB: other players' card sounds sit behind your own

SEQUENCES = [
    Sequence(
        'phase1_round', 'Phase 1 round',
        "It's your turn: you pick a card, play it and draw, two opponents follow, and you take "
        'the trick.',
        [('your_turn', 0.0), ('card_select', 0.9), ('card_play', 1.4), ('card_draw', 1.7),
         ('card_play', 2.9, OPPONENT), ('card_play', 4.0, OPPONENT), ('trick_win_you', 4.3),
         ('trick_take', 5.3)],
    ),
    Sequence(
        'drag_drop', 'Drag and drop',
        'You pick a card up, drag it across the table and drop it. (Try the drag pad on the '
        'Card dragged sound to drag one yourself.)',
        [('card_select', 0.0), ('card_drag', 0.15, 0, 1.0, 0.9), ('card_play', 1.1)],
    ),
    Sequence(
        'tie', 'A tie',
        'You and an opponent both play a king. The tie-breaker starts silently: you go again, '
        'and win it.',
        [('card_play', 0.0), ('card_play', 1.0, OPPONENT), ('card_play', 2.6),
         ('card_play', 3.5, OPPONENT), ('trick_win_you', 3.8), ('trick_take', 4.8)],
    ),
    Sequence(
        'stro_chansa', 'Strö and Chansa',
        'You play a 7 and draw, an opponent follows, you strö your other 7 (the same sound as a '
        'play) and draw again, then next round you gamble with Chansa.',
        [('card_play', 0.0), ('card_draw', 0.3), ('card_play', 1.1, OPPONENT), ('card_play', 1.9),
         ('card_draw', 2.2), ('chance', 3.6)],
    ),
    Sequence(
        'phase2_start', 'Phase 2 begins',
        'The deck runs out, everyone gathers their tricks, the trump is revealed and you start.',
        [('phase2_start', 0.0), ('trump_reveal', 1.5), ('your_turn', 2.6)],
    ),
    Sequence(
        'phase2_round', 'Phase 2: pick up and burn',
        "An opponent beats the table and you can't, so you pick up (the Card drawn sound). "
        'Later, three plays in a row burn the table.',
        [('card_play', 0.0, OPPONENT), ('your_turn', 0.35), ('card_draw', 1.5),
         ('card_play', 2.7, OPPONENT), ('card_play', 3.6, OPPONENT), ('your_turn', 3.95),
         ('card_play', 5.0), ('burn', 5.5)],
    ),
    Sequence(
        'endgame', 'Endgame',
        'An opponent escapes, then you do, and the last player is the Skitgubbe: the sting, '
        'their cards flying out, and the poster slam.',
        [('escape_other', 0.0), ('escape_you', 1.6), ('skitgubbe_sting', 2.6),
         *[('card_play', 4.6 + 0.25 * i, -10) for i in range(5)], ('skitgubbe_slam', 6.7)],
    ),
    Sequence(
        'chat', 'Chat and mistakes',
        'Two emotes arrive, then you try a move that is not allowed.',
        [('chat_pop', 0.0), ('chat_pop', 0.45, -2), ('invalid', 1.6)],
    ),
    Sequence(
        'lobby', 'Lobby',
        'You tap a couple of buttons, then push the notice board, and once more, more gently.',
        [('ui_button', 0.0), ('ui_button', 0.6), ('notice_board', 1.5),
         ('notice_board', 2.7, -5)],
    ),
]
