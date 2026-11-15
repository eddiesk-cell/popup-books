// shelf.js — the shelf: thick old leather books lying on a table, as many as the page's book list holds (a row that scrolls sideways with snap).
// Hover (or, on a phone, stillness) wakes the book under the pointer: a paper-theatre pop-up unfolds out of its cover and its character greets; only one book is awake at a time.
// A click (or the book's button) unlatches the clasp, swings the cover open and goes to that book's viewer.
// Models and textures are made by tools/shelf_book.py, tools/shelf_tex.py and tools/shelf_layers.py; one entry in the page's book list is one book At rest a book is a plain leather book whose cover carries its picture (books/<id>/plate.webp, made by tools/shelf_plate.mjs from the book's own layers); waking turns that picture into the pop-up.
// It renders only while something moves (a tilt, a scroll, a fold, a wave, the slow glint) and not at all when the tab or the shelf is off screen.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPopup, ease, dotTexture } from "./popup.js";
import { loadBook } from "./bookmodel.js";

const $ = id => document.getElementById(id), Q = new URLSearchParams(location.search), POSTER = Q.has("poster"), SOLO = Q.get("solo"), ZOOM = +Q.get("zoom") || 1;
const AT = (Q.get("at") || "0.02,0.07,0.07").split(",").map(Number), AZ = (+Q.get("az") || 0) * Math.PI / 180;  // ?solo=kapi&zoom=2.4&at=x,y,z&az=deg: one book at the origin, close-ups for the stills
const LIST = SOLO ? JSON.parse($("books").textContent).filter(b => b.id === SOLO) : JSON.parse($("books").textContent), N = LIST.length, SPACING = 0.42;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, touch = matchMedia("(hover: none)").matches;
const stage = $("stage"), rail = $("rail"), canvas = $("gl"), rad = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp;

// ---------------------------------------------------------------- renderer, scene, light (shared by every book)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: POSTER });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Math.min(innerWidth, innerHeight) < 600 ? 1.5 : 2));  // phones 1.5, everything else 2
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1.6, 0.05, 8);
scene.background = new THREE.Color(0x0d0805);
{ const env = new RoomEnvironment(); env.traverse(o => o.material?.color?.multiply(new THREE.Color(1, .82, .62)));  // a small warm room built here: no HDRI file
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.04).texture; scene.environmentIntensity = 0.34; }
const KEY = 10.5, key = new THREE.SpotLight(0xffa860, KEY, 0, 0.62, 0.9, 2); key.position.set(-0.55, 0.85, 0.5); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.003; key.shadow.radius = 5; key.shadow.camera.near = 0.4; key.shadow.camera.far = 2.5;
const fill = new THREE.HemisphereLight(0x5f78b8, 0x20140c, 0.3), inner = new THREE.PointLight(0xffc27a, 0, 0.5, 2), glint = new THREE.PointLight(0xfff0cc, 0, 0.45, 2);
// the awake book's own lights are ONE set, moved to whichever book is awake: a fixed light count means no shader recompiles and one extra shadow map at most
const lantern = new THREE.PointLight(0xffc16b, 0, 0.32, 2), front = new THREE.SpotLight(0xffe2b8, 0, 0.9, 0.22, 0.8, 2), leakLight = new THREE.PointLight(0xffa850, 0, 0.4, 2);
front.castShadow = true; front.shadow.mapSize.set(1024, 1024); front.shadow.bias = -0.0003; front.shadow.normalBias = 0.0015; front.shadow.camera.near = 0.2; front.shadow.camera.far = 0.8;
scene.add(key, key.target, fill, inner, glint, lantern, front, front.target, leakLight);

