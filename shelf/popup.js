// popup.js — the paper-theatre pop-up that stands out of a book's cover, the ONE code path for the shelf and for any other page that shows a book's cover (moved out of shelf.js).
// Layers cut to a silhouette, each on its own hinge at its own depth (the book's `diorama`, back to front), folding flat in the recess (the later a layer rises, the lower it lies, so nothing sweeps through another),
// with the character, 3D, on a little raised bank in front of the hero; a hook (Bobo peeks / Pip flies to the clasp), a wave every ~8 s, and the greeting (hello.json line, subtitle, voice).
//
//   createPopup(THREE, scene, cfg, { size, reduced, book, lights, say, onEvent }) -> pop
//     cfg      one entry of the page's book list: { id, who, dir, model, voice, greet, diorama, stage?, light?, pip? } (every URL is resolved by the page, as in the shelf)
//     size     [w, d] of the cover's recess in metres (bookmodel.js: panel.userData.size). Required.
//     reduced  prefers-reduced-motion: switched, not animated
//     book     the Object3D whose local space holds the book's clasp at (0.152, 0.145, 0); Pip flies there (default: scene)
//     lights   { lantern, front } the awake book's shared lights, moved into the pop-up when it wakes (default: it makes its own two)
//     say      (text, sub) shows a subtitle, (null) hides it       onEvent("wave" | "peek" | "pip" | "clasp" | "greet")
//   pop.group  add it to the cover's panel (b.panel.add(pop.group)); empty until pop.ready resolves
//   pop.wake()  pop.sleep(fast = false)  pop.update(dt, tiltX = 0) -> true while something moves   pop.dispose()   pop.P 0..1, pop.built, pop.ready (null until wake()/load())
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
import { touchLine } from "../reading.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const ease = t => (t = clamp(t, 0, 1)) < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;  // in-out cubic
const back = t => { t = clamp(t, 0, 1) - 1; return 1 + 2.2 * t * t * t + 1.2 * t * t; };  // out, with a little overshoot, then settles
export const dotTexture = THREE => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "#fff"); g.addColorStop(1, "#fff0"); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); };
const free = root => root.traverse(o => { o.geometry?.dispose(); o.skeleton?.dispose(); o.isLight && o.dispose?.(); for (const m of [o.material].flat()) if (m) { for (const v of Object.values(m)) v?.isTexture && v.dispose(); m.dispose(); } });

// shortcut: a layer taller than the recess is deep (the sky) lifts as it stands instead of folding double; a hero too tall folds in two halves (top: "treeb").
const UP = 2.1, DOWN = 1.35, DUR = 0.9, STEP = 0.1, PAR = 0.02, PEEKY = 0.015;  // seconds to unfold, to fold; one layer's own fold; the stagger between layers; extra sideways parallax from the tilt (m); Bobo's height when he peeks

