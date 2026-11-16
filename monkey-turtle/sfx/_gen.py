# _gen.py: renders the Monkey and the Turtle's own sounds (numpy only, free, local) into this folder as .m4a, on tools/sfx/synth3.py's helpers.
# Run from anywhere: python3 _gen.py   (not served; the page never asks for it). Beds are mixes of kapi's beds, looped to one length.
import os, subprocess, sys, numpy as np
D = os.path.dirname(os.path.abspath(__file__)); K = os.path.join(D, "..", "..", "kapi", "sfx"); sys.path.insert(0, os.path.join(D, "..", "..", "..", "tools", "sfx"))
from synth3 import *  # helpers: lp hp bp nz env mix S wood plip whoosh rg uni finish active_rms_db TARGET
def enc(x, out, g=1.0, tgt=TARGET):
    for _ in range(4):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", "22050", "-ac", "1", "-i", "-", "-c:a", "aac", "-b:a", "32k", out], input=(x * g).astype(np.float32).tobytes(), check=True)
        y = dec(out); d = tgt - active_rms_db(y)
        if abs(d) < .3: break
        g *= 10 ** (d / 20)
def dec(f): return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "22050", "-f", "f32le", "-"], capture_output=True).stdout, np.float32).astype(float)
def chop(r, i): f = [230, 255, 280][i % 3] * uni(r, .97, 1.03); return S(wood(r, f, .07), bp(nz(r, 900), 200, 900) * env(900, .002, .02) * .8)  # dull wood-and-fibre thump
def dig(r, i):  # soft earth: two scrapes and a low thud
    n = int(.22 * SR); sc = lambda: bp(nz(r, n), 250, 1400) * env(n, .03, .07) * (1 + .5 * np.sin(np.arange(n) / SR * 60))
    return mix((sc(), 0), (sc() * .8, .27), (lp(nz(r, 1500), 300) * env(1500, .004, .03) * .9, .2))
def peel(r, i):  # a wet flop and a small slide down
    t = T(.5); f = 330 * np.exp(-t / .12) + 110; sl = np.sin(TAU * np.cumsum(f) / SR) * np.minimum(t / .004, 1) * np.exp(-t / .09) * .8
    return S(sl, lp(nz(r, len(t)), 900) * env(len(t), .003, .05) * .7)
def snore(r, i):  # soft funny: a rising rasp in, a puffing breath out, a small snort
    d = 1.5; n = int(d * SR); t = T(d); inh = bp(nz(r, n), 120, 600) * (np.sin(TAU * 38 * t) * .5 + .5) * np.sin(np.pi * np.clip(t / .6, 0, 1)) * (t < .6)
    exh = bp(nz(r, n), 150, 900) * (np.sin(TAU * 22 * t) * .4 + .6) * np.sin(np.pi * np.clip((t - .7) / .6, 0, 1)) * ((t > .7) & (t < 1.3)) * .8
    return inh * (1 + .15 * i) + exh
