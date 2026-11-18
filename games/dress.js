// dress.js: builds a Wonder Hall game room in three.js from rooms.js, as a copy of its Blender reference (renders/review/games-rich: ref/ the target, REPORT.md).
// Files: the room's lightmap (lm.avif: the reference's own fire and moonlight on walls, floor and ceiling) and, where code could not copy the stone and panelling
// (three blind-critic rounds), the reference's own CC0 textures, small (tex/). Floors and planks are procedural tiles rendered ONCE on the GPU at load;
// carvings and painted cloth come from art.js canvases; fire, the moonbeam and its dust are shaders; the frame loop allocates nothing.
import * as THREE from "three";
import { ART } from "./art.js";

// ---------------- the tiles: one GLSL function per material, mat(uv) -> colour (linear), height, roughness, over a tile that repeats without a seam
const LIB = `
float h21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float vn(vec2 p, vec2 P) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(h21(mod(i, P)), h21(mod(i + vec2(1., 0.), P)), u.x), mix(h21(mod(i + vec2(0., 1.), P)), h21(mod(i + 1., P)), u.x), u.y); }
float fbm(vec2 p, vec2 P) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vn(p, P); p *= 2.; P *= 2.; a *= .5; } return s / .97; }
// courses of blocks: R rows a tile, N blocks a row on average, ends jittered by jit; edge = distance to the block's edge in tile units, id = the block
vec2 blocks(vec2 uv, float R, float N, float jit, out vec3 id) {
  float r = floor(uv.y * R), y = fract(uv.y * R), off = h21(vec2(r, 7.)), t = fract(uv.x - off) * N, k = floor(t);
  float a = k + (h21(vec2(mod(k, N), r)) - .5) * jit, b = k + 1. + (h21(vec2(mod(k + 1., N), r)) - .5) * jit, kk = k;
  if (t < a) { kk = k - 1.; b = a; a = k - 1. + (h21(vec2(mod(k - 1., N), r)) - .5) * jit; }
  else if (t >= b) { kk = k + 1.; a = b; b = k + 2. + (h21(vec2(mod(k + 2., N), r)) - .5) * jit; }
  id = vec3(h21(vec2(mod(kk, N), r + 31.)), h21(vec2(mod(kk, N) + 9., r)), (t - a) / (b - a));
  return vec2(min(t - a, b - t) / N, min(y, 1. - y) / R);
}
// boards: N across the tile in x, each cut into pieces about L long in y (L = 0: one piece); returns edge distances, id
vec2 boards(vec2 uv, float N, float L, out vec3 id) {
  float k = floor(uv.x * N), x = fract(uv.x * N), e = 1e3, y = uv.y;
  if (L > 0.) { float M = floor(1. / L + .5), off = h21(vec2(k, 3.)), t = fract(y - off) * M, j = floor(t); e = min(t - j, j + 1. - t) / M; k += j * 17.; }
  id = vec3(h21(vec2(k, 11.)), h21(vec2(k, 23.)), x); return vec2(min(x, 1. - x) / N, e);
}
vec3 pal3(vec3 a, vec3 b, vec3 c, float t) { return t < .5 ? mix(a, b, t * 2.) : mix(b, c, t * 2. - 1.); }
`;
const TILES = {
  // old_wooden_floor_02 (2.03 m): narrow strips laid along x, staggered ends, honey to dark brown
  floor: [[2.03, 2.03], `vec3 id; vec2 q = vec2(uv.y, uv.x); vec2 e = boards(q, 20., .33, id); float gr = fbm(vec2(q.x * 200., q.y * 6.), vec2(200., 6.)), d = fbm(uv * 24., vec2(24.));
    c = pal3(vec3(.07, .022, .0015), vec3(.1, .033, .002), vec3(.13, .045, .004), id.x) * (.8 + .35 * gr) * (.9 + .2 * d);
    float s = smoothstep(.0, .0025, min(e.x, e.y)); c *= .75 + .25 * s; h = s * (.7 + .3 * gr); r = .5 + .25 * (1. - gr);`],
  // dark_wooden_planks (2 m): wide grey-brown planks along x
  dark: [[2.0, 2.0], `vec3 id; vec2 q = vec2(uv.y, uv.x); vec2 e = boards(q, 8., 0., id); float gr = fbm(vec2(q.x * 80., q.y * 5.), vec2(80., 5.)), d = fbm(uv * 30., vec2(30.));
    c = vec3(.09, .068, .047) * (.8 + .35 * id.x) * (.75 + .45 * gr) * (.9 + .2 * d); float s = smoothstep(.0, .003, min(e.x, e.y)); c *= .4 + .6 * s; h = s * (.6 + .4 * gr); r = .7 + .15 * gr;`],
 // dressed: smooth faces
  // large_grey_tiles (3 m): big grey flagstones, hairline joints, a few cracks
  flags: [[3.0, 3.0], `vec3 id; vec2 e = blocks(uv, 3., 3., .35, id); float m = min(e.x, e.y), n = fbm(uv * 14., vec2(14.)), g = fbm(uv * 90., vec2(90.)), cr = abs(fbm(uv * 9. + id.xy * 5., vec2(9.)) - .5);
    c = vec3(.25, .23, .19) * (.8 + .3 * id.x) * (.75 + .45 * n) * (.9 + .2 * g); c *= 1. - .6 * (1. - smoothstep(.0, .012, cr));
    float mo = smoothstep(.001, .004, m); c = mix(vec3(.04, .04, .035), c, mo); h = mo * (.8 + .2 * n) - .3 * (1. - smoothstep(.0, .01, cr)); r = .85;`],
};
function bakeTiles(renderer, names, size) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), out = {};
  const prev = renderer.getRenderTarget();
  for (const n of names) {
    const [sz, body] = TILES[n], fn = `void mat(vec2 uv, out vec3 c, out float h, out float r) { ${body} }`;
    const rt = cs => { const t = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
      t.texture.colorSpace = cs; t.texture.anisotropy = 8; return t; };
    const C = rt(THREE.SRGBColorSpace), N = rt(THREE.NoColorSpace);
    const pass = (target, main) => { quad.material = new THREE.ShaderMaterial({ uniforms: { e: { value: 1 / size } }, vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
      fragmentShader: `uniform float e; varying vec2 vUv; ${LIB} ${fn} void main() { vec3 c; float h, r; ${main} }` }); renderer.setRenderTarget(target); renderer.render(quad, cam); quad.material.dispose(); };
    pass(C, "mat(vUv, c, h, r); gl_FragColor = vec4(max(c, 0.), clamp(h, 0., 1.));");
    pass(N, `vec3 c2; float hx, hy, r2; mat(vUv, c, h, r); mat(vUv + vec2(e, 0.), c2, hx, r2); mat(vUv + vec2(0., e), c2, hy, r2);
      float k = 1.6 * float(${size}) / 1024.; vec3 n = normalize(vec3((h - hx) * k * 8., (h - hy) * k * 8., 1.)); gl_FragColor = vec4(n * .5 + .5, clamp(r, 0., 1.));`);
    out[n] = { map: C.texture, nr: N.texture, size: sz, rts: [C, N] };
  }
  renderer.setRenderTarget(prev); quad.geometry.dispose(); return out;
}

