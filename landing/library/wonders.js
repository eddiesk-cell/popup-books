// wonders.js (Eddie 2026-11-17: "flowers grow out of the book ... the hologram of knights come out fighting with dragons, and a lot more when we look up ... random intervals, not repeated
// or patterned"; then "the underwater world and a few more ... a total of 7 things"). Seven big, rare WONDERS in 3D over the Grand Library's home balcony, one at a time, 8-15 s each
// (build-up, peak, settle). The living shelves (living.js) stay; these are the big ones.
//   bloom          a book at eye level opens (on its shelf, or in the air before our cases); long vines curl out with big pink and peach blossoms; petals drift down; it closes
//   battle         look up: a blue-and-gold shadow-puppet hologram, a knight on a rearing horse against a swooping, fire-breathing dragon, in a projector's cone; it dissolves into motes
//   constellation  look up: the top of the well dims to night, stars gather into a sky whale (a dense starfield in its shape, a faint blue body, soft glowing lines) that swims across, blowing stardust, then scatter
//   airship        a folded-paper airship spirals up the well on a glowing trail into the light
//   underwater     the well becomes the sea: caustics on the shelves and floor, aqua shafts, a school of glowing fish, a manta, kelp, bubbles; then it drains away as light
//   cranes         a book flies out and opens, its pages fold into paper cranes that spiral up into the oculus as a flock
//   lanterns       Lao sky lanterns (Boun Lai Heua Fai) rise from below, sway, flicker, light the books they pass and become stars at the top
//
//   const wonders = createWonders(scene, camera, { renderer, room, reduced, phone, busy });    each frame wonders.update(dt);  on arriving at a station wonders.setStation(id)
//   wonders.fire(name) plays one now (wonders.names), placed in the visitor's view;  wonders.auto = false stops the director;  wonders.log: what it played, when and why;  wonders.stats()
// The director: each gap is drawn at random (12-40 s, triangular); a shuffle bag never plays one twice in a row and brings every one round; every play varies its place, size, direction,
// colours and timing. Sky ones wait for the visitor to look up and come sooner when they do; shelf ones pick a shelf in view. One at a time, never while busy() (a book open, a portal
// trip, the intro): a play that is caught by one fades out in 0.6 s. Reduced motion: none at all (nothing is built). Phone: fewer particles.
// Budget (light-3d-worlds): idle, the root group is hidden and nothing is drawn; a play is 2-4 draws, all motion in the shaders from one time value, nothing allocated per frame.
// Art: wonders/holo.webp (the battle's silhouettes, assets/landing/wonders/pack.py, 84 KB); everything else is generated. Programs are compiled at create (compileAsync), not on first play.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { spineTexture } from "./living.js";

export const NAMES = ["bloom", "battle", "constellation", "airship", "underwater", "cranes", "lanterns"];
const SKY = new Set(["battle", "constellation"]), UPWARD = new Set(["battle", "constellation", "lanterns", "airship", "underwater", "cranes"]);
const TAU = Math.PI * 2, clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x, sm = x => (x = clamp01(x)) * x * (3 - 2 * x), lerp = (a, b, t) => a + (b - a) * t;
const R = (a = 0, b = 1) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0], sgn = () => Math.random() < .5 ? -1 : 1;
const win = (u, a, b, c, d) => sm((u - a) / (b - a)) * (1 - sm((u - c) / (d - c)));
const VEIL = { holo: [.02, .03, .08], night: [.01, .015, .06], sea: [0, .17, .22], dusk: [.03, .03, .1] };  // the veil's colours, made once (no array per frame)
const WC = [0, 2.5], MID_Z = 4.4, fl = x => (+x).toFixed(3);  // the well's centre (x, z); the middle of the air between the home wall (z -0.25) and the entrance wall (z 8.98); fl: a number as a GLSL float

const G = `
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float win(float u, float a, float b, float c, float d) { return smoothstep(a, b, u) * (1. - smoothstep(c, d, u)); }
vec3 camR() { return vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); }
vec3 camU() { return vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
`;
const BLEND = { add: { blending: THREE.AdditiveBlending }, mix: {},
  pre: { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } };  // premultiplied: alpha 0 adds light, alpha 1 covers
const mat = (uniforms, vs, fs, blend = "add", o = {}) => new THREE.ShaderMaterial({ uniforms, vertexShader: G + vs, fragmentShader: G + fs, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...BLEND[blend], ...o });
const obj = (o, order = 46) => { o.frustumCulled = false; o.renderOrder = order; return o; };
const inst = (base, n, attrs) => { const g = new THREE.InstancedBufferGeometry(); g.index = base.index; for (const k in base.attributes) g.setAttribute(k, base.attributes[k]); g.instanceCount = n;
  for (const [k, w] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(n * w), w)); return g; };
const pts = (n, attrs) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  for (const [k, w] of Object.entries(attrs)) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * w), w)); return g; };
const set = (g, k, i, ...v) => g.attributes[k].array.set(v, i * v.length);
const dirty = g => { for (const k in g.attributes) g.attributes[k].needsUpdate = true; };
const v3 = () => new THREE.Vector3();

