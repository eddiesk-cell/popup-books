// acts.js — the characters act out the story while it is read ("Acting" in LIVE-MASTERPLAN.md).
//
// spread.json "acts": [{ "line": "1.3", "word": "monkey", "who": "kapi", "do": "walk", "to": "tree", "stop": 0.06 }, ...]
//   line    the story line it belongs to; it starts with that line,
//   word    or when the reader reaches this word of it (voice/timing.json),
//   after   or once the same character's previous act is done (the value only names that act, e.g. "walk").
//   wait    true: the reading waits for this act to finish before it reads the next line.
//   to, face, ride: a point [x,y,z] in Blender coordinates, an object's name, or a character's name.
// do:
//   walk | run | swim | sneak | stepback
//                      go along the ground or water to `to`, end `stop` short of it (0.05) and face it, or `face`.
//                      The Walk / Run / Swim / Sneak / Step Back clip plays in place at its stride (assets/motion.json);
//                      or Idle slides. A clip marked "back" there (Step Back) moves backwards: the character keeps its
//                      face to where it came from, and does not turn round when it arrives.
//                      "clip": "<name>" on any of them plays that looping gait instead (the grandparents' "Walk Out"), at the
//                      pace of its motion.json row (one warning, Walk's pace, if there is none); a clip the character lacks: the act's own gait, one warning;
//                      without "clip" nothing changes.
//   climb              go straight up to the top surface of `to` (an object: the end point lands ON it), then step
//                      onto it; `clip` (Climb Up) plays on the way, then it holds `then`. Walk to the foot of it first.
//                      With motion.json's {"rise", "cycle"} for the clip, it climbs in whole cycles, rising with them
//                      (a "loop": false clip is played again each cycle); without, it loops at a body height a second.
//   clip               play `clip` once, then hold `then`. A Throw's `to` names a character to catch the jamun (it turns
//                      to the thrower; without it, the nearest catches). Otherwise, with `to`, travel there over the clip (onto its top
//                      surface when it is an object). With `ride` (a character): end on its back and ride along,
//                      e.g. {"do": "clip", "clip": "Mount", "ride": "bobo"}.
//   face               turn toward `face`.
//   fly                fly in an arc to `to`, `up` above it; onto a character: perch (`up` defaults to 0.9 of its
//                      height) and ride along; with `bone` ("rightUpperArm"), perch on the skin over that bone
//                      and ride the bone through its moves (Pip on Mali's shoulder); with "beside": true as well, hover
//                      beside that perch, clear of her head, facing where she faces (Pip, a lantern spirit). Plays `clip` or Fly. Pace: Fly in
//                      motion.json, or 2.5 heights a second.
//   float              drift gently to `to` (or hover where it is), over `secs` or at 0.35 heights a second,
//                      swaying a little; plays `clip` or what it holds. Mali rising with the lanterns, coming down at her door.
//                      "sway": <metres> is how far it bobs up and down on the way (a float 0.012, a fly 0, when the key is absent); write "sway": 0 for a
//                      body that walks on the ground (a Walk clip under a float), or it dips 12 mm into the floor.
//   rise               `who` (a character) or `what` (an object of the spread) rises straight up by `by` (0.12) over
//                      `secs` (1.2), and stays up: moonstones from the river, Pip peeking. An object's rises add up (a
//                      lantern a game woke 0.06 rises 0.6 more on "rose", and stays there).
//   glow               `who` glows to `by` (1; 0 is as it was) over `secs` (0.8), and stays so: Pip glowing goodnight.
//   hide | show        `who` (a cast character) or `what` (an object of the spread, via the `find` hook) vanishes / returns at once, or
//                      over `fade` seconds. Hidden: not drawn, no shadow, no tap, and it does not sink or move. "Read again" shows all.
//   shape              {"do": "shape", "what": "<prop>", "key": "Step3", "to": 1, "secs": 1, "only": true}: eases that shape key (morph
//                      target) from its weight now to `to` over `secs` (1), on every mesh under the prop that has it. "only": true eases
//                      every other key of those meshes to 0 meanwhile. A growth Step1..Step7 is seven acts on successive lines or
//                      words. A missing key warns once and ends the act. "Read again" puts every key back to its starting weight.
//                      With "line": "tap:<name>" it runs when that thing is tapped (every tap, also mid-act), not from the reading;
//                      with also "nth": 3 it runs only on the 3rd tap of that thing: taps 1 and 2 play its ordinary tap acts (those with no
//                      "nth"; with none, nothing), and after the highest nth the count starts again; "Read again" resets it;
//                      "back": <secs> returns the keys it moved to the weights they had that long after it has arrived,
//                      over `secs`: the shy plant folds (Fold 1) and opens again after 3 s.
//                      "line": "open" runs an act as the spread is built and again on "Read again" (before the first frame is drawn): a
//                      growth starts with {"line": "open", "do": "shape", "what": "<prop>", "key": "Step1", "to": 1, "secs": 0, "only": true},
//                      since with every key at 0 the prop shows its rest shape. "back" returns a key to the weight it had before the tap.
//   mood               `who` shows its face_<mood> (natural, happy, warm, sad, upset, pity, worried, sleepy, surprise), under a
//                      face_socket on its head; natural at first. Any act may carry "mood" too. No faces in the model: nothing
//   hold               `who` takes `what` (an object or a character) in its `hand` ("right" or "left") until an act
//                      with "release": true lets it go. Optional, and a hold without them is as it always was:
//                      "grip": [x, y, z]  the prop is seated by this point of itself (its own local units) on the hand bone instead of by its
//                                         origin; a node named "hold_grip" in the prop's glb does the same and wins over the field.
//                      The grip lands on the character's PALM, not its wrist (R41): an empty named "palm_r" / "palm_l" under the hand bone of its glb
//                      (the hand bone's origin is the wrist, 4-5 cm short of a closed fist). No page key: a character with the empty is seated by it, one
//                      without (every book before the gourd) on the wrist as ever. A hold with no grip, aim or hold_grip keeps the old seat either way.
//                      With a palm and no "aim" the prop is a TOOL in a fist and turns with it: its handle (its longest side) lies across the palm, its
//                      head on the thumb's side in either hand, its blade or face (the next longest side) the way the knuckles point. What the prop's glb
//                      needs: a node "hold_grip" where the fist closes and a node "hold_tip" at its working end (the axe's edge, the mallet's face).
//                      Without a hold_tip the head is the end farther from the grip, so a prop gripped past its middle must have one.
//                      "upright": true    for a jar, a lamp, a bowl (a thing that must not tip): with a palm it keeps the turn it stands with on the page
//                                         and only its grip rides the palm; without the key it is laid across the fist as a tool is. No effect
//                                         with "aim", or on a character without a palm (nothing turns it there).
//                      "aim": [x, y, z] | "<name>"  the prop's long axis points from the hand at that page point or named thing, every
//                                         frame it is held (the axis: from the grip toward a node named "hold_tip" in the glb, else toward the
//                                         end of its longest side that is farthest from the grip). Without a grip the prop's origin is the hand.
//                      A release of a prop held with a grip or aim lets it fall to what is under it (the page or a prop's top, a downward ray
//                      from five points of its box) in 0.35 s, unless a fly on it follows; "fall": true makes any release do it, false never.
//   think              the line is `who`'s thought, not said aloud: while it is read `who` neither talks nor turns to
//                      anyone, and nobody turns to listen. With `face`, it looks there meanwhile (into the night).
// A character the manifest puts `on` another rides it (its `at` is the offset; with "bone", on that bone's perch, `at` unused)
// until an act moves it on its own feet;
// clip, face and hold acts do not unseat it.
// While a character's own words are read it turns to the nearest other character, who turns back, and Talk plays if it has one.
// Only timing and geometry live here; live.js says where things are, plays the clips and moves the props.
import { glow } from "./games.js";
import { AnimationMixer, Box3, DoubleSide, LoopOnce, Matrix4, Quaternion, Raycaster, Triangle, Vector3 } from "../vendor/three/three.module.js";  // the module the page maps "three" to: one three.js

const MOVE = { walk: "Walk", run: "Run", swim: "Swim", sneak: "Sneak", stepback: "Step Back" };
const PACE = { walk: 0.9, run: 2.2, swim: 1.0, sneak: 0.45, stepback: 0.5, fly: 2.5, float: 0.35, climb: 0.8 };  // body heights a second, when motion.json has no stride
const TURN = 5;  // radians a second

