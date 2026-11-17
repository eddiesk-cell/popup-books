// Style "epic": the brand itself. A fixed full-screen scene (the site's own 3D book) sits behind a veiled foreground of gold lettering.
// Called by landing.js: init(ctx) once, frame(s) every frame. The scene never reads the page; this file feeds it progress (0..1 down the whole page) and pointer (-1..1).
const SCENE = "./epic/scene.js";
import { COVER_AT } from "./epic/timing.js";
const VEIL_THIN = .15;  // how dim the veil goes while no words are on screen after the hero has left (burst time). 1 = never thin it; the one variable to undo that choice.

// THE PROGRESS TABLE: what is on screen at each stretch of the page, and what the scene throws out behind it. The page lays its sections out to these ranges
// (a section is as tall as its ranges: K screens of scroll in all, see --K in epic.css); the scene's builder is given the same table.
export const PROGRESS = [
  // name,      from, to,  section,  what the scene shows
  ["book",      0.00, 0.12, "hero",    "closed book, dark; foreground: brand line and Scroll down"],
  ["open",      0.12, 0.26, "hero",    "the book sinks to the bottom and opens; the title arrives"],
  ["wake",      0.26, 0.66, "wake",    "Be inside the book: the burst and the stream of pictures"],
  ["enter",     0.66, 1.00, "close",   "Enter the library: the stream calms, the book glows"]
];

let sfx = () => {}, crossed = [false, false], logo, LG = { x: 0, top: 0, w: 1, k: 1 }, cueReady = false, heroFix, docH = 1, RM = false, scene, cue, cueOn = true, veil, poster, put0, P = 0, vo = 1, lastT = 0, vh = 800, TOP0 = 56, TOP1 = 100, BT1 = 500, BT0 = 550, panels = [];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const LEAD = .25, FADE = .15;  // in screens of scroll: a panel waits LEAD after its stretch begins, then fades in over FADE; it fades out over the last FADE of its stretch
const Q = p => (p < .2 ? .08 + p * .6 : p);  // page progress -> the scene's: the book answers the very first scroll (the scene's own timeline starts its sink at .08, so [0, .2] of the page plays [.08, .2] of it)

function foil(h) {  // gold-foil lettering: one span per letter, so letters can arrive one by one and the sheen can travel
  const text = h.textContent, words = text.split(" "); let n = 0;
  if (/[^\u0000-\u024F\u2000-\u206F]/.test(text)) { h.classList.add("foil", "plain"); return; }  // Lao, Thai, Chinese, Japanese: marks and vowels must stay with their letters and the browser breaks the lines, so the heading stays one piece of text with the gold on the whole
  h.setAttribute("aria-label", text); h.classList.add("foil"); h.textContent = "";
  words.forEach((w, i) => {
    const ws = document.createElement("span"); ws.className = "w"; ws.setAttribute("aria-hidden", "true");
    for (const ch of w) { const s = document.createElement("span"); s.className = "ch"; s.style.setProperty("--i", n++); s.textContent = ch; ws.append(s); }
    h.append(ws); if (i < words.length - 1) h.append(" ");
  });
  h.style.setProperty("--n", n);  // the CSS caps the stagger by this, so any heading is whole in under a second
}
function sparks(h) {  // a few gold sparks, once, as the heading arrives
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("i"); s.className = "sp"; s.onanimationend = () => s.remove();
    s.style.cssText = `left:${5 + Math.random() * 90}%;top:${10 + Math.random() * 80}%;--dx:${((Math.random() - .5) * 70).toFixed(0)}px;--dy:${(-20 - Math.random() * 40).toFixed(0)}px;animation-delay:${(.2 + Math.random() * 1.3).toFixed(2)}s`;
    h.append(s);
  }
}

