// extras3d.js — a page's extra (DIRECTION.md "extras", ambient.surprises) as a 3D model instead of a paper puppet. An entry
// with "model": "assets/animals/animal-otter.glb" (loaded as live.js loads the cast: web/live/chars/<file>, else the original)
// gets back what ambient.js add() takes from a puppet ({root, pins, meshes, size, def}), so its routine, tap, cues, sounds,
// water rings and the hide game run unchanged. ambient.js sets `p.x = x` (the routine runner's record) after add().
// It drives itself from the root's own matrix, which the renderer asks for every frame: the runner sets root.position,
// root.visible and root.scale (x: a puppet's paper flip, ±1, read here as the facing; y: its pop-up growth), and the matrix
// is the position, a turn (side-on, as a puppet faces ±x, or along a walk) and the growth; the model plays the clip of the
// step the runner is on (see clipFor). Models face +z, puppets +x.
// Entry keys: model, height (else motion.json's measured height of the paper animal, else the puppet's size), rigid (a
// posed stand-in glb, tools/pose_bake.py). A phone over 8 skinned figures (BOOK-STANDARD item 20, the cast first) and an
// extra past the 12 animated get a rigid copy: posed once, no skeleton, no mixer, still moved as a whole by its routine.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), models = {}, rigids = {}, UP = new THREE.Vector3(0, 1, 0);
const PHONE = innerWidth < 600, COARSE = matchMedia("(pointer: coarse)").matches, SKINNED = 8;  // as live.js PHONE; every path below is read from the page (web/live/), as live.js and learn.js do: the bundle step allows no other import.meta use
let motion;  // motion.json, fetched with the first 3D extra, not at import
const motionJson = () => motion ??= fetch("../assets/motion.json").then(r => r.json()).catch(() => ({}));
const PROXIES = new Set();  // every live extra's tap box: a tap that meets no body is answered by a box only when no other extra's box holds it too
export const missing = new Set();  // "model move->clip": a move played with its nearest clip (for the report and tests)

// shortcut: its own cache, so a glb that is both cast and extra on one spread is parsed twice; share live.js modelOf if that shows
export const extraModel = file => models[file] ??= loader.loadAsync(`chars/${file.split("/").pop()}`)
  .catch(() => loader.loadAsync(`../${file}`))
  .then(g => (g.animations.forEach(a => { const t0 = Math.min(...a.tracks.map(k => k.times[0])); if (t0 > 0 && t0 < Infinity) { new Set(a.tracks.map(k => k.times)).forEach(t => t.forEach((v, i) => (t[i] = v - t0))); a.resetDuration(); } }), g));  // every clip starts at 0, as live.js modelOf

// the clip for a step: its own name, then the nearest; [names to try, loop?]
const GAIT = { walk: ["Walk", "Run"], crawl: ["Walk", "Run"], run: ["Run", "Walk"], hop: ["Hop", "Walk"], swim: ["Swim"], glide: ["Swim", "Fly"], fly: ["Fly"] };
const NEAR = { hover: ["Fly"], dive: ["Dive", "Fly", "Swim"], flap: ["Fly"], jump: ["Jump", "Hop"], bounce: ["Hop", "Walk"], nod: ["Talk"], step: ["Walk"], away: ["Fly", "Flap", "Run", "Walk"] };
const cap = s => s[0].toUpperCase() + s.slice(1), REST = /^(wait|rest|show|turn|bob)$/;
function clipFor(x, s, gait) {
  const g = GAIT[gait] || GAIT.walk, a = s?.a ?? "rest";
  if (a.startsWith("go")) { const hold = a.slice(3); return [hold ? [cap(hold), ...NEAR[hold] || [], ...g] : g, true]; }
  if (a === "hide") {  // under the water, up and away, or down behind (ambient begin(): where it is sent says how)
    const d = s.to ? s.to.clone().sub(s.from) : new THREE.Vector3();
    return [d.y > 0 ? NEAR.away : Math.abs(d.z) < 1e-4 ? ["Swim", "Dive", "Tuck", ...g] : g, true];
  }
  if (REST.test(a)) return [x.pose ? [cap(x.pose), "Idle"] : ["Idle"], true];
  return [[cap(a), ...NEAR[a] || []], !!x.def.cycles?.[a]];
}
const clipNamed = (clips, names) => names.map(n => clips.find(c => c.name.toLowerCase() === n.toLowerCase())).find(Boolean);