export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);  // a character's front is +z at yaw 0
const look = (ch, p) => { if (p && Math.hypot(p.x - ch.pos.x, p.z - ch.pos.z) > 0.01) ch.want = yawTo(ch.pos, p); };  // standing on it: keep the heading
// a perch on a bone of `on` (Pip on Mali's "rightUpperArm"): the first skin straight above that bone, the top of the shoulder
// (not the hair hanging over it), kept as that point of the skin (its triangle and the weights on its corners), so the rider's
// feet stay on it however her skin moves (walk, hop, sit); without skin there, a point in the bone's own frame
// her matrices as posed this frame; updateMatrixWorld, not updateWorldMatrix, so a skinned mesh's bind inverse follows her too
// (it is what turns a skinned vertex back into her own space: stale, the perch lags a frame behind wherever she walks or turns)
const fresh = root => (root.parent?.updateWorldMatrix(true, false), root.updateMatrixWorld(true));
const skinned = root => { let s = false; root?.traverse(o => (s ||= !!o.isSkinnedMesh)); return s; };
// a skinned mesh's vertices where they are drawn, without three's per-vertex objects (getVertexPosition, ~0.3 µs a vertex, made a ray
// down Bobo 47 ms): its arrays copied once, each bone's matrix once a call, four weighted sums a vertex, three's own order of products
const rig = m => (m.userData.rig ??= (() => {
  const g = m.geometry, A = (a, n) => {
    const src = a.isInterleavedBufferAttribute ? a.data.array : a.array, st = a.isInterleavedBufferAttribute ? a.data.stride : n, o = a.offset ?? 0;
    const k = !a.normalized ? 1 : src instanceof Int8Array ? 127 : src instanceof Int16Array ? 32767 : 2 ** (8 * src.BYTES_PER_ELEMENT) - 1, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = Math.max(src[i * st + o + c] / k, -1);  // three's denormalize (quantized positions too)
    return out;
  };
  return { p: A(g.attributes.position, 3), j: A(g.attributes.skinIndex, 4), w: A(g.attributes.skinWeight, 4), ix: g.index?.array, n: g.attributes.position.count,
    M: m.skeleton.bones.map(() => new Matrix4()), W: new Matrix4() };  // its bones' matrices, filled each call
})());
const drawn = (m, ids, out) => {  // world positions [x,y,z,...] of those vertices (all without ids) as its bones last stood (fresh() first)
  const { p, j, w, n, M, W } = rig(m), N = ids ? ids.length : n, P = W.multiplyMatrices(m.matrixWorld, m.bindMatrixInverse).elements;
  const E = m.skeleton.bones.map((b, k) => M[k].multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[k]).multiply(m.bindMatrix).elements);
  out ??= new Float32Array(3 * N);
  for (let q = 0; q < N; q++) {
    const i = ids ? ids[q] : q, x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
    let X = 0, Y = 0, Z = 0;
    for (let c = 4 * i; c < 4 * i + 4; c++) { const a = w[c], e = a && E[j[c]]; if (a) X += a * (e[0] * x + e[4] * y + e[8] * z + e[12]), Y += a * (e[1] * x + e[5] * y + e[9] * z + e[13]), Z += a * (e[2] * x + e[6] * y + e[10] * z + e[14]); }
    out[3 * q] = P[0] * X + P[4] * Y + P[8] * Z + P[12]; out[3 * q + 1] = P[1] * X + P[5] * Y + P[9] * Z + P[13]; out[3 * q + 2] = P[2] * X + P[6] * Y + P[10] * Z + P[14];
  }
  return out;
};
const corner = (ix, t) => (ix ? ix[t] : t);
const parts = m => (rig(m).parts ??= (() => {  // its vertices and triangles in small lumps (a 30th of its size) of their strongest bone's frame, bind pose:
  const { p, j, w, n, ix } = rig(m), L = m.skeleton.boneInverses.map(bi => new Matrix4().multiplyMatrices(bi, m.bindMatrix)), v = new Vector3(), of = [], lumps = new Map();
  const at = i => { let b = 0; for (let c = 1; c < 4; c++) if (w[4 * i + c] > w[4 * i + b]) b = c; return v.fromArray(p, 3 * i).applyMatrix4(L[j[4 * i + b]]), j[4 * i + b]; };
  const cell = new Box3().setFromArray(p).getSize(v).length() / 30;  // what a choice near a seat need draw is the lumps near it
  for (let i = 0; i < n; i++) {
    const k = at(i), key = `${k} ${Math.floor(v.x / cell)} ${Math.floor(v.y / cell)} ${Math.floor(v.z / cell)}`;
    if (!lumps.has(key)) lumps.set(key, { k, vs: [], ts: [], c: new Vector3(), r: 0 });
    const o = (of[i] = lumps.get(key)); o.vs.push(i); o.c.add(v);
  }
  lumps.forEach(o => o.c.divideScalar(o.vs.length));
  for (let i = 0; i < n; i++) at(i), (of[i].r = Math.max(of[i].r, v.distanceTo(of[i].c)));
  for (let t = 0; t < (ix ? ix.length : n); t += 3) of[corner(ix, t)].ts.push(t);
  return [...lumps.values()];
})());
const skin = (on, from, dir, far) => {  // the first skin of `on` a ray meets, as that point of the skin: its triangle and corner weights
  fresh(on.model);
  const ms = []; on.model.traverse(o => o.isMesh && o.visible && ms.push(o));
  if (!dir.x && !dir.z && ms.length && ms.every(o => o.isSkinnedMesh)) {  // straight up or down a skin: each triangle over that point, the nearest
    let best = null;
    for (const m of ms) {
      const P = drawn(m), { ix, n } = rig(m);
      for (let t = 0; t < (ix ? ix.length : n); t += 3) {
        const a = 3 * corner(ix, t), b = 3 * corner(ix, t + 1), c = 3 * corner(ix, t + 2), den = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]);
        if (Math.abs(den) < 1e-14) continue;
        const l1 = ((P[b + 2] - P[c + 2]) * (from.x - P[c]) + (P[c] - P[b]) * (from.z - P[c + 2])) / den, l2 = ((P[c + 2] - P[a + 2]) * (from.x - P[c]) + (P[a] - P[c]) * (from.z - P[c + 2])) / den;
        if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
        const y = l1 * P[a + 1] + l2 * P[b + 1] + (1 - l1 - l2) * P[c + 1], d = (y - from.y) * dir.y;
        if (d >= 0 && d <= far && !(best?.d <= d)) best = { d, m, idx: [a / 3, b / 3, c / 3], w: [l1, l2, 1 - l1 - l2], y };
      }
    }
    return best && { root: on.model, m: best.m, idx: best.idx, w: best.w, at: new Vector3(from.x, best.y, from.z) };
  }
  const sides = []; on.model.traverse(o => o.isMesh && (sides.push([o.material, o.material.side]), (o.material.side = DoubleSide)));  // both faces: it may leave from inside
  const hit = new Raycaster(from, dir, 0, far).intersectObject(on.model, true).find(i => i.object.visible && i.face);
  sides.forEach(([m, sd]) => (m.side = sd));
  if (!hit) return null;
  const m = hit.object, idx = [hit.face.a, hit.face.b, hit.face.c], v = idx.map(i => m.getVertexPosition(i, new Vector3()).applyMatrix4(m.matrixWorld));
  return { root: on.model, m, idx, w: new Triangle(...v).getBarycoord(hit.point, new Vector3()).toArray(), at: hit.point };
};
// a rider's seat and soles against its skinned mount's skin straight below (lengths at the pair's full size; `sc`: the size they stand at
// now, both growing as one): choose() takes, of the seat and of each sole, the vertices those bones mostly move within 3 cm of their
// lowest, and the mount's triangles within 5 mm round them, every second; gap(): for the seat and for the soles the closest of those
// rider vertices as now placed over the skin as now posed, read on the skin triangle straight under each (a vertex's height, or a grid
// point's, would stand for a slope's top), and the seat's height over the soles: carry() lets the pose decide which bears. Each well under
// a millisecond, so both run in the frame they are needed
const contact = (ch, on) => {
  const kid = [], mnt = [];
  ch.model.traverse(m => m.isSkinnedMesh && kid.push(m)); on.model.traverse(m => m.isSkinnedMesh && m.visible && mnt.push(m));
  if (!kid.length || !mnt.length) return null;
  const of = re => kid.map(m => {
    const { j, w, n } = rig(m), ids = m.skeleton.bones.map(b => re.test(b.name)), out = [];
    for (let i = 0; i < n; i++) for (let c = 4 * i; c < 4 * i + 4; c++) if (w[c] > 0.5 && ids[j[c]]) { out.push(i); break; }
    return out;
  });
  const zones = [of(/^hips$/), of(/^left.*(Foot|Toe)/), of(/^right.*(Foot|Toe)/)].map(all => ({ all }));  // the seat and each sole, each on its own patch of skin
  const pick = (z, sc) => {  // a part's vertices within 3 cm of its lowest, and the skin within 5 mm round them
    const e = 0.005 * sc, P = kid.map((m, k) => drawn(m, z.all[k])), low = Math.min(...P.map(o => o.filter((_, i) => i % 3 === 1).reduce((a, y) => Math.min(a, y), Infinity))) + 0.03 * sc;
    let lx = Infinity, hx = -Infinity, lz = Infinity, hz = -Infinity;
    z.pts = z.all.map((ids, k) => ids.filter((_, q) => P[k][3 * q + 1] <= low && ((lx = Math.min(lx, P[k][3 * q])), (hx = Math.max(hx, P[k][3 * q])), (lz = Math.min(lz, P[k][3 * q + 2])), (hz = Math.max(hz, P[k][3 * q + 2])), true)));
    z.patch = mnt.map(m => {  // only the lumps whose reach (and 1.5 cm for a bend between bones) comes near the region: their vertices and triangles
      const { ix, n } = rig(m), W = new Matrix4().multiplyMatrices(m.matrixWorld, m.bindMatrixInverse), Ms = m.skeleton.bones.map(b => new Matrix4().multiplyMatrices(W, b.matrixWorld)), c = new Vector3();
      const near = parts(m).filter(o => { c.copy(o.c).applyMatrix4(Ms[o.k]); const r = o.r * Ms[o.k].getMaxScaleOnAxis() + 0.015 * sc; return c.x + r >= lx - e && c.x - r <= hx + e && c.z + r >= lz - e && c.z - r <= hz + e; });
      const ids = near.flatMap(o => o.vs), P = drawn(m, ids), slot = (rig(m).slot ??= new Int32Array(n).fill(-1)), vs = [], tri = [];
      ids.forEach((i, q) => { if (P[3 * q] >= lx - e && P[3 * q] <= hx + e && P[3 * q + 2] >= lz - e && P[3 * q + 2] <= hz + e) slot[i] = vs.push(i) - 1; });
      for (const o of near) for (const t of o.ts) { const a = slot[corner(ix, t)], b = slot[corner(ix, t + 1)], c = slot[corner(ix, t + 2)]; if (a >= 0 && b >= 0 && c >= 0) tri.push(3 * a, 3 * b, 3 * c); }
      vs.forEach(i => (slot[i] = -1));  // as found, for the next choice
      return { m, vs, tri, buf: new Float32Array(3 * vs.length) };
    });
    z.rb = z.pts.map(ids => new Float32Array(3 * ids.length));
    z.box = local(z.pts.map((ids, k) => drawn(kid[k], ids)), 0.005);
  };
  const local = (R, e) => {  // where those rider vertices stand in the mount's own frame (x, z; its walk, roll and bloom aside), and a margin
    const L = new Matrix4().copy(on.body.matrixWorld).invert().elements, k = e / on.body.matrixWorld.getMaxScaleOnAxis(), b = [Infinity, -Infinity, Infinity, -Infinity];
    for (const o of R) for (let i = 0; i < o.length; i += 3) {
      const x = L[0] * o[i] + L[4] * o[i + 1] + L[8] * o[i + 2] + L[12], z = L[2] * o[i] + L[6] * o[i + 1] + L[10] * o[i + 2] + L[14];
      b[0] = Math.min(b[0], x); b[1] = Math.max(b[1], x); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], z);
    }
    return [b[0] - k, b[1] + k, b[2] - k, b[3] + k];
  };
  const choose = sc => { fresh(ch.model); fresh(on.model); zones.forEach(z => pick(z, sc)); };
  let T = new Float32Array(0), span = new Int32Array(0), list = new Int32Array(0), at = new Int32Array(0), fill = at;  // kept from call to call: little garbage 60 times a second
  const read = (z, sc, g) => {  // the part's closest, if closer than g; its rider vertices as now placed
    const R = kid.map((m, k) => drawn(m, z.pts[k], z.rb[k])), C = 0.00125 * sc, b = local(R, 0);
    z.moved = b[0] < z.box[0] || b[1] > z.box[1] || b[2] < z.box[2] || b[3] > z.box[3];  // off its patch
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; z.low = Infinity;
    for (const o of R) for (let i = 0; i < o.length; i += 3) x0 = Math.min(x0, o[i]), x1 = Math.max(x1, o[i]), z0 = Math.min(z0, o[i + 2]), z1 = Math.max(z1, o[i + 2]), (z.low = Math.min(z.low, o[i + 1]));
    if (x0 === Infinity) return g;
    // each skin triangle (its corners, flat) listed in the 1.25 mm cells its x, z span covers; a rider vertex then reads the triangles of
    // its own cell that hold it, at its own x, z
    const nx = Math.round((x1 - x0) / C) + 1, nz = Math.round((z1 - z0) / C) + 1, nt = z.patch.reduce((n, { tri }) => n + tri.length / 3, 0);
    if (at.length < nx * nz + 1) (at = new Int32Array(2 * (nx * nz + 1))), (fill = new Int32Array(at.length));
    at.fill(0, 0, nx * nz + 1);
    if (T.length < 9 * nt) (T = new Float32Array(18 * nt)), (span = new Int32Array(8 * nt));
    let s = 0, high = -Infinity;
    for (const { m, vs, tri, buf } of z.patch) {
      const P = drawn(m, vs, buf);
      for (let t = 0; t < tri.length; t += 3) {
        const a = tri[t], b = tri[t + 1], c = tri[t + 2], w = 9 * s;
        T[w] = P[a]; T[w + 1] = P[a + 1]; T[w + 2] = P[a + 2]; T[w + 3] = P[b]; T[w + 4] = P[b + 1]; T[w + 5] = P[b + 2]; T[w + 6] = P[c]; T[w + 7] = P[c + 1]; T[w + 8] = P[c + 2];
        high = Math.max(high, P[a + 1], P[b + 1], P[c + 1]);
        const g0 = Math.max(0, Math.round((Math.min(P[a], P[b], P[c]) - x0) / C)), g1 = Math.min(nx - 1, Math.round((Math.max(P[a], P[b], P[c]) - x0) / C));
        const h0 = Math.max(0, Math.round((Math.min(P[a + 2], P[b + 2], P[c + 2]) - z0) / C)), h1 = Math.min(nz - 1, Math.round((Math.max(P[a + 2], P[b + 2], P[c + 2]) - z0) / C));
        span[4 * s] = g0; span[4 * s + 1] = g1; span[4 * s + 2] = h0; span[4 * s + 3] = h1; s++;
        for (let gx = g0; gx <= g1; gx++) for (let gz = h0; gz <= h1; gz++) at[gx * nz + gz + 1]++;
      }
    }
    for (let q = 0; q < nx * nz; q++) at[q + 1] += at[q];
    if (list.length < at[nx * nz]) list = new Int32Array(2 * at[nx * nz]);
    fill.set(at.subarray(0, nx * nz + 1));
    for (let u = 0; u < s; u++) for (let gx = span[4 * u]; gx <= span[4 * u + 1]; gx++) for (let gz = span[4 * u + 2]; gz <= span[4 * u + 3]; gz++) list[fill[gx * nz + gz]++] = 9 * u;
    for (const step of [16, 1]) for (const o of R) for (let i = 0; i < o.length; i += 3 * step) {  // a sparse pass first, for a close bound
      if (o[i + 1] - high >= g) continue;  // as high over the highest skin as the closest gap so far: it cannot be closer
      const x = o[i], z = o[i + 2], q = Math.round((x - x0) / C) * nz + Math.round((z - z0) / C);
      let top = -Infinity;
      for (let u = at[q]; u < at[q + 1]; u++) {
        const w = list[u], ax = T[w], az = T[w + 2], bx = T[w + 3], bz = T[w + 5], cx = T[w + 6], cz = T[w + 8], den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(den) < 1e-14) continue;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
        if (l1 < -1e-6 || l2 < -1e-6 || l1 + l2 > 1 + 1e-6) continue;
        top = Math.max(top, l1 * T[w + 1] + l2 * T[w + 4] + (1 - l1 - l2) * T[w + 7]);
      }
      if (top > -Infinity) g = Math.min(g, o[i + 1] - top);
    }
    return g;
  };
  const gap = sc => {  // fresh(ch.model) first, with the rider where it is to be drawn: the seat's gap, the soles', and the seat's height over
    fresh(on.model);  // the soles (full-size lengths); a part that has left its patch (a foot swung out) is chosen again at once
    const [seat, ...soles] = zones.map(z => { const v = read(z, sc, Infinity); return (z.moved ? (pick(z, sc), read(z, sc, Infinity)) : v) / sc; });
    const sole = Math.min(...soles), at = v => (v === Infinity ? null : v);
    return { seat: at(seat), soles: at(sole), h: (zones[0].low - Math.min(zones[1].low, zones[2].low)) / sc };
  };
  return { choose, gap };
};
// a held bowl or lamp, held by its rim with the bowl outboard of the hand: her arm hangs at her side, and stood on the hand a bowl rings
// her wrist and forearm. `it`: the held prop (its body's origin is its foot). at(v): where its foot goes now, laid out each frame from
// the hand as it now stands (its middle, its outer edge along her side) and the bowl as it now turns (its reach back toward the hand),
// the rim just over the hand's middle: it stays at her fingers however the hand turns or swings
export const byRim = (ch, bone, it) => {
  let m = null; ch.model.traverse(o => o.isSkinnedMesh && o.skeleton.bones.includes(bone) && (m = o));
  const k = m?.skeleton.bones.indexOf(bone), ids = m ? parts(m).filter(o => o.k === k).flatMap(o => o.vs) : [];
  if (!ids.length) return null;
  const buf = new Float32Array(3 * ids.length), c = new Vector3(), d = new Vector3(), w = new Vector3(), q = new Quaternion();
  let side = 0;
  const at = v => {
    fresh(ch.model); fresh(it.model);
    const P = drawn(m, ids, buf), foot = it.body.getWorldPosition(w).clone();
    c.set(0, 0, 0); for (let i = 0; i < P.length; i += 3) c.x += P[i], c.y += P[i + 1], c.z += P[i + 2];
    c.divideScalar(ids.length);
    d.set(1, 0, 0).applyQuaternion(ch.body.getWorldQuaternion(q)).setY(0).normalize();  // her side: that hand's way
    side ||= Math.sign(c.clone().sub(ch.body.getWorldPosition(w)).dot(d)) || 1;
    d.multiplyScalar(side);
    let out = 0, near = 0, top = -Infinity;
    for (let i = 0; i < P.length; i += 3) out = Math.max(out, (P[i] - c.x) * d.x + (P[i + 2] - c.z) * d.z);
    it.model.traverse(o => { if (o.isMesh) for (let i = 0; i < o.geometry.attributes.position.count; i++) w.fromBufferAttribute(o.geometry.attributes.position, i).applyMatrix4(o.matrixWorld), (near = Math.max(near, (foot.x - w.x) * d.x + (foot.z - w.z) * d.z)), (top = Math.max(top, w.y)); });
    return v.copy(c).addScaledVector(d, out + near + 0.001).setY(c.y - (top - foot.y) + 0.002);
  };
  return { at };
};
// a held tool seated by its grip and aimed (hold acts "grip" / "aim", R33). holdOf: what the prop holds in its own local units, read once as it is
// taken (null: neither field nor a "hold_grip" node, so the old seat); seatHeld: each frame, turn it from its rest so its axis looks along hand -> to
// (from rest each time, so no roll builds up), then move it so its grip is on the hand; dropOf: how far down a released prop falls
export const holdOf = (o, a) => {
  if (!o.getObjectByName("hold_grip") && !a.grip && a.aim == null) return null;  // touches nothing: a hold without the new fields is as it was
  o.updateWorldMatrix(true, true);
  const at = n => { const k = o.getObjectByName(n); return k && o.worldToLocal(k.getWorldPosition(new Vector3())); };
  const grip = at("hold_grip") ?? (a.grip ? new Vector3(...a.grip) : a.aim != null ? new Vector3() : null);
  if (!grip) return null;
  const rest = (o.userData.restQ ??= o.quaternion.clone());
  let axis = null, turn = null;
  if (a.aim == null && a.palm && a.upright) o.quaternion.copy(rest);  // R41 "upright" (a jar, a lamp): it stands as the page built it, whatever an earlier hold turned it to; only its grip rides the palm
  else if (a.aim != null || a.palm) {  // R41: a palm also needs the handle's axis (the fist turns the prop)
    const tip = at("hold_tip"), e = a.aim != null ? 0 : 1e-6;  // e: sides or ends this close (of the size) count as equal, so a float error never picks; 0 with an aim: the tests of R33 as they were
    let front = null;
    if (a.aim != null && tip) axis = tip.sub(grip);
    else {  // shortcut: the box of the meshes' own boxes (a skinned prop's rest pose); fine for a tool, upgrade by naming a "hold_tip" node
      const inv = new Matrix4().copy(o.matrixWorld).invert(), box = new Box3(), m = new Box3();
      o.traverse(c => c.isMesh && (c.geometry.boundingBox ?? c.geometry.computeBoundingBox(), box.union(m.copy(c.geometry.boundingBox).applyMatrix4(new Matrix4().multiplyMatrices(inv, c.matrixWorld)))));
      const s = box.getSize(new Vector3()), [k, k2] = ["x", "y", "z"].sort((p, q) => (Math.abs(s[q] - s[p]) > e * (s[p] + s[q]) ? s[q] - s[p] : 0));  // the longest side, then the next (equal sides: x, y, z)
      const end = k => new Vector3().setComponent("xyz".indexOf(k), (tip && Math.abs(tip[k] - grip[k]) > e * s[k] ? tip[k] - grip[k] : box.max[k] - grip[k] - (grip[k] - box.min[k]) + e * s[k]) >= 0 ? 1 : -1);  // which end of a side: toward the prop's hold_tip (its working end) when it has one off the grip that way, else the end farther from the grip (a grip in the middle: the + end)
      axis = end(k); front = end(k2);  // the handle toward the head; the blade or face
    }
    axis.normalize();
    const t = a.palm?.name === "palm_l" ? -1 : 1;  // the thumb's side: +X of palm_r, -X of palm_l (both empties: +Y along the fingers, +Z out of the palm, so X swaps sides between the hands)
    if (a.palm) turn = front ? new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(axis.clone().multiplyScalar(t), front, axis.clone().cross(front).multiplyScalar(t)).transpose()) : new Quaternion().setFromUnitVectors(axis, new Vector3(t, 0, 0));  // prop -> palm: head to the thumb, blade or face the way the knuckles point (the same grip mirrored in the other hand); with a hold_tip aim axis only the head
  }
  return { grip, axis, turn, rest, palm: a.palm };
};
export const seatHeld = (o, h, hand, to) => {
  if (h.palm) h.palm.updateWorldMatrix(true, false), hand = h.palm.getWorldPosition(new Vector3());  // the palm point, not the wrist the bone's origin is
  if (h.axis && to && to.distanceToSquared(hand) > 1e-12) {
    o.quaternion.copy(h.rest); o.updateWorldMatrix(true, false);
    const pq = o.parent.getWorldQuaternion(new Quaternion()), a = h.axis.clone().transformDirection(o.matrixWorld);
    o.quaternion.premultiply(pq).premultiply(new Quaternion().setFromUnitVectors(a, to.clone().sub(hand).normalize())).premultiply(pq.invert());
  } else if (h.turn) o.quaternion.copy(o.parent.getWorldQuaternion(new Quaternion()).invert().multiply(h.palm.getWorldQuaternion(new Quaternion())).multiply(h.turn));  // R41, no aim: a tool in a fist turns with it
  o.updateWorldMatrix(true, false);
  o.position.copy(o.parent.worldToLocal(o.getWorldPosition(new Vector3()).add(hand).sub(o.localToWorld(h.grip.clone()))));
};
export const dropOf = (o, root) => {  // a 9 x 9 grid of downward rays over the prop's box, against only the meshes under it; the highest support counts (a stick across a rim rests on the rim)
  const box = new Box3().setFromObject(o), col = new Box3(new Vector3(box.min.x, -Infinity, box.min.z), new Vector3(box.max.x, box.min.y + 0.002, box.max.z)), under = [], b = new Box3();
  root.traverse(m => { if (!m.isMesh || /card|wave|grass|crest/.test(m.name) || !b.setFromObject(m).intersectsBox(col)) return; for (let p = m; p; p = p.parent) if (p === o) return; under.push(m); });  // the paper's real height, as live.js's surf() reads it
  const rc = new Raycaster(), dn = new Vector3(0, -1, 0), v = new Vector3();
  let top = -Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) (rc.set(v.set(box.min.x + (box.max.x - box.min.x) * i / 8, box.min.y + 0.002, box.min.z + (box.max.z - box.min.z) * j / 8), dn), top = Math.max(top, rc.intersectObjects(under, false)[0]?.point.y ?? -Infinity));
  return top > -Infinity ? Math.max(0, box.min.y - top) : 0;
};
// a character's face: a "face_<mood>" object (a plate under a "face_socket" on its head, or a whole premade head) per mood (natural, happy, warm, sad, upset, pity, worried,
// sleepy, surprise); exactly the one asked for shows. A model without them (no faces yet): nothing to do
export const mood = (ch, m) => { const f = []; ch.model?.traverse(o => /^face_[a-z]+$/.test(o.name) && o.name !== "face_socket" && f.push(o)); if (!f.some(o => o.name === `face_${m}`)) return; f.forEach(o => o.scale.setScalar((o.visible = o.name === `face_${m}`) ? 1 : 0)); };  // anywhere in the model: premade skinned heads are not the socket's children (turtle R12); a mood the model lacks keeps the face it has (gourd R29: s01's "surprise" hid every head); the glb hides spares at scale 0 (glTF has no visibility)
const perch = (on, name) => {
  const b = on.model?.getObjectByName(name);
  if (!b) return null;
  fresh(on.model);
  const p = b.getWorldPosition(new Vector3());  // up from inside her: the first skin it leaves through
  return skin(on, p, new Vector3(0, 1, 0), 0.3 * on.height) ?? { bone: b, off: p.applyMatrix4(b.matrixWorld.clone().invert()) };
};
const onBone = pp => {  // where the perch is now
  if (!pp.m) return pp.bone.updateWorldMatrix(true, false), pp.off.clone().applyMatrix4(pp.bone.matrixWorld);
  fresh(pp.root);
  return pp.idx.reduce((s, i, k) => s.addScaledVector(pp.m.getVertexPosition(i, new Vector3()).applyMatrix4(pp.m.matrixWorld), pp.w[k]), new Vector3());
};
// riding: the rider's offset and heading are kept in the mount's own frame, so they turn with it; with a bone, on its perch
export const mount = (ch, on, at, bone = ch.c?.bone, beside = ch.c?.beside) => {
  const up = new ch.pos.constructor(0, 1, 0);
  ch.ride = { on, off: ch.pos.clone().sub(at(on)).applyAxisAngle(up, -on.yaw), dyaw: beside ? 0 : ch.yaw - on.yaw, up, bone, beside };
  if (beside) ch.want = null;  // he faces where she faces from now on, not where he flew from
};
// "beside": the rider hovers by the perch instead of standing on it (Pip, a lantern spirit, at Mali's shoulder), clear of her
// head both from in front of her and from the reader's eye: out along her side by her head's reach plus his own half-width, and
// when she turns side-on to the reader, back behind her shoulder line as far as that view needs; over it a little, bobbing; he
// faces where she faces. `eye`: the reader's eye, the viewer's camera (Acting's `cam`)
export const besidePoint = (ch, on, pp, p, eye) => {  // exported for the checks
  const side = new Vector3(Math.cos(on.yaw), 0, -Math.sin(on.yaw)), back = new Vector3(-Math.sin(on.yaw), 0, -Math.cos(on.yaw));
  const head = on.model.getObjectByName("head")?.getWorldPosition(new Vector3()) ?? p.clone();
  pp.side ??= Math.sign(p.clone().sub(on.body.position).dot(side)) || 1;  // her side the perch is on, kept: a hop never swaps it
  pp.headR ??= reach(on, head); pp.half ??= halfWidth(ch);
  side.multiplyScalar(pp.side);
  const rel = p.clone().sub(head).setY(0), s = Math.max(0, pp.headR + pp.half[0] + 0.01 - rel.dot(side)) + rel.dot(side);  // across: clear from her front
  let b = 0.012;  // a little behind her shoulder line, more when the reader sees her side-on
  if (eye) {
    const v = head.clone().sub(eye).setY(0).normalize(), perp = new Vector3(-v.z, 0, v.x);  // across the reader's view
    const R = pp.headR + 0.01 + Math.abs(perp.dot(side)) * pp.half[0] + Math.abs(perp.dot(back)) * pp.half[1];  // his half-width as the reader sees it
    const A = side.dot(perp) * s + back.dot(perp) * b, B = back.dot(perp);
    if (Math.abs(A) < R && Math.abs(B) > 0.05) b = Math.min(0.15, b + Math.max(0, (R - A * Math.sign(B)) / Math.abs(B)));
  }
  return head.clone().setY(p.y).addScaledVector(side, s).addScaledVector(back, b).add(rel.clone().sub(side.clone().multiplyScalar(rel.dot(side))))
    .setY(p.y + 0.01 + 0.004 * Math.sin(performance.now() / 600));
};
const halfWidth = ch => {  // his half-width across his body and his half-depth, his own size (he faces where she faces): any turn
  ch.body.updateMatrixWorld(true);
  const inv = ch.body.matrixWorld.clone().invert(), b = new Box3();
  (ch.model ?? ch.body).traverse(m => m.isMesh && (m.geometry.boundingBox ?? m.geometry.computeBoundingBox(), b.union(m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)))));
  return [(b.max.x - b.min.x) / 2 * (ch.s0 ?? 1), (b.max.z - b.min.z) / 2 * (ch.s0 ?? 1)];
};
const reach = (on, head) => {  // how far her head (the skin above her neck, hair and all) reaches out from the head bone
  const neck = on.model.getObjectByName("neck")?.getWorldPosition(new Vector3()).y ?? head.y, v = new Vector3();
  let r = 0;
  on.model.traverse(m => { if (m.isMesh && m.visible) for (let i = 0; i < m.geometry.attributes.position.count; i++) {
    m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); if (v.y > neck) r = Math.max(r, Math.hypot(v.x - head.x, v.z - head.z)); } });
  return r;
};
export const carry = (ch, at, eye, last) => {  // with the mount's whole turn when it has a body (a boat that rocks: the rider's feet stay on its deck)
  const r = ch.ride, q = r.on.body?.quaternion;
  if (r.bone && (r.perch ??= perch(r.on, r.bone))) { const p = onBone(r.perch); return void ch.pos.copy(r.beside ? besidePoint(ch, r.on, r.perch, p, eye) : p); }  // found once its pose is live
  // a gap only between two skins (Kapi on Bobo), held from the mount's first visible frame: the rider grows with it as one piece,
  // its lengths (offset, gap, lift) at their full size times `f`. On a deck, or skinless, the page's height over its mount
  r.held ??= r.gap != null && skinned(ch.model) && skinned(r.on.model);
  const f = r.held && r.on.s0 ? r.on.body.scale.x / r.on.s0 : 1;
  if (r.held) { ch.body.scale.setScalar(ch.s0 * Math.max(f, 1e-4)); ch.body.visible = r.on.body.visible; }
  (q ? ch.pos.copy(r.off).applyQuaternion(q) : ch.pos.copy(r.off).applyAxisAngle(r.up, r.on.yaw)).multiplyScalar(f).add(at(r.on));
  // and on the back under it: the skin straight below where the page stands the rider carries it up, down and over through every clip
  // (a croc's breath, the waves game's roll). Unheld, taken as the mount appears and again once it stands full size
  const full = !r.on.s0 || r.on.body.scale.x >= r.on.s0 * 0.999;
  if ((r.seat === undefined || (full && !r.full && !r.held)) && r.on.model && r.on.body.visible) {  // under the rider's hips (its seat), else its root
    r.full = full;
    const hips = ch.model?.getObjectByName("hips"), at = ch.pos.clone().add(hips ? hips.getWorldPosition(new Vector3()).sub(ch.body.getWorldPosition(new Vector3())).setY(0) : new Vector3());
    const s = skin(r.on, at.add(new Vector3(0, r.on.height, 0)), new Vector3(0, -1, 0), 2 * r.on.height);
    r.seat = s && Object.assign(s, { off: ch.pos.clone().sub(s.at).divideScalar(f), q: q?.clone().invert() });  // false: nothing under it (beside, not on)
    if (r.seat && r.held) r.seat.off.y = r.gap;  // its gap over the skin under its hips, until measured
    r.lift = 0;
  }
  if (!r.seat) return;
  ch.pos.copy(onBone(r.seat)).add((r.seat.q ? r.seat.off.clone().applyQuaternion(r.seat.q).applyQuaternion(q) : r.seat.off.clone()).multiplyScalar(f));
  if (r.held && last && (r.contact ??= contact(ch, r.on) ?? false)) {
    // its seat (sitting, riding: the clip shown) or soles that close to the skin, measured in the frame's last carry (`last`) with the rider
    // posed and placed as it is to be drawn, so the lift is exact each frame: nothing to ease
    const now = performance.now();
    ch.body.position.copy(ch.pos).addScaledVector(r.up, r.lift * f); fresh(ch.model);
    if (!(now - r.chosen < 1000)) r.contact.choose(f), (r.chosen = now);
    const m = r.contact.gap(f), H = ch.height ?? 0.15, low = Math.min(m.seat ?? Infinity, m.soles ?? Infinity);
    // a sitting or riding clip holds the seat, any other the soles (switched with the clip, as it is cross-faded); through a clip played on
    // the mount (a Sit Down, a Stand Up: `stay`), which starts in one and ends in the other, the pose decides: the soles, handed to the
    // seat as its height over them falls from 2 cm to 1 (and back on standing up)
    const w = r.stay ? Math.min(1, Math.max(0, (0.133 * H - m.h) / (0.067 * H))) : +/Sit|Ride/.test(ch.cur?.getClip().name ?? ch.hold);
    const g = m.seat != null && w ? w * m.seat + (1 - w) * low : low;
    if (g < Infinity) r.lift += r.gap - g;
  }
  if (r.held) ch.pos.addScaledVector(r.up, r.lift * f);
};

