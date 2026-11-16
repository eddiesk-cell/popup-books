// sky.js: one smooth gradient dome by view pitch (no cards), from room.json `sky`: down below -1.2 rad, mid at 0, up at +1.0, zenith at +1.5. The fogged cards fade toward this colour, so far towers melt into it.
//   const sky = createSky(THREE, room.sky); scene.add(sky.mesh); each frame: sky.update(camera)
export function createSky(THREE, s = {}) {
  const c = k => new THREE.Color(...(s[k] ?? [18, 11, 6]).map(v => v / 255)), U = { uDown: { value: c("down") }, uMid: { value: c("mid") }, uUp: { value: c("up") }, uZen: { value: c("zenith") } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: "varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: "uniform vec3 uDown, uMid, uUp, uZen; varying vec3 vD; void main() { float p = asin(clamp(vD.y, -1., 1.)); vec3 c = p < 0. ? mix(uMid, uDown, smoothstep(0., -1.2, p)) : p < 1. ? mix(uMid, uUp, smoothstep(0., 1., p)) : mix(uUp, uZen, smoothstep(1., 1.5, p)); gl_FragColor = vec4(c, 1.); }" });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat); mesh.scale.setScalar(450); mesh.renderOrder = -10; mesh.frustumCulled = false;  // inside camera.far (600)
  return { mesh, update: camera => mesh.position.copy(camera.position) };
}
