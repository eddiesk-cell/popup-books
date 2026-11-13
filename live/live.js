// live.js — the pop-up book as a live 3D scene, spread after spread. Each spread is exported by tools/popup.py --web:
// sNN/spread.glb (the paper scene, its whole timeline baked as one clip, frame f at (f-1)/24), sNN/exit.glb (the page
// turning away to the next spread's text page) and sNN/spread.json (camera, lights, characters loaded live, targets,
// touch, acts; the contract is in LIVE-MASTERPLAN.md). Page turns are scrubbed by the reader's finger through PageDrag
// (flip.js), so they feel like the Mali book; a spread comes alive and loops, the Reader reads it, the characters act
// it out, taps make things react, and after the last spread comes the moral.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
import { PageDrag } from "../flip.js";
import { Reader } from "../narrate.js";
import { markWords } from "../book.js";
import { loadWords, languages, touchLine, unlock } from "../reading.js";
import { Acting, mount, carry, puppetModel, byRim } from "./acts.js";
import { makeGame, glow } from "./games.js";
import { addSound, manifestFor } from "./sound.js";
import { ambient, skyline, roomShown, storyPuppet, swingRig } from "./ambient.js";

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search), FPS = 24, rad = THREE.MathUtils.degToRad;
// ?book=mali&s=s03: the book's words, voice and story live in web/<book>/ (book.json names its files); its spreads in
// web/live/<book>-sNN/, except Kapi's, which the builder writes to web/live/sNN/. A spread id with a slash is a folder
// under web/live/ as it stands (test/s02).
const bookId = q.get("book") || "kapi", first = q.get("s") || "s01", lib = `../${bookId}/`;
const bare = id => id.split("/").pop().replace(`${bookId}-`, "");  // "mali-s01" or "s01": book.json's "s01"
const dirOf = id => (bookId === "kapi" || id.includes("/") ? id : `${bookId}-${bare(id)}`);
const B = ([x, y, z]) => new THREE.Vector3(x, z, -y);  // Blender (z up) -> three (y up)
const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * k * (k * (6 * k - 15) + 10); };
const bloom = (f, start, len) => { const k = smooth(start, start + len, f); return k && k + Math.sin(k * Math.PI) * 0.18; };  // as popup.py
const note = (t, stub) => { $("note").textContent = t; $("note").hidden = !t; $("note").classList.toggle("stub", !!stub); };
const WORLD = { night: [0.004, 0.006, 0.016], evening: [0.03, 0.02, 0.03], day: [0.08, 0.1, 0.14] };  // popup.py STAGES "world"
const REACTIONS = ["Wave", "Cheer", "Jump", "Snap", "Laugh"];  // whichever of these a character has, a tap plays one

// ---------- renderer, scene, post ----------
const canvas = $("view"), renderer = new THREE.WebGLRenderer({ canvas });
canvas.addEventListener("webglcontextlost", e => (e.preventDefault(), location.reload()));  // a phone that drops the GPU blanks the book and freezes it: reload; the address names the page on the desk, so it reopens there
let dpr = Math.min(devicePixelRatio, 1.5);  // retina at 2x costs most of a frame (review A3E2 #10): 1.5, and 1 if frames stay slow
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;  // matched to the Blender plate b1-84 in headless Chrome: spread 1 at home 102/99/68 vs 105/99/66 (1.0: 133/130/95)
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;  // r187 dropped PCFSoft; radius softens
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.02, 40);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, cam));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 1.2));  // above 1.2 only the glowing bits bloom, never the white paper
composer.addPass(new OutputPass());

// ---------- the book: words, voices, story ----------
const book = await json(`${lib}book.json`).catch(e => console.warn(e));
if (!book) { note("This book is not ready yet. Please come back soon!"); await new Promise(() => {}); }  // stop here, quietly
const words = await loadWords(lib, book), { story, timing, text, subs } = words, voice = lib + book.voice;
document.title = story.title || book.title;
const speakers = Object.fromEntries([...story.spreads.flatMap(s => s.lines), ...(story.moral ?? [])].map(l => [l.id, l.say.flatMap(([who, s]) => s.split(" ").map(() => who))]));
const norm = w => w.toLowerCase().replace(/[^\p{L}']/gu, "");  // a read word as the director names it (book.js markWords does the same)
const wordAt = (line, word) => { const i = markWords(text[line], word).indexOf(true); return i < 0 ? 0 : timing[line].words[i][0]; };
const motionAll = await json("../assets/motion.json").catch(() => ({}));  // web/assets: everything the book loads is inside web/
const pageOf = id => book.spreads.find(s => s.dir === bare(id)) || book.spreads[0];
const order = sp => book.spreads.findIndex(s => s.dir === bare(sp.id));
// the book's order, with the spreads not exported yet skipped (one log line each), so the book grows as they land
const built = {}, isBuilt = id => built[id] ??= fetch(`${dirOf(id)}/spread.json`, { method: "HEAD" })
  .then(r => r.ok || void console.log(`${dirOf(id)} is not exported yet: skipped`), () => false);
async function neighbour(sp, step) {  // the next (1) or previous (-1) built spread; null: the moral after the last, nothing before the first
  if (step > 0 && sp.m.next) return sp.m.next;  // a manifest's own "next" (test chains); null, an export's last page, leaves it to book.json (the moral)
  if (step < 0 && sp.prev) return sp.prev;  // back the way we came
  for (let i = order(sp) + step; i >= 0 && i < book.spreads.length; i += step) if (await isBuilt(book.spreads[i].dir)) return book.spreads[i].dir;
  return null;
}

// ---------- a spread: loaded once, kept, entered when its page is turned to ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), models = {}, spreads = {};  // the slim characters are meshopt-compressed
const STUB = { fps: 24, frames: { turn: [12, 84], alive: 80, loop: [168, 263], last: 263 },
  camera: { at: [0, -2, 0.95], look: [0, 0.1, 0.3], lens_mm: 38 },
  stage: { name: "day", lights: [{ type: "area", at: [-1.6, 1.4, 2.6], look: [0, 0.1, 0.2], watts: 210, color: [1, 0.93, 0.82] }] },
  characters: [], // shortcut: the stand-in has no characters unless spread.json loads; fine for testing, real spreads always have one
  targets: [], touch: [] };

function stubSpread() {  // a flat open book of blank paper, so the viewer can be tested before the real export lands
  const paper = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.9 });
  const page = (mat, x, y, flip) => new THREE.Mesh(new THREE.PlaneGeometry(1, 0.68).rotateX(flip ? Math.PI / 2 : -Math.PI / 2).translate(x, y, 0), mat);
  const root = new THREE.Group(), leaf = new THREE.Group();
  leaf.name = "leaf";
  leaf.add(Object.assign(page(paper, -0.5, 0.003), { name: "leaf-page" }), page(paper, -0.5, 0.002, true));
  root.add(leaf, page(paper, 0.5, 0), page(paper, -0.5, 0));
  const q = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a).toArray(), t = f => (f - 1) / FPS;
  const track = new THREE.QuaternionKeyframeTrack("leaf.quaternion", [t(1), t(12), t(48), t(84)], [...q(-Math.PI), ...q(-Math.PI), ...q(-Math.PI / 2), ...q(0)]);
  return { stub: true, scene: root, animations: [new THREE.AnimationClip("Scene", t(264), [track])] };
}
const shade = root => root.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !o.material.emissive?.getHex(); } });  // glowing bits cast none

