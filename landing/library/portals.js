// portals.js (L5): a glowing arched doorway in the wall of shelves: a carved frame with the region's name in gold on a plaque above it, and inside a swirl of warm light with
// drifting sparks that brightens on hover or focus. Region names come in the six languages; Lao is a DRAFT for the owner's check. books.json may carry its own `names: {en, lo, th, zh, ja, ko}` per region, which wins.
// the rooms are named for animal constellations (the regions stay internal data): in the order the rooms are made. Lao is a DRAFT for the owner's check.
export const CON = [
  { en: "Leo", lo: "ດາວສິງ", th: "ราศีสิงห์", zh: "狮子座", ja: "しし座", ko: "사자자리" },
  { en: "Pegasus", lo: "ເພກາຊັສ", th: "เพกาซัส", zh: "飞马座", ja: "ペガスス座", ko: "페가수스자리" },
  { en: "Draco", lo: "ດາວມັງກອນ", th: "กลุ่มดาวมังกร", zh: "天龙座", ja: "りゅう座", ko: "용자리" },
  { en: "Phoenix", lo: "ຟີນິກ", th: "ฟีนิกซ์", zh: "凤凰座", ja: "ほうおう座", ko: "봉황자리" },
  { en: "Cygnus", lo: "ດາວຫົງ", th: "กลุ่มดาวหงส์", zh: "天鹅座", ja: "はくちょう座", ko: "백조자리" },
  { en: "Delphinus", lo: "ດາວປາໂລມາ", th: "กลุ่มดาวโลมา", zh: "海豚座", ja: "イルカ座", ko: "돌고래자리" },
  { en: "Ursa", lo: "ດາວໝີ", th: "กลุ่มดาวหมี", zh: "大熊座", ja: "おおぐま座", ko: "큰곰자리" },
];
// each constellation: stars in a 100 x 60 box and the lines that join them
export const STARS = [
  [[[24, 46], [22, 34], [26, 24], [34, 16], [42, 14], [46, 22], [60, 20], [78, 24], [62, 36]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 6]]],
  [[[30, 18], [66, 16], [68, 42], [32, 44], [18, 52], [8, 44], [86, 10], [94, 16]], [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [1, 6], [6, 7]]],
  [[[14, 40], [26, 46], [38, 40], [36, 28], [48, 22], [62, 26], [66, 38], [78, 44], [90, 34], [88, 20]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]]],
  [[[50, 6], [40, 22], [60, 22], [50, 34], [30, 40], [70, 40], [50, 54], [22, 26], [78, 26]], [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [3, 6], [1, 7], [2, 8]]],
  [[[50, 6], [50, 22], [50, 36], [50, 54], [26, 24], [74, 24]], [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]]],
  [[[44, 22], [58, 22], [58, 36], [44, 36], [32, 44], [20, 54], [68, 14]], [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [1, 6]]],
  [[[8, 14], [20, 18], [32, 22], [46, 30], [48, 46], [74, 46], [76, 32]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
  [[[38, 48], [46, 10], [46, 44], [64, 18], [72, 32]], [[0, 2], [2, 1], [1, 3], [3, 4]]],  // a music note
  [[[50, 8], [50, 20], [50, 36], [26, 26], [74, 12], [34, 54], [68, 50]], [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [2, 6]]],  // a dancer
  [[[50, 6], [58, 24], [78, 26], [62, 38], [68, 56], [50, 45], [32, 56], [38, 38], [22, 26], [42, 24]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0]]],  // a game star
  [[[10, 10], [26, 52], [50, 22], [74, 52], [90, 10]], [[0, 1], [1, 2], [2, 3], [3, 4]]],  // the Hall's W
  [[[32, 54], [32, 20], [50, 6], [68, 20], [68, 54], [60, 34]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]]],  // a door
  [[[16, 14], [44, 14], [44, 50], [16, 50], [56, 14], [84, 14], [84, 50], [56, 50]], [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4]]],  // a pair of cards
];
// a faint outline of the animal behind its stars (drawn in the same 100 x 60 box)
const ANIMAL = [
  x => { x.ellipse(60, 36, 24, 10, 0, 0, 7); x.moveTo(40, 30); x.arc(26, 28, 13, 0, 7); for (const l of [44, 52, 70, 78]) { x.moveTo(l, 44); x.lineTo(l, 56); } x.moveTo(84, 32); x.quadraticCurveTo(98, 30, 94, 14); },
  x => { x.ellipse(56, 34, 24, 10, 0, 0, 7); x.moveTo(34, 30); x.quadraticCurveTo(24, 14, 18, 10); x.lineTo(8, 16); x.lineTo(16, 24); for (const l of [40, 50, 66, 74]) { x.moveTo(l, 42); x.lineTo(l, 56); } x.moveTo(52, 26); x.quadraticCurveTo(54, 2, 84, 6); x.quadraticCurveTo(70, 12, 74, 28); },
  x => { x.moveTo(6, 44); x.bezierCurveTo(26, 14, 40, 56, 58, 30); x.bezierCurveTo(70, 12, 84, 24, 92, 12); x.lineTo(98, 22); x.lineTo(90, 26); x.bezierCurveTo(80, 36, 70, 24, 60, 40); x.bezierCurveTo(44, 62, 26, 24, 6, 44); },
  x => { x.ellipse(50, 30, 8, 14, 0, 0, 7); x.moveTo(42, 28); x.quadraticCurveTo(14, 10, 6, 34); x.moveTo(58, 28); x.quadraticCurveTo(86, 10, 94, 34); for (const a of [-.5, 0, .5]) { x.moveTo(50, 42); x.lineTo(50 + a * 40, 58); } },
  x => { x.ellipse(52, 40, 22, 11, 0, 0, 7); x.moveTo(34, 38); x.bezierCurveTo(20, 34, 36, 8, 24, 10); x.arc(22, 10, 3, 0, 7); x.moveTo(48, 36); x.quadraticCurveTo(66, 12, 82, 30); },
  x => { x.moveTo(8, 36); x.quadraticCurveTo(40, 6, 76, 24); x.quadraticCurveTo(86, 30, 96, 20); x.quadraticCurveTo(88, 40, 74, 38); x.quadraticCurveTo(40, 54, 8, 36); x.moveTo(44, 16); x.lineTo(50, 6); x.lineTo(56, 18); },
  x => { x.ellipse(56, 36, 26, 12, 0, 0, 7); x.moveTo(30, 30); x.arc(22, 26, 9, 0, 7); x.moveTo(16, 18); x.arc(14, 15, 3, 0, 7); for (const l of [40, 48, 68, 76]) { x.moveTo(l, 46); x.lineTo(l, 57); } },
  x => { x.ellipse(38, 48, 10, 7, -.4, 0, 7); x.moveTo(46, 44); x.lineTo(46, 8); x.quadraticCurveTo(66, 14, 72, 34); x.moveTo(20, 56); x.lineTo(80, 56); },
  x => { x.moveTo(58, 8); x.arc(50, 8, 7, 0, 7); x.moveTo(50, 15); x.quadraticCurveTo(44, 30, 50, 38); x.moveTo(48, 20); x.quadraticCurveTo(26, 18, 22, 30); x.moveTo(52, 20); x.quadraticCurveTo(76, 6, 84, 10); x.moveTo(50, 38); x.quadraticCurveTo(36, 46, 30, 58); x.moveTo(50, 38); x.quadraticCurveTo(62, 44, 72, 56); },
  x => { x.arc(50, 30, 27, 0, 7); x.moveTo(34, 30); x.lineTo(66, 30); x.moveTo(50, 14); x.lineTo(50, 46); },
  x => { x.arc(50, 30, 28, 3.3, 6.1); x.moveTo(18, 52); x.lineTo(82, 52); },
  x => { x.moveTo(24, 56); x.lineTo(24, 22); x.arc(50, 22, 26, Math.PI, 0); x.lineTo(76, 56); x.moveTo(60, 34); x.arc(60, 34, 3, 0, 7); x.moveTo(50, 56); x.lineTo(50, 18); },
  x => { x.roundRect(14, 12, 32, 40, 4); x.roundRect(54, 12, 32, 40, 4); x.moveTo(34, 36); x.arc(30, 32, 4, 0, 7); x.moveTo(74, 36); x.arc(70, 32, 4, 0, 7); },
];
const BACK = { en: "Back to the Grand Library", lo: "ກັບຄືນຫໍສະໝຸດໃຫຍ່", th: "กลับสู่หอสมุดใหญ่", zh: "返回大图书馆", ja: "大図書館へもどる", ko: "대도서관으로 돌아가기" };
const HALL = { en: "Wonder Hall", lo: "ຫໍມະຫັດສະຈັນ", th: "หอแห่งความมหัศจรรย์", zh: "奇妙大厅", ja: "ワンダーホール", ko: "원더 홀" };
const PLAN = { en: "Wonder plan", lo: "ແພັກເກັດ Wonder", th: "แพ็กเกจ Wonder", zh: "Wonder 方案", ja: "Wonder プラン", ko: "Wonder 요금제" };
const SOON = { en: "Opening soon", lo: "ເປີດໄວໆນີ້", th: "เร็ว ๆ นี้", zh: "即将开放", ja: "もうすぐ公開", ko: "곧 열려요" };
const ARCH = [{ en: "Sing Along", lo: "ຮ້ອງເພງນຳກັນ", th: "ร้องเพลงด้วยกัน", zh: "一起唱", ja: "いっしょにうたおう", ko: "함께 노래해요" }, { en: "Dance Along", lo: "ເຕັ້ນລຳນຳກັນ", th: "เต้นด้วยกัน", zh: "一起跳", ja: "いっしょにおどろう", ko: "함께 춤춰요" }, { en: "Mini Games", lo: "ເກມນ້ອຍ", th: "มินิเกม", zh: "迷你游戏", ja: "ミニゲーム", ko: "미니 게임" }];
const DOORS = { en: "Doors of Mystery", lo: "ປະຕູປິດສະໜາ", th: "ประตูปริศนา", zh: "神秘之门", ja: "ミステリーのとびら", ko: "신비의 문" };
const MORE = { en: "More games soon", lo: "ມີເກມອີກໄວໆນີ້", th: "เกมอื่นเร็ว ๆ นี้", zh: "更多游戏即将推出", ja: "ほかのゲームも もうすぐ", ko: "다른 게임도 곧 와요" };
const MEMORY = { en: "Memory", lo: "ເກມຈື່ຈຳ", th: "จับคู่ความจำ", zh: "记忆配对", ja: "しんけいすいじゃく", ko: "기억력 게임" };
const IMG = new Map(); const pic = url => { let e = IMG.get(url); if (!e) { e = new Image(); e.onload = () => dispatchEvent(new Event("library:plaque")); e.src = new URL(url, import.meta.url).href; IMG.set(url, e); } return e; };
const conIdx = (id, regions) => Math.max(0, regions.findIndex(q => q.id === id)) % CON.length;
// the plaque for a door: its constellation, name and (on a back door) the way home
export const regionPlaque = (link, regions, lang) => { if (link.game === "doors") { pic("../../shelf/books/toad-king/plate.webp"); return { name: DOORS[lang] ?? DOORS.en, sub: MORE[lang] ?? MORE.en, con: 11, img: "../../shelf/books/toad-king/plate.webp" }; }
  if (link.game === "memory") return { name: MEMORY[lang] ?? MEMORY.en, sub: MORE[lang] ?? MORE.en, con: 12 };
  if (link.arch != null) return { name: ARCH[link.arch][lang] ?? ARCH[link.arch].en, sub: SOON[lang] ?? SOON.en, con: 7 + link.arch };
  if (link.to === "wonder" || link.from === "wonder") return { name: HALL[lang] ?? HALL.en, sub: link.from === "wonder" ? BACK[lang] ?? BACK.en : PLAN[lang] ?? PLAN.en, con: 10 };
  const back = link.to === "home", id = (back ? link.from : link.to).replace(/^r:/, ""), r = regions.find(q => q.id === id), n = conIdx(id, regions);
  return { name: r?.names?.[lang] ?? CON[n][lang] ?? CON[n].en, sub: back ? BACK[lang] ?? BACK.en : "", con: n }; };
