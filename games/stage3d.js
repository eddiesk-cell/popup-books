// stage3d.js: the 3D room the games share. You stand in it and look around: drag or swipe turns all the way round, wheel or pinch zooms, the arrow keys turn, a tap picks.
// The room itself (walls, fire, moonlight, carvings, ivy) is dress.js building rooms.js, a copy of its Blender reference (renders/review/games-rich);
// this file is the view, the controls, the tweens, the host and the frame loop, which allocates nothing. Only a host's model and the room's lightmap are files.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
import { dress } from "./dress.js";
export { THREE };
const Q = new URLSearchParams(location.search);
export const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || Q.has("calm"), fast = Q.has("fast");
export const wait = ms => new Promise(r => setTimeout(r, fast ? ms / 20 : ms));
const ease = u => (u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

// periodic value noise (px, py = the lattice period, so a baked tile repeats without a seam), and its three-octave sum
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const md = (a, p) => ((a % p) + p) % p;
export function noise(x, y, px = 1e6, py = 1e6) {
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, i0 = md(i, px), i1 = md(i + 1, px), j0 = md(j, py), j1 = md(j + 1, py);
  const a = hash(i0, j0), b = hash(i1, j0), c = hash(i0, j1), d = hash(i1, j1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
export const fbm = (x, y, px, py) => .5 * noise(x, y, px, py) + .3 * noise(2 * x, 2 * y, 2 * px, 2 * py) + .2 * noise(4 * x, 4 * y, 4 * px, 4 * py);
// a DataTexture from f(x, y) -> [r, g, b] (0..1), mipmapped and repeating
export function bake(size, f, srgb = true) {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const c = f(x, y), k = (y * size + x) * 4; d[k] = c[0] * 255; d[k + 1] = c[1] * 255; d[k + 2] = c[2] * 255; d[k + 3] = 255; }
  const t = new THREE.DataTexture(d, size, size); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t;
}
export function createStage(canvas, { room: R, lightmap } = {}) {
  const phone = () => innerWidth < innerHeight || innerWidth <= 820, { w, d, h } = R;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone(), powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, phone() ? 1.5 : 2)); renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.52 * (R.exposure ?? 1);  // the reference's AgX at +0.6 stops
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .05, 60); scene.background = new THREE.Color(.012, .014, .03);
  // the room's bounce light and what metal reflects: a small warm panorama (dark ceiling, firelit walls with four bright torch spots, dark floor), measured from the reference; the shell ignores it
  const eq = new Float32Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) { const v = 1 - y / 31, k = (y * 64 + x) * 4, wall = Math.exp(-(((v - .5) / .22) ** 2)), spot = wall * Math.max(0, Math.cos((x / 64) * Math.PI * 8)) ** 24 * 2;
    eq.set([.01 + .06 * wall + spot, .006 + .028 * wall + spot * .55, .004 + .012 * wall + spot * .2, 1], k); }
  const et = new THREE.DataTexture(eq, 64, 32, THREE.RGBAFormat, THREE.FloatType); et.mapping = THREE.EquirectangularReflectionMapping; et.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(et).texture; scene.environment = env; pm.dispose(); et.dispose();
  performance.mark("room:start"); const uTime = { value: 0 }, D = dress({ renderer, scene, phone, uTime }, R, { lightmap, env }); performance.mark("room:built");  // marks: the load-time proof
  const ready = Promise.all([D.ready, renderer.compileAsync(scene, camera)]).then(() => performance.mark("room:ready"));  // shaders compile in parallel, off the first frame
  const box = (m, sx, sy, sz, x, y, z, parent = D.room) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); parent.add(b); return b; };

  // ---- dust in the lamplight: points drifting in the vertex shader from fixed per-point numbers and one time value
  const N = phone() ? 200 : 400, dp = new Float32Array(N * 3), ds = new Float32Array(N);
  for (let i = 0; i < N; i++) { dp[i * 3] = (hash(i, 7) - .5) * w * .9; dp[i * 3 + 1] = .2 + hash(i, 8) * (h - .4); dp[i * 3 + 2] = (hash(i, 9) - .5) * d * .9; ds[i] = hash(i, 10); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dp, 3)); dg.setAttribute("seed", new THREE.BufferAttribute(ds, 1));
  const uPx = { value: 1 };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: { uTime, uPx }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float seed; uniform float uTime, uPx; varying float vA;
      void main() { vec3 p = position + vec3(sin(uTime * .21 + seed * 40.), sin(uTime * .13 + seed * 70.) * .6, cos(uTime * .17 + seed * 25.)) * .35;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (2. + 3. * seed) * 3. / -mv.z; vA = .12 + .2 * sin(uTime * .7 + seed * 30.) * sin(uTime * .7 + seed * 30.); }`,
    fragmentShader: `varying float vA; void main() { float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(1., .82, .55, vA * (1. - 2. * r)); }` }));
  dust.frustumCulled = false; scene.add(dust);

  // ---- the view: where you stand, where you look (smoothed), zoom; drag / swipe / wheel / pinch / arrow keys; a short tap picks
  const view = { pos: new THREE.Vector3(0, 1.5, 2), yaw: 0, pitch: 0, ty: 0, tp: 0, fov: 60, tf: 60, base: 60, maxP: .55 };
  const st = { lock: false, onPick: null, pickables: [], onFrame: null };
  const ptr = new Map(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null, pinch = 0;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); down = ptr.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } : null; pinch = 0; });
  canvas.addEventListener("pointermove", e => { const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    if (ptr.size === 2) { const [a, b] = [...ptr.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoom(pinch / dd); pinch = dd; return; }
    if (down) down.moved += Math.abs(dx) + Math.abs(dy); if (st.lock) return; const k = view.fov / 60 * .0055; view.ty += dx * k; view.tp = THREE.MathUtils.clamp(view.tp + dy * k, -view.maxP, view.maxP); });
  const up = e => { ptr.delete(e.pointerId); if (!down || e.type !== "pointerup") return (down = null);
    if (down.moved < 10 && performance.now() - down.t < 700 && st.onPick) { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(st.pickables, true)[0]; if (hit) st.onPick(hit); }
    down = null; };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  const zoom = f => { view.tf = THREE.MathUtils.clamp(view.tf * f, 20, view.base * 1.15); };
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoom(Math.exp(e.deltaY * .0012)); }, { passive: false });
  addEventListener("keydown", e => { if (st.lock || e.target.closest?.("input,select,textarea")) return; const k = { ArrowLeft: .35, ArrowRight: -.35 }[e.key]; if (k) view.ty += k; if (e.key === "ArrowUp") view.tp = Math.min(view.maxP, view.tp + .2); if (e.key === "ArrowDown") view.tp = Math.max(-view.maxP, view.tp - .2); });

  // ---- tweens (reduced motion: every move is a cut) and the scripted camera
  const tweens = new Set();
  const tween = (ms, f, e = ease) => { ms = calm ? 0 : fast ? ms / 20 : ms; if (!ms) { f(1); return Promise.resolve(); } return new Promise(res => tweens.add({ t: 0, ms, f, e, res })); };
  const aim = (yaw, pitch = 0) => { view.yaw = view.ty = yaw; view.pitch = view.tp = pitch; };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // walk the camera to p (and turn to yaw, look pitch) over ms
  const walk = (p, yaw = 0, pitch = 0, ms = 1200) => { const a = view.pos.clone(), y0 = wrap(view.yaw), p0 = view.pitch, dy = wrap(yaw - y0); return tween(ms, u => { view.pos.lerpVectors(a, p, u); aim(y0 + dy * u, p0 + (pitch - p0) * u); }); };

  // ---- a host: a cast model from web/live/chars, scaled to height h, standing at `at`, facing `face`; act(name) cross-fades a clip, once-clips return to Idle.
  // statue: a host whose book is not made yet stands gilded on a plinth, still (its Idle's first frame); act() makes it glow instead
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), mixers = [];
  async function host(url, h1, at, face, statue = false) {
    const g = await loader.loadAsync(url), root = g.scene, bb = new THREE.Box3().setFromObject(root), s = h1 / (bb.max.y - bb.min.y), lift = statue ? .32 : 0;
    root.scale.setScalar(s); root.position.set(at.x, at.y + lift - bb.min.y * s, at.z); root.rotation.y = face; root.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; }); scene.add(root);
    const mixer = new THREE.AnimationMixer(root), acts = Object.fromEntries(g.animations.map(c => [c.name, mixer.clipAction(c)])); let cur = null;
    if (statue) { const gm = new THREE.MeshStandardMaterial({ color: 0xd9a448, metalness: 1, roughness: .38, emissive: 0xffb84a, emissiveIntensity: 0 }); root.traverse(o => { if (o.isMesh) o.material = gm; });
      (acts.Idle ?? Object.values(acts)[0])?.play(); mixer.update(0); const base = box(D.M("dark"), h1 * .7, lift, h1 * .7, at.x, at.y + lift / 2, at.z, scene);
      return { root, base, act: () => tween(1100, u => (gm.emissiveIntensity = .9 * Math.sin(Math.PI * u)), x => x), names: [] }; }
    mixers.push(mixer);
    const act = (name, once = false) => { const a = acts[name] ?? acts.Idle; if (!a) return; a.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.fadeIn(.3).play(); if (cur && cur !== a) cur.fadeOut(.3); cur = a; };
    mixer.addEventListener("finished", () => act("Idle")); act("Idle"); return { root, act, names: Object.keys(acts) };
  }

  // ---- size, frame loop, frame-time record (window.__frames: the last 600 frame times in ms, for the proof)
  const fit = () => { const W = innerWidth, H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; uPx.value = renderer.getPixelRatio() * H / 900; camera.updateProjectionMatrix(); st.onResize?.(); };
  addEventListener("resize", fit);
  const ft = new Float32Array(600); let fi = 0, last = performance.now(), clock = 0;
  window.__frames = () => { const a = [...ft.slice(0, Math.min(fi, 600))].filter(Boolean).sort((x, y) => x - y); return { n: a.length, avg: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2), p95: a[Math.floor(a.length * .95)], max: a[a.length - 1] }; };
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now; ft[fi++ % 600] = dt * 1000; clock += dt; uTime.value = clock;
    for (const w of tweens) { w.t += dt * 1000; const u = Math.min(1, w.t / w.ms); w.f(w.e(u)); if (u >= 1) { tweens.delete(w); w.res(); } }
    const k = 1 - Math.exp(-dt * 9); view.yaw += (view.ty - view.yaw) * k; view.pitch += (view.tp - view.pitch) * k; view.fov += (view.tf - view.fov) * k;
    camera.position.copy(view.pos); camera.rotation.set(view.pitch, view.yaw, 0, "YXZ"); if (Math.abs(camera.fov - view.fov) > .01) { camera.fov = view.fov; camera.updateProjectionMatrix(); }
    D.update(clock);
    for (const m of mixers) m.update(dt); st.onFrame?.(dt, clock); renderer.render(scene, camera);
  });
  Object.assign(st, { THREE, scene, camera, renderer, view, dressed: D, ready, box, tween, walk, aim, host, phone, fit, zoom, uTime, setFov: f => (view.fov = view.tf = view.base = f) });
  fit(); return st;
}
