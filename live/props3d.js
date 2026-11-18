// props3d.js — code-built 3D props (BOOK-STANDARD "Code-built 3D props", Eddie 2026-11-17): a prop is a row of data, the shapes are shared by every book.
// A row of a spread's "props" (live.js props()) with a "recipe" or "parts" is built here; one without stays a stand-in shape.
//   name     the node's name: acts (hold, ride, stand on) and taps find it by it (live.js propIn)
//   at, rot  its origin on the page [x, y, z] (z up) and its turn about z in degrees, as the stand-ins; scale: one number
//   lay      [x, y, z] degrees about the page's x, then y, then z: the whole prop lying or leaning at rest (a flute flat in the grass: "lay": [0, 90, 0]); `rot` then turns it about z. A hold act's "lay" does the same where it is set down (acts.js)
//   tex      the prop's painted atlas (one picture, so one material and one draw): "cards/..." from web/live/, "assets/...", or "/..." from the site root
//   color    [r, g, b] without a tex; rough: roughness (0.85); cut: true lets the atlas's alpha cut holes (a knot's lattice)
//   nodes    {"hold_grip": [x, y, z], "hold_tip": [x, y, z], ...}: empties in the prop, which acts.js reads when it is held
//   recipe   one shape, its fields on the row; or "parts": [{recipe, ...}, ...] merged into one mesh
// A recipe, in page axes (z up), metres; "at" [x, y, z] and "turn" [x, y, z] (degrees about x, then y, then z) place a part in the prop;
// "uv" [x0, y0, x1, y1] is its rectangle of the atlas, 0 to 1 from the top left (the whole atlas without it):
//   lathe    "profile": [[r, z, v?], ...] turned about z. The rectangle is its visible half, left to right, mirrored behind; its height runs
//            along the profile, bottom (0) to top (1), by length, or pinned where a point gives its v
//   tube     "path": [[x, y, z], ...] swept round with radius "r" ("closed": a loop, a thread wound round); the rectangle's height runs along the path, its width round it
//   outline  "outline": [[x, z], ...] and "holes": [[[x, z], ...]], a front-view outline "depth" thick along y with a "bevel"; the rectangle is
//            its picture from the front, laid over the outline's box
//   box      "size": [x, y, z] centred, "bevel" (12% of its smallest side); the rectangle on every face
//   "map": "top" lays the rectangle from above (the seeds in a bowl), "front" from the reader; "seg": segments round a lathe or along a tube
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const LO = innerWidth < 600;  // a phone: half the segments
const B = ([x, y, z]) => new THREE.Vector3(x, z, -y), rad = THREE.MathUtils.degToRad;
const tri = t => 1 - Math.abs(1 - (((t % 2) + 2) % 2));  // 0..1..0: a rectangle mirrored round, its folds on vertices (segment counts are multiples of 4)
const geos = new Map(), texs = new Map(), loader = new THREE.TextureLoader();
const AXES = [[1, 0, 0], [0, 0, -1], [0, 1, 0]].map(a => new THREE.Vector3(...a));  // the page's x, y, z in three
export const layQ = (t = [0, 0, 0], q = new THREE.Quaternion()) => (t.forEach((a, k) => q.premultiply(new THREE.Quaternion().setFromAxisAngle(AXES[k], rad(a)))), q);  // degrees about the page's x, then y, then z