// ---------------- materials (the same names as the reference's, renders/review/games-rich/blend/build.py)
// [tile, tint (on the tile's colour), roughness scale, moss amount, metres per tile (overrides the tile's)]
const RECIPE = {
  floorPlanks: ["floor", [.36, .37, .003], 1], ceilWood: ["dark", [.32, .26, .2], 1], beam: ["dark", [.17, .13, .1], 1, 0, 1.5], shelf: ["dark", [.4, .31, .23], 1, 0, 3],
  flags: ["flags", [.3, .2, .1], 1, .5],
};
// the stone and panelling the procedural tiles could not copy (three blind-critic rounds said "cartoon"): the reference's own CC0 textures, shipped small
// (web/games/tex, AVIF, SOURCES.txt). [texture, metres per tile, tint as build.py's, roughness, moss]
const SHIP = { plinth: ["brick", [1.5, 1.5], [.4, .25, .1], .9, .35], panel: ["boards", [1, .5], [.43, .33, .25], .7], panelDark: ["boards", [1, .5], [.26, .19, .15], .7],
  dressed: ["ashlar", [3, 3], [.5, .4, .25], .9, .25], rune: ["ashlar", [3, 3], [.36, .25, .1], .9], wallStone: ["rubble", [1.52, 1.52], [.59, .44, .22], .9, .9], door: ["door", [2, 2], [.38, .31, .24], .75], slate: ["slates", [2.5, 2.5], [.5, .37, .23], .9] };
// tints: build.py's, then times the measured reference / copy ratio (regions.py), as the copy's light is not the reference's
const PLAIN = { gold: [[.55, .37, .14], .4, 1], bronze: [[.4, .24, .11], .45, 1], iron: [[.05, .045, .04], .6, .6], dark: [[.03, .02, .015], .9, 0] };
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

