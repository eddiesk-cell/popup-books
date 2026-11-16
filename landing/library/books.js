// books.js: the room's books as ONE instanced mesh (12 triangles each) and ONE cover atlas (a canvas, a per-instance UV offset).
// Real books (books.json, status "ready") take the first slots; every other slot is a SHOW book: leather, a gold frame, a gold-foil emblem from the first page's wonders atlas.
// shortcut: a plain 3-part box (cover, spine, page block); shelf/book.glb is 21,950 triangles each (1.05 M for 48), far over the 100k budget. Upgrade: a rounded-spine mesh if close-ups (L4) need it.
const LEATHER = ["#5b1f26", "#1f4a31", "#1d3557", "#4a2a5c", "#6b4423", "#1c5a5a", "#7a3b1d", "#3a2a1a", "#5a1e3c", "#2f4a2a", "#4a3b1d", "#2a3a5e"];
const WONDERS = new URL("../styles/epic/scene/sprites/wonders", import.meta.url).href;
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function boxGeo(THREE) {  // unit box; aPart 0 = the cover face (atlas cell), 1 = leather (a plain patch of the cell), 2 = page edges
  const P = [], N = [], U = [], A = [];
  const face = (n, part, c) => { const [a, b, d, e] = c; for (const i of [0, 1, 2, 0, 2, 3]) { const v = [a, b, d, e][i]; P.push(...v); N.push(...n); U.push(...(part ? [.03, .5] : [[0, 0], [1, 0], [1, 1], [0, 1]][i])); A.push(part); } };
  const h = .5;
  face([0, 0, 1], 0, [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]]);
  face([0, 0, -1], 1, [[h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]]);
  face([-1, 0, 0], 1, [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]]);
  face([1, 0, 0], 2, [[h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h]]);
  face([0, 1, 0], 2, [[-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h]]);
  face([0, -1, 0], 2, [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setAttribute("aPart", new THREE.Float32BufferAttribute(A, 1));
  return g;
}

// FULL SHELVES: slot sizes come from room.json and are never hard-coded here. Each book is stretched to fill its slot's row: as wide as the pitch to its
// neighbour (edge to edge), as tall as the space up to the ledge above (the top row takes the row below's height), standing on the same ledge as before.
function fit(room) {
  const out = [];
  room.cases.forEach((c, ci) => {
    const rows = [...new Set(c.slots.map(s => s.p[1]))].sort((a, b) => b - a), bottom = y => { const s = c.slots.find(q => q.p[1] === y); return y - s.size[1] / 2; };
    const avail = rows.map((y, i) => i ? bottom(rows[i - 1]) - bottom(y) - .05 : 0); avail[0] = avail[1] ?? c.slots[0].size[1];
    const xs = [...new Set(c.slots.map(s => s.p[0]))].sort((a, b) => a - b), pitch = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : c.slots[0].size[0];
    for (const s of c.slots) { const r = rows.indexOf(s.p[1]), w = pitch - .004, h = Math.min(avail[r], w * 1.9), b = bottom(s.p[1]); out.push({ ...s, case: ci, w, h, d: s.size[2] - .02, y: b + h / 2 }); }
  });
  return out;
}

// centre-first fill: within a set (4 cases) the first books take the top rows of the two middle cases from the middle outwards, then their middle rows, then the bottom rows, then the two outer cases the same way,
// so the real books are the first thing seen on every screen, a phone included.
function centreFirst(slots, idx) {
  const cx = idx.reduce((a, i) => a + slots[i].p[0], 0) / idx.length, byCase = {}; for (const i of idx) (byCase[slots[i].case] ??= []).push(i);
  const cases = Object.values(byCase).sort((a, b) => Math.abs(a.reduce((m, i) => m + slots[i].p[0], 0) / a.length - cx) - Math.abs(b.reduce((m, i) => m + slots[i].p[0], 0) / b.length - cx));
  const out = [], rowsOf = g => [...new Set(g.map(i => slots[i].y))].sort((a, b) => b - a);
  for (const grp of [cases.slice(0, 2).flat(), cases.slice(2).flat()]) for (const y of rowsOf(grp)) out.push(...grp.filter(i => slots[i].y === y).sort((a, b) => Math.abs(slots[a].p[0] - cx) - Math.abs(slots[b].p[0] - cx)));
  return out;
}

import { drawTitle, fontsReady } from "./titles.js";
export function makeBooks(THREE, room, { phone, lang, setBooks, reduced, coming = () => "Coming soon" }) {
  const slots = fit(room), n = slots.length;
  const aspect = slots.reduce((a, s) => a + s.h / s.w, 0) / n;  // the cover cell takes the fitted book's own shape
  const slotBook = new Array(n).fill(null);  // slot -> its real book (or null: a show book)
  (setBooks ?? []).forEach((list, s) => { const idx = []; for (let i = s * 48; i < Math.min(n, (s + 1) * 48); i++) idx.push(i); centreFirst(slots, idx).forEach((slot, k) => { if (list[k]) slotBook[slot] = list[k]; }); });
  const realIdx = slotBook.map((b, i) => b ? i : -1).filter(i => i >= 0), COLS = n > 96 ? 16 : 8, ROWS = Math.ceil(n / COLS), cw = n > 96 ? 128 : 192, ch = Math.round(cw * aspect);
  const cv = document.createElement("canvas"); cv.width = COLS * cw; cv.height = ROWS * ch; const x = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const cellXY = i => [(i % COLS) * cw, Math.floor(i / COLS) * ch];
  const frame = (ox, oy, i, gold) => {  // leather, grain, a gold double frame and corner studs
    const base = LEATHER[Math.floor(rnd(i) * LEATHER.length)]; x.fillStyle = base; x.fillRect(ox, oy, cw, ch);
    for (let k = 0; k < cw * ch / 90; k++) { x.fillStyle = `rgba(${rnd(k + i) > .5 ? "255,230,190" : "0,0,0"},.05)`; x.fillRect(ox + rnd(k * 3 + i) * cw, oy + rnd(k * 7 + i) * ch, 2, 2); }
    x.strokeStyle = gold; x.lineWidth = cw / 64; x.strokeRect(ox + cw * .07, oy + cw * .07, cw * .86, ch - cw * .14); x.lineWidth = cw / 128; x.strokeRect(ox + cw * .105, oy + cw * .105, cw * .79, ch - cw * .21);
    x.fillStyle = gold; for (const [a, b] of [[.07, .07], [.93, .07], [.07, 1], [.93, 1]]) { x.beginPath(); x.arc(ox + a * cw, oy + (b === 1 ? ch - cw * .07 : cw * .07), cw / 40, 0, 7); x.fill(); }
  };
  const emblems = []; let wj = null, wim = null;
  const drawShow = i => { const [ox, oy] = cellXY(i); frame(ox, oy, i, "#d9ad55"); if (!wj) return; const s = wj[Math.floor(rnd(i + 9) * wj.length)], d = cw * .62; x.save(); x.globalCompositeOperation = "lighter"; x.drawImage(wim, s.x, s.y, s.w, s.h, ox + (cw - d) / 2, oy + (ch - d) / 2, d, d); x.restore(); };
  const drawReal = (i, b, img) => {
    const [ox, oy] = cellXY(i); frame(ox, oy, 1000 + i, "#e2b459"); x.fillStyle = b.spine; x.fillRect(ox + cw * .12, oy + cw * .12, cw * .76, ch - cw * .24);  // the picture sits high, the title below it
    const rw = cw * .74, rh = rw * .75, rx = ox + (cw - rw) / 2, ry = oy + cw * .15;
    if (img) { const k = Math.max(rw / img.width, rh / img.height), sw = rw / k, sh = rh / k; x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, rx, ry, rw, rh); }
    x.strokeStyle = "#e2b459"; x.lineWidth = 2; x.strokeRect(rx, ry, rw, rh);
    // the title box ends above the bottom 16% of the cover, which the shelf's ledge lip hides
    drawTitle(x, b.title.en, "en", ox + cw / 2, ry + rh + cw * .03, cw * .7, oy + ch * .84 - (ry + rh + cw * .03), { maxBig: cw * .22, sub: lang !== "en" ? b.title[lang] ?? "" : "" });
    if (b.status === "making") { x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip(); x.translate(rx + rw / 2, ry + rh * .5); x.rotate(-.5); x.fillStyle = "rgba(20,10,4,.78)"; x.fillRect(-rw, -cw * .085, rw * 2, cw * .17); x.fillStyle = "rgba(247,214,140,.97)"; x.font = `500 ${cw / 11}px "Cormorant Garamond", "Noto Sans Lao", serif`; x.textBaseline = "middle"; x.fillText(coming(), 0, 0); x.restore(); }  // a faint ribbon
  };
  const imgs = new Array(n).fill(null), paint = () => { for (let i = 0; i < n; i++) slotBook[i] ? drawReal(i, slotBook[i], imgs[i]) : drawShow(i); tex.needsUpdate = true; };
  paint();
  const cache = new Map(); realIdx.forEach(i => { const b = slotBook[i]; if (!b.cover) return; let e = cache.get(b.cover); if (!e) { e = { im: new Image(), subs: [] }; e.im.onload = () => { for (const k of e.subs) { imgs[k] = e.im; drawReal(k, slotBook[k], e.im); } tex.needsUpdate = true; }; e.im.src = new URL(b.cover, new URL("../", import.meta.url)).href; cache.set(b.cover, e); } e.subs.push(i); });
  fontsReady.then(() => { for (const i of realIdx) drawReal(i, slotBook[i], imgs[i]); tex.needsUpdate = true; });
  // the emblems: gold on black, added (lighter) once the atlas is in; shows first as plain leather and frame
  Promise.all([fetch(WONDERS + ".json").then(r => r.json()), new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = WONDERS + ".webp"; })])
    .then(([j, im]) => { wj = j.filter(s => s.kind < 4); wim = im; paint(); }).catch(() => {});

  const mat = new THREE.MeshLambertMaterial({ map: tex }), uniforms = { uTime: { value: 0 }, uLift: { value: reduced ? 0 : 1 } };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uLift = uniforms.uLift; sh.vertexShader = "uniform float uLift;\nattribute vec4 aCell; attribute float aPart, aGlow, aHover, aShim; varying float vPart, vGlow, vHover, vShim;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = uv * aCell.zw + aCell.xy; vPart = aPart; vGlow = aGlow; vHover = aHover; vShim = aShim;").replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += vec3(0., .05, .6) * max(aHover, 0.) * uLift;");
    sh.fragmentShader = "uniform float uTime; varying float vPart, vGlow, vHover, vShim;\n" + sh.fragmentShader
      .replace("#include <map_fragment>", "diffuseColor *= vPart > 1.5 ? vec4(.8, .66, .42, 1.) : texture2D(map, vMapUv);")
      .replace("#include <opaque_fragment>", "float hv = max(vHover, 0.); outgoingLight += vec3(1., .86, .5) * vShim * .55; outgoingLight *= 1. + .5 * min(vHover, 0.); if (vPart < .5) { if (vGlow > .5) outgoingLight += vec3(.9, .6, .22) * (.1 + .07 * sin(uTime * 2.2 + vGlow * 6.)); outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.12, .8 * hv); float rim = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2); outgoingLight += (vGlow > .5 ? vec3(.7, .38, .08) : vec3(.35, .27, .15)) * rim * hv * .8; } else outgoingLight = mix(outgoingLight, diffuseColor.rgb * .9, .5 * hv);\n#include <opaque_fragment>");
  };
  const geo = boxGeo(THREE), ig = geo;
  const mesh = new THREE.InstancedMesh(ig, mat, n), cell = new Float32Array(n * 4), glow = new Float32Array(n), hov = new Float32Array(n), hot = new Float32Array(n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), one = new THREE.Vector3();
  const xf = [];  // every slot's own transform: the ring flies books out of it and puts them back exactly
  slots.forEach((s, i) => {
    e.set(-s.tilt, s.yaw, 0); q.setFromEuler(e); one.set(s.w, s.h, s.d);
    const pp = new THREE.Vector3(s.p[0], s.y, s.p[2]); m.compose(pp, q, one); mesh.setMatrixAt(i, m); xf.push({ p: pp, q: q.clone(), s: one.clone() });
    const [ox, oy] = cellXY(i); cell.set([ox / cv.width, 1 - (oy + ch) / cv.height, cw / cv.width, ch / cv.height], i * 4); glow[i] = slotBook[i] && !slotBook[i].fake ? 1 + (i % 7) * .7 : 0;
  });
  ig.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 4)); ig.setAttribute("aGlow", new THREE.InstancedBufferAttribute(glow, 1)); const ha = new THREE.InstancedBufferAttribute(hov, 1).setUsage(THREE.DynamicDrawUsage); ig.setAttribute("aHover", ha); const shimA = new Float32Array(n), sa = new THREE.InstancedBufferAttribute(shimA, 1).setUsage(THREE.DynamicDrawUsage); ig.setAttribute("aShim", sa);
  mesh.frustumCulled = false;
  const M2 = new THREE.Matrix4(), set = (i, p, q, sc) => { mesh.setMatrixAt(i, M2.compose(p, q, sc)); mesh.instanceMatrix.needsUpdate = true; };
  return { mesh, slots, xf, set, shim: (i, v) => { if (shimA[i] !== v) { shimA[i] = v; sa.needsUpdate = true; } }, home: i => set(i, xf[i].p, xf[i].q, xf[i].s), tris: n * 12, real: realIdx.length, bookAt: i => slotBook[i], isReal: i => !!slotBook[i], hover: i => { hot.fill(0); if (i >= 0) hot[i] = 1; }, dim: except => { hot.fill(-1); if (except >= 0) hot[except] = 1; },  // hover(i): book i lifts and glows (the L4 shelf tap hooks on library:book, fired by the page)
    update: (t, dt = .016) => { uniforms.uTime.value = reduced ? 0 : t; let ch = false; const k = reduced ? 1 : 1 - Math.exp(-dt * 12); for (let i = 0; i < n; i++) { const v = hov[i] + (hot[i] - hov[i]) * k; if (Math.abs(v - hov[i]) > 1e-4) { hov[i] = v; ch = true; } } if (ch) ha.needsUpdate = true; },
    setLang: l => { lang = l; for (const i of realIdx) drawReal(i, slotBook[i], imgs[i]); tex.needsUpdate = true; } };
}
