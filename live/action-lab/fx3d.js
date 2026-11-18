// fx3d.js: the 3D half of the effects, all scheduled when a slice is built and drawn from one story clock (hit-stop freezes them too).
//   puffs   dust and smoke: camera-facing soft discs, moved in the vertex shader from (origin, velocity, start, life, size): no per-frame JS
//   sparks  the same in gold, added light, so the bloom pass makes them glow
//   rings   shockwaves: flat rings that grow and fade, facing a given normal
//   chips   debris: little boxes on ballistic paths that bounce once on the floor and lie still (JS, a fixed pool, nothing allocated per frame)
const VS = `attribute vec3 aO; attribute vec3 aV; attribute vec4 aP; uniform float uT; uniform vec3 uG; uniform float uDrag; varying float vA; varying vec2 vUv; varying float vS;
void main() {
  float age = uT - aP.x, k = age / aP.y;
  vec3 p = aO + aV * (1.0 - exp(-uDrag * age)) / uDrag + 0.5 * uG * age * age;
  float s = (age < 0.0 || k > 1.0) ? 0.0 : aP.z * (0.5 + 1.2 * sqrt(clamp(k, 0.0, 1.0)));
  vec4 mv = modelViewMatrix * vec4(p, 1.0); mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv; vA = (1.0 - k) * smoothstep(0.0, 0.06, k); vUv = uv; vS = aP.w;
}`;
const FS = `uniform vec3 uC; uniform vec3 uC2; uniform float uOp; varying float vA; varying vec2 vUv; varying float vS;
void main() { float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vA * uOp; if (a < 0.003) discard; gl_FragColor = vec4(mix(uC, uC2, fract(vS * 7.13)), a); }`;

function pool(THREE, n, { color, color2 = color, opacity = 1, add = false, gravity = [0, 0, 0], drag = 2 }) {
  const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1)); g.instanceCount = 0;
  const O = new Float32Array(n * 3), V = new Float32Array(n * 3), P = new Float32Array(n * 4);
  g.setAttribute("aO", new THREE.InstancedBufferAttribute(O, 3)); g.setAttribute("aV", new THREE.InstancedBufferAttribute(V, 3)); g.setAttribute("aP", new THREE.InstancedBufferAttribute(P, 4));
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uT: { value: 0 }, uG: { value: new THREE.Vector3(...gravity) }, uDrag: { value: drag }, uC: { value: new THREE.Color(...color) }, uC2: { value: new THREE.Color(...color2) }, uOp: { value: opacity } } });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = add ? 3 : 2;
  let used = 0;
  return { mesh, mat, add(o, v, t0, life, size, seed) {
    if (used >= n) throw new Error(`fx pool full (${n})`);
    O.set(o, used * 3); V.set(v, used * 3); P.set([t0, life, size, seed], used * 4); g.instanceCount = ++used;
    for (const k of ["aO", "aV", "aP"]) g.attributes[k].needsUpdate = true;
  } };
}

export function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }  // mulberry32

