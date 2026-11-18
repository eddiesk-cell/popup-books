// slices.js: the four action slices (Sun Wukong = Kapi with the golden staff, the Ox King = a stock man re-dressed with horns and a nose ring),
// each a pure function of t. Two clocks: real time t (camera, drawn layer, sound) and story time T (bodies and 3D effects): a hit-stop freezes
// the bodies while the drawing and the camera keep going, slow motion slows only the story, a replay rewinds it. Bodies move by Kimodo clips on
// timelines (motion.js): cross-fades, root motion, the head on the foe, the staff in the fist, springs, hit reactions along the blow.
// No lettered sound words (Eddie, 2026-11-18): lines, spikes, stars, rings and cracks carry the read; the sound stays.
// Rules: ~/.claude/skills/action-director (AD1-AD18, P18E).
import { Spring, segPair } from "./motion.js";
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), seg = (t, a, b) => clamp((t - a) / (b - a)), lerp = (a, b, k) => a + (b - a) * k, rad = d => d * Math.PI / 180;
const sine = k => 0.5 - Math.cos(Math.PI * k) / 2, out3 = k => 1 - (1 - k) ** 3, fastOut = k => 1 - (1 - k) ** 2.5, in2 = k => k * k;
const F = 1 / 60;  // one frame
const ramp = pts => x => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], seg(x, pts[i - 1][0], pts[i][0])); return pts[pts.length - 1][1]; };
const win = (s, a, b, f = 0.15) => seg(s, a, a + f) * (1 - seg(s, b - f, b));  // 0 -> 1 on [a, a+f], 1 -> 0 on [b-f, b]
const bump = (s, a, len) => (s > a && s < a + len ? Math.sin(Math.PI * (s - a) / len) : 0);
const hold = gaps => s => 1 - Math.max(0, ...gaps.map(([a, b]) => win(s, a, b, 0.12)));  // the staff in both hands, but for the one-handed windows (a spin, a beckon, a cheer, a fall)
const realOf = (T, s) => { for (let t = 0; t < 30; t += 1 / 240) if (T(t) >= s - 1e-6) return +t.toFixed(3); return null; };  // the film time a story moment first shows

// story clock: rate keys [[t, rate], ...] (linear between keys; two keys at one t = a step); cuts [[t, T | "resume"]] set T there ("resume": back to where the story was when the previous cut fired, plus the time since)
function clock(dur, rates, cuts = []) {
  const dt = 1 / 1200, n = Math.ceil(dur / dt) + 2, tab = new Float64Array(n), at = cuts.map(([t]) => Math.round(t / dt));
  const rate = ramp(rates.map(([t, r], i) => [t + i * 1e-9, r]));
  let T = 0, saved = null;
  for (let i = 0; i < n; i++) {
    const c = at.indexOf(i); if (c >= 0) { const v = cuts[c][1]; if (v === "resume") T = saved[0] + (i - saved[1]) * dt; else { saved = [T, i]; T = v; } }
    tab[i] = T; T += rate(i * dt) * dt;
  }
  return t => tab[clamp(Math.round(t / dt), 0, n - 1)];
}

function kit(c) {
  const { THREE, kapi, ox, staff } = c, port = c.H > c.W, v = new THREE.Vector3(), tg = new THREE.Vector3(), kick = new THREE.Vector3(), hits = { flash: [], cuts: [], zooms: 0, whips: 0, recoils: [], kicks: [] }, now = { s: 0, pushed: 0 }, V = () => new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const proj = p => { v.copy(p).project(c.cam); return [(v.x + 1) / 2 * c.W, (1 - v.y) / 2 * c.H, v.z]; };
  const wp = (a, bone, out = new THREE.Vector3()) => a.bone(bone).getWorldPosition(out);
  const head = (a, k = 0.45) => wp(a, "head").lerp(wp(a, "HeadTop_End"), k);  // the middle of a head (the head joint sits at the neck)
  // the camera: look at `at` from yaw/pitch (degrees; yaw 0 = from the reader's side), far enough that a box w wide and h high fits; zf zooms the lens (a crash zoom).
  // Then fitted: if the frame would see past the set (the book's edge, the desk, the sky dome), it narrows and tilts (toward the page if the foot of the
  // frame is off it, up if the top is) by the least amount that clears it (a search in 24 steps, then halved 5 times), so the room never shows.
  const put = (s, t, k = 0, bad = null) => {
    const vf = port ? 46 : 30, tv = Math.tan(rad(vf) / 2), th = tv * c.W / c.H, w0 = port && s.wT != null ? s.wT : s.w, w = w0 * Math.max(0.2, 1 - 0.5 * k), h = (s.h ?? w0 * 0.62) * Math.max(0.2, 1 - 0.5 * k);
    let d = Math.max(w / th, h / tv), pitch = (port && s.pitchT != null ? s.pitchT : s.pitch) + (bad ? (bad.top > bad.bottom ? 12 : bad.bottom ? -9 : 0) * k : 0), yaw = (port && s.yawT != null ? s.yawT : s.yaw) * (1 - (bad?.side ? 0.5 * k : 0));  // a side that sees out swings toward the backdrop
    kick.set(0, 0, 0);
    hits.recoils.forEach((r0, i) => { const a = (t - r0) / 0.05; if (a > 0 && a < 6) { const q = a * Math.exp(1 - a); d *= 1 + 0.02 * q; pitch += 1 * q; if (hits.kicks[i]) kick.addScaledVector(hits.kicks[i], 0.03 * w * q); } });  // a recoil: one critically damped kick, 2% back, 1 degree up and along the blow, gone in 15f (P18E)
    tg.set(...(port && s.atT ? s.atT : s.at)).add(kick); c.cam.position.set(tg.x + d * Math.sin(rad(yaw)) * Math.cos(rad(pitch)), tg.y + d * Math.sin(rad(pitch)), tg.z + d * Math.cos(rad(yaw)) * Math.cos(rad(pitch)));
    c.cam.up.set(0, 1, 0); c.cam.lookAt(tg); if (s.roll) c.cam.rotateZ(rad(s.roll));
    const zf = (s.zf || 1) * (c.freeze ? 1 + 0.07 * sine(c.freeze.k) : 1);  // a freeze frame's slow push-in
    c.cam.fov = 2 * Math.atan(tv / zf) * 180 / Math.PI; c.cam.updateProjectionMatrix(); c.cam.updateMatrixWorld();
  };
  const shoot = (s, t) => {
    put(s, t); if (s.free) return; const bad = c.roomRays(c.cam); if (!bad.bad) return;  // free: a shot that means to see past the backdrop (the painted sky dome), left as keyed
    let lo = 0, hi = 1.6; for (let i = 1; i <= 32; i++) { const k = i / 20; put(s, t, k, bad); if (!c.roomRays(c.cam).bad) { hi = k; lo = (i - 1) / 20; break; } }  // up to k 1.6: a fifth of the width, 19 degrees of tilt
    for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; put(s, t, m, bad); if (c.roomRays(c.cam).bad) lo = m; else hi = m; }
    put(s, t, hi, bad);
  };
  // shot keys {t, at (array or function of t), yaw, pitch, w, h, zf, roll, cut, e}; atT, wT, yawT, pitchT: the same for a tall (phone) frame: eased between keys, a `cut` key starts a new shot at once
  const track = keys => t => {
    let i = 0; while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
    const a = keys[i], b = keys[i + 1], val = (o, k) => (typeof o[k] === "function" ? o[k](t) : o[k]);
    if (!b || b.cut) return Object.fromEntries(Object.keys(a).map(k => [k, val(a, k)]));
    const k = (b.e || sine)(seg(t, a.t, b.t)), out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = val(a, key), y = val(b, key) ?? x; out[key] = Array.isArray(x) ? x.map((u, j) => lerp(u, y[j], k)) : typeof x === "number" ? lerp(x, y, k) : y; }
    return out;
  };
  const check = () => {  // the P18E budget, asserted when the slice is built: a broken rule stops the page (the recorder fails loudly)
    const f = hits.flash.sort((x, y) => x - y), cu = hits.cuts.sort((x, y) => x - y);
    f.forEach((x, i) => { if (i && x - f[i - 1] < 1) throw new Error(`P18E: two impact frames ${f[i - 1]} and ${x} within a second`); });
    if (f.length > 4) throw new Error("P18E: more than 4 impact frames");
    cu.forEach((x, i) => { if (i && x - cu[i - 1] < 0.5) throw new Error(`AD11: cuts ${cu[i - 1]} and ${x} under 30f apart`); });
    if (hits.zooms > 2 || hits.whips > 2) throw new Error("P18E: more than 2 crash zooms or whips");
    hits.recoils.forEach((x, i) => { if (i && x - hits.recoils[i - 1] < 2) throw new Error("P18E: recoils under 2 s apart"); });
  };
  const vib = (t, t0, len, amp) => (t > t0 && t < t0 + len ? amp * Math.sin((t - t0) * 2 * Math.PI * 22) * (1 - (t - t0) / len) : 0);  // hit-stop vibration, decaying
  const tl = (a, segs, extra) => c.timeline(a, segs, extra, c.y0);
  const quiet = fn => { Spring.off = true; try { return fn(); } finally { Spring.off = false; } };
  const cast = { kt: null, ot: null };
  const apart = () => {  // the deepest overlap of the two bodies' capsules, and the level way out for the Ox King
    let w = 0, dir = null; const K = kapi.caps(), O = ox.caps();
    for (const a of K) for (const b of O) { const d = a.r + b.r - c.segDist(a.a, a.b, b.a, b.b); if (d > w) { w = d; dir = b.a.clone().lerp(b.b, 0.5).sub(a.a.clone().lerp(a.b, 0.5)).setY(0); } }
    if (w > 0) { if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0); ox.body.position.addScaledVector(dir.normalize(), 1.5 * w + 0.0015); ox.body.updateMatrixWorld(true); }
    return w;
  };
  const staffIn = (square = false) => {  // the staff inside the Ox King: he is moved off it, on the level (the staff is the hero's; the foe gives way)
    let w = 0, dir = null; const a = staff.tip(-1), b = staff.tip(1);
    for (const q of ox.caps()) { const d = q.r + 0.0056 - c.segDist(a, b, q.a, q.b); if (d > w) { w = d; const m = q.a.clone().lerp(q.b, 0.5); dir = m.sub(new THREE.Line3(a, b).closestPointToPoint(m, true, new THREE.Vector3())).setY(0); } }
    if (w > 0 && square) { const sd = b.clone().sub(a).setY(0).normalize(), al = dir.dot(sd); if (dir.lengthSq() < 1e-6 || al * al > 0.5 * dir.lengthSq()) { dir.addScaledVector(sd, -al); if (dir.lengthSq() < 1e-6) dir.crossVectors(UP, sd); } }  // the last pushes: square to the staff (along it never frees him)
    if (w > 0) {
      if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0); ox.body.position.addScaledVector(dir.normalize(), w + 0.001); ox.body.updateMatrixWorld(true); }
    return w;
  };
  let lastS = null, pushAt = null; const closes = [], close = (s0, s1) => closes.push({ s0, s1 });  // posing the same moment again (after the ghosts, the shake) restores the staff's eased push first: the drawn pose and the measured one are the same
  const pose = s => { if (!Spring.off) { if (s !== lastS) { lastS = s; pushAt = staff.push.clone(); } else staff.push.copy(pushAt); } now.s = s; now.pushed = 0; now.raw = 0; cast.kt.at(s); cast.ot.at(s); for (let i = 0; i < 12 && apart() > 0; i++); kapi.post(s); ox.post(s); for (let i = 0; i < 12 && apart() > 0; i++); const p0 = staff.push.clone(); staff.at(s); if (now.wantRaw) now.raw = depth(); sep(); staff.push.copy(p0); staff.at(s); sep();  // the staff placed again once the bodies have settled, then settled again
    for (const q of closes) { const w = win(s, q.s0, q.s1, 0.04); if (w > 0) { const m = contact.staff(); if (m.gap > 0.0008) { ox.body.position.addScaledVector(m.n, (m.gap - 0.0008) * w); ox.body.updateMatrixWorld(true); sep(false); } } } };  // closed, then separated again: the blow lands as near as the bodies allow, never inside
  const depth = () => { const a = staff.tip(-1), b = staff.tip(1); let w = 0; const K = kapi.caps(); for (const q of ox.caps()) { w = Math.max(w, q.r + 0.0056 - c.segDist(a, b, q.a, q.b)); for (const k of K) w = Math.max(w, k.r + q.r - c.segDist(k.a, k.b, q.a, q.b)); } return w; };  // how deep the Ox King is in Wukong or his staff before he is moved off
  const sep = (last = true) => { const x0 = ox.body.position.clone(); for (let i = 0; i < 16; i++) { const b = staffIn(), a = apart(); if (!a && !b) break; } if (last) for (let i = 0; i < 8 && staffIn(true) > 0; i++); now.pushed = Math.max(now.pushed, ox.body.position.distanceTo(x0)); };  // pushed: how far the Ox King had to be moved off Wukong this pose  // measured on this pose, so a replay (other spring states) is never pushed too far  // a blow that must land: the last of the gap closed on the contact frames (the bodies' separation would hold him a little off)  // both stand (never inside each other), then each looks at the other, then the staff
  const shake = (t, t0, len, ampO, ampK, s) => {  // the hit-stop vibration on the bodies (real time), after they are posed
    if (!(t > t0 && t < t0 + len)) return;
    ox.body.position.x += vib(t, t0, len, ampO); ox.body.updateMatrixWorld(true); kapi.body.position.x += vib(t, t0, len, ampK); kapi.body.updateMatrixWorld(true); if (pushAt) staff.push.copy(pushAt); staff.at(s);
  };
  // one clip alone at the origin facing +Z: f() sampled every frame (clip-intrinsic keys: where a strike tops out, when a ram reaches furthest)
  const sample = (a, clip, f, from = 0, to = a.clips[clip].duration) => quiet(() => {  // the slice's own time-keyed extras are off (they key on story time, not clip time); a staff clip is held in both hands
    const t1 = c.timeline(a, [{ t: 0, clip, p: [0, 0], yaw: 0 }], null, 0), out = [], keep = [a.look, a.adds, a.reach, a.tailCurl, a.fistL, a.grip, staff.both, staff.twirl, staff.cock, staff.tremble, staff.aim];
    a.look = null; a.adds = []; a.reach = []; a.tailCurl = a.fistL = null; if (a === kapi) { a.grip = { right: 1 }; staff.both = () => (/^staff_(overhead|thrust)$|^guard$/.test(clip) ? 1 : 0); staff.twirl = staff.tremble = () => 0; staff.cock = () => 0.35; staff.aim = () => null; }
    try { for (let x = from; x < to - 1e-4; x += F) { t1.at(x); a.post(x); if (a === kapi) staff.at(x); out.push([x, f()]); } }
    finally { [a.look, a.adds, a.reach, a.tailCurl, a.fistL, a.grip, staff.both, staff.twirl, staff.cock, staff.tremble, staff.aim] = keep; }
    return out;
  });
  // a staff strike: the top of the wind-up, and the first frame after it where the striking end comes down through height y over the floor
  const strike = (clip, y, from = 0.15) => {
    const ys = sample(kapi, clip, () => { const a = staff.tip(-1), b = staff.tip(1); return (a.z > b.z ? a : b).y; }), n = ys.length; let top = Math.round(from / F);  // the striking end: the one in front of him (he faces +Z here)
    for (let i = top; i < n * 0.8; i++) if (ys[i][1] > ys[top][1]) top = i;
    let hit = -1; for (let i = top + 1; i < n; i++) if (ys[i][1] <= y) { hit = i; break; }
    if (hit < 0) { hit = top + 1; for (let i = top + 1; i < Math.min(n - 1, top + 30); i++) if (ys[i - 1][1] - ys[i][1] > ys[hit - 1][1] - ys[hit][1]) hit = i; }
    return { top: ys[top][0], hit: ys[hit][0], dur: kapi.clips[clip].duration, tipTop: ys[top][1] };
  };
  const headCap = () => ox.caps().find(q => q.n === "head");
  const inHead = p => { const q = headCap(), on = new THREE.Line3(q.a, q.b).closestPointToPoint(p, true, new THREE.Vector3()); return [q.r + 0.0055 - p.distanceTo(on), p.clone().sub(on).setY(0).normalize()]; };  // depth of a point in his head, and the level way out
  const arc = (s, n = 8, dt = 0.012) => { const pts = quiet(() => { const out = [], P = new THREE.Vector3(); for (let j = n; j >= 0; j--) { pose(s - j * dt); out.push(proj(staff.tip(1, P))); } return out; }); pose(s); return pts; };  // the striking end's last n positions on screen (re-posed; the frame is already drawn)
  const ghosts = (s, list) => { if (!list.length || c.noGhost) return; for (const [who, at, alpha, dx = 0, dy = 0] of list) quiet(() => {  // [who ("kapi" | "ox" | "staff"), story time, alpha, shift]
    pose(at); const a = who === "ox" ? ox : kapi; if (dx || dy) { a.body.position.x += dx; a.body.position.y += dy; a.body.updateMatrixWorld(true); staff.at(at); }
    const was = [a.body.visible, staff.mesh.visible]; a.body.visible = staff.mesh.visible = true;
    c.ghost(who === "staff" ? [staff.mesh] : who === "kapi" ? [kapi.body, staff.mesh] : [ox.body], alpha); [a.body.visible, staff.mesh.visible] = was; });
    pose(s);  // back to this frame's own pose (springs and holds step by zero: unchanged), so the marks and the leak measure read what was drawn
  };
  const smear = (s, from, to, who = "staff") => { const k = []; for (let i = 3; i >= 1; i--) { const at = s - i * F / 2; if (at > from && at < to) k.push([who, at, 0.14 + 0.08 * (3 - i)]); } return k; };  // 3 copies across the last frame and a half: the fastest moves smear
  // contacts, measured on the pose: the closest pair of capsules between two sets (the point midway between their surfaces, the normal out of the
  // struck one, the gap), or the capsule nearest a plane (the point on the plane under it). Effects are spawned at these, never at a guessed point.
  const nearCaps = (A, B) => {
    let b = null; const p = V(), q = V();
    for (const x of A) for (const y of B) { const d = segPair(x.a, x.b, y.a, y.b, p, q) - x.r - y.r; if (!b || d < b.gap) b = { gap: d, p: p.clone(), q: q.clone(), x, y }; }
    const n = V().subVectors(b.p, b.q); if (n.lengthSq() < 1e-12) n.set(0, 1, 0); n.normalize();
    return { gap: b.gap, n, p: b.q.clone().addScaledVector(n, b.y.r).lerp(b.p.clone().addScaledVector(n, -b.x.r), 0.5), on: b.y.n, by: b.x.n };
  };
  const nearPlane = (A, P0, n) => { let b = null; for (const x of A) for (const e of [x.a, x.b]) { const d = V().subVectors(e, P0).dot(n) - x.r; if (!b || d < b.gap) b = { gap: d, p: e.clone().addScaledVector(n, -(d + x.r)), on: x.n }; } return { gap: b.gap, n: n.clone(), p: b.p, on: b.on }; };
  const staffCap = () => [{ n: "staff", a: staff.tip(-1), b: staff.tip(1), r: 0.004 }];
  const contact = { staff: (only = /^head$/) => nearCaps(staffCap(), ox.caps().filter(q => only.test(q.n))), heads: () => nearCaps(ox.caps().filter(q => q.n === "head"), kapi.caps()), page: (a, only = /./) => nearPlane(a.caps().filter(q => only.test(q.n)), V().set(0, c.y0, 0), UP), plane: (a, P0, n) => nearPlane(a.caps(), P0, n) };
  const touch = (s, f) => { for (let x = 0; x < s - 1e-9; x += F) pose(x); pose(s); return f(); };  // the pose at story s as the film draws it: stepped from the start with the springs on (the staff's avoidance, the feet, the trailing legs all carry state)
  const impacts = [], tells = [];  // impacts: the effect centre used and how to measure the contact again on the drawn pose; tells: the small acting beats, film time
  const lazy = [], later = (s0, f) => lazy.push({ s0, f, done: false }), fire = s => { for (const L of lazy) if (!L.done && s >= L.s0 - 1e-9) { L.done = true; L.f(); } };  // effects spawned on the drawn frame of their contact
  const impact = (name, t, s0, f, m, fx, h) => { impacts.push({ name, t, measure: f, fx, h }); later(s0, () => fx.copy(f().p)); return m; };  // fx (a live point) is re-measured on the drawn frame: the effects read it then
  const tell = (t, who, text) => tells.push([+t.toFixed(3), who, text]);
  const away = (a, m, blow, k = 0.5) => { const ch = wp(a, "chest").sub(m.p).setY(0), b = blow.clone().setY(0); if (ch.lengthSq() < 1e-10) ch.copy(b); return ch.normalize().multiplyScalar(1 - k).add(b.normalize().multiplyScalar(k)).normalize(); };  // a hit reaction bends away from where it was struck, along the blow
  const nod = a => () => V().crossVectors(UP, a.faceDir());  // the axis a head nods down about
  const bow = (a, s0, len, deg) => { a.turn("spine", nod(a), s => 0.45 * deg * bump(s, s0, len)); a.turn("neck", nod(a), s => 0.55 * deg * bump(s, s0, len)); };
  const srad = (p, r) => { const cr = V().setFromMatrixColumn(c.cam.matrixWorld, 0), A = proj(p), B = proj(p.clone().addScaledVector(cr, r)); return Math.hypot(B[0] - A[0], B[1] - A[1]) / (Math.min(c.W, c.H) / 1080); };  // a world size at p, in the ink's units
  const mouth = a => { const h = a.caps().find(q => q.n === "head"); return head(a, 0.2).addScaledVector(a.faceDir(), h.r * 1.1); };
  const breath = (t, t0, a, seed) => { if (t < t0 || t > t0 + 0.45) return; const m = mouth(a), P = proj(m), Q = proj(m.clone().addScaledVector(a.faceDir(), 0.03)); c.ink.puff(P[0], P[1], 0.9 * srad(m, 0.012), seed, (t - t0) / 0.45, "#fffaf0", Math.atan2(Q[1] - P[1], Q[0] - P[0])); };  // a pale breath puff blown out ahead of him
  const sweat = (t, t0, len = 0.75) => { if (t < t0 || t > t0 + len) return; const p = c.oxp.point("temple"), P = proj(p); c.ink.sweat(P[0], P[1], 0.5 * srad(p, 0.006), (t - t0) / len); };
  const shiver = (t, t0, len, a) => { if (t < t0 || t > t0 + len) return; const p = head(a), P = proj(p); c.ink.shiver(P[0], P[1], srad(p, a.caps().find(q => q.n === "head").r * 1.25), t, 1 - seg(t, t0 + len - 0.15, t0 + len)); };
  const bristle = (t, t0, len) => { if (t < t0 || t > t0 + len) return; const pts = [0, 1, 2, 3, 4].map(k => proj(wp(kapi, `tail${k}`))), m = wp(kapi, "tail2"); c.ink.bristle(pts.slice(1), 0.6 * srad(m, 0.012), win(t, t0, t0 + len, 0.1), 77); };
  const stamps = (a, clip, foot) => { const y = sample(a, clip, () => wp(a, foot).y).map(x => x[1]), out = []; for (let i = 3; i < y.length - 3; i++) if (y[i] <= Math.min(...y.slice(i - 3, i + 4)) && Math.max(...y.slice(Math.max(0, i - 15), i)) - y[i] > 0.008) { out.push(i * F); i += 8; } return out; };  // the frames a stamping foot lands: a low after a lift
  // the staff's striking point: the end most in front of him, 6% of the staff in from it; and the yaw (degrees) to add to his strike so that point
  // lies on the fighting line (want: the line's direction, as a yaw), turning him about his root
  const strikeEnd = s => touch(s, () => { const f = kapi.faceDir().setY(0).normalize(), o = kapi.body.position, a = staff.tip(-1), b = staff.tip(1), [e, x] = a.clone().sub(o).dot(f) > b.clone().sub(o).dot(f) ? [a, b] : [b, a]; return e.lerp(x, 0.06); });
  const aimYaw = (s, want) => { const q = strikeEnd(s), o = touch(s, () => kapi.body.position.clone()); let d = want - Math.atan2(q.x - o.x, q.z - o.z) * 180 / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  const fist = (a, side, s0, s1, from = 0.45) => { const was = a.grip?.[side] ?? 0; const w0 = s => (typeof was === "function" ? was(s) : was); a.grip = { ...a.grip, [side]: s => (s < s0 ? lerp(w0(s), from, sine(seg(s, s0 - 0.3, s0))) : lerp(from, 1, sine(seg(s, s0, s1)))) }; a.turn(side + "Hand", () => wp(a, side + "Hand").sub(wp(a, side + "LowerArm")), s => -18 * win(s, s0 - 0.3, s1 + 0.1, 0.25)); };  // the fist loosens, then closes tight on the staff, the knuckles rolling in
  return { port, proj, wp, head, shoot, track, check, vib, hits, arc, tl, quiet, cast, pose, shake, sample, strike, inHead, ghosts, smear, now, contact, touch, impact, impacts, tell, tells, away, nod, bow, srad, mouth, breath, sweat, shiver, bristle, stamps, fist, strikeEnd, aimYaw, later, fire, close };
}

