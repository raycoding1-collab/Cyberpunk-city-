"""Original score + sound design for the KOI-TEI cinematic (numpy only, no samples).

A darksynth cue at 120 BPM (so every cut from the street shot on lands on a beat):

  0.0–15  intro    rain + thunder, CS-80-style brass swells (filter-swept detuned saws with
                   pitch scoop and delayed vibrato), a slow vibrato lead, FM "hologram" bells
                   over the koi, then a filtered 16th bassline and a snare build
  15–34   drop     four-on-the-floor kick, gated-reverb snare, 16th hats, sidechained saw bass
                   and pads; the main theme enters at 23 s (Am – F – Dm – E)
  34.3    glitch   the music bus stutters and bit-crushes with the hacked ad screen
  35–39   maglev   everything cuts to a sub drop, the train's Doppler pass, a riser + snare roll
  39–45   finale   crash, full brass reprise of the theme an octave up, final Am(add9) rings out

Every voice is additive (band-limited, with a per-harmonic low-pass + resonance envelope, i.e.
a moving filter without per-sample loops). Reverbs are FFT convolutions with synthetic IRs.

usage: python3 tools/soundtrack.py out.wav [duration]
"""
import sys, wave
import numpy as np

SR = 48000
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(2087)

BPM = 120.0
BEAT = 60 / BPM            # 0.5 s
BAR = BEAT * 4             # 2.0 s
S16 = BEAT / 4             # 0.125 s
GRID0 = 15.0               # the drop; bars run 15, 17, 19, … (and 11, 13 for the build)

# shot boundaries (s): establish, koi, tower, street, ramen, car, alley, screen, maglev, finale
SHOTS = [0, 5.5, 10.0, 15.0, 20.0, 24.0, 27.5, 31.5, 35.0, 39.0, 45.0]


# =============================================================== helpers
class Bus:
    def __init__(self):
        self.L = np.zeros(N); self.R = np.zeros(N)

    def add(self, sig, start=0.0, pan=0.0, gain=1.0):
        i0 = int(round(start * SR))
        if i0 < 0:
            sig = sig[-i0:]; i0 = 0
        n = min(len(sig), N - i0)
        if n <= 0:
            return
        s = sig[:n] * gain
        self.L[i0:i0 + n] += s * np.cos((pan + 1) * np.pi / 4)
        self.R[i0:i0 + n] += s * np.sin((pan + 1) * np.pi / 4)

    def add2(self, l, r, start=0.0, gain=1.0):
        i0 = int(round(start * SR)); n = min(len(l), N - i0)
        if n > 0:
            self.L[i0:i0 + n] += l[:n] * gain; self.R[i0:i0 + n] += r[:n] * gain

    def mul(self, e):
        self.L *= e; self.R *= e

    @staticmethod
    def scaled(b, g):
        o = Bus(); o.L, o.R = b.L * g, b.R * g
        return o

    def mix_into(self, other, gain=1.0):
        other.L += self.L * gain; other.R += self.R * gain


def spectral(x, lo=20.0, hi=20000.0, tilt=0.0, order=2):
    """zero-phase band filter with an optional dB/oct tilt, via FFT"""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** (2 * order))
    g = g / np.sqrt(1 + (f / hi) ** (2 * order))
    if tilt:
        g *= (np.maximum(f, 20) / 1000.0) ** (tilt / 6.02)
    return np.fft.irfft(X * g, len(x))


def env(points, tt=None):
    ts, vs = zip(*points)
    return np.interp(t if tt is None else tt, ts, vs)


def adsr(n, a=0.01, d=0.2, s=0.6, r=0.3):
    tt = np.arange(n) / SR
    e = np.minimum(tt / max(a, 1e-4), 1.0)
    e = np.where(tt > a, 1 - (1 - s) * np.minimum((tt - a) / max(d, 1e-4), 1), e)
    rel = np.clip((tt - (n / SR - r)) / max(r, 1e-4), 0, 1)
    return e * (1 - rel)


def nf(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def fftconv(x, ir):
    n = len(x) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]


def make_ir(sec, rt60, bright_rt=None, pre=0.02, seed=1):
    """stereo synthetic hall: dense noise, exponential decay, darker as it decays"""
    r = np.random.default_rng(seed)
    n = int(sec * SR); tt = np.arange(n) / SR
    out = []
    for _ in range(2):
        dark = spectral(r.standard_normal(n), 120, 2200) * 10 ** (-3 * tt / rt60)
        bright = spectral(r.standard_normal(n), 1500, 11000) * 10 ** (-3 * tt / (bright_rt or rt60 * 0.35))
        ir = dark + bright * 0.6
        ir *= np.clip(tt / 0.012, 0, 1)                     # soft onset
        ir = np.concatenate([np.zeros(int(pre * SR)), ir])
        out.append(ir / np.sqrt(np.sum(ir ** 2)))
    return out


