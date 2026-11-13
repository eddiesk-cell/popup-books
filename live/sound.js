// sound.js — the living world's sound: looping ambience beds + one-shot foley, ducked under the narration.
//
// Integration (two lines, for the viewer lane):
//   import { addSound, manifestFor } from "./sound.js";
//   const snd = addSound(manifestFor("kapi", "../"), { reader, voices: [speakAudio] });   // fades run on the audio clock; per spread: snd.setBed(spread.sound.bed, nextSpread.sound.bed);
//   // setBed takes the director's pairs [["river-slow", 0.3], ["birds-day", 0.18]] (or plain names); snd.play("page-turn", {gain: 0.6}) for foley.
//   // wire the page's sound button to snd.mute(!snd.muted) — the choice is remembered per viewer.
//
// `reader` is narrate.js's Reader: its audio element's play/pause/ended events duck everything ~10 dB.
// Narration itself never goes through this module, so it always stays on top.

// Names are the sound libraries at the end of stories/*/DIRECTION.md; files are web/<book>/sfx/<name>.m4a.
// page-turn also has page-turn-2 and page-turn-3 (picked at random).
// shortcut: most files are synthesized placeholders (numpy), listed in web/sfx-placeholders.md; replace in place, same names.
const LIB = {
 "kapi": {
  "beds": "river-slow birds-day birds-morning birds-afternoon birds-dusk birds-far leaves-breeze insects-day water-lap cowbells-far river-evening crickets village-evening village-day frogs-chorus night-frogs night-breeze river-night river-flowing wind-breezy river-deep wind-gusty",
  "shots": "page-turn paper-rustle paper-pat leaves-shake leaves-rustle-big paper-steps bark-scramble jamun-pluck jamun-chomp seed-flick tail-splash water-swish water-swish-big kapi-giggle kapi-land bobo-yawn laugh-trio straw-rustle firefly-chime star-chime moon-shimmer chime-soft sand-shift splash-small hush-swell wave-slap idea-pling paper-grip relief-chime seed-plop cheer-chime seed-glow wade gulp heron-croak plop kingfisher-call parakeet-chatter parakeet-squawk squirrel-chirp wing-buzz frog-croak frog-plop fish-rise oar-splash boatman-hum buffalo-snort buffalo-moo lapwing-call crab-click owl-hoot bat-flutter duck-quack duckling-peep otter-squeak pot-fill"
 },
 "mali": {
  "beds": "crickets frogs-chorus river-night festival-murmur khaen-music river-night-still festival-far market-murmur water-lap-boats wind-chimes rope-creak spirit-hum lullaby-hum",
  "shots": "page-turn paper-rustle paper-pat moon-shimmer splash-small wade gulp heron-croak frog-croak frog-plop fish-rise oar-splash boatman-hum crab-click owl-hoot bat-flutter wood-steps wind-whoosh string-snap kite-flap candle-light wind-chime lantern-tap boat-release child-giggle khaen-run dog-woof cat-mew gecko-chirp stone-rise bridge-shimmer hop-land turtle-blink lanterns-dim lantern-relight market-cheer basket-creak pip-chirp cloth-rustle bell-tinkle scale-clink sprite-giggle shrine-tinkle moth-flutter tong-sniffle leaf-rustle lamp-clink shadow-chime music-box snore lotus-bell-2 lotus-bell-4 nok-song wood-knock gold-shimmer lantern-up rise-swell door-creak pip-glow flame-catch"
 }
};
const VARIANTS = { "page-turn": 3 };
const DUCK = 0.4, HOLD_MS = 1500, BED = 0.28, FOLEY = 0.9, LOOP_PAD = 1;
// DUCK -8 dB while any voice speaks (DIRECTION.md says half = -6 dB), held 1.5 s after the last line. BED scales the director's layer gains:
// beds mix near -40 LUFS against narration at -27. Bed files carry LOOP_PAD seconds of the loop's own audio at both ends (AAC edge artefacts fall outside the loop).

// manifest for a book; `root` is the path from the page to web/ (e.g. "../" from web/live/)
export function manifestFor(book, root = "") {
  // an unknown book gets no beds and only the foley both books share, served from kapi's folder
  const known = !!LIB[book], dir = known ? book : "kapi", url = (n) => `${root}${dir}/sfx/${n}.m4a`, beds = {}, sounds = {};
  const L = known ? LIB[book] : { beds: "", shots: LIB.kapi.shots.split(" ").filter(n => LIB.mali.shots.split(" ").includes(n)).join(" ") };
  for (const n of L.beds.split(" ").filter(Boolean)) beds[n] = url(n);
  for (const n of L.shots.split(" ")) sounds[n] = [url(n), ...Array.from({ length: (VARIANTS[n] || 1) - 1 }, (_, i) => url(`${n}-${i + 2}`))];
  return { beds, sounds };
}

