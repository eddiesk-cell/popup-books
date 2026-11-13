// book.js — a reusable pop-up book engine, configured by book.json (see web/kapi/book.json).
// Spreads in reading order; each folder holds open/ close/ loop.mp4 targets.json corners-in/out.json.
// A page lies ready to turn (drag a corner), the spread comes alive, a Reader reads its lines, tapping
// anything reacts (touch.js), and a small game runs on the loop: "collect", "listen" or "timing".
import { Frames, PageDrag } from "./flip.js";
import { Reader } from "./narrate.js";
import { Fx } from "./touch.js";
import { loadWords, languages, touchLine, unlock } from "./reading.js";
export { LANGS } from "./reading.js";

// ---------- game state: pure, no DOM, tested by tools/book.test.mjs ----------
export class Collect {  // tap every target, any order; a repeat tap is simply ignored
  constructor(n) { this.n = n; this.done = new Set(); }
  tap(k) { if (k < 0 || k >= this.n || this.done.has(k)) return false; this.done.add(k); return true; }
  get complete() { return this.done.size === this.n; }
}

export class Timing {  // a ring closes on target `cur`; tap while it is nearly shut. A miss only tries again.
  constructor(n, { period = 1.8, window = 0.2 } = {}) { Object.assign(this, { n, period, window, cur: 0, misses: 0 }); }
  phase(t) { return (t % this.period) / this.period; }
  win() { return Math.min(0.6, this.window + 0.08 * this.misses); }  // every miss widens the window a little
  tap(k, t) {
    if (this.complete || k !== this.cur) return "ignore";
    if (this.phase(t) < 1 - this.win()) { this.misses++; return "miss"; }
    this.cur++; this.misses = 0; return "hit";
  }
  get complete() { return this.cur >= this.n; }
}

