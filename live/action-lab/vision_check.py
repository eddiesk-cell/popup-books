"""Ask a free local vision model (ollama on the desk, /api/chat, think off) whether each slice's motion looks natural and fluid, not stiff.
A model sees stills, not motion, so each question gets a motion strip: 12 frames 1/15 s apart across the slice's main action, in order.
Blind: the old and the new strip of a slice are asked separately and in shuffled order, named only A and B.

  python3 web/live/action-lab/vision_check.py <model> <round> [slice ...]     writes renders/review/action-slices-v2/vision/<round>-<model>.json
  OLLAMA=http://127.0.0.1:11435 ... (another machine's ollama through an ssh tunnel). A second question shows both strips, one over the other, and asks which moves better.
"""
import sys, os, json, base64, subprocess, urllib.request, random, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OLD, NEW, OUT = f"{ROOT}/renders/review/action-slices", f"{ROOT}/renders/review/action-slices-v2", f"{ROOT}/renders/review/action-slices-v2/vision"
ACTION = {"hit": 1.2, "wall": 1.4, "clash": 0.7, "split": 2.95}  # where each slice's main action starts (s)
Q = ("These 12 frames are consecutive moments, 1/15 second apart, from one animated fight clip, left to right then top to bottom. "
     "Judge only how the two characters MOVE across the frames, as a film animator would. Does the motion look natural and fluid, or stiff "
     "(rigid bodies sliding, limbs frozen, poses snapping, a weapon floating, feet sliding)? Answer in this exact form:\n"
     "SCORE: <1-10, 10 = fully natural and fluid>\nSTIFF: <the single stiffest thing you see, or none>\nNATURAL: <the most natural thing you see>")


def strip(mp4, t0, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t0), "-i", mp4, "-vf", "fps=15,scale=480:-2,tile=6x2", "-frames:v", "1", "-q:v", "3", out], check=True)
    return out


Q2 = ("Two strips of 12 consecutive frames each, 1/15 second apart: strip A on top, strip B below, the same fight beat animated twice. Which one MOVES more "
      "naturally and fluidly, like real animation, and which is stiffer? Answer in this exact form:\nBETTER: <A or B>\nWHY: <one sentence>")
URL = os.environ.get("OLLAMA", "http://127.0.0.1:11434")


def ask(model, img, q=Q):
    body = {"model": model, "stream": False, "think": False, "keep_alive": "2m", "options": {"temperature": 0, "seed": 7},
            "messages": [{"role": "user", "content": q, "images": [base64.b64encode(open(img, "rb").read()).decode()]}]}
    r = urllib.request.urlopen(urllib.request.Request(f"{URL}/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=900)
    return json.load(r)["message"]["content"].strip()


model, rnd = sys.argv[1], sys.argv[2]; slices = sys.argv[3:] or list(ACTION); os.makedirs(OUT, exist_ok=True); random.seed(rnd); res = {}
for sl in slices:
    pair = [("old", f"{OLD}/{sl}-wide.mp4"), ("new", f"{NEW}/{sl}-wide.mp4")]; random.shuffle(pair); res[sl] = {}
    for label, (which, mp4) in zip("AB", pair):
        img = strip(mp4, ACTION[sl], f"{OUT}/strip-{rnd}-{sl}-{which}.jpg"); a = ask(model, img); m = re.search(r"SCORE:\s*(\d+)", a)
        res[sl][which] = {"asked_as": label, "score": int(m.group(1)) if m else None, "answer": a}
        print(sl, which, "as", label, "->", res[sl][which]["score"], "|", a.replace("\n", " | ")[:300], flush=True)
    both = f"{OUT}/pair-{rnd}-{sl}.jpg"; subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/strip-{rnd}-{sl}-{pair[0][0]}.jpg", "-i", f"{OUT}/strip-{rnd}-{sl}-{pair[1][0]}.jpg", "-filter_complex", "vstack=2", both], check=True)
    a = ask(model, both, Q2); m = re.search(r"BETTER:\s*([AB])", a); pick = {"A": pair[0][0], "B": pair[1][0]}.get(m.group(1)) if m else None
    res[sl]["better"] = {"pick": pick, "answer": a}; print(sl, "better ->", pick, "|", a.replace("\n", " | ")[:300], flush=True)
tmp = f"{OUT}/{rnd}-{model.replace(':', '_')}.json"; json.dump(res, open(tmp + ".tmp", "w"), indent=1); os.replace(tmp + ".tmp", tmp)
subprocess.run(["curl", "-s", f"{URL}/api/generate", "-d", json.dumps({"model": model, "keep_alive": 0})], capture_output=True)  # unload: the model leaves the desk's memory
