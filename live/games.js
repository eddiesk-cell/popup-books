// games.js — the games inside the live books (stories/mali/SCENES.md, "Games for the viewer"). book.json names each
// spread's game: {"type": "collect" | "order" | "shadow" | "echo", "before": line, "targets": [...], "start", "praise",
// "voice": {"start", "praise"}, ...}. The reading waits at `before` until the game is won; nothing a child taps is
// ever wrong (a miss gets a small friendly reaction); a hint comes after a few idle seconds.
//   collect  tap every target ("tap": "hover": a tapped lantern lifts and hovers, glowing, instead of vanishing; "light": it
//            lights where it stands; "thoughts": [...]: each one found shows the next of `who`'s thoughts over them)
//   order    only the next target glows; tap it and `who` jumps onto it; win when `who` stands on the last
//   shadow   tap a spot: `who` carries the `lamp` there and sets it down; its light throws `caster`'s shadow onto
//            `screen`; win when the lamp is on `answer` (two wrong spots, and the answer glows)
//   echo     each round the bells play a tune and the child taps it back; `replay` plays it again; after
//            `help_after` misses on a note its bell glows; win when the last round is done
// The state of each game is a small class (tested in games.test.mjs); makeGame() gives it hands in the scene.
import { Collect, Timing } from "../book.js";  // three.js comes in through env.THREE, so the game logic also runs under node (games.test.mjs)

export class Order {  // only the next one counts
  constructor(n) { Object.assign(this, { n, next: 0 }); }
  tap(i) { if (this.complete) return "ignore"; if (i !== this.next) return "miss"; this.next++; return "hit"; }
  get complete() { return this.next >= this.n; }
}

export class Shadow {  // where the lamp stands; two wrong spots and the answer is shown
  constructor(answer) { Object.assign(this, { answer, at: null, wrong: 0 }); }
  place(spot) { this.at = spot; if (spot === this.answer) return "fit"; return ++this.wrong >= 2 ? "help" : "miss"; }
  get complete() { return this.at === this.answer; }
}

export class Echo {  // rounds of tunes to tap back, note by note
  constructor(rounds, helpAfter = 2) { Object.assign(this, { rounds, helpAfter, round: 0, note: 0, misses: 0 }); }
  get tune() { return this.rounds[this.round]; }
  get want() { return this.tune?.[this.note]; }
  get complete() { return this.round >= this.rounds.length; }
  restart() { this.note = 0; this.misses = 0; }  // the tune is played again: the child starts the round from its first note
  tap(name) {
    if (this.complete) return "ignore";
    if (name !== this.want) return ++this.misses >= this.helpAfter ? "help" : "miss";
    this.misses = 0;
    if (++this.note < this.tune.length) return "hit";
    this.note = 0;
    return ++this.round >= this.rounds.length ? "won" : "round";
  }
}

export class Beat {  // something comes every beat (a seed to Bobo's tail, a wave under Kapi); a tap late in the beat catches it
  constructor(n, window = 0.25) { Object.assign(this, { n, window, done: 0, misses: 0, caught: false }); }
  win() { return Math.min(0.5, this.window + 0.08 * this.misses); }  // every miss widens the moment a little
  tap(k) {  // k: how far into the beat (0..1)
    if (this.complete || this.caught) return "ignore";
    if (k < 1 - this.win()) { this.misses++; return "miss"; }
    this.caught = true; this.done++; this.misses = 0; return "hit";
  }
  next() { const dropped = !this.caught && !this.complete; this.caught = false; if (dropped) this.misses++; return dropped; }  // the beat ends
  get complete() { return this.done >= this.n; }
}

export class Steer {  // past each hazard on its free side (-1 left, 1 right); the other side bumps and tries again
  constructor(free) { Object.assign(this, { free, i: 0, misses: 0 }); }
  pick(side) {
    if (this.complete) return "ignore";
    if (side !== this.free[this.i]) return ++this.misses >= 2 ? "help" : "bump";
    this.i++; this.misses = 0; return this.complete ? "won" : "pass";
  }
  get complete() { return this.i >= this.free.length; }
}

// a game's own hands on the canvas while it is played on the spread on the desk: a short still press is a tap(x, y) (screen
// px), a quick sideways stroke a swipe(-1 | 1). While a stroke game is on, a stroke neither orbits the view nor pulls the
// page over (from a corner); the page's own tap handling still runs. Returns what takes them away again.
function gestures(sp, env, c, { tap, swipe }) {
  const el = env.renderer?.domElement;
  if (!el) return () => {};
  const on = () => c.begun && !c.complete && !!sp.group?.parent;
  let p = null;
  const down = e => { p = on() && e.target === el ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: env.now() } : null; };
  const move = e => { if (swipe && p?.id === e.pointerId) e.stopPropagation(); };  // the stroke steers: the view and the page stay put
  const up = e => {
    if (p?.id !== e.pointerId) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y, dt = env.now() - p.t; p = null;
    if (!on()) return;
    if (swipe && Math.abs(dx) > 30 && Math.abs(dx) > 1.5 * Math.abs(dy) && dt < 900) swipe(Math.sign(dx));
    else if (Math.hypot(dx, dy) < 10 && dt < 500) tap?.(e.clientX, e.clientY);
  };
  const all = [["pointerdown", down], ["pointermove", move], ["pointerup", up]];
  all.forEach(([t, f]) => addEventListener(t, f, true));  // first, before the page's own (a corner's page pull included)
  return () => all.forEach(([t, f]) => removeEventListener(t, f, true));
}