const tl = new THREE.TextureLoader();  // glb-style uvs (v from the top) need flipY off; the table's plane keeps three's
const tex = (u, srgb, rep, flip = false) => tl.loadAsync(u).then(t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.flipY = flip; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
const REST_Y = -0.14, SH = {};  // SH: what every book shares (the glb, the leather tile, gilt, brass, the table)

// ---------------------------------------------------------------- the books
const bks = LIST.map((cfg, i) => ({ cfg, i, x: i * SPACING, aim: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, awake: false, openT: 0, hoverT: 0, glowK: 0, rattleT: 0, nextRattle: 0, pop: null }));
const solo = bks.length === 1; let gone = false;
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function loadShared() {  // the table and the soft light blobs (the book itself, its leather and brass are bookmodel.js)
  const [wcol, wnor] = await Promise.all([tex("wood-color.webp", 1, 1, true), tex("wood-normal.webp", 0, 1, true)]);
  const wood = new THREE.MeshStandardMaterial({ map: wcol, normalMap: wnor, roughness: 0.5, color: 0x7d6a5c }); wcol.repeat.set(3, 6 * 2); wnor.repeat.set(3, 6 * 2);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), wood); table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), gr = x.createRadialGradient(64, 64, 8, 64, 64, 62);
  gr.addColorStop(0, "rgba(0,0,0,.65)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); SH.blobTex = new THREE.CanvasTexture(c);  // a soft contact shadow under each book
  const w2 = document.createElement("canvas"); w2.width = w2.height = 128; { const x2 = w2.getContext("2d"), g2 = x2.createRadialGradient(64, 64, 10, 64, 64, 64); g2.addColorStop(0, "rgba(255,160,70,.13)"); g2.addColorStop(1, "rgba(255,170,80,0)"); x2.fillStyle = g2; x2.fillRect(0, 0, 128, 128); SH.bounceTex = new THREE.CanvasTexture(w2); }
  const lc = document.createElement("canvas"); lc.width = 128; lc.height = 64; { const x3 = lc.getContext("2d"); for (let u = 0; u < 128; u++) { const z = (u / 128 - 0.5) * 0.3, a = Math.exp(-(((Math.abs(z) - 0.075) / 0.05) ** 2)); for (let v = 0; v < 64; v += 2) { x3.fillStyle = `rgba(255,190,110,${a * (v % 4 ? 0.55 : 1)})`; x3.fillRect(u, v, 1, 2); } } } SH.leakTex = new THREE.CanvasTexture(lc);
}
async function makeBook(b) {
  const B = await loadBook(THREE, gltf, b.cfg.id, ""); b.mats = B.materials; b.root = B.group; b.cover = B.cover; b.strap = B.strap; b.panel = B.panel; b.plate = B.plate;
  b.book = new THREE.Group(); b.tilt = new THREE.Group(); b.book.add(b.root); b.tilt.add(b.book); b.tilt.position.x = b.x; b.tilt.rotation.y = REST_Y; scene.add(b.tilt);
  b.pop = createPopup(THREE, scene, b.cfg, { size: b.panel.userData.size, reduced: reduce, book: b.book, lights: { lantern, front }, say: (t, s) => say(b, t, s), onEvent: n => onPop(b, n) }); b.panel.add(b.pop.group);  // the pop-up, in the cover's recess
  { const mp = new Float32Array(36 * 3), rr = Math.random, d = b.panel.userData.size[1], r = b.panel.userData.recess; for (let i = 0; i < 36; i++) mp.set([(rr() - 0.5) * 0.06, r + 0.0012 + rr() * 0.003, (rr() - 0.5) * d * 0.9], i * 3); b.plate.off = mp.slice(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    b.plate.mo = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex, color: 0xffd36e, size: 0.009, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, depthTest: false })); b.plate.mo.renderOrder = 6; b.plate.mo.frustumCulled = false; b.plate.mo.visible = false; b.panel.add(b.plate.mo); }  // the sweep of gold motes
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.62), new THREE.MeshBasicMaterial({ map: SH.blobTex, transparent: true, depthWrite: false })); b.blob = blob; blob.rotation.x = -Math.PI / 2; blob.position.set(b.x, 0.0006, 0); scene.add(blob);
  const bounce = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.7), new THREE.MeshBasicMaterial({ map: SH.bounceTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));  // a faint warm bounce of the gilt edges on the table
  bounce.rotation.x = -Math.PI / 2; bounce.position.set(b.x + 0.02, 0.0009, 0.05); scene.add(bounce);
  b.leak = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: SH.leakTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); b.leak.rotation.y = Math.PI / 2; b.leak.position.set(0.1698, 0.058, 0); b.book.add(b.leak);  // light from the pages, along the fore-edge beside the clasp
  b.dim = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.48), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, depthWrite: false })); b.dim.rotation.x = -Math.PI / 2; b.dim.position.y = 0.135; b.dim.visible = false; b.tilt.add(b.dim);  // a dark veil over the books that were not chosen
  b.hit = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.116, 0.40), new THREE.MeshBasicMaterial()); b.hit.position.y = 0.058; b.hit.visible = false; b.book.add(b.hit);
}