const breath = () => new Promise(r => setTimeout(r));
const load = id => spreads[id] ??= (async () => {
  const dir = dirOf(id);
  let m = await json(`${dir}/spread.json`).catch(() => null);
  const built = !!m;  // not exported yet: a stand-in, without asking for files that are not there
  m ??= STUB;
  if (id === first && q.get("with")) m = { ...m, ...await json(q.get("with")) };  // ?with=test/x.json lays a patch over the first manifest
  for (const sh of Object.values(m.shots ?? {})) if (sh?.phone) {  // a shot's "phone": {...} replaces its fields on an upright phone, read as the shot plays
    const own = { ...sh }, ph = sh.phone;
    for (const k of new Set([...Object.keys(own), ...Object.keys(ph)])) if (k !== "phone") Object.defineProperty(sh, k, { get: () => (innerWidth < innerHeight && k in ph ? ph : own)[k], enumerable: true });
  }
  const g = built ? await loader.loadAsync(`${dir}/spread.glb`, e => e.total && !S && note(`Opening the book… ${Math.round(100 * e.loaded / e.total)}%`))
    .catch(e => (console.warn(e), m = { ...STUB, ...m, targets: [], touch: [] }, stubSpread())) : stubSpread();
  await breath();  // a spread loading ahead while one is read: its parse, its set-up and its cast each in a task of their own, never one long frame
  const sp = { id, m, stub: g.stub, root: g.scene, group: new THREE.Group(), stage: new THREE.Group(), mixer: new THREE.AnimationMixer(g.scene), page: pageOf(id) };
  sp.end = Math.max(...g.animations.map(c => c.duration)) - 1e-4;  // a looping action wraps at its very end: stop just short
  g.animations.forEach(c => sp.mixer.clipAction(c).play());
  sp.animated = new Set(g.animations.flatMap(c => c.tracks.map(t => t.name.split(".")[0])));
  props(sp.root, m.props);
  shade(sp.root); sp.group.add(sp.root);
  [sp.T0, sp.T1] = m.frames.turn; [sp.L0, sp.L1] = m.frames.loop; sp.N = sp.T1 - sp.T0; sp.P = sp.L1 - sp.L0 + 1;

  sp.leaf = sp.root.getObjectByName("leaf");  // the turned page lying flat on the left measures the page
  sp.mixer.setTime((sp.T1 - 1) / FPS); sp.root.updateMatrixWorld(true);
  const flat = sp.flat = new THREE.Box3().setFromObject(sp.root.getObjectByName("leaf-page") || sp.leaf);
  sp.corner = sp.leaf.worldToLocal(new THREE.Vector3(flat.min.x, flat.max.y, flat.max.z));  // its outer bottom corner, in the leaf's own space
  sp.pageW = -flat.min.x; sp.pageD = flat.max.z - flat.min.z;
  sp.bottom = new THREE.Box3().setFromObject(sp.root).min.y;
  sp.sky = skyline(sp.root, undefined, m.backdrop);  // the standing backdrop's skyline and ends (the manifest names its cards)

  const key = m.stage.lights.reduce((a, b) => (b.watts > a.watts ? b : a));
  for (const l of m.stage.lights) {
    // shortcut: one watts->intensity ratio for every Blender area light, set by eye on spread 1; use RectAreaLight if pages look flat
    const d = new THREE.DirectionalLight(new THREE.Color(...l.color), l.watts / 75);
    d.position.copy(B(l.at)); d.target.position.copy(B(l.look || [0, 0.1, 0.2])); sp.stage.add(d, d.target);  // the lights stay on while an exit turn stands in
    if (l === key) {
      sp.key = d;
      d.castShadow = true; d.shadow.mapSize.set(2048, 2048); d.shadow.radius = 4; d.shadow.bias = -0.0004; d.shadow.normalBias = 0.01;
      Object.assign(d.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.1, far: 10 });
    }
  }

  await breath();
  sp.cast = (await Promise.all(m.characters.map(c => character(c, sp).catch(e => console.warn("character did not load", c.name, e))))).filter(Boolean);
  sp.byName = Object.fromEntries(sp.cast.map(ch => [ch.name, ch]));
  for (const ch of sp.cast) {  // "on": it rides that one, "at" is the offset (until an act moves it on its own feet)
    const on = sp.byName[ch.c.on];
    if (on) { ch.pos = on.pos.clone().add(B(ch.c.at)); mount(ch, on, o => o.pos); ch.ride.gap = ch.c.at[2]; }  // the page's height: the gap a skinned rider keeps over a skinned mount's skin (acts.js carry)
  }
  sp.cast.forEach(ch => sp.group.add(ch.body));
  const tops = {};
  const where = sp.where = (to, top) => {  // a point of the page, a character (where it stands), a prop (or its top), a part of a character (the lamp's wick)
    if (to == null || Array.isArray(to) || sp.byName[to]) return to == null ? null : Array.isArray(to) ? B(to) : sp.byName[to].body.position.clone();
    const o = sp.root.getObjectByName(to), part = !o && sp.cast.map(c => c.body.getObjectByName(to)).find(Boolean), it = o || part;
    if (!it) return null;  // a part, or a prop in a hand, moves: its top found afresh (where the hand has it now)
    return top ? (part || sp.held.some(h => h.what === to) ? topOf(it) : (tops[to] ??= topOf(it)))?.clone() ?? null : it.getWorldPosition(new THREE.Vector3());
  };
  sp.lifts = {}; sp.held = []; sp.placed = {};
  sp.acting = new Acting(m.acts || [], sp.cast, { cam, where, wordAt, loop, once, started: a => foley(`act:${[].concat(a.who ?? a.what)[0]?.replace(/\d+$/, "")}:${a.do}`, null),
    people: new Set([...Object.values(speakers).flat(), ...sp.cast.filter(c => c.clips.Talk).map(c => c.name)]),  // who speaks, or can: not boats
    spot: what => sp.placed[what]?.clone() ?? sp.root.getObjectByName(what)?.getWorldPosition(new THREE.Vector3()) ?? null, put: (what, p) => sp.held.some(h => h.what === what) || (sp.placed[what] = p),  // a flight still running never pulls a prop out of a hand
    motion: Object.fromEntries(sp.cast.map(ch => [ch.name, motionAll[ch.name] ?? motionAll[ch.c.model.split("/").pop()]])),
    raise: (what, dy) => (sp.lifts[what] = dy),  // a prop rising: kept as an offset, laid on after the paper's own animation
    hold: (ch, what, hand, on) => {  // a prop in a hand follows the hand bone until let go; a cast prop (a bowl, a lamp) is held by its rim
      const was = sp.held.find(h => h.what === what);
      if (!on && was) sp.placed[what] = inHandAt(was, new THREE.Vector3());  // let go: it stays where the hand had it, for a fly on from there
      sp.held = sp.held.filter(h => h.what !== what);
      const o = sp.root.getObjectByName(what) || sp.byName[what]?.body, bone = ch.model.getObjectByName(`${hand || "right"}Hand`);
      if (on && o && bone) sp.held.push({ what, o, bone, seat: sp.byName[what] && byRim(ch, bone, sp.byName[what]) }), delete sp.placed[what];  // held: where a flight left it no longer counts
      else if (on) console.warn("cannot hold", what, "in", ch.name);
    } });

  sp.G = { type: "collect", ...sp.page.game };
  arm(sp);
  sp.folk = new Map(sp.cast.map(ch => [ch.proxy, () => poke(ch)]));
  sp.props = new Map();
  // a fold piece is two halves, "<name>-1" and "<name>1" (or one parent "<name>"): one touch thing, its sound "tap:<name>"
  const piece = n => { const b = n.replace(/-?1$/, ""); return b !== n && sp.root.getObjectByName(`${b}-1`) && sp.root.getObjectByName(`${b}1`) ? b : n; };
  for (const n of new Set(m.touch.map(piece))) {
    const one = sp.root.getObjectByName(n), parts = one ? [one] : [`${n}-1`, `${n}1`].map(h => sp.root.getObjectByName(h)).filter(Boolean);
    if (!sp.byName[n]) parts.forEach(o => sp.props.set(o, () => wiggle(n, parts)));
  }
  return sp;
})();

function topOf(o) {  // the point on top of an object, straight above its middle: what a climber stands on
  if (!o) return null;
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(o), mid = box.getCenter(new THREE.Vector3());
  ray.set(mid.clone().setY(box.max.y + 1), new THREE.Vector3(0, -1, 0));
  return ray.intersectObject(o, true)[0]?.point ?? mid.setY(box.max.y);
}

const exitOf = sp => sp.exit ??= sp.stub ? Promise.resolve(null) : loader.loadAsync(`${dirOf(sp.id)}/exit.glb`).then(g => {  // the right page turning away
  const root = g.scene, mixer = new THREE.AnimationMixer(root), leaf = root.getObjectByName("rleaf");
  g.animations.forEach(c => mixer.clipAction(c).play()); shade(root);
  const end = Math.max(...g.animations.map(c => c.duration)) - 1e-4, show = f => mixer.setTime(Math.min((f - 1) / FPS, end));
  show(1); root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root.getObjectByName("rleaf-page") || leaf);
  return { root, show, leaf, n: (sp.m.exit_frames || 73) - 1, corner: leaf.worldToLocal(new THREE.Vector3(b.max.x, b.max.y, b.max.z)) };
}).catch(e => (console.warn("no exit turn for", sp.id, e), null));

