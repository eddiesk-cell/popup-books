// fx.js — bamboo rockets and firework bursts for the pop-up book (T7d). One additive particle pool, all motion in the vertex shader from a
// time uniform; a second small pool for smoke; three pooled point lights; no post-processing. It plays no sound: it calls opts.sound?.(name) with
// "fx-hiss" | "fx-whoosh" | "fx-crackle" | "fx-boom". The clock is its own (update(dt) adds up), so a fixed-step recorder gets the same show every time.
// createFx(scene, renderer, { phone, unit = 1, pondY, reduced, debug, sound }) -> { rocket, burst, finale, prop, update, dispose, stats }
import * as THREE from "three";

const GOLD = [1, .5, .12], WHITE = [1, .9, .7], BLUE = [.28, .55, 1];
// Kinds: 0 glowing star (white-hot core, soft halo, a velocity-stretched streak) · 1 paper diamond · 2 paper star · 3 big glow · 4 glitter · 5 flash · 6 smoke · 7 rain streak · 8 pond shimmer
const VS = `
uniform float uTime, uH, uMirror, uAlpha; uniform vec3 uLit; attribute vec3 aV, aC, aD; attribute vec4 aA;
varying vec4 vC, vS; varying vec2 vDir; varying float vK, vR;
vec3 posAt(float t) { vec3 p = position + aV * ((1. - exp(-aD.x * t)) / max(aD.x, 1e-3)); p.y -= .5 * aD.y * t * t; return p; }
vec4 clipAt(vec3 p) { if (uMirror > -1e3) p.y = uMirror - (p.y - uMirror) * .3; return projectionMatrix * modelViewMatrix * vec4(p, 1.); }  // the pond: a squashed reflection
void main() {
  float age = uTime - aA.x, life = aA.y, u = age / life, k = aA.w;
  if (age < 0. || u > 1. || (uMirror > -1e3 && k > 7.5)) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  float h = fract(sin(aA.x * 91.7 + aA.z * 1731.1 + aC.g * 57.3) * 43758.5);
  float a = min(1., age * 28.) * pow(1. - u, 1.2), s = aA.z; vec3 col = aC;
  if (k < 2.5 || (k > 3.5 && k < 4.5)) { col = mix(mix(aC, vec3(1., .97, .9), .28), aC, smoothstep(0., .12, u)); col = mix(col, vec3(1., .62, .28), smoothstep(.55, 1., u) * .7); }  // white-hot, then the shell's colour, then ember gold
  if (k > 3.5 && k < 4.5) a *= .25 + .75 * pow(.5 + .5 * sin(age * (16. + h * 22.) + h * 6.28), 2.);                              // glitter twinkles
  if (k > 2.5 && k < 3.5) a = min(1., age * 18.) * pow(1. - u, 1.5);                                                               // glow: quick attack, long fade
  if (k > 5.5 && k < 6.5) { a = min(1., age * 6.) * (1. - u) * .24; s *= 1. + 1.1 * u; col = aC + uLit * .08; }                      // smoke grows, and catches the bursts' light
  if (k > 7.5) a = sin(3.14159 * min(1., u * 1.3)) * (1. - u * .5);
  vec4 c0 = clipAt(posAt(age)), pos = c0; float pxu = uH * .5 * projectionMatrix[1][1] / c0.w, size = 1.8 * s * pxu;
  vS = vec4(0.); vDir = vec2(1., 0.);
  if (k < .5) {  // a star: sprite centred on the middle of its streak, which runs from the head back along where it has been
    vec4 c1 = clipAt(posAt(max(0., age - abs(aD.z)))); float asp = projectionMatrix[1][1] / projectionMatrix[0][0];
    vec2 d = (c0.xy / c0.w - c1.xy / c1.w) * vec2(asp, 1.) * uH * .5; float L = min(260., length(d)); vec2 dir = L > .5 ? d / L : vec2(0., 1.);
    float hr = s * pxu * .5, hs = L * .5 + hr * 4.;
    pos = vec4((c0.xy / c0.w - dir * (L * .5) / (uH * .5) / vec2(asp, 1.)) * c0.w, c0.z, c0.w); vS = vec4(L, hr, hs, aD.z < 0. ? 1. : 0.); vDir = dir; size = 2. * hs;
  } else if (k < 2.5) size = 2.6 * s * pxu;
  vC = vec4(col, a * uAlpha); vK = k; vR = h * 6.2832; gl_Position = pos; gl_PointSize = min(700., size);
}`;
const FS = `
varying vec4 vC, vS; varying vec2 vDir; varying float vK, vR;
void main() {
  vec2 q = gl_PointCoord * 2. - 1.; float d = length(q), c = cos(vR), s = sin(vR); vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y), ar = abs(r);
  vec3 col = vec3(0.); float sh = 0., edge = smoothstep(1., .82, max(abs(q.x), abs(q.y)));
  if (vK < .5) {
    vec2 P = vec2(q.x, -q.y) * vS.z, perp = vec2(-vDir.y, vDir.x); float L = vS.x, hr = max(vS.y, .6), a = dot(P, vDir), b = dot(P, perp), ah = a - L * .5, rh2 = ah * ah + b * b;
    float halo = exp(-rh2 / (hr * hr * 2.6)), core = exp(-rh2 / (hr * hr * .16)), t = clamp((L * .5 - a) / max(L, 1.), 0., 1.);
    float w = hr * mix(.5, .12, t) + .4, streak = step(-L * .5, a) * step(a, L * .5 + hr) * exp(-b * b / (w * w)) * pow(1. - t, 1.3) * step(2., L);
    vec3 sc = mix(vC.rgb, vec3(1., .78, .36), vS.w * smoothstep(0., .5, t));
    col = vC.rgb * halo * .55 + sc * streak * .5 + vec3(1., .96, .86) * (core * 1.7 + streak * .1);  // HDR: the core ~5, the halo ~2: the viewer's bloom makes the glow                                  // two layers: a white-hot core in a coloured halo
  } else if (vK < 2.5) {
    vec2 x = r / .42; float m = vK < 1.5 ? smoothstep(1., .7, abs(x.x) + abs(x.y)) : smoothstep(1., .6, sqrt(abs(x.x)) + sqrt(abs(x.y)));  // cut paper
    col = vC.rgb * (exp(-d * d * 4.) * .3 + m * .9) + vec3(1., .96, .86) * m * .25;
  } else if (vK < 3.5) col = vC.rgb * exp(-d * d * 3.2) * .8 * smoothstep(1., .55, d);
  else if (vK < 4.5) { float core = pow(max(0., 1. - d), 2.5); col = vC.rgb * (core * core * .8 + smoothstep(1., .5, d) * .1) + vec3(1., .96, .86) * pow(core, 3.) * 1.5; }
  else if (vK < 5.5) col = 1.1 * vec3(1., .97, .88) * (exp(-d * d * 6.) + smoothstep(1., .0, ar.x * 7. + ar.y) * .8 + smoothstep(1., .0, ar.y * 7. + ar.x) * .8);
  else if (vK < 6.5) sh = smoothstep(1., .0, d) * .8;
  else if (vK < 7.5) col = vC.rgb * smoothstep(1., .25, abs(q.x) * 3.2) * smoothstep(1., .0, abs(q.y));
  else col = .35 * vC.rgb * exp(-(q.x * q.x * 1.6 + q.y * q.y * 20.)) * (.7 + .3 * sin(q.x * 9. + vR * 3.)) * edge;
  if (vK > 5.5 && vK < 6.5) { if (sh * vC.a < .004) discard; gl_FragColor = vec4(vC.rgb, sh * vC.a); return; }
  col *= edge;
  gl_FragColor = vec4(col, min(1., vC.a));  // additive; values above 1 are real light in the HDR buffer
}`;

