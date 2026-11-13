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
  night: { top: "#0b0d18", low: "#1c150e", foot: "#0b0908", win: "#3a5a8c", glow: "#6d8cc8", dots: "#ffb868", pool: [1, 0.78, 0.5], alpha: 0.7 } };

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
async function puppet(id, def, stage) {
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
  return { root, pins, meshes, size, def, first: parts[1] };
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
const pageOf = root => {
  const page = new THREE.Box3();
  ["page-right", "leaf-page"].forEach(n => { const o = root.getObjectByName(n); if (o) page.expandByObject(o); });
  return page.isEmpty() ? page.setFromObject(root) : page;
};
// the built backdrop: {top, z, walls, x0, x1, floor}, null without one. Its cards are the nodes spread.json names ("backdrop"),
// else the farthest of the cards rising 0.3 above the page in its back 30% (a strip of village standing in front is not the
// backdrop). top is its skyline, the column tops across its middle 80%, the low 30% of them: the line no frame shows room above
export function skyline(root, cards = standing(root), names = null) {
  const page = pageOf(root), D = page.max.z - page.min.z;
  let walls;
  if (names?.length) {  // exactly the named nodes' pictures
    walls = [];
    names.map(n => root.getObjectByName(n)).filter(Boolean).forEach(n => n.traverse(o => {
      if (o.isMesh && /^art-/.test(o.material.name) && !walls.some(c => c.mesh === o)) { o.updateWorldMatrix(true, false); walls.push({ g: o.parent, mesh: o, box: new THREE.Box3().setFromObject(o) }); }
    }));
  } else {
    const back = cards.filter(c => c.box.max.y - page.max.y > 0.3 && c.box.min.z < page.min.z + 0.3 * D), far = Math.min(...back.map(c => c.box.min.z));
    walls = back.filter(c => c.box.min.z < far + 0.06);
  }
  if (!walls.length) return null;
  const cols = new Array(40).fill(-Infinity), x0 = Math.min(...walls.map(c => c.box.min.x)), x1 = Math.max(...walls.map(c => c.box.max.x)), v = new THREE.Vector3();
  for (const c of walls) { const pa = c.mesh.geometry.attributes.position; c.mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(c.mesh.matrixWorld); const j = Math.floor((v.x - x0) / (x1 - x0) * 40); if (j >= 4 && j < 36) cols[j] = Math.max(cols[j], v.y); } }
  const tops = cols.filter(isFinite).sort((a, b) => a - b);
  return { top: tops[Math.floor(tops.length * 0.3)] ?? Math.max(...walls.map(c => c.box.max.y)), z: walls.reduce((a, c) => a + c.box.getCenter(v).z, 0) / walls.length, walls,
    x0, x1, floor: page.max.y };  // its ends, and the page it stands on
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
        mode: () => L.mode, home: () => L.home, halt: () => L.halt?.(),  // the viewer's reading view (phone framing included), kept current on resize; halt stops its glide home
        story: () => ({ line: r?.id ?? null, t: !r || r.audio.ended ? Infinity : r.audio.currentTime, speaking: !!r && !r.audio.paused,
          // "next": the line before the game has been read (the pause before its prompt); "wait": its prompt and play; a read again starts over
          game: game(sp) && (game(sp).targets?.length ?? sp.targets?.length) ? (game(sp).complete ? "won" : sp.at >= gate() ? "wait" : sp.at === gate() - 1 && r?.audio.ended ? "next" : null) : null,
          end: sp.at >= lines().length, at: sp.at }),
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
    : line === "end" ? story.end && story.game !== "wait" && story.game !== "next"  // a game after the last line holds its own shot; the end comes once it is won
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
    const nook = new THREE.Group(); nook.add(room, fade, pool, contact); scene.add(nook);  // in the scene, not the spread: it stays through exit turns
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
  let faceLim = null;  // the reader's orbit limits while a face shot runs
  const probe = cam.clone(), lim = controls || {}, lims = () => faceLim ?? lim;  // lims: the reader's own limits, also while a face shot has the orbit's let out
  const fit = (pos, look) => {  // inside the reader's orbit limits and the director's: above z 0.3, at most 25° off the reading axis
    const s = new THREE.Spherical().setFromVector3(tmp.copy(pos).sub(look)), e = 0.02, a0 = Math.atan2(HOME.x - LOOK.x, HOME.z - LOOK.z);  // margins wider than the breathing drift
    s.radius = Math.min(Math.max(s.radius, (lims().minDistance ?? 0) + 0.03), (lim.maxDistance ?? Infinity) - 0.03);
    s.phi = Math.min(Math.max(s.phi, (lim.minPolarAngle ?? 0) + e), (lims().maxPolarAngle ?? Math.PI) - e);
    s.theta = Math.min(Math.max(s.theta, Math.max(lim.minAzimuthAngle ?? -Infinity, a0 - deg(25)) + e), Math.min(lim.maxAzimuthAngle ?? Infinity, a0 + deg(25)) - e);
    pos.setFromSpherical(s).add(look);
    if (pos.y < 0.3) { pos.y = 0.3; if (look.y > 0.29) look.y = 0.29; }
    return { pos, look };
  };
  const faceRig = s => {  // "face": her head and shoulders from in front of her face, the camera level with her chin looking up a little, near enough
    const c = subjects(s)[0], head = c?.model?.getObjectByName("head");  // that her face stands 100 px tall (75 on an upright phone); no fit, room or keep pushes it out
    if (!head) return null;
    const faceH = 0.24 * c.height, d = faceH * innerHeight / (2 * Math.tan(deg(cam.fov) / 2) * (phone() ? 80 : 100)), chin = head.getWorldPosition(new THREE.Vector3());
    const axis = HOME.clone().sub(LOOK).setY(0).normalize(), her = new THREE.Vector3(Math.sin(c.yaw ?? 0), 0, Math.cos(c.yaw ?? 0)), a = Math.atan2(axis.x, axis.z), b = Math.atan2(her.x, her.z);
    const yaw = a + Math.max(-deg(30), Math.min(deg(30), Math.atan2(Math.sin(b - a), Math.cos(b - a))));  // toward her face, at most 30° off the reading axis
    return { pos: chin.clone().add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(d)), look: chin.clone().setY(chin.y + faceH / 2), face: true };
  };
  const rigOf = s => {  // a shot's camera: its distance along the reading axis swung by yaw, the target's top no higher than 60% up
    if (!s || s === "reading" || s.target == null) return { pos: HOME.clone(), look: LOOK.clone() };  // exactly the viewer's own framing, so Reset never jumps
    if (s.framing === "face") return faceRig(s);
    const f = frame(s.target, true); if (!f) return null;  // whole bodies (a crocodile is long)
    const half = Math.min(deg(cam.fov) / 2, Math.atan(Math.tan(deg(cam.fov) / 2) * cam.aspect));  // the narrower half-angle: a phone's width
    const allow = phone() ? (s.move === "push" ? 1 / 0.85 : 1) : 1, rr = f.r + (phone() && s.move === "drift" ? 0.04 : 0);  // a phone's subjects stay whole as the move ends: a push ends 15% closer, a drift slides 0.04
    const dist = Math.max(0.6, (FRAMING[s.framing] ?? FRAMING.medium) * (phone() ? Math.tan(deg(15)) / Math.tan(deg(cam.fov) / 2) : 1), rr / Math.tan(half) * (phone() ? 1.3 : 1.15) * allow);
    const dir = HOME.clone().sub(LOOK).normalize().applyAxisAngle(UP, deg(Math.max(-25, Math.min(25, s.yaw || 0))));
    const r = fit(f.c.clone().addScaledVector(dir, dist), f.c.clone());
    for (let i = 0; i < 12; i++) {  // the read-along page covers the top quarter: lift the view until the target's top sits below 60%
      probe.position.copy(r.pos); probe.lookAt(r.look); probe.updateMatrixWorld();
      if (tmp.copy(f.top).project(probe).y <= 0.2) break;
      r.look.y += 0.03; r.pos.y += 0.03;
    }
    const q = fitIn(r), who = subjects(s);
    if (!who.length) return q;
    const end = x => ({ pos: x.pos.clone().sub(x.look).multiplyScalar(s.move === "push" ? 0.85 : 1).add(x.look), look: x.look.clone() });
    return whole(end(q), who) || !whole(end(r), who) ? q : r;  // on a phone the room fit may not cut a subject: then the shot keeps its own framing
  };
  const phone = () => cam.aspect < 1, pg = pageOf(root);  // an upright phone: closer in, as the viewer's own phone view, room above allowed, no desk below
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
  const subjects = s => cast.filter(c => c.body.visible && [s?.target].flat().includes(c.name));
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
    const axes = [[0, 0.94 * tx, 0.94 * tx], [1, 0.6 * ty, 0.94 * ty]];  // x: 3% in from each side; y: the top below 60% (the read-along page), the bottom 3% in
    const back = P.length ? Math.min(0.6, Math.max(0, ...axes.map(([i, a, b]) => (lo(i, a, 0) - hi(i, b, 0)) / (a + b)))) : 0;
    const [lx, hx] = P.length ? [lo(0, axes[0][1], back), hi(0, axes[0][2], back)] : [-0.15, 0.15], s0 = Math.min(Math.max(0, lx), hx);  // slide no further than it must; no subjects (a view of a place, the reading view): at most 15 cm
    const O = others.map(c => corners([c])).filter(Q => Q.length), x = (p, s) => (p[0] - s) / (tx * (p[2] + back));
    const half = s => O.filter(Q => { const a = Math.min(...Q.map(p => x(p, s))), b = Math.max(...Q.map(p => x(p, s))); return (a < -1 && b > -1) || (a < 1 && b > 1); }).length;
    const edge = (Q, k, f) => f(...Q.map(p => p[0] + k * tx * (p[2] + back)));  // the slide that puts Q's side exactly on an edge
    const sx = [s0, ...O.flatMap(Q => [edge(Q, 1, Math.max) + 1e-3, edge(Q, -1, Math.min) - 1e-3, edge(Q, -1, Math.max) + 1e-3, edge(Q, 1, Math.min) - 1e-3])]
      .filter(s => s >= lx && s <= hx).map(s => [half(s) + Math.abs(s - s0), s]).sort((a, b) => a[0] - b[0])[0]?.[1] ?? s0;  // another character wholly in or wholly out, if a slide that keeps the subjects can do it
    const e = tmp.set(r.look.x, pg.max.y, pg.max.z).applyMatrix4(probe.matrixWorldInverse), up = -e.z > 0.05 ? desk * Math.min(0.8, Math.max(0, e.y + ty * (-e.z + back) + 0.01)) : 0;  // at most 80 cm: a reading view farther over the desk is slid the rest of the way  // up far enough that the page's near edge is under the frame: no desk
    return { x: s0, y: P.length ? Math.min(Math.max(up, lo(1, axes[1][1], back)), hi(1, axes[1][2], back)) : up, back, others: sx - s0, lx, hx };
  };
  const slack = (r, who) => {  // how far the frame may slide back into the book (along -z) before a subject reaches an edge; closed form
    aim(r); const [tx, ty] = halves(), u = new THREE.Vector3(0, 0, 1).transformDirection(probe.matrixWorldInverse); let m = Infinity;
    for (const [x, y, D] of corners(who)) for (const [A, B] of [[0.99 * tx * D - x, -0.99 * tx * u.z - u.x], [0.99 * tx * D + x, -0.99 * tx * u.z + u.x], [0.6 * ty * D - y, -0.6 * ty * u.z - u.y], [0.99 * ty * D + y, -0.99 * ty * u.z + u.y]])  // to the edge, never past it
      if (B < 0) m = Math.min(m, Math.max(0, A / -B));
    return m;
  };
  let dz = 0, tilt = 0, od = 0, kept = new THREE.Vector3(), keptFrom = kept.clone(), keptRun, keptT = -9, step = 0;  // an upright phone's desk slide, tilt, others' slide and subject keep (step: this frame's dt)
  const toward = (v, goal, tau, rate) => { const d = goal - v, m = d * (1 - Math.exp(-step / tau)); return v + Math.sign(m) * Math.min(Math.abs(m), rate * step); };  // eased, and never faster than rate m/s
  let bd = opts.backdrop || null;  // the standing backdrop (the viewer measures it as the spread loads; else at build)
  const roomOf = r => { probe.copy(cam); probe.position.copy(r.pos); probe.lookAt(r.look); probe.updateMatrixWorld(); return room(probe, bd); };
  const fitIn = r => {  // no frame shows the room past the backdrop: move in toward the look, else across toward its middle (its ends), then down (its top)
    if (!bd || (phone() && story.game === "wait")) return r;  // a phone's game view frames every target itself; moving in would push edge targets off screen (eased() lets the correction go over ~0.4 s)
    const spare = 0.02, d = r.pos.distanceTo(r.look), fMax = Math.max(0, 1 - Math.max(0.6, (lims().minDistance ?? 0) + 0.03) / d);  // spare: the breathing drift
    const dolly = f => ({ pos: r.pos.clone().lerp(r.look, f), look: r.look.clone() }), slide = (q, s) => ({ pos: q.pos.clone().setY(q.pos.y - s), look: q.look.clone().setY(q.look.y - s) });
    const least = (lo, hi, bad) => { if (!bad(lo)) return lo; if (bad(hi)) return hi; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; bad(mid) ? (lo = mid) : (hi = mid); } return hi; };  // smooth in r: no steps
    const q0 = dolly(least(0, fMax, f => roomOf(dolly(f)).side > -spare)), mid = (bd.x0 + bd.x1) / 2 - q0.look.x;  // the orbit's nearest limit can stop the move in
    const shift = x => ({ pos: q0.pos.clone().setX(q0.pos.x + x), look: q0.look.clone().setX(q0.look.x + x) });  // across: the angles stay
    const q = shift(Math.sign(mid) * least(0, Math.abs(mid), x => roomOf(shift(Math.sign(mid) * x)).side > -spare));
    if (phone()) return q;  // an upright phone may show room above the backdrop (its frame is taller than any backdrop)
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
  const inside = l => { const v = cam.position.clone().sub(controls.target), d = v.length(); return d >= l.minDistance - 1e-3 && Math.acos(v.y / d) <= l.maxPolarAngle + 1e-3; };
  let shot = calm || !controls ? "off" : cam.position.distanceTo(HOME) < 1e-3 ? "hold" : "wait";
  let yielded = shot === "off", last = null, cur = { pos: cam.position.clone(), look: LOOK.clone() }, run = null, calmFrom = 0;
  const onStart = () => { held.on = true; }, onEnd = () => { held.on = false; };
  controls?.addEventListener("start", onStart); controls?.addEventListener("end", onEnd);
  disposers.push(() => { controls?.removeEventListener("start", onStart); controls?.removeEventListener("end", onEnd); });
  const write = (r, t, desk = 0, who = [], limit = 0) => {  // the camera, with the breathing drift (±0.01, 7 s) laid over the shot when t is given
    cur = { pos: r.pos.clone(), look: r.look.clone() };
    const p = { pos: r.pos.clone(), look: r.look.clone() };
    if (controls && !run?.base?.face) {  // the shot's subjects kept whole (and no one else half in frame); an upright phone also tilts over the look point and slides back into the book as far as they allow, so the desk stays out (`desk` of the way)
      if (run !== keptRun) keptRun = run, keptFrom.copy(kept), keptT = now;  // a new shot: its keep blends in from the last over 1 s, so nothing steps
      const others = phone() || run?.s?.target != null ? cast.filter(c => c.body.visible && !who.includes(c)) : [], w = shot === "in" ? 1 : smooth((now - keptT) / (run?.over ? run.secs : 1));  // a desktop's reading view is the viewer's own; a take-over's keep comes in with its move
      const at = a => {  // the frame for a tilt a (up over the look point; below 0, down), inside the orbit's limits, with the subjects kept whole: exact within a shot
        const v = p.pos.clone().sub(p.look), pol = Math.acos(v.y / v.length()), b = Math.max(-Math.max(0, (lims().maxPolarAngle ?? Math.PI) - pol - 0.02), Math.min(a, Math.max(0, pol - (lim.minPolarAngle ?? 0) - 0.02)));
        const q = { pos: v.applyAxisAngle(new THREE.Vector3(v.z, 0, -v.x).normalize(), -b).add(p.look), look: p.look.clone() }, n = need(q, who, others, desk), x = n.x + od;
        const kv = new THREE.Vector3().lerpVectors(keptFrom, new THREE.Vector3(x + (Math.min(Math.max(x, n.lx), n.hx) - x) * w, n.y, n.back), w);
        aim(q); const ax = i => new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, i), side = ax(0).multiplyScalar(kv.x).add(ax(1).multiplyScalar(kv.y));
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
    const left = limit ? Math.max(p.pos.distanceTo(cam.position), p.look.distanceTo(controls.target)) : 0;  // the push in: at most `limit` m/s from where the camera stands, everything included
    if (left > limit * step) { p.pos.sub(cam.position).multiplyScalar(limit * step / left).add(cam.position); p.look.sub(controls.target).multiplyScalar(limit * step / left).add(controls.target); }
    cam.position.copy(p.pos);
    if (t != null) { const b = smooth((t - calmFrom) / 2); cam.position.add(tmp.set(0.01 * b * Math.sin(TAU * t / 7), 0.006 * b * Math.sin(TAU * t / 5.6 + 1), 0)); }
    controls.target.copy(p.look); inOrbit(); last = cam.position.clone();
    return left - limit * step;  // how far it still trails
  };
  if (shot === "hold") write(opening());  // a fresh book: the camera starts wide and high
  const play = s => {  // start a shot from where the camera is now
    if (!s || calm || !controls || held.on) return;
    s = s === "reading" ? { target: null, seconds: 3 } : [s].flat()[0];
    const base = rigOf(s); if (!base) return;
    const over = shot === "in";  // the opening push-in has not landed: the line's shot blends on from where it has got to
    if (over) shot = "done";
    const edge = !!run?.base?.face !== !!base.face, real = yielded || edge || over, from = real ? { pos: cam.position.clone(), look: controls.target.clone() } : cur;  // after the reader's hands, into or out of a face shot (no keep, tilt or slide), or over a push-in (which trails its rig at 1.4 m/s): from where the camera really is
    from.ease = !!bd;  // the fit always eases in from where the camera stands: a view inside fitIn's 0.02 spare would otherwise snap
    if (real) calmFrom = now, dz = tilt = od = 0, kept.set(0, 0, 0), keptFrom.set(0, 0, 0);  // breathing eases in again; the camera stands where it is, slide and keep included
    yielded = false; focus.goal = s.focus || s.target;
    const turn = from.look.clone().sub(from.pos).angleTo(base.look.clone().sub(base.pos));
    run = { s, from, base, t0: now, f0: frame(s.target), over, swing: edge, secs: over ? Math.max(2, 3 * from.pos.distanceTo(base.pos)) : edge ? Math.max(2, turn / deg(40)) : 2 };  // taking over: no faster than a push-in (about 0.6 m/s at most); into or out of a face: the view turns at most 75°/s
  };
  function camera(t, dt) {
    const moved = last && cam.position.distanceToSquared(last) > 1e-8; step = dt;
    if ((held.on || (moved && shot !== "wait")) && !yielded) yielded = true, run = null, shot = shot === "done" ? "done" : "off";
    last = null;
    if (!controls || calm) return;
    if (shot === "wait") {  // a later spread: its text page waits still at the viewer's reading view, so a finger can find its corner; the reader's turn takes the camera out with the page, then the push-in
      const m = opts.mode?.();
      if (m === "turn") opts.halt?.(), (cur = { pos: cam.position.clone(), look: controls.target.clone() }), (shot = "hold");
      else if (m !== "closed") return void (shot = "done");
      else return void (last = cam.position.clone());
    }
    const capped = r => ({ pos: cur.pos.clone().add(r.pos.clone().sub(cur.pos).clampLength(0, 0.83 * dt)), look: cur.look.clone().add(r.look.clone().sub(cur.look).clampLength(0, 0.83 * dt)) });  // at most 1.2 s a metre, as the viewer's glides
    if (shot === "hold") {  // the opening view while the book is shut; it comes in with the turning page, so the open spread never shows the room
      if (isOpen()) { shot = "in"; run = { from: cur, t0: t, to: (O?.settle && O.settle !== "reading" && rigOf({ target: O.settle, framing: "medium" })) || rigOf("reading") }; run.secs = Math.max(O?.seconds || 2.5, 2 * run.from.pos.distanceTo(run.to.pos)); }  // the ease's first speed, 3 d / secs, at most 1.5 m/s: under 0.05 m in a 33 ms frame
      else write(capped(opening()));  // the page's turn may sweep faster than that: the camera follows at its own pace
      return;
    }
    if (shot === "in") {
      const k = (t - run.t0) / run.secs;
      const r = mixRig(run.from, run.to, ease(k));  // no room past the backdrop on the way in, landing exactly on the viewer's framing
      const p = bd ? eased(run, r, smooth(k / 0.3) * (phone() ? 1 : 1 - smooth((k - 0.85) / 0.15)), dt) : r;  // a phone keeps the fit as it lands: the viewer's own phone view shows the desk, and letting the fit go would pull back over it  // the room fit comes in over the push's first third: it may start far out (the turn's sweep is capped)
      const trail = write(p, undefined, ease(k / 0.25), [], 1.4);  // the desk is out of a phone's frame early in the push (it ramps from nothing, so it needs no blend); at most 1.4 m/s
      if (k >= 1 && trail < 0.002) shot = "done", run = null, calmFrom = t;  // landed
      return;
    }
    if (shot === "off") shot = "done";
    if (faceLim && (yielded || !run?.base?.face) && inside(faceLim)) Object.assign(controls, faceLim), (faceLim = null);  // the reader's orbit limits back after a face shot, once the camera is inside them: the orbit would clamp it there in one frame
    if (!isOpen() || yielded) return;  // turning or closed: the camera is the reader's and the page's; or the reader took it
    if (!run) return write(cur, t, 1);
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
      return void write(r, t, 0, []);
    }
    const q = mixRig(r, fit(r.pos.clone(), r.look.clone()), smooth((t - run.t0) / 2)), w = eased(run, q, phone() && subjects(s).length ? 0 : run.from.ease ? smooth((t - run.t0) / 2) : 1, dt);  // a phone shot of someone keeps its base framing (no per-frame room fit that would cut them)
    write(w, t, 1, subjects(s));  // never a jump
  }
  function shots() {
    const actors = () => [...new Set((m.acts || []).map(a => a.who))].filter(n => cast.some(c => c.name === n && c.body.visible));
    for (const k of ["end", "game", "game:won"]) if (SH[k] && when(k, "", "shot"))  // the game's shot wins; on an upright phone "reading" is the viewer's game framing, so small targets are tappable
      play(k === "game" && phone() ? "reading" : k !== "game" && phone() && SH[k] === "reading" ? { target: actors(), framing: "medium", move: "hold", seconds: 3 } : SH[k]);  // a phone's reading view is narrow: it ends on the story's actors where they are, not where they began
    if (phone() && story.game === "wait") return;  // a phone's game view holds: a line said again (a tap on Lulu) must not pull it off the targets
    for (const [k, v] of Object.entries(SH)) if (!["open", "end", "game", "game:won"].includes(k)) for (const s of [v].flat()) if (when(k, s.word, "shot")) play(s);
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
    const to = c.back ? b : { c: b.c.clone().multiply(new THREE.Color(...(c.tint || [1, 1, 1]))), i: b.i * (c.level ?? 1), p: c.at ? B(c.at) : b.p.clone() };
    tweens.set(o, { from, to, t0: now, secs: Math.max(0.1, c.seconds ?? 1.5) });
  };
  const flicker = (LI.flicker || []).flatMap(n => { const o = lightOf(n); if (o) return [{ o, i: o.intensity, ph: rnd(0, 9) }];
    const ms = []; find(n).forEach(x => x.traverse(y => y.isMesh && y.material.emissive?.getHex() && ms.push({ m: y.material, i: y.material.emissiveIntensity, ph: rnd(0, 9) }))); return ms; });
  ticks.push(t => {
    (LI.cues || []).forEach((c, i) => when(c.line, c.word, `light${i}`)  // the game's light is right from its first frame: done in the pause before its prompt
      && cueLight(c.line === "game" ? { ...c, seconds: story.game === "next" ? Math.min(c.seconds ?? 1.5, 0.4) : 0 } : c));
    for (const [o] of tweens) { const s = lightNow(o); o.color.copy(s.c); o.intensity = s.i; o.position.copy(s.p); }
    for (const [o, w] of lit) if (w.k !== w.to) glow(o, (w.k = w.from + (w.to - w.from) * smooth((now - w.t0) / w.secs)));
    for (const f of flicker) {  // a flame: 0.85..1.0 with soft noise at 6-10 Hz
      const k = 0.925 + 0.045 * Math.sin(t * TAU * 6.3 + f.ph) + 0.03 * Math.sin(t * TAU * 9.7 + 2 * f.ph);
      if (f.o) f.o.intensity = f.i * k; else f.m.emissiveIntensity = f.i * k;
    }
  });
  disposers.push(() => { for (const [o, b] of base) { o.color.copy(b.c); o.intensity = b.i; o.position.copy(b.p); } for (const [o] of lit) glow(o, 0); flicker.forEach(f => (f.o ? (f.o.intensity = f.i) : (f.m.emissiveIntensity = f.i))); });

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
        if (defs[pid]) { f.p = await puppet(pid, { ...defs[pid], size: w * 0.8 }, stage); b.add(f.p.root); }
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
          if (f.p) { const [n, hz] = Object.entries(f.p.def.cycles || {})[0] || []; if (n) pose(f.p, { [n]: beat(hz, t + f.ph) }); }
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

    // drift: leaves floating down the current, or blown across the air
    const DR = A.drift;
    if (DR?.count > 0) {
      const tex = await picture(DR.card.includes("/") ? `${DR.card}.png` : `${A.cards}/${DR.card}.png`), R = DR.over === "air" ? region(null) : water, air = DR.over === "air";
      for (let i = 0; i < DR.count; i++) {
        const w = rnd(0.035, 0.05), c = card(w, tex ? w * tex.image.height / tex.image.width : w * 0.5, tex || cutShape("#7a9a3c"));
        const leaf = new THREE.Group(); leaf.add(c); if (!air) c.rotation.x = -Math.PI / 2;
        const reset = x => leaf.position.set(x, air ? Y + rnd(0.1, 0.45) : R.y + 0.003, rnd(R.z0, R.z1));
        reset(rnd(R.x0, R.x1)); group.add(leaf);
        const ph = rnd(0, TAU);
        ticks.push((t, dt) => {
          const v = air ? 0.05 * (0.4 + wind) * WD.dir : (A.water?.flow ?? 0.012) + 0.004 * wind * WD.dir;
          leaf.position.x += v * dt; leaf.position.z += 0.003 * Math.sin(0.5 * t + ph) * dt;
          if (air) { leaf.position.y += 0.01 * Math.sin(1.3 * t + ph) * dt; c.rotation.set(0.6 * Math.sin(1.1 * t + ph), 0.8 * t + ph, 0.4 * Math.sin(0.9 * t)); }
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
      const p = e.card && !e.puppet ? await cardPuppet(e.card.includes("/") ? `${e.card}.png` : `${A.cards}/${e.card}.png`, e.size ?? 0.03)  // a surprise that is a card
        : await puppet(e.puppet || "extra", defs[e.puppet] || { size: 0.06, parts: ["body"], gait: "walk" }, stage), def = p.def;
      const home = spot(e.at); if (!home) return null;  // its anchor is not in this spread
      if (o.dx) home.add(o.dx);
      const path = (e.path || []).map(spot).filter(Boolean).map(v => (o.dx ? v.add(o.dx) : v));
      if (e.layer === "back" && walls.length) for (const v of [home, ...path]) {  // 0.04 in front of the built backdrop at its x
        const h = new THREE.Raycaster(new THREE.Vector3(v.x, v.y + 0.02, page.min.z - 0.5), new THREE.Vector3(0, 0, 1)).intersectObjects(walls.map(c => c.mesh), false)[0];
        if (h) v.z = Math.max(v.z, h.point.z + 0.04);
      }
      if (def.gait === "swim" && onWater(home)) home.y = water.y - 0.25 * p.size;  // a swimmer floats half in the water
      if (coarse) p.meshes.forEach(m => (m.castShadow = false));  // a tablet: a soft contact shadow instead of the shadow map
      const x = { e, p, def, home, path, wp: 0, face: e.face || 1, fs: e.face || 1, hidden: false, step: null, ri: -1, queue: [], later: [], delay: o.delay || 0, still: o.still, pose: e.pose, id: pups.length };
      // face: -1 starts a puppet looking to -x (its art looks to +x); a "go" or "turn" then sets it as before
      p.root.position.copy(home); p.root.rotation.y = { back: Math.PI, left: -0.35, right: 0.35 }[e.seen_from] || 0;  // a flat card leans only 20° to its side: the reader orbits ±50°, so it is never seen edge-on
      p.root.scale.setScalar(1e-3); group.add(p.root); pups.push(x);
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
      let press = null;
      const down = e => { press = [e.clientX, e.clientY, performance.now()]; };
      const up = e => {
        if (!press || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 8 || performance.now() - press[2] > 450) return void (press = null);
        press = null;
        const b = canvas.getBoundingClientRect();
        rc.setFromCamera(new THREE.Vector2(2 * (e.clientX - b.left) / b.width - 1, 1 - 2 * (e.clientY - b.top) / b.height), cam);
        const x = isOpen() && story.game !== "wait" && hit.get(rc.intersectObjects([...hit.keys()].filter(m => m.visible && m.parent.parent), false)[0]?.object);
        if (!x) return;  // while a game runs, taps pass through to its targets
        dispatchEvent(new CustomEvent("ambient:tap", { detail: { name: x.e.name } }));
        const [mv, snd] = x.e.tap || [x.e.move || "jump", x.e.sound];
        heard.length = 0; sound(snd, x.e.name);  // a tap always answers
        interrupt(x, mv, true);
      };
      canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointerup", up);
      disposers.push(() => { canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointerup", up); });
    }

    // cloud shadows slide with the wind
    if (shade > 0) { const at = SHADE.uCloudAt.value; ticks.push((t, dt) => { at.x -= 0.012 * (0.5 + wind) * WD.dir * dt; at.y += 0.004 * dt; at.z = shade * Math.min(1, (t - born) / 3); }); }

    // ---------- one extra, each frame ----------
    function interrupt(x, mv, tapped) {
      x.queue = mv.startsWith("hide") && tapped ? [["wait", 2], ["show", 1]] : [];  // tapped into hiding: back 2 s later
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
        const len = s.from.distanceTo(s.to), hold = a.slice(3), c = gait !== "crawl" && gait !== "hop" ? Object.keys(cyc)[0] : null;
        if (gait === "fly") pos.y += Math.max(0.03, 0.25 * len) * Math.sin(Math.PI * k);
        if (gait === "hop") pos.y += 0.5 * p.size * Math.abs(Math.sin(Math.PI * k * s.hops));
        if (gait === "walk" || gait === "crawl") pos.y += 0.04 * p.size * Math.abs(Math.sin(TAU * k * Math.max(1, len / (p.size * 0.6))));
        if (hold && moves[hold]) ang = { [hold]: 1 }; else if (c) ang = { [c]: beat(cyc[c], t - s.t0) };
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
    get state() { return { shot, yielded, held: held.on, run: run?.s?.target ?? null, tilt: +tilt.toFixed(3), dz: +dz.toFixed(3), kept: kept.toArray().map(v => +v.toFixed(3)), line: story.line, home: HOME.toArray().map(v => +v.toFixed(3)), wide: wide.pos.toArray().map(v => +v.toFixed(3)) }; },  // for tests
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
      if ((shot === "done" || shot === "in") && isOpen()) shots();  // a line's shot may take over a push-in that has not landed
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