function rigidOf(file, g, pose) {  // a posed copy with no skeleton: every skinned vertex (and normal) set once where the clip's first frame puts it
  return rigids[`${file}|${pose}`] ??= (() => {
    const m = clone(g.scene), mix = new THREE.AnimationMixer(m), c = clipNamed(g.animations, [pose, "Idle"]) ?? g.animations[0];
    if (c) { mix.clipAction(c).play(); mix.update(0); }
    m.updateMatrixWorld(true);
    const skins = []; m.traverse(o => o.isSkinnedMesh && skins.push(o));
    for (const o of skins) {
      const G = o.geometry, pa = G.attributes.position, na = G.attributes.normal, P = new Float32Array(pa.count * 3), N = na && new Float32Array(pa.count * 3), v = new THREE.Vector3(), w = new THREE.Vector3(), n = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        o.applyBoneTransform(i, v.fromBufferAttribute(pa, i)).toArray(P, 3 * i);
        if (N) o.applyBoneTransform(i, w.fromBufferAttribute(pa, i).addScaledVector(n.fromBufferAttribute(na, i), 1e-3)).sub(v).normalize().toArray(N, 3 * i);  // the skinned normal: the blended bone matrix applied to it
      }
      const geo = new THREE.BufferGeometry(); geo.setIndex(G.index); geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
      if (N) geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      for (const k of ["uv", "color"]) if (G.attributes[k]) geo.setAttribute(k, G.attributes[k]);
      for (const gr of G.groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
      const r = new THREE.Mesh(geo, o.material); r.name = o.name; r.position.copy(o.position); r.quaternion.copy(o.quaternion); r.scale.copy(o.scale);
      o.parent.add(r); o.removeFromParent();
    }
    return { scene: m, animations: [] };
  })();
}

/** extra(entry, its puppet's def or undefined, {stage, cast, pups, still}) -> a puppet-shaped object, or null (it did not load:
 *  ambient.js then builds the paper puppet). cast: the spread's cast (live.js), pups: the extras added so far. */