// the drawn layer's shared beats on a hit: an impact frame, ink spikes, the star, a drawn ring and focus lines; and its 3D (sparks, dust, a ring)
function hitFx(c, K, { tc, T, p, seed = 1, ring = true, impact = true, dust = 0.06, normal = [0, 0.2, 1], big = 1, invert = false, glare = false }) {
  if (impact) K.hits.flash.push(tc);
  K.later(T, () => {  // on the drawn contact frame, at the contact as measured there
    c.fx.burst("sparks", p.toArray(), T, { n: 50, sp: 0.85, up: 0.2, life: 0.45, size: 0.006, seed });
    c.fx.burst("dust", p.toArray(), T, { n: 14, sp: 0.3, up: 0.05, life: 0.7, size: dust, seed: seed + 1 });
    if (ring) c.fx.ring(p.toArray(), normal, T, { r1: 0.12, life: 0.35 });
  });
  return (t, P) => {  // draw, after the 3D frame; P = the contact point on screen this frame
    const a = t - tc;
    if (a >= -0.45 && a < 0.6) c.ink.focus(P[0], P[1], seed + Math.floor(t * 3), a < 0 ? 0.55 * seg(a, -0.45, -0.1) : 1 - seg(a, 0.35, 0.6), 210);  // creep in on the wind-up, full on contact; re-drawn 3 times a second
    if (impact && a >= 0 && a < 3 * F) c.ink.impactFrame(invert);  // inverted (paper figures on ink) only for the decisive blow
    if (glare && a >= 0 && a < 2 * F) c.ink.glare(P[0], P[1], 300 * big, 1 - a / (2 * F));  // a local white flash, two frames, never the whole frame
    if (a >= 0 && a < 0.32) c.ink.spikes(P[0], P[1], 150 * big, seed + 3, a / 0.32);
    if (a >= 0 && a < 0.45) c.ink.burst(P[0], P[1], 125 * big, seed, a / 0.45);
    c.ink.ring(P[0], P[1], 330 * big, 130 * big, (a - 2 * F) / 0.45);
  };
}

