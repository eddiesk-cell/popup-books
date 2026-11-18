// books.js: the room's books, ONE instanced mesh per SET of 48 slots (4 cases x 12), each with its own cover atlas (a canvas). Real books (books.json, status "ready") wear their own cover picture; every
// other slot holds a tale from the catalog (web/landing/catalog.json: every tale we will make, its place, its category, its series). Every cover is the real cover format, drawn in code: leather, a gold
// frame, an arched window (the cover picture, or a gold emblem of the tale's theme), a gold title plate with the place and the theme inscribed small above it. A series is one slot per chapter, side by
// side: the same leather and emblem, "Book N" on the plate and N on the spine (Eddie 2026-11-18).
// Lazy (owner 2026-11-18: "nothing loads during a move"): a set's covers are painted only when its room is in view or about to be (want(k)), a few at a time between frames, and uploaded before it shows;
// the sets of rooms left far behind give their canvas back (at most MAXP painted at once). Nothing is downloaded per room: the covers are code, the emblems one small shared sheet (emblems.webp).
// The mesh reads as the shelf's leather book (web/shelf/book.glb, 21,950 triangles each): a rounded spine with raised bands, cover boards slightly larger than the
// page block, gilt page edges and brass corners. The leather grain (leather.webp, the shelf's at 256 px), gilt and brass are shared, loaded once; each book's own colour and cover (its atlas cell) stay on its front.
// Size: the shelf's closed book standing cover-out (width 0.34, height 0.40, thickness 0.116 m), so it leaves a ~10% gap and headroom.
const LEATHER = ["#5b1f26", "#1f4a31", "#1d3557", "#4a2a5c", "#6b4423", "#1c5a5a", "#7a3b1d", "#3a2a1a", "#5a1e3c", "#2f4a2a", "#4a3b1d", "#2a3a5e"];
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hashS = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(c => c ** 2.2); };  // linear, as the cover's sRGB atlas is once decoded: the spine and edges then match the front board
const HERE = new URL("./", import.meta.url), SP = .25;  // SP: a cell's spine strip, a quarter of its cover's width, right of it in the atlas (only a series volume's spine reads it)

// the shelf's closed book (web/shelf/shelf.js hit box) standing cover-out: width (spine->fore-edge) BW, height BH, thickness BD. Kept in room metres.
const BW = 0.34, BH = 0.40, BD = 0.116;

