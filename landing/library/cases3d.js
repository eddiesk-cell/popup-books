// cases3d.js: our 4 home bookcases as REAL 3D (room.json `models`: { id: "cases", glb, glbPhone, p }) in place of painted cards; the model's own 48 slots are room.json's `cases`. The glb is baked and unlit (meshopt),
// in the room's metres with the cases standing on z 0 facing +z; `poses` (grow.js) turns each case_i onto its facet of the round wall. Every other set is a clone of the same model (shared geometry and
// materials) with its four cases posed onto that set's facets the same way ({from, to, ry, sx}: sx narrows a case to a side bay). No cases.glb: returns null, nothing changes.
//   const c3 = await loadCases3d(THREE, scene, room, base, { phone, sets: [[pose x4], ...] });     c3.group is the home set; c3.clones the others; c3.dispose() frees them
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
export async function loadCases3d(THREE, scene, room, base, { phone = false, sets = [] } = {}) {
  const cfg = room.models?.find(m => m.id === "cases") ?? room.cases3d; if (!cfg) return null;
  const url = new URL((phone && cfg.glbPhone) || cfg.glb || "cases.glb", base), gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url.href).catch(err => { console.warn("library: cases.glb failed, no 3D cases", err); return null; });
  if (!gltf) return null;
  const group = gltf.scene; group.name = "cases3d"; group.position.set(...(cfg.p ?? [0, 0, 0])); scene.add(group);
  const Y = new THREE.Vector3(0, 1, 0), pose = (g, poses) => poses.forEach(({ from, to, ry, sx = 1 }, i) => { const n = g.getObjectByName("case_" + i); if (!n) return; n.userData.p0 ??= n.position.toArray(); n.userData.r0 ??= n.rotation.y; n.userData.s0 ??= n.scale.x;  // onto its facet of the tower (grow.js); the model's own place kept as numbers (a clone copies userData as JSON)
    const d = new THREE.Vector3(...n.userData.p0).sub(new THREE.Vector3(...from)); d.x *= sx; n.position.copy(d.applyAxisAngle(Y, ry).add(new THREE.Vector3(...to))); n.rotation.y = n.userData.r0 + ry; n.scale.x = n.userData.s0 * sx; });  // the model's own scale kept (its cases are stored scaled)
  pose(group, cfg.poses ?? []);
  const clones = sets.map(p => { const g = group.clone(true); pose(g, p); scene.add(g); return g; });
  return { group, clones, dispose() { for (const g of [group, ...clones]) g.removeFromParent(); group.traverse(o => { o.geometry?.dispose(); for (const m of [o.material].flat()) if (m) { for (const v of Object.values(m)) v?.isTexture && v.dispose(); m.dispose(); } }); } };
}
