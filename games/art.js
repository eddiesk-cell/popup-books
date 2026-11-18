// art.js: the painted and carved art of the Wonder Hall rooms, drawn on a canvas at load (no picture files): the night sky, banners, the rug, the gold plates,
// and the carvings (a frieze, a lintel, a tympanum, rune pillars) as height maps, white = the floor of a groove. dress.js turns these into textures;
// the Blender reference (renders/review/games-rich/blend) reads the same pictures, dumped once, so both rooms wear the same art.
const C = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
// ten runes (elder-futhark-like strokes in a unit box, y down)
const RUNES = [[[.35, 1, .35, 0], [.35, .25, .72, .05], [.35, .5, .72, .3]], [[.3, 1, .3, 0], [.3, 0, .7, .3], [.7, .3, .7, 1]], [[.35, 1, .35, 0], [.35, .25, .7, .5], [.7, .5, .35, .75]],
  [[.5, 1, .5, 0], [.2, .7, .8, .3], [.2, .3, .8, .7]], [[.3, 1, .3, 0], [.3, 0, .7, .25], [.7, .25, .3, .5], [.3, .5, .7, 1]], [[.5, 1, .5, 0], [.5, .3, .2, 0], [.5, .3, .8, 0]],
  [[.7, 0, .3, .5], [.3, .5, .7, 1]], [[.5, 0, .2, .5], [.2, .5, .5, 1], [.5, 1, .8, .5], [.8, .5, .5, 0]], [[.5, 1, .5, 0], [.2, .25, .5, 0], [.8, .25, .5, 0]], [[.25, 1, .25, 0], [.75, 1, .75, 0], [.25, 0, .75, .5], [.75, 0, .25, .5]]];
const rune = (g, k, x, y, s) => { for (const [a, b, c, d] of RUNES[k % RUNES.length]) { g.moveTo(x + (a - .5) * s, y + (b - .5) * s); g.lineTo(x + (c - .5) * s, y + (d - .5) * s); } };
// a carving: strokes drawn white on black, blurred so each groove has a round floor
function carve(w, h, blur, draw) { const c = C(w, h), g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.strokeStyle = g.fillStyle = "#fff"; g.lineCap = g.lineJoin = "round"; g.filter = `blur(${blur}px)`; draw(g, w, h); return c; }
const roundel = (g, x, y, r, k) => { g.lineWidth = r * .16; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.beginPath(); rune(g, k, x, y, r * 1.1); g.stroke(); };

