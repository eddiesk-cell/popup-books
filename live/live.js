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
import { makeBody } from "./bookbody.js";
import { makeArrival } from "./arrive.js";
import { Acting, mount, carry, puppetModel, byRim, holdOf, seatHeld, dropOf } from "./acts.js";
import { makeGame, glow } from "./games.js";
import { addSound, manifestFor } from "./sound.js";
import { createStoryFx } from "./storyfx.js";
import { makeNotice } from "./notice.js";
import { ambient, skyline, roomShown, storyPuppet, swingRig } from "./ambient.js";
import { extraModel } from "./extras3d.js";

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
const PHONE = innerWidth < 600;  // the settings only a phone gets: it would drop to 1x and lose its render buffers mid-read anyway; shortcut: bloom stays on (every spread has fireflies or lit things, a check of eight found none without), skip it per spread if one ever has none
let dpr = PHONE ? 1 : Math.min(devicePixelRatio, 1.5);  // retina at 2x costs most of a frame (review A3E2 #10): 1.5, and 1 if frames stay slow
renderer.setPixelRatio(dpr);
renderer.debug.checkShaderErrors = location.search.includes("debug");  // three asks the GPU for every program's link status and log the moment it is used, a stall at each first sight; off unless ?debug
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;  // matched to the Blender plate b1-84 in headless Chrome: spread 1 at home 102/99/68 vs 105/99/66 (1.0: 133/130/95)
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFShadowMap;  // r187 dropped PCFSoft; radius softens
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.02, 40);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: PHONE ? 2 : 4 }));
composer.addPass(new RenderPass(scene, cam));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 1.2));  // above 1.2 only the glowing bits bloom, never the white paper
composer.addPass(new OutputPass());

// ---------- the table and the arrival: made first, so the shelf's closed book can land while everything else loads ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// a spread's model and its pictures (published apart, one request each): a picture whose request fails leaves its card a flat grey
// cut-out, so the model is loaded once more (the cache hands back all but that picture). onPart(k): how far, 0..1: the model's bytes
// are the first 40 percent, its pictures the rest (they are asked for once the model is read)
const glb = (url, onPart, size) => {  // size: the model's real bytes (spread.json "glbBytes", written at publish): a gzipping host sends the compressed length as total
  let bad = 0, bytes = 0, pics = 0; const m = new THREE.LoadingManager(), tell = () => onPart?.(0.4 * bytes + 0.6 * pics);
  m.onError = () => bad++;
  m.onProgress = (u, done, total) => { if (!/\.glb$/.test(u)) pics = total > 1 ? done / total : pics; tell(); };  // the model counts as one of `total`
  return new GLTFLoader(m).setMeshoptDecoder(MeshoptDecoder).loadAsync(url, e => (size || e.total) && ((bytes = Math.min(1, e.loaded / (size || e.total))), tell()))
    .then(g => (bad ? loader.loadAsync(url) : g));
};
if (q.get("from") === "shelf") for (const f of ["spread.json", "spread.glb"]) fetch(`${dirOf(first)}/${f}`).then(r => f === "spread.json" && r.ok ? r.json() : null).then(m => m && !S && (scene.background = new THREE.Color(...WORLD[m.stage?.name] || WORLD.night))).catch(() => {});  // and the reader's own sky is up before the first arrival frame  // the first spread's files start now, in parallel with the book's words, so the cover can open onto it sooner (the browser's cache hands them to load())
const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2),  // the walnut desk the renders stand on (not in the export)
  new THREE.MeshStandardMaterial({ color: new THREE.Color(0.07, 0.033, 0.015), roughness: 0.6 }));  // satin, not polished: at 0.32 the sun's reflection on it was a white blob across the left of a phone's opening frame (T55)
desk.receiveShadow = true; scene.add(desk);
const drawArrival = withSpread => (withSpread ? composer : renderer).render(scene, cam);  // before the spread is up the plain renderer (no bloom, no multisampled buffers): the arrival must not slow its loading
let arrival3 = null;
const body = makeBody(THREE, scene, { book: bookId, phone: PHONE, loader });
body.onload = sp => sp === S && (desk.position.y = body.fit(sp) - 0.002);  // the model arrived after the spread: the desk drops to its bottom  // the open leather book under every spread, sized from the spread's own page
const arrival = q.get("from") === "shelf" && $("arrive"), calm0 = matchMedia("(prefers-reduced-motion: reduce)").matches;  // coming from the shelf: the closed book lands and opens; a direct link has none
let arrived = !arrival, spreadReady = false, veil = null;
const lift = () => arrived && spreadReady && arrival && (arrival.style.opacity = 0, setTimeout(() => arrival.remove(), 280));  // the stand-in's veil lifts when its arrival is over and the spread is up
if (arrival) {  // 3D: the shelf's own closed book (arrive.js); the CSS veil only covers the first frames
  arrival.classList.add("veil"); veil = arrival; document.documentElement.classList.add("arriving");  // the page's own marks wait (the main loop clears this at the hand-over)
  arrival3 = makeArrival({ THREE, scene, cam, renderer, body, desk, play: (n, o) => { try { snd.play(n, o); } catch { /* not up yet */ } },
    ctl: { get target() { try { return controls.target; } catch { return new THREE.Vector3(); } } },  // the orbit controls, made further down: until then a stand-in
    reader: () => { try { return S && HOME ? { ...(S.rest ??= restPose()), root: S.root, warm: () => { S.cast.forEach(c => (c.body.visible = true)); const p = renderer.compileAsync(scene, cam).catch(() => {}); S.cast.forEach(c => (c.body.visible = false)); return p; }, lights: (S.lights ??= (() => { const l = []; S.group.traverse(o => o.isLight && l.push(o)); S.stage.traverse(o => o.isLight && l.push(o)); return l; })()) } : null; } catch { return null; } },  // where the reader rests (home, look), the spread's root, a warm-up and its lights (null until the spread is up)
    calm: calm0, show: () => { if (S) S.group.visible = S.stage.visible = true, S.cast.forEach(c => (c.body.visible = false)); } });  // the spread's pages lie on the shut book; its cast stays hidden until the loop places it (the first frame after the swing)
  for (const t of ["pointerdown", "keydown"]) addEventListener(t, () => arrival3.skip(), { once: true, capture: true });  // a tap or key goes straight to the open book
  renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(18 / 38 / Math.min(cam.aspect, 16 / 9))); cam.updateProjectionMatrix();  // the camera and the canvas, until fit() takes over
  renderer.setAnimationLoop(now => { arrival3.frame(now); if (arrival3.rendered && veil) { const v = veil; v.style.opacity = 0; setTimeout(() => v.remove(), 300); veil = null; } arrival3.active && drawArrival(false); });  // draws the arrival at once; the main loop below replaces it
  setTimeout(() => { if (arrival3.failed) arrival.classList.remove("veil"), (veil = null, arrived = true, lift()); else if (veil) veil.style.opacity = 0; }, 2500);  // the model never came: the stand-in plays out; otherwise the veil is gone by now
  const wait = setInterval(() => arrival3.failed && (clearInterval(wait), arrival.classList.remove("veil"), (veil = null), setTimeout(() => (arrived = true, lift()), 2200)), 200);
}

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
  if (step > 0 && sp.m.next) return await isBuilt(sp.m.next) ? sp.m.next : null;  // a manifest's own "next" (test chains), if exported: not yet, this is the last page for now (the moral); null, an export's last page, leaves it to book.json (the moral)
  if (step < 0 && sp.prev) return sp.prev;  // back the way we came
  for (let i = order(sp) + step; i >= 0 && i < book.spreads.length; i += step) if (await isBuilt(book.spreads[i].dir)) return book.spreads[i].dir;
  return null;
}

// ---------- a spread: loaded once, kept, entered when its page is turned to ----------
const models = {}, spreads = {};  // the slim characters are meshopt-compressed
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
  for (const e of [...m.extras ?? [], ...m.ambient?.surprises ?? []]) if (e.model) extraModel(e.model).catch(() => {});  // the 3D extras (extras3d.js) start downloading with the spread glb, as the characters below
  for (const sh of Object.values(m.shots ?? {})) if (sh?.phone) {  // a shot's "phone": {...} replaces its fields on an upright phone, read as the shot plays
    const own = { ...sh }, ph = sh.phone;
    for (const k of new Set([...Object.keys(own), ...Object.keys(ph)])) if (k !== "phone") Object.defineProperty(sh, k, { get: () => (innerWidth < innerHeight && k in ph ? ph : own)[k], enumerable: true });
  }
  for (const c of m.characters ?? []) if (!c.model.startsWith("puppet:")) [c, ...(c.wear ?? [])].forEach(w => modelOf(w.model).catch(() => {}));  // and what they wear  // the characters and the beds start downloading with the spread glb, not after it
  for (const l of built ? bedsOf({ m }) : []) { const u = sm.beds[[].concat(l)[0]]; u && fetch(u).catch(() => {}); }
  const g = built ? await glb(`${dir}/spread.glb`, k => !S && note(`Opening the book… ${Math.min(99, Math.round(100 * k))}%`), m.glbBytes)  // shortcut: a gzipped file (GitHub Pages) reports its compressed length as total while loaded counts decoded bytes, so it ran past 100; 99 until it resolves, upgrade if the export ever writes each glb's real size
    .then(g => (!S && note("Opening the book… 100%"), g))
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
      d.castShadow = true; d.shadow.mapSize.setScalar(innerWidth < 600 ? 1024 : 2048); d.shadow.radius = 4; d.shadow.bias = -0.0004; d.shadow.normalBias = 0.01;  // a phone's 390 px wide book does not show the difference
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
  sp.lifts = {}; sp.held = []; sp.placed = {}; sp.falls = [];
  sp.acting = new Acting(m.acts || [], sp.cast, { cam, where, wordAt, loop, once, started: a => foley(`act:${[].concat(a.who ?? a.what)[0]?.replace(/\d+$/, "")}:${a.do}`, null),
    people: new Set([...Object.values(speakers).flat(), ...sp.cast.filter(c => c.clips.Talk).map(c => c.name)]),  // who speaks, or can: not boats
    spot: what => sp.placed[what]?.clone() ?? sp.root.getObjectByName(what)?.getWorldPosition(new THREE.Vector3()) ?? null, put: (what, p) => sp.held.some(h => h.what === what) || (sp.falls = sp.falls.filter(f => f.what !== what), sp.placed[what] = p),  // a flight still running never pulls a prop out of a hand
    motion: Object.fromEntries(sp.cast.map(ch => [ch.name, motionAll[ch.c.model.split("/").pop()] ?? motionAll[ch.name]])),
    find: what => sp.root.getObjectByName(what) || sp.byName[what]?.body,  // hide / show reach a prop or a cast body by name
    raise: (what, dy) => (sp.lifts[what] = dy),  // a prop rising: kept as an offset, laid on after the paper's own animation
    hold: (ch, what, hand, on, a = {}) => {  // a prop in a hand follows the hand bone until let go; a cast prop (a bowl, a lamp) is held by its rim; "grip" / "aim" (acts.js) seat and aim it
      const was = sp.held.find(h => h.what === what);
      sp.falls = sp.falls.filter(f => f.what !== what);  // a new hold or release ends a fall it began
      if (!on && was) {
        sp.placed[what] = was.pose ? was.o.getWorldPosition(new THREE.Vector3()) : inHandAt(was, new THREE.Vector3());  // let go: it stays where the hand had it, for a fly on from there
        if (a.fall ?? !!was.pose) { const dy = dropOf(was.o, sp.root); if (dy > 1e-4) sp.falls.push({ what, from: sp.placed[what].clone(), dy, t0: performance.now() }); }  // ...or falls to what is under it
      }
      sp.held = sp.held.filter(h => h.what !== what);
      const o = sp.root.getObjectByName(what) || sp.byName[what]?.body, bone = ch.model.getObjectByName(`${hand || "right"}Hand`);
      const pose = on && o && holdOf(o, a);  // null: no grip or aim, the old seat
      if (on && o && bone) sp.held.push({ what, o, bone, pose, aim: a.aim, seat: !pose && sp.byName[what] && byRim(ch, bone, sp.byName[what]) }), delete sp.placed[what];  // held: where a flight left it no longer counts
      else if (on) console.warn("cannot hold", what, "in", ch.name);
    } });

  sp.G = { type: "collect", ...sp.page.game, ...sp.m.game };  // a test page's spread.json may carry its own "game"
  arm(sp);
  sp.props = new Map();
  // a fold piece is two halves, "<name>-1" and "<name>1" (or one parent "<name>"): one touch thing, its sound "tap:<name>"
  const piece = n => { const b = n.replace(/-?1$/, ""); return b !== n && sp.root.getObjectByName(`${b}-1`) && sp.root.getObjectByName(`${b}1`) ? b : n; };
  for (const n of new Set(m.touch.map(piece))) {
    const one = sp.root.getObjectByName(n), parts = one ? [one] : [`${n}-1`, `${n}1`].map(h => sp.root.getObjectByName(h)).filter(Boolean);
    if (!sp.byName[n]) parts.forEach(o => sp.props.set(o, () => wiggle(n, parts)));
  }
  for (const o of sp.play.targets) if (!sp.byName[o.name] && !sp.props.has(o)) sp.props.set(o, () => wiggle(o.name, [o]));  // a game target that is only a page piece answers as a thing before its line and once won (pick() gives the game its own handler while it takes taps)
  return sp;
})();