export function addSound(manifest, { reader, voices = [], ctx } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx) { try { ctx = new AC({ sampleRate: 22050 }); } catch { ctx = new AC(); } }  // 22 kHz halves the decoded memory
  const master = ctx.createGain(), duckG = ctx.createGain();
  duckG.connect(master); master.connect(ctx.destination);
  const buffers = {}, loading = {}, beds = {}, want = new Map(), warned = new Set(), bedUrls = new Set(Object.values(manifest.beds));
  let muted = false;
  try { muted = localStorage.getItem("popup-sound") === "off"; } catch { /* private window: default on */ }
  master.gain.value = muted ? 0 : 1;

  // all fades run on the audio clock, so a slow render loop or a hidden tab cannot stall them
  const ramp = (param, v, tc) => { const t = ctx.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.setTargetAtTime(v, t, tc); };
  const wake = () => { if (ctx.state !== "running") ctx.resume().catch(() => {}); };
  // iPad: WebKit unlocks audio on touchend/click, not pointerdown; keep trying until it runs
  for (const ev of ["pointerdown", "touchend", "click", "keydown"]) addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => document.hidden ? ctx.suspend().catch(() => {}) : wake());

  // a failed or missing file warns once, is never cached as a failure, and resolves null instead of throwing
  const load = (url) => buffers[url] ? Promise.resolve(buffers[url]) : loading[url] ||
    (loading[url] = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error("HTTP " + r.status)))
      .then(b => ctx.decodeAudioData(b)).then(b => (delete loading[url], buffers[url] = b))
      .catch(e => { delete loading[url]; if (!warned.has(url)) { warned.add(url); console.warn("sound: could not load", url, e?.message || e); } return null; }));

  // ducking: down fast when a voice starts; back up ~1.5 s after the last voice stops, so line gaps stay ducked
  const speaking = new Set(); let hold = 0, ducked = false;
  // failed: no next line is coming to hold the duck for, so the beds come straight back up (well within a second)
  const duck = (on, failed) => { ducked = !!on; clearTimeout(hold); if (on) ramp(duckG.gain, DUCK, 0.08); else hold = setTimeout(() => ramp(duckG.gain, 1, failed ? 0.15 : 0.35), failed ? 0 : HOLD_MS); };
  const watch = (a) => {
    for (const ev of ["play", "playing"]) a.addEventListener(ev, () => { speaking.add(a); duck(true); });
    for (const ev of ["pause", "ended", "emptied", "error", "stalled", "abort"])  // a voice that fails or stalls mid-play lets the beds back up
      a.addEventListener(ev, () => { speaking.delete(a); if (!speaking.size) duck(false, /error|stalled|abort/.test(ev)); });
  };
  [reader?.audio, ...voices].forEach(a => a && watch(a));

  // the book's The End card is up (the viewer's #moral): the diorama under it is still, so no extra calls out; the bed stays, low.
  // shortcut: reads the viewer's element; take a flag from live.js if the card ever moves
  const theEnd = () => document.getElementById("moral")?.hidden === false;

  const release = (n) => { const b = beds[n]; if (!b || want.has(n)) return; try { b.src?.stop(); } catch { /* not started */ } b.g.disconnect(); delete beds[n]; };
  const api = {
    ctx, get muted() { return muted; }, get ducked() { return ducked; },
    load, buffers, duck,
    // one-shot with a little random pitch so repeats never sound identical
    async play(name, { gain = 1, pitch = 1 } = {}) {
      const urls = manifest.sounds[name]; if (!urls || muted || theEnd()) return;
      wake();
      const buf = await load(urls[Math.floor(Math.random() * urls.length)]); if (!buf) return;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.playbackRate.value = pitch * (0.94 + Math.random() * 0.12); g.gain.value = FOLEY * gain;
      s.connect(g); g.connect(duckG); s.onended = () => { s.disconnect(); g.disconnect(); }; s.start();
    },
    // layers: names or [name, gain]; they fade in (~2 s), every other bed fades out and is then stopped and freed.
    // `next` (optional) lists the following spread's beds: they are decoded ahead and kept, everything else is dropped.
    async setBed(layers, next = []) {
      want.clear();
      for (const l of layers) { const [n, g = 0.3] = [].concat(l); want.set(n, g); }
      for (const [n, g] of want) {
        const url = manifest.beds[n]; if (!url) continue;
        let b = beds[n];
        if (!b) {
          b = beds[n] = { g: ctx.createGain(), src: null }; b.g.gain.value = 0; b.g.connect(duckG);
          load(url).then(buf => {
            if (!buf || beds[n] !== b) { if (!buf && beds[n] === b) delete beds[n]; return; }  // failed: retried on the next setBed
            const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
            s.loopStart = LOOP_PAD; s.loopEnd = Math.max(LOOP_PAD + 0.1, buf.duration - LOOP_PAD);  // files carry 1 s of the loop's own audio each side
            s.connect(b.g); s.start(0, s.loopStart + Math.random() * (s.loopEnd - s.loopStart)); b.src = s;
          });
        }
        ramp(b.g.gain, g * BED, 0.7);
      }
      for (const n of Object.keys(beds)) if (!want.has(n)) { ramp(beds[n].g.gain, 0, 0.7); setTimeout(() => release(n), 4000); }
      const keep = new Set([...want.keys(), ...next].map(n => manifest.beds[n]));
      for (const u of bedUrls) if (!keep.has(u)) delete buffers[u];  // bounded memory: current + next spread only
      for (const n of next) if (manifest.beds[n]) load(manifest.beds[n]);
      wake();
    },
    mute(on) {
      muted = !!on; ramp(master.gain, muted ? 0 : 1, 0.05);
      try { localStorage.setItem("popup-sound", muted ? "off" : "on"); } catch { /* not remembered */ }
      if (!muted) wake();
    },
    update() {},  // kept for callers: everything now runs on the audio clock
    state: () => ({ duck: duckG.gain.value, mute: master.gain.value, beds: Object.fromEntries(Object.entries(beds).map(([n, b]) => [n, b.g.gain.value])) }),
  };
  return api;
}