function pool(n, blending, U, mirror) {
  const g = new THREE.BufferGeometry(), S = { position: 3, aV: 3, aA: 4, aC: 3, aD: 3 }, F = {};
  for (const k in S) { F[k] = new Float32Array(n * S[k]); g.setAttribute(k, new THREE.BufferAttribute(F[k], S[k]).setUsage(THREE.DynamicDrawUsage)); }
  for (let i = 0; i < n; i++) F.aA[i * 4] = -1e9;  // every slot starts dead
  const mat = (m, al) => new THREE.ShaderMaterial({ uniforms: { ...U, uMirror: { value: m }, uAlpha: { value: al } }, vertexShader: VS, fragmentShader: FS, blending, transparent: true, depthWrite: false });
  const mk = m => { const o = new THREE.Points(g, m); o.frustumCulled = false; return o; };
  const o = { F, mesh: mk(mat(-1e4, 1)), mirror: mirror === undefined ? null : mk(mat(mirror, .07)), n, head: 0, dirty: false };
  if (o.mirror) o.mirror.renderOrder = 2;
  o.mesh.renderOrder = 3;
  o.emit = (x, y, z, vx, vy, vz, b, life, size, kind, r, gg, bl, drag, grav, trail = 0) => {  // the ring buffer: the oldest slot is overwritten, nothing is allocated
    const i = o.head; o.head = (i + 1) % n; o.dirty = true; let j = i * 3;
    F.position[j] = x; F.position[j + 1] = y; F.position[j + 2] = z; F.aV[j] = vx; F.aV[j + 1] = vy; F.aV[j + 2] = vz; F.aC[j] = r; F.aC[j + 1] = gg; F.aC[j + 2] = bl; F.aD[j] = drag; F.aD[j + 1] = grav; F.aD[j + 2] = trail;
    j = i * 4; F.aA[j] = b; F.aA[j + 1] = life; F.aA[j + 2] = size; F.aA[j + 3] = kind;
  };
  o.flush = () => { if (o.dirty) { for (const k in S) g.attributes[k].needsUpdate = true; o.dirty = false; } };  // shortcut: whole buffers re-sent while spawning (<=0.5 MB), ranges later if a profile asks
  o.live = T => { let c = 0; for (let i = 0; i < n; i++) { const a = T - F.aA[i * 4]; if (a >= 0 && a < F.aA[i * 4 + 1]) c++; } return c; };
  return o;
}

