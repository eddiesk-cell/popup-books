// motion.js: what makes the action lab's fighters move like people, not puppets.
//  - timeline: clips play as segments on story time s; each change cross-fades (0.1-0.25 s), may start the new clip at the frame whose feet match
//    the old one's (match), and places the new clip where the old one left the feet, so travel comes from the clips' own root motion (no sliding).
//  - look: the head (and a share of the neck) turns to the foe; hit: a blow bends spine, chest and head away from where it came from, as a
//    damped kick; grip: the fused fingers close round the staff.
//  - springs: the staff's ends and Kapi's tail lag and settle; they are the only state, stepped with s (a pause holds, a jump back rests them).
import * as THREE from "three";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sstep = k => k * k * (3 - 2 * k), rad = d => d * Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _r = new THREE.Quaternion();
const I = new THREE.Quaternion();

export function turnWorld(bone, q) {  // the bone's world rotation becomes q times what it was, about its own joint
  bone.parent.getWorldQuaternion(_p); _r.copy(_p).invert().multiply(q).multiply(_p); bone.quaternion.premultiply(_r); bone.updateMatrixWorld(true);
}

export class Spring {  // a point that follows its target like a damped spring (hz, zeta); s is story time
  static off = false;  // set while a slice re-poses the past (a brush smear): targets come back as they are and no state moves
  constructor(hz = 3, zeta = 0.5) { this.w = 2 * Math.PI * hz; this.z = zeta; this.x = new THREE.Vector3(); this.v = new THREE.Vector3(); this.s = null; }
  at(target, s) {
    if (Spring.off) return target;
    const dt = this.s == null ? -1 : s - this.s; this.s = s;
    if (dt === 0) return this.x;
    if (!(dt > 0 && dt < 0.1)) { this.x.copy(target); this.v.set(0, 0, 0); return this.x; }
    for (let n = Math.ceil(dt * 240), h = dt / n, i = 0; i < n; i++) {
      _u.subVectors(target, this.x).multiplyScalar(this.w * this.w).addScaledVector(this.v, -2 * this.z * this.w); this.v.addScaledVector(_u, h); this.x.addScaledVector(this.v, h);
    }
    return this.x;
  }
}

// segs: [{ t, clip, from = 0, rate = 1, map(s) -> clip time, fade = 0.15, p: [x, z] (else placed where the last one left the feet), yaw (deg),
//          turn (deg, added to the last yaw: turned on the spot over turnDur s once the fade is done), y, match (s: search the new clip's first
//          `match` seconds for the frame whose feet match) }]. A chained segment is placed without extra: keep extra continuous across it.
// extra(s) -> { x, y, z, pitch, yaw, roll }: code-made moves on top (a flight's arc, a flip); place(y0) is the floor height.
export function timeline(a, segs, extra, y0 = 0) {
  const ct = (S, s) => (S.map ? S.map(s) : (S.from ?? 0) + (s - S.t) * (S.rate ?? 1));
  const time = (S, x) => { const d = a.clips[S.clip].duration; return (S.loop ?? a.loop?.has(S.clip)) ? ((x % d) + d) % d : clamp(x, 0, d - 1e-4); };
  const put = (R, e) => { a.body.position.set(R.x + (e?.x ?? 0), y0 + R.y + (e?.y ?? 0), R.z + (e?.z ?? 0)); a.body.rotation.set(rad(e?.pitch ?? 0), rad(R.yaw + (e?.yaw ?? 0)), rad(e?.roll ?? 0), "YXZ"); };
  const one = (S, x, R) => { for (const k in a.act) a.act[k].weight = 0; const A = a.act[S.clip]; A.weight = 1; A.time = time(S, x); a.mix.update(0); put(R); a.body.updateMatrixWorld(true); };
  const feet = () => a.bone("leftFoot").getWorldPosition(_v).add(a.bone("rightFoot").getWorldPosition(_w)).multiplyScalar(0.5).clone();
  const fvec = () => a.bone("leftFoot").getWorldPosition(_v).sub(a.bone("rightFoot").getWorldPosition(_w)).clone();
  for (const S of segs) if (!a.clips[S.clip]) throw new Error(`timeline: no clip ${S.clip} (have ${Object.keys(a.clips)})`);
  const roots = [];
  segs.forEach((S, i) => {
    const P = segs[i - 1], R = roots[i - 1];
    if (S.p) { const y0 = S.yaw ?? R?.yaw ?? 0; roots[i] = { x: S.p[0], z: S.p[1], yaw0: y0, yaw: y0 + (S.turn ?? 0), y: S.y ?? 0 }; return; }
    const yaw = S.yaw ?? R.yaw;  // placed facing as before; a turn comes after the fade, on the spot
    one(P, ct(P, S.t), R); const F = feet(), d0 = fvec();
    if (S.match) {  // the frame of the new clip whose feet stand most like the old one's
      let best = Infinity, from = S.from ?? 0;
      for (let c = from; c <= from + S.match; c += 1 / 30) { one({ ...S, map: null, from: c }, S.t, { x: 0, z: 0, yaw, y: R.y }); const e = fvec().distanceTo(d0); if (e < best) { best = e; S.from = c; } }
    }
    one(S, ct(S, S.t), { x: 0, z: 0, yaw, y: R.y }); const G = feet();
    roots[i] = { x: F.x - G.x, z: F.z - G.z, yaw0: yaw, yaw: yaw + (S.turn ?? 0), y: S.y ?? R.y };
  });
  const idx = s => { let i = 0; while (i < segs.length - 1 && segs[i + 1].t <= s) i++; return i; };
  const yawAt = (i, s) => { const S = segs[i], R = roots[i]; return R.yaw0 + (R.yaw - R.yaw0) * sstep(clamp((s - S.t - (S.fade ?? 0.15)) / (S.turnDur ?? 0.5))); };  // a segment's own turn, as far as it has gone at s
  const tl = {
    segs, roots,
    shift(dx, dz) { for (const R of roots) { R.x += dx; R.z += dz; } },
    at(s) {
      const i = idx(s), S = segs[i], P = segs[i - 1], w = P && (S.fade ?? 0.15) > 0 && P.clip !== S.clip ? sstep(clamp((s - S.t) / (S.fade ?? 0.15))) : 1;
      for (const k in a.act) a.act[k].weight = 0;
      if (w < 1) { const B = a.act[P.clip]; B.weight = 1 - w; B.time = time(P, ct(P, s)); }
      const A = a.act[S.clip]; A.weight = w; A.time = time(S, ct(S, s)); a.mix.update(0);
      const R0 = roots[i], R1 = w < 1 ? roots[i - 1] : R0, y1 = w < 1 ? yawAt(i - 1, s) : 0;
      const R = { x: R1.x + (R0.x - R1.x) * w, z: R1.z + (R0.z - R1.z) * w, y: R1.y + (R0.y - R1.y) * w, yaw: y1 + (yawAt(i, s) - y1) * w };
      put(R, extra?.(s)); a.body.updateMatrixWorld(true);  // the caller runs a.post(s) once both fighters stand where they stand (each looks at the other)
    },
  };
  return tl;
}