function topOf(o) {  // the point on top of an object, straight above its middle: what a climber stands on
  if (!o) return null;
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(o), mid = box.getCenter(new THREE.Vector3());
  ray.set(mid.clone().setY(box.max.y + 1), new THREE.Vector3(0, -1, 0));
  return ray.intersectObject(o, true)[0]?.point ?? mid.setY(box.max.y);
}

const noStandIn = root => root.traverse(o => (/^(block|cover)-?1$/.test(o.name) || o.material?.name === "cloth") && (o.visible = false));  // the export's own stand-in page blocks, navy cloth boards and spine cylinder: the book's body (bookbody.js, its leather from cover.json) is the book now
const exitOf = sp => sp.exit ??= sp.stub ? Promise.resolve(null) : glb(`${dirOf(sp.id)}/exit.glb`).then(g => {  // the right page turning away
  const root = g.scene, mixer = new THREE.AnimationMixer(root), leaf = root.getObjectByName("rleaf");
  g.animations.forEach(c => mixer.clipAction(c).play()); shade(root); noStandIn(root);
  const end = Math.max(...g.animations.map(c => c.duration)) - 1e-4, show = f => mixer.setTime(Math.min((f - 1) / FPS, end));
  show(1); root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root.getObjectByName("rleaf-page") || leaf);
  return { root, show, leaf, n: (sp.m.exit_frames || 73) - 1, corner: leaf.worldToLocal(new THREE.Vector3(b.max.x, b.max.y, b.max.z)) };
}).catch(e => (console.warn("no exit turn for", sp.id, e), null));

function arm(sp) {  // the page's game, fresh (games.js: collect, order, shadow, echo)
  sp.play = makeGame(sp, gameEnv(sp)); Object.assign(sp, { promptEnd: 0, touched: false, skip: false });  // auto play: when the prompt ended, whether the child touched, whether the story moved on past the game
  // what a tap reaches, in order: a target it hits exactly, a character, a target near the fingertip, then a touch thing,
  // so neither a monkey's generous hit box nor the tree swallows the fruit beside it
  const early = () => sp.G.before && !sp.play.begun, kind = () => (early() ? "sparkle" : "game");
  sp.fruit = new Map([...sp.play.targets.map((o, i) => [o, () => (rec(o.name, kind()), sp.play.tap(i))]), ...[...sp.play.extra].map(([o, f]) => [o, () => (rec(o.name || "halo", kind()), f())])]);
}
// the paper animals' night and eve cards, measured against their day cards (53 night and 28 eve cards, alpha-weighted mean sRGB): night = luma(day) x [0.645, 0.689, 0.804] (spread 0.01-0.03), eve = luma(day) x [1.20, 0.885, 0.57] (looser, 0.1)
const GLOW = 0.15;  // the paper cards' own backlight (ambient.js card(): emissiveIntensity 0.15), so a 3D animal is lit the way a card is; calibrated on a flat 50% grey, see the commit
const GRADE = { night: [0.645, 0.689, 0.804], evening: [1.2, 0.885, 0.57] };
function gradeAnimal(model, stage) {
  const k = GRADE[stage]; if (!k) return;
  const own = m => {  // its own copy: the loaded model is shared by every spread, day ones too
    m = m.clone(); m.customProgramCacheKey = () => `grade-${stage}`;
    m.onBeforeCompile = sh => (sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb = min(pow(vec3(dot(pow(diffuseColor.rgb, vec3(1.0 / 2.2)), vec3(0.2126, 0.7152, 0.0722))) * vec3(${k.join(", ")}), vec3(2.2)), vec3(1.0));`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * ${GLOW};`));  // the paper cards' own light through thin paper (ambient.js card()), graded the same
    return m;
  };
  model.traverse(o => o.isMesh && (o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material)));
}
const modelOf = file => models[file] ??= loader.loadAsync(`chars/${file.split("/").pop()}`)  // "assets/kapi.glb": its slim copy, web/live/chars
  .catch(() => loader.loadAsync(`../${file}`))  // no slim copy (yet): the original, through web/assets
  .then(g => (g.animations.forEach(a => { const t0 = Math.min(...a.tracks.map(k => k.times[0])); if (t0 > 0 && t0 < Infinity) { new Set(a.tracks.map(k => k.times)).forEach(t => t.forEach((v, i) => (t[i] = v - t0))); a.resetDuration(); } }), g));  // every clip starts at 0: one whose first key is late (0.042 s in some exports) holds a frame at each loop's wrap. Tracks share their times arrays, so each array moves once
async function character(c, sp) {
  const g = c.model.startsWith("puppet:") ? puppetModel(THREE, await storyPuppet(c.model.slice(7), sp.m.stage?.name))  // "puppet:tong": a paper puppet
    : await modelOf(c.model);
  const model = clone(g.scene), pivot = new THREE.Group(), body = new THREE.Group();
  if (c.model.includes("/animals/")) gradeAnimal(model, sp.m.stage?.name);  // a 3D animal takes the night/eve grade of the paper cards; the story's own characters stay as lit
  body.name = c.name;  // a game reads a tapped one by name (the shadow game's spots)
  model.traverse(o => { if (o.isMesh) { o.visible = !o.name.startsWith("Icosphere"); o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
  pivot.rotation.y = rad(c.face ?? -90); pivot.add(model); body.add(pivot);
  body.updateMatrixWorld(true);
  const box = new THREE.Box3(); model.traverse(o => o.isMesh && o.visible && o.matrixWorld.determinant() !== 0 && box.expandByObject(o));  // the hidden bone-shape sphere is not measured, nor a spare head stored at scale 0 (its skinned box is NaN and blanked the page: toad request 00:51)
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  pivot.position.set(-mid.x, -box.min.y, -mid.z);  // stand on the floor, centred, as popup.py does
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x * 1.2, size.y * 1.1, size.z * 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.y = size.y * 0.5; body.add(proxy);  // the hit box: a little larger than the body, easy for a small finger
  const mix = new THREE.AnimationMixer(model), clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
  const ch = { c, body, model, mix, clips, proxy, box: box.clone().translate(pivot.position), who: c.name, name: c.name, height: c.height, s0: c.height / size.y, first: g.animations[0],
    start: sp.m.frames.alive + (c.delay || 0), ph: Math.random() * 6.28, pos: B(c.at), yaw: rad(c.rot || 0), hold: c.clip, nod: 0 };
  for (const w of c.wear ?? []) {  // "wear": [{"model", "bone"}]: an accessory made rigid in the character's own rest space (popup.py), so it rides its bone with no offset; a bone or file not there leaves the character as it is
    const b = model.getObjectByName(w.bone), a = b && await modelOf(w.model).then(g => clone(g.scene), () => null);
    if (!a) { console.warn("cannot wear", w.model, "on", c.name, w.bone); continue; }
    a.traverse(o => o.isMesh && (o.castShadow = o.receiveShadow = true, o.frustumCulled = false));
    model.add(a); model.updateMatrixWorld(true); b.attach(a);
  }
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
  if (book.fruit && /^Eat/.test(name)) done = inHand(ch, done);  // the Kapi book's jamun: a book without "fruit" in book.json tosses and eats nothing (turtle s09: Matsing's Throw is Pagong)
  const to = book.fruit && /^Throw/.test(name) && (ch.catcher ?? S.cast.filter(c => c !== ch).sort((a, b) => a.pos.distanceTo(ch.pos) - b.pos.distanceTo(ch.pos))[0]);
  if (to) setTimeout(() => toss(ch, to), clip.duration * 450);  // a Throw lets a jamun go at about its middle, to its named catcher (acts.js), else the nearest one
  const a = ch.mix.clipAction(clip);
  a.reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
  a.play(); if (ch.cur && ch.cur !== a) a.crossFadeFrom(ch.cur, 0.25, false);
  const was = ch.done; Object.assign(ch, { cur: a, done, pending: null });
  was?.();  // a clip cut short by another still finishes its act, so a "wait" never hangs
  return clip.duration;
}

// ---------- the current spread, and moving between spreads ----------
let titled = true, S = null, mode = "load", frame = 0, age = 0, exitOn = null, HOME, LOOK, peelAt = 0;  // frame: the clip frame shown; age: the same, unwrapped through the loop
let shown = false;  // the paper's animation was set this frame (so props it moves are back at their animated place)
const show = a => { age = a; frame = a < S.L0 ? a : S.L0 + (a - S.L0) % S.P; S.mixer.setTime(Math.min((frame - 1) / FPS, S.end)); shown = true; };

// ---------- hook: the cinematic layer (web/live/ambient.js) plugs in here ----------
// Its two lines: `import { ambient } from "./ambient.js";` up top, and `hooks.push(ambient);` just below. A hook may have
// spread(sp, scene, cam) — called as each spread enters (sp.group, sp.root and sp.m are that spread's scene and manifest) —
// and frame(dt, now) — called every frame before the picture is drawn.
const hooks = [];
hooks.push(ambient);

// ---------- hook: story effects (web/live/storyfx.js, stories/EFFECTS.md): a spread's "storyfx" entries play on their line's word ----------
// spread.json "storyfx": [{ "type", "line", "word", "at" | "who" | "what", "level", ... }] ("line": "rest" = while the page is open). popup.py also moves
// every "fx" entry that has a "line" here; an "fx" entry without one stays the baked floating life. A page with none builds nothing.
const sfxHook = (() => {
  const ONGOING = new Set(["rain", "haze", "embers", "halo", "sparkle", "notes", "breath", "sunrays", "rings"]);  // these stay until their line ends (or "secs")
  let fx = null, sp = null, on = [], fired = new Set(), seen = { line: null, t: 0, at: 0 }; const tex = {};
  const surf = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(sp.root, true).find(h => h.object.isMesh && !/card|wave|grass|crest/.test(h.object.name))?.point.y ?? 0;  // the paper's real height
  const named = n => sp.cast.find(c => c.name === n)?.body ?? sp.root.getObjectByName(n);
  const flat = a => { const p = B(a); p.y = Math.max(p.y, surf(p.x, p.z)); return p; };
  const play = (e, who) => {
    const o = { level: e.level, secs: e.secs, until: e.until, every: e.every, tint: e.tint, radius: e.radius, width: e.width, height: e.height, from: e.from, area: e.area, size: e.size };
    const sub = who ?? named(e.what), type = e.type ?? e.kind;
    if (sub) { const w = sub.getWorldPosition(new THREE.Vector3()); o.follow = sub; o.at = w; o.waterY = surf(w.x, w.z); o.size ??= sp.cast.find(c => c.body === sub)?.height; }
    else if (e.at) { o.at = flat(e.at); o.waterY = surf(o.at.x, o.at.z); }
    if (type === "bubbles" && o.at) for (const c of sp.cast) { const b = new THREE.Box3().setFromObject(c.body).expandByScalar(.02);  // bubbles start clear of a body, never inside one
      if (o.at.x > b.min.x && o.at.x < b.max.x && o.at.z > b.min.z && o.at.z < b.max.z && o.at.y < b.max.y) o.at.x = o.at.x - b.min.x < b.max.x - o.at.x ? b.min.x - .03 : b.max.x + .03; }
    if (e.dir) o.dir = B(e.dir); if (e.toward) o.toward = B(e.toward);
    if (e.shed) o.shed = named(e.shed) ?? B(e.shed);
    if (e.spots) o.spots = e.spots.map(s => ({ at: flat(Array.isArray(s) ? s : s.at), level: s.level }));
    if (e.card) o.card = tex[e.card] ??= Object.assign(new THREE.TextureLoader().load(`./cards/${e.card}.webp`), { colorSpace: THREE.SRGBColorSpace });
    return fx.play(type, o);
  };
  const start = (e, i) => { const items = [].concat(e.who ?? []).map(n => named(n)).filter(Boolean), me = fx;  // a list of cast: one effect each, 0.15 s apart
    if (!items.length) return on.push({ e, i, h: play(e), line: e.line });
    items.forEach((b, k) => setTimeout(() => fx === me && on.push({ e, i, h: play(e, b), line: e.line }), k * 150)); };
  return {
    get fx() { return fx; },
    tap(name) { if (fx) sp.m.storyfx.forEach((e, i) => e.line === `tap:${name}` && start(e, i)); },  // a tapped thing plays its storyfx entry whose "line" is "tap:<name>" (no reader line is ever called that)
    spread(s) { fx?.dispose(); fx = null; on = []; fired = new Set(); sp = s; seen = { line: null, t: 0, at: s.at ?? 0 };
      if (s.m.storyfx?.length) fx = createStoryFx(scene, renderer, { phone: PHONE, sound: (n, g) => snd.play(n, { gain: g }) }); },
    frame(dt) {
      if (!fx) return; const r = reader, s = { line: r?.id ?? null, t: !r || r.audio.ended ? Infinity : r.audio.currentTime, speaking: !!r && !r.audio.paused }, E = sp.m.storyfx;
      if (sp.at < seen.at) { fx.clear(); on = []; fired.clear(); }  // "Read again": everything starts over
      else if (s.line !== seen.line || s.t < seen.t - 0.3) for (const k of fired) if (k.startsWith(`${s.line}|`)) fired.delete(k);  // a line (again)
      seen = { ...s, at: sp.at };
      E.forEach((e, i) => { const k = `${e.line}|${e.word ?? ""}|${i}`; if (fired.has(k)) return;
        if (e.line === "rest" ? mode === "open" : s.line === e.line && (s.speaking || s.t === Infinity) && s.t >= (e.word ? wordAt(e.line, e.word) : 0)) { fired.add(k); start(e, i); } });
      on = on.filter(x => { const rest = x.e.line === "rest", gone = rest ? mode !== "open" : x.e.until === "line" || (ONGOING.has(x.e.type ?? x.e.kind) && x.e.secs == null && x.e.until == null) ? s.line !== x.line || s.t === Infinity : false;
        if (gone) { x.h.stop(); if (rest) fired.delete(`rest|${x.e.word ?? ""}|${x.i}`); } return !gone && !x.h.done; });
      fx.update(dt, cam);
    } };
})();
hooks.push(sfxHook);

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
  noStandIn(sp.root);
  for (const ch of sp.cast) ch.begin ??= { pos: ch.pos.clone(), yaw: ch.yaw, hold: ch.hold, on: ch.ride?.on };  // where the page began, for "Read again"
  showExit(null); S = sp; scene.add(sp.group, sp.stage);
  scene.background = new THREE.Color(...WORLD[sp.m.stage.name] || WORLD.night);
  desk.position.y = (sp.flat ? body.fit(sp) : sp.bottom) - 0.002;  // the boards rest on the desk: it sits at their bottom
  note(sp.stub ? `${dirOf(sp.id)} is not built yet: a stand-in book` : "", sp.stub);
  const fresh = !HOME;
  fit();
  if (arrival3?.active) sp.group.visible = sp.stage.visible = false;  // the arrival shows the closed book until it hands over; the camera stays where it is (onHandoff glides home)
  else if (!fresh) home(); else if (HOME) cam.position.copy(HOME), controls.target.copy(LOOK);  // opened in a hidden (zero-size) tab: the first real resize glides home
  q.set("s", sp.id); if (sp.id !== first) q.delete("with");  // the address names the page on the desk, so a reload reopens it
  history.replaceState(null, "", `?${q}`);
  hooks.forEach(h => h.spread?.(sp, scene, cam));
  Promise.all([neighbour(sp, -1), neighbour(sp, 1)]).then(([p, n]) => { Object.assign(sp, { prevId: p, nextId: n }); if (sp === S) free(sp.id, p, n); });
  snd.setBed(bedsOf(sp));
  renderer.compileAsync(scene, cam).catch(() => {});  // every material of this spread ready before it is first needed (no stall mid-story)
  const cards = new Set(); sp.group.traverse(o => o.isMesh && [].concat(o.material).forEach(m => m?.map?.image && (m.alphaTest || m.transparent) && !alphas.has(m.map) && cards.add(m.map)));
  (function read() { const t = cards.values().next().value; if (t && sp === S) cards.delete(t), alphaOf(t), (globalThis.requestIdleCallback ?? setTimeout)(read, { timeout: 2000 }); })();  // the cards' alpha read while the page is calm, one a task: a tap never waits for it
  how === "open" ? opened() : closed();
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(body.dress, 400)));  // the book's cover.json and textures once the spread has drawn (once)
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
  gone(sp.root); sp.stage.traverse(o => (o.shadow?.map?.depthTexture?.dispose(), o.shadow?.map?.dispose()));  // a shadow map's depth texture is its own: 22 MB a spread stayed on the GPU
  sp.mixer.stopAllAction(); sp.mixer.uncacheRoot(sp.root);
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
  const far = a < b ? 0.04 : 0.96, track = () => {  // ... on screen (fractions of the canvas), as the camera is now
    const c = world.map(w => (p.copy(w).project(cam), [(p.x + 1) / 2, (1 - p.y) / 2, p.z]));
    return c.every(q => q[2] < 1) && (c[b][0] - c[a][0]) * (far - x0) > 0 ? c : c.map(([, y], i) => [x0 + (far - x0) * (i - a) / (b - a), y]);  // a path behind a close camera (a face shot), or one running against the pull: the finger's own share of the way across
  };
  const c = track();
  set(a);
  drag = new PageDrag(set, land);
  drag.grab(c, a, b, auto ? c[a][0] : x0);
  drag.track = track;  // the opening shot moves the camera during a turn: the frame loop re-projects the track
  if (auto) { drag.isAuto = true; autoK = 0; }  // lifted over by the frame loop, by frame time: a stalled frame cannot drop it
  else { drag.move(fingerX); if (!down) fling(); }  // let go while the pop-ups were still folding: still a flick
}
let autoK = 0, frame_n = 0;
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
  if (titled) { titled = false; fit(); if (innerWidth < innerHeight) home(900); }  // the first pull: the story's own view (a wide screen: the director pushes in)
  mode = "open"; show(S.T1); ahead(S);  // the next spread and this page's exit turn start downloading as the page opens, so a child who turns early finds them waiting
  if (!back) turnHint();
  const n = S.page.lines.length;
  if (!back) foley("rise", "rise");
  S.at == null ? readFrom(0) : S.at < n ? readFrom(S.at) : $("bar").classList.add("on");  // read already: "Read again" waits
  const { G, play } = S;
  if (play.targets.length && !G.voice && !G.before) say(play.complete ? G.praise ?? "You found them all!" : G.start ?? "Find them all! Tap each one to pick it.");
}
const warmQ = [];
function warm(root) {  // a spread or exit turn that is waiting: its pictures on the GPU now, one a task, so the turn does not (a 2048 px page card is one 35-50 ms upload)
  const seen = new Set(); root.traverse(o => [].concat(o.material ?? []).forEach(m => [m.map, m.emissiveMap].forEach(t => t?.image && !seen.has(t) && seen.add(t) && warmQ.push(t))));
  if (warmQ.length === seen.size) (function step() { const t = warmQ.shift(); t && (renderer.initTexture(t), setTimeout(step, 30)); })();  // shortcut: shader programs are not warmed here: the turn links ~23 whatever compileAsync(next spread / exit) did, because showing both spreads re-keys every program (the lights count); upgrade by compiling the turn's real state
}
function ahead(sp) {  // what the next turn needs (the next spread, this one's exit turn), fetched once the page's last line or its game starts
  if (sp.ahead || sp !== S) return;
  sp.ahead = true; (globalThis.requestIdleCallback ?? setTimeout)(() => { neighbour(sp, 1).then(id => id && sp === S && load(id)).then(n => n && warm(n.group)); exitOf(sp).then(ex => ex && warm(ex.root)); }, { timeout: 1500 });  // when the page has a moment: a page that draws every frame never has an idle one, so at the latest 1.5 s on
}