def reverb(bus, ir, wet=1.0):
    """returns a new Bus with the wet signal only (mid/side-ish cross-feed for width)"""
    o = Bus()
    o.L = fftconv(bus.L * 0.8 + bus.R * 0.2, ir[0]) * wet
    o.R = fftconv(bus.R * 0.8 + bus.L * 0.2, ir[1]) * wet
    return o


def additive(f0, fc, n, detunes=(0.0,), res=0.0, shape='saw', kcap=160, phase_seed=None):
    """band-limited oscillator(s) through a moving 2-pole low-pass with resonance.
    f0, fc: scalars or arrays of length n (Hz)."""
    f0 = np.broadcast_to(np.asarray(f0, float), (n,))
    fc = np.maximum(np.broadcast_to(np.asarray(fc, float), (n,)), 30.0)
    r = np.random.default_rng(phase_seed)
    out = np.zeros(n)
    for d in detunes:
        fd = f0 * (1 + d)
        ph = np.cumsum(fd) / SR + r.uniform()
        ratio = fd / fc
        r4 = ratio ** 4
        kmax = int(min(kcap, 0.45 * SR / fd.max(), np.ceil(5.0 * (fc / fd).max()) + 1))
        for k in range(1, max(kmax, 1) + 1):
            if shape == 'square' and k % 2 == 0:
                continue
            g = 1 / np.sqrt(1 + k ** 4 * r4)
            if res:
                g = g + res * np.exp(-((k * ratio - 1) / 0.16) ** 2)
            out += g / k * np.sin(2 * np.pi * k * ph + r.uniform(0, 0.3))
    return out / len(detunes)


def vibrato(n, rate=5.2, depth=0.004, delay=0.35, fade=0.6):
    tt = np.arange(n) / SR
    return 1 + depth * np.clip((tt - delay) / fade, 0, 1) * np.sin(2 * np.pi * rate * tt)


# =============================================================== buses
music = Bus()      # synths (sidechain-ducked by the kick)
drums = Bus()      # kick, snare, hats, crashes, risers (not ducked)
hall_send = Bus()  # → long hall
fx = Bus()         # rain + sound effects


# --------------------------------------------------------------- harmony
AM9 = [45, 52, 59, 60, 64]
FMAJ = [41, 48, 57, 60, 64]
DM9 = [38, 50, 57, 60, 65]
EMAJ = [40, 47, 52, 56, 59, 62]
AFIN = [33, 45, 52, 57, 59, 60, 64, 71]

# (start, end, voicing, bass root midi)
PROG = [
    (0.0, 5.5, AM9, 33), (5.5, 10.0, FMAJ, 29), (10.0, 13.0, DM9, 38), (13.0, 15.0, EMAJ, 28),
    (15.0, 19.0, AM9, 33), (19.0, 23.0, FMAJ, 29), (23.0, 27.0, DM9, 38), (27.0, 31.0, EMAJ, 28),
    (31.0, 35.0, AM9, 33), (35.0, 37.0, FMAJ, 29), (37.0, 39.0, EMAJ, 28),
    (39.0, 41.0, AM9, 33), (41.0, 43.0, FMAJ, 29), (43.0, 45.0, AFIN, 33),
]


def chord_at(time):
    for s, e, v, b in PROG:
        if s <= time < e:
            return v, b
    return PROG[-1][2], PROG[-1][3]


# --------------------------------------------------------------- CS-80 brass
def brass(notes, start, dur, gain, attack=0.9, peak=2400, sustain_fc=1300, pan_spread=0.6, scoop=0.03):
    n = int(dur * SR); tt = np.arange(n) / SR
    fc = sustain_fc + (peak - sustain_fc) * np.exp(-np.maximum(tt - attack, 0) / 1.2)
    fc = np.where(tt < attack, 260 + (peak - 260) * (tt / attack) ** 1.5, fc)
    fc = fc * np.clip((dur - tt) / 1.2, 0.35, 1)                 # filter closes on release
    amp = adsr(n, a=attack * 0.8, d=0.8, s=0.8, r=min(1.6, dur * 0.4))
    for j, m in enumerate(notes):
        pitch = nf(m) * (1 - scoop * np.exp(-tt / 0.12)) * vibrato(n, 5.0 + 0.3 * j, 0.0045, 0.5, 0.8)
        v = additive(pitch, fc * (1 + 0.15 * j / len(notes)), n, detunes=(-0.0045, 0.0042), res=0.35, phase_seed=int(m * 7 + start * 10))
        pan = (j / max(1, len(notes) - 1) - 0.5) * 2 * pan_spread
        sig = v * amp * gain / np.sqrt(len(notes))
        music.add(sig, start, pan=pan)
        hall_send.add(sig, start, pan=pan, gain=0.9)