// A paper puppet story character ("model": "puppet:tong"), from ambient.js's puppet() ({root, pins, def, size}), as a model the
// viewer loads like a glTF ({scene, animations}), so every act above works on it as on a 3D character. Each move of its
// PUPPETS.md entry (hinge angles swung at its cycles a second) is a looping clip named as a model's are ("talk" -> "Talk",
// "sit-idle" -> "Sit Idle"); "Idle" is its rest and "Walk" its gait. The card always faces the reader, flipped to look the way
// its character faces: a flat puppet is never turned edge-on.
export function puppetModel(THREE, { root, pins, def, size }) {
  const top = def.parts?.[0] ?? "body", hinges = def.hinges ?? {}, Z = new THREE.Vector3(0, 0, 1);
  for (const [n, pin] of Object.entries(pins)) pin.name = n;  // the clips find the pins by name
  const bake = (name, move, hz) => {  // whole cycles, about a second and more: rest -> the move's angles -> rest
    const n = Math.max(1, Math.round(1.2 * hz)), T = n / hz, times = Array.from({ length: 8 * n + 1 }, (_, i) => (T * i) / (8 * n));
    const k = t => 0.5 - 0.5 * Math.cos(2 * Math.PI * hz * t), p0 = pins[top].position;
    const tracks = Object.entries(move).flatMap(([h, v]) => {
      if (h === "_lift") return [new THREE.VectorKeyframeTrack(`${top}.position`, times, times.flatMap(t => [p0.x, p0.y + v * size * k(t), p0.z]))];
      const pin = h === "_tilt" ? top : h, [, lo = -180, hi = 180] = hinges[pin] ?? [];
      return pins[pin] ? [new THREE.QuaternionKeyframeTrack(`${pin}.quaternion`, times,
        times.flatMap(t => new THREE.Quaternion().setFromAxisAngle(Z, (Math.min(hi, Math.max(lo, v * k(t))) * Math.PI) / 180).toArray()))] : [];
    });
    return new THREE.AnimationClip(name, T, tracks);
  };
  const title = s => s.split(/[-_ ]/).map(w => w[0].toUpperCase() + w.slice(1)).join(" "), moves = def.moves ?? {}, hz = k => def.cycles?.[k] ?? 1;
  const rest = Object.keys(moves).find(k => /idle/.test(k)), walk = moves.walk ? "walk" : def.gait === "hop" && moves.bounce ? "bounce" : null;
  const animations = [...Object.entries(moves).filter(([k]) => !k.includes("#")).map(([k, m]) => bake(title(k), m, hz(k))),
    ...(rest && rest !== "idle" ? [bake("Idle", moves[rest], hz(rest))] : []),
    ...(moves.walk ? [] : [bake("Walk", walk ? moves[walk] : { _tilt: 5 }, walk ? hz(walk) : 2)])];
  const scene = new (class extends THREE.Group {
    updateMatrixWorld(force) {  // undo whatever the body and its pivot turn, keep their left or right
      const turned = this.parent?.getWorldQuaternion(new THREE.Quaternion()), front = this.parent?.parent && Z.clone().applyQuaternion(this.parent.parent.getWorldQuaternion(new THREE.Quaternion()));
      if (turned) { this.quaternion.copy(turned.invert()); if (Math.abs(front?.x) > 0.2) this.scale.x = Math.sign(front.x); }  // puppets face +x
      super.updateMatrixWorld(force);
    }
  })();
  scene.add(root);
  return { scene, animations };
}
const turn = (a, b, max) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); };
const ease = k => k * k * (3 - 2 * k);