function moral() {  // after the last spread: a calm page, the moral read aloud (book.json's "moral" spread, its diorama, has just read it)
  mode = "moral"; quiet(); $("moral").hidden = false; notice.end($("moral")); $("replay").hidden = true; snd.setBed([["night-breeze", 0.15], ["leaves-breeze", 0.15]].filter(([n]) => sm.beds[n]).slice(0, 1));  // a calm page
  $("bar").classList.add("on"); if (bare(S.id) !== "moral") reader.read(book.moral?.lines || story.moral.map(l => l.id));
  import("./learn.js").then(m => m.offer(bookId, () => lang, () => reader.stop())).catch(() => {});  // the gold "Play and learn" door, only for a book that has a question bank
}
$("again").onclick = () => mode === "moral" && reader.read(book.moral?.lines || story.moral.map(l => l.id));
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
const notice = makeNotice({ bookId, lib, story, getLang: () => lang });  // the legal card on the title page and the end card (notice.js)

// ---------- sound (sound.js): a bed for each spread, foley for what happens, all ducked under the narration ----------
const speak = new Audio();  // touch lines and game reacts: a second voice, ducking the beds like the narration
const sm = manifestFor(bookId, "../"), snd = addSound(sm, { reader, voices: [speak] });  // an unknown book gets the shared foley and no bed
const played = [], play0 = snd.play.bind(snd);  // every library sound that starts, for scripted checks (window.live.played)
snd.play = (n, o) => (sm.sounds[n] && !snd.muted && played.push(n), play0(n, o));
addEventListener("ambient:sound", e => snd.play(e.detail.name, { gain: 0.3 }));  // the extras' routines, taps and surprises (ambient.js)
addEventListener("ambient:tap", e => { foley(`tap:${e.detail.name}`, null); learn(e.detail.name); });
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
function foley(event, fallback) {
// spread.json "sound": {"foley": {"tap:tree": ["leaves-shake", 0.4]}}; else the kind's sound
  const f = S?.m.sound?.foley ?? {}, e = f[event] ?? f[Object.keys(f).find(k => k.toLowerCase() === event)] ?? f[event.split(":")[0]];  // "line:1.4:Whoosh" is read as "whoosh"
  const own = e && sm.sounds[e[0]] ? e : null;  // the page's own [sound, gain] for this event
  if (sm.ready && event.startsWith("game:")) {  // a book with sounds of its own (web/<book>/sfx/manifest.json): a game event plays the page's sound, else the book's own correct / try again / won pool (tk-ok, tk-again, tk-won), else the shared one below
    const k = event.slice(5), kind = k === "won" ? "won" : k === "miss" || k === "again" ? "again" : "ok";
    const n = own && !["ok", "again", "won"].includes(own[0]) ? own[0] : Object.keys(sm.sounds).find(n => n.endsWith(`-${kind}`) && sm.sounds[n][0].includes(`${bookId}/sfx/`));
    if (n) return void snd.play(n, { gain: own?.[1] ?? 0.4 });
  }
  snd.cue(event, own, fallback) || (own ? snd.play(own[0], { gain: own[1] ?? 0.5 }) : sfx(fallback, { gain: 0.5 }));  // cue() answers taps and game events; a line or an act cue it leaves alone, so the page's own sound plays here
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
    if (lines[i] === sp.G.before && !sp.play.complete && !sp.skip) return prompt(sp, run);  // book.json "game": {"before": "1.4"}: read on once it is won
    const t0 = performance.now();
    const next = lines[i + 1] ?? (sp.G.before ? null : sp.G.voice?.start);  // the next line's voice (after the last, the game's), in the cache first
    if (text[next]) fetch(`${voice}${next}.m4a`).catch(() => {});
    if (i === lines.length - 1) ahead(sp);  // the last line: now the next spread (a voice always comes before a spread)
    if (!(await sayLine(lines[i])) || run !== runs) return;
    const rest = reader.audio.ended ? 0 : (timing[lines[i]]?.duration ?? 2) * 1000 - (performance.now() - t0);
    if (rest > 0 && (await sleep(rest), run !== runs)) return;  // no voice (a missing or refused file): the line still takes its time
    while (sp.acting.busy(lines[i])) if ((await sleep(100), run !== runs)) return;  // an act with "wait" finishes first
    const game = sp.play.targets.length && !sp.play.complete && (lines[i + 1] === sp.G.before || (!sp.G.before && i === lines.length - 1));
    const glide = game ? gameView(true) : 0;  // the game's view glides in during the pause, so the prompt starts on it
    if ((await sleep(Math.max(450, glide)), run !== runs)) return;
    if (game && sp.m.camera?.story) for (let t0 = performance.now(), was = null, n = 0; n < 2 && performance.now() - t0 < 8000;) {  // a story-camera page: the director flies to the game's view after the line (its own shot played to the end, at the speed caps), and the prompt starts once the camera itself has landed (under 4 cm/s for 0.2 s; the corner glow's own slide kept it waiting 8 s)
      if ((await sleep(100), run !== runs)) return;
      const now = [cam.position.clone(), controls.target.clone()]; n = was && now[0].distanceTo(was[0]) < 0.004 && now[1].distanceTo(was[1]) < 0.004 ? n + 1 : 0; was = now;
    }
  }
  sp.at = lines.length; hint.pulse = performance.now();  // read: the corners glow once to say "turn me"
  if (!sp.play.complete && !sp.skip) prompt(sp, run);
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
  sp.promptEnd = performance.now();
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
  sp.lifts = {}; sp.held = []; sp.placed = {}; sp.falls = [];
  sp.root.traverse(o => o.userData.rest && (o.position.copy(o.userData.rest), o.userData.restQ && o.quaternion.copy(o.userData.restQ)));
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
let aimed = [0.5, 0.5];
const aim = (x, y) => (aimed = [x, y], ray.setFromCamera(new THREE.Vector2(2 * x - 1, 1 - 2 * y), cam));
const hitIn = map => {  // a character is tried by its hit box, not its skinned body (57k triangles: 60 ms a tap on Kapi or Bobo)
  const by = new Map([...map.keys()].map(o => [S.cast.find(c => c.body === o)?.proxy ?? o, o]));
  for (const h of ray.intersectObjects([...by.keys()], true)) {
    let o = h.object;
    while (o && !by.has(o)) o = o.parent;
    if (o) return map.get(by.get(o));
  }
};