// a leather book in UNIT space (X: spine->fore-edge 1, Y: height 1, Z: thickness 1), scaled per instance by (w, h, d). parts:
// 0 the front board's face (the atlas cell: leather, gold frame, title or emblem) · 1 leather (back board, board edges) · 2 gilt page edges · 3 brass corners · 4 the spine and its bands
// (Eddie 2026-11-17: "the books on the shelves ... should look like leather books too, not just flat piece of papers"): the front board is rounded over at its fore-edge, head and tail so the
// light rolls off it; the boards stand a little proud of a gilt page block that shows at the head and fore-edge; the spine is rounded with four low raised bands and thin gilt lines; brass corner caps stand on the board.
function bookGeo(THREE) {
  const P = [], N = [], U = [], A = [];
  const hx = .5, PZ = .43, PX = .475, PY = .478, T = 5, SB = .1, NS = 10, BX = .1, BY = .08, BZ = .06, CS = .14;
  const put = (p, n, u, part) => { P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); U.push(u[0], u[1]); A.push(part); };
  const tri = (a, b, c, n, part, ua, ub, uc, na = n, nb = n, nc = n) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];  // wound to face along n, whatever order it was listed in; na-nc: a normal per vertex, for smooth shading
    if ((u[1] * v[2] - u[2] * v[1]) * n[0] + (u[2] * v[0] - u[0] * v[2]) * n[1] + (u[0] * v[1] - u[1] * v[0]) * n[2] < 0) [b, c, ub, uc, nb, nc] = [c, b, uc, ub, nc, nb];
    for (const [p, w, m] of [[a, ua, na], [b, ub, nb], [c, uc, nc]]) put(p, m, w, part); };
  const q = (a, b, c, d, n, part, ua, ub, uc, ud) => { tri(a, b, c, n, part, ua, ub, uc); tri(a, c, d, n, part, ua, uc, ud); };
  const L = [[0, 0], [T, 0], [T, T], [0, T]], G = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // the front board's face: flat in the middle, rolled over at the fore-edge (x) and the head and tail (y) by BZ; normals from the roll, the atlas cell spread over it
  const roll = (x, y) => { const tx = Math.max(0, (x - (hx - BX)) / BX), ty = Math.max(0, (Math.abs(y) - (hx - BY)) / BY), r = Math.min(1, Math.hypot(tx, ty));
    const dz = r > 0 ? 2 * BZ * r : 0; return { z: hx - BZ * r * r, n: [-(r > 0 ? dz * tx / r / BX : 0), -(r > 0 ? dz * ty / r / BY * Math.sign(y) : 0), 1] }; };
  const xs = [-hx, hx - BX, hx - BX * .6, hx - BX * .25, hx], ys = [-hx, -hx + BY * .25, -hx + BY * .6, -hx + BY, hx - BY, hx - BY * .6, hx - BY * .25, hx];  // the flat middle needs no rows of its own
  const V = (x, y) => { const r = roll(x, y), l = Math.hypot(...r.n); return { p: [x, y, r.z], n: r.n.map(v => v / l), u: [x + .5, y + .5] }; };
  for (let a = 0; a + 1 < xs.length; a++) for (let b = 0; b + 1 < ys.length; b++) { const v = [V(xs[a], ys[b]), V(xs[a + 1], ys[b]), V(xs[a + 1], ys[b + 1]), V(xs[a], ys[b + 1])];
    for (const k of [0, 1, 2, 0, 2, 3]) put(v[k].p, v[k].n, v[k].u, 0); }
  const zr = hx - BZ;  // the board's rim, where the roll meets its edge
  q([-hx, hx, zr], [hx, hx, zr], [hx, hx, PZ], [-hx, hx, PZ], [0, 1, 0], 1, ...L);            // head
  q([hx, -hx, zr], [-hx, -hx, zr], [-hx, -hx, PZ], [hx, -hx, PZ], [0, -1, 0], 1, ...L);       // tail
  q([hx, -hx, zr], [hx, hx, zr], [hx, hx, PZ], [hx, -hx, PZ], [1, 0, 0], 1, ...L);            // fore-edge
  q([hx, hx, PZ], [-hx, hx, PZ], [-hx, PY, PZ], [PX, PY, PZ], [0, 0, -1], 1, ...L);           // the board's underside where it stands proud of the pages
  q([hx, -hx, PZ], [PX, -hx, PZ], [PX, PY, PZ], [hx, hx, PZ], [0, 0, -1], 1, ...L);
  // back board (leather) + its three edges
  q([hx, -hx, -hx], [-hx, -hx, -hx], [-hx, hx, -hx], [hx, hx, -hx], [0, 0, -1], 1, ...L);
  q([hx, hx, -hx], [-hx, hx, -hx], [-hx, hx, -PZ], [hx, hx, -PZ], [0, 1, 0], 1, ...L);
  q([-hx, -hx, -hx], [hx, -hx, -hx], [hx, -hx, -PZ], [-hx, -hx, -PZ], [0, -1, 0], 1, ...L);
  q([hx, hx, -hx], [hx, -hx, -hx], [hx, -hx, -PZ], [hx, hx, -PZ], [1, 0, 0], 1, ...L);
  // the page block (gilt) between the boards: fore-edge, head and tail, just inside the boards
  // (Eddie 2026-11-18: "we see the thickness and the curve on the side like real thick leather cover books"): the fore-edge is hollowed CV deep in the middle, as the rounded spine pushes it in on a real book
  const CV = .04, fx = z => PX - CV * (1 - (z / PZ) ** 2), fn = z => { const d = 2 * CV * z / PZ / PZ, l = Math.hypot(1, d); return [1 / l, 0, -d / l]; }, KZ = 6;
  for (let k = 0; k < KZ; k++) { const z0 = -PZ + 2 * PZ * k / KZ, z1 = z0 + 2 * PZ / KZ, u0 = k / KZ, u1 = (k + 1) / KZ, n0 = fn(z0), n1 = fn(z1), nm = fn((z0 + z1) / 2);
    tri([fx(z0), -hx, z0], [fx(z1), -hx, z1], [fx(z1), PY, z1], nm, 2, [u0, 0], [u1, 0], [u1, 1], n0, n1, n1); tri([fx(z0), -hx, z0], [fx(z1), PY, z1], [fx(z0), PY, z0], nm, 2, [u0, 0], [u1, 1], [u0, 1], n0, n1, n0);
    q([-hx, PY, z0], [fx(z0), PY, z0], [fx(z1), PY, z1], [-hx, PY, z1], [0, 1, 0], 2, [0, u0], [1, u0], [1, u1], [0, u1]);
    q([fx(z0), -hx, z0], [-hx, -hx, z0], [-hx, -hx, z1], [fx(z1), -hx, z1], [0, -1, 0], 2, [1, u0], [0, u0], [0, u1], [1, u1]); }
  // spine (part 4): a half-cylinder at the left edge, rounded across the thickness and smooth-shaded (a true normal per vertex). Four low raised bands in its own leather, soft ridges that rise
  // out of it; the thin gilt lines either side of each band and at the head and tail are drawn by the shader (uv: round the spine, up it), like the first page's book
  const sp = (t, r) => [-hx - r * Math.sin(t), hx * Math.cos(t)], nt = (t, r, ny = 0) => { const v = [-Math.sin(t) / r, 0, Math.cos(t) / hx], l = Math.hypot(...v); v[1] = ny * l; const m = Math.hypot(...v); return v.map(k => k / m); };
  const ring = (y0, y1, r0, r1, ny0 = 0, ny1 = 0) => { for (let i = 0; i < NS; i++) { const t0 = i / NS * Math.PI, t1 = (i + 1) / NS * Math.PI, at = (t, y, r) => { const s = sp(t, r); return [s[0], y, s[1]]; }, uv = (t, y) => [t / Math.PI, y + hx];
    const a = at(t0, y0, r0), b = at(t1, y0, r0), c = at(t1, y1, r1), d = at(t0, y1, r1), n = nt((t0 + t1) / 2, (r0 + r1) / 2);
    tri(a, b, c, n, 4, uv(t0, y0), uv(t1, y0), uv(t1, y1), nt(t0, r0, ny0), nt(t1, r0, ny0), nt(t1, r1, ny1)); tri(a, c, d, n, 4, uv(t0, y0), uv(t1, y1), uv(t0, y1), nt(t0, r0, ny0), nt(t1, r1, ny1), nt(t0, r1, ny1)); } };
  ring(-hx, hx, SB, SB);
  for (const [y, sy] of [[hx, 1], [-hx, -1]]) for (let i = 0; i < NS; i++) { const t0 = i / NS * Math.PI, t1 = (i + 1) / NS * Math.PI, a = sp(t0, SB), b = sp(t1, SB);  // its end caps
    tri([-hx, y, 0], [b[0], y, b[1]], [a[0], y, a[1]], [0, sy, 0], 1, ...G); }
  for (const yb of [-.3, -.1, .1, .3]) { ring(yb - .016, yb, SB - .002, SB + .008, -.6, 0); ring(yb, yb + .016, SB + .008, SB - .002, 0, .6); }  // the bands: 0.008 proud, about 2.7 mm on a shelf book
  // brass corner caps on the fore-edge corners of both boards: a low pyramid standing on the board, so it catches the light
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const c = [hx, sy * hx], e1 = [hx - CS, sy * hx], e2 = [hx, sy * (hx - CS)], z = sz > 0 ? (x, y) => roll(x, y).z + .006 : () => -hx - .006, apex = [hx - CS * .28, sy * (hx - CS * .28), (sz > 0 ? roll(hx - CS * .28, sy * (hx - CS * .28)).z : -hx) + sz * .028];
    const P3 = ([x, y]) => [x, y, z(x, y)], f = (a, b) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [apex[0] - a[0], apex[1] - a[1], apex[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
      const nn = n.map(k => k / l * (n[2] * sz < 0 ? -1 : 1)); tri(a, b, apex, nn, 3, [0, 0], [1, 0], [.5, 1]); };
    f(P3(c), P3(e1)); f(P3(e1), P3(e2)); f(P3(e2), P3(c)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); g.setAttribute("aPart", new THREE.Float32BufferAttribute(A, 1));
  return g;
}