function arm(sp) {  // the page's game, fresh (games.js: collect, order, shadow, echo)
  sp.play = makeGame(sp, gameEnv(sp));
  // what a tap reaches, in order: a target it hits exactly, a character, a target near the fingertip, then a touch thing,
  // so neither a monkey's generous hit box nor the tree swallows the fruit beside it
  sp.fruit = new Map([...sp.play.targets.map((o, i) => [o, () => sp.play.tap(i)]), ...sp.play.extra]);
}
async function character(c, sp) {
  const g = c.model.startsWith("puppet:") ? puppetModel(THREE, await storyPuppet(c.model.slice(7), sp.m.stage?.name))  // "puppet:tong": a paper puppet
    : await (models[c.model] ??= loader.loadAsync(`chars/${c.model.split("/").pop()}`)  // "assets/kapi.glb": its slim copy, web/live/chars
      .catch(() => loader.loadAsync(`../${c.model}`))  // no slim copy (yet): the original, through web/assets
      .then(g => (g.animations.forEach(a => { const t0 = Math.min(...a.tracks.map(k => k.times[0])); if (t0 > 0 && t0 < Infinity) { new Set(a.tracks.map(k => k.times)).forEach(t => t.forEach((v, i) => (t[i] = v - t0))); a.resetDuration(); } }), g)));  // every clip starts at 0: one whose first key is late (0.042 s in some exports) holds a frame at each loop's wrap. Tracks share their times arrays, so each array moves once
  const model = clone(g.scene), pivot = new THREE.Group(), body = new THREE.Group();
  body.name = c.name;  // a game reads a tapped one by name (the shadow game's spots)
  model.traverse(o => { if (o.isMesh) { o.visible = !o.name.startsWith("Icosphere"); o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
  pivot.rotation.y = rad(c.face ?? -90); pivot.add(model); body.add(pivot);
  body.updateMatrixWorld(true);
  const box = new THREE.Box3(); model.traverse(o => o.isMesh && o.visible && box.expandByObject(o));  // the hidden bone-shape sphere is not measured
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  pivot.position.set(-mid.x, -box.min.y, -mid.z);  // stand on the floor, centred, as popup.py does
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x * 1.2, size.y * 1.1, size.z * 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.y = size.y * 0.5; body.add(proxy);  // the hit box: a little larger than the body, easy for a small finger
  const mix = new THREE.AnimationMixer(model), clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
  const ch = { c, body, model, mix, clips, proxy, box: box.clone().translate(pivot.position), who: c.name, name: c.name, height: c.height, s0: c.height / size.y, first: g.animations[0],
    start: sp.m.frames.alive + (c.delay || 0), ph: Math.random() * 6.28, pos: B(c.at), yaw: rad(c.rot || 0), hold: c.clip, nod: 0 };
  if (ch.first) loop(ch, ch.hold);
  if (c.candle) {  // spread.json "candle": a flame on top, "dark": not lit yet (a collect game in "light" mode lights "<name>-flame")
    const flame = new THREE.Mesh(new THREE.SphereGeometry(size.y * 0.09, 16, 12).scale(1, 1.9, 1), new THREE.MeshStandardMaterial({
      color: c.dark ? 0x2a1a10 : 0xffd27a, emissive: c.dark ? 0x000000 : 0xff9a3c, emissiveIntensity: c.dark ? 0 : 2.5, roughness: 1 }));
    Object.assign(flame, { name: `${c.name}-flame`, castShadow: false }); flame.position.y = size.y * 1.02; body.add(flame);
    const wick = model.getObjectByName(`${c.name}-wick`);  // a lamp's wick (by its spout, off the axis): the flame wraps its tip, turned with the page's rot
    if (wick) { body.updateMatrixWorld(true); const w = new THREE.Box3().setFromObject(wick); w.getCenter(flame.position).setY(w.max.y + size.y * 0.035); }
  }
  mix.addEventListener("finished", e => {  // a clip played once has ended: its follow-up runs, then any loop asked for meanwhile
    if (e.action !== ch.cur) return;
    const d = ch.done, p = ch.pending; ch.done = ch.pending = null; d?.(); if (p) loop(ch, p);
  });
  return ch;
}

// the jamun an Eat clip holds: hand-sized on its own terms (0.021 long against Kapi's 0.15), smooth and matte, wearing the painted
// skin of the book's jamun card (jamun-skin.webp: the middle of the rightmost fruit of cards/kapi/jamun-fallen.png, 128x86)
const jamun = new THREE.Mesh(new THREE.SphereGeometry(0.008, 32, 24).scale(1, 1, 1.3), new THREE.MeshStandardMaterial({ color: 0x4a1d4f, roughness: 0.55 }));
new THREE.TextureLoader().load("jamun-skin.webp", t => {
  t.colorSpace = THREE.SRGBColorSpace; Object.assign(jamun.material, { map: t }); jamun.material.color.set(0xffffff); jamun.material.needsUpdate = true;
});
function toss(from, to, secs = 0.6) {  // a jamun thrown from one's right hand into the other's mouth (jaw, else head, else above the body)
  const a = (from.model.getObjectByName("rightHand") ?? from.body).getWorldPosition(new THREE.Vector3());
  const end = () => (to.model.getObjectByName("jaw") ?? to.model.getObjectByName("head") ?? to.body).getWorldPosition(new THREE.Vector3());
  const f = jamun.clone(), t0 = performance.now(), arc = 0.06 + 0.3 * a.distanceTo(end());
  scene.add(f);
  effects.push(now => {
    const k = Math.min(1, (now - t0) / 1000 / secs);
    f.position.lerpVectors(a, end(), k).y += 4 * arc * k * (1 - k);
    return k < 1 || void f.removeFromParent();
  });
}
function inHand(ch, done) {  // an Eat clip holds a jamun in the right hand while it plays
  const bone = ch.model.getObjectByName("rightHand");
  if (!bone) return done;
  const f = jamun.clone(); scene.add(f); bone.getWorldPosition(f.position); bone.attach(f);
  return () => { f.removeFromParent(); done(); };
}
function loop(ch, name) {  // cross-fade into a looping clip (Idle stands in for one the model lacks: it slides)
  if (ch.done) return void (ch.pending = name);  // never cut a clip that is playing once
  const clip = ch.clips[name] || ch.clips.Idle || ch.first;
  if (!clip) return;
  const a = ch.mix.clipAction(clip);
  if (a === ch.cur) return;
  a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  if (ch.cur) a.crossFadeFrom(ch.cur, 0.3, false);
  ch.cur = a;
}
function once(ch, name, done) {  // play a clip once and hold its last pose until `done` moves on; its length, 0 if missing
  const clip = ch.clips[name];
  if (!clip) return done(), 0;
  if (/^Eat/.test(name)) done = inHand(ch, done);
  const to = /^Throw/.test(name) && (ch.catcher ?? S.cast.filter(c => c !== ch).sort((a, b) => a.pos.distanceTo(ch.pos) - b.pos.distanceTo(ch.pos))[0]);
  if (to) setTimeout(() => toss(ch, to), clip.duration * 450);  // a Throw lets a jamun go at about its middle, to its named catcher (acts.js), else the nearest one
  const a = ch.mix.clipAction(clip);
  a.reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
  a.play(); if (ch.cur && ch.cur !== a) a.crossFadeFrom(ch.cur, 0.25, false);
  const was = ch.done; Object.assign(ch, { cur: a, done, pending: null });
  was?.();  // a clip cut short by another still finishes its act, so a "wait" never hangs
  return clip.duration;
}

// ---------- the current spread, and moving between spreads ----------
let S = null, mode = "load", frame = 0, age = 0, exitOn = null, HOME, LOOK, peelAt = 0;  // frame: the clip frame shown; age: the same, unwrapped through the loop
let shown = false;  // the paper's animation was set this frame (so props it moves are back at their animated place)
const show = a => { age = a; frame = a < S.L0 ? a : S.L0 + (a - S.L0) % S.P; S.mixer.setTime(Math.min((frame - 1) / FPS, S.end)); shown = true; };
const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2),  // the walnut desk the renders stand on (not in the export)
  new THREE.MeshStandardMaterial({ color: new THREE.Color(0.07, 0.033, 0.015), roughness: 0.32 }));
desk.receiveShadow = true; scene.add(desk);

// ---------- hook: the cinematic layer (web/live/ambient.js) plugs in here ----------
// Its two lines: `import { ambient } from "./ambient.js";` up top, and `hooks.push(ambient);` just below. A hook may have
// spread(sp, scene, cam) — called as each spread enters (sp.group, sp.root and sp.m are that spread's scene and manifest) —
// and frame(dt, now) — called every frame before the picture is drawn.
const hooks = [];
hooks.push(ambient);

function enter(sp, how) {  // make `sp` the spread on the desk: "closed" (its text page, ready to turn in) or "open"
  const from = S;
  if (from && from !== sp) {
    from.group.removeFromParent(); from.stage.removeFromParent();
    if (from.nextId === sp.id && !sp.m.cut) {  // turning forward: the story carries on, everyone starts where they were left (a "cut" page starts afresh)
      sp.prev = from.id;
      const poses = from.acting.poses;
      for (const ch of sp.cast) {  // a character the new page puts on someone, or walks in, keeps that
        const p = poses[ch.name];
        if (p && !ch.c.on && !ch.c.enter) Object.assign(ch, { pos: new THREE.Vector3(...p.pos), yaw: p.yaw, hold: p.hold }), loop(ch, p.hold);
      }
    }
  }
  for (const ch of sp.cast) ch.begin ??= { pos: ch.pos.clone(), yaw: ch.yaw, hold: ch.hold, on: ch.ride?.on };  // where the page began, for "Read again"
  showExit(null); S = sp; scene.add(sp.group, sp.stage);
  scene.background = new THREE.Color(...WORLD[sp.m.stage.name] || WORLD.night);
  desk.position.y = sp.bottom - 0.002;
  note(sp.stub ? `${dirOf(sp.id)} is not built yet: a stand-in book` : "", sp.stub);
  const fresh = !HOME;
  fit();
  if (!fresh) home(); else if (HOME) cam.position.copy(HOME), controls.target.copy(LOOK);  // opened in a hidden (zero-size) tab: the first real resize glides home
  q.set("s", sp.id); if (sp.id !== first) q.delete("with");  // the address names the page on the desk, so a reload reopens it
  history.replaceState(null, "", `?${q}`);
  hooks.forEach(h => h.spread?.(sp, scene, cam));
  Promise.all([neighbour(sp, -1), neighbour(sp, 1)]).then(([p, n]) => { Object.assign(sp, { prevId: p, nextId: n }); if (sp === S) free(sp.id, p, n); });
  snd.setBed(bedsOf(sp));
  renderer.compileAsync(scene, cam).catch(() => {});  // every material of this spread ready before it is first needed (no stall mid-story)
  how === "open" ? opened() : closed();
}

// spreads more than one turn away leave memory: their scene, textures, lights' shadow maps and exit turn (the characters'
// models stay, shared by every page), so ten spreads read back and forth take no more than three at once
function free(...keep) {
  for (const id of Object.keys(spreads)) if (!keep.includes(id)) { const p = spreads[id]; delete spreads[id]; p.then(drop); }
}
function drop(sp) {
  const gone = root => root.traverse(o => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose(); }
  });
  sp.exit?.then(ex => ex && gone(ex.root));
  gone(sp.root); sp.stage.traverse(o => (o.shadow?.map?.depthTexture?.dispose(), o.shadow?.map?.dispose()));  // a shadow map's depth texture is its own: 22 MB a spread stayed on the GPU sp.mixer.stopAllAction(); sp.mixer.uncacheRoot(sp.root);
}
function showExit(ex) {  // the exit turn is its own scene: it stands in for the spread while a page turns away
  exitOn?.root.removeFromParent(); exitOn = ex;
  if (S) S.group.visible = !ex;
  if (ex) scene.add(ex.root);
}

// a page turn scrubbed by PageDrag: `set(i)` shows step i of n; `node` turns and carries `corner` (in its own space)
function scrub({ set, node, corner, n }, a, b, auto, x0, land, at) {
  mode = "turn"; say(""); foley("turn", "turn");
  if (at) { set(a); node.updateWorldMatrix(true, false); corner = node.worldToLocal(at.clone()); }  // the point the finger took (the hint's, when the corner itself is off screen) turns under it
  const world = [], p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) { set(i); node.updateWorldMatrix(true, false); world.push(corner.clone().applyMatrix4(node.matrixWorld).setY(S.flat.max.y)); }  // the turning page's outer bottom corner at each step, laid flat on the page: seen close (a phone), the lifting page swings past where it lands, and the finger would find that swing first
  const track = () => world.map(w => (p.copy(w).project(cam), [(p.x + 1) / 2, (1 - p.y) / 2]));  // ... on screen (fractions of the canvas), as the camera is now
  const c = track();
  set(a);
  drag = new PageDrag(set, land);
  drag.grab(c, a, b, auto ? c[a][0] : x0);
  drag.track = track;  // the opening shot moves the camera during a turn: the frame loop re-projects the track
  if (auto) { drag.isAuto = true; autoK = 0; }  // lifted over by the frame loop, by frame time: a stalled frame cannot drop it
  else { drag.move(fingerX); if (!down) fling(); }  // let go while the pop-ups were still folding: still a flick
}
let autoK = 0;
function fling() {  // the finger lets go: the page keeps its speed; a quick flick the turning way always turns it
  const dir = Math.sign(drag.far - drag.x0), fv = flick / (drag.far - drag.x0);
  drag.v = Math.max(drag.v, flick * dir > 0.8 ? 4 : Math.min(6, fv));
  drag.release();
}
const inTurn = () => ({ set: i => show(S.T0 + i), node: S.leaf, corner: S.corner, n: S.N });
const outTurn = ex => ({ set: i => ex.show(1 + i), node: ex.leaf, corner: ex.corner, n: ex.n });

async function turn(fwd, auto, x0 = fingerX, at) {  // at: the page point the finger took
  if (mode === "closed" && fwd) return scrub(inTurn(), 0, S.N, auto, x0, e => (e ? opened() : closed()), at);
  if (mode === "open") quiet();  // a page turning away takes its line with it; if it falls back open, the line is read again
  if (mode === "open" && !fwd) { await duck(); return scrub(inTurn(), S.N, 0, auto, x0, e => (e ? closed() : opened(true)), at); }
  if (mode === "open" && fwd) {  // on to the next spread (or the moral): the page turns away through exit.glb
    const sp = S, id = sp.nextId !== undefined ? sp.nextId : (sp.nextId = await neighbour(sp, 1));
    const next = id && load(id), on = async () => (next ? (mode = "load", enter(await next, "closed")) : moral());
    await duck();
    const ex = await exitOf(sp);
    if (!ex) return on();  // no exit turn exported: a plain cut
    showExit(ex);
    return scrub(outTurn(ex), 0, ex.n, auto, x0, e => (e ? on() : (showExit(null), opened(true))), at);
  }
  const back = mode === "closed" && !fwd && (S.prevId !== undefined ? S.prevId : await neighbour(S, -1));
  if (back) {  // back to the previous spread: its exit turn, played in reverse
    mode = "load"; const sp = await load(back), ex = await exitOf(sp);
    if (!ex) return enter(sp, "open");  // no exit turn exported: a plain cut
    quiet(); showExit(ex);
    scrub(outTurn(ex), ex.n, 0, auto, x0, e => (e ? enter(sp, "open") : (showExit(null), closed())), at);
  }
}

