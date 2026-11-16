// living.js (L3c, turn 2): the living shelves. Twelve slow magical moments (8-15 s: build-up, peak, settle) on the OTHER books of the Grand Library,
// rare and random. A living book is drawn as a decoy that is THAT book: its own height, thickness, lean and spine (colour, gold bands, wear).
//
//   const living = createLiving(scene, camera, { spots, fx, reduced, phone, onTap, kinds, station });
//   living.update(dt)         every frame (hidden tab, reduced motion: nothing runs; dt is clamped to 0.1 s)
//   living.tap(ndcX, ndcY)    a tap at normalised device coordinates: true if it hit a living book (it shivers or giggles), so the host skips its own tap
//   living.fire(n, i?)        play moment 1..12 now at spot i (else a fitting one); the test page's buttons
//   living.kinds = [numbers] | living.setStation(key of STATION_KINDS): which moments the scheduler may pick (opts.kinds / opts.station set it up)
//   living.auto = true|false  the random scheduler (default true)
//   living.stats() / living.dispose()
//   spot: { p: [x,y,z] (centre of the spine), normal: [x,y,z] (out of the shelf), width (spine thickness, m), height (m), color (spine hex), bands (0-3 gold bands),
//           lean (radians, 0), seed, hide(bool) (optional: the host hides/shows its own copy of this book while the decoy stands in),
//           flat: true + stack: [{ len, h, color }] bottom to top (a small stack of books lying flat, spine out: moment 11 lives only here) }
//   fx: a storyfx instance or null.   onTap({ spot, index, kind: "giggle" | "shiver" })
// Every picture is a quad from a pool of 3 rigs; a hidden quad costs nothing. Cards come from one atlas (living/atlas.webp). Wiring: renders/landing/L3c/WIRING.md.
import * as THREE from "three";

// Every station shows its own small set (Eddie: "all 12 should spread out, don't show all 12 in the same room"); walking on finds new ones.
export const STATION_KINDS = { home: [4, 5, 6, 8], mid: [2, 3, 7, 10], far: [1, 9, 11, 12] };
const CARDS = ["wing", "vine1", "vine2", "vine3", "vine4", "fish", "bird", "butterfly", "cloud", "eyes", "z", "page", "star"], GRID = 4;
const RIGS = 3, MAXACT = 2, TAU = Math.PI * 2;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x, sm = x => (x = clamp01(x)) * x * (3 - 2 * x), eo = x => 1 - (1 - clamp01(x)) ** 3, ei = x => clamp01(x) ** 2;
const bo = x => { x = clamp01(x) - 1; return 1 + 2.7 * x * x * x + 1.7 * x * x; };  // ease out with a little overshoot
const pr = (u, a, b) => clamp01((u - a) / (b - a)), lerp = (a, b, t) => a + (b - a) * t, damp = (t, k, w) => Math.exp(-k * t) * Math.sin(w * t);
const pulse = (u, a, b, c, d) => sm((u - a) / (b - a)) * (1 - sm((u - c) / (d - c)));  // up from a to b, down from c to d
const HUES = [0x6b2430, 0x244a6b, 0x2f5a3a, 0x5a3a6b, 0x7a5a24, 0x2a5a60];

const glowTex = (r, g, b) => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), q = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  q.addColorStop(0, `rgba(${r},${g},${b},1)`); q.addColorStop(.45, `rgba(${r},${g},${b},.4)`); q.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = q; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

// the spine of a book: leather, a lit edge and a shaded edge, worn gold bands, a little label, scuffs. Used by the decoys AND by the test page's books, so a living book is the same book.
const spineCache = new Map();
export function spineTexture(color = 0x5a2a30, bands = 2, seed = 1) {
  const key = color + "/" + bands + "/" + seed; let t = spineCache.get(key); if (t) return t;
  const c = document.createElement("canvas"); c.width = 48; c.height = 192; const x = c.getContext("2d"), col = new THREE.Color(color), rnd = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const css = (k, a = 1) => `rgba(${col.r * 255 * k | 0},${col.g * 255 * k | 0},${col.b * 255 * k | 0},${a})`;
  const g = x.createLinearGradient(0, 0, 48, 0); g.addColorStop(0, css(1.25)); g.addColorStop(.35, css(1)); g.addColorStop(1, css(.62)); x.fillStyle = g; x.fillRect(0, 0, 48, 192);
  for (let i = 0; i < 40; i++) { x.fillStyle = rnd() < .5 ? "rgba(0,0,0,.06)" : "rgba(255,230,180,.05)"; x.fillRect(rnd() * 48, rnd() * 192, 2 + rnd() * 10, 1 + rnd() * 3); }  // wear
  const gold = (y, h) => { x.fillStyle = "rgba(226,180,89,.9)"; x.fillRect(0, y, 48, h); x.fillStyle = "rgba(255,240,190,.5)"; x.fillRect(0, y, 48, 1); for (let i = 0; i < 6; i++) { x.fillStyle = css(.7, .8); x.fillRect(rnd() * 48, y, 2 + rnd() * 5, h); } };  // worn: the leather shows through
  const ys = [10, 24, 156, 170, 90]; for (let i = 0; i < bands; i++) gold(ys[i], i === 4 ? 3 : 4 + (i % 2) * 2);
  if (bands > 0) { x.fillStyle = "rgba(240,220,170,.75)"; x.fillRect(9, 50 + rnd() * 10, 30, 52); x.fillStyle = css(.45); for (let i = 0; i < 4; i++) x.fillRect(13, 58 + i * 11, 22 - rnd() * 10, 2); }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; spineCache.set(key, t); return t;
}

