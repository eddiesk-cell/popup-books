// books.js: the room's books as ONE instanced mesh (a light leather book ~150 triangles each) and ONE cover atlas (a canvas, a per-instance UV offset).
// Real books (books.json, status "ready") take the first slots; every other slot is a SHOW book: leather, a gold frame, a gold-foil emblem from the first page's wonders atlas.
// The mesh reads as the shelf's leather book (web/shelf/book.glb, 21,950 triangles each): a rounded spine with raised bands, cover boards slightly larger than the
// page block, gilt page edges and brass corners. The shelf's own leather / gilt / brass textures are shared, loaded once; each book's own colour and cover picture
// (the atlas cell) stay on its front. Size: the shelf's closed book standing cover-out (width 0.34, height 0.40, thickness 0.116 m), so it leaves a ~10% gap and headroom.
const LEATHER = ["#5b1f26", "#1f4a31", "#1d3557", "#4a2a5c", "#6b4423", "#1c5a5a", "#7a3b1d", "#3a2a1a", "#5a1e3c", "#2f4a2a", "#4a3b1d", "#2a3a5e"];
const WONDERS = new URL("../styles/epic/scene/sprites/wonders", import.meta.url).href;
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// the shelf's closed book (web/shelf/shelf.js hit box) standing cover-out: width (spine->fore-edge) BW, height BH, thickness BD. Kept in room metres.
const BW = 0.34, BH = 0.40, BD = 0.116;

// a light leather book in UNIT space (X: spine->fore-edge 1, Y: height 1, Z: thickness 1), scaled per instance by (w, h, d). parts:
// 0 cover face (atlas cell) · 1 leather (spine, back, board edges, bands) · 2 gilt page edges · 3 brass corners
function bookGeo(THREE) {
  const P = [], N = [], U = [], A = [];
  const hx = .5, PZ = .42, PX = .44, PY = .46, T = 5, SB = .17, NS = 8, EPS = .002, CSZ = .15;
  const q = (a, b, c, d, n, part, ua, ub, uc, ud) => { const put = (p, u) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); U.push(u[0], u[1]); A.push(part); }; put(a, ua); put(b, ub); put(c, uc); put(a, ua); put(c, uc); put(d, ud); };
  const tri = (a, b, c, n, part, ua, ub, uc) => { const put = (p, u) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); U.push(u[0], u[1]); A.push(part); }; put(a, ua); put(b, ub); put(c, uc); };
  const L = [[0, 0], [T, 0], [T, T], [0, T]], G = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // front cover (atlas) + its three leather edges (spine edge is the spine)
  q([-hx, -hx, hx], [hx, -hx, hx], [hx, hx, hx], [-hx, hx, hx], [0, 0, 1], 0, ...G);
  q([-hx, hx, hx], [hx, hx, hx], [hx, hx, PZ], [-hx, hx, PZ], [0, 1, 0], 1, ...L);            // top
  q([hx, -hx, hx], [-hx, -hx, hx], [-hx, -hx, PZ], [hx, -hx, PZ], [0, -1, 0], 1, ...L);       // bottom
  q([hx, -hx, hx], [hx, hx, hx], [hx, hx, PZ], [hx, -hx, PZ], [1, 0, 0], 1, ...L);            // fore-edge
  // back cover (leather) + its three edges
  q([hx, -hx, -hx], [-hx, -hx, -hx], [-hx, hx, -hx], [hx, hx, -hx], [0, 0, -1], 1, ...L);
  q([hx, hx, -hx], [-hx, hx, -hx], [-hx, hx, -PZ], [hx, hx, -PZ], [0, 1, 0], 1, ...L);
  q([-hx, -hx, -hx], [hx, -hx, -hx], [hx, -hx, -PZ], [-hx, -hx, -PZ], [0, -1, 0], 1, ...L);
  q([hx, hx, -hx], [hx, -hx, -hx], [hx, -hx, -PZ], [hx, hx, -PZ], [1, 0, 0], 1, ...L);
  // page block edges (gilt): the pages sit inside the boards on the fore-edge and top (bottom flush with the ledge)
  q([PX, -hx, PZ], [PX, -hx, -PZ], [PX, PY, -PZ], [PX, PY, PZ], [1, 0, 0], 2, ...G);          // fore-edge
  q([-hx, PY, PZ], [PX, PY, PZ], [PX, PY, -PZ], [-hx, PY, -PZ], [0, 1, 0], 2, ...G);           // top
  q([PX, -hx, -PZ], [-hx, -hx, -PZ], [-hx, -hx, PZ], [PX, -hx, PZ], [0, -1, 0], 2, ...G);     // bottom
  // spine: a half-cylinder at the left edge, rounded across the thickness, bulging a little outward; raised bands sit proud of it
  const sp = (t, r) => [-hx - r * Math.sin(t), hx * Math.cos(t)];
  for (let i = 0; i < NS; i++) {
    const t0 = i / NS * Math.PI, t1 = (i + 1) / NS * Math.PI, tm = (t0 + t1) / 2, n = [-Math.sin(tm), 0, Math.cos(tm)];
    const a = sp(t0, SB), b = sp(t1, SB);
    q([a[0], -hx, a[1]], [b[0], -hx, b[1]], [b[0], hx, b[1]], [a[0], hx, a[1]], n, 1, ...L);
  }
  // spine end caps (a half-disc top and bottom, so the spine's open ends never show)
  for (const [y, sy] of [[hx, 1], [-hx, -1]]) for (let i = 0; i < NS; i++) {
    const t0 = i / NS * Math.PI, t1 = (i + 1) / NS * Math.PI, a = sp(t0, SB), b = sp(t1, SB);
    if (sy === 1) tri([-hx, y, 0], [b[0], y, b[1]], [a[0], y, a[1]], [0, sy, 0], 1, ...G); else tri([-hx, y, 0], [a[0], y, a[1]], [b[0], y, b[1]], [0, sy, 0], 1, ...G);
  }
  // raised bands: three short ridges round the spine
  for (const yb of [-.28, 0, .28]) for (let i = 0; i < NS; i++) {
    const t0 = i / NS * Math.PI, t1 = (i + 1) / NS * Math.PI, tm = (t0 + t1) / 2, n = [-Math.sin(tm), 0, Math.cos(tm)];
    const a = sp(t0, SB + .06), b = sp(t1, SB + .06);
    q([a[0], yb - .03, a[1]], [b[0], yb - .03, b[1]], [b[0], yb + .03, b[1]], [a[0], yb + .03, a[1]], n, 1, ...L);
  }
  // brass corners: a small square cap at each of the front and back board's four corners
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) for (const [z, nz] of [[hx + EPS, 1], [-hx - EPS, -1]]) {
    const cx = sx * hx, cy = sy * hx, x0 = Math.min(cx, cx - sx * CSZ), x1 = Math.max(cx, cx - sx * CSZ), y0 = Math.min(cy, cy - sy * CSZ), y1 = Math.max(cy, cy - sy * CSZ);
    if (nz === 1) q([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1], 3, ...G); else q([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], [0, 0, -1], 3, ...G);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setAttribute("aPart", new THREE.Float32BufferAttribute(A, 1));
  return g;
}

