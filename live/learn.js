// learn.js: "Play and learn", the games on a book's end card, made from the book's own question bank
// (web/<book>/learn/bank.json, written by tools/learn_bank.mjs from its word cards).
//   offer(book, () => lang, () => reader.stop())   adds the gold "Play and learn" button to #moral (live.js calls it in moral())
// Every question is spoken, answers are pictures, a wrong pick wiggles and never counts out loud, a right pick moves on.
// A game draws 5 questions at random from the whole bank; distractors are drawn fresh and the right answer's place is
// shuffled each time. ?seed=N makes the draw repeatable (for checks only), ?age=4 gives 3 choices instead of 4.
// The pure part (quiz, memory, order, log) has no DOM, so tools/learn_check.mjs runs it in node.

const search = globalThis.location?.search ?? "", Q = new URLSearchParams(search);
const num = k => (Q.has(k) && Q.get(k) !== "" ? Number(Q.get(k)) : null);
export const AGE = num("age") ?? 6, SEED = num("seed");

export function mkRng(seed) {  // mulberry32
  if (seed == null) return Math.random;
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const shuffle = (a, rnd) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
const take = (pool, n, rnd, key) => { const out = [], seen = new Set(); for (const o of shuffle(pool, rnd)) { if (out.length >= n) break; if (!seen.has(key(o))) (seen.add(key(o)), out.push(o)); } return out; };

// ---------- the device log: one row per answer, a version key, never fatal ----------
export const KEY = "popup.learn.v1";
let mem = { v: 1, rows: [], stickers: [] };
const rd = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.v === 1) return (mem = s); } catch { /* blocked or empty: the in-memory copy plays on */ } return mem; };
const wr = d => { mem = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage blocked: the games still play */ } };
export const rows = () => rd().rows;
export const logRow = r => wr({ ...rd(), rows: [...rd().rows, { child: "local", ...r, t: new Date().toISOString() }] });
export const missed = book => {  // items whose latest answer was not right first time, newest first: they come back in the next game
  const last = new Map(); for (const r of rd().rows) if (r.book === book && r.game === "quiz") last.set(r.item, r);
  return [...last.values()].filter(r => !r.first).reverse().map(r => r.item);
};
const sticker = s => wr({ ...rd(), stickers: [...rd().stickers, s] });

// ---------- the games, drawn from the bank ----------
const KINDS = { find: () => 1, what: () => 1, colour: i => i.color, count: i => i.one,  /* only a picture of ONE animal can be counted */ sound: i => i.sound };
const pics = b => b.items.filter(i => i.img);
export const choicesFor = age => (age <= 5 ? 3 : 4);

export function quiz(b, { rnd = Math.random, age = AGE, missedIds = [], n = 5 } = {}) {
  const P = pics(b), used = new Set(), cho = choicesFor(age), kinds = Object.keys(KINDS).filter(k => age > 5 || k !== "what");  // the youngest cannot read the word answers: they get "Which one is...?" with pictures
  const ok = (i, k) => KINDS[k](i);
  const slots = [];
  for (const id of shuffle(missedIds, rnd).slice(0, 2)) {  // a missed word comes back, as one of the n
    const i = P.find(p => p.id === id); if (!i) continue;
    const ks = kinds.filter(k => ok(i, k)); slots.push({ i, k: pick(ks, rnd) }); used.add(id);
  }
  while (slots.length < n) {
    const k = pick(kinds.filter(k => P.some(i => !used.has(i.id) && ok(i, k))), rnd);
    const i = pick(P.filter(i => !used.has(i.id) && ok(i, k)), rnd); used.add(i.id); slots.push({ i, k });
  }
  return shuffle(slots, rnd).map(({ i, k }) => {
    let ans, dis;
    if (k === "colour") (ans = { type: "color", id: i.color }, dis = take(Object.keys(b.colors).filter(c => c !== i.color), cho - 1, rnd, c => c).map(id => ({ type: "color", id })));
    else if (k === "count") { const c = 1 + Math.floor(rnd() * Object.keys(b.numbers).length);  /* any picture, any number: nothing to memorise */ i = { ...i, shown: c }; ans = { type: "num", id: String(c) }; dis = take(Object.keys(b.numbers).filter(x => +x !== c), cho - 1, rnd, x => x).map(id => ({ type: "num", id })); }
    else {
      ans = { type: "item", id: i.id };
      const pool = P.filter(o => o.group !== i.group && o.en !== i.en && (k !== "sound" || (o.sound && o.soundText !== i.soundText)));
      dis = take(pool, cho - 1, rnd, o => o.group).map(o => ({ type: "item", id: o.id }));
    }
    const choices = shuffle([ans, ...dis], rnd);
    return { game: "quiz", kind: k, item: i.id, shown: i.shown, choices, correct: choices.indexOf(ans) };
  });
}

