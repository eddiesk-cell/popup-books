// games.js — the games inside the live books (stories/mali/SCENES.md, "Games for the viewer"). book.json names each
// spread's game: {"type": "collect" | "order" | "shadow" | "echo", "before": line, "targets": [...], "start", "praise",
// "voice": {"start", "praise", "hint", "react", "again", "listen"}, ...}. The reading waits at `before` until the game is won; nothing a child taps is
// ever wrong (a miss gets a small friendly reaction); a hint comes after a few idle seconds.
//   collect  tap every target ("tap": "hover": a tapped lantern lifts and hovers, glowing, instead of vanishing; "light": it
//            lights where it stands; "thoughts": [...]: each one found shows the next of `who`'s thoughts over them)
//   order    only the next target glows; tap it and `who` jumps onto it; win when `who` stands on the last
//   shadow   tap a spot: `who` carries the `lamp` there and sets it down; its light throws `caster`'s shadow onto
//            `screen`; win when the lamp is on `answer` (two wrong spots, and the answer glows)
//   echo     each round the bells play a tune and the child taps it back; `replay` plays it again; after
//            `help_after` misses on a note its bell glows; win when the last round is done; "sounds": [pool per bell]
//            plays those pools instead of the bell notes
//   pair     "pairs": [[thing, spot], ...]: tap a thing, then where it goes; a right pair joins (correct family), a wrong one
//            wobbles (try again); win when every pair is made
//   match    as pair, but each friend walks (or flies, or hops: its Walk) to its home: "pairs": [["tik", "mound"], ["frog1", "puddle"], ["frog2", "puddle"]]: a home is a
//            piece, prop or node of a model, and several friends of one home stand side by side; "gait": {"bizzy": "fly", "tik": "float"} (default walk; "secs" the time a
//            float takes, "clip": {"tik": "Walk"} the clip it plays), "stop": metres from the home's middle (default: its edge), "spread": the gap between friends at one
//            home (0.05); the win comes when the last one is there
//   collect  "targets" may name cast characters (3D animals too) as well as page pieces: a tap on one counts (its hit box), and it wobbles and glows instead of vanishing
//   timing   "step": {"prop": "axe-tree", "clip": "Notch", "steps": 5}, "light": ["beam0", ...]: one target tapped `steps` times; a good tap plays one
//            step of the prop's clip (a prop with a model is a cast character) and lights the next of `light`; a miss plays nothing
//   collect  "count": "game.1.count": each right tap says `<count>.<n>` (the n-th picked) and shows the numeral; a friend (a cast
//            character target) also pops its number word, then says "<game>.react.<name>"; "clip": [name, secs] plays on it; tapped again: "again" and a wobble
//   collect  "deal": ["pagong", "matsing"]: each tap sends the tapped one to the next named character in turn (it flies to them), counted per character in game.dealt
//   collect  "lit_glow": 0: a lit target that is no light (a mud spot) lets its glow go 1 s after the game is won (default: it stays, a lantern's)
// c.auto(): Auto Read's helping hand (live.js help()): the next right move, or null while the game is busy: {i} a target to tap (the viewer taps it the
//   way a finger does), or {o, go} for a game played by gesture; `ready` false: not yet (a beat or a ring is not at its moment); `press`: a button to press
// The state of each game is a small class (tested in games.test.mjs); makeGame() gives it hands in the scene.
import { Collect, Timing } from "../book.js";  // three.js comes in through env.THREE, so the game logic also runs under node (games.test.mjs)

export class Order {  // only the next one counts
  constructor(n) { Object.assign(this, { n, next: 0 }); }
  tap(i) { if (this.complete) return "ignore"; if (i !== this.next) return "miss"; this.next++; return "hit"; }
  get complete() { return this.next >= this.n; }
}