def ouch(r, i):  # a small rubber squeak, no voice
    d = .2; t = T(d); f = np.interp(t, [0, .35 * d, d], [uni(r, 800, 950), uni(r, 1300, 1500), uni(r, 800, 950)]) * (1 + .03 * np.sin(TAU * 24 * t))
    return np.sin(TAU * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** .8 * .8
def sizzle(r, i):  # soft crackle, fades in and out
    d = 1.0; n = int(d * SR); x = np.zeros(n)
    for p in r.uniform(0, d, 70): k = int(p * SR); m = min(300, n - k); x[k:k + m] += r.uniform(.3, 1) * bp(nz(r, m), 1200, 3500) * env(m, .001, .006)
    return x * np.sin(np.pi * np.arange(n) / n) ** .8
def bubbles(r, i): return mix(*[(plip(r, uni(r, 300, 700) * (1 + .12 * k), uni(r, .03, .05), uni(r, 1.6, 2.4)) * uni(r, .5, 1), .11 * k + uni(r, 0, .04)) for k in range(7)])
def splash(r, i):
    n = int(1.2 * SR); body = bp(nz(r, n), 180, uni(r, 1400, 1900)) * env(n, .008, .22); th = np.sin(TAU * 230 * T(.5)) * env(int(.5 * SR), .004, .1)
    return mix((body, 0), (th * .8, 0), *[(plip(r, uni(r, 300, 800), .05, 1.8) * uni(r, .15, .4), uni(r, .08, .7)) for _ in range(7)])
def fold(r, i): n = int(.14 * SR); return mix((bp(nz(r, n), 1800, 3400) * env(n, .015, .035), 0), (bp(nz(r, n), 1500, 3000) * env(n, .02, .04) * .6, .07))
def creak(r, i):  # bamboo leaning: a slow low squeak
    d = .75; t = T(d); f = np.interp(t, [0, .5 * d, d], [uni(r, 170, 190), uni(r, 240, 270), uni(r, 190, 210)]); ph = TAU * np.cumsum(f) / SR
    return (np.sin(ph) + .5 * np.sin(2 * ph) + .3 * np.sin(3 * ph)) * (.6 + .4 * np.sin(TAU * 17 * t)) * np.sin(np.pi * t / d) ** 1.2
def rumble(r, i):  # a tummy rumble: a low gurgle in two swells with a small wet burble, no voice
    d = 1.4; n = int(d * SR); t = T(d); sw = np.sin(np.pi * np.clip(t / .6, 0, 1)) * (t < .6) + .8 * np.sin(np.pi * np.clip((t - .65) / .7, 0, 1)) * (t > .65)
    f = 95 * np.exp(-t / 1.6) * uni(r, .9, 1.1) + 55; tone = np.sin(TAU * np.cumsum(f) / SR) * (.55 + .45 * np.sin(TAU * 11 * t))
    return (lp(nz(r, n), 260) * 1.2 + tone) * sw + bp(nz(r, n), 300, 700) * (.5 + .5 * np.sin(TAU * 17 * t)) * sw * .25
SHOTS = {"mt-rumble": (rumble, 3), "mt-chop": (chop, 3), "mt-dig": (dig, 3), "mt-peel-flop": (peel, 3), "mt-snore": (snore, 3), "mt-ouch": (ouch, 3), "mt-sizzle": (sizzle, 3),
         "bubbles-pop": (bubbles, 3), "mt-splash-big": (splash, 3), "mt-fold": (fold, 3), "mt-creak": (creak, 3)}
def rain_bed(L=16):  # FFT filters are circular, so the loop has no seam; drips are rolled round the end
    r = rg("rain", 0); n = int(L * SR); x = bp(nz(r, n), 1500, 3800) * .5 + lp(nz(r, n), 500) * .25; d = np.zeros(n)
    for p in r.uniform(0, L, 40): k = int(p * SR); p_ = plip(r, uni(r, 500, 1000), .03, 1.8) * uni(r, .1, .35); d += np.roll(np.pad(p_, (0, n - len(p_))), k)
    return x + d
def bed(parts, L=30.5, extra=None):  # parts: (kapi file, gain). Everything is looped to L seconds and the mix levelled to the loudest source
    n = int(L * SR); out = np.zeros(n); lv = []
    for f, g in parts:
        a = dec(os.path.join(K, f + ".m4a")); lv.append(np.sqrt(np.mean(a ** 2))); out += g * np.resize(a, n)
    for a, at in extra or []: out += np.roll(np.pad(a, (0, max(0, n - len(a))))[:n], int(at * SR))
    return out * max(lv) / np.sqrt(np.mean(out ** 2))
def far_carabao(): a = dec(os.path.join(K, "buffalo-moo-2.m4a")); return lp(a, 650) * .35
if __name__ == "__main__":
    for name, (fn, c) in SHOTS.items():
        for i in range(c):
            x = finish(fn(rg(name, i), i)); x = x * 10 ** ((TARGET - active_rms_db(x)) / 20); enc(x * min(1, .5 / np.abs(x).max()), os.path.join(D, name + ("" if i == 0 else f"-{i + 1}") + ".m4a"))
    x = rain_bed(); enc(x, os.path.join(D, "rain-light.m4a"), 1.0, -26.0)
    for name, parts, ex, tg in [("mt-bed-riverbank-noon", [("river-slow", 1), ("insects-day", .7), ("birds-day", .45)], [(far_carabao(), 12)], -23.0),
                            ("mt-bed-patch-morning", [("birds-morning", 1), ("leaves-breeze", .7), ("birds-far", .4)], None, -26.0),
                            ("mt-bed-garden-night", [("crickets", 1), ("night-frogs", .7), ("night-breeze", .55)], None, -29.0)]:
        enc(bed(parts, extra=ex), os.path.join(D, name + ".m4a"), 1.0, tg)
