// cases3d.js: our 4 home bookcases as REAL 3D (room.json `models`: { id: "cases", glb, glbPhone, p }) in place of painted cards; the model's own 48 slots are room.json's `cases`. The glb is baked and unlit (meshopt),
// in the room's metres with the cases standing on z 0 facing +z; `poses` (grow.js) turns each case_i onto its facet of the round wall. Station sets are clones of the same model (shared geometry and materials) moved by the set's offset. No cases.glb: returns null, nothing changes.
//   const c3 = await loadCases3d(THREE, scene, room, base, { phone, offsets: [[dx,dy,dz], ...] });     c3.group is the home set; c3.clones the others; c3.dispose() frees them
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
export async function loadCases3d(THREE, scene, room, base, { phone = false, offsets = [] } = {}) {
  const cfg = room.models?.find(m => m.id === "cases") ?? room.cases3d; if (!cfg) return null;
  const url = new URL((phone && cfg.glbPhone) || cfg.glb || "cases.glb", base), gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url.href).catch(err => { console.warn("library: cases.glb failed, no 3D cases", err); return null; });
  if (!gltf) return null;
  const group = gltf.scene; group.name = "cases3d"; group.position.set(...(cfg.p ?? [0, 0, 0])); scene.add(group);
  (cfg.poses ?? []).forEach(({ from, to, ry }, i) => { const n = group.getObjectByName("case_" + i); if (!n) return; const d = n.position.clone().sub(new THREE.Vector3(...from)).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);  // on the tower's curve (grow.js onTower)
    n.position.copy(d.add(new THREE.Vector3(...to))); n.rotation.y += ry; });
  const clones = offsets.map(o => { const g = group.clone(true); g.position.set(group.position.x + o[0], group.position.y + o[1], group.position.z + o[2]); scene.add(g); return g; });
  return { group, clones, dispose() { for (const g of [group, ...clones]) g.removeFromParent(); group.traverse(o => { o.geometry?.dispose(); for (const m of [o.material].flat()) if (m) { for (const v of Object.values(m)) v?.isTexture && v.dispose(); m.dispose(); } }); } };
}