export function memory(b, { rnd = Math.random, age = AGE } = {}) {
  const items = take(pics(b), age < 6 ? 3 : 4, rnd, o => o.group), mode = age < 6 ? "pic" : "word";  // pictures to match for the youngest, a picture and its word otherwise
  return { game: "memory", mode, cards: shuffle(items.flatMap(i => [{ item: i.id, face: "pic" }, { item: i.id, face: mode }]), rnd) };
}

export function order(b, { rnd = Math.random, age = AGE } = {}) {
  const k = age <= 5 ? 3 : 3 + Math.floor(rnd() * 3), right = b.scenes.map(s => s.id), sc = take(b.scenes, k, rnd, s => s.id).sort((x, y) => x.n - y.n);
  let shown; do shown = shuffle(sc, rnd); while (shown.every((s, i) => s === sc[i]));
  return { game: "order", right: sc.map(s => s.id), shown: shown.map(s => s.id), all: right };
}

// ---------- the screen ----------
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter(k => k != null)); return e; };
const svgSpk = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let ui = null;

export async function offer(book, lang = () => "", stop = () => {}) {
  const base = `../${book}/`, door = document.querySelector("#moral .row");
  if (!door || door.querySelector(".learn-door")) return;
  const bank = await fetch(`${base}learn/bank.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!bank) return;  // a book with no bank has no door
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "learn.css" }));
  const b = h("button", "learn-door", "Play and learn"); b.onclick = () => open(book, bank, lang, stop);
  door.insertBefore(b, door.firstChild);
}

function open(book, bank, lang, stop) {
  stop(); ui?.close();
  const base = `../${book}/`, rnd = mkRng(SEED), age = AGE, byId = Object.fromEntries(bank.items.map(i => [i.id, i]));
  const L = id => `${base}learn/voice/${id}.m4a`, W = id => `${base}voice/words/${id}.m4a`, S = id => `${base}voice/${id}.m4a`;
  const root = h("div", "learn"), top = h("div", "l-top"), body = h("div", "l-body");
  const back = h("button", "l-back", "Back"), stars = h("div", "l-stars"); top.append(back, stars); root.append(top, body); document.body.append(root);
  let run = 0, audio = new Audio(), tok = 0;
  const alive = r => r === run && root.isConnected;
  const play = u => new Promise(res => { const done = () => { if (audio.onended === done) audio.onended = audio.onerror = null; res(); };  /* a stale 9 s timer must not cut the end of a later clip (review 3, E) */ audio.onended = audio.onerror = done; audio.src = u; audio.play().catch(done); setTimeout(done, 9000); });
  const say = async (...urls) => { const me = ++tok; audio.pause(); for (const u of urls) { if (me !== tok) return false; await play(u); } return me === tok; };
  const sfx = (n, v) => { const a = new Audio(`${base}sfx/${n}${(v = 1 + Math.floor(rnd() * v)) > 1 ? "-" + v : ""}.m4a`); a.volume = 0.6; a.play().catch(() => {}); };
  const ok = () => sfx("ok", 4), no = () => sfx("again", 4), wait = ms => new Promise(r => setTimeout(r, ms));
  const sub = o => (lang() && o[lang()]) || "";
  const dots = (n, of = 5) => stars.replaceChildren(...Array.from({ length: of }, (_, k) => h("i", "l-dot" + (k < n ? " on" : ""))));  // progress only: no points, no count of mistakes
  const star = n => (n ? stars.replaceChildren(h("i", "l-star", "★")) : dots(0, 0));  // one star for a finished round, not one per answer
  const word = (type, id) => type === "item" ? byId[id] : type === "color" ? bank.colors[id] : bank.numbers[id];
  const wvoice = (type, id) => L(`${type === "item" ? "w" : type === "color" ? "c" : "n"}.${id}`);
  const row = (game, item, skill, first, tries, ms) => logRow({ book, game, item, skill, language: lang() || "en", first, tries, ms: Math.round(ms) });
  const label = o => [h("b", "", o.en), sub(o) && h("small", "", sub(o))];
  const pic = (i, c = "") => { const im = h("img", c); im.src = base + "learn/" + i.img; im.alt = i.en; im.draggable = false; return im; };

  ui = { close() { run++; tok++; audio.pause(); root.remove(); ui = null; } };
  let playing = false;
  const pause = () => {  // Back in a game keeps its place: the game waits under a small page
    if (root.querySelector(".l-pause")) return;
    const keep = h("button", "l-btn gold", "Keep playing"), more = h("button", "l-btn", "Other games"), el = h("div", "l-pause", h("h2", "", "Paused"), h("div", "l-row", keep, more));
    keep.onclick = () => el.remove(); more.onclick = () => (el.remove(), picker()); root.append(el);
  };
  back.onclick = () => (!playing ? (body.querySelector(".l-picker") ? ui.close() : picker()) : pause());
  addEventListener("keydown", function esc(e) { if (!root.isConnected) return removeEventListener("keydown", esc); if (e.key === "Escape") back.click(); });

  function picker() {
    run++; tok++; audio.pause(); star(0); playing = false; root.querySelector(".l-pause")?.remove();
    const g = (name, id, imgs, go) => { const t = h("button", "l-game", h("div", "l-imgs", ...imgs), h("span", "", name)), ear = h("button", "l-hear"); ear.innerHTML = svgSpk; t.onclick = go; ear.ariaLabel = name; ear.onclick = () => say(L("p.g-" + id)); return h("div", "l-gw", t, ear); };  /* the small speaker says the name: a pre-reader picks by hearing */
    const who = id => pic(byId[id]), sc = bank.scenes.slice(0, 3).map(s => { const im = h("img", "scene"); im.src = base + "learn/" + s.img; return im; });
    const album = rd().stickers.filter(s => s.book === book).slice(-12);
    body.replaceChildren(h("div", "l-picker",
      h("h2", "", "Play and learn"),
      h("div", "l-games", g("Picture quiz", "quiz", [who("frog"), who("butterfly")], () => start("quiz")), g("Memory pairs", "memory", [who("owl"), who("owl")], () => start("memory")), g("Story order", "order", sc, () => start("order"))),
      album.length ? h("div", "l-album", h("small", "", "My stickers"), ...album.map(s => pic(byId[s.who], "stk"))) : null));
    say(L("p.pick"));
  }
  const start = game => { const r = ++run; star(0); playing = true; ({ quiz: playQuiz, memory: playMemory, order: playOrder })[game](r).then(done => done && finish(game, r)); };

  async function playQuiz(r) {
    const qs = quiz(bank, { rnd, age, missedIds: missed(book) });
    dots(0);
    for (let n = 0; n < qs.length; n++) { if (!alive(r)) return false; await ask(qs[n], r); if (!alive(r)) return false; dots(n + 1); }
    return true;
  }
  function ask(q, r) {
    return new Promise(res => {
      globalThis.__learn = q;  // what is on screen now, for scripted checks
      const t0 = performance.now(), i = byId[q.item];
      const say0 = () => say(...({ find: [L(i.plural ? "p.finds" : /^(kapi|bobo|lulu)$/.test(i.id) ? "p.find0" : "p.find"), L(`w.${i.id}`)], what: [L("p.what")], colour: [L("p.colour")], count: [L("p.count")], sound: [L("p.sound"), W(i.sound)] })[q.kind]);
      const hear = q.kind === "sound" || q.kind === "find";  // no picture to show: a big speaker button says it again
      const ques = hear ? h("button", "l-sound") : h("div", "l-pics", ...Array.from({ length: q.shown ?? 1 }, () => pic(i, "big")));
      if (hear) ques.innerHTML = svgSpk; ques.onclick = say0;
      const prompt = h("div", "l-prompt", ques), grid = h("div", "l-choices n" + q.choices.length), tiles = [];
      let tries = 0;
      q.choices.forEach((c, k) => {
        const o = word(c.type, c.id), t = h("button", "tile " + c.type, c.type === "item" && (q.kind !== "what") ? pic(o) : null, c.type === "color" ? Object.assign(h("i", "sw"), { style: `background:${o.hex}` }) : null, c.type === "num" ? h("em", "", c.id) : null, ...label(o));
        t.onclick = async () => {
          if (t.classList.contains("wrong") || grid.classList.contains("done")) return; tries++;
          if (k === q.correct) {
            grid.classList.add("done"); t.classList.add("ok"); ok();
            row("quiz", q.item, q.kind === "find" || q.kind === "what" ? "name" : q.kind, tries === 1, tries, performance.now() - t0);
            await say(wvoice(c.type, c.id), L("p.right-" + (q.kind === "what" ? "find" : q.kind))); await wait(500); res();
          } else {
            t.classList.add("wrong"); no(); if (tries >= 2) tiles[q.correct].classList.add("glow");
            say(wvoice(c.type, c.id), L("p.hint"), ...(tries === 2 && i.hint ? [W(i.hint)] : []));
          }
        };
        tiles.push(t); grid.append(t);
      });
      body.replaceChildren(prompt, grid); say0();
    });
  }

  async function playMemory(r) {
    const g = (globalThis.__learn = memory(bank, { rnd, age })), t0 = performance.now(), tries = {}, firstAt = {}, cards = [];
    const grid = h("div", "l-mem n" + g.cards.length); let up = [], busy = false, found = 0;
    dots(0, g.cards.length / 2); say(L("p.mem"));
    return new Promise(res => {
      g.cards.forEach(c => {
        const o = byId[c.item], f = h("div", "face", c.face === "pic" ? pic(o) : h("span", "w", ...label(o))), card = h("button", "mc", h("div", "back", "★"), f);
        card.onclick = async () => {
          if (busy || card.classList.contains("up") || card.classList.contains("done")) return;
          card.classList.add("up"); up.push([c, card]); firstAt[c.item] ??= performance.now(); say(L(`w.${c.item}`));
          if (up.length < 2) return; busy = true;
          const [[a, ca], [b, cb]] = up; up = [];
          if (a.item === b.item) {
            ca.classList.add("done"); cb.classList.add("done"); ok(); dots(++found, g.cards.length / 2);
            tries[a.item] = (tries[a.item] ?? 0) + 1; row("memory", a.item, "memory", tries[a.item] === 1, tries[a.item], performance.now() - firstAt[a.item]);
            const praised = say(L(`w.${a.item}`), L("p.right-memory")); busy = false; if (found === g.cards.length / 2) praised.then(() => res(alive(r)));
          } else {
            tries[a.item] = (tries[a.item] ?? 0) + 1; tries[b.item] = (tries[b.item] ?? 0) + 1; no(); await wait(1200);
            ca.classList.remove("up"); cb.classList.remove("up"); busy = false;
          }
        };
        cards.push(card); grid.append(card);
      });
      body.replaceChildren(grid);
    });
  }

  async function playOrder(r) {
    const g = (globalThis.__learn = order(bank, { rnd, age })), sc = Object.fromEntries(bank.scenes.map(s => [s.id, s])), grid = h("div", "l-order n" + g.shown.length);
    let next = 0, tries = 0, t0 = performance.now(); dots(0, g.right.length);
    body.replaceChildren(h("div", "l-prompt", h("span", "l-q", "What happened first?")), grid);
    const ask0 = () => say(L(next ? "p.order" : "p.order0"));
    return new Promise(res => {
      g.shown.forEach(id => {
        const s = sc[id], t = h("button", "tile scenetile", Object.assign(h("img", "scene"), { src: base + "learn/" + s.img, alt: s.title }), h("small", "", s.title));
        t.onclick = async () => {
          if (t.classList.contains("ok") || t.classList.contains("wrong")) return; tries++;
          if (id === g.right[next]) {
            t.classList.add("ok"); t.append(h("em", "badge", String(next + 1))); ok(); dots(++next, g.right.length);
            row("order", id, "order", tries === 1, tries, performance.now() - t0); tries = 0; t0 = performance.now();
            grid.querySelectorAll(".wrong").forEach(w => w.classList.remove("wrong"));
            if (next < g.right.length) body.querySelector(".l-q").textContent = "What happened next?";
            await say(S(s.line)); if (!alive(r)) return res(false);
            if (next === g.right.length) { await wait(400); return res(true); }
            ask0();
          } else {
            t.classList.add("wrong"); no(); const right = sc[g.right[next]];
            say(L(`s.${id}`), L("p.hint"), ...(tries >= 2 ? [S(right.line)] : []));
          }
        };
        grid.append(t);
      });
      ask0();
    });
  }

  function finish(game, r) {
    if (!alive(r)) return; playing = false;
    const who = pick(["kapi", "bobo", "lulu"].filter(w => byId[w]?.img), rnd); sticker({ book, who, game, t: new Date().toISOString() });
    sfx("won", 3); star(1);
    const again = h("button", "l-btn gold", "Play again"), more = h("button", "l-btn", "Other games");
    again.onclick = () => start(game); more.onclick = picker;
    body.replaceChildren(h("div", "l-done", h("h2", "", "You finished!"), h("div", "l-sticker", pic(byId[who], "big"), h("span", "", byId[who].en)), h("div", "l-row", again, more)));
    say(L("p.done"));
  }
  picker();
}
