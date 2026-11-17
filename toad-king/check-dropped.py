"""Flags translations that may have lost words. Prints each flag, then "<n> unresolved".
 1. English has a quoted part or a colon-led part ("The sky says: ...") and the translation has no counterpart;
 2. fewer sentences than the English (not for Thai, which has no full stops);
 3. length ratio (translation / English) under 40% or over 250% of that language's median ratio.
A flagged id that a person has read and judged fine goes in check-dropped.ok (one id per line, with the language, "id lang").
  python3 web/toad-king/check-dropped.py [translations.json]   (exit 1 if any flag is unresolved)"""
import json, re, statistics, sys
from pathlib import Path
d = Path(__file__).parent
s = json.load(open(d / "story.json")); t = json.load(open(sys.argv[1] if len(sys.argv) > 1 else d / "translations.json"))
ok = {l.split("#")[0].strip() for l in open(d / "check-dropped.ok")} if (d / "check-dropped.ok").exists() else set()
en = {l["id"]: l["text"] for sp in s["spreads"] for l in sp["lines"]} | {l["id"]: l["text"] for l in s["moral"] + s["game"]}
tr = {k: v for k, v in t["lines"].items()}
for w, l in s["touch"].items():
    for i, x in enumerate(l): en[f"touch.{w}.{i}"] = x; tr[f"touch.{w}.{i}"] = t["touch"][w][i]
sent = lambda x: len(re.findall(r"[.!?。！？]+", re.sub(r"\.{3}|…+|[:：]", "", x)))
QUOTE = {"lo": "“\"", "th": "“\"", "zh": "“「", "ja": "「“"}
COLON = {"lo": (":", "ວ່າ"), "th": (":", "ว่า"), "zh": (":", "：", "说"), "ja": ("：", ":", "と", "いった")}
flags = []
for lang in ("lo", "th", "zh", "ja"):
    ratio = {i: len(tr[i][lang]) / max(1, len(en[i])) for i in en}
    med = statistics.median(ratio.values())
    for i, e in en.items():
        x, why = tr[i][lang], []
        if '"' in e and not any(c in x for c in QUOTE[lang]): why.append("quoted part missing")
        if re.search(r"\w: ", e) and not any(c in x for c in COLON[lang]): why.append("colon part missing")
        if lang != "th" and sent(x) < sent(e): why.append(f"{sent(x)} sentences for {sent(e)}")
        if not 0.4 * med <= ratio[i] <= 2.5 * med: why.append(f"length ratio {ratio[i]/med:.2f} x median")
        if why and f"{i} {lang}" not in ok: flags.append(f"{i} {lang}: {'; '.join(why)}\n    {e}\n    {x}")
print("\n".join(flags)); print(f"{len(flags)} unresolved")
sys.exit(bool(flags))
