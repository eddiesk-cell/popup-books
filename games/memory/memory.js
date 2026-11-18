// Memory: turn one stone tablet, then a second; match every pair to pass. Four walls, 4 x 4 to 10 x 10 (owner 2026-11-18: "Easy could be 4x4, hardest could be 10x10"),
// played in a stone hall you look around (memory3d.js); the tablets' backs carry fifty carvings from our tales (carvings.js). The flip state (.up / .done) is web/live/learn.js's pattern,
// kept on a hidden row of buttons: the keyboard / screen-reader path, and what the 3D wall mirrors. Its mulberry32 is copied, nothing is imported (learn.js is bound to a book page).
import { FIGS } from "./carvings.js";
import { createWall } from "./memory3d.js";
const root = document.getElementById("mm"), decks = [{ id: "stone", title: "Stone tablets", items: FIGS.map(([name], i) => ({ id: name, i, w: { en: name } })) }]; let theme = 0, run = null, world = null;
const Q = new URLSearchParams(location.search), LANG = Q.get("lang") || "en", SEED = Q.has("seed") ? +Q.get("seed") : null;
export const LEVELS = [["4 × 4", 8, 1.5], ["6 × 6", 18, 2], ["8 × 8", 32, 3], ["10 × 10", 50, 3.5]];  // [name, pairs, stars]; level 1 shows every tablet for 2 s
export const PREVIEW = 2000, MISS = 1000;
export const mkRng = seed => { if (seed == null) return Math.random; let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const shuffle = (a, rnd) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const word = (it, lang) => it.w[lang] ?? it.w.en;

// the deal: a random set of carvings, each twice, shuffled every time. Pure, no DOM.
export function deal(deck, level, rnd = Math.random) {
  const [, pairs] = LEVELS[level - 1], pick = shuffle(deck.items, rnd).slice(0, pairs);
  const cards = pick.flatMap(it => [{ key: it.id, kind: "pic", it }, { key: it.id, kind: "pic", it }]);
  return shuffle(cards, rnd);
}

// Fair stars (owner 2026-11-15): stars measure skill, not time. A win is graded by its MISSES (two cards that did not match):
// at most FULL misses = full value, at most SOME = two thirds, more = one third. A level's stars = the best grade reached in at least 3 of its last 5 wins there, times the level's value.
// So replaying a mastered level adds nothing and the game holds at most 1.5+2+3+3.5 = 10 stars.
export const GRADE = [[4, 10], [10, 24], [20, 44], [32, 70]];  // per level: [most misses for full, most for two thirds]
export const grade = (level, misses) => (misses <= GRADE[level - 1][0] ? 1 : misses <= GRADE[level - 1][1] ? 2 / 3 : 1 / 3);
export const levelStars = (wins, deck, level) => { const last = wins.filter(w => w.deck === deck && w.level === level).slice(-5); for (const g of [1, 2 / 3, 1 / 3]) if (last.filter(w => w.grade >= g - 1e-6).length >= 3) return LEVELS[level - 1][2] * g; return 0; };
export const deckStars = (wins, deck) => LEVELS.reduce((t, _, i) => t + levelStars(wins, deck, i + 1), 0);
// The daily rest: after REST_MIN minutes of play in a day the cards rest until midnight. The one setting (the parent area will set it later); ?rest=<minutes> for tests.
export const REST_MS = (Q.has("rest") ? +Q.get("rest") : 15) * 60000;
const day = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
// the host is ONE data entry (a cast glb, or statue: true for a host whose book is not made yet: gilded, still, glows when it speaks); swap it, not the game code
export const HOST = { name: "Kapi", img: "../../kapi/learn/img/kapi.webp", model: "../../live/chars/kapi.glb", statue: new URLSearchParams(location.search).has("statue"), hello: "Hi! I'm Kapi. Let's find the pairs!", cheer: ["Yay!", "A pair!", "Well done!", "Great memory!"], rest: "Kapi is resting. Come back tomorrow!" };  // shortcut: host lines in English only, translate with the landing's lang.js

// kept on this device only for now (localStorage, wrapped)
export const KEY = "popup.memory.v2"; let mem = { v: 2, wins: [], rest: { day: "", ms: 0 } };
export const saved = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.v === 2) return (mem = s); } catch { /* blocked or empty: the in-memory copy plays on */ } return mem; };
const write = m => { mem = m; try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage blocked: the game still plays */ } };
const keep = (deck, level, misses) => { const s = saved(), g = grade(level, misses); write({ ...s, wins: [...s.wins, { deck, level, misses, grade: g, t: new Date().toISOString() }].slice(-200) }); return g; };
const used = () => { const r = saved().rest; return r.day === day() ? r.ms : 0; };
const resting = () => used() >= REST_MS;
setInterval(() => { const s = saved(); if (root.dataset.state === "rest") { if (!resting()) menu(); return; } if (document.hidden || !["play", "dealing"].includes(root.dataset.state)) return; write({ ...s, rest: { day: day(), ms: used() + 1000 } }); }, 1000);

