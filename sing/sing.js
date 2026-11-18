// Sing Along: one song per book (web/sing/<book>/song.json), Kapi and Bobo on a small river stage made in code,
// bobbing to the song's beat, and the words lighting gold as they are sung. Two tracks play together and only one
// is heard, so switching "Sing with Kapi" / "You sing" never jumps; word times come from the song's score.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";

const book = new URLSearchParams(location.search).get("book") || "kapi";
const base = `${book}/`;
const song = await (await fetch(base + "song.json")).json();
document.getElementById("title").textContent = song.title;
document.title = `${song.title}: Sing Along`;

// the two tracks: "with Kapi" is the sung voice once it exists, the tune on the flute until then
const track = src => Object.assign(new Audio(base + src), { preload: "auto" });
const withKapi = track(song.audio.vocal || song.audio.guide), youSing = track(song.audio.karaoke);
let heard = withKapi;
const choose = a => {
  heard = a; withKapi.muted = a !== withKapi; youSing.muted = a !== youSing;
  document.getElementById("withKapi").setAttribute("aria-pressed", a === withKapi);
  document.getElementById("youSing").setAttribute("aria-pressed", a === youSing);
};
choose(withKapi);
document.getElementById("withKapi").onclick = () => choose(withKapi);
document.getElementById("youSing").onclick = () => choose(youSing);
const playBtn = document.getElementById("play");
const playing = () => !heard.paused;
const showPlay = () => { playBtn.innerHTML = playing() ? "&#10074;&#10074; Pause" : "&#9654; Play"; playBtn.setAttribute("aria-label", playing() ? "Pause" : "Play"); };
playBtn.onclick = async () => {
  if (playing()) { withKapi.pause(); youSing.pause(); }
  else {
    if (heard.ended) withKapi.currentTime = youSing.currentTime = 0;
    youSing.currentTime = withKapi.currentTime;
    await Promise.all([withKapi.play(), youSing.play()]);
  }
  showPlay();
};
withKapi.onended = () => { youSing.pause(); showPlay(); };

// the words: the line being sung, big; the next line, small
const lineEl = document.getElementById("line"), nextEl = document.getElementById("next");
const lines = song.lines.map((l, i) => song.words.filter(w => w.line === i));
let shown = -2;
const showLine = i => {
  if (i === shown) return;
  shown = i;
  lineEl.replaceChildren(...(lines[i] || []).flatMap((w, k) => [k ? " " : "", Object.assign(document.createElement("span"), { textContent: w.w })]));
  nextEl.textContent = song.lines[i + 1]?.text || "";
  if (i < 0) { lineEl.textContent = "Listen to the tune first…"; nextEl.textContent = song.lines[0].text; }
};
const words = t => {  // the line on show changes a beat before its first word, so the child can read ahead
  let li = -1;
  for (let i = 0; i < lines.length; i++) if (t >= lines[i][0].t - song.beat_s) li = i;
  showLine(li);
  [...lineEl.children].forEach((s, k) => {
    const w = lines[li]?.[k]; if (!w) return;
    s.classList.toggle("now", t >= w.t && t < w.end + .12);
    s.classList.toggle("said", t >= w.end + .12);
  });
};

// the stage: sky, river, far bank and a jamun tree, all generated here; only the two characters are files
const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
const sky = document.createElement("canvas"); sky.width = 2; sky.height = 256;
const g = sky.getContext("2d"), grad = g.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0, "#5fa6e0"); grad.addColorStop(.6, "#bfe0f0"); grad.addColorStop(1, "#f6e6bf");
g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight("#fff4dc", "#3d5a3a", 1.6));
const sun = new THREE.DirectionalLight("#ffe7b8", 2.4); sun.position.set(-3, 6, 4); scene.add(sun);

const water = new THREE.ShaderMaterial({
  uniforms: { t: { value: 0 } },
  vertexShader: "varying vec2 v; void main(){ v = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
  fragmentShader: `uniform float t; varying vec2 v;
    void main(){ float r = sin(v.x * 3. + t * 1.3 + sin(v.y * 5. + t) * 1.5) * sin(v.y * 9. - t * 1.7);
      vec3 c = mix(vec3(.16, .45, .5), vec3(.28, .62, .62), smoothstep(-6., 2., v.y)) + vec3(.35, .32, .2) * smoothstep(.82, .98, r);
      gl_FragColor = vec4(c, 1.); }` });
