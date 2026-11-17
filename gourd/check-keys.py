"""Every id in story.json has lo/th/zh/ja in translations.json, and nothing extra. Prints "<n> missing".
  python3 web/gourd/check-keys.py [translations.json]   (exit 1 if any key is missing or extra)"""
import json, sys
from pathlib import Path
d = Path(__file__).parent
s = json.load(open(d / "story.json")); t = json.load(open(sys.argv[1] if len(sys.argv) > 1 else d / "translations.json"))
LANGS = ("lo", "th", "zh", "ja")
want = {l["id"] for sp in s["spreads"] for l in sp["lines"]} | {l["id"] for l in s["moral"] + s["game"]}
bad = [f"line {i}: no text" for i in sorted(want - t["lines"].keys())]
bad += [f"line {i}: not in story.json" for i in sorted(t["lines"].keys() - want)]
bad += [f"titles {sp['n']}" for sp in s["spreads"] if str(sp["n"]) not in t["titles"]]
for who, said in s["touch"].items():
    got = t["touch"].get(who, [])
    bad += [f"touch {who}.{i}" for i in range(len(said)) if i >= len(got) or got[i].get("en") != said[i]]
    bad += [f"touch {who}.{len(said)}+: extra" for _ in got[len(said):]]
cells = [(f"lines {k}", v) for k, v in t["lines"].items()] + [(f"titles {k}", v) for k, v in t["titles"].items()] \
    + [("title", t["title"]), ("credit", t["credit"])] + [(f"touch {w}.{i}", v) for w, l in t["touch"].items() for i, v in enumerate(l)]
bad += [f"{k}: empty {x}" for k, v in cells for x in LANGS if not str(v.get(x, "")).strip()]
print("\n".join(bad)); print(f"{len(bad)} missing")
sys.exit(bool(bad))
