"""Small offline DSP toolkit for synthesizing Skitgubbe's sound effects.

Signals are mono float64 numpy arrays at SR. Anything random takes an explicit
numpy Generator so a given seed always renders the same file: approvals in
review.json are pinned to file hashes, so renders must be reproducible.
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 44100
LN_1000 = 6.907755  # an exp decay reaching -60 dB after t60 is exp(-LN_1000 * t / t60)


def n_samples(dur: float) -> int:
    return max(1, int(round(dur * SR)))


def time(dur: float) -> np.ndarray:
    return np.arange(n_samples(dur)) / SR


def db(x: float) -> float:
    return 10 ** (x / 20)


# ---------------------------------------------------------------- sources


def white(dur: float, rng: np.random.Generator) -> np.ndarray:
    return rng.uniform(-1.0, 1.0, n_samples(dur))


def colored(dur: float, rng: np.random.Generator, slope: float) -> np.ndarray:
    """Noise with a 1/f^slope power spectrum (1 = pink, 2 = brown)."""
    n = n_samples(dur)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1] if n > 1 else 1.0
    spec /= f ** (slope / 2)
    x = np.fft.irfft(spec, n)
    return x / (np.max(np.abs(x)) + 1e-12)


def glide(f0: float, f1: float, dur: float, glide_time: float | None = None) -> np.ndarray:
    """Per-sample frequency curve moving exponentially from f0 to f1, then holding."""
    n = n_samples(dur)
    g = n if glide_time is None else min(n, n_samples(glide_time))
    out = np.full(n, float(f1))
    out[:g] = f0 * (f1 / f0) ** np.linspace(0, 1, g)
    return out


def _per_sample(freq, n: int) -> np.ndarray:
    return np.resize(np.asarray(freq, dtype=float), n) if np.ndim(freq) else np.full(n, float(freq))


def sine(freq, dur: float, phase: float = 0.0) -> np.ndarray:
    """Sine at a fixed frequency or along a per-sample frequency curve."""
    f = _per_sample(freq, n_samples(dur))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def saw(freq, dur: float, max_harmonics: int = 40) -> np.ndarray:
    """Band-limited sawtooth (additive), safe for glides and vibrato."""
    f = _per_sample(freq, n_samples(dur))
    phase = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros_like(f)
    for k in range(1, max_harmonics + 1):
        audible = (k * f) < SR * 0.45
        if not audible.any():
            break
        out += audible * np.sin(k * phase) / k
    return out * (2 / np.pi)


# -------------------------------------------------------------- envelopes


def env_perc(dur: float, attack: float, t60: float) -> np.ndarray:
    """Raised-cosine attack, then exponential decay reaching -60 dB after t60."""
    t = time(dur)
    a = max(attack, 1 / SR)
    rise = 0.5 - 0.5 * np.cos(np.pi * np.clip(t / a, 0, 1))
    fall = np.exp(-LN_1000 * np.clip(t - a, 0, None) / t60)
    return rise * fall


def env_points(dur: float, points: list[tuple[float, float]]) -> np.ndarray:
    """Piecewise-linear envelope through (time, level) points."""
    ts, levels = zip(*points)
    return np.interp(time(dur), ts, levels)


def env_swell(dur: float, peak_at: float, t60_after: float, curve: float = 2.0) -> np.ndarray:
    """Rise as (t/peak)^curve, then decay exponentially: a whoosh shape."""
    t = time(dur)
    rise = np.clip(t / peak_at, 0, 1) ** curve
    fall = np.exp(-LN_1000 * np.clip(t - peak_at, 0, None) / t60_after)
    return rise * fall


# ---------------------------------------------------------------- filters


def _sos(kind: str, freq, order: int):
    return signal.butter(order, freq, btype=kind, fs=SR, output='sos')


def lowpass(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos('lowpass', min(fc, SR * 0.45), order), x)


def highpass(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos('highpass', fc, order), x)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(_sos('bandpass', [lo, min(hi, SR * 0.45)], order), x)


def svf(x: np.ndarray, cutoff, q: float = 0.707, mode: str = 'bp') -> np.ndarray:
    """Zavalishin TPT state-variable filter; cutoff may vary per sample.

    Stays stable under fast modulation, which the scipy filters don't.
    mode: 'lp', 'hp', or 'bp' (bandpass normalized to unity peak gain).
    """
    n = len(x)
    fc = np.clip(_per_sample(cutoff, n), 10.0, SR * 0.45)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    xs, a1s, a2s, a3s = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    out = [0.0] * n
    ic1 = ic2 = 0.0
    for i in range(n):
        v3 = xs[i] - ic2
        v1 = a1s[i] * ic1 + a2s[i] * v3
        v2 = ic2 + a2s[i] * ic1 + a3s[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 'lp':
            out[i] = v2
        elif mode == 'hp':
            out[i] = xs[i] - k * v1 - v2
        else:
            out[i] = k * v1
    return np.asarray(out)


# ---------------------------------------------------------------- mixing


def place(dst: np.ndarray, src: np.ndarray, at: float, gain: float = 1.0) -> None:
    """Add src into dst starting at `at` seconds (truncated at dst's end)."""
    i = int(round(at * SR))
    if i >= len(dst):
        return
    m = min(len(src), len(dst) - i)
    dst[i:i + m] += gain * src[:m]


def mix(layers: list[tuple[np.ndarray, float, float]]) -> np.ndarray:
    """Mix (signal, start seconds, gain dB) layers into one buffer long enough for all."""
    end = max(int(round(at * SR)) + len(sig) for sig, at, _ in layers)
    out = np.zeros(end)
    for sig, at, gain_db in layers:
        place(out, sig, at, db(gain_db))
    return out


def normalized(x: np.ndarray) -> np.ndarray:
    return x / (np.max(np.abs(x)) + 1e-12)


def room(x: np.ndarray, rng: np.random.Generator, t60: float = 0.5, wet: float = 0.12,
         predelay: float = 0.012, damp: float = 5000) -> np.ndarray:
    """Convolve with a synthetic room: sparse early reflections + a dark decaying tail."""
    dur = t60 * 1.1 + predelay
    n = n_samples(dur)
    t = time(dur)
    tail = white(dur, rng)
    bright = highpass(tail, damp) * np.exp(-LN_1000 * t / (t60 * 0.35))
    dark = lowpass(tail, damp) * np.exp(-LN_1000 * t / t60)
    ir = (bright + dark) * np.clip((t - predelay) / 0.01, 0, 1)
    for _ in range(8):
        at = predelay + rng.uniform(0, 0.03)
        ir[min(n - 1, int(at * SR))] += rng.uniform(0.3, 0.8) * rng.choice([-1, 1])
    verb = normalized(signal.fftconvolve(x, ir)) * np.max(np.abs(x))
    dry = np.zeros_like(verb)
    dry[:len(x)] = x
    return (1 - wet) * dry + wet * verb


def soft_clip(x: np.ndarray, drive: float = 1.5) -> np.ndarray:
    return np.tanh(drive * x) / np.tanh(drive)


# ---------------------------------------------------------------- texture


def grain(n: int, rng: np.random.Generator, density: float, smear: float = 0.002,
          floor: float = 0.35) -> np.ndarray:
    """Amplitude modulator of random micro-impulses: the fibre in paper sounds."""
    hits = (rng.random(n) < density / SR) * rng.uniform(0.3, 1.0, n)
    kernel = np.exp(-np.arange(int(smear * SR * 6) + 1) / (smear * SR))
    mod = normalized(signal.fftconvolve(hits, kernel)[:n])
    return floor + (1 - floor) * mod


def smooth_noise(n: int, rng: np.random.Generator, rate: float) -> np.ndarray:
    """A slow random wander in [-1, 1], changing at roughly `rate` Hz."""
    return normalized(lowpass(rng.standard_normal(n + SR), rate)[SR:])


def make_loop(x: np.ndarray, xfade: float = 0.25) -> np.ndarray:
    """Make a stationary texture loop seamlessly: crossfade its tail into its head."""
    k = n_samples(xfade)
    u = np.linspace(0, 1, k)
    out = x[:-k].copy()
    out[:k] = x[:k] * np.sin(u * np.pi / 2) + x[-k:] * np.cos(u * np.pi / 2)
    return out


# ------------------------------------------------------------ instruments


def click(rng: np.random.Generator, lo: float = 2500, hi: float = 9000,
          t60: float = 0.006, attack: float = 0.0004) -> np.ndarray:
    """A tiny filtered-noise transient: fingernail, card edge, paper tick."""
    dur = t60 * 1.3 + 0.002 + max(0.0, attack - 0.0004)
    return normalized(bandpass(white(dur, rng), lo, hi) * env_perc(dur, attack, t60))


def thump(f0: float, f1: float, t60: float, attack: float = 0.002,
          glide_time: float = 0.04) -> np.ndarray:
    """A pitched-down sine: the low body of an impact."""
    dur = t60 * 1.1 + attack
    return sine(glide(f0, f1, dur, glide_time), dur) * env_perc(dur, attack, t60)


def card_tap(rng: np.random.Generator, tone: float = 2600, t60: float = 0.035,
             body: float = 150, body_db: float | None = -12, snap_db: float | None = None,
             low_cut: float = 250, attack: float = 0.0008, order: int = 2) -> np.ndarray:
    """A card landing on felt: a damped noise impact with a faint low body."""
    dur = t60 * 1.2 + 0.01
    burst = highpass(lowpass(white(dur, rng), tone, order), low_cut) * env_perc(dur, attack, t60)
    layers = [(normalized(burst), 0, 0)]
    if body_db is not None:
        layers.append((thump(body * 1.4, body, t60 * 1.8), 0, body_db))
    if snap_db is not None:
        layers.append((click(rng, 3500, 10000, 0.004), 0, snap_db))
    return mix(layers)


def soft_land(rng: np.random.Generator, tone: float = 1300, attack: float = 0.003,
              t60: float = 0.05, body: float = 180, body_db: float | None = -12,
              air_db: float | None = None) -> np.ndarray:
    """A card settling onto thick felt: no click, just a muffled 'pat'.

    The slow attack and steep low-pass are what make it soft; the optional air
    is the cushion pushed out from under a card landing flat.
    """
    pre = 0.04 if air_db is not None else 0.0
    dur = t60 * 1.3 + attack + 0.01
    pat = highpass(lowpass(white(dur, rng), tone, 4), 120) * env_perc(dur, attack, t60)
    layers = [(normalized(pat), pre, 0)]
    if body_db is not None:
        layers.append((thump(body * 1.25, body, t60 * 1.5, attack=attack), pre, body_db))
    if air_db is not None:
        air = lowpass(white(pre + 0.01, rng), tone * 1.5, 4) * env_swell(pre + 0.01, pre, 0.01, 2.5)
        layers.append((normalized(air), 0, air_db))
    return mix(layers)


def slide(rng: np.random.Generator, dur: float, f0: float, f1: float, q: float = 1.1,
          density: float = 350, attack: float = 0.02, release: float = 0.05,
          floor: float = 0.35) -> np.ndarray:
    """A card (or stack) sliding over felt: swept bandpassed noise with paper grain.

    A higher grain floor makes the slide smoother and softer.
    """
    x = svf(white(dur, rng), glide(f0, f1, dur), q, 'bp')
    x *= grain(len(x), rng, density, floor=floor)
    hold = max(attack, dur - release)
    x *= env_points(dur, [(0, 0), (attack, 1), (hold, 0.8), (dur, 0)]) ** 1.5
    return normalized(highpass(x, 180))


def flick(rng: np.random.Generator, dur: float = 0.07, f0: float = 700, f1: float = 2800,
          snap_db: float | None = -4) -> np.ndarray:
    """A card turned over in the air: a short rising 'fwip' ending in a snap."""
    total = dur * 1.5  # room for the swell to decay fully past `dur`
    air = svf(white(total, rng), glide(f0, f1, total, dur), 1.4, 'bp') * env_swell(total, dur * 0.8,
                                                                                   dur * 0.4)
    layers = [(normalized(air), 0, 0)]
    if snap_db is not None:
        layers.append((click(rng, 3000, 9000, 0.005), dur * 0.85, snap_db))
    return mix(layers)


def clicks_along(rng: np.random.Generator, dur: float, rate_lo: float, rate_hi: float,
                 shape: str = 'arch', lo: float = 1800, hi: float = 6500,
                 t60: tuple[float, float] = (0.006, 0.014), jitter: float = 0.003,
                 fade: float = 0.0) -> np.ndarray:
    """A train of card-edge clicks whose rate follows a curve: riffles, flutters.

    shape: 'arch' (slow-fast-slow), 'accel' (speeding up), 'decel' (slowing down).
    fade: how much quieter (0..1) the last click is than the first.
    """
    u = time(dur) / dur
    curve = {'arch': np.sin(np.pi * u) ** 1.5, 'accel': u ** 1.2, 'decel': (1 - u) ** 1.5}[shape]
    rate = rate_lo + (rate_hi - rate_lo) * curve
    hits = np.flatnonzero(np.diff(np.floor(np.cumsum(rate) / SR)) > 0)
    out = np.zeros(n_samples(dur + 0.05))
    for i in hits:
        at = max(0.0, i / SR + rng.uniform(-jitter, jitter))
        amp = rng.uniform(0.45, 1.0) * (1 - fade * i / len(u))
        centre = rng.uniform(lo, hi)
        place(out, click(rng, centre * 0.6, centre * 1.5, rng.uniform(*t60)), at, amp)
    return out


def modal(freq: float, partials: list[tuple[float, float, float]], t60: float,
          attack: float = 0.0015, detune_hz: float = 0.0) -> np.ndarray:
    """Sum of exponentially decaying sine partials: (ratio, amplitude, decay scale).

    detune_hz doubles the fundamental slightly sharp, for a slow shimmering beat.
    """
    dur = t60 + attack
    out = np.zeros(n_samples(dur))
    for ratio, amp, decay_scale in partials:
        f = freq * ratio
        if f >= SR * 0.45:
            continue
        partial = sine(f, dur)
        if detune_hz and ratio == 1.0:
            partial = 0.5 * partial + 0.5 * sine(f + detune_hz, dur, 1.3)
        out += amp * partial * env_perc(dur, attack, t60 * decay_scale)
    return out


# (ratio, amplitude, decay scale) for modal()
MARIMBA = [(1.0, 1.0, 1.0), (3.93, 0.32, 0.28), (9.2, 0.08, 0.1)]
KALIMBA = [(1.0, 1.0, 1.0), (5.95, 0.22, 0.14), (15.1, 0.04, 0.06)]
CHIME = [(1.0, 1.0, 1.0), (2.76, 0.28, 0.5), (5.4, 0.1, 0.28), (8.93, 0.04, 0.16)]
WOOD = [(1.0, 1.0, 1.0), (2.41, 0.45, 0.55), (3.86, 0.2, 0.3)]


def mallet(rng: np.random.Generator, freq: float, t60: float = 0.6, hardness: float = 0.4,
           partials=MARIMBA, detune_hz: float = 0.0) -> np.ndarray:
    """A struck bar: modal partials plus a short mallet-contact noise."""
    attack = 0.004 - 0.003 * hardness
    body = modal(freq, partials, t60, attack, detune_hz)
    strike = lowpass(white(0.02, rng), 1500 + 5000 * hardness) * env_perc(0.02, 0.0005, 0.01)
    return mix([(body, 0, 0), (normalized(strike), 0, -34 + 14 * hardness)])


def pluck(rng: np.random.Generator, freq: float, dur: float, brightness: float = 0.5,
          damping: float = 0.995) -> np.ndarray:
    """Karplus-Strong string; low damping and brightness give a palm-muted 'dun'."""
    period = max(2, int(round(SR / freq)))
    buf = lowpass(rng.uniform(-1, 1, period * 4), 400 + 6000 * brightness)[-period:].tolist()
    n = n_samples(dur)
    out = [0.0] * n
    for i in range(n):
        j = i % period
        out[i] = buf[j]
        buf[j] = damping * 0.5 * (buf[j] + buf[(j + 1) % period])
    return np.asarray(out) * env_points(dur, [(0, 0), (0.002, 1), (dur - 0.04, 1), (dur, 0)])


def shimmer(rng: np.random.Generator, dur: float, count: int, lo: float = 3000,
            hi: float = 7000, t60: tuple[float, float] = (0.12, 0.3)) -> np.ndarray:
    """Scattered faint high pings: a glint or sparkle."""
    out = np.zeros(n_samples(dur + max(t60)))
    for _ in range(count):
        decay = rng.uniform(*t60)
        ping = sine(rng.uniform(lo, hi), decay) * env_perc(decay, 0.002, decay)
        place(out, ping, rng.uniform(0, dur), rng.uniform(0.3, 1.0))
    return out


def bubbles(rng: np.random.Generator, dur: float, density: float, lo: float = 180,
            hi: float = 900, t60: tuple[float, float] = (0.01, 0.03)) -> np.ndarray:
    """Little upward-chirping blips: air bubbles bursting through something wet."""
    out = np.zeros(n_samples(dur + max(t60)))
    for _ in range(rng.poisson(density * dur)):
        f0, d = rng.uniform(lo, hi), rng.uniform(*t60)
        blip = sine(glide(f0, f0 * rng.uniform(1.6, 2.6), d, d * 0.7), d) * env_perc(d, 0.0015, d)
        place(out, blip, rng.uniform(0, dur), rng.uniform(0.3, 1.0))
    return out


def creak(rng: np.random.Generator, dur: float, rate: tuple[float, float] = (35, 110),
          res: tuple[float, float] = (420, 650), q: float = 6) -> np.ndarray:
    """Stick-slip friction (a rope or hinge creaking): ticks rung through a sweeping resonance."""
    ticks = clicks_along(rng, dur, rate[0], rate[1], 'arch', 2000, 5000, t60=(0.001, 0.002),
                         jitter=0.002)
    sweep = glide(res[0], res[1], len(ticks) / SR)
    x = svf(ticks, sweep, q, 'bp') + 0.5 * svf(ticks, sweep * 2.3, q, 'bp')
    return normalized(x) * env_points(len(x) / SR, [(0, 0), (0.08 * dur, 1), (0.7 * dur, 0.8),
                                                    (len(x) / SR, 0)])


# -------------------------------------------------------------- mastering


def _k_weight(x: np.ndarray) -> np.ndarray:
    """ITU-R BS.1770 K-weighting (high shelf + high pass), designed for SR."""
    a = 10 ** (4.0 / 40)
    w = 2 * np.pi * 1681.97 / SR
    alpha = np.sin(w) / (2 * 0.7072)
    cw = np.cos(w)
    sa = 2 * np.sqrt(a) * alpha
    b = [a * ((a + 1) + (a - 1) * cw + sa), -2 * a * ((a - 1) + (a + 1) * cw),
         a * ((a + 1) + (a - 1) * cw - sa)]
    den = [(a + 1) - (a - 1) * cw + sa, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - sa]
    return highpass(signal.lfilter(b, den, x), 38.0)


def loudness_db(x: np.ndarray, window: float = 0.05) -> float:
    """Loudest K-weighted 50 ms window, in dB. Short SFX need a short window."""
    y = _k_weight(x) ** 2
    w = n_samples(window)
    if len(y) < w:
        y = np.pad(y, (0, w - len(y)))
    return float(10 * np.log10(np.max(uniform_filter1d(y, w, mode='constant')) + 1e-12))


def peak_db(x: np.ndarray) -> float:
    return float(20 * np.log10(np.max(np.abs(x)) + 1e-12))


def limit(x: np.ndarray, ceiling_db: float = -1.0, lookahead: float = 0.003) -> np.ndarray:
    """Look-ahead peak limiter with smoothed gain reduction (no hard clipping)."""
    ceiling = db(ceiling_db)
    gain = np.minimum(1.0, ceiling / (np.abs(x) + 1e-12))
    w = 2 * n_samples(lookahead) + 1
    gain = uniform_filter1d(minimum_filter1d(gain, w), w)
    return np.clip(x * gain, -ceiling, ceiling)


def trim_tail(x: np.ndarray, floor_db: float = -60.0, keep: float = 0.02) -> np.ndarray:
    """Drop the inaudible end of a decay (relative to the sound's own peak)."""
    loud = np.flatnonzero(np.abs(x) > np.max(np.abs(x)) * db(floor_db))
    if len(loud) == 0:
        return x
    return x[:min(len(x), loud[-1] + n_samples(keep))]


def master(x: np.ndarray, loudness: float, loop: bool = False) -> np.ndarray:
    """Tidy the ends, then normalize to a target loudness so variants compare fairly.

    Loops keep their ends untouched so they stay seamless.
    """
    if loop:
        return limit(x * db(loudness - loudness_db(x)))
    x = trim_tail(highpass(x, 25.0))
    fade_in = min(n_samples(0.0005), len(x))
    fade_out = min(n_samples(0.015), len(x))
    x[:fade_in] *= np.linspace(0, 1, fade_in)
    x[-fade_out:] *= np.linspace(1, 0, fade_out) ** 2
    return limit(x * db(loudness - loudness_db(x)))


def write_wav(path: Path, x: np.ndarray, rng: np.random.Generator) -> None:
    """16-bit mono PCM with TPDF dither."""
    dither = (rng.random(len(x)) - rng.random(len(x))) / 32768
    pcm = np.clip(np.round((x + dither) * 32767), -32768, 32767).astype('<i2')
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
