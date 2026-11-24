// cloth3d.js: loose clothes put on an already-rigged character at run time (its .glb untouched), moved by spring-bone chains (the VRM
// spring-bone method). A garment is a ring of chains of points hanging from one bone: each step a point keeps its speed (less drag), is
// pulled toward its rest shape in that bone's frame (stiff), falls (grav), keeps its length, and is pushed out of capsules fitted to the
// body's own skinned vertices, and above the floor. Fixed 1/120 s steps on the CPU, a few hundred points, one mesh, one draw call, nothing
// allocated per frame.
//
// Garments are data, lengths in H (the character's rest height), laid out on its rest (T) pose:
//   { kind: "skirt", top, waist: [x, z], hem: [x, z], to, chains, segs, tex }   top/to: waist ring and hem heights above the soles; bone: what it hangs from (hips);
//     gap: the share of the ring left open at her front (an overskirt parted over the one under it); shift: the rings moved to her front (a belly ahead of the bone)
//   { kind: "sleeve", side: "left"|"right", cuff, drop, chains, segs, tex }       a rigid tube on the upper arm + a hanging bell on the forearm
//   { kind: "ribbon", path: [spot, spot, ...], len, chains, segs, tex }            an open strip hung from a line of spots (2 or more), `chains` across, `len` down
//     spot: [bone, t, side, up, fwd]: t of the way from the bone's joint to its first child's, then moved in H (side = her left)
//     two-ended: to: [spot, ...], via: [side, up, fwd]: the strip runs from path to `to`, both pinned, sagging through the midpoint moved by via (a pibo behind the back)
//   any of them may set stiff, drag, grav (per step, see PHYS), float (a gentle breeze from her front, in g), over (1: kept outside every skirt listed before it), rigid,
//     vmax (top speed, H a second), bend (the sharpest turn between one link and the next, degrees: silk in S-curves), and a sleeve reach (how far its bell may swing out from the forearm, H)
//   two skirts make layers: the outer one sets over: 1
//   closed: 1 on a skirt (a sarong, a tube with no slit): a leg inside it pushes it out on the leg's outer and upper side, never between leg and body,
//     so a knee lifted into it carries the cloth over the knee; and the cloth keeps moving while only the legs move (a step up with the hips still)
//   tex: { src, rect: [x, y, w, h], mirror } a crop of a painted look sheet, or { color: "#hex" }; soft: share faded at the hem, edge: a trim colour
// const cloth = await dress(model, garments); then every frame, after the mixer: cloth.update(dt)
import * as THREE from "three";

const STEP = 1 / 120, MAXSTEPS = 8, SETTLE = 90, G = 6.1, MARGIN = 0.006, TAU = Math.PI * 2;  // G: 9.8 m/s2 for a 1.6 m person, in heights
const PHYS = { skirt: { chains: 14, segs: 7, stiff: 0.03, drag: 0.06, grav: 1 }, sleeve: { chains: 8, segs: 5, stiff: 0.04, drag: 0.08, grav: 1 }, ribbon: { chains: 4, segs: 10, stiff: 0.001, drag: 0.08, grav: 0.7, over: 1 } };
const BODY = [["leftUpperLeg", "rightUpperLeg", /^hips$/], ["spine", "neck", /^(spine|chest|upperChest)$/], ["neck", "HeadTop_End", /^(neck|head)$/],
  ...["left", "right"].flatMap(s => { const S = s[0].toUpperCase() + s.slice(1); return [
    [`${s}UpperLeg`, `${s}LowerLeg`, RegExp(`^${s}UpperLeg$`)], [`${s}LowerLeg`, `${s}Foot`, RegExp(`^${s}LowerLeg$`)], [`${s}Foot`, `${S}Toe_End`, RegExp(`^${s}(Foot|Toes)$`)],
    [`${s}UpperArm`, `${s}LowerArm`, RegExp(`^${s}UpperArm$`)], [`${s}LowerArm`, `${s}Hand`, RegExp(`^${s}LowerArm$`)], [`${s}Hand`, `${s}MiddleTip`, RegExp(`^${s}(Hand|Thumb|Index|Middle|Ring|Little)`)]]; })];

