// bookbody.js: the open book's body under every spread: the shelf's own open leather book (web/shelf/book-open.glb through bookmodel.js's loadOpenBook,
// the same generator and materials as the shelf's closed book, its look from ../shelf/books/<id>/cover.json), scaled by the spread's measured page
// width and set under the paper. It is fetched after the spread's first frames and never blocks one. Until it arrives, or if the files are missing
// (one console line), two plain boxes stand in so the paper is never flat on the desk.
export function makeBody(THREE, scene, { book, phone, loader }) {
  const group = new THREE.Group(); group.name = "bookbody"; scene.add(group);
  let model = null, last = null, sig = "";
  const fallback = () => {  // shortcut: two plain boxes (a board and a page block), no gilt, no ribbon; upgrade by shipping the shelf's glb
    const m = new THREE.MeshStandardMaterial({ color: "#2a1c14", roughness: 0.7 }), g = new THREE.Group();
    for (const x of [-0.5, 0.5]) g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.11, 1.4).translate(x * 1.0, -0.055, 0), m), { receiveShadow: true, castShadow: true }));
    return g;
  };
  const place = sp => { group.scale.setScalar(sp.pageW); group.position.y = sp.flat.min.y; group.updateMatrixWorld(true); return new THREE.Box3().setFromObject(group).min.y; };
  const body = {
    group, onload: null,
    fit(sp) { last = sp; return model ? place(sp) : sp.bottom; },  // the y the desk should sit at: the body's bottom
    dress() { return (dressed ??= load()); },  // once the spread has drawn (the arrival asks for it at once); one load however often it is asked
  };
  let dressed = null;
  const load = async () => {
      if (model) return;
      try {
        const { loadOpenBook } = await import("../shelf/bookmodel.js"), o = await loadOpenBook(THREE, loader, book, "../shelf/");
        if (phone) o.group.traverse(m => m.isMesh && m.material.normalMap && (m.material.normalMap = null, m.material.needsUpdate = true));  // no normal maps on a phone
        model = o.group; Object.assign(body, { left: o.left ?? model.getObjectByName("left"), strap: o.strap ?? model.getObjectByName("strap"), closedAngle: o.closedAngle ?? -Math.PI, strapOpen: o.strapOpen ?? Math.PI / 2 });  // the hinged left half (rotation.z = closedAngle lays it over the right: the closed book) and the clasp
      } catch (e) { console.warn(`bookbody: no open book model for ${book} (${e.message}), plain boxes`); model = fallback(); }
      group.add(model); if (last) body.onload?.(last);
  };
  return body;
}
