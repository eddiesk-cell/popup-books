// wonders.js: the quiet magic (Eddie 2026-11-17: "Ok, those 4 things, the quiet magic, i like them. Please have only 4 of these, subtle, quiet, mythical"; the seven big wonders before them
// "don't look as good as i thought", he kept only the cranes and the lanterns, toned down). Always-there magic in the Grand Library's tower, the Abyssal Garden way: everything moves in the
// shaders from a few numbers per instance and one time value, nothing is allocated per frame, and it stays small, soft, slow and low in contrast: the books and the light are the stars.
//   books     5-7 old books (phone 3) drift slowly round the open middle of the tower at many heights, turning gently, a page or two softly fluttering. Always there at home. One draw.
//   letters   now and then (random gaps, never a rhythm) a gold dust mote inside a light beam blooms into a small glowing letter, Lao or Latin, drifts up and fades. One or two at a time. One draw.
//   cranes    rare (45-120 s apart): loose pages appear high in the tower and fold into 4-7 paper cranes that circle slowly and rise into the oculus. One draw.
//   lanterns  rare (60-150 s apart), never with the cranes: 3-6 paper sky lanterns rise slowly up the tower, each laying a soft warm pool on the books beside it. Two draws.
//   const w = createWonders(scene, camera, { renderer, plan, reduced, phone, busy, beams, chime });   chime(name): a show begins (library.js plays the soft shimmer, nothing for books or letters)   each frame w.update(dt); on arriving at a station w.setStation(id)
//   beams(): the light beams of the station ({B, r, L} and the shared axis, library.js placeAir), where the letters are born.  w.fire(name) plays one now; w.auto = false stops the director
//   (the books stay); w.log: what played, when and why; w.stats().   shelf: books.js's shelf books, for the fifth, smallest moment: two show books trade places (see `swap` below)
// Only at home; never while busy() (a book open, a portal trip, the intro): all of it fades out in 0.6 s and the books come back after. Reduced motion: the books stand still in the air, nothing else.
import * as THREE from "three";
import { fontsReady, HEAD } from "./titles.js";

export const NAMES = ["books", "letters", "cranes", "lanterns", "swap"];
const TAU = Math.PI * 2, clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x, sm = x => (x = clamp01(x)) * x * (3 - 2 * x);
const R = (a = 0, b = 1) => a + Math.random() * (b - a), tri = (a, b) => a + (b - a) * (Math.random() + Math.random()) / 2, pick = a => a[Math.random() * a.length | 0], sgn = () => Math.random() < .5 ? -1 : 1;
const fl = x => (+x).toFixed(3);  // a number as a GLSL float
const G = `
vec3 camR() { return vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); }
vec3 camU() { return vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
mat3 ry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
`;
const BLEND = { add: { blending: THREE.AdditiveBlending },
  pre: { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } };  // premultiplied: alpha 0 adds light, alpha 1 covers
const mat = (uniforms, vs, fs, blend = "add", o = {}) => new THREE.ShaderMaterial({ uniforms, vertexShader: G + vs, fragmentShader: G + fs, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...BLEND[blend], ...o });
const obj = (o, order = 46) => { o.frustumCulled = false; o.renderOrder = order; return o; };  // under the library's light (50): a beam in front of them lies over them
const inst = (base, n, attrs) => { const g = new THREE.InstancedBufferGeometry(); g.index = base.index; for (const k in base.attributes) g.setAttribute(k, base.attributes[k]); g.instanceCount = n;
  for (const [k, w] of Object.entries(attrs)) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(n * w), w)); return g; };
const set = (g, k, i, ...v) => { g.attributes[k].array.set(v, i * v.length); g.attributes[k].needsUpdate = true; };