// R36, a cross-fade between grounded clips: a weighted mix of hip heights is not a pose any clip stands in (Little Lion, Run into Sit: a paw 6.5 mm
// under the page). While two or more clips blend and every one is grounded at the ends of the blend (the body's lowest foot within 2 mm of its floor in
// each clip's own pose: the outgoing ones as they are now, the incoming one at the fade's end), the body is lifted so the lowest foot stands at the mix of
// the clips' own feet now (no step at the blend's first and last frame). Never pinned: a fade with a leap, climb, hang, fly or swim (by clip name or act:
// their own take-off is right alone), a floating character (bob), or any clip whose own foot is off the floor.
const OFF = /^(fly|swim|jump|hop|ouch hop|leap|bounce|climb|pounce|swing|hang|drop|fall)/i, NOT_SOLE = /tail|ear|hair|whisk|finger|thumb|index|middle|ring|pinky|hand|arm|shoulder|head|neck|jaw|eye|chest|wing|antenn|horn|trunk/i, FLOOR = 0.002;
const soles = ch => (ch.soles ??= (() => {  // the vertices in the lowest 45% of the bind pose (a tail tip or a hand hanging low is no support), as [mesh, ids, out]
  fresh(ch.model); const ms = [], ys = []; let lo = Infinity, hi = -Infinity;
  ch.model.traverse(m => m.isSkinnedMesh && m.visible && m.matrixWorld.determinant() && ms.push(m));
  for (const m of ms) { const { p, n } = rig(m), e = m.matrixWorld.elements, y = new Float32Array(n); for (let i = 0; i < n; i++) lo = Math.min(lo, y[i] = e[1] * p[3 * i] + e[5] * p[3 * i + 1] + e[9] * p[3 * i + 2] + e[13]), hi = Math.max(hi, y[i]); ys.push(y); }
  return ms.map((m, k) => { const { j, w, n } = rig(m), ids = [], st = Math.max(1, n / 1500 | 0);
    for (let i = 0; i < n; i += st) { let b = 0; for (let c = 1; c < 4; c++) if (w[4 * i + c] > w[4 * i + b]) b = c; if (ys[k][i] < lo + 0.45 * (hi - lo) && !NOT_SOLE.test(m.skeleton.bones[j[4 * i + b]]?.name ?? "")) ids.push(i); }
    return [m, ids, new Float32Array(3 * ids.length)]; }).filter(s => s[1].length);
})());
const footAt = ch => {  // the lowest of those points above the body's own floor (where its origin stands), as the bones are now
  fresh(ch.model); let y = Infinity;
  for (const [m, ids, out] of soles(ch)) { drawn(m, ids, out); for (let i = 1; i < out.length; i += 3) y = Math.min(y, out[i]); }
  return y - ch.body.getWorldPosition(new Vector3()).y;
};
const footIn = (ch, clip, t) => {  // the same, in that clip alone at time t: a spare mixer poses it, then puts the bones back as they were
  const mx = new AnimationMixer(ch.model), a = mx.clipAction(clip).play(); a.time = t; mx.update(0);
  const y = footAt(ch); mx.stopAllAction(); mx.uncacheRoot(ch.model); return y;
};
const blendGround = ch => {  // after each of the mixer's updates; the body is at its own place here (live.js's place() set it just before)
  const run = ch.mix._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0), was = ch.gset;  // shortcut: the mixer's private list, three has no public one; upgrade: live.js keeps the clip it fades from
  if (run.length < 2 || ch.ride || ch.c?.bob || !ch.body.visible || Math.abs(ch.body.scale.x - ch.s0) > 0.01 * ch.s0 || !soles(ch).length) return void (ch.gset = ch.grounded = null);
  ch.gset = new Set(run);
  const joined = run.filter(a => !was?.has(a));
  if (joined.length) {  // a clip joined: it is the one fading in (the lightest, when the blend is first seen), the rest stand where they are now
    const inn = was ? joined : [run.reduce((a, b) => (a.getEffectiveWeight() < b.getEffectiveWeight() ? a : b))], at = a => a.time + 0.3 * (1 - a.getEffectiveWeight()) * a.timeScale;  // 0.3 s: live.js loop()'s fade
    ch.grounded = (was ? ch.grounded : true) && !["fly", "float", "climb", "swim"].includes(ch.goal?.a?.do) && !run.some(a => OFF.test(a.getClip().name)) &&
      run.every(a => { const d = a.getClip().duration, t = !inn.includes(a) ? a.time : a.loop === LoopOnce ? Math.min(at(a), d) : at(a) % d; return Math.abs(footIn(ch, a.getClip(), t)) < FLOOR; });
  }
  if (!ch.grounded) return;
  const w = run.map(a => a.getEffectiveWeight()), tot = w.reduce((x, y) => x + y, 0);
  ch.body.position.y -= footAt(ch) - run.reduce((x, a, i) => x + w[i] * footIn(ch, a.getClip(), a.time), 0) / tot;  // the mix of the clips' own feet now
};

