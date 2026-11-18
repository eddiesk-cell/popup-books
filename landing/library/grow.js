// grow.js (L5, rooms by THEME since Eddie 2026-11-18): the library grows with the catalog. Everything here is derived from the catalog (web/landing/catalog.json: every tale, its category, its series)
// and the ready books (books.json); nothing is hand-placed.
//   a SET = 4 bookcases x 12 books = 48 slots. HOME is "New Arrivals and Favourites" (one set: the ready books at eye level, then the next tales of every theme mixed). Every category gets a ROOM of
//   its own (a level of the round tower, behind a labelled portal beside the home cases, with a portal back) holding every tale of that theme; a series takes one slot per chapter, side by side.
//   A room is 4 sets on its floor (192 slots: the front, the right, the left, round the back), then its first walkway as a gallery (4 more sets), then a wing (one more room of the same theme).
// The rotunda (Eddie 2026-11-17, walls.js towerPlan): our 4 cases stand on the curve, each in its own facet facing the middle; each room is a level of the same tower (`level` m apart on the
// same axis, with the same facets), its door back an arch in the wall right of its front cases; home's portals are arches in the facets either side of the cases, the Wonder Hall's in its wider ring.
// Returns `levels` (floor y, ring, balcony tiers, arched holes, the facets its cases take) for walls.js and walls/rotunda.js.
const PER = 48, TAU = Math.PI * 2;
const turnY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
// the rooms' themes (the catalog's categories), in portal order: name in the site's six languages (English stays the title; the visitor's language is the small line under it; Lao is a DRAFT for
// the owner's check), the room's light, its constellation (portals.js STARS, for the warp) and its drifting motes (library.js MOTES)
export const THEMES = [
  { cat: "The Clever Ones", id: "clever", light: [1, .74, .42], mote: "feather", names: { lo: "ຜູ້ສະຫຼາດ", th: "ผู้ฉลาดหลักแหลม", zh: "聪明的人", ja: "かしこい なかまたち", ko: "영리한 친구들" } },
  { cat: "The Brave Hearts", id: "brave", light: [1, .56, .4], mote: "ember", names: { lo: "ຫົວໃຈກ້າຫານ", th: "หัวใจกล้าหาญ", zh: "勇敢的心", ja: "ゆうかんな こころ", ko: "용감한 마음" } },
  { cat: "Sky and Stars", id: "sky", light: [.6, .72, 1], mote: "star", names: { lo: "ທ້ອງຟ້າ ແລະ ດວງດາວ", th: "ท้องฟ้าและดวงดาว", zh: "天空与星星", ja: "そらと ほし", ko: "하늘과 별" } },
  { cat: "How the World Began", id: "world", light: [1, .7, .6], mote: "seed", names: { lo: "ໂລກເກີດຂຶ້ນແນວໃດ", th: "โลกเริ่มต้นอย่างไร", zh: "世界是怎样开始的", ja: "せかいの はじまり", ko: "세상의 시작" } },
  { cat: "The Enchanted", id: "enchanted", light: [.8, .6, 1], mote: "sparkle", names: { lo: "ໂລກມະຫັດສະຈັນ", th: "โลกแห่งเวทมนตร์", zh: "魔法世界", ja: "まほうの せかい", ko: "마법의 세계" } },
  { cat: "Wild Friends", id: "wild", light: [.7, .95, .55], mote: "leaf", names: { lo: "ໝູ່ສັດປ່າ", th: "เพื่อนสัตว์ป่า", zh: "动物朋友", ja: "どうぶつの ともだち", ko: "동물 친구들" } },
  { cat: "The Kind Hearts", id: "kind", light: [1, .72, .78], mote: "petal", names: { lo: "ຫົວໃຈໃຈດີ", th: "หัวใจใจดี", zh: "善良的心", ja: "やさしい こころ", ko: "다정한 마음" } },
];
// which facets a room's sets take (walls.js towerPlan: 0-3 our cases, 4 and 20 the first doors, 12 the entrance at home): the front first, then the right and the left, then round the back
const SET_F = [[0, 1, 2, 3], [5, 6, 7, 8], [16, 17, 18, 19], [10, 11, 13, 14]];
const FLOOR_SETS = SET_F.length, ROOM_SETS = 2 * FLOOR_SETS;  // a room's floor, then its gallery; past that a wing

