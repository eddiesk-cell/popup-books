// lab.js: action slices on an open pop-up book (Sun Wukong against the Ox King), drawn frame by frame from one clock.
// window.lab.renderAt(t) poses everything for second t of the slice and draws it: nothing reads the wall clock, so a recorder can step it.
// ?slice=hit|wall|clash|split|ref|probe  &w=1920&h=1080
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { loadOpenBook } from "../../shelf/bookmodel.js";
import { SLICES } from "./slices.js";
import { Ink } from "./ink.js";
import { Fx } from "./fx3d.js";
import { rig, tail, staff as makeStaff, oxProps, timeline, Spring, footLock, capsules, segDist, airFeet } from "./motion.js";

const q = new URLSearchParams(location.search), W = +q.get("w") || 1920, H = +q.get("h") || 1080, SLICE = q.get("slice") || "hit";
const B = ([x, y, z]) => new THREE.Vector3(x, z, -y);  // Blender (z up) -> three (y up), as live.js
const gl = document.getElementById("gl"), film = document.getElementById("film");
gl.width = film.width = W; gl.height = film.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: gl, alpha: true, preserveDrawingBuffer: true, antialias: false });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.6; renderer.outputColorSpace = THREE.SRGBColorSpace;  // the viewer's look (live.js)
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 40);
const sky = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,  // a painted evening sky round the book (the room stays out: cameraman rule 7)
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `varying vec3 vP; void main(){ float h = vP.y, a = atan(vP.z, vP.x); float c = smoothstep(0.0, 0.5, h);
    vec3 col = mix(vec3(0.95, 0.62, 0.32), vec3(0.18, 0.28, 0.55), c); col = mix(col, vec3(0.06, 0.08, 0.2), smoothstep(0.5, 1.0, h));
    float cl = smoothstep(0.55, 0.8, 0.5 + 0.25 * sin(a * 7.0 + h * 9.0) + 0.25 * sin(a * 13.0 - h * 21.0)) * smoothstep(0.02, 0.15, h) * (1.0 - smoothstep(0.3, 0.6, h));
    gl_FragColor = vec4(mix(col, vec3(1.0, 0.86, 0.66), cl * 0.5) * 0.9, 1.0); }` }));
scene.add(sky);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, cam)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.4, 1.2)); composer.addPass(new OutputPass());
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glb = u => loader.loadAsync(u);