// the after-pose layer: look, hit reactions, grips (and, through a.springs, whatever else lags)
export function rig(a) {
  a.body.updateMatrixWorld(true);
  const head = a.bone("head"), neck = a.bone("neck"), face = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(_q).invert());  // loaded facing +Z
  const fingers = {};
  for (const [side, sg] of [["right", 1], ["left", -1]]) {  // the T-pose hand: fingers out along -X (right) or +X (left), palm down; a curl turns them about +-Z
    fingers[side] = [["MiddleProximal", 80], ["MiddleIntermediate", 95], ["MiddleDistal", 70], ["IndexProximal", 80], ["IndexIntermediate", 95], ["RingProximal", 80], ["RingIntermediate", 95],
      ["LittleProximal", 80], ["LittleIntermediate", 95], ["ThumbProximal", 25], ["ThumbIntermediate", 35]].map(([n, deg]) => [a.bone(side + n), deg]).filter(([b]) => b)
      .map(([b, deg]) => ({ b, deg, rest: b.quaternion.clone(), ax: new THREE.Vector3(0, 0, sg).applyQuaternion(b.getWorldQuaternion(_q).invert()) }));
  }
  const SHARE = [["spine", 0.15], ["chest", 0.2], ["upperChest", 0.25], ["neck", 0.15], ["head", 0.25]].map(([n, k]) => [a.bone(n), k]);
  const W = 2 * Math.PI * 2.4, Z = 0.38, WD = W * Math.sqrt(1 - Z * Z), XP = Math.atan(Math.sqrt(1 - Z * Z) / Z) / WD, PK = Math.exp(-Z * W * XP) * Math.sin(WD * XP);
  a.hits = []; a.look = null; a.grip = null; a.springs = []; a.adds = []; a.reach = [];
  a.faceDir = () => face.clone().applyQuaternion(head.getWorldQuaternion(_q));  // where his face points now
  a.turn = (bone, axis, deg) => a.adds.push(s => { const d = deg(s); if (Math.abs(d) > 1e-3) turnWorld(a.bone(bone), new THREE.Quaternion().setFromAxisAngle(axis().normalize(), rad(d))); });  // an extra turn, degrees over story time (a nod, a tilt, a gulp)
  a.curl = (side, k) => {  // the fused fingers closed by k (0-1)
    for (const f of fingers[side]) { f.b.quaternion.copy(f.rest); if (k > 0) f.b.quaternion.multiply(_q.setFromAxisAngle(f.ax, rad(f.deg) * k)); }
    if (fingers[side].length) a.bone(side + "Hand").updateMatrixWorld(true);
  };
  a.hit = (s0, dir, deg = 18) => { const ax = new THREE.Vector3().crossVectors(UP, dir.clone().setY(0)); if (ax.lengthSq() < 1e-8) ax.set(1, 0, 0); a.hits.push({ s0, ax: ax.normalize(), deg }); };  // the blow pushes the top of the body along dir (its level part)
  a.post = s => {
    for (const h of a.hits) {  // a damped kick that peaks ~70 ms after the hit-stop lets go, overshoots once, settles in ~0.6 s
      const x = s - h.s0; if (x <= 0 || x > 1.3) continue;
      const th = rad(h.deg) * Math.exp(-Z * W * x) * Math.sin(WD * x) / PK;
      for (const [b, k] of SHARE) turnWorld(b, _q.setFromAxisAngle(h.ax, th * k));
    }
    const L = a.look; if (L) {
      const w = typeof L.w === "function" ? L.w(s) : L.w ?? 1, tgt = L.at();
      if (w > 0) for (const [b, share] of [[neck, 0.4], [head, 1]]) {
        head.getWorldPosition(_w); const d = _v.subVectors(tgt, _w).normalize(), f = face.clone().applyQuaternion(head.getWorldQuaternion(_q));
        const q = new THREE.Quaternion().setFromUnitVectors(f, d), ang = 2 * Math.acos(clamp(q.w, -1, 1)), lim = rad(L.max ?? 65);
        if (ang > lim) q.slerpQuaternions(I, q, lim / ang);
        turnWorld(b, q.slerpQuaternions(I, q, w * share));
      }
    }
    for (const f of a.adds) f(s);
    for (const g of a.reach) { const w = clamp(g.w(s)); if (w > 0) { const h = a.bone(g.side + "Hand"); ik2(a.bone(g.side + "UpperArm"), a.bone(g.side + "LowerArm"), h, h.getWorldPosition(new THREE.Vector3()).lerp(g.at(s), w)); } }  // a hand gesture: the wrist reaches to a point (wipe the brow, blow on the knuckles)
    const G = a.grip; if (G) for (const side of ["right", "left"]) a.curl(side, typeof G[side] === "function" ? G[side](s) : G[side] ?? 0);
    for (const side of ["left", "right"]) a.clearArm(side);
    for (const f of a.springs) f(s);
  };
  a.clearArm = side => {  // the hand and forearm never inside his own trunk, head or legs: the wrist reaches out of the deepest overlap
    if (a.caps) for (let it = 0; it < 6; it++) {
      const C = a.caps(), arm = C.filter(c => c.n === side + "Hand" || c.n === side + "LowerArm"), body = C.filter(c => /^(spine|chest|upperChest|head)$|UpperLeg|LowerLeg/.test(c.n));
      let w = 0, out = null;
      for (const x of arm) for (const y of body) { const d = x.r + y.r + (a.holdsStaff === side && x.n.endsWith("Hand") ? 0.012 : 0) - segDist(x.a, x.b, y.a, y.b); if (d > w) { w = d; const m = x.a.clone().lerp(x.b, 0.5); out = m.sub(new THREE.Line3(y.a, y.b).closestPointToPoint(m, true, new THREE.Vector3())).normalize(); } }  // a fist round the staff keeps the staff's thickness clear too
      if (w <= 0) break;
      const hand = a.bone(side + "Hand"); ik2(a.bone(side + "UpperArm"), a.bone(side + "LowerArm"), hand, hand.getWorldPosition(new THREE.Vector3()).addScaledVector(out, 1.6 * w + 0.002));
    }
  };
  return a;
}