// ---------------------------------------------------------------- framing: the same picture as the poster, for any stage shape; the camera follows the sideways scroll
const view = { open: 0, book: null, k: 0, dz: 0 }, TARGET = new THREE.Vector3(0, 0.075, -0.015); let camX = 0;
const slideV = () => Math.max(1, Math.min(N, +getComputedStyle(rail).getPropertyValue("--v") || 1)), slideW = () => rail.clientWidth / slideV();
const camXNow = () => { const x = (rail.scrollLeft / slideW() + (slideV() - 1) / 2) * SPACING; return view.book ? x + (view.book.x - x) * view.open : x; };
function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (w && h) { renderer.setSize(w, h, false); cam.aspect = w / h; aimCam(); } }
const underBooks = () => { const w = stage.clientWidth; for (const b of bks) if (b.slide && w) { const x = Math.round((new THREE.Vector3(b.x, 0.058, 0).project(cam).x + 1) / 2 * w - (b.i * slideW() - rail.scrollLeft)); if (b.bx !== x) { b.bx = x; b.slide.style.setProperty("--bx", x + "px"); } } };  // each book's button and bubble sit under the book as drawn, not at the middle of its slide
function aimCam() {
  camX = camXNow(); const th = Math.tan(rad(cam.fov / 2)), need = 0.36 + SPACING * (slideV() - 1), d = ZOOM ** -1 * Math.max(need / (0.8 * 2 * th * cam.aspect), 0.47 / (0.85 * 2 * th)) * (1 - 0.1 * view.k), el = rad(52);
  const c = (ZOOM > 1 ? new THREE.Vector3(...AT) : TARGET).clone().add(new THREE.Vector3(camX, 0, view.dz));
  cam.position.copy(c).add(new THREE.Vector3(Math.cos(el) * Math.sin(AZ), Math.sin(el), Math.cos(el) * Math.cos(AZ)).multiplyScalar(d)); cam.lookAt(c); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); underBooks();
  key.position.x = camX - 0.55 + 0.25 * view.k; key.target.position.x = camX + 0.1 * view.k;  // the candle stays with the part of the shelf in view
}

// ---------------------------------------------------------------- the pop-up lives in popup.js (createPopup); the shelf wires it to each book, its subtitle, its events and the shared lights
const dotTex = dotTexture(THREE), GL = 0.04, LLK = 0.03;
const say = (b, t, s) => { const e = b.say; clearTimeout(e.t); if (t == null) e.classList.remove("on"); else { e.firstChild.textContent = t; e.lastChild.textContent = s; e.classList.add("on"); e.t = setTimeout(() => e.classList.remove("on"), 3200); } kick(); };
const onPop = (b, n) => { if (n === "clasp") { b.rattleT = performance.now(); b.nextRattle = b.rattleT + 10000; } else if (n !== "greet") note(n, b); kick(); };  // Pip reached the clasp: it rattles and glints
const note = (n, b) => (window.__shelf.events ??= []).push({ n, book: b.cfg.id, t: Date.now() });
const ensurePopup = b => b.pop.load().then(() => { document.documentElement.dataset.popup = "1"; kick(); });
function plateStep(b) {  // the printed picture gives way to the layers rising through it: its gold fillet glows and gold motes sweep across it over the first 0.35 s, then it is gone by 0.45 s (P 0.21), drawn over the layers that are only just starting to rise, so no ghost picture lies over the standing scene; the same, reversed, as the layers fold down
  const P = b.pop.P, pl = b.plate, s = clamp(P / 0.17, 0, 1), a = 1 - ease((P - 0.1) / 0.11), m = pl.m.material; pl.m.visible = a > 0.004; m.opacity = a; m.emissiveIntensity = 1.1 * Math.sin(Math.PI * s);
  pl.mo.visible = s > 0 && s < 1 && !reduce; if (pl.mo.visible) { const p = pl.mo.geometry.attributes.position, cx = -0.12 + 0.24 * s; for (let i = 0; i < 36; i++) p.setX(i, cx + pl.off[i * 3]); p.needsUpdate = true; pl.mo.material.opacity = 0.95 * Math.sin(Math.PI * s); }
}

// ---------------------------------------------------------------- sound: a soft paper sound
let snd; const apis = {};
const sound = async (b, n) => { try { snd ??= await import("../live/sound.js"); (apis[b.cfg.id] ??= snd.addSound(snd.manifestFor(b.cfg.id, "../"))).play(n, { gain: 0.8 }); } catch { /* no sound is fine */ } };