export class Fx {
  constructor(THREE, scene) {
    this.T = THREE; this.scene = scene;
    this.dust = pool(THREE, 900, { color: [0.5, 0.42, 0.33], color2: [0.66, 0.58, 0.47], opacity: 0.42, gravity: [0, 0.05, 0], drag: 5 });
    this.smoke = pool(THREE, 600, { color: [0.09, 0.05, 0.12], color2: [0.18, 0.08, 0.16], opacity: 0.2, gravity: [0, 0.06, 0], drag: 1 });  // the Ox King's dark aura (lives in his body's space)
    this.sparks = pool(THREE, 700, { color: [2.2, 1.5, 0.5], color2: [2.0, 1.8, 1.1], opacity: 1, add: true, gravity: [0, -0.9, 0], drag: 3 });
    scene.add(this.dust.mesh, this.sparks.mesh);
    this.rings = []; this.chips = [];
    const ringMat = () => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float uA; varying vec2 vUv; void main(){ float d = abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.5, 1.1, 0.5) * uA, uA * (1.0 - d) * 0.7); }" });
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 64, 1);
    { const uv = this.ringGeo.attributes.uv, p = this.ringGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setX(i, (Math.hypot(p.getX(i), p.getY(i)) - 0.85) / 0.15); }  // u = across the band
    this.ringMat = ringMat;
    this.chipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.25), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 80); this.chipMesh.count = 0; this.chipMesh.castShadow = true; this.chipMesh.frustumCulled = false;
    scene.add(this.chipMesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  // a burst of dust or sparks: n particles from p at t0, outward speed sp, upward bias up, spread mostly on the floor plane when flat
  burst(kind, p, t0, { n = 40, sp = 0.4, up = 0.2, life = 0.9, size = 0.03, flat = false, dir = null, cone = 1, seed = 1 } = {}) {
    const r = rng(seed), P = this[kind];
    for (let i = 0; i < n; i++) {
      let x = r() * 2 - 1, y = flat ? r() * 0.3 : r() * 2 - 1, z = r() * 2 - 1; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      if (dir) { x = dir[0] + x * cone; y = dir[1] + y * cone; z = dir[2] + z * cone; }
      const s = sp * (0.4 + 0.6 * r());
      P.add(p, [x * s, y * s + up * r(), z * s], t0 + r() * 0.04, life * (0.6 + 0.6 * r()), size * (0.6 + 0.8 * r()), r());
    }
  }
  aura(parent, t0, t1, { box = [0.3, 0.25, 0.12], seed = 9 } = {}) {  // dark wisps rising round a body, emitted steadily from t0 to t1 (in the parent's own space)
    const r = rng(seed), P = this.smoke; parent.add(P.mesh);
    for (let t = t0; t < t1; t += 0.025) P.add([(r() - 0.5) * box[0] * 1.2, box[1] * (0.45 + r() * 0.5), (r() - 0.5) * box[2] * 1.4], [(r() - 0.5) * 0.05, 0.05 + r() * 0.06, (r() - 0.5) * 0.05], t, 0.9 + r() * 0.6, 0.05 + r() * 0.05, r());
  }
  ring(p, normal, t0, { r1 = 0.3, life = 0.45, width = 1 } = {}) {
    const m = new this.T.Mesh(this.ringGeo, this.ringMat()); m.position.set(...p); m.lookAt(m.position.clone().add(new this.T.Vector3(...normal))); m.visible = false; m.renderOrder = 4; m.frustumCulled = false;
    this.scene.add(m); this.rings.push({ m, t0, r1, life, width });
  }
  debris(p, t0, { n = 30, sp = 0.6, up = 0.5, dir = [0, 0, 1], floor = 0, size = 0.012, colors = [[0.75, 0.2, 0.1], [0.85, 0.66, 0.3], [0.93, 0.89, 0.8]], seed = 3 } = {}) {
    const r = rng(seed), C = new this.T.Color();
    for (let i = 0; i < n; i++) {
      const v = [dir[0] * sp * (0.4 + r()) + (r() - 0.5) * sp, up * (0.3 + r()), dir[2] * sp * (0.4 + r()) + (r() - 0.5) * sp];
      const k = this.chipMesh.count++; this.chipMesh.setColorAt(k, C.setRGB(...colors[i % colors.length]));
      this.chips.push({ k, p, v, t0, floor, s: size * (0.5 + r()), spin: [r() * 20 - 10, r() * 20 - 10, r() * 20 - 10] });
    }
    this.chipMesh.instanceColor.needsUpdate = true;
  }
  at(T) {
    for (const P of [this.dust, this.smoke, this.sparks]) P.mat.uniforms.uT.value = T;
    for (const R of this.rings) { const k = (T - R.t0) / R.life; R.m.visible = k >= 0 && k < 1; if (!R.m.visible) continue; const e = 1 - (1 - k) ** 3; R.m.scale.setScalar(Math.max(1e-3, R.r1 * e)); R.m.material.uniforms.uA.value = (1 - k) * R.width; }
    const g = -2.4;
    for (const c of this.chips) {  // fly, hit the floor once with a small bounce, lie still
      let a = Math.max(0, T - c.t0), x = c.p[0] + c.v[0] * a, z = c.p[2] + c.v[2] * a, y = c.p[1] + c.v[1] * a + 0.5 * g * a * a, rot = a;
      const ta = (c.v[1] + Math.sqrt(c.v[1] ** 2 + 2 * -g * Math.max(0, c.p[1] - c.floor))) / -g;  // when it lands
      if (a > ta) { const b = Math.min(a - ta, 0.18); x = c.p[0] + c.v[0] * (ta + b * 0.5); z = c.p[2] + c.v[2] * (ta + b * 0.5); y = c.floor + c.s * 0.2 + Math.max(0, 0.3 * b - 1.2 * b * b); rot = ta + b * 0.3; }
      this._e.set(c.spin[0] * rot, c.spin[1] * rot, c.spin[2] * rot); this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(x, y, z), this._q, this._s.setScalar(T < c.t0 ? 0 : c.s)); this.chipMesh.setMatrixAt(c.k, this._m);
    }
    this.chipMesh.instanceMatrix.needsUpdate = true;
  }
}