export async function dress(model, garments) {
  const skins = []; model.updateMatrixWorld(true); model.traverse(o => o.isSkinnedMesh && o.matrixWorld.determinant() !== 0 && skins.push(o));  // not a spare mood head stored at scale 0: its skinned points can be NaN (Zhinu's sad and happy heads)
  const bone = n => skins[0].skeleton.getBoneByName(n), V = () => new THREE.Vector3(), w = o => o.getWorldPosition(V());
  model.updateMatrixWorld(true);  // call before the first mixer update: the bones' loaded (T) pose is the rest everything is laid out on (not the skin's bind pose: packed files fold the dequantising scale into it)
  const box = new THREE.Box3(), byBone = new Map(), v = V();
  for (const m of skins) {  // the body as its vertices, sorted by the bone that moves each most
    const sw = m.geometry.attributes.skinWeight, si = m.geometry.attributes.skinIndex;
    for (let i = 0; i < sw.count; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); box.expandByPoint(v);
      let b = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, b)) b = j;
      const n = m.skeleton.bones[si.getComponent(i, b)].name; (byBone.get(n) ?? byBone.set(n, []).get(n)).push(v.clone());
    }
  }
  const H = box.max.y - box.min.y, scale0 = model.matrixWorld.getMaxScaleOnAxis(), line = new THREE.Line3(), q = V();
  const caps = BODY.filter(([a, b]) => bone(a) && bone(b)).map(([a, b, re]) => {  // radius: 80% of its own vertices lie within it, 60% for hips and legs
    line.set(w(bone(a)), w(bone(b))); const d = [...byBone].filter(([n]) => re.test(n)).flatMap(([, p]) => p.map(p => line.closestPointToPoint(p, true, q).distanceTo(p))).sort((x, y) => x - y);
    return { a: bone(a), b: bone(b), r: (d[Math.floor(d.length * 0.8)] ?? 0.02 * H) / H };  // a fitted body (legs apart to the ankle, cloth3d/REPORT.md); a skirt in the body mesh would fatten its thighs
  });
  const capR = n => caps.find(c => c.a.name === n)?.r ?? 0.03;
  const fwd = w(bone("leftToes")).sub(w(bone("leftFoot"))).setY(0).normalize(), up = new THREE.Vector3(0, 1, 0), side = V().crossVectors(up, fwd);
  const floorLocal = model.worldToLocal(V().set(0, box.min.y, 0)).y, fwdL = fwd.clone().transformDirection(model.matrixWorld.clone().invert());

  const sheets = [], ring = (c, ax, r1, r2, k, n) => {  // a point on the ellipse round c, square to ax: k of n, k = n/4 to the front
    const a = TAU * (k / n - 0.25), e1 = Math.abs(ax.y) > 0.9 ? side : V().crossVectors(ax, up).normalize(), e2 = V().crossVectors(e1, ax).normalize();
    if (e2.dot(fwd) < 0 && Math.abs(ax.y) > 0.9) e2.negate();
    return c.clone().addScaledVector(e2, Math.cos(a) * r2).addScaledVector(e1, Math.sin(a) * r1);
  };
  const sheet = (g, b, A, E, o) => {  // chains from anchors A to rest ends E, each in its bone's frame (b, or o.bs per chain); o.be: bones pinning each far end; o.curve(c, f): the rest shape
    const P = { ...PHYS[g.kind], ...g, ...o }, n = A.length, S = P.segs, bs = o.bs ?? A.map(() => b), curve = o.curve ?? ((c, f) => A[c].clone().lerp(E[c], f));
    if (o.c && V().subVectors(A[1], A[0]).cross(V().subVectors(E[0], A[0])).dot(V().subVectors(A[0], o.c)) < 0) { A.reverse(); E.reverse(); }  // outside faces out
    const anchor = new Float32Array(n * 3), seg = new Float32Array(n * (S + 1) * 3), len = new Float32Array(n * (S + 1)), row = new Float32Array(n * (S + 1)), ends = o.be && new Float32Array(n * 3);
    for (let c = 0; c < n; c++) {
      const inv = bs[c].matrixWorld.clone().invert(), m3 = new THREE.Matrix3().setFromMatrix4(inv);
      A[c].clone().applyMatrix4(inv).toArray(anchor, c * 3); if (ends) E[c].clone().applyMatrix4(o.be[c].matrixWorld.clone().invert()).toArray(ends, c * 3);
      for (let i = 1; i <= S; i++) { const d = curve(c, i / S).sub(curve(c, (i - 1) / S)); len[c * (S + 1) + i] = d.length() / H; d.applyMatrix3(m3).toArray(seg, (c * (S + 1) + i) * 3); }
      for (let i = 0; i <= S; i++) row[c * (S + 1) + i] = curve(c, i / S).distanceTo(curve((c + 1) % n, i / S)) / H;
    }
    const mask = Uint8Array.from(caps, c => g.kind !== "skirt" || !/Arm|Hand/.test(c.a.name));  // a skirt hangs inside the arms: they never push it
    sheets.push({ b, bs, be: o.be, ends, arm: o.arm ?? -1, cb: Math.cos((P.bend ?? 180) * Math.PI / 180), sb: Math.sin((P.bend ?? 180) * Math.PI / 180), n, S, P, anchor, seg, len, row, mask, rigid: !!(o.rigid ?? g.rigid), open: o.open ?? !o.c, skirt: g.kind === "skirt", band: garments.indexOf(g), v0: o.v0 ?? 0, v1: o.v1 ?? 1 });
  };
  for (const g of garments) {
    const P = { ...PHYS[g.kind], ...g };
    if (g.kind === "skirt") {
      const hips = bone(g.bone ?? "hips"), c = w(hips).addScaledVector(fwd, (g.shift ?? 0) * H), gap = g.gap ?? 0, y0 = box.min.y + (g.top ?? (c.y - box.min.y) / H) * H, y1 = box.min.y + (g.to ?? 0.01) * H, wa = g.waist ?? [0.09, 0.075], he = g.hem ?? [0.2, 0.17];
      const at = y => V().set(c.x, y, c.z), A = [], E = [];
      for (let j = 0; j < P.chains; j++) { const k = gap ? P.chains * (0.25 + gap / 2 + (1 - gap) * j / (P.chains - 1)) : j; A.push(ring(at(y0), up.clone().negate(), wa[0] * H, wa[1] * H, k, P.chains)); E.push(ring(at(y1), up.clone().negate(), he[0] * H, he[1] * H, k, P.chains)); }
      sheet(g, hips, A, E, { c: at(y0), open: gap > 0 });
    } else if (g.kind === "sleeve") {
      const s = g.side ?? "left", ua = bone(`${s}UpperArm`), la = bone(`${s}LowerArm`), p0 = w(ua), p1 = w(la), p2 = w(bone(`${s}Hand`)), p3 = w(bone(`${s}MiddleTip`) ?? bone(`${s}Hand`));
      const a1 = V().subVectors(p1, p0).normalize(), a2 = V().subVectors(p2, p1).normalize(), r0 = (capR(`${s}UpperArm`) + 0.012) * H, r1 = (capR(`${s}LowerArm`) + 0.03) * H;
      const cuff = (g.cuff ?? 0.09) * H, drop = (g.drop ?? 0.14) * H, n = P.chains;
      const A1 = [], E1 = [], A2 = [], E2 = [], c1 = p0.clone().addScaledVector(a1, 0.04 * H), c2 = p1.clone().addScaledVector(a2, -0.02 * H), e2 = p3.clone().addScaledVector(a2, 0.02 * H);
      for (let k = 0; k < n; k++) {
        A1.push(ring(c1, a1, r0, r0, k, n)); E1.push(ring(p1.clone().addScaledVector(a1, 0.02 * H), a1, r1, r1, k, n));
        const a = ring(c2, a2, r1, r1, k, n), e = ring(e2, a2, cuff, cuff, k, n), down = Math.max(0, -V().subVectors(e, e2).normalize().y);
        A2.push(a); E2.push(e.addScaledVector(up, -drop * down * down));  // the underside hangs: the bag of a wide sleeve
      }
      sheet(g, ua, A1, E1, { c: c1, rigid: true, segs: 2, v0: 0, v1: 0.3 });
      sheet(g, la, A2, E2, { c: c2, v0: 0.3, v1: 1, arm: caps.findIndex(c => c.a === la) });
    } else if (g.kind === "ribbon") {
      const spot = ([nm, t = 0, x = 0, y = 0, z = 0]) => { const b = bone(nm), ch = b.children.find(o => o.isBone), p = w(b); if (t && ch) p.lerp(w(ch), t);
        return { b, p: p.addScaledVector(side, x * H).addScaledVector(up, y * H).addScaledVector(fwd, z * H) }; };
      const line = path => {  // P.chains points evenly along the spots, each on the bone of the nearer spot
        const q = path.map(spot), L = [0]; for (let i = 1; i < q.length; i++) L.push(L[i - 1] + q[i].p.distanceTo(q[i - 1].p));
        return Array.from({ length: P.chains }, (_, c) => { const d = L.at(-1) * c / (P.chains - 1); let i = 1; while (i < q.length - 1 && L[i] < d) i++;
          const f = (d - L[i - 1]) / (L[i] - L[i - 1] || 1); return { b: (f < 0.5 ? q[i - 1] : q[i]).b, p: q[i - 1].p.clone().lerp(q[i].p, f) }; });
      };
      const A = line(g.path), Z = g.to && line(g.to), E = Z ? Z.map(z => z.p) : A.map(a => a.p.clone().addScaledVector(up, -(g.len ?? 0.4) * H));
      const via = g.via ?? [0, -0.3, -0.2], K = A.map((a, c) => a.p.clone().lerp(E[c], 0.5).addScaledVector(side, via[0] * H).addScaledVector(up, via[1] * H).addScaledVector(fwd, via[2] * H));
      sheet(g, A[0].b, A.map(a => a.p), E, { bs: A.map(a => a.b), be: Z?.map(z => z.b), curve: Z && ((c, f) => A[c].p.clone().multiplyScalar((1 - f) ** 2).addScaledVector(K[c], 2 * f * (1 - f)).addScaledVector(E[c], f * f)) });
    }
  }

  // the state: world positions now and one step ago, per point; the mesh in the model's own space, a seam column per ring
  let np = 0, nv = 0; for (const s of sheets) { s.p0 = np; s.v = nv; np += s.n * (s.S + 1); nv += (s.n + 1) * (s.S + 1); }
  const cur = new Float32Array(np * 3), old = new Float32Array(np * 3), A0 = new Float32Array(np * 3), A1 = new Float32Array(np * 3), C0 = new Float32Array(caps.length * 6), C1 = new Float32Array(caps.length * 6);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), shade = new Float32Array(nv), idx = [];
  for (const s of sheets) for (let c = 0; c <= s.n; c++) for (let i = 0; i <= s.S; i++) {
    const k = s.v + c * (s.S + 1) + i; uv[k * 2] = c / (s.open ? s.n - 1 : s.n); uv[k * 2 + 1] = 1 - (s.band + 0.02 + 0.96 * (s.v0 + (s.v1 - s.v0) * i / s.S)) / garments.length; shade[k] = s.open ? 0.85 : 0.6;
    if (c < s.n - (s.open ? 1 : 0) && i < s.S) idx.push(k, k + s.S + 1, k + 1, k + 1, k + s.S + 1, k + s.S + 2);
  }
  const geo = new THREE.BufferGeometry().setIndex(idx); geo.setAttribute("shade", new THREE.BufferAttribute(shade, 1));
  for (const [n, a, d] of [["position", pos, 3], ["normal", nor, 3], ["uv", uv, 2]]) geo.setAttribute(n, new THREE.BufferAttribute(a, d).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, transparent: true, alphaTest: 0.04, roughness: 0.9 });
  mat.onBeforeCompile = sh => {  // the inside of a robe is in its own shade; a ribbon's back nearly as bright as its front
    sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute float shade; varying float vShade;\nvoid main() { vShade = shade;");
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", "varying float vShade;\nvoid main() {").replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= gl_FrontFacing ? 1.0 : vShade;");
  };
  const mesh = Object.assign(new THREE.Mesh(geo, mat), { name: "cloth3d", castShadow: true, receiveShadow: true, frustumCulled: false });
  model.add(mesh); mat.map = await atlas(garments);

  const M = new THREE.Matrix4(), inv = new THREE.Matrix4(), e = M.elements, tmp = V(), root0 = V(), root1 = V(), face0 = V(), face1 = V(), fwdW = V(), sideW = V();
  const skirts = sheets.filter(s => s.skirt); for (const r of skirts) r.ring = new Float32Array((r.S + 1) * 5);
  let acc = 0, ready = false, k = 1, floor = 0, tSim = 0;
  const frame = (dst, cdst) => {  // anchors and capsule ends at the body's pose now
    for (const s of sheets) for (let c = 0; c < s.n; c++) {
      tmp.fromArray(s.anchor, c * 3).applyMatrix4(s.bs[c].matrixWorld).toArray(dst, (s.p0 + c * (s.S + 1)) * 3);
      if (s.ends) tmp.fromArray(s.ends, c * 3).applyMatrix4(s.be[c].matrixWorld).toArray(dst, (s.p0 + c * (s.S + 1) + s.S) * 3);
    }
    for (let j = 0; j < caps.length; j++) { caps[j].a.getWorldPosition(tmp).toArray(cdst, j * 6); caps[j].b.getWorldPosition(tmp).toArray(cdst, j * 6 + 3); }
  };
  const rest = s => {  // a sheet in its rest shape on the bone as it is now: all of a rigid one, every frame; all of any one on a reset
    if (s.ends) { const [x, y, z] = s.P.via ?? [0, -0.3, -0.2];  // a two-ended strip: sagging between its pinned ends through via, to her side, up and front as she stands now (never laid through her)
      for (let c = 0; c < s.n; c++) { const a = (s.p0 + c * (s.S + 1)) * 3, b = a + s.S * 3;
        for (let d = 0; d < 3; d++) { const m = (cur[a + d] + cur[b + d]) / 2 + (sideW.getComponent(d) * x + (d === 1) * y + fwdW.getComponent(d) * z) * H * k;
          for (let i = 1; i < s.S; i++) { const t = i / s.S; cur[a + i * 3 + d] = (1 - t) ** 2 * cur[a + d] + 2 * t * (1 - t) * m + t * t * cur[b + d]; } } }
      return; }
    for (let c = 0; c < s.n; c++) for (let i = 1; i <= s.S; i++) { if (i === 1) M.copy(s.bs[c].matrixWorld); const q = (c * (s.S + 1) + i) * 3, p = s.p0 * 3 + q, j = p - 3, x = s.seg[q], y = s.seg[q + 1], z = s.seg[q + 2];
      cur[p] = cur[j] + e[0] * x + e[4] * y + e[8] * z; cur[p + 1] = cur[j + 1] + e[1] * x + e[5] * y + e[9] * z; cur[p + 2] = cur[j + 2] + e[2] * x + e[6] * y + e[10] * z; }
  };
  const push = (p, f, s) => {  // out of every capsule (its ends f of the way from last frame's pose to this one's), out of the skirts before it, then above the floor
    for (let j = 0; j < caps.length; j++) {
      if (!s.mask[j]) continue; const o = j * 6, ax = C0[o] + (C1[o] - C0[o]) * f, ay = C0[o + 1] + (C1[o + 1] - C0[o + 1]) * f, az = C0[o + 2] + (C1[o + 2] - C0[o + 2]) * f;
      const bx = C0[o + 3] + (C1[o + 3] - C0[o + 3]) * f - ax, by = C0[o + 4] + (C1[o + 4] - C0[o + 4]) * f - ay, bz = C0[o + 5] + (C1[o + 5] - C0[o + 5]) * f - az;
      const t = Math.min(1, Math.max(0, ((cur[p] - ax) * bx + (cur[p + 1] - ay) * by + (cur[p + 2] - az) * bz) / (bx * bx + by * by + bz * bz || 1)));
      const dx = cur[p] - ax - bx * t, dy = cur[p + 1] - ay - by * t, dz = cur[p + 2] - az - bz * t, d = Math.hypot(dx, dy, dz), R = (caps[j].r + MARGIN) * H * k;
      if (d < R && d > 1e-9 && s.P.closed && /Leg$/.test(caps[j].a.name) && !/UpperLeg$/.test(caps[j].b.name)) {  // closed: 1 (a sarong): out on the leg's OUTER side, away from her middle and up, so a knee lifted into the tube carries the cloth over it instead of coming through
        const a = (s.p0 + Math.floor((p / 3 - s.p0) / (s.S + 1)) * (s.S + 1)) * 3, m = s.b.matrixWorld.elements, bl = Math.hypot(bx, by, bz) || 1;
        let ux = cur[a] - m[12], uz = cur[a + 2] - m[14]; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul; let uy = 0.6;
        const ub = (ux * bx + uy * by + uz * bz) / bl; ux -= bx / bl * ub; uy -= by / bl * ub; uz -= bz / bl * ub; const un = Math.hypot(ux, uy, uz);
        if (un > 1e-3 && dx * ux + dy * uy + dz * uz < 0) { cur[p] = ax + bx * t + ux / un * R; cur[p + 1] = ay + by * t + uy / un * R; cur[p + 2] = az + bz * t + uz / un * R; }
        else { cur[p] += dx * (R / d - 1); cur[p + 1] += dy * (R / d - 1); cur[p + 2] += dz * (R / d - 1); }
      } else if (d < R && d > 1e-9) { cur[p] += dx * (R / d - 1); cur[p + 1] += dy * (R / d - 1); cur[p + 2] += dz * (R / d - 1); }
      else if (j === s.arm && s.P.reach && d > s.P.reach * H * k) { const g = 1 - s.P.reach * H * k / d; cur[p] -= dx * g; cur[p + 1] -= dy * g; cur[p + 2] -= dz * g; }  // a sleeve's bell no further out from its forearm than reach
    }
    if (s.P.over) for (const r of skirts) {  // shortcut: a skirt is its ring of each row last step (centre, and its half-widths to her side and front), not its triangles; enough for cloth that lies over it
      if (r === s || r.band >= s.band) break; const R = r.ring, py = cur[p + 1], mg = MARGIN * 2 * H * k;
      for (let i = 0; i < r.S; i++) { const o = i * 5, y0 = R[o + 1], y1 = R[o + 6]; if (py > y0 || py < y1) continue;
        const t = (y0 - py) / (y0 - y1 || 1), cx = R[o] + (R[o + 5] - R[o]) * t, cz = R[o + 2] + (R[o + 7] - R[o + 2]) * t, ra = R[o + 3] + (R[o + 8] - R[o + 3]) * t + mg, rb = R[o + 4] + (R[o + 9] - R[o + 4]) * t + mg;
        const dx = cur[p] - cx, dz = cur[p + 2] - cz, q = Math.hypot((dx * sideW.x + dz * sideW.z) / ra, (dx * fwdW.x + dz * fwdW.z) / rb);
        if (q < 1 && q > 1e-6) { cur[p] = cx + dx / q; cur[p + 2] = cz + dz / q; } break; }
    }
    if (cur[p + 1] < floor) { cur[p + 1] = floor; old[p] += (cur[p] - old[p]) * 0.5; old[p + 2] += (cur[p + 2] - old[p + 2]) * 0.5; old[p + 1] = floor; }  // the hem rests on the floor and stops sliding
  };
  const rings = () => { for (const r of skirts) for (let i = 0; i <= r.S; i++) {  // each skirt row: centre, and half-widths to her side and front (an ellipse's are root-2 times its RMS)
    let x = 0, y = 0, z = 0, a = 0, b = 0; for (let c = 0; c < r.n; c++) { const p = (r.p0 + c * (r.S + 1) + i) * 3; x += cur[p]; y += cur[p + 1]; z += cur[p + 2]; }
    x /= r.n; y /= r.n; z /= r.n; for (let c = 0; c < r.n; c++) { const p = (r.p0 + c * (r.S + 1) + i) * 3, dx = cur[p] - x, dz = cur[p + 2] - z; a += (dx * sideW.x + dz * sideW.z) ** 2; b += (dx * fwdW.x + dz * fwdW.z) ** 2; }
    r.ring.set([x, y, z, Math.sqrt(2 * a / r.n), Math.sqrt(2 * b / r.n)], i * 5);
  } };
  const rope = s => {  // a strip pinned at both ends, four passes: every link at most its rest length; with bend, every point's two neighbours kept far enough apart that it turns no sharper; the pinned ends do not move
    const sp = Math.sqrt((1 + s.cb) / 2);
    for (let it = 0; it < 4; it++) for (let c = 0; c < s.n; c++) {
      for (let i = 1; i <= s.S; i++) {
        const p = (s.p0 + c * (s.S + 1) + i) * 3, j = p - 3, wj = i > 1 ? 1 : 0, wp = i < s.S ? 1 : 0, dx = cur[p] - cur[j], dy = cur[p + 1] - cur[j + 1], dz = cur[p + 2] - cur[j + 2], d = Math.hypot(dx, dy, dz), L = s.len[c * (s.S + 1) + i] * H * k;
        if (d > L) { const h = (d - L) / d / (wj + wp); cur[j] += dx * h * wj; cur[j + 1] += dy * h * wj; cur[j + 2] += dz * h * wj; cur[p] -= dx * h * wp; cur[p + 1] -= dy * h * wp; cur[p + 2] -= dz * h * wp; }
      }
      if (s.cb > -1) for (let i = 1; i < s.S; i++) {
        const a = (s.p0 + c * (s.S + 1) + i - 1) * 3, b = a + 6, wa = i > 1 ? 1 : 0, wb = i + 1 < s.S ? 1 : 0, dx = cur[b] - cur[a], dy = cur[b + 1] - cur[a + 1], dz = cur[b + 2] - cur[a + 2], d = Math.hypot(dx, dy, dz);
        const m = (s.len[c * (s.S + 1) + i] + s.len[c * (s.S + 1) + i + 1]) * H * k * sp;
        if (d < m && d > 1e-9 && wa + wb) { const h = (m - d) / d / (wa + wb); cur[a] -= dx * h * wa; cur[a + 1] -= dy * h * wa; cur[a + 2] -= dz * h * wa; cur[b] += dx * h * wb; cur[b + 1] += dy * h * wb; cur[b + 2] += dz * h * wb; }
      }
    }
  };
  const smooth = s => {  // no link turns more than bend from the one before it, from the anchor down (one-ended strips; rope() bends a two-ended one)
    for (let c = 0; c < s.n; c++) for (let i = 2; i <= s.S; i++) {
      const p = (s.p0 + c * (s.S + 1) + i) * 3, j = p - 3, h = p - 6, ax = cur[j] - cur[h], ay = cur[j + 1] - cur[h + 1], az = cur[j + 2] - cur[h + 2], la = Math.hypot(ax, ay, az) || 1;
      const bx = cur[p] - cur[j], by = cur[p + 1] - cur[j + 1], bz = cur[p + 2] - cur[j + 2], lb = Math.hypot(bx, by, bz) || 1, cs = (ax * bx + ay * by + az * bz) / (la * lb);
      if (cs >= s.cb) continue;
      const ux = ax / la, uy = ay / la, uz = az / la, px = bx / lb - ux * cs, py = by / lb - uy * cs, pz = bz / lb - uz * cs, lp = Math.hypot(px, py, pz);
      if (lp < 1e-6) { cur[p] = cur[j] + ux * lb; cur[p + 1] = cur[j + 1] + uy * lb; cur[p + 2] = cur[j + 2] + uz * lb; continue; }  // folded straight back: lay it on along the link before
      cur[p] = cur[j] + (ux * s.cb + px / lp * s.sb) * lb; cur[p + 1] = cur[j + 1] + (uy * s.cb + py / lp * s.sb) * lb; cur[p + 2] = cur[j + 2] + (uz * s.cb + pz / lp * s.sb) * lb;
    }
  };
  let settling = false;
  const step = f => {
    if (!settling) tSim += STEP; if (skirts.length) rings();
    for (const s of sheets) {
      for (let c = 0; c < s.n; c++) for (let n = 0; n <= (s.ends ? s.S : 0); n += s.S) { const a = (s.p0 + c * (s.S + 1) + n) * 3; for (let d = 0; d < 3; d++) old[a + d] = cur[a + d] = A0[a + d] + (A1[a + d] - A0[a + d]) * f; }
      if (s.rigid) { rest(s); continue; }
      const { stiff, drag, grav, float: fl = 0 } = s.P, gy = -G * grav * H * k * STEP * STEP, fb = fl * G * H * k * STEP * STEP, last = s.S - (s.ends ? 1 : 0), vm = (s.P.vmax ?? Infinity) * H * k * STEP;
      for (let c = 0; c < s.n; c++) { M.copy(s.bs[c].matrixWorld); for (let i = 1; i <= last; i++) {
        const q = (c * (s.S + 1) + i) * 3, p = s.p0 * 3 + q, j = p - 3, x = s.seg[q], y = s.seg[q + 1], z = s.seg[q + 2], b = fb * (settling ? 0.7 : 0.7 + 0.02 * Math.sin(tSim * 1.1 + c * 0.6 + i * 0.15));  // b: steady gentle lift from her front, calm when she stands still
        const tx = cur[j] + e[0] * x + e[4] * y + e[8] * z, ty = cur[j + 1] + e[1] * x + e[5] * y + e[9] * z, tz = cur[j + 2] + e[2] * x + e[6] * y + e[10] * z;
        let vx = (cur[p] - old[p]) * (1 - drag), vy = (cur[p + 1] - old[p + 1]) * (1 - drag), vz = (cur[p + 2] - old[p + 2]) * (1 - drag); const v = Math.hypot(vx, vy, vz);
        if (v > vm) { vx *= vm / v; vy *= vm / v; vz *= vm / v; }  // no faster than vmax: silk drifts
        const nx = cur[p] + vx + (tx - cur[p]) * stiff - fwdW.x * b, ny = cur[p + 1] + vy + (ty - cur[p + 1]) * stiff + gy + 0.3 * b, nz = cur[p + 2] + vz + (tz - cur[p + 2]) * stiff - fwdW.z * b;
        old[p] = cur[p]; old[p + 1] = cur[p + 1]; old[p + 2] = cur[p + 2];
        if (s.ends) { cur[p] = nx; cur[p + 1] = ny; cur[p + 2] = nz; continue; }  // its lengths are kept by rope() below
        const dx = nx - cur[j], dy = ny - cur[j + 1], dz = nz - cur[j + 2], L = s.len[q / 3] * H * k / (Math.hypot(dx, dy, dz) || 1);
        cur[p] = cur[j] + dx * L; cur[p + 1] = cur[j + 1] + dy * L; cur[p + 2] = cur[j + 2] + dz * L; push(p, f, s);
      } }
      if (s.ends) rope(s);
      for (let i = 1; i <= last; i++) for (let c = 0; c < s.n - (s.open ? 1 : 0); c++) {  // neighbouring chains stretch apart at most 1.4 times
        const q = c * (s.S + 1) + i, p = (s.p0 + q) * 3, r = (s.p0 + ((c + 1) % s.n) * (s.S + 1) + i) * 3, dx = cur[r] - cur[p], dy = cur[r + 1] - cur[p + 1], dz = cur[r + 2] - cur[p + 2], d = Math.hypot(dx, dy, dz), m = s.row[q] * H * k * 1.4;
        if (d > m) { const h = (1 - m / d) / 2; cur[p] += dx * h; cur[p + 1] += dy * h; cur[p + 2] += dz * h; cur[r] -= dx * h; cur[r + 1] -= dy * h; cur[r + 2] -= dz * h; }
      }
      for (let c = 0; c < s.n; c++) for (let i = 1; i <= last; i++) push((s.p0 + c * (s.S + 1) + i) * 3, f, s);
      if (s.cb > -1) s.ends ? rope(s) : smooth(s);  // bend last, after the pushes: silk curves, never kinks
    }
  };
  const at = (s, c, i) => (s.v + c * (s.S + 1) + i) * 3;
  const write = () => {  // the mesh, in the model's space: positions, then normals across and down each sheet
    inv.copy(model.matrixWorld).invert();
    for (const s of sheets) for (let c = 0; c <= s.n; c++) for (let i = 0; i <= s.S; i++) tmp.fromArray(cur, (s.p0 + (c % s.n) * (s.S + 1) + i) * 3).applyMatrix4(inv).toArray(pos, (s.v + c * (s.S + 1) + i) * 3);
    for (const s of sheets) for (let c = 0; c <= s.n; c++) for (let i = 0; i <= s.S; i++) {
      const k0 = at(s, c, i), cl = at(s, c === 0 ? (s.open ? 0 : s.n - 1) : c - 1, i), cr = at(s, s.open ? Math.min(c + 1, s.n - 1) : c === s.n ? 1 : c + 1, i), iu = at(s, c, Math.max(0, i - 1)), id = at(s, c, Math.min(s.S, i + 1));
      const ux = pos[cr] - pos[cl], uy = pos[cr + 1] - pos[cl + 1], uz = pos[cr + 2] - pos[cl + 2], vx = pos[id] - pos[iu], vy = pos[id + 1] - pos[iu + 1], vz = pos[id + 2] - pos[iu + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; nor[k0] = nx / l; nor[k0 + 1] = ny / l; nor[k0 + 2] = nz / l;
    }
    geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = true;
  };
  let still = 0; const legs = garments.some(g => g.closed) ? caps.flatMap((c, j) => /Leg$/.test(c.a.name) && !/UpperLeg$/.test(c.b.name) ? [j] : []) : [];  // only with a closed skirt: every other garment is unchanged
  const cloth = {
    mesh, caps, H, sheets, cur, steps: 0,
    update(dt) {
      model.updateWorldMatrix(true, true); k = model.matrixWorld.getMaxScaleOnAxis() / scale0; floor = tmp.set(0, floorLocal, 0).applyMatrix4(model.matrixWorld).y + MARGIN * H * k;
      fwdW.copy(fwdL).transformDirection(model.matrixWorld).setY(0).normalize(); sideW.set(fwdW.z, 0, -fwdW.x);  // her front and left now, level
      frame(A1, C1); model.getWorldPosition(root1); face1.setFromMatrixColumn(model.matrixWorld, 2).normalize();
      if (!ready || dt > 0.5 || root1.distanceTo(root0) > 0.5 * H * k || face1.dot(face0) < 0.5) {  // first frame, a long pause, a jump across the page or a snap round by over 60 degrees: start from rest
        A0.set(A1); C0.set(C1); cur.set(A1); for (const s of sheets) rest(s); old.set(cur); acc = 0; still = 1; ready = true;
        for (let j = 0; j < SETTLE; j++) step(1); old.set(cur);  // let it hang before it is first drawn: never seen falling from its T-pose shape
      }
      let mv = 0;
      for (let i = 0; i < A1.length; i += 3) mv = Math.max(mv, Math.hypot(A1[i] - A0[i], A1[i + 1] - A0[i + 1], A1[i + 2] - A0[i + 2]));
      for (const j of legs) for (let i = j * 6; i < j * 6 + 6; i += 3) mv = Math.max(mv, Math.hypot(C1[i] - C0[i], C1[i + 1] - C0[i + 1], C1[i + 2] - C0[i + 2]));  // a knee lifted with the hips still (a step up, sitting) is not standing still
      still = mv < 0.004 * H * k ? still + Math.max(0, dt) : 0;
      acc = Math.min(acc + Math.max(0, dt), MAXSTEPS * STEP); const n = Math.floor(acc / STEP + 1e-6); acc -= n * STEP;
      if (still < 0.16) {
        settling = still > 0.02;
        for (let j = 1; j <= n; j++) {
          step(j / n);
          if (settling) for (let s = 0; s < 4; s++) step(1);  // smooth damped settle to rest before 0.45 s with full drag and vmax intact
        }
        settling = false;
      } else old.set(cur);
      cloth.steps += n; A0.set(A1); C0.set(C1); root0.copy(root1); face0.copy(face1); write();
    },
    dispose() { model.remove(mesh); geo.dispose(); mat.map?.dispose(); mat.dispose(); },
  };
  return cloth;
}

async function atlas(garments) {  // one painted band per garment, stacked: the hem of each fades out
  const W = 512, B = 256, cv = Object.assign(document.createElement("canvas"), { width: W, height: B * garments.length }), x = cv.getContext("2d"), img = {};
  for (const [j, g] of garments.entries()) {
    const t = g.tex ?? {}, y = j * B;
    if (t.src) {
      const im = img[t.src] ??= await new Promise((ok, no) => Object.assign(new Image(), { onload() { ok(this); }, onerror: no, src: t.src }));
      const [rx, ry, rw, rh] = t.rect ?? [0, 0, im.width, im.height];
      if (t.mirror) { x.drawImage(im, rx, ry, rw, rh, 0, y, W / 2, B); x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(im, rx, ry, rw, rh, 0, y, W / 2, B); x.restore(); }
      else x.drawImage(im, rx, ry, rw, rh, 0, y, W, B);
    } else { x.fillStyle = t.color ?? "#e8a9a0"; x.fillRect(0, y, W, B); }
    const s = t.soft ?? 0.06; if (t.edge) { x.fillStyle = t.edge; x.fillRect(0, y + B * (0.92 - s), W, B * 0.08); }  // a trim band at the hem
    const f = x.createLinearGradient(0, y + B * (1 - s), 0, y + B); f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out"; x.fillStyle = f; x.fillRect(0, y + B * (1 - s), W, B * s); x.globalCompositeOperation = "source-over";
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