export class Pair {  // tap a thing, then its spot
  constructor(pairs) { Object.assign(this, { pairs, done: new Set(), sel: null }); }
  get complete() { return this.done.size >= this.pairs.length; }
  tap(name) {  // "pick" a thing, "hit" its spot, "miss" another spot, "ignore" a joined thing or a spot with nothing picked
    if (this.complete) return "ignore";
    const t = this.pairs.findIndex((p, i) => p[0] === name && !this.done.has(i));
    if (t >= 0) return (this.sel = t), "pick";
    if (this.sel == null || !this.pairs.some(p => p[1] === name)) return "ignore";
    const hit = this.pairs[this.sel][1] === name; if (hit) this.done.add(this.sel); this.sel = null;
    return hit ? (this.complete ? "won" : "hit") : "miss";
  }
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
  c.gesture = true;  // every tap while it is on is the game's: the viewer does not also answer it as a tap on a thing
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
    if (soft && g > 0) { (mat.map ? mat.emissive.setRGB(1, 1, 1) : mat.emissive.copy(mat.color)).multiplyScalar(0.3 * g); mat.emissiveIntensity = 1; }
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
const HINT = { pair: 8, match: 8, collect: 8, order: 6, shadow: 8, echo: 6, timing: 8, steer: 8, rally: 1e9, waves: 1e9, leap: 1e9 };  // a beat game hints on misses, not idling
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
  const targets = (G.targets ?? (G.pairs ? [...new Set(G.pairs.flat())] : cast) ?? sp.m.targets ?? []).map(obj).filter(Boolean);
  const c = { targets, extra: new Map(), begun: false, last: 0, complete: false, open: () => true,
    begin() { c.begun = true; c.last = env.now(); return c.start?.(); },
    resume() { c.last = env.now(); return c.again?.(); },  // back on the page mid-game (the bells play their tune again)
    update(now) { if (c.begun) c.tick?.(now); if (c.begun && !c.complete && now - c.last > HINT[G.type] * 1000) { c.last = now; c.hint?.(); } },
    win() { c.complete = true; env.count(""); env.won(); } };
  const n = targets.length;
  // spoken words (book.json "voice": {react, again, listen, ...}, each an id in the book's words): `react` on a right tap (a string, or a list per target),
  // `again` on a wrong one, at most once in 4 s so a child tapping wildly is not talked over; neither plays unless the page names it
  let lastAgain = -1e9;
  const react = i => { const v = [].concat(G.voice?.react ?? []); return v.length ? env.voice(v[i] ?? v[0]) : null; };  // (its voice's promise: a match win waits for it)
  const again = () => { if (G.voice?.again && env.now() - lastAgain > 4000) { lastAgain = env.now(); env.voice(G.voice.again); } };
  const miss = () => (env.foley("game:miss", "tap"), again());
  // the games played anywhere on the page: a tap on a character while playing is the game's, not a hello
  if (["rally", "waves", "leap", "steer"].includes(G.type)) for (const ch of sp.cast) if (ch.proxy) c.extra.set(ch.proxy, () => (c.begun && !c.complete ? null : env.poke(ch.name)));