const rgb = c => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };  // linear, saturated: the viewer's pipeline is linear HDR  // additive wants a little lift
const v3 = p => new THREE.Vector3().fromArray(Array.isArray(p) ? p : [p.x, p.y, p.z]);

// A festival rocket (bang fai): a long bamboo tube wound with bands of its ribbon colour, a small gold-horned naga head at the tip, a long stick, and a free ribbon.
// Local +Y is the way it points; its origin is the tube's tail.
function makeRocket(colour) {
  const g = new THREE.Group(), L = .85, em = new THREE.Color(colour).multiplyScalar(.35), rib0 = new THREE.MeshStandardMaterial({ color: colour, roughness: .8, emissive: em });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, L, 14), new THREE.MeshStandardMaterial({ color: 0xc9a45a, roughness: .85, emissive: 0x3a2508 })); tube.position.y = L / 2; g.add(tube);
  for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.057, .057, .03, 14), rib0); w.position.y = .06 + i * (L - .12) / 5; w.rotation.z = .35; g.add(w); }  // the winding: tilted bands of ribbon
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b040, roughness: .5, emissive: 0x4a3008 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(.058, 12, 10), rib0); head.position.y = L + .04; head.scale.set(1, .85, 1.15); g.add(head);  // naga head: skull, snout, two horns
  const snout = new THREE.Mesh(new THREE.ConeGeometry(.04, .12, 10), rib0); snout.position.set(0, L + .05, .09); snout.rotation.x = Math.PI / 2; g.add(snout);
  for (const x of [-.03, .03]) { const h = new THREE.Mesh(new THREE.ConeGeometry(.014, .09, 6), gold); h.position.set(x, L + .12, -.02); h.rotation.x = -.5; g.add(h); }
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(.011, .014, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x9a7640, roughness: 1, emissive: 0x20140a })); stick.position.y = -.6; g.add(stick);
  const rg = new THREE.PlaneGeometry(.1, .9, 1, 8), rib = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(1.15), side: THREE.DoubleSide }));
  g.add(rib); g.userData.rib = { pos: rg.attributes.position, base: Float32Array.from(rg.attributes.position.array), mesh: rib };
  g.userData.ribbon = (t, amp) => {  // streams and wobbles: the ribbon hangs from the tube's top ring, trailing behind
    const { pos, base } = g.userData.rib;
    for (let i = 0; i < pos.count; i++) { const y = base[i * 3 + 1], w = (.45 - y) / .9;  // 0 at the root, 1 at the free end
      pos.setXYZ(i, base[i * 3] + .06 + Math.sin(t * 15 - w * 7) * amp * w * w, y + .2, Math.cos(t * 12 - w * 6) * amp * .7 * w * w); }
    pos.needsUpdate = true;
  };
  g.userData.ribbon(0, .01); g.scale.setScalar(1.5);
  return g;
}