# --------------------------------------------------------------- vintage lead
def lead(phrase, gain, octave=0, glide=0.045, fc_peak=3600, fc_sus=1900, send=0.8, delay=True, vib=0.0055):
    """phrase: [(start, midi, dur)] — legato with portamento, delayed vibrato"""
    prev = None
    dl = Bus()
    for (st, m, du) in phrase:
        m = m + 12 * octave
        n = int((du + 0.25) * SR); tt = np.arange(n) / SR
        f_to = nf(m)
        f_from = nf(prev) if prev is not None else f_to
        pitch = f_to + (f_from - f_to) * np.exp(-tt / glide)
        pitch = pitch * vibrato(n, 5.4, vib, delay=min(0.4, du * 0.5), fade=0.5)
        fc = fc_sus + (fc_peak - fc_sus) * np.exp(-tt / 0.25)
        v = additive(pitch, fc, n, detunes=(-0.004, 0.0, 0.0045), res=0.5, phase_seed=int(st * 100))
        v += 0.35 * additive(pitch / 2, fc * 0.6, n, shape='square', phase_seed=int(st * 100) + 1)
        amp = adsr(n, a=0.025, d=0.3, s=0.82, r=0.22)
        sig = v * amp * gain
        music.add(sig, st)
        hall_send.add(sig, st, gain=send)
        if delay:
            dl.add(sig, st)
        prev = m
    if delay:   # ping-pong dotted-eighth echo
        d = int(BEAT * 0.75 * SR)
        eL = np.zeros(N); eR = np.zeros(N)
        src = (dl.L + dl.R) * 0.5
        src = spectral(src, 300, 4500)
        for k in range(1, 6):
            tap = np.roll(src, d * k) * (0.42 ** k); tap[:d * k] = 0
            (eL if k % 2 else eR)[:] += tap
        music.L += eL * 0.7; music.R += eR * 0.7
        hall_send.L += eL * 0.4; hall_send.R += eR * 0.4


# --------------------------------------------------------------- FM bells (hologram)
def bell(m, start, gain, pan=0.0, decay=2.4):
    n = int(decay * 1.6 * SR); tt = np.arange(n) / SR
    f = nf(m)
    idx = 2.6 * np.exp(-tt * 3.5)
    s = np.sin(2 * np.pi * f * tt + idx * np.sin(2 * np.pi * f * 3.5 * tt)) * np.exp(-tt / decay * 2.3)
    s += 0.25 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 3)
    music.add(s, start, pan=pan, gain=gain)
    hall_send.add(s, start, pan=pan, gain=gain * 1.2)


# --------------------------------------------------------------- drums
def mk_kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 44 + 120 * np.exp(-tt * 30) + 30 * np.exp(-tt * 300)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5.5)
    body = np.tanh(body * 1.8)
    click = spectral(rng.standard_normal(n), 1500, 9000) * np.exp(-tt * 400) * 0.35
    return body + click


def mk_snare():
    n = int(0.6 * SR); tt = np.arange(n) / SR
    body = (np.sin(2 * np.pi * 182 * tt) + 0.6 * np.sin(2 * np.pi * 331 * tt)) * np.exp(-tt * 22)
    noise = spectral(rng.standard_normal(n), 1300, 10000) * np.exp(-tt * 13)
    dry = body * 0.7 + noise / np.abs(noise).max() * 0.9
    # gated reverb: dense short room, slammed shut at 260 ms
    ir = make_ir(0.5, 0.9, 0.4, pre=0.004, seed=9)
    wl = fftconv(dry, ir[0]); wr = fftconv(dry, ir[1])
    gate = np.clip((0.29 - tt) / 0.03, 0, 1)
    sc = 3.2 / max(np.abs(wl).max(), 1e-6)
    return dry + wl * gate * sc * 0.35, dry + wr * gate * sc * 0.35


