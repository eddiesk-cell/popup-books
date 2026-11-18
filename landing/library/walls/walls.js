// walls.js (Eddie 2026-11-17: "the wall in front of us is flat, it kind of ruin the circular when we look up ... the wall cuts off our portals on both sides"): the library is ONE round tower, a rotunda,
// and every wall of books is ONE material, so no wall is a patch (the earlier "please make them seamless").
//   towerPlan(room): the plan from room.walls.rotunda. One circle round the axis `c`, cut into flat facets whose corners all lie on it: our 4 cases' facets in front (apothem `a`, each as wide as a case
//   and its gap), the entrance door's facet behind, and plain bays shared out evenly between them; a fluted pilaster stands on every corner. The Wonder Hall at the foot is a wider ring (hall.r, hall.n bays).
//   createWalls: the walls of books, every facet of every ring, with the arched openings of each level's doors cut out of them (holes: a portal, the door, a hall arch). The facets are flat, so a flat card
//   (a portal's carved frame, the door's facade) sits flush in its bay, and each bay is drawn as one bookcase between two pilasters.
//   Each bay is drawn in the shader: carved uprights, a board under every shelf with its shadow, a deeper band every sixth shelf, the dark back of the bay above shorter books and in gaps. Each shelf of books is one cell of books.webp (cut from the towers'
//   own paintings by assets/landing/walls/make_bookcells.py), chosen per bay and shelf by a seeded hash, sometimes mirrored, a shade lighter or warmer, so no two bays repeat.
//   Books are the same size in metres everywhere and every shelf lines up round the tower. Far walls darken and melt into the sky's own gradient (sky.js), the top glows round the oculus,
//   and the light shafts (setBeams) lay warm light on the books they cross.
//   createLamps: every lantern hangs from a wrought-iron bracket fixed to a pilaster, lit, with the old flicker.
//   Two instanced draws for all of them: the iron and brass (lit by the room's lights), and the glass with its glow (additive, the glow faces you and lights the books behind).
//     const plan = towerPlan(room); const w = createWalls(THREE, room, plan, { spans: [{ P, y0, y1, id }], holes }, { base, phone, anisotropy }); scene.add(w.wall); w.setBeams(beams, axis); w.lampAt(P, corner, y) -> {p, n}
//     const l = createLamps(THREE, spots, { reduced }); scene.add(l.solid, l.light); l.show(stationId) (spots may carry when(id)); l.update(T)
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const NB = 28;  // most beams the wall shader reads
const FRAG = `uniform sampler2D uMap; uniform vec2 uCells, uTop; uniform float uGain, uNB, uPwr, uEvery; uniform vec3 uDown, uMid, uUp, uZen, uFog, uFar, uAx, uTint; uniform vec4 uBm[${NB}], uBi[${NB}];
varying vec2 vUv; varying vec4 vM; varying vec3 vW;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1., 0.)), f.x), mix(h1(i + vec2(0., 1.)), h1(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  vec3 col;
  if (vM.x > 2.5) {  // a pilaster (u across its face in metres; vM: mode, the face's shade, its width, the shelf height): fluted wood, rounded, a gilt capital at every deep band
    float s = vUv.x / vM.z * 2., ry = vUv.y / vM.w, fy = fract(ry), band = step(5.5, mod(floor(ry), 6.)), gr = .85 + .3 * vn(vec2(vUv.x * 9., vUv.y * 1.3));
    col = vec3(.06, .032, .015) * gr * vM.y * (.72 + .4 * smoothstep(-.2, .7, cos(s * 7.85))) * (1. - .3 * s * s) + band * vec3(.3, .2, .06) * vM.y * smoothstep(.24, .02, fy);
  } else {
    vec2 g = vec2((vM.x > 1.5 ? abs(vUv.x) : vUv.x) - vM.y, vUv.y) / vM.zw, id = floor(g), f = fract(g), dg = fwidth(g);  // vM: mode, u offset, bay width, shelf height (m)
    float band = step(5.5, mod(id.y, 6.)), uw = .0485, bt = mix(.097, .222, band);  // upright half width, board height (a deeper band every sixth shelf), in cell units
    float r1 = h1(id), r2 = h1(id + 17.31), r3 = h1(id + 41.7), r5 = h1(id + 9.1), cell = floor(r1 * uCells.x * uCells.y), hs = .76 + .24 * h1(id + 5.3);  // hs: how tall this shelf's books stand
    float fx = r2 < .5 ? f.x : 1. - f.x;  // half the shelves mirrored
    vec2 bf = vec2((fx - uw) / (1. - 2. * uw), (f.y - bt) / (1. - bt)), sb = clamp(vec2(bf.x, bf.y / hs), .003, .997), cc = vec2(mod(cell, uCells.x), floor(cell / uCells.x));
    vec2 auv = vec2((cc.x + sb.x) / uCells.x, 1. - (cc.y + 1. - sb.y) / uCells.y), k = vec2(1. / ((1. - 2. * uw) * uCells.x), 1. / ((1. - bt) * hs * uCells.y));
    float g0 = .1 + .7 * h1(id + 3.3), gap = step(r5, .3) * step(g0, bf.x) * step(bf.x, g0 + .05 + .1 * h1(id + 7.7));  // a gap in about one shelf in three
    vec3 back = vec3(.014, .008, .004) * (.8 + .4 * vn(vUv * 3.)), books = textureGrad(uMap, auv, dFdx(g) * k, dFdy(g) * k).rgb * (.86 + .26 * r3) * vec3(1., .97 + .05 * r2, .94 + .08 * r1);
    books = mix(books, back, max(gap, smoothstep(hs - .02, hs + .02, bf.y)));  // the dark back of the bay above the books and in the gaps
    float dx = min(f.x, 1. - f.x), ex = max(dg.x * 1.2, 1e-4), ey = max(dg.y * 1.2, 1e-4), pu = g.x / uEvery, pdx = abs(pu - floor(pu + .5)) * uEvery;  // bays to the nearest pilaster
    books *= mix(.28, 1., smoothstep(uw, uw + .12, dx)) * mix(1., .22, smoothstep(.5, .97, f.y)) * mix(.5, 1., smoothstep(0., .06, bf.y)) * mix(.4, 1., smoothstep(uPwr * .5, uPwr * .5 + .27, pdx));  // shade beside the uprights, under the board above, at the board's edge, beside a pilaster
    float gr = .82 + .3 * vn(vec2(vUv.x * 30., vUv.y * 1.6)) + .08 * vn(vec2(vUv.x * 7., vUv.y * 9.)), up = 1. - smoothstep(uw - ex, uw + ex, dx), bd = 1. - smoothstep(bt - ey, bt + ey, f.y);
    vec3 wood = vec3(.05, .027, .013) * gr, upr = wood * (.45 + .75 * cos(clamp(dx / uw, 0., 1.) * 1.45)), brd = wood * mix(.55, 1.35, smoothstep(0., bt, f.y)) + band * vec3(.3, .2, .06) * smoothstep(max(.02, ey), 0., abs(f.y - bt * .55));  // a gilt line along each deep band
    col = mix(mix(books, brd, bd), upr, up) * (.86 + .28 * vn(vUv / vec2(11., 7.)));  // a slow unevenness of light over the wall, so it is never wallpaper
  }
  col *= uGain;
  float lt = 0.; for (int i = 0; i < ${NB}; i++) { if (float(i) >= uNB) break; vec3 q = vW - uBm[i].xyz; float h = dot(q, uAx), r = uBm[i].w; if (h < 0. || h > uBi[i].y) continue;
    lt += uBi[i].x * smoothstep(r * 1.3, r * .2, length(q - uAx * h)) * smoothstep(0., 6., h) * smoothstep(uBi[i].y, uBi[i].y * .7, h); }  // the books a light shaft crosses
  col *= 1. + lt * vec3(2., 1.45, .75);
  vec3 v = vW - cameraPosition; float d = length(v), p = asin(clamp(v.y / d, -1., 1.));
  vec3 sky = p < 0. ? mix(uMid, uDown, smoothstep(0., -1.2, p)) : p < 1. ? mix(uMid, uUp, smoothstep(0., 1., p)) : mix(uUp, uZen, smoothstep(1., 1.5, p));  // sky.js's gradient: far walls melt into it
  col *= mix(vec3(1.), uFar, smoothstep(6., uFog.z, d)) * mix(1., .42, smoothstep(10., 140., v.y));  // far walls darker and cooler (the old ring's tint), and darker up the well
  vec3 c = mix(linearToOutputTexel(vec4(col, 1.)).rgb, sky, (1. - exp(-max(0., d - uFog.x) / uFog.y)) * .75) + vec3(.42, .3, .15) * .5 * smoothstep(uTop.x, uTop.y, vW.y);  // the sky's haze, and a warm haze round the oculus
  gl_FragColor = vec4(c * uTint, 1.);  // uTint: a theme room's own light on its walls of books (library.js theme(); white at home)
}`;