export function createFx(scene, renderer, { phone = false, unit = 1, pondY, reduced, debug = false, sound: defSound } = {}) {
  reduced ??= typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const Q = phone ? .42 : 1, rnd = Math.random, size2 = new THREE.Vector2(), u = unit, R0 = (phone ? 2.4 : 1.9) * u, DR = 1.9;
  const light = { c: new THREE.Color(0, 0, 0), k: 0 }, kick = { x: 0, y: 0, amp: 0 }, U = { uTime: { value: 0 }, uH: { value: 800 }, uLit: { value: new THREE.Vector3() } };
  const main = pool(phone ? 1800 : 6000, THREE.AdditiveBlending, U, pondY), smoke = pool(phone ? 300 : 1100, THREE.NormalBlending, U);
  const root = new THREE.Group(); root.add(smoke.mesh, main.mesh); if (main.mirror) root.add(main.mirror); scene.add(root);
  const slots = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffb060, 0, 0, 2); root.add(l); return { l, own: null, t0: 0, dur: 1, peak: 0 }; });  // shortcut: three lights, not one per burst; the oldest is reused
  const stats = { peakLive: 0, peakFlash: 0, flashes: 0 }, flashAt = [], later = [], rockets = [];
  let T = 0, rattle = 0, drift = 1;  // smoke drifts sideways
  const hook = (o, n) => (o.sound ?? defSound)?.(n), wait = (s, f) => later.push({ t: T + s, f });
  const canFlash = () => { while (flashAt.length && T - flashAt[0] > 1) flashAt.shift(); if (flashAt.length >= 3) return false; flashAt.push(T); stats.flashes++; stats.peakFlash = Math.max(stats.peakFlash, flashAt.length); return true; };  // never more than 3 a second
  const grab = () => slots.reduce((a, b) => (a.t0 + a.dur < b.t0 + b.dur ? a : b));
  const pulse = (at, c, peak, dur) => { const s = grab(); s.own = "pulse"; s.t0 = T; s.dur = dur; s.peak = peak; s.l.position.copy(at); s.l.color.setRGB(c[0], c[1], c[2]); };
  const bump = (c, amt) => { const k = light.k + amt; light.c.r = (light.c.r * light.k + c[0] * amt) / k; light.c.g = (light.c.g * light.k + c[1] * amt) / k; light.c.b = (light.c.b * light.k + c[2] * amt) / k; light.k = Math.min(1, k); };  // the scene takes the burst's colour for about half a second
  const shake = px => { if (!reduced) kick.amp = Math.max(kick.amp, px); };

  const D = { x: 0, y: 0, z: 0 }, FP = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };  // scratch: a direction, and where a star is at a given age
  const sphere = (i, n, off) => { const z = 1 - 2 * (i + .5) / n, a = i * 2.39996 + off, r = Math.sqrt(1 - z * z); D.x = r * Math.cos(a); D.y = z; D.z = r * Math.sin(a); };
  const kindPaper = () => { const x = rnd(); return x < .8 ? 0 : x < .9 ? 1 : 2; };  // diamonds and stars among the glowing ones: the handmade touch
  const col = (c, gold) => (rnd() < gold ? GOLD : rnd() < .08 ? WHITE : c);
  const alt = c => [(c[2] + 1) * .5, (c[0] + .4) * .62, (c[1] + 1) * .5];  // a second colour for the inner sphere
  let AT = null;  // the burst being built
  const star = (sp, c, size, kind, life, drag, grav, trail = 0) => AT && main.emit(AT.x, AT.y, AT.z, D.x * sp, D.y * sp, D.z * sp, T, life, size, kind, c[0], c[1], c[2], drag, grav, trail);
  const fly = (sp, k, g, t) => { const e = Math.exp(-k * t), d = (1 - e) / k; FP.x = AT.x + D.x * sp * d; FP.y = AT.y + D.y * sp * d - .5 * g * t * t; FP.z = AT.z + D.z * sp * d; FP.vx = D.x * sp * e; FP.vy = D.y * sp * e - g * t; FP.vz = D.z * sp * e; };
  // a crackle: twinkling glitter that wakes up on the shell's own shape at time t0
  const pop = (n, sp, k, g, t0, c, life = 1.5) => { for (let i = 0; i < n; i++) { sphere(i, n, rnd() * 6); fly(sp * (.6 + rnd() * .4), k, g, t0); const j = .5 * u;
    main.emit(FP.x, FP.y, FP.z, FP.vx * .3 + (rnd() - .5) * j, FP.vy * .3 + (rnd() - .5) * j, FP.vz * .3 + (rnd() - .5) * j, T + t0 + rnd() * .25, life * (.7 + rnd() * .6), (.05 + rnd() * .04) * u, 4, c[0], c[1], c[2], 2.2, .45 * u); } };
  const glitter = (n, spread, life, c = GOLD) => { for (let i = 0; i < n; i++) { sphere(i, n, rnd() * 6); const s = spread * (.3 + rnd() * .7) * u;
    main.emit(AT.x, AT.y, AT.z, D.x * s, D.y * s, D.z * s, T + rnd() * .15, life * (.7 + rnd() * .6), .05 * u * (.7 + rnd() * .8), 4, c[0], c[1], c[2], 2.2, .45 * u); } };
  const glow = (p, c, size, life, k = .55) => main.emit(p.x, p.y, p.z, 0, 0, 0, T, life, size * u, 3, c[0] * k, c[1] * k, c[2] * k, 0, 0);
  const puff = (p, vy, big = 1) => smoke.emit(p.x + (rnd() - .5) * .1 * u, p.y, p.z + (rnd() - .5) * .1 * u, (rnd() - .5) * .3 * u + drift * .5 * u, vy * u, (rnd() - .5) * .3 * u, T, 2.5 + rnd() * .6, (.26 + rnd() * .12) * u * big, 6, .3, .27, .46, .9, -.04);
  const rain = (at, n) => { for (let i = 0; i < n; i++) main.emit(at.x + (rnd() - .5) * 2.4 * u, at.y - (.25 + rnd() * .6) * u, at.z + (rnd() - .5) * .5 * u, 0, -2.4 * u, 0, T + .25 + rnd() * 1.3, 1 + rnd() * .3, .13 * u, 7, BLUE[0], BLUE[1], BLUE[2], 0, 2.4 * u); };

  function burst(o) {
    const c = rgb(o.colour ?? 0xffd070), at = v3(o.at), type = o.type ?? "peony", R = R0 * (o.scale ?? 1), nn = k => Math.max(8, Math.round(k * Q * (o.dense ?? 1))); AT = at;
    if (reduced) { glow(at, c, 3.2, 1.8, .45); glitter(nn(40), 1.2, 2.4, c); if (o.rain) wait(.3, () => rain(at, nn(26))); return; }  // reduced motion: a soft glow and falling glitter only
    hook(o, "fx-boom"); shake(2.5);
    if (canFlash()) { main.emit(at.x, at.y, at.z, 0, 0, 0, T, .12, .3 * u, 5, c[0], c[1], c[2], 0, 0); pulse(at, c, 14, .6); bump(c, .8); } else bump(c, .25);  // a hot flash and a coloured light pulse; the limiter says when
    glow(at, c, 1.44 * R / u, 1.2, .05);  // one faint tinted glow; the bloom does the rest  // the big soft glow (about 1.3 times the burst) and a small hot centre
    main.emit(at.x, at.y, at.z, 0, 0, 0, T, .5, .3 * u, 0, 1, .97, .88, 0, 0, 0);
    if (pondY !== undefined) main.emit(at.x, pondY + .03, at.z + 2.2 * u, 0, 0, 0, T, 1.4, 5.5 * R / R0 * u, 8, c[0] * .7, c[1] * .7, c[2] * .7, 0, 0);  // a wide shimmer on the water
    const off = rnd() * 6, c2 = alt(c);
    if (type === "peony") { const n = nn(230); for (let i = 0; i < n; i++) { sphere(i, n, off); const kk = kindPaper(); star(R * DR * (.96 + rnd() * .08), col(c, .2), kk ? .17 * u : .17 * u, kk, 1.7 + rnd() * .5, DR, .5 * u, kk ? 0 : .16); }
      const m = nn(120); for (let i = 0; i < m; i++) { sphere(i, m, off + 1); star(R * DR * .5 * (.9 + rnd() * .2), c2, .14 * u, 0, 1.5, DR, .4 * u, .12); }
      pop(nn(90), R * DR, DR, .5 * u, 1.15, c); glitter(nn(40), 1.6, 1.8); }
    else if (type === "chrysanthemum") { const n = nn(160); for (let i = 0; i < n; i++) { sphere(i, n, off); star(R * DR * (.85 + rnd() * .3), col(c, .08), .11 * u, 0, 1.9, DR, .45 * u, -.4); }
      pop(nn(80), R * DR, DR, .45 * u, 1.3, GOLD); glitter(nn(30), 1.5, 1.8); }
    else if (type === "willow") { const n = nn(60), m = phone ? 7 : 12;  // thick gold strands, each a chain of shrinking sparks that follow one path
      for (let i = 0; i < n; i++) { sphere(i, n, off); const sp = R * 1.1 * (.8 + rnd() * .4); for (let j = 0; j < m; j++) { const w = 1 - j / m; AT && main.emit(AT.x, AT.y, AT.z, D.x * sp, D.y * sp, D.z * sp, T + j * .07, (3.6 - j * .05) * (.9 + rnd() * .1), (.07 + .07 * w) * u, 0, GOLD[0], GOLD[1] * (.9 + .1 * w), GOLD[2], 1.1, .9 * u, -.12); } }
      pop(nn(150), R * 1.1, 1.1, .9 * u, 1.2, GOLD, 2.2); glitter(nn(30), .7, 3); }
    else if (type === "ring") { const ring = (n, sp, tx, ty, kk) => { const ex = [Math.cos(tx), 0, Math.sin(tx)], ey = [-Math.sin(tx) * Math.sin(ty), Math.cos(ty), Math.cos(tx) * Math.sin(ty)];
        for (let i = 0; i < n; i++) { const a = i / n * 6.2832, ca = Math.cos(a), sa = Math.sin(a); D.x = ex[0] * ca + ey[0] * sa; D.y = ex[1] * ca + ey[1] * sa; D.z = ex[2] * ca + ey[2] * sa; const k = kk && i % 3 === 0 ? 1 + (i % 2) : 0; star(sp, col(c, .1), k ? .17 * u : .17 * u, k, 1.7, DR, .4 * u, k ? 0 : .12); } };
      ring(nn(100), R * DR, rnd() * 6, .5 + rnd() * .7, true); ring(nn(64), R * DR * .6, rnd() * 6, 1 + rnd() * .5, false);
      for (let i = 0; i < nn(40); i++) { sphere(i, nn(40), off); star(R * DR * .26 * (.5 + rnd()), GOLD, .13 * u, 0, 1.3, DR, .3 * u, .1); }
      pop(nn(50), R * DR, DR, .4 * u, 1.2, GOLD); glitter(nn(24), 1.2, 1.8); }
    else { const n = 9, dirs = [];  // palm: a thick tail, heavy drooping fronds, then a crackle
      for (let i = 0; i < nn(40); i++) { D.x = (rnd() - .5) * .12; D.y = -1; D.z = (rnd() - .5) * .12; star(R * (.15 + rnd() * .75), GOLD, .22 * u, 0, 1.3, 2.4, .2 * u, -.6); }
      for (let i = 0; i < n; i++) { sphere(i, n, off); D.y = Math.abs(D.y) * .55 + .35; const l = Math.hypot(D.x, D.y, D.z); D.x /= l; D.y /= l; D.z /= l; dirs.push(D.x, D.y, D.z);
        for (let j = 0; j < nn(16); j++) { star(R * 1.05 * (.7 + j / nn(16) * .4), col(c, .35), (.13 + rnd() * .07) * u, 0, 2.1, 1.9, .95 * u, -.8); } }
      wait(.9, () => { hook(o, "fx-crackle"); AT = at; for (let i = 0; i < n; i++) { D.x = dirs[i * 3]; D.y = dirs[i * 3 + 1]; D.z = dirs[i * 3 + 2]; fly(R * 1.05, 1.9, .95 * u, .9);
        for (let j = 0; j < nn(14); j++) main.emit(FP.x, FP.y, FP.z, FP.vx * .3 + (rnd() - .5) * .6 * u, FP.vy * .3 + (rnd() - .5) * .6 * u, FP.vz * .3 + (rnd() - .5) * .6 * u, T + rnd() * .3, 1.4, (.05 + rnd() * .04) * u, 4, rnd() < .5 ? 1 : .95, rnd() < .5 ? .78 : .95, rnd() < .5 ? .36 : .8, 2.2, .5 * u); } }); }
    if (o.rain) wait(.45, () => rain(at, nn(40)));
  }

  function rocket(o) {
    const c = rgb(o.colour ?? 0xff4b4b), from = v3(o.from), to = v3(o.to);
    if (reduced) return new Promise(res => wait(.4, res));  // reduced motion: no flight, the burst alone shows
    const mesh = o.mesh ?? makeRocket(o.colour ?? 0xff4b4b), dist = from.distanceTo(to);
    const r = { mesh, c, from, to, o, t: 0, ign: .55, T: 1.15 + dist * .07, puffs: 0, acc: 0, last: from.clone(), slot: null, d0: new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion), side: new THREE.Vector3(rnd() - .5, 0, rnd() - .5).normalize(), p: new THREE.Vector3(), q: new THREE.Vector3(), dir: new THREE.Vector3(), smk: 0 };
    mesh.position.copy(from); root.add(mesh); rockets.push(r); hook(o, "fx-hiss"); rattle = 1; r.slot = grab(); r.slot.own = r; r.slot.t0 = T; r.slot.dur = 9; return new Promise(res => { r.res = res; });  // the slot's light warms the frame and the ground from ignition on
  }
  const UP = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), E = (x, y, z, vx, vy, vz, life, size, kind, r, g, b, drag, grav, tr) => main.emit(x, y, z, vx, vy, vz, T, life, size, kind, r, g, b, drag, grav, tr);
  function stepRocket(r, dt) {  // -> true when it has burst
    r.t += dt; const { mesh, from, to, o } = r, dist = from.distanceTo(to), tail = mesh.position;
    if (r.t < r.ign) {  // ignition: it rattles on the frame, a flame fans from the tail, smoke rolls out
      const j = .014 * Math.sin(r.t * 90); mesh.position.set(from.x + j, from.y, from.z); mesh.userData.ribbon(T, .02);
      r.acc += dt * 130 * Q;
      for (; r.acc >= 1; r.acc--) { P.set(rnd() - .5, -(1.4 + rnd()), rnd() - .5).multiplyScalar(2.4 * u); E(tail.x, tail.y, tail.z, P.x, P.y, P.z, .4 + rnd() * .5, (.1 + rnd() * .1) * u, 0, 1, .6 + rnd() * .3, .22, 2.2, 2.6 * u, .1); }
      if (r.t - dt < .001) { E(tail.x, tail.y - .1 * u, tail.z, 0, 0, 0, .9, 1.5, 3, 1, .55, .22, 0, 0, 0); shake(2); }
      if (r.puffs < 5 && r.t > r.puffs * .1) { r.puffs++; puff(tail, .35, 1.3); puff(tail, .25, 1.1); }
      return false; }
    if (r.t - dt < r.ign) { hook(o, "fx-whoosh"); r.last.copy(tail); shake(2.5); }
    const uu = (r.t - r.ign) / r.T; if (uu >= 1) return true;
    const s = Math.pow(uu, 2.3);  // slow start, then fast, on a slight arc with a small wobble
    const at = (k, out) => out.lerpVectors(from, to, k).addScaledVector(r.side, Math.sin(Math.PI * k) * .07 * dist + Math.sin(k * 38) * .012 * dist * k);
    at(s, mesh.position); at(Math.min(1, s + .012), r.q); r.dir.subVectors(r.q, mesh.position).normalize();
    const blend = Math.min(1, uu * 5); r.dir.lerp(r.d0, 1 - blend).normalize(); mesh.quaternion.setFromUnitVectors(UP, r.dir); mesh.userData.ribbon(T, .09);
    // the plume, by distance so it has no gaps: a white-yellow core that streaks, an orange spray, falling gold sparks, a smoke column that lingers
    const step = phone ? .13 : .06, moved = tail.distanceTo(r.last), n = Math.min(14, Math.floor(moved / step)), sp = moved / Math.max(dt, 1e-3), d = r.dir;
    for (let i = 1; i <= n; i++) { P.lerpVectors(r.last, tail, i / n);
      E(P.x, P.y, P.z, d.x * sp * .5, d.y * sp * .5, d.z * sp * .5, .32, .6 * u, 0, 1, .95, .7, 4, 0, .6);
      E(P.x, P.y, P.z, (rnd() - .5) * 2.4 * u - d.x * 3 * u, (rnd() - .5) * 2.4 * u - d.y * 3 * u, (rnd() - .5) * 2.4 * u - d.z * 3 * u, .6 + rnd() * .5, .24 * u, 0, 1, .6, .22, 2, 2.2 * u, .14);  // the orange fan, falling behind
      if (i % 2) E(P.x, P.y, P.z, (rnd() - .5) * 1.2 * u - d.x * .8 * u, (rnd() - .5) * .9 * u - d.y * .8 * u, (rnd() - .5) * 1.2 * u - d.z * .8 * u, .8 + rnd() * .7, (.1 + rnd() * .06) * u, rnd() < .2 ? 2 : 0, GOLD[0], GOLD[1], GOLD[2], 1.4, 2.4 * u, .06);
      r.smk += moved / n; if (r.smk > (phone ? .4 : .2) * u) { r.smk = 0; puff(P, .12); } }
    if (n) r.last.copy(tail);
    // the flame: a white-yellow cone about one rocket-length (1.6) long with an orange edge, re-drawn every frame so it flickers
    for (let k = 0, nF = phone ? 6 : 10, L = 1.6 * u * (.85 + rnd() * .3); k < nF; k++) { const f = Math.pow(rnd(), 1.2), j = .12 * u * (1 - f * .6), x = tail.x - d.x * f * L + (rnd() - .5) * j, y = tail.y - d.y * f * L + (rnd() - .5) * j, z = tail.z - d.z * f * L + (rnd() - .5) * j;
      E(x, y, z, 0, 0, 0, .12, (.26 - .2 * f) * u * (.8 + rnd() * .4), 3, .7, .5 - .25 * f, .2 - .18 * f, 0, 0, 0); if (f < .3) E(x, y, z, 0, 0, 0, .12, .2 * u, 0, 1, .97, .8, 0, 0, 0); }
    return false;
  }
  function endRocket(r) {
    root.remove(r.mesh); if (!r.o.mesh) r.mesh.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); });
    if (r.slot?.own === r) { r.slot.own = null; r.slot.l.intensity = 0; } r.res();
  }

  // The finale: the given rockets in a staggered fan, then more shells chained so bursts overlap across the whole sky, then a gold glitter rain over the frame.
  function finale(list) {
    let xs = 1e9, xe = -1e9, ym = -1e9, yl = 1e9, z = 0; const types = ["peony", "willow", "chrysanthemum", "ring", "crackle"], extra = phone ? 8 : 9, dense = phone ? 1.5 : 1.1;
    list.forEach(i => { const p = v3(i.to); xs = Math.min(xs, p.x); xe = Math.max(xe, p.x); ym = Math.max(ym, p.y); yl = Math.min(yl, p.y); z = p.z; });
    return new Promise(done => { let left = list.length + extra; const fin = () => { if (--left) return; wait(.7, () => {
        const ticks = phone ? 22 : 30; for (let t = 0; t < ticks; t++) wait(t * .11, () => { for (let g = 0; g < Math.round(24 * Q) + 2; g++) { const x = xs - 3.4 * u + rnd() * (xe - xs + 6.8 * u);
          main.emit(x, ym + 3 * u - rnd() * 5 * u, z + (rnd() - .5) * 2 * u, (rnd() - .5) * .3 * u, -.3 * u, 0, T, 2.4 + rnd() * 1.2, (.05 + rnd() * .04) * u, 4, GOLD[0], GOLD[1], GOLD[2], .5, .5 * u); } });
        wait(ticks * .11 + 1.8, done); }); };
      list.forEach((i, k) => wait(k * .35, () => rocket(i).then(() => { burst({ ...i, at: i.to, type: i.type ?? types[k % 5], rain: true, dense }); fin(); })));
      for (let e = 0; e < extra; e++) wait(1.9 + e * .46, () => { const b = list[e % list.length], to = new THREE.Vector3(xs - 1.6 * u + rnd() * (xe - xs + 3.2 * u), yl - .8 * u + rnd() * (ym - yl + 2.4 * u), z + rnd() * 1.4 * u);
        rocket({ from: v3(b.from), to, colour: b.colour, sound: b.sound }).then(() => { burst({ at: to, colour: list[(e + 2) % list.length].colour, type: types[(e + 3) % 5], sound: b.sound, dense }); fin(); }); }); });
  }

  function update(dt) {
    dt = Math.min(dt, .1); T += dt; U.uTime.value = T; renderer.getDrawingBufferSize(size2); U.uH.value = size2.y;
    light.k *= Math.exp(-dt * 3.2); U.uLit.value.set(light.c.r * light.k, light.c.g * light.k, light.c.b * light.k);
    kick.amp *= Math.exp(-dt * 9); kick.x = (rnd() - .5) * 2 * kick.amp; kick.y = (rnd() - .5) * 2 * kick.amp; rattle *= Math.exp(-dt * 4);
    for (let i = later.length - 1; i >= 0; i--) if (later[i].t <= T) { const f = later[i].f; later.splice(i, 1); f(); }  // may add more: they run next frame
    for (let i = rockets.length - 1; i >= 0; i--) if (stepRocket(rockets[i], dt)) { const r = rockets.splice(i, 1)[0]; endRocket(r); }
    for (const s of slots) { if (s.own && s.own !== "pulse") { s.l.position.copy(s.own.mesh.position); s.l.color.setRGB(1, .68, .35); s.l.intensity = (phone ? 8 : 12) * u * u * (.75 + rnd() * .5); }
      else if (s.own === "pulse") { const k = 1 - (T - s.t0) / s.dur; s.l.intensity = k > 0 ? s.peak * u * u * k * k : (s.own = null, 0); } }
    main.flush(); smoke.flush();
    if (debug) stats.peakLive = Math.max(stats.peakLive, main.live(T));
  }
  function dispose() { scene.remove(root); for (const r of rockets) endRocket(r); main.mesh.geometry.dispose(); smoke.mesh.geometry.dispose(); main.mesh.material.dispose(); smoke.mesh.material.dispose(); main.mirror?.material.dispose(); slots.forEach(s => s.l.dispose()); }
    return { flying: rockets, pools: { main, smoke }, rocket, burst, finale, update, dispose, stats, light, kick, prop: makeRocket, caps: { main: main.n, smoke: smoke.n }, get time() { return T; }, get rattle() { return rattle; } };
}