export const regionLabel = (link, regions, lang) => link.to === "home" ? BACK[lang] ?? BACK.en : regionPlaque(link, regions, lang).name;
const W = 256, H = 680, OFF = 110, FONT = '"Cormorant Garamond", "Noto Sans Lao", "Thonburi", "Noto Sans Thai", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Georgia, serif', FONTB = '"EB Garamond", "Noto Sans Lao", "Thonburi", "Noto Sans Thai", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Georgia, serif';

export function frameCanvas(p) {  // the plaque (name, then its constellation) and the arch; the doorway itself is left transparent for the swirl behind it
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const wood = x.createLinearGradient(0, 0, W, 0); wood.addColorStop(0, "#2a1608"); wood.addColorStop(.5, "#5a3417"); wood.addColorStop(1, "#2a1608");
  x.fillStyle = wood; x.beginPath(); x.roundRect(10, 8, 236, 214, 12); x.fill(); x.strokeStyle = "#e2b459"; x.lineWidth = 4; x.stroke(); x.strokeStyle = "rgba(255,230,160,.45)"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(17, 15, 222, 200, 8); x.stroke();
  const sky = x.createLinearGradient(0, 84, 0, 208); sky.addColorStop(0, "rgba(10,12,40,.75)"); sky.addColorStop(1, "rgba(30,16,50,.55)"); x.fillStyle = sky; x.beginPath(); x.roundRect(26, 80, 204, 128, 8); x.fill();
  let fs = 36; x.textAlign = "center"; x.textBaseline = "middle"; const label = p.name; const maxH = p.sub ? 36 : 54;
  const lines = (() => { for (; fs >= 13; fs -= 2) { x.font = `500 ${fs}px ${FONT}`; const out = [""]; for (const ch of (/\s/.test(label) ? label.split(/(\s+)/) : [...label])) { const l = out.at(-1); if (x.measureText((l + ch).trim()).width > 200 && l) out.push(ch.trim()); else out[out.length - 1] = l + ch; } if (out.length * fs * 1.2 <= maxH) return out.map(s => s.trim()); } return [label]; })();
  const cy = p.sub ? 38 : 46; lines.forEach((t, i) => { const y = cy + (i - (lines.length - 1) / 2) * fs * 1.2; x.fillStyle = "#1a0d04"; x.fillText(t, 129.5, y + 1.5); x.fillStyle = "#f0cd7c"; x.fillText(t, 128, y); x.fillStyle = "rgba(255,245,200,.5)"; x.fillText(t, 127.4, y - .6); });
  if (p.sub) { x.font = `400 13px ${FONTB}`; x.fillStyle = "rgba(240,205,124,.85)"; x.fillText(p.sub, 128, 66, 200); }
  const im = p.img && IMG.get(p.img), pict = im?.complete && im.naturalWidth;
  if (pict) { x.save(); x.beginPath(); x.roundRect(26, 80, 204, 128, 8); x.clip(); const k = Math.max(204 / im.naturalWidth, 128 / im.naturalHeight); x.drawImage(im, 128 - im.naturalWidth * k / 2, 144 - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); x.restore(); x.strokeStyle = "rgba(240,205,124,.6)"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(26, 80, 204, 128, 8); x.stroke(); }
  // the constellation: a faint animal, thin lines, gold stars (over a picture: a small emblem in the corner)
  x.save(); if (pict) { x.translate(168, 150); x.scale(.55, .55); } else { x.translate(38, 88); x.scale(1.8, 1.8); } x.lineWidth = .7; x.strokeStyle = "rgba(240,205,124,.28)"; x.beginPath(); if (!pict) ANIMAL[p.con](x); x.stroke();
  const [st, ln] = STARS[p.con]; x.strokeStyle = "rgba(255,236,170,.75)"; x.lineWidth = .55; x.beginPath(); for (const [a, b] of ln) { x.moveTo(...st[a]); x.lineTo(...st[b]); } x.stroke();
  for (const [px, py] of st) { const g = x.createRadialGradient(px, py, 0, px, py, 4); g.addColorStop(0, "rgba(255,246,200,1)"); g.addColorStop(.35, "rgba(255,220,130,.8)"); g.addColorStop(1, "rgba(255,200,90,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill(); } x.restore();
  x.save(); x.translate(0, OFF);
  // the arch: carved wood with a gold edge, then the doorway cut out of it
  x.fillStyle = wood; x.beginPath(); x.moveTo(8, H); x.lineTo(8, 250); x.arc(128, 250, 120, Math.PI, 0); x.lineTo(248, H); x.closePath(); x.fill(); x.strokeStyle = "#e2b459"; x.lineWidth = 4; x.stroke();
  x.strokeStyle = "rgba(226,180,89,.55)"; x.lineWidth = 2; x.beginPath(); x.moveTo(20, H); x.lineTo(20, 250); x.arc(128, 250, 108, Math.PI, 0); x.lineTo(236, H); x.stroke();
  x.fillStyle = "#e2b459"; for (const [px, py] of [[128, 132], [24, 300], [232, 300], [24, 460], [232, 460]]) { x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); }
  x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000"; x.beginPath(); x.moveTo(30, H); x.lineTo(30, 250); x.arc(128, 250, 98, Math.PI, 0); x.lineTo(226, H); x.closePath(); x.fill();
  x.restore(); return c;
}

const VS = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }";
// ONE quad per portal, larger than the doorway: inside the arch a deep vortex (tunnel arms turning toward a bright core, stars and nebula streaming in, shifting with the camera);
// outside it a rippling light rim, a soft glow, a wash on the floor and motes drawn in. uT time, uHover brightens, uSurge flares as you walk in, uCam is the camera's offset for the parallax.
const SX = 1.7, SY = 1.12;
const FS = `uniform float uT, uHover, uSurge; uniform vec2 uCam; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 q = (vUv - .5) * vec2(${SX.toFixed(2)}, ${SY.toFixed(2)}) + .5, px = vec2(q.x * ${W}., (1. - q.y) * ${H}.);
  if (px.y > ${H}.) discard;
  float d = px.y >= 360. ? abs(px.x - 128.) - 98. : length(px - vec2(128., 360.)) - 98.;
  float breath = .5 + .5 * sin(uT * 1.1), lift = .8 + .45 * uHover + .15 * breath + 1.1 * uSurge;
  if (d < 0.) {
    vec2 p0 = (px - vec2(128., 480.)) / vec2(98., 200.); p0 *= 1. + .12 * pow(length(p0), 3.) * sin(uT * 1.7);
    vec3 col = vec3(0.); float rr0 = length(p0);
    for (int i = 0; i < 3; i++) { float dp = float(i) / 3.; vec2 p = p0 - uCam * (.05 + .13 * dp); float r = max(length(p), .02), a = atan(p.y, p.x);
      float z = .32 / r + uT * (.32 + .22 * dp) * (1. + 1.4 * uSurge), a2 = a + z * .9 + uT * .22 * (1. - dp);
      float arms = pow(.5 + .5 * sin(a2 * 3. + z * 1.6), 2.), neb = .5 + .5 * sin(a2 * 2. + z * .8 + 2. * sin(z * .5));
      vec2 g = vec2(a2 * 4., z * 4.), id = floor(g); float h = hash(id + dp * 7.), star = step(.8, h) * smoothstep(.24, 0., length(fract(g) - .5)) * (.55 + .45 * sin(uT * 3. + h * 40.)) * smoothstep(.02, .35, r);
      vec3 c = mix(vec3(.3, .12, .55), vec3(1., .62, .22), arms) + vec3(.08, .45, .6) * neb * .45; c *= .35 + .9 * smoothstep(.0, .9, r) * .6 + .2; col += (c * (.45 + .4 * arms) + vec3(1., .95, .75) * star * 1.3) * (1. - dp * .35) * .55; }
    col += vec3(1., .86, .55) * (pow(max(0., 1. - rr0 * 1.35), 3.) * (1. + .6 * breath) + .035 / max(rr0, .05));
    col += vec3(1., .78, .35) * exp(d / 5.) * (.55 + .35 * sin(uT * 2.2 + atan(p0.y, p0.x) * 5.));
    float aw = clamp(uHover, 0., 1.); vec3 idle = vec3(dot(col, vec3(.3, .5, .2))) * .1 + vec3(.01, .01, .014); idle += vec3(.55, .6, .72) * exp(d / 3.5) * .45 * (.75 + .25 * sin(uT * 1.3 + atan(p0.y, p0.x) * 3.));
    col = mix(idle, col * lift, aw); gl_FragColor = vec4(col, 1.); return;
  }
  float ang = atan(px.y - 430., px.x - 128.), rr = length(px - vec2(128., 430.)), rip = .5 + .5 * sin(d * .45 - uT * 3. + ang * 7.);
  float glow = exp(-d / 12.) * (.55 + .45 * rip) * .85 + exp(-d / 60.) * .3;
  glow += smoothstep(560., 680., px.y) * clamp(uHover, 0., 1.) * exp(-pow((px.x - 128.) / 170., 2.)) * .38;
  float sec = ang * 9.55, sid = floor(sec), hh = hash(vec2(sid, 3.)), ph = fract(hh * 7. + uT * .16 * (.6 + hh)), rp = mix(200., 60., ph);
  float spark = step(.5, hh) * smoothstep(3.2, 0., length(vec2(rr - rp, (fract(sec) - .5) * rr * .105))) * (1. - ph) * smoothstep(.0, .12, ph) * clamp(uHover, 0., 1.);
  float aw2 = clamp(uHover, 0., 1.), al = clamp(glow * (.55 + .45 * breath) * (lift * .9) * (.3 + .7 * aw2) + spark, 0., .92);
  gl_FragColor = vec4(mix(vec3(.62, .68, .82), mix(vec3(1., .6, .22), vec3(1., .93, .68), clamp(uHover * .6 + spark + uSurge * .5, 0., 1.)), aw2), al);
}`;

