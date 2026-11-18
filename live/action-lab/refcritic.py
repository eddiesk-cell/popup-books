"""The blind critic for the reference copy: a free local vision model (ollama /api/chat, think off) sees only each pair image from refcopy.py
(left: the original frame, right: an attempt to copy it) and scores how closely the right copies the left, 1-10, saying what differs.
  python3 web/live/action-lab/refcritic.py [model]     (default gemma4:12b-it-qat; writes renders/review/action-ref-copy/critic-<model>.json)"""
import sys, os, json, base64, re, glob, urllib.request
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
D = f"{ROOT}/renders/review/action-ref-copy"; model = sys.argv[1] if len(sys.argv) > 1 else "gemma4:12b-it-qat"; URL = os.environ.get("OLLAMA", "http://127.0.0.1:11434")
Q = ("Two frames side by side. LEFT is the original frame of an animated film. RIGHT is an attempt to copy that same frame with different 3D models "
     "and a different painting style. Ignore the drawing style and the characters' designs. Judge only how closely RIGHT copies LEFT in: camera angle and "
     "framing; where each character is and how big; their poses; the effects (bursts, rings, dust, lines) and where they are. Answer in this exact form:\n"
     "SCORE: <1-10, 10 = the same shot>\nDIFFERS: <the two biggest differences, one sentence>")
def ask(img):
    body = {"model": model, "stream": False, "think": False, "keep_alive": "5m", "options": {"temperature": 0, "seed": 7},
            "messages": [{"role": "user", "content": Q, "images": [base64.b64encode(open(img, "rb").read()).decode()]}]}
    return json.load(urllib.request.urlopen(urllib.request.Request(f"{URL}/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"}), timeout=900))["message"]["content"].strip()
res = {}
try:
    for p in sorted(glob.glob(f"{D}/pairs/[0-9][0-9].jpg")):
        a = ask(p); m = re.search(r"SCORE:\s*(\d+)", a); res[os.path.basename(p)[:2]] = {"score": int(m.group(1)) if m else None, "answer": a}
        print(os.path.basename(p), res[os.path.basename(p)[:2]]["score"], "|", a.replace("\n", " | ")[:260], flush=True)
finally:
    out = f"{D}/critic-{model.replace(':', '_')}.json"; json.dump(res, open(out + ".tmp", "w"), indent=1); os.replace(out + ".tmp", out)
    urllib.request.urlopen(urllib.request.Request(f"{URL}/api/generate", json.dumps({"model": model, "keep_alive": 0}).encode(), {"Content-Type": "application/json"}))  # unload: off the desk's memory