export class Acting {
  // cast: [{name, pos, yaw, height, hold, clips, ride?: {on, off}}] (pos: a Vector3 at the feet)
  // where(to, top): a point, object or character name -> a new Vector3 or null (top: an object's top surface)
  // wordAt(line, word) -> seconds into the line
  // loop(ch, clip) / once(ch, clip, done) -> its length in seconds (0 and done() at once if the clip is missing)
  // raise(what, dy): lift an object of the spread by dy; hold(ch, what, hand, on): put it in a hand, or take it out
  // started(a): told as each act begins (live.js plays its "act:<who>:<do>" foley)
  // spot(what) / put(what, p): where a prop of the spread is now (world) / set it there (it stays): for a prop flying (fly with "what")
  // people: the names that are characters (who speak, or can): only they turn to talk; null, everyone in the cast
  constructor(acts, cast, { where, wordAt, loop, once, raise = () => {}, hold = () => {}, motion = {}, started = () => {}, spot = () => null, put = () => {}, people = null, cam = null, find = () => null }) {
    Object.assign(this, { find, was: new Map(), fades: [], cast, where, wordAt, loop, once, raise, hold, motion, started, spot, put, people, cam, line: null, heard: 0, passed: new Set(), by: {}, rises: [], flights: [], glows: [], lifted: {}, holds: new Map(), shapes: [], base: new Map() });
    this.hold = (ch, what, hand, on, a) => (on ? this.holds.set(what, ch) : this.holds.delete(what), hold(ch, what, hand, on, a));  // who holds what, the games' holds too
    for (const ch of cast) (this.by[ch.name] = ch), mood(ch, "natural");
    for (const ch of cast) if (ch.mix && !ch.mix.grounding) { const up = ch.mix.update; ch.mix.grounding = true; ch.mix.update = function (dt) { const r = up.call(this, dt); blendGround(ch); return r; }; }  // R36
    this.taps = {};  // taps counted per name, for "nth"
    this.acts = acts.map((a, i) => ({ ...a, state: "wait", prev: acts.slice(0, i).findLastIndex(b => b.who === a.who && !`${b.line}`.startsWith("tap:")) }));  // a tap act never links a chain

    this.thinks = new Map(acts.filter(a => a.do === "think").map(a => [a.line, a.who]));  // line -> who thinks it
    this.open();  // "line": "open" acts: the page's starting state, set before the spread is first drawn
  }

