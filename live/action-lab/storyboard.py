"""Strips for the review: per slice, one frame per shot (its name, so the angles can be counted) with the freeze frames marked in gold, and one frame
per speed technique (its name and film time); v4: each insert at its start and end, and one frame per tell (info.tells). From the recorded <slice>-wide.mp4 and the slice's own shot and freeze list (lab.info).
  python3 web/live/action-lab/storyboard.py <dir> <info.jsonl>     writes <dir>/shots-<slice>.jpg and <dir>/techniques-<slice>.jpg"""
import sys, json, subprocess, io
from PIL import Image, ImageDraw, ImageFont
D, info = sys.argv[1], [json.loads(l) for l in open(sys.argv[2])]
F = 1 / 60; font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 22)
# the moments each technique fires, in slice time (sV, sR and the rest are the slices' own numbers)
TECH = {"hit": [(1.3, "still beat"), (1.62 + 2 * F, "flash step: ink puff"), (1.72, "after-images, speed streaks"), (1.85 - F, "reappears mid-strike, staff smear"), (1.85 + F, "impact frame"), (1.917, "freeze 0.45 s")],
        "wall": [(1.0, "still: his face"), (1.62, "charge after-images"), (1.75 + F, "impact frame"), (2.1, "multiples on the flight"), (2.267 + 2 * F, "wall: spikes, ring, cracks"), (2.334, "freeze 0.45 s")],
        "clash": [(1.55 + F, "block: glare, ring, 5f stop"), (1.72, "both pushed back"), (2.5, "still hover (the quiet)"), (3.72 - F, "staff smear"), (3.72 + F, "inverted impact frame + glare"), (3.787, "freeze 0.5 s")],
        "split": [(0.5, "still standoff"), (2.9 + 0.25, "charge, over the shoulder"), (3.28 + 2 * F, "vanish: ink puff"), (3.45, "after-images round him"), (3.6 - F, "behind him, mid-strike"), (3.667, "freeze 0.4 s"), (4.9, "he turns too late")]}
film = lambda t, fz: t + sum(l for s, l in fz if s < t - 1e-6)
def frame(sl, T):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{T:.4f}", "-i", f"{D}/{sl}-wide.mp4", "-frames:v", "1", "-vf", "scale=480:-2", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGB")
def strip(tiles, out):
    W, H = 480, 270; im = Image.new("RGB", (W * min(4, len(tiles)), (H + 34) * ((len(tiles) + 3) // 4)), (26, 19, 12)); d = ImageDraw.Draw(im)
    for k, (img, label, gold) in enumerate(tiles):
        x, y = (k % 4) * W, (k // 4) * (H + 34); im.paste(img, (x, y))
        if gold: d.rectangle([x + 2, y + 2, x + W - 3, y + H - 3], outline=(240, 181, 69), width=6)
        d.text((x + 8, y + H + 5), label, font=font, fill=(240, 181, 69) if gold else (245, 233, 204))
    im.save(out, quality=85); print(out)
for I in info:
    sl, fz, shots = I["slice"], I["freezes"], I["shots"]; ends = [s for s, _ in shots[1:]] + [99]
    tiles = [(frame(sl, film((s + min(e, s + 1.2)) / 2, fz)), f"{n}  ({film(s, fz):.2f} s)", False) for (s, n), e in zip(shots, ends)]
    tiles += [(frame(sl, s + l * 0.5), f"FREEZE {l:.2f} s at {s:.2f} s", True) for s, l in fz]
    strip(tiles, f"{D}/shots-{sl}.jpg")
    if sl in TECH and not I.get("v4"): strip([(frame(sl, film(t, fz) if "freeze" not in n else t + 0.2), f"{n}  ({film(t, fz):.2f} s)", "freeze" in n) for t, n in TECH[sl]], f"{D}/techniques-{sl}.jpg")
    ins = [(s, e, n) for (s, n), e in zip(shots, ends) if n.startswith("insert")]  # each insert twice: as it starts and as it ends, so the small action is seen to happen
    if ins: strip([(frame(sl, film(x, fz)), f"{n[8:]}  {lab} ({film(x, fz):.2f} s)", False) for s, e, n in ins for x, lab in ((s + 0.06, "start"), (e - 0.06, "end"))], f"{D}/inserts-{sl}.jpg")
    if I.get("tells"): strip([(frame(sl, film(t, fz) + 0.1), f"{film(t, fz):.2f} s {w}: {x[:34]}", False) for t, w, x in I["tells"]], f"{D}/tells-{sl}.jpg")
