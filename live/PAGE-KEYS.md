# Page keys for book builders (viewer: web/live)

Test pages load with `web/live/?book=<book>&s=<spread>&with=test/<file>.json`; state logic is tested by `node web/live/games.test.mjs` and `node web/live/sound.test.mjs`.

## Sound manifest (a book's own sounds)
`web/<book>/sfx/manifest.json`, read by `sound.js` for any book not built into it (kapi and mali are). Files `web/<book>/sfx/<name>.m4a`.
A pool of n variants is `<name>.m4a`, `<name>-2.m4a` ... `<name>-n.m4a` (the same convention the built-in pools use).
```json
{ "beds": ["tk-pond-night"], "shots": ["tk-croak"], "pools": { "tk-splash": 4 } }
```
- `beds`: looping ambience (name usable in spread `sound.bed`). `shots`: one file each. `pools`: a one-shot with n variants (a name in `pools` needs no entry in `shots`).
- The shared foley (`i-paper`, `i-wood`, `i-cloth`, `ok`, `won`, `again`, `page-turn` ... and their aliases) works with no copy, from kapi's folder. A name in your manifest wins over a shared one.
- The manifest is fetched when the page opens; a bed asked for before it lands starts when it does. No manifest (404): shared foley only.
- Test: `sound.test.mjs`. No test page (nothing to see).

## Game words: `"voice"` on the game block
Each value is an id in the book's words/voice files (`game.N.<key>`); a key not named plays nothing.
| key | when | notes |
|---|---|---|
| `start` | the game's prompt | read along, subtitled |
| `praise` | the win | |
| `hint` | after idle or misses | replaces the written `hint` |
| `react` | a right tap, any type (collect, order, pair, timing, rally/waves/leap, steer) | a string, or a list by target index (the first for any beyond it); collect's older `"react": [..]` / `"*"` still works |
| `again` | a wrong tap, any type | played after the try-again sound, at most once per 4 s |
| `listen` | the `listen` game | the line said and lit; replaces `line` |
No English string is ever shown by a game: with no voice and no `hint`, a miss is the sound only. Tests: `games.test.mjs` ("voice ok").

## Per-target sounds, `pair`, counting, characters
- `"sounds": ["drum-small", "drum-mid", "drum-big"]` on an `echo` game: one pool per target, played instead of the bell notes. Page: `test/game-sounds.json`.
- `"type": "pair", "pairs": [["seed","field"], ...]`: tap a thing, then where it goes; a right pair joins, a wrong one wobbles and tries again. Page: `test/game-pair.json`.
- `"count": "game.1.count"` on `collect`: the n-th right tap says `game.1.count.n` and shows the numeral; the last number is heard before the win. Page: `test/game-count.json`.
- Characters as targets: a `collect` game's `targets` may name cast characters (including 3D animals: buffalo, dog, cat, duck, turtle) as well as page pieces. A tap on one counts through its hit box; it wobbles and glows (with `"tap": "hover"` or `"light"` the usual behavior applies). Page: `test/game-chars.json` (stand-in positions). Not checked in a browser yet; the state logic is in `games.test.mjs` ("characters ok").

## `hide` / `show` act (acts.js)
`{"line": "9.5", "who": "buffalo", "do": "hide"}` or `{"line": "9.5", "what": "mound", "do": "show", "fade": 0.5}`. `who` is a cast character, `what` an object of the spread. At once, or over `fade` seconds.
A hidden thing is not drawn, casts no shadow, takes no tap, and does not sink or move; `show` puts back exactly what was there. "Read again" shows everything. Page: `test/act-hide.json`; tests: `acts.test.mjs` ("hide/show ok").
Characters work today. For a plain prop (not a model) the viewer must lend `find`: see "not yet".

## `timing` game with steps and lights (games.js)
`"type": "timing", "targets": ["vine"], "step": {"prop": "axe-tree", "clip": "Notch", "steps": 5}, "light": ["beam0", "beam1", "beam2", "beam3", "beam4"]`.
One target, tapped `steps` times (default: the number of targets). A good tap plays one step of the prop's clip (1/steps of its length, then it holds; the prop must be a cast model with that clip) and `glow`s the next prop of `light`; an early or late tap plays and lights nothing and the ring goes on. The win comes after `steps` good taps. `light` works without `step` and the reverse. Without either key the game is as before. Page: `test/game-chop.json` (stand-in props: no Notch model yet, so only the lights show); tests: `games.test.mjs` ("chop ok").

## Effect on a tap
- A `storyfx` entry (same fields as a line's: `type`, `at`/`what`/`who`/`shed`, `level`, `tint`; give `secs` to a kind that runs until stopped) whose `"line"` is `"tap:<piece>"` plays when that touch piece is tapped, after its word card and wobble; a piece with no such entry changes nothing. Page: `pages/turtle-01.json` (`tap:narra-tree`, a falling yellow flower); check: `tools/tap_fx.mjs`.

## `ambient.drift`: leaves, petals, seed fluff (ambient.js)
`"drift": {"card": "kapi/leaf", "count": 3, "over": "water"}`: `count` cards float down the water's current (`"over": "air"`: blown across the air over the near half of the page). `card` is a card picture (`<book>/<name>`).
`"drift": {"kind": "seed", "count": 6}`: seed fluff, no card needed: small white tufted seeds (a brown seed under a white fan, as `assets/toad-king/refs/seed-fluff-ref.png`) floating slowly with the wind over the near half of the page, 10 to 45 cm up, each rising and falling about 5 cm over 14 s, facing the camera, now and then catching the sun (a warm glint). A few at a time: of 6, about 4 are in a desktop frame and 1 to 3 on a phone (about 20 px and 8 px tall). `count: 0` or no `drift`: nothing (a page without the key is unchanged). Used by toad-king spread 2 (`pages/toad-02.json`, the stubble field). A seed is not drawn while it is over the read-along words.

## Not yet
- `hide` / `show` of a plain prop (an object of the spread that is not a cast model) needs one hook in `live.js`, in the `new Acting(m.acts || [], sp.cast, { ... })` options (line ~200): `find: what => sp.root.getObjectByName(what) || sp.byName[what]?.body,` (what name -> the Object3D, or undefined). Until then such an act is skipped.
- Nothing waits on `live.js` from this page. (Fallback English in `live.js` itself: `"Find them all! Tap each one to pick it."` and `"You found them all!"`, shown when a game has no `voice.start` / `voice.praise`: a book that wants none gives every game `voice.start` and `voice.praise`.)
