// intro/time.js: the Grand Library of Time, v2. Owner 2026-11-18, on the code pilot: "The look is right, but the code look makes it look like cheap game generated look", then the picture he approved
// (assets/landing/time/eye2-wide.png: looking OUT through the doorway at eye level, round book towers soaring out of sight in warm amber haze, carved wooden bridges with balustrades, arched supports and
// lanterns between them, tall ladders, open books drifting, columns of light falling from the upper right, our tower glowing in the middle) and the path: "when we open the door we see it horizontally,
// then we fly and still look forward, until we're about to get to our cylinder then we look down and fly down to our tube". Real 3D, so the camera can pass between towers and end looking straight down;
// painted surfaces and the picture's light and haze, so it reads as that painting, not as generated geometry:
//   towers   the walls' own painted book cells (walls/books.webp, already loaded for the room) in bays between wooden uprights, a carved gallery band every GAL shelves with a real ledge ring on it (its
//            silhouette reads), a carved crown on every top; laid out round the flight path (never on it) out to where the haze swallows them, so there is no end in sight. Lit from the upper right, as
//            the picture is, the shafts brighten the books they cross, deeper is darker
//   bridges  the house's painted carved bridge (art/bridge1.webp: balustrade, deck beam, arched brackets, lanterns) on both sides of a polished plank deck, between neighbouring towers at many heights
//   ladders  solid polished-wood ladders up the towers
//   books    open books drifting, pages fanned, flapping slowly; shafts of light falling from the upper right with dust glowing in them; the haze itself, a dome: dark gold below, bright gold above
//   ours     our tower's outer shell round the real rotunda (which stays inside it), a gallery glowing from within at eye level, a gilt crown open over the oculus, and a soft glow over it
// const time = createTime(THREE, { phone, ours: { x, z, top, r, hall: { r, y } }, path: [[x, y, z], ...], atlas, cells, base }); scene.add(time.group); await time.ready;
// each frame of the flight: time.update(camera, dt). Nothing is allocated per frame; every instance is placed once, here; what moves, moves in its vertex shader.
export function createTime(THREE, { phone = false, ours, path, atlas, cells = [4, 8], base, row = .72 }) {
  const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11), R = (a, b) => a + rnd() * (b - a);
  const O = new THREE.Vector3(ours.x, ours.top, ours.z), OR = ours.r + .55, GAL = 12, NS = phone ? 9 : 14;  // our shell's radius; a gallery every 12 shelves; light shafts
  const KEY = new THREE.Vector3(.42, .8, -.43).normalize();  // toward the light: the picture's upper right, a little behind the towers
  const U = { uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uL: { value: KEY }, uO: { value: new THREE.Vector4(O.x, O.y, O.z, OR) }, uMap: { value: atlas }, uCells: { value: new THREE.Vector2(...cells) },
    uBr: { value: null }, uS: { value: Array.from({ length: NS }, () => new THREE.Vector4()) } };
  const HEAD = `uniform vec3 uCam, uL; uniform vec4 uO, uS[${NS}]; uniform float uT; uniform sampler2D uMap, uBr; uniform vec2 uCells;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1., 0.)), f.x), mix(h1(i + vec2(0., 1.)), h1(i + vec2(1., 1.)), f.x), f.y); }
vec3 haze(vec3 v) { float p = v.y; vec3 c = p > 0. ? mix(vec3(.76, .62, .4), vec3(.95, .85, .63), smoothstep(0., .75, p)) : mix(vec3(.76, .62, .4), mix(vec3(.46, .34, .19), vec3(.13, .085, .04), smoothstep(-.3, -.95, p)), smoothstep(0., -.4, p));
  return c + vec3(1., .86, .6) * .32 * pow(max(dot(v, uL), 0.), 5.); }  // the picture's air: dark gold in the depths, bright gold above, a glow toward the light
vec3 fogit(vec3 c, vec3 w) { vec3 v = w - uCam; float d = length(v); return mix(c, haze(v / d), 1. - exp(-d / 105.)); }
const vec3 SDIR = vec3(-.16, -.98, .12); float shafts(vec3 w) { float l = 0.; vec3 D = normalize(SDIR); for (int i = 0; i < ${NS}; i++) { vec3 q = w - vec3(uS[i].x, 0., uS[i].y); l += smoothstep(uS[i].z * 1.5, uS[i].z * .2, length(q - D * dot(q, D))) * uS[i].w; } return l; }
float inOurs(vec3 w) { return step(length(w.xz - uO.xz), uO.w + .6) * step(w.y, uO.y + 24.); }  // our well and the column the camera drops down: nothing of ours drifts there
`;
  const mat = (vs, fs, o = {}) => new THREE.ShaderMaterial({ uniforms: U, vertexShader: HEAD + vs, fragmentShader: HEAD + fs, fog: false, ...o });
  const group = new THREE.Group(), put = (geo, m, n, attrs, order = 0) => { const g = new THREE.InstancedBufferGeometry().copy(geo); g.instanceCount = n;
    for (const k in attrs) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(attrs[k][1]), attrs[k][0]));
    const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = order; group.add(o); return o; };

  // ---- the layout: hero towers framing the opening view (eye2-wide.png's composition, set along the path's first heading), then a jittered field round the path out into the haze
  const P = path.map(p => new THREE.Vector3(...p)), S0 = P[0], F = new THREE.Vector3(O.x - S0.x, 0, O.z - S0.z).normalize(), Rt = new THREE.Vector3(-F.z, 0, F.x);
  const at = (a, b) => [S0.x + F.x * a + Rt.x * b, S0.z + F.z * a + Rt.z * b], T = [];  // towers: [x, z, r, top, ours]
  const clearOf = (x, z, r, top) => P.every(p => p.y > top + 8 || Math.hypot(p.x - x, p.z - z) > r + 11) && Math.hypot(x - O.x, z - O.z) > r + OR + 14 && T.every(t => Math.hypot(t[0] - x, t[1] - z) > t[2] + r + 9);
  for (const [a, b, r, top] of [[36, -31, 9, 260], [40, 33, 9.5, 300], [55, -22, 7, 210], [50, 24, 7.5, 230], [80, -20, 6, 95], [78, 21, 6.5, 170], [100, 36, 8.5, 270], [126, -33, 7, 150], [150, 20, 8, 320]]) {
    const [x, z] = at(a, b); if (clearOf(x, z, r, top)) T.push([x, z, r, top, 0]); }
  const H0 = T.length, SP = 54, RAD = phone ? 520 : 660, mid = P[P.length >> 1];
  for (let i = -RAD; i <= RAD; i += SP) for (let j = -RAD; j <= RAD; j += SP) { const x = mid.x + i + R(-15, 15), z = mid.z + j + R(-15, 15), d = Math.hypot(x - mid.x, z - mid.z), r = R(5, 11);
    if (d > RAD || rnd() < d / RAD * (phone ? .55 : .35)) continue; const top = rnd() < .3 ? R(-8, 48) : R(60, 460); if (clearOf(x, z, r, top)) T.push([x, z, r, top, 0]); }
  const OT = T.length; T.push([O.x, O.z, OR, O.y, 1]);  // ours, last: its shell from the hall's top up to ours.top, and wider round the hall below
  const near = t => P.some(p => Math.hypot(p.x - t[0], p.z - t[1]) < (phone ? 200 : 260));

  // ---- the towers: one instanced open cylinder, its height and radius per instance; the painted books, uprights and gallery bands are drawn in the shader
  const TW = [], TI = []; T.forEach((t, i) => { const lo = t[4] ? ours.hall.y : -900; TW.push(t[0], t[1], t[2], t[3]); TI.push(lo, rnd(), t[4], 0); if (t[4]) { TW.push(t[0], t[1], ours.hall.r + .6, ours.hall.y); TI.push(-900, .37, 1, 0); } });
  const BODY = `attribute vec4 aW, aI; varying vec3 vW, vN; varying vec4 vI;
void main() { vec3 n = vec3(position.x, 0., position.z); vW = vec3(aW.x + n.x * aW.z, mix(aI.x, aW.w, position.y + .5), aW.y + n.z * aW.z); vN = n; vI = vec4(aW.z, aI.y, aI.z, aW.w); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`;
  put(new THREE.CylinderGeometry(1, 1, 1, phone ? 22 : 34, 1, true), mat(BODY, `varying vec3 vW, vN; varying vec4 vI;
void main() { vec3 n = normalize(vN), tg = vec3(-n.z, 0., n.x), V = normalize(uCam - vW); float r = vI.x, nb = max(6., floor(6.2832 * r / 1.8)), bw = 6.2832 * r / nb;
  vec2 g = vec2((atan(n.z, n.x) / 6.2832 + .5) * nb, vW.y / ${row}), id = floor(g), f = fract(g), gx = vec2(dot(dFdx(vW), tg) / bw, dFdx(vW.y) / ${row}), gy = vec2(dot(dFdy(vW), tg) / bw, dFdy(vW.y) / ${row});  // grads from the surface, so the angle's seam leaves no line
  float gal = step(mod(id.y, ${GAL}.), .5), uw = .055, bt = .1, r1 = h1(id + vI.y * 9.), r2 = h1(id + 17.31), cell = floor(r1 * uCells.x * uCells.y), hs = .74 + .24 * h1(id + 5.3), fx = r2 < .5 ? f.x : 1. - f.x;
  vec2 bf = vec2((fx - uw) / (1. - 2. * uw), (f.y - bt) / (1. - bt)), sb = clamp(vec2(bf.x, bf.y / hs), .003, .997), cc = vec2(mod(cell, uCells.x), floor(cell / uCells.x)), k = vec2(1. / ((1. - 2. * uw) * uCells.x), 1. / ((1. - bt) * hs * uCells.y));
  vec3 books = pow(textureGrad(uMap, vec2((cc.x + sb.x) / uCells.x, 1. - (cc.y + 1. - sb.y) / uCells.y), gx * k * 2.4, gy * k * 2.4).rgb, vec3(.4545)) * (.82 + .3 * h1(id + 41.7));
  float dx = min(f.x, 1. - f.x), ex = max((abs(gx.x) + abs(gy.x)) * 1.2, 1e-4), ey = max((abs(gx.y) + abs(gy.y)) * 1.2, 1e-4), up = 1. - smoothstep(uw - ex, uw + ex, dx), bd = 1. - smoothstep(bt - ey, bt + ey, f.y);
  books = mix(books, vec3(.05, .03, .015), smoothstep(hs - .03, hs + .03, bf.y)) * mix(.3, 1., smoothstep(uw, uw + .12, dx)) * mix(1., .3, smoothstep(.55, .97, f.y));  // the dark back above the books, shade by the uprights and under the board
  vec3 wood = vec3(.28, .17, .08) * (.85 + .3 * vn(vec2(vW.y * 3., id.x * 7.))), c = mix(mix(books, wood * mix(.55, 1.15, f.y / bt), bd), wood * (.45 + .75 * cos(min(dx / uw, 1.) * 1.45)), up);
  c = mix(c, wood * (.75 + .5 * smoothstep(.2, .8, fract(f.y * 3.))) + vec3(.5, .36, .12) * step(abs(f.y - .5), .045), gal);  // the carved gallery band (its ledge sits on it), a gilt line through it
  float ld = max(dot(n, normalize(vec3(uL.x, .15, uL.z))), 0.), lit = .5 + 1.15 * sqrt(ld), sh = shafts(vW), ours = vI.z, lamp = gal * step(.5, mod(id.x + id.y, 2.)) * smoothstep(.16, .04, length(vec2((f.x - .5) * bw, (f.y - .5) * ${row})));
  c *= lit * vec3(1.28, 1.1, .86) * (1. + sh * vec3(1.5, 1.05, .55)) * mix(1., .3, smoothstep(10., -170., vW.y)); c += vec3(.16, .11, .05) * ld * ld;  // the warm key, and its sheen on the lit side  // the light from the upper right, the shafts it lays on the books, darker into the depths
  float glow = ours * smoothstep(7.5, 9.5, vW.y) * smoothstep(19.5, 17.5, vW.y) * (1. - up) * (1. - bd) * step(gal, .5);  // ours: a gallery lit from within, at eye level (the picture's glowing tower)
  c = mix(c * (1. + ours * .2), mix(c * 1.9 + vec3(.3, .14, .03), vec3(1.25, .88, .46), smoothstep(hs - .04, hs + .04, bf.y) * .9 + .25), glow) + lamp * vec3(1., .72, .38) * 1.6;  // the light behind the books shines over and between them
  c += haze(-V) * pow(1. - abs(dot(n, V)), 4.) * .3 * (.5 + max(dot(n, uL), 0.));  // the haze wrapping round each silhouette
  gl_FragColor = vec4(fogit(c, vW), 1.); }`), TW.length / 4, { aW: [4, TW], aI: [4, TI] }, 1);

  // ---- balconies: a carved gallery ring every GAL shelves on the towers near the path, and a crown on every top: a slab with its moulded fascia, a plank floor, and the bridge's own painted carved
  //      balustrade round its edge (see-through, as the picture's are; their silhouettes are what makes a tower read as built). Ours has an open crown over the oculus (out of the handover frame).
  const LG = [], LK = [], BH = 1.5, FL = .3;  // [x, y (its foot), z, outer radius], [kind (0 gallery, 1 crown, 2 ours), height, seed, inner radius / outer]
  T.forEach(t => { if (!t[4]) LG.push(t[0], t[3], t[1], t[2] * 1.06), LK.push(1, BH, rnd(), 0);
    if (!near(t)) return; const lo = Math.max(t[4] ? ours.hall.y + 3 : -60, -60), hi = Math.min(t[3] - 3, phone ? 100 : 140), gy = GAL * row;
    for (let y = Math.ceil(lo / gy) * gy; y < hi; y += gy) { LG.push(t[0], y, t[1], t[2] * 1.13); LK.push(0, BH, rnd(), 1 / 1.13 - .005); } });
  LG.push(O.x, O.y - .1, O.z, ours.r + 1.3); LK.push(2, BH, 0, (ours.r - .3) / (ours.r + 1.3));
  put(new THREE.CylinderGeometry(1, 1, 1, phone ? 24 : 40, 1, false), mat(`attribute vec4 aG, aK; varying vec3 vW, vN; varying vec2 vU; varying vec4 vK; varying float vH, vR, vRad;
void main() { vK = aK; vU = uv; vN = normal; vH = position.y + .5; vRad = aG.w; vR = max(1., floor(6.2832 * aG.w / ${(4.03 * (1 - FL) * BH / .187).toFixed(2)} + .5)); float y = normal.y > .5 ? ${FL} : vH;  // whole cards of balustrade round the ring; the top cap comes down to be the floor inside it
  vW = vec3(aG.x + position.x * aG.w, aG.y + y * aK.y, aG.z + position.z * aG.w); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
  `varying vec3 vW, vN; varying vec2 vU; varying vec4 vK; varying float vH, vR, vRad;
void main() { vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.), Ls = normalize(vec3(uL.x, 0., uL.z)); float top = step(.5, n.y), bot = step(n.y, -.5), rr = length(vU - .5) * 2.;
  vec3 wood = vec3(.3, .17, .08) * (.85 + .3 * vn(vU * 40.)), c; if (top + bot > .5 && rr < vK.w) discard;  // a ring, not a floor across its tower (ours: open over the oculus)
  if (top > .5) c = vK.x > .5 && vK.x < 1.5 ? mix(vec3(.08, .05, .025) * (.7 + .8 * vn(vU * 18.)), wood * 1.4, smoothstep(.86, .9, rr)) : wood * (1.1 + .25 * step(.5, fract(rr * 30.)));  // a crown's floor: stacks and papers in the dark; a gallery's: planks
  else if (bot > .5) c = wood * .3;
  else { float a = atan(n.z, n.x), y = vH;
    if (y < ${FL}) { float m = y / ${FL}; c = wood * (.55 + .5 * smoothstep(.1, .3, m) - .25 * step(.7, m) * step(m, .8)) * (.8 + .3 * smoothstep(.6, 1., abs(sin(a * 18.)))) + vec3(.5, .36, .12) * step(abs(m - .55), .05);  // the slab's moulded fascia, brackets, a gilt line
      c += vec3(1., .72, .38) * 1.5 * step(.5, vK.x) * smoothstep(.12, .04, length(vec2(fract(a / 3.1416 * 4.) - .5, (m - .5) * .5))); }  // lanterns round every crown
    else { vec3 tg = vec3(-n.z, 0., n.x); float k = vR / (6.2832 * vRad), kv = .187 / ((1. - ${FL}) * vK.y);
      vec4 b = textureGrad(uBr, vec2((a / 6.2832 + .5) * vR, mix(.643, .83, (y - ${FL}) / (1. - ${FL}))), vec2(dot(dFdx(vW), tg) * k, dFdx(vW.y) * kv), vec2(dot(dFdy(vW), tg) * k, dFdy(vW.y) * kv));
      if (b.a < .5) discard; c = pow(b.rgb, vec3(.4545)); }  // the painted carved balustrade
    c *= .4 + 1.3 * max(dot(n, Ls), 0.); c += vec3(.2, .13, .05) * smoothstep(.85, 1., y) * max(uL.y, 0.); }
  if (top > .5) c *= .9 + .5 * uL.y;
  c *= (1. + shafts(vW) * vec3(1.3, .95, .5)) * mix(1., .3, smoothstep(10., -170., vW.y));
  gl_FragColor = vec4(fogit(c, vW), 1.); }`, { side: THREE.DoubleSide }), LG.length / 4, { aG: [4, LG], aK: [4, LK] }, 1);

  // ---- bridges: between neighbouring towers (gap 12-40 m) at many heights, never across the path or through another tower; a few crossing the path's line above or below it, as the picture's do
  const BA = [], BB = [], seg = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
  const xing = (a, b, c, d) => { const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return cr(a, b, c) * cr(a, b, d) < 0 && cr(c, d, a) * cr(c, d, b) < 0; };
  const bridge = (i, j, y) => { const A = T[i], B = T[j], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), gap = L - A[2] - B[2], H = gap / 4.03;
    if (gap < 12 || gap > 40 || y > Math.min(A[3], B[3]) - 4 || (A[4] || B[4]) && y > O.y - 5) return false;
    const a = [A[0] + dx / L * A[2], A[1] + dz / L * A[2]], b = [B[0] - dx / L * B[2], B[1] - dz / L * B[2]];
    if (P.some(p => p.y > y - .66 * H - 3 && p.y < y + .4 * H + 3 && seg(p.x, p.z, ...a, ...b) < 4.5)) return false;
    if (T.some((t, k) => k !== i && k !== j && seg(t[0], t[1], ...a, ...b) < t[2] + 2)) return false;
    for (let k = 0; k < BA.length; k += 4) if (Math.abs(BA[k + 1] - y) < 10 && xing(a, b, [BA[k], BA[k + 2]], [BB[k], BB[k + 2]])) return false;
    BA.push(a[0], y, a[1], 2.6); BB.push(b[0], y, b[1], rnd()); return true; };
  for (const [i, j, y] of [[2, 3, 21], [4, 5, 2], [OT, 6, 3], [OT, 6, 24], [OT, 7, 16], [0, 2, 30], [1, 3, -4]]) if (i < T.length && j < T.length) bridge(i, j, y);
  T.forEach((A, i) => { if (!near(A) && rnd() < .5) return; T.map((B, j) => [j, Math.hypot(B[0] - A[0], B[1] - A[1])]).filter(([j]) => j > i).sort((p, q) => p[1] - q[1]).slice(0, 3)
    .forEach(([j]) => { for (let n = 1 + (rnd() < .55) + (rnd() < .25), k = 0; k < n; k++) bridge(i, j, R(-60, 120)); }); });
  const bg = new THREE.BufferGeometry(), bq = [], bi = [];  // the kit in (along, height or across, part): two painted sides, the deck's planks, its soffit
  for (const part of [0, 1, 2, 3]) { const o = bq.length / 3; bq.push(0, 0, part, 1, 0, part, 1, 1, part, 0, 1, part); bi.push(o, o + 1, o + 2, o, o + 2, o + 3); }
  bg.setAttribute("position", new THREE.Float32BufferAttribute(bq, 3)); bg.setIndex(bi);
  const bmesh = put(bg, mat(`attribute vec4 aA, aB; varying vec3 vW, vN; varying vec2 vU; varying float vP, vL;
void main() { vec3 a = aA.xyz, d = aB.xyz - a; float L = length(d), H = L / 4.03, w = aA.w; vec3 t = d / L, s = vec3(-t.z, 0., t.x); vP = position.z; vL = L; vU = position.xy;
  if (vP < 1.5) { vW = a + t * position.x * L + s * (vP < .5 ? -.5 : .5) * w + vec3(0., (position.y - .643) * H, 0.); vN = s * (vP < .5 ? -1. : 1.); }  // the card's deck line (176/476 from its top) at the walkway
  else { vW = a + t * position.x * L + s * (position.y - .5) * w * .98 + vec3(0., vP < 2.5 ? -.02 : -.27 * H, 0.); vN = vec3(0., vP < 2.5 ? 1. : -1., 0.); }
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
  `varying vec3 vW, vN; varying vec2 vU; varying float vP, vL;
void main() { vec3 c;
  if (vP < 1.5) { vec4 b = texture2D(uBr, vU); if (b.a < .5) discard; c = pow(b.rgb, vec3(.4545)) * (.7 + .55 * abs(dot(vN, uL)) + .2 * uL.y); }  // the painted carved bridge, already lit by its painter
  else { float pl = fract(vU.y * 9.), gr = .85 + .3 * vn(vec2(vU.x * vL * 1.5, floor(vU.y * 9.) * 3.)); c = vec3(.3, .17, .08) * gr * (.65 + .35 * smoothstep(0., .12, pl) * smoothstep(1., .88, pl)) * (vP < 2.5 ? .7 + .6 * uL.y : .3); }
  c *= (1. + shafts(vW) * vec3(1.3, .95, .5)) * mix(1., .3, smoothstep(10., -170., vW.y)); gl_FragColor = vec4(fogit(c, vW), 1.); }`, { side: THREE.DoubleSide }), BA.length / 4, { aA: [4, BA], aB: [4, BB] }, 2);
  const tl = new THREE.TextureLoader(); let okB; const ready = new Promise(r => { okB = r; });
  U.uBr.value = tl.load(new URL(phone ? "art/bridge1-p.webp" : "art/bridge1.webp", base).href, t => okB(t), undefined, () => { console.warn("time: bridge art failed to load, bridges left out"); bmesh.visible = false; okB(); });
  U.uBr.value.colorSpace = THREE.SRGBColorSpace; U.uBr.value.anisotropy = 4;

  // ---- ladders: solid polished-wood ladders up the towers near the path (rails 10 cm, a rung every 36 cm)
  const LD = [], LE = []; T.forEach(t => { if (!near(t)) return; for (let n = 1 + (rnd() < .6) + (rnd() < .3), k = 0; k < n; k++) { const y0 = R(-50, 90), len = R(10, 34); if (y0 + len > t[3] - 2) continue;
    LD.push(t[0], t[1], t[2] + .35, rnd() * 6.283); LE.push(y0, len, rnd(), 0); } });
  const lq = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  put(lq, mat(`attribute vec4 aD, aE; varying vec3 vW, vN; varying vec2 vM;
void main() { vec3 o = vec3(cos(aD.w), 0., sin(aD.w)), t = vec3(-o.z, 0., o.x); vN = o; vM = vec2(position.x * .82, position.y * aE.y);
  vW = vec3(aD.x, aE.x, aD.y) + o * aD.z + t * vM.x + vec3(0., vM.y, 0.); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
  `varying vec3 vW, vN; varying vec2 vM;
void main() { float x = abs(vM.x), rail = step(.31, x), rung = step(fract(vM.y / .36), .16) * step(x, .33); if (rail + rung < .5) discard;
  float s = rail > .5 ? cos(clamp((x - .36) / .05, -1., 1.) * 1.3) : cos((fract(vM.y / .36) / .16 - .5) * 2.6);
  vec3 c = vec3(.38, .21, .09) * (.45 + .75 * s) * (.5 + .9 * max(dot(vN, uL), 0.)) + vec3(.3, .2, .1) * pow(max(s, 0.), 8.) * .4;  // polished: a soft highlight down each rail and rung
  c *= (1. + shafts(vW) * vec3(1.3, .95, .5)) * mix(1., .3, smoothstep(10., -170., vW.y)); gl_FragColor = vec4(fogit(c, vW), 1.); }`, { side: THREE.DoubleSide }), LD.length / 4, { aD: [4, LD], aE: [4, LE] }, 2);

  // ---- open books drifting in a box that wraps round the camera: two leather covers and a fan of pages each side of the spine, curved; they flap slowly, and near the lens they are pushed aside
  const LV = phone ? 3 : 5, WS = 4, kp = [], ki = [], NB = phone ? 110 : 190, BOX = 80, BK = [];
  for (const side of [-1, 1]) for (let k = 0; k <= LV; k++) { const o = kp.length / 3; for (let i = 0; i <= WS; i++) kp.push(i / WS, -.5, side * 10 + k, i / WS, .5, side * 10 + k);
    for (let i = 0; i < WS; i++) ki.push(o + i * 2, o + i * 2 + 2, o + i * 2 + 1, o + i * 2 + 1, o + i * 2 + 2, o + i * 2 + 3); }
  const kg = new THREE.BufferGeometry(); kg.setAttribute("position", new THREE.Float32BufferAttribute(kp, 3)); kg.setIndex(ki);
  P.forEach((p, i) => { if (i % 6 || i < 14) return; const a = rnd() * 6.283, d = R(5, 13); BK.push(p.x + Math.cos(a) * d, p.y + R(-4, 6), p.z + Math.sin(a) * d, rnd()); });  // a few along the path: you fly past them
  while (BK.length < NB * 4) BK.push(rnd() * BOX, rnd() * BOX, rnd() * BOX, rnd() + 1);  // w > 1: wraps round the camera
  put(kg, mat(`attribute vec4 aB; varying vec3 vW, vN, vI; varying vec3 vQ;
mat3 rot(vec3 a) { float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z); return mat3(cy, 0., -sy, 0., 1., 0., sy, 0., cy) * mat3(1., 0., 0., 0., cx, sx, 0., -sx, cx) * mat3(cz, sz, 0., -sz, cz, 0., 0., 0., 1.); }
void main() { float q = fract(aB.w), side = position.z < 0. ? -1. : 1., k = abs(position.z) - 10., w = position.x, h = position.y;
  vec3 c = aB.xyz + vec3(sin(uT * .21 + q * 40.), sin(uT * .33 + q * 23.) * .6, cos(uT * .17 + q * 31.)) * 1.5;
  if (aB.w > 1.) c = mod(c - uCam + ${BOX}. * .5, ${BOX}.) - ${BOX}. * .5 + uCam;
  vec3 dv = c - uCam; float d = length(dv); c += dv / max(d, .01) * smoothstep(6., 1.5, d) * 2.5; float lens = smoothstep(4., 11., d);  // never a big book across the lens
  float open = mix(1.3, 2.7, .5 + .5 * sin(uT * (1.2 + q) + q * 50.)), ang = side * open * .5 * (1. - k * .13 / ${LV}.), sz = (.85 + .7 * fract(q * 7.3)) * (1. - inOurs(c)) * lens * (k > 0. ? .95 : 1.);
  vec3 dir = vec3(sin(ang), 0., -cos(ang)), nr = vec3(cos(ang), 0., sin(ang)) * side, p = dir * w * .74 + vec3(0., h * (k > 0. ? .96 : 1.), 0.) + nr * sin(w * 3.1416) * .05 * k / ${LV}.;
  mat3 M = rot(vec3(.6 + .35 * sin(uT * .4 + q * 9.), q * 6.283 + uT * .12 * (q - .5), .25 * sin(uT * .3 + q * 17.)));
  vW = c + M * p * sz; vN = M * nr; vI = M * (-nr); vQ = vec3(q, k, w); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
  `varying vec3 vW, vN, vI; varying vec3 vQ;
void main() { vec3 V = normalize(uCam - vW), n = normalize(vN); bool inner = dot(V, normalize(vI)) > 0.; float q = vQ.x, k = vQ.y, w = vQ.z, lt;
  vec3 leather = mix(mix(vec3(.3, .08, .05), vec3(.08, .15, .22), step(.45, q)), mix(vec3(.17, .21, .08), vec3(.32, .19, .08), step(.85, q)), step(.7, q)), c;
  if (k < .5 && !inner) c = mix(leather, vec3(.75, .56, .22), step(.9, w));  // the leather cover, a gilt fore-edge
  else c = vec3(.8, .69, .5) * (.55 + .45 * smoothstep(0., .25, w)) * (k > .5 && w > .12 && w < .9 ? .92 + .08 * step(.4, fract(vW.y * 18.)) : 1.);  // the pages, darker in the gutter, faint lines of writing
  lt = .45 + .8 * abs(dot(n, uL)); c *= lt * (1. + shafts(vW) * vec3(1.2, .9, .5)); gl_FragColor = vec4(fogit(c, vW), 1.); }`, { side: THREE.DoubleSide }), BK.length / 4, { aB: [4, BK] }, 3);

  // ---- the light: shafts falling from the upper right (camera-facing soft ribbons along each axis), a few across the path; they fade near the lens and never shine inside our tower
  const SH = []; for (let i = 0; i < NS; i++) { const p = i < 4 ? P[Math.floor((i + .7) / 4.5 * P.length * .7)] : null, a = rnd() * 6.283, d = p ? R(4, 16) : R(40, 260), c = p ?? mid;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, D = new THREE.Vector3(-.16, -.98, .12).normalize(), y0 = p ? p.y : 0; SH.push(x - D.x * y0 / D.y, z - D.z * y0 / D.y, R(2.5, 6.5), R(.5, 1)); }  // stored as where its axis crosses y 0
  for (let i = 0; i < NS; i++) U.uS.value[i].set(SH[i * 4], SH[i * 4 + 1], SH[i * 4 + 2], SH[i * 4 + 3]);
  const sq = new THREE.PlaneGeometry(2, 2, 1, 24);
  put(sq, mat(`attribute float aId; varying vec3 vW; varying float vU, vA;
void main() { vec4 s = uS[int(aId)]; vec3 D = normalize(SDIR), C = vec3(s.x, 0., s.y), Pa = C + D * (mix(-300., 420., position.y * .5 + .5) / D.y); vec3 w = normalize(cross(D, Pa - uCam)); vW = Pa + w * position.x * s.z * 2.2; vU = position.x;
  vec3 q = uCam - C; float dc = length(q - D * dot(q, D)); vA = s.w * smoothstep(s.z * 1.2, s.z * 3.5, dc); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
  `varying vec3 vW; varying float vU, vA;
void main() { float x = vU * 2.2, a = exp(-x * x * 2.2) * (.55 + .65 * vn(vec2(vU * 3. + vA * 7., vW.y * .03 + uT * .35))) * smoothstep(-260., 120., vW.y) * vA * (1. - inOurs(vW));
  float d = distance(vW, uCam); a *= .34 * exp(-d / 520.); gl_FragColor = vec4(vec3(1., .9, .66) * a, 1.); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    NS, { aId: [1, Array.from({ length: NS }, (_, i) => i)] }, 40);

  // ---- dust: motes in a box round the camera, faint everywhere and bright inside the shafts
  const ND = phone ? 1400 : 3200, DB = 60, DU = []; for (let i = 0; i < ND; i++) DU.push(rnd() * DB, rnd() * DB, rnd() * DB, rnd());
  const dust = new THREE.Points(new THREE.BufferGeometry(), mat(`attribute vec4 aD; varying float vA;
void main() { vec3 p = aD.xyz + vec3(sin(uT * .3 + aD.w * 30.) * .8, -uT * (.25 + aD.w * .4), cos(uT * .23 + aD.w * 20.) * .8); p = mod(p - uCam + ${DB}. * .5, ${DB}.) - ${DB}. * .5 + uCam;
  vec4 mv = viewMatrix * vec4(p, 1.); float d = -mv.z; vA = (.12 + 1.4 * min(shafts(p), 1.)) * (.4 + .6 * aD.w) * smoothstep(.4, 2., d) * smoothstep(${DB}. * .5, ${DB}. * .3, d) * (1. - inOurs(p));
  gl_PointSize = clamp(${phone ? 90 : 150}. / d, 1., 5.); gl_Position = projectionMatrix * mv; }`,
  `varying float vA; void main() { float r = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1., .86, .58) * smoothstep(.5, 0., r) * vA, 1.); }`, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.geometry.setAttribute("aD", new THREE.Float32BufferAttribute(DU, 4)); dust.geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(ND * 3), 3)); dust.frustumCulled = false; dust.renderOrder = 41; group.add(dust);

  // ---- our glow: a soft light over our crown (it fades as you come close, so the handover frame never holds it), and the air: the haze dome, drawn first
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat(`varying vec2 vU; varying float vA; void main() { vU = uv - .5; vec3 c = uO.xyz + vec3(0., 6., 0.), r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vA = smoothstep(18., 45., distance(uCam, c)); gl_Position = projectionMatrix * viewMatrix * vec4(c + (r * position.x + u * position.y) * 46., 1.); }`,
  `varying vec2 vU; varying float vA; void main() { float r = length(vU) * 2.; gl_FragColor = vec4(vec3(1., .78, .45) * (exp(-r * r * 5.) * .55 + exp(-r * r * 30.) * .3) * vA, 1.); }`, { transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending }));
  glow.frustumCulled = false; glow.renderOrder = 42; group.add(glow);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat(`varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * viewMatrix * vec4(uCam + position * 900., 1.); }`,
    `varying vec3 vD; void main() { gl_FragColor = vec4(haze(normalize(vD)), 1.); }`, { side: THREE.BackSide, depthTest: false, depthWrite: false }));
  dome.frustumCulled = false; dome.renderOrder = -9; group.add(dome);  // over the room's own sky

  const stats = { towers: T.length, heroes: H0, bridges: BA.length / 4, ladders: LD.length / 4, ledges: LG.length / 4, books: BK.length / 4, shafts: NS, dust: ND, draws: group.children.length };
  return { group, ready, stats, update(camera, dt) { U.uCam.value.copy(camera.position); U.uT.value += dt; } };
}