const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter(k => k != null)); return e; };
const NS = "http://www.w3.org/2000/svg";
const star = (f = 1) => { const s = h("span", "star"), o = document.createElementNS(NS, "svg"); o.setAttribute("viewBox", "0 0 24 24"); o.setAttribute("aria-hidden", "true");
  o.innerHTML = '<path class="o" d="M12 1.8l3 6.6 7.2.8-5.4 4.8 1.5 7.1L12 17.4 5.7 21.1l1.5-7.1L1.8 9.2 9 8.4z"/>' + (f ? `<path class="f" style="clip-path:inset(0 ${(1 - f) * 100}% 0 0)" d="M12 1.8l3 6.6 7.2.8-5.4 4.8 1.5 7.1L12 17.4 5.7 21.1l1.5-7.1L1.8 9.2 9 8.4z"/>` : ""); s.append(o); return s; };
const stars = n => { const w = h("span", "stars", ...[1, 2, 3].map(i => star(Math.max(0, Math.min(1, n - i + 1))))); w.dataset.v = n; w.setAttribute("aria-label", n + " stars"); return w; };
const EMBLEM = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" stroke-width=".7"/><path fill="currentColor" d="M50 12l5.5 29.5L85 50l-29.5 8.5L50 88l-5.5-29.5L15 50l29.5-8.5z"/><path fill="currentColor" opacity=".7" d="M50 28l3 19 19 3-19 3-3 19-3-19-19-3 19-3z" transform="rotate(45 50 50)"/></svg>';


let snd = null; const sound = n => snd?.then(s => s?.play(n, { gain: .9 }));
addEventListener("pointerdown", () => (snd ??= import("../../live/sound.js").then(m => { const f = m.manifestFor("kapi", "../../"); f.sounds["stone-turn"] = ["sfx/stone-turn.m4a", "sfx/stone-turn-2.m4a", "sfx/stone-turn-3.m4a"]; return m.addSound(f); }).catch(() => null)), { capture: true, once: true });
async function boot() {
  menu();
  try { world = await createWall(document.getElementById("mm-3d"), { host: HOST, sound }); document.documentElement.classList.add("has3d"); window.mm3d = { world, pairs, screenOf: i => world.screenOf(i), face: i => world.face(i) };
    world.S.onPick = h => run?.cards[h.instanceId] && tap(run.cards[h.instanceId]); }
  catch (e) { console.warn("memory: no 3D hall, the flat cards play on", e); }
}
const pairs = () => { const m = {}; run.cards.forEach((c, i) => (m[c.dataset.key] ??= []).push(i)); return Object.values(m); };  // test: each pair's two tablet indices

const kapi = cls => h("div", "host " + cls, Object.assign(h("img"), { src: new URL(HOST.img, location.href).href, alt: HOST.name, draggable: false }), h("span", "say"));
const say = t => { const e = root.querySelector(".host .say"); if (!e) return; e.textContent = t; e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); };
const dtotal = () => deckStars(saved().wins, decks[theme].id), r1 = n => String(Math.round(n * 10) / 10);

function restScreen() {
  run?.timers.forEach(clearTimeout); run = null; root.dataset.state = "rest";
  root.replaceChildren(h("div", "top", Object.assign(h("a", "back", "Back"), { href: "../" + location.search })), h("div", "rest", kapi("sleep"), h("h2", "", HOST.rest), h("p", "", "The cards are resting until tomorrow.")));
  root.querySelector(".say").textContent = "Zzz...";
}

function menu() {
  if (resting()) return restScreen();
  run?.timers.forEach(clearTimeout); run = null; root.dataset.state = "menu"; document.documentElement.lang = LANG; world?.deal([]);
  const lv = h("div", "levels", ...LEVELS.map(([n, pairs], i) => { const b = h("button", "lvl", h("b", "", n), h("small", "", `${pairs} pairs`), stars(levelStars(saved().wins, decks[theme].id, i + 1))); b.dataset.level = i + 1; b.onclick = () => play(i + 1); return b; }));
  root.replaceChildren(h("div", "top", Object.assign(h("a", "back", "Back"), { href: "../" + location.search }), h("div", "total", "Stars ", h("b", "", r1(dtotal())))), kapi("big"), h("h1", "", "Memory"), h("p", "sub", "Turn the stone tablets and find the matching carvings."), lv);
  root.querySelector(".total b").dataset.v = dtotal(); say(HOST.hello);
}