export function dress(S, R, opt = {}) {
  const { renderer, scene } = S, phone = S.phone(), room = new THREE.Group(); scene.add(room);
  const IMPLIED = { torch: ["beam", "iron"], brazier: ["dressed", "bronze"], oculus: ["dressed"], banner: ["bronze"] };  // what a part is made of besides its own m
  const used = new Set([...R.bands.map(b => b[2]), R.floor, R.ceiling, ...R.parts.flatMap(p => [p.m, p.key, ...(IMPLIED[p.t] || [])]), ...(R.leaf || []).map(p => p.m)].filter(Boolean));
  const tiles = bakeTiles(renderer, [...new Set([...used].filter(m => RECIPE[m]).map(m => RECIPE[m][0]))], phone ? 512 : 1024);
  const loads = [], TL = new THREE.TextureLoader(), SH = {};
  const tex = (f, cs) => { let t; loads.push(new Promise(res => (t = TL.load(new URL(`tex/${f}`, import.meta.url).href, res, undefined, res)))); t.colorSpace = cs; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const shipped = n => (SH[n] ||= { map: tex(n + "-d.avif", THREE.SRGBColorSpace), nr: tex(n + "-n.avif", THREE.NoColorSpace) });
  const shellU = { uDirect: { value: 1.5 }, uTime: S.uTime };
  // a tiled material: roughness from the normal texture's alpha; moss (stone) in low cavities near the floor; shell = lit by the lightmap, direct light scaled
  const M = {}, tileSize = {};
  const mk = (name, shell = false) => {
    if (M[name + shell]) return M[name + shell];
    let m;
    if (RECIPE[name] || SHIP[name]) {
      let t, tint, rs, moss = 0, sz, lum = 0;
      if (SHIP[name]) { const [tn, size, tn2, r, mo = 0] = SHIP[name]; t = shipped(tn); tint = tn2; rs = r; moss = mo; tileSize[name] = size; lum = 1; }
      else { const [tn, tn2, r, mo = 0, s1] = RECIPE[name]; t = tiles[tn]; tint = tn2; rs = r; moss = mo; tileSize[name] = s1 ? [s1, s1] : t.size; }
      m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.nr, normalScale: new THREE.Vector2(1, 1).multiplyScalar(lum ? .7 : 1), color: lin(...tint), roughness: rs });
      if (name === "rune") { m.emissive = lin(1, .5, .12); m.emissiveIntensity = .18; }
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, shellU, { uMoss: { value: moss }, uLum: { value: lum } });
        sh.vertexShader = "varying vec3 vWorld;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vec4 wq = vec4(transformed, 1.);\n#ifdef USE_INSTANCING\n wq = instanceMatrix * wq;\n#endif\n vWorld = (modelMatrix * wq).xyz;");
        sh.fragmentShader = "varying vec3 vWorld; uniform float uDirect, uMoss, uLum;\n" + sh.fragmentShader
          .replace("#include <map_fragment>", `#include <map_fragment>\n diffuseColor.a = opacity;
            vec4 tx = texture2D(map, vMapUv); float cav = mix(1. - tx.a, 1. - smoothstep(.03, .2, dot(tx.rgb, vec3(.3, .59, .11))), uLum), mk = (1. - smoothstep(.15, 1.6, vWorld.y)) * smoothstep(.5, .85, cav) * smoothstep(.45, .7, sin(vWorld.x * 3.1 + sin(vWorld.y * 4.7 + vWorld.z * 2.3) * 1.7) * .5 + .5) * uMoss;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.13, .14, .07), mk);`)
          .replace("#include <roughnessmap_fragment>", "float roughnessFactor = roughness * texture2D(normalMap, vNormalMapUv).a;")
          .replace("#include <lights_fragment_maps>", shell ? "irradiance = vec3(0.);\n#include <lights_fragment_maps>\n reflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;" : "#include <lights_fragment_maps>");
      };
      m.customProgramCacheKey = () => "tile" + shell;  // one program for every tiled material (moss is a uniform): fewer shader compiles at load
    } else if (PLAIN[name]) { const [c, r, mt] = PLAIN[name]; m = new THREE.MeshStandardMaterial({ color: lin(...c), roughness: r, metalness: mt }); }
    else m = new THREE.MeshStandardMaterial({ color: 0x777777 });
    if (shell) { m.lightMap = lm; m.lightMapIntensity = 0; m.envMap = opt.env ?? null; m.envMapIntensity = 0; }  // the shell's whole indirect light is the lightmap (its own envMap at 0 overrides the scene's)
    return (M[name + shell] = m);
  };
  // the lightmap: rooms.js's atlas, baked in Blender (build.py bake), stored as sRGB AVIF of light / LMS; until it arrives the walls have only their fires (the games wait for it before showing the room)
  const lm = new THREE.Texture(); lm.channel = 1; lm.colorSpace = THREE.SRGBColorSpace; lm.flipY = true;
  const LMS = R.lmScale ?? 4, LM_GAIN = .29;  // LM_GAIN: measured against the reference's renders (renders/review/games-rich/regions.py)
  const lmReady = opt.lightmap ? new Promise(res => { const im = new Image(); im.onload = () => { lm.image = im; lm.needsUpdate = true; for (const m of Object.values(M)) if (m.lightMap) m.lightMapIntensity = Math.PI * LMS * LM_GAIN; res(); }; im.onerror = () => res(); im.src = opt.lightmap; }) : Promise.resolve();

  // box-projected uv in tile units (as Blender's BOX projection on world metres): faces facing x use (z, y), facing y use (x, z), facing z use (x, y)
  const project = (g, sz) => { const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)); let u, v;
      if (ax >= ay && ax >= az) { u = -p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = -p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
      uv[i * 2] = u / sz[0]; uv[i * 2 + 1] = v / sz[1]; }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); return g; };
  const add = (g, name, parent = room) => { const mesh = new THREE.Mesh(tileSize[name] || RECIPE[name] ? (mk(name), project(g, tileSize[name])) : g, mk(name)); parent.add(mesh); return mesh; };
  const at = (g, p, ry = 0) => { if (ry) g.rotateY(ry); g.translate(p[0], p[1], p[2]); return g; };

  // ---------------- the shell: floor, ceiling and walls as quads in their lightmap planes (holes for the doors, bands of material up the walls)
  const A = R.lm.size;
  for (const q of R.lm.planes) {
    const [W, H] = q.size, [rx, ry, rw, rh] = q.rect, by = {};
    if (q.id === "floor") by[R.floor] = [[0, W, 0, H]]; else if (q.id === "ceiling") by[R.ceiling] = [[0, W, 0, H]];
    else { const segs = []; let a = 0;
      for (const h of q.id === "back" ? R.holes : []) { const hx = h.x + R.w / 2; segs.push([a, hx - h.w / 2, 0, R.h], [hx - h.w / 2, hx + h.w / 2, h.h, R.h]); a = hx + h.w / 2; }
      segs.push([a, W, 0, R.h]);
      for (const [s0, s1, t0, t1] of segs) for (const [b0, b1, m] of R.bands) { const lo = Math.max(t0, b0), hi = Math.min(t1, b1); if (hi > lo + 1e-6) (by[m] ||= []).push([s0, s1, lo, hi]); } }
    for (const [m, ps] of Object.entries(by)) {
      const pos = [], uv = [], uv1 = [], idx = [], fr = m === "frieze", sz = fr ? [2, .55] : (mk(m, true), tileSize[m] || [1, 1]);
      for (const [s0, s1, t0, t1] of ps) { const b = pos.length / 3;
        for (const [s, t] of [[s0, t0], [s1, t0], [s1, t1], [s0, t1]]) { for (let c = 0; c < 3; c++) pos.push(q.o[c] + q.u[c] * s + q.v[c] * t);
          uv.push(fr ? s / 2 : s / sz[0], fr ? (t - 3.55) / .55 : t / sz[1]); uv1.push((rx + s / W * rw) / A, 1 - (ry + (1 - t / H) * rh) / A); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("uv1", new THREE.Float32BufferAttribute(uv1, 2));
      g.setIndex(idx); g.computeVertexNormals();
      room.add(new THREE.Mesh(g, fr ? relief("frieze", "frieze", [.032, .013, .002], .6, null, true) : mk(m, true)));
    }
  }

  // ---------------- carvings and paintings (art.js canvases): a relief = a colour map (grooves dark, gold left in their floors) and a normal map from the height
  function relief(key, art, base, gold, glow, shell = false) {
    const id = key + shell; if (M[id]) return M[id];
    const c = ART[art](), w = c.width, h = c.height, H = c.getContext("2d").getImageData(0, 0, w, h).data, col = document.createElement("canvas"); col.width = w; col.height = h;
    const g = col.getContext("2d"), im = g.createImageData(w, h), nor = new Uint8Array(w * h * 4), em = glow ? g.createImageData(w, h) : null, hv = (x, y) => H[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
    const enc = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, v = hv(x, y), nz = .8 + .4 * Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5 % 1), sm = Math.min(1, Math.max(0, (v - .45) / .45));
      for (let i = 0; i < 3; i++) { let cc = base[i] * nz; cc = cc + (([.02, .012, .006][i]) - cc) * v * .55; cc = cc + ([.75, .5, .18][i] - cc) * sm * gold; im.data[k + i] = enc(cc); }
      im.data[k + 3] = 255; const du = (hv(x + 1, y) - hv(x - 1, y)) * 2.2, dv = (hv(x, y - 1) - hv(x, y + 1)) * 2.2, l = Math.hypot(du, dv, 1);
      nor[k] = 127.5 * (1 + du / l); nor[k + 1] = 127.5 * (1 + dv / l); nor[k + 2] = 127.5 * (1 + 1 / l); nor[k + 3] = 255;
      if (em) { const a = Math.min(1, Math.max(0, (v - .35) / .55)); for (let i = 0; i < 3; i++) em.data[k + i] = enc(glow[i] * a); em.data[k + 3] = 255; } }
    g.putImageData(im, 0, 0); const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
    const nt = new THREE.DataTexture(nor, w, h); nt.flipY = true; nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.generateMipmaps = true; nt.minFilter = THREE.LinearMipmapLinearFilter; nt.magFilter = THREE.LinearFilter; nt.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ map, normalMap: nt, roughness: .85 });
    if (em) { const ec = document.createElement("canvas"); ec.width = w; ec.height = h; ec.getContext("2d").putImageData(em, 0, 0); m.emissiveMap = new THREE.CanvasTexture(ec); m.emissiveMap.colorSpace = THREE.SRGBColorSpace; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = glow[3]; }
    if (shell) { m.lightMap = lm; m.lightMapIntensity = 0; m.envMap = opt.env ?? null; m.envMapIntensity = 0; m.onBeforeCompile = sh => { Object.assign(sh.uniforms, shellU); sh.fragmentShader = "uniform float uDirect;\n" + sh.fragmentShader.replace("#include <lights_fragment_maps>", "irradiance = vec3(0.);\n#include <lights_fragment_maps>\n reflectedLight.directDiffuse *= uDirect; reflectedLight.directSpecular *= uDirect;"); }; m.customProgramCacheKey = () => id; }
    return (M[id] = m);
  }
  const picture = (art, o = {}) => { const id = "pic-" + art; if (M[id]) return M[id]; const t = new THREE.CanvasTexture(ART[art]()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return (M[id] = o.basic ? new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(o.basic, o.basic, o.basic) }) : new THREE.MeshPhysicalMaterial({ map: t, roughness: o.rough ?? .8, sheen: .4, sheenRoughness: .5, sheenColor: 0xffffff, alphaTest: o.alpha ? .5 : 0, side: o.alpha ? THREE.DoubleSide : THREE.FrontSide })); };
  const ARTS = { tympanum: () => relief("tympanum", "tympanum", [.03, .02, .014], .35), lintel: () => relief("lintel", "lintel", [.045, .03, .01], .3),
    runes: () => relief("runes", "runes", [.03, .025, .018], 0, [.5, .8, 1, 2.5]), sky: () => picture("sky", { basic: 1.4 }) };
  // a flat card: bottom-centre p, facing +z turned by ry; arch: its top w/2 is a half circle; uv = its own 0..1 square
  const card = (P, mat, nx = 1, ny = 1, wave = 0) => { let g;
    if (P.arch) { const r = P.w / 2, yc = P.h - r, s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, yc); s.absarc(0, yc, r, 0, Math.PI, false); s.lineTo(-r, 0); g = new THREE.ShapeGeometry(s, 24);
      const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / P.w + .5, p.getY(i) / P.h); }
    else { g = new THREE.PlaneGeometry(P.w, P.h, nx, ny); g.translate(0, P.h / 2, 0); const p = g.attributes.position;
      if (wave) for (let i = 0; i < p.count; i++) { const u = p.getX(i) / P.w + .5, v = p.getY(i) / P.h; p.setZ(i, wave * Math.sin(u * Math.PI * 3) * (.4 + .6 * (1 - v))); } g.computeVertexNormals(); }
    const m = new THREE.Mesh(at(g, P.p, P.ry || 0), mat); room.add(m); return m; };

  // ---------------- parts
  const lights = [], flames = [], lathe = (prof, seg = 32) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const box = (m, s, p, ry = 0, parent) => add(at(new THREE.BoxGeometry(...s), p, ry), m, parent);
  const light = (p, l, range = 7, power = l[3]) => {  // range: the pool of light ends there (the lightmap carries the far light)
    const L = new THREE.PointLight(new THREE.Color(l[0] / 255, l[1] / 255, l[2] / 255), power * K, range, 2); L.position.set(...p); scene.add(L); lights.push({ L, i: L.intensity, ph: lights.length * 1.7 }); return L; };
  const K = .75 / (4 * Math.PI);  // Blender watts -> three candela: a point light's radiant intensity, x .6 measured (no shadows here, so props took too much)
  const torch = (P) => {  // a torch's light x 2.2: its halo on the wall behind it, measured against the reference
    const n = new THREE.Vector3(...P.n), base = new THREE.Vector3(...P.p), top = base.clone().addScaledVector(n, .13).add(new THREE.Vector3(0, .3, 0));
    box("iron", [.05, .05, .05], [base.x, base.y + .02, base.z]);
    const len = top.distanceTo(base), hg = new THREE.CylinderGeometry(.032, .022, len, 10); hg.translate(0, len / 2, 0); hg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize())); hg.translate(base.x, base.y, base.z); add(hg, "beam");
    add(at(lathe([[.03, 0], [.06, .05], [.075, .11], [.065, .12], [0, .1]], 16), top.toArray()), "iron");
    flames.push([top.x, top.y + .1, top.z, .2]); light([top.x, top.y + .17, top.z], P.light, 6, P.light[3] * 2.2); };
  const brazier = (P) => { add(at(lathe(P.ped), P.p), "dressed"); add(at(lathe(P.bowl), P.p), "bronze");
    const coal = new THREE.Mesh(at(lathe([[0, 1.0], [.24, .99], [0, 1.03]], 24), P.p), new THREE.MeshStandardMaterial({ color: lin(.05, .03, .02), emissive: lin(1, .28, .05), emissiveIntensity: 6, roughness: .9 })); room.add(coal);
    flames.push([P.p[0], P.p[1] + 1.0, P.p[2], .42]); light([P.p[0], P.p[1] + 1.25, P.p[2]], P.light, 9); };
  const arch = (P) => { const n = P.n, gap = .012, ry = P.ry || 0;
    for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n + gap / 2, a1 = Math.PI * (k + 1) / n - gap / 2, s = new THREE.Shape();
      s.moveTo(P.r0 * Math.cos(a0), P.r0 * Math.sin(a0)); s.lineTo(P.r1 * Math.cos(a0), P.r1 * Math.sin(a0)); s.lineTo(P.r1 * Math.cos(a1), P.r1 * Math.sin(a1)); s.lineTo(P.r0 * Math.cos(a1), P.r0 * Math.sin(a1));
      const g = new THREE.ExtrudeGeometry(s, { depth: P.dz, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1 }); g.translate(0, 0, -P.dz / 2);
      add(at(g, P.c, ry), P.key && k === n >> 1 ? P.key : P.m); } };
  const leafShape = new THREE.Shape([[0, -.5], [.32, -.25], [.5, .15], [.2, .5], [0, .35], [-.2, .5], [-.5, .15], [-.32, -.25]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const P of R.parts) {
    const t = P.t;
    if (t === "box") box(P.m, P.s, P.p, P.ry);
    else if (t === "lathe") add(at(lathe(P.prof), P.p), P.m);
    else if (t === "arch") arch(P);
    else if (t === "torch") torch(P);
    else if (t === "brazier") brazier(P);
    else if (t === "paint") card(P, ARTS[P.art]());
    else if (t === "banner") { card({ ...P, p: [P.p[0], P.p[1] - P.h, P.p[2]] }, picture(P.art, { alpha: true }), 12, 16, .025);
      const rod = new THREE.BoxGeometry(P.w + .16, .03, .03); rod.translate(0, .02, .03); add(at(rod, P.p, P.ry || 0), "bronze"); }
    else if (t === "oculus") { const g = new THREE.CircleGeometry(P.r, 40), uv = g.attributes.uv, p = g.attributes.position;  // the sky disc shows the painting round its moon
      for (let i = 0; i < p.count; i++) uv.setXY(i, .6 + .3 * p.getX(i) / P.r, .7 + .3 * p.getY(i) / P.r * 256 / 416); g.rotateX(Math.PI / 2); g.translate(...P.p); room.add(new THREE.Mesh(g, ARTS.sky()));
      add(at(lathe([[P.r, .005], [P.r + .2, .005], [P.r + .2, -.07], [P.r, -.09]], 40), P.p), "dressed"); }
    else if (t === "rug") { const g = new THREE.PlaneGeometry(P.w, P.d); g.rotateX(-Math.PI / 2); g.translate(...P.p); const rug = picture("rug", { rough: .95 }); rug.color.setRGB(1.3, 1.17, .97); room.add(new THREE.Mesh(g, rug)); }  // x2: measured against the reference
    else if (t === "water") { const g = new THREE.CircleGeometry(P.r, 40); g.rotateX(-Math.PI / 2); g.translate(...P.p); room.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: lin(.006, .015, .018), roughness: .05, metalness: 0, envMap: opt.env ?? null, envMapIntensity: .05 }))); }  // its own envMap, so its intensity counts
    else if (t === "leaves") { const im = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape), new THREE.MeshStandardMaterial({ roughness: .45, side: THREE.DoubleSide }), P.list.length), m4 = new THREE.Matrix4(), cl = new THREE.Color();
      const G = [[.06, .16, .03], [.1, .24, .05], [.16, .28, .07]], n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
      P.list.forEach(([x, y, z, nx, ny, nz, spin, sx, sy, tn], i) => { n.set(nx, ny, nz).normalize(); a.set(...(Math.abs(n.y) < .9 ? [0, 1, 0] : [1, 0, 0])).cross(n).normalize(); b.crossVectors(n, a);
        u.copy(a).multiplyScalar(Math.cos(spin)).addScaledVector(b, Math.sin(spin)); w.copy(a).multiplyScalar(-Math.sin(spin)).addScaledVector(b, Math.cos(spin));
        m4.makeBasis(u.multiplyScalar(sx), w.multiplyScalar(sy), n).setPosition(x, y, z); im.setMatrixAt(i, m4); im.setColorAt(i, cl.setRGB(...G[Math.min(2, (tn * 3) | 0)], THREE.LinearSRGBColorSpace)); });
      room.add(im); }
    else if (t === "books") { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .7 }), P.list.length), m4 = new THREE.Matrix4(), cl = new THREE.Color();
      P.list.forEach(([x, y, z, sx, sy, sz, r, g, b], i) => { im.setMatrixAt(i, m4.makeScale(sx, sy, sz).setPosition(x, y, z)); im.setColorAt(i, cl.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)); }); room.add(im); }
  }

  // ---------------- fire: one instanced draw for every flame (a camera-facing teardrop with a moving core) and one for their glows
  const NF = flames.length, fa = new Float32Array(NF * 4); flames.forEach((f, i) => fa.set(f, i * 4));
  const fq = new THREE.InstancedBufferGeometry(); fq.index = new THREE.PlaneGeometry(1, 1).index; fq.setAttribute("position", new THREE.PlaneGeometry(1, 1).attributes.position); fq.setAttribute("aF", new THREE.InstancedBufferAttribute(fa, 4)); fq.instanceCount = NF;
  const fmat = (glow) => new THREE.ShaderMaterial({ uniforms: { uTime: S.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true,
    vertexShader: `attribute vec4 aF; uniform float uTime; varying vec2 vQ; varying float vS;
      void main() { vS = fract(aF.x * 7.31 + aF.z * 3.7); float s = aF.w * ${glow ? "3.2" : "1.35"}; vec4 mv = modelViewMatrix * vec4(aF.xyz + vec3(0., aF.w * ${glow ? ".25" : ".42"}, 0.), 1.);
        mv.xy += position.xy * vec2(s * ${glow ? "1." : ".62"}, s); vQ = position.xy + .5; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: glow ? `varying vec2 vQ; uniform float uTime; varying float vS; void main() { float r = length(vQ - .5) * 2.; float a = exp(-r * r * 4.) * (.12 + .02 * sin(uTime * 9. + vS * 20.)); gl_FragColor = vec4(vec3(1., .45, .12) * a, 1.); }`
      : `varying vec2 vQ; uniform float uTime; varying float vS;
      float n(vec2 p) { return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5); } float sn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f); return mix(mix(n(i), n(i + vec2(1, 0)), u.x), mix(n(i + vec2(0, 1)), n(i + 1.), u.x), u.y); }
      void main() { vec2 q = vQ; float t = uTime * 3. + vS * 10., y = q.y, w = .5 * (1. - pow(y, 1.4) * .85) * (.75 + .25 * sin(t * 1.7 + y * 6.)) * sqrt(max(0., 1. - pow(max(0., .18 - y) / .18, 2.)));
        float x = abs(q.x - .5 + .06 * sin(t * 2.3 + y * 5.) * y) / max(w, 1e-3), body = (1. - smoothstep(.55, 1., x)) * (1. - smoothstep(.55, 1., y)) * smoothstep(0., .08, y);
        body *= .75 + .5 * sn(vec2(q.x * 6., y * 5. - t * 2.)); vec3 c = mix(vec3(1., .72, .28), vec3(1., .4, .06), smoothstep(.0, .5, y)); c = mix(c, vec3(.75, .12, .01), smoothstep(.45, 1., y));
        float core = (1. - smoothstep(.2, .8, x)) * (1. - smoothstep(.35, .85, y)); c = mix(c, vec3(1., .95, .85), core);  // a white-hot core, as the reference's
        gl_FragColor = vec4(c * body * (6. + 14. * core), 1.); }` });
  const glowMesh = new THREE.Mesh(fq, fmat(true)), flameMesh = new THREE.Mesh(fq, fmat(false)); for (const o of [glowMesh, flameMesh]) { o.frustumCulled = false; scene.add(o); }

  // ---------------- the moon: a cool spot through the window, a cone of light in the dust, motes that drift in it
  const mo = R.moon, from = new THREE.Vector3(...mo.from), to = new THREE.Vector3(...mo.to), half = THREE.MathUtils.degToRad(mo.angle) / 2;
  const spot = new THREE.SpotLight(new THREE.Color(mo.rgb[0] / 255, mo.rgb[1] / 255, mo.rgb[2] / 255), mo.power * K * .7, 0, half, 1, 2); spot.position.copy(from); spot.target.position.copy(to); scene.add(spot, spot.target);
  const Lh = from.distanceTo(to) * 1.05, cone = new THREE.CylinderGeometry(.05, Math.tan(half) * Lh * 1.1, Lh, 32, 1, true); cone.translate(0, -Lh / 2, 0);
  cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize())); cone.translate(from.x, from.y, from.z);
  const beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({ uniforms: { uHaze: { value: mo.haze }, uTime: S.uTime, uFrom: { value: from }, uDir: { value: to.clone().sub(from).normalize() }, uLen: { value: Lh }, uTan: { value: Math.tan(half) * 1.1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,  // the far wall of the cone: march from the eye to it, through the beam
    vertexShader: "varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }",
    fragmentShader: `uniform vec3 uFrom, uDir; uniform float uLen, uTan, uTime, uHaze; varying vec3 vW;
      void main() { vec3 seg = vW - cameraPosition; float L = length(seg), st = L / 24., acc = 0.;
        for (int i = 0; i < 24; i++) { vec3 p = cameraPosition + seg * (float(i) + .5) / 24.; vec3 d = p - uFrom; float t = dot(d, uDir); if (t < 0. || t > uLen) continue;
          float r = length(d - uDir * t) / (t * uTan + .05); acc += (1. - smoothstep(.55, 1., r)) * (1. - smoothstep(uLen * .85, uLen, t)) * smoothstep(0., .25, t) * smoothstep(0., .7, p.y) * (.85 + .15 * sin(p.y * 7. + uTime * .5 + p.x * 3.)) * st; }
        float ph = .91 / pow(1.09 - .6 * dot(uDir, -seg / L), 1.5);  // Henyey-Greenstein (g = .3, softer than the reference's .4: measured): brightest looking back up the beam
        gl_FragColor = vec4(vec3(.75, .8, 1.) * acc * uHaze * ph * 5.5, 1.); }` }));  // x 5.5: measured against the reference (regions.py on the beam)
  beam.frustumCulled = false; scene.add(beam);

  // ---------------- per frame: flicker (two sines a light), nothing allocated
  const update = clock => { for (const l of lights) l.L.intensity = l.i * (.86 + .08 * Math.sin(clock * 7.3 + l.ph) + .06 * Math.sin(clock * 13.1 + l.ph * 2.3)); };
  return { room, M: mk, add, box, ready: Promise.all([lmReady, ...loads]), update, lights, part: (q, parent) => q.t === "box" ? box(q.m, q.s, q.p, 0, parent) : (() => { const g = new THREE.TorusGeometry(q.r, q.tube, 8, 24); g.translate(...q.p); const m = new THREE.Mesh(g, mk(q.m)); parent.add(m); return m; })() };
}