const norm = w => w.toLowerCase().replace(/[^\p{L}']/gu, "");
export function markWords(text, phrase) {  // which words of `text` belong to `phrase` (all false if it is absent)
  const w = text.split(" ").map(norm), p = phrase.split(" ").map(norm);
  const i = w.findIndex((_, j) => p.every((x, k) => w[j + k] === x));
  return w.map((_, j) => i >= 0 && j >= i && j < i + p.length);
}


// ---------- the player ----------
const TURN = 72, OPEN = 156, CLOSE = 73, W = 1280, H = 720, FPS = 24;
const TEXT = { collect: ["Tap everything that moves!", "Look closely. Tap the little things!"],
  timing: ["Tap each ring just as it closes!", "Wait for the ring to shrink around it."],
  listen: ["Tap Lulu's words to hear them again.", "Tap the speech bubble."] };

export async function startBook(cfg, $ = id => document.getElementById(id)) {
  const words = await loadWords("", cfg), { story, timing, text, subs } = words;
  let lang = "";
  const opt = { voice: cfg.voice, timing, text, subs };
  const reader = new Reader($("read"), opt), mreader = new Reader($("mread"), opt);
  const BOOK = cfg.spreads, N = BOOK.length;
  const loop = $("loop"), view = $("view"), ctx = view.getContext("2d"), fx = new Fx(), speak = new Audio();
  const sfx = id => { speak.src = `${cfg.voice}${id}.m4a`; speak.play().catch(() => {}); };

  languages($("langs"), "kapi.lang", l => { lang = l; reader.setLang(l); mreader.setLang(l); });

  const saved = {}, cache = {}, fetched = u => fetch(u).then(r => r.json());
  const load = p => cache[p.dir] ??= {
    open: new Frames(`${p.dir}/open/`, OPEN), cin: fetched(`${p.dir}/corners-in.json`),
    close: new Frames(`${p.dir}/close/`, CLOSE), cout: fetched(`${p.dir}/corners-out.json`),
    meta: fetched(`${p.dir}/targets.json`),
  };

  let i = 0, mode = "title", page = BOOK[0], drag = null, fingerX = 0, down = false;
  let pos, meta, G, S, game, nG, lit, litAt, frame = 0, peelAt = 0, hintTimer;

  const say = (t, end) => {
    $("msg").innerHTML = t ? `<p>${t}</p>` + (end ? `<button id="next">Turn the page</button>` : "") : "";
    $("msg").classList.toggle("show", !!t);
    if (end) { $("next").onclick = () => turn(true, true); $("next").focus(); }
  };
  const quiet = () => {  // everything of a spread that must not outlive it
    reader.stop(); speak.pause(); reader.box.classList.remove("show"); $("bar").classList.remove("on"); say("");
    $("lbub").hidden = $("sbub").hidden = true; clearTimeout(hintTimer);
  };

  const evict = () => { const keep = BOOK.slice(Math.max(0, i - 1), i + 2).map(p => p.dir); for (const k in cache) keep.includes(k) || delete cache[k]; };
  const failed = () => { for (const p of [page, BOOK[i - 1]]) p && delete cache[p.dir]; toText(i); };  // a failed download must not freeze the book

  // ----- reading: between spreads a page lies ready to be turned -----
  function toText(k) {
    if (k >= N) return showMoral();
    i = k; page = BOOK[k]; mode = "text"; peelAt = performance.now() + 1500;
    loop.pause(); quiet(); load(page).open.draw(ctx, 0);
    if (k === 0) say("Pull the corner of the page to turn it.");
    if (k > 0) load(BOOK[k - 1]);
    evict(); view.focus({ preventScroll: true });
  }

  async function turn(fwd, auto, x0 = fingerX) {
    if (!["text", "open"].includes(mode)) return;
    const R = load(page);
    let frames, corners, a, b, onLand;
    if (mode === "text") {
      if (fwd) [frames, corners, a, b, onLand] = [R.open, R.cin, 0, TURN, e => e ? alive() : toText(i)];
      else if (i > 0) {
        const Q = load(BOOK[i - 1]);
        [frames, corners, a, b, onLand] = [Q.close, Q.cout, CLOSE - 1, 0, e => e ? (i--, page = BOOK[i], alive()) : toText(i)];
      } else return;
    } else {
      await duck();  // the pop-ups fold in first; the pull the finger made meanwhile still counts
      if (fwd) [frames, corners, a, b, onLand] = [R.close, R.cout, 0, CLOSE - 1, e => e ? toText(i + 1) : alive()];
      else [frames, corners, a, b, onLand] = [R.open, R.cin, TURN, 0, e => e ? toText(i) : alive()];
    }
    mode = "turn"; say("");
    let track; try { track = (await corners).corners; } catch { return failed(); }
    drag = new PageDrag(t => frames.draw(ctx, t), onLand);
    drag.grab(track, a, b, auto ? track[a][0] : x0);
    if (auto) { drag.isAuto = true; drag.auto(); } else { drag.move(fingerX); if (!down) drag.release(); }
  }

  const play = (frames, from, to, ms) => new Promise(end => {  // run frames from -> to on the canvas over ms
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      try { frames.draw(ctx, from + (to - from) * k); } catch {}
      k < 1 ? requestAnimationFrame(step) : end();
    };
    requestAnimationFrame(step);
  });

  async function duck() { mode = "duck"; quiet(); loop.pause(); await play(load(page).open, OPEN - 1, TURN, 450); }

  async function alive() {  // the page lies open: its pop-ups come alive, then the reading and the game start
    mode = "alive"; loop.src = `${page.dir}/loop.mp4`; loop.load();
    const R = load(page);
    try { meta = { ...await R.meta, ...page.names && { names: page.names } }; pos = meta.targets; } catch { return failed(); }
    await play(R.open, TURN, OPEN - 1, (OPEN - 1 - TURN) / FPS * 1000);
    openPage();
  }

  // ----- the open spread: reading bar, touch, and the game on the loop -----
  function openPage() {
    mode = "open"; G = { type: "collect", ...page.game };
    nG = pos[0].length - (meta.touch | 0);
    S = saved[i] ??= { done: false, litAt: [], lit: pos[0].map(() => false),  // reopening the same spread keeps its progress
      game: G.type === "timing" ? new Timing(nG, G) : new Collect(G.type === "listen" ? 1 : nG) };
    ({ game, lit, litAt } = S);
    loop.currentTime = 0; loop.play().catch(() => {});
    read();
    const [start, hint] = TEXT[G.type];
    if (S.done) say(G.praise ?? "Wonderful! You did it!", true);
    else { say(G.start ?? start); hintTimer = setTimeout(() => !S.done && say(G.hint ?? hint), 9000); }
    if (G.type === "listen") listenBubble();
    if (BOOK[i + 1]) load(BOOK[i + 1]);
    evict(); view.focus({ preventScroll: true });
  }

  function read() { $("bar").classList.add("on"); reader.read(page.lines); }
  $("replay").onclick = () => mode === "open" && read();

  function listenBubble() {  // Lulu says it again; the words Bobo missed are lit
    const b = $("lbub"), k = (meta.names || []).findIndex(n => /lulu/i.test(n));
    const [x, y] = pos[0][k] ?? [0.5, 0.3], line = text[G.line];
    const mark = markWords(line, G.say);
    b.innerHTML = line.split(" ").map((w, j) => `<span${mark[j] ? ' class="miss"' : ""}>${w}</span>`).join(" ");
    b.style.left = `${Math.min(70, Math.max(30, x * 100))}%`; b.style.top = `${Math.max(14, y * 100 - 8)}%`;
    b.hidden = false;
    b.onclick = () => { reader.stop(); sfx(G.line); if (game.tap(0)) finish(); };
  }

  function finish() {
    S.done = true; clearTimeout(hintTimer);
    if (G.type === "listen") lit.forEach((_, k) => { lit[k] = k < nG; litAt[k] = performance.now(); });
    setTimeout(() => mode === "open" && say(G.praise ?? "Wonderful! You did it!", true), 700);
  }

  function light(k) { lit[k] = true; litAt[k] = performance.now(); const v = G.react?.[k] ?? G.react?.["*"]; if (v) sfx(v); }

  function onTap(k) {  // a tap on a game target (k < nG)
    if (S.done || G.type === "listen") return;
    if (G.type === "timing") {
      const r = game.tap(k, performance.now() / 1000);
      if (r === "miss") return say("Almost! Try again.");
      if (r !== "hit") return;
    } else if (!game.tap(k)) return;
    light(k); clearTimeout(hintTimer);
    const n = G.type === "timing" ? game.cur : game.done.size;
    if (game.complete) finish(); else say(`${n} of ${nG}`);
  }

  function react(k) {  // the light reaction every hotspot gives, and a character's phrase
    const [x, y, r] = pos[frame][k], R = Math.max(50, r * W * 3);
    fx.tap(x * W, y * H, k, R);
    const who = (meta.names?.[k] || "").match(/kapi|bobo|lulu/i)?.[0].toLowerCase(), said = touchLine(words, who, lang);
    if (!said) return;
    const s = $("sbub");
    s.innerHTML = `<b></b><i></i>`; s.firstChild.textContent = said.text; s.lastChild.textContent = said.sub;
    s.style.left = `${Math.min(88, Math.max(12, x * 100))}%`; s.style.top = `${Math.max(12, y * 100 - 9)}%`;
    s.hidden = false; clearTimeout(s.t); s.t = setTimeout(() => (s.hidden = true), 2300);
    sfx(said.id);
  }

  const off = document.createElement("canvas"), octx = off.getContext("2d");
  function render(now) {
    if (loop.readyState < 2) return load(page).open.draw(ctx, OPEN - 1);  // no video frame yet: hold the last open frame
    frame = Math.floor(loop.currentTime * FPS + 0.01) % pos.length;
    ctx.globalAlpha = 1;
    ctx.drawImage(loop, 0, 0, W, H, 0, 0, W, H);   // top half: dark
    pos[frame].forEach(([x, y, r], k) => {
      if (!lit[k]) return k < nG && !S.done && ring(k, x, y, r, now);
      const a = Math.min(1, (now - litAt[k]) / 500), R = Math.max(40, r * W * 2.6);
      if (off.width !== 2 * R) off.width = off.height = 2 * R; else octx.clearRect(0, 0, 2 * R, 2 * R);
      octx.drawImage(loop, x * W - R, H + y * H - R, 2 * R, 2 * R, 0, 0, 2 * R, 2 * R);  // bottom half: lit
      octx.globalCompositeOperation = "destination-in";
      const g = octx.createRadialGradient(R, R, R * 0.35, R, R, R);
      g.addColorStop(0, "#000"); g.addColorStop(1, "#0000");
      octx.fillStyle = g; octx.fillRect(0, 0, 2 * R, 2 * R);
      octx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a; ctx.drawImage(off, x * W - R, y * H - R);
    });
    ctx.globalAlpha = 1;
    fx.draw(ctx, now, k => [pos[frame][k][0] * W, pos[frame][k][1] * H]);
  }

  function ring(k, x, y, r, now) {  // a soft breathing ring says "tap me"; in timing, one ring closes on the current target
    if (G.type === "listen") return;
    ctx.strokeStyle = "#ffd9a0"; ctx.lineWidth = 2;
    if (G.type === "timing") {
      if (k !== game.cur) return;
      const p = game.phase(now / 1000), ok = p >= 1 - game.win();
      ctx.globalAlpha = 0.9; ctx.lineWidth = 4; ctx.strokeStyle = ok ? "#7dffa0" : "#ffd9a0";
      ctx.beginPath(); ctx.arc(x * W, y * H, r * W * (1.1 + 2.4 * (1 - p)), 0, 7); ctx.stroke();
    } else {
      const s = 0.5 + 0.5 * Math.sin(now / 420);
      ctx.globalAlpha = 0.25 + 0.35 * s;
      ctx.beginPath(); ctx.arc(x * W, y * H, r * W * (1.1 + 0.25 * s), 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ----- the moral page, after the last spread -----
  function showMoral() {
    mode = "moral"; page = BOOK[N - 1]; quiet(); loop.pause(); $("moral").hidden = false; again();
  }
  const again = () => mreader.read(cfg.moral.lines);
  $("again").onclick = again;
  $("back").onclick = () => { mreader.stop(); $("moral").hidden = true; toText(N - 1); };

  // ----- every frame -----
  requestAnimationFrame(function tick(now) {
    requestAnimationFrame(tick);  // next frame first, so one bad draw never stops the book
    try {
      if (mode === "open" && pos) render(now);
      if (mode === "text" && now > peelAt) {  // a corner lifts now and then to say "pull me"
        const k = (now - peelAt) / 900;
        load(page).open.draw(ctx, k < 1 ? 3 * Math.sin(Math.PI * k) : 0);
        if (k >= 1) peelAt = now + 3500;
      }
    } catch {}
  });

  // ----- hands and keys -----
  const at = e => { const b = view.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
  const can = () => ["text", "open"].includes(mode);
  let pend = null, pid = null;
  view.addEventListener("pointerdown", e => {
    if (pid !== null) return;
    const [x, y] = at(e); fingerX = x; down = true; pid = e.pointerId; view.setPointerCapture(pid);
    if (mode === "open" && tap(x, y)) return;
    if (can() && y > 0.4) pend = { x, fwd: x > 0.5 };
  });
  view.addEventListener("pointermove", e => {
    const [x, y] = at(e); fingerX = x;
    view.style.cursor = drag?.live && drag.held ? "grabbing" : can() && y > 0.4 ? "grab" : "";
    if (e.pointerId !== pid) return;
    if (pend && (pend.fwd ? pend.x - x : x - pend.x) > 0.04) { turn(pend.fwd, false, pend.x); pend = null; }  // only a pull in the turning direction
    else if (drag?.live && drag.held && !drag.isAuto) drag.move(x);
  });
  const up = e => {
    if (e.pointerId !== pid) return;
    down = false; pend = null; pid = null; if (drag?.live && !drag.isAuto) drag.release();
  };
  view.addEventListener("pointerup", up); view.addEventListener("pointercancel", up);

  function tap(px, py) {  // generous, kid-sized hit area; every hotspot reacts, only game targets count
    let best = -1, bestD = Infinity;
    pos[frame].forEach(([x, y, r], k) => {
      const d = Math.hypot((px - x) * 16 / 9, py - y);
      if (d < Math.max(r * 3, 0.06) && d < bestD) { best = k; bestD = d; }
    });
    if (best < 0) return false;
    react(best); if (best < nG) onTap(best);
    return true;
  }

  document.addEventListener("keydown", e => {
    if (mode === "title") return;
    if (e.key === "ArrowRight") turn(true, true);
    else if (e.key === "ArrowLeft") mode === "moral" ? $("back").click() : turn(false, true);
    else if ((e.key === " " || e.key === "Enter") && mode === "open" && document.activeElement === view) {
      e.preventDefault(); const k = G.type === "timing" ? game.cur : lit.indexOf(false);
      if (k >= 0 && k < nG && G.type !== "listen") { react(k); onTap(k); }
    }
  });

  load(BOOK[0]).open.imgs[0].decode().then(() => { $("go").textContent = "Tap to open the book"; });
  const start = () => {
    if (mode !== "title") return;
    unlock(reader.audio, mreader.audio, speak);  // iPad: unlock sound inside this tap
    $("title").remove(); view.focus(); toText(0); };
  $("title").onclick = start;
  $("title").onkeydown = e => (e.key === "Enter" || e.key === " ") && start();
}
