// grow.js (L5): the library grows with the catalog. Everything here is derived from the number of ready books and the regions that have one; nothing is hand-placed.
//   a SET = 4 bookcases x 48 books (the home cases are set 0). The home group (all books) fills east, west, then new stations; each region gets a ROOM of its own
//   (the same set code, only that region's books) behind a labelled portal beside the home cases, with a portal back.
//   Any station set is at most 3 moves from home: sets 1-8 hang straight off the group's first station, the rest off those hubs (a move is a walk, a portal or a ring open).
// The station template (platform, balustrades, lantern, bridge strip) is read from room.stationTemplate when the room lane writes one; until then it is built from the room's own art here.
// The rotunda (Eddie 2026-11-17, walls.js towerPlan): our 4 cases stand on the curve, each in its own facet facing the middle; each region room is a level of the same tower (`level` m apart on the
// same axis, with the same facets), its door back an arch in the wall right of its cases; home's portals are arches in the facets either side of the cases, the Wonder Hall's in its wider ring.
// Returns `levels` (floor y, ring, balcony tiers, arched holes) for walls.js and walls/rotunda.js.
const PER = 48, TAU = Math.PI * 2;
const turnY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
// the flat-drawn cases (room.cases 0-3, their ledges and light shafts, the drawn door cards, the living spots of the old well) moved onto the tower: case i's back-centre on the floor goes to the middle of
// facet i, turned to face the axis (yaw -phi); cases3d.js turns the model's case_i the same way (room.models[0].poses)
function onTower(room, plan, onFacet) {
  const T = plan.T, moves = room.cases.slice(0, 4).map((c, i) => { const b = c.bounds, F = plan.facets[i], from = [(b.min[0] + b.max[0]) / 2, 0, b.min[2]];
      return { from, to: onFacet(plan, i, F.w / 2, 0, .02), ry: -F.phi, n: F.n }; }),
    mv = (k, p) => { const m = moves[k], d = turnY(p.map((v, j) => v - m.from[j]), m.ry); return d.map((v, j) => v + m.to[j]); };
  room.cases.slice(0, 4).forEach((c, k) => { c.slots = c.slots.map(s => ({ ...s, p: mv(k, s.p), yaw: (s.yaw ?? 0) + moves[k].ry })); c.pose = { p: moves[k].to, yaw: moves[k].ry };
    const b = c.bounds, cs = [0, 1, 2, 3, 4, 5, 6, 7].map(j => mv(k, [b[j & 1 ? "max" : "min"][0], b[j & 2 ? "max" : "min"][1], b[j & 4 ? "max" : "min"][2]]));
    c.bounds = { min: [0, 1, 2].map(j => Math.min(...cs.map(q => q[j]))), max: [0, 1, 2].map(j => Math.max(...cs.map(q => q[j]))) }; });
  for (const l of room.ledges ?? []) if (l.case < 4) { l.p = mv(l.case, l.p); l.yaw = moves[l.case].ry; }
  const near = p => moves.reduce((a, m, k) => Math.abs(p[0] - m.from[0]) < Math.abs(p[0] - moves[a].from[0]) ? k : a, 0);
  room.shafts = (room.shafts ?? []).map(s => { const k = near(s.to), to = mv(k, s.to), n = moves[k].n; return { ...s, to, from: [to[0] + n[0] * 4.4, to[1] + 7, to[2] + n[1] * 4.4] }; });  // leaning in from the open middle, under the balconies
  for (const m of room.models ?? []) if (m.id === "cases") m.poses = moves.map(({ from, to, ry }) => ({ from, to, ry }));
  const dz = plan.c[1] + plan.facets[plan.door].a - T.doorAt; for (const l of room.layers) if (/^(facade|door_inside|door_l|door_r)$/.test(l.id)) l.p = [l.p[0], l.p[1], l.p[2] + dz];
  // the living books stood on the old well's shelves (radius 26 round [0, 2.5]): each goes to the facet at its own bearing round the tower, as far in front of the books as before, on a shelf board;
  // never in a facet with a door, nor on our cases' facets below the first balcony
  const row = room.walls.row, N = plan.facets.length, busy = new Set([0, 1, 2, 3, plan.door, ...[0, 1, 2].flatMap(k => [plan.right(k), plan.left(k)])]);
  room.livingSpots = (room.livingSpots ?? []).map(s => { const dx = s.p[0], dz2 = s.p[2] - 2.5, phi = Math.atan2(dx, -dz2), ins = Math.max(.05, 26 - Math.hypot(dx, dz2)), h = s.book?.h ?? .4;
    let f = plan.facets.findIndex((F, i) => { const a = ((phi - plan.th[i]) % TAU + TAU) % TAU; return a < 2 * F.half; }); const y0 = Math.min(T.top - 3, s.p[1]);
    if (busy.has(f) && y0 < T.tiers[0]) f = (f + (f === plan.door || f < 2 ? -3 : 3) + N) % N;
    const F = plan.facets[f], k = Math.round((y0 - h / 2) / row), y = k * row + (k % 6 === 5 ? .222 : .097) * row + h / 2;
    return { ...s, p: onFacet(plan, f, F.w * (.2 + .6 * (((s.p[0] * 7.31 + s.p[1] * 3.7) % 1 + 1) % 1)), y, ins), normal: [F.n[0], 0, F.n[1]] }; });
}