// ---------- the place: Cowherd spread 2 (the weaving hall in the sky), opened, on the open leather book, on the walnut desk ----------
const SP = "../cowherd-s02/", m = await fetch(SP + "spread.json").then(r => r.json()), g = await glb(SP + "spread.glb");
const place = g.scene, mixer = new THREE.AnimationMixer(place);
g.animations.forEach(c => mixer.clipAction(c).play()); mixer.setTime((m.frames.loop[0] - 1) / m.fps); scene.add(place); place.updateMatrixWorld(true);
const HIDE = ["great-loom", "silk-streams", "bench", "urn-blue", "cloud-front"];  // the weaving-hall props that stand in the arena, and the front cloud cards that hide the fighters from a low camera
place.traverse(o => { if (o.isMesh && HIDE.some(h => o.name.startsWith(h))) o.visible = false; });
place.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
const leaf = place.getObjectByName("leaf-page") || place.getObjectByName("leaf"), flat = new THREE.Box3().setFromObject(leaf), pageW = -flat.min.x;
const book = (await loadOpenBook(THREE, loader, "kapi", "../../shelf/")).group;
book.scale.setScalar(pageW); book.position.y = flat.min.y; scene.add(book); book.updateMatrixWorld(true);
const desk = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.07, 0.033, 0.015), roughness: 0.6 }));
desk.position.y = new THREE.Box3().setFromObject(book).min.y - 0.002; desk.receiveShadow = true; scene.add(desk);
// the painted backdrop continued past its edges: each sky card turned 180 degrees about its own outer and top edges (the painting mirrored, in its
// own leaning plane), so a camera that rises with a leap or swings wide sees more of the painting, never the card's edge or the room behind it
const ext = new THREE.Group(); scene.add(ext);
place.traverse(o => {
  if (!o.isMesh || !/^sky-hall/.test(o.name)) return;
  o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox, sz = bb.getSize(new THREE.Vector3()), thin = ["x", "y", "z"].reduce((a, b) => (sz[b] < sz[a] ? b : a));
  const [u, w] = ["x", "y", "z"].filter(k => k !== thin), mid = (bb.min[thin] + bb.max[thin]) / 2;
  const corner = (cu, cw) => { const v = new THREE.Vector3(); v[thin] = mid; v[u] = cu; v[w] = cw; return v.applyMatrix4(o.matrixWorld); };
  const C = [corner(bb.min[u], bb.min[w]), corner(bb.max[u], bb.min[w]), corner(bb.min[u], bb.max[w]), corner(bb.max[u], bb.max[w])];
  const edges = [[0, 1], [2, 3], [0, 2], [1, 3]].map(([i, j]) => [C[i], C[j]]);
  const side = edges.filter(([p, q]) => Math.abs(p.x - q.x) < Math.abs(p.y - q.y)).reduce((a, b) => (Math.abs(b[0].x) > Math.abs(a[0].x) ? b : a));  // the outer upright edge
  const top = edges.filter(([p, q]) => Math.abs(p.x - q.x) > Math.abs(p.y - q.y)).reduce((a, b) => (b[0].y > a[0].y ? b : a));  // the top edge
  const ctr = C.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(0.25), inset = ([p, q]) => [p, q].map(v => v.clone().lerp(ctr, 0.006));  // a hair inside the edge: the copies overlap, no seam of sky
  const flip = e => { const [p, q] = inset(e); return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationAxis(q.clone().sub(p).normalize(), Math.PI)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z)); };
  const mat = o.material.clone(); mat.side = THREE.DoubleSide;
  const sg = Math.sign(side[0].x), fold = ([p, q]) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationAxis(q.clone().sub(p).normalize(), sg * Math.PI / 2 * Math.sign(q.y - p.y))).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  const wing = fold(side), wingTop = top.map(v => v.clone().applyMatrix4(wing));  // a wing: the card turned 90 degrees forward about its outer edge, like a stage flat
  for (const M of [flip(side), flip(top), flip(top).multiply(flip(side)), wing, flip(wingTop).multiply(wing)]) {
    const c = new THREE.Mesh(o.geometry, mat); c.matrixAutoUpdate = false; c.matrix.copy(M.multiply(o.matrixWorld)); c.name = "ext-" + o.name; ext.add(c);
  }
});
ext.updateMatrixWorld(true);
const key = m.stage.lights.reduce((a, b) => (b.watts > a.watts ? b : a));
for (const l of m.stage.lights) {  // the spread's own light plot, as live.js sets it
  const d = new THREE.DirectionalLight(new THREE.Color(...l.color), l.watts / 75); d.position.copy(B(l.at)); d.target.position.copy(B(l.look || [0, 0.1, 0.2])); scene.add(d, d.target);
  if (l === key) { d.castShadow = true; d.shadow.mapSize.setScalar(2048); d.shadow.radius = 4; d.shadow.bias = -0.0001; d.shadow.normalBias = 0.01; Object.assign(d.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.1, far: 10 }); }
}