// Kapi's tail: no bones in the book's rig, so a chain of 4 is added at load (the file is untouched): the tail is the connected part of the
// skin behind his back and below his head; its vertices are re-weighted along the chain by hop distance from the body. Each joint then lags
// on a spring as he moves.
export function tail(THREE_, a, { behind = 0.09, top = 0.42, n = 4, hz = 3.2, zeta = 0.32 } = {}) {
  let mesh; a.model.traverse(o => o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count) && (mesh = o));
  a.body.updateMatrixWorld(true);
  const sk = mesh.skeleton, hips = a.bone("hips"), g = mesh.geometry, N = g.attributes.position.count, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const P = new Float32Array(N * 3), inv = a.body.matrixWorld.clone().invert(), box = new THREE.Box3();
  for (let i = 0; i < N; i++) { mesh.getVertexPosition(i, _v); _v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); _v.toArray(P, i * 3); box.expandByPoint(_v); }  // a SkinnedMesh vertex comes back already skinned
  const H = box.max.y - box.min.y, hp = hips.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const domName = i => { let b = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, b)) b = j; return sk.bones[si.getComponent(i, b)].name; };
  const cand = new Uint8Array(N);
  for (let i = 0; i < N; i++) cand[i] = P[i * 3 + 2] < hp.z - behind * H && P[i * 3 + 1] < hp.y + top * H && !/head|neck|Arm|Hand|Shoulder|Thumb|Index|Middle|Ring|Little/.test(domName(i));
  // weld by position (glTF splits vertices at seams), then grow the component that holds the farthest-back candidate
  const key = i => `${Math.round(P[i * 3] / H * 2000)},${Math.round(P[i * 3 + 1] / H * 2000)},${Math.round(P[i * 3 + 2] / H * 2000)}`, weld = new Map(), rep = new Int32Array(N);
  for (let i = 0; i < N; i++) { const k = key(i); if (!weld.has(k)) weld.set(k, i); rep[i] = weld.get(k); }
  const adj = new Map(), ix = g.index.array, add = (x, y) => { (adj.get(x) ?? adj.set(x, []).get(x)).push(y); };
  for (let f = 0; f < ix.length; f += 3) for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const A = rep[ix[f + x]], B = rep[ix[f + y]]; if (cand[A] && cand[B] && A !== B) { add(A, B); add(B, A); } }
  let far = -1; for (let i = 0; i < N; i++) if (cand[i] && rep[i] === i && (far < 0 || P[i * 3 + 2] < P[far * 3 + 2])) far = i;
  const comp = new Set([far]), q = [far]; while (q.length) for (const y of adj.get(q.pop()) ?? []) if (!comp.has(y)) { comp.add(y); q.push(y); }
  // order along the tail: hops from the vertices nearest the hips
  const list = [...comp], d = new Map(); let root = list[0];
  for (const i of list) if (Math.hypot(P[i * 3] - hp.x, P[i * 3 + 1] - hp.y, P[i * 3 + 2] - hp.z) < Math.hypot(P[root * 3] - hp.x, P[root * 3 + 1] - hp.y, P[root * 3 + 2] - hp.z)) root = i;
  d.set(root, 0); const bq = [root]; for (let h = 0; h < bq.length; h++) for (const y of adj.get(bq[h]) ?? []) if (!d.has(y)) { d.set(y, d.get(bq[h]) + 1); bq.push(y); }
  const maxd = Math.max(...d.values()), u = i => (d.get(rep[i]) ?? 0) / maxd;
  // joints: the mean of the vertices in each of n+1 bands along it
  const J = Array.from({ length: n + 1 }, () => [new THREE.Vector3(), 0]);
  for (const i of list) { const k = Math.min(n, Math.round(u(i) * n)); J[k][0].add(_v.fromArray(P, i * 3)); J[k][1]++; }
  const joints = J.map(([p, c]) => p.divideScalar(Math.max(c, 1)).applyMatrix4(a.body.matrixWorld));
  const bones = []; let parent = hips;
  for (let k = 0; k < n; k++) { const b = new THREE.Bone(); b.name = `tail${k}`; parent.add(b); parent.updateMatrixWorld(true); b.position.copy(parent.worldToLocal(joints[k].clone())); b.updateMatrixWorld(true); bones.push(b); parent = b; }
  const tip = new THREE.Bone(); tip.name = `tail${n}`; parent.add(tip); tip.position.copy(parent.worldToLocal(joints[n].clone()));  // the tip: no skin, it ends the last capsule
  const hi = sk.bones.indexOf(hips), hipBM = new THREE.Matrix4().multiplyMatrices(hips.matrixWorld, sk.boneInverses[hi]);
  mesh.skeleton = new THREE.Skeleton([...sk.bones, ...bones], [...sk.boneInverses, ...bones.map(b => new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(hipBM))]);
  const base = sk.bones.length;
  for (let i = 0; i < N; i++) {
    if (!comp.has(rep[i])) continue;
    const c = u(i) * n, k = Math.min(n - 1, Math.floor(c)), t = c - k, keep = 1 - sstep(clamp(c / 0.6));  // the first 15% stays with the body
    const wn = k + 1 < n ? 0.5 * sstep(clamp(2 * t - 1)) : 0, wp = k > 0 ? 0.5 * sstep(clamp(1 - 2 * t)) : 0, wk = 1 - wn - wp;
    let o = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, o)) o = j;
    si.setXYZW(i, base + k, base + Math.min(n - 1, k + 1), base + Math.max(0, k - 1), si.getComponent(i, o));
    sw.setXYZW(i, wk * (1 - keep), wn * (1 - keep), wp * (1 - keep), keep);
  }
  si.needsUpdate = sw.needsUpdate = true;
  const tailR = joints.slice(1).map((J, k) => { const ln = new THREE.Line3(joints[k], J), d = list.filter(i => Math.min(n - 1, Math.floor(u(i) * n)) === k).map(i => ln.closestPointToPoint(_v.fromArray(P, i * 3).applyMatrix4(a.body.matrixWorld), true, _w).distanceTo(_v.fromArray(P, i * 3).applyMatrix4(a.body.matrixWorld))).sort((x, y) => x - y); return d[Math.floor(d.length * 0.5)] ?? 0.01 * H; });
  // the chain on springs: each joint's rest direction, carried by its parent, is the target its child end follows
  const rest = bones.map((b, k) => ({ q: b.quaternion.clone(), len: joints[k + 1].distanceTo(joints[k]), dir: (bones[k + 1] ? bones[k + 1].position.clone() : b.worldToLocal(joints[n].clone())).normalize(), sp: new Spring(hz * (1 + 0.25 * k), zeta) }));
  const curlAx = new THREE.Vector3();
  a.springs.push(s => {
    for (let k = 0; k < n; k++) {
      const b = bones[k], R = rest[k]; b.quaternion.copy(R.q); b.updateMatrixWorld(true);
      const cu = a.tailCurl?.(s) ?? 0; if (Math.abs(cu) > 1e-3) { if (!k) curlAx.crossVectors(R.dir.clone().transformDirection(b.matrixWorld), UP).normalize(); turnWorld(b, _q.setFromAxisAngle(curlAx, rad(cu * [45, 55, 70, 80][k % 4]))); }  // a question mark (cu > 0): each joint turns up and over about one side axis; flat (cu < 0): down
      const o = b.getWorldPosition(new THREE.Vector3()), tip = R.dir.clone().transformDirection(b.matrixWorld).multiplyScalar(R.len).add(o);
      const has = _w.subVectors(tip, o).normalize().clone(), sw = R.sp.at(tip, s).clone().sub(o).normalize();  // the spring's own swing, capped at 35 degrees
      const qs = new THREE.Quaternion().setFromUnitVectors(has, sw), as = 2 * Math.acos(clamp(qs.w, -1, 1)); if (as > rad(35)) qs.slerpQuaternions(I, qs, rad(35) / as);
      turnWorld(b, qs);
      const end = o.clone().addScaledVector(has.clone().applyQuaternion(qs), R.len), mid = o.clone().lerp(end, 0.5);  // then out of the legs, end and middle, uncapped
      for (const c of a.legCaps?.() ?? []) for (const q of [end, mid]) {
        const ln = new THREE.Line3(c.a, c.b), on = ln.closestPointToPoint(q, true, new THREE.Vector3()), gap = q.distanceTo(on), need = c.r + tailR[k] + 0.006;
        if (gap < need) { const to = on.clone().addScaledVector(gap > 1e-6 ? q.clone().sub(on).normalize() : new THREE.Vector3(0, 0, -1), need), f = q === mid ? 2 : 1;
          const from = q.clone().sub(o).normalize(), want = o.clone().add(to.clone().sub(o).multiplyScalar(f)).sub(o).normalize(); turnWorld(b, new THREE.Quaternion().setFromUnitVectors(from, want));
          end.copy(o).addScaledVector(want, R.len); mid.copy(o).lerp(end, 0.5); }
      }
    }
  });
  return { bones, count: comp.size, joints, caps: bones.map((b, k) => [`tail${k}`, `tail${k + 1}`, RegExp(`^tail${k}$`)]) };
}

