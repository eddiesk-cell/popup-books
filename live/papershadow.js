// papershadow.js — grounded contact shadows for every standing paper card, cast puppet, and paper extra,
// plus open-page floor seating for foot-stripped "-wing" V-fold cards (T7, Eddie 2026-11-24).
import * as THREE from "three";

const STAGE_OP = { day: 0.62, evening: 0.52, storm: 0.48, night: 0.44 };
const STAGE_COLOR = 0x000000;  // pure black occlusion: NormalBlending = dst*(1-alpha), always strictly darker than any floor even at midnight
const imgCache = new WeakMap();
let sharedTex = null;

export function contactShadowTexture() {
  if (sharedTex) return sharedTex;
  const w = 128, h = 64, cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    // v in [-1, 1]: 0 is the exact contact line of the card; v > 0 is the reading side (+z), v < 0 is behind (-z)
    const v = ((y + 0.5) / h) * 2 - 1;
    const dv = v >= 0 ? v * 1.05 : v * 1.65;
    const tight = Math.exp(-((dv / 0.36) ** 2));
    const soft = Math.exp(-((dv / 0.78) ** 2));
    const zEnv = 0.65 * tight + 0.35 * soft;
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1;
      const e = Math.min(1, Math.max(0, (1 - Math.abs(u)) / 0.12));
      const xEnv = e * e * (3 - 2 * e);
      const a = Math.round(255 * Math.min(1, xEnv * zEnv));
      const idx = (y * w + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = a; d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  sharedTex = new THREE.CanvasTexture(cv);
  sharedTex.colorSpace = THREE.NoColorSpace;
  return sharedTex;
}

export function makeContactShadow(w, d, opacity = 0.42, ofName = "") {
  const mat = new THREE.MeshBasicMaterial({
    color: STAGE_COLOR,
    alphaMap: contactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
  m.castShadow = false;
  m.receiveShadow = false;
  m.userData = { contactShadow: true, contactOf: ofName, baseOp: opacity, depth: d };
  return m;
}

function alphaDataOf(img) {
  if (!img?.width) return null;
  let rec = imgCache.get(img);
  if (rec === undefined) {
    try {
      const s = Math.min(1, 512 / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      rec = { w, h, origW: img.width, origH: img.height, data: ctx.getImageData(0, 0, w, h).data };
    } catch { rec = null; }
    imgCache.set(img, rec);
  }
  return rec;
}

function sampleMeshOpaque(mesh, maxWorldY = Infinity) {
  const mat = [].concat(mesh.material)[0], map = mat?.map, pos = mesh.geometry?.attributes?.position, uvs = mesh.geometry?.attributes?.uv;
  if (!pos) return [];
  const id = map?.image && (mat.alphaTest || mat.transparent) ? alphaDataOf(map.image) : null;
  const ix = mesh.geometry.index, triCount = (ix ? ix.count : pos.count) / 3;
  const stepM = triCount <= 8 ? 0.002 : 0.003;
  const maxSegs = triCount <= 8 ? 96 : 64;
  const pu = id ? 9 / id.origW : 0, pv = id ? 9 / id.origH : 0;
  const isAtlas = id && mat?.name?.startsWith("art-") && id.origW >= 512 && id.origH >= 512 && !map.flipY;
  const pts = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ua = new THREE.Vector2(), ub = new THREE.Vector2(), uc = new THREE.Vector2(), uv = new THREE.Vector2();
  for (let t = 0; t < triCount; t++) {
    const i0 = ix ? ix.getX(t * 3) : t * 3, i1 = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, i2 = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
    if (Math.min(a.y, b.y, c.y) > maxWorldY) continue;
    if (uvs) { ua.fromBufferAttribute(uvs, i0); ub.fromBufferAttribute(uvs, i1); uc.fromBufferAttribute(uvs, i2); }
    if (isAtlas && uvs && ua.x < pu && ua.y < pv && ub.x < pu && ub.y < pv && uc.x < pu && uc.y < pv) continue;
    const mx = Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c));
    const segs = Math.min(maxSegs, Math.max(1, Math.ceil(mx / stepM)));
    for (let i = 0; i <= segs; i++) {
      for (let j = 0; j <= segs - i; j++) {
        const u = i / segs, v = j / segs, w = 1 - u - v;
        const py3 = w * a.y + u * b.y + v * c.y;
        if (py3 > maxWorldY) continue;
        if (id && uvs) {
          uv.set(w * ua.x + u * ub.x + v * uc.x, w * ua.y + u * ub.y + v * uc.y);
          map.transformUv(uv);
          const px = Math.min(id.w - 1, Math.max(0, (uv.x * id.w) | 0));
          const py = Math.min(id.h - 1, Math.max(0, (uv.y * id.h) | 0));
          if (id.data[(py * id.w + px) * 4 + 3] <= 127) continue;
        }
        pts.push(new THREE.Vector3(w * a.x + u * b.x + v * c.x, py3, w * a.z + u * b.z + v * c.z));
      }
    }
  }
  return pts;
}

// Compute contiguous base-line strips in XZ for a single standing card mesh
function baseStripsOf(pts, baseY, heightM) {
  const bandH = Math.min(0.018, Math.max(0.006, 0.18 * heightM));
  const band = pts.filter(p => p.y < baseY + bandH);
  if (band.length < 2) return [];
  let mx = 0, mz = 0;
  for (const p of band) { mx += p.x; mz += p.z; }
  mx /= band.length; mz /= band.length;
  let cxx = 0, cxz = 0, czz = 0;
  for (const p of band) { const dx = p.x - mx, dz = p.z - mz; cxx += dx * dx; cxz += dx * dz; czz += dz * dz; }
  const ang = 0.5 * Math.atan2(2 * cxz, cxx - czz);
  let tx = Math.cos(ang), tz = Math.sin(ang);
  if (tx < 0) { tx = -tx; tz = -tz; }
  // Front normal perpendicular to tangent, facing +z (reader)
  let nx = -tz, nz = tx;
  if (nz < 0) { nx = -nx; nz = -nz; }
  const proj = band.map(p => ({ s: (p.x - mx) * tx + (p.z - mz) * tz, n: (p.x - mx) * nx + (p.z - mz) * nz })).sort((a, b) => a.s - b.s);
  const segs = [];
  let cur = [proj[0]];
  for (let i = 1; i < proj.length; i++) {
    if (proj[i].s - proj[i - 1].s > 0.035) { segs.push(cur); cur = [proj[i]]; }
    else cur.push(proj[i]);
  }
  segs.push(cur);
  return segs.map(seg => {
    const s0 = seg[0].s, s1 = seg[seg.length - 1].s, sm = (s0 + s1) / 2;
    const nm = seg.reduce((a, q) => a + q.n, 0) / seg.length;
    const len = Math.max(0.012, s1 - s0);
    return {
      cx: mx + sm * tx + nm * nx,
      cz: mz + sm * tz + nm * nz,
      x0: mx + s0 * tx + nm * nx, z0: mz + s0 * tz + nm * nz,
      x1: mx + s1 * tx + nm * nx, z1: mz + s1 * tz + nm * nz,
      len,
      yaw: Math.atan2(nx, nz),  // rotates local +Z to (nx, nz)
      nx, nz,
    };
  });
}

// Compute base span in puppet local space (for cast puppets and extras)
export function puppetBaseSpan(rootObj) {
  const prevScale = rootObj.scale.clone();
  if (Math.abs(prevScale.y) < 0.1) rootObj.scale.set(1, 1, 1);
  rootObj.updateMatrixWorld(true);
  const inv = rootObj.matrixWorld.clone().invert();
  const pts = [];
  rootObj.traverse(o => {
    if (!o.isMesh || !o.visible || o.userData?.contactShadow) return;
    for (const p of sampleMeshOpaque(o)) pts.push(p.applyMatrix4(inv));
  });
  rootObj.scale.copy(prevScale);
  rootObj.updateMatrixWorld(true);
  if (!pts.length) return { cx: 0, w: 0.05, minY: 0 };
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  const h = Math.max(0.01, maxY - minY), band = pts.filter(p => p.y < minY + Math.min(0.018, 0.18 * h));
  let x0 = Infinity, x1 = -Infinity;
  for (const p of band) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; }
  return { cx: (x0 + x1) / 2, w: Math.max(0.018, x1 - x0), minY };
}

export function buildPaperShadows(sp, fps = 24) {
  const m = sp.m || {}, stage = m.stage?.name || "day", baseOp = STAGE_OP[stage] ?? 0.42;
  const softSet = new Set(m.soft ?? []), atmoRe = /(mist|fog|haze|glow|ray|steam|smoke|cloud|sky|water|river|pond|stream|ripple|wave)/i;
  const skipNames = new Set([...(m.backdrop ?? []), ...(m.selflit ?? []), ...[...softSet].filter(n => atmoRe.test(n))]);
  const mergedSet = new Set(m.paperStatic?.hide ?? []);
  // Evaluate at open pose (sp.L0) so every flap and vfold stands upright
  sp.mixer.setTime(sp.L0 / fps);
  sp.root.updateMatrixWorld(true);

  // Measure left and right page tops + collect flat floor meshes for local height raycast
  const box = new THREE.Box3();
  const lp = sp.root.getObjectByName("leaf-page"), rp = sp.root.getObjectByName("page-right");
  const leftY = lp ? box.setFromObject(lp).max.y : sp.flat.max.y;
  const rightY = rp ? box.setFromObject(rp).max.y : 0.0003;
  const floorMeshes = [];
  sp.root.traverse(o => {
    if (!o.isMesh || o.userData?.contactShadow || /^paper-static/.test(o.name)) return;
    const b = box.setFromObject(o);
    if (b.max.y - b.min.y < 0.006 && b.max.y <= Math.max(leftY, rightY) + 0.006) floorMeshes.push(o);
  });
  const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), orig = new THREE.Vector3();
  const floorAt = (x, z) => {
    const defY = x < -0.001 ? leftY : rightY;
    orig.set(x, defY + 0.012, z);
    rc.set(orig, DOWN); rc.far = 0.025;
    const hit = rc.intersectObjects(floorMeshes, false)[0];
    return hit ? Math.max(defY, hit.point.y) : defY;
  };

  // Group all art-* meshes in sp.root by piece node
  const cardGroups = new Map();
  sp.root.traverse(o => {
    if (!o.isMesh || !/^art-/.test(o.material?.name ?? "") || /^paper-static/.test(o.name)) return;
    let g = o;
    while (g.parent && g.parent !== sp.root && g.parent !== sp.leaf && g.parent.name !== "rleaf") g = g.parent;
    if (!cardGroups.has(g)) cardGroups.set(g, []);
    cardGroups.get(g).push(o);
  });

  // 1. Seat foot-stripped "-wing" V-fold pieces whose geometry rests on the floor but whose erased glue foot left the painted wall floating
  sp.wingSeats = [];
  for (const [g, artMeshes] of cardGroups) {
    const name = g.name || artMeshes[0].name;
    if (skipNames.has(name) || sp.animated?.has(name) || mergedSet.has(name)) continue;
    const isWing = artMeshes.some(o => /^art-.*-wing(\.\d+)?$/.test(o.material?.name ?? ""));
    if (!isWing) continue;
    const geoBox = new THREE.Box3(); artMeshes.forEach(o => geoBox.expandByObject(o));
    if (geoBox.max.y - geoBox.min.y < 0.04) continue;
    const cx = (geoBox.min.x + geoBox.max.x) / 2, cz = (geoBox.min.z + geoBox.max.z) / 2;
    const fy = floorAt(cx, cz);
    if (geoBox.min.y > fy + 0.006) continue;  // genuinely placed off the floor: do not hide a page fault
    let drawnMinY = Infinity;
    for (const o of artMeshes) for (const p of sampleMeshOpaque(o, fy + 0.05)) if (p.y < drawnMinY) drawnMinY = p.y;
    const gap = drawnMinY - fy;
    if (gap > 0.0025 && gap < 0.04) {
      const drop = gap + 0.0004;
      sp.wingSeats.push({ g, y0: g.position.y, drop });
      g.position.y = g.position.y - drop;
      g.updateMatrixWorld(true);
    }
  }

  // 2. Build soft contact shadows for every standing paper card piece resting on the page
  const group = new THREE.Group();
  group.name = "paper-contact-shadows";
  sp.group.add(group);
  const cardShadows = [];
  for (const [g, artMeshes] of cardGroups) {
    const name = g.name || artMeshes[0].name;
    if (skipNames.has(name)) continue;
    const b = new THREE.Box3(); artMeshes.forEach(o => b.expandByObject(o));
    const heightM = b.max.y - b.min.y;
    if (heightM < 0.012) continue;  // flat floor card
    const pieceCenter = b.getCenter(new THREE.Vector3());
    const pieceFloor = floorAt(pieceCenter.x, pieceCenter.z);
    if (b.min.y - pieceFloor > 0.025) continue;  // hangs / floats in air (petals, clouds): never hide with a floor shadow
    const allPts = [];
    let pieceMinY = Infinity;
    for (const o of artMeshes) {
      for (const p of sampleMeshOpaque(o, pieceFloor + 0.055)) {
        if (p.y < pieceMinY) pieceMinY = p.y;
        allPts.push(p);
      }
    }
    if (!allPts.length || !isFinite(pieceMinY)) continue;
    if (pieceMinY - pieceFloor > 0.025) continue;
    const spansSpine = b.min.x < -0.01 && b.max.x > 0.01 && artMeshes.length > 1;
    const halves = spansSpine
      ? [allPts.filter(p => p.x <= 0.002), allPts.filter(p => p.x >= -0.002)].filter(h => h.length >= 2)
      : [allPts];
    const strips = [];
    for (const hpts of halves) {
      for (const st of baseStripsOf(hpts, pieceMinY, heightM)) {
        const fy = Math.max(floorAt(st.x0, st.z0), floorAt(st.cx, st.cz), floorAt(st.x1, st.z1));
        const w = st.len + Math.min(0.022, 0.28 * st.len);
        const d = THREE.MathUtils.clamp(0.20 * st.len, 0.018, 0.055);
        const cs = makeContactShadow(w, d, baseOp, name);
        // Centered directly on the card's base line (zero detached forward gap!)
        cs.position.set(st.cx, fy + 0.0005, st.cz);
        cs.rotation.y = st.yaw;
        group.add(cs);
        strips.push({ cs, fy, baseOp });
      }
    }
    if (strips.length) cardShadows.push({ g, name, merged: mergedSet.has(name), strips });
  }

  // 3. Build soft contact shadows for cast puppets (characters with model "puppet:...")
  const puppetShadows = [];
  for (const ch of sp.cast ?? []) {
    if (!ch.c?.model?.startsWith("puppet:")) continue;
    const span = puppetBaseSpan(ch.model);
    const s0 = ch.s0 ?? 1;
    const baseW = Math.max(0.028, span.w * s0 * 1.32);
    const d = THREE.MathUtils.clamp(baseW * 0.44, 0.018, 0.036);
    const cs = makeContactShadow(baseW, d, baseOp, ch.name);
    group.add(cs);
    puppetShadows.push({ ch, cs, cxOff: span.cx * s0, d, baseOp, floorAt });
  }

  // Restore pre-open pose
  for (const w of sp.wingSeats) { w.g.position.y = w.y0; w.g.updateMatrixWorld(true); }
  sp.mixer.setTime((sp.T1 - 1) / fps);
  sp.root.updateMatrixWorld(true);

  sp.paperShadows = { group, cardShadows, puppetShadows, floorAt, leftY, rightY };
}