// a ring of flat facets round centre c: corners on the circle of radius r, facet i spanning half-angle halves[i], the first corner at angle `start` (angles from -z toward +x, as the visitor turns right)
const ring = (c, r, halves, start) => { const th = [start]; for (const h of halves) th.push(th.at(-1) + 2 * h); const pt = t => [c[0] + r * Math.sin(t), c[1] - r * Math.cos(t)];
  return { c, r, th: th.slice(0, -1), corners: th.slice(0, -1).map(pt), facets: halves.map((h, i) => { const phi = th[i] + h; return { i, phi, half: h, a: r * Math.cos(h), w: 2 * r * Math.sin(h), p0: pt(th[i]), p1: pt(th[i + 1]), n: [-Math.sin(phi), Math.cos(phi)] }; }) };
};
export function towerPlan(room) {
  const T = room.walls.rotunda, hc = T.caseW / 2, r = Math.hypot(T.a, hc), ac = Math.asin(hc / r), ad = Math.asin(T.doorW / 2 / r), side = Math.PI - 4 * ac - ad;
  const n = Math.max(1, Math.round(side / (2 * Math.asin(T.bayW / 2 / r)))), as = side / n / 2, H = T.hall;
  const P = ring(T.c, r, [ac, ac, ac, ac, ...Array(n).fill(as), ad, ...Array(n).fill(as)], -4 * ac), N = P.facets.length;
  return { ...P, T, ri: T.a - T.deep, right: k => 4 + k, left: k => N - 1 - k, door: 4 + n, hall: { ...ring(T.c, H.r, Array(H.n).fill(Math.PI / H.n), -Math.PI / H.n), ri: H.r * Math.cos(Math.PI / H.n) - T.deep } };
}
// a point on facet f of ring P: u metres from its first corner, at height y, `inset` metres in front of the wall; and the facet's inward normal
export const onFacet = (P, f, u, y, inset = 0) => { const F = P.facets[f], t = u / F.w; return [F.p0[0] + (F.p1[0] - F.p0[0]) * t + F.n[0] * inset, y, F.p0[1] + (F.p1[1] - F.p0[1]) * t + F.n[1] * inset]; };
// an arched opening's outline in a facet's (u, y): a door hole is { f, y (its floor), hw (half width), sp (spring line above the floor), ry (the arch's height), c (u of its middle, default the facet's middle) }
export const archPts = (P, h, k = 16) => { const c = h.c ?? P.facets[h.f].w / 2, pts = [[c - h.hw, h.y - .02], [c - h.hw, h.y + h.sp]];
  for (let j = 1; j < k; j++) { const a = Math.PI - Math.PI * j / k; pts.push([c + h.hw * Math.cos(a), h.y + h.sp + h.ry * Math.sin(a)]); } pts.push([c + h.hw, h.y + h.sp], [c + h.hw, h.y - .02]); return pts; };

