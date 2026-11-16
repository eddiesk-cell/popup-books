// The first page's sound: web/live/sound.js's soft recorded pools (mali's folder holds paper-rustle and wind-whoosh), the same popup-sound on/off key as the library.
// Nothing is loaded or played before the visitor's first tap, click or key (a scroll or a swipe is not a gesture for audio); reduced motion does not mute.
const get = k => { try { return localStorage.getItem(k); } catch { return null; } }, set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let off = get("popup-sound") === "off", gestured = false, snd = null, loading = null;  // off is kept in memory too: with storage blocked it still holds until the page closes
const log = window.__cueLog = [];
for (const ev of ["click", "keydown"]) addEventListener(ev, () => { gestured = true; }, { capture: true, passive: true });  // a tap makes a click and a swipe does not: pointerdown and touchend both fire during a scrolling swipe
export const isOn = () => !off;
export const toggle = () => { off = !off; set("popup-sound", off ? "off" : "on"); snd?.mute(off); return !off; };
export const cue = (name, gain = 1) => {
  const ok = gestured && !off && (navigator.userActivation?.hasBeenActive ?? true); log.push({ name, ok, t: Math.round(performance.now()), y: Math.round(scrollY) }); if (!ok) return;
  (loading ??= import("../live/sound.js").then(m => (window.__snd = snd = m.addSound(m.manifestFor("mali", "../")))).catch(() => null)).then(s => s?.play(name, { gain, tag: "landing" }));
};