export function createWonders(scene, camera, { renderer = null, room = {}, reduced = false, phone = false, busy = () => false } = {}) {
  const api = { names: NAMES, auto: false, log: [], fire, update, setStation, stats, dispose, group: null };
  if (reduced) return { ...api, fire: () => null, update() {}, setStation() {}, stats: () => ({ playing: null, draws: 0, log: [] }), dispose() {} };  // reduced motion: no wonders at all, nothing built (stubs: the director's state below is never made)
  const root = new THREE.Group(); root.name = "wonders"; root.visible = false; scene.add(root); api.group = root;
  const FADE = { value: 1 }, PX = { value: 600 }, Q = phone ? .4 : 1;  // FADE: the busy fade-out shared by every material; PX: pixels per metre at 1 m (point sizes); Q: particle counts
  const n = k => Math.max(4, Math.round(k * Q));
  const C = v3(), F = v3(), V1 = v3(), V2 = v3(), V3 = v3(), M4 = new THREE.Matrix4(), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), UPV = new THREE.Vector3(0, 1, 0);
  const view = { pitch: 0, fx: 0, fz: -1, up: false };  // the visitor's eye, read once per update from the camera's matrix

  // ---- the veil: one inside-out sphere round the eye that dims (or tints) a cone of the view, or all of it, behind a wonder. Shared: one wonder plays at a time.
  const veilU = { uDir: { value: v3().set(0, 1, 0) }, uC0: { value: -2 }, uC1: { value: -1.5 }, uCol: { value: new THREE.Color() }, uA: { value: 0 }, uLevel: { value: 1e4 }, uF: FADE };
  const veil = obj(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), mat(veilU, "varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.); }",
    `uniform vec3 uDir, uCol; uniform float uC0, uC1, uA, uLevel, uF; varying vec3 vD;
     void main() { vec3 d = normalize(vD); float h = cameraPosition.y + d.y * 20., wet = smoothstep(uLevel + 1., uLevel - 1., h), line = exp(-abs(h - uLevel) * 1.2) * step(uLevel, 200.);
       float a = uA * uF * smoothstep(uC0, uC1, dot(d, uDir)) * wet; if (a + line < .003) discard; gl_FragColor = vec4(mix(uCol, vec3(.75, 1., .95), line * .8), max(a, line * .5 * uA * uF)); }`,
    "mix", { side: THREE.BackSide, depthTest: false })), 36);
  root.add(veil); veil.visible = false;
  const useVeil = (col, a, dir = null, c0 = -2, c1 = -1.5) => { veil.visible = true; veilU.uCol.value.setRGB(col[0], col[1], col[2]); veilU.uA.value = a; veilU.uC0.value = c0; veilU.uC1.value = c1; veilU.uLevel.value = 1e4; if (dir) veilU.uDir.value.copy(dir); };

  // ---- where things can go: shelf spots on the home wall (z -0.25, behind our cases) and the entrance wall (z 8.98), on a real shelf board of the wall shader (walls.js: rows of
  // `row` m from y 0, a board at the foot of each, deeper every sixth), between its uprights; the region of our four cases (and the door) is left out.
  const Wl = room.walls ?? { row: .56, well: { r: 26, bays: 109 }, home: { z: -.25, x: [-8.243, 8.243] }, door: { z: 8.98, upright: 1.36, x: [-16.347, 16.347] } }, row = Wl.row ?? .56, bay = Wl.bay ?? TAU * Wl.well.r / Wl.well.bays;  // the flat walls' own bay (walls.js SF), else the well's
  const cb = (room.cases ?? []).map(c => c.bounds).filter(b => b && b.max[2] < 1.5 && b.min[2] > -1.5 && b.max[1] < 9 && Math.abs(b.min[0] + b.max[0]) < 18),  // our home cases only (grow.js adds every station's)
    cx0 = Math.min(-4.6, ...cb.map(b => b.min[0] - .5)), cx1 = Math.max(4.6, ...cb.map(b => b.max[0] + .5)), cy1 = Math.max(4.9, ...cb.map(b => b.max[1] + .7));
  const spots = [], board = k => k * row + (k % 6 === 5 ? .222 : .097) * row;  // walls.js: a board at the foot of each shelf, deeper every sixth
  for (let k = 1; k * row < 22; k++) {
    for (let b = 0; (b + 1) * bay <= Wl.home.x[1] - Wl.home.x[0] + .01; b++) { const x = Wl.home.x[0] + (b + .5) * bay; if (!(x > cx0 && x < cx1 && board(k) < cy1)) spots.push({ x, y: board(k), z: Wl.home.z, n: 1 }); }
    for (let b = 0; Wl.door.upright + (b + 1) * bay < Wl.door.x[1]; b++) for (const s of [-1, 1]) { const x = s * (Wl.door.upright + (b + .5) * bay); if (!(Math.abs(x) < 2.6 && board(k) < 5) && board(k) < 18) spots.push({ x, y: board(k), z: Wl.door.z, n: -1 }); }
  }
  function shelfInView(maxD = 11) {  // a shelf spot well inside the view, facing the eye, not too far; nearer the middle of the view more often
    let best = null, bw = 0;
    for (const s of spots) { V1.set(s.x, s.y + .25, s.z); const d = V1.distanceTo(C); if (d > maxD || (C.z - s.z) * s.n < .5) continue; V1.project(camera); if (V1.z > 1 || Math.abs(V1.x) > .82 || Math.abs(V1.y) > .8) continue;
      const w = Math.random() * (1.4 - Math.hypot(V1.x, V1.y) * .8) * (1.3 - d / maxD); if (w > bw) { bw = w; best = { ...s, sx: V1.x, sy: V1.y }; } }
    return best && { ...best, x: best.x + R(-.3, .3) * bay };  // sx, sy: where it sits in the view (ndc), so a vine grows into the view, not out of it
  }
  const halfW = d => d * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;  // half the view's width at distance d (a phone is narrow)
  function free(dx, dy, dz) {  // metres from the eye along a unit direction to the first wall: the home wall, the entrance wall, the well (walls.js)
    let t = 300; const hw = (Wl.home.z - C.z) / dz, dw = (Wl.door.z - C.z) / dz, ox = C.x - WC[0], oz = C.z - WC[1], a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - Wl.well.r ** 2;
    if (hw > 0 && Math.abs(C.x + dx * hw) < Wl.home.x[1] && C.y + dy * hw < 90) t = hw; if (dw > 0 && Math.abs(C.x + dx * dw) < Wl.door.x[1] && C.y + dy * dw < 60) t = Math.min(t, dw);
    if (a > 1e-6) t = Math.min(t, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a)); return t; }
  function aim(minPitch, yLo, yHi, out, jit = .12) {  // a point up along the visitor's view (pitched at least minPitch), short of the first wall, at a height in yLo..yHi where the wall allows
    const p = Math.min(1.38, Math.max(minPitch, view.pitch) + R(-jit, jit)), a = Math.atan2(view.fz, view.fx) + R(-jit, jit), dx = Math.cos(p) * Math.cos(a), dy = Math.sin(p), dz = Math.cos(p) * Math.sin(a);
    const t = Math.min(free(dx, dy, dz) * .8, (R(yLo, yHi) - C.y) / dy); out.set(C.x + dx * t, C.y + dy * t, C.z + dz * t); if (out.y < yLo) out.y = yLo;  // a near wall: it rises up the air in front of it
    return out;
  }

  // ---- the decoy book (bloom, cranes): two halves hinged at the spine, one draw; its spine is living.js's spineTexture, so it is the same kind of book as the shelves' living ones
  const bookCv = document.createElement("canvas"); bookCv.width = 128; bookCv.height = 192; const bookTex = new THREE.CanvasTexture(bookCv); bookTex.colorSpace = THREE.SRGBColorSpace;
  const bookU = { uMap: { value: bookTex }, uSize: { value: v3() }, uOpen: { value: 0 }, uA: { value: 0 }, uGlow: { value: 0 }, uF: FADE };
  const bookGeo = (() => { const half = s => { const g = new THREE.BoxGeometry(.5, 1, 1); g.translate(s * .25, 0, 0); const uv = g.attributes.uv; g.setAttribute("aH", new THREE.BufferAttribute(new Float32Array(24).fill(s), 1));
      const R4 = (f, u0, u1, v0, v1) => { for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i)); } };
      R4(0, s < 0 ? .875 : .375, s < 0 ? 1 : .875, 0, 1); R4(1, s < 0 ? .375 : .875, s < 0 ? .875 : 1, 0, 1); R4(2, .875, 1, 0, 1); R4(3, .875, 1, 0, 1); R4(4, s < 0 ? 0 : .1875, s < 0 ? .1875 : .375, 0, 1); R4(5, .875, 1, 0, 1); return g; };
    return mergeGeometries([half(-1), half(1)]); })();  // canvas: spine 0-.375, cover .375-.875, page .875-1; faces +x -x +y -y +z -z; the inner face of each half is paper
  const book = obj(new THREE.Mesh(bookGeo, mat(bookU,
    `attribute float aH; uniform vec3 uSize; uniform float uOpen; varying vec2 vUv; varying vec3 vN;
     void main() { vUv = uv; vec3 p = position * uSize, nn = normal; float hz = uSize.z * .5; p.z -= hz; mat2 r = rot(aH * uOpen); p.xz = r * p.xz; nn.xz = r * nn.xz; p.z += hz;
       vN = normalize(mat3(modelMatrix) * nn); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.); }`,
    `uniform sampler2D uMap; uniform float uA, uGlow, uF; varying vec2 vUv; varying vec3 vN;
     void main() { vec3 c = texture2D(uMap, vUv).rgb, n = normalize(vN); c = c * (.35 + .9 * max(dot(n, normalize(vec3(-.3, .9, .6))), 0.) + .25 * max(n.y, 0.)) + vec3(1., .75, .4) * uGlow * .5;  // the canvas is sRGB: sampled linear, written back as sRGB
       float a = uA * uF; gl_FragColor = vec4(pow(c, vec3(1. / 2.2)) * a, a); }`, "pre", { depthWrite: true })), 44);
  book.visible = false; root.add(book);
  function dressBook(color, bands, seed) { const x = bookCv.getContext("2d"), sp = spineTexture(color, bands, seed).image;
    x.drawImage(sp, 0, 0, 48, 192); x.fillStyle = "#" + color.toString(16).padStart(6, "0"); x.fillRect(48, 0, 64, 192); x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(48, 0, 64, 192); x.strokeStyle = "rgba(226,180,89,.85)"; x.lineWidth = 3; x.strokeRect(55, 8, 50, 176);
    x.fillStyle = "#e6d3ab"; x.fillRect(112, 0, 16, 192); x.fillStyle = "rgba(90,60,30,.4)"; for (let i = 0; i < 34; i++) x.fillRect(113, 10 + i * 5.2, 13 - (i % 5 === 4 ? 6 : 0), 1); x.fillStyle = "rgba(60,40,20,.35)"; x.fillRect(126, 0, 2, 192); bookTex.needsUpdate = true; }  // cream pages with lines of text
  const bookPose = { R: v3(), U: v3(), N: v3(), slot: v3(), q: new THREE.Quaternion(), qo: new THREE.Quaternion(), po: v3(), k: 1 };  // shelf pose; open pose (bloom)
  function bookAt(s, H, T, D) {  // the book stands on shelf spot s, spine out, flush with the painted wall (its body hidden behind the wall); book.position = its centre
    const P = bookPose; P.N.set(0, 0, s.n); P.U.set(0, 1, 0); P.R.crossVectors(P.U, P.N); P.slot.set(s.x, s.y + H / 2, s.z - s.n * (D / 2 - .02)); M4.makeBasis(P.R, P.U, P.N); P.q.setFromRotationMatrix(M4);
    bookU.uSize.value.set(T, H, D); dressBook(pick([0x6b2430, 0x244a6b, 0x2f5a3a, 0x5a3a6b, 0x7a5a24, 0x2a5a60, 0x5b1f26]), pick([0, 2, 2, 3]), R(1, 99) | 0); book.visible = true; }

  // ======== 1. bloom (its concept: an open book on a shelf at eye level, big pink and peach blossoms on curling gold-green vines). A book at eye height in view slides out of its
  // shelf, turns and falls open, tipped back as on a ledge; when the visitor faces our cases and no eye-level shelf is in view, it flies out of the nearest shelf and opens in the air
  // at eye level in front of them. Three or four vines are grown (not assembled) out of its gutter: they curl tighter toward the tip, side shoots at alternate sides with Leonardo's
  // thinning, a leaf at each node, a blossom at each main and side tip in two rings of petals that open in stages round a glowing heart. Petals drift down glowing; then it all
  // folds back, the book closes and goes home. Grown once per play into fixed pools; growth, unfurling, opening, petal fall and fold-back run in the shaders.
  const MAXR = phone ? 300 : 420, SIDES = 6, MAXL = 360;
  const stemG = new THREE.BufferGeometry(); stemG.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAXR * SIDES * 3), 3)); stemG.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(MAXR * SIDES * 3), 3));
  stemG.setAttribute("aBR", new THREE.BufferAttribute(new Float32Array(MAXR * SIDES * 2), 2)); stemG.setIndex(new THREE.BufferAttribute(new Uint16Array(MAXR * SIDES * 6), 1));
  const bU = { uT: { value: 0 }, uGrow: { value: 0 }, uOpen: { value: 0 }, uRel: { value: .6 }, uDur: { value: 12 }, uBook: { value: 0 }, uGap: { value: 0 }, uSc: { value: 1 }, uAR: { value: v3() }, uAN: { value: v3() },
    uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() }, uC4: { value: new THREE.Color() }, uLeaf: { value: new THREE.Color() }, uStem: { value: new THREE.Color() }, uF: FADE };
  const SWAY = "vec3 sway(float b) { return (uAR * sin(uT * 1.1 + b * 7.) * .05 + uAN * sin(uT * 1.6 + b * 11.) * .03) * b * b * uSc; }";
  const stems = obj(new THREE.Mesh(stemG, mat(bU,
    `attribute vec2 aBR; uniform float uT, uGrow, uSc; uniform vec3 uAR, uAN; varying float vB, vG, vL, vR; ${SWAY}
     void main() { vB = aBR.x; float g = clamp((uGrow - aBR.x) / .05, 0., 1.); vG = g; vec3 c = position - normal * aBR.y, p = c + normal * aBR.y * g * (.4 + .6 * g) + sway(aBR.x);
       vL = max(0., dot(normal, normalize(vec3(-.3, .9, .5)))); vR = 1. - abs(dot(normal, normalize(cameraPosition - p))); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    `uniform float uGrow, uF; uniform vec3 uStem; varying float vB, vG, vL, vR;
     void main() { if (vG < .02) discard; vec3 c = uStem * (.45 + .75 * vL) * mix(.75, 1.15, vB) + vec3(1., .82, .32) * (pow(vR, 3.) * .55 + exp(-abs(uGrow - vB) * 35.) * .9);  // gold-green, a gold rim, the growing tip alight
       gl_FragColor = vec4(c * uF, uF); }`, "pre", { depthWrite: true })), 45);
  const leafG = inst(new THREE.PlaneGeometry(1, 1), MAXL, { aP: 3, aA: 3, aB: 3, aS: 4 });  // aS: size, birth, kind (0 leaf, 1 petal, 2 falling petal, 6 inner petal, 3 heart glow, 4 the gap a book leaves, 5 book glow), seed (>= .5: peach, else pink)
  const leaves = obj(new THREE.Mesh(leafG, mat(bU,
    `attribute vec3 aP, aA, aB; attribute vec4 aS; uniform float uT, uGrow, uOpen, uRel, uDur, uBook, uGap, uSc; uniform vec3 uAR, uAN; varying vec2 vQ; varying float vK, vA, vGl, vSd; varying vec3 vNn; ${SWAY}
     void main() { float sz = aS.x, b = aS.y, k = aS.z, sd = aS.w; vK = k; vSd = sd; vQ = vec2(position.x, position.y + .5); vGl = 0.; vA = 1.; vNn = vec3(0., 0., 1.);
       float g = clamp((uGrow - b) / .07, 0., 1.); vec3 p, ax = normalize(aA), bx = normalize(aB);
       if (k < .5) { float s = sz * g * (1. + .25 * sin(g * 3.1416)); vec3 a2 = normalize(ax + uAN * sin(uT * 2. + sd * 6.) * .12); p = aP + sway(b) + a2 * vQ.y * s + bx * position.x * s * .62; vNn = cross(a2, bx); }
       else if (k < 2.5 || k > 5.5) { bool inner = k > 5.5; float o = clamp((uOpen - b - (inner ? .14 : 0.)) / .22, 0., 1.); o = o * o * (3. - 2. * o) * (1. + .12 * sin(o * 3.1416));  // bud, half open, open, with a little overshoot
         float an = mix(.16, inner ? .8 : 1.25 + .2 * fract(sd * 7.), o); vec3 dir = ax * cos(an) + bx * sin(an), w = normalize(cross(ax, bx));
         float tr = (uRel + fract(sd * 3.) * .2) * uDur, age = k > 1.5 && k < 2.5 ? uT - tr : -1., s = sz * (age > 0. ? 1. : clamp(g * 1.6, 0., 1.) * (.55 + .45 * o));
         p = aP + sway(b) + dir * vQ.y * s + w * position.x * s * .9; vNn = cross(dir, w);
         if (age > 0.) { p += vec3(0., -1., 0.) * age * (.3 + .12 * sd) * uSc + (uAR * sin(age * 2.1 + sd * 9.) * .35 + uAN * (.12 + .2 * sin(age * 1.7 + sd * 5.))) * min(age, 1.6) * uSc;  // released: it falls, flutters and glows
           vGl = smoothstep(0., .8, age); vA = 1. - smoothstep(2.6, 4., age); } }
       else if (k < 3.5 || k > 4.5) { float s = sz * (.8 + .2 * sin(uT * 3. + sd * 9.)); p = aP + (k < 4.5 ? sway(b) : vec3(0.)) + normalize(cameraPosition - aP) * (k < 4.5 ? .12 : 1.) + (camR() * position.x + camU() * position.y) * s;  // glows: light in the air, nearer the eye
         vGl = k < 4.5 ? clamp((uOpen - b) / .3, 0., 1.) * g : max(uBook * .6, uOpen * .2); }
       else { p = aP + bx * position.x * sz + ax * vQ.y * sd; vA = uGap; }
       gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    `uniform vec3 uC1, uC2, uC3, uC4, uLeaf; uniform float uF; varying vec2 vQ; varying float vK, vA, vGl, vSd; varying vec3 vNn;
     void main() { vec2 q = vQ; float y = clamp(q.y, 0., 1.), a, l = .55 + .5 * abs(dot(normalize(vNn), normalize(vec3(-.3, .9, .5)))); vec3 c; vec4 o; bool peach = vSd >= .5;
       if (vK < .5) { float w = .5 * pow(sin(3.1416 * y), .7) * (1. - .3 * y), d = abs(q.x) - w; a = smoothstep(.015, -.015, d);
         c = mix(uLeaf * .55, uLeaf * 1.15, y) * l * (1. - .35 * smoothstep(.035, 0., abs(q.x)) - .12 * smoothstep(.06, 0., abs(fract(y * 5. - abs(q.x) * 4.) - .5) * .4)); c += vec3(1., .85, .4) * smoothstep(-.07, 0., d) * .35;
         o = vec4(c * a, a); }
       else if (vK < 2.5 || vK > 5.5) { float w = .5 * pow(sin(3.1416 * pow(y, .6)), .7), d = abs(q.x) - w; a = smoothstep(.015, -.015, d);  // a broad rounded petal
         vec3 tip = peach ? uC3 : uC1, heart = peach ? uC4 : uC2; c = mix(heart, tip, smoothstep(.05, .65, y)) * (.88 + .14 * sin(q.x * 40. + y * 7.)) * l * (vK > 5.5 ? .9 : 1.);
         vec3 e = c * (.35 + .9 * (1. - y) * (1. - y) + .5 * vGl) + tip * smoothstep(-.06, 0., d) * .4; o = vec4(c * a + e * a, a * (1. - .3 * vGl)); }  // a falling petal glows, and keeps its colour
       else if (vK < 4.5 && vK > 3.5) { a = smoothstep(.5, .25, abs(q.x)) * smoothstep(0., .12, q.y) * smoothstep(1., .85, q.y) * .85; o = vec4(0., 0., 0., a); }
       else { float r = length(q - vec2(0., .5)) * 2.; float e = exp(-r * r * 5.) * vGl; o = vec4((vK > 4.5 ? vec3(1., .82, .5) : mix(vec3(1., .9, .55), peach ? uC3 : uC1, .3)) * e * 1.2, 0.); }
       o *= vA * uF; if (o.a + o.r + o.g < .002) discard; gl_FragColor = o; }`, "pre")), 47);
  const bloomG = new THREE.Group(); bloomG.add(stems, leaves); root.add(bloomG);
  const PINK = [[1, .5, .66], [1, .93, .7]], PEACH = [[1, .6, .48], [1, .88, .7]];  // tip, heart
  function growVine(O, Rx, Uy, Nz, sc) {  // the vines rise from O in the plane of Rx (right) and Uy (up), bulging toward Nz (the eye)
    const P = stemG.attributes.position.array, NN = stemG.attributes.normal.array, BR = stemG.attributes.aBR.array, I = stemG.index.array; let nr = 0, ni = 0, nl = 0;
    const W = (x, y, z, o) => o.set(O.x + Rx.x * x + Uy.x * y + Nz.x * z, O.y + Rx.y * x + Uy.y * y + Nz.y * z, O.z + Rx.z * x + Uy.z * y + Nz.z * z), D = (x, y, z, o) => o.set(0, 0, 0).addScaledVector(Rx, x).addScaledVector(Uy, y).addScaledVector(Nz, z);
    const inst4 = (p, a, b, s) => { if (nl >= MAXL - 2) return; set(leafG, "aP", nl, p.x, p.y, p.z); set(leafG, "aA", nl, a.x, a.y, a.z); set(leafG, "aB", nl, b.x, b.y, b.z); set(leafG, "aS", nl, ...s); nl++; };
    const SPEED = .82 / (2.1 * sc), q = [], A = v3(), B = v3(), T = v3(), S = v3(), Pw = v3();
    const nMain = Math.random() < .5 ? 3 : 4;
    for (let m = 0; m < nMain; m++) { const a = (m - (nMain - 1) / 2) * R(.42, .58) + R(-.12, .12); q.push({ x: (m - (nMain - 1) / 2) * .03 * sc, y: 0, z: .03, dx: Math.sin(a), dy: Math.cos(a), dz: R(.1, .3), r: .03 * sc, len: R(1.5, 2.1) * sc * R(.85, 1.15), ord: 0, b0: m * .035, curl: (m < (nMain - 1) / 2 ? 1 : -1) * R(.8, 1.5) }); }  // a fan, curling outward
    const blossom = (x, y, z, dx, dy, dz, b, size, bud) => {
      W(x, y, z, Pw); D(dx * .3, dy * .3 + .25, 1, A).normalize(); B.set(0, 1, 0).cross(A).normalize(); if (B.lengthSq() < .1) B.set(1, 0, 0); S.crossVectors(A, B);
      const np = bud ? 4 : pick([5, 6, 6]), r0 = R(0, TAU), col = Math.random() < .5 ? 0 : .5;
      for (let k = 0; k < np; k++) { const f = r0 + k * TAU / np + R(-.1, .1); T.copy(B).multiplyScalar(Math.cos(f)).addScaledVector(S, Math.sin(f));
        inst4(Pw, A, T, [size * R(.92, 1.08) * (bud ? .5 : 1), b + (bud ? .2 : 0), !bud && Math.random() < .3 ? 2 : 1, col + R(0, .499)]); }  // about a third of the open flowers' petals fall
      if (!bud) { for (let k = 0; k < 5; k++) { const f = r0 + (k + .5) * TAU / 5; T.copy(B).multiplyScalar(Math.cos(f)).addScaledVector(S, Math.sin(f)); inst4(Pw, A, T, [size * .62, b, 6, col + R(0, .499)]); }  // the inner ring opens after
        inst4(Pw, A, B, [size * 2.3, b, 3, col + .25]); } };
    while (q.length && nr < MAXR - 2) { const s = q.shift(), step = .065 * sc, n = Math.max(5, Math.min(44, Math.round(s.len / step))); let { x, y, z, dx, dy, dz, r } = s, arc = 0, lastChild = 0, cs = sgn(), lside = sgn(), first = nr;
      for (let i = 0; i <= n && nr < MAXR; i++) {
        const f = i / n, b = s.b0 + arc * SPEED, rr = r * (1 - .7 * f), tl = Math.hypot(dx, dy, dz); T.set(dx / tl, dy / tl, dz / tl);
        S.set(T.y, -T.x, 0); if (S.lengthSq() < 1e-4) S.set(1, 0, 0); S.normalize(); A.crossVectors(S, T);  // a ring round the centreline, in local axes, then to world
        for (let k = 0; k < SIDES; k++) { const f2 = k / SIDES * TAU, cx = S.x * Math.cos(f2) + A.x * Math.sin(f2), cy = S.y * Math.cos(f2) + A.y * Math.sin(f2), cz = S.z * Math.cos(f2) + A.z * Math.sin(f2), j = nr * SIDES + k;
          W(x + cx * rr, y + cy * rr, z + cz * rr, Pw); P.set([Pw.x, Pw.y, Pw.z], j * 3); D(cx, cy, cz, B); NN.set([B.x, B.y, B.z], j * 3); BR.set([b, rr], j * 2);
          if (nr > first) { const a0 = (nr - 1) * SIDES + k, a1 = (nr - 1) * SIDES + (k + 1) % SIDES, c0 = nr * SIDES + k, c1 = nr * SIDES + (k + 1) % SIDES; I.set([a0, c0, a1, a1, c0, c1], ni); ni += 6; } }
        nr++;
        if (s.ord < 2 && i >= 4 && i <= n - 5 && i - lastChild >= 4 && Math.random() < (s.ord ? .22 : .38)) { lastChild = i; cs = -cs; const a = cs * R(.6, 1.05), c = Math.cos(a), sn = Math.sin(a);  // a side shoot from inside the stem: no gap at the joint
          q.push({ x, y, z, dx: dx * c - dy * sn, dy: dx * sn + dy * c, dz: dz + R(.05, .25), r: rr * .62, len: Math.max(.3 * sc, (s.len - arc) * R(.45, .7)), ord: s.ord + 1, b0: b + .01, curl: -s.curl * R(.8, 1.3) }); r *= .8; }  // Leonardo: .62² + .8² ≈ 1
        if (i >= 2 && i < n && (s.ord === 0 || (i + s.ord) % 2 === 0)) { const a = lside * R(.9, 1.4), c = Math.cos(a), sn = Math.sin(a); lside = -lside;  // a leaf at the node, alternate sides
          D(T.x * c - T.y * sn, T.x * sn + T.y * c, R(.2, .55), A).normalize(); B.crossVectors(A, Nz).normalize(); W(x, y, z, Pw); inst4(Pw, A, B, [R(.11, .17) * sc * (s.ord ? .8 : 1), b + .02, 0, Math.random()]); }
        const k = s.curl * (.12 + 2.6 * f ** 2.4) * (s.ord ? 1.4 : 1) / sc * step, c = Math.cos(k), sn = Math.sin(k); [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];  // curls tighter toward the tip
        if (!s.ord) dy += .05 * (1 - f); dz += ((.25 + .2 * Math.sin(f * 3 + s.curl)) * sc * .5 - z) * .4 - dz * .3;
        const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2; x += dx * step; y += dy * step; z = Math.max(.03, z + dz * step); arc += step;
      }
      blossom(x, y, z, dx, dy, dz, s.b0 + arc * SPEED, (s.ord ? .15 : .2) * sc * R(.9, 1.15), s.ord > 1 && Math.random() < .6);
    }
    stemG.setDrawRange(0, ni); stemG.attributes.position.needsUpdate = stemG.attributes.normal.needsUpdate = stemG.attributes.aBR.needsUpdate = stemG.index.needsUpdate = true;
    return nl;
  }
  function eyeShelf() {  // a shelf at eye height the visitor faces, well inside the view
    let best = null, bw = 0;
    for (const s of spots) { if (s.y < .85 || s.y > 2.4) continue; V1.set(s.x, s.y + .3, s.z); const d = V1.distanceTo(C); if (d > 9.5 || (C.z - s.z) * s.n < .8) continue; V1.project(camera);
      if (V1.z > 1 || Math.abs(V1.x) > .72 || Math.abs(V1.y) > .75) continue; const w = Math.random() * (1.3 - Math.abs(V1.x)) * (1.4 - d / 9.5); if (w > bw) { bw = w; best = s; } }
    return best && { ...best, x: best.x + R(-.3, .3) * bay };
  }
  const BR3 = v3(), BN3 = v3(), BD = v3();  // the open book's right and toward-the-eye axes, its closed size
  const bloom = { name: "bloom", dur: [12, 14.5], group: bloomG, need: "any",
    start(p) { let s = eyeShelf(); const onShelf = !!s; if (!s) s = shelfInView(14) ?? spots.filter(q => q.y > .85 && q.y < 2.4).sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z))[0];
      const H = R(.36, .42), T = R(.07, .1), D = .28, P = bookPose; bookAt(s, H, T, D); BD.set(T, H, D); p.spot = [s.x.toFixed(2), s.y.toFixed(2), s.z.toFixed(2)]; p.where = onShelf ? "shelf" : "air";
      if (onShelf) { BR3.copy(P.R); BN3.copy(P.N); P.k = Math.max(1.2, Math.min(1.7, P.slot.distanceTo(C) * .2)); P.po.set(s.x, s.y + .32 * H * P.k + .03, s.z + s.n * (.16 + .25 * P.k)); }  // open on its own shelf, tipped back
      else { const d = Math.max(2.4, Math.min(3.6, free(view.fx, 0, view.fz) - 1.4)), sd = sgn() * R(.1, .35) * halfW(d); BR3.set(-view.fz, 0, view.fx); BN3.set(-view.fx, 0, -view.fz);  // open in the air at eye level in front of the eye
        P.k = R(1.6, 1.85); P.po.set(C.x + view.fx * d + BR3.x * sd, C.y - .3, C.z + view.fz * d + BR3.z * sd); }
      M4.makeBasis(BR3, UPV, BN3); P.qo.setFromRotationMatrix(M4); Q1.setFromAxisAngle(BR3, -.95); Q2.setFromAxisAngle(UPV, Math.PI); P.qo.premultiply(Q2).premultiply(Q1);  // turned to face you, spine away, tipped back
      V2.set(0, 0, D * P.k * .5 - .01).applyQuaternion(P.qo).add(P.po); V3.set(0, 0, -1).applyQuaternion(P.qo); V2.addScaledVector(V3, .03);  // the gutter of the open book: the vines' root
      const sc = Math.max(1.1, Math.min(2.4, .5 + V2.distanceTo(C) * .3)); bU.uSc.value = sc;  // a quarter of the frame, near or far
      bU.uC1.value.setRGB(...PINK[0]); bU.uC2.value.setRGB(...PINK[1]); bU.uC3.value.setRGB(...PEACH[0]); bU.uC4.value.setRGB(...PEACH[1]); const hue = R(-.06, .06); for (const c of [bU.uC1, bU.uC3]) c.value.offsetHSL(hue, R(-.05, .05), 0);
      bU.uLeaf.value.setRGB(R(.22, .32), R(.5, .62), R(.12, .2)); bU.uStem.value.setRGB(R(.38, .48), R(.48, .56), R(.14, .2)); bU.uDur.value = p.dur; bU.uRel.value = R(.58, .64);
      bU.uAR.value.copy(BR3); bU.uAN.value.copy(BN3); let nl = growVine(V2, BR3, UPV, BN3, sc); V3.copy(P.slot).addScaledVector(P.N, D / 2 - .01);  // then the dark gap the book leaves in the painted shelf, and the glow from its pages
      set(leafG, "aP", nl, V3.x, V3.y - H / 2, V3.z); set(leafG, "aA", nl, 0, 1, 0); set(leafG, "aB", nl, P.R.x, P.R.y, P.R.z); set(leafG, "aS", nl, T * 1.6, 0, 4, H * 1.05); nl++;
      set(leafG, "aP", nl, V2.x, V2.y, V2.z); set(leafG, "aA", nl, 0, 1, 0); set(leafG, "aS", nl, .6 * sc, 0, 5, .5); nl++;
      leafG.instanceCount = nl; dirty(leafG); p.size = +sc.toFixed(2); return true; },
    tick(p, u, t) { const P = bookPose, out = win(u, 0, .05, .94, .99), f = sm(win(u, .05, .15, .9, .96)), op = win(u, .13, .21, .86, .93); bU.uT.value = t;
      bU.uGrow.value = sm((u - .17) / .42) * (1 - sm((u - .8) / .13)) * 1.02; bU.uOpen.value = win(u, .34, .66, .74, .84) * 1.45; bU.uBook.value = win(u, .12, .2, .3, .5) + .3 * op; bU.uGap.value = out;
      bookU.uA.value = Math.min(1, out * 6); bookU.uOpen.value = 1.35 * op; bookU.uGlow.value = bU.uBook.value * .3; bookU.uSize.value.copy(BD).multiplyScalar(1 + (P.k - 1) * f);
      book.position.copy(P.slot).addScaledVector(P.N, .1 * out).lerp(P.po, f); Q1.setFromAxisAngle(P.R, .16 * out).multiply(P.q); book.quaternion.slerpQuaternions(Q1, P.qo, f); } };  // out of the shelf, turned, opened
  // ======== 2. battle: shadow-puppet silhouettes (holo.webp) in a hologram shader, a theatre plane facing the eye. The knight rears about his hind hooves and thrusts; the dragon's
  // body is a strip bent along its head's own trail (so it undulates as it swoops); its wings beat about the shoulder, edge-on through the stroke. Fire sparks, the lance's flash and the
  // dissolve's motes are one Points draw that reads the same transforms. A soft projector cone rises from the well below; a veil dims the sky behind it.
  const holo = new THREE.TextureLoader().load(new URL("./wonders/holo.webp", import.meta.url).href, img => sampleMotes(img.image), undefined, () => console.warn("wonders: holo.webp failed"));
  const hU = { uMap: { value: holo }, uT: { value: 0 }, uO: { value: v3() }, uX: { value: v3() }, uY: { value: v3() }, uM: { value: 1 }, uS: { value: 1 }, uE: { value: 0 }, uEa: { value: 0 }, uEb: { value: 1 }, uEt: { value: new THREE.Vector2(1, 8) },
    uRear: { value: 0 }, uLunge: { value: 0 }, uFlash: { value: 0 }, uIn: { value: 0 }, uOut: { value: 0 }, uOutT: { value: new THREE.Vector2(10, 2) }, uCone: { value: 0 }, uApex: { value: v3() },
    uCK: { value: new THREE.Color() }, uCD: { value: new THREE.Color() }, uEl: { value: new THREE.Vector2(8.6, 5.6) }, uF: FADE };
  const HOLO = `uniform vec3 uO, uX, uY; uniform float uT, uM, uS, uE, uEa, uEb, uRear, uLunge; uniform vec2 uEt;
    const vec4 KR = vec4(.0039, .0039, .5117, .5664), DR = vec4(.0039, .6768, .9922, .3193), WR = vec4(.5664, .2959, .4297, .2744); const vec2 KP = vec2(.3057, 0.), WP = vec2(.546, .033);
    const float KW = 4.1, KH = 4.55, DL = 9.5, DH = 3.06, WW = 5.2;
    vec2 headP(float e) { float d = (e - .36) / .16; return vec2(6.5 - 13.5 * e, 2.8 - 3.4 * exp(-d * d) + 1.6 * smoothstep(.5, .85, e) + .3 * sin(e * 13.)); }  // in high from the right, a dive at the knight, up and over him, away left
    float eAt(float t) { return mix(uEa, uEb, clamp((t - uEt.x) / uEt.y, 0., 1.)); }
    vec2 bodyAt(float e0, float s, out vec2 T) { float sp = length(headP(e0 + .01) - headP(e0 - .01)) / .02, e = e0 - (1. - s) * DL / max(sp, 1.); T = normalize(headP(e + .004) - headP(e - .004)); return headP(e); }
    vec2 knight(vec2 q) { return rot(uRear) * ((q - KP) * vec2(KW, KH)) + vec2(-3.5 + uLunge, -2.7); }
    vec2 dragon(float e0, vec2 q) { vec2 T, c = bodyAt(e0, q.x, T); return c + vec2(T.y, -T.x) * q.y * DH; }
    vec2 wing(vec2 q, float far) { vec2 T, c = bodyAt(uE, .72, T), n = vec2(T.y, -T.x); float ph = uT * 4.4 + far * .8; vec2 l = (q - WP) * vec2(WW, WW * .639); l.y *= .2 + .8 * cos(ph); l = rot(.15 + .3 * sin(ph)) * l;
      return c + n * .24 * DH + T * l.x + n * l.y; }
    vec3 world(vec2 p, float z) { return uO + (uX * uM * (p.x + 1.1) + uY * (p.y - .2)) * uS + normalize(cameraPosition - uO) * z; }`;  // the clash (local x -1.1) is the centre of the stage
  const battleG = new THREE.Group(); root.add(battleG);
  const holoGeo = (() => { const part = (g, id) => { g.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(id), 1)); return g; };
    const q = id => part(new THREE.PlaneGeometry(1, 1).translate(.5, .5, 0), id);
    return mergeGeometries([q(2), part(new THREE.PlaneGeometry(1, 1, 64, 1).translate(.5, 0, 0), 1), q(0), q(3)]); })();
  const figures = obj(new THREE.Mesh(holoGeo, mat(hU,
    `attribute float aPart; varying vec2 vUv, vL; varying float vP; ${HOLO}
     void main() { vec2 q = position.xy, p; vec4 r; float z = 0.; vP = aPart;
       if (aPart < .5) { p = knight(q); r = KR; } else if (aPart < 1.5) { p = dragon(uE, q); r = DR; q.y += .5; z = .3; } else { p = wing(q, aPart < 2.5 ? 1. : 0.); r = WR; z = aPart < 2.5 ? .1 : .5; }
       vUv = r.xy + q * r.zw; vL = p; gl_Position = projectionMatrix * viewMatrix * vec4(world(p, z), 1.); }`,
    `uniform sampler2D uMap; uniform vec3 uCK, uCD; uniform vec2 uEl; uniform float uT, uIn, uOut, uF; varying vec2 vUv, vL; varying float vP;
     void main() { float m = texture2D(uMap, vUv).r, mb = texture2D(uMap, vUv, 3.).r, rim = clamp((m - mb) * 3., 0., 1.) + clamp((mb - m) * 1.5, 0., 1.) * .45;
       vec3 c = vP < .5 ? uCK : uCD; if (vP > 1.5 && vP < 2.5) c *= .55;
       float scan = .7 + .3 * sin(gl_FragCoord.y * 1.25 - uT * 9.), band = .85 + .6 * smoothstep(.93, 1., sin(vL.y * .8 - uT * 2.2)), fl = .92 + .08 * sin(uT * 23.) * sin(uT * 7.1);
       float edge = 1. - smoothstep(.86, 1.03, length((vL - vec2(-1.1, .2)) / uEl)), nz = h1(dot(floor(vL * 7.), vec2(17.13, 3.71))), ui = uIn * 1.12, uo = uOut * 1.12, vin = smoothstep(nz, nz + .1, ui), vout = 1. - smoothstep(nz, nz + .1, uo);  // whole at 0, gone at 1
       float front = (vin - smoothstep(nz + .07, nz + .1, ui)) + (smoothstep(nz, nz + .1, uo) - smoothstep(nz + .07, nz + .1, uo));  // the bright line where it forms and where it breaks up
       float a = ((m * .55 * scan * band + rim * 1.5) * vin * vout + front * m * 2.) * fl * edge * uF; if (a < .004) discard; gl_FragColor = vec4(c, a); }`, "add", { depthTest: false })), 47);  // a projection: the wall behind never cuts it
  const NM = n(520), holoPts = pts(NM, { aM: 4, aN: 2 });  // aM: kind (0 mote, 1 spark, 2 flash), q.x, q.y, seed; aN: part, birth
  const sparks = obj(new THREE.Points(holoPts, mat(Object.assign({ uPx: PX }, hU),
    `attribute vec4 aM; attribute vec2 aN; uniform float uPx, uFlash, uIn; uniform vec2 uOutT; varying float vA, vK; varying vec3 vC; uniform vec3 uCK, uCD; ${HOLO}
     void main() { float k = aM.x, sd = aM.w; vec2 p; vec3 w; vA = 0.; vK = k; float sz = .12;
       if (k < .5) { float part = aN.x; p = part < .5 ? knight(aM.yz) : part < 1.5 ? dragon(uE, aM.yz) : wing(aM.yz, 0.); float nz = h1(dot(floor(p * 7.), vec2(17.13, 3.71))), age = uT - (uOutT.x + (nz + .05) / 1.12 * uOutT.y);
         w = world(p, .2) + (uY * (1.2 + sd) + uX * uM * (sd - .5) * 1.6) * uS * max(age, 0.) * (.6 + .4 * max(age, 0.)); vA = smoothstep(0., .15, age) * (1. - smoothstep(.8, 2.4, age)); vC = part < .5 ? uCK : uCD; sz = .1 + .12 * sd; }
       else if (k < 1.5) { float b = aN.y, age = uT - b, e = eAt(b); vec2 T, h = bodyAt(e, 1., T), n = vec2(T.y, -T.x), dir = rot((sd - .5) * .7 - .35) * T;
         p = h + n * .05 * DH + T * .3 + dir * age * (3.6 + 2. * fract(sd * 7.)) + vec2(0., -1.) * age * age * .8; w = world(p, .4); vA = step(0., age) * (1. - smoothstep(.45, 1.1, age)) * uIn; vC = mix(vec3(1., .9, .55), vec3(1., .42, .12), smoothstep(.1, .7, age)); sz = .34 * (1. - age * .45); }
       else { p = knight(vec2(.8417, 1.)); w = world(p, .6); vA = uFlash; vC = vec3(.85, .95, 1.); sz = 1.4 + .3 * sd; }
       vec4 mv = viewMatrix * vec4(w, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(sz * uS * uPx / -mv.z, 1.5, 96.); }`,
    `uniform float uF; varying float vA, vK; varying vec3 vC;
     void main() { vec2 d = gl_PointCoord - .5; float r = length(d) * 2., a = vK > 1.5 ? (exp(-r * r * 6.) * .8 + exp(-abs(d.x) * 40.) * exp(-abs(d.y) * 4.) + exp(-abs(d.y) * 40.) * exp(-abs(d.x) * 4.)) : smoothstep(1., .1, r);
       a *= vA * uF; if (a < .004) discard; gl_FragColor = vec4(vC, a); }`, "add", { depthTest: false })), 48);
  function sampleMotes(img) {  // dissolve motes start inside the silhouettes: sampled once from the atlas
    try { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.drawImage(img, 0, 0, 256, 256); const d = x.getImageData(0, 0, 256, 256).data, A = holoPts.attributes.aM.array, B = holoPts.attributes.aN.array;
      const rects = [[.0039, .0039, .5117, .5664], [.0039, .6768, .9922, .3193], [.5664, .2959, .4297, .2744]], NS = Math.round(NM * .55), NF = NM - NS - 2;
      for (let i = 0; i < NM; i++) { if (i >= NS) { A.set([i < NS + NF ? 1 : 2, 0, 0, Math.random()], i * 4); B.set([0, 0], i * 2); continue; }
        const part = Math.random() < .42 ? 0 : Math.random() < .8 ? 1 : 2, r = rects[part]; let qx = .5, qy = .5;
        for (let k = 0; k < 40; k++) { qx = Math.random(); qy = Math.random(); const u = r[0] + qx * r[2], v = r[1] + qy * r[3]; if (d[((255 - Math.min(255, v * 256 | 0)) * 256 + Math.min(255, u * 256 | 0)) * 4] > 140) break; }
        A.set([0, qx, part === 1 ? qy - .5 : qy, Math.random()], i * 4); B.set([part, 0], i * 2); }
      dirty(holoPts); } catch (e) { console.warn("wonders: motes not sampled", e); } }
  const coneGeo = (() => { const N = 40, a = new Float32Array(N * 9 * 2 / 3); for (let i = 0; i < N; i++) a.set([i / N * TAU, 0, i / N * TAU, 1, (i + 1) / N * TAU, 1], i * 6); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 9), 3)); g.setAttribute("aC", new THREE.BufferAttribute(a, 2)); return g; })();
  const cone = obj(new THREE.Mesh(coneGeo, mat(hU,
    `attribute vec2 aC; uniform vec3 uO, uX, uY, uApex; uniform float uS; uniform vec2 uEl; varying float vH, vE;
     void main() { vH = aC.y; vE = aC.x; vec3 ring = uO + (uX * cos(aC.x) * uEl.x * .92 + uY * sin(aC.x) * uEl.y * .92) * uS; gl_Position = projectionMatrix * viewMatrix * vec4(mix(uApex, ring, aC.y), 1.); }`,
    `uniform float uT, uCone, uF; uniform vec3 uCK; varying float vH, vE;
     void main() { float a = pow(vH, 1.6) * smoothstep(1., .82, vH) * .14 * (.75 + .25 * sin(vE * 9. + uT * .7)) * (.85 + .15 * sin(vH * 34. - uT * 5.)) * uCone * uF; gl_FragColor = vec4(mix(uCK, vec3(1.), .4), a); }`)), 43);
  battleG.add(cone, figures, sparks);
  const battle = { name: "battle", dur: [11, 13.5], group: battleG, need: "sky",
    start(p) { const O = aim(.85, 8, 18, hU.uO.value, .04), d = O.distanceTo(C), S = Math.min(R(1.6, 1.9) * Math.min(1.3, Math.max(.8, d / 12)), halfW(d) * .95 / 3.8); hU.uS.value = S; hU.uM.value = sgn();  // centred on the look; the knight and the dive fill the width
      const side = O.x > 0 ? 1 : O.x < 0 ? -1 : sgn(); hU.uApex.value.set(side * Math.max(8, Math.abs(O.x) + 8), O.y - 22, MID_Z + R(-1, 1));
      hU.uCK.value.setRGB(R(.25, .4), R(.62, .78), 1); hU.uCD.value.setRGB(1, R(.62, .78), R(.22, .36));
      const t0 = p.dur * R(.1, .14), t1 = p.dur * R(.72, .78); hU.uEa.value = R(.08, .16); hU.uEb.value = R(1.18, 1.3); hU.uEt.value.set(t0, t1 - t0); p.fireAt = p.dur * R(.2, .25); p.hitAt = p.dur * R(.36, .4);
      const A = holoPts.attributes.aN.array, M = holoPts.attributes.aM.array; for (let i = 0; i < NM; i++) if (M[i * 4] === 1) A[i * 2 + 1] = p.fireAt + Math.random() * p.dur * .12; holoPts.attributes.aN.needsUpdate = true;
      hU.uOutT.value.set(p.dur * .8, p.dur * .13); p.place = [O.x, O.y, O.z].map(v => +v.toFixed(1)); p.size = S; p.mirror = hU.uM.value; return true; },
    tick(p, u, t) { hU.uT.value = t; hU.uE.value = lerp(hU.uEa.value, hU.uEb.value, clamp01((t - hU.uEt.value.x) / hU.uEt.value.y));
      hU.uX.value.setFromMatrixColumn(camera.matrixWorld, 0); hU.uY.value.setFromMatrixColumn(camera.matrixWorld, 1);
      const rear = Math.exp(-((t - p.hitAt + .5) ** 2) / 1.6), hit = Math.exp(-((t - p.hitAt) ** 2) / .06); hU.uRear.value = .55 * rear + .07 * Math.sin(t * 7) * rear; hU.uLunge.value = .5 * hit; hU.uFlash.value = hit;  // he rears as it dives, and thrusts as it passes over
      hU.uIn.value = clamp01((u - .01) / .13); hU.uOut.value = clamp01((u - .8) / .13); hU.uCone.value = win(u, 0, .08, .86, 1);  // linear: the motes' own clock (uOutT) follows the same line
      useVeil(VEIL.holo, .42 * win(u, 0, .1, .85, 1), V1.copy(hU.uO.value).sub(C).normalize(), Math.cos(.75), Math.cos(.3)); } };

  // ======== 3. constellation: the top of the well dims to night; stars there gather into a sky whale (a phoenix read as a scribble at a glance, so it is the whale every time), its lines trace in, it swims across trailing stardust,
  // the lines fade and the stars scatter. The whale is a few dozen hand-placed points (x -1..1 = tail..head); its body wave, fluke beat and fin sweep are shader functions of them.
  const WHALE = { pts: [[1, -.02], [.96, .12], [.82, .22], [.5, .29], [.15, .3], [-.15, .25], [-.25, .33], [-.33, .2], [-.6, .1], [-.78, .12, 2], [-1.02, .4, 2], [-.9, .17, 2], [-1.07, .03, 2], [-.78, .03, 2],
      [-.6, -.03], [-.3, -.17], [.05, -.29], [.45, -.33], [.78, -.25], [.95, -.12],  // a humpback, head right, deep blunt head, tail flukes raised: outline 0-19 (the flukes are part 2)
      [.42, -.22, 1], [0, -.72, 1], [.27, -.27, 1], [.74, .02], [.99, -.06], [.6, -.1], [.7, -.2], [.15, -.25], [.52, .28]],  // 20-22 the long pectoral fin; the eye; the mouth; a throat groove; the blowhole
    lines: [...Array.from({ length: 20 }, (_, i) => [i, (i + 1) % 20]), [20, 21], [21, 22], [24, 25], [26, 27]], fill: [Array.from({ length: 20 }, (_, i) => i), [20, 21, 22]] };
  const inPoly = (x, y, P, pts) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = pts[P[i]], b = pts[P[j]]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const bodyGeo = T => { const pos = [], idx = []; for (const P of T.fill) { const o = pos.length / 3, ring = P.map(k => new THREE.Vector2(T.pts[k][0], T.pts[k][1]));  // the creature's silhouette, triangulated once, in template coordinates
      for (const k of P) pos.push(T.pts[k][0], T.pts[k][1], T.pts[k][2] ?? 0); for (const t of THREE.ShapeUtils.triangulateShape(ring, [])) idx.push(o + t[0], o + t[1], o + t[2]); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setIndex(idx); return g; };
    const sU = { uT: { value: 0 }, uA: { value: v3() }, uB: { value: v3() }, uSwim: { value: new THREE.Vector2(2, 9) }, uX: { value: v3() }, uY: { value: v3() }, uSc: { value: 9 },
    uGat: { value: new THREE.Vector2(1, 2.5) }, uLin: { value: new THREE.Vector3(2, 2.5, 10) }, uScat: { value: 11 }, uCol: { value: new THREE.Color() }, uPx: PX, uF: FADE };
  const SHAPE = `uniform float uT, uSc; uniform vec3 uA, uB, uX, uY; uniform vec2 uSwim;
    vec3 centre(float t) { float s = clamp((t - uSwim.x) / uSwim.y, 0., 1.); s = s * s * (3. - 2. * s) * .45 + s * .55; return mix(uA, uB, s) + vec3(0., sin(t * .55) * .8, 0.); }
    vec2 shape(vec3 a, float t) { vec2 p = a.xy;
      float ph = t * 1.4;
      if (a.z > 1.5) { vec2 pv = vec2(-.76, .08); p = pv + vec2(0., sin(ph + 1.67) * .12) + rot(sin(ph - 1.2) * .38) * (p - pv); }  // the flukes beat about the tail stock
      else { p.y += sin(ph - p.x * 2.2) * .13 * smoothstep(.15, -1., p.x); if (a.z > .5) { vec2 b = vec2(.38, -.19); p = b + rot(sin(ph + 1.) * .4) * (p - b); } }  // the body swims, more toward the tail; the long fin sweeps
      return p; }
    vec3 at(vec3 a, float t) { vec2 p = shape(a, t); return centre(t) + (uX * p.x + uY * p.y) * uSc; }`;
  const NS = n(820), starG = pts(NS, { aT: 3, aS: 3, aE: 3, aK: 4 });  // aT template (x, y, part); aS start; aE end (or drift); aK: role (0 star of the creature, 1 sky star, 2 stardust), time, size, seed
  const stars = obj(new THREE.Points(starG, mat(sU,
    `attribute vec3 aT, aS, aE; attribute vec4 aK; uniform float uPx, uScat; uniform vec2 uGat; varying float vA; ${SHAPE}
     void main() { float r = aK.x, tk = aK.y, sd = aK.w, tw = .65 + .35 * sin(uT * (2. + sd * 3.) + sd * 40.); vec3 w;
       if (r < .5) { float g = smoothstep(0., 1.7, uT - tk), sc = smoothstep(0., 2.4, uT - uScat - sd * .9); w = mix(mix(aS, at(aT, uT), g * g * (3. - 2. * g)), aE, sc);
         vA = smoothstep(0., .8, uT - uGat.x + 1.2 - sd) * (1. - smoothstep(.5, 1., sc)) * tw * (.7 + .3 * g); }
       else if (r < 1.5) { w = aS + aE * uT * .04; vA = smoothstep(tk, tk + 1.5, uT) * (1. - smoothstep(uScat + 1., uScat + 3.5, uT)) * tw * .7; }
       else if (r > 2.5) { float age = uT - tk; w = at(vec3(.52, .3, 0.), tk) + (uY * (2.6 * age - 1.1 * age * age) * (.8 + .4 * fract(sd * 3.)) + uX * (fract(sd * 7.) - .5) * 1.6 * age) * uSc * .2;  // the whale's blow: a fountain of stardust
         vA = step(0., age) * (1. - smoothstep(1.4, 2.6, age)) * tw; }
       else { float age = uT - tk; w = at(vec3(-.95 + fract(sd * 7.) * .2, (fract(sd * 13.) - .5) * .4, 2.), tk) + aE * age; vA = step(0., age) * smoothstep(0., .3, age) * (1. - smoothstep(1.5, 4.5, age)) * tw; }
       vec4 mv = viewMatrix * vec4(w, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aK.z * uPx / -mv.z, 1.5, 40.); }`,
    `uniform vec3 uCol; uniform float uF; varying float vA;
     void main() { vec2 d = gl_PointCoord - .5; float r = length(d) * 2., a = (exp(-r * r * 9.) + .35 * exp(-abs(d.x) * 26.) * exp(-abs(d.y) * 6.) + .35 * exp(-abs(d.y) * 26.) * exp(-abs(d.x) * 6.)) * vA * uF;
       if (a < .004) discard; gl_FragColor = vec4(mix(uCol, vec3(1.), .55), a); }`, "add", { depthTest: false })), 48);  // a sky over the walls: never cut by the wall it hangs in front of
  const NLN = 32, lineG = inst(new THREE.PlaneGeometry(1, 1), NLN, { aP0: 3, aP1: 3, aL: 2 });
  const lines = obj(new THREE.Mesh(lineG, mat(sU,
    `attribute vec3 aP0, aP1; attribute vec2 aL; uniform vec3 uLin; varying float vA, vX; ${SHAPE}
     void main() { float t0 = uLin.x + aL.x * uLin.y, pr = smoothstep(t0, t0 + .6, uT); vec3 a = at(aP0, uT), b = at(aP1, uT), e = mix(a, b, pr), m = mix(a, e, position.y + .5);
       vec3 sd = normalize(cross(b - a, cameraPosition - m)) * max(.3, length(cameraPosition - m) * .012); vX = position.x * 2.;  // wide: a bright core in a soft glow
       vA = step(.001, pr) * (1. - smoothstep(uLin.z, uLin.z + 1.4, uT)) * (.8 + .2 * sin(uT * 3. + aL.y * 20.)); gl_Position = projectionMatrix * viewMatrix * vec4(m + sd * position.x * 2., 1.); }`,
    `uniform vec3 uCol; uniform float uF; varying float vA, vX; void main() { float a = (exp(-vX * vX * 60.) * .95 + exp(-vX * vX * 6.) * .3) * vA * uF; if (a < .004) discard; gl_FragColor = vec4(mix(uCol, vec3(1.), exp(-vX * vX * 60.) * .5), a); }`, "add", { depthTest: false })), 47);
  const body = obj(new THREE.Mesh(bodyGeo(WHALE), mat(sU,
    `uniform vec3 uLin; varying vec2 vT; varying float vA; ${SHAPE}
     void main() { vT = position.xy; vA = smoothstep(uLin.x + uLin.y * .5, uLin.x + uLin.y + 1., uT) * (1. - smoothstep(uLin.z, uLin.z + 1.4, uT)); gl_Position = projectionMatrix * viewMatrix * vec4(at(position, uT), 1.); }`,
    `uniform vec3 uCol; uniform float uT, uF; varying vec2 vT; varying float vA;
     void main() { float n = .7 + .3 * sin(vT.x * 9. + uT * .7) * sin(vT.y * 14. - uT * .5); float a = .2 * n * vA * uF; if (a < .003) discard; gl_FragColor = vec4(mix(vec3(.3, .55, 1.), uCol, .35), a); }`, "add", { depthTest: false })), 46);  // a faint blue glow fills the silhouette
  const starsG = new THREE.Group(); starsG.add(body, stars, lines); root.add(starsG);
  const constellation = { name: "constellation", dur: [12.5, 15], group: starsG, need: "sky",
    start(p) { const T = WHALE, dir = sgn(), Tp = aim(.95, 22, 46, V2, .05), sc = Math.min(R(.9, 1.1) * Math.max(6, Math.min(10.5, Tp.distanceTo(C) * .38)), halfW(Tp.distanceTo(C)) * 1.05), A = sU.uA.value, B = sU.uB.value;
      const wide = Math.abs(Tp.x) > Wl.home.x[1] + 2, sw = R(11, 15);  // in front of a wall it swims along the wall; out over the open well, across the view
      if (wide) { V1.set(-view.fz, 0, view.fx); A.copy(Tp).addScaledVector(V1, -dir * sw); B.copy(Tp).addScaledVector(V1, dir * sw); } else { A.set(Tp.x - dir * sw, Tp.y, Tp.z); B.set(Tp.x + dir * sw, Tp.y, Tp.z); }
      A.y += R(-2, 1); B.y += R(-1, 3); for (const P of [A, B]) { const r = Math.hypot(P.x - WC[0], P.z - WC[1]); if (r > 22) { P.x = WC[0] + (P.x - WC[0]) * 22 / r; P.z = WC[1] + (P.z - WC[1]) * 22 / r; } }
      sU.uSc.value = sc; sU.uCol.value.setRGB(...pick([[.7, .82, 1], [.75, .9, 1], [.8, .78, 1], [.6, .95, 1]]));
      const d = p.dur, g0 = d * R(.04, .07); sU.uGat.value.set(g0, d * .12); sU.uSwim.value.set(g0 + d * .08, d * R(.66, .72)); sU.uLin.value.set(g0 + d * .1, d * .12, d * R(.74, .78)); sU.uScat.value = d * R(.8, .84);
      const nKey = T.pts.length, nFill = n(330), nSky = n(250), at = (i, x, y, part) => set(starG, "aT", i, x, y, part ?? 0);
      for (let i = 0; i < NS; i++) {
        if (i < nKey + nFill) { if (i < nKey) at(i, ...T.pts[i]); else if (i % 3) { let x = 0, y = 0, k = 0, part = 0; for (; k < 30; k++) { x = R(-1.05, 1.05); y = R(-.65, 1); part = T.fill.findIndex(P => inPoly(x, y, P, T.pts)); if (part >= 0) break; }  // a dense field inside the silhouette
              at(i, x, y, part === 1 ? 1 : x < -.76 ? 2 : 0); }
            else { const L = pick(T.lines), a = T.pts[L[0]], b = T.pts[L[1]], f = Math.random(); at(i, lerp(a[0], b[0], f) + R(-.02, .02), lerp(a[1], b[1], f) + R(-.02, .02), a[2] === b[2] ? a[2] : 0); }  // and along its lines
          set(starG, "aS", i, Tp.x + R(-22, 22), Tp.y + R(-10, 16), Tp.z + R(-6, 6)); set(starG, "aE", i, A.x + (B.x - A.x) * R(.6, 1.3) + R(-16, 16), Tp.y + R(-6, 26), Tp.z + R(-8, 8));
          set(starG, "aK", i, 0, g0 + Math.random() * d * .1, i < nKey ? R(1.1, 1.5) : R(.3, .62), Math.random()); }
        else if (i < nKey + nFill + nSky) { const a = R(0, TAU), r = Math.sqrt(Math.random()) * 23; set(starG, "aS", i, WC[0] + Math.cos(a) * r, Tp.y + R(-8, 30), WC[1] + Math.sin(a) * r); set(starG, "aE", i, R(-.3, .3), R(-.1, .2), R(-.3, .3)); set(starG, "aK", i, 1, Math.random() * d * .25, R(.25, .6), Math.random()); }
        else if (i >= NS - n(80)) { const sw = sU.uSwim.value; set(starG, "aK", i, 3, sw.x + sw.y * (Math.random() < .5 ? R(.25, .32) : R(.6, .67)), R(.3, .55), Math.random()); }  // two blows during the swim
        else { set(starG, "aE", i, R(-.25, .25), R(-.6, -.15), R(-.25, .25)); set(starG, "aK", i, 2, sU.uSwim.value.x + Math.random() * sU.uSwim.value.y, R(.3, .6), Math.random()); } }
      dirty(starG); const L = T.lines.length;
      for (let i = 0; i < NLN; i++) { const ln = T.lines[i % L], a = T.pts[ln[0]], b = T.pts[ln[1]]; set(lineG, "aP0", i, a[0], a[1], a[2] ?? 0); set(lineG, "aP1", i, b[0], b[1], b[2] ?? 0); set(lineG, "aL", i, i < 20 ? i / 20 * .7 : .7 + Math.random() * .3, Math.random()); }
      lineG.instanceCount = L; dirty(lineG); p.place = [Tp.x, Tp.y, Tp.z].map(v => +v.toFixed(1)); p.size = +sc.toFixed(1); p.dir = dir; return true; },
    tick(p, u, t) { sU.uT.value = t; const c = V1.copy(sU.uB.value).sub(sU.uA.value).normalize(), mid = V2.copy(sU.uA.value).lerp(sU.uB.value, .5), z = V3.copy(C).sub(mid).normalize();
      sU.uX.value.copy(c).addScaledVector(z, -c.dot(z)).normalize(); sU.uY.value.crossVectors(z, sU.uX.value).normalize(); V1.setFromMatrixColumn(camera.matrixWorld, 1); if (sU.uY.value.dot(V1) < 0) sU.uY.value.negate();  // the creature's back up on screen
      useVeil(VEIL.night, .72 * win(u, 0, .12, .86, 1), V2.copy(mid).sub(C).normalize().lerp(UPV, .4).normalize(), 0, .6); } };

  // ======== 4. airship: a folded-paper airship (faceted envelope in two papers, gondola, fins, a spinning propeller) spirals up the well on an ellipse that keeps between the walls,
  // banking into the turn, into the light; its trail is a ribbon that re-evaluates the same flight path backwards in time, and sparkles shed along it.
  const aU = { uT: { value: 0 }, uD: { value: 12 }, uA0: { value: 0 }, uDir: { value: 1 }, uTurns: { value: 2.2 }, uRad: { value: new THREE.Vector2(11, 3.8) }, uCtr: { value: new THREE.Vector2(0, MID_Z) }, uY0: { value: 2 }, uY1: { value: 110 }, uSc: { value: 1 },
    uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() }, uTr: { value: new THREE.Color() }, uA: { value: 1 }, uPx: PX, uF: FADE };
  const PATH = `uniform float uT, uD, uA0, uDir, uTurns, uY0, uY1, uSc; uniform vec2 uRad, uCtr;
    vec3 path(float t) { float s = clamp(t / uD, 0., 1.), a = uA0 + uDir * uTurns * 6.2832 * (s * .8 + .2 * s * s), k = 1. - .3 * s; return vec3(uCtr.x + uRad.x * k * cos(a), uY0 + (uY1 - uY0) * pow(s, 2.6), uCtr.y + uRad.y * k * sin(a)); }`;
  const flight = (t, o) => { const s = clamp01(t / aU.uD.value), a = aU.uA0.value + aU.uDir.value * aU.uTurns.value * TAU * (s * .8 + .2 * s * s), k = 1 - .3 * s;
    return o.set(aU.uCtr.value.x + aU.uRad.value.x * k * Math.cos(a), aU.uY0.value + (aU.uY1.value - aU.uY0.value) * s ** 2.6, aU.uCtr.value.y + aU.uRad.value.y * k * Math.sin(a)); };
  const shipGeo = (() => { const parts = [], add = (g, pan, spin = 0) => { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); const c = g.attributes.position.count;
      g.setAttribute("aPan", new THREE.BufferAttribute(new Float32Array(c).fill(pan), 1)); g.setAttribute("aSpin", new THREE.BufferAttribute(new Float32Array(c).fill(spin), 1)); g.deleteAttribute("uv"); parts.push(g); return g; };
    const prof = []; for (let i = 0; i <= 10; i++) { const x = -.8 + 1.6 * i / 10, r = .34 * Math.pow(Math.max(0, 1 - (x / .82) ** 2), .62) * (x < 0 ? 1 - .25 * (-x / .8) ** 2 : 1); prof.push(new THREE.Vector2(Math.max(.004, r), x)); }
    const env = new THREE.LatheGeometry(prof, 10).rotateZ(-Math.PI / 2).toNonIndexed(), pc = env.attributes.position.count, pan = new Float32Array(pc);
    for (let i = 0; i < pc; i++) pan[i] = Math.floor(i / (6 * 10)) % 2; env.computeVertexNormals(); env.setAttribute("aPan", new THREE.BufferAttribute(pan, 1)); env.setAttribute("aSpin", new THREE.BufferAttribute(new Float32Array(pc), 1)); env.deleteAttribute("uv"); parts.push(env);
    add(new THREE.BoxGeometry(.5, .13, .17).translate(.05, -.44, 0), 2); add(new THREE.BoxGeometry(.02, .12, .02).translate(-.12, -.33, .06), 2); add(new THREE.BoxGeometry(.02, .12, .02).translate(.22, -.33, -.06), 2);
    for (const [ry, rx] of [[0, 0], [0, Math.PI / 2]]) add(new THREE.BoxGeometry(.3, .22, .012).translate(-.66, .18, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(rx + ry)), 3);
    add(new THREE.BoxGeometry(.3, .22, .012).translate(-.66, -.18, 0), 3); add(new THREE.BoxGeometry(.3, .012, .22).translate(-.66, 0, -.18), 3);
    add(new THREE.BoxGeometry(.015, .36, .05).translate(-.86, 0, 0), 4, 1); add(new THREE.BoxGeometry(.015, .05, .36).translate(-.86, 0, 0), 4, 1); add(new THREE.BoxGeometry(.06, .06, .06).translate(.05, -.53, 0), 5);
    return mergeGeometries(parts); })();
  const ship = obj(new THREE.Mesh(shipGeo, mat(aU,
    `attribute float aPan, aSpin; uniform float uT; varying float vP; varying vec3 vN;
     void main() { vec3 p = position, n = normal; if (aSpin > .5) { p.x += .86; mat2 r = rot(uT * 22.); p.yz = r * p.yz; n.yz = r * n.yz; p.x -= .86; } vP = aPan; vN = normalize(mat3(modelMatrix) * n);
       gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.); }`,
    `uniform vec3 uC0, uC1; uniform float uA, uF, uT; varying float vP; varying vec3 vN;
     void main() { vec3 n = normalize(vN), c = vP < .5 ? uC0 : vP < 1.5 ? uC1 : vP < 2.5 ? vec3(.42, .27, .14) : vP < 3.5 ? uC1 * .8 : vP < 4.5 ? vec3(.85, .8, .7) : vec3(2., 1.6, .9) * (.85 + .15 * sin(uT * 9.));
       float l = vP > 4.5 ? 1. : .38 + .75 * max(dot(n, normalize(vec3(.3, 1., .45))), 0.) + .3 * pow(1. - abs(n.y), 3.) * .5; float a = uA * uF; gl_FragColor = vec4(c * l * a, a); }`, "pre", { depthWrite: true })), 46);
  const TRN = n(90), trailG = new THREE.BufferGeometry(); { const a = new Float32Array((TRN + 1) * 4); for (let i = 0; i <= TRN; i++) a.set([i / TRN, -1, i / TRN, 1], i * 4); trailG.setAttribute("position", new THREE.BufferAttribute(new Float32Array((TRN + 1) * 6), 3)); trailG.setAttribute("aT", new THREE.BufferAttribute(a, 2));
    const ix = []; for (let i = 0; i < TRN; i++) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); trailG.setIndex(ix); }
  const trail = obj(new THREE.Mesh(trailG, mat(aU,
    `attribute vec2 aT; varying float vA, vS, vX; ${PATH}
     void main() { float ts = uT - aT.x * 3.6; vec3 p = path(ts), d = normalize(path(ts + .05) - p); p -= d * .95 * uSc; vec3 s = normalize(cross(d, cameraPosition - p)); float w = (.16 * (1. - aT.x) + .03) * uSc + length(cameraPosition - p) * .002;
       vA = step(0., ts) * pow(1. - aT.x, 1.4) * (1. - smoothstep(90., 115., p.y)); vS = aT.x; vX = aT.y; gl_Position = projectionMatrix * viewMatrix * vec4(p + s * aT.y * w, 1.); }`,
    `uniform vec3 uTr; uniform float uT, uF; varying float vA, vS, vX;
     void main() { float a = exp(-vX * vX * 3.) * vA * uF * (.7 + .3 * sin(vS * 70. - uT * 12.)); if (a < .004) discard; gl_FragColor = vec4(mix(uTr, vec3(1.), exp(-vX * vX * 10.) * .5), a); }`)), 45);
  const NSP = n(150), sparkG = pts(NSP, { aK: 4 });
  const sparkles = obj(new THREE.Points(sparkG, mat(aU,
    `attribute vec4 aK; uniform float uPx; varying float vA; ${PATH}
     void main() { float e = aK.x, age = uT - e; vec3 p = path(e), d = normalize(path(e + .05) - p); p += -d * .95 * uSc + (vec3(fract(aK.y * 7.), fract(aK.y * 13.), fract(aK.y * 29.)) - .5) * age * .9 + vec3(0., -.35, 0.) * age;
       vA = step(0., age) * smoothstep(0., .2, age) * (1. - smoothstep(1., 2.6, age)) * (.6 + .4 * sin(uT * 14. + aK.y * 50.)) * (1. - smoothstep(90., 115., p.y));
       vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aK.z * uSc * uPx / -mv.z, 1.5, 28.); }`,
    `uniform vec3 uTr; uniform float uF; varying float vA; void main() { vec2 d = gl_PointCoord - .5; float r = length(d) * 2., a = (exp(-r * r * 8.) + .4 * exp(-abs(d.x) * 30.) * exp(-abs(d.y) * 5.) + .4 * exp(-abs(d.y) * 30.) * exp(-abs(d.x) * 5.)) * vA * uF;
       if (a < .004) discard; gl_FragColor = vec4(mix(uTr, vec3(1.), .5), a); }`)), 47);
  const shipG = new THREE.Group(); shipG.add(trail, sparkles, ship); root.add(shipG);
  const SHIPS = [[[.86, .26, .22], [.95, .9, .8]], [[.2, .4, .75], [.96, .86, .55]], [[.25, .55, .4], [.95, .92, .82]], [[.5, .3, .62], [.98, .85, .6]], [[.95, .75, .3], [.6, .2, .18]]];
  const airship = { name: "airship", dur: [12, 15], group: shipG, need: "any",
    start(p) { const S = R(.8, 1.1), dir = sgn(), rx = R(2.8, 3.6); let rz = R(1.4, 1.8);  // a helix out in front of the eye, so it climbs through the view; between the walls it is flattened to fit
      const d = Math.min(6, free(view.fx, 0, view.fz) * .6), cx = Math.max(-14, Math.min(14, C.x + view.fx * d)); let cz = C.z + view.fz * d;
      if (Math.abs(cx) < Wl.home.x[1] + rx) { cz = Math.max(Wl.home.z + 2.2, Math.min(Wl.door.z - 1.5, cz)); rz = Math.max(.6, Math.min(rz, Math.hypot(cx - C.x, cz - C.z) - 3.2, cz - Wl.home.z - 1)); } else rz = rx;  // its near side keeps 3 m from the eye
      aU.uCtr.value.set(cx, cz); aU.uSc.value = S; aU.uDir.value = dir; aU.uD.value = p.dur; aU.uTurns.value = R(2.2, 3); aU.uRad.value.set(rx, rz);
      const sd = sgn(); aU.uA0.value = Math.atan2(sd * view.fx, -sd * view.fz); aU.uY0.value = Math.max(3.4, Math.min(30, C.y + Math.tan(view.pitch) * Math.hypot(cx - C.x, cz - C.z) + R(-.5, .5))); aU.uY1.value = R(100, 120);  // it starts at one side of the view, at the height the visitor is looking at
      p.place = [+cx.toFixed(1), +cz.toFixed(1)];
      const pal = pick(SHIPS); aU.uC0.value.setRGB(...pal[0]); aU.uC1.value.setRGB(...pal[1]); aU.uTr.value.setRGB(...pick([[1, .8, .4], [.5, .9, 1], [1, .6, .75], [.75, 1, .6]]));
      const A = sparkG.attributes.aK.array; for (let i = 0; i < NSP; i++) A.set([Math.random() * p.dur, Math.random(), R(.08, .18), 0], i * 4); sparkG.attributes.aK.needsUpdate = true;
      ship.scale.setScalar(S); p.size = +S.toFixed(2); p.dir = dir; p.colour = pal[0]; return true; },
    tick(p, u, t) { aU.uT.value = t; flight(t, V1); flight(t + .06, V2); V2.sub(V1).normalize(); ship.position.copy(V1); V3.crossVectors(V2, UPV).normalize(); Q1.setFromAxisAngle(V2, -aU.uDir.value * .3);
      F.copy(UPV).applyQuaternion(Q1); V3.crossVectors(V2, F).normalize(); F.crossVectors(V3, V2); M4.makeBasis(V2, F, V3); ship.quaternion.setFromRotationMatrix(M4); aU.uA.value = Math.min(sm(u / .04), 1 - sm((V1.y - 90) / 25)); } };

  // ======== 5. underwater: the well becomes the sea for a while. A teal veil; moving caustics (the Abyssal Garden's domain-feedback pattern, computed in the fragment shader, projected
  // along a slanted sun) wash over the well wall, the home and entrance walls and the floor, with a few aqua shafts; a school of glowing fish and one manta swim through the air; kelp sways
  // from shelf edges and railings; bubbles rise. Then the water level sinks past the eye: everything above it is dry again, the surface a line of light.
  const IT = phone ? 3 : 5;
  const causGeo = (() => { const tag = (g, k) => { g = g.index ? g.toNonIndexed() : g; g.setAttribute("aK", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(k), 1)); g.deleteAttribute("uv"); return g; };
    const L = [tag(new THREE.CylinderGeometry(25.7, 25.7, 90, 72, 1, true).translate(WC[0], 25, WC[1]), 0), tag(new THREE.PlaneGeometry(16.5, 32).translate(0, 14, Wl.home.z + .03), 0),
      tag(new THREE.PlaneGeometry(32.7, 32).rotateY(Math.PI).translate(0, 14, Wl.door.z - .04), 0), tag(new THREE.PlaneGeometry(10.8, 9.9).rotateX(-Math.PI / 2).translate(0, .02, 4.05), 0)];
    for (let i = 0; i < 7; i++) { const x = (i - 3) * 3.6 + R(-.8, .8), z = R(.8, 8), r = R(.6, 1.6); L.push(tag(new THREE.CylinderGeometry(r, r * 1.6, 80, 12, 1, true).applyMatrix4(new THREE.Matrix4().makeRotationZ(.12 + R(-.05, .05))).translate(x, 36, z), 1)); }
    return mergeGeometries(L); })();
  const wU = { uT: { value: 0 }, uA: { value: 0 }, uLevel: { value: 1e4 }, uCol: { value: new THREE.Color(.35, 1, .95) }, uSC: { value: v3() }, uSR: { value: v3() }, uDirS: { value: 1 }, uSP: { value: 0 }, uM: { value: new THREE.Vector4() },
    uFA: { value: new THREE.Color() }, uFB: { value: new THREE.Color() }, uGrow: { value: 0 }, uIn: { value: 0 }, uPx: PX, uF: FADE };
  const caus = obj(new THREE.Mesh(causGeo, mat(wU,
    `attribute float aK; varying vec3 vW, vN; varying float vK; void main() { vW = position; vN = normal; vK = aK; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`,
    `uniform float uT, uA, uLevel, uF; uniform vec3 uCol; varying vec3 vW, vN; varying float vK;
     float caus(vec2 p, float t) { vec2 i = p; float c = 1.; for (int n = 0; n < ${IT}; n++) { float tt = t * (1. - 3.5 / float(n + 1)); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x)); c += 1. / length(vec2(p.x / (sin(i.x + tt) / .005), p.y / (cos(i.y + tt) / .005))); }
       c /= float(${IT}); c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.); }
     void main() { float wet = smoothstep(uLevel + .8, uLevel - .8, vW.y), d = length(vW - cameraPosition); if (wet < .01) discard; vec3 nn = normalize(vN); vec2 q = abs(nn.y) > .5 ? vW.xz : vec2(dot(vW.xz, normalize(vec2(-nn.z, nn.x))), vW.y * .8) + vec2(uT * .15, 0.); float a;  // the net laid flat on each surface, drifting
       if (vK < .5) a = (min(caus(q * 1.1 - 250., uT * .5 + 23.), 2.) * .85 + .05) * mix(1., .3, smoothstep(12., 45., d));
       else { float e = abs(dot(normalize(vN), normalize(cameraPosition - vW))); a = pow(e, 2.) * .13 * (.7 + .3 * sin(uT * .8 + vW.y * .3)) * smoothstep(-6., 4., vW.y) * smoothstep(76., 50., vW.y); }
       a *= uA * uF * wet; if (a < .004) discard; gl_FragColor = vec4(uCol, a); }`)), 37);
  const NF = n(80), NK = 12, critterG = inst(new THREE.PlaneGeometry(1, 1, 14, 1), NF + 1 + NK, { aI: 4, aO: 4 });  // aI: kind (0 fish, 1 manta, 2 kelp), seed, size, phase; aO: offset (fish) or anchor (kelp), length
  const critters = obj(new THREE.Mesh(critterG, mat(wU,
    `attribute vec4 aI, aO; uniform float uT, uDirS, uSP, uGrow, uIn, uLevel; uniform vec3 uSC, uSR; uniform vec4 uM; varying vec2 vQ; varying float vK, vSd, vA;
     vec3 fish(float t) { float tt = t * uDirS * (.9 + .2 * aI.y); float ph = uSP + aI.w; return uSC + vec3(sin(tt * .22 + ph) * uSR.x, sin(tt * .31 + ph * 2.) * uSR.y, cos(tt * .22 + ph) * uSR.z) + aO.xyz * (1. + .2 * sin(t * .5 + aI.y * 6.))
       + vec3(sin(t * 1.1 + aI.y * 9.), sin(t * .9 + aI.y * 5.) * .5, cos(t * 1.3 + aI.y * 7.)) * .45; }
     vec3 manta(float t) { float a = t * .14 * uM.w + uM.z; return vec3(uM.x + sin(a) * 8., uM.y + sin(a * 1.7) * 1.4, ${MID_Z} + cos(a) * 3.); }
     void main() { float k = aI.x, sd = aI.y, sz = aI.z; vK = k; vSd = sd; vQ = position.xy + .5; vec3 p;
       if (k < .5) { vec3 c = fish(uT), h = normalize(fish(uT + .1) - c), s = normalize(cross(h, cameraPosition - c)); float x = position.x; p = c + h * x * sz + s * (position.y * sz * .42 + sin(uT * 9. + x * 5. + sd * 20.) * .09 * sz * (.6 - x)); vA = uIn; }
       else if (k < 1.5) { vec3 c = manta(uT), h = normalize(manta(uT + .1) - c), s = normalize(cross(vec3(0., 1., 0.), h)); float x = position.x, ax = abs(x * 2.);
         p = c + s * x * sz + h * position.y * sz * .6 + vec3(0., 1., 0.) * (sz * .2 * pow(ax, 1.6) * sin(uT * 1.25 - ax * 1.2) - .1 * sz * .2 * sin(uT * 1.25)); vA = uIn; }
       else { float x = position.x + .5, L = aO.w * uGrow; vec3 s = normalize(cross(vec3(0., 1., 0.), cameraPosition - aO.xyz)); p = aO.xyz + vec3(0., 1., 0.) * x * L + s * (position.y * .26 + sin(uT * .8 + x * 2. + sd * 6.) * .45 * pow(x, 1.4) * L / 3.);
         vQ = vec2(position.y + .5, x); vA = smoothstep(0., .05, uGrow); }
       vA *= smoothstep(uLevel + .5, uLevel - .5, p.y); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    `uniform vec3 uFA, uFB; uniform float uT, uF; varying vec2 vQ; varying float vK, vSd, vA;
     void main() { vec2 q = vQ - .5; vec4 o;
       if (vK < .5) { float b = length((q - vec2(.08, 0.)) / vec2(.36, .21)) - 1., tl = q.x < -.22 ? abs(q.y) - (-.22 - q.x) * 1.4 : 1., d = min(b, tl * 6.), a = smoothstep(.12, -.05, d);
         vec3 c = mix(uFA, uFB, fract(vSd * 3.7)), body = mix(c * .8, vec3(.85, .95, 1.) * .75, smoothstep(0., -.18, q.y) * .7); float eye = smoothstep(.04, .02, length(q - vec2(.3, .04))), stripe = exp(-pow((q.y - .02 + .08 * q.x) * 18., 2.)) * step(-.3, q.x);
         o = vec4(body * a * (1. - eye) + c * (stripe * 1.3 + smoothstep(-.12, 0., d) * .9) * a, a * .8); }
       else if (vK < 1.5) { float y = q.y + .5, ax = abs(q.x), lead = .92 - .5 * ax - .9 * ax * ax, trail = .18 + .27 * pow(ax / .5, .6), d = max(y - lead, trail - y) * 4., a = smoothstep(.04, -.04, d) * step(ax, .5);  // a manta seen from below
         float ceph = length(vec2(ax - .065, (y - .96) * .7)) - .035, tail = step(ax, .012) * step(y, .2); a = max(max(a, smoothstep(.01, -.01, ceph)), tail);
         float gill = step(abs(fract((y - .58) * 22.) - .5), .18) * step(.58, y) * step(y, .72) * step(.07, ax) * step(ax, .13);
         vec3 c = mix(vec3(.82, .9, .94), vec3(.18, .3, .38), smoothstep(.1, .45, ax) + smoothstep(-.12, 0., d) * .6) * (1. - gill * .6) + vec3(.35, 1., .9) * smoothstep(-.05, 0., d) * .6; o = vec4(c * a, a * .88); }
       else { float w = .5 * (.55 + .3 * sin(vQ.y * 22. + vSd * 9.)) * (1. - .6 * vQ.y), d = abs(q.x) - w, a = smoothstep(.04, -.04, d); vec3 c = mix(vec3(.18, .32, .1), vec3(.55, .62, .22), vQ.y) + vec3(.3, 1., .8) * smoothstep(-.1, 0., d) * .35; o = vec4(c * a, a * .85); }
       o *= vA * uF; if (o.a < .003) discard; gl_FragColor = o; }`, "pre")), 46);
  const NB = n(260), bubG = pts(NB, { aB: 4 });
  const bubbles = obj(new THREE.Points(bubG, mat(wU,
    `attribute vec4 aB; uniform float uT, uPx, uLevel, uIn; varying float vA;
     void main() { float h = 26., ph = fract(uT * (.05 + .05 * aB.w) + aB.w * 7.); vec3 p = position + vec3(sin(uT * 2. + aB.w * 30.) * .12, ph * h, cos(uT * 1.7 + aB.w * 20.) * .12);
       vA = smoothstep(0., .05, ph) * (1. - smoothstep(.85, 1., ph)) * uIn * smoothstep(uLevel + .3, uLevel - .3, p.y); vec4 mv = viewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aB.z * uPx / -mv.z, 1.5, 30.); }`,
    `uniform float uF; varying float vA; void main() { float r = length(gl_PointCoord - .5) * 2., a = (smoothstep(1., .8, r) * smoothstep(.55, .85, r) + .15 * smoothstep(1., 0., r) + .6 * smoothstep(.2, 0., length(gl_PointCoord - vec2(.35, .35)))) * vA * uF;
       if (a < .004) discard; gl_FragColor = vec4(.75, 1., 1., a); }`)), 47);
  const seaG = new THREE.Group(); seaG.add(caus, critters, bubbles); root.add(seaG);
  const KELP = [[-6.2, 1.2, -.12], [-7.6, 2.9, -.12], [6.4, .65, -.12], [7.4, 2.3, -.12], [-5.4, .95, 1.2], [5.4, .95, 3.6], [-5.4, .95, 6.8], [-9.4, 1.7, 8.84], [11.2, 2.8, 8.84], [-2.9, 4.4, .2], [.9, 4.4, .2], [3.1, 4.4, .2]];  // shelf edges, railings, the tops of our cases
  const FISH = [[[.3, 1, .95], [1, .85, .4]], [[1, .55, .7], [.5, .8, 1]], [[.6, 1, .5], [.3, .8, 1]], [[1, .75, .3], [1, .45, .3]]];
  const underwater = { name: "underwater", dur: [13, 15], group: seaG, need: "any",
    start(p) { wU.uSC.value.set(R(-2, 2), R(3.3, 5.2), MID_Z); wU.uSR.value.set(R(7.5, 10), R(1, 2), R(3, 3.7)); wU.uDirS.value = sgn(); wU.uM.value.set(R(-3, 3), R(6.2, 8.2), R(0, TAU), sgn() * R(.8, 1.2));
      wU.uSP.value = Math.atan2(view.fx, view.fz) - .22 * wU.uDirS.value * .35 * p.dur - .45;  // the school passes through the visitor's view about a third of the way in
      const pal = pick(FISH); wU.uFA.value.setRGB(...pal[0]); wU.uFB.value.setRGB(...pal[1]); const I = critterG.attributes.aI.array, O = critterG.attributes.aO.array;
      for (let i = 0; i < NF; i++) { I.set([0, Math.random(), R(.32, .58), R(0, .9)], i * 4); O.set([R(-1.8, 1.8), R(-1.2, 1.2), R(-1.6, 1.6), 0], i * 4); }
      I.set([1, Math.random(), R(4.2, 5.6), 0], NF * 4); O.set([0, 0, 0, 0], NF * 4); const kelps = KELP.filter(() => Math.random() < .8);
      for (let i = 0; i < NK; i++) { const k = kelps[i]; I.set(k ? [2, Math.random(), 1, 0] : [3, 0, 0, 0], (NF + 1 + i) * 4); O.set(k ? [k[0], k[1], k[2], R(2.4, 4.6)] : [0, -999, 0, 0], (NF + 1 + i) * 4); }
      const B = bubG.attributes.position.array, A = bubG.attributes.aB.array; for (let i = 0; i < NB; i++) { B.set([R(-13, 13), R(-14, 2), R(.4, 8.6)], i * 3); A.set([0, 0, R(.05, .15), Math.random()], i * 4); } dirty(bubG); dirty(critterG);
      p.palette = pal[0]; p.manta = +wU.uM.value.y.toFixed(1); p.kelp = kelps.length; return true; },
    tick(p, u, t) { wU.uT.value = t; const flood = sm(u / .12), lvl = u < .68 ? 1e4 : lerp(19, -5, clamp01((u - .68) / .28)); wU.uA.value = flood; wU.uIn.value = sm((u - .04) / .14); wU.uGrow.value = sm((u - .05) / .2) * (1 - sm((u - .78) / .14)); wU.uLevel.value = lvl;
      useVeil(VEIL.sea, .5 * flood); veilU.uLevel.value = lvl; } };

  // ======== 6. cranes: a book flies out of a shelf in view, turns and opens; its pages lift out one after another, fold in half and become paper cranes (the page and the crane share one
  // instance: the page folds about its diagonal, then the crane opens out of it), which join a flock that spirals up the well into the oculus, each on its own orbit round the flock's path.
  const crG = (() => { const T = [  // [x, y, z] crane local: x forward, y up, z right; the last two triangles are the page (folding about its diagonal)
      [[.1, .04, 0], [.2, -.05, 0], [.45, .34, 0]], [[.45, .34, 0], [.42, .3, 0], [.57, .26, 0]], [[-.1, .04, 0], [-.2, -.05, 0], [-.5, .3, 0]], [[.2, .05, 0], [-.2, .05, 0], [0, -.11, .08]], [[.2, .05, 0], [0, -.11, -.08], [-.2, .05, 0]],
      [[.13, .06, 0], [-.13, .06, 0], [-.04, .12, -.58]], [[-.13, .06, 0], [.13, .06, 0], [-.04, .12, .58]], [[-.25, 0, -.18], [.25, 0, -.18], [.25, 0, .18]], [[-.25, 0, -.18], [.25, 0, .18], [-.25, 0, .18]]];
    const p = [], w = []; T.forEach((t, i) => t.forEach(v => { p.push(...v); w.push(i >= 7 ? (i === 8 ? 3 : 2) : i >= 5 && Math.abs(v[2]) > .3 ? 1 : 0); }));
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3)); g.setAttribute("aW", new THREE.BufferAttribute(new Float32Array(w), 1)); return g; })();
  const NC = n(30), cU = { uT: { value: 0 }, uBk: { value: v3() }, uR: { value: v3() }, uU: { value: v3() }, uN: { value: v3() }, uA0: { value: 0 }, uDir: { value: 1 }, uTint: { value: new THREE.Color() }, uF: FADE };
  const craneG = inst(crG, NC, { aC: 4, aQ: 4 });  // aC: launch time, seed, orbit radius, lag; aQ: page place on the spread (u, v), tint, size
  const cranes = obj(new THREE.Mesh(craneG, mat(cU,
    `attribute float aW; attribute vec4 aC, aQ; uniform float uT, uA0, uDir; uniform vec3 uBk, uR, uU, uN; varying vec3 vW; varying float vTi, vA;
     vec3 flock(float s) { s = max(s, 0.); float a = uA0 + uDir * s * .5, r = 3.4 + 1.1 * sin(s * .3); return vec3(r * cos(a) * 1.3, 4. + s * 1.3 + s * s * .3, ${MID_Z} + r * sin(a) * .8); }
     vec3 pos(float t) { float l = aC.x, s = t - l, lift = smoothstep(0., .9, s), fly = smoothstep(1., 2.8, s), ph = aC.y * 6.2832;
       vec3 page = uBk + uR * (aQ.x - .5) * (.5 + lift * 1.6) + uU * (aQ.y - .5) * (.3 + lift * .8) + uN * (.05 + lift * (.45 + aQ.y * .6)) + uU * lift * (.35 + .5 * aQ.x);  // the pages fan out of the book before they fold
       vec3 f = flock(s - 1. - aC.w) + vec3(sin(t * 1.3 + ph) * aC.z, cos(t * 1.1 + ph * 1.7) * aC.z * .5, cos(t * 1.3 + ph) * aC.z);
       return mix(page, f, fly); }
     void main() { float s = uT - aC.x, fold = smoothstep(.35, 1.5, s), crane = smoothstep(.85, 1.35, s); vec3 c = pos(uT), h = normalize(pos(uT + .06) - c + uN * 1e-4);
       vec3 fx = normalize(mix(uU, h, smoothstep(.8, 2.2, s))), fz0 = mix(uR, normalize(cross(h, vec3(0., 1., 0.))), smoothstep(.8, 2.2, s)), fy = normalize(cross(fz0, fx)), fz = cross(fx, fy);
       vec3 p = position; float w = aW;
       if (w > 1.5) { if (w > 2.5) { vec3 ax = normalize(vec3(.5, 0., .36)); float an = fold * 3.0; p = p * cos(an) + cross(ax, p) * sin(an) + ax * dot(ax, p) * (1. - cos(an)); } p *= 1. - crane; }
       else { p.y += w * sin(uT * 7. + aC.y * 30.) * .3 * smoothstep(1.6, 2.6, s); p *= crane * (1. + .15 * sin(crane * 3.1416)); }
       p *= aQ.w; vW = c + fx * p.x + fy * p.y + fz * p.z; vTi = aQ.z; vA = step(0., s) * smoothstep(0., .3, s) * (1. - smoothstep(55., 75., c.y)); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    `uniform vec3 uTint; uniform float uF; varying vec3 vW; varying float vTi, vA;
     void main() { vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float l = .5 + .55 * abs(dot(n, normalize(vec3(-.3, .9, .5)))) + .2 * pow(1. - abs(dot(n, normalize(cameraPosition - vW))), 2.);
       vec3 c = mix(vec3(.97, .94, .86), uTint, vTi) * l * vec3(1., .94, .84); float a = vA * uF; if (a < .004) discard; gl_FragColor = vec4(c * a, a); }`, "pre", { depthWrite: true })), 46);
  const craneGrp = new THREE.Group(); craneGrp.add(cranes); root.add(craneGrp);
  const craneBook = { name: "cranes", dur: [13, 15], group: craneGrp, need: "shelf",
    start(p) { const s = shelfInView(view.up ? 14 : 11); if (!s) return false; const H = R(.36, .44), T = R(.07, .1), D = .28; bookAt(s, H, T, D); p.spot = [s.x.toFixed(2), s.y.toFixed(2), s.z.toFixed(2)];
      const P = bookPose; cU.uR.value.copy(P.R); cU.uU.value.copy(P.U); cU.uN.value.copy(P.N); cU.uBk.value.copy(P.slot).addScaledVector(P.N, .9).addScaledVector(P.U, .25); cU.uDir.value = sgn();
      cU.uA0.value = Math.atan2((P.slot.z - MID_Z) / .8, P.slot.x / 1.3); cU.uTint.value.setRGB(...pick([[1, .7, .75], [.7, .85, 1], [1, .85, .5], [.75, 1, .8], [.85, .75, 1]]));
      const A = craneG.attributes.aC.array, B = craneG.attributes.aQ.array, d = p.dur, k = Math.round(NC * R(.7, 1)), sz = R(.9, 1.25);
      for (let i = 0; i < NC; i++) { A.set([i < k ? d * (.2 + .3 * i / k) + R(-.1, .1) : 1e4, Math.random(), R(.4, 2.1), R(0, 1.2)], i * 4); B.set([Math.random(), Math.random(), Math.random() < .3 ? R(.25, .5) : 0, sz * R(.85, 1.15)], i * 4); }
      craneG.attributes.aC.needsUpdate = craneG.attributes.aQ.needsUpdate = true; p.count = k; p.size = +sz.toFixed(2); return true; },
    tick(p, u, t) { const P = bookPose; cU.uT.value = t; const out = win(u, 0, .06, .9, .97), fly = win(u, .06, .16, .66, .82), turn = sm((u - .1) / .1) * (1 - sm((u - .74) / .1));
      book.position.copy(P.slot).addScaledVector(P.N, .15 * out + .75 * fly).addScaledVector(P.U, .25 * fly); Q1.setFromAxisAngle(P.U, Math.PI * turn); Q2.setFromAxisAngle(P.R, .12 * out * (1 - fly)); book.quaternion.copy(Q1).multiply(Q2).multiply(P.q);
      bookU.uOpen.value = 1.3 * win(u, .16, .25, .6, .7); bookU.uA.value = Math.min(1, out * 6); bookU.uGlow.value = .6 * win(u, .18, .25, .5, .62); } };

  // ======== 7. lanterns (its concept: many paper sky lanterns, khom fai of the Lao lantern festivals, rising up the well, the highest become stars). 20-40 of them, of many sizes:
  // a few already high in the air in front of the home wall, most out over the open well, some rising from below the balcony. Each is a rounded paper body with ribs, a glowing
  // core and a warm rim, sways gently, flickers, lays a pool of warm light on the nearest wall of books, and high up becomes a star. The room dims to dusk round them.
  const lanG = (() => { const p = [[.3, 0], [.33, .08], [.38, .3], [.41, .55], [.4, .72], [.34, .86], [.22, .96], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)); return new THREE.LatheGeometry(p, 20); })();
  const NL = phone ? 26 : 40, lU = { uT: { value: 0 }, uIn: { value: 0 }, uEye: { value: new THREE.Vector2() }, uPx: PX, uF: FADE };
  const LAN = `uniform float uT; uniform vec2 uEye; vec3 lpos(vec4 L, vec4 M, float t) { float age = max(0., t - L.w), y = L.z + (.6 + .6 * fract(M.x * 5.)) * age + .03 * age * age; y = min(y, 92. + (y - 92.) * .06);
      vec2 xz = vec2(L.x + sin(t * .37 + M.x * 20.) * M.z, L.y + cos(t * .29 + M.x * 13.) * M.z), d = xz - uEye; float l = length(d); if (l < 5.) xz = uEye + d / max(l, .01) * 5.;  // a gentle rise and sway, never within 5 m of the eye
      return vec3(xz.x, y, xz.y); }
    float flick(float s) { return .9 + .06 * sin(uT * 7.3 + s * 40.) * sin(uT * 2.9 + s * 17.) + .04 * sin(uT * 13. + s * 9.); }
    float shrink(float y) { return 1. - smoothstep(50., 68., y); }`;
  const lanIG = inst(lanG, NL, { aL: 4, aM: 4 }), glowIG = inst(new THREE.PlaneGeometry(1, 1), NL * 4, { aL: 4, aM: 4, aK: 1 });  // aL: x0, z0, y0, birth; aM: seed, size, sway, hue
  const lanterns = obj(new THREE.Mesh(lanIG, mat(lU,
    `attribute vec4 aL, aM; uniform float uIn; varying vec2 vUv; varying vec3 vN, vW; varying float vA, vS, vH; ${LAN}
     void main() { vec3 c = lpos(aL, aM, uT); vUv = uv; vS = aM.x; vH = aM.w; float age = uT - aL.w; vA = step(0., age) * smoothstep(0., 1., age) * uIn;  // vA: how lit; it appears small and swells as it lights (no see-through fade: they write depth)
       float tl = sin(uT * .5 + aM.x * 9.) * .06; mat2 r = rot(tl); vec3 p = position * aM.y * shrink(c.y) * step(0., age) * mix(.15, 1., smoothstep(0., 1.4, age)) * mix(.25, 1., uIn), nn = normal; p.xy = r * p.xy; nn.xy = r * nn.xy; vN = nn; vW = c + p; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    `uniform float uF; varying vec2 vUv; varying vec3 vN, vW; varying float vA, vS, vH; ${LAN}
     void main() { vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float f = flick(vS), y = vUv.y, rim = pow(1. - abs(dot(n, v)), 2.), core = exp(-pow((y - .28) / .32, 2.));
       float rib = 1. - .35 * smoothstep(.9, 1., abs(sin(vUv.x * 37.7))) - .2 * smoothstep(.96, 1., abs(sin(y * 15.7)));  // 12 ribs and two seams of the paper
       vec3 paper = vH < .5 ? vec3(1., .52, .18) : vH < .8 ? vec3(1., .6, .22) : vec3(1., .44, .26), hot = vec3(1., .86, .55);
       vec3 c = gl_FrontFacing ? (paper * (.42 + .55 * rim + .25 * (1. - y)) + hot * core * .55) * rib * f : hot * (1.3 + .5 * core) * f;  // a warm rim, the core glowing through; inside, the flame's light
       c *= .15 + .85 * vA; float a = uF; gl_FragColor = vec4(c * a, a); }`, "pre", { depthWrite: true })), 46);
  const lglow = obj(new THREE.Mesh(glowIG, mat(lU,
    `attribute vec4 aL, aM; attribute float aK; uniform float uIn, uPx; varying vec2 vQ; varying float vA, vK; ${LAN}
     void main() { vec3 c = lpos(aL, aM, uT); float on = step(aL.w, uT) * smoothstep(0., 1.2, uT - aL.w) * uIn, sh = shrink(c.y), f = flick(aM.x); vQ = position.xy; vK = aK; vec3 p;
       if (aK < .5) { p = c + vec3(0., .45 * aM.y * sh, 0.) + normalize(cameraPosition - c) * .5 * aM.y + (camR() * position.x + camU() * position.y) * 2.1 * aM.y * f * sh; vA = on * sh * .22 * f; }  // a soft halo
       else if (aK < 1.5) { const float HZ = ${fl(Wl.home.z)}, DZ = ${fl(Wl.door.z)}, WR = ${fl(Wl.well.r)}; vec2 rc = c.xz - vec2(${fl(WC[0])}, ${fl(WC[1])});  // the pool on the nearest wall: home, entrance or the well
         float rl = length(rc), dh = abs(c.x) < ${fl(Wl.home.x[1])} && c.z > HZ ? c.z - HZ : 1e3, dd = abs(c.x) < ${fl(Wl.door.x[1])} && c.y < 60. && c.z < DZ ? DZ - c.z : 1e3, dw = WR - rl;
         vec3 W, n; float d; if (dh < dd && dh < dw) { d = dh; n = vec3(0., 0., 1.); W = vec3(c.x, c.y, HZ + .04); } else if (dd < dw) { d = dd; n = vec3(0., 0., -1.); W = vec3(c.x, c.y, DZ - .05); } else { d = dw; n = vec3(-rc.x / rl, 0., -rc.y / rl); W = vec3(${fl(WC[0])} + rc.x / rl * (WR - .1), c.y, ${fl(WC[1])} + rc.y / rl * (WR - .1)); }
         vec3 a2 = normalize(cross(vec3(0., 1., 0.), n)); float s = 1.8 + d * .6; p = W + (a2 * position.x + vec3(0., 1., 0.) * position.y) * s; vA = on * sh * f * .5 / (1. + d * d * .06); }
       else if (aK < 2.5) { p = c + (camR() * position.x + camU() * position.y) * (1.4 + .4 * sin(uT * 3. + aM.x * 30.)); vA = on * smoothstep(50., 68., c.y) * (.7 + .3 * sin(uT * 4. + aM.x * 50.)); }  // high up: a star
       else { p = c + vec3(0., .12 * aM.y, 0.) + (camR() * position.x + camU() * position.y) * .32 * aM.y * f; vA = on * sh * .9 * f; }  // the flame at its foot
       gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    `uniform float uF; varying vec2 vQ; varying float vA, vK;
     void main() { float r = length(vQ) * 2., a = vK > 1.5 && vK < 2.5 ? exp(-r * r * 30.) + .5 * exp(-abs(vQ.x) * 60.) * exp(-abs(vQ.y) * 8.) + .5 * exp(-abs(vQ.y) * 60.) * exp(-abs(vQ.x) * 8.) : exp(-r * r * (vK > 2.5 ? 9. : vK > .5 ? 3.5 : 6.));
       a *= vA * uF; if (a < .003) discard; gl_FragColor = vec4(vK > 1.5 && vK < 2.5 ? vec3(1., .9, .7) : vK > 2.5 ? vec3(1., .85, .55) : vec3(1., .55, .22), a); }`)), 47);
  const lanGrp = new THREE.Group(); lanGrp.add(lanterns, lglow); root.add(lanGrp);
  const lanternsW = { name: "lanterns", dur: [13.5, 15], group: lanGrp, need: "any",
    start(p) { const d = p.dur, A = lanIG.attributes.aL.array, M = lanIG.attributes.aM.array, k = Math.round(NL * R(.72, 1)), hue = R(0, 1); lU.uEye.value.set(C.x, C.z);
      for (let i = 0; i < NL; i++) { if (i >= k) { A.set([0, 0, -999, 1e4], i * 4); continue; } const r = Math.random(), s = sgn();
        let x, z, y0, b;
        if (r < .6) { const yaw = Math.atan2(view.fz, view.fx) + R(-.5, .5) * camera.fov * Math.PI / 180 * camera.aspect, pt = Math.max(.45, Math.min(1.35, view.pitch + R(-.2, .4))), dx = Math.cos(pt) * Math.cos(yaw), dy = Math.sin(pt), dz = Math.cos(pt) * Math.sin(yaw);  // in the view: along a ray inside it, short of the wall
          const t = Math.max(6, Math.min(40, free(dx, dy, dz) * R(.45, .9))); x = C.x + dx * t; z = C.z + dz * t; y0 = Math.max(-6, C.y + dy * t - R(0, 2.5)); b = d * R(0, .5); }  // above our cases, rising
        else if (r < .88) { const a = s > 0 ? R(-1.1, 1.1) : Math.PI + R(-1.1, 1.1), rr = R(11, 22); x = WC[0] + Math.cos(a) * rr; z = WC[1] + Math.sin(a) * rr; if (Math.abs(x) < Wl.home.x[1] + .6) x = s * (Wl.home.x[1] + R(.6, 4)); y0 = R(-12, 46); b = d * R(0, .5); }  // out over the open well
        else { x = s * R(6.2, 9.5); z = R(.6, 8.4); y0 = R(-12, -3); b = d * R(0, .45); }  // just past the railings, up from below
        A.set([x, z, y0, b], i * 4); M.set([Math.random(), R(.5, 1.1), R(.12, .3), (hue + R(-.2, .2) + 1) % 1], i * 4); }
      for (const k2 of ["aL", "aM"]) { const src = lanIG.attributes[k2].array, dst = glowIG.attributes[k2].array; for (let j = 0; j < 4; j++) dst.set(src, j * NL * 4); }
      const K = glowIG.attributes.aK.array; for (let i = 0; i < NL * 4; i++) K[i] = Math.floor(i / NL); dirty(lanIG); dirty(glowIG); p.count = k; p.hue = +hue.toFixed(2); return true; },
    tick(p, u, t) { lU.uT.value = t; lU.uIn.value = 1 - sm((u - .9) / .1); useVeil(VEIL.dusk, .45 * win(u, 0, .12, .85, 1)); } };

  // ---- the director
  const W = Object.fromEntries([bloom, battle, constellation, airship, underwater, craneBook, lanternsW].map(w => [w.name, w]));
  let here = "home", cur = null, last = null, bag = [], since = 0, gap = R(10, 22), patience = R(14, 26), retry = 0, upT = 0, clock = 0;
  const drawGap = () => 12 + 28 * (Math.random() + Math.random()) / 2;  // triangular over 12-40 s: never a timer
  const refill = () => { bag = NAMES.slice().sort(() => Math.random() - .5); if (bag[0] === last) bag.push(bag.shift()); };
  function look() { const e = camera.matrixWorld.elements; C.set(e[12], e[13], e[14]); F.set(-e[8], -e[9], -e[10]); view.pitch = Math.asin(Math.max(-1, Math.min(1, F.y)));
    const h = Math.hypot(F.x, F.z) || 1; view.fx = F.x / h; view.fz = F.z / h; view.up = view.pitch > .55; }
  function begin(name, why) { const w = W[name], p = { name, why, dur: R(...w.dur), t: 0 };
    for (const o of Object.values(W)) o.group.visible = false; veil.visible = false; book.visible = false; FADE.value = 1;
    if (!w.start(p)) return false; w.group.visible = true; root.visible = true; cur = { w, p, fading: 0 };
    api.log.push({ t: +clock.toFixed(1), name, why, pitch: Math.round(view.pitch * 180 / Math.PI), dur: +p.dur.toFixed(1), gap: +since.toFixed(1), ...Object.fromEntries(Object.entries(p).filter(([k]) => !["name", "why", "dur", "t", "fireAt", "hitAt"].includes(k))) });
    last = name; const i = bag.indexOf(name); if (i >= 0) bag.splice(i, 1); return true; }
  function end() { if (cur) cur.w.group.visible = false; cur = null; root.visible = false; veil.visible = false; book.visible = false; since = 0; gap = drawGap(); patience = R(14, 26); retry = 0; }
  function choose(forced) {  // the bag in its random order, the first that fits the eye now; past its patience, any (a sky one then shows at the top of the view)
    if (!bag.length) refill(); let cand = bag.filter(nm => nm !== last); if (!cand.length) { refill(); cand = bag.filter(nm => nm !== last); }
    const pref = view.up ? cand.filter(nm => UPWARD.has(nm)) : cand.filter(nm => !SKY.has(nm)), why = forced ? "patience" : view.up ? "look-up" : "timer";
    for (const nm of pref) if (begin(nm, why)) return true;
    if (forced) for (const nm of cand) if (!pref.includes(nm) && begin(nm, why)) return true;
    return false; }
  function update(dt) {
    if (document.hidden) return; dt = Math.min(dt, .1); clock += dt; PX.value = camera.projectionMatrix.elements[5] * (renderer?.domElement.height ?? innerHeight) / 2;
    look(); const b = busy() || here !== "home";
    if (cur) { const { w, p } = cur; if (b) cur.fading = Math.max(cur.fading, 1e-3); if (cur.fading) { cur.fading += dt / .6; FADE.value = Math.max(0, 1 - cur.fading); }
      p.t += dt; const u = p.t / p.dur; if (u >= 1 || FADE.value <= 0) { end(); return; } veil.position.copy(C); w.tick(p, u, p.t); return; }
    if (!api.auto || b) { upT = 0; return; } since += dt; upT = view.up ? upT + dt : 0;
    const lookNow = upT > 1 && since > 12 && Math.random() < dt * .4;  // looking up makes a wonder likelier: a few seconds of looking up, after the shortest gap, brings one
    if ((since >= gap && since >= retry) || lookNow) { if (!choose(since > gap + patience)) retry = since + R(2, 4); }  // nothing fits now: look again in a few seconds
  }
  function fire(name) { if (!W[name]) return null; look(); if (cur) end(); since = 0; return begin(name, "fire") ? cur.p : null; }
  function setStation(id) { here = id; }
  function stats() { let draws = 0; const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; }; root.traverse(o => { if ((o.isMesh || o.isPoints) && vis(o)) draws++; });
    return { playing: cur?.p.name ?? null, u: cur ? +(cur.p.t / cur.p.dur).toFixed(3) : 0, t: cur ? +cur.p.t.toFixed(2) : 0, dur: cur ? +cur.p.dur.toFixed(2) : 0, draws, nextIn: cur ? null : +(gap - since).toFixed(1), bag: bag.slice(), last, clock: +clock.toFixed(1), log: api.log }; }
  function dispose() { end(); scene.remove(root); root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); holo.dispose(); bookTex.dispose(); }
  if (renderer?.compileAsync) renderer.compileAsync(root, camera, scene).catch(e => console.warn("wonders: compile", e));  // every program now, behind the room's own loading, not on a first play
  return api;
}