def mk_hat(open_=False):
    n = int((0.32 if open_ else 0.06) * SR); tt = np.arange(n) / SR
    met = sum(np.sign(np.sin(2 * np.pi * f * tt)) for f in (3140, 4170, 5310, 6890, 8120))
    nz = rng.standard_normal(n)
    s = spectral(met * 0.4 + nz, 6500, 16000) * np.exp(-tt * (9 if open_ else 70))
    return s / np.abs(s).max()


def mk_crash(sec=3.2):
    n = int(sec * SR); tt = np.arange(n) / SR
    met = sum(np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) for f in rng.uniform(2800, 9800, 40))
    s = spectral(rng.standard_normal(n) + met * 0.15, 3500, 15000) * np.exp(-tt * 1.4) * np.clip(tt / 0.004, 0, 1)
    return s / np.abs(s).max()


KICK = mk_kick(); SNL, SNR = mk_snare(); HAT = mk_hat(); OHAT = mk_hat(True); CRASH = mk_crash()
kick_times = []


def kick(at, gain=0.9):
    drums.add(KICK, at, gain=gain); kick_times.append(at)


def snare(at, gain=0.55):
    drums.add2(SNL, SNR, at, gain=gain)
    hall_send.add((SNL + SNR) * 0.5, at, gain=gain * 0.25)


# =============================================================== the cue
# ---- intro: drone + brass swells (no grid) --------------------------------
n = int(15.5 * SR); tt = np.arange(n) / SR
drone = additive(nf(33) * (1 + 0.002 * np.sin(2 * np.pi * 0.13 * tt)), 180 + 140 * np.sin(2 * np.pi * 0.07 * tt) ** 2, n, detunes=(-0.003, 0.003))
drone += 0.6 * np.sin(2 * np.pi * nf(21) * tt)
music.add(drone * env([(0, 0), (0.4, 0), (3.0, 0.5), (14.5, 0.65), (15.4, 0.0)], tt), 0.0, gain=0.3)

brass(AM9, 0.9, 5.4, 0.36, attack=1.5, peak=2100, sustain_fc=1100)
brass(FMAJ, 5.5, 4.9, 0.34, attack=1.1, peak=2300, sustain_fc=1200)
brass(DM9, 10.0, 3.3, 0.38, attack=0.8, peak=2600, sustain_fc=1500)
brass(EMAJ, 13.0, 2.2, 0.42, attack=0.6, peak=3000, sustain_fc=1800)

# slow "Vangelis-style" lead over the establishing and koi shots (original line)
lead([(2.0, 76, 1.5), (3.5, 74, 0.5), (4.0, 72, 1.0), (5.0, 71, 0.5), (5.5, 69, 2.0),
      (7.5, 72, 0.5), (8.0, 76, 0.75), (8.75, 77, 0.75), (9.5, 76, 0.5), (10.0, 74, 2.5), (12.5, 76, 0.5), (13.0, 71, 2.0)],
     gain=0.22, fc_peak=2800, fc_sus=1500, send=1.0, vib=0.007)

# hologram bells over the koi orbit: Fmaj7 shimmering upward
for k, m in enumerate([77, 81, 84, 88, 84, 89, 93, 88, 96, 91, 89, 84, 81, 88, 93, 100]):
    bell(m, 5.6 + k * 0.27, 0.05 * (1 - k / 22), pan=np.sin(k * 1.7) * 0.7)

# ---- build 11–15: filtered bassline, kicks, snare roll ----------------------
BASS_PAT = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 7, 12]
bass_events = []


def bass_line(t0, t1, fc_curve, gain=0.5):
    k = 0
    while True:
        st = t0 + k * S16
        if st >= t1 - 1e-6:
            break
        _, root = chord_at(st + 1e-3)
        step = int(round((st - GRID0) / S16)) % 16
        m = root + BASS_PAT[step]
        bass_events.append((st, m, gain, fc_curve(st)))
        k += 1


bass_line(11.0, 15.0, lambda s: 220 + 1400 * ((s - 11.0) / 4.0) ** 2, gain=0.42)
bass_line(15.0, 34.25, lambda s: 1500 + 500 * np.sin((s - 15) / 8 * np.pi) ** 2, gain=0.6)
bass_line(39.0, 43.0, lambda s: 2200, gain=0.6)