export function ik2(up, lo, hand, goal) {  // two-bone reach: the hand joint to goal, the elbow kept on the side it bends to now
  const S = up.getWorldPosition(new THREE.Vector3()), E = lo.getWorldPosition(new THREE.Vector3()), Wp = hand.getWorldPosition(new THREE.Vector3());
  const l1 = S.distanceTo(E), l2 = E.distanceTo(Wp), d = clamp(S.distanceTo(goal), Math.abs(l1 - l2) + 1e-5, (l1 + l2) * 0.999), e = goal.clone().sub(S).normalize();
  const pole = E.clone().sub(S); pole.addScaledVector(e, -pole.dot(e)); if (pole.lengthSq() < 1e-10) pole.set(0, -1, 0).addScaledVector(e, -e.y); pole.normalize();
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), E2 = S.clone().addScaledVector(e, x).addScaledVector(pole, Math.sqrt(Math.max(l1 * l1 - x * x, 0)));
  turnWorld(up, _q.setFromUnitVectors(E.sub(S).normalize(), E2.sub(S).normalize()));
  const E3 = lo.getWorldPosition(new THREE.Vector3()), W3 = hand.getWorldPosition(new THREE.Vector3());
  turnWorld(lo, _q.setFromUnitVectors(W3.sub(E3).normalize(), S.addScaledVector(e, d).sub(E3).normalize()));
}

