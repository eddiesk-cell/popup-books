// ambient.js — the cinematic layer and the living world of the live pop-up book: LIVE-MASTERPLAN.md ("The cinematic
// layer", "The living world") played from the manifest blocks written in stories/<book>/DIRECTION.md (shots, extras,
// wind, light, ambient) with the paper puppets of stories/PUPPETS.md. Everything is paper: cut-out clouds and birds,
// a ladybug on the grass, puppets pinned like split-pin toys, motes and mist off the water, fog, wind, light.
//
// INTEGRATION — live.js already has the slot ("hook: the cinematic layer plugs in here"), two lines:
//   at the top, with the other imports:      import { ambient } from "./ambient.js";
//   on the line after `const hooks = [];`:    hooks.push(ambient);
// Standalone (ambient-test.html): `const life = addAmbient(scene, camera, manifest, opts)`, then `life.update(t, dt)`
// every frame before controls.update(). Sounds go out as window events, for sound.js:
//   "ambient:sound" {name, who}   an extra's routine or tap sound (at most two a second; routine ones wait for a gap in the voice)
//   "ambient:tap"   {name}        an extra was tapped (the foley "tap:<name>")
// Puppets: cards/puppets/puppets.json is the JSON block of stories/PUPPETS.md ({"puppets": {...}}). Until a puppet's
// entry says "cut": true its parts are stand-in cut shapes; then cards/puppets/<id>/<part>[-eve|-night].png + .json
// ({pivot: [u, v]} where it pins, {at: [u, v]} where it pins on its parent's picture; u, v from the top left) replace them.
import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { markWords } from "../book.js";
import { glow } from "./games.js";
import { extra3d } from "./extras3d.js";

const B = ([x, y, z]) => new THREE.Vector3(x, z, -y);  // Blender (z up) -> three (y up)
const rnd = (a, b) => a + Math.random() * (b - a), jit = s => s * rnd(0.75, 1.25);  // waits jitter ±25%: loops never line up
const clamp01 = k => Math.min(1, Math.max(0, k)), deg = THREE.MathUtils.degToRad;
export const swingRig = (a, b, k) => {  // a camera move from rig a to rig b (pos, look), its view turning at an even rate: lerping the look point instead whips a camera close to a face round
  const u = a.look.clone().sub(a.pos), v = b.look.clone().sub(b.pos), la = u.length(), lb = v.length(), q = new THREE.Quaternion().setFromUnitVectors(u.normalize(), v.normalize()), pos = a.pos.clone().lerp(b.pos, k);
  return { pos, look: u.applyQuaternion(new THREE.Quaternion().slerp(q, k)).multiplyScalar(la + (lb - la) * k).add(pos) };
};
const ease = k => 1 - (1 - clamp01(k)) ** 3;  // gentle ease-out
const smooth = k => (k = clamp01(k), k * k * k * (k * (6 * k - 15) + 10));
const pop = k => (k = clamp01(k), k + Math.sin(k * Math.PI) * 0.18);  // a pop-up rising, as popup.py's bloom
const swing = k => (k < 0.4 ? smooth(k / 0.4) : k < 0.6 ? 1 : smooth((1 - k) / 0.4));  // a move: 40% in, 20% hold, 40% out
const beat = (hz, t) => 0.5 - 0.5 * Math.cos(TAU * hz * t);  // a cycle swings from rest to the move's angle and back (PUPPETS.md), never past rest
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const CARDS = new URL("cards/", import.meta.url);  // light WebP copies of cards/ made by tools/slim_cards.py; re-run it when a card changes
const VER = { evening: "-eve", night: "-night" };
const DEF = { clouds: 3, birds: { count: 2, every: 12, kind: "bird" }, crawlers: [{ card: "ladybug" }],
  motes: { over: "water", count: 40, color: [1, 0.95, 0.8] }, mist: { over: "water", opacity: 0.1 }, fog: 0.25,
  dof: 1.4, shadows: { day: 0.2, evening: 0.1, night: 0 }, shafts: { day: 3, evening: 0, night: 0 }, smoke: [],
  drift: null, water: { ripple: 0.3, flow: 0.012 }, surprises: [], cards: "kapi" };