  // line: the line being read (null between pages), t: seconds into its voice, speaker: who says the word at t
  // dt: the real time since the last tick; a long frame (a slow device) is stepped in 0.05 s pieces, so the acts keep up with the voice
  tick(line, t, dt, speaker) {
    if (line !== this.line) { if (this.line) this.passed.add(this.line); this.line = line; this.heard = 0; }
    // a word counts from the tick after the voice reached it: the read-along lights it from the same voice in its own frame
    // callback, a moment earlier or later in the frame, so by then it is lit too. A word act never starts before its word glows.
    const heard = Math.min(t, this.heard); this.heard = t;
    for (let left = Math.min(dt, 2); left > 1e-9; left -= 0.05) {
      const step = Math.min(0.05, left);
      for (const a of this.acts) if (a.state === "wait" && this.ready(a, heard)) this.start(a);
      for (const ch of this.cast) this.move(ch, step);
      this.rises = this.rises.filter(r => { r.t += step; this.raise(r.what, (this.lifted[r.what] = r.from + r.by * ease(Math.min(1, r.t / r.len)))); return r.t < r.len || void r.done(); });
      this.glows = this.glows.filter(g => { g.t += step; glow(g.ch.body, (g.ch.glowing = g.from + (g.to - g.from) * ease(Math.min(1, g.t / g.len)))); return g.t < g.len || void g.done(); });
      const ended = []; this.shapes = this.shapes.filter(g => ((g.wait -= step) > 0 || ((g.t += step), g.set(ease(Math.min(1, g.t / g.len)))), g.t < g.len || !ended.push(g)));
      ended.forEach(g => g.fin(g));  // after the filter: a finished ease may start its return, which the filter would drop
      this.fades = this.fades.filter(f => (f.t += step, f.tick(Math.min(1, f.t / f.len)), f.t < f.len || void f.end()));
      this.flights = this.flights.filter(f => {  // a prop let go flies on from where it was, along the characters' fly arc
        f.t += step; const k = Math.min(1, f.t / f.len);
        this.put(f.what, f.from.clone().lerp(f.to, ease(k)).add({ x: 0, y: f.arc * 4 * k * (1 - k), z: 0 }));
        return k < 1 || void f.done();
      });
    }
    this.talk(this.thinks.get(line) === speaker ? null : this.by[speaker]);  // a thought: nobody talks or turns
  }

  // hide / show an object: layer 1 and `visible` false on every node (the layer survives live.js setting a body's own `visible` each frame, and
  // takes the object out of the tap ray and the shadow pass too); the nodes' own state is kept to put back. A fade runs on clones of its materials.
  // shortcut: a fade on a model with a shared material clones per mesh; upgrade by pooling clones if a page fades many at once.
  vis(o, on, secs, done) {
    const hid = this.was.has(o);
    if (on ? !hid : hid) return done();
    const flip = () => {
      if (on) { for (const [m, v, k] of this.was.get(o)) (m.visible = v, m.layers.mask = k); this.was.delete(o); return; }
      const nodes = []; o.traverse(m => nodes.push([m, m.visible, m.layers.mask])); this.was.set(o, nodes);
      o.traverse(m => (m.visible = false, m.layers.set(1)));
    };
    if (!secs) return flip(), done();
    if (on) flip();
    const ms = [];
    o.traverse(m => { if (!m.isMesh) return; const was = m.material, c = [].concat(was).map(x => x.clone()); m.material = Array.isArray(was) ? c : c[0]; ms.push([m, was, c.map(x => [x, x.opacity, x.transparent])]); c.forEach(x => (x.transparent = true)); });
    const f = { t: 0, len: secs, tick: k => ms.forEach(([, , cs]) => cs.forEach(([x, o0]) => (x.opacity = o0 * (on ? k : 1 - k)))),
      end: () => { if (f.over) return; f.over = true; ms.forEach(([m, was, cs]) => (m.material = was, cs.forEach(([x]) => x.dispose()))); if (!on) flip(); done(); } };
    this.fades.push(f); f.tick(0);
  }