// The golden staff (Ruyi Jingu Bang) in Kapi's right fist: it runs through the fist along the thumb's line (a sword grip), cocked a little
// toward the forearm's line. His left hand comes onto it (a two-bone reach, the fist closing) when the slice asks (both(s), 0-1).
// grip(s): where along it the right fist holds it (from its centre, + toward the striking end, in lengths); twirl(s): degrees
// spun in the fingers about the forearm. Its two ends lag on springs, so it bends a little on a fast swing and whips on the stop.
export function staff(scene, a, { L = 0.3, r = 0.004, cock = 0.35, reach = 0, hz = 5, zeta = 0.3, bend = 9 } = {}) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.28, emissive: 0x6a3a00, emissiveIntensity: 0.25 });
  const capM = new THREE.MeshStandardMaterial({ color: 0xb8321e, metalness: 0.7, roughness: 0.35, emissive: 0x3a0800 });
  const bones = [0, 1, 2, 3, 4].map(() => new THREE.Bone()), [root, a1, a2, b1, b2] = bones;
  root.add(a1, b1); a1.add(a2); b1.add(b2); a2.position.y = L / 4; b2.position.y = -L / 4;
  const geo = new THREE.CylinderGeometry(r, r, L, 14, 24), pos = geo.attributes.position, si = [], sw = [];
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = Math.min(1, Math.abs(y) / (L / 4)); si.push(...(y >= 0 ? [1, 2] : [3, 4]), 0, 0); sw.push(1 - k, k, 0, 0); }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, gold); mesh.add(root); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  for (const [b, sg] of [[a2, 1], [b2, -1]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r * 1.4, 0.03, 16), capM); c.position.y = sg * (L / 4 - 0.015); b.add(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, r * 0.3, 8, 20), gold); ring.rotation.x = Math.PI / 2; ring.position.y = sg * (L / 4 - 0.03); b.add(ring);
  }
  mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  scene.add(mesh);
  const H = a.h, hand = a.bone("rightHand"), fore = a.bone("rightLowerArm"), rm = a.bone("rightMiddleProximal"), lh = a.bone("leftHand"), lm = a.bone("leftMiddleProximal");
  const lu = a.bone("leftUpperArm"), ll = a.bone("leftLowerArm"), ls = a.bone("leftShoulder"), gap0 = 0.2 * L;  // the two fists' spacing on the shaft
  a.body.updateMatrixWorld(true);
  const thumb = new THREE.Vector3(0, 0, 1).applyQuaternion(hand.getWorldQuaternion(_q).invert());  // loaded T-pose, palm down: the thumb's line points forward
  const R = new THREE.Vector3(), Lf = new THREE.Vector3(), dir = new THREE.Vector3(), ctr = new THREE.Vector3(), sA = new Spring(hz, zeta), sB = new Spring(hz, zeta), line = new THREE.Line3();
  const fist = (h, m, out) => h.getWorldPosition(out).add(m.getWorldPosition(_v)).multiplyScalar(0.5);
  const st = {
    mesh, L, two: 0, leftGap: 0, push: new THREE.Vector3(), cock: () => cock, grip: () => -0.2, twirl: () => 0, both: () => 0, tremble: () => 0, obstacles: () => [], aim: () => null,  // the slice sets grip(s), twirl(s), both(s), cock(s) (0: across the fist, 1: along the forearm)
    at(s) {
      fist(hand, rm, R);
      const fa = _w.subVectors(hand.getWorldPosition(_w), fore.getWorldPosition(_v)).normalize().clone(), d1 = thumb.clone().applyQuaternion(hand.getWorldQuaternion(_q));
      d1.addScaledVector(fa, -d1.dot(fa)).normalize();  // the thumb's line, square to the forearm (no wrist twist noise along it)
      const ck = st.cock(s); dir.copy(d1).multiplyScalar(1 - ck).addScaledVector(fa, ck).normalize();
      fist(lh, lm, Lf); const two = clamp(st.both(s));
      if (two > 0) { const rl = _u.subVectors(R, Lf); if (rl.length() > 0.01) dir.lerp(rl.normalize(), two).normalize(); }  // two hands: the staff is the line through both fists (the clip's own staff), the striking end beyond the right
      const am = st.aim(s); if (am) dir.lerp(am[0], am[1]).normalize();  // a slice may point it ([direction, weight]: a thrust held on a target); the left fist then closes on it where it lies
      const tw = st.twirl(s); if (tw) dir.applyAxisAngle(fa, rad(tw));
      const tr = st.tremble(s); if (tr) dir.applyAxisAngle(_w.crossVectors(dir, UP).normalize(), rad(tr) * Math.sin(s * 2 * Math.PI * 17));  // a held strain: the tip trembles
      // never through a body (his own but the arm that holds it, or his foe's): one turn about the fist, summed from every point inside a capsule
      // (deeper and nearer the fist turns more), eased and capped, so it changes smoothly from frame to frame
      const g = st.grip(s), turn = new THREE.Vector3(), caps = st.obstacles(s), cp = new THREE.Vector3(), seg = new THREE.Line3();
      for (let i = 0; i <= 24; i++) {
        const t = (-g - 0.5 + i / 24) * L, p = R.clone().addScaledVector(dir, t); if (Math.abs(t) < 0.03 * L) continue;
        for (const c of caps) {
          seg.set(c.a, c.b); seg.closestPointToPoint(p, true, cp); const d = c.r + r * 1.4 - p.distanceTo(cp); if (d <= 0) continue;
          turn.addScaledVector(_w.crossVectors(dir, p.clone().sub(cp).normalize().multiplyScalar(Math.sign(t))).normalize(), d / Math.abs(t) * 0.7);
        }
      }
      if (!Spring.off) turn.copy(st.push.lerp(turn, 0.35));  // eased over a few frames: the push never flips the staff in one
      const ta = Math.min(turn.length(), rad(70)); if (ta > 1e-4) dir.applyAxisAngle(turn.normalize(), ta);
      for (let it = 0; it < 24; it++) {  // then whatever the easing left inside comes out at once, in small turns from the deepest point (no flip: each turn is at most 12 degrees)
        let worst = 0, wt = 0, wn = null;
        for (let i = 0; i <= 24; i++) {
          const t = (-g - 0.5 + i / 24) * L, p = R.clone().addScaledVector(dir, t); if (Math.abs(t) < 0.03 * L) continue;
          for (const c of caps) { seg.set(c.a, c.b); seg.closestPointToPoint(p, true, cp); const d = c.r + r * 1.4 - p.distanceTo(cp); if (d > worst) { worst = d; wt = t; wn = p.clone().sub(cp).normalize(); } }
        }
        if (!wn) break;
        dir.applyAxisAngle(_w.crossVectors(dir, wn.multiplyScalar(Math.sign(wt))).normalize(), Math.min(rad(12), worst / Math.abs(wt) + 0.002));
      }
      ctr.copy(R).addScaledVector(dir, -g * L);
      mesh.position.copy(ctr); mesh.quaternion.setFromUnitVectors(UP, dir); mesh.updateMatrixWorld(true);
      // the left fist closes on the shaft, a fixed spacing below the right one (a two-bone reach), as much as the slice asks (both(s))
      if (two > 0.001) {  // the left fist on the shaft below the right: where his own left hand is along it, kept within his reach (sliding toward the right fist if need be)
        const S = lu.getWorldPosition(new THREE.Vector3()), reach = 0.97 * (S.distanceTo(ll.getWorldPosition(_v)) + ll.getWorldPosition(_v).distanceTo(lh.getWorldPosition(_w))) + Lf.distanceTo(lh.getWorldPosition(_w)), at = t => R.clone().addScaledVector(dir, t), lo = Math.max(-1.3 * gap0, -(0.5 + st.grip(s)) * L + 0.01);  // never past the staff's back end
        const hi = at(-0.018).distanceTo(S) > reach && at(0.8 * gap0).distanceTo(S) < at(-0.018).distanceTo(S) ? 0.8 * gap0 : -0.018;  // above the right fist only when below it is out of his reach
        let t = clamp(_u.subVectors(Lf, R).dot(dir), lo, hi); const ts = clamp(_u.subVectors(S, R).dot(dir), lo, hi);
        if (at(t).distanceTo(S) > reach) { if (at(ts).distanceTo(S) > reach) t = ts; else { let a0 = t, a1 = ts; for (let i = 0; i < 16; i++) { const m = (a0 + a1) / 2; if (at(m).distanceTo(S) > reach) a0 = m; else a1 = m; } t = a1; } }
        const G = at(t), C = ls?.getWorldPosition(new THREE.Vector3());
        if (ls && G.distanceTo(S) > reach - Lf.distanceTo(lh.getWorldPosition(_w)) * 0.5) { const q = new THREE.Quaternion().setFromUnitVectors(S.clone().sub(C).normalize(), G.clone().sub(C).normalize()), a = 2 * Math.acos(clamp(q.w, -1, 1)); turnWorld(ls, q.slerpQuaternions(I, q, Math.min(1, rad(25) / Math.max(a, 1e-6)))); }  // short arms: the shoulder reaches too (up to 25 degrees)
        for (let i = 0; i < 2; i++) { const off = fist(lh, lm, _v).sub(lh.getWorldPosition(_w)); ik2(lu, ll, lh, Lf.clone().lerp(G, two).sub(off)); } st.spacing = -t;  // twice: the palm's offset from the wrist turns with the reach
      }
      line.set(st.tip(-1, _u), st.tip(1, new THREE.Vector3())); st.leftGap = line.closestPointToPoint(fist(lh, lm, _v), false, new THREE.Vector3()).distanceTo(fist(lh, lm, _w)) / H;
      st.two = two; a.curl?.("left", Math.max(two, a.fistL?.(s) ?? 0));  // the left hand closes on the shaft (or into a fist when the slice asks)
      for (const [sp, sg, b1_, b2_] of [[sA, 1, a1, a2], [sB, -1, b1, b2]]) {  // each end lags on its spring: the bend shared by the two bones of that half
        const end = ctr.clone().addScaledVector(dir, sg * L / 2), p = sp.at(end, s), e = _v.subVectors(end, ctr), f = _w.subVectors(p, ctr);
        const ang = Math.min(e.angleTo(f), rad(bend)), ax = _u.crossVectors(e, f);
        b1_.quaternion.identity(); b2_.quaternion.identity();
        if (ang > 1e-4 && ax.lengthSq() > 1e-12) { ax.normalize().applyQuaternion(_q.copy(mesh.quaternion).invert()); b1_.quaternion.setFromAxisAngle(ax, ang / 2); b2_.quaternion.setFromAxisAngle(ax, ang / 2); }
      }
      mesh.updateMatrixWorld(true);
    },
    tip: (end = 1, out = new THREE.Vector3()) => out.copy(ctr).addScaledVector(dir, end * L / 2),
    dir: () => dir.clone(),
  };
  return st;
}