const PLANT = /reed|grass|fern|flower|tree|bush|lotus|lily|plant|bamboo|palm|crown|canopy|rice|weed|vine|branch/;
const FRAMING = { wide: 2.25, medium: 1.4, close: 0.9 };  // camera distance from the target (DIRECTION.md: lens 45, reading look at z 0.15)
const FOCUS = {  // depth of field as one cheap pass: sharp around the focus line, a 12-tap disc blur growing away from it
  uniforms: { tDiffuse: { value: null }, r: { value: 0.5 }, amount: { value: 0 }, px: { value: new THREE.Vector2() } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float r, amount; uniform vec2 px; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv); float k = amount * smoothstep(0.1, 0.55, abs(vUv.y - r));
      if (k < 0.3) { gl_FragColor = c; return; }
      for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996, d = sqrt((float(i) + 0.5) / 12.0); c += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * d * k * px); }
      gl_FragColor = c / 13.0;
    }` };
// the room around the book, by the spread's light: the wall far beyond (out of focus) and the lamp or sun pool on the desk
const ROOM = { day: { top: "#5b4a3c", low: "#7a6048", foot: "#3a2b20", win: "#fff3d6", glow: "#ffe2a8", dots: "#ffe9c0", pool: [1, 0.9, 0.72], alpha: 0.85 },
  evening: { top: "#2c1d1c", low: "#4a2e20", foot: "#1e130d", win: "#ffb26a", glow: "#ff9a50", dots: "#ffc27a", pool: [1, 0.72, 0.45], alpha: 0.75 },
  night: { top: "#3b4a7a", low: "#33416b", foot: "#2c3a63", win: "#3a5a8c", glow: "#6d8cc8", dots: "#ffb868", pool: [1, 0.78, 0.5], alpha: 0.7 } };

// ---------- paper: card pictures and stand-in cut shapes ----------
const texLoader = new THREE.TextureLoader(), cache = {};
let using = new Set();  // the card pictures asked for by the ambient being built, freed when it goes (see dispose)
const picture = file => (using.add(file), cache[file] ??= new Promise(ok => texLoader.load(new URL(file.replace(/\.png$/, ".webp"), CARDS).href,
  t => (t.colorSpace = THREE.SRGBColorSpace, t.anisotropy = 4, ok(t)), undefined, () => ok(null))));
const json = file => cache[file] ??= fetch(new URL(file, CARDS)).then(r => (r.ok ? r.json() : null)).catch(() => null);
function cutShape(color) {  // a stand-in die-cut: a shaded ellipse with a cream paper rim, until the art lane's card lands
  return cache[color] ??= (() => {
    const c = document.createElement("canvas"), g = c.getContext("2d");
    c.width = c.height = 128;
    g.fillStyle = "#fbf5e6"; g.beginPath(); g.ellipse(64, 64, 63, 63, 0, 0, TAU); g.fill();
    g.fillStyle = color; g.beginPath(); g.ellipse(64, 64, 55, 55, 0, 0, TAU); g.fill();
    const f = g.createLinearGradient(0, 0, 0, 128); f.addColorStop(0, "#fff6"); f.addColorStop(0.5, "#fff0"); f.addColorStop(1, "#0004");
    g.fillStyle = f; g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
}
function card(w, h, map, glow = 0.15, pivot = [0.5, 0.5]) {  // a flat paper card w wide and h tall, pinned at `pivot` (u from the left, v from the bottom)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate((0.5 - pivot[0]) * w, (0.5 - pivot[1]) * h, 0),
    new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95,
      emissive: 0xffffff, emissiveMap: map, emissiveIntensity: glow }));  // light through thin paper: a backlit cut-out never goes black
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sprite(stops) {  // a soft round sprite (motes, smoke)
  return cache[stops] ??= (() => {
    const c = document.createElement("canvas"), g = c.getContext("2d"); c.width = c.height = 64;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); stops.split(" ").forEach((s, i, a) => r.addColorStop(i / (a.length - 1), s));
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
}

function seedFluff() {  // a seed of fluff (assets/toad-king/refs/seed-fluff-ref.png): a brown seed under a fan of white tufts
  return cache.seed ??= (() => {
    const c = document.createElement("canvas"), g = c.getContext("2d"); c.width = c.height = 64; g.lineCap = "round";
    for (const a of [-0.7, -0.35, 0, 0.35, 0.7]) for (const [w, col] of [[8, "#d9cfbf"], [5.5, "#fffdf6"]]) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(32, 40); g.lineTo(32 + 24 * Math.sin(a), 40 - 26 * Math.cos(a)); g.stroke();
    }
    g.fillStyle = "#8a5a2e"; g.beginPath(); g.arc(32, 48, 10, 0, TAU); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
}

// ---------- cloud shadows: every paper material darkens under a soft pattern sliding across the world ----------
const SHADE = { uCloud: { value: null }, uCloudAt: { value: new THREE.Vector3() } };  // offset x, z and strength
function shadeTexture() {
  return SHADE.uCloud.value ??= (() => {
    const c = document.createElement("canvas"), g = c.getContext("2d"); c.width = c.height = 256;
    for (let i = 0; i < 9; i++) {  // soft blobs, drawn wrapped so the tile repeats without a seam
      const x = rnd(0, 256), y = rnd(0, 256), r = rnd(40, 90);
      for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        gr.addColorStop(0, "#fffc"); gr.addColorStop(1, "#fff0"); g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
}
function shadeMaterial(mat) {
  if (!mat.isMeshStandardMaterial || mat.userData.cloudShade || mat.emissive?.getHex()) return;
  mat.userData.cloudShade = true;
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    before?.call(mat, s, r);
    Object.assign(s.uniforms, SHADE);
    s.vertexShader = s.vertexShader.replace("void main() {", "varying vec2 vCloudW;\nvoid main() {")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvCloudW = (modelMatrix * vec4(transformed, 1.0)).xz;");
    s.fragmentShader = s.fragmentShader.replace("void main() {", "uniform sampler2D uCloud; uniform vec3 uCloudAt; varying vec2 vCloudW;\nvoid main() {")
      .replace("#include <dithering_fragment>", "gl_FragColor.rgb *= 1.0 - uCloudAt.z * texture2D(uCloud, vCloudW * 0.42 + uCloudAt.xy).r;\n#include <dithering_fragment>");
  };
  mat.needsUpdate = true;
}

// ---------- paper puppets (stories/PUPPETS.md): a root card with hinged parts, pinned like split-pin toys ----------
// Stand-in layout by part name, in the puppet's size: [w, h, the pin on the parent (fractions of the parent's w and h from
// its centre), the part's centre from its own pin (fractions of its own w and h)]. Puppets face +x.
const LAYOUT = [[/^neck/, 0.12, 0.46, [0.35, 0.25], [0, 0.45]], [/^head/, 0.3, 0.26, [0.4, 0.3], [0.3, 0.2]],
  [/^leg/, 0.07, 0.42, [0.15, -0.4], [0, -0.48]], [/^wing/, 0.55, 0.22, [0, 0.2], [-0.35, 0.1]], [/^tail/, 0.34, 0.14, [-0.48, 0.1], [-0.45, 0]],
  [/^arm/, 0.08, 0.4, [0.25, 0.25], [0, -0.45]], [/^hat/, 0.5, 0.14, [0, 0.5], [0, 0.4]], [/^claw/, 0.26, 0.18, [0.45, 0.1], [0.4, 0.1]],
  [/^(man|spirit|child|sleeper|egret$)/, 0.24, 0.7, [0.1, 0.45], [0, 0.5]], [/./, 0.18, 0.16, [0.3, 0.3], [0.2, 0.2]]];
const hue = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
// owner 2026-11-18: "when night comes, please do not turn people and animal to blue": at night EVERY puppet wears its own day card, dimmed (x0.45 colour, about x0.7 sRGB), never a tinted card. A -night card is not read any more.
const PERSON = /boy|girl|man|aunt|uncle|grand|mother|father|seller|player|carrier|sleeper|poler|outfit|khun-borom|nyeu|villager|tong$|^nok$|monk|\bking\b|queen|child|people|person/;  // the camera frames a person by its face (cameraman)
async function puppet(id, def, stage) {
  const dim = stage === "night"; if (dim) stage = "day";
  const size = def.size || 0.06, parts = def.parts?.length ? def.parts : ["body"], hinges = def.hinges || {};
  const art = def.cut && await Promise.all(parts.map(async n => {  // the art lane's cut parts, this stage's version first
    const f = `puppets/${id}/${n}`, v = VER[stage] && (def.versions || []).includes(stage) ? VER[stage] : "";
    const [tex, j] = await Promise.all([picture(`${f}${v}.png`), json(`${f}.json`)]);
    return tex && { tex, j: j || {} };
  }));
  const root = new THREE.Group(), pins = {}, info = {}, meshes = [], legs = parts.some(n => /^leg/.test(n));
  const px = art?.[0] ? size / art[0].tex.image.height : 0;  // shortcut: every part drawn at one scale on one sheet, so pixels -> world through the root
  const R = /boat|hammock/.test(parts[0]) ? [1, 0.22] : /shell/.test(parts[0]) ? [0.9, 0.42] : [0.75, 0.45];
  parts.forEach((n, i) => {
    const par = i ? (info[hinges[n]?.[0]] ? hinges[n][0] : parts[0]) : null, a = art?.[i], P = par && info[par];
    const L = i ? LAYOUT.find(([re]) => re.test(n)) : null, stub = R[0] > 0.8 && /^leg/.test(n);  // a shell's legs are stubs
    const w = a ? a.tex.image.width * px : (i ? L[1] * (stub ? 2.4 : 1) : R[0]) * size;
    const h = a ? a.tex.image.height * px : (i ? L[2] * (stub ? 0.35 : 1) : R[1]) * size;
    const pivot = a?.j.pivot ? [a.j.pivot[0], 1 - a.j.pivot[1]] : i ? [0.5 - L[4][0], 0.5 - L[4][1]] : [0.5, 0];
    const lr = /-r$|-b$|-back$|2$/.test(n) ? -1 : 1, pin = new THREE.Group();
    const m = card(w, h, a ? a.tex : cutShape(`hsl(${(hue(id) + i * 23) % 360} ${i ? 40 : 34}% ${i ? 62 - 6 * (i % 3) : 56}%)`), 0.15, pivot);
    if (!i) pin.position.y = legs && !a ? 0.42 * size : 0;  // a stand-in wader's body sits on its legs
    else if (a?.j.at && P.a) pin.position.set((a.j.at[0] - P.pivot[0]) * P.w, (1 - a.j.at[1] - P.pivot[1]) * P.h, 0.001 * lr);
    else pin.position.set((0.5 - P.pivot[0] + L[3][0] * (lr < 0 && /^leg|^claw/.test(n) ? -1 : 1)) * P.w, (0.5 - P.pivot[1] + L[3][1]) * P.h, 0.002 * i * lr);
    pin.add(m); (par ? pins[par] : root).add(pin);
    pins[n] = pin; info[n] = { w, h, pivot, a }; meshes.push(m);
  });
  if (!art) root.traverse(o => o.isMesh && stage === "night" && o.material.color.setScalar(0.55));
  if (dim) meshes.forEach(m => (m.material.color.multiplyScalar(0.45), m.material.emissiveIntensity *= 0.45));  // sRGB x0.7, about as dark as the night cards, colour kept
  // a light cue's "stage" (gourd s09 9.5: the sun comes back on a night page) turns the puppet to that time's card, as it would have been built for it
  root.userData.restage = async (to, into = root, warm) => {  // into: a clone of this puppet (the cast's), whose materials a game's glow may have made its own; warm: only fetch the cards
    const dk = to === "night", st = dk ? "day" : to, v = VER[st] && (def.versions || []).includes(st) ? VER[st] : "";
    const n0 = warm || (into.userData.staged = (into.userData.staged ?? 0) + 1);  // the latest cue wins: gourd 4.5 asks night then day 1.3 s later, and a late card landed after the cached one
    const tex = art ? await Promise.all(parts.map(n => picture(`puppets/${id}/${n}${v}.png`))) : [];
    if (warm || n0 !== into.userData.staged) return;
    const own = into === root ? meshes : parts.map(n => into.getObjectByName(n)?.children.find(o => o.isMesh));  // each part's card hangs on the pin named after it (acts.js puppetModel)
    own.forEach((m, i) => { if (!m) return; if (tex[i]) { m.material.map = m.material.emissiveMap = tex[i]; m.material.needsUpdate = true; }
      m.material.color.setScalar(dk ? 0.45 : !art && to === "night" ? 0.55 : 1); m.material.emissiveIntensity = dk ? 0.15 * 0.45 : 0.15; });
  };
  const turned = def.turned && await picture(`puppets/${def.turned}/body${VER[stage] && (def.versions || []).includes(stage) ? VER[stage] : ""}.png`);  // V13: puppets.json "turned": the id of a three-quarter card of the same puppet, drawn instead of the front card while it faces left or right
  return { root, pins, meshes, size, def, first: parts[1], turned };
}
async function cardPuppet(file, size) {  // a single die-cut card standing on its base (a ladybug on the trunk): a puppet with no hinges
  const tex = await picture(file), root = new THREE.Group(), pin = new THREE.Group(), def = { size, parts: ["body"] };
  const m = card(tex ? size * tex.image.width / tex.image.height : size, size, tex || cutShape("#c8281e"), 0.15, [0.5, 0]);
  pin.add(m); root.add(pin);
  return { root, pins: { body: pin }, meshes: [m], size, def };
}
function pose(p, amounts) {  // hinge angles for the moves in `amounts` (move -> 0..1, or -1..1 for a cycle); other hinges rest
  const moves = p.def.moves || {}, hinges = p.def.hinges || {}, a = {}, top = (p.def.parts || ["body"])[0];
  let tilt = 0;
  for (const [mv, k] of Object.entries(amounts)) {
    if (mv === "_breathe") { if (p.first) a[p.first] = (a[p.first] || 0) + 2 * k; continue; }  // the rest pose breathes ±2° on the first hinge
    const [name, only] = mv.split("#");  // "hang#tilt": only that move's whole-puppet tilt
    for (const [h, v] of Object.entries(moves[name] || {})) h === "_tilt" ? (tilt += v * k) : h !== "_lift" && !only && (a[h] = (a[h] || 0) + v * k);
  }
  for (const [n, pin] of Object.entries(p.pins)) {
    const lim = hinges[n];
    pin.rotation.z = n === top ? deg(tilt) : deg(lim ? Math.min(lim[2], Math.max(lim[1], a[n] || 0)) : 0);
  }
}

// ---------- the standing spread, measured (here and by live.js for its reading view) ----------
export const storyPuppet = async (id, stage) => { const def = (await json("puppets/puppets.json"))?.puppets?.[id]; return def ? puppet(id, def, stage) : null; };  // a story character as a paper puppet (Tong, Nok), with the same parts as an extra
export function standing(root) {  // standing cards: the group holding an art mesh whose picture stands up from its base
  const cards = [], up = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh || !/^art-/.test(o.material.name) || o.parent === root || cards.some(c => c.g === o.parent)) return;
    const bb = (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox));
    if (bb.min.y < -0.005 || bb.max.y < 0.05 || up.set(0, 1, 0).transformDirection(o.matrixWorld).y < 0.6) return;
    cards.push({ g: o.parent, mesh: o, box: new THREE.Box3().setFromObject(o), name: `${o.parent.name} ${o.parent.parent?.name} ${o.material.name}` });
  });
  return cards;
}
// A card's picture in its texture, in uv [u0, v0, u1, v1]: glb_paper packs every card into an atlas, so its uvs cover only its own patch; both halves
// of a split fold (one material name, ".001" on the second) together; the atlas's 8 px rim-colour patch at its corner left out. Null without a picture.
// shortcut: a picture packed twice in one atlas reads as the box round both; upgrade if two pieces ever share a card and swap it
export function cardRect(root, mesh) {
  const key = mesh.material.name.replace(/\.\d+$/, ""), img = mesh.material.map?.image, r = [1, 1, 0, 0];
  if (!img?.width) return null;
  const pu = 9 / img.width, pv = 9 / img.height;
  root.traverse(o => { const U = o.isMesh && o.material?.name?.replace(/\.\d+$/, "") === key && o.geometry.attributes.uv; if (U) for (let i = 0; i < U.count; i++) { const u = U.getX(i), v = U.getY(i); if (u >= pu || v >= pv) r[0] = Math.min(r[0], u), r[1] = Math.min(r[1], v), r[2] = Math.max(r[2], u), r[3] = Math.max(r[3], v); } });
  return r[2] > r[0] && r[3] > r[1] ? r : null;
}
const pageOf = root => {
  const page = new THREE.Box3();
  ["page-right", "leaf-page"].forEach(n => { const o = root.getObjectByName(n); if (o) page.expandByObject(o); });
  return page.isEmpty() ? page.setFromObject(root) : page;
};
// the built backdrop: {top, z, walls, x0, x1, floor}, null without one. Its cards are the nodes spread.json names ("backdrop"),
// else the farthest of the cards rising 0.3 above the page in its back 30% (a strip of village standing in front is not the
// backdrop). top is its skyline, the column tops across its middle 80%, the low 30% of them: the line no frame shows room above
export function skyline(root, cards = standing(root), names = null) {
  const page = pageOf(root), D = page.max.z - page.min.z, up = new THREE.Vector3();
  let walls;
  if (names?.length) {  // exactly the named nodes' pictures
    walls = [];
    names.map(n => root.getObjectByName(n)).filter(Boolean).forEach(n => n.traverse(o => {
      if (o.isMesh && /^art-/.test(o.material.name) && !walls.some(c => c.mesh === o)) { o.updateWorldMatrix(true, false); walls.push({ g: o.parent, mesh: o, box: new THREE.Box3().setFromObject(o) }); }
    }));
  } else {
    const back = cards.filter(c => c.box.max.y - page.max.y > 0.3 && c.box.min.z < page.min.z + 0.3 * D), far = Math.min(...back.map(c => c.box.min.z));
    walls = back.filter(c => c.box.min.z < far + 0.06);
    for (const c of [...walls]) c.g.children.forEach(o => { if (o !== c.mesh && o.isMesh && /^art-/.test(o.material.name) && !walls.some(w => w.mesh === o) && up.set(0, 1, 0).transformDirection(o.matrixWorld).y > 0.6) walls.push({ g: c.g, mesh: o, box: new THREE.Box3().setFromObject(o) }); });  // a split fold's other half (standing() keeps one card a group): the skyline and the ends are the whole backdrop's, not half
  }
  if (!walls.length) return null;
  const cols = new Array(40).fill(-Infinity), x0 = Math.min(...walls.map(c => c.box.min.x)), x1 = Math.max(...walls.map(c => c.box.max.x)), v = new THREE.Vector3(), w = new THREE.Vector3();
  const mark = (a, b) => { const n = Math.max(1, Math.ceil(Math.abs(b.x - a.x) / (x1 - x0) * 80)); for (let i = 0; i <= n; i++) { const j = Math.floor((a.x + (b.x - a.x) * i / n - x0) / (x1 - x0) * 40); if (j >= 4 && j < 36) cols[j] = Math.max(cols[j], a.y + (b.y - a.y) * i / n); } };  // along the edge, not at its ends: a card's outline has a vertex every few centimetres, so a column between two had no top (the lower card behind it set the skyline: the land card, 0.46 under a 0.80 sky)
  for (const c of walls) { const g = c.mesh.geometry, pa = g.attributes.position, ix = g.index; c.mesh.updateWorldMatrix(true, false);
    const P = Array.from({ length: pa.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(c.mesh.matrixWorld));
    for (let i = 0, n = ix ? ix.count : pa.count; i + 2 < n; i += 3) { const a = P[ix ? ix.getX(i) : i], b = P[ix ? ix.getX(i + 1) : i + 1], d = P[ix ? ix.getX(i + 2) : i + 2]; mark(a, b); mark(b, d); mark(d, a); } }
  const tops = cols.filter(isFinite).sort((a, b) => a - b);
  return { top: tops[Math.floor(tops.length * 0.3)] ?? Math.max(...walls.map(c => c.box.max.y)), z: walls.reduce((a, c) => a + c.box.getCenter(v).z, 0) / walls.length, walls,
    x0, x1, floor: page.max.y, px0: page.min.x, px1: page.max.x, pz1: page.max.z };  // its ends, and the page it stands on (its sides and its near edge)
}
// How far a camera's frame shows the room past the backdrop: above its skyline or beyond its ends, measured at its depth over
// the page (metres; 0 = none). Every shot is held to 0, and the viewer can hold its reading view to it: roomShown(cam, sp.sky).
const BORDER = [[-1, 1], [-0.5, 1], [0, 1], [0.5, 1], [1, 1], ...[0.6, 0.2, -0.2, -0.6, -1].flatMap(y => [[-1, y], [1, y]])];
function room(camera, sky) {  // the frame's border against the backdrop: {top, side}, signed (negative: that much to spare)
  const eye = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld), d = new THREE.Vector3(), r = { top: -Infinity, side: -Infinity };
  for (const [x, y] of BORDER) {
    d.set(x, y, 0.5).unproject(camera).sub(eye);
    if (d.z > -1e-6) continue;  // a ray tipped toward the reader (a phone's steep bottom edge) lands on the book or desk, never past the backdrop
    const k = (sky.z - eye.z) / d.z, px = eye.x + d.x * k, py = eye.y + d.y * k;
    if (py <= sky.floor) continue;  // below the page: the book and the desk in front of it, not the room
    r.top = Math.max(r.top, py - sky.top); r.side = Math.max(r.side, sky.x0 - px, px - sky.x1);
  }
  return r;
}
export function roomShown(camera, sky) { if (!sky) return 0; camera.updateMatrixWorld(); const r = room(camera, sky); return Math.max(0, r.top, r.side); }

// ---------- the adapter for live.js's hooks: one ambient per spread, made on the spread's first frame ----------
let SAYS = {};  // line id -> who says each word, read once from the book's story.json
fetch(`../${new URLSearchParams(location.search).get("book") || "kapi"}/story.json`).then(r => r.json()).then(j => (SAYS = Object.fromEntries([...j.spreads.flatMap(p => p.lines), ...(j.moral ?? [])].map(l => [l.id, l.say.flatMap(([who, x]) => x.split(" ").map(() => who))])))).catch(() => {});
const game = sp => sp.play || sp.game;  // the spread's game (games.js; older viewers: Collect)
let current = null, pending = null;
export const ambient = {
  get life() { return current; },  // this spread's ambient, for tests
  spread(sp, scene, cam) { current?.dispose(); current = null; pending = [sp, scene, cam]; },
  frame(dt, now) {
    const L = window.live;
    if (pending && L) {  // window.live exists from the first frame on, so the viewer's own objects are reached through it
      const [sp, scene, cam] = pending; pending = null;
      const r = L.reader, lines = () => sp.page?.lines || [], gate = () => (sp.G?.before ? lines().indexOf(sp.G.before) : lines().length);  // the game comes before its line, or after the last
      current = addAmbient(scene, cam, sp.m, { root: sp.root, parent: sp.group, lights: sp.stage, controls: L.controls, composer: L.composer, cast: sp.cast,
        backdrop: sp.sky, frame: () => L.frame,  // the viewer's measure as the spread loaded (standing); the named backdrop is measured again at build
        mode: () => L.mode, home: () => L.home, readHome: () => L.readHome?.(), halt: () => L.halt?.(), titled: () => L.titled,  // titled: before the first pull the viewer's title view stands (no story shot)  // the viewer's reading view (phone framing included), kept current on resize; halt stops its glide home
        story: () => ({ line: r?.id ?? null, t: !r || r.audio.ended ? Infinity : r.audio.currentTime, speaking: !!r && !r.audio.paused,
          // "next": the line before the game has been read (the pause before its prompt); "wait": its prompt and play; a read again starts over; a game Auto or Reading Mode skips is none until settled, then "won"
          game: game(sp) && (game(sp).targets?.length ?? sp.targets?.length) && !(L.skipGames && !game(sp).complete) ? (game(sp).complete ? "won" : sp.at >= gate() ? "wait" : sp.at === gate() - 1 && r?.audio.ended ? "next" : null) : null,
          end: sp.at >= lines().length, at: sp.at }),
        info: id => { const T = r?.timing[id], ls = lines(); return T && { dur: T.duration, words: T.words, say: SAYS[id], prev: ls[ls.indexOf(id) - 1] }; },  // a line's timing and who says each word (stories/<book>/story.json)
        wordAt: (line, word) => { const i = r ? markWords(r.text[line] || "", word).indexOf(true) : -1; return i < 0 ? 0 : r.timing[line].words[i][0]; } });
    }
    current?.update(now / 1000, dt);
  },
};

/**
 * The ambient life of one spread. opts (all optional): root (the spread's scene), parent (where its pieces go), controls
 * (OrbitControls: the camera moves only with it), composer (gets the focus passes), mode() (the viewer's "closed" | "turn" |
 * "open" …; without it the spread counts as open), story() → {line, t (seconds into the line's voice), speaking, game:
 * null | "wait" | "won", end}, wordAt(line, word) → seconds, cast ([{name, body, height}]), canvas (taps; default
 * controls.domElement), puppets ({id: def}; default cards/puppets/puppets.json). Returns { update(t, dt), dispose() }.
 */
export function addAmbient(scene, cam, m, opts = {}) {
  const A = { ...DEF, ...m.ambient }, root = opts.root || scene, parent = opts.parent || scene, group = new THREE.Group();
  const stage = m.stage?.name || "day", per = v => (typeof v === "object" && v ? v[stage] ?? 0 : v);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const controls = opts.controls, canvas = opts.canvas || controls?.domElement, cast = opts.cast || [];
  const isOpen = () => !opts.mode || opts.mode() === "open";
  const SCAM = (m.camera?.story === true || new URLSearchParams(location.search).get("story") === "1") && !!controls && !calm;  // the story camera: the page's camera.story, or ?story=1
  const SH = m.shots || {}, W = m.wind || {}, LI = m.light || {};
  let HOME, LOOK;  // the reading view the shots offset from: the viewer's (window.live.home), else the manifest camera
  const reHome = () => { const h = opts.home?.(); HOME = h ? h.pos.clone() : B(m.camera.at); LOOK = h ? h.look.clone() : B(m.camera.look); };
  reHome();
  const ticks = [], disposers = [], tmp = new THREE.Vector3(), pups = [], story = { line: null, t: 0, game: null, end: false }, used = using = new Set();
  let wind = 0.3, built = false, now = 0, flockAt = null, clock = null;
  parent.add(group);

  // ---------- names: a character, an extra, the flock, a piece of the spread (its top centre), or a point ----------
  const find = name => {  // exact, then a sided or numbered copy ("grass-near" → "grass-near-l"), then the card picture's name
    const exact = root.getObjectByName(name); if (exact) return [exact];
    const e = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), re = new RegExp(`^${e}([-_.]?(l|r|\\d+))?$`), art = new RegExp(`^art-[^/]*/${e}(\\.\\d+)?$`), out = [];
    root.traverse(o => (re.test(o.name) || (o.isMesh && art.test(o.material.name))) && out.push(o));
    return out;
  };
  const edgesOf = objs => { const E = []; objs.forEach(o => { o.updateWorldMatrix(true, true); o.traverse(m => { if (!m.isMesh || !m.geometry.attributes.position) return; const p = m.geometry.attributes.position, ix = m.geometry.index, n = ix ? ix.count : p.count;
    for (let i = 0; i + 2 < n; i += 3) { const t = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + k) : i + k).applyMatrix4(m.matrixWorld)); E.push([t[0], t[1]], [t[1], t[2]], [t[2], t[0]]); } }); }); return E; };  // the world edges of a piece's cut-out mesh
  const topAt = (E, X) => { let y = null; for (const [a, b] of E) if ((a.x - X) * (b.x - X) <= 0 && a.x !== b.x) { const v = a.y + (b.y - a.y) * (X - a.x) / (b.x - a.x); if (y === null || v > y) y = v; } return y; };  // the highest edge over x: the piece's top edge there (a log's curved back, not its highest point)
  const frame = (to, real) => {  // what a name, a list of names or a point covers: centre, top and radius; real: characters by their whole body
    if (to == null) return null;
    if (Array.isArray(to) && typeof to[0] !== "number") {
      const b = new THREE.Box3(); to.map(n => frame(n, real)).filter(Boolean).forEach(f => f.box ? b.union(f.box) : b.expandByPoint(f.top).expandByPoint(f.c.clone().multiplyScalar(2).sub(f.top)));
      if (b.isEmpty()) return null;
      const c = b.getCenter(new THREE.Vector3());
      return { c, top: new THREE.Vector3(c.x, b.max.y, c.z), r: b.getSize(tmp).length() / 2 };
    }
    if (Array.isArray(to)) { const p = B(to); return { c: p, top: p.clone(), r: 0.04 }; }
    const ch = cast.find(c => c.name === to), x = pups.find(p => p.e.name === to);
    if (ch && real) { const box = new THREE.Box3().setFromObject(ch.model || ch.body), c = box.getCenter(new THREE.Vector3()); return { c, top: new THREE.Vector3(c.x, box.max.y, c.z), r: box.getSize(new THREE.Vector3()).length() / 2, box }; }
    if (ch) { const h = ch.height ?? ch.c?.height ?? 0.15, f = ch.body.position; return { c: f.clone().addScaledVector(UP, h / 2), top: f.clone().addScaledVector(UP, h), r: h / 2 }; }
    if (x) { const f = x.p.root.position; return { c: f.clone().addScaledVector(UP, x.p.size / 2), top: f.clone().addScaledVector(UP, x.p.size), r: x.p.size / 2 }; }
    if (to === "flock") return flockAt && { c: flockAt.clone(), top: flockAt.clone(), r: 0.15 };
    const os = find(to); if (!os.length) return null;
    const b = new THREE.Box3(); os.forEach(o => b.expandByObject(o));
    const c = b.getCenter(new THREE.Vector3());
    return { c, top: new THREE.Vector3(c.x, b.max.y, c.z), r: b.getSize(tmp).length() / 2 };
  };
  const spot = to => (Array.isArray(to) && typeof to[0] === "number" ? B(to) : frame(to)?.top.clone() ?? null);  // where a puppet stands or perches

  // ---------- the story clock: moments ([line, word], "game", "game:won", "end") fire once per listener each time ----------
  const fired = new Set();
  const storyTick = () => {
    const s = opts.story?.() || {};
    if (s.line !== story.line || s.t < story.t - 0.3) for (const k of fired) if (k.startsWith(`${s.line}|`)) fired.delete(k);  // a line (again)
    if (!s.game) for (const k of fired) if (k.startsWith("game")) fired.delete(k);
    if (!s.end) for (const k of fired) if (k.startsWith("end|")) fired.delete(k);
    if (s.at != null && story.at != null && s.at < story.at) {  // "Read again": every moment fires again, and the lights return to the stage first
      fired.clear();
      for (const [o, w] of tweens) tweens.set(o, { from: lightNow(o) ?? w.to, to: base.get(o), t0: now, secs: 0.6 });
    }
    Object.assign(story, s);
  };
  const reached = (line, word) => line === "game" ? story.game === "wait" || story.game === "next" : line === "game:won" ? story.game === "won"
    : line === "end" ? story.end && story.game !== "wait" && story.game !== "next"  // a game after the last line holds its own shot; the end comes once it is won,
      && !(run?.s && now - run.t0 < Math.max(run.secs + 1, run.s.seconds ?? 3))  // and once the last line's own shot has landed and held a second (a face close-up on the last word is seen before the end pulls away)
    : story.line === line && (story.speaking || story.t === Infinity) && story.t >= (word ? opts.wordAt?.(line, word) ?? 0 : 0);
  const when = (line, word = "", who = "") => { const k = `${line}|${word}|${who}`; if (fired.has(k) || !reached(line, word)) return false; fired.add(k); return true; };

  // ---------- fog: gentle depth haze in the room colour, starting just behind what the camera looks at ----------
  const fogOn = A.fog > 0, bg = scene.background?.isColor ? scene.background : new THREE.Color(0.05, 0.06, 0.1);
  if (fogOn) scene.fog = new THREE.Fog(bg.clone(), 2, 6);  // the room colour: the desk and far paper fade with no horizon line

  // ---------- the surroundings: a reading nook, never a void (the bands beside the book are part of every shot) ----------
  const RM = ROOM[stage] || ROOM.day;
  if (A.room !== false) {
    const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), floor = box.min.y - 0.002;
    const paint = (w, h, f) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; f(cv.getContext("2d"), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
    // the wall far beyond, out of focus: a window glowing with the time of day and soft lamp bokeh, all blurred
    const wall = paint(2048, 512, (g, w, h) => {
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, RM.top); v.addColorStop(0.7, RM.low); v.addColorStop(0.86, RM.foot); v.addColorStop(1, RM.foot);
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      g.filter = "blur(26px)";
      for (const x of [0.5, 0.66]) {  // two windows: one behind the book, one behind to the left
        g.globalAlpha = 0.25; g.fillStyle = RM.glow; g.fillRect(w * x - 110, h * 0.08, 220, h * 0.68);
        g.globalAlpha = 0.55; g.fillStyle = RM.win; g.fillRect(w * x - 60, h * 0.16, 120, h * 0.5);
      }
      g.filter = "blur(10px)";
      for (let i = 0; i < 26; i++) { g.globalAlpha = rnd(0.08, 0.3); g.fillStyle = RM.dots; g.beginPath(); g.arc(rnd(0, w), rnd(h * 0.2, h * 0.8), rnd(8, 30), 0, TAU); g.fill(); }
    });
    wall.wrapS = THREE.RepeatWrapping;
    const room = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 5, 64, 1, true).translate(0, 2.5, 0),
      new THREE.MeshBasicMaterial({ map: wall, side: THREE.BackSide, fog: false }));
    room.position.set(c.x, floor - 0.5, c.z);  // u 0.5 of the wall is behind the book
    // the desk: walnut grain on the viewer's desk, a pool of warm light around the book, and a soft contact shadow under it
    const desk = scene.children.filter(o => o.isMesh && o.geometry?.parameters?.width >= 4 && new THREE.Box3().setFromObject(o).max.y <= box.min.y + 0.01)
      .sort((a, b) => b.geometry.parameters.width - a.geometry.parameters.width)[0];
    if (desk && !desk.material.map) {
      const grain = paint(512, 512, (g, w, h) => {
        g.fillStyle = "#c9b8a6"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 140; i++) { const y = rnd(0, h), a = rnd(0.03, 0.1); g.strokeStyle = `rgba(${Math.random() < 0.5 ? "60,30,15" : "255,235,210"},${a})`; g.lineWidth = rnd(1, 4);
          g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + 6 * Math.sin(x / 90 + i) + 3 * Math.sin(x / 23 + i * 2)); g.stroke(); }
      });
      grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(5, 5); grain.anisotropy = 8;
      desk.material.map = grain; desk.material.color.multiplyScalar(1.6); desk.material.needsUpdate = true;
      disposers.push(() => { desk.material.map = null; desk.material.color.multiplyScalar(1 / 1.6); desk.material.needsUpdate = true; grain.dispose(); });
    }
    const size = box.getSize(new THREE.Vector3()), radial = stops => paint(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([k, col]) => r.addColorStop(k, col)); g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 2.6, size.x * 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: radial([[0, "#fff"], [0.45, "#fff6"], [1, "#fff0"]]), color: new THREE.Color(...RM.pool).multiplyScalar(0.16), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    const soft = paint(256, 256, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.filter = "blur(18px)"; g.fillStyle = "#fff"; g.fillRect(40, 40, w - 80, h - 80); });
    soft.colorSpace = THREE.NoColorSpace;
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.12, size.z * 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      alphaMap: soft, color: 0x000000, transparent: true, opacity: RM.alpha * 0.55, depthWrite: false }));  // the book's soft contact shadow
    pool.position.set(c.x, floor + 0.0006, c.z + 0.1); contact.position.set(c.x, floor + 0.001, c.z);
    const fade = new THREE.Mesh(new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({  // the desk darkens into the wall's foot
      color: RM.foot, alphaMap: Object.assign(paint(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        r.addColorStop(0, "#000"); r.addColorStop(0.45, "#000"); r.addColorStop(0.97, "#fff"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = r; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, TAU); g.fill(); }),
      { colorSpace: THREE.NoColorSpace }), transparent: true, depthWrite: false, fog: false }));
    fade.position.set(c.x, floor + 0.0004, c.z);
    const nook = new THREE.Group(); nook.name = "nook"; nook.add(room, fade, pool, contact); scene.add(nook); { const d0 = desk?.position.y; desk && ticks.push(() => (nook.position.y = desk.position.y - d0)); }  // in the scene, not the spread: it stays through exit turns; it rides the desk, which drops to the leather book's bottom after the spread: left at the spread's own floor its pool and shadow lay across the book's gilt edge (a lighter gold below that line)
    disposers.push(() => { nook.removeFromParent(); nook.traverse(o => o.isMesh && (o.geometry.dispose(), o.material.map?.dispose(), o.material.alphaMap?.dispose(), o.material.dispose())); });
    if (fogOn) scene.fog.color.set(RM.foot);  // far paper and desk fade into the wall's foot, no horizon line
  }

  // ---------- cloud shadows: patch the spread's paper (and the characters) once ----------
  const shade = per(A.shadows);
  if (shade > 0) { shadeTexture(); root.traverse(o => o.isMesh && shadeMaterial(o.material)); cast.forEach(c => c.body.traverse(o => o.isMesh && shadeMaterial(o.material))); }
  SHADE.uCloudAt.value.z = 0;

  // ---------- focus: a tilt-shift whose sharp line follows the subject ----------
  const passes = [], focus = { r: 0.5, goal: null };
  if (opts.composer && A.dof > 0) {
    passes.push(new ShaderPass(FOCUS));
    opts.composer.insertPass(passes[0], opts.composer.passes.length - 1);  // before the output pass
  }

  // ---------- the camera: the opening shot, a shot per line (DIRECTION.md "shots"), breathing; the reader's hands win ----------
  let faceLim = null, near = Infinity;  // the reader's orbit limits while a face shot (or a near shot of a small subject) runs; near: that shot's own nearest distance
  const nearShot = s => {  // a close or medium shot comes as near as its subject needs to stand 12 percent of the screen's height (never under 0.05 m), not only to 0.6 m and the reader's orbit floor: the Toad King's 6 cm hero; Kapi and Mali need more than 0.6 m for that, so theirs is unchanged
    if (s?.framing !== "close" && s?.framing !== "medium") return 0.6;
    const h = Math.max(0, ...cast.filter(c => c.body.visible && [s.target].flat().includes(c.name)).map(c => c.height || 0));
    return h ? Math.min(0.6, Math.max(0.05, h / (0.12 * 2 * Math.tan(deg(cam.fov) / 2)))) : 0.6;
  };
  const probe = cam.clone(), lim = controls || {}, lims = () => faceLim ?? lim;  // lims: the reader's own limits, also while a face shot has the orbit's let out
  const SC = { mem: {}, key: null, beat: null, since: 0, sign: null, half: null, c: null, v: null, out: -9, goal: null, endSince: -1 };
  let low = false, flo = null;  // flo: a tall close's own camera floor (fit)  // a story beat: seen from at most 25° above its subjects, below the reader's own polar limit (lifted for it as for a face shot)
  const fit = (pos, look) => {  // inside the reader's orbit limits and the director's: above z 0.3, at most 25° off the reading axis
    const s = new THREE.Spherical().setFromVector3(tmp.copy(pos).sub(look)), e = 0.02, a0 = Math.atan2(HOME.x - LOOK.x, HOME.z - LOOK.z);  // margins wider than the breathing drift
    s.radius = Math.min(Math.max(s.radius, Math.min((lims().minDistance ?? 0) + 0.03, near)), (lim.maxDistance ?? Infinity) - 0.03);  // near: a close or medium shot of a small subject (nearShot)
    s.phi = Math.min(Math.max(s.phi, (lim.minPolarAngle ?? 0) + e), Math.max(lims().maxPolarAngle ?? Math.PI, low ? deg(82) : 0) - e);
    s.theta = Math.min(Math.max(s.theta, Math.max(lim.minAzimuthAngle ?? -Infinity, a0 - deg(25)) + e), Math.min(lim.maxAzimuthAngle ?? Infinity, a0 + deg(25)) - e);
    pos.setFromSpherical(s).add(look);
    const fl = low ? flo ?? 0.18 : 0.3; if (pos.y < fl) { pos.y = fl; if (look.y > fl - 0.01) look.y = fl - 0.01; }  // a story beat may stand lower (0.18): at 0.3 a phone's close shot of a swimmer looked down at him from 28-41 degrees
    return { pos, look };
  };
  const boneOf = (c, n) => { if (!c?.model) return null; const k = c.boneAt ??= {}; if (!k[n]) c.model.traverse(o => { if (!k[n] && o.name === n && o.matrixWorld.determinant()) k[n] = o; }); return k[n] ?? null; };  // the drawn skeleton's bone, never a spare mood head's (stored at scale 0, its bones gave toad s02's face shot a zero height: the camera on its look point, NaN)
  const faceRig = s => {  // "face": her head and shoulders from in front of her face, the camera level with her chin looking up a little, near enough
    const c = subjects(s)[0], head = boneOf(c, "head");  // that her face stands 100 px tall (75 on an upright phone); no fit, room or keep pushes it out
    if (!c) return null;  // nobody to frame yet (toad-king s09 9.1: the turn's first beat names skyking before he is shown)
    if (!head) {  // a paper puppet has no skeleton: its face is the top of its card (a person's head, ~25% of the card; an animal's whole card)
      const box = new THREE.Box3().setFromObject(c?.model || c?.body); if (!box || box.isEmpty()) return null;
      const person = PERSON.test((c.c?.model || c.name || "").split(":").pop() || c.name || ""), H = box.max.y - box.min.y, faceH = person ? 0.25 * H : H, mid = box.max.y - faceH / 2;
      const d = Math.max(faceH, box.max.x - box.min.x) * innerHeight / (2 * Math.tan(deg(cam.fov) / 2) * (phone() ? 80 : 100) * (s.size ?? 1));
      const chin = new THREE.Vector3((box.min.x + box.max.x) / 2, mid, (box.min.z + box.max.z) / 2);
      const axis = HOME.clone().sub(LOOK).setY(0).normalize(), her = new THREE.Vector3(Math.sin(c.yaw ?? 0), 0, Math.cos(c.yaw ?? 0)), a = Math.atan2(axis.x, axis.z), b = Math.atan2(her.x, her.z);
      const yaw = a + Math.max(-deg(30), Math.min(deg(30), Math.atan2(Math.sin(b - a), Math.cos(b - a))));
      return { pos: chin.clone().add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(d)), look: chin, face: true };
    }
    // her head as built, chin to crown: 0.24 of her height gave Mali's head 59 px on a phone, not 80
    const crown = boneOf(c, "HeadTop_End")?.getWorldPosition(new THREE.Vector3()), faceH = crown ? crown.y - head.getWorldPosition(new THREE.Vector3()).y : 0.24 * c.height, d = faceH * innerHeight / (2 * Math.tan(deg(cam.fov) / 2) * (phone() ? 80 : 100) * (s.size ?? 1)), chin = head.getWorldPosition(new THREE.Vector3());
    const axis = HOME.clone().sub(LOOK).setY(0).normalize(), her = new THREE.Vector3(Math.sin(c.yaw ?? 0), 0, Math.cos(c.yaw ?? 0)), a = Math.atan2(axis.x, axis.z), b = Math.atan2(her.x, her.z);
    const yaw = a + Math.max(-deg(30), Math.min(deg(30), Math.atan2(Math.sin(b - a), Math.cos(b - a))));  // toward her face, at most 30° off the reading axis
    return { pos: chin.clone().add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(d)), look: chin.clone().setY(chin.y + faceH / 2), face: true };
  };
  const faceKept = (r, s, k) => {  // a face shot's view is never further off her face than the swing in began, closing to a cone that keeps her face whole under the
    const c = subjects(s)[0], head = boneOf(c, "head"); if (!head) return r;  // read-along page: a long swing could pass her by, a wave dip her chin off the screen
    const d = r.look.clone().sub(r.pos), u = head.getWorldPosition(new THREE.Vector3()).addScaledVector(UP, 0.1 * c.height).sub(r.pos), a = d.angleTo(u);  // to her face's middle (the head bone is at her chin)
    run.a0 ??= a;
    const lim = Math.max((1 - smooth(k)) * run.a0, 0.3 * deg(cam.fov) / 2);
    return a <= lim ? r : { pos: r.pos, look: d.applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(d.clone().normalize(), u.normalize()), 1 - lim / a)).add(r.pos) };
  };
  const rigOf = s => { const was = near, nr = nearShot(s); try { const r = rig(s); if (r && nr < 0.6 && !r.face) r.near = nr; return r; } finally { near = was; } };  // near reaches fit() only inside this shot's own rig
  const rig = s => {  // a shot's camera: its distance along the reading axis swung by yaw, the target's top no higher than 60% up
    if (!s || s === "reading" || s.target == null) { const h = { pos: HOME.clone(), look: LOOK.clone() }; if (!s?.room) return h; const f = fitIn(h); return whole(f, cast.filter(c => c.body.visible && (!s.keep || s.keep.includes(c.name)))) ? f : h; }  // exactly the viewer's own framing, so Reset never jumps (a closing shot off the phone: that view with no room past the backdrop)
    if (s.framing === "face") return faceRig(s);
    const f = frame(s.target, true); if (!f) return null;  // whole bodies (a crocodile is long)
    const half = Math.min(deg(cam.fov) / 2, Math.atan(Math.tan(deg(cam.fov) / 2) * cam.aspect));  // the narrower half-angle: a phone's width
    const allow = phone() ? (s.move === "push" ? 1 / 0.85 : 1) : 1, rr = f.r + (phone() && s.move === "drift" ? 0.04 : 0);  // a phone's subjects stay whole as the move ends: a push ends 15% closer, a drift slides 0.04
    const nr = nearShot(s), dist = Math.max(nr, (FRAMING[s.framing] ?? FRAMING.medium) * (phone() ? Math.tan(deg(15)) / Math.tan(deg(cam.fov) / 2) : 1), rr / Math.tan(half) * (phone() ? 1.3 : 1.15) * allow);
    if (phone() && Array.isArray(s.target) && !s.lean && dist > 0.7) {  // a phone is too narrow for a river's width of stones and a turtle: past 0.7 m it frames the focus (else the characters), as the shots of one character do
      const cs = [s.focus, ...s.target].filter(n => cast.some(c => c.name === n && c.body.visible)), one = cs.length ? (cast.some(c => c.name === s.focus && c.body.visible) ? [s.focus] : [...new Set(cs)]) : null;
      const r = one && rigOf({ ...s, target: one.length === 1 ? one[0] : one, lean: true }); if (r) return { ...r, lean: one.length === 1 ? one[0] : one };
    }
    const dir = HOME.clone().sub(LOOK).normalize().applyAxisAngle(UP, deg(Math.max(-25, Math.min(25, s.yaw || 0))));
    if (s.pitch) dir.applyAxisAngle(tmp.set(dir.z, 0, -dir.x).normalize(), -deg(Math.max(0, Math.min(40, s.pitch))));  // pitch: the camera raised over its look point by this many degrees (0 to 40), seen from higher; still inside the room fit, the orbit's limits and the text panel's rule below
    near = nr < 0.6 ? nr : Infinity; const r = fit(f.c.clone().addScaledVector(dir, dist), f.c.clone());
    for (let i = 0; i < 12; i++) {  // the read-along page covers the top quarter: lift the view until the target's top sits below 60%
      probe.position.copy(r.pos); probe.lookAt(r.look); probe.updateMatrixWorld();
      if (tmp.copy(f.top).project(probe).y <= 0.2) break;
      r.look.y += 0.03; r.pos.y += 0.03;
    }
    const k = s.move === "push" ? 0.85 : s.move === "pull" && phone() ? 1.15 : 1, end = (x, f = k) => ({ pos: x.pos.clone().sub(x.look).multiplyScalar(f).add(x.look), look: x.look.clone() });  // where the move ends
    const fitted = top => (k > 1 ? end(fitIn(end(r), top), 1 / k) : fitIn(r, top)), q = fitted(true), who = subjects(s);  // a phone's pull is fitted where it ends, widest (a phone fits its shots once, here)
    if (!who.length) return q;
    const ok = [q, ...(phone() ? [fitted(false), r] : [])].find(x => whole(end(x), who));  // the room fit may not cut a subject: then less of it (a phone: only across), else the shot's own framing
    const room = !phone() && bd && s.yaw ? roomOf(q) : null;  // off the phone no shot shows the room: the view turns less toward the side instead (Kapi 2.1 and 2.3 showed it at yaw 15 and 25)
    return (!ok || (room && Math.max(room.top, room.side) > 0.01)) && !phone() && Math.abs(s.yaw || 0) > 2 ? rigOf({ ...s, yaw: s.yaw / 2 }) : ok ?? q;
  };
  const phone = () => cam.aspect < 1, pg = pageOf(root);  // an upright phone: closer in, as the viewer's own phone view; no room above where its subjects allow it, then no desk below
  const aim = r => { probe.copy(cam); probe.position.copy(r.pos); probe.lookAt(r.look); probe.updateMatrixWorld(); return probe; };
  const deskOver = r => {  // how far past the page's near edge the tall frame's bottom edge lands, on the desk (below 0: on the page); exact, so it never steps
    const d = tmp.set(0, -1, 0.5).unproject(aim(r)).sub(r.pos).normalize();
    return d.y < -0.05 ? r.pos.z + d.z * (pg.max.y - r.pos.y) / d.y - pg.max.z + 0.012 : -1;  // 0.012: room for the breathing
  };
  const deskGap = r => Math.min(0.8, Math.max(0, deskOver(r)));  // how far it must slide back into the book (along -z, the reading axis) to land on the page
  const corner = new THREE.Box3(), whole = (r, who) => {  // are the subjects' bodies inside the frame from r (2% margin)?
    aim(r);
    for (const c of who) { corner.setFromObject(c.model || c.body);
      for (const x of [corner.min.x, corner.max.x]) for (const y of [corner.min.y, corner.max.y]) for (const z of [corner.min.z, corner.max.z]) if (Math.abs(tmp.set(x, y, z).project(probe).x) > 0.98) return false; }
    return true;
  };
  const subjects = s => { const ns = [s?.target].flat(), out = cast.filter(c => c.body.visible && ns.includes(c.name)); for (const n of ns) if (n && !out.some(c => c.name === n)) { const x = pups.find(p => p.e.name === n); if (x?.p?.root?.visible) out.push({ name: n, body: x.p.root, height: x.p.size, model: null }); } return out; };  // an extra named in the target is a subject too (it has a root to box, a size and a position, but no model)
  const corners = who => {  // the corners of each body's box in the camera space of the last aim(): [x, y, depth], only those in front
    const P = [];
    for (const c of who) { corner.setFromObject(c.model || c.body);
      for (const x of [corner.min.x, corner.max.x]) for (const y of [corner.min.y, corner.max.y]) for (const z of [corner.min.z, corner.max.z]) {
        const v = tmp.set(x, y, z).applyMatrix4(probe.matrixWorldInverse); if (v.z < -0.05) P.push([v.x, v.y, -v.z]); } }
    return P;
  };
  const halves = () => [Math.tan(deg(cam.fov) / 2) * cam.aspect, Math.tan(deg(cam.fov) / 2)];
  const need = (r, who, others, desk = 0) => {  // the least move (across, up, back along the view) that frames every corner of `who` from r under the read-along page,
    aim(r); const P = corners(who), [tx, ty] = halves();  // and the slide across that leaves no one else half in frame; closed form, so it never steps
    const lo = (i, a, b) => Math.max(...P.map(p => p[i] - a * (p[2] + b))), hi = (i, a, b) => Math.min(...P.map(p => p[i] + a * (p[2] + b)));
    const axes = [[0, 0.94 * tx, 0.94 * tx], [1, (P.length ? Math.min(0.6, safeNow().yt) : 0.6) * ty, 0.94 * ty]];  // x: 3% in from each side; y: the top below 60% and under the read-along words as drawn (R28: on desktop they reach 74%), the bottom 3% in
    const back = P.length ? Math.min(0.6, Math.max(0, ...axes.map(([i, a, b]) => (lo(i, a, 0) - hi(i, b, 0)) / (a + b)))) : 0;
    const [lx, hx] = P.length ? [lo(0, axes[0][1], back), hi(0, axes[0][2], back)] : [-0.15, 0.15], s0 = Math.min(Math.max(0, lx), hx);  // slide no further than it must; no subjects (a view of a place, the reading view): at most 15 cm
    const O = others.map(c => corners([c])).filter(Q => Q.length), x = (p, s) => (p[0] - s) / (tx * (p[2] + back));
    const half = s => O.filter(Q => { const a = Math.min(...Q.map(p => x(p, s))), b = Math.max(...Q.map(p => x(p, s))); return (a < -1 && b > -1) || (a < 1 && b > 1); }).length;
    const edge = (Q, k, f) => f(...Q.map(p => p[0] + k * tx * (p[2] + back)));  // the slide that puts Q's side exactly on an edge
    const sx = [s0, ...O.flatMap(Q => [edge(Q, 1, Math.max) + 1e-3, edge(Q, -1, Math.min) - 1e-3, edge(Q, -1, Math.max) + 1e-3, edge(Q, 1, Math.min) - 1e-3])]
      .filter(s => s >= lx && s <= hx).map(s => [half(s) + Math.abs(s - s0), s]).sort((a, b) => a[0] - b[0])[0]?.[1] ?? s0;  // another character wholly in or wholly out, if a slide that keeps the subjects can do it
    const e = tmp.set(r.look.x, pg.max.y, pg.max.z).applyMatrix4(probe.matrixWorldInverse), up = -e.z > 0.05 ? desk * Math.min(0.8, Math.max(0, e.y + ty * (-e.z + back) + 0.01)) : 0;  // at most 80 cm: a reading view farther over the desk is slid the rest of the way  // up far enough that the page's near edge is under the frame: no desk
    return { x: s0, up, lo: P.length ? lo(1, axes[1][1], back) : -Infinity, hi: P.length ? hi(1, axes[1][2], back) : Infinity, back, others: sx - s0, lx, hx };
  };
  const slack = (r, who) => {  // how far the frame may slide back into the book (along -z) before a subject reaches an edge; closed form
    aim(r); const [tx, ty] = halves(), u = new THREE.Vector3(0, 0, 1).transformDirection(probe.matrixWorldInverse), wt = Math.min(0.6, safeNow().yt); let m = Infinity;
    for (const [x, y, D] of corners(who)) for (const [A, B] of [[0.99 * tx * D - x, -0.99 * tx * u.z - u.x], [0.99 * tx * D + x, -0.99 * tx * u.z + u.x], [wt * ty * D - y, -wt * ty * u.z - u.y], [0.99 * ty * D + y, -0.99 * ty * u.z + u.y]])  // to the edge, never past it
      if (B < 0) m = Math.min(m, Math.max(0, A / -B));
    return m;
  };
  let dz = 0, tilt = 0, od = 0, kept = new THREE.Vector3(), keptFrom = kept.clone(), keptRun, keptT = -9, step = 0;  // an upright phone's desk slide, tilt, others' slide and subject keep (step: this frame's dt)
  const toward = (v, goal, tau, rate) => { const d = goal - v, m = d * (1 - Math.exp(-step / tau)); return v + Math.sign(m) * Math.min(Math.abs(m), rate * step); };  // eased, and never faster than rate m/s
  let bd = opts.backdrop || null;  // the standing backdrop (the viewer measures it as the spread loads; else at build)
  const roomOf = r => {  // how far the frame shows the room past the backdrop, or the page's own sides (the book's edge and the desk beyond it)
    probe.copy(cam); probe.position.copy(r.pos); probe.lookAt(r.look); probe.updateMatrixWorld();
    const o = room(probe, bd); if (bd?.px1 == null) return o;
    const eye = tmp.setFromMatrixPosition(probe.matrixWorld), e0 = eye.clone(), d = new THREE.Vector3(); let edge = -Infinity;
    for (const [x, y] of BORDER) { d.set(x, y, 0.5).unproject(probe).sub(e0); if (d.y > -1e-6) continue; const k = (bd.floor - e0.y) / d.y, fz = e0.z + d.z * k; if (fz > bd.pz1 || (SCAM && fz < bd.z)) continue; const fx = e0.x + d.x * k; edge = Math.max(edge, bd.px0 - fx, fx - bd.px1); }  // where the frame's edge lands on the page (under the story camera not behind the backdrop, where the floor is hidden: a low beat's side rays land there, 0.9 m past the page's end)
    return { top: o.top, side: Math.max(o.side, edge) };
  };
  const fitIn = (r, top = !phone()) => {  // no frame shows the room past the backdrop: move in toward the look, else across toward its middle (its ends), then down (its top)
    if (!bd || (story.game === "wait" && !ownGame())) return r;  // the viewer's game view frames every target itself (on every screen); moving in would push edge targets off screen (eased() lets the correction go over ~0.4 s); a page's own game shot ("own": true) is fitted as any shot is
    const spare = 0.02, d = r.pos.distanceTo(r.look), fMax = Math.max(0, 1 - Math.max(0.6, (lims().minDistance ?? 0) + 0.03) / d);  // spare: the breathing drift
    const dolly = f => ({ pos: r.pos.clone().lerp(r.look, f), look: r.look.clone() }), slide = (q, s) => ({ pos: q.pos.clone().setY(q.pos.y - s), look: q.look.clone().setY(q.look.y - s) });
    const least = (lo, hi, bad) => { if (!bad(lo)) return lo; if (bad(hi)) return hi; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; bad(mid) ? (lo = mid) : (hi = mid); } return hi; };  // smooth in r: no steps
    const q0 = dolly(least(0, fMax, f => roomOf(dolly(f)).side > -spare)), mid = (bd.x0 + bd.x1) / 2 - q0.look.x;  // the orbit's nearest limit can stop the move in
    const shift = x => ({ pos: q0.pos.clone().setX(q0.pos.x + x), look: q0.look.clone().setX(q0.look.x + x) });  // across: the angles stay
    const q = shift(Math.sign(mid) * least(0, Math.abs(mid), x => roomOf(shift(Math.sign(mid) * x)).side > -spare));
    if (!top) return q;  // an upright phone's opening and push-in may show room above the backdrop (its frame is taller than any backdrop); its story shots are slid under it where they can be (rigOf)
    return slide(q, least(0, Math.max(0, q.pos.y - 0.32), s => roomOf(slide(q, s)).top > -spare));  // sliding keeps the angles, so the orbit limits
  };
  const mixRig = (a, b, k) => ({ pos: a.pos.clone().lerp(b.pos, k), look: a.look.clone().lerp(b.look, k) });
  const eased = (st, q, e, dt) => {  // q plus e × fitIn's correction; the correction follows over ~0.4 s, so a fit that flips between two answers never cuts
    const f = fitIn({ pos: q.pos.clone(), look: q.look.clone() }), dp = f.pos.sub(q.pos).multiplyScalar(e), dl = f.look.sub(q.look).multiplyScalar(e), k = st.dp ? 1 - Math.exp(-dt / 0.4) : 1;
    st.dp = st.dp ? st.dp.lerp(dp, k) : dp; st.dl = st.dl ? st.dl.lerp(dl, k) : dl;
    return { pos: q.pos.clone().add(st.dp), look: q.look.clone().add(st.dl) };
  };
  const O = SH.open, held = { on: false }, [T0, T1] = m.frames?.turn || [12, 84];
  const wide = (() => {  // the opening view, scaled with the viewer's framing for this screen (a phone: higher and closer, as its reading view)
    const desk = new THREE.Spherical().setFromVector3(B(m.camera.at).sub(B(m.camera.look))), mine = new THREE.Spherical().setFromVector3(HOME.clone().sub(LOOK));
    const look = O?.from ? B(O.look || m.camera.look) : LOOK.clone(), s = new THREE.Spherical().setFromVector3((O?.from ? B(O.from) : LOOK.clone().addScaledVector(HOME.clone().sub(LOOK), 1.45).add(new THREE.Vector3(0.3, 0.45, 0))).sub(look));
    s.radius *= mine.radius / desk.radius; s.phi += mine.phi - desk.phi;
    const pg = new THREE.Box3(); ["page-right", "page-prev", "leaf-page"].forEach(n => { const o = root.getObjectByName(n); if (o) pg.expandByObject(o); });
    const w = Math.max(Math.abs(pg.min.x), Math.abs(pg.max.x)), r = { look };
    for (let i = 0; !pg.isEmpty() && i < 4; i++) {  // the whole book in frame, even on a narrow phone, before the push-in crops to the story
      r.pos = look.clone().add(new THREE.Vector3().setFromSpherical(s)); probe.copy(cam); probe.position.copy(r.pos); probe.lookAt(look); probe.updateMatrixWorld();
      const reach = Math.max(...[-w, w].flatMap(x => [pg.min.z, pg.max.z].map(z => Math.abs(tmp.set(x, pg.max.y, z).project(probe).x))));
      if (reach < 0.95) break;
      s.radius *= reach / 0.92;
    }
    return fit(look.clone().add(new THREE.Vector3().setFromSpherical(s)), look);
  })();
  let wideFit = null;  // the opening view brought in until the standing spread shows no room past its backdrop
  const opening = () => {  // closed: the opening view; as the page turns and the spread rises, the camera comes in to wideFit with it
    if (SCAM && opts.mode?.() === "turn") { const l0 = window.live?.S?.page?.lines?.[0], b = l0 && planOf(l0)?.[0], g = b && !b.reading && !phone() && beatRig(b, now, true); if (g) return g; const rh = opts.readHome?.(); if (rh) return phone() ? rh : fitIn(rh); }  // the story camera flies in to the first line's first beat as the page turns: from the title view its push came in after the turn and showed the desk for the first line's 4.5 s; a first beat that is the reading view, and every phone's (a beat's low view is not where a phone's first line begins), take the reading view itself, which shows no room: the title view held to the page's fall showed 1.3 m of it
    if (opts.titled?.()) return { pos: HOME.clone(), look: LOOK.clone() };  // before the first pull: the viewer's title view (square to the book, both pages whole), no story shot
    if (!bd) return wide;
    wideFit ??= fitIn({ pos: wide.pos.clone(), look: wide.look.clone() });
    return mixRig(wide, wideFit, smooth((clamp01(((opts.frame?.() ?? T0) - T0) / (T1 - T0)) - 0.35) / 0.65));
  };
  const orbit = new THREE.Spherical(), inOrbit = () => {  // the camera inside the orbit's limits, as controls.update() would clamp it: that clamp would read as the reader's hand, and the director would let go
    orbit.setFromVector3(tmp.copy(cam.position).sub(controls.target));
    orbit.radius = Math.min(Math.max(orbit.radius, controls.minDistance), controls.maxDistance);
    orbit.phi = Math.min(Math.max(orbit.phi, controls.minPolarAngle), controls.maxPolarAngle);
    orbit.theta = Math.min(Math.max(orbit.theta, controls.minAzimuthAngle), controls.maxAzimuthAngle);
    cam.position.setFromSpherical(orbit.makeSafe()).add(controls.target);
  };
  const inside = l => { const v = cam.position.clone().sub(controls.target), d = v.length(), phi = Math.acos(v.y / d); return d >= l.minDistance + 0.015 && phi <= l.maxPolarAngle - 0.01 && d <= (l.maxDistance ?? Infinity) - 0.015 && phi >= (l.minPolarAngle ?? 0) + 0.01; };  // a little inside, not on the limit: a camera still sinking toward it would be clamped each frame (a 0.5 m/s lurch leaving the face shot)
  let shot = calm || !controls ? "off" : !phone() && cam.position.distanceTo(HOME) < 1e-3 ? "hold" : "wait";  // an upright phone waits at the reading view even on a fresh load: its opening view cannot show the whole book (the orbit limits stop it short), so it cropped the text page
  let yielded = shot === "off", last = null, cur = { pos: cam.position.clone(), look: LOOK.clone() }, run = null, calmFrom = 0;
  let lastShot = null;  // the shot last played: the director returns to it 4 s after the reader lets go
  let took = false, down = null;  // took: the reader really moved the camera (a zoom, a pinch or a drag, not a tap on a character or a game target); the director leaves it to them for the rest of this page (owner 2026-11-17: "let the user watch manually ... next scene the camera rezoom, but don't fight with the user")
  const el = controls?.domElement, onWheel = () => { took ||= isOpen(); }, onDown = e => { down = [e.clientX, e.clientY]; }, onMove = e => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10) took ||= isOpen(); }, onUp = () => { down = null; };
  el?.addEventListener("wheel", onWheel, { passive: true }); el?.addEventListener("pointerdown", onDown); addEventListener("pointermove", onMove); addEventListener("pointerup", onUp);
  disposers.push(() => { el?.removeEventListener("wheel", onWheel); el?.removeEventListener("pointerdown", onDown); removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); });
  const onStart = () => { held.on = held.tap = true; }, onEnd = () => { held.on = false; };  // tap: a start seen even when its end comes in the same event (a mouse wheel step: the orbit sends both at once)
  controls?.addEventListener("start", onStart); controls?.addEventListener("end", onEnd);
  disposers.push(() => { controls?.removeEventListener("start", onStart); controls?.removeEventListener("end", onEnd); });
  // One motion model for every move (the owner: "it should be more ease into"). The shots work out where the camera should be (pos, look) each frame (the goal).
  // A carrot walks toward the goal no faster than stories/CAMERA.md section 4 allows (the view turns at most 30 deg/s, 20 while a word is lit; the look point
  // moves at most 0.35 m/s; the distance changes at most 25% a second) and the camera is a critically damped spring on the carrot: it starts from rest gently,
  // settles gently, and a new shot (or the reader's hands letting go) starts from the camera's CURRENT place and velocity, never a restart. The spring is
  // on the look point, the distance (its log) and the two view angles, so a close camera never whips round. Integrated in 1/120 s sub-steps: the same at
  // 30 and 60 fps.
  const par = (pos, look) => { const v = pos.clone().sub(look), D = Math.max(v.length(), 1e-4); return { L: look.clone(), q: [Math.log(D), Math.atan2(v.x, v.z), Math.asin(Math.max(-1, Math.min(1, v.y / D)))] }; };
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a)), OMEGA = 3.4;
  let snap = false;
  const leavingFace = () => SC.fx != null && now - SC.fx < 6 && !/^(game|won)$/.test(SC.key);  // within 6 s of a face shot ending, not on a game's view
  const sp = { s: null, c: null, vL: new THREE.Vector3(), vq: [0, 0, 0], out: null }, mv = { p: null, vL: new THREE.Vector3(), vq: [0, 0, 0] };  // s: the camera, c: the carrot
  const rigOfPar = ({ L, q: [d, a, e] }) => ({ pos: new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(Math.exp(d)).add(L), look: L.clone() });
  const damp1 = (x, v, g, w, h) => { const d = x - g, c = v + w * d, e = Math.exp(-w * h); return [g + (d + c * h) * e, (v - w * c * h) * e]; };
  const spring = p => {
    const g = par(p.pos, p.look);
    if (!sp.s) sp.s = snap ? g : par(cam.position, controls.target), sp.vL.copy(snap ? sp.vL.set(0, 0, 0) : mv.vL), sp.vq = snap ? [0, 0, 0] : [...mv.vq], sp.c = { L: sp.s.L.clone(), q: [...sp.s.q] };  // a fresh book stands where its opening says; a camera that has been the viewer's carries on from where it is
    else if (sp.out && cam.position.distanceToSquared(sp.out) > 1e-6) sp.s = par(cam.position, controls.target), sp.vL.copy(mv.vL), sp.vq = [...mv.vq], sp.c = { L: sp.s.L.clone(), q: [...sp.s.q] };  // someone else moved the camera (the reader, the viewer's glide): carry on from there, at the speed it had
    const fly = SCAM && shot === "hold" && opts.mode?.() === "turn" ? 1 : 1, S = sp.s, C = sp.c, n = Math.max(1, Math.ceil(step * 120)), h = step / n, cap = deg(story.speaking ? 20 : 30) * fly, om = SCAM && shot !== "in" ? 2.2 * fly : OMEGA;  // fly: the first pull's turn, the camera leaving the title view for the reading view faster (1.8 times the limits): room shows until it arrives  // the story camera settles a little slower still
    g.q[1] = C.q[1] + wrapA(g.q[1] - C.q[1]);
    const dr = SCAM && SC.goal?.face ? 0.8 : SCAM && SC.goal?.near ? 1.2 : SCAM && SC.cl ? 0.8 : SCAM && (leavingFace() || now - SC.gx < 6) ? 0.5 : run?.base?.face ? 0.5 : SCAM && SC.key === "game" && story.game === "next" ? 0.29 : SCAM && shot === "in" && klass() !== 3 ? 0.7 : run?.over || (SCAM && shot === "in") ? 0.27 : 0.22;  // the story camera's opening flight off the phone 70% a second: at 27% a spread's first line was still on its way in from the book view, the room around the book in view (toad s02 2.1: 0.26 m, s01 1.1: 0.32 m)  // 29% on the flight to a game's view in the hush before its prompt (inside the director's 30%/s)  // the distance may change 22% a second (27% on the way in from the opening, 3% in 0.1 s at most); into a face shot 50%: a line's closing words are seen from the face, not from the way there  // a small subject's close/medium comes in faster than a face shot (a paper puppet's fill is 8x nearer than the reading view: at 22%/s it never lands)  // SC.cl (V33, provisional until Eddie passes CAMERA.md 4): into a close at the table's fill 80% a second, as into a face: at 22% (and at 50%) the turning line's close was still on its way in when the line ended (cowherd 8.5: 0.50 of the frame against 0.65)
    for (let i = 0; i < n; i++) {
      const dL = g.L.clone().sub(C.L), ml = Math.min(1, 0.35 * (SCAM && shot === "hold" && opts.mode?.() === "turn" ? 0.7 : 1) * h / Math.max(dL.length(), 1e-9)); C.L.addScaledVector(dL, ml);
      C.q[0] += Math.max(-dr * fly * h, Math.min(dr * fly * h, g.q[0] - C.q[0]));
      const da = g.q[1] - C.q[1], de = g.q[2] - C.q[2], k = Math.min(1, cap * h / Math.max(Math.hypot(da * Math.cos(C.q[2]), de), 1e-9)); C.q[1] += da * k; C.q[2] += de * k;
      for (const a of ["x", "y", "z"]) [S.L[a], sp.vL[a]] = damp1(S.L[a], sp.vL[a], C.L[a], om, h);
      for (let j = 0; j < 3; j++) [S.q[j], sp.vq[j]] = damp1(S.q[j], sp.vq[j], C.q[j], om, h);
    }
    const r = rigOfPar(S); p.pos.copy(r.pos); p.look.copy(r.look);
    return Math.max(S.L.distanceTo(g.L), ...[0, 1, 2].map(j => Math.abs(g.q[j] - S.q[j]) * (j ? Math.exp(g.q[0]) : 1)));  // how far it still trails its goal (metres; the distance in log)
  };
  const place = (p, t) => {  // the camera at p (pos, look): through the motion model, with the breathing drift (±0.01, 7 s) laid over it when t is given
    if (![...p.pos.toArray(), ...p.look.toArray()].every(Number.isFinite) || p.pos.distanceTo(p.look) < 1e-3) return 0;  // a degenerate goal (a zero box, a zero face) is never taken: the camera holds where it is
    orbit.setFromVector3(tmp.copy(p.pos).sub(p.look)); orbit.radius = Math.min(Math.max(orbit.radius, controls.minDistance), controls.maxDistance); orbit.phi = Math.min(Math.max(orbit.phi, controls.minPolarAngle), controls.maxPolarAngle); orbit.theta = Math.min(Math.max(orbit.theta, controls.minAzimuthAngle), controls.maxAzimuthAngle);
    p.pos.setFromSpherical(orbit.makeSafe()).add(p.look);  // the goal inside the orbit's limits first, so the camera never rides them and is never pushed off them in one frame
    const trail = spring(p);  // the one motion model: whatever path the shots above work out is the goal; the camera eases toward it
    if (SCAM && isOpen()) {  // the story camera on its way between two room-safe frames is kept off the room too (8.5: following Bobo to the backdrop's end showed 0.14 m of it for 2 s): fitIn's correction through its own critically damped spring (smooth even where fitIn jumps), never from a game's view (it shows the room by design: a 1.3 m/s lurch), nor on a phone (its beats keep their own rule: under the read-along panel)
      const on = shot !== "in" && klass() !== 3 && !/^(game|won)$/.test(SC.key ?? "") && !SC.goal?.roomy, f = on ? fitIn({ pos: p.pos.clone(), look: p.look.clone() }) : null, st = SC.fit ??= [0, 0, 0, 0, 0, 0].map(() => [0, 0]);
      const g = f ? [...f.pos.sub(p.pos).toArray(), ...f.look.sub(p.look).toArray()] : [0, 0, 0, 0, 0, 0];
      st.forEach((s, i) => st[i] = damp1(s[0], s[1], g[i], 4, step)); p.pos.add(tmp.set(st[0][0], st[1][0], st[2][0])); p.look.add(tmp.set(st[3][0], st[4][0], st[5][0]));
    }
    cam.position.copy(p.pos);
    if (SCAM && isOpen()) {  // the story camera may stand outside the reader's orbit on its way (in from the title view, 2.6 m out on a phone): the orbit is let out around it, not clamped (a clamp froze the push for 5 frames, 0.45 m/s), and given back once the camera is inside it again
      const v = tmp.copy(p.pos).sub(p.look), d = v.length(), phi = Math.acos(v.y / d);
      if (d > controls.maxDistance || d < controls.minDistance || phi > controls.maxPolarAngle || phi < controls.minPolarAngle) {  // never past controls.ceil (live.js fit): a mouse wheel is not the reader's hand to the story camera, so it carried on from each wheel step and let the orbit out a step further, without end
        faceLim ??= { minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle };
        faceLim.maxDistance ??= controls.maxDistance; faceLim.minPolarAngle ??= controls.minPolarAngle;
        Object.assign(controls, { minDistance: Math.min(controls.minDistance, d - 0.01), maxDistance: Math.min(Math.max(controls.maxDistance, d + 0.01), controls.ceil ?? Infinity), minPolarAngle: Math.min(controls.minPolarAngle, phi - 0.01), maxPolarAngle: Math.max(controls.maxPolarAngle, phi + 0.01) });
      }
    }
    if (t != null) { const b = smooth((t - calmFrom) / 2); cam.position.add(tmp.set(0.01 * b * Math.sin(TAU * t / 7), 0.006 * b * Math.sin(TAU * t / 5.6 + 1), 0)); }
    controls.target.copy(p.look); const pre = cam.position.clone(); inOrbit(); if (!pre.equals(cam.position)) sp.s.q = par(rigOfPar(sp.s).pos.add(cam.position).sub(pre), sp.s.L).q; last = cam.position.clone(); sp.out = last.clone();  // an orbit clamp moves the spring with it
    return trail;  // how far it still trails its goal
  };
  const write = (r, t, desk = 0, who = [], limit = 0) => {  // the camera, with the breathing drift (±0.01, 7 s) laid over the shot when t is given
    cur = { pos: r.pos.clone(), look: r.look.clone() };
    const p = { pos: r.pos.clone(), look: r.look.clone() };
    if (controls && !run?.base?.face) {  // the shot's subjects kept whole (and no one else half in frame); an upright phone also tilts over the look point and slides back into the book as far as they allow, so the desk stays out (`desk` of the way)
      if (run !== keptRun) keptRun = run, keptFrom.copy(kept), keptT = now;  // a new shot: its keep blends in from the last over 1 s, so nothing steps
      const others = story.game !== "wait" && (phone() || run?.s?.target != null) ? cast.filter(c => c.body.visible && !who.includes(c)) : [], w = shot === "in" ? 1 : smooth((now - keptT) / (run?.over ? run.secs : 1));  // a desktop's reading view is the viewer's own, and so is the game view on every screen (live.js gameView keeps each character wholly in or out; a slide here pushed mali-s04's lampspot0 to x -8 percent on a phone); a take-over's keep comes in with its move
      const at = a => {  // the frame for a tilt a (up over the look point; below 0, down), inside the orbit's limits, with the subjects kept whole: exact within a shot
        const v = p.pos.clone().sub(p.look), pol = Math.acos(v.y / v.length()), b = Math.max(-Math.max(0, (lims().maxPolarAngle ?? Math.PI) - pol - 0.02), Math.min(a, Math.max(0, pol - (lim.minPolarAngle ?? 0) - 0.02)));
        const q = { pos: v.applyAxisAngle(new THREE.Vector3(v.z, 0, -v.x).normalize(), -b).add(p.look), look: p.look.clone() }, n = need(q, who, others, desk), x = n.x + od;
        aim(q); const ax = i => new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, i), up = ax(1);
        const clear = s => roomOf({ pos: q.pos.clone().addScaledVector(up, s), look: q.look.clone().addScaledVector(up, s) }).top <= -0.02;  // the frame lifted s still under the backdrop's top
        let cap = n.up;  // an upright phone lifts its frame off the desk no higher than the backdrop's top: the room over it is worse than the desk below (as its reading view ranks them)
        if (phone() && bd && n.up > 0 && !clear(n.up)) { let lo = 0, hi = n.up; if (!clear(0)) hi = 0; else for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; clear(m) ? (lo = m) : (hi = m); } cap = lo; }
        const kv = new THREE.Vector3().lerpVectors(keptFrom, new THREE.Vector3(x + (Math.min(Math.max(x, n.lx), n.hx) - x) * w, Math.min(Math.max(Math.min(n.up, cap), n.lo), n.hi), n.back), w);
        aim(q); const side = ax(0).multiplyScalar(kv.x).add(ax(1).multiplyScalar(kv.y));
        q.pos.add(side).addScaledVector(ax(2), kv.z); q.look.add(side);
        const room = who.length ? slack(q, who) : Infinity;
        return { q, n, kv, room, slide: Math.min(deskGap(q), room) * desk };
      };
      const left = f => { const r = { pos: f.q.pos.clone(), look: f.q.look.clone() }; r.pos.z -= f.slide; r.look.z -= f.slide; return Math.max(0, deskOver(r)); };  // the desk the slide cannot take
      const goal = desk ? [tilt - 0.02, tilt, tilt + 0.02].map(a => Math.max(-0.3, Math.min(0.35, a))).map(a => [left(at(a)) + 0.02 * Math.abs(a), a]).sort((m, n) => m[0] - n[0])[0][1] : 0;
      tilt = toward(tilt, goal, 0.2, 0.3);  // the tilt walks toward less desk, and home to level when there is none
      const f = at(tilt); od = toward(od, f.n.others, 0.25, 0.3); kept.copy(f.kv); p.pos.copy(f.q.pos); p.look.copy(f.q.look);
      dz = toward(dz, f.slide, 0.08, 0.9); p.pos.z -= dz; p.look.z -= dz;  // what the frame's lift up could not take: close behind it (at most 0.9 m/s, 3 cm in a 33 ms frame)
    }
    return place(p, t);
  };
  if (shot === "hold") snap = true, write(opening()), snap = false;  // a fresh book: the camera starts wide and high
  const play = s => {  // start a shot from where the camera is now
    if (!s || calm || !controls || held.on) return;
    lastShot = s; if (yielded && (took || now - SC.out < 4)) return;  // the reader let go less than 4 s ago: this shot waits (the next one that begins after it, or the return at 4 s, brings the director back)
    s = s === "reading" ? { target: null, seconds: 3 } : [s].flat()[0];
    const base = rigOf(s); if (!base) return;
    if (base.lean) s = { ...s, target: base.lean };  // the subjects kept whole are the ones framed
    const over = shot === "in";  // the opening push-in has not landed: the line's shot blends on from where it has got to
    if (over) shot = "done", opts.halt?.();  // the line's shot takes the push-in over: not the viewer's glide home as well (a phone's dive at 1.5 m/s)
    const edge = !!run?.base?.face !== !!base.face, real = yielded || edge || over, from = real ? { pos: cam.position.clone(), look: controls.target.clone() } : cur;  // after the reader's hands, into or out of a face shot (no keep, tilt or slide), or over a push-in (which trails its rig at 1.4 m/s): from where the camera really is
    const fitWas = over && run?.dp ? { dp: run.dp.clone(), dl: run.dl.clone() } : null;  // taking over the push-in: its room fit is already on, and carries on (dropping it let the room back in for the line's first seconds, 0.22-0.35 m on every first line on desktop)
    from.ease = !!bd && !fitWas;  // the fit always eases in from where the camera stands: a view inside fitIn's 0.02 spare would otherwise snap
    if (real) ((yielded || over) && (calmFrom = now)), dz = tilt = od = 0, kept.set(0, 0, 0), keptFrom.set(0, 0, 0);  // breathing eases in again only after the reader's hands (restarting it while it ran took its 6 mm offset away in one frame: the nudge into a face shot; it eases in after the reader's hands and the opening push, which have none)  // breathing eases in again; the camera stands where it is, slide and keep included
    yielded = false; focus.goal = s.focus || s.target;
    const turn = from.look.clone().sub(from.pos).angleTo(base.look.clone().sub(base.pos));
    run = { s, from, base, t0: now, f0: frame(s.target), over, swing: edge, ...fitWas, secs: over ? Math.max(2, 3 * from.pos.distanceTo(base.pos)) : edge ? Math.max(2, turn / deg(40)) : 2 };  // taking over: no faster than a push-in (about 0.6 m/s at most); into or out of a face: the view turns at most 75°/s
  };
  function camera(t, dt) {
    if (window.live) window.live.hint.landed = !run || yielded || shot === "done" && (t - run.t0) / Math.max(2, run.s?.seconds || 3) >= 1;  // the shot has landed: the viewer shows its Next cue only then
    if (controls && dt > 0) {  // the camera's own speed, whoever moves it
      const c = par(cam.position, controls.target);
      if (mv.p) { mv.vL.copy(c.L).sub(mv.p.L).divideScalar(dt); mv.vq = c.q.map((x, i) => (i === 1 ? wrapA(x - mv.p.q[1]) : x - mv.p.q[i]) / dt); }
      mv.p = c;
    }
    const moved = last && cam.position.distanceToSquared(last) > 1e-8; step = dt;
    if (!calm && controls && !yielded && shot === "done" && (story.game === "next" || story.game === "wait")) opts.halt?.();  // the viewer's own 0.4 s glide to its game view (a phone's) would dash across the director's eased move: Kapi doubled in size in 0.3 s at the end of s01 1.4; the director takes that view itself
    const glide = !SCAM && moved && !held.on && isOpen() && !opts.titled?.() && (shot === "hold" || shot === "in");  // the viewer's own glide home as a spread opens (a phone's dive at 1.5 m/s): not the reader's hand; the opening push takes the camera over, at the speeds of CAMERA.md section 4
    if (glide || (SCAM && isOpen() && (shot === "in" || shot === "done"))) opts.halt?.();  // the story camera owns every view once the spread is open: the viewer's own glide home on an upright screen (home(900) at the first pull) stopped its push dead, 0.45 m/s in a frame
    const hand = held.on || held.tap || (moved && shot !== "wait" && !SCAM && !glide); held.tap = false;  // the story camera: only a real touch is the reader's hand (the viewer's glide and the opening's end are not)
    if (hand && !yielded) yielded = true, run = null, shot = shot === "done" ? "done" : "off";
    if (hand) SC.out = now;  // when the reader's hand (or the viewer's glide) last moved the camera
    last = null;
    if (!SCAM && !took && yielded && !held.on && shot === "done" && lastShot && now - SC.out >= 4 && isOpen()) play(lastShot);  // the reader let go 4 s ago: the director eases back to the shot it was on
    if (!controls || calm) return;
    if (shot === "wait") {  // a later spread: its text page waits still at the viewer's reading view, so a finger can find its corner; the reader's turn takes the camera out with the page, then the push-in
      const m = opts.mode?.();
      if (m === "turn") opts.halt?.(), (cur = { pos: cam.position.clone(), look: controls.target.clone() }), (shot = "hold");
      else if (m !== "closed") return void (shot = "done");
      else return void (last = cam.position.clone());
    }
    const capped = r => ({ pos: cur.pos.clone().add(r.pos.clone().sub(cur.pos).clampLength(0, 0.83 * dt)), look: cur.look.clone().add(r.look.clone().sub(cur.look).clampLength(0, 0.83 * dt)) });  // at most 1.2 s a metre, as the viewer's glides
    if (shot === "hold") {  // the opening view while the book is shut; it comes in with the turning page, so the open spread never shows the room
      if (isOpen()) { shot = "in"; opts.halt?.(); run = { from: cur, t0: t, to: (O?.settle && O.settle !== "reading" && rigOf({ target: O.settle, framing: "medium" })) || rigOf("reading") }; run.secs = Math.max(O?.seconds || 2.5, 2 * run.from.pos.distanceTo(run.to.pos)); }  // the ease's first speed, 3 d / secs, at most 1.5 m/s: under 0.05 m in a 33 ms frame
      else return void write(capped(opening()));  // the page's turn may sweep faster than that: the camera follows at its own pace
    }  // opened: this very frame is the push's first (it was skipped, a one-frame stall)
    if (shot === "in") {
      const b0 = SCAM && story.line && !/^game\./.test(story.line) ? planOf(story.line)?.[0] : null, g0 = b0 && (b0.reading ? rigOf("reading") : beatRig(b0, t));
      if (g0) run.to = g0, lift(g0);  // the story camera's push lands on the first beat's own frame (its subjects move: followed), not on the reading view (8.1 landed on the book on the desk)
      const k = (t - run.t0) / run.secs;
      const r = SCAM ? { pos: run.to.pos.clone(), look: run.to.look.clone() } : mixRig(run.from, run.to, ease(k));  // no room past the backdrop on the way in, landing exactly on the viewer's framing; the story camera's goal is the beat itself (the spring eases; a blend from where the camera stood braked a phone's camera already moving in the turn, 0.45 m/s in a frame)
      const p = bd ? eased(run, r, run.to.roomy ? 0 : SCAM && !phone() ? 1 : smooth(k / 0.3) * (phone() || SCAM ? 1 : 1 - smooth((k - 0.85) / 0.15)), dt) : r;  // a phone keeps the fit as it lands: the viewer's own phone view shows the desk, and letting the fit go would pull back over it  // the room fit comes in over the push's first third: it may start far out (the turn's sweep is capped)
      const trail = write(p, undefined, ease(k / 0.25), [], 1.4);  // the desk is out of a phone's frame early in the push (it ramps from nothing, so it needs no blend); at most 1.4 m/s
      if (k >= 1 && (SCAM || trail < 0.002)) shot = "done", run = null, calmFrom = t;  // landed (the story camera's beat moves with its subjects, so it never trails by less than 2 mm: the spring carries on in storyCam)
      return;
    }
    if (shot === "off") shot = "done";
    if (faceLim && (yielded || !(run?.base?.face || run?.base?.near)) && inside(faceLim)) Object.assign(controls, faceLim), (faceLim = null);  // the reader's orbit limits back after a face shot, once the camera is inside them: the orbit would clamp it there in one frame
    if (SCAM && isOpen() && shot === "done") return storyCam(t);
    if (!isOpen() || yielded) return;  // turning or closed: the camera is the reader's and the page's; or the reader took it
    if (!run) return write(cur, t, story.game === "wait" ? 0 : 1);
    if (story.game === "wait" && run.s.target == null) run.base = rigOf("reading");  // the game view moves with the game (a phone's steer game, hazard by hazard): the shot follows it, through the motion model
    const { s } = run, k = clamp01((t - run.t0) / Math.max(2, s.seconds || 3)), g = { pos: run.base.pos.clone(), look: run.base.look.clone() };
    if (s.move === "push" || s.move === "pull") g.pos.sub(g.look).multiplyScalar(1 + (s.move === "push" ? -0.15 : 0.15) * ease(k)).add(g.look);
    if (s.move === "drift") { const side = tmp.copy(g.look).sub(g.pos).cross(UP).normalize().multiplyScalar(-0.04 + 0.08 * smooth(k)); g.pos.add(side); g.look.add(side); }
    if ((s.move === "follow" || s.move === "crane") && run.f0) {  // keep a moving target framed, 0.6 s behind it (0.25 s on a phone's narrow frame; crane: up and down only)
      const f = frame(s.target);
      if (f) { run.lag ??= f.c.clone(); run.lag.lerp(f.c, 1 - Math.exp(-dt / (phone() ? 0.25 : 0.6))); const d = run.lag.clone().sub(run.f0.c); if (s.move === "crane") d.set(0, d.y, 0); g.pos.add(d); g.look.add(d); }
    }
    const r = s.move === "pan"  // turn from where the camera stands to the new target, then settle to the framing
      ? { pos: run.from.pos.clone().lerp(g.pos, smooth((t - run.t0 - 1.5) / 2)), look: run.from.look.clone().lerp(g.look, smooth((t - run.t0) / 1.5)) }
      : (run.swing ? swingRig : mixRig)(run.from, g, smooth((t - run.t0) / run.secs));  // moves ease in and out over at least 2 s, never a cut
    if (run.base.face) {  // close and level with her face: past the reader's orbit limits (kept from the shot before, given back after it)
      faceLim ??= { minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle };
      Object.assign(controls, { minDistance: Math.min(faceLim.minDistance, 0.05), maxPolarAngle: Math.max(faceLim.maxPolarAngle, deg(110)) });
      return void write(faceKept(r, s, clamp01((t - run.t0) / run.secs)), t, 0, []);
    }
    if (run.base.near) faceLim ??= { minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle }, controls.minDistance = Math.min(faceLim.minDistance, run.base.near - 0.01);  // a near shot of a small subject: the orbit's floor let out to it, given back as after a face shot
    near = run.base.near ?? Infinity; const q = mixRig(r, fit(r.pos.clone(), r.look.clone()), smooth((t - run.t0) / 2)); near = Infinity; const w = eased(run, q, phone() && subjects(s).length ? 0 : run.from.ease ? smooth((t - run.t0) / 2) : 1, dt);  // a phone shot of someone keeps its base framing (no per-frame room fit that would cut them)
    write(w, t, story.game === "wait" ? 0 : 1, subjects(s));  // never a jump; the game view is the viewer's on every screen: no slide off the desk (it slid mali-s01's phone game view 0.5 m into the book and lb4's flame to x 103 percent)
  }
    const actors = () => [...new Set((m.acts || []).map(a => a.who))].filter(n => cast.some(c => c.name === n && c.body.visible));
    const closing = (s, who) => {  // the closing shot of a page whose cast is on stage keeps the WHOLE cast in frame (every one of them can be tapped as long as the page is up), whatever the shot is aimed at: a close-up on a branch took them all off screen
      if (!who.length || (s === "reading" ? whole(rigOf("reading"), who) : s && who.every(c => [s.target].flat().includes(c.name)))) return s?.target && [s.target].flat().length > who.length ? { ...s, target: who.map(c => c.name) } : s;  // already all in (the reading view, or a shot of everyone): as authored, held on these bodies only
      const all = { target: who.map(c => c.name), framing: "wide", move: "hold", seconds: 3 }, r = rigOf(all);
      return r ? all : "reading";  // as wide as the orbit allows when the cast is wider than any frame it permits (rigOf keeps them all in where it can)
    };
  const endShot = () => {  // the closing shot (a phone's reading view is narrow: it ends on the story's actors): the first of everyone (Kapi and Mali: their passed looks),
    // the living cast (skinned, not a diorama's rigid props and posed copies) and who acts or can talk whose view holds the story's people whole with no room past the
    // backdrop (off the phone); a body a hide act hid never counts. None: never everyone (gourd-s01's 36 bodies took the view into the room, 0.64 m): the reading view, room-fitted, on the people
    const hid = window.live?.acting?.was, ppl = window.live?.acting?.people, act = actors(), skinned = c => { let k = false; (c.model || c.body).traverse(o => (k ||= !!o.isSkinnedMesh)); return k; };
    const shown = keep => cast.filter(c => c.body.visible && !hid?.has(c.body) && keep(c)), people = shown(c => skinned(c) && (act.includes(c.name) || ppl?.has(c.name)));  // the story's people: living bodies that act or talk, not acting props (gourd-s01's mud patches and rice shoots)
    const shotOf = who => { const s = closing(SH.end, who); return s !== "reading" ? s : phone() ? { target: actors(), framing: "medium", move: "hold", seconds: 3 } : { target: null, seconds: 3, room: true, keep: who.map(c => c.name) }; };
    const drawn = window.live?.drawn, held = (r, who) => (aim(r), who.every(c => (drawn ? drawn(c) : []).every(p => (tmp.copy(p).project(probe), tmp.z < 1 && Math.abs(tmp.x) <= 0.98 && Math.abs(tmp.y) <= 0.98))));  // every body as drawn now, inside 98 percent of the frame
    const E = SH.end, authored = E === "reading" || (E && typeof E === "object" && !Array.isArray(E) && (E.target == null || !Array.isArray(E.target) || E.target.length < 2));
    if (authored) return shotOf(cast.filter(c => c.body.visible));  // an end the author set as the reading view or on one subject is a passed look (every Kapi and Mali page): as it always was, everyone, untouched
    let last;
    for (const keep of [() => true, skinned, c => people.includes(c)]) {
      const who = shown(keep), s = last = shotOf(who), r0 = rigOf(s);
      if (!r0 || !people.length) return s;
      const n = need(r0, [s.target].flat().length && s.target ? who : [], [], 0), ax = i => new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, i), d = ax(0).multiplyScalar(n.x).add(ax(1).multiplyScalar(Math.min(Math.max(0, n.lo), n.hi)));
      const r = { pos: r0.pos.clone().add(d).addScaledVector(ax(2), n.back), look: r0.look.clone().add(d) };  // as the shot's keep will stand it: moved out until its subjects are whole (gourd-s01's 36 bodies took it into the room)
      const o = !bd ? null : (aim(r), room(probe, bd));  // on a phone too: the ladder only runs where no passed look stands
      if (held(r, people) && !(o && Math.max(o.top, o.side) > 0.02)) return s;  // that view holds the story's people whole, with no room
    }
    return phone() ? { target: people.map(c => c.name), framing: "medium", move: "hold", seconds: 3 } : last;  // none does: the story's people (never everyone: gourd-s01's 36 bodies took the view 0.64 m into the room); a phone frames them as its closing medium
  };
  function shots() {
    for (const k of ["end", "game", "game:won"]) if ((SH[k] || k === "end") && when(k, "", "shot")) {  // a page with no authored end still closes on its people (gourd-s01 R17c)  // the game's shot wins; on an upright phone "reading" is the viewer's game framing, so small targets are tappable
      play(k === "end" ? endShot() : k === "game" ? "reading" : SH[k]);  // the game: the viewer's own game view (HOME while the game is on), on every screen  // a phone's reading view is narrow: it ends on the story's actors where they are, not where they began
    }
    if (story.game === "wait") return;  // the game view holds on every screen: a line said again (a tap on Lulu) must not pull it off the targets
    for (const [k, v] of Object.entries(SH)) if (!["open", "end", "game", "game:won"].includes(k)) for (const s of [v].flat()) if (when(k, s.word, "shot")) play(s);
  }

  // ---------- the story camera (stories/CAMERA.md): each line cut into beats, a shot per beat, every move through the motion model above; on with camera.story or ?story=1 ----------
  const FILL = { wide: [0.35, 0.40, 0.50, 0.60], medium: [0.50, 0.55, 0.65, 0.75], close: [0.65, 0.70, 0.78, 0.85] }, CLOSE = 0.65;  // CLOSE (V33): a close that is taller than wide stands 0.65 of the frame's HEIGHT on every screen, its body drawn tight; 0.65 of the safe frame read as a medium (0.35-0.45 of the frame)  // subjects' fill of the safe frame: desktop, tablet landscape, tablet portrait, phone (CAMERA.md section 3)
  const klass = () => { const lo = Math.min(innerWidth, innerHeight), hi = Math.max(innerWidth, innerHeight); return lo < 600 ? 3 : hi >= 1200 ? 0 : innerWidth > innerHeight ? 1 : 2; };
  const MOVERS = /^(walk|run|swim|jump|stepback|leap)$/, EMOTE = /^(Worry|Sad|Cry|Cheer|Laugh|Surprise|Scared|Jump|Wave)$/, GAP = 1.4;  // GAP: the pause a line's last beat runs into
  const hero = n => cast.find(c => c.name === n && c.body.visible);
  const withPair = ns => { const out = new Set(ns); for (const n of ns) { const c = hero(n); if (c?.ride?.on) out.add(c.ride.on.name); for (const o of cast) if (c && o.ride?.on === c) out.add(o.name); } return [...out]; };  // a rider and its mount are one subject (a name with no character — an extra — has no mount: without `c &&`, every non-rider matched undefined and the shot framed the whole cast)
  const sb = new THREE.Box3(), sv = new THREE.Vector3();
  const boxOf = (ns, at, any, tight) => {  // at: [[x0,y0,z0],[x1,y1,z1]] a box of the page (a painted thing: gourd-s01's Sky King on the sky card); a name no character has: that page piece's box  // the subjects' box from their bones (the skin's own box is the bind pose's, twice as wide as the body that is drawn) and a tenth of their height; null if none is on stage
    const u = new THREE.Box3();
    if (at?.length === 2) u.expandByPoint(B(at[0])).expandByPoint(B(at[1]));
    for (const n of ns) { const c = any ? cast.find(c => c.name === n) : hero(n); if (!c) { const o = n && (root.getObjectByName(n) || group.getObjectByName(n)); if (o) u.union(new THREE.Box3().setFromObject(o)); continue; } const bones = c.bones ??= (() => { const l = []; (c.model || c.body).traverse(o => o.isBone && l.push(o)); return l; })(), D = tight && bones.length && window.live?.drawn?.(c); if (D?.length) { u.union(sb.setFromPoints(D)); continue; } sb.makeEmpty(); for (const o of bones) sb.expandByPoint(o.getWorldPosition(sv)); u.union(bones.length ? sb.expandByScalar(0.15 * c.height) : sb.setFromObject(c.model || c.body)); }  // a paper puppet has no bones: its card's own box (gourd s11)  // bones and 15% of the height: a crocodile's snout and tail reach past its bones (the drawn pair touched the frame's edge at 10%)
    return u.isEmpty() ? null : u;  // tight (a close, V33): a 3D body as drawn now, sleeves and skirt included (bones + 15% made a close's frame 30% taller and 60% wider than her: a phone's close of one person was always held by its width)
  };
  let safeAt = -9, safeV = null;
  const safeNow = () => {  // the safe frame in NDC: under the read-along page (+3%), above the bar (10%), 3% in at the sides; measured every quarter second
    if (now - safeAt > 0.25 || !safeV) { safeAt = now; const r = document.querySelector(".ra-page")?.getBoundingClientRect(); safeV = { x: 0.94, yt: 1 - 2 * (r ? (r.height ? r.bottom / innerHeight : 0.08) + 0.03 : 0.33), yb: -0.8 }; }
    return safeV;
  };
  const extent = (P, r) => { aim(r); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of P) { sv.copy(p).project(probe); x0 = Math.min(x0, sv.x); x1 = Math.max(x1, sv.x); y0 = Math.min(y0, sv.y); y1 = Math.max(y1, sv.y); } return { x0, x1, y0, y1 }; };
  const lowDir = (v, up = 0) => { const EL = deg(klass() === 3 ? 12 : 22) + up, r = Math.hypot(v.x, v.z), e = Math.atan2(v.y, r); return e <= EL ? v.clone().normalize() : new THREE.Vector3(v.x / r * Math.cos(EL), Math.sin(EL), v.z / r * Math.cos(EL)); };  // the reading axis brought down to 25° at most: a pop-up is seen across its layers (review 3: the iPad and phone looked down on a flat map, 42-72° above the speakers)
  const solveFrame = (P, f, sign, up = 0, S = safeNow(), yaw = 0) => {  // the frame in which P fills `f` of the safe frame, sits in the middle of the free band under the read-along page (V15: a tall one hung 8% under the caption, the lower half empty) and off its middle away from `sign` (lead room), seen along the reading axis as the spread opened (the game view moves HOME under a running beat: a lurch)
    const W = 2 * S.x, H = S.yt - S.yb, v0 = (SC.ax ?? HOME.clone().sub(LOOK)).clone().applyAxisAngle(UP, yaw), dir = lowDir(v0, up), L = new THREE.Box3().setFromPoints(P).getCenter(new THREE.Vector3()), [tx, ty] = halves(), lead = sign * (klass() === 3 ? 0.12 : 0.2);
    f = Math.min(f, 2 * (0.82 - Math.abs(lead)) / W);  // at least 9% of the screen between the subjects and its sides: this wins over the table
    let D = v0.length(), tall;
    for (let i = 0; i < 8; i++) {
      const b = extent(P, { pos: L.clone().addScaledVector(dir, D), look: L }), w = b.x1 - b.x0, h = b.y1 - b.y0, sx = w / W / f, sy = S.close ? h / 2 / S.close : h / H / f;
      tall = sy >= sx; D *= Math.max(sx, sy);
      const mid = (S.yb + S.yt) / 2, gy = tall && S.close ? S.yt - 0.08 - h / 2 : tall ? S.yt - 0.08 * H - h / 2 + 0.35 * (mid - (S.yt - 0.08 * H - h / 2)) : mid, right = new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 1);  // S.close (V33): a close's subjects stand S.close of the frame's height, 4% of it under the words, running on under the bar if they must
      L.addScaledVector(right, ((b.x0 + b.x1) / 2 + lead) * tx * D).addScaledVector(up, ((b.y0 + b.y1) / 2 - gy) * ty * D);
    }
    return { pos: L.clone().addScaledVector(dir, D), look: L, tall };
  };
  const inSafe = (P, r, S = safeNow()) => { const b = extent(P, r), x = Math.min(S.x, 0.82); return b.x0 >= -x && b.x1 <= x && b.y1 <= S.yt && b.y0 >= S.yb; };  // inside the safe frame, 9% of the screen from its sides
  const sideOf = (to, P) => {  // +1: `to` (a character, or a point) lies to the screen's right of P, -1: left, 0: no such thing
    const w = Array.isArray(to) ? B(to) : typeof to === "string" ? frame(to, true)?.c : null; if (!w || !P.length) return 0;
    aim({ pos: cam.position, look: controls.target }); const d = sv.copy(w).project(probe).x - new THREE.Box3().setFromPoints(P).getCenter(new THREE.Vector3()).project(probe).x;
    return Math.abs(d) < 0.02 ? 0 : Math.sign(d);
  };
  const plans = {};
  const ownGame = () => { const G = SH.game; return SCAM && G?.constructor === Object && ({ ...G, ...(klass() === 3 ? G.phone : klass() ? G.tablet : null) }).own === true; };  // the page's own game shot, opted in ("own": true inside shots.game; a screen's override may set it too, so "phone": {"own": false} keeps the viewer's own view on phones)
  const beatOf = (line, s) => ({ line, t0: 0, names: [s.target].flat().filter(Boolean), at: s.at, size: s.framing ?? "medium", num: s.size, pitch: s.pitch, tablet: s.tablet, phone: s.phone, move: s.move ?? "hold", lead: s.lead, by: s.by, after: s.after, len: 3, kind: "authored" });  // a page's shot as a beat
  const planOf = line => plans[line] ??= (() => {  // the line's beats: authored (a list of shots), else cut from who speaks and who acts
    const I = opts.info?.(line) ?? {}, W = I.words ?? [], say = I.say ?? [], dur = I.dur ?? 4, acts = (m.acts || []).filter(a => a.line === line && a.who), at = w => (w ? opts.wordAt?.(line, w) ?? 0 : 0), S = SH[line]?.constructor === Object ? [SH[line]] : SH[line];  // a line's one shot written as an object (turtle s01 1.5) is a list of one: it was never read, so the director's own beats framed whoever walked last (Matsing) and left Pagong, the target, at the edge
    if (S === "reading") return [{ line, t0: 0, len: dur + GAP, kind: "reading", reading: true, names: [] }];  // a line authored as the reading view holds the viewer's reading view all through (gourd-s01 1.1, its establishing line: the default beat went to a tight medium on everyone)
    if (Array.isArray(S)) return S.map(s => ({ ...beatOf(line, s), t0: at(s.word), to: acts.findLast(a => [s.target].flat().includes(a.who) && a.to)?.to })).sort((a, b) => a.t0 - b.t0);  // in the order their words are said (V33: cowherd 8.5 listed "Zhinü" before "cried", which is said first, and her close never played)
    const trig = [{ t: 0 }];
    say.forEach((w, i) => i && w !== say[i - 1] && (w !== "narrator" || say[i - 1] !== "narrator") && trig.push({ t: W[i]?.[0] ?? 0 }));
    for (const a of acts) { const k = MOVERS.test(a.do) ? "go" : (a.do === "clip" && EMOTE.test(a.clip)) || a.do === "mood" ? "emote" : a.do === "face" && Array.isArray(a.face) ? "gaze" : null; if (k) trig.push({ t: at(a.word), k, who: a.who, to: a.to ?? a.face }); }
    const bs = [];
    for (const x of trig.sort((a, b) => a.t - b.t)) { const p = bs.at(-1); if (p && x.t - p.t < 0.4) p.k ??= x.k, p.who ??= x.who, p.to ??= x.to; else bs.push({ ...x }); }  // triggers at one moment are one beat
    const len = i => { const n = bs[i + 1]?.t, ws = W.filter(w => w[0] >= bs[i].t && (n == null || w[0] < n)); return n == null ? dur + GAP - bs[i].t : (ws.at(-1)?.[1] ?? n) - bs[i].t; };  // the speech's length (the last beat runs on into the pause)
    for (let i = bs.length - 1; i >= 0; i--) if (bs.length > 1 && len(i) < 1.5) { const j = i ? i - 1 : 1; if (!i) bs[1].t = 0; else bs[j].k ??= bs[i].k, bs[j].who ??= bs[i].who, bs[j].to ??= bs[i].to; bs.splice(i, 1); }  // a beat shorter than 1.5 s joins the one before (the first: the one after)
    const pl = opts.info?.(I.prev), prevSay = pl?.say?.at(-1), everyone = cast.filter(c => c.body.visible).map(c => c.name);
    bs.forEach((b, i) => { if (b.k === "go" && i) b.t = Math.max(bs[i - 1].t + 1.5, b.t - 1.2); });  // a camera leads the action: the swim's frame is there before the swim
    return bs.slice(0, 3).map((b, i) => {
      const w = W.findLastIndex(x => x[0] <= b.t + 0.01), sp = say[Math.max(0, w)], talker = sp && sp !== "narrator" && hero(sp) ? sp : null, o = { line, t0: b.t, len: len(i), kind: "two", names: [...new Set(acts.map(a => a.who))].filter(hero), size: "medium", move: "hold" };
      if (!o.names.length) o.names = everyone;
      if (b.k === "go") Object.assign(o, { kind: "travel", names: [b.who], size: "wide", move: "follow", lead: b.to });
      else if (talker) Object.assign(o, { kind: prevSay && prevSay !== "narrator" && prevSay !== talker ? "reply" : "single", names: [talker], lead: everyone.find(n => n !== talker && !withPair([talker]).includes(n)) });
      else if (b.k === "emote") Object.assign(o, { kind: "push", names: [b.who], size: "close", move: "push" });
      else if (b.k === "gaze") Object.assign(o, { kind: "gaze", names: [b.who], lead: b.to });
      return o;
    });
  })();
  const beatRig = (b, tt, any) => {  // V18: an authored wide is never closer than the reading view (the room-safe fit pulled a page-piece wide in to 1.2 m where the reading view stands at 1.3)
    const r = beatRig0(b, tt, any), h = r && b.kind === "authored" && b.size === "wide" && !phone() ? rigOf("reading") : null;
    return h && r.pos.distanceTo(r.look) < h.pos.distanceTo(h.look) ? h : r;
  };
  const beatRig0 = (b, tt, any) => {  // a beat's frame at this moment (its subjects move: it follows them); any: hidden characters count (the page turning, before they stand up)
    if (!opts.titled?.() && !SC.ax) SC.ax = HOME.clone().sub(LOOK);  // the reading axis as the spread opened (before the first pull HOME is the title view)
    const ov0 = klass() === 3 ? b.phone : klass() ? b.tablet : null;
    if (ov0) b = { ...b, ...ov0, names: ov0.target != null ? [ov0.target].flat() : b.names, size: ov0.framing ?? b.size, num: ov0.size ?? b.num };  // a screen's override is the beat's, every key of it (target, framing, size, pitch, at, lead, move, by, after): only target and pitch were read, so a phone's own 'at' (turtle s09 9.2-9.5), framing and lead (toad s01 1.3, s02 2.1) did nothing
    if ((ov0?.framing ?? b.size) === "face") { const r = faceRig({ target: [ov0?.target ?? b.names].flat()[0], size: ov0?.size ?? b.num }); if (r) return r; }  // a face beat is the face shot (T52: it fell back to the medium fill, Kankak's sad face 2.7-9.2 percent of a phone's height)
    const cl = b.size === "close" && b.num == null, u = boxOf(withPair(b.names.filter(Boolean)), b.at, any, cl); if (!u) return null;  // cl: a close at the table's fill (an authored size keeps the safe frame's measure it was tuned on)
    const c = u.getCenter(new THREE.Vector3()), h = u.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const vel = SC.c ? c.clone().sub(SC.c).divideScalar(Math.max(step, 1e-3)) : new THREE.Vector3(); SC.c = c.clone(); SC.v = (SC.v ?? vel).lerp(vel, 1 - Math.exp(-step / 0.25)); c.addScaledVector(SC.v, SCAM && leavingFace() && SC.goal && cam.position.distanceTo(controls.target) < 0.7 * SC.goal.pos.distanceTo(SC.goal.look) ? 0.9 : 0.4);  // still nearer than its shot after a face (it pulls out at 50%/s): the look point leads by the spring's lag (2/omega, 0.9 s), else a walker leaves the narrow frame (toad s02 2.5 phone: Kankak cut at the edge)  // aimed 0.4 s ahead of where they are going: a swimmer is never caught at the frame's edge
    const key = withPair(b.names).sort().join(), hm = h.clone().setX(Math.max(h.x, h.z)).setZ(Math.max(h.x, h.z)), mem = (SC.mem[key] = (SC.mem[key] ?? hm.clone()).multiplyScalar(Math.exp(-step / 200)).max(hm));  // the biggest this subject has been lately, turned any way (a swim stretches Bobo to three times his resting width, and he turns round)
    SC.half = (SC.half ? SC.half.multiplyScalar(Math.exp(-step / 3)).max(h) : h.clone()).max(mem.clone().multiplyScalar(/travel|gaze/.test(b.kind) ? 0.7 : 0));  // fast attack, slow release: a swinging arm or tail never makes the frame breathe
    const pad = klass() === 3 ? (b.kind === "travel" ? 1.5 : b.kind === "gaze" ? 1.3 : 1.1) : b.kind === "travel" ? 1.5 : b.kind === "gaze" ? 1.3 : 1.05, P = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => new THREE.Vector3(c.x + x * SC.half.x * pad, c.y + y * SC.half.y * pad, c.z + z * SC.half.z * pad))));  // a swimmer turns: its box can grow by a third in half a second, more room for it
    const k = klass(), ov = k === 3 ? b.phone : k ? b.tablet : null;
    let f = ov?.size ?? b.num ?? FILL[b.size]?.[k] ?? FILL.medium[k];
    const p = clamp01((tt - SC.since - (b.after != null ? (opts.wordAt?.(b.line, b.after) ?? 0) - b.t0 : 0)) / Math.max(1.5, b.len)), by = b.by ?? (b.move === "pull" ? 0.15 : 0.12);
    if (b.move === "push") f *= 1 - by * (1 - smooth(p)); else if (b.move === "pull") f *= 1 + by * (1 - smooth(p));
    // One pitch rule on every screen: the view stays at most 25° above its subjects (lowDir) and is never tipped; the frame is fitted by moving in (fitIn) or by a lower fill (x 0.85, x 0.7).
    // Off the phone the room-safe frame wins; an upright phone may show the wall only above the read-along panel's bottom edge (its frame is taller than any backdrop).
    const sign = SC.sign ??= sideOf(b.lead === "travel" ? b.to : b.lead, P), whole_ = (r, Q = P, x = 0.92, lo = Math.min(safeNow().yb, -x)) => { const e = extent(Q, r); return e.x0 >= -x && e.x1 <= x && e.y0 >= lo && e.y1 <= Math.max(0.96, x); };
    const R = [0, 1].flatMap(x => [0, 1].flatMap(y => [0, 1].map(z => new THREE.Vector3(x ? u.max.x : u.min.x, y ? u.max.y : u.min.y, z ? u.max.z : u.min.z))));  // the subjects as they are now (P is padded for a swim's stretch and aimed ahead)
    const ka = b.at?.length === 2 && new THREE.Box3().setFromPoints(b.at.map(B)), pa = ka && boxOf(withPair(b.names.filter(Boolean)), null, any);  // a painted thing and its people are two boxes, not one: their union's empty front-top corners asked for a frame three screens tall (R20)
    if (pa) { const cs = x => R.map((_, i) => new THREE.Vector3(i & 4 ? x.max.x : x.min.x, i & 2 ? x.max.y : x.min.y, i & 1 ? x.max.z : x.min.z)); P.splice(0, 8, ...cs(pa.clone().expandByVector(pa.getSize(new THREE.Vector3()).multiplyScalar((pad - 1) / 2))), ...cs(ka)); R.splice(0, 8, ...cs(pa), ...cs(ka)); }
    const crowns = withPair(b.names).map(n => boneOf(hero(n), "HeadTop_End")?.getWorldPosition(new THREE.Vector3())).filter(Boolean), underWords = r => (aim(r), crowns.every(p => sv.copy(p).project(probe).y <= safeNow().yt));  // R28: no face under the read-along words (gourd s01's desktop end put Pu Nyeu's head in them: the room-safe fit allowed the top to 96%)
    const heads = withPair(b.names).map(n => boneOf(hero(n), "head")?.getWorldPosition(new THREE.Vector3())).filter(Boolean), pu = deg(Math.max(0, Math.min(40, b.pitch || 0))), lowEnough = r => heads.every(h => r.pos.y - h.y <= Math.sin(deg(29) + pu) * r.pos.distanceTo(h));  // pu: the page's pitch, the view raised that much over the beat's own (and allowed that much higher over the heads)  // the pitch rule where it shows, at the subjects' eyes: a close frame sits on the camera's floor and looks down more steeply the nearer it is (a phone's 8.2: 32 degrees above Bobo's head); a lower fill stands it farther back
    low = true;
    const nearWas = near; near = 0.05;  // a paper puppet is small: its close/medium/wide fill sits nearer than the reader's orbit floor (the fill already fits it; fit() reads `near`, place() reads the let-out below)
    try {
      let q, fq, q0, fq0, loose, qn;
      // a phone whose room fit would cut its subjects at every fill (turtle s02 2.2: the pair by the backdrop's end, pushed off the right edge): the view turns instead (the smallest of 8, 15, 22 degrees either way that holds them, room-free) at the full fill, so the size the page asks for holds; not while the opening push flies in (its speed caps are tuned to the unturned beat: Kapi s08's phone push went 0.35 m/s)
      for (const [sg, up, m, sf, yaw] of [[sign, 0, 1], [sign, 0, 0.85], [sign, 0, 0.7], ...(klass() === 3 ? (shot === "in" ? [] : [8, -8, 15, -15, 22, -22].map(d => [sign, 0, 1, undefined, deg(d)]).concat(b.kind === "end" ? [[0, deg(10), 1], [0, deg(18), 1], [0, deg(18), 0.7], [0, deg(18), 0.5]] : [])) : [[0, 0, 1], [0, 0, 1.2], [0, deg(8), 1], [0, deg(8), 0.85]]), ...(b.at && klass() !== 3 ? [1.4, 1.6, 1.8, 1.2, 1].flatMap(m => [-8, -12].map(d => [0, deg(d), m, { ...safeNow(), yt: 0.94 }])) : [])]) {  // a painted thing high on the backdrop (R20: the Sky King, 0.13 m under the skyline): lower and from the backdrop's middle, and the text may cover the backdrop (CAMERA.md 3)  // off the phone, then no lead room (8.5: the lead toward the backdrop's end took the frame past it), closer, a little higher (still at most 30 degrees), before giving up the room (a phone's closer rung went 32 degrees above Bobo on 8.2)
        const r = solveFrame(P, Math.min(0.92, f * m), sg, up + pu, sf ?? (cl ? { ...safeNow(), close: CLOSE * m * f / FILL.close[k] } : undefined), yaw), lo = cl && r.tall ? -1.12 : undefined, SB = lo && { ...safeNow(), yb: lo }; flo = lo ? 0.1 : null; /* a tall close comes down to 0.1 m, near a 3D person's eyes (cameraman T23): from 0.18 a phone's close looked down on the top of Zhinü's head */ if (sf && bd) { const dx = (bd.x0 + bd.x1) / 2 - r.look.x; r.pos.x += dx; r.look.x += dx; } q = fit(r.pos.clone(), r.look.clone()); q0 ??= q; if (!yaw) qn = q; fq = fitIn({ pos: q.pos.clone(), look: q.look.clone() }, !phone()); fq0 ??= fq;
        if (phone() && bd) fq = underPanel(fq);
        if (phone() && bd) fq = deskOut(fq, q => inSafe(P, q, SB) && lowEnough(q) && underWords(q));
        if ((klass() === 3 || !bd ? inSafe(P, fq, SB) : whole_(fq, P, 0.92, lo)) && lowEnough(fq) && underWords(fq)) return SC.cl = cl, fq;  // SC.cl: a close at the table's fill (the faster way in, spring below)  // a close may run on 6% under the frame's foot (its feet under the bar), never over its top
        if (b.kind === "end" && klass() === 3 && lowEnough(fq) && whole_(fq, P, 0.98)) loose ??= fq;  // a closing frame no rung holds inside the safe frame: the first that still holds the people whole
      }
      if (klass() !== 3 && bd) for (const m of [0.75, 0.85]) {  // closer on the subjects as they are: a narrower frame stays on the backdrop (8.5 ends with the pair 0.35 m from its end, where every wider frame showed the room or lost them)
        const r = solveFrame(R, m, 0); q = fit(r.pos.clone(), r.look.clone()); fq = fitIn({ pos: q.pos.clone(), look: q.look.clone() });
        if (whole_(fq, R) && underWords(fq)) return fq;
      }
      const kept = klass() !== 3 && bd && SC.goal && !SC.goal.face && whole_(SC.goal, R, 0.99) && underWords(SC.goal) ? { pos: SC.goal.pos.clone(), look: SC.goal.look.clone(), roomy: SC.goal.roomy } : null;
      const names = withPair(b.names.filter(Boolean)), who = names.map(n => (any ? cast.find(c => c.name === n) : hero(n))).filter(Boolean);
      if (klass() !== 3 && bd && bd.pz1 != null && !b.at && who.length === names.length && !(kept && !kept.roomy) && plans[b.line]?.some(x => x.move === "follow" && x.names.some(n => names.includes(n)))) {  // the room-safe frame may cut the one a line follows (turtle s07 7.1: Matsing at the stage's front by the backdrop's right end, a third of him off the screen for the whole line; the backdrop is 0.9 m behind him, so a frame that ends on it ends before he does). In a line with a follow shot, every beat that frames its target keeps it whole while it stands ON the stage, in front of the backdrop: it wins over the room. Someone in the wings (past the backdrop's ends: an entrance) changes nothing, nor does any line without a follow. shortcut: characters only; a beat that also names a page piece or an `at` box keeps the room-safe frame, add their boxes to D if one is ever cut
        const D = who.flatMap(c => window.live?.drawn?.(c) ?? []), seen = (r, m) => (aim(r), D.every(p => (sv.copy(p).project(probe), sv.z < 1 && Math.abs(sv.x) <= m && Math.abs(sv.y) <= m)));  // their bodies as drawn now, inside the frame's middle m
        const held = r => seen(r, 0.94) && lowEnough(r) && underWords(r);
        if (D.length && seen(fq, 0.98)) { if (kept) return fq; }  // the room-safe frame holds them (again): it is the frame
        else if (D.length && who.every(c => { const p = c.body.getWorldPosition(sv); return p.x >= bd.x0 && p.x <= bd.x1 && p.z >= bd.z && p.z <= bd.pz1; }) && held(q0)) {
          let lo = 0, hi = 1; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; held(mixRig(q0, fq0, m)) ? (lo = m) : (hi = m); }  // the page's own frame brought toward its room-safe one as far as they stay whole: the least room
          return Object.assign(deskOut(mixRig(q0, fq0, lo), r => held(r) && roomOf(r).top <= -0.02), { roomy: true });  // and slid up its own screen until its bottom edge lands on the page (a wide frame of someone at the stage's front ended on the book's board)  // roomy: place() and the opening push leave their own room fit off (it pushed the subjects back off the edge)
        }
      }
      if (klass() !== 3 && bd) return kept ?? fq;  // none this moment: the frame it is on while that still holds them, else the closest room-safe one; never the wide view into the room (8.5#2: the swim's stretch not yet framed went for a 4.6 m view and held it)
      return klass() === 3 ? loose ?? (b.kind === "end" ? null : qn) : q0;  // a phone keeps its subjects whole at the lowest fill (farthest back, least steep: the first rung's frame went 32 degrees above Bobo on 8.2); no backdrop: its own frame  // none keeps them whole with no room: their own frame, whole (room may show: Bobo swimming off in 8.5 was cut half a screen), else the room-safe one
    } finally { low = false; near = nearWas; flo = null; }
  };
  const deskOut = (r, ok) => {  // an upright phone's story frame slid up its own screen (the subjects sink toward the bottom, nothing grows) until its bottom edge lands on the page, as far as `ok` (the subjects in the safe frame, no face under the words) and the backdrop's top stays above the read-along panel allow: the book's board and the desk out of the picture (turtle s09's phone frames were 29-33% board at any pitch, the frame being centred on the subjects)
    if (deskOver(r) <= 0) return r;
    if (!ok(r)) return r;  // a frame that already fails `ok` gets no search (review 6: about 80 percent of calls ran all 12 steps for nothing); frames the same within 1.2 mm (camera-10)
    const up = new THREE.Vector3().setFromMatrixColumn(aim(r).matrixWorld, 1), at = s => ({ pos: r.pos.clone().addScaledVector(up, s), look: r.look.clone().addScaledVector(up, s) }), yt = safeNow().yt - 0.02;
    const fine = s => { const q = at(s); return ok(q) && (aim(q), sv.set((bd.x0 + bd.x1) / 2, bd.top, bd.z).project(probe).y >= yt); };
    let hi = 0.5; if (!fine(hi)) { let lo = 0; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; fine(m) ? (lo = m) : (hi = m); } hi = lo; }
    if (hi <= 0 || deskOver(at(hi)) > 0) return at(hi);
    let lo = 0; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; deskOver(at(m)) > 0 ? (lo = m) : (hi = m); }
    return at(hi);
  };
  const underPanel = r => {  // an upright phone's frame slid down (angles kept) until the backdrop's top stands at or above the read-along panel's bottom edge: the wall shows only behind the panel
    const yt = safeNow().yt - 0.02, topAt = q => (aim(q), sv.set((bd.x0 + bd.x1) / 2, bd.top, bd.z).project(probe).y), slide = s => ({ pos: r.pos.clone().setY(r.pos.y - s), look: r.look.clone().setY(r.look.y - s) });
    if (bd.top == null || topAt(r) >= yt) return r;
    let lo = 0, hi = Math.max(0, r.pos.y - 0.32); if (topAt(slide(hi)) < yt) return slide(hi);
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; topAt(slide(m)) >= yt ? (hi = m) : (lo = m); }
    return slide(hi);
  };
  const lift = g => {  // a low beat lies below the reader's polar limit: lift it for the beat, as a face shot does (given back once the camera is inside it again)
    const v = g.pos.clone().sub(g.look), phi = Math.acos(v.y / v.length());
    if (phi <= controls.maxPolarAngle - 0.03) return;
    faceLim ??= { minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle };
    controls.maxPolarAngle = Math.min(deg(85), phi + 0.05);
  };
  function storyCam(t) {
    const s = story, pl = s.line && !/^game\./.test(s.line) ? planOf(s.line) : null;
    if (s.end && SC.endSince < 0) SC.endSince = now; else if (!s.end) SC.endSince = -1;
    opts.halt?.();  // the viewer's own glides (to its game view, set 2.4 s before the line ends, before story.game says so) cut across the director's move: 0.5 m in 0.8 s into the game on 8.4; the director takes every view itself
    let key = null, beat = null;
    if (s.game === "wait" || s.game === "next") key = "game";  // the line before the game plays its own shot to its end; the game's view from the pause after it (live.js waits there until the camera has landed, then the prompt)
    else if (/^game\./.test(s.line ?? "") && s.game === "won") key = "won";
    else if (s.end && now - SC.endSince >= 1.05) key = "end";
    else if (pl?.length) { let i = 0; pl.forEach((b, j) => { if (b.t0 <= s.t) i = j; }); key = `${s.line}#${i}`, beat = pl[i]; }
    if (key !== SC.key && key) {  // a new beat: it waits out a speaker's 1.5 s hold
      const hold = SC.beat && /single|reply/.test(SC.beat.kind) && now - SC.since < 3;
      if (!hold) { if (!SC.key) opts.halt?.();  // the first beat takes the camera from the viewer's glide home
        if (SC.goal?.face) SC.fx = now; if (/^(game|won)$/.test(SC.key) && !/^(game|won)$/.test(key)) SC.gx = now; SC.key = key; SC.endHold = SC.own = null; SC.rel = key === "end" ? SC.goal : null; SC.since = now; SC.sign = null; SC.half = SC.c = SC.v = null; SC.cl = false; SC.beat = beat; SC.pend = null; focus.goal = beat?.names[0] ?? null; }
    }
    if (yielded) { if (!took && !held.on && SC.since >= SC.out + 4) yielded = false, calmFrom = now; else return; }  // the reader's hand wins; after a tap the director returns at the first beat that begins 4 s after they let go, after a real zoom or turn only on the next page
    let g = null;
    // The game's view is the viewer's own (live.js gameView: every target on the screen) unless the page opts in with "own": true inside its shots.game: then that shot is the game's view,
    // read as any other shot (target, framing, size, pitch, at, lead and the phone / tablet overrides, "own" itself among them), room-safe, framed once as the game's view begins (and again when the
    // screen turns) and held while the child plays. Without "own" nothing changes: many Kapi and Mali pages carry a shots.game that was never used. Story-camera pages only (camera.story).
    if (SC.key === "game") { if (!ownGame()) SC.own = null; else if (SC.own?.asp !== cam.aspect) { const r = beatRig(beatOf("game", SH.game), now); SC.own = r && Object.assign(r, { asp: cam.aspect }); } g = SC.own || rigOf("reading"); } else if (SC.key === "won") g = beatRig({ line: "won", t0: 0, len: 3, names: [...new Set([...(m.targets || []), ...actors()])].filter(n => !window.live?.acting?.was?.has(hero(n)?.body)), size: "medium", move: "hold" }, now);  // the game's targets (where its reward grows) and the story's actors, not every visible body: gourd-s01's 36 took the frame to the sky while the rice rose (R26)
    else if (SC.key === "end") { if (!SC.endHold) { const e = endShot(), ns = e?.target != null ? [e.target].flat() : actors(), E = SH.end && typeof SH.end === "object" && !Array.isArray(SH.end) ? SH.end : {}, g0 = beatRig({ line: "end", t0: 0, len: 3, names: ns, size: E.framing ?? "wide", num: E.size, phone: E.phone, tablet: E.tablet, move: "hold", kind: "end" }, now) ?? rigOf(e); SC.endHold = g0 && { pos: g0.pos.clone(), look: g0.look.clone() }; } g = SC.endHold; }  // the close is framed once, as it begins, and held (the page's own size and screen overrides): it lands and stays, so the Next button is placed once and clear (a close that followed its people crept on under it), and a walker who leaves walks out of a still frame  // the story camera's close holds the end's subjects (its people, never everyone: 8.5's otter and kingfisher took it 2.7 m out, into the room) as a beat does (low, room-safe): the reading view's own steep look tipped 8.5's end top-down (34.6°)
    else if (SC.beat) g = SC.beat.reading ? rigOf("reading") : beatRig(SC.beat, now);
    if (g) SC.goal = g;
    if (SC.goal?.face) faceLim ??= { minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle }, Object.assign(controls, { minDistance: Math.min(faceLim.minDistance, 0.05), maxPolarAngle: Math.max(faceLim.maxPolarAngle, deg(110)) });  // the orbit let out for a face beat, as for a face shot (given back once the camera is inside it again)
    else if (SC.goal) { const d = SC.goal.pos.distanceTo(SC.goal.look); if (d < (faceLim?.minDistance ?? controls.minDistance) - 0.01) { SC.goal.near = SC.beat?.names.filter(Boolean).every(n => { const c = hero(n); return !c || (c.bones?.length ?? 0) === 0; }); faceLim ??= { minDistance: controls.minDistance, maxPolarAngle: controls.maxPolarAngle }; controls.minDistance = Math.min(faceLim.minDistance, Math.max(0.05, d - 0.01)); } else lift(SC.goal); }  // a beat of a small subject: the orbit floor is let out to its own fill (any subject), and a paper puppet/extra's fill comes in faster (a 3D small body keeps its own rate, so s01 is untouched)
    const trail = SC.goal ? place({ pos: SC.goal.pos.clone(), look: SC.goal.look.clone() }, t) : 0;
    if (window.live) window.live.hint.landed = trail < 0.02 && SC.key === "end", window.live.hint.hold = SC.key === "end" ? SC.endHold : null;  // the Next page button: placed as the held close will show it, as soon as the close begins (it waited for the landing, 11-17 s on the toad pages)
  }

  // ---------- light: cues on named lights, flicker (DIRECTION.md "light") ----------
  const lights = [], named = {};
  for (const g of new Set([opts.lights, parent].filter(Boolean))) g.traverse(o => o.isLight && !o.isAmbientLight && lights.push(o));
  (m.stage?.lights || []).forEach(l => { const o = lights.find(o => o.position.distanceTo(B(l.at)) < 1e-4); if (o && l.name) named[l.name] = o; });
  const lightOf = n => named[n] || [root.getObjectByName(n)].find(o => o?.isLight) || null;
  const base = new Map(lights.map(o => [o, { c: o.color.clone(), i: o.intensity, p: o.position.clone() }])), tweens = new Map();
  const lightNow = o => { const w = tweens.get(o); if (!w) return null; const k = smooth((now - w.t0) / w.secs); return { c: w.from.c.clone().lerp(w.to.c, k), i: w.from.i + (w.to.i - w.from.i) * k, p: w.from.p.clone().lerp(w.to.p, k) }; };
  const lit = new Map();  // parts a cue lights (a lamp's flame): part -> {from, to, t0, secs, k}
  const cueLight = c => {  // level × the stage watts, tint × its colour, at moves it; eases over seconds and holds; "back" returns it
    const o = lightOf(c.light), part = !o && [root, ...cast.map(ch => ch.body)].map(g => g?.getObjectByName(c.light)).find(Boolean);
    if (part) { const w = lit.get(part); return void lit.set(part, { from: w?.k ?? 0, to: c.back ? 0 : c.level ?? 1, t0: now, secs: Math.max(0.1, c.seconds ?? 0.8) }); }  // a part, not a light: it glows (a candle's "-flame" catching)
    if (!o) return;
    if (!base.has(o)) base.set(o, { c: o.color.clone(), i: o.intensity, p: o.position.clone() });
    const b = base.get(o), from = lightNow(o) || { c: o.color.clone(), i: o.intensity, p: o.position.clone() };
    const tn = new THREE.Color(...(c.tint || [1, 1, 1])); if (tn.b > tn.r) tn.lerp(new THREE.Color(1, 1, 1), 0.85);  // owner 2026-11-18: no blue on people at night: a bluish cue tint is nearly white (the sky and backdrop cards carry the blue); shortcut: lights cannot tell people from scenery, so the scenery's own blue comes from its cards, upgrade with a per-layer light
    const to = c.back ? b : { c: b.c.clone().multiply(tn), i: b.i * (c.level ?? 1), p: c.at ? B(c.at) : b.p.clone() };
    tweens.set(o, { from, to, t0: now, secs: Math.max(0.1, c.seconds ?? 1.5) });
  };
  const flicker = (LI.flicker || []).flatMap(n => { const o = lightOf(n); if (o) return [{ o, i: o.intensity, ph: rnd(0, 9) }];
    const ms = []; find(n).forEach(x => x.traverse(y => y.isMesh && y.material.emissive?.getHex() && ms.push({ m: y.material, i: y.material.emissiveIntensity, ph: rnd(0, 9) }))); return ms; });
  new Set((LI.cues || []).map(c => c.stage).filter(Boolean)).forEach(s => cast.forEach(ch => ch.body.userData.restage?.(s, null, true)));  // the cast's cards for each "stage" fetched as the page is made, so a cue never waits on the network (4.5's night cards came after its day cue on a slow line)
  const pageCards = [];  // V26: the page's own cards that name a stage (art-<path>-day|eve|night|storm): a light cue's "stage" swaps them to their sibling, like a paper puppet's night card
  root.traverse(o => { const mm = o.isMesh && /^art-(.+)-(day|eve|night|storm)(\.\d+)?$/.exec(o.material?.name ?? ""); if (mm && o.material.map) pageCards.push({ o, base: mm[1], own: o.material.map }); });
  const pageStage = async st => {
    const n = ++pageStage.n;
    for (const c of pageCards) {
      const t = st === "day" ? null : await picture(`${c.base}-${st}.png`);  // a missing sibling stays as it is (one 404 for a card without it)
      if (n !== pageStage.n) return;
      const r = c.rect === undefined ? (c.rect = cardRect(root, c.o)) : c.rect, map = t ? (c.tex ??= {})[st] ??= Object.assign(t.clone(), { flipY: false, needsUpdate: true }) : c.own;
      if (t && r && map.offset.x === 0 && map.offset.y === 0) map.repeat.set(1 / (r[2] - r[0]), 1 / (r[3] - r[1])), map.offset.set(-r[0] / (r[2] - r[0]), -r[1] / (r[3] - r[1]));  // the sibling is a picture of its own; the card's uvs are its patch of the atlas: the patch is stretched over the whole sibling (unmapped, Cowherd s07's night sky showed a smeared strip of it)
      if (c.o.material.map !== map) { c.o.material.map = map; c.o.material.needsUpdate = true; }
    }
  }; pageStage.n = 0;
  new Set((LI.cues || []).map(c => c.stage).filter(st => st && st !== "day")).forEach(st => pageCards.forEach(c => picture(`${c.base}-${st}.png`)));  // fetched as the page is made
  ticks.push(t => {
    (LI.cues || []).forEach((c, i) => when(c.line, c.word, `light${i}`)  // the game's light is right from its first frame: done in the pause before its prompt
      && (cueLight(c.line === "game" ? { ...c, seconds: story.game === "next" ? Math.min(c.seconds ?? 1.5, 0.4) : 0 } : c),
        c.stage && (pageStage(c.stage), root.userData.stage = c.stage, [root, group, ...cast.map(ch => ch.body)].forEach(g => g?.traverse(o => o.userData.restage?.(c.stage))))));  // "stage": "day": every paper puppet to its day card from this cue
    for (const [o] of tweens) { const s = lightNow(o); o.color.copy(s.c); o.intensity = s.i; o.position.copy(s.p); }
    for (const [o, w] of lit) if (w.k !== w.to) glow(o, (w.k = w.from + (w.to - w.from) * smooth((now - w.t0) / w.secs)));
    for (const f of flicker) {  // a flame: 0.85..1.0 with soft noise at 6-10 Hz
      const k = 0.925 + 0.045 * Math.sin(t * TAU * 6.3 + f.ph) + 0.03 * Math.sin(t * TAU * 9.7 + 2 * f.ph);
      if (f.o) f.o.intensity = f.i * k; else f.m.emissiveIntensity = f.i * k;
    }
  });
  disposers.push(() => { delete root.userData.stage; pageCards.forEach(c => (c.o.material.map = c.own)); for (const [o, b] of base) { o.color.copy(b.c); o.intensity = b.i; o.position.copy(b.p); } for (const [o] of lit) glow(o, 0); flicker.forEach(f => (f.o ? (f.o.intensity = f.i) : (f.m.emissiveIntensity = f.i))); });

  // ---------- wind: gusts crossing the spread, swaying the pieces in turn (DIRECTION.md "wind") ----------
  const WD = { base: 0.2, gust: 0.5, gust_every: [8, 14], dir: -1, ...W }, sway = [], gusts = [];
  let nextGust = rnd(2, 5);
  const gustAt = (t, x) => {  // the wind at x: the base plus every gust front that has reached it (half the spread's width per 0.4 s)
    const d = (WD.dir > 0 ? x + 1 : 1 - x) / 2.5;
    return WD.base + gusts.reduce((a, g) => { const k = t - g.t0 - d; return a + (k < 0 ? 0 : g.s * (k < 0.6 ? smooth(k / 0.6) : Math.exp(-(k - 0.6) / 2.2))); }, 0);
  };
  const windTick = t => {
    if (t > nextGust) { gusts.push({ t0: t, s: WD.gust }); nextGust = t + rnd(...WD.gust_every); }
    (WD.cues || []).forEach(([line, word, s], i) => when(line, word, `wind${i}`) && gusts.push({ t0: t, s }));
    while (gusts.length && t - gusts[0].t0 > 12) gusts.shift();
    wind = gustAt(t, 0);
    for (const s of sway) {  // a card rocks about its base hinge, its top moving most; laid over whatever the paper's own animation set
      const o = s.o;
      if (!s.last || !o.quaternion.equals(s.last)) s.base.copy(o.quaternion);
      const a = deg(s.deg) * gustAt(t, s.x) * (0.75 + 0.25 * Math.sin(TAU * s.f * t + s.ph));
      s.q.setFromEuler(s.e.set(a * 0.35, 0, a * s.lean));
      if (s.riders.length || s.carry) { o.quaternion.copy(s.base); o.updateWorldMatrix(true, false); s.inv.copy(o.matrixWorld).invert(); }
      o.quaternion.copy(s.base).multiply(s.q);
      (s.last ??= new THREE.Quaternion()).copy(o.quaternion);
      if (s.riders.length || s.carry) {  // fruit and characters in a swaying crown move with it
        o.updateWorldMatrix(false, false); s.delta.multiplyMatrices(o.matrixWorld, s.inv);
        for (const r of s.riders) { if (!r.last || !r.o.position.equals(r.last)) r.p.copy(r.o.position); r.o.position.copy(r.p).applyMatrix4(s.delta); (r.last ??= new THREE.Vector3()).copy(r.o.position); }
      }
    }
  };
  disposers.push(() => sway.forEach(s => s.last && s.o.quaternion.equals(s.last) && s.o.quaternion.copy(s.base)));

  // ---------- extras' sounds, and rings on the water ----------
  const heard = [], hush = (m.sound?.hush || []).map(() => false);
  const hushTick = () => (m.sound?.hush || []).forEach(([a, b], i) => { if (when(a, "", `hush${i}`)) hush[i] = true; if (when(b, "", `unhush${i}`)) hush[i] = false; });
  const sound = (name, who) => {  // at most two extras' sounds in any one second, and none inside a hush span
    if (!name || hush.some(Boolean)) return;
    heard.splice(0, heard.length, ...heard.filter(h => now - h < 1));
    if (heard.length >= 2) return;
    heard.push(now); dispatchEvent(new CustomEvent("ambient:sound", { detail: { name, who } }));
  };
  let ring = () => {};  // set up when the spread comes alive

  // ---------- the spread comes alive: measure it, then set everything in place ----------
  async function build(t) {
    built = true;
    root.updateMatrixWorld(true);
    const cards = standing(root);
    const cardOf = o => cards.find(c => c.g === o || c.mesh === o || o.getObjectById(c.g.id) || c.g.getObjectById(o.id));
    const page = pageOf(root), Y = page.max.y, D = page.max.z - page.min.z;
    const region = name => {
      const b = new THREE.Box3(); (name ? find(name) : []).forEach(o => b.expandByObject(o));
      return !b.isEmpty() ? { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, y: b.max.y }
        : { x0: page.min.x + 0.1, x1: page.max.x - 0.1, z0: page.min.z + 0.45 * D, z1: page.max.z - 0.06, y: Y };  // shortcut: no "water" piece yet, so the near half of the painted pages
    };
    const water = region("water"), onWater = p => p.y <= water.y + 0.012 && p.x > water.x0 && p.x < water.x1 && p.z > water.z0 && p.z < water.z1;
    const view = cam.clone(); view.position.copy(HOME); view.lookAt(LOOK); view.updateMatrixWorld();
    const ray = new THREE.Vector3(), eye = new THREE.Vector3(), sky = (sy, z, c = cam) => {  // the height at depth z a camera shows at screen height sy (0 = top)
      eye.setFromMatrixPosition(c.matrixWorld);  // as last drawn: the live camera's position this frame is ahead of its matrices
      ray.set(0, 1 - 2 * sy, 0.5).unproject(c).sub(eye);
      return eye.y + ray.y * (z - eye.z) / ray.z;
    };
    const tuck = (f, o, h, dt) => {  // a sky card folds flat while a close shot would lift it into the read-along page's quarter, and back
      const v = tmp.set(o.position.x, o.position.y + h / 2, o.position.z).project(cam), up = Math.abs(v.x) < 1.1 && (1 - v.y) / 2 < 0.27;
      return (f.k = Math.max(0, Math.min(1, f.k + (up ? -dt : dt) / 0.4))) * f.k * (3 - 2 * f.k) || 1e-3;
    };
    const halfWidth = z => { const d = new THREE.Vector3(1, 0, 0.5).unproject(view).sub(HOME).normalize(); return HOME.x + d.x * (z - HOME.z) / d.z; };
    bd = skyline(root, cards, m.backdrop);
    const walls = bd?.walls ?? [], backdrop = walls.reduce((a, c) => Math.max(a, c.box.max.z), -Infinity);
    const back = backdrop > -Infinity ? backdrop : page.min.z + 0.05;  // clouds and birds hang in front of the whole backdrop (a V-fold's wings come forward), or over the back edge
    for (const n of A.retire || []) find(n).forEach(o => { if (o.visible) { o.visible = false; disposers.push(() => (o.visible = true)); } });  // page fx an extra replaces
    const born = t;

    // wind on the pieces the page names, else on every plant
    const list = W.sway || cards.filter(c => PLANT.test(c.name)).map(c => [c, /tree|palm|bamboo|crown|canopy/.test(c.name) ? 1.2 : /branch/.test(c.name) ? 3 : /reed|grass/.test(c.name) ? 5 : 3]);
    const foldOf = c => { const p = c.g.parent; return p && p !== root && cards.filter(d => d.g.parent === p).length > 1 ? p : c.g; };  // a V-fold's halves sway as one, or a seam opens down the fold
    for (const [n, dg] of list) for (const c of new Set((typeof n === "string" ? find(n).map(cardOf) : [n]).filter(Boolean))) {
      const g = foldOf(c), box = g === c.g ? c.box : new THREE.Box3().setFromObject(g);
      if (sway.some(s => s.o === g)) continue;
      const h = box.max.y - box.min.y, xw = new THREE.Vector3(1, 0, 0).transformDirection(g.matrixWorld), riders = [];
      if (h > 0.3) {  // fruit and characters inside a tall card's picture ride its sway
        const b = box.clone().expandByScalar(0.04);
        root.children.forEach(o => o.isMesh && !cardOf(o) && b.containsPoint(o.position) && riders.push({ o, p: o.position.clone() }));
        cast.forEach(ch => b.containsPoint(ch.body.position) && riders.push({ o: ch.body, p: ch.body.position.clone() }));
      }
      sway.push({ o: g, base: g.quaternion.clone(), q: new THREE.Quaternion(), e: new THREE.Euler(), last: null, deg: dg, x: box.getCenter(tmp).x,
        lean: -Math.sign(xw.x * WD.dir) || 1, f: THREE.MathUtils.clamp(0.9 / Math.sqrt(h / 0.2), 0.3, 1.3), ph: rnd(0, TAU),
        riders, delta: new THREE.Matrix4(), inv: new THREE.Matrix4(), b: h > 0.3 ? box.clone().expandByScalar(0.04) : null });
    }

    // the water: rings where something touches it, and glints drifting with the current
    const WA = { ripple: 0.3, flow: 0.012, ...(A.water || {}) };
    if (A.water && WA.ripple > 0) {
      const pool = Array.from({ length: 12 }, () => {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
          opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        r.visible = false; group.add(r); return { r, t0: -9, size: 0.04 };
      });
      ring = (p, size = 0.04) => { const q = pool.reduce((a, b) => (a.t0 < b.t0 ? a : b)); q.t0 = now; q.size = size; q.r.position.set(p.x, water.y + 0.003, p.z); q.r.visible = true; };
      ticks.push(() => pool.forEach(q => { const k = (now - q.t0) / 1.4; q.r.visible = k < 1; if (k < 1) { q.r.scale.setScalar(q.size * (0.2 + 1.3 * ease(k))); q.r.material.opacity = 0.6 * WA.ripple * (1 - k); } }));
      const u = { uT: { value: 0 }, uA: { value: 0 } }, w = water.x1 - water.x0, d = water.z1 - water.z0;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform float uT, uA; varying vec2 vUv;
          float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
          void main() { vec2 p = vUv * vec2(${(w * 34).toFixed(1)}, ${(d * 34).toFixed(1)});
            float g = n(p - vec2(uT, 0.0)) * n(p * 1.7 + vec2(uT * 0.4, uT * 0.6));
            vec2 e = smoothstep(0.0, 0.12, vUv) * smoothstep(0.0, 0.12, 1.0 - vUv);
            gl_FragColor = vec4(vec3(1.0, 0.96, 0.85), uA * smoothstep(0.55, 0.85, g) * e.x * e.y); }` }));
      sh.position.set((water.x0 + water.x1) / 2, water.y + 0.002, (water.z0 + water.z1) / 2); sh.renderOrder = 1; group.add(sh);
      const glint = stage === "night" ? 0.25 : 0.6;
      ticks.push((t, dt) => { u.uT.value += (WA.flow * 34 + 0.15) * dt; u.uA.value = glint * WA.ripple * Math.min(1, (t - born) / 2); });  // flowing with the current, in glint cells
    }

    // clouds: paper cards drifting across the sky band with the wind, nearer ones faster; the top quarter of the screen stays clear
    for (let i = 0; i < (A.clouds || 0); i++) {
      const z = back + 0.03 + 0.04 * i + rnd(0, 0.02), w = rnd(0.24, 0.36) * (1 - 0.08 * i), sp = (0.012 + 0.006 * i) * rnd(0.85, 1.15), half = halfWidth(z) + w;
      picture(`${A.cards}/cloud-${i % 3 + 1}${VER[stage] || ""}.png`).then(tex => {
        const asp = tex ? tex.image.width / tex.image.height : 2.4, h = w / asp, c = card(w, h, tex || cutShape("#f4f6fb"), stage === "night" ? 0.08 : 0.32);
        const y = bd ? bd.top - 0.03 - h / 2 - rnd(0, 0.07) : sky(rnd(0.28, 0.36), z, view) - h / 2;  // in the backdrop's sky (DIRECTION.md: soft things may cross the top), else the reading view's sky band
        const [lo, hi] = bd ? [bd.x0 + w / 2, bd.x1 - w / 2] : [-half, half];  // a backdrop's clouds stay within its ends, folding away at them
        c.position.set(rnd(lo, hi), y, z); c.userData.sky = true; group.add(c);
        const ph = rnd(0, TAU), b = now, fold = { k: 1 };
        ticks.push((t, dt) => {
          c.position.x += sp * (0.7 + 0.8 * wind) * Math.sign(WD.dir || 1) * dt;
          if (c.position.x > hi) c.position.x = lo; if (c.position.x < lo) c.position.x = hi;
          c.position.y = y + 0.004 * Math.sin(0.4 * t + ph); c.rotation.z = 0.015 * Math.sin(0.3 * t + ph);
          c.scale.setScalar(Math.max(1e-3, pop((t - b) / 0.8) * (bd ? clamp01(Math.min(c.position.x - lo, hi - c.position.x) / 0.06) : 1)));
          if (!bd) c.scale.y *= tuck(fold, c, h, dt);
        });
      });
    }

    // birds: a little flock crosses the sky now and then, and on the page's own moments ("on")
    const BD = { count: 2, every: 12, kind: "bird", ...(A.birds || {}) };
    if (A.birds && BD.count > 0) {
      const kind = BD.kind, pid = kind === "bat" ? "fruit-bat" : kind, defs = /parakeet|bat/.test(kind) ? await puppetDefs() : {};
      const [up, down] = defs[pid] ? [] : kind === "egret" ? [await picture(`${A.cards}/egret.png`)] : await Promise.all([picture(`${A.cards}/bird-up.png`), picture(`${A.cards}/bird-down.png`)]);
      const flock = await Promise.all(Array.from({ length: BD.count }, async () => {
        const b = new THREE.Group(), w = rnd(0.07, 0.09), f = { b, ph: rnd(0, TAU), f: rnd(2.6, 3.4) };
        if (BD.model) { const m = await extra3d({ name: "bat", model: BD.model, pose: "fly", height: w * 0.8 }, undefined, { stage, cast, pups }); if (m) { f.m = m; b.add(m.root); disposers.push(() => m.dispose?.()); } }  // a 3D flock member (extras3d.js): its Fly clip loops, the flock's group places and flips it; none loaded: the paper below
        if (f.m) {}
        else if (defs[pid]) { f.p = await puppet(pid, { ...defs[pid], size: w * 0.8 }, stage); b.add(f.p.root); }
        else {
          f.u = card(w, up ? w * up.image.height / up.image.width : w * 0.4, up || cutShape("#f4f1e8"), 0.3); b.add(f.u);
          if (down) { f.d = card(w, w * down.image.height / down.image.width, down, 0.3); b.add(f.d); }
        }
        b.visible = false; b.userData.sky = true; group.add(b); return f;
      }));
      let next = now + 2.5, fly = null;
      const launch = () => {  // across the backdrop, end to end (or the whole sky without one)
        const z = back + rnd(0.05, 0.14), dir = Math.random() < 0.5 ? 1 : -1, half = halfWidth(z) + 0.25, [lo, hi] = bd ? [bd.x0 + 0.06, bd.x1 - 0.06] : [-half, half];
        fly = { t0: now, z, dir, lo, hi, y: bd ? bd.top - rnd(0.1, 0.2) : sky(rnd(0.36, 0.42), z), rise: rnd(-0.05, 0.02), fold: { k: 1 } }; fly.dur = (hi - lo + 0.1 * BD.count) / rnd(0.3, 0.38);
      };
      ticks.push((t, dt) => {
        (BD.on || []).forEach(([line, word], i) => when(line, word, `birds${i}`) && !fly && launch());
        if (!fly && t > next) launch();
        if (!fly) return void (flockAt = null);
        const k = (t - fly.t0) / fly.dur;
        flock.forEach((f, i) => {
          const u = k * (1 + 0.1 * BD.count / (fly.hi - fly.lo)) - 0.1 * i / (fly.hi - fly.lo), x = fly.dir > 0 ? fly.lo + (fly.hi - fly.lo) * u : fly.hi - (fly.hi - fly.lo) * u, flap = Math.sin(TAU * f.f * t + f.ph);
          const edge = bd ? clamp01(Math.min(x - fly.lo, fly.hi - x) / 0.06) : 1;  // a bird appears and leaves at the backdrop's ends
          f.b.visible = k < 1 && u >= 0 && u <= 1;
          f.b.position.set(x, fly.y + fly.rise * k + (i % 2 ? -0.02 : -0.04) * Math.min(i, 1) + 0.006 * flap, fly.z + 0.025 * i);
          f.b.scale.set(fly.dir, 1, 1).multiplyScalar(bd ? Math.max(1e-3, edge) : i ? fly.fold.k : tuck(fly.fold, f.b, 0.06, dt));
          if (f.m) {}
          else if (f.p) { const [n, hz] = Object.entries(f.p.def.cycles || {})[0] || []; if (n) pose(f.p, { [n]: beat(hz, t + f.ph) }); }
          else if (f.d) { f.u.visible = flap > 0; f.d.visible = flap <= 0; } else f.u.scale.y = 0.75 + 0.25 * flap;
        });
        flockAt = flock[0].b.position;
        if (k >= 1) fly = null, next = t + jit(BD.every);
      });
    }

    // crawlers: a ladybug climbing along the top edge of a foreground card, pausing, climbing on
    for (const cr of A.crawlers || []) {
      const c = (cr.on && find(cr.on).map(cardOf).find(Boolean))
        || [...cards].filter(c => c.box.max.y - Y < 0.4).sort((a, b) => (PLANT.test(b.name) - PLANT.test(a.name)) || b.box.max.z - a.box.max.z)[0];
      if (!c) continue;
      const pos = c.mesh.geometry.attributes.position, n = 56, top = new Array(n).fill(-1);
      const bb = c.mesh.geometry.boundingBox, x0 = bb.min.x, x1 = bb.max.x;
      for (let i = 0; i < pos.count; i++) { const j = Math.min(n - 1, Math.floor((pos.getX(i) - x0) / (x1 - x0) * n)); top[j] = Math.max(top[j], pos.getY(i)); }
      const path = [];  // the card's top silhouette, in its own space: up and down every blade
      top.forEach((y, j) => y >= 0 && path.push(new THREE.Vector2(x0 + (j + 0.5) / n * (x1 - x0), y)));
      if (path.length < 3) continue;
      const len = [0]; for (let i = 1; i < path.length; i++) len.push(len[i - 1] + path[i].distanceTo(path[i - 1]));
      const at = s => { let i = len.findIndex(l => l >= s); i = Math.max(1, i < 0 ? len.length - 1 : i);
        const k = (s - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]); return [path[i - 1].clone().lerp(path[i], k), path[i].clone().sub(path[i - 1])]; };
      const size = cr.size ?? 0.022, side = Math.sign(tmp.set(0, 0, 1).transformDirection(c.g.matrixWorld).dot(HOME.clone().sub(c.box.getCenter(new THREE.Vector3())))) || 1;
      picture(`${A.cards}/${cr.card || "ladybug"}.png`).then(tex => {
        const bug = card(size, tex ? size * tex.image.height / tex.image.width : size, tex || cutShape("#c8281e"));
        bug.castShadow = false; c.g.add(bug); disposers.push(() => bug.removeFromParent());
        let s = rnd(0.2, 0.6) * len.at(-1), dir = 1, goal = s, rest = 0;
        ticks.push((t, dt) => {
          if (rest > 0) rest -= dt;
          else if (Math.abs(goal - s) < 1e-4) { rest = rnd(0.7, 2.4); if (Math.random() < 0.35 || goal <= 0.02 || goal >= len.at(-1) - 0.02) dir = -dir;
            goal = THREE.MathUtils.clamp(s + dir * rnd(0.04, 0.13), 0.01, len.at(-1) - 0.01); }
          else s += Math.sign(goal - s) * Math.min(Math.abs(goal - s), (cr.speed ?? 0.022) * dt);
          const [p, d] = at(s), go = goal >= s ? 1 : -1;
          bug.position.set(p.x, p.y - size * 0.32, side * 0.004);
          bug.rotation.set(0, side < 0 ? Math.PI : 0, Math.atan2(go * d.y, go * d.x * side) - Math.PI / 2 + (rest > 0 ? 0.08 * Math.sin(t * 7) : 0));
          bug.scale.setScalar(Math.max(1e-3, pop((t - born) / 0.6)));
        });
      });
    }

    // motes: glowing dust and spray rising off the water, fading
    const MO = { count: 40, color: [1, 0.95, 0.8], ...(A.motes || {}) };
    if (A.motes && MO.count > 0) {
      const R = region(MO.over), N = MO.count, P = new Float32Array(N * 3), C = new Float32Array(N * 3), S = [];
      const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(P, 3)).setAttribute("color", new THREE.BufferAttribute(C, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.028, map: sprite("#fff #fffa #fff0"), vertexColors: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending }));
      pts.frustumCulled = false; group.add(pts);
      const col = new THREE.Color(...MO.color).multiplyScalar(stage === "day" ? 1.5 : 2.2);
      const mx0 = Math.max(R.x0, bd?.x0 ?? -Infinity), mx1 = Math.min(R.x1, bd?.x1 ?? Infinity);  // inside the backdrop's ends
      const spawn = (s, t) => Object.assign(s, { x: rnd(mx0, mx1), z: rnd(R.z0, R.z1), y: R.y + 0.004, v: rnd(0.012, 0.04), t0: t, life: rnd(3, 6.5), ph: rnd(0, TAU) });
      for (let i = 0; i < N; i++) S.push(spawn({}, t - rnd(0, 6)));
      ticks.push((t, dt) => {
        S.forEach((s, i) => {
          let k = (t - s.t0) / s.life;
          if (k >= 1 || s.x < mx0 || s.x > mx1) spawn(s, t), k = 0;
          s.y += s.v * dt; s.x += (0.012 * wind * WD.dir + 0.004 * Math.sin(t + s.ph)) * dt;
          P.set([s.x, s.y, s.z + 0.006 * Math.sin(0.7 * t + s.ph)], i * 3);
          const a = Math.sin(Math.PI * k) * Math.min(1, (t - born) / 2);
          C.set([col.r * a, col.g * a, col.b * a], i * 3);
        });
        geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
      });
    }

    // mist: low soft sheets drifting over the water
    const MI = { opacity: 0.1, ...(A.mist || {}) };
    if (A.mist && MI.opacity > 0) {
      const R = region(MI.over), w = (R.x1 - R.x0) * 1.15, d = (R.z1 - R.z0) * 1.3;
      const tint = { day: [0.88, 0.92, 1], evening: [1, 0.86, 0.78], night: [0.5, 0.6, 0.85] }[stage] || [0.9, 0.92, 1];
      for (let i = 0; i < 1; i++) {  // one sheet: two layers drifting against each other in the shader
        const u = { uT: { value: rnd(0, 50) }, uOp: { value: 0 }, uCol: { value: new THREE.Color(...tint) } };
        const mist = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
          uniforms: u, transparent: true, depthWrite: false,
          vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform float uT, uOp; uniform vec3 uCol; varying vec2 vUv;
            float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
              return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
            void main() { vec2 p = vUv * vec2(5.0, 3.0) + vec2(uT * 0.05, uT * 0.013);
              float d = max(0.62 * n(p) + 0.38 * n(p * 2.3 - vec2(uT * 0.031, 0.0)), 0.6 * n(p * 0.8 + vec2(-uT * 0.06, 5.0)) + 0.4 * n(p * 1.9 + vec2(3.0, uT * 0.02)));
              vec2 e = smoothstep(0.0, 0.3, vUv) * smoothstep(0.0, 0.3, 1.0 - vUv);
              gl_FragColor = vec4(uCol, uOp * smoothstep(0.38, 0.8, d) * e.x * e.y); }` }));
        mist.position.set((R.x0 + R.x1) / 2, R.y + 0.012 + 0.018 * i, (R.z0 + R.z1) / 2 + 0.03 * i);
        mist.renderOrder = 2; group.add(mist);
        const sp = (i % 2 ? -1 : 1) * rnd(0.6, 1.1);
        ticks.push((t, dt) => { u.uT.value += sp * (0.6 + 1.2 * wind) * dt; u.uOp.value = 1.1 * MI.opacity * Math.min(1, (t - born) / 3) * (0.85 + 0.15 * Math.sin(0.23 * t + i)); });
      }
    }

    // drift: leaves floating down the current, or blown across the air; kind "seed": white tufted seed fluff floating slowly in the air, rising and falling, glinting in the sun
    const DR = A.drift;
    if (DR?.count > 0) {
      const seed = DR.kind === "seed", tex = seed ? seedFluff() : await picture(DR.card.includes("/") ? `${DR.card}.png` : `${A.cards}/${DR.card}.png`), air = seed || DR.over === "air", R = air ? region(null) : water;
      for (let i = 0; i < DR.count; i++) {
        const w = seed ? rnd(0.028, 0.036) : rnd(0.035, 0.05), c = card(w, tex ? w * tex.image.height / tex.image.width : w * 0.5, tex || cutShape("#7a9a3c"), seed ? 0.3 : 0.15);
        if (seed) c.material.emissive.setRGB(1, 0.85, 0.6);  // the low sun through the fluff
        const leaf = new THREE.Group(); leaf.add(c); if (!air) c.rotation.x = -Math.PI / 2;
        const reset = x => leaf.position.set(x, air ? Y + rnd(0.1, 0.45) : R.y + 0.003, rnd(R.z0, R.z1));
        reset(rnd(R.x0, R.x1)); group.add(leaf);
        const ph = rnd(0, TAU);
        ticks.push((t, dt) => {
          const v = seed ? 0.02 * (0.4 + wind) * WD.dir : air ? 0.05 * (0.4 + wind) * WD.dir : (A.water?.flow ?? 0.012) + 0.004 * wind * WD.dir;
          leaf.position.x += v * dt; leaf.position.z += 0.003 * Math.sin(0.5 * t + ph) * dt;
          if (seed) { leaf.position.y += 0.025 * Math.sin(0.45 * t + ph) * dt; leaf.quaternion.copy(cam.quaternion); c.rotation.set(0.2 * Math.sin(0.7 * t + ph), 0.6 * Math.sin(0.3 * t + ph), 0.25 * Math.sin(0.6 * t)); c.material.emissiveIntensity = 0.3 + 0.3 * Math.max(0, Math.sin(0.8 * t + ph)) ** 3; c.visible = leaf.getWorldPosition(tmp).project(cam).y <= safeNow().yt; }  // never across the read-along words (review 1 S4: one drifted through the line on desktop)  // rises and falls ~5 cm over 14 s, facing the camera, tuft up, turning a little (a steep phone view never sees it edge-on); now and then it catches the sun
          else if (air) { leaf.position.y += 0.01 * Math.sin(1.3 * t + ph) * dt; c.rotation.set(0.6 * Math.sin(1.1 * t + ph), 0.8 * t + ph, 0.4 * Math.sin(0.9 * t)); }
          else { c.rotation.z = 0.3 * t * Math.sign(v) + ph; leaf.position.y = R.y + 0.003 + 0.0015 * Math.sin(1.7 * t + ph); }
          if (leaf.position.x > R.x1 + 0.05 || leaf.position.x < R.x0 - 0.05) reset(v >= 0 ? R.x0 - 0.04 : R.x1 + 0.04);
          leaf.scale.setScalar(Math.max(1e-3, pop((t - born) / 0.8)));
        });
      }
    }

    // smoke: thin smoke rising from the named pieces (village roofs, cooking boats)
    for (const n of A.smoke || []) {
      const f = frame(n); if (!f) continue;
      const N = 14, P = new Float32Array(N * 3), C = new Float32Array(N * 3);
      const geo = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(P, 3)).setAttribute("color", new THREE.BufferAttribute(C, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, map: sprite("#fff #fff8 #fff0"), vertexColors: true, transparent: true, depthWrite: false }));
      pts.frustumCulled = false; group.add(pts);
      const grey = stage === "night" ? 0.25 : 0.7;
      ticks.push(t => {
        for (let i = 0; i < N; i++) {
          const k = ((t + i * 0.4) % 5.6) / 5.6, a = grey * Math.sin(Math.PI * k) * 0.8;
          P.set([f.top.x + 0.06 * k * wind * WD.dir + 0.01 * Math.sin(3 * k + i), f.top.y + 0.25 * k, f.top.z], i * 3); C.set([a, a, a], i * 3);
        }
        geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
      });
    }

    // light shafts by day: faint warm beams slanting in from the key light, behind the middle ground
    const nShafts = per(A.shafts), key = lights.filter(o => o.isDirectionalLight).reduce((a, o) => (!a || o.intensity > a.intensity ? o : a), null);
    if (nShafts > 0 && key) {
      const c = document.createElement("canvas"), g = c.getContext("2d"); c.width = 32; c.height = 256;
      const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, "#0000"); v.addColorStop(0.4, "#0000"); v.addColorStop(0.65, "#fff"); v.addColorStop(1, "#0000");  // nothing in the top of the beam: the read-along band stays calm
      g.fillStyle = v; g.fillRect(0, 0, 32, 256);
      const hz = g.createLinearGradient(0, 0, 32, 0); hz.addColorStop(0, "#000"); hz.addColorStop(0.5, "#0000"); hz.addColorStop(1, "#000");
      g.globalCompositeOperation = "destination-out"; g.fillStyle = hz; g.fillRect(0, 0, 32, 256);
      const tex = new THREE.CanvasTexture(c);
      const dir = key.target.getWorldPosition(new THREE.Vector3()).sub(key.getWorldPosition(new THREE.Vector3())).normalize();
      for (let i = 0; i < nShafts; i++) {
        const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 0.9, 0.7), transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
        const beam = new THREE.Mesh(new THREE.PlaneGeometry(rnd(0.12, 0.22), 1.3), mat);
        const mid = new THREE.Vector3(page.min.x * 0.6 + i * 0.45 + rnd(-0.08, 0.08), Y + 0.4, page.min.z + 0.25 * D + rnd(0, 0.15));
        const Yax = dir.clone().negate(), Z = HOME.clone().sub(mid).projectOnPlane(Yax).normalize(), X = Yax.clone().cross(Z);
        beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Yax, Z)); beam.position.copy(mid);
        beam.renderOrder = 3; group.add(beam);
        const ph = rnd(0, TAU);
        ticks.push(t => { mat.opacity = (0.05 + 0.03 * Math.sin(0.25 * t + ph)) * (1 - 0.4 * Math.min(1, wind)) * Math.min(1, (t - born) / 3); });
      }
    }

    // extras: paper puppets with routines, taps and story cues (DIRECTION.md "extras"), then the surprises a child finds
    const defs = (m.extras?.length || A.surprises?.length) ? await puppetDefs() : {};
    const add = async (e, o) => {
      const p = e.model && await extra3d(e, defs[e.puppet], { stage: e.grade ?? stage, cast, pups, still: o.still })  // a 3D model (extras3d.js), with a puppet's interface; null if it does not load
        || (e.card && !e.puppet ? await cardPuppet(e.card.includes("/") ? `${e.card}.png` : `${A.cards}/${e.card}.png`, e.size ?? 0.03)  // a surprise that is a card
        : await puppet(e.puppet || "extra", (d => ({ ...d, size: e.height ?? e.size ?? d.size }))(defs[e.puppet] || { size: 0.06, parts: ["body"], gait: "walk" }), e.grade ?? stage)), def = p.def;  // the entry's height (or size) wins over the puppet's own, as a 3D model's does; tools/stage_check.mjs reads the same
      const home = spot(e.at); if (!home) return null;  // its anchor is not in this spread
      if (e.along) { home.x += (e.shift || 0) - e.along; home.z += 0.015; }  // along: a crawler on the top edge of the named piece `at`, to and fro 2 x along (m) across it, its middle `shift` m along x from the piece's middle; a little in front of it
      if (o.dx) home.add(o.dx);
      const path = e.along ? [home.clone(), home.clone().setX(home.x + 2 * e.along)] : (e.path || []).map(spot).filter(Boolean).map(v => (o.dx ? v.add(o.dx) : v));
      if (e.layer === "back" && walls.length) for (const v of [home, ...path]) {  // 0.04 in front of the built backdrop at its x
        const h = new THREE.Raycaster(new THREE.Vector3(v.x, v.y + 0.02, page.min.z - 0.5), new THREE.Vector3(0, 0, 1)).intersectObjects(walls.map(c => c.mesh), false)[0];
        if (h) v.z = Math.max(v.z, h.point.z + 0.04);
      }
      if (def.gait === "swim" && onWater(home)) home.y = water.y - 0.25 * p.size;  // a swimmer floats half in the water
      if (coarse) p.meshes.forEach(m => (m.castShadow = false));  // a tablet: a soft contact shadow instead of the shadow map
      const x = { e, p, def, home, path, wp: 0, face: e.face || 1, fs: e.face || 1, hidden: false, step: null, ri: -1, queue: [], later: [], delay: o.delay || 0, still: o.still, pose: e.pose, id: pups.length, on: e.along ? find(e.at) : null };
      // face: -1 starts a puppet looking to -x (its art looks to +x); a "go" or "turn" then sets it as before
      p.root.position.copy(home); p.root.rotation.y = { back: Math.PI, left: -0.35, right: 0.35 }[e.seen_from] || 0;  // a flat card leans only 20° to its side: the reader orbits ±50°, so it is never seen edge-on
      p.root.scale.setScalar(1e-3); p.root.name ||= e.name ?? ""; group.add(p.root); pups.push(x);  // named, so a shot can name an extra
      p.x = x;  // a 3D extra plays the clip of the step its routine is on
      if ((x.sw = sway.find(s => s.b?.containsPoint(home)))) x.sw.carry = true;
      if (coarse) { x.cs = new THREE.Mesh(new THREE.PlaneGeometry(p.size, p.size * 0.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false, alphaMap: dot }));
        group.add(x.cs); }
      return x;
    };
    const coarse = matchMedia("(pointer: coarse)").matches, dot = coarse && sprite("#fff #fff8 #000");
    let animated = 0;
    for (const e of m.extras || []) {
      const n = e.count || 1;
      for (let k = 0; k < n; k++) {  // copies: trailing along the path, or each at its own fixed offset within 0.08 with its own timing
        const dx = n > 1 && !e.trail && k ? new THREE.Vector3(rnd(-0.08, 0.08), 0, rnd(-0.08, 0.08)) : null;
        await add(e, { dx, delay: e.trail ? k * e.trail / 0.08 : n > 1 ? rnd(0, 2) : 0, still: ++animated > 12 });  // at most 12 animated puppets, copies counted
      }
    }
    for (const e of A.surprises || []) { const x = await add(e, {}); if (x) x.surprise = { seen: false, check: 0 }; }
    ticks.push((t, dt) => { for (const x of pups) extra(x, t, dt); });
    if (canvas && pups.length) {  // a tap on an extra: its move and sound at once, then its routine resumes
      const rc = new THREE.Raycaster(), hit = new Map(pups.flatMap(x => x.p.meshes.map(m => [m, x])));
      rc.params.generous = true;  // extras3d.js: a tap in a 3D extra's box beside its body still answers it
      let press = null;
      const down = e => { press = [e.clientX, e.clientY, performance.now()]; };
      const up = e => {
        if (!press || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 8 || performance.now() - press[2] > 450) return void (press = null);
        press = null;
        const b = canvas.getBoundingClientRect();
        rc.setFromCamera(new THREE.Vector2(2 * (e.clientX - b.left) / b.width - 1, 1 - 2 * (e.clientY - b.top) / b.height), cam);
        const h = rc.intersectObjects([...hit.keys()].filter(m => m.visible && m.parent.parent), false)[0], x = isOpen() && story.game !== "wait" && hit.get(h?.object);
        if (!x || ["card", "reaction", "game"].includes(window.live?.lastTap?.kind) && window.live.lastTap.who !== x.e.name) return;  // while a game runs, taps pass through to its targets; on or beside an extra, when live.js has just answered something else (its pointerup listener runs first; it clears lastTap every tap): that thing's tap alone
        dispatchEvent(new CustomEvent("ambient:tap", { detail: { name: x.e.name, at: x.p.root } }));  // at: the word card points at the extra, not at the first cast member
        const [mv, snd] = x.e.tap || [x.e.move || "jump", x.e.sound];
        heard.length = 0; sound(snd, x.e.name);  // a tap always answers
        interrupt(x, mv, true);
      };
      canvas.addEventListener("pointerdown", down, true); canvas.addEventListener("pointerup", up);  // capture: a press in a page-turn corner (live.js stops it there) still reaches a frog sitting in it
      disposers.push(() => { canvas.removeEventListener("pointerdown", down, true); canvas.removeEventListener("pointerup", up); });
    }

    // cloud shadows slide with the wind
    if (shade > 0) { const at = SHADE.uCloudAt.value; ticks.push((t, dt) => { at.x -= 0.012 * (0.5 + wind) * WD.dir * dt; at.y += 0.004 * dt; at.z = shade * Math.min(1, (t - born) / 3); }); }

    // ---------- one extra, each frame ----------
    function interrupt(x, mv, tapped) {
      const left = x.def.moves?.crawl0 && x.step?.a?.startsWith("go") && x.path.length ? x.step.secs - (now - x.step.t0) : 0;  // a crawler tapped mid-leg finishes that leg after its move, at its own pace (else the routine's next step sent it back where it came from and it crawled on the spot for most of a minute)
      x.queue = mv.startsWith("hide") && tapped ? [["wait", 2], ["show", 1]] : [];  // tapped into hiding: back 2 s later
      if (left > 0.2) { x.wp = (x.wp - 1 + x.path.length) % x.path.length; x.queue.push(["go", left]); }
      begin(x, [mv, mv.startsWith("hide") ? 0.8 : 1.4], true); x.step.tap = tapped;
    }
    function begin(x, step, now_) {
      const [a, secs = 1, snd] = step, p = x.p, gait = x.def.gait || "walk";
      const s = x.step = { a, secs: a === "wait" ? jit(secs) : Math.max(0.2, secs), snd, t0: now, from: (x.at || p.root.position).clone(), sounded: !snd || now_ };
      if (a.startsWith("go")) {
        if (x.path.length) { x.wp = (x.wp + 1) % x.path.length; s.to = x.path[x.wp].clone(); } else s.to = s.from.clone();
        if (/swim|glide/.test(gait) && onWater(s.to)) s.to.y = s.from.y;
        if (Math.abs(s.to.x - s.from.x) > 0.004) x.face = Math.sign(s.to.x - s.from.x);
        s.hops = Math.max(1, Math.round(s.from.distanceTo(s.to) / (p.size * 1.5)));
      }
      if (a.startsWith("hide")) s.a = "hide";
      if (a.startsWith("hide") && !x.hidden) {  // by gait, or as forced: under the water (or the page), up and away, or down behind its anchor
        const how = a.split(":")[1] || (gait === "fly" ? "away" : gait === "swim" || onWater(s.from) ? "under" : "behind");
        x.shown = s.from.clone();
        s.to = how === "away" ? s.from.clone().add(new THREE.Vector3(x.face * 0.6, 0.45, 0)) : how === "under" ? s.from.clone().addScaledVector(UP, -1.3 * p.size) : s.from.clone().add(new THREE.Vector3(0, -0.6 * p.size, -0.08));
        if (how === "under" && onWater(s.from)) ring(s.from, p.size);
      }
      if (a === "show") { if (!x.hidden) s.a = "wait"; else { x.hidden = false; p.root.visible = true; s.to = x.shown || x.home.clone(); if (onWater(s.to)) ring(s.to, p.size); } }
      if (a === "turn") x.face = -x.face;
      if (a === "jump" && onWater(s.from)) ring(s.from, p.size);
    }
    function ended(x) { if (x.step?.a === "hide" && x.step.to && !x.hidden) { x.hidden = true; x.p.root.visible = false; } }  // a hide that ran out of time is hidden
    function extra(x, t, dt) {
      const p = x.p, gait = x.def.gait || "walk", grow = Math.max(1e-3, pop((t - born - x.delay) / 0.6));
      if (t - born < x.delay) return;
      if (x.e.seen_from === "left" || x.e.seen_from === "right") p.root.rotation.y = Math.atan2(cam.position.x - p.root.position.x, cam.position.z - p.root.position.z) + (x.e.seen_from === "left" ? -0.35 : 0.35);  // a side-seen card turns with the reader, leaning 20° to its side: never edge-on
      if (x.still) { pose(p, x.pose ? { [x.pose]: 1 } : {}); p.root.scale.set(x.fs, 1, 1).multiplyScalar(grow); return; }
      if (x.surprise && t > x.surprise.check) {  // a surprise plays its move when it comes into view (and on a tap)
        x.surprise.check = t + 0.25;
        const c = p.root.getWorldPosition(new THREE.Vector3()).addScaledVector(UP, p.size / 2), v = c.clone().project(cam);
        let seen = Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1;
        if (seen) {  // and nothing of the paper stands between the camera and it
          const h = new THREE.Raycaster(cam.position, c.clone().sub(cam.position).normalize()).intersectObject(root, true).find(h => h.object.visible && h.object.isMesh);
          seen = !h || h.distance > cam.position.distanceTo(c) - 0.02;
        }
        if (seen && !x.surprise.seen && x.e.move) { begin(x, [x.e.move, 2]); sound(x.e.sound, x.e.name); }
        x.surprise.seen = seen;
      }
      (x.e.cues || []).forEach(([line, word, mv, until], i) => {
        if (!when(line, word, `x${x.id}c${i}`)) return;
        if (x.until && !until) return void x.later.push([mv, 1.4]);  // held (hidden for the game, say): it plays once the hold ends
        interrupt(x, mv);
        x.until = until ? { mv, line: until[0], word: until[1] || "", key: `x${x.id}u${i}` } : null;  // hold the pose, or stay hidden, until then
      });
      if (x.e.game === "hide" && when("game", "", `x${x.id}g`)) { interrupt(x, "hide"); x.until = { mv: "hide", line: "game:won", word: "", key: `x${x.id}gw` }; }
      if (x.until && t - x.step.t0 >= x.step.secs) {  // the cue's move has played: hold it until its moment, then show, any cue that waited, the routine from the top
        ended(x);
        if (!when(x.until.line, x.until.word, x.until.key)) { if (!x.hidden) pose(p, { [x.until.mv]: 1 }); return; }
        x.until = null; x.ri = -1; x.queue = [...(x.hidden ? [["show", 1]] : []), ...x.later.splice(0)]; x.step = null;
      }
      if (!x.step || t - x.step.t0 >= x.step.secs) {
        ended(x);
        if (x.surprise) x.step = { a: "rest", secs: 1e9, t0: t, from: (x.at || p.root.position).clone(), sounded: true };
        else begin(x, x.queue.shift() || (x.e.routine || [["wait", 4]])[x.ri = (x.ri + 1) % (x.e.routine?.length || 1)]);
      }
      const s = x.step;
      if (!s.sounded) s.sounded = true, x.owe = { snd: s.snd, t0: t };  // the move plays now, under the voice too; only its sound waits
      if (x.owe && !story.speaking) { sound(x.owe.snd, x.e.name); x.owe = null; }  // in the next gap in the voice, so a splash never lands on a word
      const k = clamp01((t - s.t0) / s.secs), a = s.a, cyc = x.def.cycles || {}, moves = x.def.moves || {};
      const pos = s.to ? s.from.clone().lerp(s.to, a.startsWith("go") ? smooth(k) : ease(k)) : s.from.clone(), ground = pos.clone();  // ground: before any lift
      let ang = {};
      if (a.startsWith("go")) {
        const len = s.from.distanceTo(s.to), hold = a.slice(3), c = gait !== "crawl" && gait !== "hop" ? Object.keys(cyc)[0] : null, cr = Object.keys(cyc).filter(k => /^crawl/.test(k));  // cr: a ripple, each crawlN a 1/n of a cycle behind the last, so a wave runs along the body
        if (gait === "fly") pos.y += Math.max(0.03, 0.25 * len) * Math.sin(Math.PI * k);
        if (gait === "hop") pos.y += 0.5 * p.size * Math.abs(Math.sin(Math.PI * k * s.hops));
        if (gait === "walk" || (gait === "crawl" && !cr.length)) pos.y += 0.04 * p.size * Math.abs(Math.sin(TAU * k * Math.max(1, len / (p.size * 0.6))));
        if (hold && moves[hold]) ang = { [hold]: 1 }; else if (cr.length) ang = Object.fromEntries(cr.map((k, i) => [k, beat(cyc[k], t - s.t0 - i / (cr.length * cyc[k]))])); else if (c) ang = { [c]: beat(cyc[c], t - s.t0) };
        if ((gait === "walk" || gait === "swim") && onWater(pos) && Math.floor((t - s.t0) / 0.6) !== s.ringN) { s.ringN = Math.floor((t - s.t0) / 0.6); ring(pos, p.size * 0.7); }
        if (k >= 1 && hold && !s.splashed && onWater(pos)) { s.splashed = true; ring(pos, p.size); }
      } else if (a === "hide") { if (k >= 1 && !x.hidden) { x.hidden = true; p.root.visible = false; } }
      else if (a === "bob") pos.y += 0.004 * Math.sin(TAU * (t - s.t0) / 1.6);
      else if (a === "jump") { pos.y += 0.5 * p.size * Math.sin(Math.PI * k); if (k >= 1 && !s.splashed && onWater(pos)) { s.splashed = true; ring(pos, p.size); } }
      else if (moves[a]) {
        ang = { [a]: cyc[a] ? beat(cyc[a], t - s.t0) : swing(k) };
        if (moves[a]._lift) pos.y += moves[a]._lift * p.size * swing(k);
        if (cyc[a] && s.tap && gait !== "crawl" && gait !== "swim") pos.y += 0.4 * p.size * Math.sin(Math.PI * k);  // a tapped flap lifts off and lands back (the same move in its routine stays down)
      } else ang = { _breathe: Math.sin(TAU * (t - s.t0) / 3) };  // wait, turn, show, rest
      if (x.pose && !a.startsWith("go")) {  // a surprise's rest pose (hanging, asleep): a move eases its hinges, never its whole-puppet tilt
        const s = moves[a] && a !== x.pose ? swing(k) : 0;
        ang[x.pose] = 1 - s; ang[`${x.pose}#tilt`] = s;
      }
      if (x.on) { if (!x.E || t - x.Et > 2) { x.E = edgesOf(x.on); x.Et = t; } const top = topAt(x.E, pos.x); if (top !== null) pos.y = ground.y = top; }  // a crawler on a piece follows its top edge, so it never floats or sinks
      x.at = ground;  // where it stands before any lift or sway: the next step starts here, so a cue mid-hop never strands it in the air and the sway never accumulates
      if (x.sw) pos.applyMatrix4(x.sw.delta);  // perched on a swaying tree: it rides the sway, never floats off the limb
      p.root.position.copy(pos);
      if (x.cs) { x.cs.position.set(pos.x, x.home.y + 0.002, pos.z); x.cs.material.opacity = x.hidden ? 0 : 0.3 * Math.max(0, 1 - (pos.y - x.home.y) / 0.15); }
      pose(p, ang);
      x.fs += (x.face - x.fs) * Math.min(1, dt * 12);  // turning round flips the paper through edge-on, 0.3 s
      p.root.scale.set(Math.sign(x.fs || 1) * Math.max(0.05, Math.abs(x.fs)), 1, 1).multiplyScalar(grow);
    }
  }

  async function puppetDefs() { return opts.puppets || (await json("puppets/puppets.json"))?.puppets || {}; }

  return {
    get shot() { return shot; },
    get state() { return { shot, yielded, took, held: held.on, run: run?.s?.target ?? null, tilt: +tilt.toFixed(3), dz: +dz.toFixed(3), kept: kept.toArray().map(v => +v.toFixed(3)), line: story.line, story: SCAM, beat: SC.key, home: HOME.toArray().map(v => +v.toFixed(3)), wide: wide.pos.toArray().map(v => +v.toFixed(3)) }; },  // for tests
    get extras() { return pups; },  // the extras, the backdrop's top, and everything this layer added, for tests
    get backdrop() { return bd; },
    group,
    update(t, dt) {
      dt = Math.min(dt, 1 / 30); t = now = clock = clock == null ? t : clock + dt;  // ambient's own clock, at most 33 ms a frame: a stalled frame never jumps the camera, and a 30 fps tablet still runs at full speed
      group.visible = isOpen();  // from the start of a turn until the next spread stands, nothing floats over the paper
      reHome();
      storyTick();
      if (!built && isOpen()) build(t).catch(e => console.error("ambient:", e));
      windTick(t);
      hushTick();
      if ((shot === "done" || shot === "in") && isOpen() && !SCAM) shots();  // a line's shot may take over a push-in that has not landed
      camera(t, dt);
      if (fogOn) { const d = cam.position.distanceTo(controls?.target || LOOK); scene.fog.near = d; scene.fog.far = d + 1.6 / A.fog; }
      if (passes.length) {  // focus: the sharp line follows the subject (the shot's focus, else what the camera looks at), pulled over 0.8 s
        const f = focus.goal && frame(focus.goal), at = f?.c || controls?.target || LOOK;
        focus.r += ((tmp.copy(at).project(cam).y + 1) / 2 - focus.r) * Math.min(1, dt * 3.75);
        passes[0].enabled = (opts.composer.renderer?.getPixelRatio() ?? 2) > 1;  // the focus pass is off at pixel ratio 1 (a slow device)
        const u = passes[0].uniforms; u.amount.value = A.dof * 4; u.px.value.set(1 / innerWidth, 1 / innerHeight); u.r.value = focus.r;
      }
      for (const f of ticks) f(t, dt);
    },
    dispose() {
      disposers.forEach(f => f());
      pups.forEach(x => x.p.dispose?.());  // a 3D extra frees its skeletons and its own copies (extras3d.js); the sweep below frees the rest
      setTimeout(async () => {  // this spread's card pictures leave the GPU once nothing on the desk or in the loaded spreads shows them: cached forever,
        const shown = new Set(), look = r => r?.traverse(o => [].concat(o.material ?? []).forEach(m => Object.values(m).forEach(v => v?.isTexture && shown.add(v))));  // every spread read piled up (77 left over by s08) and a phone dropped the page
        look(scene); for (const p of Object.values(window.live?.spreads ?? {})) look((await Promise.resolve(p).catch(() => null))?.root);
        for (const k of used) { const t = await cache[k]; if (t && !shown.has(t) && !using.has(k)) { t.dispose(); delete cache[k]; } }
      }, 8000);
      passes.forEach(p => (opts.composer.removePass(p), p.dispose?.()));
      if (fogOn && scene.fog) scene.fog = null;
      SHADE.uCloudAt.value.z = 0;
      group.removeFromParent();
      group.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
}