export const SLICES = {
  // 1. THE HIT: the proud bull learns the monkey is faster. The dare (he paws and snorts; Wukong's fist tightens), the blow (the flash step, the
  // staff on his brow), the doubt (horns droop, a glance at the way out, a sweat drop, a gulp), the resolve (he wipes his brow and paws again;
  // Wukong's tail asks "still standing?", a show-off spin, a small bow, the beckon). Beat sheet: renders/review/action-slices-v4/REPORT.md.
  hit: c => {
    const K = kit(c), { kapi, ox, staff, oxp, THREE } = c, dur = 7.6, tc = 1.85, hs = 12 * F, z = 0.27, xk = -0.1, xFar = -0.27, sV = 1.62, sR = tc - 3 * F;  // the flash step: gone at sV, back 3f before the blow (11f gap)
    const T = clock(dur, [[0, 1], [tc, 1], [tc, 0], [tc + hs, 0], [tc + hs, 1]]), R = s => realOf(T, s);
    const ot = K.tl(ox, [
      { t: 0, clip: "stomp2", from: 0.4, p: [0.32, z], yaw: -90 },  // the dare: he paws the stone (the stamp lands at 0.83, in the hoof's insert)
      { t: 1.55, clip: "charge2", from: 0.15, rate: 0.85, fade: 0.12, match: 0.4 },
      { t: tc + 0.02, clip: "hit_stagger", from: 0.05, fade: 0.08 },  // released by the hit-stop: he reels back along the blow
      { t: tc + 0.85, clip: "dizzy2", fade: 0.35 },
      { t: 4.05, clip: "stomp2", from: 0.86, fade: 0.2 },  // the resolve: an over-big stamp (lands at 4.42) to hide the wiped brow
    ], s => ({ x: 0.06 * sine(seg(s, 4.75, 5.15)) + 0.08 * sine(seg(s, 6.5, 6.95)) }));  // he gives Wukong room for the show-off (the staff never sweeps through him)
    const exit = new THREE.Vector3(0.62, c.y0 + 0.12, z);  // the way out: the page's far edge
    const lookOx = { at: () => K.head(kapi).lerp(exit, win(K.now.s, 2.92, 3.32, 0.1)), w: s => (s < 1.55 ? 1 : s < tc ? 0.35 : s < tc + 0.5 ? 0.3 : s < 3.2 ? 0.8 : 1) };  // head down in the charge; a glance at the way out
    K.cast.ot = ot; ox.look = null; K.quiet(() => { ot.at(tc); ox.post(tc); });
    const hop = s => 0.07 * (s < tc - 0.4 ? 0 : s < tc - 0.08 ? sine(seg(s, tc - 0.4, tc - 0.08)) : 1 - in2(seg(s, tc - 0.08, tc + 0.3)));  // he springs up into the blow: the staff comes down from higher, through more of its swing
    const browY = oxp.point("brow").y - c.y0, ks = K.strike("staff_overhead", browY + 0.01 - hop(tc));  // the frame the staff's end comes down to his brow
    const kSegs = yh => [
      { t: 0, clip: "guard", p: [xFar, z], yaw: 90 },  // still: the burst reads fast against it
      { t: 1.42, clip: "staff_overhead", map: ramp([[1.42, 0], [sV, ks.top]]), p: [xFar, z], fade: 0.12 },  // the wind-up, 12f: he leans into it, then is gone
      { t: sR, clip: "staff_overhead", map: ramp([[sR, ks.top], [tc, ks.hit], [tc + 1.0, ks.dur]]), p: [xk, z], yaw: yh, fade: 0 },  // already there, mid-strike, 3f before it lands (turned so the staff's end comes down on the line)
      { t: tc + 1.0, clip: "guard", p: [xk, z], yaw: 90, fade: 0.3 },
      { t: 5.15, clip: "staff_spin", fade: 0.22 },  // the show-off
      { t: 5.95, clip: "guard", fade: 0.25 },  // a small bow over the staff
      { t: 6.55, clip: "beckon", fade: 0.25 },
    ];
    let yh = 90, kt = K.tl(kapi, kSegs(yh), s => ({ y: hop(s) })); K.cast.kt = kt;
    for (let i = 0; i < 3; i++) { const d = K.aimYaw(tc, 90); if (Math.abs(d) < 1) break; yh += d; kt = K.tl(kapi, kSegs(yh), s => ({ y: hop(s) })); K.cast.kt = kt; }
    staff.both = hold([[tc - 0.03, 2.95], [5.05, 99]]);  // both hands on the staff but from the smash (the left hand lets go on the impact, as the clip does), in the spin, the bow and the beckon
    staff.grip = s => (s > 5.15 && s < 6.1 ? lerp(-0.2, 0, win(s, 5.15, 6.1, 0.2)) : -0.2 - 0.1 * win(s, 1.3, tc + 0.4, 0.12));  // a longer reach for the blow: the fists slide back down the staff
    staff.twirl = s => 540 * sine(seg(s, 5.4, 5.95)); staff.cock = s => lerp(0.35, 0.85, seg(s, 6.5, 6.8));  // along the beckoning arm, clear of his face
    K.fist(kapi, "right", 1.17, 1.4); K.bow(kapi, 6.05, 0.45, 22); kapi.tailCurl = s => win(s, 4.75, 5.5, 0.2);
    kapi.look = { at: () => oxp.point("brow"), w: s => (s > 1.4 && s < tc + 0.3 ? 0.6 : s > 6.05 && s < 6.5 ? 0 : 1) };
    // solved, not guessed: where the staff's end is on the contact frame, which way it is going, and where the Ox King's brow must be then
    const hitP = new THREE.Vector3(), dir = new THREE.Vector3();
    dir.copy(K.strikeEnd(tc - F)); hitP.copy(K.strikeEnd(tc)); dir.subVectors(hitP, dir).normalize();
    const brow = K.touch(tc, () => oxp.point("brow")); ot.shift(hitP.x - brow.x, hitP.z - brow.z);
    for (let i = 0; i < 4; i++) { const [d, out] = K.touch(tc, () => K.inHead(hitP)); if (d <= 0) break; ot.shift(out.x * d, out.z * d); }  // the staff's end on his brow, not in it
    const [m, hd] = K.touch(tc, () => { const m = K.contact.staff(); return [m, K.away(ox, m, dir)]; }), P = m.p.clone();  // the contact, measured: every effect starts here
    ox.look = lookOx; ox.hit(tc, hd, 26);
    oxp.tremble = s => win(s, 0.1, 0.6, 0.1) + 0.6 * win(s, 3.25, 3.7, 0.1) + win(s, 4.42, 4.85, 0.1); oxp.droop = s => 16 * win(s, 2.58, 4.3, 0.3);
    oxp.glow = s => (s > tc && s < tc + 0.06 ? 0.3 : s > 3.25 && s < 3.9 ? 0.78 + 0.22 * Math.sin(s * 70) : 1);  // the eyes dip 3f at the blow, flicker while he is afraid
    ox.turn("neck", K.nod(ox), s => 8 * bump(s, 3.55, 0.3));  // the gulp
    ox.reach.push({ side: "left", w: s => win(s, 3.82, 4.36, 0.14), at: s => oxp.point("temple").lerp(oxp.point("brow"), sine(seg(s, 3.9, 4.22))).addScaledVector(ox.faceDir(), oxp.hh * 0.25) });  // he wipes his brow
    ox.grip = { left: s => 0.5 * win(s, 3.82, 4.36, 0.14) };
    const oStart = ot.roots[0].x;
    K.impact("the staff on his brow", tc, tc, () => K.contact.staff(), m, P, ox.h);
    const draw = hitFx(c, K, { tc, T: tc, p: P, seed: 11, normal: m.n.clone().add(new THREE.Vector3(0, 0, 1)).normalize().toArray() });
    const feet = K.touch(tc + 0.5, () => K.contact.page(ox, /Foot/)).p;
    c.fx.burst("dust", [feet.x + 0.01, c.y0 + 0.005, feet.z], tc + 0.15, { n: 30, sp: 0.35, up: 0.06, life: 1, size: 0.07, flat: true, dir: [1, 0, 0], cone: 0.6, seed: 4 });  // the skid as he reels
    const st0 = K.stamps(ox, "stomp2", "rightFoot"), paws = [...st0.map(x => x - 0.4), ...st0.map(x => 4.05 + x - 0.86)].filter(s => s < 1.55 || s > 4.05);
    for (const s of paws) { const f = K.touch(s, () => K.contact.page(ox, /rightFoot|rightToes/)).p; c.fx.burst("dust", [f.x, c.y0 + 0.004, f.z], s, { n: 16, sp: 0.22, up: 0.05, life: 0.8, size: 0.04, flat: true, dir: [1, 0, 0], cone: 0.9, seed: 6 + Math.round(s * 10) }); }
    const snorts = [0.1, 4.42];
    for (const s of snorts) { const p = K.touch(s, () => oxp.point("nose")); c.fx.burst("dust", p.toArray(), s, { n: 8, sp: 0.12, up: 0.02, life: 0.6, size: 0.03, dir: [-1, -0.3, 0], cone: 0.4, seed: 5 + s }); }
    const hoofAt = K.touch(paws[1] ?? paws[0], () => K.wp(ox, "rightFoot")), fistAt = K.touch(1.2, () => K.wp(kapi, "rightHand")), tailAt = K.touch(4.95, () => K.wp(kapi, "tail2"));
    const mid = (xk + oStart) / 2, wide = clamp(oStart - xk + 0.12, 0.5, 0.58), wp = 12 + 30 * (wide - 0.5);  // a wider opening looks further down, so the page (not the desk) fills the frame's foot
    const cam = K.track([
      { t: 0, at: [mid, 0.12, z - 0.02], yaw: 0, pitch: wp, w: wide, wT: wide * 0.62, yawT: 10, pitchT: 22 },  // AD1 geography: both fighters and the hall
      { t: 0.55, at: [mid, 0.12, z - 0.02], yaw: 0, pitch: wp - 1, w: wide * 0.97, wT: wide * 0.61, yawT: 10, pitchT: 21 },
      { t: 0.55, cut: true, at: hoofAt.clone().add(new THREE.Vector3(0, 0.015, 0)).toArray(), yaw: -28, pitch: 5, w: 0.1, wT: 0.075, yawT: -24 },  // INSERT: the hoof paws the stone
      { t: 1.05, at: hoofAt.clone().add(new THREE.Vector3(0, 0.015, 0)).toArray(), yaw: -30, pitch: 5, w: 0.095, wT: 0.072, yawT: -26 },
      { t: 1.05, cut: true, at: fistAt.toArray(), yaw: 22, pitch: 12, w: 0.085, wT: 0.065, yawT: 26 },  // INSERT: Wukong's fist tightens on the staff
      { t: 1.55, at: fistAt.clone().add(new THREE.Vector3(0, 0.01, 0)).toArray(), yaw: 22, pitch: 12, w: 0.09, wT: 0.068, yawT: 26 },
      { t: 1.55, cut: true, at: [(xFar + P.x) / 2, 0.12, z], yaw: -14, pitch: 0, w: P.x - xFar + 0.1, wT: 0.3, yawT: -40, pitchT: 4 },  // low on the hero for the wind-up, the flash step and the blow (AD7), both in frame (AD2)
      { t: tc - 0.1, at: [(xFar + P.x) / 2 + 0.03, 0.12, z], yaw: -14, pitch: -2, w: P.x - xFar + 0.06, wT: 0.27, yawT: -40, pitchT: 3 },
      { t: tc + 0.08, at: [P.x - 0.03, P.y, z], yaw: -14, pitch: -4, w: 0.32, wT: 0.19, yawT: -40, pitchT: 3, zf: 1.35, e: out3 },  // the crash zoom: 11f
      { t: tc + 0.7, at: [P.x - 0.01, P.y, z], yaw: -14, pitch: -4, w: 0.32, wT: 0.19, yawT: -40, pitchT: 3, zf: 1.12 },
      { t: 2.75, at: [P.x + 0.02, P.y - 0.01, z], yaw: -14, pitch: -4, w: 0.34, wT: 0.2, yawT: -40, pitchT: 3, zf: 1.1 },
      { t: 2.75, cut: true, at: () => K.head(ox).toArray(), yaw: -78, pitch: 4, w: 0.13, wT: 0.095, yawT: -70 },  // REACTION: the horns droop, a glance at the way out
      { t: 3.35, at: () => K.head(ox).toArray(), yaw: -78, pitch: 4, w: 0.125, wT: 0.092, yawT: -70 },
      { t: 3.35, cut: true, at: () => oxp.point("temple").toArray(), yaw: -25, pitch: 8, w: 0.07, wT: 0.055, yawT: -25 },  // INSERT: tight on his temple, a sweat drop, a gulp
      { t: 3.95, at: () => oxp.point("temple").toArray(), yaw: -25, pitch: 8, w: 0.066, wT: 0.052, yawT: -25 },
      { t: 3.95, cut: true, at: [mid + 0.02, 0.12, z], atT: [mid, 0.12, z], yaw: 8, pitch: 8, w: 0.44, wT: 0.28, yawT: -28, pitchT: 15 },  // a two-shot: he wipes his brow, snorts, paws again
      { t: 4.8, at: [mid + 0.02, 0.12, z], atT: [mid, 0.12, z], yaw: 6, pitch: 8, w: 0.42, wT: 0.27, yawT: -27, pitchT: 15 },
      { t: 4.8, cut: true, at: tailAt.toArray(), yaw: 4, pitch: 6, w: 0.13, wT: 0.1, yawT: 8 },  // INSERT: Wukong's tail curls into a question mark
      { t: 5.35, at: tailAt.toArray(), yaw: 4, pitch: 6, w: 0.125, wT: 0.097, yawT: 8 },
      { t: 5.35, cut: true, at: [mid + 0.02, 0.12, z], atT: [mid, 0.12, z], yaw: 8, pitch: 8, w: 0.44, wT: 0.28, yawT: -28, pitchT: 15 },  // the two-shot: the show-off spin, a small bow, the beckon
      { t: dur, at: [mid + 0.02, 0.12, z], atT: [mid, 0.12, z], yaw: 4, pitch: 8, w: 0.4, wT: 0.27, yawT: -26, pitchT: 15 },
    ]);
    K.hits.cuts.push(0.55, 1.05, 1.55, 2.75, 3.35, 3.95, 4.8, 5.35); K.hits.zooms = 1; K.check();
    [[0.1, "ox", "a big slow snort, the ring trembles and jingles"], [paws.find(s => s > 0.5) ?? paws[0], "ox", "his hoof paws the stone, dust kicks back"], [1.17, "kapi", "his fist loosens, then closes tight on the staff, the knuckles rolling in"],
      [tc, "ox", "his eyes dip for 3 frames at the blow"], [1.95, "ox", "shock: shiver lines round his head"], [R(2.58), "ox", "his horns droop"], [R(2.92), "ox", "a glance at the way out"], [3.46, "ox", "a sweat drop slides down his temple, his eyes flicker, he gulps"],
      [R(3.82), "ox", "he wipes his brow with the back of his hand"], [R(4.42), "ox", "then hides it: an over-big stamp and a snort, horns up"], [R(4.75), "kapi", "his tail curls into a question mark: still standing?"],
      [R(5.15), "kapi", "a show-off staff spin"], [R(6.05), "kapi", "a showy little bow over the staff"], [R(6.55), "kapi", "the beckon: come again"]].forEach(([t, w, x]) => K.tell(t, w, x));
    const freezes = [{ t: tc + 4 * F, len: 0.45, at: () => K.proj(P), ang: Math.atan2(dir.y * -1, dir.x) }];  // the blow held: push-in, ink, paper
    return { dur, freezes, impacts: K.impacts, strike: [1.3, 2.05],
      shots: [[0, "wide"], [0.55, "insert: his hoof paws the stone"], [1.05, "insert: Wukong's fist tightens on the staff"], [1.55, "low angle"], [2.75, "face close-up: shock, a glance at the way out"], [3.35, "insert: a sweat drop, a gulp"], [3.95, "two-shot: he wipes his brow, stamps"], [4.8, "insert: his tail curls into a question mark"], [5.35, "two-shot: a spin, a bow, the beckon"]],
      info: { contact: tc, hitstopFrames: 12, strike: ks, strikeYaw: +yh.toFixed(1), hitDir: hd.toArray().map(x => +x.toFixed(2)), oxStart: +oStart.toFixed(3), paws: paws.map(R), dbg: ["guard", "staff_overhead", "staff_thrust"].map(cl => { const pm = sd => K.wp(kapi, sd + "Hand").add(K.wp(kapi, sd + "MiddleProximal")).multiplyScalar(0.5), r = K.sample(kapi, cl, () => { const R0 = pm("right"), L0 = pm("left"), d = staff.dir(); return [R0.distanceTo(L0), L0.clone().sub(R0).dot(d), K.wp(kapi, "leftUpperArm").distanceTo(K.wp(kapi, "leftLowerArm")) + K.wp(kapi, "leftLowerArm").distanceTo(K.wp(kapi, "leftHand")), K.wp(kapi, "leftUpperArm").distanceTo(R0)]; }).map(x => x[1]); const med = k => +r.map(x => x[k]).sort((p, q) => p - q)[Math.floor(r.length / 2)].toFixed(3); return [cl, med(0), med(1), med(2), med(3)]; }), stampsClip: K.stamps(ox, "stomp2", "rightFoot").map(x => +x.toFixed(2)), flashes: K.hits.flash, cuts: K.hits.cuts, tells: K.tells },
      cues: [["snort", 0.1, 0.8], ["jingle", 0.2, 0.25], ["leap", tc - 0.4, 0.4], ["whoosh", tc - 0.16, 0.9], ["hit", tc, 1], ["thump", tc, 1], ["jingle", R(3.3), 0.15], ["gulp", R(3.57), 0.6], ["snort", R(4.42), 0.9], ["thump", R(4.42), 0.6], ["leap", R(5.15) + 0.01, 0.5]],
      at(t, render) {
        const s = T(t); K.pose(s); K.shake(t, tc, hs, 0.003, 0.0015, s); K.fire(s);
        kapi.body.visible = staff.mesh.visible = !(s > sV && s < sR);  // the gap: no body where he was, none yet where he will be
        c.fx.at(s); K.shoot(cam(t), t); render();
        const g = [];  // after-images along the dash, fading from the start end; the staff smeared on its last frames
        if (s > sV && s < sR + 0.05) for (let i = 1; i <= 4; i++) { const age = s - sV - i * 0.025; if (age > 0) g.push(["kapi", sV - 0.001, 0.34 * (1 - clamp(age / 0.2)), (xk - xFar) * i / 5]); }
        g.push(...K.smear(s, sR, tc));
        K.ghosts(s, g);
        const P0 = K.proj(new THREE.Vector3(xFar, c.y0 + 0.1, z)), P1 = K.proj(new THREE.Vector3(xk, c.y0 + 0.1, z));
        if (t >= sV && t < sV + 0.14) c.ink.puff(P0[0], P0[1], 110, 31, (t - sV) / 0.14);
        if (t >= sV && t < sR) c.ink.speed(Math.atan2(P1[1] - P0[1], P1[0] - P0[0]), t, 0.8, { seed: 9, band: 0.35, cy: (P0[1] + P1[1]) / 2 });  // streaks along the dash
        if (t >= sR - F && t < sR + 0.1) c.ink.puff(P1[0], P1[1], 70, 33, (t - sR + F) / 0.1);
        draw(t, K.proj(P));
        K.shiver(t, 1.95, 0.75, ox); K.sweat(t, 3.46, 0.85);
      } };
  },

  // 2. FLY INTO THE WALL: the bull wins one, the monkey gets up. Wukong yawns behind his hand (overconfidence); the bull sees it: his eyes narrow
  // and flare, a steam-jet snort, the charge, the ram (the villain attacks right to left, AD6). Wukong flies into the hall's red pillar (8f stop,
  // recoil, cracks, dust settling in silence), his tail lies flat; the bull puffs his chest out and stamps. Wukong gets up, his tail lifts, he
  // blows on his stung knuckles; the bull sweats, gulps and steps back half a step; a small bow and the beckon; the bull stamps: still in it.
  wall: c => {
    const K = kit(c), { kapi, ox, staff, oxp, THREE } = c, dur = 7.8, tc = 1.75, hs = 10 * F, fly = 0.35, tw = tc + fly, hw = 8 * F;
    const T = clock(dur, [[0, 1], [tc, 1], [tc, 0], [tc + hs, 0], [tc + hs, 1], [tw + hs, 1], [tw + hs, 0], [tw + hs + hw, 0], [tw + hs + hw, 1]]), R = s => realOf(T, s);
    const twR = tw + hs, z = 0.26, xk = -0.06, wall = new THREE.Vector3(-0.31, 0.075, 0);
    const face = new THREE.Raycaster(new THREE.Vector3(wall.x, c.y0 + 0.1, 0.4), new THREE.Vector3(0, 0, -1)).intersectObject(c.place, true).find(h => h.object.visible && h.object.name.startsWith("pavilion"));
    if (!face) throw new Error("wall: the ray found no hall front");  // the card is cut and leans (forced perspective): the stop point must be measured, never assumed
    const wz = face.point.z, wn = face.face.normal.clone().transformDirection(face.object.matrixWorld); if (wn.z < 0) wn.negate(); wall.z = wz + 0.03;
    const W = c.y0;  // world height of the page
    const ram = K.sample(ox, "headbutt2", () => K.wp(ox, "head").z - K.wp(ox, "hips").z).reduce((b, x) => (x[1] > b[1] ? x : b))[0];  // the frame his head is furthest forward of his hips
    const ot = K.tl(ox, [
      { t: 0, clip: "stomp2", p: [0.36, z], yaw: -90 },
      { t: 0.8, clip: "charge2", from: 0.15, rate: 0.8, fade: 0.15, match: 0.4 },  // a long run in: he starts well clear of Wukong
      { t: tc - 0.4, clip: "headbutt2", map: ramp([[tc - 0.4, ram * 0.35], [tc, ram], [tc + 0.9, ram + 0.7]]), fade: 0.14 },
      { t: tc + 0.9, clip: "bull_guard", fade: 0.35 },
      { t: 3.25, clip: "stomp2", from: 0.86, fade: 0.2 },  // triumph: a proud stamp (lands at 3.62)
      { t: 3.95, clip: "bull_guard", fade: 0.3 },
      { t: 6.8, clip: "stomp2", from: 0.86, fade: 0.2 },  // still in it: a stamp (lands at 7.17)
    ], s => ({ x: 0.025 * sine(seg(s, 6.1, 6.4)) }));  // half a step back when Wukong is up again
    const up = kapi.clips["Stand Up"].duration;
    let launch = null;
    const path = k => new THREE.Vector3(lerp(launch.x, wall.x, fastOut(k)), lerp(0, wall.y, fastOut(k)) + 0.07 * 4 * k * (1 - k), lerp(launch.z, wall.z, fastOut(k)));
    const kextra = s => {
      if (s < tc || !launch) return { x: -0.006 * sine(seg(s, 1.3, 1.45)) };  // the back foot slides and digs in
      if (s < tw) { const k = seg(s, tc, tw), p = path(k).sub(launch); return { x: p.x, y: p.y, z: p.z, yaw: -90 * sine(seg(k, 0.1, 0.8)), pitch: (-18 - 30 * Math.sin(Math.PI * k)) * (1 - sine(seg(k, 0.35, 0.75))) }; }  // upright before the pillar: his head never goes through it first
      const k = seg(s, tw, tw + 0.1), w = 1 - k * k * (3 - 2 * k), p = path(1).sub(launch);  // the root hands over to the wall's over the fade (the timeline's own smoothstep): the sum stays put
      return { x: p.x * w, z: p.z * w, yaw: -90 * w, y: lerp(wall.y, 0, in2(seg(s, tw + 0.05, tw + 0.45))) };  // slides down the pillar into his sit
    };
    const kt = K.tl(kapi, [
      { t: 0, clip: "guard", p: [xk, z], yaw: 90 },
      { t: tc + 0.01, clip: "hit_stagger", from: 0.08, rate: 0.5, fade: 0.1 },
      { t: tw, clip: "slump", from: 0.6, rate: 1.6, p: [wall.x, wall.z], yaw: 0, fade: 0.1 },  // the back meets the pillar: the pose changes inside the hit-stop
      { t: 3.75, clip: "Stand Up", fade: 0.35 },
      { t: 3.75 + up - 0.15, clip: "guard", fade: 0.3 },
      { t: 4.5, clip: "guard", turn: 90, fade: 0.6 },
      { t: 6.85, clip: "beckon", fade: 0.25 },
    ], kextra);
    launch = new THREE.Vector3(kt.roots[1].x, 0, kt.roots[1].z);
    K.cast.kt = kt; K.cast.ot = ot;
    staff.both = hold([[0.05, 0.95], [tc - 0.12, 4.45], [4.75, 5.4], [6.8, 99]]);  // a yawn, the fall and the getting up, the knuckles, the beckon
    staff.grip = s => lerp(-0.2, 0.3, win(s, 0.85, tc + 0.15, 0.2)); staff.twirl = () => 0; staff.cock = s => lerp(0.35, 0.85, seg(s, 6.8, 7.1));  // braced for the ram: his fists slide up the staff, its long end back behind him, nothing out front for the bull's swinging arms
    kapi.reach.push({ side: "left", w: s => win(s, 0.15, 0.88, 0.15), at: () => K.mouth(kapi) }, { side: "left", w: s => win(s, 4.85, 5.32, 0.12), at: () => K.mouth(kapi).addScaledVector(kapi.faceDir(), 0.012) });  // the yawn; the stung knuckles blown on
    kapi.fistL = s => win(s, 4.85, 5.32, 0.12);
    kapi.turn("neck", K.nod(kapi), s => -14 * win(s, 0.2, 0.85, 0.15)); K.bow(kapi, 6.45, 0.4, 20);
    kapi.tailCurl = s => (s < tw ? 0 : s < 3.9 ? -0.55 * seg(s, tw, tw + 0.2) : lerp(-0.55, 0.35, sine(seg(s, 3.9, 4.25))) * (1 - seg(s, 4.6, 5.0)));  // flat after the wall, then up again
    kapi.look = { at: () => K.head(ox), w: s => (s < 0.95 ? 0.3 : s < tc ? 1 : s < 4.5 ? 0 : seg(s, 4.5, 5.0)) };
    ox.look = { at: () => K.head(kapi), w: s => (s < 0.95 ? 1 : s < tc + 0.3 ? 0.25 : 0.8) };
    oxp.squint = s => 0.85 * win(s, 0.5, 1.4, 0.12); oxp.glow = s => (s < 0.55 ? 1 : s < 1.6 ? 1.6 : s < 5.35 ? 1.25 : s < 6.3 ? 0.8 + 0.2 * Math.sin(s * 70) : 1);  // the eyes flare in anger, bright in triumph, flicker in doubt
    oxp.tremble = s => win(s, 0.85, 1.25, 0.1) + win(s, 3.62, 4.0, 0.1); oxp.droop = s => 12 * win(s, 5.4, 6.6, 0.25);
    ox.turn("spine", K.nod(ox), s => -10 * win(s, 3.25, 3.95, 0.15)); ox.turn("neck", K.nod(ox), s => 8 * bump(s, 5.75, 0.3));  // chest out; the gulp
    // solved: the Ox King's horns at Wukong's face on the contact frame, then the contact measured
    const hitK = new THREE.Vector3(); K.quiet(() => { K.pose(tc); hitK.copy(K.head(kapi, 0.4)).add(new THREE.Vector3(0.02, 0, 0)); });
    const crown = K.quiet(() => { K.pose(tc); return oxp.point("brow").lerp(oxp.point("crown"), 0.5); }); ot.shift(hitK.x - crown.x, hitK.z - crown.z);
    K.now.wantRaw = true; for (let i = 0; i < 4; i++) { let d = 0; for (let s = 0.75; s < tc - 0.05; s += F) { K.pose(s); if (s > 0.8) d = Math.max(d, K.now.raw); } if (d < 0.0005) break; ot.shift(d + 0.003, 0); } K.now.wantRaw = false;  // his run-in never presses into Wukong or his staff before the ram (the arms swing ahead of the head): moved back by what the film would have had to push
    const ramDir = K.touch(tc, () => ox.faceDir().setY(0).normalize());  // the way he drives his head (his facing: the separation pushes him back on the contact frame)
    for (let i = 0; i < 3; i++) {  // his flight ends with his back on the pillar, not through it: the deepest point of him behind the card's plane over the hit and the slide down, moved out
      let g = 0; for (let s = tc + 0.05; s <= tw + 1.0; s += 0.025) g = Math.min(g, K.touch(s, () => K.contact.plane(kapi, face.point, wn)).gap);
      if (g > -0.0005) break; const d = wn.clone().setY(0).multiplyScalar(0.0015 - g); for (const r of kt.roots.slice(2)) { r.x += d.x; r.z += d.z; } wall.x += d.x; wall.z += d.z;
    }
    const ram1 = () => { const a = K.contact.staff(), b = K.contact.heads(); return a.gap < b.gap ? a : b; };  // his head meets the guard (the staff) or Wukong, whichever is first
    const obs = staff.obstacles; staff.obstacles = s => (s > 0.9 && s < tc - 0.12 ? kapi.caps().filter(q => !/^right(UpperArm|LowerArm|Hand)$|^left(LowerArm|Hand)$/.test(q.n)) : obs(s));  // in the run-in the staff holds him off (he is moved off it), it is not turned into Wukong's own head
    const [m1, kd] = K.touch(tc, () => { const m = ram1(); return [m, K.away(kapi, m, ramDir)]; }), P1 = m1.p.clone();
    kapi.hit(tc, kd, 30);
    const m2 = K.touch(tw, () => K.contact.plane(kapi, face.point, wn)), P2 = m2.p.clone(), m3 = K.touch(tw + 0.45, () => K.contact.page(kapi, /hips|UpperLeg/)), P3 = m3.p.clone();  // his back on the pillar; where he sits
    const flight = path(1).sub(path(0.85)).normalize(), oStart = ot.roots[0].x;
    K.impact("the horns on Wukong's guard", tc, tc, ram1, m1, P1, kapi.h);
    K.impact("Wukong hits the pillar", twR, tw, () => K.contact.plane(kapi, face.point, wn), m2, P2, kapi.h);
    const draw = hitFx(c, K, { tc, T: tc, p: P1, seed: 21, normal: m1.n.clone().add(new THREE.Vector3(0, 0, 1)).normalize().toArray(), big: 0.9 });
    K.hits.recoils.push(twR); K.hits.kicks.push(flight);
    K.later(tw, () => {
      c.fx.debris(P2.clone().addScaledVector(wn, 0.006).toArray(), tw, { n: 16, sp: 0.35, up: 0.4, dir: [0.6, 0, 0.5], floor: c.y0, size: 0.006, seed: 7 });
      c.fx.burst("dust", P2.clone().addScaledVector(wn, 0.006).toArray(), tw, { n: 24, sp: 0.3, up: 0.06, life: 1.0, size: 0.06, flat: true, seed: 8 });  // spreading along the wall, not over his face
      c.fx.burst("dust", P2.clone().addScaledVector(wn, 0.01).toArray(), tw + 0.5, { n: 18, sp: 0.04, up: -0.01, life: 2.4, size: 0.035, seed: 10 });  // then it settles, slowly, in silence
      c.fx.ring(P2.clone().addScaledVector(wn, 0.004).toArray(), wn.toArray(), tw, { r1: 0.1, life: 0.3 });
      decal.position.copy(P2).addScaledVector(wn, 0.002); decal.lookAt(decal.position.clone().add(wn));
    });
    K.later(tw + 0.45, () => { P3.copy(K.contact.page(kapi, /hips|UpperLeg/).p); c.fx.burst("dust", [P3.x, W + 0.004, P3.z], tw + 0.45, { n: 26, sp: 0.25, up: 0.04, life: 1, size: 0.055, flat: true, seed: 9 }); });
    // the cracks: inked on a paper decal on the hall's front, centred on the measured contact, so his body hides them where he lies against it
    const cv = Object.assign(document.createElement("canvas"), { width: 512, height: 512 }), tex = new THREE.CanvasTexture(cv), cink = new c.ink.constructor(cv, 512, 512); tex.colorSpace = THREE.SRGBColorSpace;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    decal.position.copy(P2).addScaledVector(wn, 0.002); decal.lookAt(decal.position.clone().add(wn)); c.scene.add(decal); let drawnK = -1;
    for (const s of [0.9, 0.95, 1.0, 1.05]) { const p = K.touch(s, () => oxp.point("nose")), d = K.touch(s, () => ox.faceDir()); c.fx.burst("dust", p.toArray(), s, { n: 6, sp: 0.35, up: 0.01, life: 0.5, size: 0.022, dir: d.toArray(), cone: 0.15, seed: 30 + s * 100 }); }  // the steam jet
    { const p = K.touch(3.62, () => oxp.point("nose")); c.fx.burst("dust", p.toArray(), 3.62, { n: 10, sp: 0.14, up: 0.02, life: 0.7, size: 0.035, dir: [-1, -0.3, 0], cone: 0.5, seed: 36 }); }
    for (const s of [3.62, 7.17]) { const f = K.touch(s, () => K.contact.page(ox, /rightFoot|rightToes/)).p; c.fx.burst("dust", [f.x, c.y0 + 0.004, f.z], s, { n: 16, sp: 0.22, up: 0.05, life: 0.8, size: 0.04, flat: true, cone: 0.9, seed: 37 + s }); }
    const back = K.touch(1.35, () => [K.wp(kapi, "leftFoot"), K.wp(kapi, "rightFoot")].reduce((a, b) => (a.x < b.x ? a : b)));
    c.fx.burst("dust", [back.x, c.y0 + 0.004, back.z], 1.35, { n: 14, sp: 0.18, up: 0.04, life: 0.7, size: 0.035, flat: true, dir: [-1, 0, 0], cone: 0.7, seed: 38 });
    const tailAt = K.touch(3.0, () => K.wp(kapi, "tail2").lerp(K.head(kapi), 0.35)), knuck = K.touch(5.05, () => K.mouth(kapi)), oxMid = K.touch(3.6, () => K.wp(ox, "hips").lerp(K.head(ox), 0.55));
    const mid = (wall.x + oStart) / 2, wide = clamp(oStart - wall.x + 0.1, 0.52, 0.58), wp = 14 + 30 * (wide - 0.52);
    const cam = K.track([
      { t: 0, at: [mid, 0.1, 0.13], yaw: 0, pitch: wp, w: wide, wT: wide * 0.6, yawT: 8, pitchT: 22 },  // AD1: the hall, the arena, both fighters; Wukong yawns
      { t: 0.5, at: [mid, 0.1, 0.13], yaw: 0, pitch: wp - 0.5, w: wide * 0.98, wT: wide * 0.59, yawT: 8, pitchT: 21.5 },
      { t: 0.5, cut: true, at: () => K.head(ox, 0.45).toArray(), yaw: -72, pitch: 4, w: 0.1, wT: 0.08, yawT: -68 },  // INSERT: his eyes narrow and flare, the steam jet
      { t: 1.0, at: () => K.head(ox, 0.45).toArray(), yaw: -72, pitch: 4, w: 0.095, wT: 0.076, yawT: -68 },
      { t: 1.0, cut: true, at: [(xk + P1.x) / 2 + 0.06, 0.12, z], yaw: -16, pitch: 0, w: 0.42, wT: 0.24, yawT: -30, pitchT: 2 },  // low on the villain while he has the upper hand (AD7), Wukong in frame (AD2)
      { t: tc + hs, at: [(xk + P1.x) / 2 + 0.04, 0.12, z], yaw: -16, pitch: 0, w: 0.4, wT: 0.23, yawT: -30, pitchT: 2 },
      { t: tc + hs, cut: true, at: [-0.19, 0.13, 0.1], atT: [-0.25, 0.13, 0.08], yaw: -6, pitch: 9, w: 0.3, wT: 0.19, yawT: 10, pitchT: 14 },  // cut on action at the launch: a still frame he crosses (static cross), high enough for the slam on the pillar
      { t: 2.95, at: [-0.19, 0.13, 0.1], atT: [-0.25, 0.13, 0.08], yaw: -6, pitch: 9, w: 0.295, wT: 0.187, yawT: 10, pitchT: 14 },
      { t: 2.95, cut: true, at: tailAt.toArray(), yaw: 28, pitch: 22, w: 0.13, wT: 0.1, yawT: 28 },  // INSERT: his tail lies flat; stars
      { t: 3.5, at: tailAt.toArray(), yaw: 28, pitch: 22, w: 0.125, wT: 0.097, yawT: 28 },
      { t: 3.5, cut: true, at: oxMid.toArray(), yaw: -58, pitch: 6, w: 0.22, wT: 0.16, yawT: -55 },  // the bull: chest out, a proud stamp
      { t: 4.05, at: oxMid.toArray(), yaw: -58, pitch: 6, w: 0.21, wT: 0.155, yawT: -55 },
      { t: 4.05, cut: true, at: () => [wall.x, 0.04, 0.08], yaw: 12, pitch: 58, w: 0.16, wT: 0.11, yawT: 12 },  // high on the hero at his low point (AD7): he gets up, his tail lifts
      { t: 4.6, at: () => [wall.x, 0.05, 0.08], yaw: 12, pitch: 54, w: 0.15, wT: 0.105, yawT: 12 },
      { t: 4.6, cut: true, at: () => [wall.x, 0.05 + 0.04 * seg(T(cam.now), 4.3, 5.3), 0.07], yaw: 18, pitch: -3, w: 0.15, wT: 0.1, yawT: 18 },  // low on the hero, craning up as he turns to face him
      { t: 5.12, at: () => [wall.x, 0.09, 0.07], yaw: 18, pitch: 2, w: 0.15, wT: 0.1, yawT: 18 },
      { t: 5.12, cut: true, at: knuck.toArray(), yaw: 62, pitch: 6, w: 0.075, wT: 0.06, yawT: 58 },  // INSERT: he blows on his stung knuckles
      { t: 5.65, at: knuck.toArray(), yaw: 62, pitch: 6, w: 0.072, wT: 0.058, yawT: 58 },
      { t: 5.65, cut: true, at: () => oxp.point("temple").toArray(), yaw: -30, pitch: 8, w: 0.07, wT: 0.055, yawT: -30 },  // INSERT: the bull sees him up: a sweat drop, a gulp
      { t: 6.2, at: () => oxp.point("temple").toArray(), yaw: -30, pitch: 8, w: 0.066, wT: 0.052, yawT: -30 },
      { t: 6.2, cut: true, at: [(wall.x + oStart) / 2 + 0.05, 0.11, 0.14], yaw: 0, pitch: 12, w: 0.5, wT: 0.3, yawT: -22, pitchT: 16 },  // the two-shot: half a step back, a bow, the beckon, a stamp
      { t: dur, at: [(wall.x + oStart) / 2 + 0.05, 0.11, 0.14], yaw: 0, pitch: 11, w: 0.47, wT: 0.29, yawT: -20, pitchT: 16 },
    ]);
    K.hits.cuts.push(0.5, 1.0, tc + hs, 2.95, 3.5, 4.05, 4.6, 5.12, 5.65, 6.2); K.check();
    [[0.2, "kapi", "a yawn behind his hand: overconfidence"], [0.55, "ox", "his eyes narrow and flare: he saw it"], [0.9, "ox", "a steam-jet snort, the ring swings"], [1.35, "kapi", "his back foot slides and digs in, dust"],
      [R(2.3), "kapi", "his tail lies flat"], [R(tw + 0.25), "kapi", "stars"], [R(2.95), "place", "the pillar's dust settles in silence"], [R(3.25), "ox", "chest out, eyes bright: triumph"], [R(3.62), "ox", "a proud stamp and a snort"],
      [R(4.1), "kapi", "his tail lifts again"], [R(4.85), "kapi", "he blows on his stung knuckles (his cost)"], [5.68, "ox", "a sweat drop, his eyes flicker"], [R(5.75), "ox", "a gulp, his horns dip"], [R(6.1), "ox", "half a step back: the feet are honest"],
      [R(6.45), "kapi", "a small bow"], [R(6.85), "kapi", "the beckon"], [R(7.17), "ox", "a stamp: still in it"]].forEach(([t, w, x]) => K.tell(t, w, x));
    const smear = []; for (let i = 0; i <= 14; i++) smear.push(path(i / 14).add(new THREE.Vector3(0, W + 0.1, 0)));
    const freezes = [{ t: twR + 4 * F, len: 0.45, at: () => K.proj(P2), ang: Math.PI }];  // the wall impact held
    return { dur, freezes, impacts: K.impacts, strike: [1.2, 1.95], walls: [{ name: "Wukong in the pillar", P0: face.point.clone(), n: wn.clone(), who: "kapi" }],
      shots: [[0, "wide: Wukong yawns"], [0.5, "insert: his eyes narrow, a steam-jet snort"], [1.0, "low angle"], [tc + hs, "static cross"], [2.95, "insert: Wukong's tail lies flat"], [3.5, "insert: the bull's chest out, a proud stamp"], [4.05, "high angle"], [4.6, "low crane"], [5.12, "insert: he blows on his knuckles"], [5.65, "insert: a sweat drop, a gulp"], [6.2, "two-shot"]],
      info: { contact: tc, wall: twR, wallFace: wz, ram, oxStart: +oStart.toFixed(3), kickDir: kd.toArray().map(v => +v.toFixed(2)), flashes: K.hits.flash, cuts: K.hits.cuts, recoil: K.hits.recoils, tells: K.tells },
      cues: [["snort", 0.9, 1], ["jingle", 0.95, 0.25], ["swoosh-big", tc - 0.25, 0.5], ["hit", tc, 1], ["thump", tc, 1], ["swoosh-big", tc + hs, 0.8], ["crash", twR, 1], ["boom", twR, 0.6], ["crumble", twR + 0.35, 0.7], ["land", twR + 0.6, 0.6],
        ["thump", R(3.62), 0.6], ["snort", R(3.62), 0.8], ["jingle", R(3.65), 0.2], ["gulp", R(5.75), 0.6], ["thump", R(7.17), 0.6], ["snort", R(7.2), 0.6]],
      at(t, render) {
        const s = T(t); cam.now = t; K.pose(s); K.shake(t, tc, hs, 0.0015, 0.002, s); K.fire(s);
        const ck = seg(t, twR, twR + 5 * F); if (ck !== drawnK) { cink.x.clearRect(0, 0, 512, 512); if (ck > 0) cink.cracks(256, 256, 31, ck, 300); tex.needsUpdate = true; drawnK = ck; }  // the cracks run out over 5 frames, then stay
        c.fx.at(s); K.shoot(cam(t), t); render();
        const g = [];
        if (s > tc - 0.25 && s < tc) for (let i = 1; i <= 2; i++) g.push(["ox", s - i * 0.05, 0.22 - 0.08 * i]);  // the charge leaves him behind himself
        if (s > tc && s < tw + 0.06) for (let i = 1; i <= 4; i++) { const at = s - i * 0.035; if (at > tc) g.push(["kapi", at, 0.34 - 0.07 * i]); }  // multiples along the flight
        K.ghosts(s, g);
        draw(t, K.proj(P1));
        const k = seg(s, tc, tw);
        if (t > tc + hs - 2 * F && t < twR + 0.15) { const m = smear.filter((_, i) => i / 14 <= k + 0.01); if (m.length > 2) c.ink.arc(m.map(K.proj), 120, 1 - seg(t, twR, twR + 0.15)); }  // the brush smear along his flight
        if (t > tc + hs && t < twR + 0.1) c.ink.speed(Math.PI, t, 0.8 * (1 - seg(t, twR, twR + 0.1)), { seed: 3 });
        const Wp = K.proj(P2); if (t >= twR && t < twR + 0.4) { c.ink.spikes(Wp[0], Wp[1], 170, 41, (t - twR) / 0.4); c.ink.ring(Wp[0], Wp[1], 300, 300, (t - twR) / 0.4); }  // the wall impact's own read, beside the cracks
        if (s > tw + 0.25 && s < 3.7) { const h = K.proj(K.head(kapi, 0.8).add(new THREE.Vector3(0, 0.02, 0))); c.ink.stars(h[0], h[1], 60 * (0.3 / cam(t).w), s - tw); }
        K.breath(t, R(5.0), kapi, 43); K.sweat(t, 5.68, 0.75);
      } };
  },

  // 3. THE CLASH ABOVE THE BOOK: the decisive exchange, and the bow. Wukong's back foot digs in, the staff tip trembles; both leap; the block
  // throws them apart, the long slow lock in the air (his tail bristles as a counterweight; the bull's fast small snorts, horns dipping, two
  // sweat drops, a gulp); Wukong's fist tightens, one long breath out, the quiet (AD10); the decisive blow from above (his eyes shut, a horn tip
  // chips), the fall, dust settling in silence, the replay (AD9); home on the page (AD16): the bull gets up and bows with warm eyes; Wukong bows back.
  clash: c => {
    const K = kit(c), { kapi, ox, staff, oxp, THREE } = c, z = 0.27;
    const t1 = 1.55, hs1 = 5 * F, td = 4.22, hs2 = 16 * F, slowEnd = 3.5;  // the first contact is blocked: a short 5f stop; the lock is long and slow
    const rates = [[0, 1], [t1, 1], [t1, 0], [t1 + hs1, 0], [t1 + hs1, 0.3], [slowEnd, 0.3], [slowEnd + 4 * F, 1], [td, 1], [td, 0], [td + hs2, 0], [td + hs2, 1]];
    const replay0 = 5.45, replay1 = 6.65;
    const Tm = clock(12, rates), Td = Tm(td), Tc = Tm(t1), Tland = Td + 0.42, dur = +(td + hs2 + (Tland + 4.2 - Td)).toFixed(2);
    const T = clock(dur, [...rates, [replay0, 1], [replay0, 0.4], [replay1, 0.4], [replay1, 1]], [[replay0, Td - 0.3], [replay1, "resume"]]), R = s => realOf(Tm, s), S = Tm;
    const kx0 = -0.2, ox0 = 0.22, C = new THREE.Vector3(0.0, c.y0 + 0.36, z), kLand = new THREE.Vector3(-0.14, 0, z), oLand = new THREE.Vector3(0.18, 0, z - 0.1);
    const low = a => {  // the crouch's lowest hips, then the frame they rise fastest (the spring)
      const h = K.sample(a, "crouch_leap2", () => K.wp(a, "hips").y); let lo = 0; for (let i = 1; i < h.length * 0.7; i++) if (h[i][1] < h[lo][1]) lo = i;
      let up = lo + 1; for (let i = lo + 1; i < Math.min(h.length, lo + 20); i++) if (h[i][1] - h[i - 1][1] > h[up][1] - h[up - 1][1]) up = i;
      return [h[lo][0], h[Math.min(up, h.length - 1)][0]];
    };
    const [kLo, kOff] = low(kapi), [oLo, oOff] = low(ox);
    const thr = K.sample(kapi, "staff_thrust", () => staff.tip(1).z).reduce((b, x) => (x[1] > b[1] ? x : b))[0];
    const ram = K.sample(ox, "headbutt2", () => K.wp(ox, "head").z - K.wp(ox, "hips").z).reduce((b, x) => (x[1] > b[1] ? x : b))[0];
    const lie = K.sample(ox, "knocked_down", () => K.wp(ox, "head").y).reduce((b, x) => (x[1] < b[1] - 0.002 ? x : b))[0];
    const ks = K.strike("staff_overhead", 0.05);
    let kAir = new THREE.Vector3(-0.1, 0.33, z), oAir = new THREE.Vector3(0.07, 0.26, z), oDec = oAir.clone();
    const kpos = s => { const air = seg(s, 1.0, Tc), down = seg(s, Td, Td + 0.85);  // Wukong's flight: the leap, the lock, the wind-up rise and the strike's drop, the flip back down to the page
      return s < 1.0 ? new THREE.Vector3(kx0, 0, z) : s < Td ? new THREE.Vector3(lerp(kx0, kAir.x, out3(air)) - 0.012 * seg(s, Tc, Td - 0.6) + 0.032 * seg(s, Td - 0.15, Td), lerp(0, kAir.y, out3(air)) + 0.05 * Math.sin(Math.PI * air) + 0.03 * seg(s, Td - 0.6, Td - 0.15) - 0.05 * seg(s, Td - 0.15, Td), z)
        : new THREE.Vector3(lerp(kAir.x + 0.02, kLand.x, down), lerp(kAir.y - 0.02, 0, in2(down)) + 0.12 * Math.sin(Math.PI * down) * (1 - down), z); };
    const oxPos = s => { const air = seg(s, 1.0, Tc), oDown = seg(s, Td, Tland);
      return s < 1.0 ? new THREE.Vector3(ox0, 0, z) : s < Tc ? new THREE.Vector3(lerp(ox0, oAir.x, out3(air)), lerp(0, oAir.y, out3(air)) + 0.05 * Math.sin(Math.PI * air), z)
        : s < Td ? oAir.clone().lerp(oDec, sine(seg(s, Tc, Td))) : new THREE.Vector3(lerp(oDec.x, oLand.x, fastOut(oDown)), lerp(oDec.y, 0, in2(oDown)), lerp(oDec.z, oLand.z, oDown)); };
    const push = s => fastOut(seg(s, Tc, Tc + 0.28)) * (1 - sine(seg(s, Td - 0.75, Td - 0.15)));  // the block throws both back apart (15f), then they close again for the decisive blow
    const kx = s => { const p = kpos(s).add(new THREE.Vector3(-0.045 * push(s) - 0.006 * sine(seg(s, 0.5, 0.62)) * (1 - seg(s, 0.95, 1.05)), 0, 0)), pitch = s > 1.05 && s < Tc - 0.15 ? -360 * sine(seg(s, 1.05, Tc - 0.15)) : s > Td + 0.05 && s < Td + 0.7 ? 360 * sine(seg(s, Td + 0.05, Td + 0.7)) : 0;  // the back foot digs in; a forward flip up, a back flip down
      return { x: p.x - kx0, y: p.y, z: 0, pitch }; };
    const oxx = s => { const p = oxPos(s).add(new THREE.Vector3(0.05 * push(s), 0, 0)); return { x: p.x - ox0, y: p.y, z: p.z - z, pitch: s > 1.0 && s < Td ? -12 * seg(s, 1.0, 1.3) : 0 }; };
    const kSegs = (yT, yD) => [
      { t: 0, clip: "guard", p: [kx0, z], yaw: 90 },
      { t: 0.4, clip: "crouch_leap2", map: ramp([[0.4, kLo * 0.3], [0.95, kLo], [1.05, kOff]]), p: [kx0, z], fade: 0.22 },  // the crouch (anticipation), then the spring
      { t: 1.15, clip: "staff_thrust", map: ramp([[1.15, thr * 0.4], [Tc, thr], [Td - 0.75, thr + 0.05]]), p: [kx0, z], yaw: yT, fade: 0.15 },  // the thrust meets the horns, and leans on them through the lock (turned so its end is on the line)
      { t: Td - 0.75, clip: "staff_overhead", map: ramp([[Td - 0.75, ks.top * 0.2], [Td - 0.12, ks.top], [Td, ks.hit], [Td + 0.5, ks.hit + 0.3]]), p: [kx0, z], yaw: yD, fade: 0.25 },  // the decisive blow
      { t: Td + 0.75, clip: "land_crouch", from: 0.55, rate: 1.1, p: [kx0, z], yaw: 90, fade: 0.12 },
      { t: Td + 1.6, clip: "cheer", p: [kx0, z], fade: 0.35 },
      { t: Tland + 2.9, clip: "guard", p: [kx0, z], fade: 0.3 },  // then he bows back, over the staff
    ];
    let yT = 90, yD = 90, kt = K.tl(kapi, kSegs(yT, yD), kx);
    const ot = K.tl(ox, [
      { t: 0, clip: "bull_guard", p: [ox0, z], yaw: -90 },
      { t: 0.4, clip: "crouch_leap2", map: ramp([[0.4, oLo * 0.3], [0.95, oLo], [1.05, oOff]]), p: [ox0, z], fade: 0.22 },
      { t: 1.15, clip: "headbutt2", map: ramp([[1.15, ram * 0.3], [Tc, ram], [Td, ram + 0.04]]), p: [ox0, z], fade: 0.15 },  // horns first into the clash, held through the lock
      { t: Td + 0.02, clip: "knocked_down", map: ramp([[Td, 0.1], [Tland, lie], [Tland + 1.3, lie + 0.3]]), p: [ox0, z], fade: 0.08 },  // struck back and down onto his back
      { t: Tland + 1.35, clip: "get_up2", from: 0.2, rate: 1.2, fade: 0.45 },
      { t: Tland + 2.6, clip: "yield2", fade: 0.4 },  // he bows, deeply
    ], oxx);
    K.cast.kt = kt; K.cast.ot = ot;
    const reK = () => { kt = K.tl(kapi, kSegs(yT, yD), kx); K.cast.kt = kt; };
    staff.both = hold([[0.38, 1.18], [Td + 0.12, Tland + 2.95]]);  // one hand in the crouch and spring, the landing and the cheer
    staff.grip = s => -0.2 - 0.1 * win(s, Td - 0.8, Td + 0.4, 0.12); staff.twirl = () => 0; staff.cock = s => lerp(0.35, 0.9, seg(s, Td + 1.55, Td + 1.85)) * (1 - seg(s, Tland + 2.8, Tland + 3.0));
    staff.tremble = s => 2.5 * win(s, 0.82, 1.0, 0.05);
    K.fist(kapi, "right", S(3.3), S(3.55)); K.bow(kapi, Tland + 3.15, 0.6, 26);
    kapi.look = { at: () => K.head(ox), w: s => (s > 1.05 && s < Tc - 0.1 ? 0 : s > Td && s < Td + 0.8 ? 0 : s > Tland + 3.1 && s < Tland + 3.8 ? 0 : 1) };
    ox.look = { at: () => K.head(kapi), w: s => (s < Td ? 0.7 : s < Tland + 2.3 ? 0 : s < Tland + 2.6 ? 0.6 : 0) };
    oxp.glow = s => (s < Tc ? 1.2 : s < S(2.4) ? 1 : s < Td ? 0.8 + 0.2 * Math.sin(s * 90) : s < Td + 0.6 ? 0.25 : s < Tland + 2.2 ? 0.7 : 1);  // sure, then flickering fear, dark at the blow
    oxp.warm = s => seg(s, Tland + 2.2, Tland + 2.6); oxp.squint = s => win(s, Td - 0.03, Td + 0.6, 0.05);
    oxp.droop = s => 12 * seg(s, S(2.4), S(2.4) + 0.12); oxp.tremble = s => win(s, S(2.05), S(2.5), 0.03);
    ox.turn("neck", K.nod(ox), s => 7 * bump(s, S(3.1), 0.09));  // the gulp (story time runs at 0.3 here)
    // solved: Wukong placed so the staff's end is on the horns at C on the clash frame; the Ox King's horns brought to C; on the decisive frame his brow brought to the staff
    for (let i = 0; i < 3; i++) { const d = K.aimYaw(Tc, 90); if (Math.abs(d) < 1) break; yT += d; reK(); }
    for (let i = 0; i < 5; i++) { const e = K.strikeEnd(Tc).sub(C); if (e.length() < 0.002) break; kAir = kAir.clone().sub(e); }
    for (let i = 0; i < 5; i++) { const e = K.touch(Tc, () => oxp.point("brow").lerp(oxp.point("crown"), 0.4)).sub(C).add(new THREE.Vector3(0.012, -0.01, 0)); oAir = oAir.clone().sub(e); }
    for (let i = 0; i < 4; i++) { const [d, out] = K.touch(Tc, () => K.inHead(C)); if (d <= 0) break; oAir = oAir.clone().addScaledVector(out, d); }  // the staff's end on his horns' root, not in his head
    const tipAt = new THREE.Vector3();
    for (let i = 0; i < 3; i++) { const d = K.aimYaw(Td, 90); if (Math.abs(d) < 1) break; yD += d; reK(); }
    for (let i = 0; i < 5; i++) { tipAt.copy(K.strikeEnd(Td)); const e = K.touch(Td, () => oxp.point("brow")).sub(tipAt).add(new THREE.Vector3(0.008, -0.004, 0)); oDec = oDec.clone().sub(e); }
    for (let i = 0; i < 4; i++) { tipAt.copy(K.strikeEnd(Td)); const [d, out] = K.touch(Td, () => K.inHead(tipAt)); if (d <= 0) break; oDec = oDec.clone().addScaledVector(out, d); }
    K.close(Td - 0.05, Td + 0.05);  // the decisive blow lands: its last gap closed through the hit-stop (story time holds at Td)
    // the contacts, measured: the block, the decisive blow, his back on the page
    const m1 = K.touch(Tc, () => K.contact.staff()), blow = K.strikeEnd(Td).sub(K.strikeEnd(Td - F)).normalize();
    const [m2, hd] = K.touch(Td, () => { const m = K.contact.staff(); return [m, K.away(ox, m, blow)]; }), m3 = K.touch(Tland, () => K.contact.page(ox)), P1 = m1.p.clone(), P2 = m2.p.clone(), P3 = m3.p.clone();
    ox.hit(Td, hd, 30); oxp.chip = Td;
    const hornTip = K.touch(Td, () => { const h = oxp.horns[0].children[0], g = h.geometry.attributes.position, v = new THREE.Vector3(); let best = null; for (let i = 0; i < g.count; i++) { v.fromBufferAttribute(g, i); if (!best || v.lengthSq() > best.lengthSq()) best = v.clone(); } return h.localToWorld(best); });
    K.impact("the block: staff on the horns' root", t1, Tc, () => K.contact.staff(), m1, P1, ox.h);
    K.impact("the decisive blow on his brow", td, Td, () => K.contact.staff(), m2, P2, ox.h);
    K.impact("his back on the page", td + hs2 + 0.42, Tland, () => K.contact.page(ox), m3, P3, ox.h);
    const back = K.touch(0.55, () => [K.wp(kapi, "leftFoot"), K.wp(kapi, "rightFoot")].reduce((a, b) => (a.x < b.x ? a : b)));
    c.fx.burst("dust", [back.x, c.y0 + 0.004, back.z], 0.55, { n: 16, sp: 0.18, up: 0.04, life: 0.8, size: 0.04, flat: true, dir: [-1, 0, 0], cone: 0.6, seed: 50 });  // the back foot digs in
    for (const [a, x, sd] of [[kapi, kx0, 51], [ox, ox0, 52]]) { const f = K.touch(1.0, () => K.contact.page(a, /Foot|Toes/)).p; c.fx.burst("dust", [f.x, c.y0 + 0.005, f.z], 1.0, { n: 30, sp: 0.3, up: 0.05, life: 0.9, size: a === ox ? 0.07 : 0.06, flat: true, seed: sd }); }
    K.later(Tc, () => { for (let s = Tc; s < Tc + 0.12; s += 0.02) c.fx.burst("sparks", P1.toArray(), s, { n: 8, sp: 0.6, up: 0.1, life: 0.4, size: 0.009, seed: Math.round(s * 1000) });  // the block: sparks fly from the staff on the horns
    c.fx.ring(P1.toArray(), m1.n.toArray(), Tc, { r1: 0.18, life: 0.4, width: 1.4 }); });  // the block's shockwave, square to the contact
    for (const [t, sd] of [[2.05, 53], [2.22, 54], [2.39, 55]]) { const s = S(t), p = K.touch(s, () => oxp.point("nose")); c.fx.burst("dust", p.toArray(), s, { n: 5, sp: 0.08, up: 0.01, life: 0.3, size: 0.018, dir: [-1, -0.4, 0], cone: 0.4, seed: sd }); }  // fast small snorts: he is tired and afraid
    c.fx.debris(hornTip.toArray(), Td, { n: 4, sp: 0.25, up: 0.3, dir: [1, 0, 0.3], floor: c.y0, size: 0.006, colors: [[0.9, 0.85, 0.72], [0.35, 0.28, 0.22]], seed: 56 });  // the horn tip chips off
    const draw1 = hitFx(c, K, { tc: t1, T: Tc, p: P1, seed: 61, impact: false, glare: true });  // a block: no impact frame (the blow did not land), a glare and a ring
    const draw2 = hitFx(c, K, { tc: td, T: Td, p: P2, seed: 71, normal: m2.n.clone().add(new THREE.Vector3(0, 0, 1)).normalize().toArray(), big: 1.15, invert: true, glare: true });  // the decisive blow: the inverted impact frame, the glare
    const landR = td + hs2 + 0.42; K.hits.recoils.push(td + hs2); K.hits.kicks.push(blow);  // the camera kicks along the blow as it lets go
    K.later(Tland, () => { c.fx.burst("dust", [P3.x, c.y0 + 0.01, P3.z], Tland, { n: 70, sp: 0.5, up: 0.04, life: 1.3, size: 0.08, flat: true, seed: 81 });
    c.fx.burst("dust", [P3.x, c.y0 + 0.02, P3.z], Tland + 0.6, { n: 26, sp: 0.04, up: -0.005, life: 2.6, size: 0.05, seed: 84 });  // then it settles, in silence
    c.fx.ring([P3.x, c.y0 + 0.006, P3.z], [0, 1, 0], Tland, { r1: 0.3, life: 0.5 }); c.fx.debris([P3.x, c.y0 + 0.02, P3.z], Tland, { n: 14, sp: 0.3, up: 0.4, dir: [0, 0, 0.5], floor: c.y0, size: 0.009, colors: [[0.93, 0.89, 0.8], [0.85, 0.66, 0.3]], seed: 82 }); });
    { const f = K.touch(Td + 0.85, () => K.contact.page(kapi, /Foot|Toes/)).p; c.fx.burst("dust", [f.x, c.y0 + 0.005, f.z], Td + 0.85, { n: 20, sp: 0.2, up: 0.03, life: 0.8, size: 0.05, flat: true, seed: 83 }); }
    const footAt = back.clone().add(new THREE.Vector3(0.015, 0.012, 0)), fistAt = K.touch(S(3.45), () => K.wp(kapi, "rightHand"));
    const mid = s => (s < 1.0 ? [0, 0.13, z] : s < Tc ? [0, lerp(0.13, P1.y, sine(seg(s, 1.0, Tc))), z] : P1.toArray());
    const cam = K.track([
      { t: 0, at: [0, 0.13, z], yaw: 0, pitch: 7, w: 0.5, wT: 0.3, yawT: 10, pitchT: 18 },  // AD1: both on the page, the hall behind
      { t: 0.5, at: [0, 0.13, z], yaw: 0, pitch: 6.5, w: 0.49, wT: 0.295, yawT: 10, pitchT: 17 },
      { t: 0.5, cut: true, at: footAt.toArray(), yaw: 24, pitch: 10, w: 0.1, wT: 0.08, yawT: 24 },  // INSERT: his back foot digs in, the staff tip trembles
      { t: 1.0, at: footAt.toArray(), yaw: 24, pitch: 10, w: 0.096, wT: 0.077, yawT: 24 },
      { t: 1.0, cut: true, at: [0, 0.13, z], yaw: 0, pitch: 6, w: 0.48, wT: 0.29, yawT: 10, pitchT: 16 },  // back to the pair as they spring
      { t: t1 - 0.12, at: () => mid(T(cam.now)), yaw: 0, pitch: -10, w: 0.42, wT: 0.24, yawT: 25 },  // a crane up with the leap (the sky behind: the room stays out)
      { t: t1 + 0.03, at: P1.clone().add(new THREE.Vector3(-0.04, -0.04, 0)).toArray(), yaw: -4, pitch: -12, w: 0.4, wT: 0.24, yawT: 22, zf: 1.3, e: out3 },  // the crash zoom: 9f into the clash
      { t: t1 + 0.62, at: P1.clone().add(new THREE.Vector3(-0.04, -0.04, 0)).toArray(), yaw: -8, pitch: -12, w: 0.4, wT: 0.24, yawT: 18, zf: 1.25 },
      { t: t1 + 0.62, cut: true, at: P1.clone().add(new THREE.Vector3(-0.02, -0.06, -0.02)).toArray(), yaw: 0, pitch: 2, w: 0.52, wT: 0.34, yawT: 0, pitchT: 4 },  // the quiet: a wide profile of the locked pair in the air, drifting slowly
      { t: 2.7, at: P1.clone().add(new THREE.Vector3(-0.02, -0.06, -0.02)).toArray(), yaw: 3, pitch: 2, w: 0.5, wT: 0.33, yawT: 3, pitchT: 4 },
      { t: 2.7, cut: true, at: () => oxp.point("temple").toArray(), yaw: -30, pitch: 6, w: 0.075, wT: 0.06, yawT: -30 },  // INSERT: the bull's fear: two sweat drops, a gulp, horns dipping
      { t: 3.25, at: () => oxp.point("temple").toArray(), yaw: -30, pitch: 6, w: 0.072, wT: 0.058, yawT: -30 },
      { t: 3.25, cut: true, at: () => K.wp(kapi, "rightHand").toArray(), yaw: 26, pitch: 8, w: 0.09, wT: 0.07, yawT: 26 },  // INSERT: Wukong's fist tightens on the staff: his decision
      { t: 3.76, at: () => K.wp(kapi, "rightHand").toArray(), yaw: 26, pitch: 8, w: 0.09, wT: 0.07, yawT: 26 },
      { t: 3.76, cut: true, at: () => P2.clone().add(new THREE.Vector3(-0.04, 0.0, 0)).toArray(), yaw: -42, pitch: -9, w: 0.38, wT: 0.2, yawT: -60 },  // the decisive blow: low on the hero (AD7), the sky behind
      { t: td + hs2, at: () => P2.clone().add(new THREE.Vector3(-0.04, 0.0, 0)).toArray(), yaw: -42, pitch: -9, w: 0.38, wT: 0.2, yawT: -60 },
      { t: td + hs2, cut: true, at: [P3.x - 0.04, c.y0 + 0.04, P3.z], yaw: -6, pitch: 68, w: 0.4, wT: 0.26, yawT: -6 },  // from high above: he falls onto the page, the dust ring spreads, then settles
      { t: replay0, at: [P3.x - 0.04, c.y0 + 0.04, P3.z], yaw: -10, pitch: 64, w: 0.38, wT: 0.25, yawT: -10 },
      { t: replay0, cut: true, at: () => P2.clone().add(new THREE.Vector3(-0.04, 0.02, 0)).toArray(), yaw: 12, pitch: -6, w: 0.3, wT: 0.17, yawT: 25 },  // AD9: the decisive blow again, a second angle (54 degrees round), 40% speed
      { t: replay1, at: () => P2.clone().add(new THREE.Vector3(-0.04, 0.02, 0)).toArray(), yaw: 8, pitch: -5, w: 0.28, wT: 0.16, yawT: 21 },
      { t: replay1, cut: true, at: [0.02, 0.12, z - 0.03], yaw: 0, pitch: 12, w: 0.52, wT: 0.4, yawT: 10, pitchT: 21 },  // AD16: home on the page, a wide: the bow both ways
      { t: dur, at: [0.02, 0.12, z - 0.03], yaw: 0, pitch: 11, w: 0.5, wT: 0.39, yawT: 8, pitchT: 20 },
    ]);
    K.hits.cuts.push(0.5, 1.0, t1 + 0.62, 2.7, 3.25, 3.76, td + hs2, replay0, replay1); K.hits.zooms = 1; K.check();
    const Rr = s => +(s + (td + hs2 - Td)).toFixed(3);  // film time after the decisive blow (the replay shows the past; the story resumes as if it had run on)
    [[0.55, "kapi", "his back foot slides back and digs in, dust"], [0.88, "kapi", "the staff tip trembles"], [1.7, "kapi", "his tail bristles: a counterweight in the lock"], [2.05, "ox", "fast small snorts (tired, afraid), the ring shivers and jingles"],
      [2.4, "ox", "his horns dip"], [2.75, "ox", "two sweat drops slide down, his eyes flicker"], [3.1, "ox", "a gulp"], [3.45, "kapi", "his fist loosens, then closes tight: his decision"], [3.8, "kapi", "one long breath out"],
      [td, "ox", "his eyes shut dark at the blow; a horn tip chips off (his cost)"], [Rr(Tland + 0.6), "place", "the dust settles round him in silence"], [Rr(Tland + 1.35), "ox", "he gets up"], [Rr(Tland + 2.2), "ox", "his eyes turn warm amber"],
      [Rr(Tland + 2.6), "ox", "a deep bow"], [Rr(Tland + 3.15), "kapi", "Wukong bows back: sworn brothers"]].forEach(([t, w, x]) => K.tell(t, w, x));
    const freezes = [{ t: td + 4 * F, len: 0.5, at: () => K.proj(P2), ang: -Math.PI / 2 - 0.4 }];  // the decisive blow held (the clash is not: it gets the slow lock)
    return { dur, freezes, impacts: K.impacts, strike: [3.45, 4.3],
      shots: [[0, "wide"], [0.5, "insert: his back foot digs in, the staff tip trembles"], [1.0, "crane up, crash zoom"], [t1 + 0.62, "wide profile: the lock"], [2.7, "insert: the bull's sweat, a gulp"], [3.25, "insert: Wukong's fist tightens"], [3.76, "low angle"], [td + hs2, "top-down"], [replay0, "replay angle"], [replay1, "wide: the bow both ways"]],
      info: { clash: t1, decisive: td, landing: landR, replay: [replay0, replay1], slowMotion: [t1 + hs1, slowEnd, 0.3], keys: { kLo, kOff, thr, ram, lie, ks }, strikeYaw: [+yT.toFixed(1), +yD.toFixed(1)], hitDir: hd.toArray().map(v => +v.toFixed(2)), flashes: K.hits.flash, cuts: K.hits.cuts, tells: K.tells },
      cues: [["leap", 0.95, 0.9], ["swoosh-big", 1.05, 0.6], ["clang", t1, 1], ["thump", t1, 0.8], ["snort", 2.05, 0.35], ["jingle", 2.1, 0.2], ["gulp", 3.1, 0.6], ["whoosh", td - 0.18, 1], ["hit", td, 1], ["boom", td, 0.7], ["swoosh-big", td + hs2, 0.6],
        ["land", landR, 1], ["boom", landR, 0.9], ["crumble", landR + 0.1, 0.5], ["whoosh", replay0 + 0.45, 0.5], ["hit", replay0 + 0.75, 0.6]],
      at(t, render) {
        const s = T(t); cam.now = t; K.pose(s); K.shake(t, td, hs2, 0.003, 0.0015, s); K.fire(s);
        c.fx.at(s); K.shoot(cam(t), t); render();
        K.ghosts(s, s < Td + 0.02 ? K.smear(s, Td - 0.12, Td + 0.001) : []);  // the decisive staff smears
        draw1(t, K.proj(P1)); draw2(t, K.proj(P2));
        if (t > t1 + hs1 && t < t1 + hs1 + 0.25) c.ink.speed(0, t, 0.7 * (1 - seg(t, t1 + hs1 + 0.15, t1 + hs1 + 0.25)), { seed: 19, band: 0.4, cy: K.proj(P1)[1] });  // thrown apart: lines both ways along the line between them
        if (t > t1 + hs1 + 0.3 && t < slowEnd) c.ink.focus(...K.proj(P1).slice(0, 2), 900 + Math.floor(t * 3), 0.45 * seg(t, t1 + hs1 + 0.3, t1 + hs1 + 0.6) * (1 - seg(t, slowEnd - 0.2, slowEnd)), 300);  // the still hover before the blow
        if (t > td + hs2 && t < td + hs2 + 0.3) c.ink.speed(-Math.PI / 2 - 0.25, t, 0.9 * (1 - seg(t, td + hs2 + 0.2, td + hs2 + 0.3)), { seed: 13 });  // the fall's speed lines
        if (t >= replay0 + 0.75 && t < replay0 + 1.05) { const P = K.proj(P2); c.ink.spikes(P[0], P[1], 130, 74, (t - replay0 - 0.75) / 0.3); c.ink.burst(P[0], P[1], 110, 72, (t - replay0 - 0.75) / 0.3); }  // the replay's contact: spikes and a star, no second impact frame
        const L = K.proj(P3); if (t < replay0) { c.ink.ring(L[0], L[1], 340, 90, (t - landR) / 0.45); if (t >= landR && t < landR + 0.35) c.ink.spikes(L[0], L[1], 140, 91, (t - landR) / 0.35); }
        if (t > replay0 + 0.5 && t < replay0 + 0.8) c.ink.arc(K.arc(s, 8, 0.015), 50);
        if (t < replay0) { K.bristle(t, 1.7, 0.75); K.sweat(t, 2.75, 0.5); if (t > 2.95 && t < 3.25) { const p = oxp.point("temple").add(new THREE.Vector3(0, 0.012, 0.004)), P = K.proj(p); c.ink.sweat(P[0], P[1], 0.45 * K.srad(p, 0.006), (t - 2.95) / 0.3); } K.breath(t, 3.8, kapi, 45); }
      } };
  },

  // 4. SPLIT SCREEN: the stare-down, the trick, the comic beat. The wide; the two faces in panels (one at a time, each facing in across the
  // gutter, AD5): Wukong's cheeky head tilt, the bull's big slow snort, a petal drifting across the gutter; the petal lands on the page between
  // them (the signal), both charge; Wukong vanishes and is behind him, the staff taps his crown; the bull's shock (shiver lines, horns droop);
  // he turns round to find nobody and scratches his head (the fight's one comic beat); Wukong twirls the staff and cheers.
  split: c => {
    const K = kit(c), { kapi, ox, staff, oxp, THREE } = c, dur = 7.6, z = 0.27, tc = 4.1, hs = 10 * F;
    const T = clock(dur, [[0, 1], [tc, 1], [tc, 0], [tc + hs, 0], [tc + hs, 1]]), R = s => realOf(T, s);
    const run0 = 3.45, off = 3.8, sV = off - 0.02, sR = tc - 3 * F, land = 4.45;  // the teleport: gone at sV in front of him, back 3f before the blow, behind him
    // Wukong's run speed, from his own Run clip: how fast a planted foot goes back under him (his travel over the page matches it: no sliding)
    const fz = K.sample(kapi, "Run", () => [K.wp(kapi, "leftFoot"), K.wp(kapi, "rightFoot")].reduce((a, b) => (a.y < b.y ? a : b)).z), sp = [];
    for (let i = 1; i < fz.length; i++) sp.push((fz[i - 1][1] - fz[i][1]) / F);
    const vRun = clamp(sp.sort((a, b) => a - b)[Math.floor(sp.length * 0.5)], 0.05, 0.6);
    const ot = K.tl(ox, [
      { t: 0, clip: "bull_guard", p: [0.3, z], yaw: -90 },
      { t: run0 + 0.15, clip: "charge2", from: 0.1, rate: 0.7, fade: 0.2, match: 0.4 },
      { t: tc + 0.6, clip: "dizzy2", turn: 180, fade: 0.6 },  // the blow from behind presses his head down; he runs on, then turns, too late, to find nobody
    ]);
    const oxAt = s => K.quiet(() => { ot.at(s); return K.wp(ox, "hips"); });
    const kTake = oxAt(sV).x - 0.15, k0 = kTake - vRun * (sV - run0);
    const [kLo] = (() => { const h = K.sample(kapi, "crouch_leap2", () => K.wp(kapi, "hips").y); let lo = 0; for (let i = 1; i < h.length * 0.7; i++) if (h[i][1] < h[lo][1]) lo = i; return [h[lo][0]]; })();
    const ks = K.strike("staff_overhead", 0.02);
    let B = new THREE.Vector3(oxAt(tc).x + 0.12, 0.2, 0);  // where he reappears: behind and above the Ox King's head (solved below)
    const kAt = s => (s < run0 ? [k0, 0, 0] : s < sV ? [lerp(k0, kTake, (s - run0) / (sV - run0)), 0, 0] : s < sR ? [kTake, 0, 0] : s <= tc ? [B.x, B.y, B.z] : [B.x + 0.06 * seg(s, tc, land), B.y * (1 - in2(seg(s, tc, land))), B.z * (1 - seg(s, tc, land))]);
    const kx = s => { const [x, y, dz] = kAt(s); return { x: x - k0, y, z: dz, pitch: s > sR && s < land ? 14 * Math.sin(Math.PI * seg(s, sR, land)) : 0 }; };
    const kSegs = yS => [
      { t: 0, clip: "guard", p: [k0, z], yaw: 90 },
      { t: run0, clip: "Run", p: [k0, z], fade: 0.15 },
      { t: sV - 0.12, clip: "crouch_leap2", map: ramp([[sV - 0.12, kLo * 0.8], [sV, kLo]]), p: [k0, z], fade: 0.08 },  // he gathers, and is gone
      { t: sR, clip: "staff_overhead", map: ramp([[sR, ks.top], [tc, ks.hit], [land, ks.hit + 0.3]]), p: [k0, z], yaw: yS, fade: 0 },  // behind him, already striking
      { t: land - 0.04, clip: "land_crouch", from: 0.55, p: [k0, z], yaw: -90, fade: 0.1 },
      { t: 4.9, clip: "guard", p: [k0, z], fade: 0.3 },
      { t: 6.1, clip: "staff_spin", p: [k0, z], fade: 0.25 },
      { t: 6.8, clip: "cheer", p: [k0, z], fade: 0.3 },
    ];
    let yS = -90, kt = K.tl(kapi, kSegs(yS), kx); K.cast.kt = kt; K.cast.ot = ot;
    staff.both = hold([[run0 - 0.05, sR - 0.01], [tc + 0.1, 5.15], [6.0, 99]]);  // one hand in the run, the landing, the spin and the cheer
    staff.grip = s => (s > 6.1 && s < 7.0 ? lerp(-0.2, 0, win(s, 6.1, 7.0, 0.2)) : -0.2 - 0.1 * win(s, sR - 0.15, tc + 0.15, 0.1));
    staff.twirl = s => 540 * sine(seg(s, 6.25, 6.85)); staff.cock = s => lerp(0.35, 0.9, seg(s, 6.85, 7.1));  // raised in the cheer, along his arm
    kapi.look = { at: () => K.head(ox), w: s => (s > sV && s < land + 0.3 ? 0.5 : 1) };
    kapi.turn("head", () => kapi.faceDir(), s => 12 * win(s, 1.2, 1.75, 0.12));  // the cheeky head tilt
    ox.look = { at: () => K.head(kapi), w: s => (s < run0 ? 1 : s < sV ? 0.3 : s < tc + 0.75 ? 0 : 0.7) };  // he never sees him come round
    oxp.glow = s => (s < tc ? 1.2 : s < tc + 0.06 ? 0.3 : 0.9); oxp.tremble = s => win(s, 0.3, 0.8, 0.1) + win(s, 2.0, 2.5, 0.1); oxp.droop = s => 12 * win(s, 4.97, 6.9, 0.25);
    ox.reach.push({ side: "right", w: s => win(s, 5.75, 6.45, 0.15), at: s => oxp.point("crown").add(ox.faceDir().multiplyScalar(-0.25 * oxp.hh)).add(new THREE.Vector3(0, 0, 0.2 * oxp.hh * Math.sin(s * 2 * Math.PI * 4))) });  // he scratches his head
    ox.grip = { right: s => 0.6 * win(s, 5.75, 6.45, 0.15) };
    // solved: where Wukong must hang behind him so the staff's end comes down on the top of his head (the capsule's top), on the contact frame
    const crownAt = () => K.touch(tc, () => { const q = ox.caps().find(q => q.n === "head"), top = q.a.y > q.b.y ? q.a : q.b; return top.clone().add(new THREE.Vector3(0, q.r + 0.0055, 0)); });  // the top of his head's capsule
    for (let i = 0; i < 3; i++) { const d = K.aimYaw(tc, -90); if (Math.abs(d) < 1) break; yS += d; kt = K.tl(kapi, kSegs(yS), kx); K.cast.kt = kt; }
    for (let i = 0; i < 8; i++) { const cr = crownAt(), tip = K.strikeEnd(tc), e = cr.sub(tip); if (e.length() < 0.002) break; B = B.clone().add(e); }
    const blow = K.strikeEnd(tc).sub(K.strikeEnd(tc - F)).normalize();
    K.close(tc - 0.05, tc + 0.05);  // the tap lands: its last gap closed through the hit-stop
    const [m, hd] = K.touch(tc, () => { const m = K.contact.staff(); return [m, K.away(ox, m, blow)]; }), P = m.p.clone(), kEnd = B.x + 0.06;
    ox.hit(tc, hd, 28);
    K.impact("the staff on his crown", tc, tc, () => K.contact.staff(), m, P, ox.h);
    const oEnd = K.quiet(() => { K.pose(5.5); return K.wp(ox, "hips"); }), oStart = ot.roots[0].x;
    const draw = hitFx(c, K, { tc, T: tc, p: P, seed: 101, normal: m.n.clone().add(new THREE.Vector3(0, 0, 1)).normalize().toArray() });
    c.fx.burst("dust", [oEnd.x, c.y0 + 0.005, z], tc + 0.5, { n: 30, sp: 0.3, up: 0.05, life: 1, size: 0.07, flat: true, dir: [-1, 0, 0], cone: 0.6, seed: 102 });
    { const f = K.touch(land, () => K.contact.page(kapi, /Foot|Toes/)).p; c.fx.burst("dust", [f.x, c.y0 + 0.005, f.z], land, { n: 20, sp: 0.2, up: 0.04, life: 0.8, size: 0.05, flat: true, seed: 103 }); }
    c.fx.burst("dust", [kTake, c.y0 + 0.005, z], sV, { n: 18, sp: 0.2, up: 0.04, life: 0.7, size: 0.045, flat: true, seed: 104 });
    for (const s of [0.35, 2.0]) { const p = K.touch(s, () => oxp.point("nose")); c.fx.burst("dust", p.toArray(), s, { n: 14, sp: 0.1, up: 0.02, life: 1.1, size: 0.045, dir: [-1, -0.3, 0], cone: 0.4, seed: 105 + s }); }  // big slow snorts: he is sure of himself
    // the petal: from the hall's trees, drifting down between them; it touches the page at run0, the signal to charge
    const petal = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12).scale(1, 0.6, 1), new THREE.MeshStandardMaterial({ color: 0xf6b9c8, side: THREE.DoubleSide, roughness: 0.6 })), pX = (kTake + oxAt(run0).x) / 2 - 0.03;
    petal.castShadow = true; c.scene.add(petal);
    const petalAt = s => { const k = seg(s, 2.3, run0 - 0.05); return [pX + 0.02 * Math.sin(k * 9), c.y0 + 0.0015 + 0.13 * (1 - k) ** 1.3, z + 0.012 * Math.sin(k * 6)]; };
    const kHead = () => K.head(kapi, 0.35).toArray(), oHead = () => K.head(ox, 0.4).toArray();
    const panA = K.track([{ t: 0, at: kHead, yaw: 68, pitch: 3, w: 0.075, wT: 0.08 }, { t: 2.9, at: kHead, yaw: 68, pitch: 3, w: 0.065, wT: 0.07 }]);  // each faces in across the gutter (AD5)
    const panB = K.track([{ t: 0, at: oHead, yaw: -68, pitch: -2, w: 0.1, wT: 0.105 }, { t: 2.9, at: oHead, yaw: -68, pitch: -2, w: 0.085, wT: 0.09 }]);
    const mid = (k0 + oStart) / 2, wide = clamp(oStart - k0 + 0.12, 0.5, 0.58), wp = 10 + 30 * (wide - 0.5), pland = new THREE.Vector3(pX, c.y0 + 0.012, z);
    const cam = K.track([
      { t: 0, at: [mid, 0.11, z - 0.02], yaw: 0, pitch: wp, w: wide, wT: wide * 0.62, yawT: 0, pitchT: 22 },  // AD1
      { t: 2.9, at: [mid, 0.11, z - 0.02], yaw: 0, pitch: wp, w: wide * 0.94, wT: wide * 0.6, yawT: 0, pitchT: 22 },
      { t: 2.9, cut: true, at: pland.toArray(), yaw: 8, pitch: 42, w: 0.1, wT: 0.08, yawT: 8 },  // INSERT: the petal settles on the page: the signal (from above the railing)
      { t: 3.45, at: pland.toArray(), yaw: 8, pitch: 40, w: 0.095, wT: 0.076, yawT: 8 },
      { t: 3.45, cut: true, at: () => K.head(kapi, 0.2).toArray(), yaw: 72, pitch: 16, w: 0.3, wT: 0.2, yawT: 68, pitchT: 18 },  // over the Ox King's shoulder: Wukong charges at us
      { t: 3.95, at: () => K.head(kapi, 0.2).toArray(), yaw: 70, pitch: 14, w: 0.28, wT: 0.19, yawT: 66, pitchT: 16 },
      { t: 3.95, cut: true, at: [0.02, 0.2, z - 0.02], yaw: 0, pitch: -4, w: 0.56, h: 0.38, wT: 0.44, yawT: 0, pitchT: 2 },  // low, side on: the vault and the blow in passing
      { t: 4.75, at: [0.02, 0.17, z - 0.02], yaw: 0, pitch: -2, w: 0.54, h: 0.34, wT: 0.42, yawT: 0, pitchT: 4 },
      { t: 4.75, cut: true, at: () => K.head(ox).toArray(), yaw: -60, pitch: 4, w: 0.13, wT: 0.095, yawT: -50 },  // INSERT: the bull's shock: shiver lines, his horns droop
      { t: 5.3, at: () => K.head(ox).toArray(), yaw: -60, pitch: 4, w: 0.125, wT: 0.092, yawT: -50 },
      { t: 5.3, cut: true, at: [(kEnd + oEnd.x) / 2, 0.12, z], yaw: 0, pitch: 10, w: 0.46, wT: 0.24, yawT: 35, pitchT: 15 },  // the two-shot: nobody there, a head scratch; the spin, the cheer
      { t: dur, at: [(kEnd + oEnd.x) / 2, 0.12, z], yaw: 2, pitch: 10, w: 0.44, wT: 0.23, yawT: 33, pitchT: 15 },
    ]);
    K.hits.cuts.push(0.8, 2.9, 3.45, 3.95, 4.75, 5.3); K.check();
    [[0.35, "ox", "a big slow snort, the ring trembles: sure of himself"], [1.2, "kapi", "a cheeky head tilt"], [1.55, "place", "a petal drifts across the gutter between their faces"], [2.0, "ox", "a second big snort, the ring jingles"],
      [3.4, "place", "the petal touches the page: the signal, then silence"], [tc, "ox", "his eyes dip at the tap"], [4.8, "ox", "shock: shiver lines round his head"], [R(4.97), "ox", "his horns droop"], [R(tc + 0.6), "ox", "he turns round: nobody there; stars"],
      [R(5.75), "ox", "he scratches his head (the fight's comic beat)"], [R(6.1), "kapi", "a show-off staff spin"], [R(6.8), "kapi", "a cheer"]].forEach(([t, w, x]) => K.tell(t, w, x));
    const W = c.W, H = c.H, port = K.port;
    // the two panels with a diagonal gutter; each slides in from its own side (10f), both leave together (8f)
    const polyA = (k, e) => (port ? [[-W * (1 - k) - W * e, 0], [W - W * (1 - k) - W * e, 0], [W - W * (1 - k) - W * e, H * 0.44], [-W * (1 - k) - W * e, H * 0.56]]
      : [[0, -H * (1 - k) - H * e], [W * 0.56, -H * (1 - k) - H * e], [W * 0.44, H - H * (1 - k) - H * e], [0, H - H * (1 - k) - H * e]]);
    const polyB = (k, e) => (port ? [[W * (1 - k) + W * e, H * 0.56], [W + W * (1 - k) + W * e, H * 0.44], [W + W * (1 - k) + W * e, H], [W * (1 - k) + W * e, H]]
      : [[W * 0.56, H * (1 - k) + H * e], [W, H * (1 - k) + H * e], [W, H + H * (1 - k) + H * e], [W * 0.44, H + H * (1 - k) + H * e]]);
    const centre = poly => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
    const freezes = [{ t: tc + 4 * F, len: 0.4, at: () => K.proj(P), ang: Math.PI / 2 }];  // the tap held
    return { dur, freezes, impacts: K.impacts, strike: [sR - 0.25, land],
      shots: [[0, "wide"], [0.8, "panels: a head tilt, a snort, a drifting petal"], [2.9, "insert: the petal lands: the signal"], [3.45, "over the shoulder"], [3.95, "low profile"], [4.75, "insert: the bull's shock, horns droop"], [5.3, "two-shot: a head scratch, the spin, the cheer"]],
      info: { contact: tc, strikeYaw: +yS.toFixed(1), behind: B.toArray().map(v => +v.toFixed(3)), runSpeed: +vRun.toFixed(3), panels: [0.8, 1.15, 2.9], hitDir: hd.toArray().map(v => +v.toFixed(2)), flashes: K.hits.flash, cuts: K.hits.cuts, tells: K.tells },
      cues: [["snort", 0.35, 0.9], ["jingle", 0.45, 0.2], ["swoosh-big", 0.8, 0.35], ["snort", 2.0, 0.8], ["jingle", 2.1, 0.25], ["swoosh-big", 2.9, 0.4], ["whoosh", sV, 0.7], ["leap", sR - 0.05, 0.6], ["whoosh", tc - 0.16, 0.9], ["hit", tc, 1], ["thump", tc, 0.9], ["land", land + hs, 0.5], ["jingle", R(4.97), 0.2], ["leap", R(6.1), 0.5]],
      at(t, render) {
        const s = T(t); K.pose(s); K.shake(t, tc, hs, 0.003, 0.0015, s); K.fire(s);
        kapi.body.visible = staff.mesh.visible = !(s > sV && s < sR);  // the teleport's gap
        petal.visible = s > 2.3; petal.position.set(...petalAt(s)); petal.rotation.set(-Math.PI / 2 + (1 - seg(s, 2.3, run0 - 0.05)) * Math.sin(s * 7) * 0.9, s * 2 * (1 - seg(s, 2.3, run0 - 0.05)), 0);
        c.fx.at(s); K.shoot(cam(t), t); render();
        if (t > 3.45 + 8 * F) {  // after-images round him to the back, fading from the start end; the staff smeared on the blow
          const g = []; if (s > sV && s < sR + 0.12) for (let i = 1; i <= 4; i++) { const age = s - sV - i * 0.03; if (age > 0) g.push(["kapi", sV - 0.001, 0.34 * (1 - clamp(age / 0.22)), (B.x - kTake) * i / 5, B.y * Math.sin(Math.PI * i / 5)]); }
          K.ghosts(s, [...g, ...K.smear(s, sR, tc)]);
          const P0 = K.proj(new THREE.Vector3(kTake, c.y0 + 0.08, z)), P1 = K.proj(new THREE.Vector3(B.x, c.y0 + B.y + 0.08, z + B.z));
          if (t >= sV && t < sV + 0.14) c.ink.puff(P0[0], P0[1], 100, 51, (t - sV) / 0.14);
          if (t >= sR - F && t < sR + 0.1) c.ink.puff(P1[0], P1[1], 70, 53, (t - sR + F) / 0.1);
        }
        const inA = sine(seg(t, 0.8, 0.8 + 10 * F)), inB = sine(seg(t, 1.15, 1.15 + 10 * F)), out = in2(seg(t, 2.9, 2.9 + 8 * F));
        if (t >= 0.8 && t < 2.9 + 8 * F) {
          for (const [pan, poly] of [[panA, polyA(inA, out)], [panB, polyB(inB, out)]]) {  // each panel: the 3D frame from its own camera, its subject moved to the panel's centre by a view offset
            const [cx, cy] = centre(poly); K.shoot(pan(t), t); c.cam.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); c.renderOnly(); c.ink.panel(c.gl, poly); c.cam.clearViewOffset();
          }
          if (t > 1.55 && t < 2.85) { const k = seg(t, 1.55, 2.85); c.ink.petal(port ? W * 0.15 : W * 0.62, port ? H * 0.38 : H * 0.05, port ? W * 0.85 : W * 0.4, port ? H * 0.62 : H * 0.95, k, 7); }  // the petal drifts across the gutter
        }
        K.shoot(cam(t), t);  // the marks below are placed in the wide's frame
        if (t > run0 && t < tc) c.ink.speed(0, t, 0.75 * seg(t, run0, run0 + 0.15), { seed: 17, band: 0.5, cy: K.proj(P)[1] });  // the charge, and the streak round him
        draw(t, K.proj(P));
        K.shiver(t, 4.8, 0.5, ox);
        if (s > tc + 0.6 && s < 7.4) { const h = K.proj(K.head(ox, 0.9).add(new THREE.Vector3(0, 0.02, 0))); c.ink.stars(h[0], h[1], 60 * (0.4 / cam(t).w), s - tc - 0.6); }
        if (s > tc - 0.12 && s < tc) c.ink.arc(K.arc(s), 46);
      } };
  },

  // 5. REF: the Higgsfield reference copied shot for shot (assets/action-ref/fight-ref-1-small.mp4, 10.04 s; the frame-checked shot table is in
  // renders/review/action-ref-copy/REPORT.md). Its wide is solved from where the set's balustrades sit in its first frame (0.4% of the frame);
  // the face shots and the low angle are placed by eye against its frames. One clock: it has no hit-stop and no freeze. Its two snap cuts are 2
  // of its frames long (faster than AD11), copied as they are, so this slice skips K.check; its two white bursts are 1.25 s apart, never red.
  ref: c => {
    const K = kit(c), { kapi, ox, staff, oxp, THREE } = c, dur = 10.04, V = (x, y, z) => new THREE.Vector3(x, y, z), D = 180 / Math.PI;
    for (const [a, k] of [[kapi, 1.25], [ox, 1.2]]) {  // the reference draws both bigger against the set than the book does (measured on its first frame): scaled to match, their capsules with them
      a.body.scale.setScalar(k); a.h *= k; a.body.updateMatrixWorld(true); const f = a.caps; a.caps = Object.assign(() => f().map(q => ({ ...q, r: q.r * k })), { box: f.box, counts: f.counts });
    }
    const open = [c.ext, c.desk, c.book]; c.place.traverse(o => o.isMesh && /^sky-hall/.test(o.name) && open.push(o));  // the low angle sees the open painted sky dome, as the reference sees open sky: the backdrop, its continuations, the book and the desk go
    c.fx.dust.mat.uniforms.uOp.value = 0.7;  // the reference's dust is thick
    const props = []; c.place.traverse(o => o.isMesh && o.visible && !/^(leaf|page|block|cover|Cylinder|words|pavilion|far-|sky-)/.test(o.name) && props.push(o));  // hidden in the low angle: its floor is bare stone to the far hall
    // a root path: rows [t, [x, y, z, yaw, pitch, roll], ease] eased from each row to the next (two rows at one t: a jump, at a cut); the rows hold live arrays, so a solve can move them
    const path = rows => s => { let i = 0; while (i < rows.length - 2 && rows[i + 1][0] <= s) i++; const a = rows[i], b = rows[i + 1] ?? a, k = b[0] > a[0] ? (a[2] ?? sine)(seg(s, a[0], b[0])) : 1;
      const [x, y, z, yaw, pitch = 0, roll = 0] = a[1].map((v, j) => lerp(v, b[1][j] ?? v, k)); return { x, y, z, yaw, pitch, roll }; };
    const fwd = (yaw, p) => V(-Math.sin(yaw / D) * Math.cos(p / D), -Math.sin(p / D), -Math.cos(yaw / D) * Math.cos(p / D));  // where a camera at yaw, pitch looks
    const view = (P, A, vf) => {  // a camera from its own position, target and vertical lens (degrees), as the kit's keys; a tall frame keeps the place and widens the lens a quarter
      const d = P.distanceTo(A), tv = Math.tan(rad(K.port ? 23 : 15)), th = tv * c.W / c.H, f = K.port ? 2 * Math.atan(Math.tan(rad(vf) / 2) * 1.25) : rad(vf);
      return { at: A.toArray(), yaw: Math.atan2(P.x - A.x, P.z - A.z) * D, pitch: Math.asin((P.y - A.y) / d) * D, w: d * th, h: d * tv * 0.999, zf: tv / Math.tan(f / 2) };
    };
    const low = a => { const h = K.sample(a, "crouch_leap2", () => K.wp(a, "hips").y); let lo = 0; for (let i = 1; i < h.length * 0.7; i++) if (h[i][1] < h[lo][1]) lo = i;
      let up = lo + 1; for (let i = lo + 1; i < Math.min(h.length, lo + 20); i++) if (h[i][1] - h[i - 1][1] > h[up][1] - h[up - 1][1]) up = i; return [h[lo][0], h[Math.min(up, h.length - 1)][0]]; };
    const [kLo, kOff] = low(kapi), kd = n => kapi.clips[n].duration;
    const hb3 = K.sample(ox, "headbutt3", () => K.wp(ox, "head").z - K.wp(ox, "hips").z).reduce((b, x) => (x[1] > b[1] ? x : b))[0];
    const oLand = K.sample(ox, "land_crouch", () => K.wp(ox, "hips").y).reduce((b, x) => (x[1] < b[1] - 0.001 ? x : b))[0], kLand = K.sample(kapi, "land_crouch", () => K.wp(kapi, "hips").y).reduce((b, x) => (x[1] < b[1] - 0.001 ? x : b))[0];

    // the low angle (shot 7): a camera near the page's front left, low, a wide lens; the bull lands at its left, Wukong's foot crashes down beside it
    const C7 = V(-0.62, 0.035, 0.63), C7a = V(-0.3, 0.12, 0.63), F7 = fwd(0, 0), R7 = V(-F7.z, 0, F7.x);
    const B7 = C7.clone().addScaledVector(F7, 0.22).addScaledVector(R7, -0.17), L7 = C7.clone().addScaledVector(F7, 0.12).addScaledVector(R7, 0.07);
    const CUf = fwd(-12, 0), CU = C7a.clone().addScaledVector(CUf, 0.16), CUr = V(-CUf.z, 0, CUf.x), CUout = CU.clone().addScaledVector(CUr, 0.26);
    const kToB = Math.atan2(B7.x - L7.x, B7.z - L7.z) * D, oToK = Math.atan2(L7.x - B7.x, L7.z - B7.z) * D;
    // Wukong's root, film time: the stand-off, the dash in, the swing onto the bull's guard, the hop through the first burst, the lock, the spring
    // at the camera; then, in the low angle, the grin close to the lens, gone past it, the drop onto his foot, the leap, the flips and the dive
    const KA = [-0.208, 0, 0.195, 65], KD = [-0.52, 0, 0.06, 75], KB = [-0.208, 0, 0.195, 62], KL = [-0.053, 0, 0.223, 58];
    const kRows = [[0, KA], [3.95, KA], [3.95, KD, out3], [4.25, KB], [5.0, KB, fastOut], [5.3, KL], [6.5, KL, out3], [6.85, [-0.02, 0.12, 0.55, 40, -8]], [7.04, [0.02, -0.06, 0.93, 20, -10]], [7.083, [0.02, -0.06, 0.93, 20, -10]],
      [7.083, [CU.x, -0.05, CU.z, 50]], [7.25, [CU.x, -0.05, CU.z, 50], in2], [7.42, [CUout.x, 0.02, CUout.z, 10]], [7.42, [L7.x, 0.6, L7.z, kToB]], [8.1, [L7.x, 0.45, L7.z, kToB], in2], [8.27, [L7.x, 0, L7.z, kToB]],
      [8.75, [L7.x, 0, L7.z, kToB], in2], [8.92, [-0.56, 0.02, 0.44, kToB, 10], out3], [9.08, [-0.58, 0.14, 0.24, kToB, 60]], [9.25, [-0.62, 0.26, 0.02, kToB, 200]], [9.5, [-0.66, 0.3, -0.15, kToB, 380]],
      [9.78, [-0.74, 0.3, -0.05, kToB, 400], in2], [10.04, [B7.x + 0.03, 0.2, B7.z - 0.04, kToB, 430]]];
    const kPath = path(kRows), kx = s => { const p = kPath(s), th = rad(p.pitch), hh = 0.5 * kapi.h; p.y += 0.06 * bump(s, 5.0, 0.3) + hh * (1 - Math.cos(th)); p.x -= hh * Math.sin(th) * Math.sin(rad(p.yaw)); p.z -= hh * Math.sin(th) * Math.cos(rad(p.yaw)); return p; };  // a flip turns about his hips, not his feet
    // the bull's: the stand-off, the lunge at him, turned to us for the snarl and the roar, the block, the lock leaning back, knocked away; then he drops into the low angle
    const OA = [0.18, 0, 0.38, -55], OT = [0.14, 0, 0.36, -12], OB = [0.17, 0, 0.38, -50], OL = [0.17, 0, 0.38, -60, -8];
    const oRows = [[0, OA], [1.62, OA], [2.4, [0.13, 0, 0.36, -62]], [2.833, [0.13, 0, 0.36, -62]], [2.833, OT], [3.95, OT], [4.05, OB], [5.3, OB], [5.45, OL], [6.25, OL, out3], [6.9, [0.36, 0.05, 0.34, -70, -25]], [7.083, [0.38, 0.05, 0.34, -70, -25]],
      [7.083, [B7.x, 0.7, B7.z, oToK]], [7.55, [B7.x, 0.45, B7.z, oToK], in2], [7.83, [B7.x, 0, B7.z, oToK]], [10.04, [B7.x, 0, B7.z, oToK + 6]]];
    const oPath = path(oRows);
    const ot = K.tl(ox, [
      { t: 0, clip: "bull_guard", p: [0, 0], yaw: 0 },
      { t: 1.62, clip: "headbutt3", map: ramp([[1.62, 0], [2.3, hb3], [2.85, hb3]]), fade: 0.25 },  // the lunge, his arm swinging out at Wukong
      { t: 2.75, clip: "bull_guard", fade: 0.2 },  // turned to us: the snarl, the swing, the roar; then the block and the lock (his arms by reaches)
      { t: 6.25, clip: "hit_stagger", from: 0.04, fade: 0.06 },
      { t: 7.55, clip: "land_crouch", map: ramp([[7.55, 0.3], [7.83, oLand], [8.05, oLand + 0.4], [10.04, oLand + 0.55]]), fade: 0 },  // he lands low, then holds a wide half-crouch, arms out (the reference holds it)
    ], s => oPath(s));
    K.cast.ot = ot;
    // the lock's point: the bull's raised fists, a little above and before his brow
    const LP = K.quiet(() => { ot.at(5.8); ox.post(5.8); return K.head(ox, 0.45).addScaledVector(ox.faceDir().setY(0).normalize(), 0.08); }), ks1 = K.strike("staff_overhead", 0.05);
    const kt = K.tl(kapi, [
      { t: 0, clip: "guard", p: [0, 0], yaw: 0 },
      { t: 1.25, clip: "staff_thrust", map: ramp([[1.25, 0], [2.05, 0.85 * kd("staff_thrust")]]), fade: 0.15 },  // the flourish: the staff at the waist, swung, levelled at the bull
      { t: 2.1, clip: "guard", fade: 0.3 },
      { t: 3.95, clip: "Run", fade: 0.06 },  // the dash in from the left
      { t: 4.2, clip: "staff_overhead", map: ramp([[4.2, 0.4], [4.42, 0.9]]), fade: 0.08 },  // the staff swung up overhead...
      { t: 4.45, clip: "staff_thrust", map: ramp([[4.45, 0.5], [4.67, 0.75], [5.0, 0.85]]), fade: 0.12 },  // ...and down, levelled at the bull's fists (his fists reached onto the line)
      { t: 5.0, clip: "crouch_leap2", map: ramp([[5.0, kOff], [5.28, kOff + 0.3]]), fade: 0.06 },  // the hop in, through the burst
      { t: 5.24, clip: "staff_overhead", map: ramp([[5.24, 0.75], [5.36, 1.0]]), fade: 0.06 },  // raised overhead again...
      { t: 5.4, clip: "staff_thrust", map: ramp([[5.4, 0.6], [5.55, 0.8], [6.25, 0.9]]), fade: 0.08 },  // ...and up into his raised fists: the lock
      { t: 6.28, clip: "crouch_leap2", map: ramp([[6.28, kLo * 0.6], [6.5, kLo], [6.58, kOff], [7.05, kOff + 0.25]]), fade: 0.1 },  // the spring at the camera
      { t: 7.083, clip: "guard", fade: 0 },  // the grin and the grip, close to the lens
      { t: 8.1, clip: "land_crouch", map: ramp([[8.1, 0.4], [8.27, Math.max(kLand, 0.45)], [8.72, Math.max(kLand, 0.45) + 0.3]]), fade: 0 },  // the foot crash
      { t: 8.7, clip: "crouch_leap2", map: ramp([[8.7, kLo], [8.8, kOff], [9.5, kOff + 0.35]]), fade: 0.1 },  // the leap away, the flips
      { t: 9.6, clip: "staff_overhead", map: ramp([[9.6, 0.05], [9.95, ks1.top]]), fade: 0.2 },  // the dive, the staff raised to strike
    ], kx);
    K.cast.kt = kt;
    const fists = s => K.quiet(() => { ot.at(s); ox.post(s); return K.wp(ox, "chest").addScaledVector(ox.faceDir().setY(0).normalize(), 0.075); });
    const F1 = fists(4.96);
    // the bull's arms, as the reference draws them (the stock clips keep them low): fists up in his guard and his snarl, the lunge's swinging right
    // arm, the forearms crossed before his face, the fists out at the staff, up on its end in the lock, and out wide in the low angle
    const fd = () => ox.faceDir().setY(0).normalize(), sd = () => V(0, 1, 0).cross(fd());  // his forward and his left
    const armW = right => s => Math.max(win(s, -1, 1.72, 0.15), right ? win(s, 1.72, 2.85, 0.12) : 0, win(s, 2.85, 6.3, 0.1), win(s, 7.85, 11, 0.3));
    ox.reach.push(...[["left", 1], ["right", -1]].map(([side, g]) => ({ side, w: armW(g < 0), at: s => (s < 1.72 || (s > 2.85 && s < 3.98) ? K.wp(ox, "chest").addScaledVector(fd(), 0.07).addScaledVector(sd(), g * 0.055).add(V(0, 0.045, 0))
      : s < 2.85 ? K.head(kapi) : s < 4.55 ? K.head(ox, 0.6).addScaledVector(fd(), 0.07).add(V(0, g * 0.012, 0)) : s < 5.3 ? F1.clone().add(V(0, g * 0.009, 0)) : s < 6.3 ? LP.clone().add(V(0, g * 0.008, 0))
      : K.wp(ox, "chest").addScaledVector(sd(), g * 0.12).addScaledVector(fd(), 0.04)) })));
    ox.grip = { left: armW(false), right: armW(true) };
    const camFace = V(0, 0, 0), camLunge = V(0, 0, 0);  // set below: the lenses he looks into (his head turns to us at the end of the push-in, then in the face shots)
    ox.look = { max: 88, at: () => (K.now.s > 2.6 && K.now.s < 2.833 ? camLunge : K.now.s > 2.833 && K.now.s < 3.98 ? camFace : K.head(kapi)), w: s => (s > 6.25 && s < 7.6 ? 0.2 : 0.9) };
    kapi.look = { at: () => (K.now.s > 7.06 && K.now.s < 7.45 ? C7a : K.head(ox)), w: s => (s > 8.7 && s < 10 ? 0.4 : 0.9) };
    kapi.turn("head", () => kapi.faceDir(), s => 11 * win(s, 7.083, 7.42, 0.08));  // the grin: a cocky tilt
    K.fist(kapi, "right", 7.12, 7.24);
    oxp.glow = s => (s > 2.75 && s < 4.0 ? 1.6 : 1.2); oxp.squint = s => 0.85 * win(s, 3.0, 3.95, 0.35); oxp.tremble = s => win(s, 3.82, 4.0, 0.03) + win(s, 6.25, 6.6, 0.05);
    const obs0 = staff.obstacles; staff.obstacles = s => (win(s, 4.5, 5.05, 0) > 0 || win(s, 5.38, 6.3, 0) > 0 ? kapi.caps().filter(q => !/^right(UpperArm|LowerArm|Hand)$|^left(LowerArm|Hand)$/.test(q.n)) : obs0(s));  // the strikes end in his fists: he gives way (pushed off the staff), the staff does not
    staff.both = hold([[8.12, 8.62], [9.0, 9.62]]); staff.grip = s => -0.2 - 0.15 * Math.max(win(s, 4.45, 5.04, 0.08), win(s, 5.36, 6.3, 0.06)); staff.twirl = () => 0; staff.cock = s => lerp(0.35, 0.85, win(s, 9.0, 9.62, 0.1)); staff.tremble = s => 2.5 * win(s, 5.55, 6.2, 0.05);  // one-handed through the flips, along his arm; a strain tremble in the lock
    // the strikes placed by the staff's own line, as the reference draws them: level from his fists to the bull's fists (the first burst), then
    // up into his raised fists (the lock). His right fist is reached onto that line near the staff's back end (staff.grip -0.35: little of it
    // behind the fist to catch his own body, room for his left fist below), the staff is pointed along it (staff.aim; his left fist closes on it), its striking end lands
    // on the target, and he stands a forearm behind his fists, turned along it
    const line = (T, from, rise) => { const u = V(T.x - from[0], 0, T.z - from[2]).normalize(), u3 = u.clone().setY(rise).normalize(), Rf = T.clone().addScaledVector(u3, -0.85 * staff.L);
      return { u3, Rf, root: [Rf.x - u.x * 0.13, 0, Rf.z - u.z * 0.13, Math.atan2(u.x, u.z) * D] }; };
    const S1 = line(F1, KB, 0.12), S2 = line(LP, KL, 0.45); KB.splice(0, 4, ...S1.root); KL.splice(0, 4, ...S2.root);
    const toCam = () => V(C7a.x, 0, C7a.z).sub(K.wp(kapi, "chest").setY(0)).normalize(), across = () => V(-toCam().z, 0, toCam().x);  // the close-up: the staff level across his chest, square to the lens
    const strikeW = s => Math.max(win(s, 4.5, 5.04, 0.12), win(s, 5.38, 6.3, 0.08), s >= 7.08 && s < 7.45 ? 1 - seg(s, 7.42, 7.45) : 0);  // the close-up's grip is there from its first frame
    kapi.reach.push({ side: "right", w: strikeW, at: s => (s < 5.2 ? S1.Rf.clone() : s < 6.5 ? S2.Rf.clone() : K.wp(kapi, "chest").addScaledVector(toCam(), 0.06).addScaledVector(across(), 0.035)) });
    const leapAim = V(1, -0.35, 0.15).normalize();  // the spring at the camera: the staff slanted across him, as the reference holds it
    staff.aim = s => { const w = strikeW(s), wl = win(s, 6.6, 7.07, 0.1); return w > 0 ? [s < 5.2 ? S1.u3 : s < 6.5 ? S2.u3 : across(), w] : wl > 0 ? [leapAim, wl] : null; };
    const m1 = K.touch(4.96, () => K.contact.staff(/Hand|LowerArm|head/)), m2 = K.touch(6.24, () => K.contact.staff(/Hand|LowerArm|head/)), P1 = m1.p.clone(), P2 = m2.p.clone();
    const mid = (s, P) => K.touch(s, () => K.wp(kapi, "rightHand").lerp(P, 0.5)), M1 = mid(4.96, P1), M2 = mid(6.24, P2);  // each white burst blooms where the reference puts it: along the staff, halfway from his fists to the contact
    ox.hit(6.25, K.touch(6.24, () => K.away(ox, m2, V(1, 0.3, 0))), 28);
    K.impact("the staff on his guard: the first white burst", 4.96, 4.96, () => K.contact.staff(/Hand|LowerArm|head/), m1, P1, ox.h);
    K.impact("the staff in his raised fists: the second white burst", 6.24, 6.24, () => K.contact.staff(/Hand|LowerArm|head/), m2, P2, ox.h);
    const foot = (a, s) => K.touch(s, () => K.contact.page(a, /Foot|Toes/)).p, dust = (p, s, o) => c.fx.burst("dust", [p.x, c.y0 + 0.006, p.z], s, { flat: true, up: 0.03, ...o });
    dust(foot(kapi, 4.25), 4.25, { n: 20, sp: 0.2, size: 0.05, life: 0.9, seed: 201 });
    for (const [a, sd] of [[kapi, 202], [ox, 203]]) dust(foot(a, 4.62), 4.62, { n: 50, sp: 0.28, size: 0.08, life: 2.0, seed: sd });  // dust rises along the floor
    dust(V(M1.x, 0, M1.z), 4.97, { n: 110, sp: 0.6, size: 0.15, life: 1.0, seed: 204 }); dust(foot(kapi, 5.3), 5.3, { n: 30, sp: 0.22, size: 0.06, life: 1.0, seed: 205 });
    dust(V(M1.x - 0.28, 0, M1.z + 0.08), 5.6, { n: 40, sp: 0.08, size: 0.12, life: 2.5, seed: 206 }); dust(V(M1.x + 0.26, 0, M1.z + 0.04), 5.6, { n: 40, sp: 0.08, size: 0.12, life: 2.5, seed: 207 });
    dust(V(M2.x, 0, M2.z), 6.25, { n: 110, sp: 0.55, size: 0.15, life: 1.6, seed: 208 }); dust(foot(kapi, 6.55), 6.55, { n: 30, sp: 0.25, size: 0.06, life: 1.0, seed: 209 });
    for (let i = 0; i < 7; i++) dust(V(-0.9 + i * 0.15, 0, -0.02 + 0.04 * (i % 2)), 6.9, { n: 20, sp: 0.05, size: 0.14, life: 3.6, seed: 210 + i });  // the low angle's far dust wall
    dust(B7, 7.83, { n: 110, sp: 0.5, size: 0.09, life: 1.6, seed: 220 }); dust(L7, 8.27, { n: 70, sp: 0.35, size: 0.05, life: 1.2, seed: 221 }); dust(L7, 8.8, { n: 40, sp: 0.25, size: 0.05, life: 1.0, seed: 222 });
    c.fx.debris([L7.x + 0.02, c.y0 + 0.01, L7.z - 0.02], 8.27, { n: 3, sp: 0.2, up: 0.4, dir: [-0.3, 0, -1], floor: c.y0, size: 0.006, colors: [[0.12, 0.1, 0.09]], seed: 223 });  // a pebble kicked up
    // the cameras, film time (the reference's cuts at its frames 53, 69, 93, 95, 97 and 171, at 24 fps)
    const PW = V(0.007, 0.175, 1.144), WIDE = view(PW, PW.clone().add(fwd(0.628, 2.481)), 33.3);
    const turn = (v, deg) => v.clone().applyAxisAngle(V(0, 1, 0), deg / D), ch = s => K.touch(s, () => K.wp(ox, "chest")), face = K.touch(3.2, () => [K.head(ox, 0.5), ox.faceDir().setY(0).normalize(), oxp.point("brow").lerp(oxp.point("nose"), 0.6)]);
    const c2 = ch(2.75), P2c = c2.clone().add(V(-0.05, 0.03, 0.24)); camLunge.copy(P2c); camFace.copy(face[0]).addScaledVector(face[1], 0.3);
    const c4 = ch(3.85), c6 = ch(4.0);
    const cam = K.track([
      { t: 0, ...WIDE }, { t: 2.167, ...WIDE, e: k => 1 - (1 - k) ** 2 },  // 1. the wide, held; then the push-in on the bull as he lunges
      { t: 2.79, ...view(P2c, c2.clone().add(V(-0.03, 0.02, 0)), 33.3) },
      { t: 2.833, cut: true, ...view(face[0].clone().addScaledVector(face[1], 0.26).add(V(0, -0.01, 0)), face[0].clone().add(V(0, -0.04, 0)), 33.3), e: out3 },  // 3. his face: from a medium close-up...
      { t: 3.5, ...view(face[2].clone().addScaledVector(face[1], 0.085), face[2], 33.3) }, { t: 3.833, ...view(face[2].clone().addScaledVector(face[1], 0.082), face[2], 33.3) },  // ...to his eyes and nose ring
      { t: 3.833, cut: true, ...view(c4.clone().addScaledVector(face[1], 0.3).add(V(0, 0.03, 0)), c4.clone().add(V(0, 0.03, 0)), 33.3) },  // 4. a snap: the fists swing
      { t: 3.917, cut: true, ...view(c4.clone().addScaledVector(turn(face[1], -40), 0.32).add(V(0, 0.06, 0)), c4.clone().add(V(0, 0.06, 0)), 33.3) },  // 5. a snap from his side: the roar
      { t: 4.0, cut: true, ...view(PW.clone().lerp(c6, 0.55), V(...WIDE.at).lerp(c6, 0.6), 33.3), e: out3 },  // 6. pulled back...
      { t: 4.17, ...WIDE }, { t: 7.06, ...WIDE },  // ...to the wide: the block, the first burst, the lock, the second burst, the spring at us
      { t: 7.083, cut: true, free: true, ...view(C7a, C7a.clone().add(fwd(-12, 2)), 68) },  // 7. the low angle: the grin close to the lens...
      { t: 7.3, free: true, ...view(C7a.clone().lerp(C7, 0.3), C7a.clone().lerp(C7, 0.3).add(fwd(-9, 0)), 68) },
      { t: 8.0, free: true, ...view(C7, C7.clone().add(fwd(-4, -6)), 68) }, { t: dur, free: true, ...view(C7, C7.clone().add(fwd(-2, -6)), 68) },  // ...panning with him as he passes; the bull drops in, the foot, the leap, the dive
    ]);
    const shots = [[0, "1 wide: the stand-off, the staff flourish"], [2.167, "2 push-in: the bull lunges"], [2.833, "3 his face: in to the eyes and ring"], [3.833, "4 snap: the fists swing"], [3.917, "5 snap: the roar"],
      [4.0, "6 pull back to the wide: the block, two white bursts, the spring"], [7.083, "7 low angle: the grin, the drop, the foot crash, the leap and dive"]];
    return { dur, impacts: K.impacts, strike: [4.1, 6.3], shots,
      info: { F1: F1.toArray().map(v => +v.toFixed(3)), LP: LP.toArray().map(v => +v.toFixed(3)), ref: "assets/action-ref/fight-ref-1-small.mp4", P1: P1.toArray().map(v => +v.toFixed(3)), P2: P2.toArray().map(v => +v.toFixed(3)), KB: KB.map(v => +v.toFixed(3)), KL: KL.map(v => +v.toFixed(3)), B7: B7.toArray().map(v => +v.toFixed(3)), L7: L7.toArray().map(v => +v.toFixed(3)), keys: { kLo, kOff, hb3, oLand, kLand, ks1 }, flashes: [4.96, 6.24] },
      cues: [["swoosh-big", 1.45, 0.4], ["whoosh", 1.98, 0.5], ["snort", 2.2, 0.6], ["snort", 3.83, 1], ["whoosh", 3.97, 0.6], ["swoosh-big", 4.3, 0.5], ["clang", 4.96, 1], ["boom", 4.96, 0.8], ["hit", 5.35, 0.8],
        ["clang", 6.24, 1], ["boom", 6.24, 1], ["thump", 6.26, 0.8], ["swoosh-big", 6.95, 0.7], ["land", 7.83, 0.9], ["crash", 8.2, 1], ["thump", 8.2, 0.8], ["crumble", 8.3, 0.5], ["leap", 8.78, 0.8], ["whoosh", 9.75, 0.9]],
      at(t, render) {
        const s = t; K.pose(s); K.fire(s); for (const o of [...props, ...open]) o.visible = t < 7.07;
        kapi.body.visible = staff.mesh.visible = !(s > 7.43 && s < 8.08); ox.body.visible = !(s > 7.08 && s < 7.55);  // out of the frame between shots: hidden so no stray limb crosses the lens
        c.fx.at(s); K.shoot(cam(t), t); render();
        const g = [];
        if (s > 3.95 && s < 4.3) for (let i = 1; i <= 3; i++) if (s - i * 0.04 > 3.95) g.push(["kapi", s - i * 0.04, 0.3 - 0.07 * i]);  // the dash: after-images
        if (s > 7.25 && s < 7.43) for (let i = 1; i <= 2; i++) g.push(["kapi", s - i * 0.035, 0.25 - 0.08 * i]);  // gone past the lens in a blur
        K.ghosts(s, g);
        const A = K.proj(M1), B = K.proj(M2); c.ink.shock(A[0], A[1], t - 4.96, 400, 7, 0.65); c.ink.shock(B[0], B[1], t - 6.24, 380, 11, 0.72);
        if (t > 8.1) c.ink.focus(c.W * 0.5, c.H * 0.8, 400 + Math.floor(t * 3), 0.9 * seg(t, 8.1, 8.3), 820, "#ffffff");  // white speed lines streaming in at the top
        if (t > 9.7) c.ink.speed(Math.atan2(c.H * 0.1, -c.W * 0.1), t, 0.5 * seg(t, 9.7, 9.85), { seed: 23, band: 0.5 });  // the dive
      } };
  },
};
