// front.js (L4): the front book of the ring, and two neighbours each side, are the SHELF's own model (web/shelf/bookmodel.js loadBook: the thick leather volume with ribbed spine, brass corners, clasp, gilt edges, ribbon and the
// printed cover plate), and the front one stands its pop-up (web/shelf/popup.js createPopup) up out of the cover. Books further back, and the shelves, stay the cheap instanced boxes.
// A show book (no tale yet) gets the same model with its own leather colour, gold tooling and emblem.
// Nothing is built while the books fly: prewarm(book) builds, compiles and uploads the five models (and Kapi's pop-up) BEFORE the ring opens (on hover, focus, and when idle at home), and they stay cached across opens.
// Every texture a model makes is reference-counted and disposed when the model is evicted, so the GPU count stays flat however many times the ring opens.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
import { loadBook } from "../../shelf/bookmodel.js";
import { createPopup } from "../../shelf/popup.js";

const POOL = 5, SHELF = new URL("../../shelf/", import.meta.url), WONDERS = new URL("../styles/epic/scene/sprites/wonders", import.meta.url).href, tick = () => new Promise(r => setTimeout(r, 0));
import { drawTitle } from "./titles.js";
export function createFront(THREE, { scene, camera, renderer, ring, books, reduced, getLang, getStill, say: say0 }) {
  let noted = false; const say = (t, s) => { noted = t != null; say0(t, s); }, clearNote = () => { if (noted) { noted = false; say0(null); } };  // only a note the ring itself set is cleared by the ring (the Wonder Hall's notes live outside it)
  const V = THREE.Vector3, RX = new THREE.Quaternion().setFromAxisAngle(new V(1, 0, 0), Math.PI / 2), gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), zero = new V(0, 0, 0);
  const lantern = new THREE.PointLight(0xffc16b, 0, 0.32, 2), front = new THREE.SpotLight(0xffe2b8, 0, 0.9, 0.22, 0.8, 2); scene.add(lantern, front, front.target);  // the shared candle and soft front light, moved into the awake pop-up
  const models = new Map(), building = new Map(), ref = new Map(); let list = null, atlas = null, kapiColor = null, kapiSpine = null, kapiOrm = null, dims = null, queue = Promise.resolve();
  const getList = async () => list ??= await fetch(new URL("popups.json", import.meta.url)).then(r => r.json()).catch(() => []);  // shortcut: popups.json is a copy of web/shelf/index.html's #books list, because the published shelf/index.html is only a redirect (no list: every book came out a show book, no pop-up); upgrade: let tools/books_json.mjs write it
  const img = u => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
  const cfgOf = e => ({ ...e, dir: new URL(e.dir, SHELF).href, voice: new URL(e.voice, SHELF).href, model: new URL(e.model, SHELF).href });
  const col = hex => new THREE.Color(hex);
  const owned = root => { const s = new Set(); root.traverse(o => { for (const mat of [o.material].flat()) if (mat) { s.add(mat); for (const v of Object.values(mat)) if (v?.isTexture) s.add(v); } }); return s; };  // materials and textures
  const hold = set => set.forEach(t => ref.set(t, (ref.get(t) ?? 0) + 1)), drop = set => set.forEach(t => { const n = (ref.get(t) ?? 1) - 1; if (n <= 0) { ref.delete(t); t.dispose(); } else ref.set(t, n); });

  // a show book's cover and spine: the shelf's own tooling, the leather recoloured, the title cartouche wiped and rewritten, an emblem in the picture window
  const recolour = (im, hex, w, h, fn) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(im, 0, 0, w, h); const d = x.getImageData(0, 0, w, h), px = d.data, L = col(hex).multiplyScalar(255);
    for (let i = 0; i < px.length; i += 4) { const r = px[i], g = px[i + 1], b = px[i + 2]; if (g > r * 1.1 && g > b * 1.05) { const k = Math.min(2, (r * .3 + g * .59 + b * .11) / 62); px[i] = Math.min(255, L.r * k); px[i + 1] = Math.min(255, L.g * k); px[i + 2] = Math.min(255, L.b * k); } }
    x.putImageData(d, 0, 0); fn?.(x, L); return c; };
  async function showTextures(b, i) {
    kapiColor ??= await img(new URL("books/kapi/color.webp", SHELF).href); kapiSpine ??= await img(new URL("books/kapi/spine-color.webp", SHELF).href);
    if (!atlas) atlas = await Promise.all([fetch(WONDERS + ".json").then(r => r.json()), img(WONDERS + ".webp")]).then(([j, im]) => ({ j: j.filter(s => s.kind < 4), im })).catch(() => ({ j: [], im: null }));
    const hex = b.spine || "#1f4a31", s = atlas.j[(i * 7 + 3) % Math.max(1, atlas.j.length)];
    const cover = recolour(kapiColor, hex, 960, 1280, (x, L) => { const lc = `rgb(${L.r | 0},${L.g | 0},${L.b | 0})`, dark = `rgb(${L.r * .35 | 0},${L.g * .35 | 0},${L.b * .35 | 0})`;
      x.fillStyle = dark; x.fillRect(160, 268, 646, 480); if (atlas.im && s) { x.save(); x.globalCompositeOperation = "lighter"; x.drawImage(atlas.im, s.x, s.y, s.w, s.h, 160 + (646 - 400) / 2, 268 + (480 - 400) / 2, 400, 400); x.restore(); }
      x.fillStyle = lc; x.beginPath(); x.roundRect(200, 800, 560, 320, 34); x.fill(); x.strokeStyle = "#e2b459"; x.lineWidth = 6; x.stroke(); const t = b.title?.en || "", lg = getLang();
      drawTitle(x, t || getStill(), t ? "en" : "x", 480, 818, 500, 284, { color: "#e9c273", maxBig: t ? 118 : 58, sub: t && lg !== "en" ? b.title[lg] ?? "" : "" });  // a show book: the cartouche says the tale is still being written, never an empty box
    });
    kapiOrm ??= await img(new URL("books/kapi/orm.webp", SHELF).href); const oc = document.createElement("canvas"); oc.width = kapiOrm.width; oc.height = kapiOrm.height; const ox = oc.getContext("2d"); ox.drawImage(kapiOrm, 0, 0); ox.fillStyle = "rgb(255,190,0)"; { const sx = oc.width / 960, sy = oc.height / 1280; ox.fillRect(200 * sx, 800 * sy, 560 * sx, 320 * sy); ox.fillRect(160 * sx, 268 * sy, 646 * sx, 480 * sy); }  // flat gloss where Kapi's title and picture window were
    const spine = recolour(kapiSpine, hex, 512, 1152);
    const tx = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t; };
    const orm = new THREE.CanvasTexture(oc); orm.flipY = false; return { cover: tx(cover), spine: tx(spine), orm, hex };
  }

  async function build(g) {
    const b = books.bookAt(g), list_ = await getList(), e = b && list_.find(q => q.id === b.id), baseId = e?.id ?? list_[0]?.id ?? "kapi";
    const B = await loadBook(THREE, gltf, baseId, "../../shelf/"), m = { g, B, group: B.group, panel: B.panel, ms: 1, pop: null, awake: false, depth: B.size.z, thick: B.size.y, width: B.size.x, show: !e };
    if (!e) { const T = await showTextures(b ?? { title: { en: "" } }, g); B.materials.cover.map = T.cover; B.materials.cover.normalMap = null; B.materials.cover.aoMap = B.materials.cover.roughnessMap = B.materials.cover.metalnessMap = T.orm; B.materials.spine.map = T.spine; B.materials.spine.normalMap = null; B.materials.leather.color.set(T.hex); B.plate.m.visible = false; B.materials.cover.needsUpdate = B.materials.spine.needsUpdate = true; }
    const box = new THREE.Box3().setFromObject(B.group), c = box.getCenter(new V()), sz = box.getSize(new V()); Object.assign(m, { cx: c.x, cz: c.z, width: sz.x, depth: sz.z });  // the whole book, spine and boards included
    dims ??= { w: sz.x, d: sz.z }; ring.setModel?.(dims);
    m.own = owned(B.group); hold(m.own);
    m.hitBox = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })); m.hitBox.position.copy(c); m.hitBox.userData.g = g; B.group.add(m.hitBox);
    if (e) { const cfg = cfgOf(e); m.pop = createPopup(THREE, scene, cfg, { size: B.panel.userData.size, reduced, book: B.group, lights: { lantern, front }, say, onEvent: () => {} }); B.panel.add(m.pop.group); m.cfg = cfg; await m.pop.load?.(); await m.pop.ready; }
    // compile its shaders and push its textures to the GPU now, in small steps, not while the books fly
    scene.add(m.group); m.group.visible = true; m.group.position.set(0, -50, 0); m.group.scale.setScalar(.1); m.group.updateMatrixWorld(true);
    try { await renderer.compileAsync(m.group, camera, scene); } catch { /* the first frame compiles it instead */ }
    const all = owned(B.group); for (const t of all) if (t.isTexture) { try { renderer.initTexture(t); } catch { /* ignore */ } await tick(); }
    m.group.visible = false; m.ready = true; models.set(g, m); return m;
  }
  function free(m) { m.pop?.sleep(true); m.pop?.dispose(); m.group.removeFromParent(); drop(m.own); m.hitBox.geometry.dispose(); m.hitBox.material.dispose(); models.delete(m.g); }

  // the models a book at the front of the ring needs: itself and two each side (the ring order within its case)
  const neighbours = g => { const ci = books.slots[g].case, ids = []; books.slots.forEach((s, i) => { if (s.case === ci) ids.push(i); }); const j = ids.indexOf(g); return [0, 1, -1, 2, -2].map(k => ids[(j + k + ids.length) % ids.length]); };
  function prewarm(g) {  // resolves when the five models exist, compiled and uploaded; calling it again is free
    const want = neighbours(g), key = new Set(want);
    for (const [k, m] of [...models]) if (!key.has(k) && !ring.isOpen) free(m);  // another case: let the old models go (their textures are freed)
    const jobs = want.map(w => models.has(w) ? Promise.resolve(models.get(w)) : building.get(w) ?? (() => { const p = (queue = queue.then(() => build(w)).catch(err => console.warn("front: model failed", err))); building.set(w, p); p.finally(() => building.delete(w)); return p; })());
    return Promise.all(jobs);
  }
  function hide() { for (const m of models.values()) { m.group.visible = false; if (m.awake) { m.awake = false; m.pop.sleep(true); } } lantern.intensity = front.intensity = 0; clearNote(); }

  function place(m, pose) {  // the model lies cover-up in its own space; rotate its cover normal onto the box's front normal, scale its depth to the box's height, centre the whole book (spine too) and sink it so the cover face meets the box face
    const n = new V(0, 0, 1).applyQuaternion(pose.q), ms = pose.s.y / m.depth; m.ms = ms;
    m.group.quaternion.copy(pose.q).multiply(RX); m.group.scale.setScalar(ms);
    m.group.position.copy(pose.p).addScaledVector(n, pose.s.z / 2 - m.thick * ms * .55).addScaledVector(new V(1, 0, 0).applyQuaternion(m.group.quaternion), -m.cx * ms).addScaledVector(new V(0, 0, 1).applyQuaternion(m.group.quaternion), -m.cz * ms); m.group.updateMatrixWorld(true);
  }
  function update(dt) {
    if (!ring.isOpen) { hide(); return; }
    const want = ring.near(2.6), keep = new Set(want.map(q => q.g));
    for (const q of want.sort((a, b) => a.a - b.a)) if (!models.has(q.g) && !building.has(q.g)) prewarm(q.g);  // swiping to a book whose models are not there yet
    if (models.size > POOL) for (const [g, m] of models) if (!keep.has(g) && models.size > POOL) free(m);
    const fp = ring.frontPose();
    for (const [g, m] of models) { const q = want.find(w => w.g === g); if (!q) { m.group.visible = false; if (m.awake) { m.awake = false; m.pop.sleep(true); } continue; } m.group.visible = true; place(m, q.pose); books.set(g, q.pose.p, q.pose.q, zero);
      if (m.pop) { const isFront = fp && fp.global === g && fp.w > .95 && ring.settled || (ring.picked === g);
        if (isFront && !m.awake) { m.awake = true; try { localStorage.setItem(`${m.cfg.who}.lang`, getLang() === "en" ? "" : getLang()); } catch { /* no storage */ } m.pop.wake(); }
        else if (!isFront && m.awake && ring.picked < 0) { m.awake = false; m.pop.sleep(); clearNote(); }
        if (m.pop.built) { m.pop.update(dt, 0); const pm = m.B.plate.m.material; pm.opacity = 1 - Math.min(1, m.pop.P * 2.4); pm.emissiveIntensity = 0; const k = m.ms; if (m.awake) { lantern.intensity *= k * k; front.intensity *= k * k; lantern.distance = .32 * k; front.distance = .9 * k; } else lantern.intensity = front.intensity = 0; }
      } }
  }
  function disposeAll() { for (const m of [...models.values()]) free(m); lantern.intensity = front.intensity = 0; clearNote(); }
  return { update, prewarm, disposeAll, hitTargets: () => [...models.values()].filter(m => m.group.visible).map(m => m.hitBox), get count() { return models.size; }, models };
}
