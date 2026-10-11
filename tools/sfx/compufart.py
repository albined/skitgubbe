"""A physical fart model: Python port of "Terrance" from Alex M. Fink's CompuFart.

Source: https://github.com/alexmfink/compufart (CompuFart.cmajor). A damped
mass-spring "lip" swings open under air pressure; the Bernoulli airflow through
the opening, fed back through the pressure it builds, keeps it oscillating. The
output is the airflow itself (DC-blocked), which is why it sounds rounded rather
than clicky. Ported line for line; only the I/O is reshaped into numpy arrays.

MIT License

Copyright (c) 2023 Alex M. Fink

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

from __future__ import annotations

import math

import numpy as np

SR = 44100


def terrance(rng: np.random.Generator, freq: np.ndarray, pressure: np.ndarray,
             pinch: float = 0.5, cheek: float = 0.5, strain: float = 0.7,
             strain_intensity: float = 0.5) -> np.ndarray:
    """Run the model. freq (Hz, per sample) sets the lip mass, so roughly the pitch (it is
    not tuned); pressure (0..1, per sample) blows. pinch, cheek, strain and
    strain_intensity are CompuFart's timbre controls, all 0..1 (its defaults here).
    """
    n = len(pressure)
    sr = float(SR)
    pi2 = math.pi * math.pi

    # TerranceInputInterface: map the normalized controls to physical units.
    p = pinch * 0.75 + 0.25
    kc = p * p * 4.2e8
    x_upper = 0.0012 * cheek * cheek + 0.0015
    x_lower = -0.0006 * (1.0 - cheek) ** 2
    noise_mag = min(max(0.35 * strain, 0.0), 0.35)
    cutoff = strain_intensity * 10000.0 + 100.0
    noise_coeff = min(max(1.0 - cutoff * 2 * math.pi / sr, 0.0), 0.999)
    bipolar = rng.uniform(-1.0, 1.0, n).tolist()
    prev_noise = 0.0

    # Terrance: constants and state.
    q_open, q_closed = 3.0, 0.5
    k, kp = 105.0, 50.0e8
    w, l_ = 0.007, 0.002
    x0 = y0 = -0.001
    x_joint, y_joint = 0.0, 0.004
    y_lower_lim, y_upper_lim = -0.0004, 0.0002
    rho, nu, c = 1.2, 0.0000185, 340.0
    s_cup = 0.0025
    z_c = rho * c / s_cup
    is_open = True
    xn = yn = xnm1 = ynm1 = 0.0
    p_cup = p_lip = u_ac = 0.0

    # TerranceOutputInterface: gain and DC blocker.
    last_in = last_out = 0.0

    fs, ps = freq.tolist(), pressure.tolist()
    out = [0.0] * n
    for i in range(n):
        control = ps[i]
        if control < 0.05:
            p0 = control / 0.05 * 4800.0
        else:
            r = (1.0 - noise_coeff) * bipolar[i]
            r += r + noise_coeff * prev_noise  # sic: the original adds r twice
            prev_noise = r
            p0 = ((control - 0.05) / 0.95 * 3200.0 + 4800.0) * 0.95 * (1.0 + noise_mag * r)

        mass = 1.5 / (4.0 * pi2 * (fs[i] / 16.0))
        r_ = math.sqrt(mass * k) / (q_open if is_open else q_closed)

        xnm2, ynm2 = xnm1, ynm1
        xnm1, ynm1 = xn, yn
        a = 2.0 * mass * sr * sr - r_ * sr - k
        b = -mass * sr * sr + r_ * sr
        drive = 2.0 * w * (p0 - p_cup)
        xn = a * xnm1 + drive * (-ynm1) + b * xnm2 + k * x0 - drive * (-y_joint)
        yn = a * ynm1 + drive * xnm1 + b * ynm2 + k * y0 - drive * x_joint
        yn += 2.0 * w * l_ * p_lip
        if is_open:
            xn += -0.5 * kc * (xnm1 - x0) ** 3
            yn += -0.5 * kc * (ynm1 - y0) ** 3
        if ynm1 < y_lower_lim:
            d = ynm1 - y_lower_lim
            yn += -0.5 * kp * d * d * d
        xn *= 1.0 / (sr * sr * mass)
        yn *= 1.0 / (sr * sr * mass)
        yn = min(yn, y_upper_lim)
        xn = min(max(xn, x_lower), x_upper)

        if yn > 0.0:
            is_open = True
            s_lip = 2.0 * w * yn
        else:
            is_open = False
            s_lip = 0.0
        u_lip = w * ((xn - x_joint) * (yn - ynm1) * sr - (yn - y_joint) * (xn - xnm1) * sr)

        if is_open:
            u_acm1 = u_ac
            s2 = s_lip * s_lip
            s3 = s2 * s_lip
            if s_lip == 0.0 or s2 == 0.0 or s3 == 0.0:
                u_ac = p_lip = 0.0
            else:
                aa = 0.5 * rho / s2 - rho * (1.0 / (s_lip * s_cup) - 1.0 / (s_cup * s_cup))
                bb = rho * l_ * sr / s_lip + 12.0 * nu * w * w * l_ / s3
                cc = p_cup - p0 - rho * l_ * u_acm1 * sr / s_lip
                rad = bb * bb - 4.0 * aa * cc
                u_ac = (-bb + (math.sqrt(rad) if rad > 0.0 else 0.0)) / (2.0 * aa)
                p_lip = (p0 - 0.5 * rho * u_ac * u_ac / s2 - rho * l_ * (u_ac - u_acm1) * sr / s_lip
                         - 12.0 * nu * w * w * l_ * u_ac / s3)
        else:
            u_ac = p_lip = 0.0
        flow = u_lip + u_ac
        p_cup = z_c * flow

        audio = 2500.0 * flow
        last_out = 0.99 * last_out + 0.995 * audio - 0.995 * last_in
        last_in = audio
        out[i] = last_out
    return np.asarray(out)