// what a tap reaches is the thing drawn nearest along the ray, each tested as it is drawn: a mesh by its own triangles (a card
// not where it is cut away; a glow or a light shaft is seen through), a skinned body by its posed skin near the ray (found
// through its hit box: its 57k triangles cost 60 ms). So a house, a tree or a tile in `characters` never answers for what
// stands in front of it, and a boat's hull answers for itself, the child sitting in it for herself.
const drawnMat = m => !!m && m.visible !== false && m.colorWrite !== false && m.depthWrite !== false && (m.opacity ?? 1) >= 0.5 && (m.blending ?? THREE.NormalBlending) === THREE.NormalBlending;
const alphas = new Map(), uvT = new THREE.Vector2();
function alphaOf(map) {  // a card's alpha, read once: sharp (at most 512 px a side) and averaged as a far card's mipmaps are (4 and 16 times smaller)
  let a = alphas.get(map);
  if (a !== undefined) return a;
  try {
    const w = Math.min(512, map.image.width), hh = Math.min(512, map.image.height), x = Object.assign(document.createElement("canvas"), { width: w, height: hh }).getContext("2d", { willReadFrequently: true });
    x.imageSmoothingQuality = "medium"; x.drawImage(map.image, 0, 0, w, hh);
    const d = x.getImageData(0, 0, w, hh).data, A = new Uint8Array(w * hh); for (let i = 0; i < A.length; i++) A[i] = d[4 * i + 3];
    const down = (s, f) => { const W = Math.max(1, s.w / f | 0), H = Math.max(1, s.h / f | 0), o = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let t = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) t += s.a[(y * f + j) * s.w + x * f + i]; o[y * W + x] = t / (f * f); }
      return { w: W, h: H, a: o }; };
    const s0 = { w, h: hh, a: A }, s1 = down(s0, 4); a = [s0, s1, down(s1, 4)];
  } catch { a = null; }
  alphas.set(map, a);
  return a;
}
function cut(h, m) {  // the hit lands on a card's cut-away part: clear there at every level (the GPU draws a far card from its averaged mipmaps)
  const map = m.map;
  if (!map?.image || !h.uv || !(m.alphaTest || m.transparent)) return false;
  const a = alphaOf(map);
  if (!a) return false;
  map.transformUv(uvT.copy(h.uv));
  return a.every(({ w, h: hh, a }) => a[Math.min(hh - 1, Math.max(0, uvT.y * hh | 0)) * w + Math.min(w - 1, Math.max(0, uvT.x * w | 0))] < 255 * (m.alphaTest || 0.5));
}
const sv = new THREE.Vector3(), boxW = new THREE.Box3(), at3 = new THREE.Vector3();
function skinAt(ch, far) {  // how far along the ray the posed skin is: [t, sure]: the nearest of about 3000 vertices a mesh within 6 % of the character's height (or 2 px) of the ray, and whether one within 3.5 % (or 1 px) is as near (sure: it covers the ray; else only at its edge). far: about how far away it is
  const o0 = ray.ray.origin, d = ray.ray.direction, px = far * 2 * Math.tan(rad(cam.fov) / 2) / innerHeight, h = ch.height || 0.1;
  const r = Math.max(0.06 * h, 2 * px), r2 = r * r, q2 = Math.max(0.035 * h, px) ** 2;
  let t = Infinity, u = Infinity, m = 0; const side = new THREE.Vector3();
  ch.model.traverseVisible(o => {
    if (!o.isSkinnedMesh) return;
    const n = o.geometry.attributes.position.count, k = Math.max(1, Math.ceil(n / 3000));
    for (let i = 0; i < n; i += k) {
      o.getVertexPosition(i, sv).applyMatrix4(o.matrixWorld).sub(o0);
      const s = sv.dot(d), e = sv.lengthSq() - s * s;
      if (s > 0 && e < r2) { if (s < t) t = s; if (e < q2) { if (s < u) u = s; m++; if (e > 1e-12) side.add(sv.addScaledVector(d, -s).normalize()); } }
    }
  });
  return [Math.min(t, u), u < t + 0.5 * r, m < 3 || side.length() >= 0.5 * m];  // sure: a close vertex no more than half the margin behind the nearest; rim: the close vertices lie to one side of the ray (it is just outside the body, or on its edge)
}
const skin = ch => { if (ch.skinned == null) { ch.vertices = 0; ch.model.traverse(o => o.isSkinnedMesh && (ch.vertices += o.geometry.attributes.position.count)); ch.skinned = ch.vertices > 0; } return ch.skinned; };  // a living body (people, animals), not a set piece
const tappable = o => { for (let p = o; p; p = p.parent) if (S.props.has(p) || S.fruit.has(p) || S.cast.some(c => c.body === p)) return true; return false; };
let boxes = null;  // this tap's world boxes of what can be drawn ([box, mesh or skinned character]): made once a tap, every ray of it reuses them
const drawables = () => boxes ??= (() => {
  const l = [];
  S.group.traverseVisible(o => {
    if (!o.isMesh || o.isSkinnedMesh || ![].concat(o.material).some(drawnMat)) return;
    const b = o.isInstancedMesh ? (o.boundingBox ?? (o.computeBoundingBox(), o.boundingBox)) : (o.geometry.boundingBox ?? (o.geometry.computeBoundingBox(), o.geometry.boundingBox));
    l.push([b.clone().applyMatrix4(o.matrixWorld), o]);
  });
  for (const ch of S.cast) if (skin(ch) && ch.body.visible) l.push([new THREE.Box3().setFromObject(ch.proxy), ch]);
  return l;
})();
function nearest(cheap) {  // cheap: no exact skin test (the fingertip's many rays)  // the drawn object nearest along the ray: a mesh, or a skinned character's body; null: nothing drawn there
  const c = [], o0 = ray.ray.origin;
  for (const [b, o] of drawables()) if (ray.ray.intersectBox(b, at3)) c.push([at3.distanceTo(o0), o]);
  c.sort((a, b) => a[0] - b[0]);
  let best = Infinity, it = null, edge = null, onRim = null;  // onRim: the body that won only at its rim; edge: a skin met only at its edge, nearer than anything sure: it wins over scenery (the page, a hill), never over a thing that answers
  for (const [d, o] of c) {  // nearest box first; one that starts past the best hit cannot hold a nearer one
    if (d >= best) break;
    if (o.body) { const [t, sure, rim] = skinAt(o, d); if (t < best) sure ? ((best = t), (it = o.body), (onRim = rim ? o : null)) : (!edge || t < edge[0]) && (edge = [t, o, d]); continue; }
    for (const h of ray.intersectObject(o, false)) {
      if (h.distance >= best) break;
      const m = [].concat(o.material)[h.face?.materialIndex ?? 0];
      if (drawnMat(m) && !cut(h, m)) { best = h.distance; it = o; break; }
    }
  }
  if (!cheap && onRim && it === onRim.body && onRim.vertices < 40000) {  // a body won at its rim: a thing that answers just behind it is asked
      let b2 = Infinity, it2 = null;
      for (const [d, o] of c) {
        if (d >= b2) break;
        if (o === onRim) continue;
        if (o.body) { const [t2, s2] = skinAt(o, d); if (s2 && t2 < b2) (b2 = t2), (it2 = o.body); continue; }
        for (const h of ray.intersectObject(o, false)) { if (h.distance >= b2) break; const m = [].concat(o.material)[h.face?.materialIndex ?? 0]; if (drawnMat(m) && !cut(h, m)) { b2 = h.distance; it2 = o; break; } }
      }
      if (it2 && tappable(it2) && !(skinExact(onRim) < b2)) return it2;
    }
    if (!edge || edge[0] >= best) return it;
    if (!(it && tappable(it))) return edge[1].body;
  return !cheap && edge[1].vertices < 40000 && skinExact(edge[1]) < best ? edge[1].body : it;  // in front of a thing that answers: its posed triangles near the ray asked exactly (a small body; its sample may fall between the vertices that cover the ray)
}
const fans = new WeakMap(), tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
function fanOf(g) {  // vertex -> the triangles that use it (made once a geometry)
  let f = fans.get(g); if (f) return f;
  const n = g.attributes.position.count, ix = g.index?.array, m = ix ? ix.length : n, start = new Uint32Array(n + 1), tri = new Uint32Array(m);
  for (let i = 0; i < m; i++) start[(ix ? ix[i] : i) + 1]++;
  for (let i = 0; i < n; i++) start[i + 1] += start[i];
  const at = start.slice(0, n); for (let i = 0; i < m; i++) tri[at[ix ? ix[i] : i]++] = (i / 3) | 0;
  fans.set(g, f = { start, tri }); return f;
}
let xr = null;
  function skinExact(ch) {  // how far along the ray (from the eye) the posed skin truly is, asked of the GPU: the tap's own pixel through a 1 x 1 view, the character's skin drawn as its distance from the eye; Infinity: the ray misses it
    const r = renderer, W = innerWidth, H = innerHeight;
    xr ??= { rt: new THREE.WebGLRenderTarget(1, 1), cam: Object.assign(new THREE.PerspectiveCamera(), { matrixAutoUpdate: false }), mat: new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { eye: { value: new THREE.Vector3() } },
      vertexShader: "varying vec3 vW;\n#include <common>\n#include <skinning_pars_vertex>\nvoid main() {\n#include <skinbase_vertex>\n#include <begin_vertex>\n#include <skinning_vertex>\nvec4 w = modelMatrix * vec4(transformed, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform vec3 eye; varying vec3 vW;\n#include <packing>\nvoid main() { gl_FragColor = packDepthToRGBA(length(vW - eye) / 100.0); }" }), px: new Uint8Array(4), c: new THREE.Color() };
    const nx = 2 * aimed[0] - 1, ny = 1 - 2 * aimed[1];  // the camera's own projection (whatever offset it carries), narrowed to the one pixel the finger is on
    xr.cam.projectionMatrix.set(W, 0, 0, -nx * W, 0, H, 0, -ny * H, 0, 0, 1, 0, 0, 0, 0, 1).multiply(cam.projectionMatrix); xr.cam.projectionMatrixInverse.copy(xr.cam.projectionMatrix).invert();
    xr.cam.matrixWorld.copy(cam.matrixWorld); xr.cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    xr.mat.uniforms.eye.value.copy(ray.ray.origin);
    const swap = [], was = [r.getRenderTarget(), r.getClearColor(xr.c).getHex(), r.getClearAlpha()];
    ch.model.traverse(o => { if (o.isMesh) { swap.push([o, o.material, o.visible]); o.isSkinnedMesh ? (o.material = xr.mat) : (o.visible = false); } });
    r.setRenderTarget(xr.rt); r.setClearColor(0, 0); r.clear(); r.render(ch.model, xr.cam); r.readRenderTargetPixels(xr.rt, 0, 0, 1, 1, xr.px);
    r.setRenderTarget(was[0]); r.setClearColor(was[1], was[2]);
    for (const [o, m, v] of swap) { o.material = m; o.visible = v; }
    const [p0, p1, p2, p3] = xr.px;
    return p0 | p1 | p2 | p3 ? 100 * (p0 / 256 + p1 / 65536 + p2 / 16777216 + p3 / (255 * 16777216)) : Infinity;  // unpackRGBAToDepth, times farDistance
  }
  function pick(game) {  // [the handler, its character or null] of the nearest drawn thing: a game's while it is played (game: the open targets and extras), a character's, a touch piece's; []: none
  const P = S.play;
  for (let p = nearest(); p; p = p.parent) {
    const ch = S.cast.find(c => c.body === p), i = game ? P.targets.indexOf(p) : -1;
    const f = game && (game.get(p) ?? (ch && game.get(ch.proxy)) ?? (i >= 0 && P.repeat && (() => (rec(p.name, "game"), P.repeat(i)))));  // a counted friend tapped again: the game's "again"
    if (f) return [f, ch];
    if (p.userData.extraTap) return [];  // a 3D extra's body is what the finger is on: ambient.js answers it
    if (ch) return [() => poke(ch), ch];
    if (S.props.has(p)) return [S.props.get(p), null];
  }
  return [];
}
const sq = new THREE.Box3(), sc = new THREE.Vector3();
function small(x, y, game) {  // a small thing (seen under 44 px on the screen) whose 44 px square holds the finger, the nearest first: its handler, as pick() gives it
  const W = innerWidth, H = innerHeight, fx = x * W, fy = y * H, near = [];
  for (const o of new Set([...S.cast.filter(c => c.body.visible).map(c => c.body), ...[...S.props.keys()].filter(o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; })])) {
    const c = S.cast.find(c => c.body === o);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
    for (const p of corners(sq.setFromObject(c ? c.proxy : o))) { sc.copy(p).project(cam); behind ||= sc.z > 1; x0 = Math.min(x0, sc.x); x1 = Math.max(x1, sc.x); y0 = Math.min(y0, sc.y); y1 = Math.max(y1, sc.y); }
    const r = [Math.max(0, (x0 + 1) / 2 * W), Math.min(W, (x1 + 1) / 2 * W), Math.max(0, (1 - y1) / 2 * H), Math.min(H, (1 - y0) / 2 * H)];  // its hit box on the screen, px (the part on the screen)
    const d = Math.hypot(Math.max(0, r[0] - fx, fx - r[1]), Math.max(0, r[2] - fy, fy - r[3]));
    if (!behind && r[1] > r[0] && r[3] > r[2] && d <= 22 && (c && skin(c) || (r[1] - r[0] < 88 && r[3] - r[2] < 88))) near.push([d, o, r]);  // a living body of any size may be seen small (a crocodile under water); a thing up to twice the size (partly hidden)
  }
  for (const [, o, [X0, X1, Y0, Y1]] of near.sort((a, b) => a[0] - b[0]).slice(0, 2)) {  // the two nearest (a phone's crowded page: a tap costs no more)
    const seen = [], grid = (X0, X1, Y0, Y1) => { for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {  // where in that box it is the thing drawn: 3 x 3 rays
      const px = X0 + (X1 - X0) * (i + 0.5) / 3, py = Y0 + (Y1 - Y0) * (j + 0.5) / 3;
      aim(px / W, py / H);
      for (let p = nearest(true); p; p = p.parent) if (p === o) { seen.push([px, py]); break; }
    } };
    grid(X0, X1, Y0, Y1);
    if (!seen.length) grid(Math.max(X0, fx - 22), Math.min(X1, fx + 22), Math.max(Y0, fy - 22), Math.min(Y1, fy + 22));  // none: a body mostly hidden (under water, off the screen) whose shown part fell between them; 3 x 3 more where its box meets the finger's 44 px square
    if (!seen.length) continue;
    const xs = seen.map(p => p[0]), ys = seen.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= 44 || Math.abs(cx - fx) > 22 || Math.abs(cy - fy) > 22) continue;  // seen small, the finger in its 44 px square
    const at = seen.reduce((a, p) => (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? p : a));
    aim(at[0] / W, at[1] / H);
    return pick(game)[0];
  }
  return null;
}
let tapped = null;  // what the last tap reached: {who, kind: card | reaction | game | sparkle, card: the word card's line} (tools/tap_who.mjs)
const rec = (who, kind) => (tapped = { who, kind });
function tap(x, y) {
  tapped = null; boxes = null;
  if (mode !== "open") return;
  aim(x, y);
  const P = S.play, on = P.begun && !P.complete;
  if (on && P.gesture) return;  // a tap in a gesture game (seed, wave, leap) is the game's alone: no thing's own sound or word on top of its "correct"
  // a game that waits for its line, or one that is won, is not played: its targets answer as things. Otherwise its open targets
  // and extras are the game's (a picked one catches no tap)
  const open = (S.G.before && !P.begun) || P.complete ? null : new Map([...S.fruit].filter(([o]) => { const i = P.targets.indexOf(o); return i < 0 || P.open(i); }));
  // small things are hard to hit: the nearest unpicked target within a fingertip also counts
  const best = open && P.targets.map((o, i) => [i, o.getWorldPosition(new THREE.Vector3()).project(cam)])
    .map(([i, v]) => [i, Math.hypot(((v.x + 1) / 2 - x) * innerWidth, ((1 - v.y) / 2 - y) * innerHeight)])
    .filter(([i, d]) => P.open(i) && d < 44).sort((a, b) => a[1] - b[1])[0];
  const near = best && (() => (rec(P.targets[best[0]].name, "game"), P.tap(best[0])));
  const [f, ch] = pick(open);
  if (!on) return void (f ?? near ?? (nearest()?.userData.extraTap ? null : small(x, y, open)))?.();  // a thing the finger is on always wins; on the scenery, a small thing beside it
  // while a game is on: its own targets first (by hit box), then one by the fingertip, then a character drawn there, then a halo, then the thing drawn there
  const targets = new Map([...open].filter(([o]) => P.targets.includes(o)));
  (hitIn(targets) ?? near ?? (ch && f) ?? hitIn(open) ?? f ?? small(x, y, open))?.();
}