for (st, m, g, fpk) in bass_events:
    n = int(S16 * 1.05 * SR); tt = np.arange(n) / SR
    fc = 160 + fpk * np.exp(-tt / 0.045)
    v = additive(nf(m), fc, n, detunes=(-0.006, 0.006), res=0.9, phase_seed=int(st * 1000))
    v += 0.3 * np.sin(2 * np.pi * nf(m - 12 if m > 36 else m) * tt)
    music.add(np.tanh(v * 1.4) * adsr(n, a=0.002, d=0.06, s=0.7, r=0.02), st, gain=g)

for q in range(4):                      # four-on-the-floor kicks swell in over the last bar of the build
    st = 13.0 + q * BEAT
    kick(st, gain=0.35 + 0.35 * (st - 13) / 2)
for k in range(16):                     # 16th snare roll 14 → 15, rising
    snare(14.0 + k * S16 / 2, gain=0.12 + 0.3 * k / 15)

# riser + reverse crash into the drop (and again into the finale)
def riser(t_end, dur, gain):
    n = int(dur * SR); tt = np.arange(n) / SR
    nz = rng.standard_normal(n)
    out = np.zeros(n)
    bands = [(300, 900), (700, 1800), (1500, 3500), (3000, 7000), (6000, 14000)]
    for i, (lo, hi) in enumerate(bands):
        c = (i + 0.5) / len(bands)
        w = np.clip(1 - np.abs(tt / dur - c) * 2.2, 0, 1)
        out += spectral(nz, lo, hi) * w
    pitch = 200 * 2 ** (3 * tt / dur)
    out = out / np.abs(out).max() + 0.25 * np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    drums.add(out * (tt / dur) ** 2, t_end - dur, gain=gain)
    rev = CRASH[:int(1.6 * SR)][::-1]
    drums.add(rev, t_end - len(rev) / SR, gain=gain * 0.8)


riser(15.0, 3.0, 0.22)

# ---- drop 15 → 34.25 ---------------------------------------------------------
drums.add(CRASH, 15.0, gain=0.32); hall_send.add(CRASH, 15.0, gain=0.15)
bt = 15.0
while bt < 34.25 - 1e-6:
    beat_i = int(round((bt - GRID0) / BEAT))
    kick(bt)
    if beat_i % 2 == 1:
        snare(bt)
    for s in range(4):                                     # 16th hats, accented off-beat opens
        ht = bt + s * S16
        if ht >= 34.25:
            break
        if s == 2:
            drums.add(OHAT, ht, pan=0.25, gain=0.16)
        else:
            drums.add(HAT, ht, pan=-0.2, gain=0.09 if s % 2 else 0.13)
    bt += BEAT
for at in (18.75, 22.875, 30.75):                          # little ghost-snare fills at phrase ends
    for k in range(3):
        snare(at + k * S16 * 0.5, gain=0.18 + 0.06 * k)

# sidechained pad chords under the groove
for s, e, v, _ in PROG:
    if s < 15.0 or s >= 35.0:
        continue
    du = e - s + 0.4
    n = int(du * SR); tt = np.arange(n) / SR
    pad = np.zeros(n)
    for m in v:
        pad += additive(nf(m) * vibrato(n, 0.25, 0.0015, 0, 0.1), 900, n, detunes=(-0.007, 0.0, 0.007), phase_seed=m) / len(v)
    a = adsr(n, a=0.12, d=0.4, s=0.85, r=0.4)
    music.add(pad * a, s, pan=-0.35, gain=0.36)
    music.add(np.roll(pad, 1931) * a, s, pan=0.35, gain=0.36)
    hall_send.add(pad * a, s, gain=0.2)

# arpeggio pluck over the ramen counter 19 → 23, then under the theme
for k in range(int((34.25 - 19.0) / S16)):
    st = 19.0 + k * S16
    v, _ = chord_at(st + 1e-3)
    m = sorted(v)[[1, 2, 3, 4, 3, 2, 4, 3][k % 8] % len(v)] + 12
    n = int(0.3 * SR); tt = np.arange(n) / SR
    pl = additive(nf(m), 600 + 3800 * np.exp(-tt / 0.03), n, res=0.2, phase_seed=k)
    g = 0.13 if st < 23 else 0.09
    music.add(pl * np.exp(-tt * 11), st, pan=0.55 * np.sin(k * 0.9), gain=g)
    if k % 2 == 0:
        hall_send.add(pl * np.exp(-tt * 11), st, gain=g * 0.6)