// ---------------------------------------------------------------- state: asleep / awake / opening (one book awake at a time)
let onScreen = true; const awakeBook = () => bks.find(b => b.awake), current = () => awakeBook() || bks[0];
function wake(b) {
  if (b.awake || b.openT || gone) return; for (const o of bks) if (o !== b && o.awake) sleep(o);
  b.awake = true; b.slide.classList.add("awake"); b.book.add(leakLight); leakLight.position.set(0.19, 0.06, 0); b.pop.wake(); ensurePopup(b).then(() => reduce && b.awake && plateStep(b));
  if (!reduce) { b.nextRattle = performance.now() + 3000; sound(b, "paper-rustle"); } kick();  // reduced motion: switched, not animated
}
function sleep(b) {
  if (!b.awake || b.openT) return; b.awake = false; b.slide.classList.remove("awake"); b.pop.sleep();
  if (reduce) { if (b.pop.built) plateStep(b); kick(); return; }
  sound(b, "i-paper"); kick();
}
// CHOOSING a book (one animation for every book, driven only by its entry): the pop-up folds back into its picture (0.3 s), the closed book is lifted a hand's height and tilted toward the reader, the others slide aside and dim,
// then it is carried toward the reader and a little down, the camera going with it, the candle light sliding across the gold; a warm veil closes on the fastest moment and the page goes to the reader. See HANDOFF.md for the pose at the cut.
const LIFT = 0.18, CARRY = 0.45, SINK = 0.07, TILT = 0.45, TILT2 = 0.15, T_UP = 0.1, T_UP1 = 0.9, T_GO = 0.4, T_GO1 = 1.6, T_VEIL = 1.25, WARM = "#1c1009";  // metres, radians, seconds
const carry = t => { const s1 = ease((t - T_UP) / (T_UP1 - T_UP)), u = clamp((t - T_GO) / (T_GO1 - T_GO), 0, 1), s2 = 1 - Math.cos(Math.PI / 2 * u); return { s1, s2, y: LIFT * s1 - SINK * s2, z: CARRY * s2, rx: TILT * s1 + TILT2 * s2, yaw: ease(t / 0.9) }; };  // s2 is eased IN only: the book is at its fastest as it leaves
function openBook(b) {
  if (b.openT || gone) return; b.openT = performance.now(); b.awake = false; b.slide.classList.remove("awake"); b.pop.sleep(true); sound(b, "page-turn"); view.book = b;
  document.body.classList.add("picking"); const v = $("veil"); v.style.background = WARM; if (reduce) { v.style.transition = "opacity .3s ease"; v.classList.add("on"); setTimeout(() => go(b), 320); return; } kick();
}
const go = b => { if (gone) return; gone = true; location.href = b.cfg.href + "&from=shelf"; };
addEventListener("pageshow", e => e.persisted && location.reload());

// ---------------------------------------------------------------- the rail: one slide per book (title caption, button, subtitle), sideways scroll with snap, dots, arrows
for (const b of bks) {
  const s = b.slide = document.createElement("section"); s.className = "slide"; s.tabIndex = 0; s.setAttribute("role", "button"); s.setAttribute("aria-label", `${b.cfg.title}. Press Enter to open the book.`);
  s.innerHTML = `<div class="say" aria-live="polite"><b></b><i></i></div><button class="open" type="button">Open the book</button>`; b.say = s.querySelector(".say"); rail.append(s);
  s.querySelector(".open").addEventListener("click", e => { e.stopPropagation(); openBook(b); });
  s.addEventListener("keydown", e => { if (e.target === s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openBook(b); } });
  s.addEventListener("focus", () => { if (!touch) wake(b); }); s.addEventListener("blur", () => { if (!b.openT && !touch) sleep(b); });
}
const dots = $("dots"); if (N > 1) { dots.innerHTML = bks.map((b, i) => `<button type="button" aria-label="${b.cfg.title}" data-i="${i}"></button>`).join(""); dots.onclick = e => e.target.dataset.i != null && goTo(+e.target.dataset.i); }
const goTo = i => rail.scrollTo({ left: Math.max(0, Math.min(i, N - slideV())) * slideW(), behavior: reduce ? "auto" : "smooth" });
$("prev").onclick = () => goTo(Math.round(rail.scrollLeft / slideW()) - 1); $("next").onclick = () => goTo(Math.round(rail.scrollLeft / slideW()) + 1);
const showNav = () => { const more = N > slideV(), i = Math.round(rail.scrollLeft / slideW()); document.body.classList.toggle("many", more); $("prev").hidden = !more || i <= 0; $("next").hidden = !more || i >= N - slideV(); [...dots.children].forEach((d, k) => d.classList.toggle("on", k >= i && k < i + slideV())); };
let scrollT = 0; rail.addEventListener("scroll", () => { clearTimeout(scrollT); scrollT = setTimeout(settle, 240); kick(); }, { passive: true });
function settle() {  // a phone has no hover: the book that is centred and still wakes
  showNav(); if (!touch || reduce || Q.has("still") || SOLO && POSTER) return; const v = slideV(); if (v !== 1) return; const i = clamp(Math.round(rail.scrollLeft / slideW()), 0, N - 1); if (onScreen) wake(bks[i]); for (const o of bks) if (o !== bks[i]) sleep(o);
}

