"""One version against the next, side by side, for each slice and format: <new>/compare-<slice>-<fmt>.mp4 (left: the old one, right: the new one,
the shorter held on its last frame; the sound is the new one's). Labels are drawn with PIL (this ffmpeg has no drawtext).
  python3 web/live/action-lab/compare.py [old dir] [new dir] [old label] [new label]     (default: action-slices, action-slices-v2, BEFORE, AFTER)"""
import os, sys, subprocess
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
a = sys.argv[1:] + [None] * 4
OLD, NEW = (f"{ROOT}/renders/review/{d}" for d in (a[0] or "action-slices", a[1] or "action-slices-v2")); LABELS = (a[2] or "BEFORE", a[3] or "AFTER")
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 30)
for name in LABELS:
    im = Image.new("RGBA", (190, 50), (20, 12, 6, 170)); ImageDraw.Draw(im).text((14, 8), name, font=font, fill=(245, 233, 204, 255)); im.save(f"{NEW}/label-{name}.png")
dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)
for sl in ("hit", "wall", "clash", "split"):
    for fmt, (w, h) in (("wide", (960, 540)), ("tall", (540, 960))):
        o, n, out = f"{OLD}/{sl}-{fmt}.mp4", f"{NEW}/{sl}-{fmt}.mp4", f"{NEW}/compare-{sl}-{fmt}.mp4"; L = max(dur(o), dur(n))
        fc = (f"[0:v]scale={w}:{h},tpad=stop_mode=clone:stop_duration={L}[a];[1:v]scale={w}:{h},tpad=stop_mode=clone:stop_duration={L}[b];[a][2:v]overlay=12:12[a2];[b][3:v]overlay=12:12[b2];[a2][b2]hstack=2[v]")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", o, "-i", n, "-i", f"{NEW}/label-{LABELS[0]}.png", "-i", f"{NEW}/label-{LABELS[1]}.png",
                        "-filter_complex", fc, "-map", "[v]", "-map", "1:a?", "-c:v", "libx264", "-crf", "22", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", str(L), "-movflags", "+faststart", out], check=True)
        print(out, os.path.getsize(out))
for name in LABELS: os.replace(f"{NEW}/label-{name}.png", os.path.expanduser(f"~/.Trash/label-{name}-{os.getpid()}.png"))  # the labels to the Trash once drawn in
