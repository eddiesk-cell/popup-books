// bookmodel.js — the closed leather book, shared by the shelf page and the reader. No page state, no loops, no DOM beyond two small canvases.
//   loadBook(THREE, loader, id, base) -> { group, cover, strap, panel, plate, materials, size }
//     THREE   the caller's three module (so both pages use their own instance); loader a GLTFLoader with the meshopt decoder set; id "kapi" | "mali" | ...; base the path to web/shelf/ ("" on the shelf, "../shelf/" from the reader).
//     group   the closed book (mesh + leather + gold + brass + gilt + ribbon + the tooled cover + its plate), spine along -x, cover on top, origin on the table under the book's middle, 0.116 m thick
//     cover   the cover board's node, origin on its hinge (the spine side): rotation.z 0 = closed, +112 deg (1.955 rad) = open flat-ish, as the shelf's old opening did (rad(112) eased over 1.25 s, then a 0.035 rad settle). The book is lying face up with the spine to -x.
//     strap   the clasp strap, origin on its pivot (the back board's fore-edge): rotation.z 0 = latched, -78 deg (-1.361 rad) = released (turn it before the cover).
//     panel   the cover's picture recess (userData.size [w,d], recess) where a pop-up may stand
//     plate   { m } the varnished plate mesh lying flush in the recess (m.material.opacity / emissiveIntensity are free to animate)
//     materials  the named materials (cover, spine, leather, gold, brass, gilt, endpaper, band, ribbon, paper) so a caller can recolour or light them
//     size    THREE.Vector3 of the closed book's bounding box
//   loadOpenBook(THREE, loader, id, base) -> { group, materials, pageTop, left, strap, plate, closedAngle, strapOpen }   the same book lying open flat: units are PAGE WIDTHS (1.0 wide, 1.333 deep, the reader's paper), origin on the fold line at the paper's
//     underside, the page blocks' top faces at y = pageTop = 0, z + toward the reader/tail. Same named materials, so the same textures and the book's colours apply. Made by tools/shelf_book.py (book-open.glb).
//     HINGED: `left` (origin on the fold line at the page tops) holds the left board, page block and spine piece: left.rotation.z = 0 is open flat, left.rotation.z = closedAngle (-PI) folds it face down onto the right half = the closed book
//     (spine at -x, tooled cover and `plate` up, gilt edges, ribbon); in between the spine stays whole by itself. `strap` is hidden while flat and, once folded, latched across the cover at rotation.z 0 (released: `strapOpen` = +PI/2, which tucks it into the back board out of sight; loadBook's closed book releases outward at -1.361).
// A book's colours come from <base>books/<id>/cover.json ({leather, gold, ribbon, title}), written by tools/shelf_tex.py from the book's own entry; the shared textures live beside this file.
const PAPER = "#f1efe5";  // shortcut: set by eye-and-measure against the reader's title spread (tools/shelf_paper7.mjs); re-measure if the reader's light changes
const S = new Map();  // per base: the textures and glbs every book shares
const shared = (THREE, loader, base) => S.get(base) ?? (S.set(base, (async () => {
  const tl = new THREE.TextureLoader(), tex = (u, srgb, flip = false, rep = false) => tl.loadAsync(base + u).then(t => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.flipY = flip; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });
  const [glb, lcol, lnor, lorm, gcol, gnor, bcol, bnor, borm] = await Promise.all([loader.loadAsync(base + "book.glb"), tex("leather-color.webp", 1, false, true), tex("leather-normal.webp", 0, false, true), tex("leather-orm.webp", 0, false, true), tex("gilt-color.webp", 1, false, true), tex("gilt-normal.webp", 0, false, true), tex("brass-color.webp", 1, false, true), tex("brass-normal.webp", 0, false, true), tex("brass-orm.webp", 0, false, true)]);
  const orm = (m, t) => Object.assign(m, { aoMap: t, roughnessMap: t, metalnessMap: t, roughness: 1, metalness: 1 });
  return { glb, lcol, lnor, lorm, orm, tex, brass: orm(new THREE.MeshStandardMaterial({ map: bcol, normalMap: bnor }), borm), gilt: new THREE.MeshStandardMaterial({ map: gcol, normalMap: gnor, color: 0xfff0c8, metalness: 0.8, roughness: 0.36 }), endpaper: new THREE.MeshStandardMaterial({ color: 0x4a1410, roughness: 0.85 }) };
})()), S.get(base));
const titlePaper = (THREE, c) => {  // shortcut: titles are Latin, so Noto Sans Lao (Lao-only range) is first in the stack but never fetched here; wait on document.fonts.load('16px "Noto Sans Lao"') if a title ever carries Lao. The closed book's title page (it shows only when the cover swings open on the shelf); the open book has plain paper
  const pc = document.createElement("canvas"); pc.width = 480; pc.height = 640; { const x = pc.getContext("2d"), g = x.createRadialGradient(240, 330, 40, 240, 330, 400);  // the title page: warm paper, a fine frame, the title
    g.addColorStop(0, "#f3e6c6"); g.addColorStop(1, "#c9b283"); x.fillStyle = g; x.fillRect(0, 0, 480, 640); x.strokeStyle = "#8a6a2c"; x.lineWidth = 2; x.strokeRect(36, 36, 408, 568); x.lineWidth = 1; x.strokeRect(46, 46, 388, 548);
    x.fillStyle = "#5b3d14"; x.textAlign = "center"; x.font = '700 34px "Noto Sans Lao", Andika, sans-serif'; x.fillText(c.title.split(" and ")[0] + " and", 240, 270);
    let fs = 52; const l2 = "the " + c.title.split(" the ")[1]; do x.font = `700 ${fs}px "Noto Sans Lao", Andika, sans-serif`; while (x.measureText(l2).width > 400 && (fs -= 2)); x.fillText(l2, 240, 336); }
  const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; pt.flipY = false;
  return new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9, emissive: 0xffb561, emissiveMap: pt, emissiveIntensity: 0 });
};
async function materials(THREE, loader, id, base) {  // the book's named materials: shared ones from the first call, its own from its folder
  const SH = await shared(THREE, loader, base), D = `books/${id}/`, c = await fetch(`${base}${D}cover.json`).then(r => r.json()), m = {}, orm = SH.orm;
  const [ccol, cnor, corm, scol, snor, sorm] = await Promise.all([SH.tex(D + "color.webp", 1), SH.tex(D + "normal.webp"), SH.tex(D + "orm.webp"), SH.tex(D + "spine-color.webp", 1), SH.tex(D + "spine-normal.webp"), SH.tex(D + "spine-orm.webp")]);
  m.cover = orm(new THREE.MeshStandardMaterial({ map: ccol, normalMap: cnor }), corm); m.spine = orm(new THREE.MeshStandardMaterial({ map: scol, normalMap: snor }), sorm);
  m.leather = orm(new THREE.MeshStandardMaterial({ color: c.leather, map: SH.lcol, normalMap: SH.lnor, normalScale: new THREE.Vector2(1.2, 1.2) }), SH.lorm);
  m.gold = new THREE.MeshStandardMaterial({ color: c.gold, metalness: 1, roughness: 0.3 }); m.brass = SH.brass; m.gilt = SH.gilt; m.endpaper = SH.endpaper;
  m.band = new THREE.MeshStandardMaterial({ color: c.ribbon, roughness: 0.8 }); m.ribbon = new THREE.MeshStandardMaterial({ color: c.ribbon, roughness: 0.55, side: THREE.DoubleSide });
  return { m, SH, D, c };
}
const plateMesh = (THREE, pcol, w, d) => {  // the cover's picture: a varnished colour plate flush with the leather; its gold fillet is an emissive ring
  const ring = document.createElement("canvas"); ring.width = 256; ring.height = 192; const rx = ring.getContext("2d"); rx.strokeStyle = "#fff"; rx.lineWidth = 5; rx.strokeRect(3, 3, 250, 186);
  return { m: new THREE.Mesh(new THREE.PlaneGeometry(w + 0.0006, d + 0.0006), new THREE.MeshPhysicalMaterial({ map: pcol, color: 0x858078, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.3, emissive: 0xffa83a, emissiveMap: new THREE.CanvasTexture(ring), emissiveIntensity: 0, transparent: true, depthTest: false })) };
};
export async function loadBook(THREE, loader, id, base) {
  const { m, SH, D, c } = await materials(THREE, loader, id, base), group = SH.glb.scene.clone(true), pcol = await SH.tex(D + "plate.webp", 1, true);
  m.paper = titlePaper(THREE, c); group.traverse(o => { if (o.isMesh) { o.material = m[o.material.name] || o.material; o.castShadow = o.receiveShadow = true; } });
  const panel = group.getObjectByName("panel"), [w, d] = panel.userData.size, plate = plateMesh(THREE, pcol, w, d);
  plate.m.rotation.x = -Math.PI / 2; plate.m.position.y = panel.userData.recess + 0.0001; plate.m.renderOrder = 5; panel.add(plate.m);
  return { group, cover: group.getObjectByName("cover"), strap: group.getObjectByName("strap"), panel, plate, materials: m, size: new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()) };
}
export async function loadOpenBook(THREE, loader, id, base) {
  const { m, SH, D } = await materials(THREE, loader, id, base), group = (await loader.loadAsync(base + "book-open.glb")).scene, pcol = await SH.tex(D + "plate.webp", 1, true);
  m.paper = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.9 });  // plain paper in the reader's own paper colour: the reader's sheet lies on it, so nothing swaps when the half lands
  group.traverse(o => { if (o.isMesh) { o.material = m[o.material.name] || o.material; o.castShadow = o.receiveShadow = true; } });
  const left = group.getObjectByName("left"), mid = group.getObjectByName("spinemid"), caps = ["caps_right", "caps_left"].map(n => group.getObjectByName(n)), strap = group.getObjectByName("strap");
  const plate = plateMesh(THREE, pcol, 0.7, 0.525), ZB = 0.7165, x = new THREE.Vector3(-1, 0, 0), y = new THREE.Vector3(0, 0, -1), z = new THREE.Vector3(0, -1, 0);  // on the left board's OUTSIDE (it faces down when open), upright once folded
  plate.m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); plate.m.position.set(-0.525, -0.2033, -0.2 * ZB); plate.m.material.depthTest = true; left.add(plate.m);
  const upd = group.updateMatrixWorld.bind(group); strap.visible = false;
  group.updateMatrixWorld = f => { const t = Math.min(1, Math.max(0, -left.rotation.z / Math.PI)), s = Math.min(1, Math.max(0, (t - 0.2) / 0.5)); mid.rotation.z = left.rotation.z / 2; for (const c of caps) { c.scale.set(s, s, 1); c.visible = s > 0.01; } strap.visible = t > 0.02; upd(f); };  // the middle of the spine turns half the angle; the outer end caps grow in as it closes; the strap shows once the book is no longer flat
  return { group, materials: m, pageTop: 0, left, strap, plate, closedAngle: -Math.PI, strapOpen: Math.PI / 2 };  // strapOpen: released, the strap tucks into the back board, out of sight (the shelf's closed book releases it at -78 deg, outward)
}