// ---------- the cast: Kapi as Sun Wukong (the book's Kapi, his fight clips made with Kimodo), a stock man re-dressed as the Ox King ----------
const LOOP = new Set(["Walk", "Run", "Idle", "guard", "bull_guard", "dizzy2"]);  // cycles wrap; one-shots hold their last pose
const noScale = c => { c.tracks = c.tracks.filter(t => !t.name.endsWith(".scale")); return c; };  // bone scale is ours (the Ox King's bulk); clips only turn and move
async function actor(url, height, extraClips) {
  const a = await glb(url), model = a.scene, body = new THREE.Group(), pivot = new THREE.Group();
  model.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
  pivot.add(model); body.add(pivot); scene.add(body); body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), s = height / size.y;
  pivot.scale.setScalar(s); pivot.position.set(-box.getCenter(new THREE.Vector3()).x * s, -box.min.y * s, -box.getCenter(new THREE.Vector3()).z * s);
  const clips = Object.fromEntries([...a.animations, ...(extraClips ?? [])].map(c => [c.name, noScale(c)])), mix = new THREE.AnimationMixer(model), act = {};
  for (const [n, c] of Object.entries(clips)) { act[n] = mix.clipAction(c); act[n].play(); act[n].weight = 0; }
  return { body, model, mix, act, clips, h: height, bone: n => model.getObjectByName(n), loop: LOOP };
}
const [kf, of] = await Promise.all([glb("kapi-fight.glb"), glb("ox-fight.glb")]);
const kapi = rig(await actor("../chars/kapi.glb", 0.2, kf.animations));
const ox = rig(await actor("ox-king-man.glb", 0.25, of.animations));  // a head and a quarter taller than Wukong: his brow stays inside the staff's reach
const kTail = tail(THREE, kapi), oxp = oxProps(ox);
kapi.caps = capsules(kapi, kTail.caps); ox.caps = capsules(ox); kapi.holdsStaff = "right";
kapi.legCaps = () => kapi.caps().filter(c => /UpperLeg|LowerLeg|Foot|^hips/.test(c.n));
const staff = makeStaff(scene, kapi, { L: 0.34 });
staff.obstacles = () => [...kapi.caps().filter(c => !/^right(UpperArm|LowerArm|Hand)$|^left(LowerArm|Hand)$/.test(c.n)), ...ox.caps()];  // all but the arm that holds it and the other hand (it holds the staff, or rests by it)
for (const a of [kapi, ox]) { airFeet(a, flat.max.y); footLock(a, flat.max.y); }
kapi.springs.push(kapi.springs.shift());  // the tail last: it keeps out of the legs as the feet left them
kapi.grip = { right: 1 };  // the right fist always round the staff (the staff closes the left as it takes it)
const fx = new Fx(THREE, scene), ink = new Ink(film, W, H);
if (SLICE !== "ref") fx.aura(ox.body, -1.5, 9.5, { box: [0.2, 0.32, 0.16] });  // from before the first frame (already swirling) to past the longest slice; the reference copy has none
// does this camera see past the set? rays through a 9x5 grid of the frame must land on the open pages (inside their edges) or on the painted
// backdrop (with its continuation); a ray that does neither sees the book's edge, the desk or the empty sky dome. Counts by frame edge for the fit.
const backs = [], rc = new THREE.Raycaster(), nd = new THREE.Vector2(), pageY = flat.max.y;
place.traverse(o => o.isMesh && /^sky-hall/.test(o.name) && backs.push(o)); ext.traverse(o => o.isMesh && backs.push(o));
function roomRays(c = cam) {
  const r = { bad: 0, bottom: 0, top: 0, side: 0 };
  for (let gx = 0; gx <= 8; gx++) for (let gy = 0; gy <= 4; gy++) {
    nd.set(gx / 4 - 1, gy / 2 - 1); rc.setFromCamera(nd, c); const o = rc.ray.origin, d = rc.ray.direction;
    if (rc.intersectObjects(backs, false).length) continue;
    if (d.y < -1e-6) { const k = (pageY - o.y) / d.y, x = o.x + d.x * k, z = o.z + d.z * k; if (Math.abs(x) < 0.985 && Math.abs(z) < 0.655) continue; }
    r.bad++; if (gy === 0) r.bottom++; else if (gy === 4) r.top++; else r.side++;
  }
  return r;
}
// a ghost: whatever pose(fn) leaves the fighter (or only its staff) in, drawn as a flat pale-gold silhouette over the film (an after-image,
// a multiple, a smear copy). The posing is the caller's, done quietly; nothing is allocated per ghost.
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xf5e9cc }), ghostVis = [];  // paper, a trace of where he was
function ghost(parts, alpha) {
  ghostVis.length = 0; for (const o of scene.children) { ghostVis.push(o.visible); o.visible = parts.includes(o); }
  const bg = scene.background, auto = renderer.shadowMap.autoUpdate; scene.background = null; scene.overrideMaterial = ghostMat; renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, cam); ink.trace(gl, alpha);
  scene.overrideMaterial = null; scene.background = bg; renderer.shadowMap.autoUpdate = auto; scene.children.forEach((o, i) => (o.visible = ghostVis[i]));
}
const ctx = { gl, THREE, scene, cam, roomRays, book, desk, ext, segDist, ghost, place, kapi, ox, staff, oxp, fx, ink, B, W, H, pageW, flat, timeline, Spring, y0: flat.max.y, render: () => { composer.render(); ink.frame(gl); }, renderOnly: () => composer.render() };
const slice = SLICE === "sheet" ? { dur: 0, at() {} } : SLICES[SLICE](ctx), FZ = slice.freezes ?? [];  // freezes: [{ t (slice time), len, at() -> screen point, ang }]
const v = new THREE.Vector3();
ctx.project = p => (v.copy(p).project(cam), [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]);

