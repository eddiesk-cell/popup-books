"""The reference copy's comparisons (renders/review/action-ref-copy): the reference left and ours right, synced, on a 16:9 canvas
(side-by-side.mp4, ours' sound); and one pair per key frame of the reference's shots (pairs/NN.jpg, ref | ours, unlabelled for the blind
critic) plus a labelled sheet of them all (shots-pairs.jpg). Labels are drawn with PIL (this ffmpeg has no drawtext).
  python3 web/live/action-lab/refcopy.py"""
import os, subprocess, io
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
D, REF = f"{ROOT}/renders/review/action-ref-copy", f"{ROOT}/assets/action-ref/fight-ref-1-small.mp4"
OURS = f"{D}/ref-wide.mp4"
# (ref frame at 24 fps, what the reference shows there); our frame is the same moment of the film
KEYS = [(37, "1 wide: the staff flourish"), (61, "2 push-in: the lunge"), (77, "3 face: medium close-up"), (85, "3 face: eyes and ring"), (93, "4 snap: the fists swing"),
        (95, "5 snap: the roar"), (113, "6 the staff on his guard"), (121, "6 the first white burst"), (140, "6 the lock"), (153, "6 the second white burst"),
        (167, "6 the spring at the camera"), (173, "7 the grin and the grip"), (191, "7 the bull lands"), (203, "7 the foot crash"), (215, "7 the spring away"), (235, "7 the dive")]
font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 26)
def ours(t):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t + 1 / 120:.4f}", "-i", OURS, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGB")
def label(text, w=330):
    im = Image.new("RGBA", (w, 44), (20, 12, 6, 180)); ImageDraw.Draw(im).text((12, 7), text, font=font, fill=(245, 233, 204, 255)); return im
os.makedirs(f"{D}/pairs", exist_ok=True)
W, H = 800, 450; sheet = Image.new("RGB", (2 * W, len(KEYS) * (H + 40)), (20, 12, 6)); d = ImageDraw.Draw(sheet)
for k, (n, name) in enumerate(KEYS):
    t = (n - 1) / 24; a = Image.open(f"{D}/ref-frames/f{n:03d}.jpg").convert("RGB").resize((W, H)); b = ours(t).resize((W, H))
    pair = Image.new("RGB", (2 * W + 16, H), (255, 255, 255)); pair.paste(a, (0, 0)); pair.paste(b, (W + 16, 0)); tmp = f"{D}/pairs/{k + 1:02d}.tmp.jpg"; pair.save(tmp, "JPEG", quality=88); os.replace(tmp, f"{D}/pairs/{k + 1:02d}.jpg")
    y = k * (H + 40); sheet.paste(a, (0, y + 40)); sheet.paste(b, (W, y + 40)); d.text((10, y + 6), f"{k + 1:02d}  {name}   reference f{n} ({t:.2f} s)  |  ours at {t:.2f} s", font=font, fill=(240, 181, 69))
tmp = f"{D}/shots-pairs.tmp.jpg"; sheet.save(tmp, "JPEG", quality=82); os.replace(tmp, f"{D}/shots-pairs.jpg"); print(f"{D}/shots-pairs.jpg", len(KEYS))
# the synced side-by-side: both scaled to 960x540, side by side, centred on a 1920x1080 canvas, a label over each
for name, img in (("L", label("REFERENCE (Higgsfield)")), ("R", label("OURS: the copy", 260))): img.save(f"{D}/label-{name}.png")
fc = ("[0:v]fps=60,scale=960:540,setsar=1[a];[1:v]scale=960:540,setsar=1[b];[a][b]hstack=2[h];[h]pad=1920:1080:0:270:color=0x140c06[p];"
      "[p][2:v]overlay=14:210[p1];[p1][3:v]overlay=974:210[v]")
out = f"{D}/side-by-side.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", REF, "-i", OURS, "-i", f"{D}/label-L.png", "-i", f"{D}/label-R.png", "-filter_complex", fc, "-map", "[v]", "-map", "1:a?",
                "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", "10.04", "-movflags", "+faststart", out], check=True)
for name in "LR": os.replace(f"{D}/label-{name}.png", os.path.expanduser(f"~/.Trash/refcopy-label-{name}-{os.getpid()}.png"))  # the labels to the Trash once drawn in
print(out, os.path.getsize(out))
