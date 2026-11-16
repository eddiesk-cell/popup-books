// Style "tale": one tale's living scene, built from the shelf's own paper layers. Called by landing.js: init(ctx) once, frame(s) every frame.
// shortcut: the book's side wings stand open and Bobo sits mid-river so a flat front view still shows the river (wings 14% outward, Bobo smaller and centred); upgrade: tilt the wings in 3D like the book.
// Layers: [file, width (m, as in the shelf's diorama), x, z, "F" = full width, top half]. The shelf's own numbers, so the scene is the book's.
const KAPI = [["sky", .2, 0, -.073, "F"], ["cloud", .0575, -.06, -.0705], ["rays", .2, 0, -.067, "F"], ["mountains", .2, 0, -.06, "F"], ["bird", .041, .05, -.056], ["shore", .2, 0, -.051, "F"], ["riverfar", .2, 0, -.043, "F"], ["treea", .21, -.045, -.03, "", "treeb"], ["waterb", .12, .05, -.022], ["bobo", .075, .012, -.014], ["waterf", .11, .055, -.006], ["butterfly", .037, -.075, -.008], ["bank", .2, 0, .01, "F"], ["reeds", .07, .035, .018], ["lotus", .075, .062, .04], ["wingl", .0978, -.0857, .066], ["wingr", .0978, .0637, .066]];
const MALI = [["sky", .2, 0, -.073, "F"], ["cloud", .0575, -.065, -.0705], ["stars", .2, 0, -.067, "F"], ["farshore", .2, 0, -.06, "F"], ["kite", .03, .072, -.056], ["village", .14, .04, -.051], ["riverfar", .2, 0, -.043, "F"], ["marketa", .19, -.045, -.03, "", "marketb"], ["waterb", .12, .05, -.022], ["boats", .11, .056, -.014], ["waterf", .11, .055, -.006], ["spirits", .075, .066, .006], ["bank", .2, 0, .012, "F"], ["wingl", .0978, -.0857, .066], ["wingr", .1116, .0557, .066]];
// Things that cross during part 3: [file, width %, z, start %, end % (of the stage width), lift %]
const FLY = [["bird", 15, -.056, -45, 80, 24], ["bird", 24, -.018, -50, 150, 10], ["butterfly", 16, -.008, 150, -50, 9], ["butterfly", 24, .005, -50, 150, 14], ["cloud", 22, -.07, 150, -50, 36], ["cloud", 17, -.068, -50, 150, 32]];
const IDLE = { cloud: "drift", bird: "bob", kite: "bob", boats: "bob", spirits: "bob", lotus: "bob", waterb: "shim", waterf: "shim", butterfly: "flit", bobo: "bob" };
const BASE = "../shelf/books/";
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), sm = t => t * t * (3 - 2 * t);


let ctx, world, aEls, bEls, aF, bF, bLoaded = false, vis = true, lastPb = null;
const BACK = new Set(["sky", "rays", "stars"]), LIFT = 12;  // backdrops stay put; the rest rise with distance, as the book is seen from above
const fOf = z => clamp((z + .075) / .145);
function layer(book, [f, w, x, z, k, top], cls, i, defer) {
  const d = document.createElement("div"), full = k === "F";
  d.className = `L ${full ? "F " : ""}${cls}${IDLE[f] ? " a-" + IDLE[f] : ""}${f === "bobo" ? " bobo" : ""}${BACK.has(f) ? " back" : ""}`;
  d.style.cssText = `--f:${fOf(z).toFixed(3)};--i:${i};z-index:${Math.round((z + .08) * 2000) + (cls === "b" ? 1 : 0)};` + (BACK.has(f) ? "" : `bottom:${((1 - fOf(z)) * LIFT * 1.28).toFixed(2)}%;`) + (full ? "" : `left:${(50 + 500 * x - 250 * w).toFixed(2)}%;width:${(500 * w).toFixed(2)}%`);
  const im = (n, c) => `<img ${c ? `class="${c}" ` : ""}${defer ? "data-" : ""}src="${BASE}${book}/layers/${n}.webp" alt="" decoding="async" draggable="false">`;
  d.innerHTML = (f === "bobo" ? `<div class="mv">${im(f)}</div>` : im(f)) + (top ? im(top, "top") : "");
  return d;
}
function creature([f, w, z, xs, xe, lift], i) {
  const d = document.createElement("div");
  d.className = `L cr a-${IDLE[f]}`;
  d.style.cssText = `--f:${fOf(z).toFixed(3)};--i:${i};z-index:${Math.round((z + .08) * 2000)};bottom:${lift}%;left:0;width:${w}%;--o:${(xs * 100 / w).toFixed(1)};--k:${((xe - xs) * 100 / w).toFixed(1)}`;
  d.innerHTML = `<div class="mv"><img src="${BASE}kapi/layers/${f}.webp" alt="" decoding="async" draggable="false"></div>`;
  return d;
}

export function init(c) {
  ctx = c; world = c.world;
  const cam = (host, id) => { host.innerHTML = `<div class="cam"><div class="stage" id="${id}"></div></div>`; return host.querySelector(".stage"); };
  const stage = cam(world, "stage");
  aEls = KAPI.map((r, i) => layer("kapi", r, "a", i)); bEls = MALI.map((r, i) => layer("mali", r, "b", i, true));
  const crEls = FLY.map(creature);
  [...aEls, ...bEls, ...crEls].sort((p, q) => p.style.zIndex - q.style.zIndex).forEach(e => stage.append(e));
  aF = aEls.map(e => +e.style.getPropertyValue("--f")); bF = bEls.map(e => +e.style.getPropertyValue("--f"));
  // the closing scene is the market again (same files, cached); native lazy loading keeps it off the first load
  const st2 = cam(c.close, "stage2");
  MALI.forEach((r, i) => { const e = layer("mali", r, "", i); e.querySelectorAll("img").forEach(m => (m.loading = "lazy")); st2.append(e); });
  [...st2.children].sort((p, q) => p.style.zIndex - q.style.zIndex).forEach(e => st2.append(e));
  // the night market loads on the first scroll or touch, or after a short pause
  if (!c.reduce) { addEventListener("scroll", loadB, { once: true, passive: true }); addEventListener("touchstart", loadB, { once: true, passive: true }); setTimeout(loadB, 2500); }
}
function loadB() {
  if (bLoaded) return; bLoaded = true;
  bEls.forEach(e => e.querySelectorAll("img").forEach(m => (m.src = m.dataset.src)));
}
export function frame({ y, vh, tr: [pw, pf, pb], geo, cx, cy, put }) {
  const on = y < geo[2][0] + geo[2][1] + vh * 1.2;
  if (on !== vis) { vis = on; world.style.visibility = on ? "" : "hidden"; }
  if (!on) return;
  [world, ctx.close].forEach(e => { put(e, "--mx", cx); put(e, "--my", cy); });
  put(world, "--zoom", 1 + .3 * sm(pw) - .2 * sm(pf) + .3 * sm(pb));
  put(world, "--rise", .2 + .8 * sm(clamp(pw * 1.5)));
  put(world, "--sf", pf);
  if (lastPb !== pb) {  // the dissolve: far layers change first, near ones last, so one world turns into the next by depth
    lastPb = pb;
    const w = f => (pb - (.08 + .42 * f)) / .45;
    aEls.forEach((e, i) => (e.style.opacity = 1 - sm(clamp((w(aF[i]) - .35) / .65))));
    bEls.forEach((e, i) => (e.style.opacity = sm(clamp(w(bF[i])))));
  }
}