window.lab = {
  ready: true, slice: SLICE, dur: slice.dur + FZ.reduce((a, f) => a + f.len, 0), cues: (slice.cues ?? []).map(([n, t, g]) => [n, t + FZ.filter(f => f.t <= t).reduce((a, f) => a + f.len, 0), g]),
  flashes: slice.flashes ?? [], info: { ...(slice.info ?? {}), freezes: FZ.map(f => [f.t, f.len]), shots: slice.shots ?? [] }, ctx,
  renderAt(T) {  // T: the film's time; a freeze frame holds the slice at its moment while the push-in, speed lines and paper tint go on
    const t0 = performance.now(); let t = T, fz = null;
    for (const f of FZ) { if (t < f.t) break; if (t < f.t + f.len) { fz = { f, k: (t - f.t) / f.len }; t = f.t; break; } t -= f.len; }
    ctx.freeze = fz; slice.at(t, ctx.render);
    if (fz) {
      const P = fz.f.at(), e = Math.min(1, fz.k * fz.f.len / (5 / 60), (1 - fz.k) * fz.f.len / (5 / 60));  // the tint eases in and out over 5 frames (no flash)
      ink.paper(0.3 * e); ink.speed(fz.f.ang, T, 0.75 * e, { seed: 7, cx: P[0], cy: P[1] }); ink.focus(P[0], P[1], 300 + Math.floor(T * 3), 0.8 * e, 260);
    }
    ctx.freeze = null; return performance.now() - t0;
  },
  trace(fps = 60) {  // per frame, posed without drawing: the staff's turn (degrees; a jump reads as a floating staff) and each fighter's planted-foot slide
    const out = { staff: [], slide: { kapi: [], ox: [] } }, prev = new THREE.Vector3(), last = { kapi: {}, ox: {} }, v = new THREE.Vector3(); let p = null;
    for (let i = 0; i * (1 / fps) < slice.dur; i++) {
      slice.at(i / fps, () => {}); const d = staff.dir(); out.staff.push(p ? +(d.angleTo(prev) * 180 / Math.PI).toFixed(1) : 0); prev.copy(d); p = 1;
      for (const [n, a] of [["kapi", kapi], ["ox", ox]]) for (const f of ["leftFoot", "rightFoot"]) {  // a foot within 1.5% of its height of the page is planted: how far it moved since the last frame, in % of the height
        a.bone(f).getWorldPosition(v); const L = last[n][f], down = v.y - ctx.y0 < 0.06 * a.h;
        if (down && L?.down) out.slide[n].push([+(i / fps).toFixed(2), f[0], +(Math.hypot(v.x - L.x, v.z - L.z) / a.h * 100).toFixed(2)]);
        last[n][f] = { x: v.x, z: v.z, down };
      }
    }
    return out;
  },
  // the leak measure, every frame (posed without drawing): how deep anything is inside anything else, in % of the height of what it went into, and
  // whether the frame shows the set's edge or the room (rays through a 9x5 grid of the frame that miss the painted set, or hit the book's edges or the desk)
  leaks(fps = 60) {
    const worst = {}, rows = [], grip = { held: 0, two: 0 }, feet = { kapi: { airMin: 90, landMax: 0, air: 0, land: 0 }, ox: { airMin: 90, landMax: 0, air: 0, land: 0 } }, was = { kapi: -1, ox: -1 };
    const put = (k, d, t, h, what) => { const v = d / h * 100; if (!worst[k] || v > worst[k][0]) worst[k] = [+v.toFixed(2), +t.toFixed(3), what]; return v; };
    const pair = (A, B, skip = () => false) => { let w = [0, ""]; for (const a of A) for (const b of B) { if (skip(a, b)) continue; const d = a.r + b.r - segDist(a.a, a.b, b.a, b.b); if (d > w[0]) w = [d, a.n + "/" + b.n]; } return w; };
    for (let i = 0; i * (1 / fps) < slice.dur; i++) {
      const t = i / fps; slice.at(t, () => {});
      const K = kapi.caps(), O = ox.caps(), st = [{ n: "staff", a: staff.tip(-1), b: staff.tip(1), r: 0.004 }];
      const kS = pair(st, K.filter(c => !/^right(UpperArm|LowerArm|Hand)$|^left(LowerArm|Hand)$/.test(c.n)));  // his body and head (his hands hold it)
      const row = { t: +t.toFixed(3),
        staffKapi: put("staff in Wukong", kS[0], t, kapi.h, kS[1]),
        staffOx: put("staff in the Ox King", ...((w) => [w[0], t, ox.h, w[1]])(pair(st, O))),
        bodies: put("Wukong and the Ox King", ...((w) => [w[0], t, kapi.h, w[1]])(pair(K, O))),
        tail: put("tail in Wukong's legs", ...((w) => [w[0], t, kapi.h, w[1]])(pair(K.filter(c => /^tail/.test(c.n)), K.filter(c => /UpperLeg|LowerLeg|Foot/.test(c.n))))),
        selfK: put("Wukong's arms in his body", ...((w) => [w[0], t, kapi.h, w[1]])(pair(K.filter(c => /LowerArm|Hand/.test(c.n)), K.filter(c => /^(spine|chest|upperChest|head)$/.test(c.n))))),
        selfO: put("the Ox King's arms in his body", ...((w) => [w[0], t, ox.h, w[1]])(pair(O.filter(c => /LowerArm|Hand/.test(c.n)), O.filter(c => /^(spine|chest|upperChest|head)$/.test(c.n))))),
      };
      if (kapi.body.visible) {  // the grip: each gripping palm's distance from the staff's axis (the right always; the left when both hands hold it)
        const ax = new THREE.Line3(staff.tip(-1), staff.tip(1)), off = side => { const p = palm(side); return ax.closestPointToPoint(p, false, new THREE.Vector3()).distanceTo(p); };
        row.gripR = put("right palm off the staff", off("right"), t, kapi.h, ""); grip.held++;
        if (staff.two >= 0.99) { row.gripL = put("left palm off the staff", off("left"), t, kapi.h, ""); grip.two++; }
      }
      for (const w of slice.walls ?? []) { const a = w.who === "ox" ? ox : kapi; let d = 0; for (const q of a.caps()) for (const e of [q.a, q.b]) d = Math.max(d, q.r - e.clone().sub(w.P0).dot(w.n)); row.wall = put(w.name, Math.max(0, d), t, a.h, ""); }
      const rc = oxp.ring.children[0].getWorldPosition(new THREE.Vector3()), hd = O.find(c => c.n === "head"), ringR = oxp.hh * 0.11 * ox.body.scale.x;
      row.ring = put("the ring in the Ox King's face", Math.max(0, hd.r + ringR * 0.2 - new THREE.Line3(hd.a, hd.b).closestPointToPoint(rc, true, new THREE.Vector3()).distanceTo(rc)), t, ox.h, "ring");
      const out = roomRays(cam).bad;  // the frame's own camera, as the slice left it
      row.room = out; if (out) (worst.room ??= []).push(+t.toFixed(3));
      for (const [n, a] of [["kapi", kapi], ["ox", ox]]) for (const side of ["left", "right"]) {  // airborne: toes down at least 25 degrees; landing (the 0.15 s after): flat within 5
        const t0 = a.bone(side + "Toes").getWorldPosition(new THREE.Vector3()).sub(a.bone(side + "Foot").getWorldPosition(new THREE.Vector3())), pitch = Math.atan2(-t0.y, Math.hypot(t0.x, t0.z)) * 180 / Math.PI, F = feet[n];
        if (a.air > 0.99) { F.air++; if (pitch - a.flat * 180 / Math.PI < F.airMin) F.airMin = +(pitch - a.flat * 180 / Math.PI).toFixed(1); was[n] = t; }
        else if (a.air < 0.05 && was[n] >= 0 && t - was[n] < 0.5 && a.down?.[side]) { F.land++; const dv = Math.abs(pitch - a.flat * 180 / Math.PI); if (dv > F.landMax) { F.landMax = +dv.toFixed(1); F.landAt = +t.toFixed(3); } }
      }
      rows.push(row);
    }
    return { worst, feet, grip, gripOver: rows.filter(r => r.gripR >= 1.5 || r.gripL >= 1.5).map(r => r.t), frames: rows.length, roomFrames: worst.room?.length ?? 0, over1: Object.fromEntries(["staffKapi", "staffOx", "bodies", "tail", "selfK", "selfO", "ring", "wall"].map(k => [k, rows.filter(r => r[k] >= 1).map(r => r.t)])) };
  },
  // the impacts: each effect's centre against the contact measured again on the drawn pose (stepped frame by frame from the start, so the springs
  // are where they were), in % of the struck one's height, with both points on screen for the strip
  impacts(fps = 60) {
    const pj = p => { const v = p.clone().project(cam); return [+((v.x + 1) / 2 * W).toFixed(1), +((1 - v.y) / 2 * H).toFixed(1)]; }, out = [];
    for (const im of slice.impacts ?? []) {
      for (let i = 0; i / fps < im.t - 1e-6; i++) slice.at(i / fps, () => {});
      slice.at(im.t, () => {}); const m = im.measure();
      out.push({ name: im.name, t: +im.t.toFixed(3), film: +filmOf(im.t).toFixed(3), cm: +(m.p.distanceTo(im.fx) / im.h * 100).toFixed(3), on: m.on, gap: +(m.gap / im.h * 100).toFixed(2), contact: pj(m.p), fx: pj(im.fx) });
    }
    return out;
  },
  mark(T, pts) {  // a frame with marks on it: [x, y, "contact" | "fx"]
    this.renderAt(T); const x = film.getContext("2d"); x.save(); x.lineWidth = 5;
    for (const [px, py, k] of pts) { x.beginPath(); if (k === "contact") { x.strokeStyle = "#20e0ff"; x.arc(px, py, 22, 0, Math.PI * 2); } else { x.strokeStyle = "#ffcc00"; x.moveTo(px - 26, py); x.lineTo(px + 26, py); x.moveTo(px, py - 26); x.lineTo(px, py + 26); } x.stroke(); }
    x.restore();
  },
  // the hands: 8 frames of the strike, close on both fists and the staff, with each palm's distance from the staff's axis
  handSheet(tw = 240, th = 240) {
    const [a, b] = slice.strike, fps = 60, vis = [], res = []; ctx.noGhost = true; const ro = ctx.renderOnly; ctx.renderOnly = () => {};
    for (let i = 0; i / fps <= b; i++) { slice.at(i / fps, () => {}); if (i / fps >= a && kapi.body.visible) vis.push(i / fps); }
    const pick = Array.from({ length: 8 }, (_, k) => vis[Math.round(k * (vis.length - 1) / 7)]);
    renderer.setScissorTest(true); renderer.setClearColor(0x2b2420, 1);
    pick.forEach((t, k) => {
      for (let i = 0; i / fps < t - 1e-6; i++) slice.at(i / fps, () => {}); slice.at(t, () => {});
      const ax = new THREE.Line3(staff.tip(-1), staff.tip(1)), pr = palm("right"), pl = palm("left"), two = staff.two >= 0.99, aim = two ? pr.clone().lerp(pl, 0.5) : pr.clone(), D = 0.5;
      cam.position.set(aim.x + 0.2 * D, aim.y + 0.25 * D, aim.z + D); cam.lookAt(aim); cam.fov = 2 * Math.atan(0.075 / D) * 180 / Math.PI; cam.aspect = tw / th; cam.updateProjectionMatrix();
      renderer.setViewport(k * tw, H - th, tw, th); renderer.setScissor(k * tw, H - th, tw, th); renderer.clear(); renderer.render(scene, cam);
      const gap = p => +(ax.closestPointToPoint(p, false, new THREE.Vector3()).distanceTo(p) / kapi.h * 100).toFixed(2);
      res.push({ t: +t.toFixed(3), film: +filmOf(t).toFixed(3), right: gap(pr), left: two ? gap(pl) : null, two: +staff.two.toFixed(2) });
    });
    renderer.setScissorTest(false); ctx.noGhost = false; ctx.renderOnly = ro; const fc = film.getContext("2d"); fc.clearRect(0, 0, W, H); fc.drawImage(gl, 0, 0); return res;
  },
  // the feet in the air: 8 airborne frames of one fighter from this slice (fully airborne: a.air > 0.99), side on at his legs, with the toe pitch below
  airSheet(who, tw = 240, th = 300) {
    const a = who === "ox" ? ox : kapi, times = []; ctx.noGhost = true;  // the slice's own ghosts would draw over the tiles
    for (let i = 0; i * (1 / 60) < slice.dur; i++) { slice.at(i / 60, () => {}); if (a.air > 0.99 && a.body.visible) times.push(i / 60); }
    if (!times.length) return [];
    const pick = Array.from({ length: 8 }, (_, k) => times[Math.round(k * (times.length - 1) / 7)]), res = [];
    renderer.setScissorTest(true); renderer.setClearColor(0x2b2420, 1);
    pick.forEach((t, k) => {
      slice.at(t, () => {});
      const hp = a.bone("hips").getWorldPosition(new THREE.Vector3()), aim = hp.clone().add(new THREE.Vector3(0, -0.2 * a.h, 0)), D = a.h * 3;
      cam.position.set(aim.x + 0.15 * D, aim.y + 0.1 * D, aim.z + D); cam.lookAt(aim); cam.fov = 2 * Math.atan(a.h * 0.75 / D) * 180 / Math.PI; cam.aspect = tw / th; cam.updateProjectionMatrix();
      renderer.setViewport(k * tw, H - th, tw, th); renderer.setScissor(k * tw, H - th, tw, th); renderer.clear(); renderer.render(scene, cam);  // GL counts from the bottom: the top row
      const pitch = ["left", "right"].map(sd => { const v = a.bone(sd + "Toes").getWorldPosition(new THREE.Vector3()).sub(a.bone(sd + "Foot").getWorldPosition(new THREE.Vector3())); return +((Math.atan2(-v.y, Math.hypot(v.x, v.z)) - a.flat) * 180 / Math.PI).toFixed(1); });
      res.push({ t: +t.toFixed(3), toeDown: pitch });
    });
    renderer.setScissorTest(false); ctx.noGhost = false; const fc = film.getContext("2d"); fc.clearRect(0, 0, W, H); fc.drawImage(gl, 0, 0); return res;
  },
  probe() {
    const out = [], b = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
    place.traverse(o => { if (o.isMesh && o.visible) { b.setFromObject(o); b.getCenter(c); b.getSize(s); out.push([o.name, ...c.toArray().map(x => +x.toFixed(3)), ...s.toArray().map(x => +x.toFixed(3))]); } });
    return { pageW, flat: [flat.min.toArray(), flat.max.toArray()], meshes: out, kapiClips: Object.keys(kapi.clips), oxClips: Object.keys(ox.clips), tail: kTail.count, vbox: [kapi.caps.box, ox.caps.box].map(b => [b.min.toArray().map(x => +x.toFixed(3)), b.max.toArray().map(x => +x.toFixed(3))]), kb: [kapi, ox].map(a => { const b = new THREE.Box3().setFromObject(a.model); return [b.min.toArray().map(x => +x.toFixed(3)), b.max.toArray().map(x => +x.toFixed(3))]; }), counts: ox.caps.counts, caps: Object.fromEntries([["kapi", kapi], ["ox", ox]].map(([n, a]) => [n, a.caps().map(c => [c.n, +(c.r / a.h * 100).toFixed(1), +(c.a.distanceTo(c.b) / a.h * 100).toFixed(1)])])) };
  },
  // the clip check: 8 frames of one clip, front row over side row, on a plain floor, with the staff, fists, tail and horns as the slices show them;
  // numbers per frame: the left fist's gap from the staff when both hold it, the staff through the body (in heights)
  sheet(who, clip, tw = 200, th = 280) {
    const a = who === "ox" ? ox : kapi, other = a === ox ? kapi : ox, n = 8, d = a.clips[clip].duration, res = [];
    for (const o of [place, book, desk, sky, other.body]) o.visible = false;
    if (a === ox) staff.mesh.visible = false;
    scene.background = new THREE.Color(0x2b2420); renderer.setScissorTest(true); renderer.setClearColor(0x2b2420, 1);
    const floor = sheetFloor ??= (() => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 })); m.receiveShadow = true; scene.add(m); return m; })();
    const tl = timeline(a, [{ t: 0, clip, p: [0, 0], yaw: 0 }], null, 0); floor.position.y = 0.0005; staff.both = () => (/^staff_(overhead|thrust)$|^guard$/.test(clip) ? 1 : 0); floor.scale.setScalar(a.h * 1.4);
    Spring.off = true;
    const tp = new THREE.Vector3(), hp = new THREE.Vector3(), up = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      tl.at(k / (n - 1) * (d - 1e-3)); a.post(0);
      if (a === kapi) staff.at(0);
      a.bone("hips").getWorldPosition(hp); floor.position.x = hp.x; floor.position.z = hp.z; floor.updateMatrixWorld();
      let thru = 0;  // the staff's worst depth inside the trunk or head (a capsule from the hips to the head top, a fifth of the height thick)
      if (a === kapi) { a.bone("hips").getWorldPosition(hp); a.bone("HeadTop_End").getWorldPosition(up); const seg = new THREE.Line3(hp, up), q = new THREE.Vector3();
        for (let i = 0; i <= 20; i++) { staff.tip(1, tp).lerp(staff.tip(-1, q), i / 20); thru = Math.max(thru, 0.1 * a.h - seg.closestPointToPoint(tp, true, q).distanceTo(tp)); } }
      res.push({ t: +(k / (n - 1) * d).toFixed(2), two: +staff.two.toFixed(2), leftGap: +staff.leftGap.toFixed(3), thru: +(Math.max(0, thru) / a.h).toFixed(3) });
      for (const [row, yaw] of [[0, 0], [1, 90]]) {
        const D = a.h * 3.2, aim = new THREE.Vector3(hp.x, a.h * 0.5, hp.z);
        cam.position.set(aim.x + D * Math.sin(yaw * Math.PI / 180), aim.y + a.h * 0.25, aim.z + D * Math.cos(yaw * Math.PI / 180)); cam.lookAt(aim);
        cam.fov = 2 * Math.atan(a.h * 0.85 / D) * 180 / Math.PI; cam.aspect = tw / th; cam.updateProjectionMatrix();
        renderer.setViewport(k * tw, (1 - row) * th, tw, th); renderer.setScissor(k * tw, (1 - row) * th, tw, th); renderer.render(scene, cam);
      }
    }
    Spring.off = false; renderer.setScissorTest(false);
    film.getContext("2d").drawImage(gl, 0, 0); return res;
  },
};
let sheetFloor;
function palm(side) { return kapi.bone(side + "Hand").getWorldPosition(new THREE.Vector3()).add(kapi.bone(side + "MiddleProximal").getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5); }  // the palm's centre: the wrist and the middle knuckle (as the staff grips it)
function filmOf(t) { return t + FZ.filter(f => f.t < t - 1e-9).reduce((a, f) => a + f.len, 0); }  // a slice moment's film time (freezes before it pushed it on)