export async function extra3d(e, puppetDef, { stage = "day", cast = [], pups = [], still = false } = {}) {
  let g, mo;
  try { [g, mo] = await Promise.all([extraModel(e.model), motionJson()]); } catch (err) { console.warn("extras3d: no model, the paper puppet stands in", e.name, e.model, err); return null; }
  const file = e.model.split("/").pop(), m = mo[file] ?? mo[file.replace(/^(animal|people|spirit)-|\.glb$/g, "")] ?? {};
  const ref = Object.values(m).find(v => v?.height), def = puppetDef || { size: 0.06, parts: ["body"], gait: e.gait || "walk" };
  const H = e.height ?? ref?.height ?? e.size ?? def.size ?? 0.06;
  const skinned = o => { let k = false; o?.traverse(c => (k ||= !!c.isSkinnedMesh)); return k; };
  const used = cast.filter(c => skinned(c.model)).length + pups.filter(x => x.p.skinned).length;
  const rigid = still || (PHONE && used >= SKINNED), pose = cap(e.pose || "idle");
  if (rigid && e.rigid) g = await extraModel(e.rigid).catch(() => g);
  const src = rigid && g.animations.length ? rigidOf(e.rigid || e.model, g, pose) : g;
  const model = clone(src.scene), pivot = new THREE.Group(), root = new THREE.Group(), shared = new Set();
  src.scene.traverse(o => o.isMesh && shared.add(o.material));  // the loaded model's own materials (shared with the next copy); any other on this copy is its own
  if (/animal/.test(e.model)) window.live?.gradeAnimal?.(model, stage);  // the paper cards' night and eve grade, as the cast's 3D animals (live.js)
  model.traverse(o => { if (o.isMesh) { o.visible = !o.name.startsWith("Icosphere"); o.castShadow = !COARSE; o.receiveShadow = true; o.frustumCulled = false; } });  // a tablet: the runner's soft contact shadow instead
  const roll = new THREE.Group(); pivot.add(model); roll.add(pivot); root.add(roll); root.updateMatrixWorld(true);  // roll: "wall" entries (a gecko on a wall) lie belly to the wall, back to the reader, head along its walk
  const box = new THREE.Box3(); model.traverse(o => o.isMesh && o.visible && box.expandByObject(o));
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3()), s0 = H / size.y;
  pivot.scale.setScalar(s0);
  pivot.position.set(-mid.x * s0, -box.min.y * s0 - (/swim|glide/.test(def.gait) && m.float ? (m.float - 0.25) * H : 0), -mid.z * s0);  // feet on its spot; a swimmer as deep as motion.json floats it (the runner sinks it 0.25 of its height)
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x * s0 * 1.2, 0.04), Math.max(H * 1.1, 0.04), Math.max(size.z * s0 * 1.2, 0.04)), new THREE.MeshBasicMaterial({ opacity: 0.99, alphaTest: 1 }));
  proxy.position.copy(pivot.position).add(mid.clone().multiplyScalar(s0)); root.add(proxy);
  PROXIES.add(proxy); proxy.userData.extraTap = true; proxy.material.side = THREE.DoubleSide; proxy.raycast = function (rc, out) {  // the box finds it, its body says how near: a frog at a heron's feet is the frog's
    const box = []; THREE.Mesh.prototype.raycast.call(this, rc, box); if (!box.length) return; box.sort((a, b) => a.distance - b.distance);
    const skin = []; model.traverse(o => o.isMesh && o.visible && !(o.material.transparent && o.material.opacity < 0.5) && (o.isSkinnedMesh && o.computeBoundingSphere(), o.raycast(rc, skin)));  // its pose now, not the first one measured
    if (skin.length) return void out.push({ ...box[0], distance: Math.min(...skin.map(h => h.distance)) });  // a tap on its body
    if (rc.params.generous && ![...PROXIES].some(q => q !== this && q.parent?.visible && (THREE.Mesh.prototype.raycast.call(q, rc, q.__t = []), q.__t.length))) out.push({ ...box[0], generous: true });  // beside it, in its generous box (only the extras' own tap handler asks: ambient.js; live.js's nearest() stops only at a body, so a box never steals a tap from Mali or a card behind it): it answers when no other extra's box holds the tap (a frog just behind a heron's box is the frog's, review 2)
  };
  // the tap target above: a little larger than the body as the cast's hit box; drawn, so live.js's nearest() stops at it as at a puppet's card (a tap never falls through to the rocks behind), and never seen: every fragment fails its alpha test

  const mix = !rigid && src.animations.length && new THREE.AnimationMixer(model), clips = src.animations, gait = def.gait || "walk";
  let yaw = (e.face || 1) * Math.PI / 2, last = performance.now() / 1000, was, hid, cur;
  const p = { root, pins: {}, meshes: [proxy], size: H, def, skinned: !!mix, model, x: null, get clip() { return cur?.getClip().name ?? null; } };  // clip: for tests
  const play = (x, s) => {  // the step's clip, cross-faded in 0.2 s
    const [names, loop] = clipFor(x, s, gait), c = (e.pose && !s?.a?.startsWith("go") ? (/^(kneel|sit)$/i.test(e.pose) ? null : clipNamed(clips, [names[0]])) ?? clipNamed(clips, [cap(e.pose)]) : null) ?? clipNamed(clips, names) ?? clipNamed(clips, ["Idle"]) ?? clips[0];  // a posed extra (kneeling, flying) keeps its pose between its own clips
    if (!c) return;
    if (c.name.toLowerCase() !== names[0].toLowerCase()) missing.add(`${file} ${s?.a ?? "rest"}->${c.name}`);
    const hold = !!e.pose && /^(kneel|sit)$/i.test(c.name) && c.name.toLowerCase() === e.pose.toLowerCase();  // kneeling or sitting: down once, then held (the clip stands up again at its end)
    const act = mix.clipAction(c), v = s?.to && s.secs ? s.from.distanceTo(s.to) / s.secs : 0, mc = m[c.name];
    act.setLoop(loop && !hold ? THREE.LoopRepeat : THREE.LoopOnce); act.clampWhenFinished = !loop || hold;
    act.timeScale = s?.a.startsWith("go") ? (v && mc?.speed ? THREE.MathUtils.clamp(v / (mc.speed * H / (mc.height || H)), 0.3, 3) : 1)  // a walk at the pace it covers the ground (motion.json: speed at its measured height)
      : loop || hold ? 1 : THREE.MathUtils.clamp(c.duration / (s?.secs || c.duration), 0.5, 2);  // a move done inside its step, as the puppet's swing
    if (act === cur && (loop || hold)) return;
    act.reset().play();
    if (cur && cur !== act) cur.crossFadeTo(act, 0.2, false);
    cur = act; p.hold = hold ? c.duration * 0.9 : 0;
  };
  const drive = dt => {
    const x = p.x, s = x?.step;
    let goal = e.front ? 0 : (Math.sign(root.scale.x) || 1) * Math.PI / 2;  // side-on, as the paper faces
    if (s?.a.startsWith("go") && s.to && Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z) > 0.002) goal = Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z);  // along its walk
    yaw += Math.atan2(Math.sin(goal - yaw), Math.cos(goal - yaw)) * Math.min(1, dt * 8);
    if (!mix || !root.visible) return;
    if (s !== was || x?.hidden !== hid || !cur) { was = s; hid = x?.hidden; play(x || { def, pose: e.pose }, s); }
    mix.update(dt); if (p.hold && cur.time >= p.hold) cur.paused = true;
  };
  p.dispose = () => {
    PROXIES.delete(proxy);  // ambient.js, as it clears the spread: what this copy holds on the GPU beyond what ambient.js frees itself (its skeletons' bone
    if (mix) { mix.stopAllAction(); mix.uncacheRoot(model); }  // textures), and its own graded materials and rigid geometry as well, so freeing them never rests on ambient.js's sweep
    model.traverse(o => { o.skeleton?.dispose(); if (o.isMesh && rigid) o.geometry.dispose(); if (o.isMesh && !shared.has(o.material)) o.material.dispose(); });
  };
  const q = new THREE.Quaternion(), k = new THREE.Vector3();
  root.updateMatrix = function () {  // every frame, as the renderer brings the scene's matrices up to date: clip and turn, then the matrix
    const now = performance.now() / 1000;
    if (now - last > 0.004) { drive(Math.min(now - last, 1 / 30)); last = now; }  // asked several times a frame: the mixer moves once
    if (e.wall) roll.rotation.z = (Math.sin(yaw) < 0 ? -1 : 1) * Math.PI / 2;  // its own forward axis turned a quarter: up becomes toward the reader once the yaw turns it side-on; its root is the belly's spot on the wall (shortcut: the tap box stays upright, the body hits answer)
    this.matrix.compose(this.position, q.setFromAxisAngle(UP, yaw), k.setScalar(Math.abs(this.scale.y)));
    this.matrixWorldNeedsUpdate = true;
  };
  return p;
}