// ---------------------------------------------------------------- input (the rail overlays the stage)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hov = { b: null };
function pick(e) { const r = stage.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); let best = null, bd = 1e9; for (const b of bks) { const h = ray.intersectObject(b.hit)[0]; if (h && h.distance < bd) { best = b; bd = h.distance; } } return best; }
const slideAt = e => { const r = rail.getBoundingClientRect(); return bks[clamp(Math.floor((e.clientX - r.left + rail.scrollLeft) / slideW()), 0, N - 1)]; };
rail.addEventListener("pointermove", e => {
  if (e.pointerType === "touch" || gone) return; const b = pick(e), s = slideAt(e), r = s.slide.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  for (const o of bks) { o.aim.x = o === s && !reduce ? ((e.clientX - r.left) / r.width - 0.5) * 2 : 0; o.aim.y = o === s && !reduce ? ((e.clientY - sr.top) / sr.height - 0.5) * 2 : 0; }
  hov.b = b; clearTimeout(hov.t); if (b) wake(b); else hov.t = setTimeout(() => { const a = awakeBook(); if (a && !hov.b) sleep(a); }, 380); kick();
});
rail.addEventListener("pointerleave", e => { if (e.pointerType === "touch") return; hov.b = null; for (const o of bks) o.aim.x = o.aim.y = 0; clearTimeout(hov.t); hov.t = setTimeout(() => { const a = awakeBook(); if (a) sleep(a); }, 380); kick(); });
rail.addEventListener("click", e => { if (e.pointerType === "touch" || e.detail === 0 || e.target.closest("button")) return; const b = pick(e); if (b) openBook(b); });
rail.addEventListener("pointerup", e => { if (e.pointerType !== "touch" || e.target.closest("button")) return; const b = pick(e) || slideAt(e); b.awake ? b.pop.greet() : wake(b); });  // a first tap wakes, the next greets again

