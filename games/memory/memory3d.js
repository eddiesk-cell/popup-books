// memory3d.js: Memory as a wall of carved stone tablets in an old stone hall (owner 2026-11-18: "stone tablets that turns when you choose and has the stone sliding sound").
// Every tablet is one instance of one box (one draw for the whole wall, up to 10 x 10). Its face side carries the faded gold emblem, its back one of the fifty carvings
// (carvings.js atlas, chosen per instance in the shader); a matched pair glows in its carved lines. Torches low on both sides rake light across the grooves (the room: rooms.js, dressed by dress.js).
import { createStage, THREE } from "../stage3d.js";
import { memory as ROOM } from "../rooms.js";
import { bakeAtlas } from "./carvings.js";
const SZ = .5, GAP = .07, WZ = -5, MAX = 100;

export async function createWall(canvas, { host, sound = () => {} }) {
  const S = createStage(canvas, { room: ROOM(), lightmap: new URL("lm.avif", import.meta.url).href }), phone = S.phone();
  S.setFov(phone ? 70 : 56); S.view.pos.set(0, 1.6, 0);
  const { map, normalMap } = bakeAtlas();
  const geo = new THREE.BoxGeometry(SZ, SZ, .14), side = new Float32Array(24); side.fill(1, 16, 20); side.fill(2, 20, 24);  // box faces: +x -x +y -y +z(face) -z(back), 4 vertices each
  geo.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  const fig = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1), glow = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1); glow.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aFig", fig); geo.setAttribute("aGlow", glow);
  const m = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughness: .9, color: new THREE.Color().setRGB(.9, .8, .65) });  // tinted to the reference
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = S.uTime;
    sh.vertexShader = "attribute float aSide, aFig, aGlow; varying float vGlow;\n" + sh.vertexShader.replace("#include <uv_vertex>",
      `float cell = aSide > 1.5 ? aFig : aSide > .5 ? 50. : 51.; vec2 cuv = (vec2(mod(cell, 8.), 7. - floor(cell / 8.)) + (aSide > .5 ? uv * .98 + .01 : uv * .6 + .2)) / 8.; vGlow = aGlow;\n` +
      THREE.ShaderChunk.uv_vertex.replace(/\b(NORMAL)?MAP_UV\b/g, "cuv"));
    sh.fragmentShader = "varying float vGlow; uniform float uTime;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1., .7, .28) * texture2D(map, vMapUv).a * vGlow * (.55 + .2 * sin(uTime * 2.2));");
  };
  const wall = new THREE.InstancedMesh(geo, m, MAX); wall.count = 0; S.scene.add(wall); S.pickables = [wall];
  const o3 = new THREE.Object3D(), ang = new Float32Array(MAX), pos = [];
  const put = i => { const p = pos[i], a = ang[i]; o3.position.set(p.x, p.y, WZ + .09 + Math.sin(a) * (SZ / 2 + .03)); o3.rotation.set(0, a, 0); o3.updateMatrix(); wall.setMatrixAt(i, o3.matrix); wall.instanceMatrix.needsUpdate = true; };
  const kapi = await S.host(new URL(host.model, location.href).href, .95, new THREE.Vector3(2.2, 0, WZ + 1.1), -.5, host.statue).catch(e => (console.warn("memory: the host did not load", e), null)); await S.ready;
  let g = 4, cy = 1.6;

  // stand where the whole wall fits, unless that would make a tablet smaller than a fingertip (48 css px): then turn and zoom to see the rest
  const place = () => { const G = g * SZ + (g - 1) * GAP, t = Math.tan(S.view.base * Math.PI / 360), fit = Math.max(G / 2 / t, G / 2 / (t * S.camera.aspect)) * 1.4, tip = SZ * innerHeight / (2 * t * 48);
    S.view.pos.set(0, cy, WZ + Math.min(fit, tip, 9.4)); S.aim(0, 0); S.view.tf = S.view.base; S.view.maxP = .7; };
  S.onResize = () => wall.count && place();
  return {
    S, act: (n, once = true) => kapi?.act(n, once),
    // lay out the wall for these carvings (card i shows carving figs[i]), all face side out
    deal(figs) {
      if (!figs.length) { wall.count = 0; S.view.pos.set(0, 1.7, -.5); S.aim(0, .08); return; }  // the menu: the empty wall and its host
      g = Math.round(Math.sqrt(figs.length)); const G = g * SZ + (g - 1) * GAP; cy = .75 + G / 2; wall.count = figs.length; pos.length = 0;
      figs.forEach((f, i) => { fig.setX(i, f); glow.setX(i, 0); ang[i] = 0; pos.push({ x: -G / 2 + SZ / 2 + (i % g) * (SZ + GAP), y: cy + G / 2 - SZ / 2 - Math.floor(i / g) * (SZ + GAP) }); put(i); });
      fig.needsUpdate = glow.needsUpdate = true; wall.computeBoundingSphere(); for (const o of [kapi?.root, kapi?.base]) o?.position.setX(G / 2 + .75); place();
    },
    // turn tablet i to show its carving (open) or its face (closed), with the stone sound
    turn(i, open, quiet = false) { const a0 = ang[i], a1 = open ? Math.PI : 0; if (a0 === a1) return; if (!quiet) sound("stone-turn"); S.tween(520, u => { ang[i] = a0 + (a1 - a0) * u; put(i); }); },
    glow(i) { S.tween(700, u => { glow.setX(i, u); glow.needsUpdate = true; }); },
    // tests: where tablet i is on screen (off: outside the view), and turning the view to face it
    screenOf(i) { const p = pos[i], v = new THREE.Vector3(p.x, p.y, WZ + .1).project(S.camera), x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
      return { x, y, off: v.z > 1 || x < 20 || y < 70 || x > innerWidth - 20 || y > innerHeight - 20 }; },
    face(i) { const p = pos[i], c = S.view.pos; S.aim(Math.atan2(-(p.x - c.x), c.z - WZ), Math.atan2(p.y - c.y, c.z - WZ)); },
  };
}
