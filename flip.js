// flip.js — turn a pre-rendered page by hand. Reusable for any book whose page turns are rendered
// from a fixed eye as numbered frames, with a track of where the turning page's outer corner sits on
// screen in each frame (tools/popup.py --corners writes it).
//
//   const frames = new Frames("kite/open/", 156)            // kite/open/000.webp ... 155.webp
//   const page = new PageDrag(t => frames.draw(ctx, t), end => ...)
//   page.grab(corners, 0, 72, x)  // finger down at x (0..1 of the picture): frames 0 -> 72 is the turn
//   page.move(x) ... page.release()          // or page.auto() to turn it without a finger
//
// The page is a sheet hinged at the spine. While held it follows the finger through a spring, so it
// has weight and trails the hand a little; the corner track maps the finger to the page's own corner,
// so perspective is honoured. Let go and gravity takes it: it falls the way it leans, carried by the
// speed of the flick, lands with a small bounce, and reports which end it landed on (0 = where it was
// grabbed, 1 = turned).

export class Frames {
  constructor(dir, count) {
    this.imgs = Array.from({ length: count }, (_, i) =>
      Object.assign(new Image(), { src: `${dir}${String(i).padStart(3, "0")}.webp` }));
  }
  ready() { return Promise.all(this.imgs.map(im => im.decode().catch(() => {}))); }
  draw(ctx, t) {  // a fractional frame blends its two neighbours, so a slow drag never steps
    const n = this.imgs.length, i = Math.max(0, Math.min(n - 1, Math.floor(t))), f = t - i;
    const { width: w, height: h } = ctx.canvas;
    ctx.globalAlpha = 1; ctx.drawImage(this.imgs[i], 0, 0, w, h);
    if (f > 0.02 && i + 1 < n) { ctx.globalAlpha = f; ctx.drawImage(this.imgs[i + 1], 0, 0, w, h); ctx.globalAlpha = 1; }
  }
}

const K = 260, G = 7, DAMP = 1.6;  // spring to the finger (1/s²), gravity and air on a free page

export class PageDrag {
  constructor(draw, onLand) { this.draw = draw; this.onLand = onLand; this.live = false; }

  // corners: [[x, y], ...] one per frame; a: the frame the page rests at now; b: the frame it turns to
  grab(corners, a, b, x) {
    const cx = i => corners[i][0], far = cx(b) < cx(a) ? 0.04 : 0.96;
    Object.assign(this, { corners, a, b, x0: x, far, p: 0, v: 0, held: true, target: 0, live: true, last: 0 });
    this.move(x);
    requestAnimationFrame(t => this.tick(t));
  }

  move(x) {  // the finger's share of the way across becomes the corner's share of its path
    const c = this.corners, u = (x - this.x0) / (this.far - this.x0);
    const want = c[this.a][0] + (c[this.b][0] - c[this.a][0]) * Math.max(-0.05, Math.min(1.05, u));
    this.target = (frameAtX(c, want) - this.a) / (this.b - this.a);
  }

  release() {  // a page let go while still trailing the finger is flung on by that stretch: a swipe turns it
    this.v += 4 * (this.target - this.p); this.held = false;
  }

  auto() {  // no finger: an invisible hand lifts the page over, then lets it fall
    let t0;
    const ease = k => k * k * (3 - 2 * k);
    const step = now => {
      if (!this.live) return;
      const k = Math.min(1, (now - (t0 ??= now)) / 650);
      this.target = 0.62 * ease(k);
      if (k < 1) requestAnimationFrame(step); else this.held = false;
    };
    requestAnimationFrame(step);
  }

  tick(now) {
    if (!this.live) return;
    const dt = Math.min(1 / 30, this.last ? (now - this.last) / 1000 : 1 / 60); this.last = now;
    const before = this.p;
    const acc = this.held ? K * (this.target - this.p) - 2 * Math.sqrt(K) * this.v
                          : -G * Math.cos(Math.PI * this.p) - DAMP * this.v;
    this.v += acc * dt; this.p += this.v * dt;
    if ((before - 0.5) * (this.p - 0.5) < 0) navigator.vibrate?.(8);  // a tick as it passes upright
    if (!this.held && (this.p <= 0 || this.p >= 1)) {
      const end = this.p >= 1 ? 1 : 0;
      this.p = end;
      if (Math.abs(this.v) > 0.8) this.v *= -0.12;  // paper lands with a little bounce
      else { this.live = false; this.draw(this.frame()); return this.onLand(end); }
    }
    this.p = Math.max(-0.02, Math.min(1.02, this.p));
    this.draw(this.frame());
    requestAnimationFrame(t => this.tick(t));
  }

  frame() { return this.a + (this.b - this.a) * Math.max(0, Math.min(1, this.p)); }
}

export function frameAtX(c, x) {  // the (fractional) frame whose corner sits at screen x
  for (let i = 0; i + 1 < c.length; i++) {
    const p = c[i][0], q = c[i + 1][0];
    if ((p - x) * (q - x) <= 0 && p !== q) return i + (p - x) / (p - q);
  }
  return Math.abs(c[0][0] - x) < Math.abs(c[c.length - 1][0] - x) ? 0 : c.length - 1;
}
