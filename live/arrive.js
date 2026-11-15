// arrive.js: the arrival at the reading table (?from=shelf), for every book from its id alone. There is no stand-in: the book that arrives IS the reader's own (bookbody.js, the shelf's open
// book model, with the real first spread lying on it), folded shut. It comes down onto the table closed, rests about 2 s, the clasp lets go and the left half swings open over about 2.2 s while
// the camera eases to the reader's own resting pose and the lamp to the reader's light; gold motes rise and linger ~3 s. When the swing ends the scene IS the reading view: nothing is swapped.
// The cover only opens onto a ready spread: until the spread is up the book stays shut, its light breathing and the motes rising. The spread's left page, with its printing, rides the half (attached to it while the book lies flat, attached back at touch-down).
// skip() goes straight to the open book. Reduced motion: no swing, the closed book's last frame fades out over the open one (0.4 s).
import { swingRig } from "./ambient.js";
const T = { land: 0.9, rest: 2.1, lead: 0.35, swing: 2.2, settle: 0.6, control: 0.4 };  // seconds: landing, rest closed, the strap's lead before the swing, the swing, the settle, control after the swing
export function makeArrival({ THREE, scene, cam, renderer, ctl, body, desk, play, reader, show, calm }) {
  const A = { active: true, locked: true, rendered: false, failed: false, finished: false, mix: 0 };
  const V = new THREE.Vector3(), rig = new THREE.Group(), ease = k => (k = Math.min(1, Math.max(0, k)), k * k * (3 - 2 * k)), out = k => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
  let kids = [], room = [], roomAt = 0, warm = 0, ready = false, clock = 0, tsw = 0, skipped = !!calm, lights = null, pts = null, base = null, fog = null, plain = null, old = null, proj = null, lens = null, seat = null;
  const PRE = { pageW: 1, flat: { min: { y: -0.0015 } }, bottom: 0 };  // the spread's own page width and paper height, until its spread is up (the same for every book)
  body.dress().then(() => {
    if (!body.left) throw new Error("the open book has no hinged left half");
    scene.add(rig); rig.add(body.group); desk.position.y = body.fit(PRE) - 0.002; body.left.rotation.z = body.closedAngle; body.group.visible = false;
    lights = [new THREE.DirectionalLight(0xffe2b0, 2.2), new THREE.PointLight(0xffa850, 1.6, 8, 1.6), new THREE.PointLight(0xffa860, 0, 6, 2)];  // the table's warm light, a candle, and the glow from the pages
    lights[0].position.set(-1.2, 3.4, 2.4); lights[1].position.set(1, 1.6, 1.2); lights[2].position.set(0, 1.5, 0.1); body.group.add(...lights);
    const N = innerWidth < innerHeight ? 200 : 400,  // half as many on a phone: the cover's title stays readable
       g = new THREE.BufferGeometry(), cv = document.createElement("canvas"); cv.width = cv.height = 32;
    const x = cv.getContext("2d"), rg = x.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, "#fff"); rg.addColorStop(0.4, "#ffd98a99"); rg.addColorStop(1, "#ffd98a00"); x.fillStyle = rg; x.fillRect(0, 0, 32, 32);
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.boundingBox = new THREE.Box3();  // empty on purpose: the motes are not part of the book. Parked ones wait at y -9, and counted into the body's box (bookbody.js place) they dropped the desk 9 below the book the moment the spread came up
    pts = Object.assign(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.04, map: new THREE.CanvasTexture(cv), color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), { frustumCulled: false });
    pts.userData = { N, life: new Float32Array(N), vel: new Float32Array(N * 3), age: new Float32Array(N).fill(1e9) }; body.group.add(pts);
    return renderer.compileAsync(scene, cam).catch(() => {}).then(() => { body.group.visible = true; ready = true; });
  }).catch(e => { console.warn("arrive: no hinged open book", e.message); A.failed = true; A.active = A.locked = false; A.finished = true; });
  const fitDist = (w, d, ele) => {  // how far back the camera must stand for a w by d footprint to fill 70 percent of the frame
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2), th = tv * cam.aspect;
    return Math.max(w / 0.7 / (2 * th), d * Math.sin(ele) / 0.7 / (2 * tv) + d * 0.25);
  };
  const join = R => {  // the first spread's left page and everything printed on it (every root child left of the fold) ride the swinging half: attached to it while the book still lies open flat, so each keeps its place on it at every angle
    const b = new THREE.Box3(); body.left.rotation.z = 0; scene.updateMatrixWorld(true);
    kids = R.root.children.filter(o => o.visible && !b.setFromObject(o).isEmpty() && b.max.x <= 0.02 && b.min.x < -0.02).map(o => [o, o.parent, o.matrixWorld.clone()]);  // shortcut: direct children of the spread's root only
    { const at = [rig.position.clone(), rig.rotation.clone(), rig.scale.clone()], z = body.strap?.rotation.z; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.setScalar(1); if (body.strap) body.strap.rotation.z = 0; rig.updateMatrixWorld(true);  // where the desk sits under the OPEN book (its rounded spine and ribbon reach 1.6 cm lower than the shut book): the desk eases there with the swing, and ends where a direct link puts it
      seat = [desk.position.y, new THREE.Box3().setFromObject(body.group).min.y - 0.002]; rig.position.copy(at[0]); rig.rotation.copy(at[1]); rig.scale.copy(at[2]); if (body.strap) body.strap.rotation.z = z; rig.updateMatrixWorld(true); }
    kids.forEach(([o]) => body.left.attach(o)); A.kids = kids.map(k => k[0]); base = R.lights.map(l => [l, l.intensity]);
  };
  const leave = R => { body.left.rotation.z = 0; kids.forEach(([o, p]) => p.attach(o)); scene.updateMatrixWorld(true); A.diff = Math.max(0, ...kids.flatMap(([o, , m]) => o.matrixWorld.elements.map((v, i) => Math.abs(v - m.elements[i])))); base?.forEach(([l, v]) => (l.intensity = v)); };  // back where they were: the reader's own page-turn finds its hierarchy untouched
  const fade = () => {  // shortcut: a still of the closed book over the page, 0.4 s; a reduced-motion reader only
    renderer.render(scene, cam); const im = Object.assign(new Image(), { src: renderer.domElement.toDataURL("image/jpeg", 0.85) });
    im.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:80;pointer-events:none;transition:opacity .4s"; document.body.append(im);
    im.decode().catch(() => {}).then(() => requestAnimationFrame(() => (im.style.opacity = 0, setTimeout(() => im.remove(), 500))));
  };
  A.skip = () => { skipped = true; if (tsw) tsw = Math.min(tsw, (A.lt ?? 0) - T.swing - T.settle); };  // a tap once the swing has begun goes straight to the open book too
  A.frame = now => {
    if (A.finished || !ready) return;
    clock += Math.min(0.05, (now - (A.now ?? now)) / 1000) - (A.now === undefined ? 0.35 : 0); A.now = now;  // the clock starts 0.35 s after the first frame (the veil lifts), and never jumps: a stalled frame (a material linking) only pauses it
    const t = Math.max(0, clock), dt = Math.min(0.05, t - (A.lt ?? t)), R = reader(); A.lt = t;
    const off = () => (cam.view?.enabled ? cam.view.offsetY : 0); if (!R) proj = [cam.fov, off()];  // the lens and the picture's shift the arrival is drawn with until the spread sets its own (live.js fit())
    if (!R && !plain) plain = desk.material.clone();  // the bare desk, as drawn before the spread dresses it (ambient.js gives it a grain and a fog)
    if (R && !roomAt) {  // the reader's own room comes up over 1 s from the moment the spread is up, instead of cutting in: the wall and the desk's darkening fade up, the fog draws in, and the bare desk fades out over the dressed one
      roomAt = clock || 1e-6; scene.getObjectByName("nook")?.traverse(o => o.isMesh && (room.push([o.material, o.material.opacity, o.material.transparent]), Object.assign(o.material, { transparent: true, opacity: 0 })));
      { const at = [rig.position.clone(), rig.rotation.clone(), rig.scale.clone()]; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.setScalar(1); rig.updateMatrixWorld(true);  // the desk sits under the book where it RESTS: live.js measured the body while it was still coming down (lifted, tilted), which left the desk above the landed book
        desk.position.y = new THREE.Box3().setFromObject(body.group).min.y - 0.002; rig.position.copy(at[0]); rig.rotation.copy(at[1]); rig.scale.copy(at[2]); rig.updateMatrixWorld(true); }
      if (scene.fog?.isFog) fog = [scene.fog, scene.fog.near, scene.fog.far];
      if (proj && A.rendered && (proj[0] !== cam.fov || proj[1] !== off())) lens = [proj, [cam.fov, off()], cam.aspect];
      if (plain && A.rendered) { old = new THREE.Mesh(desk.geometry, Object.assign(plain, { transparent: true, depthWrite: false, fog: false })); old.position.y = 0.0003; old.renderOrder = -1; desk.add(old); }
    }
    if (A.active && !tsw && !warm && R && (skipped || t >= T.rest)) { warm = 1; join(R); show(); Promise.resolve(R.warm()).then(() => (warm = 2)); }  // the spread's materials (and its cast's) are all linked while the book still rests shut: no stall at touch-down
    if (A.active && !tsw && warm === 2) { if (calm) fade(); tsw = skipped ? t - T.swing - T.settle - T.lead : t + T.lead; A.sw = t; if (skipped) pts.material.opacity = 0; }  // the cover only opens onto a ready spread
    const u = tsw ? t - tsw : -1, k = ease(u / T.swing), done = u >= T.swing + T.settle;
    if (room.length || fog || old || lens) {  // at the hand-over (a skip, reduced motion) whatever is left of the fade completes at once: the room is never left dark
      const f = done || !A.active ? 1 : ease((clock - roomAt) / 1), s = Math.max(f, 1e-3);
      room.forEach(([m, o]) => (m.opacity = o * f)); if (fog) fog[0].near = fog[1] / s, fog[0].far = fog[2] / s; if (old) old.material.opacity = 1 - f;
      if (lens && cam.aspect === lens[2]) { const y = lens[0][1] + (lens[1][1] - lens[0][1]) * f; cam.fov = lens[0][0] + (lens[1][0] - lens[0][0]) * f; if (y) cam.setViewOffset(innerWidth, innerHeight, 0, y, innerWidth, innerHeight); else cam.clearViewOffset(); cam.updateProjectionMatrix(); } else lens = null;  // the spread's lens and shift ease in too (the camera below stands back to match, so the book keeps its size); a resize meanwhile keeps the viewer's own  // near and far divided by the fade: at 0 nothing is fogged, at 1 they are the room's own
      if (f >= 1) { room.forEach(([m, o, tr]) => Object.assign(m, { transparent: tr, opacity: o })); room = []; fog = lens = null; if (old) old.removeFromParent(), old.material.dispose(), old = null; }
    }
    if (A.active) {
      const land = calm ? 1 : out(t / T.land), M = body.group; M.updateMatrix();
      rig.position.set(0, (1 - land) * 0.6, (1 - land) * 0.4); rig.rotation.set((1 - land) * 0.6, 0, 0); rig.scale.setScalar(1); rig.updateMatrixWorld(true);  // closer to the camera at first, as big on the screen as the shelf's last frame
      const ele = THREE.MathUtils.degToRad(56), c = new THREE.Vector3(0.45, 0.1, 0.05), dist = fitDist(1.3, 1.45, ele) * (1 - 0.05 * ease((t - T.land) / 1.2));
      let pos = c.clone().add(new THREE.Vector3(0, Math.sin(ele), Math.cos(ele)).multiplyScalar(dist)), look = c; A.h0 = pos.y; A.d0 = pos.length();  // in the book's own units: looking down at the closed cover
      if (R && k > 0) { const inv = M.matrix.clone().invert(), r = swingRig({ pos, look }, { pos: R.home.clone().applyMatrix4(inv), look: R.look.clone().applyMatrix4(inv) }, k); pos = r.pos; look = r.look; const h = R.home.clone().applyMatrix4(inv); pos.y = Math.max(pos.y, Math.min(h.y, A.h0)); const d = pos.length(), d0 = Math.min(h.length(), A.d0); if (d < d0) pos.multiplyScalar(d0 / d); }  // then eased to the reader's own resting pose, never lower than it or nearer the fold (the closed view's, if that is lower)
      pos.applyMatrix4(M.matrix); look = look.clone().applyMatrix4(M.matrix);
      cam.position.copy(pos); ctl.target.copy(look); cam.lookAt(look); cam.updateMatrixWorld(); A.rendered = true;
      const wide = () => { rig.updateMatrixWorld(true); const cs = [-0.2, 1.06].flatMap(x => [-0.22, 0.22].flatMap(y => [-0.72, 0.72].map(z => M.localToWorld(V.set(x, y, z)).project(cam).clone()))), near = cs.some(q => q.z > 1), sp = a => (Math.max(...cs.map(q => q[a])) - Math.min(...cs.map(q => q[a]))) / 2; return near ? 2 : Math.max(sp("x"), sp("y")); };  // a corner past the camera's near plane projects flipped: too big  // never wider or taller on the screen than 86 percent of it (a phone's tall frame): the whole cover is seen
      for (let i = 0, f; i < 4 && land < 1 && (f = wide()) > 0.86; i++) rig.scale.multiplyScalar(0.86 / f), rig.position.x = 0.45 * (1 - rig.scale.x);  // about the book's own middle (x 0.45), so it does not slide  // perspective is not linear: a few passes
      const w = u > 0 ? (u < T.swing ? k : 1) : 0, sw = u > T.swing ? 0.03 * Math.exp(-7 * (u - T.swing)) * Math.abs(Math.sin(15 * (u - T.swing))) : 0;
      body.left.rotation.z = done ? 0 : body.closedAngle * (1 - w) - sw
      body.strap && (body.strap.rotation.z = body.strapOpen * ease((t - (tsw ? tsw - T.lead : 1e9)) / T.lead));
      A.mix = w; if (R && base) base.forEach(([l, v]) => (l.intensity = v * w)); if (seat) desk.position.y = seat[0] + (seat[1] - seat[0]) * w;
      if (tsw) renderer.shadowMap.needsUpdate = true;  // the spread's own shadows deepen with its lights as the book opens (the viewer only redraws them from the hand-over on: they came in on one frame)
      lights[0].intensity = 2.2 * (1 - w); lights[1].intensity = 1.6 * (1 - w); lights[2].intensity = (0.1 + 0.03 * Math.sin(t * 2.2) + 0.55 * Math.sin(Math.PI * w)) * (1 - w) ** 2;  // the table's light eases to the reader's; the pages glow, breathing, then fade
      if (t > T.land && !A.thud) { A.thud = true; play("i-cloth", { gain: 0.6 }); }
      if (done) { A.active = false; leave(R); body.strap && (body.strap.rotation.z = 0);  // latched again, as on a direct link: it is hidden while the book lies flat, but left released it hung below the boards and was measured into the book's bottom (the desk dropped 10.8 cm at the next spread)
        const r = R; cam.position.copy(r.home); ctl.target.copy(r.look); cam.lookAt(r.look); cam.updateMatrixWorld(); }
    }
    if (pts) {  // gold motes from the pages, rising all the while the book waits or opens, lingering about 3 s after it lies open, thinning
      const o = pts.userData, p = pts.geometry.attributes.position, end = tsw ? tsw + T.swing + T.settle : Infinity;
      pts.material.opacity = skipped ? 0 : Math.min(1, ease((t - 2.4) / 0.6)) * (1 - ease((t - end - 1) / 2)) * 0.9;
      for (let i = 0; i < o.N; i++) {
        if (o.age[i] > o.life[i]) { if (t > 2.5 && t < end + 1.2 && !skipped && Math.random() < 0.55) { o.age[i] = 0; o.life[i] = 2.4 + Math.random() * 1.6; p.setXYZ(i, -1 + Math.random() * 2.1, 0.05, (Math.random() - 0.5) * 1.3); o.vel.set([(Math.random() - 0.5) * 0.1, 0.12 + Math.random() * 0.26, (Math.random() - 0.5) * 0.1], i * 3); } else p.setXYZ(i, 0, -9, 0); continue; }
        o.age[i] += dt; const a = o.age[i], vx = o.vel[i * 3] + Math.sin(a * 1.7 + i) * 0.07, vz = o.vel[i * 3 + 2] + Math.cos(a * 1.3 + i) * 0.07;
        p.setXYZ(i, p.getX(i) + vx * dt, p.getY(i) + o.vel[i * 3 + 1] * dt, p.getZ(i) + vz * dt);
      }
      p.needsUpdate = true;
      if (!A.active && (t > end + T.control || skipped)) A.locked = false;
      if (!A.active && (t > end + 3.2 || skipped)) { body.group.remove(pts); pts.geometry.dispose(); A.finished = true; }
    }
  };
  return A;
}
