// ring.js (L4): tap a book and its case's 12 books float out of the shelf into a ring facing the visitor: each slides forward off its ledge, lifts, and glides on a soft eased arc
// (a gold sparkle trail, a chime, a shimmer of light), the ripple running outward from the tapped book (about 2 s in all); flying back is the same, a little quicker.
// The FRONT book comes close and fills most of the screen, tilted like the books on the shelf page (cover leaning back toward the visitor) so its pop-up can stand up in full view; the others curve away behind it.
// Turning (drag, arrows) blends the next book into that stage pose and the leaving one back into the ring. Data-driven: a book's case is slots[i].case; nothing else is assumed.
export function createRing(THREE, { scene, camera, books, reduced, onChange, chime = true }) {
  const N = 12, D = Math.PI * 2 / N, OPEN = { fly: 1.5, stag: .6 }, CLOSE = { fly: 1.0, stag: .35 }, DF = 2.2, TILT = .62;  // DF: how far in front of the eye the front book stands; TILT: the shelf's cover pitch (0.60 rad on the shelf)
  let R = 2.6, S = 1.3, SF = 3, model = { w: .36, d: .42 };  // model: the shelf book's whole footprint (spine included), set once the first model is built  // ring radius, ring book scale, front book scale: set at open from the screen shape
  const ids = [], cur = [], V = THREE.Vector3, Q = THREE.Quaternion, AX = new V(0, 1, 0), RX = new V(1, 0, 0);
  const st = { open: false, busy: false, ci: -1, phi: 0, v: 0, t: 0, dir: 0, dragging: false, c: new V(), right: new V(), back: new V(), eye: new V(), qStage: new Q(), picked: -1, carryFrom: null, delay: [], started: [], rank: [] };
  const clamp = (u, a = 0, b = 1) => Math.min(b, Math.max(a, u)), sm = u => u * u * (3 - 2 * u), inOut = u => u < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2, sine = u => .5 - Math.cos(Math.PI * clamp(u)) / 2;
  const frontLocal = () => ((Math.round(-st.phi / D) % N) + N) % N, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const fw = j => 1 - sm(clamp(Math.abs(wrapA(j * D + st.phi)) / (D * .85)));  // 1 = the front book, 0 = in the ring
  const poseOf = () => ({ p: new V(), q: new Q(), s: new V() }), T = poseOf(), A = poseOf();
  const qLean = new Q().setFromAxisAngle(RX, -.1), qYaw = new Q();
  function ringPose(j, out) {  // wherever it sits on the curve, the cover faces the visitor, turned only a little with the curve (never edge-on, never its back)
    const a = wrapA(j * D + st.phi), nx = Math.sin(a), nz = Math.cos(a), head = Math.atan2(st.back.x, st.back.z);
    out.p.copy(st.c).addScaledVector(st.right, R * nx).addScaledVector(st.back, R * nz); out.p.y = st.eye.y - .12;
    out.q.copy(qYaw.setFromAxisAngle(AX, head + clamp(a * .32, -.5, .5))).multiply(qLean); out.s.copy(books.xf[ids[j]].s).multiplyScalar(S); return out;
  }
  function stagePose(j, out) { out.p.copy(st.eye).addScaledVector(st.back, -DF); out.p.y = st.eye.y - .12; out.q.copy(st.qStage); out.s.copy(books.xf[ids[j]].s).multiplyScalar(SF); return out; }
  function target(j, out) { ringPose(j, out); const w = fw(j); if (w > 0) { stagePose(j, A); out.p.lerp(A.p, sm(w)); out.q.slerp(A.q, sm(w)); out.s.lerp(A.s, sm(w)); } return out; }

  // ---- the sparkle trail: gold motes left behind each flying book, fading as they drift up; one Points draw
  const NT = 420, tp = new Float32Array(NT * 3), tc = new Float32Array(NT * 3), tv = new Float32Array(NT * 3), tl = new Float32Array(NT), tg = new THREE.BufferGeometry(); let th = 0;
  tg.setAttribute("position", new THREE.BufferAttribute(tp, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute("color", new THREE.BufferAttribute(tc, 3).setUsage(THREE.DynamicDrawUsage));
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "#fff"); g.addColorStop(.35, "rgba(255,230,160,.7)"); g.addColorStop(1, "rgba(255,200,100,0)"); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ map: dot, size: .13, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); trail.frustumCulled = false; trail.renderOrder = 60; scene.add(trail);
  const spawn = (p, n = 2) => { for (let k = 0; k < n; k++) { const i = th++ % NT; tp[i * 3] = p.x + (Math.random() - .5) * .25; tp[i * 3 + 1] = p.y + (Math.random() - .5) * .45; tp[i * 3 + 2] = p.z + (Math.random() - .5) * .08; tv[i * 3] = (Math.random() - .5) * .05; tv[i * 3 + 1] = .05 + Math.random() * .12; tv[i * 3 + 2] = (Math.random() - .5) * .05; tl[i] = 1; } };
  function trailStep(dt) { for (let i = 0; i < NT; i++) { if (tl[i] <= 0) { tc[i * 3] = tc[i * 3 + 1] = tc[i * 3 + 2] = 0; continue; } tl[i] -= dt / 1.3; tp[i * 3] += tv[i * 3] * dt; tp[i * 3 + 1] += tv[i * 3 + 1] * dt; tp[i * 3 + 2] += tv[i * 3 + 2] * dt; const a = Math.max(0, tl[i]) ** 1.5; tc[i * 3] = a * 1.3; tc[i * 3 + 1] = a * 1.05; tc[i * 3 + 2] = a * .55; } tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true; }
  // ---- a soft chime per book as it leaves its ledge: three sine partials, a pentatonic note, quiet
  let ac = null; const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
  function ding(k) { if (!chime || reduced) return; try { ac ??= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); const f = NOTES[k % NOTES.length] * (k >= 8 ? 2 : 1), t0 = ac.currentTime;
    [[1, .016], [2.76, .006], [5.4, .0025]].forEach(([m, g]) => { const o = ac.createOscillator(), e = ac.createGain(); o.type = "sine"; o.frequency.value = f * m; e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(g, t0 + .01); e.gain.exponentialRampToValueAtTime(1e-4, t0 + 1.1); o.connect(e).connect(ac.destination); o.start(t0); o.stop(t0 + 1.2); }); } catch { /* no audio: the shimmer of light still plays */ } }

  function open(book, o = {}) {
    if (st.open || st.busy) return false;
    const ci = books.slots[book].case; ids.length = 0; books.slots.forEach((s, i) => { if (s.case === ci) ids.push(i); }); if (!ids.length) return false;
    camera.updateMatrixWorld(); const f = new V(); if (o.yaw != null) f.set(Math.sin(o.yaw), 0, -Math.cos(o.yaw)); else { camera.getWorldDirection(f); f.y = 0; f.normalize(); } st.eye.copy(o.eye ?? camera.position);  // the station's own eye and heading, not the swaying camera's
    const portrait = innerWidth / innerHeight < .85; R = portrait ? 1.3 : 2.6; S = portrait ? 1.5 : 1.3;
    st.back.copy(f).negate(); st.right.set(-f.z, 0, f.x); st.c.copy(st.eye).addScaledVector(f, DF + R);
    st.qStage.setFromAxisAngle(AX, Math.atan2(st.back.x, st.back.z)).multiply(new Q().setFromAxisAngle(RX, -TILT));
    const vs = 2 * DF * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hs = vs * camera.aspect, x0 = books.xf[ids[0]].s; SF = Math.min(.46 * vs / Math.cos(TILT), (portrait ? .74 : .86) * hs * model.d / model.w) / x0.y;  // the whole book, spine and all, in frame with a margin  // fills ~78% of the height, or nearly the full width on a phone
    const j0 = ids.indexOf(book); st.rank = ids.map((_, j) => Math.abs(j - j0)); const order = [...st.rank].sort((a, b) => a - b); st.rank = st.rank.map(r => order.indexOf(r) + (st.rank.filter((q, i) => q === r && i < st.rank.indexOf(r)).length));
    st.phi = -j0 * D; st.v = 0; st.open = true; st.picked = -1; st.t = 0; st.dir = 1; st.busy = true; st.started = ids.map(() => false); ids.forEach((g, j) => { cur[j] = poseOf(); cur[j].p.copy(books.xf[g].p); cur[j].q.copy(books.xf[g].q); cur[j].s.copy(books.xf[g].s); });
    if (reduced) { st.t = 99; flight(0); }
    onChange?.(api); return true;
  }
  function close() { if (!st.open || st.picked >= 0 || st.busy && st.dir < 0) return; st.dir = -1; st.t = reduced ? 99 : 0; st.busy = true; st.started = ids.map(() => false); onChange?.(api); if (reduced) update(0); }
  function flight(dt) {  // opening: slot -> ring; closing: ring -> slot, the same path run backwards, quicker
    const k = st.dir, C = k > 0 ? OPEN : CLOSE; let done = true;
    for (let j = 0; j < ids.length; j++) {
      const delay = st.rank[j] / (ids.length - 1 || 1) * C.stag, raw = clamp((st.t - delay) / C.fly), u = k > 0 ? raw : 1 - raw; if (raw < 1) done = false;
      const x = books.xf[ids[j]], t = target(j, T), e = inOut(u), turn = sine(clamp((u - .12) / .88));
      // a cubic arc: slide forward off the ledge, rise, float, then lay itself into the ring
      const p0 = x.p, p3 = t.p, p1 = new V(p0.x, p0.y + .04, p0.z + .38), p2 = new V(p3.x + (p0.x - p3.x) * .15, p3.y + .75, p3.z + (st.back.z * .5)), tt = e, m = 1 - tt;
      const pp = cur[j].p.set(m * m * m * p0.x + 3 * m * m * tt * p1.x + 3 * m * tt * tt * p2.x + tt ** 3 * p3.x, m * m * m * p0.y + 3 * m * m * tt * p1.y + 3 * m * tt * tt * p2.y + tt ** 3 * p3.y, m * m * m * p0.z + 3 * m * m * tt * p1.z + 3 * m * tt * tt * p2.z + tt ** 3 * p3.z);
      cur[j].q.copy(x.q).slerp(t.q, turn); cur[j].s.copy(x.s).lerp(t.s, sine(u)); books.set(ids[j], pp, cur[j].q, cur[j].s);
      const flying = raw > 0 && raw < 1; books.shim?.(ids[j], flying ? Math.sin(Math.PI * raw) ** 1.4 * .9 : 0);
      if (flying) { spawn(pp, dt > 0 ? 4 : 0); if (!st.started[j]) { st.started[j] = true; ding(j); } }
    }
    return done;
  }
  function update(dt) {
    trailStep(dt); if (!st.open) return;
    if (st.busy) { st.t += dt; if (flight(dt)) { st.busy = false; for (let j = 0; j < ids.length; j++) books.shim?.(ids[j], 0); if (st.dir < 0) { for (const i of ids) books.home(i); st.open = false; st.dir = 0; onChange?.(api); } } return; }
    if (st.picked >= 0) return;
    if (!st.dragging) { st.phi += st.v * dt; st.v *= Math.exp(-dt * 3.2); if (Math.abs(st.v) < .9) st.phi += (Math.round(st.phi / D) * D - st.phi) * (1 - Math.exp(-dt * 7)); }
    for (let j = 0; j < ids.length; j++) { target(j, cur[j]); books.set(ids[j], cur[j].p, cur[j].q, cur[j].s); }
  }
  // one book picked: the shelf's carry (web/shelf/HANDOFF.md) in this page's camera terms, from wherever the front book stands now. Lift 0.1-0.9 s (0.18 m up), carry 0.4-1.6 s (sine ease-in) to the pose at the cut:
  // 0.45 m toward the reader of the table point, 0.11 m above it, spine left, cover up with 0.60 rad (34.4 deg) of tilt toward the reader; the other books slide 0.12 m aside and dim over the first 0.6 s.
  const sineIn = u => 1 - Math.cos(u * Math.PI / 2), tmpQ = new Q();
  function carry(t, camPos, look) {
    const jp = ids.indexOf(st.picked), x = st.carryFrom, back = look.clone().negate(), head = Math.atan2(-look.x, -look.z);
    const table = camPos.clone().addScaledVector(look, 1.15); table.y = camPos.y - .8; const cut = table.clone().addScaledVector(look, -.45); cut.y += .11;
    const uc = sineIn(clamp((t - .4) / 1.2)), lift = sm(clamp((t - .1) / .8));
    const p = x.p.clone().lerp(cut, uc); p.y += .18 * Math.sin(Math.PI * clamp((t - .1) / 1.5)) * lift;
    const endQ = new Q().setFromAxisAngle(AX, head).multiply(new Q().setFromAxisAngle(RX, -Math.PI / 2 + .6)); tmpQ.copy(x.q).slerp(endQ, uc);
    const sc = x.s.clone().lerp(books.xf[st.picked].s.clone().multiplyScalar(SF * .45), uc); cur[jp].p.copy(p); cur[jp].q.copy(tmpQ); cur[jp].s.copy(sc); books.set(st.picked, p, tmpQ, sc);
    const slide = sm(clamp(t / .6)) * .12; for (let j = 0; j < ids.length; j++) if (j !== jp) { const tt = target(j, T); const d = tt.p.clone().sub(st.c).setY(0).normalize(); books.set(ids[j], tt.p.addScaledVector(d, slide), tt.q, tt.s); }
  }
  const api = {
    open, close, update, carry, trail, setModel: d => { model = d; }, get isOpen() { return st.open; }, get busy() { return st.busy; },
    has: i => st.open && ids.includes(i), get ids() { return ids; }, get front() { return frontLocal(); }, get frontGlobal() { return ids[frontLocal()]; },
    near(maxA) { const o = []; for (let j = 0; j < ids.length; j++) { const a = Math.abs(wrapA(j * D + st.phi)); if (a < maxA * D && cur[j]) o.push({ j, g: ids[j], a, w: fw(j), pose: cur[j] }); } return o; },
    frontPose() { const j = frontLocal(); return cur[j] ? { pose: cur[j], w: fw(j), global: ids[j] } : null; },
    get settled() { return st.open && !st.busy && !st.dragging && st.picked < 0 && Math.abs(st.v) < .3 && Math.abs(st.phi - Math.round(st.phi / D) * D) < .03; },
    get picked() { return st.picked; }, pick() { if (!st.open || st.busy || st.picked >= 0) return -1; st.picked = this.frontGlobal; const j = frontLocal(); st.carryFrom = { p: cur[j].p.clone(), q: cur[j].q.clone(), s: cur[j].s.clone() }; return st.picked; },
    drag(dxPx, pxPerStep) { st.dragging = true; st.phi += dxPx / pxPerStep * D; st.v = 0; }, release(vPx, pxPerStep) { st.dragging = false; st.v = vPx / pxPerStep * D; },
    step(n) { if (!st.open || st.busy || st.picked >= 0) return; st.v = 0; st.phi = Math.round(st.phi / D) * D - n * D; },  // +1: the next book (the one on the right) comes to the front
    turnTo(book) { const j = ids.indexOf(book); if (j < 0 || st.busy) return; st.v = 0; const f = frontLocal(); let d = ((j - f) % N + N) % N; if (d > N / 2) d -= N; st.phi = Math.round(st.phi / D) * D - d * D; },
    stepPx: () => R * Math.sin(D) * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * (DF + R * (1 - Math.cos(D)) / 2)), cancelPick() { st.picked = -1; },
    reset() { if (!st.open) return; for (const i of ids) { books.home(i); books.shim?.(i, 0); } st.open = false; st.busy = false; st.dir = 0; st.picked = -1; st.carryFrom = null; onChange?.(api); },
    get phi() { return st.phi; }, get center() { return st.c; },
  };
  return api;
}