const duck = () => new Promise(done => {  // the living things fold back in, quickly, before the page can turn
  mode = "duck"; say(""); $("sbub").hidden = true;
  const f0 = Math.min(frame, S.L0), t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / 200); show(f0 + (S.T1 - f0) * k); k < 1 ? requestAnimationFrame(step) : done(); };
  requestAnimationFrame(step);
});

function closed() { mode = "closed"; show(S.T0); quiet(); say("Pull the glowing corner to turn the page."); peelAt = performance.now() + 1500; }

let hinted = false;
function turnHint() {  // the first time a book opens on an upright phone: a gentle hint that sideways is bigger, about 4 s, then never again
  if (hinted || innerWidth >= innerHeight || innerWidth > 600) return;
  hinted = true;
  try { if (localStorage.getItem("popup-turn-hint") === "1") return; localStorage.setItem("popup-turn-hint", "1"); } catch { /* no storage: once this visit */ }
  const t = $("turnhint"); t.hidden = false; setTimeout(() => (t.hidden = true), 4000);
}
function opened(back) {  // back: the page fell back open after a pull (no rustle); either way the reading goes on from its line
  mode = "open"; show(S.T1);
  if (!back) turnHint();
  const n = S.page.lines.length;
  if (!back) foley("rise", "rise");
  S.at == null ? readFrom(0) : S.at < n ? readFrom(S.at) : $("bar").classList.add("on");  // read already: "Read again" waits
  const { G, play } = S;
  if (play.targets.length && !G.voice && !G.before) say(play.complete ? G.praise ?? "You found them all!" : G.start ?? "Find them all! Tap each one to pick it.");
}
function ahead(sp) {  // what the next turn needs (the next spread, this one's exit turn), fetched once the page's last line or its game starts
  if (sp.ahead || sp !== S) return;
  sp.ahead = true; (globalThis.requestIdleCallback ?? setTimeout)(() => { neighbour(sp, 1).then(id => id && sp === S && load(id)); exitOf(sp); });  // when the page has a moment
}

function moral() {  // after the last spread: a calm page, the moral read aloud (book.json's "moral" spread, its diorama, has just read it)
  mode = "moral"; quiet(); $("moral").hidden = false; $("replay").hidden = true; snd.setBed([["night-breeze", 0.15], ["leaves-breeze", 0.15]].filter(([n]) => sm.beds[n]).slice(0, 1));  // a calm page
  $("bar").classList.add("on"); if (bare(S.id) !== "moral") reader.read(book.moral?.lines || story.moral.map(l => l.id));
}
$("again").onclick = () => mode === "moral" && reader.read(book.moral?.lines || story.moral.map(l => l.id));
$("start").onclick = () => (q.set("s", "s01"), q.delete("with"), location.search = q);  // The End: the whole book again from spread 1 (Eddie)
$("back").onclick = () => {
  if (mode !== "moral") return;
  $("moral").hidden = true; $("replay").hidden = false; quiet(); snd.setBed(bedsOf(S));
  if (!exitOn) return opened();
  scrub(outTurn(exitOn), exitOn.n, 0, true, 0, e => (e ? (showExit(null), opened()) : moral()));
};

// ---------- reading: the Reader, languages, the bar ----------
let lang = "", runs = 0;
const reader = new Reader($("read"), { voice, timing, text, subs });
languages($("langs"), `${bookId}.lang`, l => { lang = l; reader.setLang(l); });

// ---------- sound (sound.js): a bed for each spread, foley for what happens, all ducked under the narration ----------
const speak = new Audio();  // touch lines and game reacts: a second voice, ducking the beds like the narration
const sm = manifestFor(bookId, "../"), snd = addSound(sm, { reader, voices: [speak] });  // an unknown book gets the shared foley and no bed
const played = [], play0 = snd.play.bind(snd);  // every library sound that starts, for scripted checks (window.live.played)
snd.play = (n, o) => (sm.sounds[n] && !snd.muted && played.push(n), play0(n, o));
addEventListener("ambient:sound", e => snd.play(e.detail.name, { gain: 0.3 }));  // the extras' routines, taps and surprises (ambient.js)
addEventListener("ambient:tap", e => foley(`tap:${e.detail.name}`, null));
// the book's own beds when a spread names none (the director's names, stories/*/DIRECTION.md)
const DEFAULT_BED = { kapi: { day: [["river-slow", 0.3], ["birds-day", 0.18]], evening: [["river-evening", 0.3], ["crickets", 0.12]],
  night: [["night-frogs", 0.25], ["night-breeze", 0.12]] }, mali: { night: [["river-night", 0.3], ["crickets", 0.12]] } };
const bedsOf = sp => {  // spread.json "sound": {"bed": [[name, level], ...]}
  const own = DEFAULT_BED[bookId] ?? {}, want = sp.m.sound?.bed ?? own[sp.m.stage?.name] ?? Object.values(own)[0] ?? [];
  return want.filter(l => sm.beds[[].concat(l)[0]]);
};
// what the viewer and games ask for, by kind, and the library sound that plays it (the first this book has)
const KINDS = { turn: ["page-turn"], rise: ["paper-rustle"], tap: ["paper-pat"], sparkle: ["moon-shimmer", "paper-rustle"],
  pick: ["jamun-pluck", "paper-pat"], splash: ["splash-small", "tail-splash", "water-swish"] };
const sfx = (kind, o) => { const n = sm.sounds[kind] ? kind : KINDS[kind]?.find(n => sm.sounds[n]); if (n) snd.play(n, o); };
function foley(event, fallback) {  // spread.json "sound": {"foley": {"tap:tree": ["leaves-shake", 0.4]}}; else the kind's sound
  const f = S?.m.sound?.foley ?? {}, e = f[event] ?? f[Object.keys(f).find(k => k.toLowerCase() === event)] ?? f[event.split(":")[0]];  // "line:1.4:Whoosh" is read as "whoosh"
  e && sm.sounds[e[0]] ? snd.play(e[0], { gain: e[1] ?? 0.5 }) : sfx(fallback, { gain: 0.5 });
}
const sndBtn = $("snd"), showSnd = () => { sndBtn.textContent = snd.muted ? "🔇" : "🔊"; sndBtn.setAttribute("aria-pressed", !snd.muted); };
sndBtn.onclick = () => { snd.mute(!snd.muted); showSnd(); };
showSnd();
const say = t => { $("msg").innerHTML = t ? `<p>${t}</p>` : ""; $("msg").classList.toggle("show", !!t); };
const count = t => { $("count").textContent = t; $("count").hidden = !t; };  // a game's "2 of 5", in its own badge
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sayLine = id => (text[id] ? reader.say(id) : (console.warn("no text for line", id), Promise.resolve(true)));  // a missing line is skipped, never a stop
async function readFrom(i) {  // the page's lines from line i; S.at keeps the place, so a page turned back to resumes there
  const run = ++runs, sp = S, lines = sp.page.lines;
  $("bar").classList.add("on");
  for (; i < lines.length; i++) {
    sp.at = i;
    if (lines[i] === sp.G.before && !sp.play.complete) return prompt(sp, run);  // book.json "game": {"before": "1.4"}: read on once it is won
    const t0 = performance.now();
    const next = lines[i + 1] ?? (sp.G.before ? null : sp.G.voice?.start);  // the next line's voice (after the last, the game's), in the cache first
    if (text[next]) fetch(`${voice}${next}.m4a`).catch(() => {});
    if (i === lines.length - 1) ahead(sp);  // the last line: now the next spread (a voice always comes before a spread)
    if (!(await sayLine(lines[i])) || run !== runs) return;
    const rest = reader.audio.ended ? 0 : (timing[lines[i]]?.duration ?? 2) * 1000 - (performance.now() - t0);
    if (rest > 0 && (await sleep(rest), run !== runs)) return;  // no voice (a missing or refused file): the line still takes its time
    while (sp.acting.busy(lines[i])) if ((await sleep(100), run !== runs)) return;  // an act with "wait" finishes first
    const game = !sp.play.complete && (lines[i + 1] === sp.G.before || (!sp.G.before && i === lines.length - 1));
    const glide = game ? gameView(true) : 0;  // the game's view glides in during the pause, so the prompt starts on it
    if ((await sleep(Math.max(450, glide)), run !== runs)) return;
  }
  sp.at = lines.length; hint.pulse = performance.now();  // read: the corners glow once to say "turn me"
  if (!sp.play.complete) prompt(sp, run);
}
// a game's prompt: spoken through the Reader, so it has subtitles and the read-along, when book.json names its voice
// ("voice": {"start": "game.1.start", "praise": "game.1.praise"}); otherwise the English line on the page
async function prompt(sp, run) {
  const { G, play } = sp;
  if (!play.targets.length || play.complete) return;
  if (sp === S && !homing) gameView(true);  // the game's view as its prompt starts (unless it is still gliding in from the line before)
  if (G.voice?.start) {
    $("bar").classList.add("on");
    const said = run === runs && sayLine(G.voice.start);
    ahead(sp);  // the game starts, its voice already asked for: the next spread may come now
    await said;
  } else { say(G.start ?? "Find them all! Tap each one to pick it."); ahead(sp); }
  if (sp === S) play.begun ? play.resume() : play.begin();  // then the game begins (the bells play their tune, the first stone glows); back again: it picks up
}
async function won() {
  foley("game:won", null); fit();  // the reading view back for ambient's won/end shot, which moves the camera: moving it here would make ambient let go
  const { G, page } = S, sp = S, gate = page.lines.indexOf(G.before), paused = gate >= 0 && sp.at === gate;  // the reading waits at the game
  if (!G.voice?.praise) { say(G.praise ?? "You found them all!"); return paused && readFrom(gate); }
  const run = ++runs;
  say(""); $("bar").classList.add("on");
  if (!(await sayLine(G.voice.praise)) || run !== runs || sp !== S) return;
  await sleep(450);
  if (run === runs && sp.at < page.lines.length) readFrom(sp.at);  // the story goes on: past the game's line, or the line the praise cut short
}
$("replay").onclick = () => (mode === "open" ? replay(S) : mode === "moral" && $("again").click());
function replay(sp) {  // "Read again": everyone back where the page began, the props and the game as they were, then the acts and the reading from line 1
  quiet();
  sp.play.stop?.(); sp.play.targets.forEach(o => glow(o, 0)); effects.length = 0;
  sp.lifts = {}; sp.held = []; sp.placed = {};
  sp.root.traverse(o => o.userData.rest && o.position.copy(o.userData.rest));
  sp.acting.reset();
  for (const ch of sp.cast) Object.assign(ch, { pos: ch.begin.pos.clone(), yaw: ch.begin.yaw, hold: ch.begin.hold, ride: null, want: null, moved: false, done: null, pending: null });
  for (const ch of sp.cast) { if (ch.begin.on) mount(ch, ch.begin.on, o => o.pos), ch.ride.gap = ch.c.at[2]; loop(ch, ch.hold); }
  arm(sp); gameView(false);
  readFrom(0);  // ambient.js sees the line go back: its moments fire again and the lights return to the stage
}
function quiet() { runs++; reader.stop(); speak.pause(); reader.box.classList.remove("show"); $("bar").classList.remove("on"); say(""); count(""); $("sbub").hidden = $("lbub").hidden = true; }

