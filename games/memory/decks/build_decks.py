# One-off: python3 web/games/memory/decks/build_decks.py  (from the repo root). Writes decks/*.json + img/mali/*.webp from the books' OWN pictures.
# A new book joins by adding its own deck here (or by hand) and one line in decks/index.json: no game code changes.
import json
from PIL import Image
M = "web/games/memory/"
b = json.load(open("web/kapi/learn/bank.json")); by = {i["id"]: i for i in b["items"]}
kapi = [{"id": i, "img": "../../kapi/learn/" + by[i]["img"], "w": {k: by[i][k] for k in ("en", "lo", "th", "zh", "ja")}}
        for i in "kapi otter frog turtle owl heron duck fish crab butterfly squirrel gecko buffalo bat dragonfly kingfisher".split()]
json.dump({"id": "kapi", "title": "Kapi and the Crocodile", "bg": "../../kapi/learn/scenes/s04.webp", "items": kapi}, open(M + "decks/kapi.json", "w"), ensure_ascii=False, indent=1)
mali = [("kite", "kite"), ("petal", "flower"), ("moth", "moth"), ("houseboat", "houseboat"), ("spirit-house", "spirit house"), ("home-door", "house"),
        ("islet", "island"), ("basket-stall", "market stall"), ("moonstone", "moon stone"), ("lantern-arch", "lanterns"), ("village-centre", "village")]
items = []
for n, w in mali:  # trim to the picture, fit 256 px, keep the cut-out's own transparency
    im = Image.open(f"cards/mali/{n}.png").convert("RGBA"); im = im.crop(im.getbbox()); im.thumbnail((256, 256)); im.save(f"{M}img/mali/{n}.webp", quality=88)
    items.append({"id": n, "img": f"img/mali/{n}.webp", "w": {"en": w}})
bg = Image.open("cards/mali/backdrop-market.png").convert("RGB"); bg.thumbnail((900, 900)); bg.save(M + "img/mali/bg.webp", quality=70)
json.dump({"id": "mali", "title": "Mali and the Lantern Market", "bg": "img/mali/bg.webp", "items": items}, open(M + "decks/mali.json", "w"), ensure_ascii=False, indent=1)
json.dump(["kapi", "mali"], open(M + "decks/index.json", "w"))
