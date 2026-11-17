// The first page's sound: web/live/sound.js's soft pools served from web/landing/sfx/ (the "landing" library), the same popup-sound on/off key as the library.
// Nothing is loaded or played before the visitor's first tap, click or key (a scroll or a swipe is not a gesture for audio); reduced motion does not mute.
const get = k => { try { return localStorage.getItem(k); } catch { return null; } }, set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let off = get("popup-sound") === "off", gestured = false, snd = null, loading = null;  // off is kept in memory too: with storage blocked it still holds until the page closes
const log = window.__cueLog = [];
// the scroll page's beats still ask for the old mali names; they now play the landing sounds
const MAP = { "paper-rustle": "page-soft", "wind-whoosh": "portal-through" };
const BED_GAIN = 1.0, BED_FADE = 4000;  // the hum: a low, felt-not-heard bed, faded in over 4 s on the first gesture
let bedOn = false;
const startBed = () => {
  if (bedOn || off) return; bedOn = true;
  (loading ??= import("../live/sound.js").then(m => (window.__snd = snd = m.addSound(m.manifestFor("landing", "../")))).catch(() => null))
    .then(s => { if (!s) return; s.setBed([["library-hum", 0]]); const t0 = performance.now();
      const iv = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / BED_FADE); s.setBed([["library-hum", u * BED_GAIN]]); if (u >= 1) clearInterval(iv); }, 40); });
};
for (const ev of ["click", "keydown"]) addEventListener(ev, () => { gestured = true; startBed(); }, { capture: true, passive: true });  // a tap makes a click and a swipe does not: pointerdown and touchend both fire during a scrolling swipe
export const isOn = () => !off;
export const toggle = () => { off = !off; set("popup-sound", off ? "off" : "on"); snd?.mute(off); if (!off) startBed(); return !off; };
export const cue = (name, gain = 1) => {
  const ok = gestured && !off && (navigator.userActivation?.hasBeenActive ?? true); log.push({ name, ok, t: Math.round(performance.now()), y: Math.round(scrollY) }); if (!ok) return;
  (loading ??= import("../live/sound.js").then(m => (window.__snd = snd = m.addSound(m.manifestFor("landing", "../")))).catch(() => null)).then(s => s?.play(MAP[name] || name, { gain, tag: "landing" }));
};