export function createWalls(THREE, room, plan, { spans, holes = [] }, { base, phone = false, anisotropy = 8 } = {}) {
  const C = room.walls, P = C.pilaster;
  const t = new THREE.TextureLoader().load(new URL(phone && C.atlasPhone ? C.atlasPhone : C.atlas, base).href, undefined, undefined, () => console.warn("library: walls atlas failed to load"));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  const col = k => new THREE.Color(...(room.sky?.[k] ?? [18, 11, 6]).map(v => v / 255)), ax = new THREE.Vector3(0, 1, 0), top = C.rotunda.top;
  const U = { uMap: { value: t }, uCells: { value: new THREE.Vector2(...C.cells) }, uGain: { value: C.gain ?? .9 }, uFog: { value: new THREE.Vector3(...(C.fog ?? [20, 160, 40])) }, uFar: { value: new THREE.Vector3(...(C.far ?? [.55, .57, .68])) },
    uDown: { value: col("down") }, uMid: { value: col("mid") }, uUp: { value: col("up") }, uZen: { value: col("zenith") }, uTint: { value: new THREE.Color(1, 1, 1) }, uAx: { value: ax }, uNB: { value: 0 }, uPwr: { value: P.w / C.rotunda.bayW }, uEvery: { value: 1 }, uTop: { value: new THREE.Vector2(top - 26, top + 2) },
    uBm: { value: Array.from({ length: NB }, () => new THREE.Vector4()) }, uBi: { value: Array.from({ length: NB }, () => new THREE.Vector4()) } };
  const VS = "attribute vec4 aMap; varying vec2 vUv; varying vec4 vM; varying vec3 vW; void main() { vUv = uv; vM = aMap; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }";
  const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide, fog: false, fragmentShader: FRAG, vertexShader: VS });
  const map = (g, mode, off, a, b) => g.setAttribute("aMap", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 4).map((_, i) => [mode, off, a, b][i % 4]), 4));  // how u comes from uv.x: 0 as is, 1 minus off, 2 |x| minus off, 3 a pilaster face (off: its shade); a, b: bay and shelf (a pilaster: its width and shelf)
  // a pilaster standing PD proud of the wall at point p (y from ya to yb), n out of the wall: a fluted front and two shaded sides, uv in metres (v = world height)
  const pil = (p, n, ya, yb) => { const PW = P.w, PD = P.d, a = Math.atan2(n[0], n[2]), tx = [Math.cos(a), 0, -Math.sin(a)], face = (w, cx, cz, rot, shade) => { const g = new THREE.PlaneGeometry(w, yb - ya), q = g.attributes.uv;
      for (let i = 0; i < q.count; i++) q.setXY(i, (q.getX(i) - .5) * w, ya + q.getY(i) * (yb - ya)); g.rotateY(rot); g.translate(cx, (ya + yb) / 2, cz); return map(g, 3, shade, PW, C.row); };
    const at = (s, o) => [p[0] + tx[0] * s + n[0] * o, p[2] + tx[2] * s + n[2] * o];
    return [face(PW, ...at(0, PD), a, 1), face(PD + .04, ...at(-PW / 2, PD / 2 - .02), a - Math.PI / 2, .5), face(PD + .04, ...at(PW / 2, PD / 2 - .02), a + Math.PI / 2, .5)]; };
  // each facet of each span (a ring of facets from y0 to y1) is one bay: a flat sheet with its door holes cut out, u in metres along it; g.x = facet index + u / width, so every bay picks its own books
  const parts = [];
  spans.forEach(({ P: R, y0, y1, id = 0 }) => { R.facets.forEach(F => {
    const s = new THREE.Shape([[0, y0], [F.w, y0], [F.w, y1], [0, y1]].map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) if (h.P === R && h.f === F.i && h.y > y0 && h.y < y1) s.holes.push(new THREE.Path(archPts(R, h).map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ShapeGeometry(s, 1), p = g.attributes.position, q = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), y = p.getY(i), k = u / F.w; q.setXY(i, u, y); p.setXYZ(i, F.p0[0] + (F.p1[0] - F.p0[0]) * k, y, F.p0[1] + (F.p1[1] - F.p0[1]) * k); }
    parts.push(map(g, 0, -(F.i + id) * F.w, F.w, C.row)); });
    R.th.forEach((th, i) => parts.push(...pil([R.corners[i][0], 0, R.corners[i][1]], [-Math.sin(th), 0, Math.cos(th)], y0, y1))); });
  const wall = new THREE.Mesh(mergeGeometries(parts.map(g => (g.deleteAttribute("normal"), g.index ? g.toNonIndexed() : g))), mat); wall.name = "wall_tower"; wall.frustumCulled = false; wall.renderOrder = 2;  // after the cases, balconies and floors, so the books behind them are never shaded
  return { wall, material: mat, pd: P.d,
    lampAt: (R, k, y) => { const th = R.th[k], n = [-Math.sin(th), 0, Math.cos(th)]; return { p: [R.corners[k][0] + n[0] * (P.d + .005), y, R.corners[k][1] + n[2] * (P.d + .005)], n }; },  // on corner k's pilaster face, facing the middle
    setBeams(list, axis) { ax.copy(axis); U.uNB.value = Math.min(NB, list.length); list.slice(0, NB).forEach((b, i) => { U.uBm.value[i].set(b.B.x, b.B.y, b.B.z, b.r); U.uBi.value[i].set(b.I, b.L, 0, 0); }); } };
}

