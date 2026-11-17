// walls/rotunda.js (Eddie 2026-11-17: "when you look up, you see the balconies that floats out of nowhere, could you use code to create the balconies to connect to the walls and curve with it?"):
// the tower's built parts, all generated from the plan (walls.js towerPlan) and grow.js's levels; nothing is shipped.
//   Then (Eddie, the same day: "maybe too many balconies, i want to see more books, the balconies should be just walkway just to get on so you can grab the books, with ladders"): the books are the star.
//   Each level: a round floor (one plank shader: boards, a border band with a brass line, a rosette in the middle, darker at the wall); slim walkways at `tiers` m, each a thin slab whose outer edge IS
//   the wall's facets and whose inner edge is a true circle, a narrow fascia with a gilt line, a light iron bracket under it on every pilaster, a light railing (thin turned balusters, a brass handrail,
//   slim posts with small gold finials); rolling library ladders (`ladders`): from the floor up to the first walkway's railing, and on the floor and the walkways up to a brass rail on the bookcases;
//   the same slab under its floor (so from the level below it reads as one more ring); the reveals of its arched holes (jambs, soffit, a dark back, a threshold).
//   The Wonder Hall also has its ceiling ring (where the tower narrows), with a hole the stair's light rises through; the top of the tower, the oculus, has a cornice and a gilt rim.
// Draws: ONE merged mesh of wood and gold (vertex colours, lit by the room's lights), ONE instanced draw of brackets, ONE of balusters, TWO of ladders (the two lengths), one floor per level. The levels are built top down, so a level
// and everything above it is a prefix of each buffer: show(y) draws only that (nothing below your own floor is ever drawn).
//   const t = createRotunda(THREE, plan, levels, { phone }); scene.add(t.group); t.show(floorY); t.floors.get(id) (the floor mesh; home's is named "floor" and has userData.cut(x, z, r))
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { archPts, onFacet } from "./walls.js";

const FLOOR = `uniform vec2 uC; uniform float uA, uRose; varying vec3 vW;
float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f); return mix(mix(h1(i), h1(i + vec2(1., 0.)), f.x), mix(h1(i + vec2(0., 1.)), h1(i + vec2(1., 1.)), f.x), f.y); }
vec3 boards(vec2 p, float w, float L) {  // boards w wide along y, L long, joints staggered per column: walnut, each board its own shade, grain along it, dark grooves
  float c = floor(p.x / w), fx = fract(p.x / w), pz = (p.y + h1(vec2(c, 3.)) * L) / L, r = floor(pz), fz = fract(pz), r1 = h1(vec2(c, r)), r2 = h1(vec2(c, r) + 7.1);
  vec2 aa = fwidth(vec2(p.x / w, pz)) * 1.5;
  vec3 col = mix(vec3(.052, .028, .014), vec3(.092, .052, .026), r1) * (.8 + .35 * vn(vec2(p.x / w * 3. + r2 * 9., p.y * 6.)) + .12 * vn(vec2(p.x * 40., p.y * 1.5)));
  return col * mix(.4, 1., smoothstep(aa.x, aa.x + .03, min(fx, 1. - fx))) * mix(.5, 1., smoothstep(aa.y, aa.y + .006, min(fz, 1. - fz)));
}
void main() {
  vec2 q = vW.xz - uC; float rho = length(q), an = atan(q.x, -q.y), px = fwidth(rho) * 1.5;
  vec3 col = boards(vW.xz, .19, 2.2);
  float band = smoothstep(uA - 1.02 - px, uA - 1.02 + px, rho);  // the border: boards running round the wall
  col = mix(col, boards(vec2(an * uA, rho), .23, 1.9) * .82, band);
  float star = .9 * (.55 + .45 * pow(abs(cos(an * 4.)), 6.));  // the rosette under the axis: a paler eight-point star in rings of brass
  col = mix(col, boards(vW.xz * vec2(1., -1.), .12, .9) * 1.45, smoothstep(star + px, star - px, rho) * .8 * uRose);
  float brass = 0.; for (int i = 0; i < 4; i++) { float r = i == 0 ? .45 : i == 1 ? .95 : i == 2 ? 1.35 : uA - 1.06; brass = max(brass, smoothstep(.016 + px, .016, abs(rho - r)) * (i < 3 ? uRose : 1.)); }
  col = mix(col, vec3(.42, .27, .08), brass * .85);
  col *= mix(.5, 1., smoothstep(uA - .05, uA - 1.6, rho));  // darker into the foot of the wall
  gl_FragColor = linearToOutputTexel(vec4(col, 1.));
}`;