export async function init({ world, T, reduce, qs, put, $, $$, cue: sfxCue = () => {} }) {
  sfx = sfxCue;
  // the page first: a still of the closed book (poster) shows from the first paint, the live scene is started without waiting and fades in over it; if it never comes the page still works
  RM = reduce; put0 = put; veil = document.createElement("div"); veil.className = "veil"; document.body.append(veil);
  poster = document.createElement("picture"); poster.id = "poster"; const u = n => new URL(`./epic/poster-${n}.webp`, import.meta.url).href;
  poster.innerHTML = `<source media="(min-aspect-ratio: 21/20)" srcset="${u("wide")}"><source media="(min-aspect-ratio: 29/50)" srcset="${u("mid")}"><img alt="" src="${u("tall")}" decoding="async">`;  // wide / mid / tall by the viewport's aspect
  const canvas = document.createElement("canvas"); canvas.id = "scene"; world.append(poster, canvas);
  const decoded = poster.lastChild.decode?.().catch(() => {}) ?? Promise.resolve();
  Promise.race([decoded, new Promise(r => setTimeout(r, 1500))]).then(() => import(SCENE)).then(m => m.mount(canvas, { reducedMotion: reduce })).then(s => {
    scene = window.__scene = s; s.resize(); s.progress(Q(P));
    if (world.querySelector("#scene") === canvas) canvas.classList.add("live"); else console.info("epic: the scene fell back to its still; the poster stays");
  }).catch(e => console.info("epic: no live scene, the poster stays", e));
  addEventListener("resize", () => scene?.resize());
  // the page is shown (and the fade starts) only when the logo and the book's still are decoded, so they ease in whole; on a slow link it fades in anyway after 4 s. The cue follows the fade by 1.4 s.
  const art = Promise.race([Promise.all([$("h1.logo img"), poster.lastChild].map(i => i.decode?.().catch(() => {}))), new Promise(r => setTimeout(r, 4000))]).then(() => setTimeout(() => { cueReady = true; update(scrollY); }, 1400));

  // the logo (the drawn gold artwork) is ONE fixed element at the top centre for the whole page (owner 2026-11-15): big on arrival, a compact size once the first scroll has begun, never under the scene, the veil or a panel
  logo = $("h1.logo"); document.body.append(logo);

  // layout: every section is as tall as its ranges
  const span = {}; PROGRESS.forEach(([, a, b, id]) => (span[id] = (span[id] || 0) + b - a));
  for (const id in span) $("#" + id).style.setProperty("--r", span[id].toFixed(2));

  // the main line under the title: ?line=1..5 previews the owner's options (all of them are in the copy object, T.hero.options)
  const n = +qs.get("line"); if (T.hero.options?.[n - 1]) $(".head p").textContent = T.hero.options[n - 1];

  // the scroll cue
  cue = document.createElement("a"); cue.className = "cue"; cue.href = "#wake"; cue.innerHTML = `<span></span><i></i>`; cue.firstChild.textContent = T.hero.scroll;
  $(".bar").after(cue);  // early in the tab order, where it sits on screen

  // gold lettering, text blocks, and the once-only arrival
  $$("main h1, main h2").forEach(foil);
  $$(".sec").forEach(s => { const b = document.createElement("div"); b.className = "blk"; b.append(...s.childNodes); s.append(b); });
  $$(".plaque > p").forEach(p => p.classList.add("line"));  // the closing line too
  // the title group is held above the book: one fixed panel (title, line, buttons) that arrives as the book has sunk clear of it, holds while the cover opens and leaves as the burst fires (heroFade)
  heroFix = document.createElement("div"); heroFix.className = "blk hero-fix"; heroFix.append($("#hero .head")); $("#hero").append(heroFix);
  $$(".plaque").forEach(p => p.classList.add("blk"));
  $("#hero").classList.add("in", "now"); $$("#hero .foil").forEach(h => h.classList.add("in", "vis"));
  $$("main section").forEach(s => { let k = 0; s.querySelectorAll(".line,.sub,.card,.chips,.keep,.foot,.head p,.plaque > .btn").forEach(e => e.style.setProperty("--k", k++)); });
  // buttons that do nothing yet keep their plain name (owner: no "soon" on them) and look quieter; a tap shows a short note under them (.btn.soon in epic.css)
  $$(".btn[aria-disabled=true]").forEach(b => { b.dataset.soon = T.nav.soon; b.onclick = () => { b.classList.add("soon"); clearTimeout(b.__t); b.__t = setTimeout(() => b.classList.remove("soon"), 1800); }; });
  const anchors = ["#wake .plaque", "#close .plaque"].map(q => $(q));

  // Each section's words are ONE panel (heading, words, cards or buttons together), fixed in the band between the logo and the open book and faded in and out as a whole across its own stretch of the page (the progress table).
  // Nothing inside a panel fades on its own. A panel taller than the band is scaled down to fit (the layout in epic.css is built so that it rarely has to be).
  const ids = ["wake", "close"], rng = {};
  PROGRESS.forEach(([, a, b, id]) => { rng[id] = [Math.min(a, rng[id]?.[0] ?? 9), Math.max(b, rng[id]?.[1] ?? 0)]; });
  panels = anchors.map((el, i) => { el.classList.add("panel"); const sheet = document.createElement("div"); sheet.className = "sheet"; sheet.setAttribute("aria-hidden", "true"); el.prepend(sheet); for (const c of "tb") { const r = document.createElement("i"); r.className = "roll " + c; r.setAttribute("aria-hidden", "true"); el.append(r); } return { sheet, id: ids[i], el, sec: el.closest("section"), a: rng[ids[i]][0], b: rng[ids[i]][1], last: ids[i] === "close", seen: false }; });
  const measure = () => {
    vh = innerHeight; docH = document.documentElement.scrollHeight; const asp = innerWidth / vh;
    const wd = innerWidth, ar = $(".acct").getBoundingClientRect(), big = Math.min(wd < 600 ? .84 * wd : .34 * wd, .46 * vh * 1.51), small = Math.min(Math.max(.13 * wd, wd < 600 ? .42 * wd : 150), 260);  // the logo's width on arrival, and once the first scroll has begun
    LG = { x: wd / 2, top: ar.bottom + 6, w: big, k: small / big }; logo.style.width = big + "px"; const lh = small * 581 / 878;
    TOP0 = LG.top + lh + 8; document.documentElement.style.setProperty("--ht", (TOP0 + 4) + "px"); BT0 = vh * (asp >= 1.05 ? .686 : asp < .58 ? .72 : .70) - 6;  // the band: under the compact logo, above the open book's top edge (.686 of the height wide, .70 mid, .72 tall, measured)
    const band = BT0 - TOP0, H = Math.max(docH - vh, 1);
    for (const k of panels) { k.el.style.scale = ""; const h = k.el.offsetHeight, s = Math.min(1, band / h); k.s = s; k.h = h;
      k.el.style.setProperty("--pt", (TOP0 + (band - h * s) / 2).toFixed(1) + "px"); if (s < 1) k.el.style.scale = s.toFixed(3);
      k.y0 = k.a * H + LEAD * vh; k.y1 = k.b * H; }  // a panel comes in a beat after its stretch begins (the burst plays first) and leaves as the next stretch begins
    update(scrollY);
  };
  addEventListener("resize", measure); addEventListener("load", measure); document.fonts?.ready.then(measure); new ResizeObserver(measure).observe($("main")); measure();
  // a focused control's panel shows whole at once: the page jumps to the middle of that panel's stretch
  addEventListener("focusin", e => { const el = e.target;
    if (el.closest?.(".hero-fix")) { scrollTo({ top: .13 * (docH - vh), behavior: "instant" }); P = .13; update(scrollY); return; }
    const k = panels.find(q => q.el.contains(el)); if (!k) return;
    k.sec.classList.add("now");  // no arrival transition for a focused control: it is whole at once
    if (scrollY < k.y0 + FADE * vh || (!k.last && scrollY > k.y1 - FADE * vh)) { scrollTo({ top: (k.y0 + k.y1) / 2, behavior: "instant" }); P = clamp(scrollY / Math.max(docH - vh, 1)); }
    el.closest(".grid")?.scrollWidth > el.closest(".grid")?.clientWidth && el.closest(".card")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });  // a card in the swipe row: bring the whole card into the row
    update(scrollY); });
  if (reduce) {  // nothing moves by itself, but the scene still follows the scroll (the wonders hang still) and the panels still follow the scroll
    const follow = () => { P = clamp(scrollY / Math.max(document.documentElement.scrollHeight - innerHeight, 1)); scene?.progress(Q(P)); update(scrollY); };
    addEventListener("scroll", follow, { passive: true }); addEventListener("resize", follow); follow();
    $$(".foil").forEach(h => h.classList.add("in", "vis")); await art; return;
  }
  await art;
}

