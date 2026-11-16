"use strict";
const STYLE = "epic";  // THE one setting: which style is live ("tale" or "epic"). ?style=tale|epic overrides it for preview.

// Every line of copy lives in T (English) and in lang.js (Lao, Thai, Chinese, Japanese, Korean, the same keys). Nothing below holds words, except each language's own name in the picker.
const T = {
  brand: "Wonder of Saya Tales",
  // Very easy English (owner 2026-11-15: "The words ... sounds confusing, maybe reword them, easer to understand"; "remember these are children books, and books for people who are learning English"):
  // short sentences, everyday words a beginner knows, present tense, no idioms.
  meta: "Pop-up storybooks for children. Read, listen and learn English.",
  nav: { signin: "Sign in", signup: "Sign up", soon: "Opening soon", lang: "Language", snd: "Sound", on: "on", off: "off", menu: "Menu" },
  alt: { world: "A closed storybook in the dark. It opens, and pictures from many stories fly out of it." },
  hero: { title: "Wonder of Saya Tales", line: "Pop-up storybooks for children. Read, listen and learn English.", scroll: "Scroll down" },
  wake: { h: "Be inside the book", a: "Feel the real adventure as it happens, as if you were there.", b: "" },  // owner 2026-11-15: "Be inside the book, feel the real adventure as it happens as if you're there"
  fly: { h: "Animals walk, swim and fly", a: "A crocodile swims in the river. A butterfly flies by. A bird sings in a tree.", b: "Some are near and some are far. Every page looks like a real place." },
  worlds: { h: "Every page is a new place", a: "Rivers, markets, villages and the sky.", b: "Stories from Laos, India, the Philippines and more." },
  doors: { h: "Read, sing, dance and play", sub: "Four ways to enjoy every story.", items: [
    { n: "Read", d: "Turn the pages. Listen to the story.", s: "Ready now", open: 1 },
    { n: "Sing", d: "Sing the story as a song.", s: "Coming soon" },
    { n: "Dance", d: "Dance with your child.", s: "Coming soon" },
    { n: "Play", d: "Play games from the story.", s: "Coming soon" }] },
  lang: { h: "Learn English while you read", a: "Hear the story in English. See the words in your language too.", b: "Tap a word. Hear it. Say it.",
    names: [["English", "en"], ["ລາວ", "lo"], ["ไทย", "th"], ["中文", "zh"], ["日本語", "ja"], ["한국어", "ko"], ["and more coming", "en"]] },
  parents: { h: "For parents", items: [
    { n: "New words", d: "Your child learns new words on every page." },
    { n: "The world", d: "Stories from many countries." },
    { n: "Kindness", d: "Every story ends with a kind lesson." }],
    note: "No ads. A parent owns the account." },
  plans: { h: "Plans", keep: "Or buy one book. Keep it forever.", price: "Price coming soon", items: [
    { n: "Free", d: "One book, free. Read it again and again.", p: "Free", b: "Start free" },
    { n: "Story", d: "All the books.", b: "Choose Story", pick: 1 },
    { n: "Wonder", d: "All the books, plus songs, dances and games.", b: "Choose Wonder" }] },
  close: { h: "The library is open", a: "Pick a book and start reading.", btn: "Come inside" }
};

import * as sfx from "./cue.js";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), sm = t => t * t * (3 - 2 * t);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const qs = new URLSearchParams(location.search), asked = qs.get("style") || "";
const S = /^[a-z]{2,12}$/.test(asked) ? asked : STYLE;
// per-element cache: write a custom property only when it changed
const put = (el, k, v) => { const c = el.__c || (el.__c = {}), n = +v.toFixed(4); if (c[k] !== n) { c[k] = n; el.style.setProperty(k, n); } };

// ---- the style's files, fetched in parallel: a visitor downloads one style only
const link = document.createElement("link"); link.rel = "stylesheet"; link.href = `styles/${S}.css`;
const cssReady = new Promise(r => { link.onload = link.onerror = r; }); document.head.append(link);
const mod = import(`./styles/${S}.js`);