const river = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), water);
river.rotation.x = -Math.PI / 2; river.position.z = 4; scene.add(river);
const land = (w, d, x, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, 0, z); scene.add(m); return m; };
land(40, 4, 0, -8, "#6f9a4c"); land(5, 3, -3.4, 1.2, "#7aa457");
const hill = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 12), new THREE.MeshLambertMaterial({ color: "#5c8a45" }));
hill.scale.set(2.2, .5, 1); hill.position.set(2, -1.5, -15); scene.add(hill);
const tree = new THREE.Group(); tree.position.set(-3.9, .25, -.4); tree.scale.setScalar(.72); scene.add(tree);
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .28, 2.6, 8), new THREE.MeshLambertMaterial({ color: "#6b4a2e" }));
trunk.position.y = 1.3; tree.add(trunk);
const leafMat = new THREE.MeshLambertMaterial({ color: "#5d9e45" }), fruitMat = new THREE.MeshLambertMaterial({ color: "#5b2a6e" });
const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), fruitMat, 40), m4 = new THREE.Matrix4();
for (const [x, y, z, r] of [[0, 3, 0, 1.1], [.8, 2.7, .2, .8], [-.8, 2.8, -.1, .85], [.2, 3.6, -.2, .75]]) {
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), leafMat); b.position.set(x, y, z); tree.add(b);
}
for (let i = 0; i < 40; i++) {
  const a = i * 2.4, y = 2.5 + (i % 7) * .18, r = 1.05 - Math.abs(y - 3) * .25;
  fruit.setMatrixAt(i, m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r + .3));
}
tree.add(fruit);

// the cast: Kapi on the bank, Bobo in the river
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cast = [];
const place = async (file, height, x, z, turn, clip) => {
  const gltf = await loader.loadAsync(`../live/chars/${file}`);
  const root = gltf.scene, box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  root.scale.setScalar(height / Math.max(size.y, .001));
  const holder = new THREE.Group(); holder.add(root); holder.position.set(x, 0, z); holder.rotation.y = turn; scene.add(holder);
  root.position.y = -box.min.y * root.scale.y;
  const mixer = new THREE.AnimationMixer(root), find = n => gltf.animations.find(a => a.name === n);
  mixer.clipAction(find(clip) || gltf.animations[0]).play();
  cast.push({ holder, mixer, y: 0 });
};
await Promise.all([place("kapi.glb", 1.1, -2.6, 1.6, .35, "Idle"), place("kapi-bobo.glb", .75, .3, .7, -.5, "Swim")]);
cast[1].y = -.18; cast[1].holder.position.y = -.18;

const fit = () => {
  const w = innerWidth, h = innerHeight, tall = h > w;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = tall ? 62 : 40;
  // the cast sits in the upper middle: the words and buttons take the lower third
  camera.position.set(tall ? -1.2 : -.9, tall ? 1.2 : 1.5, tall ? 8.5 : 7); camera.lookAt(tall ? -1.2 : -.9, tall ? -.9 : -.15, 0);
  camera.updateProjectionMatrix();
};
addEventListener("resize", fit); fit();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta(), t = heard.currentTime, on = playing();
  water.uniforms.t.value += dt;
  const beat = t / song.beat_s, hop = on ? Math.abs(Math.sin(Math.PI * beat)) : 0;  // one bob per beat, only while the song plays
  cast.forEach((c, i) => {
    c.mixer.update(dt);
    c.holder.position.y = c.y + hop * (i ? .05 : .12);
    c.holder.rotation.z = on ? Math.sin(Math.PI * beat / 2) * (i ? .03 : .08) : 0;  // a sway across each pair of beats
  });
  tree.rotation.z = Math.sin(clock.elapsedTime * .7) * .01;
  words(t);
  renderer.render(scene, camera);
});
showPlay();