// the shelf book stands on its slot's ledge with a gap to each neighbour; the home cases' slots are 0.38 m pitch, 0.76 m shelf height (a side bay's ~6% less: grow.js narrows those cases)
function fit(room) {
  const out = [];
  room.cases.forEach((c, ci) => {
    const rows = [...new Set(c.slots.map(s => s.p[1]))].sort((a, b) => b - a), bottom = y => { const s = c.slots.find(q => q.p[1] === y); return y - s.size[1] / 2; };
    const avail = rows.map((y, i) => i ? bottom(rows[i - 1]) - bottom(y) - .05 : 0); avail[0] = avail[1] ?? c.slots[0].size[1];
    const r0 = c.slots.filter(s => s.p[1] === rows[0]), pitch = r0.length > 1 ? Math.hypot(r0[r0.length - 1].p[0] - r0[0].p[0], r0[r0.length - 1].p[2] - r0[0].p[2]) / (r0.length - 1) : c.slots[0].size[0];  // along the case, whichever way it faces
    for (const s of c.slots) { const r = rows.indexOf(s.p[1]), w = Math.min(BW, pitch * .92), h = Math.min(BH, avail[r] * .62), b = bottom(s.p[1]); out.push({ ...s, case: ci, row: r, w, h, d: Math.min(BD, s.size[2] - .01), y: b + h / 2 }); }
  });
  return out;
}
// a set's slots in reading order (as seen from the middle of the room: cases left to right, rows top to bottom, books left to right), so a series' volumes stand side by side
function readingOrder(slots, idx, facets) {
  const key = i => { const s = slots[i], c = s.case % 4, F = facets?.[c]; return [c, s.row, F ? (s.p[0] - F.p0[0]) * (F.p1[0] - F.p0[0]) + (s.p[2] - F.p0[1]) * (F.p1[1] - F.p0[1]) : s.p[0]]; };
  return [...idx].sort((a, b) => { const A = key(a), B = key(b); return A[0] - B[0] || A[1] - B[1] || A[2] - B[2]; });
}