// the base cases (room.cases 0-3, drawn for the flat wall: back-centre on the floor at z min) and where one goes: case i of a set onto facet f at floor y, turned to face the axis, its width scaled
// to the facet (a side bay is ~6% narrower than a case bay); cases3d.js poses the model's case_i the same way
function placer(room, plan, onFacet) {
  const base = room.cases.slice(0, 4).map(c => JSON.parse(JSON.stringify(c))), from = base.map(c => { const b = c.bounds; return [(b.min[0] + b.max[0]) / 2, 0, b.min[2]]; });
  return (i, f, y) => { const F = plan.facets[f], to = onFacet(plan, f, F.w / 2, y, .02), ry = -F.phi, sx = F.w / plan.facets[i].w, c = base[i],
      mv = p => { const d = [(p[0] - from[i][0]) * sx, p[1] - from[i][1], p[2] - from[i][2]]; return turnY(d, ry).map((v, j) => v + to[j]); };
    const b = c.bounds, cs = [0, 1, 2, 3, 4, 5, 6, 7].map(j => mv([b[j & 1 ? "max" : "min"][0], b[j & 2 ? "max" : "min"][1], b[j & 4 ? "max" : "min"][2]]));
    return { case: { ...c, slots: c.slots.map(s => ({ ...s, p: mv(s.p), yaw: (s.yaw ?? 0) + ry, size: [s.size[0] * sx, s.size[1], s.size[2]] })), bounds: { min: [0, 1, 2].map(j => Math.min(...cs.map(q => q[j]))), max: [0, 1, 2].map(j => Math.max(...cs.map(q => q[j]))) }, pose: { p: to, yaw: ry }, f },
      pose: { from: from[i], to, ry, sx } }; };
}
// the flat-drawn home layers (the ledges, light shafts and door cards) moved onto the tower with the home cases
function onTower(room, plan, onFacet, homeMoves) {
  const T = plan.T, mv = (k, p) => { const m = homeMoves[k], d = turnY(p.map((v, j) => v - m.from[j]), m.ry); return d.map((v, j) => v + m.to[j]); };
  for (const l of room.ledges ?? []) if (l.case < 4) { l.p = mv(l.case, l.p); l.yaw = homeMoves[l.case].ry; }
  const near = p => homeMoves.reduce((a, m, k) => Math.abs(p[0] - m.from[0]) < Math.abs(p[0] - homeMoves[a].from[0]) ? k : a, 0);
  room.shafts = (room.shafts ?? []).map(s => { const k = near(s.to), to = mv(k, s.to), n = plan.facets[k].n; return { ...s, to, from: [to[0] + n[0] * 4.4, to[1] + 7, to[2] + n[1] * 4.4] }; });  // leaning in from the open middle, under the balconies
  for (const m of room.models ?? []) if (m.id === "cases") m.poses = homeMoves;
  const dz = plan.c[1] + plan.facets[plan.door].a - T.doorAt; for (const l of room.layers) if (/^(facade|door_inside|door_l|door_r)$/.test(l.id)) l.p = [l.p[0], l.p[1], l.p[2] + dz];
}

// every slot a room holds: one per tale, one per chapter of a series (Eddie 2026-11-18: "Nezha should be a series ... we have to do chapters for them"); the ready books first, then the tales being
// made, then the rest in catalog order. A series starts on a fresh row when single tales can fill the row before it, so its volumes stand side by side.
const roomItems = (tales, real) => {
  const rank = t => real.has(t.id) ? 0 : t.status === "planned" ? 1 : 2, list = [...tales].sort((a, b) => rank(a) - rank(b)), out = [], singles = list.filter(t => !t.series);
  const one = t => ({ tale: t, book: real.get(t.id) ?? null });
  for (const t of list) { if (!t.series) { if (singles.includes(t)) { out.push(one(t)); singles.splice(singles.indexOf(t), 1); } continue; }
    while (out.length % 4 && singles.length && rank(singles[0]) >= rank(t)) out.push(one(singles.shift()));
    for (let v = 1; v <= t.series.chapters; v++) out.push({ tale: t, vol: v, of: t.series.chapters, book: v === 1 ? real.get(t.id) ?? null : null }); }
  return out; };
// home: New Arrivals and Favourites (Eddie 2026-11-18): the ready books, the tales being made, the first book of each series, then the next tale of every theme in turn
const homeItems = (tales, real, cats) => {
  const out = [], seen = new Set(), add = (t, x = {}) => { if (out.length < PER && !seen.has(t.id)) { seen.add(t.id); out.push({ tale: t, book: real.get(t.id) ?? null, ...x }); } };
  tales.filter(t => real.has(t.id)).forEach(t => add(t)); tales.filter(t => t.status === "planned").forEach(t => add(t));
  tales.filter(t => t.series).slice(0, 8).forEach(t => add(t, { vol: 1, of: t.series.chapters }));
  const by = cats.map(c => tales.filter(t => t.category === c && !t.series)); for (let k = 0; out.length < PER && by.some(q => q.length); k = (k + 1) % by.length) { const t = by[k].shift(); if (t) add(t); }
  return out; };