  busy(line) { return this.acts.some(a => a.wait && a.line === line && a.state !== "done"); }  // the reading waits on these

  reset() {  // "Read again": every act waits for its line again; nobody is mid-act (live.js puts them back where the page began)
    this.fades.forEach(f => f.end()); this.fades = [];
    this.acts.forEach(a => (a.state = "wait")); this.taps = {}; this.passed.clear(); this.line = null; this.rises = []; this.glows = []; this.lifted = {}; this.shapes = [];
    for (const [m, w] of this.base) m.morphTargetInfluences.splice(0, w.length, ...w);
    for (const o of [...this.was.keys()]) this.vis(o, true, 0, () => {});
    for (const ch of this.cast) if (ch.glowing) glow(ch.body, (ch.glowing = 0));
    for (const ch of this.cast) (ch.goal = ch.slide = ch.facing = null), mood(ch, "natural");
    this.open();
  }

  open() { const tell = this.started; this.started = () => {}; this.acts.filter(a => a.line === "open").forEach(a => this.start(a)); this.started = tell; }  // the starting state (the banana plant a pup: Step1, secs 0) before the spread is first drawn, with no act foley

  // a tap on `name`: its acts whose line is "tap:<name>" start (again, whatever state they are in; a running one is cut short)
  tap(name) {
    const nth = a => +a.nth >= 1 ? +a.nth : (a.nth != null && (a.nthBad ??= (console.warn(`act "nth" is not a number of taps: it plays as an ordinary tap act`, a), true)), 0);  // "3" written as text counts as 3 (it never played, silently); anything else is said once
    const all = this.acts.filter(a => a.line === `tap:${name}`), top = Math.max(0, ...all.map(nth)), n = top ? this.taps[name] = (this.taps[name] ?? 0) + 1 : 0;
    (top ? all.filter(a => (all.some(b => nth(b) === n) ? nth(a) === n : !nth(a))) : all).forEach(a => this.start(a));
    if (n >= top) delete this.taps[name];  // "nth": the count starts again after the last surprise
  }

  // shape: ease shape keys of the meshes under `o`; with `back`, a second ease returns them after `back` s
  shape(a, o, done) {
    const key = a.key, ms = []; o.traverse(m => m.morphTargetDictionary && key in m.morphTargetDictionary && ms.push(m));
    if (!ms.length) return console.warn(`no shape key "${key}" under "${a.what}"`, a), done();
    const items = [];  // [mesh, key index, from, to, the weight to go back to]
    for (const m of ms) {
      if (!this.base.has(m)) this.base.set(m, [...m.morphTargetInfluences]);
      for (const [k, i] of Object.entries(m.morphTargetDictionary)) if (k === key || a.only) {  // "back" goes to the weight before this act, or, on a key still easing, before the act that moved it (a second tap mid-fold)
        const live = this.shapes.flatMap(g => g.items).find(([n, j]) => n === m && j === i);
        items.push([m, i, m.morphTargetInfluences[i], k === key ? a.to ?? 1 : 0, live ? live[4] : m.morphTargetInfluences[i]]);
      }
    }
    for (const g of this.shapes) g.items = g.items.filter(([m, i]) => !items.some(([n, j]) => n === m && j === i));  // the newest act on a key wins
    const run = (its, len, wait, fin) => this.shapes.push({ items: its, t: 0, len, wait, fin, set(k) { this.items.forEach(([m, i, f, t]) => (m.morphTargetInfluences[i] = f + (t - f) * k)); } });
    // shortcut: reset returns keys to their first-seen weight (this.base), then "open" acts run; upgrade if a page needs a reset to somewhere else
    const len = a.secs ?? 1;
    if (!len) items.forEach(([m, i, , t]) => (m.morphTargetInfluences[i] = t));  // secs 0: at once, not on the next tick (an "open" act lands before the first frame)
    run(items, len, 0, g => { done(); if (a.back != null && g.items.length) run(g.items.map(([m, i, , , b]) => [m, i, m.morphTargetInfluences[i], b, b]), len, a.back, () => {}); });  // a key a newer act took is not returned
  }

  ready(a, t) {
    const heard = this.passed.has(a.line) || (a.line === this.line && t >= (a.word ? this.wordAt(a.line, a.word) : 0));
    return heard && (a.after == null || a.prev < 0 || this.acts[a.prev].state === "done");
  }

  pace(ch, kind, clip) {  // motion.json: {"kapi": {"Walk": {"speed": book metres a second, "cycle": seconds}}}; clip: a move act's own gait ("clip": "Walk Out")
    const mo = this.motion[ch.name]?.[clip ?? (MOVE[kind] || kind[0].toUpperCase() + kind.slice(1))];
    return +(mo?.speed ?? mo) || PACE[kind] * ch.height;
  }

  at(on) { return on.body?.position ?? on.pos; }  // where a character stands, bobbing on the water included

  start(a) {
    const done = () => (a.state = "done");
    if (a.face != null && this.by[a.who]) this.by[a.who].faced = a.line;  // where it looks on this line is the page's, not the talk rule's
    if (a.do === "rise" && !a.who) return this.rises.push({ what: a.what, from: this.lifted[a.what] ?? 0, by: a.by ?? 0.12, t: 0, len: a.secs ?? 1.2, done }), void (a.state = "run"), void this.started(a);
    if (a.do === "hide" || a.do === "show") {
      const o = a.who ? this.by[a.who]?.body : this.find(a.what);
      if (!o) return done();
      return this.vis(o, a.do === "show", a.fade, done), void (a.state = a.state === "done" ? "done" : "run"), void this.started(a);
    }
    if (a.do === "shape") {  // the shape keys of a prop of the spread (the banana plant growing, the shy plant folding)
      const o = this.find(a.what);
      if (!o) return console.warn("nothing to shape:", a), done();
      return a.state = "run", this.shape(a, o, done), void this.started(a);
    }
    if (a.do === "glow") {  // games.js's warm light on a character's body
      const ch = this.by[a.who];
      if (!ch?.body) return done();
      return this.glows.push({ ch, from: ch.glowing ?? 0, to: a.by ?? 1, t: 0, len: a.secs ?? 0.8, done }), void (a.state = "run"), void this.started(a);
    }
    if (a.do === "fly" && !a.who) {  // {"what": "kite", "do": "fly", "to": [x, y, z], "up": 0.3, "secs": 3}: a carried prop, away from where it is
      const from = this.spot(a.what), to = from && this.where(a.to);
      if (!to) return console.warn("nothing to fly:", a), done();
      to.y += a.up ?? 0;
      return this.flights.push({ what: a.what, from, to, arc: a.arc ?? 0.25 * from.distanceTo(to), t: 0, len: a.secs ?? 2, done }), void (a.state = "run"), void this.started(a);
    }
    const ch = this.by[a.who];
    if (!ch) return console.warn("act for a character not on this page:", a), done();
    if (a.mood) mood(ch, a.mood);  // {"do": "mood", "mood": "sad"}, or a mood on any other act
    if (a.do === "mood") return done();
    const target = MOVE[a.do] || a.do === "climb" || (a.do === "fly" || a.do === "float") && a.to != null ? a.to : a.do === "face" ? a.face : null;
    if (target != null && !this.where(target)) return console.warn(`nothing to ${a.do} to: "${target}" is not on this page`, a), done();
    a.state = "run"; this.started(a);
    const take = (slot, v) => { const old = ch[slot]; ch[slot] = v; if (old && old !== v) old.done?.(); };  // the act it replaces is finished, so a wait never hangs
    const stay = a.do === "clip" && a.ride && !a.to && ch.ride?.on === this.by[a.ride];  // a clip on the mount it rides (Sit Down, Stand Up on Bobo's back): the ride, and its hold, go on
    const moving = !stay && (MOVE[a.do] || ["fly", "float", "rise", "climb"].includes(a.do) || (a.do === "clip" && (a.to || a.ride)));
    if (moving) { ch.moved = true; ch.ride = null; }  // on its own feet now: off whatever it rode, off its entrance path
    if (MOVE[a.do]) {
      const clip = a.clip && ch.clips?.[a.clip] ? a.clip : null, gait = clip ?? MOVE[a.do], row = this.motion[ch.name]?.[gait];  // a "clip" the character lacks: the act's own gait, one warning
      if (a.clip && !clip) console.warn(`${ch.name} has no clip "${a.clip}": ${gait}`, a);
      else if (clip && !row) console.warn(`no motion row "${clip}" for ${ch.name}: Walk's pace`, a);
      const back = row?.back ?? a.do === "stepback";
      take("goal", { a, pace: (clip && !row ? this.pace(ch, "walk") : this.pace(ch, a.do, clip)) * (a.rate ?? 1), back, done }); this.loop(ch, gait);
      if (ch.cur && ch.cur.getClip() === ch.clips?.[gait]) ch.cur.timeScale = a.rate ?? 1;  // "rate": the clip and its pace both faster, the feet still planted
    } else if (a.do === "clip") {
      if (a.then) ch.hold = a.then;  // a mood is held from the moment it is set: a line said meanwhile is that mood's talk
      if (a.clip === a.then && !a.to && !a.ride) return this.loop(ch, a.clip), done();  // "clip": "Worry", "then": "Worry": worried now
      // a Throw "to" a character names who catches (live.js throws to ch.catcher, else the nearest), who turns to the thrower
      const catcher = /^Throw/.test(a.clip) && this.by[a.to];
      if (/^Throw/.test(a.clip)) ch.catcher = catcher || null;
      if (catcher && !catcher.goal) look(catcher, ch.pos);
      if (stay) { if (a.up != null) ch.ride.gap = a.up; if (a.face) look(ch, this.where(a.face)); ch.ride.stay = true; }
      const on = !stay && this.by[a.ride], from = ch.pos.clone();
      const base = on && (this.where(a.ride) ?? on.pos.clone()), back = on && on.model && skin(on, base.clone().setY(base.y + on.height), new Vector3(0, -1, 0), 2 * on.height)?.at;  // onto its skin
      const to = on ? base.setY((back ?? base).y + (a.up ?? on.height * 0.6)) : !catcher && a.to && this.where(a.to, true);
      const len = this.once(ch, a.clip, () => {
        if (stay && ch.ride) ch.ride.stay = false;
        if (a.then) ch.hold = a.then;
        this.loop(ch, ch.hold); done();
      });
      if (to) take("slide", { from, to, t: 0, len: len || 1, done: on ? () => {  // mounted: it faces the way its mount faces, unless told where to look
        mount(ch, on, o => this.at(o)); ch.ride.gap = a.up;  // `up`: its height over the skin under its hips (carry's seat), the same on every read
        if (a.face) look(ch, this.where(a.face)); else { ch.ride.dyaw = 0; ch.want = null; ch.yaw = on.yaw; }
      } : a.face ? () => look(ch, this.where(a.face)) : null });
      if (on && !a.face) ch.want = on.yaw;  // and turns that way while it climbs on
      else if (!on && to && a.face) look(ch, this.where(a.face));  // a leap "to" a branch turns as told on the way, and lands so
    } else if (a.do === "climb") {
      const to = this.where(a.to, true), clip = a.clip ?? "Climb Up", mo = this.motion[ch.name]?.[clip];
      const from = ch.pos.clone(), up = from.clone().setY(to.y), dy = Math.abs(to.y - from.y);
      // motion.json "Climb Up": {"rise": m a cycle, "cycle": s, "loop": false}: whole cycles, the body lifted with the clip's hands
      const n = mo?.rise > 0 && mo.cycle > 0 ? Math.max(1, Math.ceil(dy / mo.rise - 1e-6)) : 0;
      take("goal", { a, climb: [from, up, to], t: 0, n, cycle: mo?.cycle, each: n && mo.loop === false, clip, k: -1,
        legs: [n ? n * mo.cycle : dy / this.pace(ch, "climb"), Math.max(0.3, up.distanceTo(to) / this.pace(ch, "walk"))], done });
      ch.want = yawTo(from, to);
      if (!n || mo.loop !== false) this.loop(ch, clip);
    } else if (a.do === "fly" || a.do === "float") {
      const fly = a.do === "fly", on = this.by[a.to], from = ch.pos.clone(), pp = on && a.bone && perch(on, a.bone), at = pp ? (a.beside ? besidePoint(ch, on, pp, onBone(pp), this.cam?.position) : onBone(pp)) : this.where(a.to, !on);
      const up = a.up ?? (pp ? 0 : on ? on.height * 0.9 : 0), to = (at ?? from.clone()).setY((at?.y ?? from.y) + up);
      const dist = from.distanceTo(to), len = a.secs ?? Math.max(0.5, dist / this.pace(ch, a.do));
      take("goal", { a, air: true, from, up, on, pp, top: !on, s: 0, len, arc: fly ? 0.25 * dist : 0, sway: a.sway ?? (fly ? 0 : 0.012), done });
      this.loop(ch, a.clip ?? (fly ? "Fly" : ch.hold));
    } else if (a.do === "rise") {
      const from = ch.pos.clone();
      take("slide", { from, to: from.clone().setY(from.y + (a.by ?? 0.12)), t: 0, len: a.secs ?? 1.2, done });
    } else if (a.do === "hold") this.hold(ch, a.what, a.hand, !a.release, a), done();
    else if (a.do === "face" || a.do === "think" && a.face) take("facing", { a, done });
    else if (a.do === "think") done();
    else console.warn("unknown act:", a), done();
  }