const glows = new WeakMap();
// a light from within the object, 0 as it was: a warm light (a firefly, a flame, a star) that keeps its colour, at most LIT
// strong so the tone mapping never bleaches it to a cream-white disc (the halo gives it its glow), or `soft`: its own
// colours a little brighter, below the bloom (a rock, a stone, a bell)
const LIT = 1.1, GOLD = [1, 0.42, 0.06];  // GOLD: the colour a light warms to (linear: sRGB #ffb020)
export function glow(o, k, soft) {
  o?.traverse(m => {
    if (!m.isMesh || !m.material.emissive) return;
    for (let p = m; p && p !== o; p = p.parent) if (/-lit$/.test(p.name)) return;  // a decal's "-lit" card is its own picture of the light
    if (!glows.has(m)) { m.material = m.material.clone(); glows.set(m, [m.material.emissive.clone(), m.material.emissiveIntensity, m.material.emissiveMap]); }
    const [c, i, map] = glows.get(m), g = Math.max(0, Math.min(1, k)), mat = m.material, own = soft && g > 0 ? mat.map : map;
    if (mat.emissiveMap !== own) { mat.emissiveMap = own; mat.needsUpdate = true; }
    if (soft && g > 0) { mat.emissive.copy(mat.map ? new c.constructor(1, 1, 1) : mat.color).multiplyScalar(0.3 * g); mat.emissiveIntensity = 1; }
    else { mat.emissive.copy(c).lerp(c.clone().setRGB(...GOLD), g); mat.emissiveIntensity = i + (Math.max(i, LIT) - i) * g; }
  });
}

// a thought over a character (ch from sp.byName): the page's speech bubble #sbub, which live.js keeps over `who`, made soft, a
// cloud with a trail of puffs; it fades by itself. shortcut: its look is injected here; move it beside #sbub's in index.html
// when the page lane next touches it.
function think(ch, text) {
  const s = globalThis.document?.getElementById("sbub");
  if (!s || !ch || !text) return;
  if (!document.getElementById("think-css")) document.head.insertAdjacentHTML("beforeend", `<style id="think-css">
    #sbub.think { font-style: italic; background: #eef0ff; border-radius: 2em; box-shadow: 0 0 24px #c3ccffaa, 0 6px 18px #0006; }
    #sbub.think::after { border: 0; width: 14px; height: 14px; border-radius: 50%; background: #eef0ff; bottom: -20px; box-shadow: -11px 14px 0 -3px #eef0ff; }</style>`);
  s.textContent = text; s.className = "think"; s.who = ch; s.hidden = false;
  clearTimeout(s.thought); s.thought = setTimeout(() => { if (s.className === "think") s.hidden = true; s.className = ""; }, 4000);
}

// where the last finger or click came down, and the view's camera: what a game needs to know which side, or which one, was meant.
// shortcut: live.js exposes its camera as window.live.cam; take env.cam once the viewer lends it.
const pointer = { x: 0, y: 0 };
globalThis.addEventListener?.("pointerdown", e => Object.assign(pointer, { x: e.clientX, y: e.clientY }), true);
const camOf = env => env.cam ?? globalThis.live?.cam;
const onScreen = (env, p) => { const v = p.clone().project(camOf(env)); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
// of `points` (world positions, or false to skip), the index of the one nearest the last finger on the screen (null: no camera)
function nearest(env, points) {
  if (!camOf(env)) return null;
  let best = null, d = Infinity;
  points.forEach((p, i) => { if (!p) return; const [x, y] = onScreen(env, p), e = Math.hypot(x - pointer.x, y - pointer.y); if (e < d) [best, d] = [i, e]; });
  return best;
}

// the timing ring: upright, facing the reader, drawn over the grass it hides in; in the scene from the start (unseen), so
// showing it compiles no shader mid-game
function ringIn(sp, THREE) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  ring.renderOrder = 10; (sp.group ?? sp.stage).add(ring);
  return ring;
}