// ---------------------------------------------------------------- the frame loop: runs only while something moves
const coverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.118), tmp = new THREE.Vector3(); let glintK = 0, glowAll = 0;
let raf = 0, last = 0, glints = 0, glintT = -1, glintB = null, frames = 0, lastRender = 0, ready = false, lastScroll = -1;
window.__shelf = { get state() { return { onScreen, raf, ready, hidden: document.hidden }; }, get frames() { return frames; }, get glints() { return glints; }, glint: () => { glintT = performance.now(); glintB = bks[0]; glints++; kick(); }, renderer, scene, cam, lights: { key, fill, front, lantern }, aim: bks[0].aim, get pop() { return current().pop; }, get books() { return bks; }, b: id => bks.find(b => b.cfg.id === id), at: id => { const b = bks.find(x => x.cfg.id === id), v = new THREE.Vector3(b.x, 0.06, 0).project(cam), r = stage.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, get awake() { return !!awakeBook(); },
  setP: (p, id) => { const b = id ? bks.find(x => x.cfg.id === id) : bks[0]; b.pop.setP(p); kick(); } };  // for tools/shelf_*.mjs
const kick = () => { if (!raf && !document.hidden && onScreen && ready) { last = performance.now(); raf = requestAnimationFrame(loop); } };
const mg = new THREE.BufferGeometry(), NM = 70, mp = new Float32Array(NM * 3); for (let i = 0; i < NM; i++) mp.set([(Math.random() - .5) * 0.5, 0.03 + Math.random() * 0.3, (Math.random() - .5) * 0.5], i * 3);
mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));  // motes: specks drifting up in the light, present only inside the glint window
const motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: dotTex, color: 0xffd9a0, size: 0.006, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); motes.visible = false; scene.add(motes);
const drift = dt => { for (let i = 0; i < NM; i++) { mp[i * 3 + 1] += dt * 0.012; mp[i * 3] += Math.sin(i + performance.now() / 2200) * dt * 0.006; if (mp[i * 3 + 1] > 0.34) mp[i * 3 + 1] = 0.03; } mg.attributes.position.needsUpdate = true; };
function loop(now) {
  raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now; let busy = false, anyOpen = false;
  const moving = bks.some(b => Math.abs(b.aim.x - b.cur.x) + Math.abs(b.aim.y - b.cur.y) > 8e-4 || b.pop.moving || b.openT), scrolled = rail.scrollLeft !== lastScroll; lastScroll = rail.scrollLeft;
  if (!moving && !scrolled && now - lastRender < 40) { raf = requestAnimationFrame(loop); return; }  // glint or a character alone: 30 fps is plenty
  const sec = now / 1000; aimCam(); const a = awakeBook(); let glowMax = 0;
  for (const b of bks) {
    const pop = b.pop, tiltMoving = Math.abs(b.aim.x - b.cur.x) + Math.abs(b.aim.y - b.cur.y) > 8e-4;
    if (pop.built) { busy = pop.update(dt, b.cur.x) || busy; plateStep(b); }  // the pop-up rises, stands, lives (popup.js); the printed picture gives way (plateStep)
    const k = 1 - Math.exp(-dt * 4.5); b.cur.x += (b.aim.x - b.cur.x) * k; b.cur.y += (b.aim.y - b.cur.y) * k;  // tilt eases toward the pointer, never snaps; the books turn a little toward the centre of the view
    b.tilt.rotation.y = REST_Y + (camX - b.x) * 0.45 + b.cur.x * 0.09; b.tilt.rotation.x = b.cur.y * 0.045; busy ||= tiltMoving;
    b.glowK += ((b.awake && !b.openT ? 1 : 0) - b.glowK) * (1 - Math.exp(-dt * 2.5)); glowMax = Math.max(glowMax, b.glowK); const breath = 0.5 + 0.5 * Math.sin(sec * Math.PI / 2);
    b.leak.material.opacity = b.glowK * (0.14 + 0.3 * breath); if (b === a) leakLight.intensity = b.glowK * LLK * (0.45 + 0.55 * breath); if (b.glowK > 0.01 && b.glowK < 0.99) busy = true;
    if (b.awake && !b.openT && !reduce && now >= b.nextRattle && pop.P > 0.9 && !pop.pip) { b.rattleT = now; b.nextRattle = now + 10000 + Math.random() * 2000; }
    if (b.rattleT) { const t = (now - b.rattleT) / 1000; if (b.openT || t > 1.4) { b.rattleT = 0; if (!b.openT) b.strap.rotation.z = 0; } else { b.strap.rotation.z = 0.055 * Math.exp(-3.2 * t) * Math.sin(2 * Math.PI * 6.5 * t); glint.position.set(b.x + 0.158, 0.17, 0); glint.intensity = GL * 4 * Math.exp(-2.4 * t); busy = true; } }
    if (b.openT && !reduce) {  // chosen: carried off (the closed book, cover up, never opened here)
      const t = (now - b.openT) / 1000, c = carry(t); busy = anyOpen = true; b.aim.x = b.aim.y = 0;
      b.tilt.position.set(b.x, c.y, c.z); b.tilt.rotation.set(c.rx, b.tilt.rotation.y * (1 - c.yaw), 0); view.open = ease(t / 0.8); view.dz = 0.85 * c.z; view.k = c.s2;
      b.blob.material.opacity = 1 - 0.55 * c.s1; b.blob.scale.setScalar(1 - 0.15 * c.s1); b.blob.position.z = 0.9 * c.z; (window.__shelf.trace ??= []).push([now, b.x, c.y, c.z, c.rx, b.tilt.rotation.y]);
      if (t > T_VEIL && !b.veiled) { b.veiled = true; $("veil").style.background = WARM; $("veil").style.transition = "opacity .35s ease-in"; $("veil").classList.add("on"); } if (t > T_GO1) go(b);
    } else if (!reduce && bks.some(o => o.openT)) {  // the others slide a little aside and dim
      const o = bks.find(x => x.openT), e = ease((now - o.openT) / 1000 / 0.6), sg = Math.sign(b.x - o.x) || 1; b.tilt.position.x = b.x + sg * 0.12 * e; b.dim.visible = e > 0.01; b.dim.material.opacity = 0.5 * e; b.blob.position.x = b.x + sg * 0.12 * e;
    }
  }
  const dim = 1 - 0.15 * glowMax;  // while a book is awake the table and the books' edges dim 15 % (eased) so the scene glows out of it
  key.intensity = KEY * dim * (1 - 0.5 * view.k) * (1 + 0.028 * Math.sin(sec * 1.3) + 0.016 * Math.sin(sec * 2.9 + 1.7)); scene.environmentIntensity = 0.34 * dim; fill.intensity = 0.3 * dim;
  // a point of light follows the pointer across the awake book's cover, so the tilt sweeps a glint over the gold tooling
  glintK += ((a && !a.openT ? 1 : 0) - glintK) * (1 - Math.exp(-dt * 3)); const rat = bks.some(b => b.rattleT);
  if (glintK > 0.01 && glintT < 0 && !rat) { ray.setFromCamera(ndc, cam); if (ray.ray.intersectPlane(coverPlane, tmp)) { const bx = (a || bks[0]).x; glint.position.set(bx + clamp(tmp.x - bx, -0.15, 0.15), 0.118 + 0.05, clamp(tmp.z, -0.2, 0.2)); glint.intensity = GL * glintK; } } else if (glintT < 0 && !rat) glint.intensity = 0; if (glintK > 0.01 && glintK < 0.99) busy = true;
  if (glintT >= 0) {  // the slow glint: a point of warm light travelling across a cover, and motes in the light
    const t = (performance.now() - glintT) / 2600, bx = glintB.x;
    if (t >= 1) { glintT = -1; glint.intensity = 0; motes.visible = false; } else { const e = Math.sin(Math.PI * t) ** 2; glint.position.set(bx - 0.17 + 0.34 * ease(t), 0.118 + 0.05, 0.1 - 0.2 * t); glint.intensity = GL * e; motes.position.x = bx; motes.visible = true; motes.material.opacity = 0.6 * e; drift(dt); busy = true; }
  }
  if (!anyOpen && view.book) { view.book = null; view.open = view.k = view.dz = 0; }
  renderer.render(scene, cam); frames++; lastRender = now;
  if (busy) raf = requestAnimationFrame(loop);
}
const startGlint = () => setTimeout(() => { if (!reduce && onScreen && !document.hidden && !awakeBook() && !bks.some(b => b.openT)) { glintT = performance.now(); glintB = bks[Math.floor(Math.random() * N)]; glints++; kick(); } startGlint(); }, 18000 + Math.random() * 8000);

