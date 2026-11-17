// ring.js (L4): tap a book and its case's 12 books float out of the shelf into a ring facing the visitor: each slides forward off its ledge, lifts, and glides on a soft eased arc
// (a gold sparkle trail, a chime, a shimmer of light), the ripple running outward from the tapped book (about 2 s in all); flying back is the same, a little quicker.
// The FRONT book comes close, as big as the screen allows, tilted like the books on the shelf page (cover leaning back toward the visitor) so its pop-up can stand up in full view; the others curve away behind it.
// The stage is fixed to the VIEW, not to the world: at open the book and its pop-up are fitted (scale and lift) so their whole box on screen is as big as the free band between the top bar and the caption allows, and centred in it; the lift and the cover's tilt then follow the camera's pitch every frame,
// so the book stands in the same place however far up or down the visitor was looking when they tapped (it used to ride off the top of the screen when looking down at a low shelf). A few dozen specks of gold dust drift round the front book (one Points draw, all motion in the vertex shader).
// Turning (drag, arrows) blends the next book into that stage pose and the leaving one back into the ring. Data-driven: a book's case is slots[i].case; nothing else is assumed.
export function createRing(THREE, { scene, camera, books, reduced, onChange, chime = false }) {
  const N = 12, D = Math.PI * 2 / N, OPEN = { fly: 1.5, stag: .6 }, CLOSE = { fly: 1.0, stag: .35 }, DF = 2.2, TILT = .62, TH0 = .08;  // DF: how far in front of the eye the front book stands; TILT: the shelf's cover pitch (0.60 rad on the shelf) when the view is TH0 above level
  let R = 2.6, S = 1.3, SF = 3, FP = { sy: 1.5, b: 0 }, FB = { sy: 1.5, b: 0 };  // ring radius, ring book scale, front book scale (SF), and the front book's fitted scale/lift (FP: with its pop-up, FB: a show book): all set at open from the screen shape
  const ids = [], cur = [], V = THREE.Vector3, Q = THREE.Quaternion, AX = new V(0, 1, 0), RX = new V(1, 0, 0);
  const st = { open: false, busy: false, ci: -1, phi: 0, v: 0, t: 0, dir: 0, dragging: false, c: new V(), right: new V(), back: new V(), eye: new V(), picked: -1, carryFrom: null, delay: [], started: [], rank: [], th: 0, head: 0 };
  const clamp = (u, a = 0, b = 1) => Math.min(b, Math.max(a, u)), sm = u => u * u * (3 - 2 * u), inOut = u => u < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2, sine = u => .5 - Math.cos(Math.PI * clamp(u)) / 2;
  const frontLocal = () => ((Math.round(-st.phi / D) % N) + N) % N, wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const fw = j => 1 - sm(clamp(Math.abs(wrapA(j * D + st.phi)) / (D * .85)));  // 1 = the front book, 0 = in the ring
  const poseOf = () => ({ p: new V(), q: new Q(), s: new V() }), T = poseOf(), A = poseOf();
  const qLean = new Q().setFromAxisAngle(RX, -.1), qYaw = new Q();
  function ringPose(j, out) {  // wherever it sits on the curve, the cover faces the visitor, turned only a little with the curve (never edge-on, never its back)
    const a = wrapA(j * D + st.phi), nx = Math.sin(a), nz = Math.cos(a), head = Math.atan2(st.back.x, st.back.z);
    out.p.copy(st.c).addScaledVector(st.right, R * nx).addScaledVector(st.back, R * nz); out.p.y = st.eye.y + (DF + R * (1 - nz)) * Math.tan(st.th + FP.b);  // the ring stays at the height of the front book on screen
    out.q.copy(qYaw.setFromAxisAngle(AX, head + clamp(a * .32, -.5, .5))).multiply(qLean); out.s.copy(books.xf[ids[j]].s).multiplyScalar(S); return out;
  }
  const fw_ = new V(), qT = new Q(), view = () => { camera.getWorldDirection(fw_); st.th = Math.asin(clamp(fw_.y, -1, 1)); };  // the camera's pitch right now
  function stageAt(b, out) {  // the front book's place: DF along the view, b radians above its axis; the cover tilts like the shelf's (TILT when the view is TH0 up) and eases off as the view looks up, so the visitor sees it at the same angle
    const ph = st.th + b; out.p.copy(st.eye).addScaledVector(st.back, -DF * Math.cos(ph)); out.p.y += DF * Math.sin(ph);
    out.q.copy(qYaw.setFromAxisAngle(AX, st.head)).multiply(qT.setFromAxisAngle(RX, -(TILT - st.th + TH0))); return out;
  }
  function stagePose(j, out) { const f = books.isReal(ids[j]) ? FP : FB; stageAt(f.b, out); const x = books.xf[ids[j]].s; out.s.copy(x).multiplyScalar(f.sy / x.y); return out; }  // every front book the same size, whatever its height on the shelf
  // the front book's shape in the pose frame (units of the book's height): the whole body (spine and boards) and, for a real book, the pop-up standing on the cover; measured from the shelf model and Kapi/Mali's pop-ups at landing (the body's width is trimmed to .375: the box's near corners are not solid, so its silhouette runs wider than the real book's)
  const cube = (x0, x1, y0, y1, z0, z1) => { const o = []; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) o.push(x, y, z); return o; }, PB = cube(-.375, .375, -.5, .5, -.03, .22), PP = [...PB, ...cube(-.27, .31, -.02, .33, .215, .7)];
  function fit(pts) {  // scale and lift for this shape: its box on screen as big as the free band (below the top bar, above the caption) and the width allow, centred between the band's middle and the screen's
    const W = innerWidth, H = innerHeight, tf = Math.tan(camera.fov * Math.PI / 360), top = (document.querySelector("header.bar")?.getBoundingClientRect().bottom ?? 62) + 14, bot = H - (W / H < .85 ? 92 : 66) - 14, mid = (top + bot + H) / 4 + (W / H < .85 ? 12 : 0);  // the phone's room is wide open, so it sits a little low, clear of the greeting line  // shortcut: the caption's height is a constant (the title line only since the Open the book button went, owner 2026-11-17; it is hidden when the ring opens); upgrade: measure #cap once shown
    const cs = Math.cos(st.th), sn = Math.sin(st.th), fh = new V(-st.back.x, 0, -st.back.z), v = new V(); let sy = 1.4, b = 0;
    for (let k = 0; k < 10; k++) {
      stageAt(b, A); let l = 1e9, t = 1e9, r = -1e9, d = -1e9;
      for (let i = 0; i < pts.length; i += 3) { v.set(pts[i], pts[i + 1], pts[i + 2]).multiplyScalar(sy).applyQuaternion(A.q).add(A.p).sub(st.eye); const f = v.dot(fh), z = f * cs + v.y * sn, y = f * -sn + v.y * cs, X = W / 2 * (1 + v.dot(st.right) / (z * tf * camera.aspect)), Y = H / 2 * (1 - y / (z * tf)); l = Math.min(l, X); r = Math.max(r, X); t = Math.min(t, Y); d = Math.max(d, Y); }
      const g = Math.min((bot - top) / (d - t), (W * .955) / (r - l)), hh = (d - t) * g; sy *= g; b += ((t + d) / 2 - clamp(mid, top + hh / 2, bot - hh / 2)) / H * 2 * tf;
    }
    return { sy, b };
  }
  function target(j, out) { ringPose(j, out); const w = fw(j); if (w > 0) { stagePose(j, A); out.p.lerp(A.p, sm(w)); out.q.slerp(A.q, sm(w)); out.s.lerp(A.s, sm(w)); } return out; }

  // ---- the sparkle trail: gold motes left behind each flying book, fading as they drift up; one Points draw
  const NT = 420, tp = new Float32Array(NT * 3), tc = new Float32Array(NT * 3), tv = new Float32Array(NT * 3), tl = new Float32Array(NT), tg = new THREE.BufferGeometry(); let th = 0;
  tg.setAttribute("position", new THREE.BufferAttribute(tp, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute("color", new THREE.BufferAttribute(tc, 3).setUsage(THREE.DynamicDrawUsage));
  const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "#fff"); g.addColorStop(.35, "rgba(255,230,160,.7)"); g.addColorStop(1, "rgba(255,200,100,0)"); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const trail = new THREE.Points(tg, new THREE.PointsMaterial({ map: dot, size: .13, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); trail.frustumCulled = false; trail.renderOrder = 60; scene.add(trail);
  const spawn = (p, n = 2) => { for (let k = 0; k < n; k++) { const i = th++ % NT; tp[i * 3] = p.x + (Math.random() - .5) * .25; tp[i * 3 + 1] = p.y + (Math.random() - .5) * .45; tp[i * 3 + 2] = p.z + (Math.random() - .5) * .08; tv[i * 3] = (Math.random() - .5) * .05; tv[i * 3 + 1] = .05 + Math.random() * .12; tv[i * 3 + 2] = (Math.random() - .5) * .05; tl[i] = 1; } };
  function trailStep(dt) { for (let i = 0; i < NT; i++) { if (tl[i] <= 0) { tc[i * 3] = tc[i * 3 + 1] = tc[i * 3 + 2] = 0; continue; } tl[i] -= dt / 1.3; tp[i * 3] += tv[i * 3] * dt; tp[i * 3 + 1] += tv[i * 3 + 1] * dt; tp[i * 3 + 2] += tv[i * 3 + 2] * dt; const a = Math.max(0, tl[i]) ** 1.5; tc[i * 3] = a * 1.3; tc[i * 3 + 1] = a * 1.05; tc[i * 3 + 2] = a * .55; } tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true; }
  // ---- magic dust: a few dozen gold and pale specks drift up slowly round the front book and twinkle; ONE additive Points draw, a few numbers per speck, all motion in the vertex shader from one time value (nothing allocated per frame).
  // The Points sits in the front book's pose frame (units of the book's height). A speck fades out where, seen from the visitor's eye (uV, in book heights), it would sit over the title cartouche on the cover.
  const ND = 64, dP = new Float32Array(ND * 3), dR = new Float32Array(ND * 4), dg = new THREE.BufferGeometry(); let rs = 7;
  const rnd = () => (rs = rs * 16807 % 2147483647) / 2147483647;  // fixed seed: the same dust on every visit
  for (let i = 0; i < ND; i++) { dP.set([(rnd() - .5) * 1.6, -.65, .1 + rnd() * .6], i * 3); dR.set([rnd(), .012 + rnd() * .02, rnd(), rnd()], i * 4); }  // x, base y (it rises 1.45 over its 30-80 s life), z in front of the cover; life phase, rise speed, sway/twinkle phase, size
  dg.setAttribute("position", new THREE.BufferAttribute(dP, 3)); dg.setAttribute("aR", new THREE.BufferAttribute(dR, 4));
  const dU = { uT: { value: 0 }, uA: { value: 0 }, uM: { value: reduced ? 0 : 1 }, uK: { value: 1 }, uV: { value: new V(0, 0, 3) } }, warm = { v: false };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: dU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: "uniform float uT, uM, uA, uK; uniform vec3 uV; attribute vec4 aR; varying float vA, vS, vC; void main() { float ph = fract(aR.x + uT * aR.y * uM), s = aR.z * 6.2832; vec3 p = position; p.y += ph * 1.45; p += vec3(sin(uT * .31 + s), sin(uT * .23 + s * 1.7) * .5, cos(uT * .27 + s * 1.3)) * .05 * uM;"
      + " vec2 q = uV.xy + (p.xy - uV.xy) * (uV.z - .215) / (uV.z - p.z); float title = smoothstep(1., 1.5, max(abs(q.x) / .32, abs(q.y + .2) / .2)); float tw = .5 + .5 * sin(uT * (1.3 + aR.w * 2.5) + s * 3.); vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;"
      + " gl_PointSize = (6. + 12. * aR.w) * uK * (2.2 / -mv.z) * (.6 + .4 * tw); vA = uA * title * smoothstep(0., .12, ph) * smoothstep(1., .85, ph) * (uM > 0. ? .3 + .7 * tw * tw : .4 + .5 * tw); vS = aR.w; vC = fract(s * 5.); }",
    fragmentShader: "varying float vA, vS, vC; void main() { vec2 c = gl_PointCoord - .5; float d = length(c) * 2., core = smoothstep(1., 0., d); core *= core; float star = (smoothstep(.07, 0., abs(c.x)) + smoothstep(.07, 0., abs(c.y))) * smoothstep(1., .2, d) * step(.35, vS); float a = (core + star * .9) * vA * 1.15; gl_FragColor = vec4(mix(vec3(1., .78, .4), vec3(1., .95, .84), step(.5, vC)), a); }" }));
  dust.frustumCulled = false; dust.renderOrder = 61; dust.visible = false; dust.onBeforeRender = r => { dU.uK.value = r.domElement.height / 800; }; scene.add(dust);
  function dustStep(dt) {  // fades in once the books have landed, softens while the ring turns, fades out on close or pick
    const want = st.open && !st.busy && st.picked < 0 && st.dir > 0 ? (st.dragging || Math.abs(st.v) > .3 ? .5 : 1) : 0, a = dU.uA.value += (want - dU.uA.value) * (1 - Math.exp(-dt * (want > dU.uA.value ? 2 : 5)));
    dust.visible = a > .004 || !warm.v; warm.v = true; if (!dust.visible) return;  // drawn once at alpha 0 on the first frame, so its shader compiles at page start, not when the books land
    dU.uT.value += dt; stageAt(FP.b, A); dust.position.copy(A.p); dust.quaternion.copy(A.q); dust.scale.setScalar(FP.sy); dU.uV.value.copy(camera.position).sub(A.p).applyQuaternion(qT.copy(A.q).invert()).divideScalar(FP.sy);
  }
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
    st.head = Math.atan2(st.back.x, st.back.z); view(); FP = fit(PP); FB = fit(PB); SF = FP.sy / books.xf[ids[0]].s.y;  // the whole book with its pop-up, as big as fits and centred; a show book (no pop-up) is fitted on its own
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
      const p0 = x.p, p3 = t.p, yw = books.slots[ids[j]].yaw ?? 0, p1 = new V(p0.x + Math.sin(yw) * .38, p0.y + .04, p0.z + Math.cos(yw) * .38),  // straight out of its own shelf (the cases stand on the tower's curve)
        p2 = new V(p3.x + (p0.x - p3.x) * .15, p3.y + .75, p3.z + (st.back.z * .5)), tt = e, m = 1 - tt;
      const pp = cur[j].p.set(m * m * m * p0.x + 3 * m * m * tt * p1.x + 3 * m * tt * tt * p2.x + tt ** 3 * p3.x, m * m * m * p0.y + 3 * m * m * tt * p1.y + 3 * m * tt * tt * p2.y + tt ** 3 * p3.y, m * m * m * p0.z + 3 * m * m * tt * p1.z + 3 * m * tt * tt * p2.z + tt ** 3 * p3.z);
      cur[j].q.copy(x.q).slerp(t.q, turn); cur[j].s.copy(x.s).lerp(t.s, sine(u)); books.set(ids[j], pp, cur[j].q, cur[j].s);
      const flying = raw > 0 && raw < 1; books.shim?.(ids[j], flying ? Math.sin(Math.PI * raw) ** 1.4 * .9 : 0);
      if (flying) { spawn(pp, dt > 0 ? 4 : 0); if (!st.started[j]) { st.started[j] = true; ding(j); } }
    }
    return done;
  }
  // ---- the tap hint (owner 2026-11-17: no Open the book button; "an indicator that shows a finger/mouse click at the cover ... if it's been left idle for 5 secs" the first time,
  // then only after a longer idle): a small hand taps the front book's cover, lower right of the title; drawn by library.css .taphint; hidden the moment anything is touched
  const hand = document.createElement("div"), hp = new V(); hand.className = "taphint"; hand.hidden = true; hand.setAttribute("aria-hidden", "true");
  hand.innerHTML = '<svg viewBox="0 0 32 32"><path d="M12 4.5a2 2 0 0 1 4 0v9l1-.3a2 2 0 0 1 2.4 1.3l.1.3.9-.2a2 2 0 0 1 2.4 1.5l.1.4a2 2 0 0 1 2.6 1.4l.9 4.4a6 6 0 0 1-1.2 5L22 30H13l-5.4-7.3a2 2 0 0 1 2.9-2.7L12 21Z"/></svg>'; document.body.append(hand);
  let idle = 0, tapped = false; try { tapped = localStorage.getItem("wst-tapped") === "1"; } catch {}
  for (const e of ["pointerdown", "keydown", "wheel"]) addEventListener(e, () => { idle = 0; }, { capture: true, passive: true });
  function hintStep(dt) {
    idle += dt; const show = st.open && !st.busy && !st.dragging && st.picked < 0 && Math.abs(st.v) < .3 && idle > (tapped ? 20 : 5) && books.isReal(ids[frontLocal()]);
    if (show) { stageAt(FP.b, A); hp.set(.2, -.36, .24).multiplyScalar(FP.sy).applyQuaternion(A.q).add(A.p).project(camera); hand.style.left = `${(hp.x + 1) / 2 * innerWidth}px`; hand.style.top = `${(1 - hp.y) / 2 * innerHeight}px`; }
    hand.hidden = !show;
  }
  function update(dt) {
    trailStep(dt); if (st.open) view(); dustStep(dt); hintStep(dt); if (!st.open) return;
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
    open, close, update, carry, trail, get isOpen() { return st.open; }, get busy() { return st.busy; },
    has: i => st.open && ids.includes(i), get ids() { return ids; }, get front() { return frontLocal(); }, get frontGlobal() { return ids[frontLocal()]; },
    near(maxA) { const o = []; for (let j = 0; j < ids.length; j++) { const a = Math.abs(wrapA(j * D + st.phi)); if (a < maxA * D && cur[j]) o.push({ j, g: ids[j], a, w: fw(j), pose: cur[j] }); } return o; },
    frontPose() { const j = frontLocal(); return cur[j] ? { pose: cur[j], w: fw(j), global: ids[j] } : null; },
    get settled() { return st.open && !st.busy && !st.dragging && st.picked < 0 && Math.abs(st.v) < .3 && Math.abs(st.phi - Math.round(st.phi / D) * D) < .03; },
    get picked() { return st.picked; }, pick() { if (!st.open || st.busy || st.picked >= 0) return -1; st.picked = this.frontGlobal; tapped = true; try { localStorage.setItem("wst-tapped", "1"); } catch {} const j = frontLocal(); st.carryFrom = { p: cur[j].p.clone(), q: cur[j].q.clone(), s: cur[j].s.clone() }; return st.picked; },
    drag(dxPx, pxPerStep) { st.dragging = true; st.phi += dxPx / pxPerStep * D; st.v = 0; }, release(vPx, pxPerStep) { st.dragging = false; st.v = vPx / pxPerStep * D; },
    step(n) { if (!st.open || st.busy || st.picked >= 0) return; st.v = 0; st.phi = Math.round(st.phi / D) * D - n * D; },  // +1: the next book (the one on the right) comes to the front
    turnTo(book) { const j = ids.indexOf(book); if (j < 0 || st.busy) return; st.v = 0; const f = frontLocal(); let d = ((j - f) % N + N) % N; if (d > N / 2) d -= N; st.phi = Math.round(st.phi / D) * D - d * D; },
    stepPx: () => R * Math.sin(D) * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360) * (DF + R * (1 - Math.cos(D)) / 2)), cancelPick() { st.picked = -1; },
    reset() { if (!st.open) return; for (const i of ids) { books.home(i); books.shim?.(i, 0); } st.open = false; st.busy = false; st.dir = 0; st.picked = -1; st.carryFrom = null; onChange?.(api); },
    get phi() { return st.phi; }, get center() { return st.c; },
  };
  return api;
}