export function createLiving(scene, camera, { spots = [], fx = null, reduced = false, phone = false, onTap = () => {}, kinds = null, station = "home" } = {}) {
  const base = new URL("./living/", import.meta.url);
  const root = new THREE.Group(); root.name = "living"; scene.add(root);
  const atlas = new THREE.TextureLoader().load(new URL(phone ? "atlas-p.webp" : "atlas.webp", base).href); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const glowW = glowTex(255, 214, 140), glowD = glowTex(0, 0, 0);
  const geos = Object.fromEntries(CARDS.map((n, i) => { const g = new THREE.PlaneGeometry(1, 1), uv = g.attributes.uv, c = i % GRID, r = i / GRID | 0;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / GRID, 1 - (r + 1 - uv.getY(k)) / GRID); return [n, g]; }));
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  const mat = (map, add) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const quad = (geo, m, order = 52) => { const q = new THREE.Mesh(geo, m); q.visible = false; q.renderOrder = order; q.frustumCulled = false; return q; };

  // ---- the rigs: a group with 3 decoy books, 4 cards, a light glow, a beam, a dark gap and a soft shadow
  const rigs = Array.from({ length: RIGS }, () => { const g = new THREE.Group(), r = { g, busy: false,
    b: [0, 1, 2].map(() => quad(quadGeo, mat(spineTexture(0x777777, 0, 0)))),  // a map from the start, so swapping spines never needs a new shader
     c: [0, 1, 2, 3].map(() => quad(geos.z, mat(atlas))), gl: quad(quadGeo, mat(glowW, true), 54), gl2: quad(quadGeo, mat(glowW, true), 54),
    dk: quad(quadGeo, mat(glowD), 51), sh: quad(quadGeo, mat(glowD), 50) };
    g.add(r.sh, r.dk, ...r.b, ...r.c, r.gl, r.gl2); g.visible = false; root.add(g); return r; });

  // ---- the spots: every size comes from the book itself
  const S = spots.map((s, i) => { const p = new THREE.Vector3(...s.p), n = new THREE.Vector3(...s.normal).normalize(), r = new THREE.Vector3(0, 1, 0).cross(n);
    if (r.lengthSq() < 1e-6) r.set(1, 0, 0); r.normalize(); const up = n.clone().cross(r), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, n));
    const GAP = s.gap ?? .5, k = (s.height || 0) > GAP ? GAP / s.height : 1, w = (s.width || .06) * k, h = (s.height || (s.width || .06) * 5) * k, u = Math.max(.2, h * .9);  // the assert: no living book stands taller than the shelf gap it lives in (k shrinks the few the writer sized larger)
    return { i, p, n, up, q, w, h, u, tw: w / u, th: h / u, lean: s.lean || 0, color: s.color ?? HUES[i % HUES.length], bands: s.bands ?? 2, seed: s.seed ?? i + 1, hide: s.hide, flat: !!s.flat, stack: s.stack, busy: false, dist: 0, vis: false }; });

  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
  const hid = q => { q.visible = false; q.material.opacity = 0; };
  const put = (m, U, x, y, z, sx, sy, rz, op) => { m.position.set(x * U, y * U, z * U); m.scale.set(sx * U, sy * U, 1); m.rotation.z = rz; m.material.opacity = op; m.visible = op > .004; };
  const card = (m, name) => { m.geometry = geos[name]; };
  const worldOf = (s, x, y, z, out) => out.set(x * s.u, y * s.u, z * s.u).applyQuaternion(s.q).add(s.p);
  const fxPlay = (t, o) => { if (fx && !reduced) try { return fx.play(t, o); } catch (e) { /* shortcut: a failing effect must never stop the show; ceiling: silent; upgrade when fx logs */ } };
  const book = (r, s, i, x, y, z, rz, op = 1, sy = 1, sx = 1) => { put(r.b[i], s.u, x, y, z, s.tw * sx, s.th * sy, rz + s.lean, op); };  // the book itself (decoy), in its own size
  const shadow = (r, s, x, y, k, op) => put(r.sh, s.u, x + .09 * k, y - .06 * k, -.03, (s.tw + .35) * k, s.th * .95 * k, 0, op * .55);  // a soft shadow on the shelf back, further when the book is lifted
  const wing = (r, i, s, side, px, py, ws, th, op) => { const a = side * th, ox = .42 * ws * side, oy = .27 * ws;  // a paper wing hinged at the book's shoulder
    put(r.c[i], s.u, px + ox * Math.cos(a) - oy * Math.sin(a), py + ox * Math.sin(a) + oy * Math.cos(a), .05, ws * side, ws, a, op); };

  // ---- the twelve moments: [name, min secs, max secs, begin(a), tick(a, u, dt, s, r, U)]; local units are U (about a book height), x right, y up, z out of the shelf
  const MOM = [null,
    ["winged", 13, 15, a => { a.s2 = pickNear(a.s); if (a.s2) a.s2.busy = true; card(a.r.c[0], "wing"); card(a.r.c[1], "wing"); a.ph = 0; a.mv = 0; a.tilt = 0; a.lx = a.s.p.x; },
      (a, u, dt, s, r, U) => { const to = a.s2 || s, up = s.up, hov = .38 * (eo(pr(u, .13, .25)) * (1 - eo(pr(u, .44, .52))) + eo(pr(u, .68, .76)) * (1 - eo(pr(u, .9, .97))));
        const t = u < .25 ? 0 : u < .46 ? sm(pr(u, .25, .46)) : u < .76 ? 1 : u < .92 ? 1 - sm(pr(u, .76, .92)) : 0;  // out to the perch, and home again
        const open = bo(pr(u, .03, .13)) * (1 - sm(pr(u, .52, .58))) + sm(pr(u, .65, .71)) * (1 - sm(pr(u, .93, .99)));
        a.mv += (((u > .13 && u < .53) || (u > .67 && u < .97) ? 1 : .15) - a.mv) * Math.min(1, dt * 3);  // flapping quickens while it travels
        a.ph += dt * TAU * (1.3 + 3.6 * a.mv) * (open > .02 ? 1 : .3); const flap = Math.sin(a.ph);
        r.g.position.copy(s.p).lerp(V3.copy(to.p).addScaledVector(to.up, to.h * .5 + s.h * .46), t);  // the perch is the top of the other book
        r.g.position.addScaledVector(up, (hov + Math.sin(t * Math.PI) * .75 * (a.s2 ? 1 : .5)) * U + Math.sin(a.ph * .5) * .02 * U * hov * 4).addScaledVector(s.n, Math.sin(t * Math.PI) * .35 * U);
        r.g.quaternion.copy(s.q).slerp(to.q, t);
        const vx = (r.g.position.x - a.lx) / Math.max(dt, 1e-3); a.lx = r.g.position.x; a.tilt += (clamp01(Math.abs(vx) * .3) * Math.sign(vx) * -.35 - a.tilt) * Math.min(1, dt * 5);  // it leans into the motion, a beat late
        const crouch = Math.sin(pr(u, 0, .08) * Math.PI) * .05, land = damp(Math.max(0, u - .46), 9, 20) * .1 * (u < .6 ? 1 : 0), perch = pulse(u, .52, .56, .66, .7);
        book(r, s, 0, 0, -crouch + Math.abs(land) * .05, 0, a.tilt + land + perch * Math.sin(u * 40) * .04, 1, 1 - crouch);
        const th = lerp(-1.25, -.1 + .65 * flap, Math.min(1, open)), ws = open * 1.55 * (.86 + .14 * Math.cos(a.ph));
        wing(r, 0, s, 1, s.tw * .4, s.th * .14, ws, th - a.tilt * .5, Math.min(1, open * 3)); wing(r, 1, s, -1, -s.tw * .4, s.th * .14, ws, th + a.tilt * .5, Math.min(1, open * 3));
        shadow(r, s, 0, 0, 1, (1 - t) * (1 - clamp01(hov * 4))); put(r.gl, U, 0, 0, .1, 2.6, 2.6, 0, .14 * Math.min(1, open) * (.7 + .3 * flap)); r.gl.material.color.setRGB(1, .8, .5);
        if (!a.f && u > .25) { a.f = 1; fxPlay("sparkle", { at: worldOf(s, 0, .2, .3, V2), size: U * 1.2, level: 1, secs: 1.4 }); }
        if (a.f === 1 && u > .47) { a.f = 2; fxPlay("puff", { at: V2.copy(to.p).addScaledVector(to.up, to.h * .55), size: U * .7, tint: [.8, .72, .55], level: 1 }); } }],
    ["blooming", 12, 14, a => { a.k = Math.random() * 6; }, (a, u, dt, s, r, U) => bloom(a, u, s, r, U, 1, 0)],
    ["spell smoke", 10, 12, a => { a.hue = Math.random() < .5 ? [.6, .32, .9] : [1, .78, .32]; a.tm = 0; }, (a, u, dt, s, r, U) => {
      const k = pulse(u, .04, .22, .62, .92), rat = damp(u * 30, .3, 9) * .02 * pulse(u, .02, .1, .2, .3);
      book(r, s, 0, rat * 2, .08 * k, .08 * k, -.05 * k + rat, 1); put(r.gl, U, 0, .2, .12, 3.2, 3.2, 0, .6 * k); r.gl.material.color.setRGB(a.hue[0], a.hue[1], a.hue[2]); shadow(r, s, 0, 0, 1 + .3 * k, k * .5);
      a.tm -= dt; if (u > .2 && u < .88 && a.tm <= 0) { a.tm = .5 + Math.random() * .5 + u * 1.2;  // puffs rise slowly and curl: each one starts a little off to a side and a little in depth
        const d = Math.sin(u * 9) * .3, big = u > .6 ? 1.8 : 1 + Math.random() * .6; fxPlay("puff", { at: worldOf(s, d, .55 + u * .5, .15 + Math.random() * .5, V2), size: U * big, tint: a.hue, level: u > .55 ? 1 : 2 }); }
      if (!a.f && u > .24) { a.f = 1; fxPlay("sparkle", { at: worldOf(s, 0, .3, .3, V2), size: U * 2.4, level: 3, secs: 3 }); }
      if (a.f === 1 && u > .5) { a.f = 2; fxPlay("sparkle", { at: worldOf(s, .3, .7, .4, V2), size: U * 2, level: 2, secs: 2.5 }); } }],
    ["shiver", 8, 10, a => { a.f = 0; }, (a, u, dt, s, r, U) => {  // tremors, a hard rattle that dies away, a calm, a smaller rattle, stillness
      const e = .1 * pr(u, 0, .18) * (1 - pr(u, .16, .2)) + Math.exp(-5 * Math.max(0, u - .2)) * (u > .2 && u < .5 ? 1 : 0) + .5 * Math.exp(-7 * Math.max(0, u - .6)) * (u > .6 ? 1 : 0), w = u * 400;
      book(r, s, 0, Math.sin(w * 1.1) * .09 * e, Math.abs(Math.sin(w * .8)) * .07 * e, .02 + .08 * e, Math.sin(w) * .13 * e, 1); shadow(r, s, 0, 0, 1 + e * .2, .4);
      if (!a.f && u > .21) { a.f = 1; fxPlay("dust", { at: worldOf(s, 0, -.5, .2, V2), size: U, level: 1, secs: 3 }); }
      if (a.f === 1 && u > .62) { a.f = 2; fxPlay("dust", { at: worldOf(s, 0, -.5, .2, V2), size: U * .7, level: 1, secs: 2 }); } }],
    ["peeking eyes", 9, 12, a => { card(a.r.c[0], "eyes"); a.bl = .3 + Math.random() * .1; }, (a, u, dt, s, r, U) => {  // a gap opens, eyes look left, right, blink twice, the gap closes
      const g = eo(pr(u, .03, .2)) * (1 - sm(pr(u, .8, .92))), eye = pulse(u, .16, .3, .74, .84), look = Math.sin(pr(u, .3, .7) * TAU * .75) * .22, bl = 1 - .93 * (Math.max(0, 1 - Math.abs(u - a.bl - .2) * 28) + Math.max(0, 1 - Math.abs(u - .6) * 28));
      book(r, s, 0, -.1 * g, 0, 0, .07 * g, 1); put(r.dk, U, s.tw * .55 * g, 0, .005, (s.tw * .9 + .22) * g, s.th * 1.02, 0, .88 * g); put(r.c[0], U, s.tw * .4 + look, .12, .06, .8 * (.75 + .25 * eye), .8 * bl * (.75 + .25 * eye), 0, eye);
      put(r.gl, U, s.tw * .4 + look, .12, .07, 1.6, .8, 0, .32 * eye * (.8 + .2 * Math.sin(u * 60))); r.gl.material.color.setRGB(1, .8, .35); shadow(r, s, 0, 0, 1, .4); }],
    ["sleepy", 11, 14, a => { for (let i = 0; i < 3; i++) card(a.r.c[i], "z"); }, (a, u, dt, s, r, U) => {  // slow breaths, a sleepy nod, z's float up one by one
      const br = Math.sin(u * TAU * 2.6) * .5 + .5, k = pulse(u, .04, .14, .88, .98); book(r, s, 0, 0, br * .012, .01, Math.sin(u * TAU * 1.3) * .035 * k, 1, 1 + br * .022 * k, 1 + br * .03 * k);
      put(r.gl, U, 0, .35, .1, 2.8, 2.8, 0, .16 * k * (.6 + .4 * br)); r.gl.material.color.setRGB(.55, .6, 1); shadow(r, s, 0, 0, 1, .35);
      for (let i = 0; i < 3; i++) { const v = (u - .1) / .26 - i * 1, ph = ((v % 3) + 3) % 3, on = u > .12 && u < .84 ? 1 : 0, f = ph; if (f > 1) { hid(r.c[i]); continue; }  // each z lives 0.26 of the moment, three take turns
        put(r.c[i], U, s.tw * .3 + .5 * f + Math.sin(f * 7 + i) * .1, .5 + 1.5 * eo(f), .05, .22 + .38 * f, .22 + .38 * f, Math.sin(f * 5 + i) * .22, on * Math.sin(Math.min(1, f * 1.15) * Math.PI) ** .7); } }],
    ["little visitor", 11, 14, a => { a.k = ["fish", "bird", "butterfly"][Math.random() * 3 | 0]; a.d = Math.random() < .5 ? 1 : -1; card(a.r.c[0], a.k); a.fx = 0; }, (a, u, dt, s, r, U) => {
      const g = eo(pr(u, .03, .14)) * (1 - sm(pr(u, .9, .97))), e = pr(u, .12, .86), x = a.d * (.15 + 1.5 * Math.sin(e * Math.PI) * (1 + .12 * Math.sin(e * 17))), y = .15 + 1.2 * Math.sin(e * Math.PI) ** .8 + Math.sin(e * 23) * (a.k === "butterfly" ? .15 : .06);
      const dirx = a.d * (e < .5 ? 1 : -1), face = a.k === "bird" ? -dirx : dirx;
      const fl = a.k === "butterfly" ? .55 + .45 * Math.abs(Math.cos(u * 140)) : 1, rot = a.k === "fish" ? Math.sin(u * 46) * .22 : a.k === "bird" ? Math.cos(e * Math.PI) * -.25 * a.d : Math.sin(u * 30) * .2, sz = (a.k === "butterfly" ? .85 : 1.05) * (.35 + .65 * sm(pr(u, .1, .22))) * (1 - .45 * sm(pr(u, .8, .92)));
      book(r, s, 0, -.08 * g, 0, 0, .05 * g, 1); put(r.dk, U, s.tw * .45 * g, 0, .005, (s.tw * .9 + .2) * g, s.th * 1.02, 0, .85 * g);
      put(r.c[0], U, x, y, .08, sz * face * fl, sz, rot, g > .02 ? clamp01(g * 2) : 0); shadow(r, s, 0, 0, 1, .4); put(r.gl, U, 0, .1, .06, 1.8, 1.6, 0, .25 * pulse(u, .06, .16, .84, .94)); r.gl.material.color.setRGB(1, .85, .5); }],
    ["sunrise inside", 10, 12, a => { a.f = 0; }, (a, u, dt, s, r, U) => {  // the book opens a crack, light grows from deep orange to pale gold, dust motes drift up, it fades
      const o = pulse(u, .08, .5, .62, .96), op = eo(pr(u, .02, .2)) * (1 - sm(pr(u, .88, .98))), c = clamp01(pr(u, .1, .55));
      book(r, s, 0, 0, .03 * op, .02 * op, -.04 * op, 1); put(r.gl, U, 0, .25, .14, 3.6 * (.6 + .4 * o), 3.2 * (.6 + .4 * o), 0, .72 * o); r.gl.material.color.setRGB(1, .55 + .35 * c, .15 + .5 * c);
      put(r.gl2, U, 0, 1.0 + .5 * o, .12, .55 + .5 * o, 2.4 * (.5 + .5 * o), 0, .5 * o); r.gl2.material.color.setRGB(1, .8, .45); shadow(r, s, 0, 0, 1, .3);
      a.tm = (a.tm || 0) - dt; if (u > .25 && u < .78 && a.tm <= 0) { a.tm = .9 + Math.random() * .7; fxPlay("sparkle", { at: worldOf(s, (Math.random() - .5) * .4, .3, .3, V2), size: U * 1.4, level: 1, secs: 3.5 }); } }],
    ["page swirl", 11, 13, a => { for (let i = 0; i < 3; i++) card(a.r.c[i], "page"); a.sp = Math.random() < .5 ? 1 : -1; }, (a, u, dt, s, r, U) => {
      const k = pulse(u, .03, .1, .9, .98); let thump = 0;
      for (let i = 0; i < 3; i++) { const t0 = .1 + i * .09, t1 = .74 + i * .06, out = eo(pr(u, t0, t0 + .22)) * (1 - ei(pr(u, t1, t1 + .15))), an = i * 2.2 + (u - t0) * TAU * 1.9 * a.sp, rad = out * (1.1 + .35 * Math.sin(u * 9 + i)) * (.6 + .4 * Math.sin(pr(u, t0, t1) * Math.PI)), lift = out * (.5 + .4 * Math.sin(u * 7 + i)) ;
        put(r.c[i], U, rad * Math.cos(an), .2 + lift + rad * Math.sin(an) * .55, .06 + .25 * out * Math.sin(an) * a.sp, .62 * Math.cos(an * 1.7 + i), .8, an * .35 + Math.sin(u * 20 + i) * .2, out > .01 ? clamp01(out * 3) : 0);
        thump += Math.exp(-14 * Math.abs(u - (t1 + .13))) * (1 - ei(pr(u, t1 + .15, t1 + .2))) + Math.exp(-14 * Math.abs(u - t0)); }
      book(r, s, 0, 0, 0, .01, Math.sin(u * 55) * .02 * thump + .03 * k, 1); put(r.gl, U, 0, .2, .1, 2.4, 2.4, 0, .22 * k); r.gl.material.color.setRGB(1, .85, .55); shadow(r, s, 0, 0, 1, .35); }],
    ["rain cloud", 12, 14, a => { a.k = Math.random() * 6; a.h = null; card(a.r.c[3], "cloud"); }, (a, u, dt, s, r, U) => {
      const come = eo(pr(u, .02, .24)) * (1 - ei(pr(u, .88, .99))), sz = 1.9 * (1 - .35 * pr(u, .35, .85)), cx = (1 - come) * (a.k > 3 ? 3.2 : -3.2) + Math.sin(u * 4) * .12;
      put(r.c[3], U, cx, 1.55 + Math.sin(u * 6) * .05 + .02 * Math.sin(u * 40) * pulse(u, .22, .26, .3, .34), .1, sz, sz * (1 + .04 * Math.sin(u * 11)), Math.sin(u * 5) * .05, come > .02 ? Math.min(1, come * 1.4) : 0);
      put(r.dk, U, 0, .9, .01, 3.2, 3.6, 0, .35 * pulse(u, .15, .3, .8, .94));
      if (!a.f && u > .25) { a.f = 1; a.h = fxPlay("rain", { at: worldOf(s, 0, 1.25, .15, V2), size: U * 2.4, area: [U * 1.3, U * .4], level: 1, secs: a.dur * .55 }); }
      bloom(a, u * .92 + .06, s, r, U, 1.05, 1); }],
    ["hopping stack", 12, 14, a => { const n = a.s.stack ? a.s.stack.length : 0; a.hs = a.s.stack || []; a.cnt = n; for (let i = 0; i < Math.min(3, n); i++) { const sp = a.s.stack[i]; a.r.b[i].material.map = spineTexture(sp.color, 1, a.s.seed + i); a.r.b[i].rotation.z = Math.PI / 2; }
      a.ord = [0, 1, 2]; a.oy = [0, 0, 0]; a.ny = [0, 0, 0]; a.mv = -1; },
      (a, u, dt, s, r, U) => { const st = a.hs, n = Math.min(3, a.cnt); if (n < 3) return;  // the bottom book hops onto the top, three times, and the pile ends as it began
        const stackY = (ord, k, out) => { let y = -(st[0].h + st[1].h + st[2].h) / 2; for (let j = 0; j < 3; j++) { const bk = ord[j], h = st[bk].h; out[bk] = (y + h / 2) / U; y += h; } };
        const m = Math.min(2, Math.max(0, Math.floor((u - .12) / .24))), tm = pr(u, .12 + m * .24, .12 + m * .24 + .2), ord0 = a.ord;
        if (a.mv !== m) { a.mv = m; if (m > 0) { const b = a.ord.shift(); a.ord.push(b); } stackY(a.ord, 0, a.oy); const nx = a.ord.slice(1); nx.push(a.ord[0]); stackY(nx, 0, a.ny); a.jump = a.ord[0]; a.nx = nx; }
        const k = u < .12 ? 0 : u > .84 ? 0 : 1, e = sm(tm), lim = pulse(u, .01, .06, .94, .99);
        for (let i = 0; i < 3; i++) { const sp = st[i], len = sp.len / U, hh = sp.h / U; let y = lerp(a.oy[i], a.ny[i], e), x = 0, rz = 0, sy = 1;
          if (i === a.jump) { const hop = Math.sin(e * Math.PI), pre = Math.sin(pr(tm, 0, .25) * Math.PI) * (1 - sm(pr(tm, .25, .4))); x = Math.sin(e * Math.PI * 2) * len * .22 * (m % 2 ? -1 : 1); y += hop * .55 - pre * .02; rz = Math.sin(e * Math.PI * 2) * .15 * (m % 2 ? -1 : 1); sy = 1 + .1 * pre - .08 * hop * hop; }
          put(r.b[i], U, x + (sp.dx || 0), y, .02 + i * .004, hh, len * sy, Math.PI / 2 + rz, lim); }
        void ord0; void k; shadow(r, s, 0, -.1, 1.2, .3); } ],
    ["star fountain", 11, 13, a => { for (let i = 0; i < 4; i++) { card(a.r.c[i], "star"); a.r.c[i].userData.v = Math.random(); } a.f = 0; }, (a, u, dt, s, r, U) => {
      const o = pulse(u, .06, .3, .72, .94), op = eo(pr(u, .03, .18)) * (1 - sm(pr(u, .9, .98)));
      book(r, s, 0, 0, .05 * op, .03 * op, -.05 * op, 1); put(r.gl, U, 0, .5, .14, 3 * (.7 + .3 * o), 2.4 * (.7 + .3 * o), 0, .7 * o); r.gl.material.color.setRGB(1, .86, .5); put(r.gl2, U, 0, 1.3, .12, .7, 2.2 * o, 0, .4 * o); r.gl2.material.color.setRGB(1, .9, .6); shadow(r, s, 0, 0, 1, .3);
      if (!a.f && u > .16) { a.f = 1; fxPlay("sparkle", { at: worldOf(s, 0, .6, .3, V2), size: U * 2.6, level: 3, secs: 6 }); }
      if (a.f === 1 && u > .55) { a.f = 2; fxPlay("sparkle", { at: worldOf(s, 0, .9, .35, V2), size: U * 2.2, level: 2, secs: 3 }); }
      for (let i = 0; i < 4; i++) { const q = r.c[i], v = (((u * 3.1 - i * .25) % 1) + 1) % 1, on = u > .12 && u < .8 ? 1 : (u > .8 && u < .93 && v < .6 ? 1 : 0), dir = (i - 1.5) * .5 + Math.sin(i * 5 + Math.floor(u * 3.1 - i * .25)) * .2;  // a toss, a slowing arc, a drift up into the light
        put(q, U, dir * eo(v) * 1.2 + Math.sin(v * 9 + i) * .08, .45 + 2.7 * eo(v) - .5 * v * v, .08, .42 * (1 + .2 * Math.sin(v * 30)), .42 * (1 + .2 * Math.sin(v * 30)), v * 5 + i, on * Math.sin(Math.min(1, v * 1.1) * Math.PI) ** .6); } }],
  ];
  function bloom(a, u, s, r, U, rate, rainy) {  // moments 2 and 10: three vines grow stem by stem along the shelf, flowers open, then it all folds back
    const open = pulse(u, .02, .16, .88, .98), cut = [-.95, .05, .95];
    book(r, s, 0, .04 * open, 0, .03 * open, -.07 * open, 1); shadow(r, s, 0, 0, 1, .4); put(r.gl, U, 0, 0, .12, 2.2, 2, 0, .35 * open * (.5 + .5 * pulse(u, .2, .5, .7, .9))); r.gl.material.color.setRGB(1, .8, .5);
    for (let i = 0; i < 3; i++) { const st = .12 + i * .13, g = (eo(pr(u, st, st + .42 / rate)) * (1 - sm(pr(u, .86, .97 + i * .005)))), stage = Math.min(3, g * 3.999 | 0), f = g * 4 - stage, bl = stage === 3 ? bo(pr(g, .75, 1)) : 1;
      card(r.c[i], "vine" + (stage + 1)); const sz = (.36 + .62 * g) * (i === 1 ? 1.08 : 1) * (stage === 3 ? .88 + .12 * bl : 1), sway = Math.sin(u * 5 + a.k + i * 2) * .05 * g;
      put(r.c[i], U, cut[i] + sway, -s.th / 2 + sz / 2 * .96, .08 + i * .01, sz * (i === 1 ? -1 : 1), sz, sway * .7, g > .01 ? clamp01(g * 5) : 0); void f; }
    if (!a.f && u > .5) { a.f = 1; fxPlay("sparkle", { at: worldOf(s, 0, 0, .3, V2), size: U * 2, level: 1, secs: 3 }); }
    void rainy; }

  // ---- the scheduler
  const acts = []; let last = [], wait = 3, clock = 0;
  const api = { auto: true, kinds: kinds || STATION_KINDS[station] || STATION_KINDS.home, setStation(k) { if (STATION_KINDS[k]) api.kinds = STATION_KINDS[k]; }, group: root, update, tap, fire, stats, dispose };
  function pickNear(s) { let best = null, bd = 9e9; for (const o of S) { if (o === s || o.busy || o.flat) continue; const d = o.p.distanceTo(s.p); if (d > s.h * 2 && d < 4 && d < bd) { bd = d; best = o; } } return best; }
  function visible() { camera.updateMatrixWorld();
    for (const s of S) { s.dist = s.p.distanceTo(camera.position); V.copy(s.p).project(camera); s.vis = V.z < 1 && Math.abs(V.x) < .8 && Math.abs(V.y) < .75 && s.n.dot(V2.copy(camera.position).sub(s.p)) > 0; } }  // fully in view, facing us
  const fits = (n, s) => n === 11 ? s.flat && s.stack?.length >= 3 : !s.flat;
  function start(n, s) { const m = MOM[n], rig = rigs.find(r => !r.busy); if (!m || !s || s.busy || !rig || !fits(n, s)) return null;
    const a = acts.find(x => !x.on) || (acts.push({}), acts[acts.length - 1]); Object.assign(a, { on: true, n, s, s2: null, r: rig, t: 0, dur: m[1] + Math.random() * (m[2] - m[1]), f: 0, k: 0, h: null, d: 1, hue: null, tm: 0 });
    rig.busy = true; s.busy = true; rig.g.visible = true; rig.g.position.copy(s.p); rig.g.quaternion.copy(s.q);
    if (n !== 11) for (const q of rig.b) q.material.map = spineTexture(s.color, s.bands, s.seed);
    for (const q of rig.b) q.rotation.z = 0; rig.gl.material.color.setRGB(1, .8, .5);
    s.hide?.(true); if (n === 11) s.hide?.(true); m[3](a); return a; }
  function stop(a) { const r = a.r; r.g.visible = false; for (const q of [...r.b, ...r.c, r.gl, r.gl2, r.dk, r.sh]) hid(q); r.busy = false; a.s.busy = false; a.s.hide?.(false); if (a.s2) a.s2.busy = false; a.on = false; a.h?.stop?.(); }
  function fire(n, i) { if (reduced) return null; visible(); let s = i != null ? S[i] : null; if (!s) { const c = S.filter(o => !o.busy && o.vis && fits(n, o)); s = c[Math.random() * c.length | 0] || S.find(o => !o.busy && fits(n, o)); } return start(n, s); }
  function schedule() {
    let live = 0; for (const a of acts) if (a.on) live++; if (live >= MAXACT) return;
    visible(); const free = S.filter(o => !o.busy && o.vis && !acts.some(a => a.on && a.s.p.distanceTo(o.p) < 2.5));  // never side by side
    const K = api.kinds.filter(k => !last.includes(k)), pool = (K.length ? K : api.kinds).slice().sort(() => Math.random() - .5);
    for (const n of pool) { const c = free.filter(o => fits(n, o)); if (!c.length) continue; let tot = 0; for (const o of c) tot += o.dist; let x = Math.random() * tot, s = c[0]; for (const o of c) { x -= o.dist; if (x <= 0) { s = o; break; } }  // far spots come up more often
      last.push(n); if (last.length > Math.max(1, api.kinds.length - 2)) last.shift(); start(n, s); return; } }
  function update(dt) {
    if (reduced || document.hidden || !S.length) return; dt = Math.min(dt, .1); clock += dt;
    for (const a of acts) { if (!a.on) continue; a.t += dt; const u = a.t / a.dur; if (u >= 1) { stop(a); continue; } MOM[a.n][4](a, u, dt, a.s, a.r, a.s.u); }
    wait -= dt; if (wait <= 0) { wait = 4 + Math.random() * 6; if (api.auto) schedule(); }
  }
  function tap(x, y) {  // a tap on a living book: it shivers or giggles for a moment
    if (reduced || !S.length) return false; visible(); let best = null, bd = 9e9;
    for (const s of S) { if (!s.vis) continue; V.copy(s.p).project(camera); const k = Math.hypot((V.x - x) * camera.aspect, V.y - y), rad = Math.max(s.h, s.w * 3) * .7 / s.dist * camera.projectionMatrix.elements[5]; if (k < rad && k < bd) { bd = k; best = s; } }
    if (!best) return false; const kind = Math.random() < .5 ? "giggle" : "shiver", a = acts.find(q => q.on && q.s === best);
    if (!a && !best.flat) { const a2 = start(4, best); if (a2) { a2.dur = 3.6; a2.t = a2.dur * .19; } }  // straight into the rattle
    if (kind === "giggle") fxPlay("sparkle", { at: worldOf(best, 0, .3, .3, V2), size: best.u * 1.4, level: 1, secs: 1.2 }); onTap({ spot: best, index: best.i, kind }); return true; }
  function stats() { let q = 0; root.traverse(o => { if (o.isMesh && o.visible && o.parent.visible) q++; }); return { acts: acts.filter(a => a.on).length, active: acts.filter(a => a.on).map(a => [a.n, a.s.i, +(a.t / a.dur).toFixed(2)]), quads: q, spots: S.length, clock }; }
  function dispose() { for (const a of acts) if (a.on) stop(a); scene.remove(root); atlas.dispose(); glowW.dispose(); glowD.dispose(); for (const g of Object.values(geos)) g.dispose(); quadGeo.dispose(); }
  return api;
}
