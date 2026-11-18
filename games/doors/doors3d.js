// doors3d.js: Doors of Mystery as a room you stand in. Three carved doors in the far wall, each with its answer on a gold plaque, the sum on a hanging sign,
// Kankak beside them asking. The right door swings open and you walk through into the next room; a wrong one opens on a funny, harmless trap:
// a bucket of feathers tips onto you, a sleepy baby dragon snorts a puff of smoke, or a slide carries you gently back to the start. Built in code from rooms.js (dress.js); Kankak and the room's lightmap are the only files.
import { createStage, THREE, wait, bake } from "../stage3d.js";
import { doors as ROOM } from "../rooms.js";
import { plate as drawPlate } from "../art.js";
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function createDoors(canvas, { sound = () => {}, host }) {
  const R = ROOM(), phone = innerWidth < innerHeight || innerWidth <= 820, { DW, DH, WZ, xs } = R, gap = xs[2];  // the same room on a phone: you stand further back
  const S = createStage(canvas, { room: R, lightmap: new URL("lm.avif", import.meta.url).href }), { box } = S, D = S.dressed, start = V(0, 1.45, phone ? 4.0 : 2.2);
  S.setFov(phone ? 76 : 56); S.view.pos.copy(start);
  await document.fonts.load("600 100px Cinzel").catch(() => {});
  const label = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, t }; };
  const plate = (L, text, size) => { drawPlate(L.c, text, size); L.t.needsUpdate = true; };

  // ---- the doors: a leaf hinged on its left edge (opens inward, away from you): planks, iron straps and studs, a bronze ring (rooms.js leaf), the plaque; frames and arches are the room's
  const pick = [], gold = D.M("gold");
  const doors = xs.map((x, i) => {
    const hinge = new THREE.Group(); hinge.position.set(x - DW / 2, 0, WZ); S.scene.add(hinge);
    R.leaf.forEach((q, k) => { const m = D.part(q, hinge); if (!k) { m.userData.door = i; pick.push(m); } });
    const L = label(256, 180), pl = new THREE.Mesh(new THREE.PlaneGeometry(.56, .39), new THREE.MeshStandardMaterial({ map: L.t, roughness: .45, color: 0xffc766 })); pl.position.set(DW / 2, 1.2, .07); hinge.add(pl);
    // the space behind (seen only through the open door): dark, deep enough for the slide; its floor hides for the slide
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 3.4), new THREE.MeshStandardMaterial({ color: 0x0c0705, roughness: .95, side: THREE.BackSide })); back.position.set(x, 0, WZ - 1.7); S.scene.add(back);
    const fg = new THREE.PlaneGeometry(1.5, 3.4); fg.rotateX(-Math.PI / 2); fg.translate(x, .001, WZ - 1.7); const floor = D.add(fg, "floorPlanks", S.scene);
    return { hinge, L, floor };
  });
  S.pickables = pick;
  // the sign: the sum, hanging from two gold chains
  const SL = label(640, 180), sw = phone ? 2 : 2.3, sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 180 / 640), new THREE.MeshStandardMaterial({ map: SL.t, roughness: .45, color: 0xffc766 }));  // tinted amber: the reference's gold plates under firelight
  sign.position.set(0, DH + .78, WZ + .25); S.scene.add(sign); for (const s of [-1, 1]) box(D.M("iron"), .025, 4.4 - DH - 1.05, .025, s * sw * .4, (4.4 + DH + 1.05) / 2, WZ + .25);
  const doorLight = new THREE.PointLight(0xffd27a, 0, 6, 1.6); S.scene.add(doorLight);

  // ---- behind the right door: warm gold light
  const glow = new THREE.Group(), gm = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false, map: bake(128, (x, y) => { const r = Math.min(1, Math.hypot(x - 64, (y - 64) * .6) / 64), a = (1 - r) ** 1.6; return [.55 + .45 * a, .3 + .65 * a, .08 + .75 * a * a]; }) }); glow.add(new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), gm)); glow.children[0].position.set(0, 1.3, -3.3); S.scene.add(glow);
  // ---- trap 1: the bucket of feathers (feathers: one instanced draw, moved only while they fall)
  const bucket = new THREE.Group(); bucket.add(new THREE.Mesh(new THREE.CylinderGeometry(.24, .18, .32, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: .8, side: THREE.DoubleSide })));
  const bandM = gold; for (const y of [-.1, .1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.215 + y * .15, .012, 6, 20), bandM); r.rotation.x = Math.PI / 2; r.position.y = y; bucket.add(r); }
  S.scene.add(bucket);
  const NF = 90, fg = new THREE.CircleGeometry(.035, 8); fg.scale(.5, 1.8, 1);
  const feathers = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xfff6ea, emissive: 0x9a8a78, roughness: .9, side: THREE.DoubleSide }), NF), F = Array.from({ length: NF }, () => ({ p: V(0, 0, 0), v: V(0, 0, 0), ph: 0, s: 0 }));
  feathers.frustumCulled = false; feathers.visible = false; S.scene.add(feathers); let fall = -1; const o3 = new THREE.Object3D();
  // ---- trap 2: the sleepy baby dragon (spheres and cones), and its puff of smoke
  const dragon = new THREE.Group(), green = new THREE.MeshStandardMaterial({ color: 0x5fae5a, roughness: .6 }), cream = new THREE.MeshStandardMaterial({ color: 0xf2e2b0, roughness: .7 }), ink = new THREE.MeshBasicMaterial({ color: 0x1a1208 });
  const ball = (m, r, x, y, z, sx = 1, sy = 1, sz = 1, p = dragon) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); p.add(b); return b; };
  ball(green, .42, 0, .42, 0, 1, .95, 1); ball(cream, .3, 0, .4, .2, .9, 1, .6); ball(green, .14, -.3, .1, .22); ball(green, .14, .3, .1, .22);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.12, .7, 10), green); tail.position.set(.35, .2, -.35); tail.rotation.set(-1.2, 0, -.8); dragon.add(tail);
  for (const s of [-1, 1]) { const wg = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 3), new THREE.MeshStandardMaterial({ color: 0x8fd27a, roughness: .6 })); wg.position.set(s * .42, .72, -.1); wg.rotation.set(0, 0, -s * 1.1); dragon.add(wg); }
  const head = new THREE.Group(); head.position.set(0, .86, .08); dragon.add(head); ball(green, .3, 0, .12, 0, 1, .92, 1, head); ball(green, .17, 0, .02, .26, 1.1, .8, 1, head);
  for (const s of [-1, 1]) { ball(ink, .022, s * .07, .05, .42, 1, 1, 1, head); const h = new THREE.Mesh(new THREE.ConeGeometry(.05, .18, 8), cream); h.position.set(s * .14, .42, -.05); h.rotation.z = -s * .3; head.add(h);
    ball(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 }), .085, s * .13, .2, .2, 1, 1, .7, head); ball(ink, .04, s * .13, .2, .27, 1, 1, .6, head); }
  const lids = [-1, 1].map(s => ball(green, .095, s * .13, .2, .205, 1, 1, .75, head));
  S.scene.add(dragon);
  const smokeM = new THREE.MeshStandardMaterial({ color: 0xd9d2c8, roughness: 1, transparent: true, opacity: 0, depthWrite: false }), puffs = Array.from({ length: 9 }, () => ball(smokeM, .14, 0, 0, 0, 1, 1, 1, S.scene));
  // ---- trap 3: the slide (a polished chute with gold rails, down into the dark)
  const slide = new THREE.Group(), len = Math.hypot(2.7, 2.8), chute = box(new THREE.MeshStandardMaterial({ color: 0xc08a44, emissive: 0x3a2008, roughness: .3, metalness: .2 }), .9, .04, len, 0, 0, 0, slide);
  for (const s of [-1, 1]) box(gold, .05, .12, len, s * .45, .08, 0, chute);
  chute.rotation.x = -Math.atan2(2.7, 2.8); chute.position.set(0, -1.35, -1.45); S.scene.add(slide);

  // ---- the host (doors.js HOST: a cast model, or a gilded statue), beside the doors (on a phone: in front, below them)
  const at = phone ? V(-.5, 0, .6) : V(-gap - 1.3, 0, WZ + .9), kankak = await S.host(new URL(host.model, location.href).href, phone ? .7 : 1.05, at, Math.atan2(start.x - at.x, start.z - at.z), host.statue).catch(e => (console.warn("doors: the host did not load", e), null)); await S.ready;
  const act = (n, once = true) => kankak?.act(n, once);

  // ---- the fade (a cut under reduced motion)
  const veil = Object.assign(document.createElement("div"), { className: "dm-veil" }); document.body.append(veil);
  const fade = (to, ms = 500, color = "#ffe6a8") => { veil.style.background = color; const a = +veil.style.opacity || 0; return S.tween(ms, u => (veil.style.opacity = a + (to - a) * u)); };

  const PAL = [[1, 1, 1], [.92, .98, 1.08], [1.08, .95, .9], [.95, .95, 1.04], [1.05, 1, .94]], panel = D.M("panel", true), panel0 = panel.color.clone();  // each room along the road a little different
  function reset() {
    doors.forEach(d => { d.hinge.rotation.y = 0; d.floor.visible = true; }); doorLight.intensity = 0; feathers.visible = false; fall = -1; smokeM.opacity = 0;
    bucket.visible = false; head.rotation.x = .5; lids.forEach(l => (l.visible = true)); S.view.pos.copy(start); S.aim(0, 0); S.view.tf = S.view.base;
  }
  let kinds = [];
  return {
    S, act, kinds: () => kinds,
    // a new question: the sum on the sign, the answers on the plaques, what waits behind each door; room = how far along the road (re-tints the room)
    ask(cur, ks, room = 0) {
      reset(); kinds = ks; plate(SL, `${cur.a} ${{ "+": "+", "-": "−", "*": "×", "/": "÷" }[cur.op]} ${cur.b} = ?`, 104); doors.forEach((d, i) => plate(d.L, String(cur.doors[i]), 118));
      panel.color.copy(panel0).multiply(new THREE.Color(...PAL[room % PAL.length]));
      const put = (g, k) => { const i = ks.indexOf(k); g.visible = i >= 0; if (i >= 0) g.position.set(xs[i], 0, WZ); return i; };
      put(glow, "right"); put(slide, "slide"); const di = put(dragon, "dragon"); if (di >= 0) dragon.position.set(xs[di], 0, WZ - 1.25); const si = ks.indexOf("slide"); if (si >= 0) doors[si].floor.visible = false;
      act("Talk");
    },
    enter: () => fade(0, 600),
    // open door i and play what is behind it; resolves when the next question can be asked (the screen is veiled)
    async open(i) {
      const k = kinds[i], x = xs[i], d = doors[i]; S.lock = true;
      await S.walk(V(x, 1.45, WZ + 1.6), 0, 0, 1100); sound("i-creak"); doorLight.position.set(x, k === "slide" ? .4 : 1.8, WZ - 1.2);
      await S.tween(900, u => { d.hinge.rotation.y = 1.6 * u; doorLight.intensity = (k === "right" ? 9 : k === "slide" ? 8 : 4) * u; });
      if (k === "right") { act("Cheer"); await Promise.all([S.walk(V(x, 1.45, WZ - 1.9), 0, 0, 1500), wait(700).then(() => fade(1, 700))]); }
      else if (k === "feathers") {
        act("Laugh"); bucket.visible = true; sound("i-wing");
        await S.tween(450, u => { bucket.position.set(x, DH + .25 - .25 * u, WZ - .25 + .55 * u); bucket.rotation.set(-2.3 * u, 0, 0); });
        F.forEach((f, n) => { const r = (a, b) => a + (b - a) * Math.random(); f.p.set(x + r(-.15, .15), DH - .05, WZ + .3); f.v.set(r(-.55, .55), r(.1, .8), r(.7, 1.5)); f.ph = r(0, 6.3); f.s = r(.7, 1.3); }); fall = 0; feathers.visible = true;
        await S.walk(V(x, 1.3, WZ + 1.75), 0, .32, 900); await wait(1500); sound("i-wing"); await fade(1, 500, "#2a1a0c");
      } else if (k === "dragon") {
        await S.tween(700, u => { head.rotation.x = .5 - .7 * u; }); lids.forEach(l => (l.visible = false)); await wait(350); sound("buffalo-snort"); act("Laugh");
        const nose = V(x, .9, WZ - .95);
        await Promise.all([S.tween(1300, u => puffs.forEach((p, n) => { const s = Math.min(1, u * 1.4 - n * .04); p.position.set(nose.x + Math.sin(n * 2.4) * .3 * s, nose.y + .35 * s + Math.cos(n * 1.7) * .15 * s, nose.z + 2.1 * s); p.scale.setScalar(.4 + 3.2 * Math.max(0, s)); smokeM.opacity = .85 * (1 - u * u); })),
          S.walk(V(x, 1.45, WZ + 2.0), 0, .02, 700)]);
        await wait(700); await fade(1, 500, "#2a1a0c");
      } else {
        act("Laugh"); await S.walk(V(x, 1.45, WZ + 1.6), 0, -.5, 600); await wait(400); sound("sand-shift"); await S.walk(V(x, 1.0, WZ - .3), 0, -.6, 900);
        await Promise.all([S.walk(V(x, -2.3, WZ - 2.7), 0, -.5, 1700), wait(1000).then(() => fade(1, 700, "#ffe6a8"))]);
      }
      S.lock = false;
    },
    // where door i is on the screen (css px), for the tap-through check
    screenOf(i) { const v = V(xs[i], 1.15, WZ).project(S.camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    frame: S.onFrame = dt => { if (fall < 0) return; fall += dt;
      F.forEach((f, n) => { f.v.y = Math.max(-.55, f.v.y - 2.2 * dt); f.v.z *= 1 - .6 * dt; f.p.addScaledVector(f.v, dt); if (f.p.y < .02) { f.p.y = .02; f.v.set(0, 0, 0); }
        o3.position.copy(f.p); o3.position.x += Math.sin(fall * 3 + f.ph) * .12; o3.rotation.set(f.ph + fall * 2, f.ph, Math.sin(fall * 4 + f.ph)); o3.scale.setScalar(f.s); o3.updateMatrix(); feathers.setMatrixAt(n, o3.matrix); });
      feathers.instanceMatrix.needsUpdate = true; },
  };
}