export function createRotunda(THREE, plan, levels, { phone = false } = {}) {
  const T = plan.T, group = new THREE.Group(); group.name = "rotunda";
  const WOOD = new THREE.Color(0x6e4626), DARK = new THREE.Color(0x2a170b), GOLD = new THREE.Color(0xf0c060), up = new THREE.Vector3(0, 1, 0);
  const P = [], N = [], Cl = [], push = (p, n, c) => { P.push(...p); N.push(...n); Cl.push(c.r, c.g, c.b); };
  const quad = (a, b, c, d, n, col) => { for (const v of [a, b, c, a, c, d]) push(v, n, col); };
  const add = (g, m, col) => { g = g.index ? g.toNonIndexed() : g; if (m) g.applyMatrix4(m); const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) push([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)], col); };
  const at = (R, phi, rad, y) => [R.c[0] + rad * Math.sin(phi), y, R.c[1] - rad * Math.cos(phi)], inward = phi => [-Math.sin(phi), 0, Math.cos(phi)];
  const inGap = (gap, phi) => gap && Math.abs(Math.atan2(Math.sin(phi - gap.phi), Math.cos(phi - gap.phi))) < gap.half;
  // the bracket: a light iron triangle from the pilaster's face out under the walkway (local x out of the wall, y up, z along it), open in the middle
  const cs = new THREE.Shape([[0, 0], [.48, 0], [0, -.44]].map(([x, y]) => new THREE.Vector2(x, y))); cs.holes.push(new THREE.Path([[.06, -.045], [.33, -.045], [.06, -.29]].map(([x, y]) => new THREE.Vector2(x, y))));
  const corbelG = new THREE.ExtrudeGeometry(cs, { depth: .045, bevelEnabled: false }).translate(0, 0, -.0225);
  const balG = new THREE.LatheGeometry([[.028, 0], [.028, .04], [.017, .08], [.028, .24], [.014, .43], [.022, .57], [.015, .67], [.025, .71], [.025, .75]].map(([r, y]) => new THREE.Vector2(r, y)), phone ? 5 : 7);
  // a rolling ladder L m long (local y up the ladder from its foot, x across, -z toward the wall): two rails, a rung every 0.3 m, brass hooks over the rail at the top, brass wheels at the foot
  const paint = (g, c) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute("uv"); g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3)); return g; };
  const ladderG = L => mergeGeometries([...[-.21, .21].flatMap(x => [paint(new THREE.BoxGeometry(.05, L, .045).translate(x, L / 2, 0), WOOD), paint(new THREE.TorusGeometry(.05, .012, 4, 8, Math.PI).rotateY(Math.PI / 2).translate(x, L, -.05), GOLD),
      paint(new THREE.CylinderGeometry(.045, .045, .03, 10).rotateZ(Math.PI / 2).translate(x, .045, 0), GOLD)]), ...Array.from({ length: Math.floor((L - .35) / .3) + 1 }, (_, k) => paint(new THREE.BoxGeometry(.42, .03, .03).translate(0, .3 + k * .3, 0), WOOD))]);
  const LA = Math.hypot(T.tiers[0] + .93, 1.35), LB = Math.hypot(T.rail, .35), lads = [[], []];
  const ladder = (k, F, Tp, phi) => { const Y = new THREE.Vector3(...Tp).sub(new THREE.Vector3(...F)).normalize(), X = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)), Z = X.clone().cross(Y).normalize(); X.crossVectors(Y, Z);
    lads[k].push(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(...F)); };
  const corbels = [], bals = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), ends = [];
  const sample = (R, ri) => { const out = []; R.facets.forEach(F => { const K = Math.max(2, Math.ceil(F.w / .3)); for (let k = 0; k < K; k++) { const t = k / K, o = [F.p0[0] + (F.p1[0] - F.p0[0]) * t, F.p0[1] + (F.p1[1] - F.p0[1]) * t], phi = Math.atan2(o[0] - R.c[0], -(o[1] - R.c[1])); out.push({ o, phi, i: at(R, phi, ri, 0) }); } }); out.push(out[0]); return out; };
  // a slab ring at height y (its top): top face (if walked on), soffit, a fascia hanging `fascia` below the soffit at the inner edge, its lip and a gilt line; corbels under it on every pilaster
  function slab(R, ri, y, { top = true, gap = null } = {}) {
    const t = T.slab, fy = y - t - T.fascia, s = sample(R, ri), Y = (p, y) => [p[0], y, p[2] ?? p[1]];
    for (let k = 0; k + 1 < s.length; k++) { const a = s[k], b = s[k + 1], mid = (a.phi + b.phi) / 2 + (Math.abs(b.phi - a.phi) > Math.PI ? Math.PI : 0); if (inGap(gap, mid)) continue;
      const oa = [a.o[0], 0, a.o[1]], ob = [b.o[0], 0, b.o[1]], n = inward(mid), ia = a.i, ib = b.i, la = at(R, a.phi, ri + .1, 0), lb = at(R, b.phi, ri + .1, 0), ga = at(R, a.phi, ri - .006, 0), gb = at(R, b.phi, ri - .006, 0);
      if (top) quad(Y(oa, y), Y(ob, y), Y(ib, y), Y(ia, y), [0, 1, 0], WOOD);
      quad(Y(oa, y - t), Y(ob, y - t), Y(lb, y - t), Y(la, y - t), [0, -1, 0], WOOD);
      quad(Y(ia, y + .01), Y(ib, y + .01), Y(ib, fy), Y(ia, fy), n, WOOD);
      quad(Y(ia, fy), Y(ib, fy), Y(lb, fy), Y(la, fy), [0, -1, 0], DARK);
      quad(Y(la, y - t), Y(lb, y - t), Y(lb, fy), Y(la, fy), n.map(v => -v), DARK);
      quad(Y(ga, fy + .035), Y(gb, fy + .035), Y(gb, fy + .075), Y(ga, fy + .075), n, GOLD); }  // a gilt line along the fascia
    R.th.forEach((th, k) => { if (inGap(gap, th)) return; const p = at(R, th, R.r - .13, y - t), n = inward(th);  // a bracket on the pilaster's face, its x along n
      M.makeBasis(new THREE.Vector3(...n), up, new THREE.Vector3(...n).cross(up)).setPosition(...p); corbels.push(M.clone()); });
  }
  // the railing on a walkway at y: slim posts on the corners (and at a gap's ends) with small gold finials, thin turned balusters between them, a brass handrail and a foot rail, `rho` from the axis
  function rail(R, rho, y, gap) {
    let posts = R.th.filter(th => !inGap(gap, th)); if (gap) posts.push(gap.phi - gap.half, gap.phi + gap.half); posts = posts.map(a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
    posts.forEach((a, k) => { const b = k + 1 < posts.length ? posts[k + 1] : posts[0] + 2 * Math.PI, mid = (a + b) / 2; const p = at(R, a, rho, 0);
      add(new THREE.BoxGeometry(.08, .92, .08), M.makeRotationY(-a).setPosition(p[0], y + .46, p[2]), WOOD); add(new THREE.BoxGeometry(.11, .03, .11), M.makeRotationY(-a).setPosition(p[0], y + .935, p[2]), WOOD);
      add(new THREE.SphereGeometry(.045, 8, 6), M.makeTranslation(p[0], y + .99, p[2]), GOLD);
      if (inGap(gap, mid)) return; const n = Math.max(1, Math.floor((b - a) * rho / .3));
      for (let j = 1; j < n; j++) { const q = at(R, a + (b - a) * j / n, rho, y + .02); bals.push(M.compose(new THREE.Vector3(...q), Q, S1).clone()); }
      const arc = Array.from({ length: Math.max(3, Math.ceil((b - a) * rho / .25)) + 1 }, (_, j) => new THREE.Vector3(...at(R, a + (b - a) * j / Math.max(3, Math.ceil((b - a) * rho / .25)), rho, 0)));
      for (const [dy, r, c] of [[.88, .032, GOLD], [.04, .02, WOOD]]) add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), arc.length * 2, r, phone ? 4 : 6), M.makeTranslation(0, y + dy, 0), c); });
  }
  // the brass rail the rolling ladders hang on, `T.rail` m above a floor or walkway: one bar along each facet a little in front of the books (not behind our cases, nor across a door or arch)
  function brass(R, y, skip) { R.facets.forEach(F => { if (skip(F.i)) return; const a = [F.p0[0] + F.n[0] * .09, F.p0[1] + F.n[1] * .09], b = [F.p1[0] + F.n[0] * .09, F.p1[1] + F.n[1] * .09];
      add(new THREE.CylinderGeometry(.022, .022, F.w, 6).rotateZ(Math.PI / 2), M.makeRotationY(-Math.atan2(b[1] - a[1], b[0] - a[0])).setPosition((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2), GOLD); }); }
  // an arched hole's recess: jambs and soffit `d` deep behind the wall face, a dark back, a threshold
  function reveal(h) {
    const pts = archPts(h.P, h), c = h.c ?? h.P.facets[h.f].w / 2, F = h.P.facets[h.f], W = (u, y, o) => onFacet(h.P, h.f, u, y, o);
    for (let k = 0; k + 1 < pts.length; k++) { const [ua, ya] = pts[k], [ub, yb] = pts[k + 1], mu = (ua + ub) / 2 - c, my = Math.max(0, (ya + yb) / 2 - h.y - h.sp), l = Math.hypot(mu, my) || 1, tn = [(F.p1[0] - F.p0[0]) / F.w, (F.p1[1] - F.p0[1]) / F.w];
      quad(W(ua, ya, 0), W(ub, yb, 0), W(ub, yb, -h.d), W(ua, ya, -h.d), [-tn[0] * mu / l, -my / l, -tn[1] * mu / l], WOOD); }
    const sh = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u, y))), g = new THREE.ShapeGeometry(sh, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, ...W(p.getX(i), p.getY(i), -h.d - .005)); g.computeVertexNormals(); add(g, null, DARK);
    quad(W(c - h.hw, h.y + .004, .02), W(c + h.hw, h.y + .004, .02), W(c + h.hw, h.y + .004, -h.d), W(c - h.hw, h.y + .004, -h.d), [0, 1, 0], WOOD);
  }
  // a flat ring of the plan between two outlines (the hall's ceiling), seen from below
  function ceiling(L) { const sh = new THREE.Shape(L.P.corners.map(([x, z]) => new THREE.Vector2(x, -z))); sh.holes.push(new THREE.Path(plan.corners.map(([x, z]) => new THREE.Vector2(x, -z))));
    const [hx, hz, hr] = L.ceil.hole; sh.holes.push(new THREE.Path(new THREE.EllipseCurve(hx, -hz, hr, hr, 0, 2 * Math.PI, true).getPoints(40)));
    const g = new THREE.ShapeGeometry(sh, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), L.ceil.y, -p.getY(i)); g.computeVertexNormals(); add(g, null, WOOD);
    for (const [x, z, rr, tube] of [[plan.c[0], plan.c[1], T.a - .03, .07], [hx, hz, hr + .02, .06], [L.P.c[0], L.P.c[1], L.P.ri + T.deep - .1, .07]]) add(new THREE.TorusGeometry(rr, tube, 6, 96).rotateX(Math.PI / 2), M.makeTranslation(x, L.ceil.y - .05, z), GOLD); }  // gilt rims: where the tower rises, round the stair's opening, along the hall's wall
  // the oculus: a shallow cornice at the top of the wall and a gilt rim round the opening
  slab(plan, plan.r - .55, T.top, { top: false }); add(new THREE.TorusGeometry(plan.r - .58, .07, 6, 120).rotateX(Math.PI / 2), M.makeTranslation(plan.c[0], T.top - T.slab - T.fascia, plan.c[1]), GOLD);
  const floors = new Map(), fmat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Vector2(...plan.c) }, uA: { value: plan.T.a }, uRose: { value: 1 } }, fragmentShader: FLOOR,
    vertexShader: "varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }" });
  const floorGeo = (R, y, holes = []) => { const sh = new THREE.Shape(R.corners.map(([x, z]) => new THREE.Vector2(x, -z))); for (const [x, z, r] of holes) sh.holes.push(new THREE.Path(new THREE.EllipseCurve(x, -z, r, r, 0, 2 * Math.PI, true).getPoints(96)));
    const g = new THREE.ShapeGeometry(sh, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), y, -p.getY(i)); g.deleteAttribute("normal"); g.deleteAttribute("uv"); return g; };
  for (const L of levels) {
    const R = L.P, ri = R === plan ? plan.ri : R.ri, fl = new THREE.Mesh(floorGeo(R, L.y), R === plan ? fmat : fmat.clone()); if (R !== plan) { fl.material.uniforms.uC.value = new THREE.Vector2(...R.c); fl.material.uniforms.uA.value = R.ri + T.deep; fl.material.uniforms.uRose.value = 0; }  // the hall has its own stage in the middle
    fl.name = L.id === "home" ? "floor" : "floor_" + L.id; fl.userData.cut = (x, z, r) => { fl.geometry.dispose(); fl.geometry = floorGeo(R, L.y, [[x, z, r]]); }; fl.renderOrder = 1; floors.set(L.id, fl); group.add(fl);
    slab(R, ri, L.y - .02, { top: false });  // under the floor: one more ring from below
    for (const dy of L.tiers) { slab(R, ri, L.y + dy, { gap: L.gap }); rail(R, ri + .12, L.y + dy, L.gap); }
    const holeF = new Set((L.holes ?? []).map(h => h.f)), LD = T.ladders, tower = R === plan, wallAt = (f, y, o) => at(R, R.facets[f].phi, R.facets[f].a - o, y);  // the ladders and their rails
    brass(R, L.y + T.rail, f => tower ? f < 4 || f === plan.door : holeF.has(f)); if (tower) L.tiers.forEach(dy => brass(R, L.y + dy + T.rail, () => false));
    for (const f of tower ? LD.up : []) { const phi = R.facets[f].phi; ladder(0, at(R, phi, ri - .03 - 1.35, L.y), at(R, phi, ri - .03, L.y + T.tiers[0] + .93), phi); }  // up to the first walkway's railing
    for (const [base, list] of [[L.y, tower ? LD.floor : LD.hall], ...(tower ? L.tiers.map((dy, t) => [L.y + dy, LD.walks[t] ?? []]) : [])]) for (const f of list) { const phi = R.facets[f].phi; ladder(1, wallAt(f, base, .44), wallAt(f, base + T.rail, .09), phi); }
    if (L.ceil) ceiling(L);
    for (const h of L.holes ?? []) reveal(h);
    ends.push([P.length / 3, corbels.length, bals.length, lads[0].length, lads[1].length]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(Cl, 3));
  const wood = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a1609 })), woodI = new THREE.MeshLambertMaterial({ color: 0x9a6a38, emissive: 0x2e1a0a });  // emissive: the warm bounce under the balconies (never black)
  const iron = new THREE.MeshLambertMaterial({ color: 0x2c2018, emissive: 0x140b05 }), ladM = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a1609 });
  const inst = (geo, list, mat = woodI) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((x, i) => m.setMatrixAt(i, x)); return m; }, cm = inst(corbelG, corbels, iron), bm = inst(balG, bals), la = inst(ladderG(LA), lads[0], ladM), lb = inst(ladderG(LB), lads[1], ladM);
  for (const [m, n] of [[wood, "rotunda_wood"], [cm, "rotunda_brackets"], [bm, "rotunda_balusters"], [la, "rotunda_ladders"], [lb, "rotunda_ladders"]]) { m.name = n; m.frustumCulled = false; group.add(m); }
  return { group, floors, counts: { tris: P.length / 9, brackets: corbels.length, balusters: bals.length, ladders: lads[0].length + lads[1].length },
    show(y) { const k = Math.max(0, levels.findLastIndex(L => L.y >= y - .5)), e = ends[k]; g.setDrawRange(0, e[0]); cm.count = e[1]; bm.count = e[2]; la.count = e[3]; lb.count = e[4]; for (const [id, f] of floors) f.visible = levels[k].id === id; } };
}