export function grow(room, catalog, { plan, onFacet, tales = [] } = {}) {
  const home = room.stations.find(s => s.id === "home"), HP = home.cam.p, EYE = 1.7, RT = plan.T, holeFor = (P, f, y, size, d = .35) => ({ P, f, y, hw: .4575 * size[0], sp: .5701 * size[1], ry: .4575 * size[0], d });
  const place = placer(room, plan, onFacet), homeMoves = [0, 1, 2, 3].map(i => place(i, i, 0)); room.cases = homeMoves.map(m => m.case); onTower(room, plan, onFacet, homeMoves.map(m => m.pose));
  const ready = [...catalog.books.filter(b => b.status === "ready"), ...catalog.books.filter(b => b.status === "making" && b.cover)], real = new Map(ready.map(b => [b.id, b]));
  for (const b of ready) if (!tales.some(t => t.id === b.id)) tales = [{ id: b.id, title: b.title.en, category: THEMES[0].cat, region: b.culture ?? "", status: "live" }, ...tales];  // a ready book the catalog does not list yet still gets its place
  const cats = THEMES.map(t => t.cat), rooms = [];
  for (const th of THEMES) { const items = roomItems(tales.filter(t => t.category === th.cat), real); for (let w = 0; w * ROOM_SETS * PER < items.length; w++) rooms.push({ ...th, id: w ? `${th.id}-${w + 1}` : th.id, wing: w, items: items.slice(w * ROOM_SETS * PER, (w + 1) * ROOM_SETS * PER) }); }
  const stations = [], sets = [], portals = [], add = (s) => (room.stations.push(s), stations.push(s), s), casePoses = [], setStation = [];
  const mk = (id, p, note) => add({ id, cam: { p, look: [p[0], p[1] + .6, p[2] - 6.134], fov: 60 }, look: { yawMin: -Math.PI, yawMax: Math.PI, pitchMin: -1.4, pitchMax: .9 }, note, links: [] });
  sets.push({ group: "home", station: "home", items: homeItems(tales, real, cats), home: true, facets: SET_F[0], y: 0 }); setStation.push("home");
  const DW = 1.05, DH = 2.34, holes = [], levels = [{ id: "home", y: 0, P: plan, tiers: RT.tiers, sets: [SET_F[0]] }], door = (st, f, y, size) => { const F = plan.facets[f], at = onFacet(plan, f, F.w / 2, y + size[1] / 2 + .02, .015);
      holes.push(holeFor(plan, f, y, size)); return { at, yaw: -F.phi, n: [F.n[0], 0, F.n[1]] }; };
  holes.push({ P: plan, f: plan.door, y: 0, hw: 1.135, sp: 2.73, ry: 1.02, c: plan.facets[plan.door].w / 2 - .036, d: .35 });  // the entrance: the facade card's own arch (it was cut in the flat entrance wall)
  rooms.forEach((r, j) => {
    const st = mk("r:" + r.id, [HP[0], HP[1] - RT.level * (j + 1), HP[2]], "theme room: " + r.cat), y = st.cam.p[1] - EYE, n = Math.ceil(r.items.length / PER), lv = { id: st.id, y, P: plan, tiers: RT.tiers, sets: [], gallery: [] };
    for (let k = 0; k < n; k++) { const gal = k >= FLOOR_SETS, f = SET_F[k % FLOOR_SETS], sy = y + (gal ? RT.tiers[0] : 0);  // the gallery: the same facets on the first walkway
      (gal ? lv.gallery : lv.sets).push(f); const ms = f.map((fi, i) => place(i, fi, sy)); room.cases.push(...ms.map(m => m.case)); casePoses.push(ms.map(m => m.pose));
      sets.push({ group: r.id, station: st.id, items: r.items.slice(k * PER, (k + 1) * PER), facets: f, y: sy }); setStation.push(st.id); }
    const k = Math.floor(j / 2), a = door(home, j % 2 ? plan.right(k) : plan.left(k), 0, [DW, DH]), b = door(st, plan.right(0), y, [DW, DH]);
    levels.push(lv);
    home.links.push({ to: st.id, portal: true, label: r.cat, at: a.at, yaw: a.yaw, size: [DW, DH], depth: .33, path: [HP, [a.at[0] + a.n[0] * 1.8, HP[1], a.at[2] + a.n[2] * 1.8]] });
    st.links.push({ to: "home", portal: true, label: "Back to the Grand Library", at: b.at, yaw: b.yaw, size: [DW, DH], depth: .33, path: [st.cam.p, [b.at[0] + b.n[0] * 1.8, st.cam.p[1], b.at[2] + b.n[2] * 1.8]] });
    portals.push({ from: "home", to: st.id, label: r.cat, at: a.at }, { from: st.id, to: "home", label: "Back to the Grand Library", at: b.at });
  });
  // the Wonder Hall: a round warp in the floor at home leads to a theatre room far below every home sight line, with three arches (soon) and the way back
  const fp = [HP[0], .03, 2.6], WP = [HP[0], -Math.max(170, RT.level * (rooms.length + 1) + 2), HP[2]],  /* below the deepest room */ wy = WP[1] - EYE, wh = mk("wonder", WP, "the Wonder Hall"), H = plan.hall;
  home.links.push({ to: "wonder", portal: true, floor: true, at: fp, label: "Wonder Hall", path: [HP, [HP[0], HP[1], 4.3], [HP[0], .55, 3.0]] });
  [[-.9, { soon: true }], [0, { soon: true }], [.9, { soon: true, game: "doors" }], [1.8, { soon: true, game: "memory" }]].forEach(([ph, o], i) => { const f = (Math.round(ph / (TAU / H.facets.length)) + H.facets.length) % H.facets.length, F = H.facets[f];  // in the facet at that bearing round the hall's ring
    holes.push(holeFor(H, f, wy, [2.1, 4.68], .5)); wh.links.push({ to: "wonder:" + i, ...o, arch: i, portal: true, at: onFacet(H, f, F.w / 2, wy + 2.34 + .02, .015), yaw: -F.phi, size: [2.1, 4.68], depth: .48, label: "", path: [] }); });
  const sc = [WP[0] - 3.94, wy + .02, WP[2] - 7.415]; wh.links.push({ to: "home", portal: true, stairUp: true, label: "Back to the Grand Library", at: sc, path: [] });  // the way home: the foot of the spiral stair (stairup.glb, baked for this spot: its foot meets the walk from the arrival view), left of the stage, between the middle and the left arch
  levels.push({ id: "wonder", y: wy, P: H, tiers: room.walls.rotunda.hall.tiers, gap: { phi: Math.atan2(sc[0] - plan.c[0], -(sc[2] - plan.c[1])), half: .25 }, ceil: { y: wy + room.walls.rotunda.hall.ceil, hole: [sc[0], sc[2], 1.6] } });  // the stair's light rises through a gap in the balcony and a hole in the ceiling
  for (const [id, art] of [["east", /^(s2_|walk_east$)/], ["west", /^(s3_|walk_west$)/]]) if (!sets.some(s => s.station === id)) { home.links = home.links.filter(l => l.to !== id); const q = room.stations.find(s => s.id === id); if (q) q.links = []; room.layers = room.layers.filter(l => !art.test(l.id)); }  // no door to a bare platform, and no platform either: its floor, railings and lamp arm hung in the air beside the home balcony (owner 2026-11-16)
  for (const [id, pre] of [["east", "s2_"], ["west", "s3_"]]) if (sets.some(s => s.station === id)) room.layers = room.layers.filter(l => l.id !== pre + "bal_2");  // the room's own back railing would stand in front of the cases we put there
  // reachability: moves from home to each set = (walks and portals) + 1 ring open
  const dist = { home: 0 }, q = ["home"]; while (q.length) { const id = q.shift(); for (const l of room.stations.find(s => s.id === id)?.links ?? []) if (!(l.to in dist)) { dist[l.to] = dist[id] + 1; q.push(l.to); } }
  const reach = sets.map((s, i) => ({ set: i, group: s.group, station: s.station, books: s.items.length, moves: (dist[s.station] ?? 99) + 1 }));
  const regions = rooms.map((r, j) => ({ id: r.id, name: r.cat + (r.wing ? " " + "I".repeat(r.wing + 1) : ""), names: { en: r.cat, ...r.names }, theme: r, con: THEMES.indexOf(THEMES.find(t => t.cat === r.cat)) }));
  return { sets, setStation, casePoses, portals, levels, holes, regions, groups: [{ id: "home", books: sets[0].items.length }, ...rooms.map(r => ({ id: r.id, books: r.items.length }))], reach, worst: Math.max(...reach.map(r => r.moves)) };
}