import { titleLines, fontsReady, BODY } from "./titles.js";
const SMALL = new Set(["the", "and", "of", "a", "an", "in", "on", "to", "for", "with"]);
// sets: [{ items: [{ book?, tale?, vol?, of? }], home?, facets }] from grow.js, in set order; emblems: emblems.json (library_sheets.py); plan: walls.js towerPlan (for the reading order)
export function makeBooks(THREE, room, { phone, lang, sets = [], reduced, coming = () => "Coming soon", renderer, emblems = null, plan = null }) {
  const slots = fit(room), n = slots.length, NS = Math.ceil(n / 48);
  const aspect = slots.reduce((a, s) => a + s.h / s.w, 0) / n;  // the cover cell takes the fitted book's own shape
  const slotBook = new Array(n).fill(null), slotTale = new Array(n).fill(null), emblemOf = new Array(n).fill(null);
  const clean = t => t.replace(/\s*\([^)]*\)?/g, "").trim(), fam = c => emblems?.cats?.[c] ?? [];
  sets.forEach((st, k) => {
    const idx = []; for (let i = k * 48; i < Math.min(n, (k + 1) * 48); i++) idx.push(i);
    let order; if (st.home) { const hx0 = idx.reduce((a, i) => a + slots[i].p[0], 0) / idx.length; order = [...idx].sort((a, b) => slots[a].p[1] - slots[b].p[1] || Math.abs(slots[a].p[0] - hx0) - Math.abs(slots[b].p[0] - hx0)); }  // home: the real books at eye level, from the middle out
    else order = readingOrder(slots, idx, plan && st.facets?.map(f => plan.facets[f]));
    const room = st.items.find(q => q.tale)?.tale.category;  // a slot past the room's last tale stays a show book (its tap: "still being written"), its window an emblem of the room's own theme
    let prev = null; order.forEach((slot, j) => { const it = st.items[j]; if (!it) { const F = fam(room); if (!st.home && F.length) emblemOf[slot] = F[Math.floor(rnd(slot + 3) * F.length)]; return; } if (it.book) slotBook[slot] = it.book;
      const t = it.tale; if (!t) return; const sid = t.id, F = fam(t.category); let e = F.length ? F[hashS(sid) % F.length] : null;
      if (!it.vol && e === prev && F.length > 1) e = F[(F.indexOf(e) + 1) % F.length];  // two single tales side by side never share an emblem; a series keeps one
      emblemOf[slot] = prev = e;
      slotTale[slot] = { ...t, title: { en: clean(t.title) }, place: t.region, emblem: e, vol: it.vol ?? 0, of: it.of ?? 0, spine: it.vol ? LEATHER[hashS(sid) % LEATHER.length] : LEATHER[Math.floor(rnd(slot) * LEATHER.length)] }; }); });
  const realIdx = slotBook.map((b, i) => b ? i : -1).filter(i => i >= 0);

  // ---- the pages: one per set, its atlas laid out [cover | spine strip] per cell
  const BIGW = phone ? 192 : 256, SMW = phone ? 96 : 128, MAXP = phone ? 8 : 20, pages = [];
  for (let k = 0; k < NS; k++) { const w = sets[k]?.home ? BIGW : SMW, h = Math.round(w * aspect), cw = w * (1 + SP), cols = Math.floor(2048 / cw), cnt = Math.min(48, n - k * 48), rows = Math.ceil(cnt / cols);
    pages.push({ k, w, h, cw, cols, W: cols * cw, H: rows * h, cnt, cv: null, tex: null, painted: false, queued: false, want: false, soon: false, used: 0, waiters: [] }); }
  const pageOf = i => pages[Math.floor(i / 48)], cellOf = i => { const P = pageOf(i), j = i - P.k * 48; return [j % P.cols * P.cw, Math.floor(j / P.cols) * P.h, P.w, P.h]; };
  let emb = null, x = null;  // the emblem sheet; x: the page being painted's 2d context
  const goldIn = (y, h) => { const g = x.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "#f4d78f"); g.addColorStop(.45, "#dcab4e"); g.addColorStop(.55, "#e9bf68"); g.addColorStop(1, "#ad7d2c"); return g; };
  const orn = (px, py, sx, sy, r) => { x.save(); x.translate(px, py); x.scale(sx, sy); x.lineWidth = r / 7; x.beginPath(); x.moveTo(r * .3, r * 1.9); x.bezierCurveTo(r * .3, r * .8, r * .8, r * .3, r * 1.9, r * .3); x.stroke();  // a gilt corner flourish: a scroll, a bud and two leaves
    x.beginPath(); x.arc(r * .62, r * .62, r * .22, 0, 7); x.fill(); for (const [lx, ly, a] of [[1.25, .78, -.5], [.78, 1.25, -1.07]]) { x.beginPath(); x.ellipse(r * lx, r * ly, r * .34, r * .12, a, 0, 7); x.fill(); } x.restore(); };
  const plateText = (title, cx, top, w, h) => {  // the title on the gold plate, in the library's own capitals (Cinzel Decorative, already on the page for the door names): the names large, "and the" small
    const W2 = title.split(/\s+/).map(t => ({ t: t.toUpperCase(), small: SMALL.has(t.toLowerCase()) })), F = (s, sm) => `${sm ? 400 : 700} ${sm ? s * .5 : s}px "Cinzel Decorative", ${BODY}`, wd = (t, s, sm) => (x.font = F(s, sm), x.measureText(t).width);
    const stack = titleLines(title).map(l => [{ t: l.t.toUpperCase(), small: !l.big }]), wrap = s => { const L = [[]]; let lw = 0; for (const q of W2) { const ww = wd(q.t + " ", s, q.small); if (lw + ww > w && L.at(-1).length) { L.push([]); lw = 0; } L.at(-1).push(q); lw += ww; } return L; };
    const lh = (l, s) => l.every(q => q.small) ? s * .62 : s * 1.06, fits = (L, s) => L.reduce((a, l) => a + lh(l, s), 0) <= h && L.every(l => l.reduce((a, q) => a + wd(q.t, s, q.small), 0) + (l.length - 1) * s * .3 <= w);
    let s = h * .44, L = stack; while (s > 4 && !(stack.length <= 3 && fits(L = stack, s)) && !fits(L = wrap(s), s)) s *= .94;
    let y = top + (h - L.reduce((a, l) => a + lh(l, s), 0)) / 2; x.textBaseline = "middle"; x.textAlign = "left";
    for (const l of L) { const ws = l.map(q => wd(q.t, s, q.small)), tot = ws.reduce((a, b) => a + b, 0) + (l.length - 1) * s * .3; let px = cx - tot / 2; y += lh(l, s) / 2; l.forEach((q, k) => { x.font = F(s, q.small); x.fillText(q.t, px, y); px += ws[k] + s * .3; }); y += lh(l, s) / 2; } };
  const imgs = new Map();  // a real book's cover picture: the small copy beside this page (covers/<id>.webp, library_sheets.py), else books.json's cover
  const coverImg = b => { let e = imgs.get(b.id); if (!e) { e = { im: new Image(), ok: false }; e.im.onload = () => { e.ok = true; for (const i of realIdx) if (slotBook[i] === b) repaint(i); }; let tried = false; e.im.onerror = () => { if (!tried && b.cover) { tried = true; e.im.src = new URL(b.cover, new URL("../", HERE)).href; } }; e.im.src = new URL(`covers/${b.id}.webp`, HERE).href; imgs.set(b.id, e); } return e.ok ? e.im : null; };
  const cover = i => {  // the shelf book's real cover, all in code (owner 2026-11-18, web/shelf/books/kapi/color.webp is the model): leather, a gold double frame with corner flourishes, an arched picture window at the top, a gold title plate at the bottom
    const [ox, oy, w, h] = cellOf(i), b = slotBook[i], t = slotTale[i], img = b && coverImg(b), gold = goldIn(oy, h), cx = ox + w / 2; x.save(); x.clearRect(ox, oy, w * (1 + SP), h); x.beginPath(); x.rect(ox, oy, w, h); x.clip();
    x.fillStyle = b?.spine ?? t?.spine ?? LEATHER[Math.floor(rnd(i) * LEATHER.length)]; x.fillRect(ox, oy, w, h);  // a real book in its own leather (books.json spine), as on the shelf page
    for (let k = 0; k < w * h / 90; k++) { x.fillStyle = `rgba(${rnd(k + i) > .5 ? "255,230,190" : "0,0,0"},.05)`; x.fillRect(ox + rnd(k * 3 + i) * w, oy + rnd(k * 7 + i) * h, 2, 2); }
    x.strokeStyle = x.fillStyle = gold; x.lineWidth = w / 75; x.strokeRect(ox + w * .045, oy + w * .045, w * .91, h - w * .09); x.lineWidth = w / 170; x.strokeRect(ox + w * .08, oy + w * .08, w * .84, h - w * .16);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) orn(sx > 0 ? ox + w * .08 : ox + w * .92, sy > 0 ? oy + w * .08 : oy + h - w * .08, sx, sy, w * .055);
    const rw = w * .31, top = oy + h * .1, spring = top + w * .15, wy = oy + h * .5, arch = () => { x.beginPath(); x.moveTo(cx - rw, wy); x.lineTo(cx - rw, spring); x.ellipse(cx, spring, rw, spring - top, 0, Math.PI, 2 * Math.PI); x.lineTo(cx + rw, wy); x.closePath(); };
    arch(); x.fillStyle = "#140b05"; x.fill(); x.save(); arch(); x.clip();
    if (b && img) { const bw = 2 * rw, bh = wy - top, k = Math.max(bw / img.width, bh / img.height), sw = bw / k, sh = bh / k; x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, cx - rw, top, bw, bh); }
    else if (!b && emb && emblemOf[i]) { const a = emb.j.at[emblemOf[i]], S = emb.j.size, d = Math.min(2 * rw, wy - top) * .86; if (a) { x.globalCompositeOperation = "lighter"; x.drawImage(emb.im, a[0] * S, a[1] * S, S, S, cx - d / 2, (top + wy) / 2 - d / 2 + h * .01, d, d); } }
    x.restore(); x.strokeStyle = gold; arch(); x.lineWidth = w / 60; x.stroke();
    const pw = w * .68, ph = h * .2, py = oy + h * .585, pr = w * .04;  // the plate stays above the bottom 16% of the cover, which the shelf's ledge lip hides
    x.beginPath(); x.roundRect(cx - pw / 2, py, pw, ph, pr); x.fillStyle = "rgba(10,4,0,.28)"; x.fill(); x.lineWidth = w / 80; x.stroke(); x.beginPath(); x.roundRect(cx - pw / 2 + w * .02, py + w * .02, pw - w * .04, ph - w * .04, pr * .6); x.lineWidth = w / 220; x.stroke();
    x.fillStyle = gold; for (const [dx, dy] of [[0, py], [0, py + ph]]) { x.beginPath(); x.moveTo(cx - w * .03, dy); x.lineTo(cx, dy - w * .025); x.lineTo(cx + w * .03, dy); x.lineTo(cx, dy + w * .025); x.fill(); }
    for (const sx of [-1, 1]) { x.beginPath(); x.arc(cx + sx * (pw / 2 + w * .045), py + ph / 2, w * .022, 0, 7); x.fill(); }
    const where = t?.place, cat = t?.category;  // (owner 2026-11-18) the tale's place and category inscribed small in gold either side of the plate's top diamond
    if (where && cat) { x.textBaseline = "middle"; x.textAlign = "center"; const iy = (wy + py) / 2 + h * .004, hw = pw / 2 - w * .06; for (const [txt, sx] of [[where, -1], [cat, 1]]) { const f = Math.min(w * .05, hw / (x.font = `400 100px "Cinzel Decorative", ${BODY}`, x.measureText(txt.toUpperCase()).width) * 100); x.font = `400 ${f}px "Cinzel Decorative", ${BODY}`; x.fillText(txt.toUpperCase(), cx + sx * (w * .045 + hw / 2), iy); }
      x.lineWidth = w / 260; x.beginPath(); x.moveTo(cx - pw / 2 + w * .02, iy + w * .03); x.lineTo(cx - w * .04, iy + w * .03); x.moveTo(cx + w * .04, iy + w * .03); x.lineTo(cx + pw / 2 - w * .02, iy + w * .03); x.stroke(); }
    const title = b?.title.en ?? t?.title.en, vol = t?.vol;
    if (title) plateText(title, cx, py + w * .035, pw - w * .1, (ph - w * .07) * (vol ? .74 : 1)); else { x.lineWidth = w / 150; x.beginPath(); x.moveTo(cx - pw * .3, py + ph / 2); x.lineTo(cx + pw * .3, py + ph / 2); x.stroke(); x.beginPath(); x.arc(cx, py + ph / 2, w * .02, 0, 7); x.fill(); }
    if (vol) { x.font = `700 ${w * .052}px "Cinzel Decorative", ${BODY}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(`BOOK ${vol}`, cx, py + ph - w * .058); }  // a series volume: "Book N" under the series title
    const sub = b && lang !== "en" ? b.title[lang] ?? "" : ""; if (sub) { x.font = `400 ${w * .045}px ${BODY}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(sub, cx, py + ph + h * .03, pw); }
    if (b?.status === "making") { x.save(); arch(); x.clip(); x.translate(cx, (top + wy) / 2); x.rotate(-.5); x.fillStyle = "rgba(20,10,4,.78)"; x.fillRect(-rw * 2, -w * .085, rw * 4, w * .17); x.fillStyle = "rgba(247,214,140,.97)"; x.font = `500 ${w / 11}px "Cormorant Garamond", "Noto Sans Lao", serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(coming(), 0, 0); x.restore(); }  // a faint ribbon
    if (!b) { x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(ox, oy, w, h); }  // a tale not yet made: a touch dimmer
    x.restore();
    if (vol) { const sx0 = ox + w, sw = w * SP, my = oy + h * .3, s = Math.min(sw * .62, h * .09); x.save(); x.fillStyle = x.strokeStyle = goldIn(my - s, 2 * s); x.lineWidth = Math.max(1, sw / 18);  // its spine (the strip right of the cover): the volume number in a small gilt frame, between the raised bands
      x.strokeRect(sx0 + sw * .14, my - s * .95, sw * .72, s * 1.9); x.font = `700 ${s * 1.2}px "Cinzel Decorative", ${BODY}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(vol), sx0 + sw / 2, my + s * .06); x.restore(); } };

  // ---- painting: a page waits for the face (Cinzel Decorative) and the emblem sheet (at most 2 s), then paints a few covers at a time between frames, the room in view first
  const assets = Promise.race([Promise.all([fontsReady, document.fonts?.load('700 20px "Cinzel Decorative"').catch(() => {}),
    emblems ? new Promise(ok => { const im = new Image(); im.onload = () => { emb = { im, j: emblems }; ok(); }; im.onerror = ok; im.src = new URL("emblems.webp", HERE).href; }) : null]), new Promise(r => setTimeout(r, 2000))]);
  let pumping = false, aborted = false;
  const queue = () => pages.filter(P => P.queued && !P.painted).sort((a, b) => b.want - a.want || b.soon - a.soon || b.used - a.used);
  const pump = async () => { if (pumping) return; pumping = true; await assets;
    while (!aborted) { const P = queue()[0]; if (!P) break;
      if (!P.cv) { P.cv = document.createElement("canvas"); P.cv.width = P.W; P.cv.height = P.H; P.x = P.cv.getContext("2d"); } x = P.x;
      for (let j = P.next ?? 0, t0 = performance.now(); j < P.cnt; j++) { cover(P.k * 48 + j); P.next = j + 1; if (performance.now() - t0 > 6 && j + 1 < P.cnt) break; }
      if (P.next >= P.cnt) { P.next = 0; finish(P); } await new Promise(r => setTimeout(r, P.want || P.soon ? 0 : 30)); }
    pumping = false; };
  const finish = P => { if (!P.tex) { P.tex = new THREE.CanvasTexture(P.cv); P.tex.colorSpace = THREE.SRGBColorSpace; P.tex.anisotropy = 4; P.mat.map = P.tex; P.mat.needsUpdate = true; } else P.tex.needsUpdate = true;
    try { renderer?.initTexture(P.tex); } catch { /* the first frame that shows it uploads it */ } P.painted = true; P.queued = P.soon = false; P.mesh.visible = P.want; P.waiters.splice(0).forEach(f => f()); evict(); };
  const repaint = i => { const P = pageOf(i), j = i - P.k * 48; if (!P.x || !(P.painted || j < (P.next ?? 0))) return; const keep = x; x = P.x; cover(i); x = keep; if (P.tex) P.tex.needsUpdate = true; };  // a cell already drawn (also mid-page); a later one draws itself
  const evict = () => { const live = pages.filter(P => P.painted && !P.want).sort((a, b) => a.used - b.used); for (let m = pages.filter(P => P.painted).length; m > MAXP && live.length; m--) { const P = live.shift(); P.painted = false; P.mesh.visible = false; P.tex.dispose(); P.tex = null; P.mat.map = white; P.cv.width = P.cv.height = 0; P.cv = P.x = null; } };
  // want(k, on): set k's room is in view (on) or not; prefetch(k, soon): paint it unseen, when idle (or at once: soon)
  const want = (k, on) => { const P = pages[k]; if (!P) return; P.want = on; if (on) { P.used = performance.now(); if (!P.painted) { P.queued = true; pump(); } } P.mesh.visible = on && P.painted; };
  const prefetch = (k, soon) => { const P = pages[k]; if (!P || P.painted) return; P.soon ||= !!soon; P.used = performance.now() - (soon ? 0 : 6e4); P.queued = true; pump(); };  // soon: the visitor is on the way there
  const ready = k => { const P = pages[k]; return !P || P.painted ? Promise.resolve() : new Promise(r => P.waiters.push(r)); };
  Promise.all([fontsReady, assets]).then(() => { for (const P of pages) if (P.painted) { x = P.x; for (let j = 0; j < P.cnt; j++) cover(P.k * 48 + j); P.tex.needsUpdate = true; } });  // a page painted before the face arrived (a 2 s timeout) is painted again in it

  // the shelf's shared textures (leather grain, gilt page edges, brass corners), loaded once; until they land the parts fall back to white * the book's own colour / gold
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true; white.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { uTime: { value: 0 }, uLift: { value: reduced ? 0 : 1 }, uLeather: { value: white }, uGilt: { value: white }, uBrass: { value: white } };
  { const tl = new THREE.TextureLoader(), shelf = new URL("../../shelf/", import.meta.url).href;
    const load = (u, rep, U) => { const t = tl.load(u, () => { U.value = t; }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    load(new URL("leather.webp", HERE).href, true, uniforms.uLeather); load(shelf + "gilt-color.webp", false, uniforms.uGilt); load(shelf + "brass-color.webp", false, uniforms.uBrass);
  }
  const compile = sh => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uLeather = uniforms.uLeather; sh.uniforms.uGilt = uniforms.uGilt; sh.uniforms.uBrass = uniforms.uBrass;
    sh.uniforms.uLift = uniforms.uLift;
    sh.vertexShader = "uniform float uLift;\nattribute vec4 aCell; attribute float aPart, aGlow, aHover, aShim, aVol; attribute vec3 aColor; varying float vPart, vGlow, vHover, vShim, vVol; varying vec2 vCellUv, vUv, vSpUv; varying vec3 vColor;\n" + sh.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>\nvCellUv = uv * aCell.zw + aCell.xy; vSpUv = vec2(aCell.x + aCell.z + uv.x * aCell.z * ${SP.toFixed(3)}, aCell.y + uv.y * aCell.w); vUv = uv; vColor = aColor; vPart = aPart; vGlow = aGlow; vHover = aHover; vShim = aShim; vVol = aVol;`).replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += vec3(0., .05, .6) * max(aHover, 0.) * uLift;");
    sh.fragmentShader = "uniform float uTime; uniform sampler2D uLeather, uGilt, uBrass; varying float vPart, vGlow, vHover, vShim, vVol; varying vec2 vCellUv, vUv, vSpUv; varying vec3 vColor;\n" + sh.fragmentShader
      .replace("#include <map_fragment>", "float _line = 0.; if (vPart > 3.5) { float yy = vUv.y - .5, d = abs(abs(yy) - .46); for (int k = 0; k < 4; k++) d = min(d, abs(abs(yy + .3 - .2 * float(k)) - .026)); _line = 1. - smoothstep(.0025, .0025 + 1.5 * fwidth(yy), d); }  vec4 _book = vPart < .5 ? texture2D(map, vCellUv) : vPart > 3.5 ? mix(texture2D(uLeather, vUv * vec2(2., 5.)) * vec4(vColor, 1.), texture2D(uBrass, vUv), _line) : (vPart < 1.5 ? texture2D(uLeather, vUv) * vec4(vColor, 1.) : (vPart < 2.5 ? texture2D(uGilt, vUv) : texture2D(uBrass, vUv))); if (vPart > 3.5 && vVol > .5) { vec4 _s = texture2D(map, vSpUv); _book.rgb = mix(_book.rgb, _s.rgb, _s.a); _line = max(_line, _s.a); }  float _gold = vPart < .5 ? smoothstep(.06, .2, (_book.r + _book.g) * .5 - _book.b) * smoothstep(.32, .6, _book.r) : vPart > 3.5 ? _line : vPart > 1.5 ? 1. : 0.; if (vPart < .5) _book.rgb *= mix(.82 + .5 * dot(texture2D(uLeather, vUv * 2.).rgb, vec3(.333)), 1., _gold) * mix(1., .62, smoothstep(.4, .5, max(abs(vUv.x - .5), abs(vUv.y - .5)))); diffuseColor *= _book;")  // the cover: leather grain under its picture, its gold left bright; a volume's spine: its number from the strip beside its cell
      .replace("#include <opaque_fragment>", "{ vec3 _n = normalize(normal), _v = normalize(vViewPosition); float _sp = pow(max(dot(reflect(-normalize(vec3(.25, .75, .6)), _n), _v), 0.), 14.), _rim = pow(1. - abs(dot(_n, _v)), 3.); outgoingLight += diffuseColor.rgb * (_gold * (.35 + 1.4 * _sp) + (1. - _gold) * (.12 * _sp + .1 * _rim)); }  // gold catches the light, leather a soft sheen\nfloat hv = max(vHover, 0.); outgoingLight += vec3(1., .86, .5) * vShim * .55; outgoingLight *= 1. + .5 * min(vHover, 0.); if (vPart < .5) { if (vGlow > .5) outgoingLight += vec3(.9, .6, .22) * (.1 + .07 * sin(uTime * 2.2 + vGlow * 6.)); outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.12, .8 * hv); float rim = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2); outgoingLight += (vGlow > .5 ? vec3(.7, .38, .08) : vec3(.35, .27, .15)) * rim * hv * .8; } else outgoingLight = mix(outgoingLight, diffuseColor.rgb * .9, .5 * hv);\n#include <opaque_fragment>");
  };
  const geo = bookGeo(THREE), TRI = geo.attributes.position.count / 3, group = new THREE.Group(); group.name = "books";
  const hot = new Float32Array(n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), one = new THREE.Vector3(), xf = [];  // xf: every slot's own transform: the ring flies books out of it and puts them back exactly
  for (const P of pages) {
    const g = new THREE.BufferGeometry(); for (const [k, v] of Object.entries(geo.attributes)) g.setAttribute(k, v);  // the book's own vertices shared by every page (one GPU buffer); the per-book numbers its own
    const c = P.cnt, cell = new Float32Array(c * 4), glow = new Float32Array(c), colr = new Float32Array(c * 3), vol = new Float32Array(c); P.hov = new Float32Array(c); P.shimA = new Float32Array(c);
    P.mat = new THREE.MeshLambertMaterial({ map: white }); P.mat.onBeforeCompile = compile;  // a white stand-in map until the page is painted: every page then shares one program P.mat.customProgramCacheKey = () => "books";
    P.mesh = new THREE.InstancedMesh(g, P.mat, c); P.mesh.userData.k = P.k; P.mesh.frustumCulled = false; P.mesh.visible = false; P.mesh.name = "books_" + P.k; group.add(P.mesh);
    for (let j = 0; j < c; j++) { const i = P.k * 48 + j, s = slots[i];
      const ww = 1 + (rnd(i * 3.1 + 1.7) - .5) * .06, hh = 1 + (rnd(i * 7.13 + 5.1) - .5) * .08, tilt = s.tilt + (rnd(i * 1.7 + 9.3) - .5) * .14;  // a book's thickness varies a little, and its height; a few lean a little more or less
      const turn = (i % 2 ? 1 : -1) * (slotBook[i] ? .16 + .06 * rnd(i * 5.3 + 2.1) : .14 + .12 * rnd(i * 5.3 + 2.1));  // every book turned a little (owner 2026-11-18: the thickness and the curve on the side must read at eye level), its spine or its gilt pages to you; a story book a little less, its cover still read square-on
      e.set(-tilt, s.yaw + turn, 0); q.setFromEuler(e); one.set(s.w * ww, s.h * hh, s.d);
      const pp = new THREE.Vector3(s.p[0], s.y + s.h * (hh - 1) / 2, s.p[2]); m.compose(pp, q, one); P.mesh.setMatrixAt(j, m); xf.push({ p: pp, q: q.clone(), s: one.clone() });
      const [ox, oy, cw, ch] = cellOf(i); cell.set([ox / P.W, 1 - (oy + ch) / P.H, cw / P.W, ch / P.H], j * 4); glow[j] = slotBook[i] && !slotBook[i].fake ? 1 + (i % 7) * .7 : 0; vol[j] = slotTale[i]?.vol ?? 0;
      const rgb = hexRGB(slotBook[i]?.spine ?? slotTale[i]?.spine ?? LEATHER[Math.floor(rnd(i) * LEATHER.length)]).map(v => slotBook[i] ? v : v * .8); colr.set(rgb, j * 3); }
    g.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 4)); g.setAttribute("aGlow", new THREE.InstancedBufferAttribute(glow, 1)); g.setAttribute("aColor", new THREE.InstancedBufferAttribute(colr, 3)); g.setAttribute("aVol", new THREE.InstancedBufferAttribute(vol, 1));
    P.ha = new THREE.InstancedBufferAttribute(P.hov, 1).setUsage(THREE.DynamicDrawUsage); g.setAttribute("aHover", P.ha); P.sa = new THREE.InstancedBufferAttribute(P.shimA, 1).setUsage(THREE.DynamicDrawUsage); g.setAttribute("aShim", P.sa);
  }
  const M2 = new THREE.Matrix4(), set = (i, p, q, sc) => { const P = pageOf(i); P.mesh.setMatrixAt(i - P.k * 48, M2.compose(p, q, sc)); P.mesh.instanceMatrix.needsUpdate = true; };
  return { group, slots, xf, set, tris: n * TRI, real: realIdx.length, pages, want, prefetch, ready, emblems, dispose: () => { aborted = true; },
    shim: (i, v) => { const P = pageOf(i), j = i - P.k * 48; if (P.shimA[j] !== v) { P.shimA[j] = v; P.sa.needsUpdate = true; } }, home: i => set(i, xf[i].p, xf[i].q, xf[i].s),
    bookAt: i => slotBook[i], taleAt: i => slotTale[i], talesReady: Promise.resolve(), isReal: i => !!slotBook[i],
    shown: i => { const P = pageOf(i); return !!P && P.mesh.visible; },  // in a set whose room is in view, painted
    pick: ray => ray.intersectObjects(pages.filter(P => P.mesh.visible).map(P => P.mesh), false).map(h => ({ distance: h.distance, index: h.object.userData.k * 48 + h.instanceId })),
    hover: i => { hot.fill(0); if (i >= 0) hot[i] = 1; }, dim: except => { hot.fill(-1); if (except >= 0) hot[except] = 1; },  // hover(i): book i lifts and glows (the L4 shelf tap hooks on library:book, fired by the page)
    update: (t, dt = .016) => { uniforms.uTime.value = reduced ? 0 : t; const k = reduced ? 1 : 1 - Math.exp(-dt * 12);
      for (const P of pages) { if (!P.mesh.visible) continue; let ch = false; for (let j = 0; j < P.cnt; j++) { const h = P.hov[j], v = h + (hot[P.k * 48 + j] - h) * k; if (Math.abs(v - h) > 1e-4) { P.hov[j] = v; ch = true; } } if (ch) P.ha.needsUpdate = true; } },
    setLang: l => { lang = l; for (const i of realIdx) repaint(i); },
    swapLook: (i, j) => { const P = pageOf(i); if (P !== pageOf(j)) return; [slotTale[i], slotTale[j]] = [slotTale[j], slotTale[i]]; const g = P.mesh.geometry, a = i - P.k * 48, b = j - P.k * 48;  // two show books that changed places (wonders.js): each slot keeps its instance, the covers trade
      for (const [name, w] of [["aCell", 4], ["aColor", 3], ["aVol", 1]]) { const arr = g.attributes[name].array; for (let k = 0; k < w; k++) [arr[a * w + k], arr[b * w + k]] = [arr[b * w + k], arr[a * w + k]]; g.attributes[name].needsUpdate = true; } } };
}