  if (G.type === "order") {
    const state = new Order(n), who = G.who;
    let busy = false;
    c.tick = now => targets.forEach((o, i) => glow(o, i === state.next ? 0.6 + 0.25 * Math.sin(now / 380) : 0));  // only the next one glows, never dimly
    c.tap = async i => {
      if (busy || state.complete) return;
      const o = targets[i];
      if (state.tap(i) === "miss") return env.wobble(o, 6), miss();  // a soft "plip", nothing else
      busy = true; c.last = env.now(); react(i);
      await env.act({ do: "fly", who, to: o.name, secs: 0.6, clip: "Jump" });  // an arc, landing on its top
      env.sparkle(at(o)); env.play("splash", { gain: 0.5 }); env.wobble(o, 3);  // the stone ripples
      busy = false;
      if (state.complete) { glow(o, 0); c.win(); }
    };
    c.hint = () => { const o = targets[state.next]; if (o) { env.sparkle(at(o)); env.lift(o.name, 0.03, 0.4); } };  // the glowing stone bounces
    c.auto = () => (busy || state.complete ? null : { i: state.next });
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
      miss(); env.wobble(caster, 8);  // Tong looks at his shadow and shakes his head: the try-again voice
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
    c.auto = () => (busy || state.complete ? null : { i: targets.findIndex(o => o.name === G.answer) });
    c.state = state; c.light = light; c.outline = () => outline;
    c.stop = () => {  // "Read again" mid-game: the shadows, the light and the outline as they were
      casts.forEach(([m, was]) => (m.castShadow = was)); if (env.keyLight) env.keyLight.castShadow = true;
      light.removeFromParent(); outline?.userData.meshes.forEach(o => o.removeFromParent()); glow(wick(), 0);  // as it was before the cue lit it
    };
  } else if (G.type === "echo") {
    const state = new Echo(G.rounds ?? [], G.help_after ?? 2), pip = sp.byName.pip, names = targets.map(o => o.name);
    let busy = false, help = null;
    const ring = (name, gain = 1, quiet = false) => {
      const o = obj(name), k = names.indexOf(name);
      if (o) { glow(o, 1); setTimeout(() => glow(o, name === help ? 0.6 : 0), 600); }
      if (!quiet) G.sounds?.[k] ? env.play(G.sounds[k], { gain }) : tone(NOTES[k % NOTES.length] ?? 440, gain);  // a page's own pool per target, else the pentatonic wood notes
      if (pip && o) env.act({ do: "fly", who: "pip", to: name, up: 0.1, secs: 0.45 });  // Pip flies over the ringing bell
    };
    const tone = (f, gain) => env.play("ok", { pitch: f / NOTES[0], gain, exact: true });  // a soft wood or bamboo note from the sound pool at the note's pitch (no bell)
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
      const wrong = r === "miss" || r === "help";
      ring(name, 1, wrong);  // a wrong bell glows but does not sound like a right one: the try-again voice instead
      if (wrong) {
        miss();
        if (r === "help") { help = want; glow(obj(want), 0.6); }  // the right bell glows until it is tapped
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
    c.auto = () => (busy || state.complete ? null : { i: names.indexOf(state.want) });
    c.state = state;
  } else if (G.type === "timing") {  // the old player's game (book.js Timing): a ring closes on the next one; tap as it is nearly shut
    // "step": {"prop", "clip", "steps"} + "light": [names]: the one target is tapped `steps` times; each good tap plays one step of the prop's clip
    // (1/steps of its length, then it holds) and lights the next of `light`. Without them: one tap per target, as before.
    const S = G.step, steps = S ? S.steps ?? n : n, state = new Timing(steps, G), lamps = (G.light ?? []).map(obj), prop = S && sp.byName[S.prop], clip = prop?.clips?.[S.clip];
    const act = clip && prop.mix.clipAction(clip); let stopAt = 0;
    c.start = () => { if (act) { act.reset().setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.play(); act.paused = true; prop.cur = act; prop.done = () => {}; } };  // at rest on its first frame; live.js's loop() never cuts it
    const size = targets.map(o => Math.max(0.012, new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()).radius));
    const ring = ringIn(sp, THREE);
    c.tick = now => {
      if (act && !act.paused && act.time >= stopAt) (act.time = stopAt, act.paused = true);  // one step done: hold
      const o = targets[S ? 0 : state.cur];
      ring.material.opacity = o && !state.complete ? 0.9 : 0;
      if (!o) return;
      const p = state.phase(now / 1000);
      ring.position.copy(at(o)); ring.scale.setScalar(size[S ? 0 : state.cur] * (1.1 + 2.4 * (1 - p)));
      ring.material.color.set(p >= 1 - state.win() ? 0x7dffa0 : 0xffd9a0);  // green: now
    };
    c.tap = i => {
      const o = targets[i], r = state.tap(S ? state.cur : i, env.now() / 1000);
      if (r === "ignore") return env.sparkle(at(o));
      c.last = env.now();
      if (r === "miss") return env.wobble(o, 6), miss();
      env.say(""); env.sparkle(at(o)); glow(o, 0.8, true); env.foley(`game:${o.name.replace(/\d+$/, "")}`, "pick"); react(i);
      if (act) (stopAt = clip.duration * state.cur / steps, act.paused = false);
      glow(lamps[state.cur - 1], 1);
      if (state.complete) { ring.material.opacity = 0; c.win(); } else env.count(`${state.cur} of ${steps}`);
    };
    c.hint = () => { const o = targets[S ? 0 : state.cur]; if (o) env.wobble(o, 4); };
    c.auto = () => (state.complete ? null : { i: S ? 0 : state.cur, ready: state.phase(env.now() / 1000) >= 1 - 0.6 * state.win() });  // the ring well inside its green moment
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
      else env.say(G.hint ?? "");
      if (!slowed) { slowed = true; P *= 1.2; }
      env.sparkle(at(mark));
    };
    const missed = () => state.misses >= 2 && state.misses % 2 === 0 && hint();
    const beat = () => {  // a beat ends: a seed not flicked back falls in the river; a wave not held throws Kapi about; Kapi crouches again
      held = state.caught; c.last = env.now();
      if (!state.next()) return;
      if (leap) env.wobble(kapi?.body, 5);
      else if (rally) { env.play("splash", { gain: 0.5 }); gone = true; seed.visible = false; env.sparkle(at(mark)); }
      else { env.play("splash", { gain: 0.5 }); env.wobble(kapi?.body, 12); }
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
      if (r === "miss") return miss(), missed();
      env.say(""); env.sparkle(at(mark)); env.foley(`game:${G.type}`, "pick"); react(0);
      if (rally) { ret = { a: seed.position.clone(), u: 0 }; env.act({ do: "clip", who: bobo.name, clip: G.flick ?? "Turn", then: bobo.hold }); }
      env.count(state.complete || leap ? "" : `${state.done} of ${state.n}`);
      if (leap) env.act({ do: "clip", who: kapi.name, clip: "Jump", then: kapi.hold, ...G.leap }).then(finish);  // up into the branches
      else if (!rally && state.complete) finish();
    };
    c.start = () => { off = gestures(sp, env, c, { tap: hit }); };
    c.tap = () => {};  // a tap anywhere is the game's (gestures); one on a character neither pokes it nor counts twice
    c.stop = () => { off(); ring.removeFromParent(); seed.removeFromParent(); };
    c.auto = () => (state.complete || state.caught || ret ? null : { o: (rally ? bobo : kapi)?.body, ready: k >= 1 - 0.6 * state.win(), go: hit });  // the same hit a tap anywhere makes
    c.state = state; c.phase = () => k;  // how far into the beat (tests, the recorder)
  } else if (G.pairs && (G.type === "pair" || G.type === "match")) {  // a match game without "pairs" (the book.json one, "tap each friend") plays as collect
    const pairs = G.pairs.filter(p => p.every(n => targets.some(o => o.name === n)) || console.warn("game: a pair not on this page:", p)), state = new Pair(pairs), name = i => targets[i].name, moves = [], walks = [];
    const thing = nm => targets.find(o => o.name === nm);
    c.open = i => !state.pairs.some((p, k) => state.done.has(k) && p[0] === name(i));  // a joined thing catches no tap
    c.tap = i => {
      const o = targets[i], prev = state.sel, r = state.tap(o.name);
      env.sparkle(at(o)); c.last = env.now();
      if (r === "pick") { if (prev != null) glow(thing(state.pairs[prev][0]), 0); glow(o, 0.9); return; }
      if (r === "ignore") return;
      const t = thing(state.pairs[prev][0]); glow(t, 0);
      if (r === "miss") return env.wobble(t, 6), env.wobble(o, 4), miss();
      env.foley(`game:${G.type}`, "pick"); const said = react(i); glow(t, G.type === "match" ? 0 : 0.6); glow(o, G.type === "match" ? 0 : 0.6);  // joined: it goes to its spot and stays lit (a home that is a whole mound or rock pile is not lit)
      if (G.type === "match" && sp.byName[t.name]) walks.push(home(t, o));  // a character walks (flies, hops) home
      else { const p = t.parent; if (p) moves.push({ t, from: t.position.clone(), to: p.worldToLocal(at(o).add(new THREE.Vector3(0, 0.03, 0))), t0: env.now() }); }
      if (r === "won") { if (walks.length) env.count(`${state.pairs.length} of ${state.pairs.length}`); Promise.all([...walks, said]).then(() => (targets.forEach(o => glow(o, 0)), c.win())); } else env.count(`${state.done.size} of ${state.pairs.length}`);  // won: the joined pairs stop glowing for the rest of the page
    };
    const home = (t, o) => {  // each friend stands at the edge of its home, on the side it comes from; the friends of one home side by side
      const mates = state.pairs.filter(p => p[1] === o.name), k = mates.findIndex(p => p[0] === t.name), z = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      const c = at(o), p = c.clone().add(at(t).sub(c).setY(0).normalize().multiplyScalar(G.stop ?? Math.min(0.12, Math.max(z.x, z.z) / 2 + 0.02))).add(new THREE.Vector3((k - (mates.length - 1) / 2) * (G.spread ?? 0.05), 0, 0));
      return env.act({ do: G.gait?.[t.name] ?? "walk", who: t.name, to: [p.x, -p.z, p.y], stop: 0, ...(G.secs && { secs: G.secs }), ...(G.clip?.[t.name] && { clip: G.clip[t.name] }), ...(G.rate?.[t.name] && { rate: G.rate[t.name] }) }).then(() => env.sparkle(at(o)));
    };
    c.tick = now => { for (const m of moves) { const k = Math.min(1, (now - m.t0) / 600); m.t.position.lerpVectors(m.from, m.to, k * k * (3 - 2 * k)); } };
    c.auto = () => { if (state.complete) return null; const k = state.sel ?? state.pairs.findIndex((_, i) => !state.done.has(i)); return { i: targets.findIndex(o => o.name === state.pairs[k][state.sel == null ? 0 : 1]) }; };  // the thing, then its spot
    c.hint = () => { const k = state.sel ?? state.pairs.findIndex((_, i) => !state.done.has(i)), p = state.pairs[k]; if (p) { env.sparkle(at(thing(state.sel == null ? p[0] : p[1]))); env.wobble(thing(state.sel == null ? p[0] : p[1]), 4); } };
    c.state = state;
  } else if (G.type === "steer") {
    // steer (s07), tap-to-go: Bobo, Kapi on his back, swims up to each hazard (the targets, in order). A glowing gold place on the
    // water beside it shows where to go: a tap near it (a fingertip's radius) takes him there and on past. From the last hazard
    // there are two places, one calm and one where the fish splash; the splashing one only splashes him back to try again.
    const bobo = sp.byName[G.who ?? "bobo"], kapi = sp.byName[G.rider ?? "kapi"];
    const state = new Steer(G.free ?? targets.map(() => (Math.random() < 0.5 ? -1 : 1)));
    const B = v => [v.x, -v.z, v.y];  // three.js -> the acts' Blender coordinates
    const right = () => new THREE.Vector3(1, 0, 0).applyQuaternion(camOf(env)?.quaternion ?? new THREE.Quaternion()).setY(0).normalize();
    const swim = to => env.act({ do: "swim", who: bobo.name, to: B(to), stop: 0 });
    const lights = [0, 1].map(() => {  // a flat gold ring with a soft glow inside, lying on the water; in the scene from the start (unseen)
      const g = new THREE.Group(), mat = o => new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: o, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40), mat(0.95)), new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), mat(0.35)));
      g.rotation.x = -Math.PI / 2; g.visible = false; g.children.forEach(m => (m.renderOrder = 10)); (sp.group ?? sp.stage).add(g); return g;
    });
    const LIFT = 0.05; let busy = true, off = () => {}, cur = null, splashed = 0, queued = null, shown = [];
    const show = list => { shown = list; lights.forEach((l, k) => { l.visible = !!list[k]; if (list[k]) l.position.copy(list[k].p); }); };
    const approach = async () => {  // up to the next hazard, facing it; its place already glows, and a tap on it meanwhile is kept
      busy = true; queued = null;
      const o = targets[state.i], h = at(o).setY(bobo.pos.y), fwd = h.clone().sub(bobo.pos).setY(0).normalize(), r = right(), f = state.free[state.i];
      cur = { h, fwd, near: h.clone().addScaledVector(fwd, -0.15), side: s => h.clone().addScaledVector(r, s * 0.11) };
      const lit = k => ({ side: k, p: cur.side(k).setY(h.y + LIFT) });  // a little above the waterline, so the foreground grass does not hide it
      show([lit(f), ...(state.i >= 2 ? [lit(-f)] : [])]);  // the last hazard: a second place, where the fish splash
      glow(o, 0.6, true); env.wobble(o, 5);
      await swim(cur.near); await env.act({ do: "face", who: bobo.name, face: B(h) });
      busy = false; c.last = env.now(); splashed = 0;
      if (queued != null) choose(queued);
    };
    const hint = () => cur && [0, 500].forEach(ms => setTimeout(() => env.sparkle(cur.side(state.free[state.i])), ms));
    const choose = async side => {
      if (state.complete || !side) return;
      if (busy) return void (cur && (queued = side));
      busy = true; c.last = env.now();
      const r = state.pick(side);
      if (r === "pass" || r === "won") {
        env.say(""); env.foley("game:steer", "pick"); glow(targets[state.i - 1], 0); env.sparkle(cur.side(side)); show([]);
        await swim(cur.side(side)); await swim(cur.side(side).addScaledVector(cur.fwd, 0.12));
        env.count(r === "won" ? "" : `${state.i} of ${n}`);
        if (r === "pass") return approach();
        off(); if (kapi) env.act({ do: "clip", who: kapi.name, clip: "Cheer", then: kapi.hold });
        return c.win();
      }
      await swim(cur.near.clone().lerp(cur.side(side), 0.6));  // toward the splashing place: a splash in his face, and back
      env.sparkle(cur.side(side)); env.play("splash", { gain: 0.6 }); env.wobble(bobo.body, 8);
      env.say(r !== "help" || G.voice?.hint ? "" : G.hint ?? "");
      if (r !== "help") again(); else { if (G.voice?.hint) env.voice(G.voice.hint); hint(); }
      await swim(cur.near); await env.act({ do: "face", who: bobo.name, face: B(cur.h) });
      busy = false;
    };
    c.tick = now => {
      const k = 1 + 0.12 * Math.sin(now / 260);  // the places breathe
      lights.forEach((l, i) => l.visible && l.scale.setScalar((shown[i]?.side === state.free[state.i] ? 0.095 : 0.075) * k));
      if (busy || !cur || state.complete || shown.length < 2 || now - splashed < 1600) return;
      splashed = now; env.sparkle(shown[1].p); env.play("splash", { gain: 0.25 });  // the fish splash on the blocked place
    };
    // a tap: the place nearest it, if within a fingertip (64 px, or 0.6 of the gap between two); on empty water, nothing
    const touch = (x, y) => {
      const px = shown.map(s => onScreen(env, s.p)), gap = px.length > 1 ? Math.hypot(px[0][0] - px[1][0], px[0][1] - px[1][1]) : 1e9, R = Math.min(64, 0.6 * gap);
      const d = px.map(([a, b]) => Math.hypot(a - x, b - y)), k = d.indexOf(Math.min(...d));
      if (d[k] <= R) choose(shown[k].side);
    };
    c.start = () => { off = gestures(sp, env, c, { tap: touch }); return approach(); };
    c.hint = hint; c.tap = () => {};  // taps are the game's (gestures)
    c.places = () => shown.map(s => ({ side: s.side, calm: s.side === state.free[state.i], p: s.p }));  // (tests, the recorder)
    c.stop = () => { off(); lights.forEach(l => l.removeFromParent()); targets.forEach(o => glow(o, 0)); };
    c.auto = () => (busy || !cur || state.complete ? null : { o: targets[state.i], go: () => choose(state.free[state.i]) });  // the calm place, as a tap on it chooses
    c.state = state; c.ready = () => !busy && !!cur;  // waiting at a hazard for a tap (tests, the recorder)
  } else if (G.type === "listen") {  // the old player's game: tap the speaker and the line is said again, the words Bobo missed lit; one listen wins
    const state = new Collect(1), who = G.who ?? "lulu", line = G.voice?.listen ?? G.line;  // "voice": {"listen": id} names the line when `line` is not set
    let busy = false;
    c.tap = async () => {
      if (!c.begun) return env.poke(who);  // before the game: a tap is the speaker's usual hello
      if (state.complete) return env.poke(who);  // won: a tap on her is her usual hello again
      if (busy) return;
      busy = true; c.last = env.now(); env.bubble(null);  // the read-along says it now, the same words lit
      await env.listen(line, G.say ?? "");
      busy = false;
      if (state.tap(0)) { env.bubble(null); c.win(); }
    };
    c.start = c.again = () => env.bubble(who, line, G.say ?? "");  // her words over her: tap them (or her) to hear them again
    c.hint = () => env.wobble(targets[0], 4);
    c.auto = () => (busy || state.complete ? null : { i: 0, press: "lbub" });  // her words' bubble is the button
    c.state = state;
  } else {  // collect; "tap": "hover" for lanterns that wake up and rise, "light" for things lit where they stand (fireflies, candles)
    const state = new Collect(n), hover = G.tap === "hover", light = G.tap === "light";
    c.dealt = {};  // "deal": how many each named one was dealt
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
    // a friend (a cast character named as a target, not a light or a lantern) stays where it stands once counted: it shakes and
    // glows; counting aloud, its number word pops over it and then it says its own react line ("voice": {"react"}, else the
    // book's "<game>.react.<name>"); "clip": [name, secs] plays on it as it is counted; tapped again: the soft "again" and a wobble
    const body = i => sp.byName[targets[i].name]?.body === targets[i], friend = i => body(i) && !light && !hover;
    const own = (o, i) => { const id = G.voice?.react ? [].concat(G.voice.react)[i] ?? [].concat(G.voice.react)[0] : `${(G.voice?.start ?? "game").replace(/\.start$/, "")}.react.${o.name}`; return env.line?.(id) ? id : null; };
    let num = null;  // {o, el, until}: the number word over the friend just counted
    const pop = (o, t) => {
      const d = globalThis.document; if (!d || !t) return;
      if (!d.getElementById("gnum-css")) d.head.insertAdjacentHTML("beforeend", `<style id="gnum-css">
        #gnum { position: fixed; z-index: 30; pointer-events: none; translate: -50% -100%; font: 800 clamp(26px, 5vw, 44px)/1 "Noto Sans Lao", system-ui, sans-serif; color: #ffe08a;
          text-shadow: 0 2px 0 #6b3a10, 0 0 14px #ffb34799; animation: gnum .35s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes gnum { from { scale: .4; opacity: 0; } } @media (prefers-reduced-motion: reduce) { #gnum { animation: none; } }</style>`);
      num?.el.remove();
      const el = d.body.appendChild(Object.assign(d.createElement("div"), { id: "gnum", textContent: t.replace(/[.!]+$/, "") }));
      num = { o, el, until: env.now() + 1500 };
    };
    c.repeat = i => { if (!friend(i) || !state.done.has(i)) return; c.last = env.now(); env.foley("game:again", "tap"); env.wobble(targets[i], 6); };
    c.tap = i => {
      const o = targets[i];
      env.sparkle(at(o));
      if (!state.tap(i)) return;
      c.last = env.now();
      env.foley(`game:${o.name.replace(/\d+$/, "")}`, "pick");
      const v = G.count ? `${G.count}.${state.done.size}` : G.react?.[i] ?? G.react?.["*"];  // counting aloud: the n-th pick says the n-th number
      const mine = G.count && friend(i) && own(o, i), said = v ? env.voice(v) : react(i);
      const then = mine ? Promise.resolve(said).then(ok => ok !== false && env.voice(mine)) : null;  // its own line once the number is said (not if another tap cut the number short)
      if (G.deal) { const to = G.deal[(state.done.size - 1) % G.deal.length]; c.dealt[to] = (c.dealt[to] ?? 0) + 1; env.act({ do: "fly", ...(sp.byName[o.name] ? { who: o.name } : { what: o.name }), to, secs: 0.8, up: 0.05 }); }  // "deal": ["pagong", "matsing"]: each pick goes to the next one named, in turn, and is counted for them
      else if (hover) { env.act({ do: "rise", what: o.name, by: 0.06, secs: 0.8 }); glow(o, 0.8); }  // woken: up 0.06 to stay, as an act, so a story rise adds to it
      else if (dark[i].length) dark[i].forEach(m => {  // a paper lantern lit: its paper's colour, a warm light inside, no white disc
        m.material.color.copy(paper.color).multiplyScalar(0.9); m.material.emissive.set(0xff8c2a); m.material.emissiveIntensity = 0.85 * LIT; });
      else if (light) { glow(o, 0.9); glow(obj(`${o.name}-flame`), 1); }
      else if (sp.byName[o.name]?.body === o) { env.wobble(o, 6); glow(o, 0.6, true); }  // a character named as a target (an animal, a friend) stays: it shakes and glows, never vanishes
      else env.vanish(o);
      if (friend(i) && G.clip) {  // "clip": "Droop" or ["Droop", 1.8]: held that long, then back to what it was doing
        const [clip, secs] = [].concat(G.clip), was = sp.byName[o.name].hold;
        env.act({ do: "clip", who: o.name, clip, then: clip });
        if (secs && was) setTimeout(() => env.act({ do: "clip", who: o.name, clip: was, then: was }), secs * 1000);
      }
      if (G.count && friend(i)) pop(o, env.line?.(v));
      if (G.toss) env.toss(...G.toss);  // book.json "toss": ["kapi", "bobo"]: each one picked is thrown into Bobo's mouth
      if (G.thoughts) think(sp.byName[G.who ?? "bobo"], G.thoughts[(state.done.size - 1) % G.thoughts.length]);
      if (G.count) env.count(`${state.done.size}`);  // the numeral
      if (state.complete) then ? then.then(() => setTimeout(c.win, env.gap ?? 400)) : G.count ? Promise.all([said, new Promise(r => setTimeout(r, env.gap ?? 1300))]).then(c.win) : Promise.resolve(said).then(c.win); else if (!G.count) env.count(`${state.done.size} of ${n}`);  // the last number (and its own line) is heard and seen before the win (the number's whole voice too: its sentence hold then reaches the praise)
    };
    c.hint = () => { const i = targets.findIndex((_, i) => !state.done.has(i)); if (i >= 0) { env.sparkle(at(targets[i])); env.wobble(targets[i], 4); } };
    c.auto = () => (state.complete ? null : { i: targets.findIndex((_, i) => !state.done.has(i)) });
    // while the game waits on them, each unlit one wears a soft halo in the spread's light colour, at least 44 px across on the
    // screen however small it is drawn; the halo is its tap zone too, and a tap on any halo lights the unlit one nearest the
    // finger: never a lit one, never the character behind. It pulses unless the reader asked for less motion; lit, it fades.
    let wonAt = null, crowd = null;
    const off = () => {}, still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches, size = new Map(), warm = new THREE.Color(1, 0.45, 0.12);
    const halos = targets.map((o, i) => {
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(THREE), color: G.halo ?? (friend(i) ? 0xffb347 : lightOf(o)), transparent: true, opacity: 0,
        depthTest: false, depthWrite: false }));
      h.renderOrder = 9; h.raycast = off; (sp.group ?? sp.stage).add(h);
      c.extra.set(h, () => c.tap(nearest(env, targets.map((o, j) => !state.done.has(j) && at(o))) ?? i));
      return h;
    });
    c.tick = now => {
      const cam = camOf(env);
      if (!cam) return;
      if (num) {  // the number word rides over its friend's head, then goes
        if (now > num.until) num.el.remove(), (num = null);
        else { const b = new THREE.Box3().setFromObject(sp.byName[num.o.name].model), [x, y] = onScreen(env, b.getCenter(new THREE.Vector3()).setY(b.max.y)); Object.assign(num.el.style, { left: `${x}px`, top: `${y - 6}px` }); }
      }
      const unit = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / innerHeight;  // world size of a pixel, one unit away
      halos.forEach((h, i) => {
        const o = targets[i], p = at(o), d = -p.clone().applyMatrix4(cam.matrixWorldInverse).z, on = !state.done.has(i) && !c.complete;
        if (!size.has(o)) size.set(o, new THREE.Box3().setFromObject(o).getBoundingSphere(new THREE.Sphere()).radius * 2);
        // a game whose character targets crowd (two stand nearer than one's height: Gourd s04's ten faces 0.025 apart, s05's rows of people) shows no
        // disc on any of them: a disc, in front or behind, fogs the faces round it. Each pulses brighter in its own colours while it waits; its sprite
        // stays an unseen tap zone
        crowd ??= targets.some((a, k) => body(k) && targets.some((b, j) => j !== k && body(j) && at(a).distanceTo(at(b)) < sp.byName[a.name].height));
        const quiet = crowd && body(i) && !friend(i);
        if (quiet) on ? glow(o, still ? 0.7 : 0.55 + 0.4 * Math.sin(now / 230 + i), true) : state.done.has(i) || glow(o, 0);
        // lit (not picked away): the halo becomes a still, soft warm glow round the light, the size of its light, not of a fingertip
        const glowing = !quiet && !on && state.done.has(i) && (light || hover), want = quiet ? 0 : on ? (still ? 0.85 : 0.7 + 0.25 * Math.sin(now / 230 + i)) : glowing ? 0.5 : 0;
        if (glowing && G.lit_glow === 0 && c.complete) h.material.opacity = 0.5 * Math.max(0, 1 - (now - (wonAt ??= now)) / 1000);  // book.json "lit_glow": 0: a lit thing that is no light (a mud spot) lets its glow go over 1 s once the game is won
        else h.material.opacity += (want - h.material.opacity) * 0.12;  // in as the game begins; once lit, down to the glow (or out)
        if (glowing) h.material.color.lerp(warm, 0.1);
        if (friend(i)) {  // a friend's glow: its own size (1.5 times its height on screen), just behind it, so it never hides the friend
          const ch = sp.byName[o.name], r = new THREE.Box3().setFromObject(ch.model).getSize(new THREE.Vector3()), top = p.clone().setY(p.y + ch.height);
          const tall = Math.abs(top.project(cam).y - p.clone().project(cam).y) / 2 * innerHeight;  // its height on the screen, px
          h.material.depthTest = true; h.position.copy(p).setY(p.y + ch.height / 2).addScaledVector(p.clone().sub(cam.position).normalize(), Math.max(r.x, r.z) / 2);
          h.scale.setScalar(1.5 * tall * unit * -h.position.clone().applyMatrix4(cam.matrixWorldInverse).z);
        } else h.position.copy(p), h.scale.setScalar((glowing ? 1.8 * size.get(o) : Math.max(HALO * unit * d, 1.4 * size.get(o))));
        h.raycast = on ? THREE.Sprite.prototype.raycast : off;
      });
    };
    c.state = state; c.stop = () => num?.el.remove();
  }
  // a game that waits for its line is not played before it: a tap there only sparkles (a child taps all through the story)
  const play = c.tap, early = () => G.before && !c.begun;
  c.tap = i => (early() ? env.sparkle(at(targets[i])) : play(i));
  for (const [o, f] of c.extra) c.extra.set(o, () => (early() ? env.sparkle(at(o)) : f()));
  return c;
}
