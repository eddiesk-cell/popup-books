// grow.js (L5): the library grows with the catalog. Everything here is derived from the number of ready books and the regions that have one; nothing is hand-placed.
//   a SET = 4 bookcases x 48 books (the home cases are set 0). The home group (all books) fills east, west, then new stations; each region gets a ROOM of its own
//   (the same set code, only that region's books) behind a labelled portal beside the home cases, with a portal back.
//   Any station set is at most 3 moves from home: sets 1-8 hang straight off the group's first station, the rest off those hubs (a move is a walk, a portal or a ring open).
// The station template (platform, balustrades, lantern, bridge strip) is read from room.stationTemplate when the room lane writes one; until then it is built from the room's own art here.
const PER = 48, TAU = Math.PI * 2;
const bridge = (a, b, w) => {  // a floor strip lying between two points: a card whose long local axis runs along a-b (Euler YXZ [pitch, yaw], no roll)
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), u = d.map(v => v / L);
  return { p: a.map((v, i) => (v + b[i]) / 2), size: [w, L], rot: [Math.atan2(Math.hypot(u[0], u[2]), u[1]), Math.atan2(u[0], u[2])] };
};

export function grow(room, catalog, { fake } = {}) {
  const home = room.stations.find(s => s.id === "home"), HP = home.cam.p, EYE = 1.7, WC = room.wellCentre ?? [0, 0, 2.5];
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
    if (gi === 0) anchor = home; else { const p = [(gi % 2 ? 9 : -9) + WC[0], -6 - 24 * gi, WC[2] - 4]; anchor = mk(g.id, p, "region room: " + g.region.name); platform(anchor, g.id.replace(":", "_")); }
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
  // portals: full-height arched doorways standing on the floor, set along an arc round the visitor (radius 7.8 m at the home eye): the first on each side is whole at the frame edge beside the outer case,
  // the rest curve round the ring so turning reveals more; a door that falls outside the balcony gets a floor patch. The back door of a region room stands beside its cases.
  const DW = 1.05, DH = 2.34, ARC = 7.8, TH0 = 38.5 * Math.PI / 180, STEP = .42, patch = (id, x, y, z) => card(id, floorTex, [x, y + .02, z], [3.4, 3.4], [-Math.PI / 2, 0], { tier: 2 });
  regions.forEach((r, j) => {
    const side = j % 2 ? 1 : -1, k = Math.floor(j / 2), th = TH0 + k * STEP, ra = room.stations.find(s => s.id === "r:" + r.id), P = ra.cam.p;
    const at = [HP[0] + side * ARC * Math.sin(th), DH / 2 + .02, HP[2] - ARC * Math.cos(th)], yaw = -side * th, n = [Math.sin(yaw), 0, Math.cos(yaw)];
    if (Math.abs(at[0] - HP[0]) > 6.6 || at[2] > HP[2] - 1) patch(`g_pd_${j}`, at[0], 0, at[2]);
    const bat = [P[0] + 5.0, P[1] - EYE + DH / 2 + .02, P[2] - 6.134 + .06]; patch(`g_pb_${j}`, bat[0], P[1] - EYE, bat[2]);
    home.links.push({ to: ra.id, portal: true, label: r.name, at, yaw, size: [DW, DH], path: [HP, [at[0] + n[0] * 1.8, HP[1], at[2] + n[2] * 1.8]] });
    ra.links.push({ to: "home", portal: true, label: "Back to the Grand Library", at: bat, yaw: 0, size: [DW, DH], path: [P, [bat[0], P[1], bat[2] + 1.8]] });
    portals.push({ from: "home", to: ra.id, label: r.name, at }, { from: ra.id, to: "home", label: "Back to the Grand Library", at: bat });
  });
  // the Wonder Hall: a round warp in the floor at home leads to a theatre room far below every home sight line, with three arches (soon) and the way back
  const fp = [HP[0], .03, 2.6], WP = [HP[0], -170, HP[2]], wy = WP[1] - EYE, wh = mk("wonder", WP, "the Wonder Hall");
  home.links.push({ to: "wonder", portal: true, floor: true, at: fp, label: "Wonder Hall", path: [HP, [HP[0], HP[1], 4.3], [HP[0], .55, 3.0]] });
  card("g_wh_floor", floorTex, [WP[0], wy + .02, WP[2] - 3], [20, 20], [-Math.PI / 2, 0], { tier: 2 });
  [[-.9, { soon: true }], [0, { soon: true }], [.9, { soon: true, game: "doors" }], [1.8, { soon: true, game: "memory" }]].forEach(([ph, o], i) => { const R2 = 8.6, at = [WP[0] + R2 * Math.sin(ph), wy + 2.34 + .02, WP[2] - R2 * Math.cos(ph)]; wh.links.push({ to: "wonder:" + i, ...o, arch: i, portal: true, at, yaw: -ph, size: [2.1, 4.68], label: "", path: [] }); });
  { const sc = [WP[0] - 3.94, wy + .02, WP[2] - 7.415]; wh.links.push({ to: "home", portal: true, stairUp: true, label: "Back to the Grand Library", at: sc, path: [] }); }  // the way home: the foot of the spiral stair (stairup.glb, baked for this spot: its foot meets the walk from the arrival view), left of the stage, between the middle and the left arch
  for (const [id, art] of [["east", /^(s2_|walk_east$)/], ["west", /^(s3_|walk_west$)/]]) if (!sets.some(s => s.station === id)) { home.links = home.links.filter(l => l.to !== id); const q = room.stations.find(s => s.id === id); if (q) q.links = []; room.layers = room.layers.filter(l => !art.test(l.id)); }  // no door to a bare platform, and no platform either: its floor, railings and lamp arm hung in the air beside the home balcony (owner 2026-11-16)
  for (const [id, pre] of [["east", "s2_"], ["west", "s3_"]]) if (sets.some(s => s.station === id)) room.layers = room.layers.filter(l => l.id !== pre + "bal_2");  // the room's own back railing would stand in front of the cases we put there
  room.layers.push(...layers);
  // reachability: moves from home to each set = (walks and portals) + 1 ring open
  const dist = { home: 0 }, q = ["home"]; while (q.length) { const id = q.shift(); for (const l of room.stations.find(s => s.id === id)?.links ?? []) if (!(l.to in dist)) { dist[l.to] = dist[id] + 1; q.push(l.to); } }
  const reach = sets.map((s, i) => ({ set: i, group: s.group, station: s.station, books: s.books.length, moves: (dist[s.station] ?? 99) + 1 }));
  return { sets, setStation, caseSets, portals, groups: groups.map(g => ({ id: g.id, books: g.books.length })), reach, worst: Math.max(...reach.map(r => r.moves)) };
}