// ---------------------------------------------------------------- start
addEventListener("resize", () => { resize(); showNav(); kick(); });
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) kick(); else { cancelAnimationFrame(raf); raf = 0; if (touch) for (const b of bks) sleep(b); } }, { threshold: 0.05 }).observe(stage);
document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; for (const b of bks) b.pop.hush(); } else kick(); });
rail.style.setProperty("--v", slideV()); await loadShared(); await Promise.all(bks.map(makeBook)); resize(); showNav(); renderer.compile(scene, cam); renderer.render(scene, cam); frames++;
requestAnimationFrame(() => { canvas.classList.add("on"); document.documentElement.dataset.ready = "1"; });  // the 3D replaces the poster in the same place, in the same light
ready = true;
if (!POSTER) {
  const later = f => (window.requestIdleCallback || (g => setTimeout(g, 300)))(f, { timeout: 1500 });  // a book's pop-up: not needed by the first view; loaded when about to be seen (the books in view and the next one)
  const near = () => { const i = Math.round(rail.scrollLeft / slideW()); bks.forEach(b => { if (b.i >= i - 1 && b.i <= i + slideV()) later(() => ensurePopup(b)); }); }; near(); rail.addEventListener("scroll", () => { clearTimeout(near.t); near.t = setTimeout(near, 300); }, { passive: true });
  startGlint();
  if (touch && !reduce && !Q.has("still")) setTimeout(settle, 1100);
}