const FS_FLOOR = FS.replace(/vec2 q = [^;]*;/, "vec2 px = (vUv - .5) * 312. + 128.;").replace(/float d = px\.y >= 360\.[^;]*;/, "float d = length(px - vec2(128., 128.)) - 100.;").replace(/vec2 p0 = \(px - vec2\(128\., 480\.\)\) \/ vec2\(98\., 200\.\);/, "vec2 p0 = (px - vec2(128., 128.)) / 100.;").split("430.").join("128.").replace("mix(200., 60., ph)", "mix(150., 40., ph)").replace(/glow \+= smoothstep\(560[^;]*;/, "");
function rimCanvas() {  // the gold rim, carved with music notes, a dancer and a game star
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"), g = x.createRadialGradient(256, 256, 194, 256, 256, 246); g.addColorStop(0, "#6b4510"); g.addColorStop(.25, "#e2b459"); g.addColorStop(.6, "#f6d98c"); g.addColorStop(1, "#7a5014");
  x.fillStyle = g; x.beginPath(); x.arc(256, 256, 246, 0, Math.PI * 2); x.moveTo(450, 256); x.arc(256, 256, 194, 0, Math.PI * 2, true); x.fill("evenodd"); x.strokeStyle = "rgba(60,32,6,.8)"; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, 246, 0, 7); x.stroke(); x.beginPath(); x.arc(256, 256, 194, 0, 7); x.stroke();
  x.strokeStyle = "rgba(255,240,190,.55)"; x.lineWidth = 2; x.beginPath(); x.arc(256, 256, 238, 0, 7); x.stroke();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; x.save(); x.translate(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220); x.rotate(a + Math.PI / 2); x.fillStyle = "#3a2208"; x.strokeStyle = "#3a2208"; x.lineWidth = 3.5; x.lineCap = "round";
    if (i % 3 === 0) { x.beginPath(); x.ellipse(-6, 12, 9, 6.5, -.4, 0, 7); x.fill(); x.beginPath(); x.moveTo(2, 10); x.lineTo(2, -16); x.quadraticCurveTo(16, -12, 14, 2); x.stroke(); }
    else if (i % 3 === 1) { x.beginPath(); x.arc(0, -17, 5, 0, 7); x.fill(); x.beginPath(); x.moveTo(0, -11); x.lineTo(0, 6); x.moveTo(0, -7); x.lineTo(-13, -14); x.moveTo(0, -7); x.lineTo(13, -1); x.moveTo(0, 6); x.lineTo(-9, 18); x.moveTo(0, 6); x.lineTo(10, 16); x.stroke(); }
    else { x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 7 : 17, b = k * Math.PI / 5 - Math.PI / 2; x.lineTo(Math.cos(b) * r, Math.sin(b) * r); } x.closePath(); x.fill(); } x.restore(); }
  return c; }