const bridge = (a, b, w) => {  // a floor strip lying between two points: a card whose long local axis runs along a-b (Euler YXZ [pitch, yaw], no roll)
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), u = d.map(v => v / L);
  return { p: a.map((v, i) => (v + b[i]) / 2), size: [w, L], rot: [Math.atan2(Math.hypot(u[0], u[2]), u[1]), Math.atan2(u[0], u[2])] };
};

export function grow(room, catalog, { plan, onFacet } = {}) {
  const home = room.stations.find(s => s.id === "home"), HP = home.cam.p, EYE = 1.7, RT = plan.T, holeFor = (P, f, y, size, d = .35) => ({ P, f, y, hw: .4575 * size[0], sp: .5701 * size[1], ry: .4575 * size[0], d });
  onTower(room, plan, onFacet);
  const T0 = o => o && { img: o.img, phoneImg: o.img.replace(/\.webp$/, "-p.webp") };
  const ready = [...catalog.books.filter(b => b.status === "ready"), ...catalog.books.filter(b => b.status === "making" && b.cover)], tpl = room.stationTemplate ?? {};
  const baseCase = room.layers.filter(l => /^case_\d+$/.test(l.id)).sort((a, b) => +a.id.slice(5) - +b.id.slice(5)), baseCases = room.cases.slice(0, 4), baseLedges = (room.ledges ?? []).slice();
  const regions = (catalog.regions ?? []).map(r => ({ ...r, books: ready.filter(b => b.region === r.id) })).filter(r => r.books.length);
  const groups = [{ id: "home", books: ready }, ...regions.map(r => ({ id: "r:" + r.id, books: r.books, region: r }))];
  const stations = [], sets = [], portals = [], layers = [], add = (s) => (room.stations.push(s), stations.push(s), s);
  const mk = (id, p, note) => add({ id, cam: { p, look: [p[0], p[1] + .6, p[2] - 6.134], fov: 60 }, look: { yawMin: -Math.PI, yawMax: Math.PI, pitchMin: -1.4, pitchMax: /^r:/.test(id) ? .9 : 1.4 }, note, links: [] });
  const link = (a, b, path) => { a.links.push({ to: b.id, path: path ?? [a.cam.p, b.cam.p] }); b.links.push({ to: a.id, path: [...(path ?? [a.cam.p, b.cam.p])].reverse() }); };
  const floorTex = room.layers.find(l => l.id === "floor") ?? T0(tpl.floor), balTex = room.layers.find(l => l.id === "bal_left"), lampTex = room.layers.find(l => l.id === "s2_lantern") ?? room.layers.find(l => l.id === "lantern_near");
  const card = (id, src, p, size, rot, extra = {}) => { if (src) layers.push({ id, plane: "back", img: src.img, phoneImg: src.phoneImg, p, size, rot, tint: [.85, .85, .95], fog: .1, ...extra }); };
  const T = (o) => o && { img: o.img, phoneImg: o.phoneImg ?? o.img.replace(/\.webp$/, "-p.webp") };
  const platform = (st, tag) => {  // a platform under a station and its cases: the room's stationTemplate (positions relative to the floor centre, 3 m in front of the station so the cases stand on it) or, without one, our own floor and balustrades
    const c = st.cam.p, y0 = c[1] - EYE, fc = [c[0], y0, c[2] - 2.2];  // the template's back balustrade (4.2 m behind the floor centre) stands just behind the cases
    if (tpl.floor?.img) {
      const at = o => [fc[0] + o.p[0], fc[1] + o.p[1], fc[2] + o.p[2]];
      card(`g_floor_${tag}`, T(tpl.floor), at({ p: [tpl.floor.p?.[0] ?? 0, (tpl.floor.p?.[1] ?? 0) + .02, tpl.floor.p?.[2] ?? 0] }), tpl.floor.size, tpl.floor.rot, { tier: 2 });
      (tpl.balustrade ?? []).forEach((o, i) => card(`g_bal${i}_${tag}`, T(o), at(o), o.size, o.rot, o.flip ? { flip: o.flip } : {}));
      (tpl.lanterns ?? []).forEach((o, i) => card(`g_arm${i}_${tag}`, T(o), at(o), o.size, o.rot));
      return;
    }
    card(`g_floor_${tag}`, floorTex, [c[0], y0 + .02, c[2] - 3.2], [9, 15], [-Math.PI / 2, 0], { tier: 2 });
    card(`g_balL_${tag}`, balTex, [c[0] - 4.5, y0 + .75, c[2] - 3.2], [15, 1.5], [0, Math.PI / 2]); card(`g_balR_${tag}`, balTex, [c[0] + 4.5, y0 + .75, c[2] - 3.2], [15, 1.5], [0, -Math.PI / 2], { flip: "h" });
  };
  const strip = (a, b, tag) => { const s = bridge([a[0], a[1] - EYE + .03, a[2]], [b[0], b[1] - EYE + .03, b[2]], tpl.bridge?.width ?? 2.4); card(`g_walk_${tag}`, floorTex, s.p, s.size, s.rot, { tier: 2 }); };
  const addCases = (setIdx, st) => {  // four case layers, their books' slots and ledges, translated to the station
    const d = st.cam.p.map((v, i) => v - HP[i]);
    caseSets.push(d);  // the page clones cases.glb to this offset
    baseCases.forEach(c => room.cases.push({ ...c, slots: c.slots.map(s => ({ ...s, p: s.p.map((v, i) => v + d[i]) })), bounds: c.bounds && { min: c.bounds.min.map((v, i) => v + d[i]), max: c.bounds.max.map((v, i) => v + d[i]) } }));
    baseLedges.forEach(l => room.ledges.push({ ...l, case: l.case + setIdx * 4, p: l.p.map((v, i) => v + d[i]) }));
  };
  const caseSets = [], setStation = [];  // set index -> station id
  groups.forEach((g, gi) => {
    const n = Math.max(1, Math.ceil(g.books.length / PER));
    let anchor;
    if (gi === 0) anchor = home; else anchor = mk(g.id, [HP[0], HP[1] - RT.level * gi, HP[2]], "region room: " + g.region.name);  // a level of the tower, straight below home
    const gStations = [anchor];
    for (let k = 1; k < n; k++) {
      let st = gi === 0 && k <= 2 ? room.stations.find(s => s.id === (k === 1 ? "east" : "west")) : null;
      if (!st) { const hub = k <= 8 ? 0 : ((k - 9) % 8) + 1, par = gStations[hub], dir = k % 2 ? 1 : -1, p = [par.cam.p[0] + dir * (13 + 2.5 * (k % 3)), par.cam.p[1] + 5 + 3 * (k % 4), par.cam.p[2] - 2 * Math.floor(k / 4) - 1];
        st = mk(`${g.id}#${k}`, p); link(par, st); strip(par.cam.p, st.cam.p, `${gi}_${k}`); platform(st, `${gi}_${k}`); }
      else platform(st, `${gi}_${k}`);
      gStations.push(st);
    }
    gStations.forEach((st, k) => { if (k > 0 || gi > 0) st.cam.look = [st.cam.p[0], st.cam.p[1] + .6, st.cam.p[2] - 6.134];  // arrive looking at your own cases
      sets.push({ group: g.id, station: st.id, books: g.books.slice(k * PER, (k + 1) * PER) }); setStation.push(st.id); if (sets.length > 1) addCases(sets.length - 1, st); });
  });
  // portals: full-height arched doorways set into the tower's wall (each in its own facet, in a recess `d` m deep: walls.js cuts the hole, walls/rotunda.js lines it): home's go round from the facets beside
  // our cases, the first left, then right, then the next out on each side, so turning reveals more; a region room's way back is the arch right of its cases. The card stands flush in the facet, facing the axis.
  const DW = 1.05, DH = 2.34, holes = [], levels = [{ id: "home", y: 0, P: plan, tiers: RT.tiers }], door = (st, f, y, size) => { const F = plan.facets[f], at = onFacet(plan, f, F.w / 2, y + size[1] / 2 + .02, .015);
      holes.push(holeFor(plan, f, y, size)); return { at, yaw: -F.phi, n: [F.n[0], 0, F.n[1]] }; };
  holes.push({ P: plan, f: plan.door, y: 0, hw: 1.135, sp: 2.73, ry: 1.02, c: plan.facets[plan.door].w / 2 - .036, d: .35 });  // the entrance: the facade card's own arch (it was cut in the flat entrance wall)
  regions.forEach((r, j) => {
    const k = Math.floor(j / 2), ra = room.stations.find(s => s.id === "r:" + r.id), P = ra.cam.p, y = P[1] - EYE, a = door(home, j % 2 ? plan.right(k) : plan.left(k), 0, [DW, DH]), b = door(ra, plan.right(0), y, [DW, DH]);
    levels.push({ id: ra.id, y, P: plan, tiers: levels[0].tiers });
    home.links.push({ to: ra.id, portal: true, label: r.name, at: a.at, yaw: a.yaw, size: [DW, DH], depth: .33, path: [HP, [a.at[0] + a.n[0] * 1.8, HP[1], a.at[2] + a.n[2] * 1.8]] });
    ra.links.push({ to: "home", portal: true, label: "Back to the Grand Library", at: b.at, yaw: b.yaw, size: [DW, DH], depth: .33, path: [P, [b.at[0] + b.n[0] * 1.8, P[1], b.at[2] + b.n[2] * 1.8]] });
    portals.push({ from: "home", to: ra.id, label: r.name, at: a.at }, { from: ra.id, to: "home", label: "Back to the Grand Library", at: b.at });
  });
  // the Wonder Hall: a round warp in the floor at home leads to a theatre room far below every home sight line, with three arches (soon) and the way back
  const fp = [HP[0], .03, 2.6], WP = [HP[0], -170, HP[2]], wy = WP[1] - EYE, wh = mk("wonder", WP, "the Wonder Hall"), H = plan.hall;
  home.links.push({ to: "wonder", portal: true, floor: true, at: fp, label: "Wonder Hall", path: [HP, [HP[0], HP[1], 4.3], [HP[0], .55, 3.0]] });
  [[-.9, { soon: true }], [0, { soon: true }], [.9, { soon: true, game: "doors" }], [1.8, { soon: true, game: "memory" }]].forEach(([ph, o], i) => { const f = (Math.round(ph / (TAU / H.facets.length)) + H.facets.length) % H.facets.length, F = H.facets[f];  // in the facet at that bearing round the hall's ring
    holes.push(holeFor(H, f, wy, [2.1, 4.68], .5)); wh.links.push({ to: "wonder:" + i, ...o, arch: i, portal: true, at: onFacet(H, f, F.w / 2, wy + 2.34 + .02, .015), yaw: -F.phi, size: [2.1, 4.68], depth: .48, label: "", path: [] }); });
  const sc = [WP[0] - 3.94, wy + .02, WP[2] - 7.415]; wh.links.push({ to: "home", portal: true, stairUp: true, label: "Back to the Grand Library", at: sc, path: [] });  // the way home: the foot of the spiral stair (stairup.glb, baked for this spot: its foot meets the walk from the arrival view), left of the stage, between the middle and the left arch
  levels.push({ id: "wonder", y: wy, P: H, tiers: room.walls.rotunda.hall.tiers, gap: { phi: Math.atan2(sc[0] - plan.c[0], -(sc[2] - plan.c[1])), half: .25 }, ceil: { y: wy + room.walls.rotunda.hall.ceil, hole: [sc[0], sc[2], 1.6] } });  // the stair's light rises through a gap in the balcony and a hole in the ceiling
  for (const [id, art] of [["east", /^(s2_|walk_east$)/], ["west", /^(s3_|walk_west$)/]]) if (!sets.some(s => s.station === id)) { home.links = home.links.filter(l => l.to !== id); const q = room.stations.find(s => s.id === id); if (q) q.links = []; room.layers = room.layers.filter(l => !art.test(l.id)); }  // no door to a bare platform, and no platform either: its floor, railings and lamp arm hung in the air beside the home balcony (owner 2026-11-16)
  for (const [id, pre] of [["east", "s2_"], ["west", "s3_"]]) if (sets.some(s => s.station === id)) room.layers = room.layers.filter(l => l.id !== pre + "bal_2");  // the room's own back railing would stand in front of the cases we put there
  room.layers.push(...layers);
  // reachability: moves from home to each set = (walks and portals) + 1 ring open
  const dist = { home: 0 }, q = ["home"]; while (q.length) { const id = q.shift(); for (const l of room.stations.find(s => s.id === id)?.links ?? []) if (!(l.to in dist)) { dist[l.to] = dist[id] + 1; q.push(l.to); } }
  const reach = sets.map((s, i) => ({ set: i, group: s.group, station: s.station, books: s.books.length, moves: (dist[s.station] ?? 99) + 1 }));
  return { sets, setStation, caseSets, portals, levels, holes, groups: groups.map(g => ({ id: g.id, books: g.books.length })), reach, worst: Math.max(...reach.map(r => r.moves)) };
}