# main theme: enters at 23 over Dm (original melody)
THEME = [(23.0, 74, 0.5), (23.5, 77, 0.25), (23.75, 76, 0.25), (24.0, 74, 0.5), (24.5, 69, 0.5),
         (25.0, 72, 0.75), (25.75, 74, 0.25), (26.0, 76, 1.0),
         (27.0, 76, 0.5), (27.5, 71, 0.5), (28.0, 76, 0.5), (28.5, 74, 0.25), (28.75, 72, 0.25),
         (29.0, 71, 0.5), (29.5, 68, 1.5),
         (31.0, 69, 0.5), (31.5, 72, 0.25), (31.75, 76, 0.25), (32.0, 81, 1.0),
         (33.0, 79, 0.25), (33.25, 77, 0.25), (33.5, 76, 0.75)]
lead(THEME, gain=0.3, send=0.7)

# ---- maglev 35 → 39: sub drop, brass, riser, snare roll ---------------------
n = int(3.8 * SR); tt = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(30 + 32 * np.exp(-tt * 1.6)) / SR) * np.exp(-tt * 0.9)
music.add(np.tanh(boom * 2.0) * 0.8, 35.0, gain=0.75)
drums.add(CRASH, 35.0, gain=0.12)
brass([41, 48, 53, 57, 60], 35.0, 2.2, 0.32, attack=0.9, peak=1600, sustain_fc=900)
brass(EMAJ, 37.0, 2.15, 0.42, attack=1.2, peak=3200, sustain_fc=2000)
riser(39.0, 2.0, 0.26)
ROLL = [37.5 + k * BEAT / 2 for k in range(2)] + [38.0 + k * S16 for k in range(4)] + [38.5 + k * S16 / 2 for k in range(8)]
for k, st in enumerate(ROLL):            # 8ths → 16ths → 32nds into the finale
    snare(st, gain=0.1 + 0.4 * k / (len(ROLL) - 1))

# ---- finale 39 → 45 ----------------------------------------------------------
drums.add(CRASH, 39.0, gain=0.38); hall_send.add(CRASH, 39.0, gain=0.2)
bt = 39.0
while bt < 43.0 - 1e-6:
    beat_i = int(round((bt - GRID0) / BEAT))
    kick(bt)
    if beat_i % 2 == 1:
        snare(bt, gain=0.6)
    for s in range(4):
        drums.add(OHAT if s == 2 else HAT, bt + s * S16, pan=0.2 if s == 2 else -0.2, gain=0.15 if s == 2 else 0.1)
    bt += BEAT
kick(43.0, 1.0); drums.add(CRASH, 43.0, gain=0.42); hall_send.add(CRASH, 43.0, gain=0.3)
brass(AM9, 39.0, 2.3, 0.5, attack=0.25, peak=3400, sustain_fc=2000, scoop=0.05)
brass(FMAJ, 41.0, 2.3, 0.5, attack=0.25, peak=3400, sustain_fc=2000, scoop=0.05)
brass(AFIN, 43.0, 2.4, 0.6, attack=0.18, peak=3800, sustain_fc=2200, scoop=0.05)
lead([(39.0, 81, 1.0), (40.0, 79, 0.25), (40.25, 76, 0.25), (40.5, 76, 0.5),
      (41.0, 77, 0.5), (41.5, 76, 0.25), (41.75, 74, 0.25), (42.0, 72, 0.5), (42.5, 71, 0.5),
      (43.0, 69, 2.0)], gain=0.32, send=1.0)
n = int(2.4 * SR); tt = np.arange(n) / SR
music.add(np.sin(2 * np.pi * nf(33) * tt) * adsr(n, 0.01, 0.3, 0.8, 1.6) + 0.5 * np.sin(2 * np.pi * nf(21) * tt) * adsr(n, 0.01, 0.3, 0.8, 1.6), 43.0, gain=0.45)

# ---- sidechain: synths pump under each kick ---------------------------------
duck = np.ones(N)
for kt in kick_times:
    i0 = int(kt * SR); m = min(int(0.3 * SR), N - i0)
    if m > 0:
        tt = np.arange(m) / SR
        duck[i0:i0 + m] = np.minimum(duck[i0:i0 + m], 1 - 0.4 * np.exp(-tt / 0.09))
music.mul(duck)
synth = Bus(); synth.L, synth.R = music.L.copy(), music.R.copy()
drums.mix_into(music)

# ---- hall reverb ----------------------------------------------------------------
HALL = make_ir(4.5, 3.6, 1.2, pre=0.035, seed=3)
wet = reverb(hall_send, HALL)
wet.mul(env([(0, 0.5), (14, 0.5), (15, 0.38), (34.9, 0.38), (35.2, 0.42), (38.8, 0.4), (39, 0.3), (42.8, 0.3), (43.4, 0.45), (45, 0.45)]))
wet.mix_into(music)