export const ART = {
  // the frieze round the Doors room: a running vine with curls between two fillets, a rune roundel every tile (tile = 2 m x .55 m, repeats along the wall)
  frieze: () => carve(512, 140, 1.4, (g, w, h) => { g.lineWidth = 6; for (const y of [10, h - 10]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 7; g.beginPath(); for (let x = 0; x <= w; x += 2) { const y = h / 2 + Math.sin(x / w * Math.PI * 4) * 30; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    for (let k = 0; k < 4; k++) { const x = (k + .5) * w / 4, up = k % 2 ? -1 : 1, y = h / 2 + up * 30 * Math.sin((k + .5) * Math.PI); g.lineWidth = 5; g.beginPath(); g.arc(x + 18, y - up * 14, 15, 0, 5.2); g.stroke();
      g.beginPath(); g.ellipse(x - 22, y - up * 24, 13, 6, up * .7, 0, 7); g.fill(); }
    g.fillStyle = "#000"; g.beginPath(); g.arc(w / 2, h / 2, 44, 0, 7); g.fill(); g.fillStyle = "#fff"; roundel(g, w / 2, h / 2, 36, 3); }),
  // the Memory lintel: rune roundels every .8 m and a wave between, two fillets
  lintel: () => carve(1024, 64, 1.2, (g, w, h) => { g.lineWidth = 4; for (const y of [5, h - 5]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= w; x += 2) { const y = h / 2 + Math.sin(x / w * Math.PI * 24) * 11; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    for (let k = 0; k < 8; k++) { const x = (k + .5) * w / 8; g.fillStyle = "#000"; g.beginPath(); g.arc(x, h / 2, 25, 0, 7); g.fill(); g.fillStyle = "#fff"; roundel(g, x, h / 2, 20, k); } }),
  // over each door: a half-moon of carved sun rays
  tympanum: () => carve(256, 128, 1.4, (g, w, h) => { g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h, h - 8, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(w / 2, h, 26, Math.PI, 0); g.stroke();
    g.lineWidth = 5; for (let k = 1; k < 12; k++) { const a = Math.PI + k * Math.PI / 12; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 36, h + Math.sin(a) * 36); g.lineTo(w / 2 + Math.cos(a) * (h - 22), h + Math.sin(a) * (h - 22)); g.stroke(); } }),
  // a column of runes cut into the Memory frame's pilasters (they glow faintly: the room's magic)
  runes: () => carve(48, 1056, 1, (g, w, h) => { g.lineWidth = 3.4; for (let k = 0; k < 16; k++) { g.beginPath(); rune(g, k * 7 + 2, w / 2, 40 + k * 65, 34); g.stroke(); } }),
  sky: () => { const c = C(256, 416), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 416); gr.addColorStop(0, "#070b22"); gr.addColorStop(.7, "#1a2a5e"); gr.addColorStop(1, "#2c3f74"); g.fillStyle = gr; g.fillRect(0, 0, 256, 416);
    for (let i = 0; i < 70; i++) { const s = Math.sin(i * 91.7) * 43758.5, x = (s - Math.floor(s)) * 256, t = Math.sin(i * 37.3) * 9871.3, y = (t - Math.floor(t)) * 300; g.fillStyle = `rgba(255,250,235,${.4 + .6 * ((s * 7) % 1)})`; g.fillRect(x, y, 1.6, 1.6); }
    const m = g.createRadialGradient(160, 120, 18, 160, 120, 90); m.addColorStop(0, "#e8ecff80"); m.addColorStop(1, "#e8ecff00"); g.fillStyle = m; g.fillRect(0, 0, 256, 416);
    g.fillStyle = "#f4f1e2"; g.beginPath(); g.arc(160, 120, 24, 0, 7); g.fill(); g.fillStyle = "#d9d6c788"; for (const [x, y, r] of [[152, 114, 6], [168, 128, 4], [158, 132, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = "#3a4a7a55"; for (const [x, y, rx] of [[60, 250, 90], [190, 290, 70], [110, 330, 110]]) { g.beginPath(); g.ellipse(x, y, rx, 14, 0, 0, 7); g.fill(); } return c; },
  "banner-sun": () => banner("#7a1820", "#4a0c12", g => { g.lineWidth = 7; g.beginPath(); g.arc(96, 150, 34, 0, 7); g.fill(); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.beginPath(); g.moveTo(96 + Math.cos(a) * 44, 150 + Math.sin(a) * 44); g.lineTo(96 + Math.cos(a) * 64, 150 + Math.sin(a) * 64); g.stroke(); } }),
  "banner-moon": () => banner("#1f2a5a", "#10173a", g => { g.beginPath(); g.arc(96, 150, 44, 0, 7); g.fill(); g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(116, 138, 40, 0, 7); g.fill(); g.globalCompositeOperation = "source-over";
    for (const [x, y] of [[60, 240], [132, 228], [96, 290]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 5 : 13, a = k * Math.PI / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); } }),
  rug: () => { const c = C(512, 654), g = c.getContext("2d"), W = 512, H = 654, gold = "#c99a3e";
    g.fillStyle = "#6a1814"; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 6) { g.fillStyle = y % 12 ? "#00000010" : "#ffffff08"; g.fillRect(0, y, W, 3); }
    g.fillStyle = "#1c2848"; g.fillRect(14, 14, W - 28, 56); g.fillRect(14, H - 70, W - 28, 56); g.fillRect(14, 14, 56, H - 28); g.fillRect(W - 70, 14, 56, H - 28);
    g.fillStyle = gold; const dia = (x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.fill(); };
    for (let x = 42; x < W - 30; x += 32) { dia(x, 42, 11); dia(x, H - 42, 11); } for (let y = 74; y < H - 60; y += 32) { dia(42, y, 11); dia(W - 42, y, 11); }
    g.strokeStyle = gold; g.lineWidth = 4; g.strokeRect(78, 78, W - 156, H - 156); g.lineWidth = 2; g.strokeRect(90, 90, W - 180, H - 180);
    g.fillStyle = "#1c2848"; g.beginPath(); g.moveTo(W / 2, 140); g.lineTo(W - 130, H / 2); g.lineTo(W / 2, H - 140); g.lineTo(130, H / 2); g.closePath(); g.fill(); g.lineWidth = 6; g.stroke();
    g.fillStyle = "#8a2a1c"; dia(W / 2, H / 2, 70); g.fillStyle = gold; dia(W / 2, H / 2, 24); for (const [x, y] of [[120, 120], [W - 120, 120], [120, H - 120], [W - 120, H - 120]]) dia(x, y, 18);
    g.fillStyle = "#e8dcc0"; for (let x = 16; x < W - 14; x += 6) { g.fillRect(x, 0, 2, 12); g.fillRect(x, H - 12, 2, 12); } return c; },
};
function banner(field, deep, emblem) { const c = C(192, 512), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 192, 0), gold = "#d8a94a";
  gr.addColorStop(0, deep); gr.addColorStop(.5, field); gr.addColorStop(1, deep); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(192, 0); g.lineTo(192, 470); g.lineTo(96, 430); g.lineTo(0, 470); g.closePath(); g.fill();
  g.strokeStyle = gold; g.lineWidth = 5; g.beginPath(); g.moveTo(12, 14); g.lineTo(180, 14); g.lineTo(180, 452); g.lineTo(96, 416); g.lineTo(12, 452); g.closePath(); g.stroke();
  g.fillStyle = gold; g.strokeStyle = gold; emblem(g); g.lineWidth = 3;
  g.beginPath(); for (let k = 0; k < 3; k++) rune(g, k * 3 + 1, 52 + k * 44, 330, 30); g.stroke(); return c; }

// a gold plate with text (the door plaques and the sum sign)
export function plate(c, text, size) { const g = c.getContext("2d"), w = c.width, h = c.height, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#f3d58a"); gr.addColorStop(1, "#c8923e");
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = "#7a5420"; g.lineWidth = 10; g.strokeRect(9, 9, w - 18, h - 18); g.strokeStyle = "#ffeab4"; g.lineWidth = 3; g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = "#3a2410"; g.font = `600 ${size}px Cinzel, Marcellus, Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, w / 2, h / 2 + size * .06); }