// a sconce in its own frame: the wall at z 0, +z out of it, +y up; the lantern hangs under the arm's tip (its glass centre at LC)
const LC = [0, -.39, .56];
export function createLamps(THREE, spots, { reduced = false } = {}) {
  const parts = [], iron = [.09, .07, .06], brass = [.62, .45, .2];
  const put = (g, c, f) => { f(g); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute("color", new THREE.BufferAttribute(a, 3)); parts.push(g.index ? g.toNonIndexed() : g); };
  put(new THREE.BoxGeometry(.11, .24, .03), iron, g => g.translate(0, 0, .015));  // the plate on the upright
  put(new THREE.BoxGeometry(.04, .04, .6), iron, g => g.translate(0, 0, .3));  // the arm
  put(new THREE.BoxGeometry(.03, .03, .44), iron, g => { g.rotateX(-.443); g.translate(0, -.115, .23); });  // the brace under it
  put(new THREE.TorusGeometry(.055, .009, 5, 12, Math.PI * 1.5), iron, g => { g.rotateY(Math.PI / 2); g.translate(0, -.07, .2); });  // a curl between them
  put(new THREE.SphereGeometry(.028, 8, 6), brass, g => g.translate(0, 0, .61));
  put(new THREE.BoxGeometry(.012, .12, .012), iron, g => g.translate(0, -.08, .56));  // the hanger
  const lathe = pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 8);
  put(lathe([[.001, -.14], [.03, -.15], [.12, -.24], [.135, -.255], [.11, -.265]]), brass, g => g.translate(0, 0, .56));  // the cap
  put(lathe([[.11, -.515], [.135, -.53], [.1, -.57], [.025, -.62], [.001, -.645]]), brass, g => g.translate(0, 0, .56));  // the foot
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; put(new THREE.BoxGeometry(.014, .26, .014), brass, g => g.translate(Math.cos(a) * .108, -.39, .56 + Math.sin(a) * .108)); }  // the cage
  for (const g of parts) { g.deleteAttribute("uv"); }
  const solidG = mergeGeometries(parts), M = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), n = spots.length;
  const solid = new THREE.InstancedMesh(solidG, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x1c1006 }), n);
  // the glass (an 8-sided column) and its glow (a quad turned to you, pulled a little toward you so the wall behind does not cut it): one additive draw
  const glass = new THREE.CylinderGeometry(.096, .096, .25, 8, 1, false).translate(...LC), halo = new THREE.PlaneGeometry(2, 2);
  for (const [g, h] of [[glass, 0], [halo, 1]]) { g.setAttribute("aHalo", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(h), 1)); g.deleteAttribute("normal"); g.deleteAttribute("uv"); }
  const U = { uT: { value: 0 } }, light = new THREE.InstancedMesh(mergeGeometries([glass, halo]), new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uT; attribute float aHalo; varying vec2 vQ; varying float vF, vH; void main() { float i = float(gl_InstanceID);
      vF = .9 + .07 * sin(uT * 9.1 + i) * sin(uT * 2.3 + i * 2.) + .03 * sin(uT * 23. + i * 5.); vH = aHalo; mat4 M = modelMatrix * instanceMatrix; float s = length(M[0].xyz);
      if (aHalo > .5) { vec4 c = M * vec4(${LC.join(", ")}, 1.); vec3 tc = cameraPosition - c.xyz; float dc = length(tc); c.xyz += tc / dc * min(.9 * s, dc * .5); vec4 mv = viewMatrix * c; mv.xy += position.xy * 1.15 * s; gl_Position = projectionMatrix * mv; vQ = position.xy; }
      else { gl_Position = projectionMatrix * viewMatrix * M * vec4(position, 1.); vQ = vec2((position.y - ${LC[1]}) / .125, 0.); } }`,
    fragmentShader: `varying vec2 vQ; varying float vF, vH; void main() { vec3 c; if (vH > .5) { float r2 = dot(vQ, vQ); c = vec3(1., .66, .32) * (exp(-r2 * 5.) * .34 + exp(-r2 * 26.) * .36) * vF; }
      else c = mix(vec3(1., .55, .2), vec3(1., .88, .6), .5 + .5 * vQ.x) * .85 * vF; gl_FragColor = vec4(c, 1.); }` }), n);
  const show = id => { spots.forEach((sp, i) => { q.setFromUnitVectors(Z, new THREE.Vector3(...sp.n).normalize()); M.compose(new THREE.Vector3(...sp.p), q, new THREE.Vector3().setScalar(id == null || !sp.when || sp.when(id) ? sp.s ?? 1 : 0)); solid.setMatrixAt(i, M); light.setMatrixAt(i, M); });
    solid.instanceMatrix.needsUpdate = light.instanceMatrix.needsUpdate = true; };  // a lamp whose bookcase or wall is hidden from here is hidden with it (scaled to nothing)
  show(); for (const m of [solid, light]) { m.frustumCulled = false; m.name = "lamps"; } light.renderOrder = 58;
  return { solid, light, show, update(T) { U.uT.value = reduced ? 0 : T; } };
}