function signCanvas(p) {  // the plaque standing at the portal's edge: the name, and a small badge for the plan
  const c = document.createElement("canvas"); c.width = 512; c.height = 176; const x = c.getContext("2d"), wood = x.createLinearGradient(0, 0, 512, 0); wood.addColorStop(0, "#2a1608"); wood.addColorStop(.5, "#5a3417"); wood.addColorStop(1, "#2a1608");
  x.fillStyle = wood; x.beginPath(); x.roundRect(6, 6, 500, 164, 20); x.fill(); x.strokeStyle = "#e2b459"; x.lineWidth = 6; x.stroke(); x.strokeStyle = "rgba(255,230,160,.45)"; x.lineWidth = 2; x.beginPath(); x.roundRect(16, 16, 480, 144, 14); x.stroke();
  let fs = 72; x.textAlign = "center"; x.textBaseline = "middle"; for (; fs > 24; fs -= 4) { x.font = `500 ${fs}px ${FONT}`; if (x.measureText(p.name).width < 440) break; }
  x.fillStyle = "#1a0d04"; x.fillText(p.name, 257, 70); x.fillStyle = "#f0cd7c"; x.fillText(p.name, 256, 68);
  x.font = `400 26px ${FONTB}`; const bw = Math.min(400, x.measureText(p.sub).width + 74); x.fillStyle = "rgba(226,180,89,.2)"; x.strokeStyle = "#e2b459"; x.lineWidth = 2.5; x.beginPath(); x.roundRect(256 - bw / 2, 114, bw, 36, 18); x.fill(); x.stroke(); x.fillStyle = "#f6d98c"; x.fillText(p.sub, 256 + 14, 133);
  x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 5 : 11, b = k * Math.PI / 5 - Math.PI / 2; x.lineTo(256 - bw / 2 + 24 + Math.cos(b) * r, 132 + Math.sin(b) * r); } x.closePath(); x.fill(); return c; }