// ---- the language: ?lang= (a preview), else the visitor's saved choice, else the first of the browser's languages we have, else English
const NAMES = [["en", "English"], ["lo", "ລາວ"], ["th", "ไทย"], ["zh", "中文"], ["ja", "日本語"], ["ko", "한국어"]], CODES = NAMES.map(n => n[0]);
let lang = qs.get("lang"); if (!CODES.includes(lang)) { try { lang = localStorage.getItem("wst-lang"); } catch { lang = null; } }
if (!CODES.includes(lang)) lang = (navigator.languages || [navigator.language || "en"]).map(c => CODES.find(x => String(c).toLowerCase().startsWith(x))).find(Boolean) || "en";
document.documentElement.lang = lang;
const fonts = qs.get("fonts"); if (/^[bc]$/.test(fonts)) document.documentElement.classList.add("fonts-" + fonts);  // the owner can try the other pairings live: ?fonts=b (Cinzel + Cormorant), ?fonts=c (Marcellus + EB Garamond)

// ---- words
const L = {}; if (lang === "en") { for (const k in T) if (k !== "by") L[k] = typeof T[k] === "string" ? T[k] : { ...T[k], ...(T.by?.[S]?.[k] || {}) }; } else Object.assign(L, (await import("./lang.js")).TR[lang]);
document.title = L.brand; $("meta[name=description]").content = L.meta;
const pick = $("#langpick"); pick.innerHTML = NAMES.map(([c, n]) => `<option value="${c}" lang="${c}"${c === lang ? " selected" : ""}>${n}</option>`).join(""); pick.setAttribute("aria-label", L.nav.lang);
pick.onchange = () => { try { localStorage.setItem("wst-lang", pick.value); } catch {} const u = new URL(location.href); if (u.searchParams.has("lang")) { u.searchParams.set("lang", pick.value); location.href = u.href; } else location.reload(); };  // a new language rebuilds the page's words, letters and measures from scratch: a reload is the one safe way
const get = (o, p) => p.split(".").reduce((a, k) => a[k], o);
$$("[data-t]").forEach(e => { const v = get(L, e.dataset.t); e.textContent = v; if (!v) e.hidden = true; });
const card = (c, inner) => `<article class="card"><h3>${c.n}</h3>${inner}</article>`;
$("[data-list=doors]").innerHTML = L.doors.items.map(c => card(c, `<p>${c.d}</p><span class="tag${c.open ? " open" : ""}">${c.s}</span>`)).join("");
$("[data-list=langs]").innerHTML = L.lang.names.map(([n, l]) => `<li lang="${l}">${n}</li>`).join("");
$("[data-list=parents]").innerHTML = L.parents.items.map(c => card(c, `<p>${c.d}</p>`)).join("");
$("[data-list=plans]").innerHTML = L.plans.items.map(c => `<article class="card${c.pick ? " pick" : ""}"><h3>${c.n}</h3><p>${c.d}</p><p class="price">${c.p || L.plans.price}</p><button class="btn" type="button" aria-disabled="true">${c.b}</button></article>`).join("");
$("#world").setAttribute("aria-label", L.alt.world);
// ---- sound toggle (one choice for both pages), names for the disabled buttons, and the swipe rows as named groups
const snd = $("#snd"), sndLabel = () => { snd.textContent = `${L.nav.snd}: ${sfx.isOn() ? L.nav.on : L.nav.off}`; };
snd.onclick = () => { sfx.toggle(); sndLabel(); }; sndLabel();
// the menu (the library's pattern): a three-line button on the left holds the language and Sound; Enter or Space opens it and focus goes to the first item, Esc closes it and focus returns to the button
const menu = $("#menu"), panel = $("#panel"), openMenu = (on, back) => { panel.hidden = !on; menu.setAttribute("aria-expanded", on); if (on) pick.focus({ focusVisible: kb }); else if (back) menu.focus(); };
menu.setAttribute("aria-label", L.nav.menu); let kb = false;  // a keyboard open shows the focus ring, a mouse or tap open does not
menu.onclick = e => { kb = e.detail === 0; openMenu(panel.hidden); };
const away = e => { const t = e.relatedTarget; if (t && !panel.hidden && !panel.contains(t) && t !== menu) openMenu(false); };  // Tab out of the menu closes it
panel.addEventListener("focusout", away); menu.addEventListener("focusout", away);
addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) openMenu(false, true); });
addEventListener("pointerdown", e => { if (!panel.hidden && !panel.contains(e.target) && !menu.contains(e.target)) openMenu(false); });
$$(".btn[aria-disabled=true]").forEach(b => b.setAttribute("aria-label", `${b.textContent}, ${L.nav.soon}`));
const rows = $$(".sec .grid"), narrow = matchMedia("(max-width: 700px)"), stops = () => rows.forEach(g => narrow.matches ? g.setAttribute("tabindex", "0") : g.removeAttribute("tabindex"));
rows.forEach(g => { g.setAttribute("role", "group"); g.setAttribute("aria-label", g.closest("section").querySelector("h2").textContent); }); stops(); narrow.addEventListener("change", stops);  // the swipe rows scroll only at phone width, so only there are they a tab stop; a rotation moves it