const talking = () => !reader.audio.paused && !reader.audio.ended;  // the storyteller is mid-line
let cutT = 0;
const cutWord = () => {  // a story or game line starts: a word card's voice fades out in 80 ms and its card closes, so there is one voice at a time
  $("sbub").hidden = true; clearTimeout($("sbub").t); if (speak.paused) return;
  clearInterval(cutT); cutT = setInterval(() => { speak.volume = Math.max(0, speak.volume - 0.25); if (!speak.volume) clearInterval(cutT), speak.pause(), (speak.volume = 1); }, 20);
};
reader.audio.addEventListener("play", cutWord);
function learn(name, o) {  // a tapped thing says a word of its own (words.json: a pool of true things to say, a new one each tap), in a bubble beside it, with the chosen language's subtitle; one voice at a time (the same Audio), only that one file is fetched
  if (talking()) return;
  const said = touchLine(words, name, lang, S.id), at = o ?? S.root.getObjectByName(name) ?? S.cast[0]?.body;
  if (!said || !at) return;
  if (tapped) tapped.card = said.text;
  const s = $("sbub");
  s.innerHTML = (said.word ? "<h4><span></span><u></u></h4>" : "") + "<b></b><i></i>";  // a word card: the WORD large, the chosen language's word beside it, then the sentence said and its subtitle
  if (said.word) { s.firstChild.firstChild.textContent = said.word.text; s.firstChild.lastChild.textContent = said.word.sub || ""; s.dataset.kind = said.tag ?? ""; }  // words.json: word[key] {en, lo, th, zh, ja}, and the line's tag (what, does, looks, fact, sound, count, culture, say, who)
  s.querySelector("b").textContent = said.text; Object.assign(s.querySelector("i"), { textContent: said.sub, lang: lang || "en" });  // lang: Lao, Thai, Chinese and Japanese stand upright (no faux italic)
  s.classList.toggle("card", !!said.word); s.hidden = false; s.who = { body: at, c: { height: 0.12 }, box: true }; clearTimeout(s.t);
  s.t = setTimeout(() => (s.hidden = true), Math.min(6000, Math.max(said.word ? 3000 : 2300, (said.duration ?? 0) * 1000 + 500)));  // about 3 s, or until the voice has ended
  speak.src = `${voice}${said.id}.m4a`; speak.play().catch(() => {});
}
function poke(ch) {  // a reaction played once, then back to what it was doing; and a touch line said
  rec(ch.name, "reaction");
  foley(`tap:${ch.name}`, "tap"); S.acting.tap(ch.name);  // a cast thing's "tap:<name>" acts too (shape keys)
  const names = REACTIONS.filter(n => ch.clips[n] && n !== ch.hold);
  if (names.length && !ch.done && !ch.goal) once(ch, names[Math.floor(Math.random() * names.length)], () => loop(ch, ch.hold));
  learn(ch.who, ch.body);  // a character's word card, the same as a thing's
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
  line: id => text[id], keyLight: sp.key, ctx: snd.ctx, muted: () => snd.muted });

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
  rec(name, "card");
  foley(`tap:${name}`, "tap"); learn(name, parts[0]);
  sparkle(parts[0].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0)));
  parts.forEach(o => wobble(o)); sfxHook.tap(name); S.acting.tap(name);  // acts whose line is "tap:<name>" (acts.js: shape keys)
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
let drag = null, fingerX = 0, down = false, pend = null, pid = null, press = null, primed = false, flick = 0, trail = [], took = false;
const at = e => { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
const turnable = s => !(arrival3 && (arrival3.active || arrival3.locked)) && ((mode === "open" && s !== 0) || (mode === "closed" && (s > 0 || (s < 0 && !!S.prevId))));  // not while the book arrives

// ---------- the turn hint: a softly glowing page corner where the finger should pull, and the only place a pull turns ----------
const hint = { els: { "-1": $("curlL"), 1: $("curlR") }, spots: [], pulse: 0, at: {} };
function spot(s, view) {  // the bottom corner of side s (+1 right, -1 left), or the point of the page nearest it that the screen shows
  const f = S.flat, v = new THREE.Vector3(), seen = (at, m = 0) => { v.copy(at).project(view); const px = (v.x + 1) / 2, py = (1 - v.y) / 2; return v.z < 1 && px > 0.06 - m && px < 0.94 + m && py > 0.06 - m && py < 0.86 + m && { s, x: px, y: py, at }; };
  const last = hint.at[s] && seen(hint.at[s], 0.03), away = at => Math.hypot(S.pageW - s * at.x, f.max.z - at.z);  // the point the glow shows now, kept a little past the edge where a new one may show
  if (last && hint.moving) return away(last.at) > 0.3 * Math.hypot(S.pageW, S.pageD) ? null : last;  // while the camera moves: the glow slides with the page, it does not hop about it under a finger; but not over a page's middle (an end shot gliding out showed Pip over the house, a glow that ran across the screen for 3 s and then jumped): that is the reading view's corner, which stays put
  let best = null, bd = Infinity;
  for (let i = 0; i <= 13; i++) for (let j = 0; j <= 13; j++) {  // the whole half page, nearest the corner first: a close shot may show only its middle
    const dx = i * 0.07 * S.pageW, dz = j * 0.07 * S.pageD, d = Math.hypot(dx, dz);
    if (d >= bd) continue;
    const p = seen(new THREE.Vector3(s * (S.pageW - dx), f.max.y, f.max.z - dz));
    if (p) { best = p; bd = d; }
  }
  return last && !(bd < 0.7 * away(last.at)) ? last : best;  // it moves on only to a point clearly nearer the corner: no flicker between two at the screen's edge
}
const faceV = new THREE.Vector3(), cardBox = new THREE.Box3();
function faceBox() {  // a face close-up (the director lets the orbit's minimum out only then): where on screen the nearest character's head is, and how far its face reaches
  if (controls.minDistance > 0.1) return null;
  let best = null, bd = 1.2;
  for (const c of S?.cast ?? []) { const h = c.model.getObjectByName("head"); if (!h) continue; h.getWorldPosition(faceV); const d = faceV.distanceTo(cam.position); if (d < bd) bd = d, best = h; }
  if (!best) return null;
  best.getWorldPosition(faceV).y += 0.1 * (S.cast.find(c => c.model.getObjectByName("head") === best)?.height ?? 0.17); faceV.project(cam);
  return { x: (faceV.x + 1) / 2 * innerWidth, y: (1 - faceV.y) / 2 * innerHeight, r: (innerWidth < 600 ? 80 : 100) * 0.9 };
}
function showHint(now) {
  hint.moving = !!hint.cp && cam.position.distanceTo(hint.cp) > 0.05 * (now - hint.t) / 1000; hint.cp = cam.position.clone(); hint.t = now;  // faster than 5 cm/s: more than the breathing drift
  let rv;
  const readView = () => { if (!rv) { rv = cam.clone(); rv.position.copy(HOME); rv.lookAt(LOOK); rv.updateMatrixWorld(); } return rv; };  // the reading view, made when asked for
  const edge = s => ({ s, x: s > 0 ? 0.94 : 0.06, y: 0.84, at: new THREE.Vector3(s * S.pageW, S.flat.max.y, S.flat.max.z) });  // no view shows that page (a phone's close reading view, the back page): the screen's own bottom corner on its side
  // gliding home: where the corner will be. A shot that shows none of the page (a face close-up, an end shot): where the reading view has it, and a pull from there brings that view back
  hint.spots = ["closed", "open"].includes(mode) ? [1, -1].filter(turnable).map(s => (homing ? spot(s, readView()) ?? edge(s) : spot(s, cam) ?? { ...(spot(s, readView()) ?? edge(s)), home: true })) : [];
  hint.at = Object.fromEntries(hint.spots.map(p => [p.s, p.at]));
  hint.past = [[now, hint.spots], ...(hint.past ?? []).filter(([t]) => now - t < 300)];  // where the glows were this last 0.3 s: a finger answering a glow that has just moved lands where it saw it
  for (const [s, el] of Object.entries(hint.els)) {
    const p = hint.spots.find(p => p.s === +s);
    el.hidden = !p;
    if (p) { el.style.left = `${p.x * 100}%`; el.style.top = `${p.y * 100}%`; }
    el.style.visibility = p && faceBox() && Math.hypot(p.x * innerWidth - faceBox().x, p.y * innerHeight - faceBox().y) < faceBox().r + 30 ? "hidden" : "";  // never over a face in a close-up; a pull from it still takes (grabAt reads the spots, not the element)
    if (p && hint.pulse) { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }
  }
  if (hint.spots.length) hint.pulse = 0;
  showCue(now);
}
// ---------- "more to read" and "turn the page": dots in the read-along bar (a line each, and the game), and a labelled Next button at the end ----------
const NEXT = { "": "Next page", lo: "ໜ້າຕໍ່ໄປ", th: "หน้าถัดไป", zh: "下一页", ja: "次のページ" };  // the subtitle languages' own words, English where unknown
const cue = { key: "", since: 0, still: 0, shown: false, lang: null, dy: 0 };
$("title").textContent = book.title ?? "";
function showCue(now) {
  $("title").hidden = !(PHONE && mode === "closed" && order(S) === 0 && book.title);  // an upright phone waits at the reading view, which shows one page: the book's title on the desk above it until the page turns
  const sp = S, n = sp?.page.lines.length ?? 0, g = sp?.play.targets.length ? 1 : 0, open = mode === "open" && !exitOn && n > 0;
  const done = open && sp.at >= n && (!g || sp.play.complete) && !(arrival3 && (arrival3.active || arrival3.locked));  // every line read, the game won: the end of the page
  const k = open ? `${sp.id}|${n + g}|${sp.at}|${g && sp.play.complete}|${done}` : "";
  if (k !== cue.key) {  // the dots: one a line (and one for the game), filled once read, the one being read breathing
    cue.key = k; $("dots").hidden = !open;
    if (open) {  // in the order things happen: the game's dot sits before the line it comes before (book.json "before"), else after the last
      const lines = sp.page.lines, gate = g ? (sp.G.before && lines.includes(sp.G.before) ? lines.indexOf(sp.G.before) : n) : -1, won = sp.play.complete, waiting = g && !won && sp.at === gate;
      const dot = [...lines.map((_, i) => `<i class="${i < sp.at ? "on" : i === sp.at && !waiting ? "now" : ""}"></i>`)];
      if (g) dot.splice(gate, 0, `<i class="${won ? "on" : waiting ? "now" : ""}"></i>`);
      $("dots").innerHTML = dot.join("");
    }
  }
  if (open) { const ra = document.querySelector(".ra-page")?.getBoundingClientRect(), y = ra && ra.height ? ra.bottom + 6 : -99, d = $("dots"); if (d.dataset.y !== String(Math.round(y))) d.dataset.y = Math.round(y), d.style.top = `${y}px`, d.style.visibility = y < 0 ? "hidden" : ""; }  // the dots sit just under the read-along page's text, in its own area, so they never cover a face
  const q = hint.spots.find(p => p.s === 1), pxy = q && [q.x * innerWidth, q.y * innerHeight], slid = pxy && cue.px && Math.hypot(pxy[0] - cue.px[0], pxy[1] - cue.px[1]) > 0.8;
  const cm = cue.cp && (cam.position.distanceTo(cue.cp) > 0.0008 || controls.target.distanceTo(cue.ct) > 0.0008), lim = 0.02 * Math.max(1, now - (cue.tp ?? now)) / 1000, calm = cue.cp && cam.position.distanceTo(cue.cp) < lim && controls.target.distanceTo(cue.ct) < lim; cue.cp = cam.position.clone(); cue.ct = controls.target.clone(); cue.tp = now; cue.calm = calm ? cue.calm || now : 0;  // calm: the camera itself has stopped (under 2 cm/s; the breathing drift is 1)  // the camera itself: under 0.8 mm a frame, 5 cm/s (the breathing drift is 0.15 mm)
  cue.px = pxy; cue.still = cm || slid ? 0 : cue.still || now;  // since when the camera and the corner have stood still
  if (!done) cue.since = 0; else cue.since ||= now;
  const on = done && (cue.shown || hint.landed !== false && ((cue.still && cue.calm && now - Math.max(cue.still, cue.calm, cue.since) > 600) || now - cue.since > 20000));  // shown once the camera itself has stopped  // once up it stays until the page is read again  // the page's last shot has landed (or a few seconds on, if the camera never settles)
  if (on !== cue.shown) { cue.shown = on; $("next").hidden = !on; }
  if (cue.lang !== lang) { cue.lang = lang; $("next").firstElementChild.textContent = NEXT[lang] ?? NEXT[""]; }
  const p = hint.spots.find(p => p.s === 1);
  if (on) {  // beside the forward corner, and still under a finger: it moves only when the corner has moved a good way (the camera's breathing drift would walk it out from under a tap)
    const x = (p?.x ?? 0.94) * innerWidth, y = (p?.y ?? 0.84) * innerHeight;
    const move = !cue.at || cue.at[2] !== innerWidth;  // placed once beside the corner as it shows, and never moved under a finger after (review 5: it jumped twice as gourd s01's phone close, which follows its people, moved the corner); again only for a new screen size
    if (move) {  // R30: never over the end frame's subjects (gourd s01's phone end put it over Pu Nyeu, Nya Nyeu and Little Lion): just below or above the corner
      const [ax, ay] = [x, y], nb = $("next"), w = nb.offsetWidth, h = nb.offsetHeight, acted = new Set((S.m.acts ?? []).flatMap(a => [].concat(a.who ?? []))), v = new THREE.Vector3();
      const boxes = S.cast.filter(c => c.body.visible && (S.acting.people?.has(c.name) || acted.has(c.name))).map(c => drawn(c).map(p => v.copy(p).project(cam)).filter(q => Number.isFinite(q.x)).reduce((b, q) => [Math.min(b[0], q.x), Math.max(b[1], q.x), Math.min(b[2], q.y), Math.max(b[3], q.y)], [9, -9, 9, -9]).map((n, i) => i < 2 ? (n + 1) / 2 * innerWidth : (1 - n) / 2 * innerHeight));  // each one's box on the screen: [x0, x1, bottom, top] px
      const gap = d => { const l = ax - w - 36, t = ay + d - h / 2; return t > 0.1 * innerHeight && t + h < 0.9 * innerHeight ? Math.min(Infinity, ...boxes.map(([x0, x1, yb, yt]) => Math.max(x0 - l - w, l - x1, t - yb, yt - t - h))) : -Infinity; };  // px to the nearest subject (below 0: over one)
      { const ds = [0, 1.3, -1.3, 2.6, -2.6].map(k => k * h); cue.dy = gap(0) >= 24 ? 0 : ds.reduce((a, d) => (gap(d) > gap(a) ? d : a), 0); cue.at = [ax, ay, innerWidth]; Object.assign(nb.style, { left: `${ax}px`, top: `${ay + cue.dy}px` }); }  // beside the corner, else the spot farthest from every subject (the close follows its people: they move a little after)
    }
  } else cue.at = null;
}
// ---------- auto play: the page turns by itself 2.5 s after its last line (and its game), through to the end card ----------
const autoBtn = $("auto"), au = { on: false, t: 0, mode: "", fired: "", n: 0 };  // n: the automatic turns so far (tools/auto_probe.mjs)
try { au.on = (q.get("auto") ?? localStorage.getItem("popup-auto")) === "1"; } catch { au.on = q.get("auto") === "1"; }
const showAuto = () => autoBtn.setAttribute("aria-pressed", au.on);
autoBtn.onclick = () => { au.on = !au.on; au.t = 0; showAuto(); try { localStorage.setItem("popup-auto", au.on ? "1" : "0"); } catch { /* not remembered */ } };
showAuto();
function autoTick(now) {
  const sp = S, n = sp.page.lines.length, key = `${sp.id}|${mode}`;
  if (mode !== au.mode) Object.assign(au, { mode, fired: "", t: 0 });  // a new mode (also a turn that fell back): the wait starts again
  if (!au.on || au.fired === key || exitOn || arrival3 && (arrival3.active || arrival3.locked) || (mode !== "open" && mode !== "closed")) return;
  let ready = mode === "closed";  // the flat page: lifted to the open spread after the wait
  if (mode === "open") {
    const game = sp.play.targets.length && !sp.play.complete && !sp.skip;
    if (game && sp.promptEnd && !sp.touched && now - sp.promptEnd > 10000) sp.skip = true, sp.play.stop?.(), sp.play.begun = false, gameView(false), sp.at < n && readFrom(sp.at);  // nobody touched the game for 10 s: it stops hinting and the story goes on (Read again plays it)
    ready = sp.at >= n && !(game && !sp.skip) && (sp.skip || reader.audio.paused || reader.audio.ended);  // every line read, the game won or left, the last voice done
  }
  if (!ready) return void (au.t = 0);
  if (!au.t) au.t = now;
  if (now - au.t >= 2500) au.fired = key, au.n++, turn(true, true);
}
$("next").onclick = () => mode === "open" && turn(true, true);
const grabAt = (x, y) => (hint.past ?? [[0, hint.spots]]).map(([, ps]) => ps.find(p => Math.hypot((p.x - x) * innerWidth, (p.y - y) * innerHeight) < Math.max(48, innerWidth * 0.08))).find(Boolean);  // the glow under the finger, now or a moment ago

canvas.addEventListener("pointerdown", e => {
  if (S?.promptEnd) S.touched = true;  // auto play: the child is at the game, so it is waited for
  if (!primed) { primed = true; unlock(reader.audio, speak); snd.ctx.resume().catch(() => {}); }  // iPad: unlock sound inside a touch
  const [x, y] = at(e), p = grabAt(x, y), s = p?.s ?? 0; fingerX = x; press = [e.clientX, e.clientY, performance.now()]; trail = [[performance.now(), x]];
  if (pid !== null || !turnable(s)) return;  // not a page turn: OrbitControls has it
  e.stopImmediatePropagation(); pid = e.pointerId; canvas.setPointerCapture(pid); down = true; pend = { x, fwd: s > 0, at: p.at };
  if (p.home) { controls.dispatchEvent({ type: "start" }); home(); took = true; }  // a glow where the reading view has the corner: that view glides back under the finger (the director lets go, as for the reader's hands)
});
canvas.addEventListener("pointermove", e => {
  const [x, y] = at(e); fingerX = x;
  if (pid === null) canvas.style.cursor = turnable(grabAt(x, y)?.s ?? 0) ? "grab" : "";
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
  if (took) took = false, controls.dispatchEvent({ type: "end" });
  const [t0, x0] = trail[0] ?? [0, x], t1 = performance.now(); flick = t1 > t0 + 5 ? (x - x0) / ((t1 - t0) / 1000) : 0;
  if (drag?.live && !drag.isAuto) fling();
};
canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
addEventListener("keydown", e => { if (e.key === "ArrowRight") turn(true, true); if (e.key === "ArrowLeft") turn(false, true); });

const controls = new OrbitControls(cam, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minPolarAngle: rad(20), maxPolarAngle: rad(80),
  minAzimuthAngle: -rad(50), maxAzimuthAngle: rad(50) });
function restPose() {  // the pose the director leaves the camera in for this closed spread: its opening view where it has one (a wide screen), else the reading view; found by letting it take its first frame from the reading view, then putting the camera back
  const p = cam.position.clone(), tg = controls.target.clone(); cam.position.copy(HOME); controls.target.copy(LOOK);
  hooks.forEach(h => h.frame?.(0.016, performance.now()));
  const r = { home: cam.position.clone(), look: controls.target.clone() }; cam.position.copy(p); controls.target.copy(tg); return r;
}
let homing = null;
function home(ms = 700, carry = false) {  // glide back to the reading view; its length in ms. carry: it sets out at the speed the camera already has (the game view, taken while the director is mid-move), no step in velocity
  if (![...cam.position.toArray(), ...controls.target.toArray()].every(Number.isFinite)) { cam.position.copy(HOME); controls.target.copy(LOOK); }
  const p0 = cam.position.clone(), t0 = controls.target.clone(), [vp, vl] = carry ? camVel.map(v => v.clone()) : [new THREE.Vector3(), new THREE.Vector3()];
  ms = Math.max(ms, 1200 * Math.max(p0.distanceTo(HOME), t0.distanceTo(LOOK)), 25 * THREE.MathUtils.radToDeg(t0.clone().sub(p0).angleTo(LOOK.clone().sub(HOME))));  // never faster than 0.027 m a frame at its peak, nor a turn of 75°/s
  let t = 0, prev = performance.now() - (carry ? 16 : 0);  // carry: its first frame already moves (no one-frame stop) // the glide's own clock, at most 17 ms a frame: a stalled frame (a shader compiling) never jumps the camera
  homing = now => { t += Math.min(now - prev, 17); prev = now; const k = smooth(0, 1, t / ms), r = swingRig({ pos: p0, look: t0 }, { pos: HOME, look: LOOK }, k), c = t / 1000 * (1 - t / ms) ** 2; cam.position.copy(r.pos).addScaledVector(vp, c); controls.target.copy(r.look).addScaledVector(vl, c); return k < 1; };  // c: the carried speed fades out by the glide's end  // from a face shot's close view too, no whip
  return ms;
}
$("reset").onclick = () => home();

// ---------- every frame ----------
const corners = b => [...Array(8)].map((_, i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
const drawn = c => {  // a character's body as drawn now: each visible mesh's own box, posed and turned with it (not its hit box)
  const ps = [], b = new THREE.Box3(), v = new THREE.Vector3(); c.body.updateWorldMatrix(true, true);
  c.body.traverse(o => {
    if (!o.isMesh || !o.visible || o === c.proxy || !o.matrixWorld.determinant()) return;  // a spare head stored at scale 0 draws nothing (its skinned points are NaN: they took the toad s01 phone camera to NaN at 1.4)
    if (o.isSkinnedMesh) { o.skeleton.update(); b.makeEmpty(); for (let i = 0, n = o.geometry.attributes.position.count; i < n; i += 8) b.expandByPoint(o.getVertexPosition(i, v)); }  // shortcut: every 8th
    else b.copy(o.geometry.boundingBox ?? (o.geometry.computeBoundingBox(), o.geometry.boundingBox));  // skinned vertex, a few mm short at most; every one if a cut ever shows
    ps.push(...corners(b).map(p => p.applyMatrix4(o.matrixWorld)));
  });
  return ps;
};
function readHome() {  // the reading view as the first pull will land it (the title view stands until the page falls open, so HOME is not it yet), fitted once per size
  if (!S || !HOME) return null;
  if (!titled) return { pos: HOME.clone(), look: LOOK.clone() };
  const key = `${innerWidth}x${innerHeight}`;
  if (S.rh?.key !== key) { titled = false; fit(); S.rh = { key, pos: HOME.clone(), look: LOOK.clone() }; titled = true; fit(); }
  return { pos: S.rh.pos.clone(), look: S.rh.look.clone() };
}
function titlePose() {  // the closed spread's own view on any screen: square to the book, both pages whole in the frame with at least 3 percent to spare on every side
  const f = S.flat, w = S.pageW, y = f.max.y, a = innerWidth / innerHeight, el = rad(a < 0.8 ? 62 : a < 1.2 ? 56 : 46), one = a < 0.8 && innerWidth < 600, look = new THREE.Vector3(one ? w / 2 : 0, y, 0), v = new THREE.Vector3();  // one: an upright phone frames the page the reader turns, not both: from both (2.97 m) the first pull could not reach the reading view inside the director's speed caps until 4 s (T55)
  const cs = (one ? [0, 1] : [-1, 1]).flatMap(x => [f.min.z, f.max.z].map(z => new THREE.Vector3(x * w, y, z))), keep = [cam.position.clone(), cam.quaternion.clone()];
  const reach = r => (cam.position.copy(look).add(v.set(0, Math.sin(el), Math.cos(el)).multiplyScalar(r)), cam.lookAt(look), cam.updateMatrixWorld(), Math.max(...cs.flatMap(c => { const q = v.copy(c).project(cam); return [Math.abs(q.x), Math.abs(q.y)]; })));
  let lo = 0.5, hi = 30; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; reach(m) <= (one ? 0.86 : 0.94) ? (hi = m) : (lo = m); }  // a phone's 0.86: its corner glow stays on the screen (spot)
  reach(hi); const pos = cam.position.clone(); cam.position.copy(keep[0]); cam.quaternion.copy(keep[1]); cam.updateMatrixWorld(); return { pos, look };
}
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
    if (S.sky && !titled) {  // before the first pull there is no story view yet: the title spread's own (titlePose)
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
      let subjects = S.cast.filter(c => !c.c.candle);  // the people and what they ride or stand in (a boat); not a game's little candle boats
      let body;  // their drawn bodies (a body not at its size yet, popping up or just made: its rest box, turned and where the page puts it), measured once, when needed
      const at = c => c.pos.clone().sub(new THREE.Vector3().setFromMatrixPosition(c.body.matrixWorld));  // a body not placed yet this page (a turn in): moved to where the page has it
      const whole = () => (body ??= subjects.flatMap(c => Math.abs(c.body.scale.x / c.s0 - 1) < 0.01 ? drawn(c).map(p => p.add(at(c))) : corners(c.box).map(p => p.multiplyScalar(c.s0).applyAxisAngle(up3, c.yaw).add(c.pos))))
        .every(p => { const q = v.copy(p).project(cam); return Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1; });  // whole in the frame
      if (a >= 1) {
        const r = first(r => (pose(r, slide(r)), !onPage()), 0.3 * sph.radius, 3 * sph.radius) * 1.10;  // the widest view whose bottom is still all page, 10 percent wider: the book's leather frame shows along the bottom and both sides of the pages (the skyline stays at the top: slide() solves it again)
        [sph.radius, dy] = [r, slide(r)];
      } else {  // an upright phone: no room above or beside the backdrop (the page's sides cropped: the reader orbits to them) and every
        const L0 = LOOK.clone(), s0 = sph.clone(), xs = subjects.map(c => c.pos.x), mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : L0.x;
        const at = (r, x, dz) => (LOOK.set(x, L0.y, L0.z + dz), pose(r, 0));  // person whole: the nearest such view, its look slid toward the reader
        const slid = (r, x) => { const dz = first(dz => (at(r, x, dz), roomShown(cam, above) === 0), 0, 1, 10); at(r, x, dz); return dz; };  // skyline at the top
        const key = [S.id, w, h, ...subjects.flatMap(c => [c.pos.x, c.pos.z, c.yaw].map(v => v.toFixed(2)))].join();  // the same page, screen and places: the same view
        const find = () => {  // best: no room and the frame's bottom on the page, then over the desk; none such: whole, room or not
          let best = { key, found: false, rank: 6 };
          search: for (const deg of [40, 35, 30, 25, 20, 15]) for (const x of [...[0, -0.1, 0.1, -0.2, 0.2].map(o => mid + o), L0.x]) {
            sph.phi = rad(deg);
            const r = first(r => (slid(r, x), whole()), 0.4, 2.5, 10), dz = slid(r, x);  // the nearest that holds them all
            if (!whole()) continue;
            const rank = (dz < 1 && !roomShown(cam, S.sky) ? (onPage() ? 0 : 1) : 2) + (spot(1, cam) ? 0 : 3);  // and the forward corner on screen: a phone has no other way on
            if (rank < best.rank) best = { key, found: true, rank, x, dz, phi: sph.phi, r };
            if (!rank) break search;
          }
          return best;
        };
        const roomOf = f => f.found ? (LOOK.set(f.x, L0.y, L0.z + f.dz), sph.set(f.r * 1.05, f.phi, sph.theta), pose(sph.radius, 0), roomShown(cam, S.sky)) : Infinity;  // the room the view shows, as it will be drawn
        if (S.phone?.key !== key) {
          S.phone = find();
          if (roomOf(S.phone) > 0.1) {  // the set pieces whole (a great tree, two houses) cost the sky: the living (and what they ride) whole instead
            const acted = new Set((S.m.acts ?? []).flatMap(a => [].concat(a.who ?? []))), living = subjects.filter(c => skin(c) || Object.keys(c.clips).length || acted.has(c.name) || c.c.model.startsWith("puppet:") || c.c.bob || subjects.some(o => o.c.on === c.name));  // what moves (a skin, a clip, an act), puppets, boats and what anyone rides: not the still houses, trees and tiles
            if (living.length && living.length < subjects.length) { const all = subjects; subjects = living; body = undefined; const g = find(), was = roomOf(S.phone); if (roomOf(g) < was) S.phone = { ...g, living: true }; subjects = all; body = undefined; }
          }
        }
        const f = S.phone;
        if (f.found) LOOK.set(f.x, L0.y, L0.z + f.dz), sph.set(f.r * 1.05, f.phi, sph.theta); else LOOK.copy(L0), sph.copy(s0);  // nothing holds them all: the whole-width view; 5 percent wider on a phone: a band of the book's near edge shows at the bottom
      }
    }
    if (titled) { const t = titlePose(); LOOK.copy(t.look); sph.setFromVector3(t.pos.clone().sub(t.look)); }
    LOOK.y -= dy;
    HOME = LOOK.clone().add(v.setFromSpherical(sph));
    cam.position.copy(keep[0]); cam.quaternion.copy(keep[1]); cam.updateMatrixWorld();
    const d = cam.position.distanceTo(controls.target);  // never past where the camera is now: the controls would snap it there in one frame
    Object.assign(controls, { minDistance: Math.min(sph.radius / 3, d), maxDistance: Math.max(sph.radius / 0.6, d) });  // the director's close shots come in past 1/1.6
  }
}
addEventListener("resize", () => { fit(); if (S) gameView(S.play.begun && !S.play.complete, true); }); fit();
function gameView(on, force) {  // every screen frames the game while it is on; otherwise the page's own view
  if (on && S.play.gv && !force) return 0;  // already framed, early (the frame loop): the prompt neither re-frames nor waits for a glide
  fit();
  const upright = innerWidth < 600 && innerWidth < innerHeight, one = upright && S.G.type === "steer", story = !!S.m.camera?.story;  // story: a story-camera page frames its game as the story does (below), from where the targets are, not where they walked before  // one: an upright phone frames the steer game hazard by hazard, the hazard with its two gold places (0.11 off, 0.095 wide) and the pair's head at its stop (the whole river left its rings 47 px wide, Kapi s07)
  const ts = on ? (one ? [S.play.targets[S.play.state?.i ?? 0]].filter(Boolean) : S.play.targets) : [];
  S.play.gi = S.play.state?.i;
  if (ts.length) {  // every target on the screen, every character in the shot whole and a body's height off, then as close as that allows
    const steer = S.G.type === "steer" && S.byName[S.G.who ?? "bobo"], rider = steer && S.cast.find(c => c.ride?.on === steer);  // steer: the pair goes round each hazard
    const pts = ts.flatMap(o => {  // where each target goes for the whole game: a boat's flame drifts and bobs with its boat (place(): ±drift, ±0.6 drift)
      const b = new THREE.Box3().setFromObject(o), rc = !(story && !S.play.begun) && S.play.reach?.get(o), at = o.getWorldPosition(new THREE.Vector3()), on = S.cast.find(c => { for (let a = o; a; a = a.parent) if (a === c.body) return true; }), dr = on?.c.bob ? (on.c.drift || 0) + 0.01 : 0;
      if (rc) b.min.add(rc.min.clone().sub(at)), b.max.add(rc.max.clone().sub(at));  // its whole reach so far (a lantern bobs, a bell swings), not only where it stands now
      if (steer) { const len = steer.box.getSize(new THREE.Vector3()).multiplyScalar(steer.s0); b.expandByVector(new THREE.Vector3(1, 0, 1).multiplyScalar(one ? 0.21 : 0.15 + Math.max(len.x, len.z) / 2)); b.max.y += steer.height + (rider?.height ?? 0); }  // its sides (0.11), its stop (0.15 short), its length, its rider
      return corners(b).flatMap(p => dr ? [-1, 1].flatMap(sx => [-1, 1].map(sz => p.clone().add(new THREE.Vector3(sx * dr, sz * 0.008, sz * 0.6 * dr)))) : [p]);  // the whole target
    });
    if (steer) {  // where he waits as the game starts: he turns there to face the first hazard, his length sweeping round him (s07: his tail swept to x 108 percent on a phone)
      const len = steer.box.getSize(new THREE.Vector3()).multiplyScalar(steer.s0), r = Math.max(len.x, len.z) / 2 + 0.02, gate = S.G.before ? S.page.lines.indexOf(S.G.before) : S.page.lines.length;  // and where he still swims before the game (s07 7.4 "off": the view is set before he sets out)
      const to = S.acting.acts.filter(a => a.who === steer.name && a.to != null && a.state !== "done" && S.page.lines.indexOf(a.line) < gate).map(a => S.where(a.to)).filter(Boolean);
      for (const c of [one ? steer.body.getWorldPosition(new THREE.Vector3()) : steer.pos, ...to]) pts.push(...corners(new THREE.Box3(c.clone().add(new THREE.Vector3(-r, 0, -r)), c.clone().add(new THREE.Vector3(r, steer.height + (rider?.height ?? 0), r)))));
    }
    const leap = S.G.type === "leap" && S.G.leap?.to && S.byName[S.G.rider ?? "kapi"];  // leap: where he lands is in the game's view too, or he leaps off it
    if (leap) pts.push(...corners(new THREE.Box3().setFromCenterAndSize(B(S.G.leap.to).add(new THREE.Vector3(0, leap.height / 2, 0)), new THREE.Vector3(1, 1, 1).multiplyScalar(leap.height))));
    const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const who = steer || (S.byName[S.G.who] ?? S.cast.filter(c => c.body.visible && (!S.acting.people || S.acting.people.has(c.name))).sort((a, b) => a.pos.distanceTo(mid) - b.pos.distanceTo(mid))[0]);  // a person, not a boat
    const hull = new Map(S.cast.filter(c => c.body.visible).map(c => [c, drawn(c)]));
    const boxes = new Map([...hull].map(([c, ps]) => [c, new THREE.Box3().setFromPoints(ps)]));
    const dir = HOME.clone().sub(LOOK).normalize(), side = new THREE.Vector3().crossVectors(dir, up3).normalize(), up = new THREE.Vector3().crossVectors(side, dir);
    if (story && dir.y > Math.sin(THREE.MathUtils.degToRad(25))) { const h = Math.hypot(dir.x, dir.z), e = THREE.MathUtils.degToRad(25); dir.set(dir.x / h * Math.cos(e), Math.sin(e), dir.z / h * Math.cos(e)); up.crossVectors(side, dir); }  // a story page's game seen as its story is, at most 25 degrees above (the phone's reading view looks down 50)
    const frame = ps => {  // the middle of a set of points, across and up the screen
      const xs = ps.map(p => p.dot(side)), ys = ps.map(p => p.dot(up)), m = ps.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(ps.length);
      return m.addScaledVector(side, (Math.max(...xs) + Math.min(...xs)) / 2 - m.dot(side)).addScaledVector(up, (Math.max(...ys) + Math.min(...ys)) / 2 - m.dot(up));
    };
    const view = cam.clone(), q = new THREE.Vector3(), W = innerWidth, H = innerHeight, rect = s => document.querySelector(s)?.getBoundingClientRect();
    const top = Math.max(0.09 * H, ...["#top", ".ra-page"].map(s => rect(s)).filter(r => r?.height).map(r => r.bottom + 4)), bar = rect("#bar");  // 9 percent in on every side (the 6 asked for, and 3 for a target's drift and the director's own slides), and clear of the text panel and top buttons above, the counter chip and "Read again" below
    const low = Math.min(0.91 * H, bar ? bar.top - 4 : H, H - (0.09 * H + 8 + 36)), ok = top < low, xs = [0.09 * W, 0.91 * W].map(x => x / W * 2 - 1), ys = [low, top].map(y => 1 - 2 * (ok ? y : (y === low ? 0.91 : 0.09) * H) / H);
    const seen = (p, m) => (q.copy(p).project(view), q.z < 1 && (m < 1 ? q.x >= xs[0] && q.x <= xs[1] && q.y >= ys[0] && q.y <= ys[1] : Math.abs(q.x) < m && Math.abs(q.y) < m));  // the read-along offset included; m < 1: the safe frame
    const clear = who?.height ?? 0, inShot = new Set(who ? [who, rider].filter(Boolean) : []);  // one: the pair where it is now and the next hazard (its stop and its places), nothing else
    let at, back;
    for (let k = 0; k < 5; k++) {  // a character that comes into the shot joins it whole: none is ever cut by the frame's edge
      const set = [...pts, ...[...inShot].flatMap(c => hull.get(c))];
      at = frame(set); back = 0.05;
      const fits = () => (view.position.copy(at).addScaledVector(dir, back), view.lookAt(at), view.updateMatrixWorld(),
        set.every(p => seen(p, 0.5)) && [...boxes.values()].every(b => b.distanceToPoint(view.position) >= clear));
      for (let i = 0; i < 150 && !fits(); i++) back *= 1.03;  // the nearest that holds it all
      const more = [...hull].filter(([c, ps]) => !inShot.has(c) && (!S.acting.people || S.acting.people.has(c.name)) && ps.some(p => seen(p, 1)));  // people; a boat may run off the edge
      if (!more.length || one) break;
      more.forEach(([c]) => inShot.add(c));
    }
    const lifted = (() => {  // an upright phone's director lifts a frame that shows the page's near edge until no desk shows (ambient.js write(): its `up`): lift it here, so that has nothing to move
      view.position.copy(at).addScaledVector(dir, back); view.lookAt(at); view.updateMatrixWorld();
      const e = q.set(at.x, S.flat.max.y, S.flat.max.z).applyMatrix4(view.matrixWorldInverse), ty = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), l = Math.min(0.8, Math.max(0, e.y + ty * -e.z + 0.01));
      const moved = at.clone().addScaledVector(up, l); view.position.copy(moved).addScaledVector(dir, back); view.lookAt(moved); view.updateMatrixWorld();
      return l && [...pts, ...[...inShot].flatMap(c => hull.get(c))].every(p => seen(p, 0.5)) ? moved : at;  // only if every target is still in the safe frame
    })();
    at = lifted;
    if (![at.x, at.y, at.z, back].every(Number.isFinite)) return home(on ? 1000 : 700, on);  // a degenerate target box (a mesh stored at scale 0) never becomes the view: the one before stays
    LOOK = at; HOME = at.clone().addScaledVector(dir, back); Object.assign(controls, { minDistance: Math.min(controls.minDistance, back * 0.8), maxDistance: Math.max(controls.maxDistance, back * 1.25), minPolarAngle: Math.min(controls.minPolarAngle, Math.acos(dir.y) - 0.01), maxPolarAngle: Math.max(controls.maxPolarAngle, Math.acos(dir.y) + 0.01) });  // the controls never clamp the game view (its angle: a phone's can be steeper than the reader's 20 degree floor, and the orbit would snap the glide there in one frame)
  }
  return home(on ? 1000 : 700, on);  // a calm glide to the game's view, begun before the line before the game ends (the director, ambient.js, reads it as a reader's hand and keeps clear)
}