const ramp = (v, a, b) => clamp((v - a) / (b - a)), sm = t => t * t * (3 - 2 * t);
// the leave: from however far open the scroll is this frame (an arrival half done included), by script, so nothing ever jumps to the open scroll first: it rolls up (--u to 0, the bottom roller back to the top one), then sinks (down when left downward, up when left upward) and fades
function rollUp(k, up) { const cs = getComputedStyle(k.el), u = parseFloat(cs.getPropertyValue("--u")) || 0, t = 150 + 750 * u, dur = t + 600, mt = cs.marginTop; k.sink?.cancel(); k.dur = dur;
  k.sink = k.el.animate([{ "--u": u, marginTop: mt, opacity: cs.opacity, easing: "cubic-bezier(.5, 0, .2, 1)" }, { "--u": 0, marginTop: mt, opacity: cs.opacity, offset: t / dur, easing: "cubic-bezier(.5, 0, .8, .4)" }, { "--u": 0, marginTop: up ? "-60px" : "90px", opacity: 0 }], { duration: dur, fill: "forwards" }); }
function update(y, t = lastT) {
  const put = put0; let words = false;
  const busy = panels.find(q => q.sinking && performance.now() < q.until);  // a scroll still rolling up and sinking: the next one waits for it, so two parchments never stack
  for (const k of panels) {
    if (k.y1 === undefined) continue;
    const now = performance.now(), down = !k.last && y > k.y1 - FADE * vh, arrived = y > k.y0 - (k.seen ? .06 * vh : 0) && !(busy && busy !== k && !k.seen), up = !RM && k.seen && !arrived, past = down || up;  // arrived has a little slack once shown, so the edge does not flicker
    const f = RM ? sm(ramp(y, k.y0, k.y0 + FADE * vh)) * (k.last ? 1 : 1 - sm(ramp(y, k.y1 - FADE * vh, k.y1))) : arrived && !down ? 1 : 0;  // with motion the scroll itself is the arrival and the leave (rollUp); reduced motion: a plain fade
    if (past && !k.past && k.seen && !RM) { k.sinking = true; k.sinkT = now; rollUp(k, up); k.until = now + k.dur + 100; }  // only a panel that was showing sinks; coming back from below or above it simply arrives again
    if (!past && k.sinking && k.seen && now - k.sinkT < k.dur) {  // a leave undone while the scroll is still on its way out: it runs back from where it is
      k.el.classList.remove("leaving"); const a = k.sink; a.onfinish = () => { if (a.playbackRate < 0) a.cancel(); }; a.reverse();
    } else if (!past && k.sinking && k.seen) { k.sink?.cancel(); k.sink = null; k.sec.classList.remove("in"); k.el.querySelectorAll(".foil").forEach(h => h.classList.remove("in", "vis")); void k.sec.offsetWidth; k.seen = false; }  // a leave that already ended: the whole arrival (rise, unroll and words) starts again, never bare words
    if (!past) k.sinking = false; k.past = past; const hold = !!k.sinking && now < k.until;
    k.el.classList.toggle("leaving", !!k.sinking); put(k.el, "--pf", hold ? 1 : f); k.el.classList.toggle("on", f > .3 || hold); if (f > .3) words = true;
    const seen = f > .02 || hold; if (seen !== k.seen) { k.seen = seen; if (seen) { k.sink?.cancel(); k.sink = null; } if (!seen) k.sinking = false; k.sec.classList.toggle("in", seen); if (seen) sfx("paper-rustle", .8); k.el.querySelectorAll(".foil").forEach(h => { h.classList.toggle("in", seen); h.classList.toggle("vis", seen); if (seen && !RM) sparks(h); }); }  // the letters arrive each time the panel does
  }
  const hf = sm(ramp(Q(P), COVER_AT, COVER_AT + .01)) * (1 - sm(ramp(Q(P), .19, .2))); put(heroFix, "--hf", hf); heroFix.classList.toggle("off", hf < .3); words ||= hf > .3;
  const r = sm(ramp(P, 0, .06)), sc = 1 + (LG.k - 1) * r;  // arrival size -> compact, as the first scroll begins; the top edge stays put
  put(logo, "--lx", LG.x); put(logo, "--ly", LG.top + LG.w * 581 / 878 * sc / 2); put(logo, "--ls", sc);
  cue.classList.toggle("on", cueReady && y < 8);  // the cue arrives a beat after the fade-in and is gone for good at the first scroll (a return to the top brings it back)
  // burst time: no words on screen after the hero has left, so the veil thins and the burst is the one loud beat; words coming back bring it back
  [COVER_AT, .2].forEach((at, i) => { const c = Q(P) > at; if (c !== crossed[i]) { crossed[i] = c; if (c) sfx("wind-whoosh", .5); } });  // the cover starts to open (the scene's own COVER_AT) and the burst (.2): a page whoosh each time the scroll crosses them downward
  const want = !words && Q(P) > COVER_AT && !RM ? VEIL_THIN : 1;
  vo += (want - vo) * (1 - Math.exp(-((t - lastT) || 16) / 300)); lastT = t; put(veil, "--vo", vo);
}

export function frame({ p, y, t, cx, cy }) {
  P = p; scene?.progress(Q(p)); scene?.pointer(cx, cy); update(y, t);
}