# ---- glitch 34.25 → 35: beat-repeat + bit-crush on the whole music bus ------
def stutter(t0, t1, src_t, slice_len):
    a, p1 = int(src_t * SR), int(t1 * SR)
    for ch in (music.L, music.R):
        seg = ch[a:a + int(slice_len * SR)].copy()
        p, k = int(t0 * SR), 0
        while p < p1:
            ln = len(seg) if k < 4 else len(seg) // 2          # 16ths, then 32nds
            sl = seg[:ln] * np.hanning(ln * 2)[ln:] ** 0.2
            m = min(ln, p1 - p)
            ch[p:p + m] = sl[:m]
            p += ln; k += 1


stutter(34.25, 35.0, 33.5, S16)
i0, i1 = int(34.25 * SR), int(35.0 * SR)
music.L[i0:i1] *= 0.6; music.R[i0:i1] *= 0.6
crush = np.linspace(0, 1, i1 - i0)
for ch in (music.L, music.R):
    seg = ch[i0:i1]
    q = np.round(np.repeat(seg[::12], 12)[:len(seg)] * 24) / 24   # sample-and-hold + 5-bit-ish quantise
    ch[i0:i1] = seg * (1 - crush) + q * crush

# =============================================================== sound design
rain_lvl = env([(0, 0.0), (0.6, 0.6), (5.5, 0.55), (5.6, 0.35), (10, 0.35), (10.1, 0.45), (15, 0.4), (15.1, 0.55),
                (20, 0.5), (20.1, 0.35), (24, 0.35), (24.1, 0.5), (27.5, 0.5), (27.6, 0.5), (31.5, 0.4), (35, 0.45),
                (39, 0.4), (42, 0.35), (45, 0.0)])
for buf in (fx.L, fx.R):
    nz = spectral(rng.standard_normal(N), lo=350, hi=9000, tilt=-1.5)
    n2 = spectral(rng.standard_normal(N), lo=90, hi=900, tilt=-3)
    nz = nz / np.abs(nz).max() * 0.18 + n2 / np.abs(n2).max() * 0.07
    buf += nz * rain_lvl
drops = np.zeros(N)
for k in rng.integers(0, N - 4000, 2600):
    f = rng.uniform(1400, 5200); n = int(rng.uniform(0.004, 0.02) * SR)
    tt = np.arange(n) / SR
    drops[k:k + n] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * rng.uniform(250, 600)) * rng.uniform(0.02, 0.09)
dl = drops * rain_lvl
fx.add(dl, pan=-0.4, gain=0.7); fx.add(np.roll(dl, 1777), pan=0.4, gain=0.7)


def noise_burst(du, lo, hi, a=0.05, r=0.5, tilt=0.0):
    n = int(du * SR)
    return spectral(rng.standard_normal(n), lo, hi, tilt) * adsr(n, a=a, d=0.1, s=1.0, r=r)


th = noise_burst(4.5, 25, 260, a=0.3, r=3.2, tilt=-3); fx.add(th / np.abs(th).max(), 0.2, gain=0.22)            # thunder
wind = noise_burst(5.2, 180, 1400, a=1.5, r=1.8, tilt=-2); fx.add(wind / np.abs(wind).max(), 10.0, pan=-0.2, gain=0.06)
tr = noise_burst(3.0, 30, 400, a=1.0, r=1.3, tilt=-2); fx.add(tr / np.abs(tr).max(), 16.0, pan=0.2, gain=0.12)  # distant train
for f, d in ((1046.5, 0.0), (1318.5, 0.18)):                                                                   # door chime
    n = int(1.8 * SR); tt = np.arange(n) / SR
    fx.add(np.sin(2 * np.pi * f * tt) * np.exp(-tt * 3), 20.9 + d, pan=0.4, gain=0.045)
n = int(3.6 * SR); tt = np.arange(n) / SR                                                                       # hover-car fans
hum = sum(np.sin(2 * np.pi * h * 61 * (1 + 0.004 * np.sin(2 * np.pi * 0.7 * tt)) * tt) / h for h in (1, 2, 3, 5))
hum = hum * adsr(n, a=0.5, d=0.2, s=1, r=0.6) + noise_burst(3.6, 300, 2500, a=0.5, r=0.6) * 0.3
fx.add(hum / np.abs(hum).max(), 24.0, gain=0.05)
for k in range(26):                                                                                             # alley drips
    n = int(0.25 * SR); tt = np.arange(n) / SR
    f = rng.uniform(700, 1500)
    fx.add(np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-tt * 40)) * tt) * np.exp(-tt * 28), 27.6 + rng.uniform(0, 3.8), pan=rng.uniform(-0.7, 0.7), gain=0.05)