let last = performance.now();
const camWas = [new THREE.Vector3(), new THREE.Vector3()], camVel = [new THREE.Vector3(), new THREE.Vector3()];
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
  for (const h of S.held) { const { o } = h; o.userData.rest ??= o.position.clone(); if (h.pose) h.bone.updateWorldMatrix(true, false), head.setFromMatrixPosition(h.bone.matrixWorld), seatHeld(o, h.pose, head, h.aim != null ? S.where(h.aim) : null); else toWorld(o, inHandAt(h, head)); S.cast.find(c => c.body === o)?.pos.copy(head); }  // a held character is there for good: where() and its riders find it in the hand
  S.falls = S.falls.filter(f => { const k = Math.min(1, (performance.now() - f.t0) / 350); S.placed[f.what] = f.from.clone().setY(f.from.y - f.dy * k * k); return k < 1; });  // a released tool falling: slow, then fast
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
  if (arrival3 && !arrival3.finished) {  // the arrival draws first (even before the spread has loaded), then hands over
    arrival3.frame(now); document.documentElement.classList.toggle("arriving", arrival3.active || arrival3.locked);  // the open body and the page's own marks wait for the hand-over
    if (arrival3.rendered && veil) { const v = veil; v.style.opacity = 0; setTimeout(() => v.remove(), 300); veil = null; }
    if (arrival3.active) { drawArrival(!!S); return; }  // before the spread is up, the plain renderer (no bloom, no multisampled buffers): the arrival must not slow its loading
  }
  if (!S) return;
  autoTick(now);
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
  const gp = S.play, gl = (S.G.before ? S.page.lines.indexOf(S.G.before) : S.page.lines.length) - 1;  // the game's view is set 2.4 s before the line before it ends (a glide of 1 s, so it is in place before the prompt; earlier and the director, which reads the glide as a reader's hand, returns to the line's shot 4 s later): the director takes its game shot from the viewer's view that same frame (ambient.js play()), so a view set later is one it never goes to
  if (mode === "open" && gp.targets.length && !gp.complete) for (const o of gp.targets) { const p = o.getWorldPosition(new THREE.Vector3()), r = (gp.reach ??= new Map()).get(o); r ? r.expandByPoint(p) : gp.reach.set(o, new THREE.Box3(p.clone(), p.clone())); }  // how far each target goes, for the frame
  if (gp.begun && !gp.complete && gp.gi != null && gp.state?.i !== gp.gi && gp.state.i < gp.targets.length && S.G.type === "steer" && innerWidth < 600 && innerWidth < innerHeight) gameView(true, true);  // the next hazard: its own view
  if (gp.targets.length && !gp.begun && !gp.complete && !gp.gv && mode === "open" && gl >= 0 && reader.id === S.page.lines[gl] && (timing[reader.id]?.duration ?? 2) - reader.audio.currentTime <= 2.4) gameView(true), gp.gv = true;
  hooks.forEach(h => h.frame?.(dt, now));
  if (homing && !homing(now)) homing = null;
  controls.update();
  if (dt > 0) camVel[0].subVectors(cam.position, camWas[0]).divideScalar(dt), camVel[1].subVectors(controls.target, camWas[1]).divideScalar(dt); camWas[0].copy(cam.position); camWas[1].copy(controls.target);  // the camera's speed this frame (m/s), for a glide that carries it
  for (const s of [$("sbub"), $("lbub")]) if (!s.hidden && s.who) {  // a bubble rides above its speaker's head; a word card above (else below) the thing's whole box, never on it
    let x, ytop, ybot;
    if (s.who.box) {
      cardBox.setFromObject(s.who.body); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (let i = 0; i < 8; i++) { head.set(i & 1 ? cardBox.max.x : cardBox.min.x, i & 2 ? cardBox.max.y : cardBox.min.y, i & 4 ? cardBox.max.z : cardBox.min.z).project(cam); x0 = Math.min(x0, head.x); x1 = Math.max(x1, head.x); y0 = Math.min(y0, head.y); y1 = Math.max(y1, head.y); }
      x = (x0 + x1) / 2; ytop = (1 - y1) / 2 * innerHeight; ybot = (1 - y0) / 2 * innerHeight;
    } else { s.who.body.getWorldPosition(head).add(new THREE.Vector3(0, s.who.c.height * 1.15, 0)).project(cam); x = head.x; ytop = (1 - head.y) / 2 * innerHeight; ybot = ytop + 0.07 * innerHeight; }
    const half = s.offsetWidth / 2 + 8;  // kept whole on the screen
    s.style.left = `${Math.min(innerWidth - half, Math.max(half, (x + 1) / 2 * innerWidth))}px`;
    const top = s === $("sbub") ? (document.querySelector(".ra-page")?.getBoundingClientRect().bottom ?? 0) + 8 : 8, h = s.offsetHeight + 14;  // never under the read-along page: where there is no room above the thing, the card goes below
    const below = ytop - h < top;
    s.classList.toggle("below", below); s.style.translate = below ? "-50% 0" : ""; s.style.top = `${Math.min(innerHeight - h - 8, below ? ybot + 6 : ytop - 4)}px`;
  }
  showHint(now); dimReading(now);
  renderer.shadowMap.needsUpdate = !(innerWidth < 600 && (frame_n++ & 1));  // the shadows are redrawn every frame on a big screen and every second frame on a phone (30 Hz is not seen under a drifting camera)
  composer.render();
  for (const [o, p, q, sc] of undo.splice(0).reverse()) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); }
});
enter(await load(first), "closed"); spreadReady = true; lift(); notice.open();
canvas.focus();
window.live = { get sfx() { return sfxHook.fx; }, get arrival() { return arrival3; }, get titled() { return titled; }, drawn, gradeAnimal, get home() { return HOME && { pos: HOME.clone(), look: LOOK.clone(), fov: cam.fov }; }, readHome,  // the reading view, current after every resize
  get auto() { return au; }, get mode() { return mode; }, get frame() { return frame; }, get S() { return S; }, get root() { return S.root; }, get cast() { return S.cast; },
  get acting() { return S.acting; }, get game() { return S.play; }, get exitOn() { return exitOn; }, get dpr() { return dpr; }, hint, snd, played, get lastTap() { return tapped; }, nearest: (x, y) => (boxes = null, aim(x, y), nearest()), scene, composer, renderer, reader, hooks, turn, tap, readFrom, fit, dim: dimReading, controls, cam, load, spreads, reset: home,
  halt: () => (homing = null, true) };  // the director takes the camera from the glide home (ambient.js, a spread turned to)
