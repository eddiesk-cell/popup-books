// touch.js — a light reaction to any tap: a sparkle burst, a soft ring, and a jelly wobble of that
// spot of the picture. Nothing a child taps is ever wrong. Draw it on top of the frame, every frame:
//   const fx = new Fx();  fx.tap(x, y, k, R)  // pixels; k = index of the thing tapped, so the wobble follows it
//   fx.draw(ctx, now, k => [px, py])
const JT = 1.2;  // seconds the wobble lasts
export const jelly = t => (t >= JT ? 1 : 1 + 0.16 * Math.exp(-4.5 * t) * Math.sin(2 * Math.PI * 3.2 * t));

export class Fx {
  constructor() { this.list = []; this.cv = null; }

  tap(x, y, k = -1, R = 70) {
    const sp = Array.from({ length: 14 }, (_, i) => ({ a: 2 * Math.PI * i / 14 + Math.random() * 0.4, v: 90 + Math.random() * 120, s: 3 + Math.random() * 4 }));
    this.list.push({ x, y, k, R, t: performance.now(), sp });
  }

  draw(ctx, now, at) {
    this.list = this.list.filter(f => now - f.t < 1200);
    for (const f of this.list) {
      const t = (now - f.t) / 1000, [x, y] = f.k >= 0 && at ? at(f.k) : [f.x, f.y];
      const s = f.k >= 0 ? jelly(t) : 1;
      if (s !== 1) this.wobble(ctx, x, y, f.R, s);
      ctx.globalAlpha = Math.max(0, 1 - t / 0.9);  // soft ring
      ctx.strokeStyle = "#ffe2a8"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.R * 0.3 + f.R * 0.9 * t / 0.9, 0, 7); ctx.stroke();
      for (const p of f.sp) {  // sparkles fly out, fall a little, fade
        ctx.globalAlpha = Math.max(0, 1 - t / 0.8);
        ctx.fillStyle = p.s > 5 ? "#fff3c4" : "#ffc864";
        ctx.beginPath(); ctx.arc(f.x + Math.cos(p.a) * p.v * t, f.y + Math.sin(p.a) * p.v * t + 90 * t * t, p.s * (1 - t / 1.2), 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  wobble(ctx, x, y, R, s) {  // redraw the region of the frame, scaled, feathered into what is under it
    const cv = this.cv ??= document.createElement("canvas"), c = cv.getContext("2d");
    cv.width = cv.height = 2 * R;
    c.drawImage(ctx.canvas, x - R, y - R, 2 * R, 2 * R, 0, 0, 2 * R, 2 * R);
    c.globalCompositeOperation = "destination-in";
    const g = c.createRadialGradient(R, R, R * 0.5, R, R, R);
    g.addColorStop(0, "#000"); g.addColorStop(1, "#0000");
    c.fillStyle = g; c.fillRect(0, 0, 2 * R, 2 * R);
    ctx.globalAlpha = 1; ctx.drawImage(cv, x - R * s, y - R * s, 2 * R * s, 2 * R * s);
  }
}