// a target's halo: a soft disc that fades out to its edge; HALO px across at the least (the visible glow about 44 of them)
const HALO = 64;
let haloTex;
const haloTexture = THREE => haloTex ??= !globalThis.document ? null : (() => {  // none under node (the tests)
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  [[0, 0.3], [0.45, 0.6], [0.72, 0.5], [0.9, 0.18], [1, 0]].forEach(([at, a]) => r.addColorStop(at, `rgba(255,255,255,${a})`));  // brightest in a ring round the target
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
// the light a target gives (a firefly's green-gold, a star's gold): its own glow colour, else lantern amber
function lightOf(o) {
  let c = null;
  o.traverse(m => { if (!c && m.isMesh && m.material.emissive?.getHex()) c = m.material.emissive.clone(); });
  return c ?? 0xffb347;
}

const NOTES = [392, 440, 523.25, 587.33, 659.25];  // G4 A4 C5 D5 E5: one pentatonic scale, so a wrong bell still sounds sweet
const HINT = { collect: 8, order: 6, shadow: 8, echo: 6, timing: 8, steer: 8, rally: 1e9, waves: 1e9, leap: 1e9 };  // a beat game hints on misses, not idling
const sleep = ms => new Promise(r => setTimeout(r, ms));

// env: what live.js lends a game: { sp (the spread), now(), say(text), won(), sparkle(at), wobble(o, degrees), lift(name, dy),
//   vanish(o), act(a) -> Promise (an act played now), hold(ch, what, hand, on), holding(what), place(what, at|null), where(to, top),
//   play(sound, opts), foley(event, fallback), voice(id), keyLight, ctx (AudioContext), muted(), THREE }
// The shadow game's target: the caster's own silhouette as the lamp on the winning spot throws it, drawn on the screen as a
// faint dashed ink line. Rendered once from the flame into a mask, then projected onto the screen's own surface, so it fits
// whatever puppet art the caster is (alpha-cut cards included; emissive parts, the flame, cast none).
const INK = 0.55;
// a part that is a light, which casts no shadow: a flame, a lit glow; not paper's faint backlight (a puppet card's 0.15 glow)
const lightPart = (m, mat) => (mat.emissive?.getHex() && mat.emissiveIntensity > 0.5) || /flame/.test(`${m.parent?.name} ${m.name}`);
export function inkOutline(env, caster, screen, from) {
  const { THREE, renderer: r } = env;
  if (!r || !caster || !screen || !from) return null;
  const box = new THREE.Box3().setFromObject(caster), mid = box.getCenter(new THREE.Vector3()), R = box.getBoundingSphere(new THREE.Sphere()).radius;
  const d = from.distanceTo(mid), eye = new THREE.PerspectiveCamera(2 * THREE.MathUtils.radToDeg(Math.asin(Math.min(0.95, 1.15 * R / d))), 1, 0.005, d + R);
  eye.position.copy(from); eye.lookAt(mid); eye.updateMatrixWorld();
  const mask = new THREE.WebGLRenderTarget(512, 512), swap = [];
  caster.traverse(m => m.isMesh && swap.push([m, m.material, m.visible]));
  for (const [m, was] of swap) {
    m.visible &&= was.visible && !lightPart(m, was);  // not a hit box (invisible material), not a light
    m.material = new THREE.MeshBasicMaterial({ map: was.map, alphaMap: was.alphaMap, alphaTest: was.map || was.alphaMap ? 0.5 : 0, side: THREE.DoubleSide });
  }
  const clear = [r.getClearColor(new THREE.Color()), r.getClearAlpha()], target = r.getRenderTarget();
  r.setRenderTarget(mask); r.setClearColor(0, 0); r.clear(); r.render(caster, eye);
  r.setRenderTarget(target); r.setClearColor(...clear);
  for (const [m, was, v] of swap) { m.material.dispose(); m.material = was; m.visible = v; }
  const ink = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { mask: { value: mask.texture }, L: { value: eye.projectionMatrix.clone().multiply(eye.matrixWorldInverse) }, k: { value: 0 } },
    vertexShader: `uniform mat4 L; varying vec4 vL;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vL = L * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D mask; uniform float k; varying vec4 vL;
      float at(vec2 uv) { return step(0.5, texture2D(mask, uv).a); }
      void main() {
        vec2 uv = vL.xy / vL.w * 0.5 + 0.5;
        if (vL.w <= 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
        float c = at(uv), e = 0.0;  // the edge: the silhouette's inside next to its outside
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.7854; e = max(e, abs(at(uv + vec2(cos(a), sin(a)) * 2.5 / 512.0) - c)); }
        float dash = step(0.45, fract(atan(uv.y - 0.5, uv.x - 0.5) * 7.639));  // 48 dashes around it
        if (e * dash * k < 0.01) discard;
        gl_FragColor = vec4(0.24, 0.16, 0.1, e * dash * k);
      }`,
  });
  const faces = []; screen.traverse(m => m.isMesh && !m.material.uniforms?.mask && faces.push(m));
  ink.userData.meshes = faces.map(m => m.add(new THREE.Mesh(m.geometry, ink)).children.at(-1));  // on the screen's own surface, whatever its shape
  return ink;
}