// ---------- characters on the page ----------
const along = (keys, f) => {  // "enter": a path of [frame, [x,y,z]] keys, walked once (frames on the unwrapped timeline)
  const i = keys.findIndex(([k]) => k > f);
  if (i <= 0) return B(keys.at(i)[1]);
  const [fa, a] = keys[i - 1], [fb, b] = keys[i];
  return B(a).lerp(B(b), (f - fa) / (fb - fa));
};
function place(ch, dt, now) {  // ch.pos / ch.yaw: the manifest's place, then wherever the acts take it
  const { c, body } = ch, tau = 2 * Math.PI / S.P, w = frame * tau + ch.ph, k = bloom(age, ch.start, c.bob ? 18 : 12);
  body.visible = k > 0; body.scale.setScalar(ch.s0 * Math.max(k, 1e-4));
  if (!ch.moved && c.enter) ch.pos.copy(along(c.enter, age));
  if (ch.ride && !ch.slide) {  // riding: carried along, bobbing and turning with it
    carry(ch, o => o.body.position, cam.position);
    if (ch.want == null) ch.yaw = ch.ride.on.yaw + ch.ride.dyaw;
  }
  ch.nod = ch.talking ? 0.07 * Math.sin(now / 70) : ch.nod * 0.85;  // the small nod of someone talking
  const p = ch.pos.clone();
  if (c.bob) {  // surface from the river, then rock and turn on a slow eddy (popup.py's boat motion)
    const dr = c.drift || 0;
    p.add(new THREE.Vector3(dr * Math.sin(w), 0.006 * Math.sin(w) - 0.06 * (1 - Math.min(k, 1)), -0.6 * dr * Math.cos(w)));
    body.rotation.set(0.04 * Math.sin(2 * frame * tau + ch.ph) + ch.nod, ch.yaw + 0.05 * Math.sin(w), -0.05 * Math.sin(w + 1), "YZX");
  } else body.rotation.set(ch.nod, ch.yaw, 0, "YXZ");
  body.position.copy(p);
  ch.mix.update(dt);
}

// ---------- taps: characters react and speak, targets are picked, touch things wiggle ----------
const effects = [], undo = [];
const nudge = (o, fn) => { undo.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); fn(o); };  // undone after the frame is drawn
const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
const aim = (x, y) => ray.setFromCamera(new THREE.Vector2(2 * x - 1, 1 - 2 * y), cam);
const hitIn = map => {  // a character is tried by its hit box, not its skinned body (57k triangles: 60 ms a tap on Kapi or Bobo)
  const by = new Map([...map.keys()].map(o => [S.cast.find(c => c.body === o)?.proxy ?? o, o]));
  for (const h of ray.intersectObjects([...by.keys()], true)) {
    let o = h.object;
    while (o && !by.has(o)) o = o.parent;
    if (o) return map.get(by.get(o));
  }
};

function tap(x, y) {
  if (mode !== "open") return;
  aim(x, y);
  // small things are hard to hit: the nearest unpicked target within a fingertip also counts
  const best = S.play.targets.map((o, i) => [i, o.getWorldPosition(new THREE.Vector3()).project(cam)])
    .map(([i, v]) => [i, Math.hypot(((v.x + 1) / 2 - x) * innerWidth, ((1 - v.y) / 2 - y) * innerHeight)])
    .filter(([i, d]) => S.play.open(i) && d < 44).sort((a, b) => a[1] - b[1])[0];
  const open = new Map([...S.fruit].filter(([o]) => { const i = S.play.targets.indexOf(o); return i < 0 || S.play.open(i); }));  // a picked one catches no tap
  const near = best && (() => S.play.tap(best[0])), on = S.play.begun && !S.play.complete;  // while a game is on, a target by the fingertip comes before a character
  (hitIn(open) ?? (on ? near : null) ?? hitIn(S.folk) ?? near ?? hitIn(S.props))?.();
}

function poke(ch) {  // a reaction played once, then back to what it was doing; and a touch line said
  foley(`tap:${ch.name}`, "tap");
  const names = REACTIONS.filter(n => ch.clips[n] && n !== ch.hold);
  if (names.length && !ch.done && !ch.goal) once(ch, names[Math.floor(Math.random() * names.length)], () => loop(ch, ch.hold));
  const said = touchLine(words, ch.who, lang);
  if (!said) return;
  const s = $("sbub");
  s.innerHTML = "<b></b><i></i>"; s.firstChild.textContent = said.text; s.lastChild.textContent = said.sub;
  s.hidden = false; s.who = ch; clearTimeout(s.t); s.t = setTimeout(() => (s.hidden = true), 2300);
  speak.src = `${voice}${said.id}.m4a`; speak.play().catch(() => {});
}

// ---------- what a game may do in the scene (games.js) ----------
const gameEnv = sp => ({ THREE, renderer, cam, now: () => performance.now(), say, count, won, sparkle, wobble,
  poke: who => sp.byName[who] && poke(sp.byName[who]),
  toss: (from, to) => sp.byName[from] && sp.byName[to] && toss(sp.byName[from], sp.byName[to]),
  bubble: (who, id, phrase) => {  // listen: the speaker's line in a bubble over them, the missed words lit (null: gone); a tap on it is a tap on them
    const b = $("lbub"); b.hidden = !who || !text[id];
    if (b.hidden) return;
    const mark = markWords(text[id], phrase);
    b.innerHTML = text[id].split(" ").map((w, j) => `<span${mark[j] ? ' class="miss"' : ""}>${w}</span>`).join(" ");
    b.who = sp.byName[who]; b.onclick = () => sp === S && sp.play.tap(0);
  },
  listen: async (id, phrase) => {  // the line said again through the Reader, the phrase's words lit in the bar and on the read-along page
    runs++; say(""); $("bar").classList.add("on");
    const said = sayLine(id), mark = markWords(text[id] ?? "", phrase);
    setTimeout(() => [reader.en, document.querySelector(".ra-page .ra-en")].forEach(el => el && [...el.querySelectorAll("span")].forEach((w, j) => w.classList.toggle("miss", !!mark[j]))));
    await said;
  },
  vanish: o => { const t0 = performance.now(); effects.push(now => { const k = (now - t0) / 1000; nudge(o, o => o.scale.multiplyScalar(k < 0.12 ? 1 + 2.5 * k : Math.max(1e-4, 1.3 - 5 * (k - 0.12)))); return true; }); },
  lift: (name, dy, secs, hover) => {  // up and back (a bounce), or up to stay, bobbing (a lantern waking)
    const t0 = performance.now();
    effects.push(now => {
      const k = Math.min(1, (now - t0) / 1000 / secs);
      sp.lifts[name] = hover ? dy * smooth(0, 1, k) + (k >= 1 ? 0.005 * Math.sin(now / 500) : 0) : dy * Math.sin(Math.PI * k);
      return hover || k < 1;
    });
  },
  act: a => new Promise(done => {  // an act played now, outside the story's list: resolves when it is done
    const act = { ...a, state: "wait" };
    sp.acting.start(act);
    const t = setInterval(() => act.state === "done" && (clearInterval(t), done()), 50);
  }),
  hold: (ch, what, hand, on) => sp.acting.hold(ch, what, hand, on), holding: what => sp.held.some(h => h.what === what),
  place: (what, at) => (at ? (sp.placed[what] = at.clone()) : delete sp.placed[what]), where: (to, top) => sp.where(to, top),
  play: sfx, foley, voice: id => { if (text[id]) return $("bar").classList.add("on"), sayLine(id);  // a scripted line (a game hint) goes through the Reader: read-along and subtitles
    speak.src = `${voice}${id}.m4a`; speak.play().catch(() => {}); },
  keyLight: sp.key, ctx: snd.ctx, muted: () => snd.muted });

function props(root, list = []) {  // stand-in shapes for props not built yet (spread.json "props"): disc, box or ball
  for (const p of list) {  // {name, shape, at: the bottom centre, size: number or [x, y, z], color, glow, rot}
    const [w, d, h] = typeof p.size === "number" ? [p.size, p.size, p.size] : p.size ?? [0.1, 0.1, 0.1];
    const geo = p.shape === "ball" ? new THREE.SphereGeometry(w / 2, 24, 16).translate(0, w / 2, 0)
      : p.shape === "disc" ? new THREE.CylinderGeometry(w / 2, w / 2, h, 32).translate(0, h / 2, 0) : new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(...(p.color ?? [0.9, 0.85, 0.75])), roughness: 0.8,
      emissive: new THREE.Color(...(p.glow ?? [0, 0, 0])) }));
    mesh.name = p.name; mesh.position.copy(B(p.at)); mesh.rotation.y = rad(p.rot || 0);
    root.add(mesh);
  }
}

function wobble(o, deg = 7) {  // a little shake, dying away
  if (!o) return;
  const t0 = performance.now();
  effects.push(now => {
    const k = (now - t0) / 1000, e = Math.exp(-4 * k) * Math.sin(2 * Math.PI * 3 * k);
    nudge(o, o => { o.rotateZ(rad(deg) * e); o.scale.multiplyScalar(1 + 0.04 * e); });  // a tilt, which a round stone or lantern shows (a spin it would not)
    return k < 1.2;
  });
}
function wiggle(name, parts) {  // a touch thing answers a tap (both halves of a fold piece together)
  foley(`tap:${name}`, "tap");
  sparkle(parts[0].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0)));
  parts.forEach(o => wobble(o));
}