function play(level) {
  if (resting()) return restScreen();
  const deck = decks[theme], cards = deal(deck, level, mkRng(SEED)), [name, pairs, st] = LEVELS[level - 1];
  run = { deck, level, st, left: pairs, miss: 0, open: [], lock: false, timers: [] }; root.dataset.state = "dealing"; document.documentElement.lang = LANG;
  const board = h("div", "board"); board.dataset.cards = cards.length;
  cards.forEach(c => { const b = h("button", "mc", h("span", "face", h("span", "w", word(c.it, LANG))), h("span", "back", Object.assign(h("i"), { innerHTML: EMBLEM })));
    b.dataset.key = c.key; b.dataset.kind = c.kind; b.setAttribute("aria-label", "tablet"); b.onclick = () => tap(b); c.el = b; board.append(b); });
  root.replaceChildren(h("div", "top", Object.assign(h("button", "back", "Menu"), { onclick: menu }), kapi("small"), h("div", "total", "Pairs ", h("b", "", "0"), ` / ${pairs}`)), board);
  root.querySelector(".host").title = name;
  run.cards = cards.map(c => c.el); world?.deal(cards.map(c => c.it.i)); say(level === 1 ? "Look closely!" : "Find the pairs!");
  if (level === 1) { run.lock = true; run.cards.forEach((c, i) => (c.classList.add("up"), world?.turn(i, true, i > 0))); run.timers.push(setTimeout(() => { run.cards.forEach((c, i) => (c.classList.remove("up"), world?.turn(i, false, i > 0))); run.lock = false; root.dataset.state = "play"; say("Now you try!"); }, PREVIEW + 600)); } else root.dataset.state = "play";
}

function tap(b) {
  if (!run || run.lock || b.classList.contains("up") || b.classList.contains("done")) return;
  b.classList.add("up"); b.setAttribute("aria-label", b.querySelector(".w")?.textContent || "picture"); run.open.push(b); world?.turn(run.cards.indexOf(b), true);
  if (run.open.length < 2) return;
  const [a, c] = run.open; run.open = [];
  if (a.dataset.key === c.dataset.key) { [a, c].forEach(x => (x.classList.remove("up"), x.classList.add("done"), world?.glow(run.cards.indexOf(x)))); sound("ok"); world?.act("Cheer"); root.querySelector(".total b").textContent = (+root.querySelector(".total b").textContent) + 1; say(HOST.cheer[Math.floor(Math.random() * HOST.cheer.length)]); root.querySelector(".host").classList.add("hop"); run.timers.push(setTimeout(() => root.querySelector(".host")?.classList.remove("hop"), 600)); if (--run.left === 0) run.timers.push(setTimeout(win, 900)); return; }
  run.miss++; run.lock = true; run.timers.push(setTimeout(() => { [a, c].forEach((x, k) => (x.classList.remove("up"), x.setAttribute("aria-label", "tablet"), world?.turn(run.cards.indexOf(x), false, k > 0))); run.lock = false; }, MISS + 500));
}

function win() {
  const { deck, level, miss } = run, g = keep(deck.id, level, miss), v = LEVELS[level - 1][2], ls = levelStars(saved().wins, deck.id, level); root.dataset.state = "win"; sound("won"); world?.act("Cheer");
  const ov = h("div", "win", kapi("cheer"), h("h2", "", "You found them all!"), stars(ls), h("p", "", ls ? `${r1(ls)} stars for this level` : "Win 3 times to earn this level's stars"), h("small", "", `${miss} ${miss === 1 ? "miss" : "misses"} this game`), h("div", "row", Object.assign(h("button", "go", "Play again"), { onclick: () => play(level) }), ...(level < LEVELS.length ? [Object.assign(h("button", "go", "Next level"), { onclick: () => play(level + 1) })] : []), Object.assign(h("button", "go alt", "Menu"), { onclick: menu })));
  ov.dataset.grade = g.toFixed(3); ov.dataset.misses = miss; ov.dataset.levelstars = ls; ov.dataset.max = v; root.append(ov);
}

boot();