// a round warp set into the floor: the same living vortex, a carved gold rim, and a plaque standing at its edge
export function createFloorPortal(THREE, link, label) {
  const g = new THREE.Group(), R = 1.25, U = { uT: { value: 0 }, uHover: { value: 0 }, uSurge: { value: 0 }, uCam: { value: new THREE.Vector2() } };
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS_FLOOR, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; disc.scale.setScalar(312 * R / 100); disc.renderOrder = 36; disc.position.y = .004;
  const rimT = new THREE.CanvasTexture(rimCanvas()); rimT.colorSpace = THREE.SRGBColorSpace; rimT.anisotropy = 4;
  const rim = new THREE.Mesh(new THREE.CircleGeometry(.5, 64), new THREE.MeshBasicMaterial({ map: rimT, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })); rim.rotation.x = -Math.PI / 2; rim.scale.setScalar(512 / 194 * R); rim.renderOrder = 37; rim.position.y = .008; rim.userData.link = link;
  const signT = new THREE.CanvasTexture(signCanvas(label)); signT.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .516), new THREE.MeshBasicMaterial({ map: signT, transparent: true, depthWrite: false, fog: false })); sign.position.set(0, .42, -1.12); sign.renderOrder = 35; sign.userData.link = link;
  g.add(disc, rim, sign); g.position.set(...link.at); let h = 0, tt = 0;
  return { group: g, frame: rim, update: (t, target, dt, still, cam, surge = 0) => { h += (target - h) * (1 - Math.exp(-dt * 8)); tt += dt * (.25 + 1.75 * h); U.uT.value = still ? 2.4 : tt; U.uHover.value = h; U.uSurge.value = still ? 0 : surge; if (cam) U.uCam.value.set((cam.position.x - g.position.x) / 12, (cam.position.z - g.position.z) / 12).clampLength(0, .5); },
    setLabel: p => { signT.image = signCanvas(p); signT.needsUpdate = true; } };
}

