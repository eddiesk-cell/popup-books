// ink.js: the drawn half of the effects, in the book's ink and gold, on a 2D canvas over the 3D frame. Every mark is placed at a
// point the slice projected from 3D, so the drawing sticks to the action. Pixel sizes scale with the frame (S = shorter side / 1080).
import { rng } from "./fx3d.js";
export const INK = "#1d130b", GOLD = "#f0b545", PALE = "#ffe7a6", PAPER = "#f5e9cc", RUST = "#6b2414";

export class Ink {
  constructor(canvas, W, H) { this.x = canvas.getContext("2d"); this.W = W; this.H = H; this.S = Math.min(W, H) / 1080; this.R = Math.hypot(W, H); }
  frame(src) { const x = this.x; x.globalAlpha = 1; x.filter = "none"; x.drawImage(src, 0, 0); }
  panel(src, poly, { border = 16 } = {}) {  // the 3D frame seen through a polygon, ink border with a gold rule
    const x = this.x, S = this.S; x.save(); this.path(poly); x.clip(); x.drawImage(src, 0, 0); x.restore();
    this.path(poly); x.lineJoin = "round"; x.strokeStyle = INK; x.lineWidth = (border + 6) * S; x.stroke(); x.strokeStyle = PAPER; x.lineWidth = border * S; x.stroke();  // a cream paper gutter with an ink edge (action-director §7), never a black comic border
  }
  path(poly) { const x = this.x; x.beginPath(); poly.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); }
  trace(src, alpha) { const x = this.x; x.save(); x.globalAlpha = alpha; x.drawImage(src, 0, 0); x.restore(); }  // a ghost: the paper silhouette as it is
  ghost(src, alpha) { const x = this.x; x.save(); x.globalAlpha = alpha; x.filter = "sepia(1) saturate(2.2) brightness(1.25)"; x.drawImage(src, 0, 0); x.restore(); }
  lum() {  // the frame's mean relative luminance (linear light), from a 64x36 copy
    const c = this.small ??= Object.assign(document.createElement("canvas"), { width: 64, height: 36 }), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(this.x.canvas, 0, 0, 64, 36); const d = g.getImageData(0, 0, 64, 36).data, lin = v => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
    return s / (d.length / 4);
  }
  impactFrame(invert = false) {  // the anime impact frame: the picture as ink on warm paper (or inverted: paper figures on ink, for the decisive blow), its mean luminance matched to the colour frame (change under 0.1), never red. Returns [before, after]
    const x = this.x, c = x.canvas, L0 = this.lum(); x.save(); x.filter = `grayscale(1) contrast(${invert ? 5 : 3.2}) brightness(1.15)${invert ? " invert(1)" : ""}`; x.drawImage(c, 0, 0); x.filter = "none";
    x.globalCompositeOperation = "multiply"; x.fillStyle = PAPER; x.fillRect(0, 0, this.W, this.H); x.restore();
    for (let i = 0; i < 3; i++) {
      const L1 = this.lum(); if (Math.abs(L1 - L0) < 0.03) break;
      x.save(); if (L1 > L0) { x.fillStyle = INK; x.globalAlpha = Math.min(0.9, 1 - (L0 / L1) ** (1 / 2.2)); } else { x.globalCompositeOperation = "screen"; x.fillStyle = PAPER; x.globalAlpha = Math.min(0.9, (L0 - L1) / (0.8 - L1)); }
      x.fillRect(0, 0, this.W, this.H); x.restore();
    }
    return [L0, this.lum()];
  }
  focus(cx, cy, seed, k, inner = 260, color = INK) {  // focus lines (action-director P18E): 24 tapered irregular ink wedges at most 60% ink, toward the hit, re-drawn at most 3 times a second (seed)
    const x = this.x, r = rng(seed), S = this.S; x.save(); x.globalAlpha = 0.6 * Math.min(1, k); x.fillStyle = color;
    for (let i = 0; i < 24; i++) {
      const a = (i + r() * 0.8) / 24 * Math.PI * 2, w = 0.012 + r() * 0.03, r0 = inner * S * (0.9 + r() * 0.8), R = this.R;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a - w) * R, cy + Math.sin(a - w) * R); x.lineTo(cx + Math.cos(a + w) * R, cy + Math.sin(a + w) * R); x.fill();
    }
    x.restore();
  }
  speed(ang, t, k, { cx = this.W / 2, cy = this.H / 2, band = 1, v = 3000, seed = 5 } = {}) {  // streaming speed lines: 22 tapered strokes that flow along ang (never flicker), at most 60% ink
    const x = this.x, r = rng(seed), S = this.S, dx = Math.cos(ang), dy = Math.sin(ang), span = this.R * 1.6; x.save(); x.globalAlpha = 0.6 * Math.min(1, k);
    for (let i = 0; i < 22; i++) {
      const off = (r() - 0.5) * this.R * band, len = this.R * (0.15 + r() * 0.3), w = (7 + r() * 9) * S, along = ((r() * span + t * v * S * (0.7 + r() * 0.6)) % span) - span / 2;
      const hx = cx - dy * off + dx * along, hy = cy + dx * off + dy * along, tx = hx - dx * len, ty = hy - dy * len;
      x.fillStyle = i % 4 ? INK : PAPER; x.beginPath(); x.moveTo(tx, ty); x.lineTo(hx - dy * w / 2, hy + dx * w / 2); x.lineTo(hx + dx * w * 0.8, hy + dy * w * 0.8); x.lineTo(hx + dy * w / 2, hy - dx * w / 2); x.closePath(); x.fill();
    }
    x.restore();
  }
  burst(cx, cy, rad, seed, k) {  // the impact star: paper and gold, ink outline; k 0..1 over its life
    const x = this.x, r = rng(seed), S = this.S, n = 16, grow = 0.55 + 0.6 * (1 - (1 - Math.min(1, k * 3)) ** 3), fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    const star = (R, jag) => { x.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 + seed, rr = i % 2 ? R * (0.32 + 0.1 * r()) : R * (jag + (1 - jag) * r()); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); };
    x.save(); x.globalAlpha = fade; x.lineJoin = "miter";
    star(rad * S * grow, 0.55); const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad * S * grow); gr.addColorStop(0, "#fffbe8"); gr.addColorStop(0.45, PALE); gr.addColorStop(1, GOLD);
    x.fillStyle = gr; x.fill(); x.strokeStyle = INK; x.lineWidth = 7 * S; x.stroke();
    star(rad * S * grow * 0.5, 0.7); x.fillStyle = "#fffdf4"; x.fill(); x.restore();
  }
  puff(cx, cy, rad, seed, k, color = INK, ang = null) {  // a flash step's ink puff: brushy blots thrown out and thinning (k 0..1 over its life); with ang, a breath blown one way
    if (k < 0 || k > 1) return; const x = this.x, r = rng(seed), S = this.S, out = 1 - (1 - k) ** 2;
    x.save(); x.fillStyle = color;
    for (let i = 0; i < 11; i++) { const a = ang == null ? r() * Math.PI * 2 : ang + (r() - 0.5) * 0.9, d = rad * S * out * (0.2 + 0.8 * r()), rr = rad * S * (0.12 + 0.18 * r()) * (1 - 0.6 * k);
      x.globalAlpha = 0.85 * (1 - k) * (0.6 + 0.4 * r()); x.beginPath(); x.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, rr, rr * (0.6 + 0.3 * r()), a, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }
  glare(cx, cy, rad, k) {  // a local white flash on a contact (under a third of the frame, never full-frame): k 1 -> 0 over 1-2 frames
    if (k <= 0) return; const x = this.x, R = rad * this.S, g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `rgba(255,255,250,${0.95 * k})`); g.addColorStop(0.35, `rgba(255,248,225,${0.6 * k})`); g.addColorStop(1, "rgba(255,240,200,0)");
    x.save(); x.globalCompositeOperation = "screen"; x.fillStyle = g; x.fillRect(cx - R, cy - R, 2 * R, 2 * R); x.restore();
  }
  paper(k) {  // a freeze frame's paper: the frame multiplied by warm paper, a little grain at the edges (k 0..1, eased by the caller)
    if (k <= 0) return; const x = this.x; x.save(); x.globalCompositeOperation = "multiply"; x.globalAlpha = k; x.fillStyle = PAPER; x.fillRect(0, 0, this.W, this.H); x.restore(); this.vignette(0.5 * k);
  }
  spikes(cx, cy, rad, seed, k) {  // manga impact spikes: 14 jagged ink brush strokes thrown out from the contact behind the star (k 0..1: shoot out fast, thin away)
    if (k < 0 || k > 1) return; const x = this.x, r = rng(seed), S = this.S, out = 1 - (1 - Math.min(1, k * 2.5)) ** 3, thin = 1 - k;
    x.save(); x.fillStyle = INK; x.globalAlpha = 0.9 * thin;
    for (let i = 0; i < 14; i++) {
      const a = (i + r() * 0.7) / 14 * Math.PI * 2, L = rad * S * (0.9 + 0.9 * r()) * out, r0 = rad * S * 0.35 * out, w = (0.05 + 0.05 * r()) * thin;
      x.beginPath(); x.moveTo(cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0); x.lineTo(cx + Math.cos(a) * (r0 + L), cy + Math.sin(a) * (r0 + L)); x.lineTo(cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0); x.fill();
    }
    x.restore();
  }
  arc(pts, w, alpha = 1) {  // a brush stroke along screen points, thin at the tail (first) and full at the head (last)
    if (pts.length < 3) return;
    const x = this.x, S = this.S, L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const [a, b] = pts[Math.max(0, i - 1)], [c, d] = pts[Math.min(pts.length - 1, i + 1)], nx = -(d - b), ny = c - a, l = Math.hypot(nx, ny) || 1, h = w * S * (i / (pts.length - 1)) ** 1.3 / 2;
      L.push([pts[i][0] + nx / l * h, pts[i][1] + ny / l * h]); R.push([pts[i][0] - nx / l * h, pts[i][1] - ny / l * h]);
    }
    x.save(); x.globalAlpha = alpha; this.path([...L, ...R.reverse()]); const g = x.createLinearGradient(...pts[0], ...pts[pts.length - 1]); g.addColorStop(0, "rgba(255,231,166,0)"); g.addColorStop(1, PALE);
    x.fillStyle = g; x.fill(); x.strokeStyle = INK; x.lineWidth = 2.5 * S; x.globalAlpha = alpha * 0.8; x.stroke(); x.restore();
  }
  cracks(cx, cy, seed, k, size = 160) {  // ink cracks spreading from a point (k 0..1 = how far they have run), with a paper-coloured lip
    const x = this.x, r = rng(seed), S = this.S; x.save(); x.lineCap = x.lineJoin = "round";
    const branch = (px, py, a, len, w, depth) => {
      const seg = 6, pts = [[px, py]];
      for (let i = 1; i <= seg; i++) { a += (r() - 0.5) * 0.9; const l = len / seg; px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]); if (depth < 2 && r() < 0.3) branch(px, py, a + (r() - 0.5) * 1.6, len * 0.45, w * 0.6, depth + 1); }
      const m = Math.max(1, Math.round(pts.length * Math.min(1, k * (1.4 - depth * 0.3))));
      for (const [col, lw, o] of [[PAPER, w + 2, 1.5], [INK, w, 0]]) { x.strokeStyle = col; x.lineWidth = lw * S; x.beginPath(); pts.slice(0, m).forEach(([a_, b_], i) => (i ? x.lineTo(a_ + o * S, b_ + o * S) : x.moveTo(a_ + o * S, b_ + o * S))); x.stroke(); }
    };
    for (let i = 0; i < 9; i++) branch(cx, cy, (i / 9) * Math.PI * 2 + r() * 0.5, size * S * (0.6 + r() * 0.7), 5 + r() * 3, 0);
    x.restore();
  }
  // the anime white burst (copied from the Higgsfield reference): a jagged white star for its first `star` s (rad, growing), then its centre
  // breaks open and it spreads as a thick jagged white ring that thins and leaves the frame by `life` s. a: seconds since it began
  shock(cx, cy, a, rad, seed, life = 0.65, star = 0.11) {
    if (a < 0 || a > life) return; const x = this.x, r = rng(seed), S = this.S, k = a / life, u = (a - star) / (life - star), N = 15, sp = Array.from({ length: N }, () => [r(), r(), r()]);
    const out = rad * S * (a < star ? 0.6 + 0.4 * a / star : 1 + 3.2 * u ** 0.9), inn = a < star ? 0 : out * (0.62 + 0.3 * u ** 0.5), long = a < star ? 0.9 : 0.35;
    const pt = (an, R, i) => x[i ? "lineTo" : "moveTo"](cx + Math.cos(an) * R, cy + Math.sin(an) * R * 0.9);
    x.save(); x.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2; x.beginPath();
    sp.forEach(([p, q, w], i) => { const a0 = (i + 0.3 * (p - 0.5)) / N * Math.PI * 2 + seed, wd = (0.25 + 0.3 * w) / N * Math.PI;  // a round blob with spikes of uneven length at uneven angles: long while it is a star, short once it is a ring
      pt(a0 - wd, out * (0.82 + 0.1 * q), i * 4); pt(a0, out * (1 + long * q * q), 1); pt(a0 + wd, out * (0.82 + 0.1 * q), 1); pt(a0 + Math.PI / N, out * (0.8 + 0.12 * p), 1); });
    x.closePath();
    if (inn > 0) { for (let i = 0; i < 24; i++) pt(-i / 24 * Math.PI * 2 + seed, inn * (1 - 0.12 * r()), i); x.closePath(); }  // the hole that opens in its centre
    const g = x.createRadialGradient(cx, cy, inn, cx, cy, out * 1.2); g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#f4f8ff"); g.addColorStop(1, "#d9e3f2");
    x.fillStyle = g; x.fill("evenodd"); x.restore();
  }
  ring(cx, cy, rx, ry, k) {  // a drawn shockwave
    if (k < 0 || k > 1) return; const x = this.x, S = this.S, e = 1 - (1 - k) ** 3;
    x.save(); x.globalAlpha = 1 - k; x.beginPath(); x.ellipse(cx, cy, rx * S * e, ry * S * e, 0, 0, Math.PI * 2); x.strokeStyle = INK; x.lineWidth = 10 * S * (1 - k) + 1; x.stroke(); x.strokeStyle = PALE; x.lineWidth = 4 * S * (1 - k) + 1; x.stroke(); x.restore();
  }
  stars(cx, cy, rad, t, n = 3) {  // dizzy stars round a head (screen space)
    const x = this.x, S = this.S; x.save();
    for (let i = 0; i < n; i++) {
      const a = t * 5 + i * Math.PI * 2 / n, px = cx + Math.cos(a) * rad * S, py = cy + Math.sin(a) * rad * S * 0.35;
      x.beginPath(); for (let j = 0; j <= 10; j++) { const b = j * Math.PI / 5 - Math.PI / 2, rr = j % 2 ? 7 : 17; x.lineTo(px + Math.cos(b) * rr * S, py + Math.sin(b) * rr * S); }
      x.closePath(); x.fillStyle = PALE; x.fill(); x.strokeStyle = INK; x.lineWidth = 3 * S; x.stroke();
    }
    x.restore();
  }
  sweat(cx, cy, size, k) {  // a sweat drop: forms at the temple (k 0-0.35), then slides down with a wet trail (k 0.35-1)
    if (k < 0 || k > 1) return; const x = this.x, S = this.S, R = size * S * Math.min(1, k / 0.35), dy = size * S * 2.2 * Math.max(0, (k - 0.35) / 0.65) ** 1.5;
    x.save(); x.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1; x.lineCap = "round";
    if (dy > 0) { x.strokeStyle = "rgba(225,243,255,0.8)"; x.lineWidth = R * 0.5; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + dy); x.stroke(); }
    const y = cy + dy; x.beginPath(); x.moveTo(cx, y - R * 1.7); x.bezierCurveTo(cx + R * 0.35, y - R * 0.9, cx + R, y - R * 0.2, cx + R, y + R * 0.15); x.arc(cx, y + R * 0.15, R, 0, Math.PI); x.bezierCurveTo(cx - R, y - R * 0.2, cx - R * 0.35, y - R * 0.9, cx, y - R * 1.7);
    x.fillStyle = "#e3f4ff"; x.fill(); x.strokeStyle = INK; x.lineWidth = Math.max(1.5, 3 * S); x.stroke();
    x.beginPath(); x.ellipse(cx - R * 0.35, y, R * 0.18, R * 0.32, -0.3, 0, Math.PI * 2); x.fillStyle = "#fff"; x.fill(); x.restore();
  }
  shiver(cx, cy, rad, t, k) {  // shock: short wavy lines either side of a head, trembling
    if (k <= 0) return; const x = this.x, S = this.S; x.save(); x.globalAlpha = Math.min(1, k); x.strokeStyle = INK; x.lineWidth = 4 * S; x.lineCap = "round";
    for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) { const bx = cx + sg * rad * S * (1 + 0.18 * i), by = cy + (i - 1) * rad * S * 0.45, j = Math.sin(t * 2 * Math.PI * 12 + i) * 4 * S;
      x.beginPath(); for (let q = 0; q <= 6; q++) { const yy = by - rad * S * 0.18 + q * rad * S * 0.06; x.lineTo(bx + j + sg * Math.sin(q * 1.6) * 6 * S, yy); } x.stroke(); }
    x.restore();
  }
  petal(x0, y0, x1, y1, k, seed = 1) {  // a petal drifting across the frame, rocking as it falls
    if (k < 0 || k > 1) return; const x = this.x, S = this.S, r = rng(seed), ph = r() * 6, px = x0 + (x1 - x0) * k + Math.sin(k * 9 + ph) * 30 * S, py = y0 + (y1 - y0) * k + Math.sin(k * 5 + ph) * 18 * S, a = Math.sin(k * 11 + ph) * 1.2;
    x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.ellipse(0, 0, 16 * S, 9 * S, 0, 0, Math.PI * 2); x.fillStyle = "#f6b9c8"; x.fill(); x.strokeStyle = INK; x.lineWidth = 2.5 * S; x.stroke();
    x.beginPath(); x.moveTo(-10 * S, 0); x.lineTo(10 * S, 0); x.strokeStyle = "#d9879b"; x.lineWidth = 1.5 * S; x.stroke(); x.restore();
  }
  bristle(pts, len, k, seed = 1) {  // fur standing up: short ink ticks out from both sides of a line of screen points (the tail), jittering
    if (k <= 0 || pts.length < 2) return; const x = this.x, S = this.S, r = rng(seed); x.save(); x.strokeStyle = INK; x.lineWidth = 3 * S; x.lineCap = "round"; x.globalAlpha = Math.min(1, k);
    for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
      for (let j = 0; j < 4; j++) { const u = (j + 0.5) / 4, cx = ax + (bx - ax) * u, cy = ay + (by - ay) * u, l = len * S * (0.6 + 0.6 * r()) * k;
        for (const sg of [-1, 1]) { const tx = (bx - ax) / L * (r() - 0.3) * 0.6; x.beginPath(); x.moveTo(cx + sg * nx * 5 * S, cy + sg * ny * 5 * S); x.lineTo(cx + sg * nx * (5 * S + l) + tx * l, cy + sg * ny * (5 * S + l) + (by - ay) / L * (r() - 0.3) * 0.6 * l); x.stroke(); } } }
    x.restore();
  }
  vignette(k = 0.35) { const x = this.x, g = x.createRadialGradient(this.W / 2, this.H / 2, this.R * 0.25, this.W / 2, this.H / 2, this.R * 0.62); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(20,10,4,${k})`); x.fillStyle = g; x.fillRect(0, 0, this.W, this.H); }
}