// a few sparkle bursts kept in the scene for good (invisible at rest): one made and thrown away per tap recompiled its shader, a 0.3-0.6 s stall
const sparks = Array.from({ length: 6 }, () => {
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(18 * 3, 3)),
    new THREE.PointsMaterial({ color: new THREE.Color(4, 3.2, 1.6), size: 0.018, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts);
  return pts;
});
let sparkN = 0;
function sparkle(at) {  // a little burst of light; bright enough that the bloom catches it
  sfx("sparkle", { gain: 0.35 });
  const pts = sparks[sparkN++ % sparks.length], g = pts.geometry, run = pts.userData.run = (pts.userData.run || 0) + 1;
  const dirs = Array.from({ length: 18 }, () => new THREE.Vector3().randomDirection().multiplyScalar(0.06 + Math.random() * 0.08));
  pts.position.copy(at);
  const t0 = performance.now();
  effects.push(now => {
    if (pts.userData.run !== run) return false;  // the burst was reused for a newer sparkle
    const k = (now - t0) / 800;
    if (k >= 1) return (pts.material.opacity = 0), false;
    dirs.forEach((d, i) => g.attributes.position.setXYZ(i, d.x * k, d.y * k - 0.04 * k * k, d.z * k));
    g.attributes.position.needsUpdate = true; pts.material.opacity = 1 - k * k;
    return true;
  });
}

// ---------- hands: a drag on the bottom strip of a page turns it; any other drag orbits (OrbitControls comes after, so a turn keeps its pointer) ----------
let drag = null, fingerX = 0, down = false, pend = null, pid = null, press = null, primed = false, flick = 0, trail = [];
const at = e => { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
const turnable = s => (mode === "open" && s !== 0) || (mode === "closed" && (s > 0 || (s < 0 && !!S.prevId)));

// ---------- the turn hint: a softly glowing page corner where the finger should pull, and the only place a pull turns ----------
const hint = { els: { "-1": $("curlL"), 1: $("curlR") }, spots: [], pulse: 0, at: {} };
function spot(s, view) {  // the bottom corner of side s (+1 right, -1 left), or the point of the page nearest it that the screen shows
  const f = S.flat, v = new THREE.Vector3(), seen = at => { v.copy(at).project(view); const px = (v.x + 1) / 2, py = (1 - v.y) / 2; return px > 0.04 && px < 0.96 && py > 0.06 && py < 0.86 && { s, x: px, y: py, at }; };
  const last = hint.moving && hint.at[s] && seen(hint.at[s]);  // while the camera moves, the point shown last (still on screen): the glow slides with the page, it does not hop about it under a finger
  if (last) return last;
  let best = null, bd = Infinity;
  for (let i = 0; i <= 13; i++) for (let j = 0; j <= 13; j++) {  // the whole half page, nearest the corner first: a close shot may show only its middle
    const dx = i * 0.07 * S.pageW, dz = j * 0.07 * S.pageD, d = Math.hypot(dx, dz);
    if (d >= bd) continue;
    const p = seen(new THREE.Vector3(s * (S.pageW - dx), f.max.y, f.max.z - dz));
    if (p) { best = p; bd = d; }
  }
  return best;
}
function showHint(now) {
  let view = cam;
  hint.moving = !!hint.cp && cam.position.distanceTo(hint.cp) > 0.05 * (now - hint.t) / 1000; hint.cp = cam.position.clone(); hint.t = now;  // faster than 5 cm/s: more than the breathing drift
  if (homing) { view = cam.clone(); view.position.copy(HOME); view.lookAt(LOOK); view.updateMatrixWorld(); }  // gliding home: where the corner will be
  hint.spots = ["closed", "open"].includes(mode) ? [1, -1].filter(turnable).map(s => spot(s, view)).filter(Boolean) : [];
  hint.at = Object.fromEntries(hint.spots.map(p => [p.s, p.at]));
  for (const [s, el] of Object.entries(hint.els)) {
    const p = hint.spots.find(p => p.s === +s);
    el.hidden = !p;
    if (p) { el.style.left = `${p.x * 100}%`; el.style.top = `${p.y * 100}%`; }
    if (p && hint.pulse) { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }
  }
  if (hint.spots.length) hint.pulse = 0;
  const read = mode === "open" && S.at >= S.page.lines.length && (S.play.complete || !S.play.targets.length);  // a read page always offers its forward corner: a shot that hides it 3.5 s hands the camera back to the reading view
  if (!read || !turnable(1) || homing || hint.spots.some(p => p.s > 0)) hint.lost = null;
  else if ((hint.lost ??= now) < now - 3500) { hint.lost = null; fit(); home(); }
}
const grabAt = (x, y) => hint.spots.find(p => Math.hypot((p.x - x) * innerWidth, (p.y - y) * innerHeight) < Math.max(48, innerWidth * 0.08))?.s ?? 0;

canvas.addEventListener("pointerdown", e => {
  if (!primed) { primed = true; unlock(reader.audio, speak); snd.ctx.resume().catch(() => {}); }  // iPad: unlock sound inside a touch
  const [x, y] = at(e), s = grabAt(x, y); fingerX = x; press = [e.clientX, e.clientY, performance.now()]; trail = [[performance.now(), x]];
  if (pid !== null || !turnable(s)) return;  // not a page turn: OrbitControls has it
  e.stopImmediatePropagation(); pid = e.pointerId; canvas.setPointerCapture(pid); down = true; pend = { x, fwd: s > 0, at: hint.spots.find(p => p.s === s)?.at };
});
canvas.addEventListener("pointermove", e => {
  const [x, y] = at(e); fingerX = x;
  if (pid === null) canvas.style.cursor = turnable(grabAt(x, y)) ? "grab" : "";
  if (e.pointerId !== pid) return;
  canvas.style.cursor = "grabbing";
  const t = performance.now(); trail.push([t, x]); trail = trail.filter(([u]) => t - u < 100);  // the last 0.1 s, for a flick's speed
  if (pend && (pend.fwd ? pend.x - x : x - pend.x) > 0.03) { turn(pend.fwd, false, pend.x, pend.at); pend = null; }  // only a pull the turning way
  else if (drag?.live && drag.held && !drag.isAuto) drag.move(x);
});
const up = e => {
  const [x, y] = at(e);
  if (e.type === "pointerup" && press && Math.hypot(e.clientX - press[0], e.clientY - press[1]) < 8 && performance.now() - press[2] < 450
      && (pid === null || pend)) tap(x, y);  // a short still press is a tap, even on the page's bottom strip
  press = null;
  if (e.pointerId !== pid) return;
  down = false; pend = null; pid = null; canvas.style.cursor = "";
  const [t0, x0] = trail[0] ?? [0, x], t1 = performance.now(); flick = t1 > t0 + 5 ? (x - x0) / ((t1 - t0) / 1000) : 0;
  if (drag?.live && !drag.isAuto) fling();
};
canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
addEventListener("keydown", e => { if (e.key === "ArrowRight") turn(true, true); if (e.key === "ArrowLeft") turn(false, true); });

const controls = new OrbitControls(cam, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minPolarAngle: rad(20), maxPolarAngle: rad(80),
  minAzimuthAngle: -rad(50), maxAzimuthAngle: rad(50) });
let homing = null;
function home(ms = 700) {  // glide back to the reading view; its length in ms
  if (![...cam.position.toArray(), ...controls.target.toArray()].every(Number.isFinite)) { cam.position.copy(HOME); controls.target.copy(LOOK); }
  const p0 = cam.position.clone(), t0 = controls.target.clone();
  ms = Math.max(ms, 1200 * Math.max(p0.distanceTo(HOME), t0.distanceTo(LOOK)), 25 * THREE.MathUtils.radToDeg(t0.clone().sub(p0).angleTo(LOOK.clone().sub(HOME))));  // never faster than 0.027 m a frame at its peak, nor a turn of 75°/s
  let t = 0, prev = performance.now();  // the glide's own clock, at most 17 ms a frame: a stalled frame (a shader compiling) never jumps the camera
  homing = now => { t += Math.min(now - prev, 17); prev = now; const k = smooth(0, 1, t / ms), r = swingRig({ pos: p0, look: t0 }, { pos: HOME, look: LOOK }, k); cam.position.copy(r.pos); controls.target.copy(r.look); return k < 1; };  // from a face shot's close view too, no whip
  return ms;
}
$("reset").onclick = () => home();

