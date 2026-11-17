// portals.js (L5): an arched doorway in the wall of shelves: a carved walnut frame (one baked relief texture shared by all) with the region's constellation on a medallion and its name on a brass plate,
// and inside the dark-blue night turning slowly into a space-time swirl that brightens and quickens on hover or focus. Region names come in the six languages; Lao is a DRAFT for the owner's check. books.json may carry its own `names: {en, lo, th, zh, ja, ko}` per region, which wins.
// the rooms are named for animal constellations (the regions stay internal data): in the order the rooms are made. Lao is a DRAFT for the owner's check.
import { TextureLoader, SRGBColorSpace } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/meshopt_decoder.module.js";
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
const W = 300, H = 680, FONT = '"Cormorant Garamond", "Noto Sans Lao", "Thonburi", "Noto Sans Thai", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Georgia, serif', FONTB = '"EB Garamond", "Noto Sans Lao", "Thonburi", "Noto Sans Thai", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Georgia, serif';

// the wall doorway (design A): a wide carved walnut arch (44 px each side of a 196 px opening, 22%) with a raised gold-leaf moulding on its inner edge, a gilded vine carved in relief
// along the field, a beaded outer moulding, a round navy medallion with the region's gold constellation crowning it, and a brass nameplate hung in the top of the opening.
// The carving is a HEIGHT MAP lit once at load (a baked normal map: light from the upper left, gold gets a highlight), shared by every wall portal; each portal adds only a small badge (medallion + plate).
const CX = W / 2, AY = 360, RO = 98, RF = 142, E = 24, FOOT = H - 40, LEG = FOOT - AY, S = 2, MY = 196, MR = 42;  // E: the crown is that much deeper than the posts
const archOpen = (x, r, ry = r) => { x.beginPath(); x.moveTo(CX - r, H); x.lineTo(CX - r, AY); x.ellipse(CX, AY, r, ry, 0, Math.PI, 0); x.lineTo(CX + r, H); };
const band = (x, r, w, st, ry = r) => { archOpen(x, r, ry); x.lineWidth = w; x.strokeStyle = st; x.stroke(); };
// a point s along the arch at radius r from the left foot: [x, y, tangent angle, outward normal angle]
const along = (s, r) => { if (s < LEG) return [CX - r, FOOT - s, -Math.PI / 2, Math.PI]; s -= LEG; if (s < Math.PI * r) { const A = Math.PI + s / r; return [CX + r * Math.cos(A), AY + r * Math.sin(A), A + Math.PI / 2, A]; } return [CX + r, AY + s - Math.PI * r, Math.PI / 2, 0]; };
const leaf = (x, px, py, ang, len, wid, fill) => { x.save(); x.translate(px, py); x.rotate(ang); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * .5, -wid, len, 0); x.quadraticCurveTo(len * .5, wid, 0, 0); x.fillStyle = fill; x.fill(); x.restore(); };
const hc = (h, g = 0) => `rgb(${h},${g ? 255 : 0},0)`;  // height in red, gilded where green
let BASE = null;
function baseFrame() {  // once per page: draw the height map, then light it pixel by pixel
  if (BASE) return BASE;
  const c = document.createElement("canvas"); c.width = W * S; c.height = H * S; const x = c.getContext("2d", { willReadFrequently: true }); x.scale(S, S); x.lineJoin = "round";
  const bead = (r, w, h0, h1, g, ry = r) => { for (let k = 0; k * 2 < w; k++) band(x, r, w - 2 * k, hc(Math.round(h0 + (h1 - h0) * Math.sin(Math.min(1, 2 * k / w) * Math.PI / 2)), g), ry); };
  x.fillStyle = hc(75); archOpen(x, RF, RF + E); x.closePath(); x.fill();  // the sunk field, deeper at the crown
  band(x, RF - 1, 3, hc(70), RF + E - 1); bead(RF - 7, 10, 95, 200, 0, RF + E - 7); band(x, RF - 12.5, 2, hc(60), RF + E - 12.5);  // the outer beaded moulding (following the crown) and its step
  for (const sg of [-1, 1]) for (let k = 0; k < 6; k++) { const A = -Math.PI / 2 + sg * (.42 + k * .17), rr = 134 + 8 * Math.cos(k * .6), px = CX + rr * Math.cos(A), py = AY + (rr + 10 * Math.max(0, 1 - k / 5)) * Math.sin(A); for (const [f, h] of [[1, 125], [.6, 180]]) leaf(x, px, py, A + sg * (Math.PI / 2 + .25), (15 - k) * f + 2, (5.5 - k * .5) * f + .8, hc(h, 1)); }  // gilt leaf sprays either side of the medallion
  const TOT = 2 * LEG + Math.PI * 120, VR = 120;  // the gilded vine: a wavy stem, leaves alternating, fuller towards the crown, a curl every few leaves
  for (const [lw, h] of [[3.6, 130], [2, 165]]) { x.strokeStyle = hc(h, 1); x.lineWidth = lw; x.beginPath(); for (let s = 0; s <= TOT; s += 2) { const [px, py, , nA] = along(s, VR), o = 3.6 * Math.sin(s / 8); x[s ? "lineTo" : "moveTo"](px + o * Math.cos(nA), py + o * Math.sin(nA)); } x.stroke(); }
  for (let s = 8, i = 0; s < TOT - 6; s += 14, i++) { const [px, py, tA, nA] = along(s, VR), sg = i % 2 ? 1 : -1, big = 1.15 - Math.abs(s - TOT / 2) / (TOT / 2) * .35;
    for (const [k, h] of [[1, 120], [.62, 175]]) { leaf(x, px, py, nA + sg * 1.05, 12 * big * k + 2 * (1 - k), 4.6 * big * k + 1, hc(h, 1)); leaf(x, px, py, tA + sg * .5 + (i % 4 < 2 ? 0 : Math.PI), 8 * big * k + 1, 3 * big * k + .6, hc(h, 1)); }
    if (i % 3 === 1) { const ox = px + 6 * sg * Math.cos(nA), oy = py + 6 * sg * Math.sin(nA); x.strokeStyle = hc(150, 1); x.lineWidth = 1.6; x.beginPath(); x.arc(ox, oy, 2.6, 0, 5.2); x.stroke(); } }
  band(x, 109.5, 3, hc(55)); bead(103.5, 10, 105, 215, 1); band(x, RO + .6, 1.6, hc(70, 1));  // the raised gold-leaf moulding on the inner edge, a shadowed step behind it
  for (const sx of [-1, 1]) { const x0 = sx < 0 ? CX - RF - 4 : CX + RO - 4, w = RF - RO + 8; for (let k = 0; k < 6; k++) { x.fillStyle = hc(90 + k * 14, k === 1); x.fillRect(x0 + k, FOOT + k, w - 2 * k, H - FOOT - k); } }  // the plinths, a gilt edge
  // the crown medallion: a carved wooden ring, a gilt bezel, a wreath of gilt leaves (the navy centre and its stars come with each portal's badge)
  for (let k = 0; k < 6; k++) { x.fillStyle = hc(100 + k * 12); x.beginPath(); x.arc(CX, MY, MR + 17 - k, 0, 7); x.fill(); }
  for (let k = 0; k < 16; k++) { const A = k * Math.PI / 8; for (const [s, h] of [[1, 150], [.6, 190]]) leaf(x, CX + (MR + 5) * Math.cos(A), MY + (MR + 5) * Math.sin(A), A + .55, 10 * s + 2, 3.8 * s + .6, hc(h, 1)); }
  for (let k = 0; k < 4; k++) { x.strokeStyle = hc(130 + k * 30, 1); x.lineWidth = 6 - k * 1.4; x.beginPath(); x.arc(CX, MY, MR + 1, 0, 7); x.stroke(); }
  x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000"; archOpen(x, RO); x.closePath(); x.fill(); x.globalCompositeOperation = "source-over";
  // light it: normal from the height gradient, lambert from the upper left, a hot spot on the gold, darker in the recesses and towards the foot; walnut grain follows the arch
  const w = c.width, h = c.height, src = x.getImageData(0, 0, w, h).data, img = new ImageData(w, h), o = img.data, Lx = -.45, Ly = -.6, Lz = .66, Hn = Math.hypot(Lx, Ly, Lz + 1), Hx = Lx / Hn, Hy = Ly / Hn, Hz = (Lz + 1) / Hn, K = 1 / 26;
  for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) { const i = (py * w + px) * 4; if (!src[i + 3]) continue;
    const nx = (src[i - 4] - src[i + 4]) * K, ny = (src[i - 4 * w] - src[i + 4 * w]) * K, inv = 1 / Math.sqrt(nx * nx + ny * ny + 1), dif = Math.max(0, (nx * Lx + ny * Ly + Lz) * inv), u = px / S, v = py / S;
    const fall = 1.1 - .38 * Math.min(1, Math.max(0, (v - AY) / (H - AY))), ao = .72 + .28 * Math.min(1, src[i] / 190); let r, g, b;
    if (src[i + 1] > 128) { const sp = Math.pow(Math.max(0, (nx * Hx + ny * Hy + Hz) * inv), 28) * 1.1, l = (.3 + .85 * dif) * ao * fall; r = 218 * l + 255 * sp; g = 164 * l + 236 * sp; b = 66 * l + 180 * sp; }
    else { const rho = v >= AY ? Math.abs(u - CX) : Math.hypot(u - CX, v - AY), al = v >= AY ? v : (Math.atan2(v - AY, u - CX) + 4) * 90, gr = .5 + .5 * Math.sin(rho * 1.7 + 2.4 * Math.sin(al * .043 + rho * .19)), fine = .5 + .5 * Math.sin(rho * 9.1 + Math.sin(al * .21) * 1.3), m = .22 + .55 * gr + .12 * fine, l = (.4 + .9 * dif) * ao * fall;
      r = (66 + 92 * m) * l; g = (38 + 60 * m) * l; b = (18 + 34 * m) * l; }
    o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = src[i + 3]; }
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); const t = document.createElement("canvas"); t.width = w; t.height = h; t.getContext("2d").putImageData(img, 0, 0);
  x.shadowColor = "rgba(8,3,0,.7)"; x.shadowBlur = 9 * S; x.shadowOffsetY = 2 * S; x.drawImage(t, 0, 0);  // its shadow: on the wall outside, into the reveal inside
  return BASE = c;
}
// each portal's badge: the medallion's navy centre with its constellation, and the brass nameplate (a 160 x 204 window of the frame, from BX, BY)
const BX = CX - 80, BY = MY - 60, BW = 160, BH = 204;
export function badgeCanvas(p) {
  const c = document.createElement("canvas"); c.width = BW * S; c.height = BH * S; const x = c.getContext("2d"); x.scale(S, S); x.translate(-BX, -BY); const con = p.con ?? 0;
  const navy = x.createRadialGradient(CX - 8, MY - 10, 3, CX, MY, MR); navy.addColorStop(0, "#22367a"); navy.addColorStop(1, "#060b22"); x.fillStyle = navy; x.beginPath(); x.arc(CX, MY, MR - 2, 0, 7); x.fill();
  x.save(); x.beginPath(); x.arc(CX, MY, MR - 3, 0, 7); x.clip(); x.translate(CX, MY); const k = (MR - 6) / 52; x.scale(k, k); x.translate(-50, -30);
  x.lineWidth = 1.2; x.strokeStyle = "rgba(240,205,124,.32)"; x.beginPath(); ANIMAL[con](x); x.stroke();
  const [st, ln] = STARS[con]; x.strokeStyle = "rgba(255,226,150,.95)"; x.lineWidth = 2.6; x.lineCap = "round"; x.beginPath(); for (const [a, b] of ln) { x.moveTo(...st[a]); x.lineTo(...st[b]); } x.stroke();
  for (const [px, py] of st) { const g = x.createRadialGradient(px, py, 0, px, py, 8); g.addColorStop(0, "rgba(255,250,220,1)"); g.addColorStop(.35, "rgba(255,222,130,.9)"); g.addColorStop(1, "rgba(255,200,90,0)"); x.fillStyle = g; x.beginPath(); x.arc(px, py, 8, 0, 7); x.fill(); }
  x.restore(); const gl = x.createRadialGradient(CX - 14, MY - 18, 2, CX - 14, MY - 18, MR); gl.addColorStop(0, "rgba(255,255,255,.14)"); gl.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gl; x.beginPath(); x.arc(CX, MY, MR - 2, 0, 7); x.fill();  // a glaze
  // the brass nameplate with the region's name, hung in the top of the opening (and the way home on a back door)
  const nh = p.sub ? 40 : 30, ny = p.sub ? 322 : 316, bw = p.sub ? 156 : 128;
  const brass = x.createLinearGradient(0, ny - nh / 2, 0, ny + nh / 2); brass.addColorStop(0, "#f6dc96"); brass.addColorStop(.45, "#d9a53c"); brass.addColorStop(1, "#8a6218");
  x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.roundRect(CX - bw / 2 + 2, ny - nh / 2 + 4, bw, nh, 7); x.fill();
  x.fillStyle = brass; x.beginPath(); x.roundRect(CX - bw / 2, ny - nh / 2, bw, nh, 7); x.fill(); x.strokeStyle = "rgba(90,58,10,.9)"; x.lineWidth = 2; x.stroke();
  x.strokeStyle = "rgba(255,242,205,.55)"; x.lineWidth = 1; x.beginPath(); x.roundRect(CX - bw / 2 + 4, ny - nh / 2 + 3.5, bw - 8, nh - 7, 5); x.stroke();
  x.fillStyle = "#6b4a10"; for (const sx of [CX - bw / 2 + 8, CX + bw / 2 - 8]) { x.beginPath(); x.arc(sx, ny, 2.2, 0, 7); x.fill(); }
  let fs = p.sub ? 21 : 24; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 ${fs}px ${FONT}`;
  while (fs > 11 && x.measureText(p.name).width > bw - 26) { fs -= 2; x.font = `700 ${fs}px ${FONT}`; }
  const nameY = p.sub ? ny - 8 : ny; x.fillStyle = "#fbefc4"; x.fillText(p.name, CX, nameY - .6); x.fillStyle = "#3a2406"; x.fillText(p.name, CX, nameY + .5);
  if (p.sub) { x.font = `600 12px ${FONTB}`; x.fillStyle = "#3a2406"; x.fillText(p.sub, CX, ny + 11); }
  return c;
}

const VS = "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }";
// THE WARP TUNNEL (Eddie 2026-11-17: "dark blue ... the look of long tunnel like a real warp portal ... twisted and distorted"), shared by the arch interior here and the full-screen warp in library.js.
// Classic tunnel mapping: angle a = atan(q), depth z = .5 / r. Everything lives on the tunnel wall in (angle, depth): it streams toward the far end (w = z - t), and the angle corkscrews with depth (b = a + .35 z + spin),
// so streaks curve (plus a log-spiral wind, 1.3 ln z, so the arms coil like the reference's swirl). Sizes are kept in screen units (dr = 2 r^2 dz, ds = r da) against one pixel (px): a star streak fixed in depth is a long smear at the mouth and a point far away; rings at even depth steps crowd
// toward the centre. Fog to black with depth, a faint pale-blue light at the far end. `far` shifts the far end only (bends the walls; with the eye it is parallax), and a slow wobble of the radius warps them.
// `lens` > 0 (inside the warp): light near the centre is bent round it (source radius r - lens^2 / r), so stars smear into a ring there. Colours: deep navy to black, no gold (the reference: renders/review/landing-warp-ref).
export const TUNNEL = `float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float starL(float b, float w, float r, float N, float M, float th, float px, float sd) {
  vec2 g = vec2(b * N / 6.2831853, w * M), id = floor(g), f = fract(g); id.x = mod(id.x, N); float h = hash(id + sd); if (h < th) return 0.;
  vec2 c = .3 + .4 * vec2(hash(id + sd + 3.1), hash(id + sd + 7.7)); float dA = (f.x - c.x) * 6.2831853 / N * r, dZ = (f.y - c.y) / M * 2. * r * r, L = .13 / M * 2. * r * r;
  return smoothstep(px * 1.6, 0., length(vec2(dA, max(0., abs(dZ) - L)))) * (.45 + .55 * (h - th) / (1. - th)) * smoothstep(px * 2., px * 7., 6.2831853 / N * r); }
vec3 tunnel(vec2 q, float t, float spin, float px, float lens, vec2 far) {
  float r0 = length(q); q -= far / (1. + 4. * r0); float rc = length(q), a = atan(q.y, q.x);
  float r = rc * (1. + .05 * sin(a * 2. + t * .4) + .03 * sin(a * 3. - t * .27));
  if (lens > 0.) { float s = r - lens * lens / max(r, 1e-3); a += s < 0. ? 3.14159 : 0.; r = abs(s); }
  r = max(r, 1e-3); float z = .5 / r, w = z - t, b = a + .22 * z + 1.3 * log(z) + spin, fog = exp(-.075 * z);
  float arms = pow(.5 + .5 * sin(3. * b + 1.2 * sin(w * .45 + b * 2.)), 1.6) * (.6 + .4 * sin(b * 13. + w * .7)) * (.7 + .3 * sin(b * 37. - w * .5));
  float fN = 60., fg = b * fN / 6.2831853, fh = hash(vec2(floor(fg), 1.)), seg = fract(w * .22 + fh * 7.);
  float fil = step(.5, fh) * smoothstep(0., .08, seg) * smoothstep(.62, .3, seg) * smoothstep(px * 1.7, 0., abs(fract(fg) - .5) * 6.2831853 / fN * r) * smoothstep(px * 3., px * 9., 6.2831853 / fN * r);
  float rd = abs(w - 2.4 * floor(w / 2.4 + .5)) * 2. * r * r, ring = exp(-rd * rd / (px * px * 2.)) * smoothstep(px * 6., px * 20., 2.4 * 2. * r * r);
  float st = starL(b, w, r, 34., 1.6, .62, px, 0.) + starL(b, w, r, 70., 3.1, .7, px, 9.) * .75 + starL(b, w, r, 130., 5.3, .78, px, 21.) * .55;
  vec3 col = vec3(.003, .005, .014) + vec3(.085, .115, .23) * arms * fog + vec3(.36, .45, .66) * fil * fog * .7 + vec3(.20, .30, .55) * ring * fog * .3 + vec3(.80, .87, 1.) * st * (.35 + .65 * fog);
  return col + vec3(.45, .6, 1.) * (exp(-rc * rc * 900.) * .55 + exp(-rc * rc * 60.) * .06); }`;
// ONE quad per portal, the same size as the frame: inside the arch the tunnel above seen from its mouth, turning slowly; hover or focus quickens it (uT runs faster, see update). Outside the arch: nothing (the frame covers it).
// uT time, uHover brightens a little, uSurge (the walk into it) brightens, uCam parallax (the far end shifts with the eye). The arch is 2 px wider than the frame's cut-out so no seam shows.
const FS = `uniform float uT, uHover, uSurge; uniform vec2 uCam; varying vec2 vUv;
${TUNNEL}
void main() {
  vec2 px = vec2(vUv.x * ${W}., (1. - vUv.y) * ${H}.);
  float d = px.y >= ${AY}. ? abs(px.x - ${CX}.) - ${RO + 2}. : length(px - vec2(${CX}., ${AY}.)) - ${RO + 2}.;
  if (d > 0.) discard;
  vec2 q = (px - vec2(${CX}., 440.)) / 140. * vec2(1., -1.); float t = uT * .5;
  vec3 col = tunnel(q, t, uT * .16, length(fwidth(q)), 0., uCam * vec2(-.22, -.17) + .07 * vec2(sin(t * .37), cos(t * .29)));
  col *= .55 + .45 * smoothstep(0., 16., -d);  // deeper at the reveal
  gl_FragColor = vec4(col * (1. + .35 * uHover + .6 * uSurge), 1.);
}`;

function signCanvas(p) {  // a carved wooden board with scroll ends and gold trim: the name large, and a small badge for the plan
  const c = document.createElement("canvas"); c.width = 768, c.height = 272; const x = c.getContext("2d"), GOLD = "#e2b459";
  const body = () => { x.beginPath(); x.moveTo(60, 30); x.lineTo(708, 30); x.arc(708, 62, 32, -Math.PI / 2, 0); x.lineTo(740, 150); x.arc(708, 200, 50, 0, Math.PI / 2); x.lineTo(60, 250); x.arc(60, 200, 50, Math.PI / 2, Math.PI); x.lineTo(20, 62); x.arc(60, 62, 40, Math.PI, -Math.PI / 2); x.closePath(); };
  body(); const wood = x.createLinearGradient(0, 30, 0, 250); wood.addColorStop(0, "#7a4a22"); wood.addColorStop(.5, "#5f3818"); wood.addColorStop(1, "#43250f"); x.fillStyle = wood; x.fill();
  x.save(); x.clip(); for (let k = 0; k < 40; k++) { const y = 30 + k * 5.6 + Math.sin(k * 7.3) * 2; x.strokeStyle = `rgba(${k % 3 ? "25,10,2" : "210,150,80"},${.06 + (k % 5) * .02})`; x.lineWidth = 1 + (k % 3) * .6; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(250, y + Math.sin(k) * 6, 500, y - Math.cos(k) * 6, 768, y + 2); x.stroke(); } x.restore();
  x.lineJoin = "round"; body(); x.strokeStyle = "#1a0b03"; x.lineWidth = 11; x.stroke(); x.strokeStyle = GOLD; x.lineWidth = 5; x.stroke();
  x.save(); x.translate(384, 140); x.scale(.93, .85); x.translate(-384, -140); body(); x.strokeStyle = "rgba(255,225,150,.55)"; x.lineWidth = 2.4; x.stroke(); x.restore();
  x.strokeStyle = GOLD; x.lineWidth = 4; for (const [cx, cy, sg] of [[70, 62, 1], [698, 62, -1], [70, 214, 1], [698, 214, -1]]) { x.beginPath(); x.arc(cx, cy, 11, 0, 4.7); x.stroke(); x.beginPath(); x.arc(cx + sg * 3, cy, 4, 0, 7); x.stroke(); }
  let fs = 112; x.textAlign = "center"; x.textBaseline = "middle"; for (; fs > 36; fs -= 6) { x.font = `600 ${fs}px ${FONT}`; if (x.measureText(p.name).width < 560) break; }
  x.fillStyle = "#1a0b03"; x.fillText(p.name, 386, 108); x.fillStyle = "#f8dc8e"; x.fillText(p.name, 384, 104);
  x.font = `600 36px ${FONTB}`; const bw = Math.min(560, x.measureText(p.sub).width + 80); x.fillStyle = "rgba(0,0,0,.28)"; x.strokeStyle = GOLD; x.lineWidth = 3; x.beginPath(); x.roundRect(384 - bw / 2, 172, bw, 54, 27); x.fill(); x.stroke(); x.fillStyle = "#fbe7ab"; x.fillText(p.sub, 384, 200);
  return c; }

// the warm light rising out of the opening: a faint additive column with a few slow sparkles climbing it
const GLOWFS = `uniform float uT, uHover; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() { float y = vUv.y; float a = smoothstep(0., .22, y) * pow(1. - y, 2.2) * (.3 + .2 * uHover) * (.75 + .25 * sin(uT * 1.3 + vUv.x * 18.));
  vec2 g = vec2(vUv.x * 36., (y * 1.35 - uT * .07) * 9.), id = floor(g), f = fract(g) - .5; float h = hash(id);
  float sp = step(.9, h) * smoothstep(.34, 0., length(f)) * (.5 + .5 * sin(uT * 2.4 + h * 50.)) * smoothstep(0., .1, y) * (1. - y);
  gl_FragColor = vec4(vec3(1., .76, .46) * (a + sp * .9), 1.); }`;

// the stairwell: baked in Blender (stairwell.glb: unlit, the light and shadows are in its texture; stairwell-floor.webp: the railing's shadows and the golden glow on the boards), loaded ONCE when this
// module is imported and waited for (5 s at most, like the room's cards) so it arrives behind the loading cover. If it fails the floor stays whole and the sign, light shaft and door still work.
const loadWell = (async () => { try { const [gl, tx] = await Promise.all([new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL("stairwell.glb", import.meta.url).href), new TextureLoader().loadAsync(new URL("stairwell-floor.webp", import.meta.url).href)]); tx.colorSpace = SRGBColorSpace; tx.anisotropy = 8; return { well: gl.scene, decal: tx }; } catch (e) { console.warn("portals: stairwell.glb failed, no stairwell", e); return null; } })();
await Promise.race([loadWell, new Promise(r => setTimeout(r, 5000))]);
// a real hole in the floor card (a 1x1 plane in the library): the plane becomes a shape with a round hole, same UVs (u = x + .5, v = y + .5), so its material and its depth write are unchanged: no stencil.
function holeInFloor(THREE, mesh, cx, cz, rad) {
  if (mesh.userData.cut) return mesh.userData.cut(cx, cz, rad);  // the rotunda's round floor cuts its own (walls/rotunda.js)
  const s = mesh.scale, hx = (cx - mesh.position.x) / s.x, hy = -(cz - mesh.position.z) / s.y, shape = new THREE.Shape([[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(p => new THREE.Vector2(...p)));
  shape.holes.push(new THREE.Path(new THREE.EllipseCurve(hx, hy, rad / s.x, rad / s.y, 0, Math.PI * 2, true).getPoints(96)));
  const g = new THREE.ShapeGeometry(shape), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + .5, p.getY(i) + .5); mesh.geometry = g; }
// slow gold sparkles rising in the well: ONE additive Points draw, 72 points whose whole path (rise, sway, twinkle) is computed in the vertex shader from three numbers each and one time value; nothing is allocated per frame.
const SPARKVS = `uniform float uT, uS, uHover; attribute vec3 aP; varying float vA;
void main() { float k = fract(aP.y + uT * aP.z / 3.05); vec3 p = position; p.y = mix(-2.55, .45, k); p.x += .05 * sin(uT * .7 + aP.y * 30.); p.z += .05 * cos(uT * .6 + aP.y * 17.);
  vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uS * aP.x / -mv.z, 1.5, 12.);
  vA = smoothstep(0., .1, k) * smoothstep(1., .8, k) * (.5 + .5 * sin(uT * 2.3 + aP.y * 61.)) * (1. + .7 * uHover); }`;
const SPARKFS = "varying float vA; void main() { float d = length(gl_PointCoord - .5), a = smoothstep(.5, 0., d); a *= a; gl_FragColor = vec4(vec3(1., .78, .4) * a * vA * 2.2, 1.); }";

// the floor portal (to the Wonder Hall): the baked spiral stairwell (walnut wall, 22 steps, turned post, balusters and gold handrail, lit by the golden glow from below) seen through a round hole in the floor,
// the railing's shadows and the glow on the boards round it, slow gold sparkles rising in the well, a faint light shaft over the opening, and a carved wooden sign on its own short brass post OUTSIDE the
// railing, behind the well, facing the arrival view. The invisible disc over the opening is the click/tap target.
export function createFloorPortal(THREE, link, label) {
  const g = new THREE.Group(), R = 1.3, Rr = 1.34, U = { uT: { value: 0 }, uHover: { value: 0 }, uS: { value: 0 } }, y0 = link.at[1];
  const frame = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshBasicMaterial({ visible: false }));  // the click/tap target
  frame.rotation.x = -Math.PI / 2; frame.position.y = .014; frame.userData.link = link; frame.renderOrder = 22;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.14, 1.3, 28, 1, true), new THREE.ShaderMaterial({ uniforms: U, vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }", fragmentShader: GLOWFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); shaft.position.y = .66; shaft.renderOrder = 36;
  const N = 72, pos = new Float32Array(N * 3), ap = new Float32Array(N * 3), hs = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i < N; i++) { const r = 1.05 * Math.sqrt(hs(i, 1)), a = hs(i, 2) * Math.PI * 2; pos.set([r * Math.cos(a), 0, r * Math.sin(a)], i * 3); ap.set([.07 + .1 * hs(i, 3) ** 2, hs(i, 4), .05 + .08 * hs(i, 5)], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sg.setAttribute("aP", new THREE.BufferAttribute(ap, 3));
  const sparks = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: U, vertexShader: SPARKVS, fragmentShader: SPARKFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; sparks.renderOrder = 37;
  g.add(frame, shaft, sparks);
  // the sign: a brass post with a finial behind the well, the carved board hung on it
  const gm = new THREE.MeshLambertMaterial({ color: 0xd2a84c, emissive: 0x3a2808 }), sign = new THREE.Group(), signT = new THREE.CanvasTexture(signCanvas(label)); signT.colorSpace = THREE.SRGBColorSpace; signT.anisotropy = 4; const Z = -(Rr + .55), BY = 1.18;
  const bp = new THREE.Mesh(new THREE.CylinderGeometry(.03, .045, 1.55, 12), gm), fin = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), gm), base = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, .08, 14), gm), col = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), gm);
  bp.position.set(0, .78, Z - .03); fin.position.set(0, 1.62, Z - .03); base.position.set(0, .04, Z - .03); col.position.set(0, 1.5, Z - .03); sign.add(bp, fin, base, col);
  for (const dy of [-.2, .2]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .1, 6), gm); br.rotation.x = Math.PI / 2; br.position.set(0, BY + dy, Z - .02); sign.add(br); }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .6), new THREE.MeshBasicMaterial({ map: signT, transparent: true, alphaTest: .5, fog: false })); board.position.set(0, BY, Z + .02); board.userData.link = link; board.renderOrder = 41; sign.add(board);
  g.add(sign); g.position.set(...link.at);
  let h = 0, tt = 0, wellMat = null, cut = false;
  loadWell.then(w => { if (!w) return; const d = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: w.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));  // the decal: over the floor card (20), under everything else
    d.rotation.x = -Math.PI / 2; d.position.y = .008 - y0; d.renderOrder = 21; w.well.position.y = -y0; w.well.traverse(o => { if (o.isMesh) { wellMat = o.material; if (wellMat.map) wellMat.map.anisotropy = 8; } });g.add(w.well, d); });  // anisotropy 8: the treads and wall are seen at a slant, close, on the way down; the well's origin is its centre on the floor (the floor card is at y 0, this group at the door's y)
  return { group: g, frame, update: (t, target, dt, still, cam, surge = 0) => { h += (target - h) * (1 - Math.exp(-dt * 8)); tt += dt * (.25 + 1.75 * h); U.uT.value = still ? 2.4 : tt; U.uHover.value = h;
      if (cam) U.uS.value = .5 * innerHeight * Math.min(devicePixelRatio, innerWidth > 820 ? 2 : 1.5) / Math.tan(cam.fov * Math.PI / 360); if (wellMat) wellMat.color.setScalar(1 + .3 * h * (1 - surge) + .15 * surge);  // hover or focus brightens the baked well like the other doors; surge (0..1, the walk down the stairs) lets the gold from below grow a little (the hover's lift fades as it comes, so the glow never clips)
      if (!cut && wellMat && g.parent) { cut = true; const m = g.parent.getObjectByName("floor"); if (m) holeInFloor(THREE, m, link.at[0], link.at[2], 1.24); } },  // the hole (1.24 m, hidden under the 1.17-1.32 m coping ring) is cut the frame the well is in, in the floor card at the door
    setLabel: p => { signT.image = signCanvas(p); signT.needsUpdate = true; } };
}

// the way back up from the Wonder Hall (Eddie 2026-11-17: "use Blender to do the staircase that goes back up"): the SAME spiral stair, baked in Blender (stairup.glb, make_stairup.py: unlit, light and shadow in its texture), standing on the hall floor and climbing 4 turns (8 m)
// straight up out of every hall view: no ceiling, no disc, no visible top. A column of the home library's warm light (additive, soft-edged, brightest high up, fading out far above) swallows the top of the stair and spills down it. Loaded ONCE, the first time this portal is built,
// not waited for (about 450 KB, and the hall is a click away); the invisible cylinder over it is the click/tap target; hover or focus brightens the baked wood like the other doors; a warm pool on the boards, and a carved sign on a brass post says where it goes.
let upLoad = null; const loadUp = () => upLoad ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL("stairup.glb", import.meta.url).href).then(g => g.scene).catch(e => { console.warn("portals: stairup.glb failed, no stair up", e); return null; });
const UPFS = `uniform float uT, uHover, uIn; varying vec3 vN, vV; varying float vY;
void main() { float e = mix(pow(abs(dot(normalize(vN), normalize(vV))), 3.5), 1., uIn), a = smoothstep(2.5, 8.5, vY) * (1. - smoothstep(18., 70., vY)) * e * (mix(3.6, .75, uIn) + .15 * uHover) * (.94 + .06 * sin(uT * 1.1 + vY * .9)); gl_FragColor = vec4(mix(vec3(1., .66, .3), vec3(1., .9, .62), smoothstep(2., 14., vY)) * a, 1.); }`;  // uIn: the eye is inside the column (the climb): its far wall is lit all round, held to a warm gold (at full strength it washed the screen white for about a second)
export function createStairUp(THREE, link, label, renderer) {
  const g = new THREE.Group(), U = { uT: { value: 0 }, uHover: { value: 0 }, uIn: { value: 0 } };
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 8, 20), new THREE.MeshBasicMaterial({ visible: false })); frame.position.y = 4; frame.userData.link = link;  // the click/tap target
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 70, 28, 1, true).translate(0, 35, 0), new THREE.ShaderMaterial({ uniforms: U, vertexShader: "varying vec3 vN, vV; varying float vY; void main() { vY = position.y; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }", fragmentShader: UPFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  shaft.renderOrder = 36;
  const pc = document.createElement("canvas"); pc.width = pc.height = 128; { const x = pc.getContext("2d"), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(20,9,3,.5)"); gr.addColorStop(.34, "rgba(32,14,4,.32)"); gr.addColorStop(.46, "rgba(255,190,100,.2)"); gr.addColorStop(.75, "rgba(255,180,90,.07)"); gr.addColorStop(1, "rgba(255,180,90,0)"); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); }
  const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); pool.rotation.x = -Math.PI / 2; pool.position.y = .012; pool.renderOrder = 21;  // over the floor card (20), under the rest, like the home decal
  g.add(pool, shaft, frame);
  // the sign: on a brass post by the foot, on the side away from the walk in, turned to face the arrival view (shortcut: built here, not shared with createFloorPortal's)
  const gm = new THREE.MeshLambertMaterial({ color: 0xd2a84c, emissive: 0x3a2808 }), sign = new THREE.Group(), SP = p => ({ name: p.sub || p.name, sub: p.sub ? p.name : "" }), signT = new THREE.CanvasTexture(signCanvas(SP(label))); signT.colorSpace = THREE.SRGBColorSpace; signT.anisotropy = 4;
  const bp = new THREE.Mesh(new THREE.CylinderGeometry(.03, .045, 1.55, 12), gm), fin = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 10), gm), base = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, .08, 14), gm), col = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), gm);
  bp.position.y = .78; fin.position.y = 1.62; base.position.y = .04; col.position.y = 1.5; sign.add(bp, fin, base, col);
  for (const dy of [-.2, .2]) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .1, 6), gm); br.rotation.x = Math.PI / 2; br.position.set(0, 1.18 + dy, .03); sign.add(br); }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .6), new THREE.MeshBasicMaterial({ map: signT, transparent: true, alphaTest: .5, fog: false })); board.position.set(0, 1.18, .06); board.userData.link = link; board.renderOrder = 41; sign.add(board);
  const sx = 1.9 * Math.sin(1.19), sz = 1.9 * Math.cos(1.19); sign.position.set(sx, 0, sz); sign.rotation.y = Math.atan2(3.94 - sx, 7.415 - sz); g.add(sign); g.position.set(...link.at);
  let h = 0, tt = 0, mat = null;
  loadUp().then(m => { if (!m) return; m = m.clone(); m.traverse(o => { if (o.isMesh) { mat = o.material = o.material.clone(); } }); g.add(m); if (mat?.map) renderer?.initTexture?.(mat.map); });
  return { group: g, frame, update: (t, target, dt, still, cam, surge = 0) => { h += (target - h) * (1 - Math.exp(-dt * 8)); tt += dt; U.uT.value = still ? 2.4 : tt; U.uHover.value = h; U.uIn.value = cam ? Math.min(1, Math.max(0, (1.7 - Math.hypot(cam.position.x - g.position.x, cam.position.z - g.position.z)) / .4)) : 0; if (mat) mat.color.setScalar(1 + .3 * h + .25 * surge); },  // hover or focus, and the climb (surge 0..1), brighten the baked wood
    setLabel: p => { signT.image = signCanvas(SP(p)); signT.needsUpdate = true; } };
}

export function createPortal(THREE, plane, link, size, label) {
  const g = new THREE.Group(); let base = BASE?.tex; if (!base) { base = new THREE.CanvasTexture(baseFrame()); base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 4; BASE.tex = base; }  // one carved frame for all
  const tex = new THREE.CanvasTexture(badgeCanvas(label)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const frame = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: base, transparent: true, alphaTest: .5, fog: false, side: THREE.DoubleSide })), U = { uT: { value: 0 }, uHover: { value: 0 }, uSurge: { value: 0 }, uCam: { value: new THREE.Vector2() } };
  const badge = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .5, fog: false, side: THREE.DoubleSide })); badge.scale.set(BW / W, BH / H, 1); badge.position.set((BX + BW / 2) / W - .5, .5 - (BY + BH / 2) / H, .002);  // frame and badge are solid (alphaTest, depth written): the library's light (drawn after them) lies over them where it is in front
  const inner = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  frame.renderOrder = 34; badge.renderOrder = 35; inner.renderOrder = 33; inner.position.z = -(link.depth ?? .01); frame.userData.link = link; g.add(inner, frame, badge); g.scale.set(size[0] * W / 256, size[1] * H / 570, 1); g.position.set(...link.at); g.position.y += size[1] * (H / 570 - 1) / 2; g.rotation.y = link.yaw ?? 0;  // inner: at the back of the recess the wall's arch is cut into (grow.js depth)
  let h = 0, tt = 0;
  return { group: g, frame, update: (t, target, dt, still, cam, surge = 0) => { h += (target - h) * (1 - Math.exp(-dt * 8)); tt += dt * (1 + 1.3 * h + 3 * surge); U.uT.value = still ? 2.4 : tt; U.uHover.value = h; U.uSurge.value = still ? 0 : surge; if (cam) { g.updateWorldMatrix(true, false); const l = cam.position.clone(); g.worldToLocal(l); U.uCam.value.set(l.x, l.y).multiplyScalar(1 / (1 + Math.abs(l.z))).clampLength(0, .6); } frame.material.color.setScalar(1 + .45 * h); badge.material.color.setScalar(1 + .3 * h); },
    setLabel: s => { tex.image = badgeCanvas(s); tex.needsUpdate = true; } };
}