function shape(r) {  // one recipe in its own axes (three: y up), its uv 0-1 before the rectangle
  let g, map = r.map;
  if (r.recipe === "lathe") {
    const n = r.seg ?? (LO ? 12 : 24), pts = r.profile.map(([x, z]) => new THREE.Vector2(x, z)), np = pts.length;
    g = new THREE.LatheGeometry(pts, n);
    let s = 0; const L = pts.map((p, j) => (s += j ? p.distanceTo(pts[j - 1]) : 0));  // length along the profile
    const pin = r.profile.map((p, j) => [j, p[2] ?? (j ? (j === np - 1 ? 1 : null) : 0)]).filter(p => p[1] != null);
    const v = L.map((l, j) => { const k = pin.findIndex(p => p[0] >= j), [b, vb] = pin[k]; if (b === j) return vb; const [a, va] = pin[k - 1]; return va + (vb - va) * (l - L[a]) / (L[b] - L[a]); });
    const uv = g.attributes.uv;
    for (let i = 0; i <= n; i++) for (let j = 0; j < np; j++) uv.setXY(i * np + j, tri((i / n + 0.25) * 2), v[j]);  // i = 0 faces the reader: the rectangle's middle
  } else if (r.recipe === "tube") {
    const n = r.seg ?? (LO ? 16 : 32), m = LO ? 6 : 8;
    g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r.path.map(B), !!r.closed, "centripetal"), n, r.r, m, !!r.closed);
    const uv = g.attributes.uv;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) uv.setXY(i * (m + 1) + j, tri(2 * j / m), i / n);
  } else {
    const box = r.recipe === "box", [sx, sy, sz] = r.size ?? [0, r.depth ?? 0.004, 0];
    const b = r.bevel ?? (box ? 0.12 * Math.min(sx, sy, sz) : 0), d = Math.max(1e-5, sy - 2 * b), v2 = ([x, z]) => new THREE.Vector2(x, z);
    const sh = new THREE.Shape(box ? [[-sx / 2 + b, -sz / 2 + b], [sx / 2 - b, -sz / 2 + b], [sx / 2 - b, sz / 2 - b], [-sx / 2 + b, sz / 2 - b]].map(v2) : r.outline.map(v2));
    for (const h of r.holes ?? []) sh.holes.push(new THREE.Path(h.map(v2)));
    g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: box ? 0 : -b, bevelSegments: LO ? 1 : 2, curveSegments: 4 }).translate(0, 0, -d / 2);
    map ??= box ? "box" : "front";
  }
  if (map) {  // planar: from the reader, from above, or each face from its own side
    g.computeBoundingBox();
    const { min, max } = g.boundingBox, s = max.clone().sub(min).max(new THREE.Vector3(1e-6, 1e-6, 1e-6)), p = g.attributes.position, nm = g.attributes.normal, uv = g.attributes.uv;
    const f = [(x, y) => [(x - min.x) / s.x, (y - min.y) / s.y], (x, y, z) => [(x - min.x) / s.x, (max.z - z) / s.z], (x, y, z) => [(z - min.z) / s.z, (y - min.y) / s.y]];
    const pick = i => { const n = [nm.getX(i), nm.getY(i), nm.getZ(i)].map(Math.abs); return n[2] >= n[0] && n[2] >= n[1] ? 0 : n[1] >= n[0] ? 1 : 2; };
    for (let i = 0; i < p.count; i++) uv.setXY(i, ...f[map === "front" ? 0 : map === "top" ? 1 : pick(i)](p.getX(i), p.getY(i), p.getZ(i)));
  }
  const [x0, y0, x1, y1] = r.uv ?? [0, 0, 1, 1], uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, x0 + uv.getX(i) * (x1 - x0), 1 - y1 + uv.getY(i) * (y1 - y0));
  const q = new THREE.Quaternion();
  g.applyQuaternion(layQ(r.turn, q)).translate(...B(r.at ?? [0, 0, 0]).toArray()).clearGroups();
  return g.index ? g.toNonIndexed() : g;
}

const picture = url => texs.get(url) ?? texs.set(url, loader.loadAsync(url.replace(/^\/?web\/live\//, "").replace(/^assets\//, "../assets/"))  // page-relative: the viewer's page is web/live/index.html
  .then(t => Object.assign(t, { colorSpace: THREE.SRGBColorSpace, anisotropy: 4 })).catch(e => (console.warn("props3d: no picture", url, e?.message ?? e), null))).get(url);

export async function codeProp(p) {  // -> a Mesh named p.name, its texture loaded (the spread waits for it behind its loading cover)
  const { name, at, rot, lay, scale, nodes, tex, color, rough, cut, ...one } = p, parts = p.parts ?? [one], key = JSON.stringify([LO, parts]);
  if (!geos.has(key)) geos.set(key, mergeGeometries(parts.map(shape)));  // one geometry per recipe, shared by every copy of the prop
  const map = tex ? await picture(tex) : null;
  const mesh = new THREE.Mesh(geos.get(key), new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : new THREE.Color(...(color ?? [0.8, 0.68, 0.5])), roughness: rough ?? 0.85, alphaTest: cut ? 0.5 : 0 }));
  mesh.name = name; mesh.position.copy(B(at ?? [0, 0, 0])); mesh.quaternion.setFromAxisAngle(AXES[2], rad(rot || 0)).multiply(layQ(lay)); mesh.scale.setScalar(scale ?? 1);
  for (const [k, v] of Object.entries(nodes ?? {})) { const o = new THREE.Object3D(); o.name = k; o.position.copy(B(v)); mesh.add(o); }
  return mesh;
}