export function createWonders(scene, camera, { renderer = null, plan, reduced = false, phone = false, busy = () => false, beams = () => ({ list: [], axis: new THREE.Vector3(0, 1, 0) }), chime = () => {}, shelf = null } = {}) {
  const WC = plan.c, RI = plan.ri, RW = plan.r, TOP = plan.T.top;  // the tower's axis (x, z), the walkways' inner edge (nothing flies past it), the wall, the open top
  const api = { names: NAMES, auto: true, log: [], fire, update, setStation, stats, dispose, group: null };
  const root = new THREE.Group(); root.name = "wonders"; scene.add(root); api.group = root;
  const FADE = { value: 1 }, C = new THREE.Vector3(), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), U = { uT: { value: 0 }, uF: FADE };  // FADE: the busy fade shared by every material; uT: the director's clock (books, letters), never a show's
  let here = "home";

  // ======== books: the first page's leather book (styles/epic/hero-book.glb: dark leather, gold tooling and a star medallion on the front board, gilt page edges, a rounded spine with
  // gilt raised bands, a red ribbon), open, built here in code at a few hundred triangles instead of shipping its 1.2 MB (Eddie 2026-11-17: "the floating books, they look just like boxes, why not
  // use the one on our first page"). Each on its own slow orbit round the axis: radius, phase, height, speed (aB); seed, size, how open, how much its leaves flutter (aS); its leather (aC).
  // It faces along its orbit, tips and turns slowly; lit from the oculus, its gold catching the light. Parts (aPart): 0 left half, 1 right half (board + page block), 2, 3 two loose leaves,
  // 4 the spine and its bands, 5 the ribbon. Materials (aMat): 0 leather, 1 paper, 2 gilt edges, 3 gilt bands, 4 ribbon. The tooling is drawn in the shader on the boards' outer faces.
  const bookG = (() => { const W = .16, H = .22, TB = .006, T = .022, SQ = .006, P = [], Nn = [], A = [], Mt = [];
    const put = (p, n, part, m) => { P.push(...p); Nn.push(...n); A.push(part); Mt.push(m); }, quad = (a, b, c, d, n, part, m) => { for (const v of [a, b, c, a, c, d]) put(v, n, part, m); };
    const top = u => T * (.42 + .58 * sm(u / .3) - .1 * u);  // the page block's top: dipping into the gutter, full by a third of the way out
    for (const [s, part] of [[-1, 0], [1, 1]]) {
      const x1 = s * (W + SQ), y1 = H / 2 + SQ, f = (n) => s < 0 ? [-n[0], n[1], n[2]] : n, Q = (a, b, c, d, n, m) => s > 0 ? quad(a, b, c, d, n, part, m) : quad(a, d, c, b, f(n), part, m);
      Q([0, -y1, -TB], [x1, -y1, -TB], [x1, y1, -TB], [0, y1, -TB], [0, 0, -1], 0);  // the board: its outer face (tooled), inner face, edges
      Q([0, y1, 0], [x1, y1, 0], [x1, -y1, 0], [0, -y1, 0], [0, 0, 1], 0);
      Q([x1, -y1, -TB], [x1, -y1, 0], [x1, y1, 0], [x1, y1, -TB], [1, 0, 0], 0); Q([0, y1, -TB], [x1, y1, -TB], [x1, y1, 0], [0, y1, 0], [0, 1, 0], 0); Q([x1, -y1, -TB], [0, -y1, -TB], [0, -y1, 0], [x1, -y1, 0], [0, -1, 0], 0);
      const K = 10, X = k => s * W * k / K, Z = k => top(k / K);
      for (let k = 0; k < K; k++) { const z0 = Z(k), z1 = Z(k + 1), sl = (z1 - z0) / (W / K), n = [-sl, 0, 1].map(v => v / Math.hypot(sl, 1));  // (Q mirrors x for the left half)
        Q([X(k), -H / 2, z0], [X(k + 1), -H / 2, z1], [X(k + 1), H / 2, z1], [X(k), H / 2, z0], n, 1);  // pages
        Q([X(k), H / 2, z0], [X(k + 1), H / 2, z1], [X(k + 1), H / 2, 0], [X(k), H / 2, 0], [0, 1, 0], 2); Q([X(k + 1), -H / 2, z1], [X(k), -H / 2, z0], [X(k), -H / 2, 0], [X(k + 1), -H / 2, 0], [0, -1, 0], 2); }  // gilt head and tail
      Q([X(K), -H / 2, 0], [X(K), -H / 2, Z(K)], [X(K), H / 2, Z(K)], [X(K), H / 2, 0], [1, 0, 0], 2); }  // gilt fore-edge
    for (const part of [2, 3]) for (let k = 0; k < 8; k++) { const x0 = W * .96 * k / 8, x1 = W * .96 * (k + 1) / 8, z0 = top(x0 / W) + .002, z1 = top(x1 / W) + .002;  // a loose leaf: z is only its height over the pages; the shader lays it flat, turns it, then lifts it to the page side
      quad([x0, -H * .47, z0], [x1, -H * .47, z1], [x1, H * .47, z1], [x0, H * .47, z0], [0, 0, 1], part, 1); }
    const r = .018, cyl = (rad, y0, y1, m) => { for (let k = 0; k < 8; k++) { const t0 = Math.PI + Math.PI * k / 8, t1 = Math.PI + Math.PI * (k + 1) / 8, tm = (t0 + t1) / 2, p = t => [rad * Math.cos(t), 0, -TB + rad * Math.sin(t)];
      const a = p(t0), b = p(t1); quad([a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]], [Math.cos(tm), 0, Math.sin(tm)], 4, m); } };
    cyl(r, -H / 2 - SQ, H / 2 + SQ, 0); for (const yb of [-.065, -.022, .022, .065]) cyl(r + .0035, yb - .006, yb + .006, 3);  // the spine, rounded, and its gilt bands
    quad([-.006, -H / 2 + .01, top(0) + .001], [.006, -H / 2 + .01, top(0) + .001], [.006, -H / 2 - .08, top(0) + .001], [-.006, -H / 2 - .08, top(0) + .001], [0, 0, 1], 5, 4);  // the ribbon
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute("aPart", new THREE.Float32BufferAttribute(A, 1)); g.setAttribute("aMat", new THREE.Float32BufferAttribute(Mt, 1)); return g; })();
  const NB = phone ? 3 : R(5, 7.99) | 0, bkG = inst(bookG, NB, { aB: 4, aS: 4, aC: 3 }), LEATHER = [[.1, .1, .27], [.16, .05, .06], [.05, .1, .08], [.12, .07, .04], [.08, .06, .13]];  // the hero's dark navy first
  for (let i = 0; i < NB; i++) { const lane = i / NB; set(bkG, "aB", i, 2.3 + Math.random() * (RI - 3.7), lane * TAU + R(-.3, .3), 3 + lane ** 1.5 * (TOP - 14) + R(-1, 1), sgn() * R(.02, .045));  // more of them low, where the eye is
    set(bkG, "aS", i, Math.random(), R(1.7, 2.2), R(.83, .95), Math.random() < .6 ? R(.5, 1) : 0); set(bkG, "aC", i, ...(i ? pick(LEATHER) : LEATHER[0])); }  // aS.z: open 150-170 degrees, nearly flat like the hero
  const books = obj(new THREE.Mesh(bkG, mat({ ...U, uC: { value: new THREE.Vector2(...WC) } },
    `attribute float aPart, aMat; attribute vec4 aB, aS; attribute vec3 aC; uniform float uT; uniform vec2 uC; varying vec3 vN, vW, vCol, vNl; varying vec2 vP; varying float vM, vSide;
     void main() { float t = uT, ang = aB.y + aB.w * t, a0 = 1.5708 * (1. - aS.z), fl = aS.w * (.5 + .5 * sin(t * (.9 + aS.x * .6) + aS.x * 20.)), a = 0.; vec3 p = position, up = vec3(0.);
       if (aPart < .5) a = a0; else if (aPart < 1.5) a = -a0; else if (aPart < 3.5) { a = mix(-a0, a0 - 3.1416, aPart < 2.5 ? .2 + .5 * fl : .62 + .3 * fl); float u = p.x / .155, lift = p.z + .05 * u * u * (aPart < 2.5 ? fl : 1. - fl) + .012 * sin(u * 3.1416);
         p.z = 0.; up = vec3(sin(a), 0., cos(a)) * cos(a) / cos(a0) * lift; }  // the leaves lift, curl and settle, always on the page side: the lift turns with the leaf and is 0 when it stands upright
       else if (aPart > 4.5) { p.x += sin(t * 1.3 + aS.x * 9.) * .01 * (-.11 - p.y); }  // the ribbon sways
       vP = position.xy; vNl = normal; vM = aMat; vCol = aC; vSide = aPart < .5 ? -1. : aPart < 1.5 ? 1. : 0.;  // tooling: back board, front board, none
       mat3 B = ry(ang + 1.5708 + .5 * sin(t * .07 + aS.x * 9.)) * rx(-.5 + .3 * sin(t * .11 + aS.x * 4.)), Rr = ry(a);  // along its orbit, tipped back to show its pages, turning slowly
       vec3 c = vec3(uC.x + aB.x * cos(ang), aB.z + .4 * sin(t * .19 + aS.x * 6.), uC.y + aB.x * sin(ang)); vW = c + B * ((Rr * p + up) * aS.y); vN = B * (Rr * normal); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    `uniform float uF; varying vec3 vN, vW, vCol, vNl; varying vec2 vP; varying float vM, vSide;
     float ln(float d, float w) { return 1. - smoothstep(w, w + fwidth(d) * 1.5, abs(d)); }
     float fine(float x) { return clamp(1.5 - fwidth(x) * .5, 0., 1.); }  // fades a fine pattern once it is finer than a pixel, so a moving book never sparkles
     void main() { vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.), v = normalize(cameraPosition - vW), L = normalize(vec3(-.25, 1., .35)); float dif = .38 + .62 * max(dot(n, L), 0.), sp = pow(max(dot(reflect(-L, n), v), 0.), 18.);
       vec3 gold = vec3(.86, .63, .26), c;
       if (vM < .5) {  // leather; the outer faces of the boards carry the tooling: a double frame, and on the front board a medallion with an eight-point star and a lower panel
         float g = 0.; if (vNl.z < -.5 && abs(vSide) > .5) { vec2 q = vec2(abs(vP.x) / .166, vP.y / .232 + .5); float fr = min(min(q.x, 1. - q.x), min(q.y, 1. - q.y)); g = max(ln(fr - .07, .006), ln(fr - .1, .003));
           if (vSide > .5) { vec2 m = (q - vec2(.5, .6)) * vec2(.166, .232) / .045; float rr = length(m), an = atan(m.y, m.x), st = .55 + .45 * pow(abs(cos(an * 4.)), 6.); g = max(g, max(ln(rr - 1.25, .05), step(rr, st * .95)));
             vec2 lp = abs(q - vec2(.5, .27)) - vec2(.28, .07); g = max(g, ln(max(lp.x, lp.y), .006)); } }
         c = mix(vCol * dif * (1. + .3 * (fract(sin(dot(floor(vP * 900.), vec2(12.9, 78.2))) * 43758.5) - .5) * fine(vP.x * 900.)) + vec3(.06, .05, .05) * sp, gold * (dif + 1.4 * sp), g); }
       else if (vM < 1.5) c = vec3(.98, .9, .72) * (.5 + .5 * dif) * (.96 + .04 * sin(vP.y * 900.) * fine(vP.y * 900.));  // paper: warm cream
       else if (vM < 3.5) c = gold * (dif * (vM < 2.5 ? .9 + .1 * sin(vP.x * 2400.) * fine(vP.x * 2400.) : 1.) + 1.3 * sp);  // gilt edges (fine page lines), gilt bands
       else c = vec3(.5, .07, .08) * dif;  // the ribbon
       float a = uF; gl_FragColor = vec4(c * a, a); }`, "pre", { depthWrite: true })), 46);
  root.add(books);
  if (reduced) { FADE.value = 1; return { ...api, auto: false, fire: () => null, update() { books.visible = here === "home"; }, setStation(id) { here = id; }, stats: () => ({ playing: null, books: NB, draws: 1, log: [] }), dispose() {} };  // reduced motion: the books stand still, nothing else
  }

  // ======== letters: a quad per letter, born at a dust mote inside a beam: first the mote's spark, which blooms into the letter (Lao or Latin, gold, a soft halo), drifts up and fades.
  // aP: where it is born; aL: birth time, life, glyph cell, seed. The glyphs are one small canvas (4 x 4 cells), drawn again when the fonts are in.
  const GL = ["ກ", "ຂ", "ຄ", "ງ", "ຈ", "ສ", "ນ", "ບ", "A", "B", "D", "E", "M", "R", "S", "W"], cv = document.createElement("canvas"); cv.width = cv.height = 512;
  const glyphs = new THREE.CanvasTexture(cv), drawGlyphs = () => { const x = cv.getContext("2d"); x.clearRect(0, 0, 512, 512); x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
    GL.forEach((ch, i) => { x.font = `${i < 8 ? 74 : 92}px ${HEAD}`; x.fillText(ch, (i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 68); }); glyphs.needsUpdate = true; };  // Lao only in Noto Sans Lao (HEAD's second face)
  drawGlyphs(); fontsReady.then(drawGlyphs);
  const NLT = phone ? 1 : 2, ltG = inst(new THREE.PlaneGeometry(1, 1), NLT + 1, { aP: 3, aL: 4 });
  for (let i = 0; i <= NLT; i++) set(ltG, "aL", i, -99, 1, 0, 0);
  const letters = obj(new THREE.Mesh(ltG, mat({ ...U, uMap: { value: glyphs } },
    `attribute vec3 aP; attribute vec4 aL; uniform float uT; varying vec2 vUv, vQ; varying float vA, vB;
     void main() { float age = uT - aL.x, u = age / aL.y; vA = step(0., u) * step(u, 1.) * smoothstep(0., .2, u) * (1. - smoothstep(.6, 1., u)); vB = smoothstep(.04, .22, u);  // vB: the mote has become a letter
       vec3 c = aP + vec3(sin(age * .6 + aL.w * 9.) * .1, age * .2, cos(age * .5 + aL.w * 7.) * .1); float s = mix(.07, .3 + .08 * aL.w, vB);
       vQ = position.xy; vUv = (vec2(mod(aL.z, 4.), 3. - floor(aL.z / 4.)) + position.xy + .5) / 4.; gl_Position = projectionMatrix * viewMatrix * vec4(c + (camR() * position.x + camU() * position.y) * s, 1.); }`,
    `uniform sampler2D uMap; uniform float uF; varying vec2 vUv, vQ; varying float vA, vB;
     void main() { float r = length(vQ) * 2., g = texture2D(uMap, vUv).a, a = (mix(exp(-r * r * 9.), g * .85 + exp(-r * r * 4.) * .14, vB)) * vA * uF; if (a < .003) discard; gl_FragColor = vec4(vec3(1., .82, .46) * a, a); }`)), 51);  // just over the beam it was born in
  letters.visible = false; root.add(letters);
  let ltNext = tri(5, 20), ltI = 0;
  function letter(t, why) {  // a mote in a beam, in view, not too near, not too far: born there now
    const { list, axis } = beams(); if (!list?.length) return false;
    for (let k = 0; k < 16; k++) { const b = pick(list), h = R(2, Math.min(24, b.L * .5)), a = R(0, TAU), q = R(0, b.r * .5);
      V1.copy(b.B).addScaledVector(axis, h); V1.x += Math.cos(a) * q; V1.z += Math.sin(a) * q; const d = V1.distanceTo(C); if (d < 2.5 || d > 18) continue; const p = V2.copy(V1).project(camera);
      if (p.z > 1 || Math.abs(p.x) > .75 || Math.abs(p.y) > .75) continue;
      const i = ltI = (ltI + 1) % (NLT + 1), life = R(5, 7.5); set(ltG, "aP", i, V1.x, V1.y, V1.z); set(ltG, "aL", i, t, life, Math.random() * GL.length | 0, Math.random()); letters.visible = true; lastLetter = t + life;
      api.log.push({ t: +clock.toFixed(1), name: "letters", why, glyph: GL[ltG.attributes.aL.array[i * 4 + 2]], at: [V1.x, V1.y, V1.z].map(v => +v.toFixed(1)), life: +life.toFixed(1) }); return true; }
    return false; }
  let lastLetter = -1;

  // ======== cranes: loose pages appear high in the tower, fan out a little and fold into paper cranes (the page and the crane share one instance: the page folds about its diagonal, then
  // the crane opens out of it); a small flock that circles the open middle slowly, each on its own orbit round the flock's path, and rises into the oculus.
  const crG = (() => { const T = [  // [x, y, z] crane local: x forward, y up, z right; the last two triangles are the page (folding about its diagonal)
      [[.1, .04, 0], [.2, -.05, 0], [.45, .34, 0]], [[.45, .34, 0], [.42, .3, 0], [.57, .26, 0]], [[-.1, .04, 0], [-.2, -.05, 0], [-.5, .3, 0]], [[.2, .05, 0], [-.2, .05, 0], [0, -.11, .08]], [[.2, .05, 0], [0, -.11, -.08], [-.2, .05, 0]],
      [[.13, .06, 0], [-.13, .06, 0], [-.04, .12, -.58]], [[-.13, .06, 0], [.13, .06, 0], [-.04, .12, .58]], [[-.25, 0, -.18], [.25, 0, -.18], [.25, 0, .18]], [[-.25, 0, -.18], [.25, 0, .18], [-.25, 0, .18]]];
    const p = [], w = []; T.forEach((t, i) => t.forEach(v => { p.push(...v); w.push(i >= 7 ? (i === 8 ? 3 : 2) : i >= 5 && Math.abs(v[2]) > .3 ? 1 : 0); }));
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3)); g.setAttribute("aW", new THREE.BufferAttribute(new Float32Array(w), 1)); return g; })();
  const NC = phone ? 5 : 7, cU = { ...U, uT: { value: 0 }, uBk: { value: new THREE.Vector3() }, uA0: { value: 0 }, uDir: { value: 1 }, uY0: { value: 12 }, uTint: { value: new THREE.Color() } };
  const craneG = inst(crG, NC, { aC: 4, aQ: 4 });  // aC: when it appears, seed, its own orbit's radius, lag; aQ: its page's place in the fan (u, v), tint, size
  const cranes = obj(new THREE.Mesh(craneG, mat(cU,
    `attribute float aW; attribute vec4 aC, aQ; uniform float uT, uA0, uDir, uY0; uniform vec3 uBk; varying vec3 vW; varying float vTi, vA;
     vec3 flock(float s) { s = max(s, 0.); float a = uA0 + uDir * s * .2, r = ${fl(RI - 2.3)} + .4 * sin(s * .3); return vec3(${fl(WC[0])} + r * cos(a), uY0 + s * .5 + s * s * .012, ${fl(WC[1])} + r * sin(a)); }
     vec3 pos(float t) { float s = t - aC.x, lift = smoothstep(0., 1.4, s), fly = smoothstep(1.4, 3.6, s), ph = aC.y * 6.2832, a = uA0 + (aQ.x - .5) * .5;
       vec3 page = uBk + vec3(cos(a), 0., sin(a)) * (aQ.x - .5) * .3 * lift + vec3(0., (aQ.y - .5) * .5 + lift * .3, 0.);  // the leaves drift apart before they fold
       vec3 f = flock(s - 1.4 - aC.w) + vec3(sin(t * .9 + ph) * aC.z, cos(t * .7 + ph * 1.7) * aC.z * .4, cos(t * .9 + ph) * aC.z);
       return mix(page, f, fly); }
     void main() { float s = uT - aC.x, fold = smoothstep(.5, 1.9, s), crane = smoothstep(1.1, 1.8, s); vec3 c = pos(uT), h = normalize(pos(uT + .08) - c + vec3(1e-4, 0., 0.));
       vec3 fx = normalize(mix(vec3(0., 1., 0.), h, smoothstep(1.2, 2.8, s))), fz0 = normalize(cross(h + vec3(0., 1e-3, 0.), vec3(0., 1., 0.)) + vec3(1e-4)), fy = normalize(cross(fz0, fx)), fz = cross(fx, fy);
       vec3 p = position; float w = aW;
       if (w > 1.5) { if (w > 2.5) { vec3 ax = normalize(vec3(.5, 0., .36)); float an = fold * 3.0; p = p * cos(an) + cross(ax, p) * sin(an) + ax * dot(ax, p) * (1. - cos(an)); } p *= 1. - crane; }
       else { p.y += w * sin(uT * 4.5 + aC.y * 30.) * .28 * smoothstep(1.8, 3., s); p *= crane; }  // a slow wing beat
       p *= aQ.w; vW = c + fx * p.x + fy * p.y + fz * p.z; vTi = aQ.z; vA = step(0., s) * smoothstep(0., .8, s) * (1. - smoothstep(${fl(TOP - 6)}, ${fl(TOP + 6)}, c.y)); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    `uniform vec3 uTint; uniform float uF; varying vec3 vW; varying float vTi, vA;
     void main() { vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); float l = .45 + .45 * abs(dot(n, normalize(vec3(-.3, .9, .5)))) + .15 * pow(1. - abs(dot(n, normalize(cameraPosition - vW))), 2.);
       vec3 c = mix(vec3(.93, .9, .82), uTint, vTi) * l * vec3(1., .94, .84); float a = vA * uF; if (a < .004) discard; gl_FragColor = vec4(c * a, a); }`, "pre", { depthWrite: true })), 46);
  const cranesW = { name: "cranes", dur: [26, 32], group: cranes,
    start(p) { const k = phone ? R(4, 5.99) | 0 : R(4, 7.99) | 0, sz = R(.95, 1.2), a = R(0, TAU), y = R(7.5, 11); cU.uA0.value = a; cU.uDir.value = sgn(); cU.uY0.value = y;
      cU.uBk.value.set(WC[0] + Math.cos(a) * (RI - 2.3), y, WC[1] + Math.sin(a) * (RI - 2.3)); cU.uTint.value.setRGB(...pick([[1, .8, .82], [.82, .9, 1], [1, .9, .7], [.86, 1, .88]]));
      for (let i = 0; i < NC; i++) { set(craneG, "aC", i, i < k ? p.dur * .25 * i / k + R(0, .6) : 1e4, Math.random(), R(.25, .9), R(0, 1)); set(craneG, "aQ", i, Math.random(), Math.random(), Math.random() < .3 ? R(.15, .35) : 0, sz * R(.85, 1.15)); }
      p.count = k; p.size = +sz.toFixed(2); p.from = +y.toFixed(1); return true; },
    tick(p, u, t) { cU.uT.value = t; } };

  // ======== lanterns: paper sky lanterns (khom fai of the Lao lantern festivals) rising slowly up the open middle: a rounded paper body with ribs, a glowing core and a warm rim, a gentle sway
  // and flicker, a soft halo, a small flame at its foot, and a soft warm pool on the books of the wall beside it. aL: x0, z0, y0, birth; aM: seed, size, sway, hue.
  const lanG = new THREE.LatheGeometry([[.3, 0], [.33, .08], [.38, .3], [.41, .55], [.4, .72], [.34, .86], [.22, .96], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  const NL = phone ? 4 : 6, lU = { ...U, uT: { value: 0 }, uIn: { value: 0 } };  // a show runs on its own clock (uT): sharing U.uT made the floating books jump back to the show's 0 s at its start and forward at its end (the owner's "glitches and skip a beat")
  const LAN = `uniform float uT; vec3 lpos(vec4 L, vec4 M, float t) { float age = max(0., t - L.w); return vec3(L.x + sin(t * .3 + M.x * 20.) * M.z, L.z + (.24 + .14 * fract(M.x * 5.)) * age + .003 * age * age, L.y + cos(t * .23 + M.x * 13.) * M.z); }
    float flick(float s) { return .92 + .05 * sin(uT * 6.3 + s * 40.) * sin(uT * 2.9 + s * 17.) + .03 * sin(uT * 11. + s * 9.); }
    float shrink(float y) { return 1. - smoothstep(${fl(TOP - 2)}, ${fl(TOP + 12)}, y); }`;
  const lanIG = inst(lanG, NL, { aL: 4, aM: 4 }), glowIG = inst(new THREE.PlaneGeometry(1, 1), NL * 3, { aL: 4, aM: 4, aK: 1 });
  const lanterns = obj(new THREE.Mesh(lanIG, mat(lU,
    `attribute vec4 aL, aM; uniform float uIn; varying vec2 vUv; varying vec3 vN, vW; varying float vA, vS, vH; ${LAN}
     void main() { vec3 c = lpos(aL, aM, uT); vUv = uv; vS = aM.x; vH = aM.w; float age = uT - aL.w; vA = step(0., age) * smoothstep(0., 2., age) * uIn;
       mat2 r = rot(sin(uT * .4 + aM.x * 9.) * .05); vec3 p = position * aM.y * shrink(c.y) * step(0., age) * mix(.3, 1., smoothstep(0., 2., age)), nn = normal; p.xy = r * p.xy; nn.xy = r * nn.xy; vN = nn; vW = c + p; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    `uniform float uF; varying vec2 vUv; varying vec3 vN, vW; varying float vA, vS, vH; ${LAN}
     void main() { vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float f = flick(vS), y = vUv.y, rim = pow(1. - abs(dot(n, v)), 2.), core = exp(-pow((y - .28) / .32, 2.));
       float rib = 1. - .3 * smoothstep(.9, 1., abs(sin(vUv.x * 37.7))) - .15 * smoothstep(.96, 1., abs(sin(y * 15.7)));  // 12 ribs and two seams of the paper
       vec3 paper = vH < .5 ? vec3(.95, .55, .24) : vec3(.95, .62, .3), hot = vec3(1., .84, .56);
       vec3 c = gl_FrontFacing ? (paper * (.36 + .4 * rim + .2 * (1. - y)) + hot * core * .4) * rib * f : hot * (1. + .4 * core) * f;  // a warm rim, the core glowing through; inside, the flame's light
       c *= .15 + .85 * vA; float a = uF * vA; gl_FragColor = vec4(c * a, a); }`, "pre", { depthWrite: true })), 46);
  const lglow = obj(new THREE.Mesh(glowIG, mat(lU,
    `attribute vec4 aL, aM; attribute float aK; uniform float uIn; varying vec2 vQ; varying float vA, vK; ${LAN}
     void main() { vec3 c = lpos(aL, aM, uT); float on = step(aL.w, uT) * smoothstep(0., 2., uT - aL.w) * uIn, sh = shrink(c.y), f = flick(aM.x); vQ = position.xy; vK = aK; vec3 p;
       if (aK < .5) { p = c + vec3(0., .45 * aM.y * sh, 0.) + normalize(cameraPosition - c) * .5 * aM.y + (camR() * position.x + camU() * position.y) * 1.8 * aM.y * f * sh; vA = on * sh * .12 * f; }  // a soft halo
       else if (aK < 1.5) { vec2 rc = c.xz - vec2(${fl(WC[0])}, ${fl(WC[1])}); float rl = max(length(rc), .01), d = ${fl(RW)} - rl; vec3 n = vec3(-rc.x / rl, 0., -rc.y / rl), W = vec3(${fl(WC[0])} + rc.x / rl * ${fl(RW - .1)}, c.y, ${fl(WC[1])} + rc.y / rl * ${fl(RW - .1)});
         vec3 a2 = normalize(cross(vec3(0., 1., 0.), n)); float s = 1.6 + d * .5; p = W + (a2 * position.x + vec3(0., 1., 0.) * position.y) * s; vA = on * sh * f * .28 / (1. + d * d * .08); }  // the pool on the books beside it
       else { p = c + vec3(0., .12 * aM.y, 0.) + (camR() * position.x + camU() * position.y) * .28 * aM.y * f; vA = on * sh * .6 * f; }  // the flame at its foot
       gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    `uniform float uF; varying vec2 vQ; varying float vA, vK;
     void main() { float r = length(vQ) * 2., a = exp(-r * r * (vK > 1.5 ? 9. : vK > .5 ? 3.5 : 6.)) * vA * uF; if (a < .003) discard; gl_FragColor = vec4(vK > 1.5 ? vec3(1., .85, .55) : vec3(1., .58, .26), a); }`)), 47);
  const lanGrp = new THREE.Group(); lanGrp.add(lanterns, lglow);
  const lanternsW = { name: "lanterns", dur: [34, 42], group: lanGrp,
    start(p) { const k = phone ? R(3, 4.99) | 0 : R(3, 6.99) | 0; for (let i = 0; i < NL; i++) { if (i >= k) { set(lanIG, "aL", i, 0, 0, -999, 1e4); set(lanIG, "aM", i, 0, 0, 0, 0); continue; }
        let x, z, tries = 0; do { const a = R(0, TAU), rr = i < 2 ? R(RI - 1.5, RI - .9) : R(1.6, RI - 1.2); x = WC[0] + Math.cos(a) * rr; z = WC[1] + Math.sin(a) * rr; } while (Math.hypot(x - C.x, z - C.z) < 2.2 && ++tries < 20);  // never at the eye
        set(lanIG, "aL", i, x, z, i < 2 ? R(.3, 1) : R(1.5, 9), p.dur * R(0, .35)); set(lanIG, "aM", i, Math.random(), R(.4, .65), R(.08, .2), Math.random()); }
      for (const k2 of ["aL", "aM"]) { const src = lanIG.attributes[k2].array, dst = glowIG.attributes[k2].array; for (let j = 0; j < 3; j++) dst.set(src, j * NL * 4); glowIG.attributes[k2].needsUpdate = true; }
      const K = glowIG.attributes.aK.array; for (let i = 0; i < NL * 3; i++) K[i] = Math.floor(i / NL); glowIG.attributes.aK.needsUpdate = true; p.count = k; return true; },
    tick(p, u, t) { lU.uT.value = t; lU.uIn.value = 1 - sm((u - .88) / .12); } };
  for (let i = 0; i < NC; i++) set(craneG, "aC", i, 1e4, 0, 0, 0); for (let i = 0; i < NL; i++) set(lanIG, "aL", i, 0, 0, -999, 1e4);  // nothing shows until a show starts
  for (const g of [cranes, lanGrp]) { g.visible = false; root.add(g); }

  // ======== the books rearrange themselves (Eddie 2026-11-17: "could the books come out of shelves and rearrange themselves somewhere else?"): now and then two show books in view (never a
  // story book) slide out of their shelves, float past each other on slow arcs turning once, and slide into each other's places; then the two instances trade covers back (books.js swapLook),
  // so every slot keeps its own instance for the pick and the ring. The shelf's own instances move (no new draw); a busy() snaps them home.
  const SA = new THREE.Vector3(), S1 = new THREE.Vector3(), S2 = new THREE.Vector3(), SQ = new THREE.Quaternion(), SR = new THREE.Quaternion(), SV = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let sw = null, swNext = R(40, 100);
  const inView = i => { V2.copy(shelf.xf[i].p).project(camera); return V2.z < 1 && Math.abs(V2.x) < .7 && Math.abs(V2.y) < .7; };  // and below, shown: library.js scales a far room's books to nothing (their matrix's [5] is then 0)
  function swapStart(why) { const show = shelf.xf.map((_, i) => i).filter(i => !shelf.isReal(i) && shelf.shown(i) && inView(i)), a = pick(show), b = a == null ? null : pick(show.filter(j => Math.abs(shelf.xf[j].p.y - shelf.xf[a].p.y) > .3 || shelf.slots[j].case !== shelf.slots[a].case));
    if (b == null) return false; sw = { a, b, t: 0, dur: R(7, 9) }; api.log.push({ t: +clock.toFixed(1), name: "swap", why, books: [a, b] }); return true; }
  function swapStep(dt, off) { const { a, b } = sw; sw.t += dt; const u = Math.min(1, sw.t / sw.dur);
    if (off || u >= 1) { if (!off) shelf.swapLook(a, b); shelf.home(a); shelf.home(b); sw = null; swNext = clock + R(50, 120); return; }
    for (let o = 0; o < 2; o++) { const i = o ? b : a, j = o ? a : b, k = o ? -1 : 1, A = shelf.xf[i], B = shelf.xf[j], ya = shelf.slots[i].yaw ?? 0, yb = shelf.slots[j].yaw ?? 0, e = sm(u);
      S1.set(Math.sin(ya), 0, Math.cos(ya)).multiplyScalar(.45).add(A.p).addScaledVector(UP, .25 * k + .35); S2.set(Math.sin(yb), 0, Math.cos(yb)).multiplyScalar(.45).add(B.p).addScaledVector(UP, .35 - .25 * k);  // out of its shelf, past the other a little above or below
      const m = 1 - e; SV.copy(A.p).multiplyScalar(m * m * m).addScaledVector(S1, 3 * m * m * e).addScaledVector(S2, 3 * m * e * e).addScaledVector(B.p, e * e * e);
      SQ.copy(A.q).slerp(B.q, e).premultiply(SR.setFromAxisAngle(UP, TAU * sm((u - .2) / .6) * k)); SA.copy(A.s).lerp(B.s, e); shelf.set(i, SV, SQ, SA); } }  // no shimmer: it washed the leather to pale paper in flight
  // ---- the director: the books always there; a letter now and then; one rare show at a time, each on its own random clock (never a rhythm), and never right after the other
  const SHOWS = { cranes: cranesW, lanterns: lanternsW }, SHOW_NAMES = Object.keys(SHOWS), GAP = { cranes: [45, 120], lanterns: [60, 150] };
  let cur = null, clock = 0, rest = 0; const next = { cranes: R(...GAP.cranes), lanterns: R(...GAP.lanterns) };
  function begin(name, why) { const w = SHOWS[name], p = { name, why, dur: R(...w.dur), t: 0 }; if (!w.start(p)) return false; w.group.visible = true; cur = { w, p }; chime(name);
    api.log.push({ t: +clock.toFixed(1), name, why, dur: +p.dur.toFixed(1), ...Object.fromEntries(Object.entries(p).filter(([k]) => !["name", "why", "dur", "t"].includes(k))) }); return true; }
  function end() { if (!cur) return; cur.w.group.visible = false; next[cur.p.name] = clock + R(...GAP[cur.p.name]); cur = null; rest = clock + R(10, 20); }
  function update(dt) {
    if (document.hidden) return; dt = Math.min(dt, .1); clock += dt; U.uT.value = clock; const e = camera.matrixWorld.elements; C.set(e[12], e[13], e[14]);
    const off = busy() || here !== "home"; FADE.value = Math.max(0, Math.min(1, FADE.value + (off ? -dt / .6 : dt / 1.5))); root.visible = here === "home" && FADE.value > 0;
    letters.visible = clock < lastLetter;
    if (cur) { const { w, p } = cur; p.t += dt; if (off) p.t = Math.max(p.t, p.dur * .9 + (1 - FADE.value) * p.dur * .1); const u = p.t / p.dur; if (u >= 1) end(); else w.tick(p, u, p.t); }  // busy: it ends in its own short fade
    if (sw) swapStep(dt, off); if (off || !api.auto) return;
    if (shelf && !sw && !cur && clock >= swNext && !swapStart("timer")) swNext = clock + R(5, 10);  // no two show books in view: look again soon
    if (clock >= ltNext) { ltNext = clock + (letter(clock, "timer") ? tri(6, 22) : R(1, 3)); }  // no beam in view: look again soon
    if (!cur && clock >= rest && (clock >= next.cranes || clock >= next.lanterns)) { const nm = clock >= next.cranes && clock >= next.lanterns ? pick(SHOW_NAMES) : clock >= next.cranes ? "cranes" : "lanterns"; if (!begin(nm, "timer")) next[nm] = clock + R(5, 10); }  // nothing built per frame: only when one is due
  }
  function fire(name) { if (name === "books") return { name, count: NB }; if (name === "swap") return shelf && !sw && swapStart("fire") ? { name } : null; if (name === "letters") return letter(clock, "fire") ? { name } : null; if (!SHOWS[name]) return null; end(); return begin(name, "fire") ? cur.p : null; }
  function setStation(id) { here = id; }
  function stats() { let draws = 0; const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; }; root.traverse(o => { if (o.isMesh && vis(o)) draws++; });
    return { playing: cur?.p.name ?? (sw ? "swap" : null), u: cur ? +(cur.p.t / cur.p.dur).toFixed(3) : 0, books: NB, letters: letters.visible, draws, fade: +FADE.value.toFixed(2), next: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, +(v - clock).toFixed(1)])), clock: +clock.toFixed(1), log: api.log }; }
  function dispose() { scene.remove(root); root.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); glyphs.dispose(); }
  if (renderer?.compileAsync) { for (const g of [cranes, lanGrp, letters]) g.visible = true; renderer.compileAsync(root, camera, scene).catch(e => console.warn("wonders: compile", e)).finally(() => { cranes.visible = lanGrp.visible = false; letters.visible = false; }); }  // every program now, behind the room's own loading
  return api;
}