// The Ox King on a stock man: a heavier upper body (the spine scaled up, the head scaled back), code-built horns, a gold nose ring, ember eyes.
// The horns shake and the ring swings on every blow in a.hits; the ring also hangs and swings as his head moves.
export function oxProps(a, { bulk = 1.14 } = {}) {
  a.bone("spine").scale.setScalar(bulk); a.bone("neck").scale.setScalar(1 / bulk * 1.06);
  a.body.updateMatrixWorld(true);
  const head = a.bone("head"), top = a.bone("HeadTop_End"), hp = head.getWorldPosition(new THREE.Vector3()), tp = top.getWorldPosition(new THREE.Vector3()), hh = tp.y - hp.y;
  let skin; a.model.traverse(o => o.isSkinnedMesh && (!skin || o.geometry.attributes.position.count > skin.geometry.attributes.position.count) && (skin = o));
  const front = y => { const hit = new THREE.Raycaster(new THREE.Vector3(hp.x, y, hp.z + hh * 3), new THREE.Vector3(0, 0, -1)).intersectObject(skin)[0]; return hit ? hit.point : new THREE.Vector3(hp.x, y, hp.z + hh * 0.45); };
  const ws = head.getWorldScale(new THREE.Vector3()).x, hq = head.getWorldQuaternion(new THREE.Quaternion()), hqi = hq.clone().invert();
  const attach = (o, at, q = new THREE.Quaternion()) => { o.position.copy(head.worldToLocal(at.clone())); o.quaternion.copy(hqi).multiply(q); o.scale.setScalar(1 / ws); head.add(o); };
  const horn = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.45, metalness: 0.05 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.5 });
  const horns = [];
  for (const sg of [1, -1]) {  // out from the temples, then up and a little forward, darkening to the tips
    const len = hh * 1.15, base = hh * 0.15, Rc = len * 0.75, g = new THREE.CylinderGeometry(base * 0.08, base, len, 14, 12).translate(0, len / 2, 0), p = g.attributes.position;
    const col = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), h = p.getY(i), th = h / Rc; p.setXYZ(i, Rc - (Rc - x) * Math.cos(th), (Rc - x) * Math.sin(th), p.getZ(i)); const k = h / len; col.push(...[0.86, 0.78, 0.62].map(c => c * (1 - 0.8 * k * k))); }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, horn.clone()); m.material.vertexColors = true; m.castShadow = true;
    // local Y (the horn's start) points out sideways and a little up; local X (where it curls) points up and forward
    const out = new THREE.Vector3(sg, 0.25, 0.05).normalize(), curl = new THREE.Vector3(0, 1, 0.35).normalize(); curl.addScaledVector(out, -curl.dot(out)).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(curl, out, new THREE.Vector3().crossVectors(curl, out)));
    const g2 = new THREE.Group(); attach(g2, new THREE.Vector3(hp.x + sg * hh * 0.33, hp.y + hh * 0.72, hp.z + hh * 0.02)); m.quaternion.copy(q); g2.add(m); horns.push(g2);
  }
  const nose = front(hp.y + hh * 0.33), eyeY = hp.y + hh * 0.42;
  const ringR = hh * 0.11, ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, ringR * 0.22, 10, 28), new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.25, emissive: 0x4a2a00, emissiveIntensity: 0.3 }));
  ring.position.y = -ringR; const pend = new THREE.Group(); pend.add(ring); attach(pend, nose.clone().add(new THREE.Vector3(0, -hh * 0.01, hh * 0.09)));  // hung off the tip of his nose, clear of the face
  skin.material.onBeforeCompile = sh => {  // the man's skin to a bull demon's slate grey: texels by colour (skin is warm with green 33-68% and blue 12-50% of red; the gold sash is far bluer-poor, the red cloth far greener-poor)
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      { vec3 c = diffuseColor.rgb; float r = max(c.r, 1e-4), gr = c.g / r, br = c.b / r;
        float k = smoothstep(0.03, 0.06, c.r) * smoothstep(0.2, 0.26, gr) * (1.0 - smoothstep(0.66, 0.72, gr)) * smoothstep(0.1, 0.14, br) * (1.0 - smoothstep(0.48, 0.55, br));
        diffuseColor.rgb = mix(c, vec3(0.30, 0.33, 0.40) * dot(c, vec3(0.6, 0.3, 0.1)) * 2.2, k); }`);
  };
  skin.material.customProgramCacheKey = () => "ox-skin";
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.42, 0.1) }), eyes = [];
  for (const sg of [1, -1]) {  // on the painted eyes, found by a ray from the front
    const f = new THREE.Raycaster(new THREE.Vector3(hp.x + sg * hh * 0.17, eyeY, hp.z + hh * 3), new THREE.Vector3(0, 0, -1)).intersectObject(skin)[0]?.point ?? front(eyeY);
    const m = new THREE.Mesh(new THREE.SphereGeometry(hh * 0.026, 12, 8), eyeM); attach(m, f.clone().add(new THREE.Vector3(0, 0, hh * 0.01))); eyes.push(m);
  }
  const sp = new Spring(2.2, 0.18), gq = new THREE.Quaternion(), rest = pend.quaternion.clone();
  const marks = { brow: [0, 0.62, 0.3], crown: [0, 0.95, 0.05], nose: [0, 0.33, 0.45], chin: [0, 0.1, 0.32], temple: [0.33, 0.55, 0.3] }, local = {};  // in head heights from the head joint: side, up, forward
  for (const [k, [x, y, z]] of Object.entries(marks)) local[k] = head.worldToLocal(new THREE.Vector3(hp.x + x * hh, hp.y + y * hh, hp.z + z * hh));
  const P = { horns, ring: pend, nose, hh, eyes, squint: () => 0, droop: () => 0, tremble: () => 0, glow: () => 1, warm: () => 0, chip: Infinity, point: (k, out = new THREE.Vector3()) => head.localToWorld(out.copy(local[k])) };  // the slice sets squint(s) 0-1, droop(s) degrees, tremble(s) 0-1, glow(s) (1 = sure of himself), warm(s) 0-1 (amber, no longer burning), chip (when a horn tip breaks)
  a.springs.push(s => {
    let kick = 0; for (const h of a.hits) { const x = s - h.s0; if (x > 0 && x < 1) kick += Math.exp(-x / 0.14) * Math.sin(x * 2 * Math.PI * 9); }
    horns.forEach((g, i) => { g.rotation.set(0, 0, 0); g.rotateZ(rad(7) * kick * (i ? -1 : 1)); g.rotateX(rad(4) * kick + rad(P.droop(s))); });  // droop: the horns tip forward and down (pride gone)
    const sq = 1 - 0.75 * clamp(P.squint(s)); for (const m of eyes) m.scale.y = m.scale.x * sq;
    const gl = P.glow(s), wm = clamp(P.warm(s)); eyeM.color.setRGB((2.4 - 0.8 * wm) * gl, (0.42 + 0.5 * wm) * gl, (0.1 + 0.2 * wm) * gl);  // the eyes as his feelings: bright when sure, a dip when hit, a flicker in fear, warm at the bow
    horns[0].children[0].scale.setScalar(s >= P.chip ? 0.84 : 1);  // the cost of the last blow: one horn's tip broken off
    pend.quaternion.copy(rest); pend.updateMatrixWorld(true); const o = pend.getWorldPosition(new THREE.Vector3()), down = o.clone().add(new THREE.Vector3(0, -ringR * a.body.scale.x, 0));
    const p = sp.at(down, s), want = _v.subVectors(p, o).normalize(), tr = P.tremble(s); if (tr) want.add(new THREE.Vector3(0.25 * tr * Math.sin(s * 2 * Math.PI * 13), 0, 0.15 * tr * Math.sin(s * 2 * Math.PI * 9))).normalize();  // a snort: the ring trembles
    const hq = head.getWorldQuaternion(new THREE.Quaternion()), lw = want.clone().applyQuaternion(hq.clone().invert()); if (lw.z < 0.05) { lw.z = 0.05; want.copy(lw.normalize().applyQuaternion(hq)); }  // never back into his face
    pend.getWorldQuaternion(gq); const cur = new THREE.Vector3(0, -1, 0).applyQuaternion(gq);  // the ring's hanging line as it is now (head-locked)
    turnWorld(pend, new THREE.Quaternion().setFromUnitVectors(cur, want));
    pend.quaternion.multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -rad(22) * Math.abs(kick)));  // the kick swings it forward, off the face
  });
  return P;
}

// Planted feet stay planted: a foot whose ankle is down at its standing height is held where it landed (a two-bone leg reach) while the clips
// blend or drift under it; if the animation means to move it, the hold creeps after it (0.5% of the height a frame, or 12% of the gap if more:
// never a pop); a jump in story time (a replay) lets go at once. State steps with story time like the springs; a pause holds it.
export function footLock(a, floorY) {
  a.body.updateMatrixWorld(true);
  const lock = {}, legs = ["left", "right"].map(s => [s, a.bone(s + "UpperLeg"), a.bone(s + "LowerLeg"), a.bone(s + "Foot")]);
  const ankle = legs[0][3].getWorldPosition(new THREE.Vector3()).y - a.body.getWorldPosition(new THREE.Vector3()).y; let last = null;
  const toes = { left: a.bone("leftToes"), right: a.bone("rightToes") }, pitchOf = (ft, side) => { const t = toes[side].getWorldPosition(new THREE.Vector3()).sub(ft.getWorldPosition(_w)); return [t, Math.atan2(-t.y, Math.hypot(t.x, t.z))]; };
  const flat = pitchOf(legs[0][3], "left")[1]; a.flat = flat; a.down = {};  // the loaded (standing) foot's pitch: a planted foot is laid back to it
  a.springs.push(s => {
    if (Spring.off) return;
    const dt = last == null ? -1 : s - last; last = s;
    if (!(dt >= 0 && dt < 0.1)) for (const k in lock) delete lock[k];
    for (const [side, up, lo, ft] of legs) {
      const p = ft.getWorldPosition(new THREE.Vector3()), down = p.y - floorY - ankle < 0.025 * a.h; a.down[side] = down;
      if (!down) { delete lock[side]; continue; }
      const L = lock[side] ??= p.clone();
      const d = Math.hypot(p.x - L.x, p.z - L.z);
      if (d > 1e-6) { const k = Math.min(1, Math.max(0.005 * a.h, 0.12 * d) / d); L.x += (p.x - L.x) * k; L.z += (p.z - L.z) * k; }  // creep toward where the clip has it
      if (Math.hypot(p.x - L.x, p.z - L.z) > 1e-6) ik2(up, lo, ft, new THREE.Vector3(L.x, p.y, L.z));
      const [t, pitch] = pitchOf(ft, side), h = Math.hypot(t.x, t.z);  // and lies flat on the page
      if (h > 1e-6 && Math.abs(pitch - flat) > rad(0.5)) turnWorld(ft, _q.setFromUnitVectors(t.clone().normalize(), new THREE.Vector3(t.x / h * Math.cos(flat), -Math.sin(flat), t.z / h * Math.cos(flat))));
    }
  });
}

// The body as capsules (bone to bone, radius = the median distance of the skin that bone owns, from the loaded pose), for collisions and
// for the leak measure. caps() gives them posed, in the world: [{ n, a, b, r }]. Kapi's tail joints, once added, are capsules too.
const CAPS = [["hips", "spine", /^hips$/], ["spine", "chest", /^spine$/], ["chest", "upperChest", /^chest$/], ["upperChest", "neck", /^upperChest$/], ["neck", "head", /^neck$/], ["head", "HeadTop_End", /^head$/],
  ...["left", "right"].flatMap(s => { const T = s === "left" ? "LeftToe_End" : "RightToe_End"; return [
    [`${s}UpperArm`, `${s}LowerArm`, RegExp(`^${s}UpperArm$`)], [`${s}LowerArm`, `${s}Hand`, RegExp(`^${s}LowerArm$`)], [`${s}Hand`, `${s}MiddleTip`, RegExp(`^${s}(Hand|Thumb|Index|Middle|Ring|Little)`)],
    [`${s}UpperLeg`, `${s}LowerLeg`, RegExp(`^${s}UpperLeg$`)], [`${s}LowerLeg`, `${s}Foot`, RegExp(`^${s}LowerLeg$`)], [`${s}Foot`, T, RegExp(`^${s}(Foot|Toes)$`)]]; })];
export function segDist(p1, q1, p2, q2) {  // the closest distance between two segments (Ericson, Real-Time Collision Detection 5.1.9)
  const d1 = _a.subVectors(q1, p1), d2 = _b.subVectors(q2, p2), r = _c.subVectors(p1, p2), a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a < 1e-12 && e < 1e-12) return p1.distanceTo(p2);
  if (a < 1e-12) t = clamp(f / e);
  else { const c = d1.dot(r); if (e < 1e-12) s = clamp(-c / a); else { const b = d1.dot(d2), den = a * e - b * b; s = den > 1e-12 ? clamp((b * f - c * e) / den) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); } } }
  return _d.copy(p1).addScaledVector(d1, s).distanceTo(_e.copy(p2).addScaledVector(d2, t));
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
export function segPair(p1, q1, p2, q2, o1, o2) { const d = segDist(p1, q1, p2, q2); if (p1.distanceToSquared(q1) < 1e-24 && p2.distanceToSquared(q2) < 1e-24) { o1.copy(p1); o2.copy(p2); } else { o1.copy(_d); o2.copy(_e); } return d; }  // and the two closest points
export function capsules(a, extra = []) {
  let mesh; a.model.traverse(o => o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count) && (mesh = o));
  a.body.updateMatrixWorld(true);
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones, byBone = new Map(), v = new THREE.Vector3(), line = new THREE.Line3(), q = new THREE.Vector3();
  for (let i = 0; i < g.attributes.position.count; i += 2) {
    let k = 0; for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j;
    const n = bones[si.getComponent(i, k)].name; mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
    (byBone.get(n) ?? byBone.set(n, []).get(n)).push(v.clone());
  }
  const W = n => a.bone(n).getWorldPosition(new THREE.Vector3());
  const list = [...CAPS, ...extra].filter(([x, y]) => a.bone(x) && a.bone(y)).map(([x, y, re]) => {
    line.set(W(x), W(y)); const d = [...byBone].filter(([n]) => re.test(n)).flatMap(([, p]) => p.map(p => line.closestPointToPoint(p, true, q).distanceTo(p))).sort((m, n) => m - n);
    return { n: x, x: a.bone(x), y: a.bone(y), r: d.length ? d[Math.floor(d.length * 0.5)] : 0.02 * a.h };
  });
  const f = () => list.map(c => ({ n: c.n, a: c.x.getWorldPosition(new THREE.Vector3()), b: c.y.getWorldPosition(new THREE.Vector3()), r: c.r }));
  f.box = new THREE.Box3().setFromPoints([...byBone.values()].flat()); f.counts = Object.fromEntries([...byBone].map(([n, p]) => [n, p.length])); return f;
}

// In the air the feet hang: whenever the fighter's lowest joint is off the page, the ankles relax (toes down 45 degrees), the knees soften and
// the feet trail the motion on springs. It fades in over the first 2-7% of the height off the ground and out the same way before landing, so the
// feet are flat again at touchdown and the planted-foot hold takes over. a.air: how airborne (0-1) this frame.
export function airFeet(a, floorY) {
  a.body.updateMatrixWorld(true);
  const J = ["leftFoot", "rightFoot", "hips"].map(n => a.bone(n)), base = a.body.getWorldPosition(new THREE.Vector3()).y;  // ankles and hips, each against its own standing height (toes roll in the clips; hips sink when he lies down)
  const rest = J.map(b => b.getWorldPosition(new THREE.Vector3()).y - base);
  const legs = ["left", "right"].map(s => ({ up: a.bone(s + "UpperLeg"), lo: a.bone(s + "LowerLeg"), ft: a.bone(s + "Foot"), toe: a.bone(s + "Toes"), sp: new Spring(3.5, 0.55) }));
  const t0 = legs[0].toe.getWorldPosition(new THREE.Vector3()).sub(legs[0].ft.getWorldPosition(new THREE.Vector3())), hang = Math.atan2(-t0.y, Math.hypot(t0.x, t0.z)) + rad(40);  // 40 degrees below the standing foot
  a.air = 0;
  a.springs.push(s => {
    const e = Math.min(...J.map((b, i) => b.getWorldPosition(_v).y - floorY - rest[i])), w = sstep(clamp((e - 0.02 * a.h) / (0.05 * a.h))); a.air = w;
    for (const L of legs) {
      const ank = L.ft.getWorldPosition(new THREE.Vector3()), p = L.sp.at(ank, s), lag = p.clone().sub(ank); if (lag.length() > 0.1 * a.h) lag.setLength(0.1 * a.h);
      if (w < 1e-3) continue;
      ik2(L.up, L.lo, L.ft, ank.clone().addScaledVector(lag, 0.8 * w).add(new THREE.Vector3(0, 0.035 * a.h * w, 0)));  // trailing, knees soft
      const t = L.toe.getWorldPosition(new THREE.Vector3()).sub(L.ft.getWorldPosition(_w)), h = Math.hypot(t.x, t.z); if (h < 1e-6) continue;
      const pitch = Math.atan2(-t.y, h), want = pitch + Math.max(0, hang - pitch) * w;  // toes down; a foot already pointing lower is left as it is
      const d = new THREE.Vector3(t.x / h * Math.cos(want), -Math.sin(want), t.z / h * Math.cos(want));
      turnWorld(L.ft, _q.setFromUnitVectors(t.normalize(), d));
    }
  });
}