// ---- the style
const style = await mod;
await cssReady;
await style.init({ world: $("#world"), close: $("#close .scene"), T: L, cue: sfx.cue, reduce, qs, put, clamp, sm, $, $$ });
document.documentElement.classList.remove("pre");

// ---- the scroll engine: pointer and scroll in, one loop, the style's frame() out. State given to the style:
// y scroll, vh, p whole-page progress 0..1, tr per-track progress [wake, fly, worlds], geo track geometry, cx/cy smoothed pointer -1..1, put()
if (!reduce) {
  const tracks = $$(".track");
  let tx = 0, ty = 0, cx = 0, cy = 0, lastIn = -9e9, geo = [], docH = 1, raf = 0;
  const point = (x, y) => { tx = clamp(x / innerWidth * 2 - 1, -1, 1); ty = clamp(y / innerHeight * 2 - 1, -1, 1); lastIn = performance.now(); };
  addEventListener("pointermove", e => point(e.clientX, e.clientY), { passive: true });
  addEventListener("touchmove", e => point(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  // shortcut: tilt only where it needs no permission prompt (Android); iPhones fall back to finger and idle sway, upgrade if a prompt is wanted
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== "function")
    addEventListener("deviceorientation", e => e.gamma != null && point((clamp(e.gamma, -25, 25) / 25 + 1) * innerWidth / 2, (clamp((e.beta || 0) - 40, -25, 25) / 25 + 1) * innerHeight / 2), { passive: true });
  const measure = () => { geo = tracks.map(t => { const r = t.getBoundingClientRect(); return [r.top + scrollY, r.height - innerHeight]; }); docH = document.documentElement.scrollHeight; };
  addEventListener("resize", measure); addEventListener("load", measure); document.fonts?.ready.then(measure); measure();

  function frame(t) {
    raf = 0;
    const y = scrollY, vh = innerHeight;
    const tr = geo.map(([top, len], i) => { const v = clamp((y - top) / Math.max(len, 1)); put(tracks[i], "--s", v); return v; });
    const idle = t - lastIn > 4000;  // no pointer for a while: a slow sway so the scene never sits dead
    const gx = idle ? Math.sin(t / 3200) * .35 : tx, gy = idle ? Math.cos(t / 4100) * .2 : ty;
    cx += (gx - cx) * .08; cy += (gy - cy) * .08;
    style.frame({ y, vh, t, p: clamp(y / Math.max(docH - vh, 1)), tr, geo, cx, cy, put });
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) raf = requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
}