export function createPopup(THREE, scene, cfg, o = {}) {
  const reduced = !!o.reduced, rad = THREE.MathUtils.degToRad, emit = n => o.onEvent?.(n), [w, d] = o.size;
  const c = cfg, st = { kx: -0.012, kz: 0.03, mound: "bank", size: 0.099, ...c.stage }, lt = { lantern: [-0.03, 0.045, -0.025, "#ffc16b", 0.008], front: ["#ffe2b8", 0.34], motes: ["#ffcf7a", 0.032, 0.05, 0.12, -0.07], ...c.light };
  const dot = dotTexture(THREE), bpos = new THREE.Vector3(), host = o.book ?? scene, tl = new THREE.TextureLoader(), own = !o.lights;
  const lantern = o.lights?.lantern ?? new THREE.PointLight(0xffc16b, 0, 0.32, 2), front = o.lights?.front ?? new THREE.SpotLight(0xffe2b8, 0, 0.9, 0.22, 0.8, 2);
  if (own) { front.castShadow = true; front.shadow.mapSize.set(1024, 1024); front.shadow.bias = -0.0003; front.shadow.normalBias = 0.0015; front.shadow.camera.near = 0.2; front.shadow.camera.far = 0.8; }
  const pop = { group: new THREE.Group(), P: 0, target: 0, up: 0, cards: [], kapi: null, mixer: null, acts: {}, peek: { a: reduced ? 1 : 0, t0: 0, next: 0 }, bobo: null, motes: null, mound: null, halo: null, pip: null, nextWave: 0, ready: null, built: false, fast: false, get moving() { return this.built && Math.abs(this.target - this.P) > 1e-4; } };
  let awake = false, dead = false, greetPending = false, greeted = false, lastLine = "", words = null, speak = null; const texs = {};
  const tex = u => tl.loadAsync(u).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });  // layer uvs: three's own flipY

  const layerMat = (map, own, s) => {  // ONE mesh per layer, both sides: the picture on the front (a little self-light, a warm rim at the cut edge, lanterns that glow) and no blank back: its own print in kraft tones, or a designed endpaper
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.85, alphaTest: 0.45, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: s.glow ?? 0.12 });
    Array.isArray(s.tint) ? m.color.setRGB(...s.tint) : m.color.setScalar(s.tint ?? 1); m.shadowSide = THREE.DoubleSide; const em = s.emit || 0;
    m.onBeforeCompile = sh => {
      sh.uniforms.backMap = { value: own || map }; sh.uniforms.emitK = { value: em };
      sh.fragmentShader = "uniform sampler2D backMap; uniform float emitK;\n" + sh.fragmentShader.replace("#include <map_fragment>", `vec4 sd = texture2D( map, vMapUv ); vec4 bd = texture2D( backMap, vMapUv );
        if ( gl_FrontFacing ) diffuseColor *= sd; else { diffuseColor.a *= ${own ? "bd.a" : "sd.a"}; diffuseColor.rgb = ${own ? "bd.rgb" : "vec3( 0.60, 0.42, 0.25 ) * ( 0.35 + 1.3 * dot( sd.rgb, vec3( 0.30, 0.59, 0.11 ) ) )"}; }`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        if ( gl_FrontFacing ) { totalEmissiveRadiance += vec3( 1.0, 0.6, 0.26 ) * 0.6 * smoothstep( 0.95, 0.5, texture2D( map, vMapUv, 2.2 ).a ) * diffuseColor.a;
          totalEmissiveRadiance += diffuseColor.rgb * emitK * smoothstep( 0.45, 0.8, dot( diffuseColor.rgb, vec3( 0.30, 0.59, 0.11 ) ) ); }
        else totalEmissiveRadiance = ${own ? "bd.rgb * 0.25" : "vec3( 0.0 )"};`);
    }; m.customProgramCacheKey = () => (own ? "o" : "k") + (em ? "e" : "n"); return m;
  };
  const layer = (s, map, ranks, bk) => {  // a cut layer: hinged on its foot, y just above the one below it so they stack flat inside the recess
    const lw = s.w, h = lw * map.image.height / map.image.width, g = new THREE.PlaneGeometry(lw, h); g.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(g, layerMat(map, bk, s)); mesh.castShadow = mesh.receiveShadow = true;
    const inner = new THREE.Group(); inner.add(mesh); const hinge = new THREE.Group(); hinge.add(inner); hinge.position.set(s.x, 0.0003 + (ranks - s.rank) * 0.00026, s.z);
    const k = { hinge, inner, s, h, w: lw, y0: hinge.position.y, closed: rad(90 * s.d), open: rad(s.open ?? 0), delay: s.rank * STEP }; pop.cards.push(k); if (s.peek) pop.bobo = k; return k;
  };
  const haloTex = ([r, gr, bl]) => { const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d"), g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, `rgba(${r},${gr},${bl},.95)`); g.addColorStop(0.4, `rgba(${r},${Math.round(gr * .75)},${Math.round(bl * .6)},.4)`); g.addColorStop(1, `rgba(${r},${Math.round(gr * .65)},${Math.round(bl * .5)},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); };
  const halo = (rgb, size) => new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: haloTex(rgb), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const grassCanvas = () => { const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128; const x = cv.getContext("2d"); x.fillStyle = "#6d9a52"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 380; i++) { x.strokeStyle = `rgba(${40 + Math.random() * 50},${100 + Math.random() * 60},46,${0.3 + Math.random() * 0.3})`; const px = Math.random() * 128, py = Math.random() * 128; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.random() * 4 - 2, py - 4 - Math.random() * 6); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const plankCanvas = () => { const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128; const x = cv.getContext("2d"); for (let i = 0; i < 6; i++) { x.fillStyle = `hsl(28,${40 + i % 2 * 6}%,${30 + (i * 7) % 11}%)`; x.fillRect(0, i * 21.4, 128, 21.4); x.fillStyle = "#2a160a"; x.fillRect(0, i * 21.4, 128, 1.5); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const bankMesh = () => {  // a low cut-paper grass bank: an irregular scissor-cut outline, a grass top, a pale paper rim
    const sh = new THREE.Shape(), n = 34, rr = (() => { let q = 7; return () => (q = (q * 16807) % 2147483647) / 2147483647; })();
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 1 + 0.09 * Math.sin(3 * a + 0.7) + 0.06 * Math.sin(5 * a + 2.1) + (rr() - 0.5) * 0.12, x = Math.cos(a) * 0.04 * r, y = Math.sin(a) * 0.031 * r; i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.006, 0);
    const t = grassCanvas(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 20);
    return new THREE.Mesh(g, [new THREE.MeshStandardMaterial(st.moundColor ? { color: st.moundColor, roughness: 0.95 } : { map: t, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: 0xe9dcbc, roughness: 0.95 })]);
  };

  async function build() {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), spec = c.diorama, ranks = Math.max(...spec.map(s => s.rank)) + 1, D = c.dir;
    const need = [...new Set([...spec.flatMap(s => [s.f, s.back, s.top]).filter(Boolean), "base"])];
    const [kapi] = await Promise.all([loader.loadAsync(c.model), ...need.map(n => tex(`${D}layers/${n}.webp`).then(t => (texs[n] = t)))]);
    if (dead) { Object.values(texs).forEach(t => t.dispose()); free(kapi.scene); return; }
    const g = pop.group;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.995, d * 0.995), new THREE.MeshStandardMaterial({ map: texs.base, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.position.y = 0.0002; ground.receiveShadow = true; g.add(ground);  // the printed floor
    const sprite = (hs, card) => hs?.forEach(([u, v, sz, rgb]) => { const hh = halo(rgb || [255, 190, 110], sz); hh.position.set((u - 0.5) * card.w, (1 - v) * card.h, 0.002); hh.userData.flick = Math.random() * 6; card.inner.add(hh); (pop.lamps ??= []).push(hh); });
    for (const s of spec) {
      const cd = layer(s, texs[s.f], ranks, s.back && texs[s.back]); g.add(cd.hinge);
      if (s.top) { const t = layer({ ...s, f: s.top, x: 0, z: 0, rank: s.rank + 0.3 }, texs[s.top], ranks), th = t.hinge; th.position.set(0, cd.h - (s.overlap || 0), -0.0004); cd.inner.add(th); t.delay = cd.delay + 0.3; t.child = true; t.y0 = cd.h; sprite(s.topHalos, t); }  // the halves overlap a hair (s.overlap) so no fold line shows
      sprite(s.halos, cd);
      if (s.halo) { const hs = s.halo === 1 ? { x: 0.032, y: 0.028, size: 0.12, rgb: [255, 226, 150] } : s.halo; pop.halo = halo(hs.rgb, hs.size); pop.haloK = hs.k ?? 0.3; pop.halo.position.set(hs.x, hs.y, 0.002); cd.inner.add(pop.halo); }  // the sun's (or the moon's) glow
    }
    const pos = []; for (const k of pop.cards) { if (k.child) continue; const tw = Math.min(0.011, k.s.w * 0.2), y = k.y0 - 0.00012, z0 = k.s.z + 0.001, z1 = k.s.z + 0.0042; if (k.s.lift > 0.01) continue; pos.push(k.s.x - tw / 2, y, z1, k.s.x + tw / 2, y, z1, k.s.x + tw / 2, y, z0, k.s.x - tw / 2, y, z0); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); tg.setIndex([...Array(pos.length / 12).keys()].flatMap(q => [q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3])); tg.computeVertexNormals();
    const tabs = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0x9a8864, roughness: 0.95, side: THREE.DoubleSide })); tabs.receiveShadow = true; g.add(tabs);  // little paper support tabs at the feet
    // the raised bank the character stands on, rising with the rest: a squat grassy drum, or a little wooden deck
    const mound = pop.mound = st.mound === "deck" ? new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.05), new THREE.MeshStandardMaterial({ map: plankCanvas(), roughness: 0.85 })) : bankMesh();
    mound.position.set(st.kx, 0.006, st.kz); mound.castShadow = mound.receiveShadow = true; g.add(mound);
    // light inside the diorama: the lantern and a soft front light that throws each layer's shadow on the next (the shared set, moved here when the book wakes), motes in the light
    pop.light = lt;
    const [mcol, mx, my, msp, mz] = lt.motes, mp2 = new Float32Array(40 * 3).map((_, i) => i % 3 === 0 ? mx + (Math.random() - .5) * msp : i % 3 === 1 ? my + Math.random() * 0.12 : mz + Math.random() * 0.06), mg2 = new THREE.BufferGeometry(); mg2.setAttribute("position", new THREE.BufferAttribute(mp2, 3));
    pop.motes = new THREE.Points(mg2, new THREE.PointsMaterial({ map: dot, color: mcol, size: 0.011, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); pop.motes.visible = false; pop.mp = mp2; pop.my = my; g.add(pop.motes);
    const k = kapi.scene, bb = new THREE.Box3().setFromObject(k), sc = st.size / (bb.max.y - bb.min.y); k.scale.setScalar(sc); k.position.y = -bb.min.y * sc;
    k.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; if (st.plates && /-plate$/.test(m.name) && m.name !== "natural-plate") m.visible = false; } });  // only one of her faces
    const kg = pop.kapi = new THREE.Group(); kg.add(k); kg.position.set(st.kx, 0.012, st.kz); kg.rotation.x = -0.5; g.add(kg);  // leaned back toward the camera so the character faces the viewer, head up
    pop.mixer = new THREE.AnimationMixer(k); const by = n => kapi.animations.find(a => a.name === n);
    pop.acts = { idle: pop.mixer.clipAction(by("Idle")), wave: pop.mixer.clipAction(by("Wave")) };
    pop.acts.wave.setLoop(THREE.LoopOnce, 1); pop.acts.wave.clampWhenFinished = true; pop.acts.idle.play();
    pop.mixer.addEventListener("finished", () => { pop.acts.idle.reset().play(); pop.acts.idle.crossFadeFrom(pop.acts.wave, 0.35, false); });
    if (c.pip) {  // Pip: a small pulsing light that circles her and, every ~8 s, flies to the clasp (the hook that leads the eye toward the book's opening)
      pop.pip = { s: new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xe6ff8a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), tr: null, ph: 0, t0: 0, next: 0, hist: [] };
      pop.pip.s.scale.setScalar(0.03); const tg2 = new THREE.BufferGeometry(); tg2.setAttribute("position", new THREE.BufferAttribute(new Float32Array(20 * 3), 3)); tg2.setAttribute("color", new THREE.BufferAttribute(new Float32Array(20 * 3), 3));
      pop.pip.tr = new THREE.Points(tg2, new THREE.PointsMaterial({ map: dot, size: 0.008, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pop.pip.tr.frustumCulled = false; host.add(pop.pip.s, pop.pip.tr);
    }
    pop.built = true; if (reduced) { pop.P = pop.target = awake ? 1 : 0; pop.up = 0; } pose(pop.P);
  }
  const lit = () => { const L = pop.light; pop.group.add(lantern, front, front.target); lantern.position.set(...L.lantern.slice(0, 3)); lantern.color.set(L.lantern[3]); front.color.set(L.front[0]); front.position.set(0.04, 0.34, 0.3); front.target.position.set(0, 0.06, -0.02); };  // the awake book's own lights, moved onto it
  const load = () => pop.ready ??= build();
  let tx = 0;
  function pose(P) {  // P 0 = flat in the recess, 1 = standing. Layers rise back to front, STEP apart, each with a small overshoot that settles (only on the way up)
    const sec = P * UP;
    for (const k of pop.cards) {
      const t = clamp((sec - k.delay) / DUR, 0, 1), f = ease(t) + 0.07 * pop.up * Math.sin(Math.PI * clamp((t - 0.45) / 0.55, 0, 1));
      if (k.child) { k.hinge.rotation.x = rad(180) * (1 - ease(t)); k.t = t; continue; }  // the hero's upper half unfolds off its lower half
      k.hinge.rotation.x = k.closed + (k.open - k.closed) * f; k.t = t; if (k.s.lean) k.hinge.rotation.z = rad(k.s.lean) * ease(t);
      k.hinge.position.y = k.y0 + (k.s.lift ?? 0) * ease(t);  // a layer too tall to lie flat in the recess is lifted as it stands
      k.hinge.position.x = k.s.x + tx * PAR * clamp(-k.s.z / 0.075, -1, 1) * P;  // the tilt shifts far layers one way and near ones the other: parallax
    }
    const mt = ease(clamp((sec - 0.85) / 0.7, 0, 1)); pop.mound.scale.y = Math.max(0.02, mt); pop.mound.position.y = 0.006 * pop.mound.scale.y;
    const kt = clamp((sec - 1.25) / 0.9, 0, 1); pop.kapi.scale.setScalar(Math.max(1e-3, back(kt))); pop.kapi.visible = kt > 0; pop.group.visible = P > 0.001;
    if (pop.halo) pop.halo.material.opacity = clamp((sec - 0.3) / 1.2, 0, 1) * (pop.haloK ?? 0.3);
    for (const l of pop.lamps || []) l.material.opacity = clamp((sec - 1.0) / 1.0, 0, 1) * (0.55 + 0.12 * Math.sin(performance.now() / 700 + l.userData.flick));  // lanterns and candle flames glow once the scene stands
  }
  function wave() { const a = pop.acts; if (reduced || !a.wave) return; a.wave.reset().play(); a.wave.crossFadeFrom(a.idle, 0.25, false); emit("wave"); }
  function living(sec, dt, k) {  // while awake and standing: stalk things sway, the hook plays (Bobo peeks and sinks / Pip flies to the clasp), the character waves every ~8 s, lanterns flicker, motes drift
    const pk = pop.peek, now = performance.now();
    for (const [i, k2] of pop.cards.entries()) if (k2.s.sway && !reduced) k2.hinge.rotation.z = rad(k2.s.sway[0]) * Math.sin(sec * k2.s.sway[1] + i) * k;
    if (!reduced) {
      if (k > 0.95) { if (!pk.next) { pk.next = now + 1500; pop.nextWave = now + 7000; } if (pop.bobo && now > pk.next) { pk.t0 = now; pk.next = now + 6000 + Math.random() * 3000; emit("peek"); } if (now > pop.nextWave) { wave(); pop.nextWave = now + 8000 + Math.random() * 1500; } } else pk.next = 0;
      const t = (now - pk.t0) / 1000; pk.a = k < 0.5 || !pk.t0 ? 0 : t < 0.9 ? ease(t / 0.9) : t < 3.5 ? 1 : t < 4.5 ? 1 - ease(t - 3.5) : 0;
    }
    if (pop.bobo) { const k2 = pop.bobo, a = pk.a; k2.inner.position.y = -k2.h + (PEEKY + k2.h) * a + 0.0012 * Math.sin(sec * 2.1) * a; k2.hinge.rotation.z = rad(-2.2) * Math.sin(sec * 1.6) * a * 0.6; }
    if (pop.pip) pipStep(sec, k, now);
    if (awake) { lantern.intensity = lt.lantern[4] * k * (1 + 0.05 * Math.sin(sec * 1.7)); front.intensity = lt.front[1] * k; }
    if (!reduced) { pop.motes.visible = k > 0.02; pop.motes.material.opacity = 0.85 * k; const m = pop.mp, y0 = pop.my; for (let i = 0; i < 40; i++) { m[i * 3 + 1] += dt * 0.012; m[i * 3] += Math.sin(i * 1.7 + sec * 0.9) * dt * 0.004; if (m[i * 3 + 1] > y0 + 0.12) m[i * 3 + 1] = y0; } pop.motes.geometry.attributes.position.needsUpdate = true; }
  }
  function pipStep(sec, k, now) {
    const p = pop.pip, head = bpos.set(st.kx, 0.088, st.kz - 0.04); pop.group.localToWorld(head); host.worldToLocal(head);
    const CL = new THREE.Vector3(0.152, 0.145, 0), a = sec * 1.9, home = new THREE.Vector3(head.x + Math.cos(a) * 0.034, head.y + 0.018 + 0.012 * Math.sin(a * 1.7), head.z + Math.sin(a) * 0.022);
    if (k > 0.95) { if (!p.next) p.next = now + 2000; if (!p.ph && now > p.next) { p.ph = 1; p.t0 = now; p.next = now + 8000 + Math.random() * 1500; emit("pip"); } } else { p.next = 0; p.ph = 0; }
    let pos = home, boost = 1;
    if (p.ph) {  // 1: out to the clasp (2.2 s), 2: hover there (0.9 s; the clasp rattles and glints on arrival), 3: back (1.8 s)
      const t = (now - p.t0) / 1000; let e;
      if (t < 2.2) { e = ease(t / 2.2); pos = home.clone().lerp(CL, e); pos.y += Math.sin(Math.PI * e) * 0.05; }
      else if (t < 3.1) { pos = CL.clone(); pos.y += 0.004 * Math.sin(t * 9); boost = 1.8; if (!p.arr) { p.arr = 1; emit("clasp"); } }
      else if (t < 4.9) { e = ease((t - 3.1) / 1.8); pos = CL.clone().lerp(home, e); pos.y += Math.sin(Math.PI * e) * 0.04; p.arr = 0; } else { p.ph = 0; p.arr = 0; }
    }
    p.s.position.copy(pos); p.s.material.opacity = clamp((k - 0.4) / 0.4, 0, 1) * (0.7 + 0.3 * Math.sin(sec * 6) * boost); p.s.scale.setScalar(0.026 * (0.85 + 0.25 * Math.sin(sec * 6)) * boost);
    p.hist.unshift(pos.clone()); if (p.hist.length > 20) p.hist.pop(); const ps = p.tr.geometry.attributes.position, cs = p.tr.geometry.attributes.color;
    for (let i = 0; i < 20; i++) { const h = p.hist[i] || pos, f = (1 - i / 20) ** 2 * clamp((k - 0.4) / 0.4, 0, 1) * 0.9; ps.setXYZ(i, h.x, h.y, h.z); cs.setXYZ(i, 0.9 * f, 1.0 * f, 0.5 * f); } ps.needsUpdate = cs.needsUpdate = true;
  }

  // greeting: the character waves and says a line (with its subtitle and voice)
  async function greet() {
    if (!pop.kapi) return;
    words ??= await fetch(c.dir + "hello.json").then(r => r.json()).catch(() => null); if (!words || dead) return;
    let lang = ""; try { lang = localStorage.getItem(`${c.who}.lang`) || ""; } catch { /* default */ }
    const line = () => touchLine({ story: { touch: {} }, tr: {}, w: words, wt: null }, c.who, lang, ""), first = words.lines[c.greet]; let l = !greeted && first ? { id: `words/${c.greet}`, text: first.en, sub: (lang && first[lang]) || "" } : line();
    if (l && l.id === lastLine) l = line();  // never the same line twice running
    greeted = true; if (!l) return; lastLine = l.id; o.say?.(l.text, l.sub);
    speak ??= new Audio(); speak.src = `${c.voice}${l.id}.m4a`; speak.play().catch(() => { /* a browser may hold sound until the first tap: the subtitle still shows */ });
    wave(); emit("greet");
  }

  return Object.assign(pop, {
    load, greet, hush() { speak?.pause(); }, setP(p) { pop.target = pop.P = p; pose(p); pop.group.visible = true; },  // for tools/shelf_*.mjs
    wake() {
      if (dead) return; awake = true; load().then(() => { if (!awake || dead) return; lit(); if (reduced) { pop.P = pop.target = 1; pose(1); greet(); } });  // reduced motion: switched, not animated
      if (!reduced) { greetPending = true; pop.target = 1; pop.up = 1; }  // the greeting waits until the scene stands (update starts it)
    },
    sleep(fast = false) {  // fast: the book is being opened, the pop-up folds back into its picture in 0.3 s
      if (dead) return; awake = greetPending = false; speak?.pause(); o.say?.(null);
      if (reduced && !fast) { pop.P = pop.target = 0; if (pop.built) pose(0); return; }
      pop.target = 0; pop.up = 0; pop.fast = fast; pop.peek.next = 0; if (pop.pip) pop.pip.ph = 0;
    },
    update(dt, tiltX = 0) {  // up in ~2 s, down in ~1.4 s, eased inside each card; true while anything still moves
      if (!pop.built || dead) return false; tx = tiltX; let busy = false; const sec = performance.now() / 1000;
      if (pop.moving) { const dir = pop.target - pop.P; pop.P = clamp(pop.P + Math.sign(dir) * dt / (dir > 0 ? UP : pop.fast ? 0.3 : DOWN), 0, 1); if (Math.abs(pop.target - pop.P) < 2e-4) pop.P = pop.target; busy = true; }
      pose(pop.P); if (pop.P > 0 && (awake || reduced)) { pop.mixer.update(dt); busy ||= !reduced; } if (pop.P > 0) { living(sec, dt, pop.P); if (!reduced && pop.P > 0.5) busy = true; }
      if (greetPending && pop.P > 0.999 && awake) { greetPending = false; greet(); } return busy;
    },
    dispose() {
      if (dead) return; dead = true; awake = false; if (speak) { speak.pause(); speak.removeAttribute("src"); speak.load(); speak = null; }
      pop.group.remove(lantern, front, front.target); if (!own) scene.add(lantern, front, front.target); pop.group.removeFromParent();  // the shared lights go back to the scene
      pop.mixer?.stopAllAction(); pop.mixer?.uncacheRoot(pop.kapi.children[0]);
      for (const p of [pop.pip?.s, pop.pip?.tr]) if (p) { p.removeFromParent(); free(p); }
      free(pop.group); Object.values(texs).forEach(t => t.dispose()); dot.dispose(); if (own) { lantern.dispose?.(); front.dispose?.(); }
    },
  });
}