// the shelf book stands on its slot's ledge with a gap to each neighbour; the home cases' slots are 0.38 m pitch, 0.76 m shelf height.
function fit(room) {
  const out = [];
  room.cases.forEach((c, ci) => {
    const rows = [...new Set(c.slots.map(s => s.p[1]))].sort((a, b) => b - a), bottom = y => { const s = c.slots.find(q => q.p[1] === y); return y - s.size[1] / 2; };
    const avail = rows.map((y, i) => i ? bottom(rows[i - 1]) - bottom(y) - .05 : 0); avail[0] = avail[1] ?? c.slots[0].size[1];
    const xs = [...new Set(c.slots.map(s => s.p[0]))].sort((a, b) => a - b), pitch = xs.length > 1 ? (xs[xs.length - 1] - xs[0]) / (xs.length - 1) : c.slots[0].size[0];
    for (const s of c.slots) { const r = rows.indexOf(s.p[1]), w = Math.min(BW, pitch * .92), h = Math.min(BH, avail[r] * .62), b = bottom(s.p[1]); out.push({ ...s, case: ci, w, h, d: Math.min(BD, s.size[2] - .01), y: b + h / 2 }); }
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
  let wj = null, wim = null;
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

  // the shelf's shared textures (leather grain, gilt page edges, brass corners), loaded once; until they land the parts fall back to white * the book's own colour / gold
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true; white.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { uTime: { value: 0 }, uLift: { value: reduced ? 0 : 1 }, uLeather: { value: white }, uGilt: { value: white }, uBrass: { value: white } };
  { const tl = new THREE.TextureLoader(), base = new URL("../../shelf/", import.meta.url).href;
    const load = (f, rep, u) => { const t = tl.load(base + f, () => { u.value = t; }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    load("leather-color.webp", true, uniforms.uLeather); load("gilt-color.webp", false, uniforms.uGilt); load("brass-color.webp", false, uniforms.uBrass);
  }
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uLeather = uniforms.uLeather; sh.uniforms.uGilt = uniforms.uGilt; sh.uniforms.uBrass = uniforms.uBrass;
    sh.uniforms.uLift = uniforms.uLift;
    sh.vertexShader = "uniform float uLift;\nattribute vec4 aCell; attribute float aPart, aGlow, aHover, aShim; attribute vec3 aColor; varying float vPart, vGlow, vHover, vShim; varying vec2 vCellUv, vUv; varying vec3 vColor;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvCellUv = uv * aCell.zw + aCell.xy; vUv = uv; vColor = aColor; vPart = aPart; vGlow = aGlow; vHover = aHover; vShim = aShim;").replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += vec3(0., .05, .6) * max(aHover, 0.) * uLift;");
    sh.fragmentShader = "uniform float uTime; uniform sampler2D uLeather, uGilt, uBrass; varying float vPart, vGlow, vHover, vShim; varying vec2 vCellUv, vUv; varying vec3 vColor;\n" + sh.fragmentShader
      .replace("#include <map_fragment>", "vec4 _book = vPart < .5 ? texture2D(map, vCellUv) : (vPart < 1.5 ? texture2D(uLeather, vUv) * vec4(vColor, 1.) : (vPart < 2.5 ? texture2D(uGilt, vUv) : texture2D(uBrass, vUv))); diffuseColor *= _book;")
      .replace("#include <opaque_fragment>", "float hv = max(vHover, 0.); outgoingLight += vec3(1., .86, .5) * vShim * .55; outgoingLight *= 1. + .5 * min(vHover, 0.); if (vPart < .5) { if (vGlow > .5) outgoingLight += vec3(.9, .6, .22) * (.1 + .07 * sin(uTime * 2.2 + vGlow * 6.)); outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.12, .8 * hv); float rim = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2); outgoingLight += (vGlow > .5 ? vec3(.7, .38, .08) : vec3(.35, .27, .15)) * rim * hv * .8; } else outgoingLight = mix(outgoingLight, diffuseColor.rgb * .9, .5 * hv);\n#include <opaque_fragment>");
  };
  const geo = bookGeo(THREE), ig = geo, TRI = geo.attributes.position.count / 3;
  const mesh = new THREE.InstancedMesh(ig, mat, n), cell = new Float32Array(n * 4), glow = new Float32Array(n), hov = new Float32Array(n), hot = new Float32Array(n), colr = new Float32Array(n * 3), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), one = new THREE.Vector3();
  const xf = [];  // every slot's own transform: the ring flies books out of it and puts them back exactly
  slots.forEach((s, i) => {
    const ww = 1 + (rnd(i * 3.1 + 1.7) - .5) * .06;    // a book's thickness varies a little
    const hh = 1 + (rnd(i * 7.13 + 5.1) - .5) * .08;   // ...and its height; a few lean a little more or less
    const tilt = s.tilt + (rnd(i * 1.7 + 9.3) - .5) * .14;
    e.set(-tilt, s.yaw, 0); q.setFromEuler(e); one.set(s.w * ww, s.h * hh, s.d);
    const pp = new THREE.Vector3(s.p[0], s.y + s.h * (hh - 1) / 2, s.p[2]); m.compose(pp, q, one); mesh.setMatrixAt(i, m); xf.push({ p: pp, q: q.clone(), s: one.clone() });
    const [ox, oy] = cellXY(i); cell.set([ox / cv.width, 1 - (oy + ch) / cv.height, cw / cv.width, ch / cv.height], i * 4); glow[i] = slotBook[i] && !slotBook[i].fake ? 1 + (i % 7) * .7 : 0;
    const seed = slotBook[i] ? 1000 + i : i, rgb = hexRGB(LEATHER[Math.floor(rnd(seed) * LEATHER.length)]); colr[i * 3] = rgb[0]; colr[i * 3 + 1] = rgb[1]; colr[i * 3 + 2] = rgb[2];
  });
  ig.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 4)); ig.setAttribute("aGlow", new THREE.InstancedBufferAttribute(glow, 1)); ig.setAttribute("aColor", new THREE.InstancedBufferAttribute(colr, 3)); const ha = new THREE.InstancedBufferAttribute(hov, 1).setUsage(THREE.DynamicDrawUsage); ig.setAttribute("aHover", ha); const shimA = new Float32Array(n), sa = new THREE.InstancedBufferAttribute(shimA, 1).setUsage(THREE.DynamicDrawUsage); ig.setAttribute("aShim", sa);
  mesh.frustumCulled = false;
  const M2 = new THREE.Matrix4(), set = (i, p, q, sc) => { mesh.setMatrixAt(i, M2.compose(p, q, sc)); mesh.instanceMatrix.needsUpdate = true; };
  return { mesh, slots, xf, set, shim: (i, v) => { if (shimA[i] !== v) { shimA[i] = v; sa.needsUpdate = true; } }, home: i => set(i, xf[i].p, xf[i].q, xf[i].s), tris: n * TRI, real: realIdx.length, bookAt: i => slotBook[i], isReal: i => !!slotBook[i], hover: i => { hot.fill(0); if (i >= 0) hot[i] = 1; }, dim: except => { hot.fill(-1); if (except >= 0) hot[except] = 1; },  // hover(i): book i lifts and glows (the L4 shelf tap hooks on library:book, fired by the page)
    update: (t, dt = .016) => { uniforms.uTime.value = reduced ? 0 : t; let ch = false; const k = reduced ? 1 : 1 - Math.exp(-dt * 12); for (let i = 0; i < n; i++) { const v = hov[i] + (hot[i] - hov[i]) * k; if (Math.abs(v - hov[i]) > 1e-4) { hov[i] = v; ch = true; } } if (ch) ha.needsUpdate = true; },
    setLang: l => { lang = l; for (const i of realIdx) drawReal(i, slotBook[i], imgs[i]); tex.needsUpdate = true; } };
}