g = noise_burst(0.75, 300, 12000, a=0.002, r=0.1)                                                               # screen glitch
q = np.round(g * 6) / 6 * (np.sin(2 * np.pi * 37 * np.arange(len(g)) / SR) > 0)
for k in range(5):
    n = int(0.06 * SR); tt = np.arange(n) / SR
    q[int(k * 0.13 * SR):int(k * 0.13 * SR) + n] += np.sign(np.sin(2 * np.pi * rng.uniform(600, 2400) * tt)) * 0.6
fx.add(q / np.abs(q).max(), 34.25, gain=0.06)
n = int(3.4 * SR); tt = np.arange(n) / SR                                                                       # maglev pass-by
pk = 2.1
dop = 1 + 0.25 * np.tanh((pk - tt) * 2.5)
car = spectral(rng.standard_normal(n), 120, 6000, tilt=-1)
whine = np.sin(2 * np.pi * np.cumsum(720 * dop) / SR) * 0.3
amp = np.exp(-((tt - pk) / 0.55) ** 2) + 0.15 * np.exp(-((tt - pk) / 1.4) ** 2)
mag = (car / np.abs(car).max() + whine) * amp
pan = np.tanh((tt - pk) * 1.8)
i0 = int(35.2 * SR); m = min(n, N - i0)
fx.L[i0:i0 + m] += mag[:m] * 0.4 * np.cos((pan[:m] + 1) * np.pi / 4)
fx.R[i0:i0 + m] += mag[:m] * 0.4 * np.sin((pan[:m] + 1) * np.pi / 4)
rum = noise_burst(3.4, 25, 160, a=0.8, r=1.0); fx.add(rum / np.abs(rum).max() * amp, 35.2, gain=0.3)

# =============================================================== master
import os
if os.environ.get('STEMS'):   # loudness of each bus per section (for mixing by numbers)
    secs = [0, 5.5, 10, 15, 20, 24, 27.5, 31.5, 34.25, 35, 39, 43, 45]
    for name, b in (('synth', synth), ('drums', drums), ('hall', wet), ('music', music), ('fx x4', Bus.scaled(fx, 4.0))):
        row = []
        for a, c in zip(secs, secs[1:]):
            seg = np.concatenate([b.L[int(a * SR):int(c * SR)], b.R[int(a * SR):int(c * SR)]])
            row.append(f'{20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9):6.1f}')
        print(f'{name:6s}', ' '.join(row))
FX_GAIN = 4.0   # +12 dB: rain ≈ 10 dB under the intro score, the maglev pass level with the music
F = np.fft.rfftfreq(N, 1 / SR)
EQ = 1 / np.sqrt(1 + (30 / np.maximum(F, 1)) ** 4)                       # rumble high-pass at 30 Hz
EQ *= 1 - 0.37 / (1 + (F / 70) ** 2)                                      # −4 dB low shelf under ~70 Hz
EQ *= 1 + 0.33 * np.exp(-(np.log2(np.maximum(F, 1) / 3000) / 1.2) ** 2)   # +2.5 dB presence around 3 kHz
FADE = env([(0, 0), (0.25, 1), (43.6, 1), (45, 0)])


def master(st, norm):
    st = np.stack([np.fft.irfft(np.fft.rfft(ch) * EQ, N) for ch in st * norm]) * FADE
    return np.tanh(st * 1.2) / 1.2                                         # soft limiter on transients


def write(path, st):
    pcm = (np.clip(st, -1, 1).T * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


fx_st = np.stack([fx.L, fx.R]) * FX_GAIN
full = np.stack([music.L, music.R]) + fx_st
norm = 10 ** (-10.5 / 20) / np.sqrt((full[:, int(15 * SR):int(34 * SR)] ** 2).mean())   # groove at −10.5 dBFS RMS
mix = master(full, norm)
peak = max(1.0, np.abs(mix).max() / 0.92)
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
write(out, mix / peak)
# rain + sound-effects stem at the same level, for laying your own music over the picture
write(out[:-4] + '_fx.wav' if out.endswith('.wav') else out + '_fx.wav', master(fx_st, norm) / peak)
print('wrote', N / SR, 's →', out, '(+ _fx stem)')
