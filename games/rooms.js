// rooms.js: the two Wonder Hall game rooms as data, the one source two builders read: dress.js (three.js, the room that ships) and
// renders/review/games-rich/blend/build.py (Blender, the reference it copies; tools dump this to JSON). Metres, y up, the play wall at z = -d/2. No imports.
// Part types: box (s size, p centre, ry), lathe (prof [[r, y]], p), arch (voussoir ring: c centre, r0, r1, dz depth, n stones, key = keystone material),
// cyl (r, h, p, rx/rz tilt), torch (p, n = the wall's normal, a flame and its light), brazier (p, light), banner (p top centre, w, h, ry, art),
// paint (a flat painted card: p, w, h, ry, art; arch: the top is a half circle), oculus (a round skylight in the ceiling: p, r), rug, leaves (instances: [x, y, z, nx, ny, nz, spin, sx, sy, tint]), books.
export const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const rng = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ivy: leaves scattered along a polyline that lies on a wall (n = the wall's normal), denser near the root; `fern`: a clump of long fronds fanning up
function ivy(pts, n, seed, per = 46, size = .075) {
  const r = rng(seed), out = [];
  for (let k = 0; k < pts.length - 1; k++) { const [a, b] = [pts[k], pts[k + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m = Math.round(L * per * (1 - .35 * k / pts.length));
    for (let i = 0; i < m; i++) { const u = r(), j = () => (r() - .5) * .24, p = a.map((v, c) => v + (b[c] - v) * u + (n[c] ? 0 : j()));
      const off = .012 + .03 * r(); out.push([+(p[0] + n[0] * off).toFixed(3), +(p[1] + n[1] * off).toFixed(3), +(p[2] + n[2] * off).toFixed(3), +(n[0] + (r() - .5) * .7).toFixed(2), +(n[1] + (r() - .5) * .5).toFixed(2), +(n[2] + (r() - .5) * .7).toFixed(2), +(r() * 6.28).toFixed(2), +(size * (.7 + .6 * r())).toFixed(3), +(size * (.7 + .6 * r())).toFixed(3), +r().toFixed(2)]); } }
  return out;
}
function fern(c, seed, n = 18, len = .5) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) { const a = r() * 6.28, t = .5 + .6 * r(), l = len * (.6 + .5 * r());
    for (let s = 1; s <= 6; s++) { const u = s / 6, x = c[0] + Math.cos(a) * l * u * .8, z = c[2] + Math.sin(a) * l * u * .8, y = c[1] + l * (u * t * 1.3 - u * u * .9);
      out.push([+x.toFixed(3), +y.toFixed(3), +z.toFixed(3), +(Math.cos(a) * .4).toFixed(2), 1, +(Math.sin(a) * .4).toFixed(2), +(a + 1.57).toFixed(2), +(.05 * (1.2 - u * .6)).toFixed(3), +(.1 * (1.2 - u * .5)).toFixed(3), +r().toFixed(2)]); } }
  return out;
}
// the lightmap atlas: each shell plane (floor, ceiling, four walls) gets a rectangle; uv1 = plane projection into it (build.py bakes, dress.js reads)
function atlas(planes, A = 1024, pad = 6) {
  for (let s = 200; s > 4; s -= 1) { let x = pad, y = pad, row = 0, ok = true;
    for (const q of planes) { const w = Math.ceil(q.size[0] * s), h = Math.ceil(q.size[1] * s); if (x + w + pad > A) { x = pad; y += row + pad; row = 0; } if (y + h + pad > A) { ok = false; break; } q.rect = [x, y, w, h]; x += w + pad; row = Math.max(row, h); }
    if (ok) return { size: A, pxPerM: s, planes };
  }
}
function shell(w, d, h) {
  const P = (id, o, u, v, size) => ({ id, o, u, v, size });
  return atlas([P("floor", [-w / 2, 0, d / 2], [1, 0, 0], [0, 0, -1], [w, d]), P("ceiling", [-w / 2, h, -d / 2], [1, 0, 0], [0, 0, 1], [w, d]),
    P("back", [-w / 2, 0, -d / 2], [1, 0, 0], [0, 1, 0], [w, h]), P("front", [w / 2, 0, d / 2], [-1, 0, 0], [0, 1, 0], [w, h]),
    P("left", [-w / 2, 0, d / 2], [0, 0, -1], [0, 1, 0], [d, h]), P("right", [w / 2, 0, -d / 2], [0, 0, 1], [0, 1, 0], [d, h])]);
}
// a moulding run round all four walls at height y (sy tall, dep deep)
const rim = (w, d, P, m, y, sy, dep) => [[0, -d / 2, 1], [0, d / 2, 1], [-w / 2, 0, 0], [w / 2, 0, 0]].forEach(([x, z, ax]) =>
  P({ t: "box", m, s: ax ? [w, sy, dep] : [dep, sy, d], p: [x - Math.sign(x) * dep / 2, y, z - Math.sign(z) * dep / 2] }));
const pedestal = [[.24, 0], [.24, .1], [.17, .15], [.12, .22], [.1, .7], [.15, .76], [.19, .8], [.19, .86]];
const bowl = [[0, .86], [.1, .87], [.22, .93], [.3, 1.02], [.33, 1.08], [.3, 1.09], [.27, 1.03], [.18, .97], [0, .95]];

export function doors() {
  const w = 9, d = 9, h = 4.4, WZ = -d / 2, xs = [-2.2, 0, 2.2], DW = 1.12, DH = 2.3, parts = [], P = o => parts.push(o);
  // walls: stone plinth, wood panelling, a carved frieze, panelling; gold crown; stone ledge on the plinth; gold fillets round the frieze
  const bands = [[0, .95, "plinth"], [.95, 3.55, "panel"], [3.55, 4.1, "frieze"], [4.1, h, "panel"]];
  rim(w, d, P, "gold", h - .12, .1, .14); rim(w, d, P, "dressed", .985, .07, .12); for (const y of [3.55, 4.1]) rim(w, d, P, "gold", y, .035, .06);
  for (const z of [-d / 4, 0, d / 4]) P({ t: "box", m: "beam", s: [w, .26, .3], p: [0, h - .13, z] });
  for (const x of [-2.9, 2.9]) P({ t: "box", m: "beam", s: [.22, .18, d], p: [x, h - .35, 0] });
  // door frames: dressed-stone jambs and a voussoir arch with a glowing rune keystone; a dark carved half-moon over each door
  for (const x of xs) { for (const s of [-1, 1]) P({ t: "box", m: "dressed", s: [.2, DH, .26], p: [x + s * (DW / 2 + .1), DH / 2, WZ + .06] });
    P({ t: "arch", m: "dressed", key: "rune", c: [x, DH, WZ + .06], r0: DW / 2, r1: DW / 2 + .28, dz: .26, n: 9 });
    P({ t: "paint", art: "tympanum", arch: true, p: [x, DH, WZ + .01], w: DW, h: DW / 2 }); }
  // carved pilasters between the doors, each holding a torch
  for (const x of [-1.1, 1.1]) { P({ t: "box", m: "panelDark", s: [.26, 2.6, .1], p: [x, 2.25, WZ + .05] }); for (const y of [1.0, 3.5]) P({ t: "box", m: "dressed", s: [.34, .1, .16], p: [x, y, WZ + .08] });
    P({ t: "torch", p: [x, 2.1, WZ + .1], n: [0, 0, 1], light: [255, 150, 70, 40] }); }
  for (const [x, z, n] of [[-w / 2, -d / 4 - 1.4, [1, 0, 0]], [w / 2, -d / 4 - 1.4, [-1, 0, 0]], [-w / 2, d / 4 + 1, [1, 0, 0]], [w / 2, d / 4 + 1, [-1, 0, 0]]])
    P({ t: "torch", p: [x + n[0] * .02, 2.55, z], n, light: [255, 150, 70, 45] });
  for (const x of [-3.55, 3.55]) P({ t: "brazier", p: [x, 0, 0], ped: pedestal, bowl, light: [255, 140, 60, 120] });
  P({ t: "banner", art: "banner-sun", p: [-3.45, 3.45, WZ + .04], w: .7, h: 2.0, ry: 0 }); P({ t: "banner", art: "banner-moon", p: [3.45, 3.45, WZ + .04], w: .7, h: 2.0, ry: 0 });
  P({ t: "rug", art: "rug", p: [0, .006, 0], w: 3.6, d: 4.6 });
  // the night window behind you: an arched painted sky in a stone surround, and the moonlight that comes through it
  P({ t: "paint", art: "sky", arch: true, p: [0, 1.25, -WZ - .03], w: 1.6, h: 2.55, ry: Math.PI }); P({ t: "arch", m: "dressed", c: [0, 3.0, -WZ - .08], r0: .8, r1: 1.0, dz: .16, n: 11, ry: Math.PI });
  for (const s of [-1, 1]) P({ t: "box", m: "dressed", s: [.2, 1.75, .16], p: [s * .9, 2.125, -WZ - .08] });
  P({ t: "box", m: "dressed", s: [2.0, .12, .3], p: [0, 1.19, -WZ - .14] }); P({ t: "box", m: "iron", s: [.04, 2.55, .03], p: [0, 2.52, -WZ - .05] }); P({ t: "box", m: "iron", s: [1.6, .04, .03], p: [0, 2.3, -WZ - .05] });
  // the moon comes in through a round opening in the ceiling: a beam down into the host's corner, beside the doors (seen from where you stand, clear of them)
  P({ t: "oculus", p: [-2.1, h - .01, -3.2], r: .42 });
  const moon = { from: [-2.1, h - .08, -3.2], to: [-3.1, 0, -3.1], angle: 20, rgb: [150, 175, 255], power: 1200, haze: .12 };
  // shelves of books on the side walls (one instanced draw for every book)
  const books = [], pal = [[107, 31, 31], [31, 74, 49], [29, 53, 87], [91, 58, 26], [74, 42, 92], [122, 74, 20], [42, 42, 42]]; let n = 0;
  for (const side of [-1, 1]) for (const cz of [-d / 4 + .2, d / 4 - .2]) {
    const x = side * (w / 2 - .2); P({ t: "box", m: "shelf", s: [.36, 2.9, 2.2], p: [x, 1.45, cz] });
    for (let s = 0; s < 4; s++) { const y = .35 + s * .66; P({ t: "box", m: "shelf", s: [.42, .05, 2.2], p: [x - side * .03, y, cz] }); let z = cz - 1.02;
      while (z < cz + 1.0 && n < 520) { const bw = .04 + .045 * hash(n, 1), bh = .3 + .2 * hash(n, 2), k = .7 + .5 * hash(n, 4), c = pal[(hash(n, 3) * pal.length) | 0];
        books.push([+(x - side * .07).toFixed(3), +(y + bh / 2 + .025).toFixed(3), +(z + bw / 2).toFixed(3), .26, +bh.toFixed(3), +bw.toFixed(3), ...c.map(v => Math.min(255, Math.round(v * k)))]); n++; z += bw + .006; } } }
  P({ t: "books", list: books });
  // ivy: up the two front corners of the play wall and along the plinth; a fern by each brazier
  const leaves = [...ivy([[-4.42, 0, WZ + .02], [-4.38, 1.4, WZ + .02], [-4.2, 2.6, WZ + .02], [-4.3, 3.5, WZ + .02], [-3.0, 3.62, WZ + .02]], [0, 0, 1], 11),
    ...ivy([[-4.48, 0, WZ + .3], [-4.48, 1.2, WZ + .9], [-4.48, 2.2, WZ + 1.3]], [1, 0, 0], 12, 34),
    ...ivy([[4.42, 0, WZ + .02], [4.36, 1.1, WZ + .02], [4.0, 1.9, WZ + .02], [3.7, 2.3, WZ + .02]], [0, 0, 1], 13),
    ...ivy([[-2.9, .95, WZ + .02], [-1.75, .9, WZ + .02]], [0, 0, 1], 14, 30), ...fern([-3.55, 0, .55], 15, 14, .45), ...fern([3.55, 0, -.55], 16, 14, .45)];
  P({ t: "leaves", list: leaves });
  return { name: "doors", w, d, h, WZ, xs, DW, DH, holes: xs.map(x => ({ x, w: DW, h: DH })), bands, floor: "floorPlanks", ceiling: "ceilWood", parts, moon,
    lm: shell(w, d, h), lmScale: 1.8892, exposure: .78,  // lmScale: lm.avif holds light / lmScale (renders/review/games-rich/lm_encode.py prints it); exposure: measured against the reference
    // a door leaf, in its hinge's frame (the hinge at the leaf's left edge on the wall): planks, iron straps and studs, a bronze ring
    leaf: [{ t: "box", m: "door", s: [DW - .02, DH - .02, .07], p: [DW / 2, DH / 2, 0] },
      ...[.5, 1.85].flatMap(y => [{ t: "box", m: "iron", s: [DW - .1, .07, .014], p: [DW / 2, y, .041] }, ...Array.from({ length: 7 }, (_, i) => ({ t: "box", m: "iron", s: [.03, .03, .03], p: [.13 + i * (DW - .26) / 6, y, .05] }))]),
      { t: "box", m: "bronze", s: [.1, .16, .012], p: [DW - .15, 1.0, .041] }, { t: "torus", m: "bronze", p: [DW - .15, .95, .056], r: .055, tube: .011 }] };
}

export function memory() {
  const w = 10, d = 10, h = 7, WZ = -d / 2, parts = [], P = o => parts.push(o);
  rim(w, d, P, "dressed", .11, .22, .2);
  // the carved frame round the tablet field (fits the largest wall, 10 x 10): pilasters with runes, a lintel with a relief, bases and capitals
  for (const s of [-1, 1]) { P({ t: "box", m: "dressed", s: [.45, 6.3, .3], p: [s * 3.25, 3.37, WZ + .15] }); P({ t: "box", m: "dressed", s: [.62, .24, .38], p: [s * 3.25, .12, WZ + .19] });
    P({ t: "box", m: "dressed", s: [.62, .18, .38], p: [s * 3.25, 6.43, WZ + .19] }); P({ t: "paint", art: "runes", p: [s * 3.25, 1.2, WZ + .302], w: .2, h: 4.4 }); }
  P({ t: "box", m: "dressed", s: [7.2, .48, .34], p: [0, 6.76, WZ + .17] }); P({ t: "paint", art: "lintel", p: [0, 6.56, WZ + .342], w: 6.4, h: .4 });
  for (const x of [-1, 1]) for (const z of [-1, 1]) P({ t: "lathe", m: "dressed", p: [x * (w / 2 - .45), 0, z * (d / 2 - .45)], prof: [[.5, 0], [.5, .22], [.44, .3], [.4, .4], [.35, 6.45], [.42, 6.58], [.5, 6.72], [.5, 7]] });
  for (const z of [-2.5, 0, 2.5]) P({ t: "box", m: "dressed", s: [w, .35, .4], p: [0, h - .175, z] });
  for (const s of [-1, 1]) { P({ t: "torch", p: [s * 3.95, 2.25, WZ + .02], n: [0, 0, 1], light: [255, 140, 60, 70] }); P({ t: "brazier", p: [s * 4.0, 0, -2.4], ped: pedestal, bowl, light: [255, 135, 55, 150] });
    P({ t: "banner", art: s < 0 ? "banner-sun" : "banner-moon", p: [s * (w / 2 - .04), 5.7, -.8], w: 1.0, h: 3.2, ry: -s * Math.PI / 2 }); }
  // the moon window behind you, a stone basin of water under it
  P({ t: "paint", art: "sky", arch: true, p: [0, 2.1, -WZ - .03], w: 1.4, h: 2.9, ry: Math.PI }); P({ t: "arch", m: "dressed", c: [0, 4.3, -WZ - .1], r0: .7, r1: .92, dz: .2, n: 11, ry: Math.PI });
  for (const s of [-1, 1]) P({ t: "box", m: "dressed", s: [.22, 2.2, .2], p: [s * .81, 3.2, -WZ - .1] }); P({ t: "box", m: "dressed", s: [1.84, .14, .34], p: [0, 2.07, -WZ - .17] });
  P({ t: "lathe", m: "dressed", p: [0, 0, -WZ - 1.3], prof: [[.3, 0], [.3, .1], [.18, .16], [.16, .34], [.62, .42], [.72, .6], [.66, .62], [.6, .5], [0, .48]] }); P({ t: "water", p: [0, .56, -WZ - 1.3], r: .63 });
  const moon = { from: [0, 3.9, -WZ - .25], to: [0, 0, .4], angle: 28, rgb: [150, 175, 255], power: 2200, haze: .035 };
  const leaves = [...ivy([[-3.55, 6.95, WZ + .36], [-3.3, 6.5, WZ + .32], [-3.35, 5.2, WZ + .32], [-3.1, 4.3, WZ + .32]], [0, 0, 1], 21, 50),
    ...ivy([[3.6, 6.95, WZ + .36], [2.6, 6.98, WZ + .36], [1.4, 7, WZ + .36]], [0, 1, 0], 22, 40),
    ...ivy([[3.4, 6.9, WZ + .32], [3.35, 5.8, WZ + .32]], [0, 0, 1], 23, 40),
    ...ivy([[-4.98, 0, -4.0], [-4.98, 1.6, -3.4], [-4.98, 3.0, -3.7], [-4.98, 4.2, -3.2]], [1, 0, 0], 24, 40),
    ...ivy([[4.98, 0, -3.9], [4.98, 1.3, -3.5], [4.98, 2.2, -3.8]], [-1, 0, 0], 25, 40),
    ...fern([-3.7, 0, WZ + .5], 26, 20, .6), ...fern([3.75, 0, WZ + .55], 27, 20, .6), ...fern([-.7, 0, -WZ - 1.3], 28, 10, .4)];
  P({ t: "leaves", list: leaves });
  return { name: "memory", w, d, h, WZ, holes: [], bands: [[0, h, "wallStone"]], floor: "flags", ceiling: "slate", parts, moon,
    lm: shell(w, d, h), lmScale: 1.6840, exposure: .9 };
}
export const ROOMS = { doors, memory };