  move(ch, dt) {
    const g = ch.goal, f = ch.facing, s = ch.slide;
    if (g?.climb) {  // straight up the trunk, then a step onto the branch
      g.t += dt;
      const [a, b, c] = g.climb, [t1, t2] = g.legs;
      if (g.t < t1) {
        ch.pos.lerpVectors(a, b, g.n ? g.t / t1 : ease(g.t / t1));  // by cycles: rising steadily, as the clip climbs
        if (g.each && Math.floor(g.t / g.cycle) !== g.k) g.k = Math.floor(g.t / g.cycle), this.once(ch, g.clip, () => {});  // a one-shot cycle, again
      } else {
        if (g.each && !g.top) g.top = true, this.loop(ch, "Walk");  // up: a step onto it
        ch.pos.lerpVectors(b, c, ease(Math.min(1, (g.t - t1) / t2)));
      }
      if (g.t >= t1 + t2) { ch.goal = null; if (g.a.then) ch.hold = g.a.then; this.loop(ch, ch.hold); g.done(); }
    } else if (g?.air) {  // fly or float: along a straight line to the target (which may move), lifted by the arc and the sway
      const to = (g.pp ? (g.a.beside ? besidePoint(ch, g.on, g.pp, onBone(g.pp), this.cam?.position) : onBone(g.pp)) : this.where(g.a.to, g.top)) ?? g.from.clone();
      to.y += g.up; g.s = Math.min(1, g.s + dt / g.len);
      ch.pos.lerpVectors(g.from, to, ease(g.s)).y += g.arc * 4 * g.s * (1 - g.s) + g.sway * Math.sin(Math.PI * g.s * Math.max(1, Math.round(g.len)));  // a sway that settles at both ends
      if (g.from.distanceTo(to) > 0.01) ch.want = yawTo(g.from, to);
      if (g.s >= 1) {
        ch.goal = null; this.loop(ch, ch.hold);
        if (g.on) mount(ch, g.on, o => this.at(o), g.a.bone, g.a.beside);  // perched: ride along (on its bone, when the act names one; or beside it)
        if (g.a.face) look(ch, this.where(g.a.face) ?? to);
        g.done();
      }
    } else if (g) {
      const to = this.where(g.a.to), d = to && to.clone().sub(ch.pos).setY(0), left = d ? d.length() - (g.a.stop ?? 0.05) : 0;
      if (left <= 0.002) {  // arrived: face what it came to, or what the act names
        ch.goal = null; this.loop(ch, ch.hold);
        if (!g.back || g.a.face) look(ch, this.where(g.a.face ?? g.a.to));
        g.done();
      } else { ch.pos.addScaledVector(d.normalize(), Math.min(left, g.pace * dt)); ch.want = Math.atan2(d.x, d.z) + (g.back ? Math.PI : 0); }
    }
    if (s) {
      s.t += dt; ch.pos.lerpVectors(s.from, s.to, ease(Math.min(1, s.t / s.len)));
      if (s.t >= s.len) ch.slide = null, s.done?.();
    }
    if (ch.ride && !ch.slide) carry(ch, o => this.at(o), this.cam?.position);  // riding: carried along
    if (f) {
      const p = this.where(f.a.face);
      look(ch, p);
      if (!p || ch.want == null || Math.abs(Math.sin((ch.want - ch.yaw) / 2)) < 0.02) { ch.facing = null; f.done(); }
    }
    if (ch.want != null) {
      ch.yaw = turn(ch.yaw, ch.want, TURN * dt);
      if (Math.abs(Math.sin((ch.want - ch.yaw) / 2)) < 1e-4 && !ch.goal && !ch.talking) ch.want = null;  // turned: a rider then turns with its mount
    }
    if (ch.ride) ch.want != null ? (ch.ride.dyaw = ch.yaw - ch.ride.on.yaw) : (ch.yaw = ch.ride.on.yaw + ch.ride.dyaw);
  }

  // the speaker turns to the nearest other character, who turns back; both only while standing, never its own mount or rider, and
  // neither once the page has said where it looks on this line (a face act, or an act's "face"): the page's direction wins
  talk(who) {
    for (const ch of this.cast) {
      const on = ch === who, talk = ch.clips?.[`${ch.hold} Talk`] ? `${ch.hold} Talk` : "Talk";  // in a mood (Worry): that mood's talk
      if (on !== !!ch.talking && ch.clips?.[talk] && !ch.goal) this.loop(ch, on ? talk : ch.hold);
      ch.talking = on;
    }
    if (!who) return;
    const person = c => !this.people || this.people.has(c.name);  // boats and props neither turn to talk nor are turned to
    if (!person(who)) return;
    // not the one it rides, nor one riding it: under a centimetre apart, their turn to each other points anywhere (Kapi's back)
    // nor one she holds or one riding what she holds (Pip perched on the lamp in her hand), nor one too close to point anywhere
    const mine = c => c === who.ride?.on || c.ride?.on === who || this.holds.get(c.name) === who || (c.ride && this.holds.get(c.ride.on.name) === who);
    const near = this.cast.filter(c => c !== who && person(c) && !mine(c) && Math.hypot(c.pos.x - who.pos.x, c.pos.z - who.pos.z) >= who.height * 0.25)
      .sort((a, b) => a.pos.distanceTo(who.pos) - b.pos.distanceTo(who.pos))[0];
    if (!near) return;
    if (!who.goal && who.faced !== this.line) look(who, near.pos);
    if (!near.goal && near.faced !== this.line) look(near, who.pos);
  }

  get poses() { return Object.fromEntries(this.cast.map(c => [c.name, { pos: c.pos.toArray(), yaw: c.yaw, hold: c.hold }])); }
}