// ---------- every frame ----------
const corners = b => [...Array(8)].map((_, i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
const drawn = c => {  // a character's body as drawn now: each visible mesh's own box, posed and turned with it (not its hit box)
  const ps = [], b = new THREE.Box3(), v = new THREE.Vector3(); c.body.updateWorldMatrix(true, true);
  c.body.traverse(o => {
    if (!o.isMesh || !o.visible || o === c.proxy) return;
    if (o.isSkinnedMesh) { b.makeEmpty(); for (let i = 0, n = o.geometry.attributes.position.count; i < n; i += 8) b.expandByPoint(o.getVertexPosition(i, v)); }  // shortcut: every 8th
    else b.copy(o.geometry.boundingBox ?? (o.geometry.computeBoundingBox(), o.geometry.boundingBox));  // skinned vertex, a few mm short at most; every one if a cut ever shows
    ps.push(...corners(b).map(p => p.applyMatrix4(o.matrixWorld)));
  });
  return ps;
};
function fit() {  // the manifest's camera on a wide screen; on a narrow one closer and higher, the book a little lower
  const w = innerWidth, h = innerHeight, a = w / h, k = Math.min(1, Math.max(0, (16 / 9 - a) / (16 / 9 - 0.5)));  // 0 wide .. 1 a phone upright
  if (!w || !h) return;  // a hidden or zero-size window: keep the last good camera, the next real size fits again
  renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); renderer.setSize(w, h, false); composer.setSize(w, h);
  cam.aspect = a;
  cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(18 / (S?.m.camera.lens_mm || 38) / Math.min(a, 16 / 9)));  // Blender's 36 mm sensor, never narrower than the 16:9 renders
  if (k) cam.setViewOffset(w, h, 0, -0.04 * h * k, w, h); else cam.clearViewOffset();  // room above the book for the read-along page
  cam.updateProjectionMatrix();
  if (S) {  // narrow: a little higher, and close enough that the middle of the spread (where the story is) fills the width
    LOOK = B(S.m.camera.look);
    const sph = new THREE.Spherical().setFromVector3(B(S.m.camera.at).sub(LOOK)), f = S.flat, v = new THREE.Vector3();
    const keep = [cam.position.clone(), cam.quaternion.clone()];
    sph.phi += (rad(40) - sph.phi) * k;  // a phone upright looks down more steeply: the page floor, not the room, fills the tall frame
    for (let i = 0; k && i < 3; i++) {  // the page corners' widest reach on screen sets the distance
      cam.position.copy(LOOK).add(new THREE.Vector3().setFromSpherical(sph)); cam.lookAt(LOOK); cam.updateMatrixWorld();
      const reach = Math.max(...[-1, 1].flatMap(x => [f.min.z, (f.min.z + f.max.z) / 2].map(z => Math.abs(v.set(x * S.pageW * (1 - 0.1 * k), f.max.y, z).project(cam).x))));  // the back half, where the scene stands
      sph.radius *= reach / 0.98;
    }
    // desktop and tablet, as docs/reference/b1-open.png (approved): the diorama fills the frame. The backdrop's skyline sits at the
    // frame's top (no room above it: ambient.js roomShown, measured above only; room beside the backdrop is the reading nook), and the
    // frame's bottom edge lies on the page all across (no band of bare desk; the page's front edge and corners may run off the bottom).
    // Same angles as the director's; the distance and a vertical slide are solved for. A phone upright: its own steep view
    let dy = 0;
    if (S.sky) {
      const pose = (r, d) => { cam.position.copy(LOOK).add(v.setFromSpherical(sph.clone().set(r, sph.phi, sph.theta))).y -= d; cam.lookAt(LOOK.x, LOOK.y - d, LOOK.z); cam.updateMatrixWorld(); };
      const first = (ok, lo, hi, n = 30) => { for (let j = 0; j < n; j++) { const m = (lo + hi) / 2; ok(m) ? (hi = m) : (lo = m); } return hi; };  // the least value where ok holds
      const above = { ...S.sky, x0: -Infinity, x1: Infinity };  // the backdrop as wide as the world: only the room above it counts
      const slide = r => first(d => (pose(r, d), roomShown(cam, above) === 0), -1, 2);  // the slide that puts the skyline at the frame's top
      const eye = new THREE.Vector3(), ray = new THREE.Vector3();
      const onPage = () => [-1, -0.5, 0, 0.5, 1].every(x => {  // where the frame's bottom edge meets the page's plane: on the page, not the desk
        eye.setFromMatrixPosition(cam.matrixWorld); ray.set(x, -1, 0.5).unproject(cam).sub(eye);
        if (ray.y >= 0) return false;
        const k = (f.max.y - eye.y) / ray.y, px = eye.x + ray.x * k, pz = eye.z + ray.z * k;
        return Math.abs(px) <= S.pageW && pz <= f.max.z;
      });
      const subjects = S.cast.filter(c => !c.c.candle);  // the people and what they ride or stand in (a boat); not a game's little candle boats
      let body;  // their drawn bodies (a body not at its size yet, popping up or just made: its rest box, turned and where the page puts it), measured once, when needed
      const at = c => c.pos.clone().sub(new THREE.Vector3().setFromMatrixPosition(c.body.matrixWorld));  // a body not placed yet this page (a turn in): moved to where the page has it
      const whole = () => (body ??= subjects.flatMap(c => Math.abs(c.body.scale.x / c.s0 - 1) < 0.01 ? drawn(c).map(p => p.add(at(c))) : corners(c.box).map(p => p.multiplyScalar(c.s0).applyAxisAngle(up3, c.yaw).add(c.pos))))
        .every(p => { const q = v.copy(p).project(cam); return Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1; });  // whole in the frame
      if (a >= 1) {
        const r = first(r => (pose(r, slide(r)), !onPage()), 0.3 * sph.radius, 3 * sph.radius) * 0.999;  // the widest view whose bottom is still all page
        [sph.radius, dy] = [r, slide(r)];
      } else {  // an upright phone: no room above or beside the backdrop (the page's sides cropped: the reader orbits to them) and every
        const L0 = LOOK.clone(), s0 = sph.clone(), xs = subjects.map(c => c.pos.x), mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : L0.x;
        const at = (r, x, dz) => (LOOK.set(x, L0.y, L0.z + dz), pose(r, 0));  // person whole: the nearest such view, its look slid toward the reader
        const slid = (r, x) => { const dz = first(dz => (at(r, x, dz), roomShown(cam, above) === 0), 0, 1, 10); at(r, x, dz); return dz; };  // skyline at the top
        const key = [S.id, w, h, ...subjects.flatMap(c => [c.pos.x, c.pos.z, c.yaw].map(v => v.toFixed(2)))].join();  // the same page, screen and places: the same view
        if (S.phone?.key !== key) {
          S.phone = { key, found: false, rank: 6 };  // best: no room and the frame's bottom on the page, then over the desk; none such: whole, room or not
          search: for (const deg of [40, 35, 30, 25, 20, 15]) for (const x of [...[0, -0.1, 0.1, -0.2, 0.2].map(o => mid + o), L0.x]) {
            sph.phi = rad(deg);
            const r = first(r => (slid(r, x), whole()), 0.4, 2.5, 10), dz = slid(r, x);  // the nearest that holds them all
            if (!whole()) continue;
            const rank = (dz < 1 && !roomShown(cam, S.sky) ? (onPage() ? 0 : 1) : 2) + (spot(1, cam) ? 0 : 3);  // and the forward corner on screen: a phone has no other way on
            if (rank < S.phone.rank) S.phone = { key, found: true, rank, x, dz, phi: sph.phi, r };
            if (!rank) break search;
          }
        }
        const f = S.phone;
        if (f.found) LOOK.set(f.x, L0.y, L0.z + f.dz), sph.set(f.r, f.phi, sph.theta); else LOOK.copy(L0), sph.copy(s0);  // nothing holds them all: the whole-width view
      }
    }
    LOOK.y -= dy;
    HOME = LOOK.clone().add(v.setFromSpherical(sph));
    cam.position.copy(keep[0]); cam.quaternion.copy(keep[1]); cam.updateMatrixWorld();
    const d = cam.position.distanceTo(controls.target);  // never past where the camera is now: the controls would snap it there in one frame
    Object.assign(controls, { minDistance: Math.min(sph.radius / 3, d), maxDistance: Math.max(sph.radius / 0.6, d) });  // the director's close shots come in past 1/1.6
  }
}
addEventListener("resize", () => { fit(); if (S) gameView(S.play.begun && !S.play.complete); }); fit();
function gameView(on) {  // a phone upright frames the game while it is on (its only game view); otherwise the page's own view
  fit();
  const ts = on && innerWidth < innerHeight ? S.play.targets : [];
  if (ts.length) {  // every target on the screen, every character in the shot whole and a body's height off, then as close as that allows
    const steer = S.G.type === "steer" && S.byName[S.G.who ?? "bobo"], rider = steer && S.cast.find(c => c.ride?.on === steer);  // steer: the pair goes round each hazard
    const pts = ts.flatMap(o => {  // where each target goes for the whole game: a boat's flame drifts and bobs with its boat (place(): ±drift, ±0.6 drift)
      const b = new THREE.Box3().setFromObject(o), on = S.cast.find(c => { for (let a = o; a; a = a.parent) if (a === c.body) return true; }), dr = on?.c.bob ? (on.c.drift || 0) + 0.01 : 0;
      if (steer) { const len = steer.box.getSize(new THREE.Vector3()).multiplyScalar(steer.s0); b.expandByVector(new THREE.Vector3(1, 0, 1).multiplyScalar(0.15 + Math.max(len.x, len.z) / 2)); b.max.y += steer.height + (rider?.height ?? 0); }  // its sides (0.11), its stop (0.15 short), its length, its rider
      return corners(b).flatMap(p => dr ? [-1, 1].flatMap(sx => [-1, 1].map(sz => p.clone().add(new THREE.Vector3(sx * dr, sz * 0.008, sz * 0.6 * dr)))) : [p]);  // the whole target
    });
    const leap = S.G.type === "leap" && S.G.leap?.to && S.byName[S.G.rider ?? "kapi"];  // leap: where he lands is in the game's view too, or he leaps off it
    if (leap) pts.push(...corners(new THREE.Box3().setFromCenterAndSize(B(S.G.leap.to).add(new THREE.Vector3(0, leap.height / 2, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(leap.height))));
    const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const who = S.byName[S.G.who] ?? S.cast.filter(c => c.body.visible && (!S.acting.people || S.acting.people.has(c.name))).sort((a, b) => a.pos.distanceTo(mid) - b.pos.distanceTo(mid))[0];  // a person, not a boat
    const hull = new Map(S.cast.filter(c => c.body.visible).map(c => [c, drawn(c)]));
    const boxes = new Map([...hull].map(([c, ps]) => [c, new THREE.Box3().setFromPoints(ps)]));
    const dir = HOME.clone().sub(LOOK).normalize(), side = new THREE.Vector3().crossVectors(dir, up3).normalize(), up = new THREE.Vector3().crossVectors(side, dir);
    const frame = ps => {  // the middle of a set of points, across and up the screen
      const xs = ps.map(p => p.dot(side)), ys = ps.map(p => p.dot(up)), m = ps.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(ps.length);
      return m.addScaledVector(side, (Math.max(...xs) + Math.min(...xs)) / 2 - m.dot(side)).addScaledVector(up, (Math.max(...ys) + Math.min(...ys)) / 2 - m.dot(up));
    };
    const view = cam.clone(), q = new THREE.Vector3(), seen = (p, m) => (q.copy(p).project(view), q.z < 1 && Math.abs(q.x) < m && Math.abs(q.y) < m);  // the read-along offset included
    const clear = who?.height ?? 0, inShot = new Set(who ? [who] : []);
    let at, back;
    for (let k = 0; k < 5; k++) {  // a character that comes into the shot joins it whole: none is ever cut by the frame's edge
      const set = [...pts, ...[...inShot].flatMap(c => hull.get(c))];
      at = frame(set); back = 0.05;
      const fits = () => (view.position.copy(at).addScaledVector(dir, back), view.lookAt(at), view.updateMatrixWorld(),
        set.every(p => seen(p, 0.85)) && [...boxes.values()].every(b => b.distanceToPoint(view.position) >= clear));
      for (let i = 0; i < 150 && !fits(); i++) back *= 1.03;  // the nearest that holds it all
      const more = [...hull].filter(([c, ps]) => !inShot.has(c) && (!S.acting.people || S.acting.people.has(c.name)) && ps.some(p => seen(p, 1)));  // people; a boat may run off the edge
      if (!more.length) break;
      more.forEach(([c]) => inShot.add(c));
    }
    LOOK = at; HOME = at.clone().addScaledVector(dir, back); Object.assign(controls, { minDistance: Math.min(controls.minDistance, back * 0.8), maxDistance: Math.max(controls.maxDistance, back * 1.25) });  // the controls never clamp the game view
  }
  const shot = on && S.m.shots?.game;  // a director's game shot holds the game (ambient.js); gliding home under it would take the camera off it
  return !shot || (on && innerWidth < innerHeight) ? home(on ? 400 : 700) : 0;  // a phone's only game view: a calm glide, begun as the line before the game ends
}

let last = performance.now();
const head = new THREE.Vector3(), up3 = new THREE.Vector3(0, 1, 0), tilt = new THREE.Quaternion();
let slow = 0, dimAt = 0, dimOn = false, dimSince = -1e9;
const clock = { id: null, t0: 0 }, word = { id: null, i: -1 };
const toWorld = (o, p) => { o.parent.updateWorldMatrix(true, false); o.position.copy(o.parent.worldToLocal(p)); };
const inHandAt = ({ bone, seat }, v) => seat ? seat.at(v) : (bone.updateWorldMatrix(true, false), v.setFromMatrixPosition(bone.matrixWorld));  // a held bowl by its rim (acts.js byRim); else at the hand bone
function moveProps() {  // props the story moved stay where they are drawn (risen, in a hand, set down), so taps and acts find them there
  for (const [what, dy] of Object.entries(S.lifts)) {
    const o = S.root.getObjectByName(what);
    if (!o || (S.animated.has(o.name) && !shown)) continue;  // animated: lifted from where the paper's animation put it this frame
    if (!S.animated.has(o.name)) o.position.copy(o.userData.rest ??= o.position.clone());  // still: lifted from where it stood
    toWorld(o, o.getWorldPosition(head).addScaledVector(up3, dy));
  }
  for (const h of S.held) { const { o } = h; o.userData.rest ??= o.position.clone(); toWorld(o, inHandAt(h, head)); S.cast.find(c => c.body === o)?.pos.copy(head); }  // a held character is there for good: where() and its riders find it in the hand
  for (const [what, p] of Object.entries(S.placed)) { const o = S.root.getObjectByName(what) || S.byName[what]?.body; if (o) { o.userData.rest ??= o.position.clone(); toWorld(o, p.clone()); } }
  shown = false;
}
function dimReading(now) {  // the read-along page fades while a character's head or a game target is behind it
  if (now < dimAt) return;
  dimAt = now + 50;  // often enough to step aside before a moving head arrives
  const v = new THREE.Vector3(), on = (pts, r, m = 0) => !!r && pts.some(([x, y]) => x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m);
  const px = ps => ps.map(p => p.project(cam)).filter(p => p.z < 1).map(p => [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]);
  const bodies = S.cast.filter(c => c.body.visible), targets = S.play.begun ? px(S.play.targets.filter((_, i) => S.play.open(i)).map(o => o.getWorldPosition(v.clone()))) : [];
  const heads = px(bodies.flatMap(c => {  // the whole head where the rig has it (a hanging monkey's is at the bottom), not the crown
    c.head ??= (() => { let b = false; c.model.traverse(o => { if (!b && o.isBone && /head/i.test(o.name) && !/top|end/i.test(o.name)) b = o; }); return b; })();
    const at = c.head ? c.head.getWorldPosition(v.clone()) : c.body.getWorldPosition(v.clone()).add(new THREE.Vector3(0, c.height * 0.9, 0)), r = c.height * 0.12;
    return [[0, 0, 0], [r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]].map(([x, y, z]) => at.clone().add(new THREE.Vector3(x, y, z)));
  }));
  const rect = document.querySelector(".ra-page.show")?.getBoundingClientRect();
  const behind = mode === "open" && (on(heads, rect, 40) || on(targets, rect));  // a head steps the page aside before it reaches it
  if (behind !== dimOn && (behind || now - dimSince >= 1000)) { dimOn = behind; dimSince = now; document.documentElement.classList.toggle("ra-dim", behind); }  // aside at once, back after a second: no flicker
  const b = $("count");  // the count's corner: the right one, else the left, whichever has no character (feet to head) or target behind it
  if (!b.hidden) {
    const all = [...targets, ...px(bodies.flatMap(c => [0, 0.5, 1].map(k => c.body.getWorldPosition(v.clone()).add(new THREE.Vector3(0, c.height * k, 0)))))];
    const w = b.offsetWidth, hh = b.offsetHeight, x = innerWidth * 0.03, y = innerHeight * 0.91 - 8;
    const right = on(all, { left: innerWidth - x - w, right: innerWidth - x, top: y - hh, bottom: y }, 24), left = on(all, { left: x, right: x + w, top: y - hh, bottom: y }, 24);
    b.classList.toggle("left", right && !left); b.classList.toggle("dim", right && left);
  }
  return behind;
}
renderer.setAnimationLoop(now => {
  const gap = (now - last) / 1000, dt = Math.min(0.05, gap); last = now;
  slow = gap > 0.02 && gap < 0.25 ? slow + gap : 0;  // a second of frames over 20 ms (a pause is not slow): drop to 1x
  if (slow > 1 && dpr > 1) { dpr = 1; slow = 0; fit(); }
  if (!S) return;
  if (mode === "open") show(age + dt * FPS);
  if (mode === "closed" && now > peelAt) {  // a corner lifts now and then to say "pull me"
    const k = (now - peelAt) / 900;
    show(S.T0 + (k < 1 ? 3 * Math.sin(Math.PI * k) : 0));
    if (k >= 1) peelAt = now + 3500;
  }
  if (drag?.live && drag.track) { drag.corners = drag.track(); if (drag.held && !drag.isAuto) drag.move(fingerX); }  // the finger follows the corner where it is now
  if (drag?.isAuto && drag.live && drag.held) {  // an arrow-key turn: an invisible hand lifts the page, by frame time
    autoK = Math.min(1, autoK + dt / 0.65); drag.target = 0.62 * autoK * autoK * (3 - 2 * autoK);
    if (autoK >= 1) drag.held = false;
  }
  if (reader.id !== clock.id) Object.assign(clock, { id: reader.id, t0: now });
  if (mode === "open" && reader.id) {  // the acts follow the reader: its line, how far into it (by the clock when no voice plays), and whose words those are
    const a = reader.audio, t = a.ended ? Infinity : a.error || a.paused ? (now - clock.t0) / 1000 : a.currentTime;  // a failed file stays "playing" at 0
    const ws = timing[reader.id]?.words ?? [], wi = ws.findLastIndex(([w]) => w <= t);
    if (word.id !== reader.id || wi < word.i) Object.assign(word, { id: reader.id, i: -1 });  // a new line, or the same one again
    for (let j = word.i + 1; j <= wi; j++)  // each word as it is read: its "line:<id>:<word>" foley, every time (a slow frame skips none; a stale one plays none)
      if ((!a.paused || a.error) && t - ws[j][0] < 0.5) foley(`line:${reader.id}:${norm(text[reader.id].split(" ")[j] ?? "")}`, null);
    word.i = Math.max(word.i, wi);
    S.acting.tick(reader.id, t, Math.min(gap, 2), reader.audio.paused ? null : speakers[reader.id]?.[timing[reader.id].words.findLastIndex(([a]) => a <= t)]);
  }
  S.cast.forEach(ch => place(ch, dt, now));
  S.play.update(now);
  for (const ch of S.cast) if (ch.ride && !ch.slide) {  // again, after a game may have rolled the mount (the waves): on its back, leaning with it, and a
    const m = ch.ride.on.body, l = ch.model.getObjectByName("leftFoot"), r = ch.model.getObjectByName("rightFoot");  // rock of the rider's own a lean from its planted foot
    ch.half ??= l && r ? l.getWorldPosition(new THREE.Vector3()).distanceTo(r.getWorldPosition(new THREE.Vector3())) / 2 : 0;
    const lean = ch.half * Math.abs(Math.sin(ch.body.rotation.z));
    ch.body.quaternion.premultiply(tilt.setFromAxisAngle(up3, -m.rotation.y).premultiply(m.quaternion));  // its roll and pitch, not its turn
    carry(ch, o => o.body.position, cam.position, true);  // the frame's last, tilted as drawn: a held rider measures its gap here
    ch.body.position.copy(ch.pos).addScaledVector(up3, ch.ride.held ? 0 : lean);  // (a held gap measures its feet itself)
  }
  moveProps();  // after the last carry: a prop in a rider's hand is where the hand is now
  for (const ch of S.cast) if (ch.ride && !ch.slide && S.held.some(h => h.o === ch.ride.on.body)) carry(ch, o => o.body.position, cam.position), ch.body.position.copy(ch.pos);  // riding what a hand holds (Pip on the lamp)
  for (const o of S.play.targets) {  // a decal (the builder's "decal") lit: its "<name>-lit" card shows, the dark card hides
    const lit = o.userData.lit ??= o.getObjectByName(`${o.name}-lit`) ?? false;
    if (!lit) continue;
    const on = o.children.some(m => m.isMesh && m.material.emissive?.getHex() > 0);  // shortcut: lit = glow() turned the dark card's black emissive on; upgrade if a decal is ever exported glowing
    lit.scale.setScalar(on ? 1 : 0); o.children.forEach(m => m.isMesh && (m.visible = !on));
  }
  effects.splice(0, effects.length, ...effects.filter(f => f(now)));
  snd.update(dt);
  hooks.forEach(h => h.frame?.(dt, now));
  if (homing && !homing(now)) homing = null;
  controls.update();
  for (const s of [$("sbub"), $("lbub")]) if (!s.hidden && s.who) {  // a bubble rides above its speaker's head
    s.who.body.getWorldPosition(head).add(new THREE.Vector3(0, s.who.c.height * 1.15, 0)).project(cam);
    const half = s.offsetWidth / 2 + 8;  // kept whole on the screen, over the speaker as near as it can be
    s.style.left = `${Math.min(innerWidth - half, Math.max(half, (head.x + 1) / 2 * innerWidth))}px`; s.style.top = `${(1 - head.y) / 2 * 100}%`;
  }
  showHint(now); dimReading(now);
  composer.render();
  for (const [o, p, q, sc] of undo.splice(0).reverse()) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); }
});
enter(await load(first), "closed");
canvas.focus();
window.live = { get home() { return HOME && { pos: HOME.clone(), look: LOOK.clone(), fov: cam.fov }; },  // the reading view, current after every resize
  get mode() { return mode; }, get frame() { return frame; }, get S() { return S; }, get root() { return S.root; }, get cast() { return S.cast; },
  get acting() { return S.acting; }, get game() { return S.play; }, get exitOn() { return exitOn; }, get dpr() { return dpr; }, hint, snd, played, scene, composer, renderer, reader, hooks, turn, tap, readFrom, fit, dim: dimReading, controls, cam, load, spreads, reset: home,
  halt: () => (homing = null, true) };  // the director takes the camera from the glide home (ambient.js, a spread turned to)