export function makeGame(sp, env) {
  const { THREE } = env, G = sp.G, obj = n => (sp.group ?? sp.root).getObjectByName(n) ?? sp.byName[n]?.body, at = o => o.getWorldPosition(new THREE.Vector3());  // group: a character's own pieces (a boat's flame) too
  const cast = { listen: [G.who ?? "lulu"], rally: ["bobo", "kapi"], waves: ["kapi", "bobo"], leap: ["kapi"] }[G.type];  // listen: the one who speaks; a beat: the pair
  const targets = (G.targets ?? cast ?? sp.m.targets ?? []).map(obj).filter(Boolean);
  const c = { targets, extra: new Map(), begun: false, last: 0, complete: false, open: () => true,
    begin() { c.begun = true; c.last = env.now(); return c.start?.(); },
    resume() { c.last = env.now(); return c.again?.(); },  // back on the page mid-game (the bells play their tune again)
    update(now) { if (c.begun) c.tick?.(now); if (c.begun && !c.complete && now - c.last > HINT[G.type] * 1000) { c.last = now; c.hint?.(); } },
    win() { c.complete = true; env.count(""); env.won(); } };
  const n = targets.length;
  // the games played anywhere on the page: a tap on a character while playing is the game's, not a hello
  if (["rally", "waves", "leap", "steer"].includes(G.type)) for (const ch of sp.cast) if (ch.proxy) c.extra.set(ch.proxy, () => (c.begun && !c.complete ? null : env.poke(ch.name)));

  if (G.type === "order") {
    const state = new Order(n), who = G.who;
    let busy = false;
    c.tick = now => targets.forEach((o, i) => glow(o, i === state.next ? 0.6 + 0.25 * Math.sin(now / 380) : 0));  // only the next one glows, never dimly
    c.tap = async i => {
      if (busy || state.complete) return;
      const o = targets[i];
      if (state.tap(i) === "miss") return env.wobble(o, 6), env.foley("game:miss", "tap");  // a soft "plip", nothing else
      busy = true; c.last = env.now();
      await env.act({ do: "fly", who, to: o.name, secs: 0.6, clip: "Jump" });  // an arc, landing on its top
      env.sparkle(at(o)); env.play("splash", { gain: 0.5 }); env.wobble(o, 3);  // the stone ripples
      busy = false;
      if (state.complete) { glow(o, 0); c.win(); }
    };
    c.hint = () => { const o = targets[state.next]; if (o) { env.sparkle(at(o)); env.lift(o.name, 0.03, 0.4); } };  // the glowing stone bounces
    c.state = state;
  } else if (G.type === "shadow") {
    const state = new Shadow(G.answer), lamp = G.lamp, caster = obj(G.caster), screen = obj(G.screen), ch = sp.byName[G.who];
    const flame = s => (env.where(s.name, true) ?? at(s)).add(new THREE.Vector3(0, 0.03, 0));  // the lamp's flame, set down on a spot
    const wick = () => sp.byName[lamp]?.body.getObjectByName(`${lamp}-flame`);  // a "dark" candle prop's flame (live.js): the page's light cue lights it (ambient.js, on 4.4 "light"); the game keeps it, never lights it
    let outline = null;  // the faint ink outline on the screen (drawn when the game begins): what a wrong spot pulses, never the screen
    // the lamp light is in the scene from the start, dark: lighting it at the payoff must not recompile every material (a 0.9 s stall)
    const light = new THREE.SpotLight(new THREE.Color(1, 0.8, 0.5), 0, 2, THREE.MathUtils.degToRad(55), 0.4, 2);
    Object.assign(light.shadow.camera, { near: 0.02, far: 1 }); light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.0005;
    light.castShadow = true; light.shadow.autoUpdate = false; sp.stage.add(light, light.target);
    const lit = on => { light.intensity = on ? 0.6 : 0; light.shadow.autoUpdate = on; light.shadow.needsUpdate = true; };
    const casts = [];
    let busy = false;
    c.start = () => {  // during the game only the caster throws a shadow, and only the lamp light makes one
      [sp.root, ...sp.cast.map(ch => ch.body)].forEach(r => r.traverse(m => m.isMesh && casts.push([m, m.castShadow])));
      casts.forEach(([m]) => (m.castShadow = false));
      caster?.traverse(m => m.isMesh && (m.castShadow = !lightPart(m, m.material)));
      if (env.keyLight) env.keyLight.castShadow = false;
      outline ??= inkOutline(env, caster, screen, obj(G.answer) && flame(obj(G.answer)));
      ink(INK);
    };
    c.tap = async i => {
      if (busy || state.complete || !ch) return;
      busy = true; lit(false); c.last = env.now();
      const spot = targets[i], front = s => {  // where Mali stands to set the lamp on a spot (Blender): beside it, on the side away from the reader's eye, so the flame stays in sight
        const p = at(s), e = camOf(env)?.position;
        return [p.x + (e && e.x > p.x ? -0.07 : 0.07), -p.z, 0];
      };
      if (!env.holding(lamp)) {  // pick the lamp up first, wherever it stands
        const l = env.where(lamp);
        if (l) await env.act({ do: "walk", who: ch.name, to: [l.x, -l.z - 0.08, 0], stop: 0 });
        env.place(lamp, null); env.hold(ch, lamp, "right", true);
      }
      await env.act({ do: "walk", who: ch.name, to: front(spot), stop: 0 });
      await env.act({ do: "face", who: ch.name, face: spot.name });
      env.hold(ch, lamp, "right", false);
      const fire = flame(spot);
      env.place(lamp, fire.clone().sub(new THREE.Vector3(0, 0.03, 0)));  // set down on the spot
      light.position.copy(fire);
      light.target.position.copy(screen ? at(screen).add(new THREE.Vector3(0, 0.15, 0)) : new THREE.Vector3(0, 0.25, -0.1));
      lit(true);
      const r = state.place(spot.name);
      busy = false; c.last = env.now();  // the hint clock starts at the set-down, so a hint never lands on the "wrong" pulse
      if (r === "fit") {
        glow(obj(G.answer), 0);
        env.sparkle(at(caster ?? spot).add(new THREE.Vector3(0, 0.1, 0))); glow(obj(`${G.caster}-flame`) ?? caster?.getObjectByName("flame"), 1);  // Tong's flame relights (a puppet's: its "flame" part)
        casts.forEach(([m, was]) => (m.castShadow = was)); if (env.keyLight) env.keyLight.castShadow = true;
        ink(0, 1500);  // the outline fades into the shadow
        return c.win();
      }
      env.wobble(caster, 8);  // Tong looks at his shadow and shakes his head
      pulse();
      if (r === "help") glow(obj(G.answer), 0.6);  // two wrong spots: the answer glows until it is tapped
    };
    let fade = 0;
    const ink = (to, ms = 600) => {  // the outline's strength, eased to `to`
      if (!outline) return;
      const k = outline.uniforms.k, from = k.value, t0 = env.now();
      clearInterval(fade); fade = setInterval(() => { const q = Math.min(1, (env.now() - t0) / ms); k.value = from + (to - from) * q; if (q >= 1) clearInterval(fade); }, 30);
    };
    const pulse = () => { ink(1, 250); setTimeout(() => !state.complete && ink(INK, 700), 300); };
    c.hint = pulse;
    c.state = state; c.light = light; c.outline = () => outline;
    c.stop = () => {  // "Read again" mid-game: the shadows, the light and the outline as they were
      casts.forEach(([m, was]) => (m.castShadow = was)); if (env.keyLight) env.keyLight.castShadow = true;
      light.removeFromParent(); outline?.userData.meshes.forEach(o => o.removeFromParent()); glow(wick(), 0);  // as it was before the cue lit it
    };
  } else if (G.type === "echo") {
    const state = new Echo(G.rounds ?? [], G.help_after ?? 2), pip = sp.byName.pip, names = targets.map(o => o.name);
    let busy = false, help = null;
    const ring = (name, gain = 1) => {
      const o = obj(name), k = names.indexOf(name);
      if (o) { glow(o, 1); setTimeout(() => glow(o, name === help ? 0.6 : 0), 600); }
      tone(NOTES[k % NOTES.length] ?? 440, gain);
      if (pip && o) env.act({ do: "fly", who: "pip", to: name, up: 0.1, secs: 0.45 });  // Pip flies over the ringing bell
    };
    const tone = (f, gain, hum) => {  // a soft bell made here: a sine with two bell partials, dying away over 1.2 s (a hum: one soft sine)
      if (env.muted() || !env.ctx) return;
      const ctx = env.ctx, t = ctx.currentTime, out = ctx.createGain(), dur = hum ? 0.9 : 1.2;
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.25 * gain, t + (hum ? 0.15 : 0.01));
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur); out.connect(ctx.destination);
      for (const [m, g] of hum ? [[0.5, 1]] : [[1, 1], [2.76, 0.3], [5.4, 0.1]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = f * m; og.gain.value = g; o.connect(og).connect(out); o.start(t); o.stop(t + dur);
      }
    };
    const playTune = async () => {  // the bells show the tune, 0.7 s apart; then it is the child's turn
      if (busy || state.complete) return;
      busy = true; state.restart();
      if (help) { glow(obj(help), 0); help = null; }
      for (const name of state.tune ?? []) { ring(name); await sleep(env.gap ?? 700); }
      busy = false; c.last = env.now();
      env.sparkle(at(replay ?? targets[Math.floor(n / 2)]));  // your turn
    };
    c.start = c.again = playTune;
    const replay = obj(G.replay);
    if (replay) c.extra.set(replay, playTune);  // tap Grandma Nok: the tune again, and the round starts over
    c.tap = async i => {
      if (state.complete) return;
      if (busy) return ring(names[i], 0.3);  // tapping along with the tune: it rings softly and does not count
      const name = names[i], want = state.want, r = state.tap(name);
      ring(name, r === "miss" || r === "help" ? 0.4 : 1);
      if (r === "miss" || r === "help") {
        setTimeout(() => tone(NOTES[names.indexOf(want)] ?? 440, 0.5, true), 450);  // Grandma Nok hums the right note
        if (r === "help") { help = want; glow(obj(want), 0.6); }
        return;
      }
      c.last = env.now();
      if (name === help) help = null;
      if (r === "round" || r === "won") {
        busy = true;
        await sleep(500);
        const done = state.rounds[state.round - 1] ?? [];
        [...new Set(done)].forEach(b => ring(b, 0.6));  // the round's bells chime together
        await sleep(1000);
        busy = false;
        if (r === "won") { targets.forEach(o => glow(o, 1, true)); return c.win(); }
        playTune();
      }
    };
    c.hint = () => { const o = obj(state.want); if (o) { env.sparkle(at(o)); glow(o, 0.5); setTimeout(() => glow(o, state.want === help ? 0.6 : 0), 700); } };
    c.state = state;
  } else if (G.type === "timing") {  // the old player's game (book.js Timing): a ring closes on the next one; tap as it is nearly shut
    const state = new Timing(n, G), size = targets.map(o => Math.max(0.012, new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()).radius));
    const ring = ringIn(sp, THREE);
    c.tick = now => {
      const o = targets[state.cur];
      ring.material.opacity = o ? 0.9 : 0;
      if (!o) return;
      const p = state.phase(now / 1000);
      ring.position.copy(at(o)); ring.scale.setScalar(size[state.cur] * (1.1 + 2.4 * (1 - p)));
      ring.material.color.set(p >= 1 - state.win() ? 0x7dffa0 : 0xffd9a0);  // green: now
    };
    c.tap = i => {
      const o = targets[i], r = state.tap(i, env.now() / 1000);
      if (r === "ignore") return env.sparkle(at(o));
      c.last = env.now();
      if (r === "miss") return env.wobble(o, 6), env.foley("game:miss", "tap"), env.say("Almost! Try again.");
      env.say(""); env.sparkle(at(o)); glow(o, 0.8, true); env.foley(`game:${o.name.replace(/\d+$/, "")}`, "pick");
      if (state.complete) { ring.material.opacity = 0; c.win(); } else env.count(`${state.cur} of ${n}`);
    };
    c.hint = () => { const o = targets[state.cur]; if (o) env.wobble(o, 4); };
    c.stop = () => ring.removeFromParent();
    c.state = state;
  } else if (G.type === "rally" || G.type === "waves" || G.type === "leap") {
    // rally (s03): every beat Kapi throws a seed to Bobo's tail; a tap as it lands, and Bobo flicks it back. waves (s08): every
    // beat a wave rocks Bobo; a tap as it lifts him, and Kapi holds on tight. leap (s09): a ring closes on Kapi on Bobo's back;
    // a tap as it shuts and he leaps (the act `leap`, his Jump into the branches). A tap anywhere counts. A miss or a drop only
    // tries again; every second one in a row the moment widens, a hint is said, and (once) the beat slows.
    const rally = G.type === "rally", leap = G.type === "leap", state = new Beat(G.count ?? (rally ? 5 : leap ? 1 : 4), G.window ?? 0.25);
    const bobo = sp.byName[G.boat ?? "bobo"], kapi = sp.byName[G.rider ?? "kapi"];
    const bone = (ch, ...names) => names.map(b => ch?.model.getObjectByName(b)).find(Boolean) ?? ch?.body;
    const mark = rally ? bone(bobo, "tail2", "tail0") : bone(kapi, "head"), hand = bone(kapi, "rightHand");  // where the ring shuts; where the seed leaves
    const ring = ringIn(sp, THREE), seed = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12).scale(1, 1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.55 }));
    seed.visible = false; if (rally) (sp.group ?? sp.stage).add(seed);
    const arc = (a, b, u) => a.clone().lerp(b, u).add(new THREE.Vector3(0, (0.05 + 0.3 * a.distanceTo(b)) * 4 * u * (1 - u), 0));
    let P = G.period ?? (rally ? 2.4 : 2.2), k = rally ? 0.1 : 0.35, then = 0, off = () => {}, slowed = false, held = false, ret = null, launch = null, gone = false;
    const hint = () => {
      if (G.voice?.hint) env.say(""), env.voice(G.voice.hint);  // a voiced hint is read along, with its subtitle
      else env.say(G.hint ?? (rally ? "Tap just as the seed reaches Bobo's tail!" : leap ? "Tap just as the ring closes on Kapi!" : "Tap just as the wave lifts Bobo!"));
      if (!slowed) { slowed = true; P *= 1.2; }
      env.sparkle(at(mark));
    };
    const missed = () => state.misses >= 2 && state.misses % 2 === 0 && hint();
    const beat = () => {  // a beat ends: a seed not flicked back falls in the river; a wave not held throws Kapi about; Kapi crouches again
      held = state.caught; c.last = env.now();
      if (!state.next()) return;
      if (leap) env.wobble(kapi?.body, 5);
      else if (rally) { env.play("splash", { gain: 0.5 }); gone = true; seed.visible = false; env.sparkle(at(mark)); }
      else { env.play("splash", { gain: 0.5 }); env.wobble(kapi?.body, 12); env.say("Whoa! Hold on tight!"); }
      missed();
    };
    const finish = () => {
      ring.material.opacity = 0; seed.visible = false; off();
      if (kapi) env.act({ do: "clip", who: kapi.name, clip: "Cheer", then: kapi.hold });
      c.win();
    };
    c.tick = now => {
      const dt = then ? Math.min(0.1, (now - then) / 1000) : 0; then = now;
      if (c.complete) return;
      k += dt / P;
      if (k >= 1) { k -= 1; beat(); }
      if (rally) {
        if (k >= 0.25 && k - dt / P < 0.25 && !state.complete) env.act({ do: "clip", who: kapi.name, clip: "Throw", then: kapi.hold });  // its swing lets go about 0.45
        if (ret) {  // flicked back: tail to Kapi's hand in 0.4 of a beat, so it is back before the next throw
          ret.u = Math.min(1, ret.u + dt / (0.4 * P)); seed.position.copy(arc(ret.a, at(hand), ret.u));
          if (ret.u >= 1) { ret = null; env.sparkle(at(hand)); if (state.complete) return finish(); }
        } else if (k < 0.45) { seed.visible = !gone || k > 0.3; gone &&= k <= 0.3; seed.position.copy(at(hand)); launch = null; }
        else { launch ??= at(hand); seed.visible = true; if (!state.caught) seed.position.copy(arc(launch, at(mark), (k - 0.45) / 0.55)); }
      } else if (!leap) {
        if (G.wave !== null && k >= 0.5 && k - dt / P < 0.5) env.lift(G.wave ?? "waves", 0.025, P);  // the crest rises to its top as the beat ends
        const bump = Math.exp(-(((k > 0.5 ? k - 1 : k) / 0.16) ** 2)), calm = (k < 0.5 ? held : state.caught) ? 0.45 : 1;
        if (bobo) bobo.body.rotation.z += 0.12 * calm * bump;
        if (kapi) kapi.body.rotation.z += 0.12 * (calm < 1 ? 0.5 : 1.4) * bump;
      }
      const closing = (k - (rally ? 0.45 : 0.3)) / (rally ? 0.55 : 0.7);
      ring.material.opacity = closing >= 0 && !state.caught && !state.complete ? 0.9 : 0;
      ring.position.copy(at(mark)); ring.scale.setScalar((rally ? 0.025 : 0.03) * (1.1 + 2.4 * (1 - Math.max(0, closing))));
      ring.material.color.set(k >= 1 - state.win() ? 0x7dffa0 : 0xffd9a0);  // green: now
    };
    const hit = () => {
      const r = state.tap(k);
      if (r === "ignore") return;
      if (r === "miss") return env.foley("game:miss", "tap"), missed();
      env.say(""); env.sparkle(at(mark)); env.foley(`game:${G.type}`, "pick");
      if (rally) { ret = { a: seed.position.clone(), u: 0 }; env.act({ do: "clip", who: bobo.name, clip: G.flick ?? "Turn", then: bobo.hold }); }
      env.count(state.complete || leap ? "" : `${state.done} of ${state.n}`);
      if (leap) env.act({ do: "clip", who: kapi.name, clip: "Jump", then: kapi.hold, ...G.leap }).then(finish);  // up into the branches
      else if (!rally && state.complete) finish();
    };
    c.start = () => { off = gestures(sp, env, c, { tap: hit }); };
    c.tap = () => {};  // a tap anywhere is the game's (gestures); one on a character neither pokes it nor counts twice
    c.stop = () => { off(); ring.removeFromParent(); seed.removeFromParent(); };
    c.state = state; c.phase = () => k;  // how far into the beat (tests, the recorder)
  } else if (G.type === "steer") {
    // steer (s07): Bobo, Kapi on his back, swims up to each hazard (the targets, in order); fish splash on one side of it, and a
    // swipe, or a tap on that side of Bobo, takes him round the other. The splashing side only bumps him back to try again.
    const bobo = sp.byName[G.who ?? "bobo"], kapi = sp.byName[G.rider ?? "kapi"];
    const state = new Steer(G.free ?? targets.map(() => (Math.random() < 0.5 ? -1 : 1)));
    const B = v => [v.x, -v.z, v.y];  // three.js -> the acts' Blender coordinates
    const right = () => new THREE.Vector3(1, 0, 0).applyQuaternion(camOf(env)?.quaternion ?? new THREE.Quaternion()).setY(0).normalize();
    const swim = to => env.act({ do: "swim", who: bobo.name, to: B(to), stop: 0 });
    let busy = true, off = () => {}, cur = null, splashed = 0;
    const approach = async () => {  // up to the next hazard, facing it
      busy = true;
      const o = targets[state.i], h = at(o).setY(bobo.pos.y), fwd = h.clone().sub(bobo.pos).setY(0).normalize(), r = right();
      cur = { h, fwd, near: h.clone().addScaledVector(fwd, -0.15), side: s => h.clone().addScaledVector(r, s * 0.11) };
      glow(o, 0.6, true); env.wobble(o, 5);
      await swim(cur.near); await env.act({ do: "face", who: bobo.name, face: B(h) });
      busy = false; c.last = env.now(); splashed = 0;
    };
    const hint = () => cur && [0, 500].forEach(ms => setTimeout(() => env.sparkle(cur.side(state.free[state.i])), ms));
    const choose = async side => {
      if (busy || state.complete || !side) return;
      busy = true; c.last = env.now();
      const r = state.pick(side);
      if (r === "pass" || r === "won") {
        env.say(""); env.foley("game:steer", "pick"); glow(targets[state.i - 1], 0);
        await swim(cur.side(side)); await swim(cur.side(side).addScaledVector(cur.fwd, 0.12));
        env.count(r === "won" ? "" : `${state.i} of ${n}`);
        if (r === "pass") return approach();
        off(); if (kapi) env.act({ do: "clip", who: kapi.name, clip: "Cheer", then: kapi.hold });
        return c.win();
      }
      await swim(cur.near.clone().lerp(cur.side(side), 0.6));  // toward the splashing side: a splash in his face, and back
      env.sparkle(cur.side(side)); env.play("splash", { gain: 0.6 }); env.wobble(bobo.body, 8);
      env.say(r !== "help" ? "Splash! Try the other side." : G.voice?.hint ? "" : G.hint ?? "The fish are splashing there. Go round the other side!");
      if (r === "help") { if (G.voice?.hint) env.voice(G.voice.hint); hint(); }
      await swim(cur.near); await env.act({ do: "face", who: bobo.name, face: B(cur.h) });
      busy = false;
    };
    c.tick = now => {  // while Bobo waits at a hazard, the fish splash on its blocked side
      if (busy || !cur || state.complete || now - splashed < 1600) return;
      splashed = now; env.sparkle(cur.side(-state.free[state.i])); env.play("splash", { gain: 0.25 });
    };
    c.start = () => { off = gestures(sp, env, c, { swipe: choose, tap: x => {
      const b = camOf(env) ? onScreen(env, at(bobo.body))[0] : innerWidth / 2;  // a tap beside Bobo: that side
      if (Math.abs(x - b) > 12) choose(Math.sign(x - b));
    } }); return approach(); };
    c.hint = hint; c.tap = () => {};  // taps are the game's (gestures)
    c.stop = () => { off(); targets.forEach(o => glow(o, 0)); };
    c.state = state; c.ready = () => !busy && !!cur;  // waiting at a hazard for a side (tests, the recorder)
  } else if (G.type === "listen") {  // the old player's game: tap the speaker and the line is said again, the words Bobo missed lit; one listen wins
    const state = new Collect(1), who = G.who ?? "lulu";
    let busy = false;
    c.tap = async () => {
      if (!c.begun) return env.poke(who);  // before the game: a tap is the speaker's usual hello
      if (busy || state.complete) return;
      busy = true; c.last = env.now(); env.bubble(null);  // the read-along says it now, the same words lit
      await env.listen(G.line, G.say ?? "");
      busy = false;
      if (state.tap(0)) { env.bubble(null); c.win(); }
    };
    c.start = c.again = () => env.bubble(who, G.line, G.say ?? "");  // her words over her: tap them (or her) to hear them again
    c.hint = () => env.wobble(targets[0], 4);
    c.state = state;
  } else {  // collect; "tap": "hover" for lanterns that wake up and rise, "light" for things lit where they stand (fireflies, candles)
    const state = new Collect(n), hover = G.tap === "hover", light = G.tap === "light";
    c.open = i => !state.done.has(i);  // a picked one catches no tap meant for the one beside it, hovering or lit
    // paper lanterns built dark (popup.py's "lantern-dim", a grey faceted ball): until lit, the lit lanterns' own paper, dimmed
    // and smooth; lit, exactly their light. shortcut: the smoothing mends the export here until popup.py shades them smooth
    let paper = null; sp.root.traverse(m => (paper ??= m.isMesh && m.material.name?.startsWith("lantern-lit") ? m.material : null));
    const dark = targets.map(o => { const ms = []; if (light && paper) o.traverse(m => m.isMesh && m.material.name?.startsWith("lantern-dim") && ms.push(m)); return ms; });
    for (const m of dark.flat()) {
      m.material = paper.clone(); m.material.color.multiplyScalar(0.6); m.material.emissive.setScalar(0);
      const p = m.geometry.attributes.position, nrm = m.geometry.attributes.normal, v = new THREE.Vector3();
      for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k).normalize(); nrm.setXYZ(k, v.x, v.y, v.z); }  // a sphere's own normals
      nrm.needsUpdate = true;
    }
    c.tap = i => {
      const o = targets[i];
      env.sparkle(at(o));
      if (!state.tap(i)) return;
      c.last = env.now();
      env.foley(`game:${o.name.replace(/\d+$/, "")}`, "pick");
      const v = G.react?.[i] ?? G.react?.["*"];
      if (v) env.voice(v);
      if (hover) { env.act({ do: "rise", what: o.name, by: 0.06, secs: 0.8 }); glow(o, 0.8); }  // woken: up 0.06 to stay, as an act, so a story rise adds to it
      else if (dark[i].length) dark[i].forEach(m => {  // a paper lantern lit: its paper's colour, a warm light inside, no white disc
        m.material.color.copy(paper.color).multiplyScalar(0.9); m.material.emissive.set(0xff8c2a); m.material.emissiveIntensity = 0.85 * LIT; });
      else if (light) { glow(o, 0.9); glow(obj(`${o.name}-flame`), 1); } else env.vanish(o);
      if (G.toss) env.toss(...G.toss);  // book.json "toss": ["kapi", "bobo"]: each one picked is thrown into Bobo's mouth
      if (G.thoughts) think(sp.byName[G.who ?? "bobo"], G.thoughts[(state.done.size - 1) % G.thoughts.length]);
      if (state.complete) c.win(); else env.count(`${state.done.size} of ${n}`);
    };
    c.hint = () => { const i = targets.findIndex((_, i) => !state.done.has(i)); if (i >= 0) { env.sparkle(at(targets[i])); env.wobble(targets[i], 4); } };
    // while the game waits on them, each unlit one wears a soft halo in the spread's light colour, at least 44 px across on the
    // screen however small it is drawn; the halo is its tap zone too, and a tap on any halo lights the unlit one nearest the
    // finger: never a lit one, never the character behind. It pulses unless the reader asked for less motion; lit, it fades.
    const off = () => {}, still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches, size = new Map(), warm = new THREE.Color(1, 0.45, 0.12);
    const halos = targets.map((o, i) => {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(THREE), color: G.halo ?? lightOf(o), transparent: true, opacity: 0,
        depthTest: false, depthWrite: false }));
      h.renderOrder = 9; h.raycast = off; (sp.group ?? sp.stage).add(h);
      c.extra.set(h, () => c.tap(nearest(env, targets.map((o, j) => !state.done.has(j) && at(o))) ?? i));
      return h;
    });
    c.tick = now => {
      const cam = camOf(env);
      if (!cam) return;
      const unit = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / innerHeight;  // world size of a pixel, one unit away
      halos.forEach((h, i) => {
        const o = targets[i], p = at(o), d = -p.clone().applyMatrix4(cam.matrixWorldInverse).z, on = !state.done.has(i) && !c.complete;
        if (!size.has(o)) size.set(o, new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()).radius * 2);
        // lit (not picked away): the halo becomes a still, soft warm glow round the light, the size of its light, not of a fingertip
        const glowing = !on && state.done.has(i) && (light || hover), want = on ? (still ? 0.85 : 0.7 + 0.25 * Math.sin(now / 230 + i)) : glowing ? 0.5 : 0;
        h.material.opacity += (want - h.material.opacity) * 0.12;  // in as the game begins; once lit, down to the glow (or out)
        if (glowing) h.material.color.lerp(warm, 0.1);
        h.position.copy(p); h.scale.setScalar((glowing ? 1.8 * size.get(o) : Math.max(HALO * unit * d, 1.4 * size.get(o))));
        h.raycast = on ? THREE.Sprite.prototype.raycast : off;
      });
    };
    c.state = state;
  }
  // a game that waits for its line is not played before it: a tap there only sparkles (a child taps all through the story)
  const play = c.tap, early = () => G.before && !c.begun;
  c.tap = i => (early() ? env.sparkle(at(targets[i])) : play(i));
  for (const [o, f] of c.extra) c.extra.set(o, () => (early() ? env.sparkle(at(o)) : f()));
  return c;
}