export function updatePaperShadows(sp, isOpen, frame) {
  if (!sp) return;
  // Smoothly seat foot-stripped "-wing" V-folds during the final 12 frames of the page turn
  const openK = isOpen ? 1 : Math.max(0, Math.min(1, (frame - (sp.T1 - 12)) / 12));
  for (const w of sp.wingSeats ?? []) w.g.position.y = w.y0 - w.drop * openK;

  const ps = sp.paperShadows;
  if (!ps) return;
  ps.group.visible = isOpen;
  if (!isOpen) return;

  for (const c of ps.cardShadows) {
    // Hidden by an act? Note: paperStatic hides original nodes while paperOn is true, so static cards stay shown when paperOn is true
    const vis = c.merged ? (sp.paperOn ? true : c.g.visible) : c.g.visible;
    const lift = sp.lifts?.[c.name] ?? 0;
    const fade = Math.max(0, 1 - Math.max(0, lift) / 0.035);
    for (const s of c.strips) {
      s.cs.visible = vis && fade > 0.01;
      s.cs.material.opacity = s.baseOp * fade;
    }
  }
  for (const p of ps.puppetShadows) {
    const ch = p.ch, body = ch.body;
    const sc = Math.abs(body.scale.y);
    if (!body.visible || sc < 0.05 || ch.c.bob || ch.ride?.on) { p.cs.visible = false; continue; }
    const pos = body.position;
    const fy = p.floorAt(pos.x, pos.z);
    const lift = pos.y - fy;
    if (lift > 0.025 || lift < -0.02) { p.cs.visible = false; continue; }
    const fade = Math.max(0, 1 - Math.max(0, lift) / 0.03) * Math.min(1, sc / (ch.s0 || 1));
    p.cs.visible = fade > 0.01;
    p.cs.position.set(pos.x + p.cxOff * Math.sign(body.scale.x || 1), fy + 0.0005, pos.z);
    p.cs.material.opacity = p.baseOp * fade;
  }
}