export function createPortal(THREE, plane, link, size, label) {
  const g = new THREE.Group(), tex = new THREE.CanvasTexture(frameCanvas(label)); tex.colorSpace = THREE.SRGBColorSpace;
  const frame = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })), U = { uT: { value: 0 }, uHover: { value: 0 }, uSurge: { value: 0 }, uCam: { value: new THREE.Vector2() } };
  const inner = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  frame.renderOrder = 34; inner.renderOrder = 33; inner.position.z = -.01; inner.scale.set(SX, SY, 1); frame.userData.link = link; g.add(inner, frame); g.scale.set(size[0], size[1] * H / 570, 1); g.position.set(...link.at); g.position.y += size[1] * (H / 570 - 1) / 2; g.rotation.y = link.yaw ?? 0;
  let h = 0, tt = 0;
  return { group: g, frame, update: (t, target, dt, still, cam, surge = 0) => { h += (target - h) * (1 - Math.exp(-dt * 8)); tt += dt * (.25 + 1.75 * h); U.uT.value = still ? 2.4 : tt; U.uHover.value = h; U.uSurge.value = still ? 0 : surge; if (cam) { g.updateWorldMatrix(true, false); const l = cam.position.clone(); g.worldToLocal(l); U.uCam.value.set(l.x, l.y).multiplyScalar(1 / (1 + Math.abs(l.z))).clampLength(0, .6); } frame.material.color.setScalar(1 + .45 * h); },
    setLabel: s => { tex.image = frameCanvas(s); tex.needsUpdate = true; } };
}
