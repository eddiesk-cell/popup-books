// The Grand Library page (L3b): painted layers + instanced books + the viewer's sunrays, behind the intro doors (index.html, library.css) and the fall down the well.
// room.json drives everything: layers (any number; optional repeatY {count, spacing, from}, per-layer fog 0..1), cams, shafts, windows, fog {color, near, far}.
import * as THREE from "three";
import { makeBooks } from "./books.js";
import { createRing } from "./ring.js";
import { grow } from "./grow.js";
import { createFront } from "./front.js";
import { titleNodes, fontsReady } from "./titles.js";
import { createPortal, createFloorPortal, createStairUp, regionLabel, regionPlaque, STARS, TUNNEL } from "./portals.js";
import { createSky } from "./sky.js";
import { loadCases3d } from "./cases3d.js";
import { wireLiving } from "./livingwire.js";
import { createWonders } from "./wonders.js";
import { createWalls, createLamps } from "./walls/walls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const $ = s => document.querySelector(s), qs = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// ---- words (menu only; Lao, Thai, Chinese, Japanese, Korean are drafts for a native read)
const NAMES = [["en", "English"], ["lo", "ລາວ"], ["th", "ไทย"], ["zh", "中文"], ["ja", "日本語"], ["ko", "한국어"]], CODES = NAMES.map(n => n[0]);
const TR = {
  en: ["Menu", "Settings", "Language", "Account", "Sign in", "Sign up", "Opening soon", "Watch the intro", "Skip", "Home", "This tale is still being written", "Drag to look around", "Open the book", "Close", "Drag to find the doors", "Coming soon", "Sound", "on", "off", "Opening the library...", "Previous book", "Next book", "Tales still being written", "The Grand Library: drag or move the mouse to look around, arrow keys turn, Enter walks on", "Wonder of Saya Tales, back to the first page"],
  lo: ["ເມນູ", "ຕັ້ງຄ່າ", "ພາສາ", "ບັນຊີ", "ເຂົ້າສູ່ລະບົບ", "ສະໝັກ", "ເປີດໄວໆນີ້", "ເບິ່ງວິດີໂອນຳ", "ຂ້າມ", "ໜ້າຫຼັກ", "ນິທານເລື່ອງນີ້ກຳລັງຖືກຂຽນຢູ່", "ລາກເພື່ອເບິ່ງອ້ອມໆ", "ເປີດປຶ້ມ", "ປິດ", "ລາກເພື່ອຊອກຫາປະຕູ", "ມາໄວໆນີ້", "ສຽງ", "ເປີດ", "ປິດ", "ກຳລັງເປີດຫໍສະໝຸດ...", "ປຶ້ມກ່ອນໜ້າ", "ປຶ້ມຖັດໄປ", "ນິທານທີ່ກຳລັງຖືກຂຽນ", "ຫໍສະໝຸດໃຫຍ່: ລາກ ຫຼື ຍ້າຍເມົ້າສ໌ເພື່ອເບິ່ງອ້ອມໆ, ປຸ່ມລູກສອນເພື່ອຫັນ, Enter ເພື່ອເດີນໄປ", "Wonder of Saya Tales, ກັບໄປໜ້າທຳອິດ"],
  th: ["เมนู", "ตั้งค่า", "ภาษา", "บัญชี", "เข้าสู่ระบบ", "สมัคร", "เร็ว ๆ นี้", "ดูวิดีโอเปิด", "ข้าม", "หน้าแรก", "นิทานเรื่องนี้กำลังถูกเขียนอยู่", "ลากเพื่อมองไปรอบ ๆ", "เปิดหนังสือ", "ปิด", "ลากเพื่อหาประตู", "เร็ว ๆ นี้", "เสียง", "เปิด", "ปิด", "กำลังเปิดห้องสมุด...", "เล่มก่อนหน้า", "เล่มถัดไป", "นิทานที่กำลังเขียน", "ห้องสมุดใหญ่: ลากหรือเลื่อนเมาส์เพื่อมองรอบ ๆ ปุ่มลูกศรเพื่อหัน Enter เพื่อเดินต่อ", "Wonder of Saya Tales, กลับไปหน้าแรก"],
  zh: ["菜单", "设置", "语言", "账户", "登录", "注册", "即将开放", "观看开场短片", "跳过", "回到书架", "这个故事还在写作中", "拖动四处看看", "打开这本书", "关闭", "拖动寻找传送门", "即将推出", "声音", "开", "关", "正在打开图书馆…", "上一本", "下一本", "还在写作中的故事", "大图书馆：拖动或移动鼠标四处看，方向键转向，回车键前进", "Wonder of Saya Tales，回到首页"],
  ja: ["メニュー", "設定", "言語", "アカウント", "ログイン", "新規登録", "もうすぐ公開", "イントロを見る", "スキップ", "ホーム", "このおはなしは まだ かきかけです", "ドラッグして見まわそう", "ほんを ひらく", "とじる", "ドラッグして とびらを さがそう", "もうすぐ会えるよ", "おと", "オン", "オフ", "としょかんを ひらいています…", "まえの ほん", "つぎの ほん", "かきかけの おはなし", "おおきな としょかん：ドラッグか マウスで 見まわす、矢印キーで むきを かえる、Enterで すすむ", "Wonder of Saya Tales、さいしょの ページへ もどる"],
  ko: ["메뉴", "설정", "언어", "계정", "로그인", "가입", "곧 열려요", "인트로 보기", "건너뛰기", "홈", "이 이야기는 아직 쓰이고 있어요", "끌어서 둘러보세요", "책 펴기", "닫기", "끌어서 문을 찾아보세요", "곧 만나요", "소리", "켜짐", "꺼짐", "도서관을 여는 중…", "이전 책", "다음 책", "아직 쓰이는 이야기", "큰 도서관: 끌거나 마우스를 움직여 둘러보고, 방향키로 돌리고, Enter로 걸어가요", "Wonder of Saya Tales, 첫 페이지로 돌아가기"],
};
const KEYS = ["menu", "settings", "language", "account", "signin", "signup", "soon", "intro", "skip", "home", "still", "hint", "tapopen", "close", "doors", "coming", "snd", "on", "off", "loading", "prev", "next", "stills", "stage", "logo"];
let lang = qs.get("lang"); if (!CODES.includes(lang)) lang = store.get("wst-lang");  // the first page's key
if (!CODES.includes(lang)) lang = (navigator.languages || ["en"]).map(c => CODES.find(x => String(c).toLowerCase().startsWith(x))).find(Boolean) || "en";
const words = () => Object.fromEntries(KEYS.map((k, i) => [k, TR[lang][i]]));
let W = words(), books = null, homeWalls = null, behindDoor = null; const shelfBtns = [], setShown = [], ZERO = new THREE.Vector3();
let sndOff = store.get("popup-sound") === "off";  // kept in memory too: with storage blocked, off still holds until the page closes
const sndOn = () => !sndOff;
const sndLabel = () => { const b = $("#snd"); b.textContent = `${W.snd}: ${sndOn() ? W.on : W.off}`; };
const setWords = () => { W = words(); document.documentElement.lang = lang; $("#menu").setAttribute("aria-label", W.menu); $("#skip").textContent = W.skip; $("#hint").textContent = W.hint; $("#ringx").setAttribute("aria-label", W.close); $("#home").textContent = W.home; $("#ringp").setAttribute("aria-label", W.prev); $("#stage").setAttribute("aria-label", W.stage); $(".logo").setAttribute("aria-label", W.logo); $("#ringn").setAttribute("aria-label", W.next); sndLabel(); labelBooks(); document.querySelectorAll("[data-t]").forEach(e => { e.textContent = W[e.dataset.t]; }); };
$("#lang").innerHTML = NAMES.map(([c, n]) => `<option value="${c}" lang="${c}">${n}</option>`).join(""); $("#lang").value = lang;
$("#lang").onchange = e => { lang = e.target.value; store.set("wst-lang", lang); setWords(); books?.setLang(lang); capText(true); portalLabels?.(); };
function labelBooks() { if (!books) return; shelfBtns.forEach((b) => { if (b.__portal) { b.setAttribute("aria-label", regionLabel(b.__portal.frame.userData.link, catalog.regions ?? [], lang)); return; } if (b.__n) { b.setAttribute("aria-label", `${W.stills} (${b.__n})`); return; } const bk = books.bookAt(b.__i); b.setAttribute("aria-label", bk ? bk.title.en + (lang !== "en" && bk.title[lang] ? " — " + bk.title[lang] : "") : `${W.still} (${b.__i % 48 + 1})`); }); }
setWords();

// ---- the menu: one button, Enter/Space opens, Esc closes
const menu = $("#menu"), panel = $("#panel");
const openMenu = on => { panel.hidden = !on; menu.setAttribute("aria-expanded", on); if (!on) $("#note").textContent = ""; };
menu.onclick = () => openMenu(panel.hidden);
addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { openMenu(false); menu.focus(); } });
addEventListener("pointerdown", e => { if (!panel.hidden && !panel.contains(e.target) && !menu.contains(e.target)) openMenu(false); });
document.querySelectorAll(".acct").forEach(b => { b.onclick = () => { $("#note").textContent = W.soon; }; });

// ---- sound (L6a): sound.js's soft pools served from web/landing/sfx/ (the "landing" library), loaded only after the visitor's first gesture, on/off kept the way sound.js keeps it
let snd = null, sndP = null, gestured = false; const cueLog = [];
const BED_GAIN = 1.0, BED_FADE = 4000; let bedOn = false;  // the hum: a low bed, faded in over 4 s on the first gesture
const startBed = () => { if (bedOn || sndOff) return; bedOn = true;
  (sndP ??= import("../../live/sound.js").then(m => (snd = m.addSound(m.manifestFor("landing", "../../")))).catch(() => null))
    .then(s => { if (!s) return; s.setBed([["library-hum", 0]]); const t0 = performance.now();
      const iv = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / BED_FADE); s.setBed([["library-hum", u * BED_GAIN]]); if (u >= 1) clearInterval(iv); }, 40); }); };
for (const ev of ["pointerdown", "keydown", "touchend"]) addEventListener(ev, () => { gestured = true; startBed(); }, { capture: true, passive: true });
const cue = (name, gain = 1) => { const ok = gestured && sndOn(); cueLog.push({ name, ok, t: Math.round(performance.now()) }); if (!ok) return;
  (sndP ??= import("../../live/sound.js").then(m => (snd = m.addSound(m.manifestFor("landing", "../../")))).catch(() => null)).then(s => s?.play(name, { gain, tag: "library" })); };
$("#snd").onclick = () => { sndOff = !sndOff; store.set("popup-sound", sndOff ? "off" : "on"); snd?.mute(sndOff); sndLabel(); if (sndOff) front?.hush(); else startBed(); };

// ---- the room
const phoneArt = innerWidth <= 820 || innerWidth < innerHeight, phone = phoneArt;
const renderer = new THREE.WebGLRenderer({ canvas: $("#stage"), antialias: !phone, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2)); renderer.setClearColor(0x120b06);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 1400);
const base = new URL("./", import.meta.url), room = await fetch(new URL("room.json", base)).then(r => r.json());
// the catalog (books.json) and, for tests only, ?fake=N: N invented ready books across six regions (never linked from the site)
const catalog = await fetch(new URL("../books.json", base)).then(r => r.json()).catch(err => { console.warn("library: books.json failed, shelves hold show books only:", err); return { books: [], regions: [] }; });
if (qs.has("makecover")) catalog.books.forEach(b => { if (b.status === "making" && !b.cover) b.cover = "../shelf/books/kapi/plate.webp"; });  // test only: pretend the covers of the books being made have landed
if (qs.has("fake")) { const REG = [["sea", "Lao and Southeast Asia"], ["asia", "Asia"], ["africa", "Africa"], ["europe", "Europe"], ["americas", "The Americas"], ["oceania", "Oceania"]], pal = ["#1f4a31", "#5b1f26", "#1d3557", "#4a2a5c", "#6b4423", "#1c5a5a"], realOnes = catalog.books.filter(b => b.status === "ready");
  catalog.regions = REG.map(([id, name]) => ({ id, name })); catalog.books = [...realOnes]; for (let i = realOnes.length; i < Math.max(Math.min(+qs.get("fake") || 200, 400), realOnes.length); i++) catalog.books.push({ id: "fake-" + i, title: { en: "Tale " + (i + 1) }, cover: null, fake: true, spine: pal[i % 6], status: "ready", region: REG[i % 6][0], link: "../live/?book=kapi&s=s01" }); }
const grown = grow(room, catalog);
const c3 = await loadCases3d(THREE, scene, room, base, { phone, offsets: grown.caseSets });  // our cases as real 3D (null without a cases.glb)
const sky = createSky(THREE, room.sky); scene.add(sky.mesh);
{ const wc = room.wellCentre ?? [0, 0, 2.5], back = new THREE.Mesh(new THREE.CylinderGeometry(95, 95, 1300, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x1b1109, side: THREE.BackSide, fog: false })); back.position.set(wc[0], 250, wc[2]); back.renderOrder = -5; scene.add(back); }  // a dark backing behind the tower cards: the seams between them no longer show the sky
const walls = createWalls(THREE, room, { base, phone, anisotropy: renderer.capabilities.getMaxAnisotropy() }); scene.add(walls.well, walls.home, walls.homeHi);// every wall of books is one seamless wall (walls/walls.js)
const lamps = createLamps(THREE, (() => { const L = room.walls.lamps, Wl = room.walls.well, out = [], away = id => id !== "wonder";  // sconces: up the well's uprights, on the two outer sides of every bookcase unit, flanking the door
  for (let y = Wl.y[0] + 6, i = 0; y < Wl.y[1] - 6; y += L.step, i++) out.push({ ...walls.wellSpot((i * L.turn) % Wl.bays, y), s: L.wellScale });
  if (c3) { const b = new THREE.Box3().setFromObject(c3.group), zc = (b.min.z + b.max.z) / 2 + .12, y = b.max.y - .55;
    [[0, 0, 0], ...grown.caseSets].forEach((o, j) => { const sid = grown.setStation[j], when = id => id === sid || LINKS.some(l => l.from === id && l.to === sid && !l.portal);  // shown with its cases (onStation's near)
      out.push({ p: [b.min.x + o[0], y + o[1], zc + o[2]], n: [-1, 0, 0], when }, { p: [b.max.x + o[0], y + o[1], zc + o[2]], n: [1, 0, 0], when }); }); }
  for (const [x, y] of L.door) out.push({ p: [x, y, room.walls.door.z - walls.pd - .005], n: [0, 0, -1], when: away });  // on the pilasters that flank the arch
  return out; })(), { reduced }); scene.add(lamps.solid, lamps.light);
{ const wst = room.stations.find(s => s.id === "wonder"); if (wst) {  // the Wonder Hall's round stage and a warm pool of light
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"), g = x.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, "#6a4222"); g.addColorStop(.8, "#3a2210"); g.addColorStop(1, "#24140a"); x.fillStyle = g; x.beginPath(); x.arc(256, 256, 254, 0, 7); x.fill();
  x.strokeStyle = "#e2b459"; for (const [r, w] of [[250, 8], [236, 2], [150, 3], [60, 2]]) { x.lineWidth = w; x.beginPath(); x.arc(256, 256, r, 0, 7); x.stroke(); }
  const t = new THREE.CanvasTexture(c), P = wst.cam.p; t.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set(P[0], P[1] - 1.7 + .04, P[2] - 3.2); disc.renderOrder = 21; scene.add(disc);
  const gc = document.createElement("canvas"); gc.width = gc.height = 128; const gx = gc.getContext("2d"), gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64); gg.addColorStop(0, "rgba(255,214,140,.55)"); gg.addColorStop(1, "rgba(255,190,90,0)"); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.set(P[0], P[1] - 1.7 + .06, P[2] - 3.2); glow.renderOrder = 22; scene.add(glow); } }
if (room.fog) scene.fog = new THREE.Fog(room.fog.color ?? 0x120b06, room.fog.near ?? 8, room.fog.far ?? 40);
const fogCol = new THREE.Color(room.fog?.color ?? 0x120b06);
const loader = new THREE.TextureLoader(), texes = new Map(), plane = new THREE.PlaneGeometry(1, 1);
const tex = url => { let e = texes.get(url); if (!e) { let ok; const p = new Promise(r => { ok = r; }), t = loader.load(new URL(url, base).href, ok, undefined, () => { console.warn('library: art failed to load, card left out:', url); ok(); }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texes.set(url, e = { t, p }); } return e; };
const rings = new Map(), core = [], billboards = [], fades = [], flick = new Set(), mats = new Map(), FC = room.fogColors ?? {};
const fogAt = y => new THREE.Color(...((y > 25 ? FC.up : y < -10 ? FC.down : FC.mid) ?? [18, 11, 6]).map(v => v / 255));
const hash = str => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7), rnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return x - Math.floor(x); };
const vary = (id, k, c) => { const h = hash(id), r = j => rnd(h + j, k); c.r *= .95 + r(1) * .1; c.g *= .96 + r(2) * .08; c.b *= .95 + r(3) * .1; return { mirror: r(4) < .5, dy: r(5) - .5, w: .94 + r(6) * .12, yaw: (r(7) - .5) * .1 }; };
// a layer is a card: tint multiplies, fog blends toward the well's colour by height (+ fogStep per copy away), repeatY n = n copies centred on p.y spaced spacingY, billboard "y" turns it to face the visitor
room.layers = room.layers.filter(l => !/art\/(balustrade|arm1|bridge2)\.webp$/.test(l.img) && !/^g_arm\d/.test(l.id));  // the home balcony's painted side railings were a torn cut-out (rails and balusters missing, white scraps): built in 3D below instead
for (const L of room.layers) {
  const flat = Math.abs(Math.abs(L.rot?.[0] ?? 0) - Math.PI / 2) < .01, side = flat ? THREE.FrontSide : THREE.DoubleSide;  // floors and walkways: seen from below (looking up from a lower room) they vanish instead of hanging as dark slabs in the light
  const url = phoneArt && L.phoneImg ? L.phoneImg : L.img, n = L.repeatY ?? 1, half = n >> 1, e = tex(url), add = L.blend === "add", tint = new THREE.Color(...(L.tint ?? [1, 1, 1]));
  const grade = L.plane === "mid" ? .95 : L.plane === "fore" ? .9 : 1, order = L.tier ?? (L.plane === "back" ? 1 : 3), ro = /^glow/.test(L.id) ? 9 : L.plane === "back" ? 19 : order * 10;  // painter's order: far glows 9, the tower rings 10-18 (far ring first), other back cards 19, floors 20, rays 29, cases and fore 30+  // our 4 cases keep their own bright warm tint; the rest sit a little dimmer
  if (/^tower\d+_/.test(L.id)) { const k = L.id.split("_")[0]; (rings.get(k) ?? rings.set(k, []).get(k)).push({ L, url, e, tint, n, half }); continue; }  // merged below
  if (n > 1 && !L.billboard) {  // one draw for all copies: per-instance colour (tint + fog), the mesh sits at the layer's centre so painter's sorting by distance still works
    const key = "inst" + url + add + flat; let m = mats.get(key); if (!m) { m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: flat, side, opacity: 0, visible: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); mats.set(key, m); e.p.then(() => { if (!e.t.image) return; m.map = e.t; m.visible = true; m.needsUpdate = true; fades.push(m); }); }
    const im = new THREE.InstancedMesh(plane, m, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(L.rot?.[0] ?? 0, L.rot?.[1] ?? 0, 0, "YXZ"), sc = new THREE.Vector3(L.size[0] * (L.flip === "h" ? -1 : 1), L.size[1] * (L.flip === "v" ? -1 : 1), 1); q.setFromEuler(eu);
    for (let k = -half; k <= half; k++) { const y = L.p[1] + k * (L.spacingY ?? 0), f = add ? 0 : Math.min(1, (L.fog ?? 0) + (L.fogStep ?? 0) * Math.abs(k)); const c = tint.clone().multiplyScalar(grade).lerp(fogAt(y), f), v = k ? vary(L.id, k, c) : { mirror: false, dy: 0, w: 1, yaw: 0 }; sc.x = Math.abs(sc.x) * v.w * (v.mirror !== (L.flip === "h") ? -1 : 1); im.setMatrixAt(k + half, M.compose(new THREE.Vector3(0, k * (L.spacingY ?? 0) + v.dy * (L.spacingY ?? 0) * .12, 0), q, sc)); im.setColorAt(k + half, c); }
    im.position.set(...L.p); im.renderOrder = ro; im.name = L.id; scene.add(im); if (L.plane !== "back" && !/^(s\d|walk)/.test(L.id)) core.push(e.p); continue;
  }
  for (let k = -half; k <= half; k++) {
    const y = L.p[1] + k * (L.spacingY ?? 0), f = add ? 0 : Math.min(1, (L.fog ?? 0) + (L.fogStep ?? 0) * Math.abs(k)), col = tint.clone().multiplyScalar(grade).lerp(fogAt(y), f), key = url + col.getHexString() + add + flat;
    let m = mats.get(key); if (!m) { m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: flat, side, color: col, opacity: 0, visible: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }); mats.set(key, m); e.p.then(() => { if (!e.t.image) return; m.map = e.t; m.visible = true; m.needsUpdate = true; fades.push(m); }); if (/^lantern/.test(L.id)) { m.userData.base = col.clone(); flick.add(m); } }
    const mesh = new THREE.Mesh(plane, m); mesh.name = L.id; mesh.renderOrder = ro; mesh.rotation.order = "YXZ"; mesh.position.set(L.p[0], y, L.p[2]); mesh.rotation.set(L.rot?.[0] ?? 0, L.rot?.[1] ?? 0, 0);
    mesh.scale.set(L.size[0] * (L.flip === "h" ? -1 : 1), L.size[1] * (L.flip === "v" ? -1 : 1), 1); if (L.billboard) billboards.push(mesh); scene.add(mesh);
  }
  if (L.plane !== "back" && !/^(s\d|walk)/.test(L.id)) core.push(e.p);
}

// the tower rings: one instanced draw per ring and picture (far rings first). No two repeats alike: each card at each level picks one of the ring's pictures at random, may be mirrored, sits a little off its level,
// is a touch wider or narrower, turned a hair and tinted a shade; seeded, so the same every visit.
const WC0 = room.wellCentre ?? [0, 0, 2.5];
for (const g of rings.values()) {
  const urls = [...new Set(g.map(q => q.url))], byUrl = new Map(urls.map(u => [u, []])); let R = 0;
  for (const { L, url, n, half, tint } of g) { R += Math.hypot(L.p[0] - WC0[0], L.p[2] - WC0[2]) / g.length;
    for (let k = -half; k <= half; k++) { const v = rnd(hash(L.id), k + 50) < .5 ? url : urls[Math.floor(rnd(hash(L.id) + 9, k) * urls.length)]; byUrl.get(v).push({ L, k, tint }); } }
  for (const [url, list] of byUrl) { if (!list.length) continue;
    const e = tex(url), m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0, visible: false }); e.p.then(() => { if (!e.t.image) return; m.map = e.t; m.visible = true; m.needsUpdate = true; fades.push(m); });
    const im = new THREE.InstancedMesh(plane, m, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, "YXZ"), sc = new THREE.Vector3();
    list.forEach(({ L, k, tint }, i) => { const c = new THREE.Color(), y = L.p[1] + k * (L.spacingY ?? 0), f = Math.min(1, (L.fog ?? 0) + (L.fogStep ?? 0) * Math.abs(k)); c.copy(tint).lerp(fogAt(y), f); const v = vary(L.id, k, c);
      eu.set(L.rot?.[0] ?? 0, (L.rot?.[1] ?? 0) + v.yaw, 0); q.setFromEuler(eu); sc.set(L.size[0] * v.w * (v.mirror !== (L.flip === "h") ? -1 : 1), L.size[1] * (L.flip === "v" ? -1 : 1), 1);
      im.setMatrixAt(i, M.compose(new THREE.Vector3(L.p[0], y + v.dy * (L.spacingY ?? 0) * .12, L.p[2]), q, sc)); im.setColorAt(i, c); });
    im.renderOrder = 10 + 8 * (1 - Math.min(1, R / 100)); im.frustumCulled = false; im.name = g[0].L.id.split("_")[0]; scene.add(im); }
}
// contact shadows under each bookcase, window glows
const soft = (r, g, b) => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), q = x.createRadialGradient(64, 64, 0, 64, 64, 64); q.addColorStop(0, `rgba(${r},${g},${b},1)`); q.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = q; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const shadowT = soft(0, 0, 0), glowT = soft(255, 200, 110), wall = room.layers.find(l => l.id === "wall");
const floorY0 = room.cases[0].bounds?.min[1] ?? 0;
room.cases.forEach(c => { const bd = c.bounds; if (!bd) return;  // a soft contact shadow under every case, from its own bounds
  const s = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, opacity: .55, depthWrite: false })); s.rotation.x = -Math.PI / 2;
  s.position.set((bd.min[0] + bd.max[0]) / 2, bd.min[1] - floorY0 + (room.cases[0].floorY ?? 0) + .012, bd.max[2] + .2); s.scale.set((bd.max[0] - bd.min[0]) * 1.2, .9, 1); s.renderOrder = 31; scene.add(s); });
const glows = (room.windows ?? []).map(wx => { const g = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: glowT, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); g.position.set(wx, room.windowY ?? 4.95, (wall?.p[2] ?? -.8) + .05); g.scale.set(1.5, 2.4, 1); g.renderOrder = 19.5; scene.add(g); return g; });

const cb = room.cases.map(c => c.bounds).filter(Boolean);  // a warm pool of light over our 4 cases
if (cb.length && !room.layers.some(l => l.id === "spot")) { const x0 = Math.min(...cb.map(b => b.min[0])), x1 = Math.max(...cb.map(b => b.max[0])), y0 = Math.min(...cb.map(b => b.min[1])), y1 = Math.max(...cb.map(b => b.max[1]));
  const sp = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: glowT, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.set((x0 + x1) / 2, (y0 + y1) / 2, .3); sp.scale.set((x1 - x0) * 1.35, (y1 - y0) * 1.5, 1); sp.renderOrder = 32; scene.add(sp); }
// lights for the 3D bits (books, ledges): warm key from above, soft fill
scene.add(new THREE.HemisphereLight(0xffe2b8, 0x3a2412, 1.5)); const key = new THREE.DirectionalLight(0xffd9a0, 2.2); key.position.set(-1.5, 6, 4); scene.add(key);
books = makeBooks(THREE, room, { phone, lang, setBooks: grown.sets.map(q => q.books), reduced, coming: () => W.coming });
let front = null, living = null; const say = (t, s) => { const e = $("#sub"); if (t == null) { e.classList.remove("on"); return; } e.firstChild.textContent = t; e.lastChild.textContent = s || ""; e.classList.add("on"); clearTimeout(say.t); say.t = setTimeout(() => e.classList.remove("on"), 3600); };
let ringWas = false, opener = null;  // the ring traps focus while open: the shelf behind it is inert, Esc gives focus back to what opened it
const ring = createRing(THREE, { scene, camera, books, reduced, chime: false, onChange: a => { disarm(); if (a.isOpen) { hideHint(); $("#hint").hidden = true; } $("#ringx").hidden = $("#ringp").hidden = $("#ringn").hidden = $("#ringb").hidden = !a.isOpen; if (a.isOpen && !ringWas) { ringWas = true; opener = document.activeElement; $("#shelf").inert = true; $("#stage").tabIndex = -1; ringName(); $("#ringb").focus({ preventScroll: true }); } if (!a.isOpen) $("#cap").hidden = true; } });
front = createFront(THREE, { scene, camera, renderer, ring, books, reduced, getLang: () => lang, getStill: () => W.still, say, muted: () => sndOff });
scene.add(books.mesh);  // opaque: drawn first, the cards depth-test against it
if (!c3) { const ledgeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x5a3a20 }), room.ledges?.length ?? 1);
(room.ledges ?? []).forEach((l, i) => ledgeMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(...l.p), new THREE.Quaternion(), new THREE.Vector3(...l.size))));
scene.add(ledgeMesh); }
// the balcony's two side railings, built (owner 2026-11-16, "both sides have broken images"): turned balusters, a top and a foot rail and posts with gold finials along both open sides of the floor; opaque, so the cards behind stop at them
for (const fl of room.layers.filter(l => l.id === "floor" || /^g_floor_r_/.test(l.id))) {
  const cx = fl.p[0], x = fl.size[0] / 2, z0 = fl.p[2] - fl.size[1] / 2 + (fl.id === "floor" ? 1.1 : 2.6), z1 = fl.p[2] + fl.size[1] / 2 - .1, n = Math.round((z1 - z0) / .2), wood = new THREE.MeshLambertMaterial({ color: 0x4a2c16 }), gold = new THREE.MeshLambertMaterial({ color: 0xc9a046, emissive: 0x2a1c06 });  // z0: clear of the side doors
  const lathe = new THREE.LatheGeometry([[.05, 0], [.05, .06], [.028, .1], [.046, .3], [.022, .5], [.036, .62], [.024, .72], [.04, .76], [.04, .8]].map(([r, y]) => new THREE.Vector2(r, y)), 10), bal = new THREE.InstancedMesh(lathe, wood, 2 * n), M = new THREE.Matrix4();
  let i = 0; for (const sx of [-1, 1]) for (let k = 0; k < n; k++) bal.setMatrixAt(i++, M.makeTranslation(cx + sx * x, fl.p[1], z0 + (k + .5) * (z1 - z0) / n));
  bal.name = "rail"; scene.add(bal);
  for (const sx of [-1, 1]) { for (const [y, h, w] of [[.83, .07, .12], [.03, .06, .1]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, z1 - z0), wood); r.position.set(cx + sx * x, fl.p[1] + y, (z0 + z1) / 2); r.name = "rail"; scene.add(r); }
    for (const z of [z0, (z0 + z1) / 2, z1]) { const q = new THREE.Mesh(new THREE.BoxGeometry(.15, .92, .15), wood), f = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 8), gold); q.position.set(cx + sx * x, fl.p[1] + .46, z); f.position.set(cx + sx * x, fl.p[1] + 1, z); q.name = f.name = "rail"; scene.add(q, f); } } }

// faint gold motes lingering in the air (the sunray dust lives in the viewer's effects)
const NM = phone ? 50 : 120, mp = new Float32Array(NM * 3), mv = Array.from({ length: NM }, () => Math.random() * 6.28);
for (let i = 0; i < NM; i++) mp.set([(Math.random() - .5) * 11, 1 + Math.random() * 5, -.5 + Math.random() * 7], i * 3);
const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(mp, 3)), new THREE.PointsMaterial({ map: soft(255, 215, 130), size: .09, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
motes.frustumCulled = false; motes.renderOrder = 60; scene.add(motes);

// a soft glow over the opening at the top of the well, so the tower tops melt into the sky (3 big warm additive discs)
{ const hz = document.createElement("canvas"); hz.width = hz.height = 256; const x = hz.getContext("2d"), g = x.createRadialGradient(128, 128, 0, 128, 128, 128); [[0, 1], [.25, .75], [.5, .35], [.75, .1], [1, 0]].forEach(([o, al]) => g.addColorStop(o, `rgba(255,214,150,${al})`)); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const ht = new THREE.CanvasTexture(hz); ht.colorSpace = THREE.SRGBColorSpace;
  [[135, 90, .05], [150, 150, .06], [198, 44, .5], [206, 24, .55]].forEach(([y, r, o]) =>  /* the last two: the oculus itself, a soft round glow at the top of the well */ { const h = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: ht, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); h.rotation.x = -Math.PI / 2; h.position.set((room.wellCentre ?? [0, 0, 2.5])[0], y, (room.wellCentre ?? [0, 0, 2.5])[2]); h.scale.set(r * 2, r * 2, 1); h.renderOrder = 19.2; scene.add(h); }); }
// the mist (two slow drifting veils) and now and then a far book floating from one shelf to another
const mistT = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); for (let i = 0; i < 26; i++) { const px = (i * 97 % 256), py = 12 + (i * 53 % 40), r = 30 + (i * 31 % 30), g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, "rgba(255,225,180,.5)"); g.addColorStop(1, "rgba(255,225,180,0)"); x.fillStyle = g; for (const o of [-256, 0, 256]) { x.save(); x.translate(o, 0); x.fillRect(px - r, py - r, 2 * r, 2 * r); x.restore(); } }
  const f = x.createLinearGradient(0, 0, 0, 64); f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(.35, "#000"); f.addColorStop(.65, "#000"); f.addColorStop(1, "rgba(0,0,0,0)"); x.globalCompositeOperation = "destination-in"; x.fillStyle = f; x.fillRect(0, 0, 256, 64);  // fade to nothing at the top and bottom: the blobs were cut straight at the canvas edge, a hard line across the top shelf
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const mist = [[-.3, 2.2, 36, 7, .1], [1.4, 1.0, 36, 4, .08]].map(([z, y, w, h, o], i) => { const t = mistT.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.position.set(0, y, z); m.scale.set(w, h, 1); m.renderOrder = 28; scene.add(m); return m; });
const bookT = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 90; const x = c.getContext("2d"); x.fillStyle = "#5b1f26"; x.fillRect(2, 2, 60, 86); x.strokeStyle = "#e2b459"; x.lineWidth = 3; x.strokeRect(8, 8, 48, 74); x.fillStyle = "#e2b459"; x.fillRect(26, 38, 12, 14); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const fb = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: bookT, transparent: true, opacity: 0, depthWrite: false, fog: false })); fb.scale.set(.9, 1.3, 1); fb.renderOrder = 19.5; scene.add(fb);
let fT = 8, fA = [0, 0, 0], fB = [0, 0, 0]; const FD = 7;
function floater(dt) { fT -= dt; if (fT < -FD) { fT = 12 + Math.random() * 14; } if (fT > 0) { fb.material.opacity = 0; return; }
  if (fT > -dt * 1.01 || fb.userData.go !== 1) { if (fb.userData.go !== 1) { fb.userData.go = 1; const s = Math.random() < .5 ? -1 : 1; fA = [-9 * s, 5 + Math.random() * 4, -12]; fB = [9 * s, 4 + Math.random() * 6, -12]; } }
  const u = -fT / FD, e = ease(u); fb.position.set(fA[0] + (fB[0] - fA[0]) * e, fA[1] + (fB[1] - fA[1]) * e + Math.sin(u * Math.PI) * .6, fA[2]); fb.rotation.z = Math.sin(u * 6) * .25; fb.material.opacity = Math.sin(u * Math.PI) * .85; if (u > .99) fb.userData.go = 0; }
// rays of warm light from the bright top of the well (Eddie 2026-11-17: "make the lights really come down ... like a real 3D"), laid out for the station you stand at (placeAir, on every arrival).
// ONE instanced draw of soft open columns, all parallel (one sun through the oculus): each glows through its middle with soft edges and a noise drifting down it, and keeps its place in the
// room as you turn and walk. Beams that land on the station's floor come all the way down and leave a warm pool where they land (the same draw: the geometry's floor disc); beams in the open
// well fall past and fade; a few lean into the well's wall, and the wall shader lights the books they cross (walls.setBeams); one lights the Wonder Hall's stage. Dust drifts down only
// inside the beams, thickest in the ones near you. Fainter looking level, full looking up, so the books at the cases are never washed out.
const WC = room.wellCentre ?? [0, 0, 2.5], RW = room.walls, rU = { uT: { value: 0 }, uUp: { value: 0 }, uWl: { value: new THREE.Vector4(WC[0], WC[2], RW.well.r, 1) }, uHw: { value: new THREE.Vector4(RW.home.z, RW.home.x[1], RW.door.z, RW.door.x[1]) } }, RL = 104, TWO_PI = Math.PI * 2, rs = i => { const x = Math.sin(i * 91.7 + 3.1) * 43758.5; return x - Math.floor(x); };
const NOISE = "float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f *= f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }";
const rayMat = new THREE.ShaderMaterial({ uniforms: rU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,  // instanceColor: strength, the foot's fade (m), the pool's size (0: no pool)
  vertexShader: `attribute float aCap; varying vec3 vN, vV, vA, vI, vW; varying vec2 vQ; varying float vH, vD, vL, vCap, vBy; void main() { mat4 M = modelMatrix * instanceMatrix; vI = instanceColor; vCap = aCap; vL = length(M[1].xyz); vA = M[1].xyz / vL; vec3 foot = (M * vec4(0., -.5, 0., 1.)).xyz; vBy = foot.y; vec4 w;
    if (aCap > .5) { w = vec4(foot + vec3(position.x, 0., position.y) * length(M[0].xyz) * instanceColor.z + vec3(0., .02, 0.), 1.); vQ = position.xy; vH = 0.; } else { w = M * vec4(position, 1.); vQ = position.xz; vH = position.y + .5; }
    vN = normalize(mat3(M) * normal); vV = normalize(cameraPosition - w.xyz); vD = length(cameraPosition - w.xyz); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uT, uUp; uniform vec4 uWl, uHw; varying vec3 vN, vV, vA, vI, vW; varying vec2 vQ; varying float vH, vD, vL, vCap, vBy; ${NOISE}
  void main() { float a, s = vH * vL, lv = vI.z > 0. ? .5 : -vI.z, up = lv + (1. - lv) * uUp, fan = step(lv, .2);  // z: a landing beam's pool size, or minus its strength looking level; fan: home's rays from the oculus
    float dw = min(uWl.z - length(vW.xz - uWl.xy), uWl.w > .5 ? min(abs(vW.x) < uHw.y ? abs(vW.z - uHw.x) : 9., abs(vW.x) < uHw.w ? abs(vW.z - uHw.z) : 9.) : 9.);  // metres to the nearest wall: a beam melts into the books it meets (they light up there), never a hard edge
    if (vCap > .5) { if (vI.z <= 0.) discard; a = vI.x * .34 * smoothstep(1., .08, length(vQ)) * (.7 + .3 * vn(vQ * 2.5 + uT * .1)) * (.65 + .35 * up); }
    else { float e = abs(dot(normalize(vN), normalize(vV))), on = smoothstep(.5, .9, abs(dot(vA, vV))) * smoothstep(6., 30., vD), body = mix(pow(e, .9), mix(.55, .8, fan), on), core = mix(pow(e, 5.), mix(.6, .9, fan), on);  // end-on glow only far off (up the well), never a beam beside you
      float n = vn(vec2(vQ.x * 2.3 + s * .03, s * .09 + uT * .5)) * .6 + vn(vec2(vQ.y * 3.7 - s * .04, s * .25 + uT * 1.1)) * .4;  // the noise drifts down the beam
      a = mix(.85, 1., fan) * (body * .3 + core * .6) * vI.x * smoothstep(0., vI.y, s) * smoothstep(1., .72, vH) * (.62 + .38 * vH) * mix(.55 + .8 * n, .72 + .5 * n, fan) * up * smoothstep(.4, 2.5, vD) * smoothstep(-3., 3., cameraPosition.y - vBy) * smoothstep(0., 2.2, dw); }
    gl_FragColor = vec4(vec3(1., .82, .5) * a, a); }` });
const rayAxis = new THREE.Vector3(-.16, 1, -.1).normalize(), rayQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rayAxis), rayGeo = mergeGeometries([new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), new THREE.CircleGeometry(1, 28)]);
rayGeo.setAttribute("aCap", new THREE.BufferAttribute(new Float32Array(rayGeo.attributes.position.count).map((_, i) => +(i >= 17 * 2)), 1));  // the column's 34 vertices first, then the floor disc's
const rays = [], NR = phone ? 16 : 28, rayMesh = new THREE.InstancedMesh(rayGeo, rayMat, NR), RM = new THREE.Matrix4(), RC = new THREE.Color();
rayMesh.renderOrder = 29; rayMesh.frustumCulled = false; rayMesh.name = "rays"; scene.add(rayMesh);
const DN = phone ? 900 : 3200, dP = new Float32Array(DN * 3), dAx = new Float32Array(DN * 3), dR = new Float32Array(DN * 4);
for (let i = 0; i < DN; i++) dR.set([rs(i + 11), .002 + rs(i + 13) * .004, rs(i + 15), .6 + rs(i + 17) * 1.4], i * 4);
const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dP, 3)); dg.setAttribute("aAx", new THREE.BufferAttribute(dAx, 3)); dg.setAttribute("aR", new THREE.BufferAttribute(dR, 4));
function placeAir(id) {  // the beams, their dust, the motes and the mist for station id (the home layout moved and re-laid for each room); the lamps of hidden bookcases hidden
  const s = STATIONS.find(q => q.id === id) ?? home(), E = new THREE.Vector3(...s.cam.p), fy = E.y - 1.7, d = E.clone().sub(new THREE.Vector3(...home().cam.p)), seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const fl = room.layers.find(l => Math.abs(Math.abs(l.rot?.[0] ?? 0) - Math.PI / 2) < .01 && !l.rot?.[1] && Math.abs(l.p[1] - fy) < .3 && Math.abs(E.x - l.p[0]) < l.size[0] / 2 && Math.abs(E.z - l.p[2]) < l.size[1] / 2);  // the floor you stand on
  const F = fl ? [fl.p[0] - fl.size[0] / 2 + .9, fl.p[0] + fl.size[0] / 2 - .9, fl.p[2] - fl.size[1] / 2 + .9, fl.p[2] + fl.size[1] / 2 - .9] : [E.x - 3, E.x + 3, E.z - 3, E.z + 3];
  const cases = grown.setStation.includes(id), add = (B, r, I, fade, pool, near) => rays.push({ B, r, I, L: RL, fade, pool, w: near / (1 + Math.hypot(B.x - E.x, B.z - E.z) / 6) }); rays.length = 0;
  if (!cases) add(new THREE.Vector3(E.x, fy, E.z - 3.2), 1.5, 1.1, .6, 1.5, 2);  // a stage (the Wonder Hall): one beam straight onto its middle
  for (let j = 0, n = 0; j < 300 && n < (phone ? 3 : 5); j++) { const x = F[0] + rs(seed + j) * (F[1] - F[0]), z = F[2] + rs(seed + j + 300) * (F[3] - F[2]);  // onto the floor: never between you and the books, never on you
    if ((cases && Math.abs(x - E.x) < 3.1 && z > E.z - 6.4 && z < E.z + .8) || Math.hypot(x - E.x, z - E.z) < 1.4 || rays.some(q => Math.hypot(q.B.x - x, q.B.z - z) < 2.6)) continue;
    add(new THREE.Vector3(x, fy, z), .45 + rs(seed + j + 600) * .4, .8 + rs(seed + j + 900) * .4, .6, 1.7, 2); n++; }
  if (id === home().id) for (let i = 0; i < (phone ? 12 : 22); i++) { const grp = i % 3, ang = rs(i) * TWO_PI, rad = [2.5 + rs(i + 40) * 3, 6 + rs(i + 40) * 7, 14 + rs(i + 40) * 10][grp], r = [.7, 1.4, 2.8][grp] * (.7 + rs(i + 80) * .6);  // home: the fan of rays from the oculus Eddie
    add(new THREE.Vector3(WC[0] + Math.cos(ang) * rad, fy - 12, WC[2] + Math.sin(ang) * rad), r, (grp ? 1 : .55) * (.6 + rs(i + 120) * .6), 23, -.12, 1); }  // loves (the old near, middle and far beams, rising from below the balcony; faint looking level)
  else { const k = id === "wonder" ? .6 : 1, lean = Math.atan2(rayAxis.z, rayAxis.x);  // the rooms: beams down the open well past the floor, and a few that lean into the wall and cross the books higher up (fewer and softer in the Wonder Hall, where they all meet overhead)
    for (let j = 0, n = 0; j < 600 && n < Math.round((phone ? 6 : 13) * k); j++) { const an = rs(seed + j + 1200) * TWO_PI, rad = 5 + rs(seed + j + 1500) * 17, B = new THREE.Vector3(WC[0] + Math.cos(an) * rad, fy - 28, WC[2] + Math.sin(an) * rad);
      const at = B.clone().addScaledVector(rayAxis, 28 / rayAxis.y), top = B.clone().addScaledVector(rayAxis, RL); if ((at.x > F[0] - 1.6 && at.x < F[1] + 1.6 && at.z > F[2] - 1.6 && at.z < F[3] + 1.6) || Math.hypot(top.x - WC[0], top.z - WC[2]) > 24) continue;
      add(B, (.8 + rad * .07) * (.75 + rs(seed + j + 1800) * .5), k * (.7 + rs(seed + j + 2100) * .5), 24, -.28, 1); n++; }
    for (let j = 0; j < Math.round((phone ? 3 : 6) * k); j++) { const an = lean + (rs(seed + j + 2400) - .5) * 2.4, rad = 20 + rs(seed + j + 2700) * 3; add(new THREE.Vector3(WC[0] + Math.cos(an) * rad, fy - 10, WC[2] + Math.sin(an) * rad), 1.6 + rs(seed + j + 3000) * .8, k * (.8 + rs(seed + j + 3300) * .4), 10, -.28, 1); } }
  rays.forEach((q, i) => { rayMesh.setMatrixAt(i, RM.compose(q.B.clone().addScaledVector(rayAxis, q.L / 2), rayQ, new THREE.Vector3(q.r, q.L, q.r))); rayMesh.setColorAt(i, RC.setRGB(q.I, q.fade, q.pool)); });
  rayMesh.count = rays.length; rayMesh.instanceMatrix.needsUpdate = true; rayMesh.instanceColor.needsUpdate = true; rU.uWl.value.w = +(id !== "wonder");
  const meets = q => { const T = q.B.clone().addScaledVector(rayAxis, q.L), m = 1.3 * q.r, plane = (z0, hx) => { if (Math.min(q.B.z, T.z) - m > z0 || Math.max(q.B.z, T.z) + m < z0) return false; const t = Math.min(1, Math.max(0, (z0 - q.B.z) / (T.z - q.B.z))); return Math.abs(q.B.x + (T.x - q.B.x) * t) < hx + m; };
    return Math.max(Math.hypot(q.B.x - WC[0], q.B.z - WC[2]), Math.hypot(T.x - WC[0], T.z - WC[2])) > RW.well.r - m - .5 || (id !== "wonder" && (plane(RW.home.z, RW.home.x[1]) || plane(RW.door.z, RW.door.x[1]))); };
  walls.setBeams(rays.filter(meets), rayAxis);  // only the beams that reach a wall light the books (fewer to sum per pixel)
  const wsum = rays.reduce((a, q) => a + q.w, 0); let di = 0;  // the dust: near the floor in a beam that lands, round your eye height in the rooms' others
  for (const q of rays) { const fan = q.pool === -.12, st0 = q.pool > 0 || fan ? 0 : Math.max(0, (E.y - 15 - q.B.y) / rayAxis.y), span = q.pool > 0 ? 16 : fan ? q.L : 40;  // home's fan: dust all the way up, as before
    for (let k = 0, n = Math.round(DN * q.w / wsum); k < n && di < DN; k++, di++) { const rr = Math.sqrt(rs(di + 7)) * q.r * .9, an = rs(di + 9) * TWO_PI;
      dP.set([q.B.x + rayAxis.x * st0 + Math.cos(an) * rr, q.B.y + rayAxis.y * st0, q.B.z + rayAxis.z * st0 + Math.sin(an) * rr], di * 3); dAx.set([rayAxis.x * span, rayAxis.y * span, rayAxis.z * span], di * 3); } }
  dg.setDrawRange(0, di); dg.attributes.position.needsUpdate = dg.attributes.aAx.needsUpdate = true;
  motes.position.copy(d); mist.forEach(m => { m.userData.p0 ??= m.position.clone(); m.position.copy(m.userData.p0).add(d); }); lamps.show(id); }
const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: rU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  vertexShader: "uniform float uT, uUp; attribute vec3 aAx; attribute vec4 aR; varying float vA; void main() { float t = fract(aR.x - uT * aR.y); vec3 p = position + aAx * t + vec3(sin(uT * .3 + aR.z * 6.), sin(uT * .22 + aR.x * 9.) * .4, cos(uT * .27 + aR.z * 5.)) * .25; vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aR.w * 260. / -mv.z, 2., 16.); vA = smoothstep(0., .1, t) * smoothstep(1., .85, t) * (.4 + .6 * smoothstep(60., 3., -mv.z)) * (.7 + .3 * sin(uT * 1.3 + aR.z * 20.)) * (.5 + .5 * uUp); }",
  fragmentShader: "varying float vA; void main() { float d = length(gl_PointCoord - .5) * 2.; float a = smoothstep(1., .15, d) * vA * .95; gl_FragColor = vec4(vec3(1., .88, .58) * a, a); }" }));
dust.frustumCulled = false; dust.renderOrder = 29; scene.add(dust);

// ---- the ring (L4): the other cases dim, a caption under the front book, X, and the carry to the reader when a real book is picked
const dimMesh = room.cases.map(c => { const bd = c.bounds, m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, opacity: 0, depthWrite: false, fog: false })); if (bd) { m.position.set((bd.min[0] + bd.max[0]) / 2, (bd.min[1] + bd.max[1]) / 2, bd.max[2] + .5); m.scale.set((bd.max[0] - bd.min[0]) * 1.9, (bd.max[1] - bd.min[1]) * 1.5, 1); } m.renderOrder = 31; scene.add(m); return m; });
const ringName = () => { const b = books.bookAt(ring.frontGlobal); $("#ringb").setAttribute("aria-label", b ? b.title.en + (lang !== "en" && b.title[lang] ? " — " + b.title[lang] : "") : W.still); };
$("#ringb").__i = 0; $("#ringb").onclick = () => { if (!pick) startPick(); };  // __i set: the ring's Enter handler treats this button as the front book itself
let capFor = -2; function capText(force) { if (!ring.isOpen || ring.busy) { if (!ring.isOpen) capFor = -2; return; } const g = ring.frontGlobal; if (g === capFor && !force) return; capFor = g; ringName(); const c = $("#cap"), b = books.bookAt(g); c.hidden = false; c.textContent = ""; const t = document.createElement("b"), n = document.createElement("span"); if (b) t.append(titleNodes(b.title.en, lang !== "en" ? b.title[lang] ?? "" : "", lang)); else t.textContent = W.still; n.textContent = b?.status === "making" ? W.coming : ""; c.append(t, n); }  /* a ready book: its title only; the cover itself opens it, and the ring's tap hint shows how (owner 2026-11-17: no Open the book button) */
$("#ringp").onclick = () => ring.step(-1); $("#ringn").onclick = () => ring.step(1);
const carryVeil = $("#carry"); let pick = null; $("#ringx").onclick = () => closeRing();
function startPick() { const g = ring.pick(); if (g < 0) return; if (books.isReal(g)) books.dim(g); if (!books.isReal(g)) { ring.cancelPick?.(); capFor = -2; capText(true); return; } const b = books.bookAt(g); if (b.status === "making") { ring.cancelPick?.(); capFor = -2; capText(true); say(W.coming, b.title.en); return; }  // a book still being made: the ring wakes, a soft note, the reader never opens
  cue("book-open", .9); pick = { t: 0, href: new URL(b.link, new URL("../", import.meta.url)).href + "&from=shelf" }; $("#ringx").hidden = true; $("#cap").hidden = true; }  // the same hand-off as the shelf: ../live/?book=<id>&s=s01&from=shelf
// ---- navigation: stations and links (room.stations / room.links), a look-around controller, arrows that walk
// shortcut: only if room.json has no stations, two are faked (home = the balcony, near = three metres closer to the cases)
const STATIONS = room.stations ?? [{ id: "home", cam: room.cams.room, links: [{ to: "near", path: [] }] }, { id: "near", cam: { p: [0, 1.9, 3.3], look: [0, 2.3, -2], fov: 50 }, links: [{ to: "home", path: [] }] }];
const LINKS = STATIONS.flatMap(q => (q.links ?? []).map(l => ({ from: q.id, ...l }))); for (const l of [...LINKS]) if (!LINKS.some(r => r.from === l.to && r.to === l.from)) LINKS.push({ from: l.to, to: l.from, path: [...(l.path ?? [])].reverse() });
const st = id => STATIONS.find(q => q.id === id), home = () => st("home") ?? STATIONS[0];
const stCam = s => { const c = innerWidth / innerHeight < .85 && s.id === "home" && room.cams.roomPhone ? room.cams.roomPhone : s.cam; if (c !== room.cams.roomPhone) return c;
  // upright phone at home: the middle two cases (x -2.0..2.0) fill the width and the outer two peek in as half-seen edges that invite a drag; covers come out about 47 px tall
  const half = 2.3, dist = c.p[2] - .3, fov = Math.min(110, Math.max(40, 2 * Math.atan(half / (dist * (innerWidth / innerHeight))) * 180 / Math.PI)); return { ...c, fov, look: [c.look[0], c.p[1], c.look[2]] }; };
const sP = s => new THREE.Vector3(...stCam(s).p), sFov = s => stCam(s).fov ?? 60, sYaw = s => { const c = stCam(s); return Math.atan2(c.look[0] - c.p[0], -(c.look[2] - c.p[2])); }, sPitch = s => { const c = stCam(s); return Math.atan2(c.look[1] - c.p[1], Math.hypot(c.look[0] - c.p[0], c.look[2] - c.p[2])); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), TAU = Math.PI * 2;
const lim = () => { const l = st(cur).look ?? {}; return cur === home().id && innerWidth / innerHeight < .85 ? { ...l, yawMin: -1.75, yawMax: 1.75 } : l; },  // an upright phone at home stands close to the entrance: the turn stops before the door fills the screen
  cP = p => Math.max(lim().pitchMin ?? -1.4, Math.min(lim().pitchMax ?? 1.4, p)), cY = y => { const l = lim(); return l.yawMax - l.yawMin < 6.2 ? Math.max(l.yawMin, Math.min(l.yawMax, y)) : wrap(y); };
let cur = home().id, yaw = sYaw(home()), pitch = sPitch(home()), vI = [0, 0], yawOff = 0, pitchOff = 0, pe = [0, 0], walk = null, camPos = sP(home()), fov = sFov(home());
const size = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (!walk) { camPos = sP(st(cur)); fov = sFov(st(cur)); } arrowsFor(); }; addEventListener("resize", size);

// glowing paper arrows: one per link out of the station, on the floor ahead of the way; billboards, tapped to walk
const arrowT = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, "rgba(255,214,130,.55)"); g.addColorStop(1, "rgba(255,190,90,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#ffe3a0"; x.strokeStyle = "#a8691f"; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 26); x.lineTo(98, 70); x.lineTo(76, 70); x.lineTo(76, 98); x.lineTo(52, 98); x.lineTo(52, 70); x.lineTo(30, 70); x.closePath(); x.fill(); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const arrows = []; let hoverArrow = -1;
function arrowsFor() {
  for (const a of arrows) { scene.remove(a); a.material.dispose(); } arrows.length = 0; if (walk) return;
  const A = sP(st(cur));
  for (const l of LINKS.filter(q => q.from === cur && !q.portal)) { const next = [...(l.path ?? []), sP(st(l.to)).toArray()].map(q => new THREE.Vector3(...q)).find(q => q.distanceTo(A) > .6) ?? sP(st(l.to)), d = next.clone().sub(A).setY(0), dist = d.length(); if (dist < .01) continue; d.normalize();
    const a = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: arrowT, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, opacity: .7 }));
    a.position.copy(A).addScaledVector(d, Math.min(2.4, dist * .6)); a.position.y = A.y - 1.66; a.rotation.set(-Math.PI / 2, Math.atan2(-d.x, -d.z), 0, "YXZ"); if (l.at) a.position.set(...l.at); a.scale.setScalar(.8); a.renderOrder = 80; a.userData.link = l; a.userData.base = a.position.y; scene.add(a); arrows.push(a); }
}
// portals (L5): an arched doorway in the wall for every link marked portal (portals.js); walking into one jumps to its room. Portals of the station you stand at are shown.
const portalMeshes = [], portals = []; let hoverPortal = null, focusPortal = null;
for (const lk of LINKS.filter(q => q.portal)) { const p = lk.floor ? createFloorPortal(THREE, lk, regionPlaque(lk, catalog.regions ?? [], lang)) : lk.stairUp ? createStairUp(THREE, lk, regionPlaque(lk, catalog.regions ?? [], lang), renderer) : createPortal(THREE, plane, lk, lk.size ?? [1.17, 2.6], regionPlaque(lk, catalog.regions ?? [], lang)); p.group.visible = false; scene.add(p.group); portals.push(p); portalMeshes.push(p.frame); }
addEventListener("library:plaque", () => portalLabels?.());
const portalLabels = () => portals.forEach(p => p.setLabel(regionPlaque(p.frame.userData.link, catalog.regions ?? [], lang)));
function onStation() { living?.setStation(cur); wonders.setStation(cur); placeAir(cur);
  const near = id => id === cur || LINKS.some(l => l.from === cur && l.to === id && !l.portal);  // a platform's 3D cases show only where you stand or can walk to: from a lower room the others read as dark bars across the light
  if (c3) { c3.group.visible = near(grown.setStation[0]); c3.clones.forEach((c, j) => { c.visible = near(grown.setStation[j + 1]); }); }
  grown.setStation.forEach((sid, k) => { const on = near(sid); if (setShown[k] === on) return; setShown[k] = on; for (let i = k * 48; i < k * 48 + 48; i++) if (books.xf[i]) on ? books.home(i) : books.set(i, books.xf[i].p, books.xf[i].q, ZERO); });  // and so do its books (scaled to nothing), never floating without their cases
  homeWalls ??= scene.children.filter(o => /^(wall_\d|wall_home|doorwall_)/.test(o.name)); for (const o of homeWalls) o.visible = cur !== "wonder";
  behindDoor ??= scene.children.filter(o => /^(bridge|arm)_\d+$/.test(o.name) && o.position.z > (room.layers.find(l => l.id === "facade")?.p[2] ?? 9)); for (const o of behindDoor) o.visible = cur !== "home";  // the well's bridges and lamp arms beyond the entrance wall: from the balcony they were drawn over the door (no depth on the cards), hanging in the air  // the home walls' repeats end in the open well: from the Wonder Hall, 150 m below, their ends would hang in the light
  const k0 = grown.setStation.indexOf(cur); if (k0 >= 0) { const first = [...Array(48).keys()].map(i => k0 * 48 + i).find(i => books.isReal(i)); if (first != null) (window.requestIdleCallback ?? (f => setTimeout(f, 1500)))(() => !ring.isOpen && front.prewarm(first)); } for (const p of portals) p.group.visible = p.frame.userData.link.from === cur; rebuildShelf(); }
const fade = document.createElement("div"); fade.className = "fade"; document.body.append(fade);
let opening = false;
const swap = fn => { fade.style.opacity = .9; setTimeout(() => { fn(); fade.style.opacity = 0; }, 210); }, eyeOpts = () => ({ eye: camPos.clone(), yaw }),
  openRing = i => { if (walk || opening || ring.isOpen) return; opening = true; Promise.race([front.prewarm(i), new Promise(r => setTimeout(r, 400))]).then(() => { opening = false; if (walk || ring.isOpen) return; const go = () => { ring.open(i, eyeOpts()); cue("ring-open", .8); }; if (reduced) swap(go); else go(); }); },  // the books fly only once their models are built, compiled and uploaded
  closeRing = () => reduced ? swap(() => ring.close()) : ring.close();
function goto(id) {
  const A = st(cur), B = st(id), l = LINKS.find(q => q.from === cur && q.to === id); if (walk) return; if (l?.href) { location.assign(new URL(l.href, import.meta.url).href); return; } if (l?.soon) { const pl = regionPlaque(l, catalog.regions ?? [], lang); say(pl.name, pl.sub); return; } if (!B) return;
  const pts = l?.portal ? (l.path ?? []).map(q => new THREE.Vector3(...q)) : [sP(A), ...(l?.path ?? []).map(q => new THREE.Vector3(...q)), sP(B)], len = pts.reduce((n, p, i) => n + (i ? p.distanceTo(pts[i - 1]) : 0), 0);
  const w = { pts, len, t: 0, dur: l?.portal ? WALK_IN : Math.min(3, Math.max(2, 1.4 + len * .12)), y0: yaw, y1: yaw + wrap(sYaw(B) - yaw), p0: pitch, p1: sPitch(B), f0: fov, f1: sFov(B), id, jump: !!l?.portal && !l.floor && !l.stairUp };
  if (l?.portal) w.con = regionPlaque(l, catalog.regions ?? [], lang).con;
  if (reduced) { if (l?.portal && !l.floor && !l.stairUp) { w.jump = true; walk = w; through(w); return; } w.stairs = !!(l?.floor || l?.stairUp); fade.style.opacity = 1;  // the floor has no warp, in reduced motion either: a plain fade to the hall
    setTimeout(() => { arrive(w); fade.style.opacity = 0; }, 260); return; }
  landed(); if (l?.floor) { camPos = camPos.clone(); stairs(w, camPos, l); } else if (l?.stairUp) { camPos = camPos.clone(); climbs(w, camPos, l); } walk = w; vI = [0, 0]; arrowsFor();
}
function arrive(w) { if (w.jump && w.id === home().id) descend(.8, .4);  // back from a room by a portal: a short, low descent plays as the tunnel opens on the home bookcase
  cur = w.id; yaw = w.y1; pitch = w.p1; fov = w.f1; camPos = w.jump || w.stairs ? sP(st(w.id)) : w.pts[w.pts.length - 1].clone(); walk = null; arrowsFor(); onStation(); disarm(); if (!document.activeElement || document.activeElement === document.body) cv.focus({ preventScroll: true }); if (pending.length) setTimeout(() => goto(pending.shift()), 60); }
// a WALL portal (Eddie 2026-11-17, asks 2 and 4): the click walks you to the arch (WALK_IN s) and its tunnel swallows the view over the walk's last stretch (from PULL), then the same tunnel from the inside:
// dark blue, stars stretched and bent by the warp (TUNNEL with lens and stretch), the destination's constellation drawn silver-blue ahead, a brief pale blue-white glow at the tunnel's end as you arrive (ARR),
// and the tunnel opens from its far end onto the new room (uOpen). No gold. Arch to standing about 1.8 s (2.1 s home, with its short drop onto the bookcase), click to arrival about 2.2 s. Reduced motion: a still tunnel faded in and out with the constellation.
const WALK_IN = 1.55, PULL = .55, WARP = 1.15, ARR = .55;
const warpU = { uT: { value: 0 }, uTw: { value: 0 }, uR: { value: 0 }, uA: { value: 0 }, uBloom: { value: 0 }, uForm: { value: 0 }, uSt: { value: 0 }, uAsp: { value: 1 }, uOpen: { value: 0 }, uLens: { value: 0 }, uStr: { value: 1 }, uC: { value: new THREE.Vector2(.5, .5) }, uPts: { value: Array.from({ length: 10 }, () => new THREE.Vector2()) }, uLn: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) } };
const warpMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: warpU, transparent: true, depthTest: false, depthWrite: false, vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
  fragmentShader: `uniform float uT, uTw, uR, uA, uBloom, uForm, uSt, uAsp, uOpen, uLens, uStr; uniform vec2 uC, uPts[10]; uniform vec4 uLn[12]; varying vec2 vUv;
${TUNNEL}
void main() {
  vec2 s = (vUv - uC) * vec2(uAsp, 1.); float cover = (1. - smoothstep(uR - .4, uR, length(s))) * uA;
  vec2 c = mix(uC, vec2(.5), clamp(uR / 2.4, 0., 1.)), p = (vUv - c) * vec2(uAsp, 1.); float r = length(p);
  if (uOpen > 0.) cover *= smoothstep(uOpen * .6, uOpen, r);  // the way out opens at the far end
  vec2 q = p * 1.6; vec3 col = tunnel(q, uT, uTw, length(fwidth(q)) / uStr, uLens, .12 * vec2(sin(uT * .3), cos(uT * .23)));
  float cons = 0.; if (uSt > .001) { float sc = .62 * mix(.15, 1., uForm);
    for (int i = 0; i < 10; i++) { vec2 pt = (uPts[i] - vec2(50., 30.)) / 60. * vec2(1., -1.) * sc; cons += exp(-length(p - pt) * 80.) * .6 * step(.01, uPts[i].x); }
    for (int i = 0; i < 12; i++) { vec2 a0 = (uLn[i].xy - vec2(50., 30.)) / 60. * vec2(1., -1.) * sc, b0 = (uLn[i].zw - vec2(50., 30.)) / 60. * vec2(1., -1.) * sc, pa = p - a0, ba = b0 - a0; float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0., 1.); cons += smoothstep(.004, 0., length(pa - ba * t)) * .22 * step(.01, uLn[i].x + uLn[i].z); }
    cons *= uSt; col += vec3(.72, .82, 1.) * cons; }
  col += vec3(.75, .86, 1.) * uBloom * (exp(-r * r * 70.) * .5 + .03);  // the light at the tunnel's end as you arrive
  float al = max(cover, clamp(cons, 0., 1.) * uA);
  if (al < .002) discard; gl_FragColor = vec4(col, al);
}` }));
warpMesh.frustumCulled = false; warpMesh.renderOrder = 999; scene.add(warpMesh);  // visible (and fully discarded, uA 0) for the first frames, so its shader compiles behind the loading cover, not on the first click
let warp = null; const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function through(w) { cue("portal-through", .6); const [pts, lns] = STARS[w.con ?? 0]; warpU.uPts.value.forEach((v, i) => pts[i] ? v.set(...pts[i]) : v.set(0, 0)); warpU.uLn.value.forEach((v, i) => lns[i] ? v.set(...pts[lns[i][0]], ...pts[lns[i][1]]) : v.set(0, 0, 0, 0));
  w.frozen = true; warp = { t: 0, w, arrived: false, dur: reduced ? 1.3 : WARP }; warpMesh.visible = true; }
function warpStep(dt) {
  warpU.uAsp.value = innerWidth / innerHeight; const U = warpU;
  if (!warp) { if (walk?.jump && !walk.frozen && walk.t > PULL) { const u = Math.min(1, (walk.t - PULL) / (1 - PULL)), p = portals.find(q => q.frame.userData.link.to === walk.id && q.frame.userData.link.from === cur);  // the pull: the arch's tunnel swallows the view
      if (p) { const v = p.group.position.clone().project(camera); U.uC.value.set((v.x + 1) / 2, (v.y + 1) / 2); } warpMesh.visible = true; U.uA.value = 1; U.uR.value = 3 * Math.pow(u, 1.5); U.uT.value += dt * (.5 + 2.5 * u); U.uTw.value += dt * (.16 + .8 * u); U.uLens.value = 0; U.uStr.value = 1 + .5 * u; U.uOpen.value = 0; U.uSt.value = 0; U.uBloom.value = 0; U.uForm.value = 0; }
    else if (warpMesh.visible && frameNo > 2) warpMesh.visible = false; return; }
  const t = warp.t += dt, k = warp.w;
  if (reduced) { U.uT.value = 2; U.uTw.value = 0; U.uLens.value = 0; U.uStr.value = 1; U.uOpen.value = 0; U.uR.value = 3; U.uA.value = t < .35 ? t / .35 : Math.max(0, 1 - (t - .7) / .6); U.uForm.value = 1; U.uSt.value = ss(0, .35, t) * (1 - ss(.9, 1.3, t)); U.uBloom.value = 0; U.uC.value.set(.5, .5); if (!warp.arrived && t >= .45) { warp.arrived = true; arrive(k); } }
  else { const ramp = t < ARR ? 1 : 1 - (t - ARR) / (WARP - ARR); U.uC.value.set(.5, .5); U.uR.value = 3; U.uA.value = 1; U.uT.value += dt * (1.5 + 4.5 * ramp); U.uTw.value += dt * (.3 + ramp); U.uLens.value = .07 * ss(0, .3, t) * ramp; U.uStr.value = 1.5 + ramp;
    U.uOpen.value = t < ARR ? 0 : Math.pow((t - ARR) / (WARP - ARR), 1.3) * 2.2; U.uForm.value = ss(0, .45, t); U.uSt.value = ss(0, .15, t) * (1 - ss(ARR, WARP - .1, t)); U.uBloom.value = .9 * Math.max(0, 1 - Math.abs(t - ARR) / .2);
    if (!warp.arrived && t >= ARR) { warp.arrived = true; arrive(k); } }
  if (t >= warp.dur) { warp = null; warpMesh.visible = false; } }
// the FLOOR portal (Eddie 2026-11-17, ask 3: "just make the animation of going down stairs is enough, don't warp"): the walk runs straight through the gap in the railing and meets the stair's helix on its tangent
// (so there is no corner), then goes down STAIR.turns of a turn round the post (stooping to STAIR.low once the turn above is overhead: the set has 1.2 m a turn), looking ahead and down the steps, the gold from below growing (the well's surge); a soft dim at the bottom, then the Wonder Hall.
// The stair is stairwell.glb's (make_stairwell.py): first tread 0.10 m down at 0.9 rad, 10 treads a turn, 0.12 m rise, angle measured from +z toward +x. Speeds in m/s along the path (the approach takes about 1 s from wherever home's camera stands), eased in and out.
const STAIR = { R: .65, turns: 1.05, rot: .9, rise: .12 / (TAU / 10), top: .1, eye: 1.25, low: .9, va: 3.2, vh: 2.1 };
const sp = x => .5 * (x + Math.sqrt(x * x + .0025)), treadY = th => -sp(STAIR.top + STAIR.rise * (th - STAIR.rot));  // the tread under the eye, rounded off where the floor meets the first step
function stairs(w, A, l) { const C = new THREE.Vector3(l.at[0], 0, l.at[2]), Dh = Math.hypot(A.x - C.x, A.z - C.z), th = Math.atan2(A.x - C.x, A.z - C.z) + Math.acos(Math.min(1, STAIR.R / Dh));
  const E = new THREE.Vector3(C.x + STAIR.R * Math.sin(th), A.y + treadY(th), C.z + STAIR.R * Math.cos(th)), La = E.distanceTo(A);
  Object.assign(w, { stairs: true, C, A: A.clone(), E, th0: th, La, d: 0, s: 0, D: La + STAIR.R * STAIR.turns * TAU, va: Math.max(STAIR.va, La / 1.05), fS: innerWidth / innerHeight < .85 ? 80 : 62 }); }
function stairStep(w, dt) { const R = STAIR.R, rem = w.D - w.d;
  w.s += dt; w.d = Math.min(w.D, w.d + (w.va + (STAIR.vh - w.va) * ss(w.La - 1.2, w.La, w.d)) * Math.min(1, .3 + w.s / .45) * Math.max(.3, Math.min(1, rem / .8)) * dt); w.t = w.d / w.D;
  if (w.d <= w.La) { const f = w.d / w.La, head = Math.PI / 2 - w.th0; camPos.lerpVectors(w.A, w.E, f); camPos.y = w.A.y + (w.E.y - w.A.y) * f * f; yaw = w.y0 + wrap(head - w.y0) * ss(0, .7, f); pitch = w.p0 + (-.5 - w.p0) * ss(0, 1, f); fov = w.f0 + (w.fS - w.f0) * ss(0, 1, f); }
  else { const th = w.th0 + (w.d - w.La) / R, k = ss(w.th0, w.th0 + STAIR.turns * TAU, th); camPos.set(w.C.x + R * Math.sin(th), w.A.y + treadY(th) + (STAIR.eye - w.A.y) * ss(w.th0, w.th0 + 2, th) + (STAIR.low - STAIR.eye) * ss(w.th0 + 4.6, w.th0 + 5.8, th), w.C.z + R * Math.cos(th)); yaw = Math.PI / 2 - th - .55 * ss(w.th0, w.th0 + 2, th); pitch = -.55 - .15 * k; fov = w.fS; }
  fade.style.opacity = .92 * ss(w.D - .6, w.D - .05, w.d);  // the soft dim at the bottom (the fade's own .2 s transition smooths it)
  if (w.d >= w.D) { arrive(w); setTimeout(() => { fade.style.opacity = 0; }, 140); } }
// the way back UP from the Wonder Hall (Eddie 2026-11-17: "use Blender to do the staircase that goes back up"): the walk crosses the hall to the foot of stairup.glb's spiral (make_stairup.py bakes its foot at CLIMB.rot + 40 treads, where this walk's
// line from the arrival view meets it), climbs 2.4 of its 4 turns round the post looking ahead and up (the underside of the treads above, then the column of the library's light that swallows its top), the light growing (the stair's surge), a soft dim over the last 0.6 m, then home.
// Treads rise 0.2 m, 10 to a turn (CLIMB.rise m a radian along the stair line, measured from the foot); the eye is 1.3 m up because a turn is 2.0 m (the tread above is 1.8 m over the tread). Same speeds as the descent: a walk across (the hall is 8 m wide), then the stair.
const CLIMB = { R: .65, rot: 5.2796, treads: 40, rise: .2 / (TAU / 10), eye: 1.3, end: 15, vh: 4.5 };
function climbs(w, A, l) { const C = new THREE.Vector3(...l.at), th = CLIMB.rot + CLIMB.treads * TAU / 10, E = new THREE.Vector3(C.x + CLIMB.R * Math.sin(th), C.y + CLIMB.eye + sp(.1), C.z + CLIMB.R * Math.cos(th)), La = Math.hypot(E.x - A.x, E.z - A.z);
  Object.assign(w, { stairs: true, climb: true, C, A: A.clone(), E, th0: th, La, d: 0, s: 0, D: La + CLIMB.R * CLIMB.end, va: La / 1.35, fS: innerWidth / innerHeight < .85 ? 80 : 62 }); }
function climbStep(w, dt) { const R = CLIMB.R, rem = w.D - w.d;
  w.s += dt; w.d = Math.min(w.D, w.d + (w.va + (CLIMB.vh - w.va) * ss(w.La - 1.2, w.La, w.d)) * Math.min(1, .3 + w.s / .45) * Math.max(.3, Math.min(1, rem / .8)) * dt); w.t = w.d / w.D;
  if (w.d <= w.La) { const f = w.d / w.La, head = Math.atan2(w.E.x - w.A.x, -(w.E.z - w.A.z)); camPos.lerpVectors(w.A, w.E, f); camPos.y = w.A.y + (w.E.y - w.A.y) * ss(0, 1, f); yaw = w.y0 + wrap(head - w.y0) * ss(0, .7, f); pitch = w.p0 + (.22 - w.p0) * ss(0, 1, f); fov = w.f0 + (w.fS - w.f0) * ss(0, 1, f); }
  else { const ph = (w.d - w.La) / R, th = w.th0 - ph; camPos.set(w.C.x + R * Math.sin(th), w.E.y + sp(.1 + CLIMB.rise * ph) - sp(.1), w.C.z + R * Math.cos(th)); yaw = 1.5 * Math.PI - th + .4 * ss(0, 2, ph); pitch = .22 + .15 * ss(0, 3, ph) + .55 * ss(8, 15, ph); fov = w.fS; }
  fade.style.opacity = .92 * ss(w.D - .6, w.D - .05, w.d);  // the soft dim at the top
  if (w.d >= w.D) { arrive(w); setTimeout(() => { fade.style.opacity = 0; }, 140); } }
const along = (pts, len, u) => { let d = u * len; for (let i = 1; i < pts.length; i++) { const sg = pts[i].distanceTo(pts[i - 1]); if (d <= sg || i === pts.length - 1) return pts[i - 1].clone().lerp(pts[i], Math.min(1, d / (sg || 1))); d -= sg; } return pts[pts.length - 1].clone(); };
const ease = t => t * t * (3 - 2 * t);
let pending = [];
function routeTo(id) {  // breadth-first over the links, then walk each step (a move is a walk or a portal)
  const prev = { [cur]: null }, q = [cur]; while (q.length) { const a = q.shift(); if (a === id) break; for (const l of LINKS.filter(k => k.from === a)) if (!(l.to in prev)) { prev[l.to] = a; q.push(l.to); } }
  if (!(id in prev)) return false; const path = []; for (let a = id; a !== null; a = prev[a]) path.unshift(a); pending = path.slice(2); if (path.length > 1) goto(path[1]); return true; }
function goHome() { if (cur !== home().id) routeTo(home().id); else { vI = [0, 0]; homing = true; } }
let homing = false; $("#home").onclick = goHome;
// ---- the arrival (owner 2026-11-16: "get to the Library and get down to the shelf, not just appear"): the camera comes down the well onto the home bookcase. A first visit's intro ends with the long fall (FALL s);
// a return visit gets the live move (FULL s), every later arrival in the same page (back through a portal, back from a book) the short one (SHORT s). A tap, a key or a drag ends it at the bookcase at once; reduced motion: none.
// The move is a smooth curve through way points [x, y, z, yaw, pitch, fov] ending on home's own pose; the fall's: through the doorway high on the entrance wall looking across the well, down the well looking down
// through the rays at the balcony below (turning a little, as the film did), then swinging level onto the bookcase. It starts already moving (the doors' push hands over to it) and eases out.
const FULL = 3.2, SHORT = 1.8, FALL = 4.4; let desc = null;
const FALL_AT = (e, tall = innerWidth / innerHeight < .85) => [[0, 30, 7.6, tall ? -.5 : 0, -.3, 72], [0, 22, 6.6, tall ? -.3 : .25, -.85, 76], [0, 15, 6.2, tall ? .2 : .5, -.95, 76], [e.x, e.y + 4.5, e.z + .3, .3, -.6, 70]];  // an upright phone starts turned left, where a light shaft falls into its narrow view
function descend(dur, lift = 1, fall = false) { if (reduced) return; const h = home(), e = sP(h), K = fall ? FALL_AT(e) : [[e.x, e.y + 7.5 * lift, e.z + 3.2 * lift, sYaw(h), -.55 * lift, sFov(h) + 8 * lift]];  // lift < 1: a shorter, lower drop (back through a portal)
  K.push([e.x, e.y, e.z, sYaw(h), sPitch(h), sFov(h)]); const way = i => new THREE.CatmullRomCurve3(K.map(k => new THREE.Vector3(k[i], k[i + 1], k[i + 2])));
  desc = { t: 0, dur, fall, e: 0, P: way(0), A: way(3) }; homing = false; vI = [0, 0]; }
const landed = () => { skip.hidden = true; if (!desc) return false; const h = home(); camPos = sP(h); yaw = sYaw(h); pitch = sPitch(h); fov = sFov(h); desc = null; return true; };

// ---- input: the mouse's offset from the centre sets the view and, near an edge, keeps turning it; a drag (mouse or finger) looks around with inertia; arrows look; Enter walks
const cv = $("#stage"), P = { x: 0, y: 0, has: false, mouse: true, down: false, id: -1, sx: 0, sy: 0, lx: 0, ly: 0, lt: 0, t0: 0, moved: 0, ui: false, vx: 0, vy: 0 }, keys = new Set(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const live = () => veil.classList.contains("out");
addEventListener("pointermove", e => { P.mouse = e.pointerType === "mouse"; P.has = true; P.x = e.clientX / innerWidth * 2 - 1; P.y = e.clientY / innerHeight * 2 - 1; P.ui = !!e.target.closest?.(".bar,.panel,.ringx,.home"); if (!armed && !P.ui && Math.hypot(e.clientX - anchor[0], e.clientY - anchor[1]) > 70) armed = true; });  // edge turning wakes up again only after a deliberate move away
let armed = true, anchor = [0, 0]; const disarm = () => { armed = false; anchor = [(P.x + 1) * innerWidth / 2, (P.y + 1) * innerHeight / 2]; };
document.documentElement.addEventListener("mouseleave", () => { P.has = false; }); addEventListener("blur", () => { P.has = false; keys.clear(); });
addEventListener("pointerdown", () => { disarm(); document.body.classList.remove("kb"); }, true); addEventListener("keydown", e => { if (e.key === "Tab") document.body.classList.add("kb"); }, true);
const kf = () => fov * Math.PI / 180 / innerHeight;  // radians per pixel
cv.addEventListener("pointerdown", e => { if (!live() || walk) return; if (desc) { landed(); return; }  /* a tap during the arrival lands it, and is spent on that */ P.down = true; P.id = e.pointerId; P.sx = P.lx = e.clientX; P.sy = P.ly = e.clientY; P.lt = P.t0 = performance.now(); P.moved = 0; P.vx = P.vy = P.rvx = 0; vI = [0, 0]; homing = false; cv.setPointerCapture(e.pointerId); cv.classList.add("drag"); });
cv.addEventListener("pointermove", e => { if (!P.down || e.pointerId !== P.id) return; const dx = e.clientX - P.lx, dy = e.clientY - P.ly, now = performance.now(), dt = Math.max(.008, (now - P.lt) / 1000);
  if (ring.isOpen) { if (!pick && !ring.busy) ring.drag(dx, ring.stepPx()); P.rvx += (dx / dt - P.rvx) * .4; P.moved += Math.abs(dx) + Math.abs(dy); P.lx = e.clientX; P.ly = e.clientY; P.lt = now; return; }
  yaw -= dx * kf(); pitch = cP(pitch + dy * kf()); P.vx += (-dx * kf() / dt - P.vx) * .4; P.vy += (dy * kf() / dt - P.vy) * .4; P.moved += Math.abs(dx) + Math.abs(dy); if (P.moved > 12) hideHint(); P.lx = e.clientX; P.ly = e.clientY; P.lt = now; });
const up = e => { if (!P.down || e.pointerId !== P.id) return; P.down = false; if (ring.isOpen) ring.release(performance.now() - P.lt < 90 ? P.rvx : 0, ring.stepPx()); cv.classList.remove("drag"); try { cv.releasePointerCapture(e.pointerId); } catch {}
  if (P.moved < 8 && performance.now() - P.t0 < 500) tap(e.clientX, e.clientY, e.pointerType); else if (performance.now() - P.lt < 90) vI = [P.vx, P.vy]; };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
addEventListener("keydown", e => { if (!ring.isOpen || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const door = e.target.__portal, free = e.target === document.body || e.target === cv || e.target.__i != null;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") ring.step(e.key === "ArrowRight" ? 1 : -1); else if (e.key === "Enter" && door) { const to = door.frame.userData.link.to; closeRing(); let n = 0; const t = setInterval(() => { if (!ring.isOpen || ++n > 60) { clearInterval(t); if (!ring.isOpen) goto(to); } }, 120); }  // a door chosen with the ring open: put the books back, then go through
  else if (e.key === "Enter" && free) { if (!pick) startPick(); } else if (e.key === "Escape" && panel.hidden) closeRing(); else return; e.preventDefault(); e.stopImmediatePropagation(); }, true);
addEventListener("keydown", e => { const a = document.activeElement; if (a && a !== document.body && a !== cv) return; if (e.key.startsWith("Arrow")) { keys.add(e.key); homing = false; e.preventDefault(); } else if (e.key === "Enter" && live() && !walk) { const l = LINKS.find(q => q.from === cur); if (l) goto(l.to); } });
addEventListener("keyup", e => keys.delete(e.key)); addEventListener("keydown", () => { if (live()) landed(); }, true);
// the phone's tilt, only where the browser gives it without asking (iOS asks, so there it stays a slow idle drift)
let tilt = null; if (matchMedia("(pointer: coarse)").matches && typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function") addEventListener("deviceorientation", e => { if (e.gamma != null) tilt = [Math.max(-1, Math.min(1, e.gamma / 20)), Math.max(-1, Math.min(1, (e.beta - 55) / 20))]; });
let frameNo = 0, hitC = { f: -1, x: 0, y: 0, r: null };
const hit = (cx, cy) => { if (hitC.f === frameNo && hitC.x === cx && hitC.y === cy) return hitC.r; const r = hit_(cx, cy); hitC = { f: frameNo, x: cx, y: cy, r }; return r; };
const hit_ = (cx, cy) => { ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight * 2 - 1)); ray.setFromCamera(ndc, camera); const ar = ray.intersectObjects(arrows); if (ar.length) return { arrow: arrows.indexOf(ar[0].object) }; const po = ray.intersectObjects(portalMeshes.filter(m => m.parent.visible)); if (po.length) return { portal: po[0].object }; const b = ray.intersectObject(books.mesh), mh = ring.isOpen ? ray.intersectObjects(front.hitTargets(), false) : []; if (mh.length && (!b.length || mh[0].distance <= b[0].distance)) return { book: mh[0].object.userData.g }; return b.length ? { book: b[0].instanceId } : null; };
const fire = i => dispatchEvent(new CustomEvent("library:book", { detail: { index: i, case: books.slots[i].case, real: books.isReal(i), id: books.bookAt(i)?.id ?? null } }));  // the hook for L4: the shelf tap listens here
let flash = -1, flashT = 0;
let wakeP = null, wakeT = 0;  // touch: the first tap wakes a portal, the second goes through; a few seconds untouched, or a tap elsewhere, and it falls back to black
function tap(x, y, type) { const h = hit(x, y); if (!h?.portal) wakeP = null; if (!h?.portal && !ring.isOpen && living?.tap(x / innerWidth * 2 - 1, -(y / innerHeight * 2 - 1))) return;
  if (ring.isOpen) { if (pick) return; if (h?.book != null && ring.has(h.book)) { if (h.book === ring.frontGlobal) startPick(); else ring.turnTo(h.book); } else closeRing(); return; }
  if (!h) return; if (h.book != null && !walk) { cue("book-touch", .7); fire(h.book); openRing(h.book); return; } if (h.portal) { cue("book-touch", .7); if (type !== "mouse" && wakeP !== h.portal) { wakeP = h.portal; wakeT = 4; return; } wakeP = null; goto(h.portal.userData.link.to); } else if (h.arrow != null) goto(arrows[h.arrow].userData.link.to); }
// the book buttons: Tab reaches each book (it lifts and glows), Enter fires the same hook
function rebuildShelf() { shelfBtns.forEach(b => b.remove()); shelfBtns.length = 0;
  for (const p of portals) if (p.frame.userData.link.from === cur) { const b = document.createElement("button"); b.type = "button"; b.__portal = p; b.onfocus = () => { focusPortal = p; }; b.onblur = () => { if (focusPortal === p) focusPortal = null; }; b.onclick = () => goto(p.frame.userData.link.to); b.setAttribute("aria-label", regionLabel(p.frame.userData.link, catalog.regions ?? [], lang)); $("#shelf").append(b); shelfBtns.push(b); }
  const k = grown.setStation.indexOf(cur); if (k < 0) return;
  const stand = new Map();  // the stand-in books ("still being written") are one tab stop per shelf, not one each
  for (let i = k * 48; i < Math.min(books.slots.length, (k + 1) * 48); i++) { if (!books.isReal(i)) { const c = books.slots[i].case, e = stand.get(c); if (e) e.__n++; else { const b = document.createElement("button"); b.type = "button"; b.__i = i; b.__n = 1; b.onfocus = () => { flash = b.__i; flashT = 1e9; hideHint(); const c = $("#cap"); c.hidden = false; c.classList.add("kf"); c.textContent = b.getAttribute("aria-label"); }; b.onblur = () => { if (flash === b.__i) flash = -1; $("#cap").classList.remove("kf"); if (!ring.isOpen) $("#cap").hidden = true; }; b.onclick = () => { cue("book-touch", .7); fire(b.__i); openRing(b.__i); }; $("#shelf").append(b); shelfBtns.push(b); stand.set(c, b); } continue; } const b = document.createElement("button"); b.type = "button"; b.__i = i; b.onfocus = () => { flash = i; flashT = 1e9; if (!ring.isOpen) front.prewarm(i); }; b.onblur = () => { if (flash === i) flash = -1; }; b.onclick = () => { cue("book-touch", .7); fire(i); openRing(i); }; $("#shelf").append(b); shelfBtns.push(b); } labelBooks(); }
const wonders = window.__wonders = createWonders(scene, camera, { renderer, room, reduced, phone, busy: () => !live() || ring.isOpen || !!pick || !!walk || !!warp || !!intro || !!desc });  // the big rare wonders (wonders.js): never over a book, a portal trip or the intro
{ const ask = qs.get("wonder"); if (ask && !reduced) { const q = ask === "all" ? [...wonders.names] : [ask]; let miss = 0; const t = setInterval(() => { if (!live() || walk || warp || intro || desc || ring.isOpen || pick || wonders.stats().playing) return; if (!q.length) return clearInterval(t); const ok = wonders.fire(q[0]); miss = ok ? 0 : miss + 1; if (ok || miss > 4) { q.shift(); miss = 0; } }, 2500); } }  // ?wonder=<name>, or ?wonder=all: play it (them, one after another) as soon as you stand at home; for showing them without waiting for the director
rebuildShelf(); onStation(); size();

// ---- the intro (owner 2026-11-17: "change the video to code ... so it just starts right away"): index.html's own script swings the doors open the moment their small cards decode, before this module arrives. When the camera is
// at the threshold (window.__intro resolves) and the room has drawn its first frame, it goes through (doors .in) as the veil dissolves into the live fall down the well; a slow room holds it at the threshold, never skips it.
// Tap, Skip or Esc ends it at once; "Watch the intro" plays it again; a return visit (or ?intro=0) gets the live move; reduced motion: the doors stand open, still, then the short dissolve.
const veil = $("#veil"), doors = $("#doors"), skip = $("#skip");
let sfx = null, roomReady = false, intro = window.__intro ? "doors" : "";  // doors -> fall (through the doorway) -> "" (in the room)
const reveal = () => { if (!roomReady || intro === "doors") return; if (intro === "fall") { descend(FALL, 1, true); doors.classList.add("in"); intro = ""; } veil.classList.add("out"); veil.inert = true; store.set("wst-intro-seen", "1"); skip.hidden = !desc?.fall; };
const doorsThrough = p => p.then(() => { if (intro !== "doors") return; intro = "fall"; reveal(); });
const endIntro = () => { if (intro) { intro = ""; doors.hidden = true; delete document.documentElement.dataset.intro; } landed(); reveal(); };
skip.onclick = endIntro; veil.addEventListener("pointerdown", endIntro);
addEventListener("keydown", e => { if (e.key === "Escape" && !skip.hidden) endIntro(); });
$("#replay").onclick = () => { openMenu(false); landed(); intro = "doors"; doors.hidden = false; veil.classList.remove("out"); veil.inert = false; skip.hidden = false; doorsThrough(window.__introPlay()); };
setTimeout(() => { if (!roomReady) { roomReady = true; reveal(); } }, 6000);  // if the room is very slow, the doors' end or a skip still lands us there
if (intro) { skip.hidden = false; doorsThrough(window.__intro); }

// a one-line first-visit hint: shown once the room is live, gone after the first drag (remembered)
function showHint() { if (intro || desc?.fall) { setTimeout(showHint, 800); return; } if (grown.portals.length && innerWidth / innerHeight < .85) { $("#hint").textContent = "‹  " + W.doors + "  ›"; } if (store.get("wst-lib-hint") === "1" || ring.isOpen) return; const h = $("#hint"); h.hidden = false; requestAnimationFrame(() => h.classList.add("on")); }
function hideHint() { const h = $("#hint"); if (h.hidden) return; h.classList.remove("on"); store.set("wst-lib-hint", "1"); setTimeout(() => { h.hidden = true; }, 900); }
// coming back from the reader (the browser restores this page from its back-forward cache): no veil, no ring, no half-made pick, the camera home
addEventListener("pageshow", e => { if (!e.persisted) return; pick = null; carryVeil.style.opacity = 0; fade.style.opacity = 0; ring.cancelPick(); ring.reset(); front.disposeAll(); books.hover(-1); key.position.x = -1.5; key.color.set(0xffd9a0);
  walk = null; pending = []; cur = home().id; camPos = sP(home()); yaw = sYaw(home()); pitch = sPitch(home()); fov = sFov(home()); vI = [0, 0]; P.down = false; keys.clear(); descend(SHORT); $("#ringx").hidden = true; $("#cap").hidden = true; say(null); arrowsFor(); onStation(); disarm(); });
// the door plaques are drawn before Cinzel Decorative arrives on a first visit: draw them again once it has
fontsReady.then(() => portalLabels());
// ---- run
await Promise.race([Promise.all(core), new Promise(r => setTimeout(r, 5000))]);  // never wait on a slow or missing card: the room arrives with what has loaded
const dbg = window.__lib = { renderer, camera, scene, books, frames: 0, firstFrame: 0, goto, routeTo, openRing, get living() { return living; }, get front() { return front; }, links: LINKS, hit, grown, portalMeshes, ring, pick: () => pick, mist, rays, descending: () => !!desc, intro: () => intro || (desc?.fall ? "fall" : ""), state: () => ({ cur, yaw, pitch, walking: !!walk, arrows: arrows.length, homeVisible: !$("#home").hidden }), look: (y, p) => { yaw = y; pitch = p; }, get wake() { return !!wakeP; }, cueLog, get snd() { return snd; } };

let last = performance.now(), T = 0, hov = -1, lastFront = -1;
const loop = now => {
  frameNo++;
  const dt = Math.min((now - last) / 1000, .1); last = now; T += dt;
  const live_ = live(), still = reduced;
  // what the pointer and tilt do: a parallax offset of the eye (near things move most, far things least) and, for the mouse, the view's own offset
  const mouse = P.has && P.mouse, n = mouse ? [P.x, P.y] : tilt ?? [Math.sin(T * .17) * .5, Math.sin(T * .23) * .3];
  const kk = 1 - Math.exp(-dt * 3); const calm = still || ring.isOpen || !!walk?.stairs; pe[0] += ((calm ? 0 : n[0]) - pe[0]) * kk; pe[1] += ((calm ? 0 : n[1]) - pe[1]) * kk;
  const wantY = mouse && !still && !walk && !ring.isOpen ? n[0] * .16 : 0, wantP = mouse && !still && !walk && !ring.isOpen ? -n[1] * .1 : 0; yawOff += (wantY - yawOff) * kk; pitchOff += (wantP - pitchOff) * kk;
  if (!walk && live_) {
    let ay = 0, ap = 0;  /* aiming at a door near the frame edge must not turn the view away */
    if (mouse && !still && !P.down && !P.ui && !ring.isOpen && !hoverPortal && armed) { const dz = v => Math.abs(v) < .62 ? 0 : Math.sign(v) * (Math.abs(v) - .62) / .38; ay = dz(P.x) * 1.3; ap = -dz(P.y) * .9; }  // near an edge the view keeps turning: all the way round
    if (keys.has("ArrowLeft")) ay -= 1.3; if (keys.has("ArrowRight")) ay += 1.3; if (keys.has("ArrowUp")) ap += .9; if (keys.has("ArrowDown")) ap -= .9;
    const d = 1 - Math.exp(-dt * 6); P.ay = (P.ay ?? 0) + (ay - (P.ay ?? 0)) * d; P.ap = (P.ap ?? 0) + (ap - (P.ap ?? 0)) * d;
    if (!P.down) { vI[0] *= Math.exp(-dt * 2.8); vI[1] *= Math.exp(-dt * 2.8); yaw += (vI[0] + P.ay) * dt; pitch += (vI[1] + P.ap) * dt; }
    if (homing) { const h = home(); yaw += wrap(sYaw(h) - yaw) * (1 - Math.exp(-dt * 4)); pitch += (sPitch(h) - pitch) * (1 - Math.exp(-dt * 4)); if (Math.abs(wrap(sYaw(h) - yaw)) < .003) homing = false; }
    pitch = cP(pitch); yaw = cY(yaw);
  }
  if (wakeP && (wakeT -= dt) <= 0) wakeP = null;
  let bob = 0; warpStep(dt);
  if (desc && live_ && !walk) { if (!warp || warp.arrived) desc.t += dt;  /* back through a portal: it starts as the tunnel opens */ const u = Math.min(1, desc.t / desc.dur), e = desc.e = desc.fall ? u * (1.2 + u * (.6 - .8 * u)) : u < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2, a = desc.A.getPoint(e);
    camPos = desc.P.getPoint(e); yaw = a.x; pitch = a.y; fov = a.z; if (u >= 1) { desc = null; skip.hidden = true; } }
  if (walk?.climb) climbStep(walk, dt); else if (walk?.stairs) stairStep(walk, dt);
  else if (walk && !walk.frozen) { walk.t += dt / walk.dur; const u = Math.min(1, walk.t), e = ease(u); camPos = along(walk.pts, walk.len, e); bob = Math.sin(u * TAU * 3) * .03 * Math.sin(u * Math.PI);
    yaw = walk.y0 + (walk.y1 - walk.y0) * e; pitch = walk.p0 + (walk.p1 - walk.p0) * e; fov = walk.f0 + (walk.f1 - walk.f0) * e * (walk.jump ? 0 : 1) + (walk.jump ? 40 * Math.pow(Math.max(0, (u - PULL) / (1 - PULL)), 2) : 0); if (u >= 1) walk.jump ? through(walk) : arrive(walk); }
  const vy = yaw + yawOff, vp = cP(pitch + pitchOff); camera.rotation.set(vp, -vy, 0, "YXZ");
  const rx = Math.cos(vy), rz = Math.sin(vy); camera.position.copy(camPos).add(new THREE.Vector3(rx * pe[0] * .3, pe[1] * -.15 + bob, rz * pe[0] * .3)); camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  // the hovered book: the mouse's, or the one a touch or the keyboard picked
  let h = -1; if (flash >= 0) { h = flash; flashT -= dt; if (flashT <= 0) flash = -1; } else if (ring.isOpen && !mouse) h = ring.frontGlobal; else if (mouse && live_ && !P.down && !P.ui && !walk) { const r = hit(P.x * innerWidth / 2 + innerWidth / 2, P.y * innerHeight / 2 + innerHeight / 2); h = r?.book ?? -1; const a = r?.arrow ?? -1; if (a !== hoverArrow) { hoverArrow = a; } cv.classList.toggle("pick", h >= 0 || a >= 0); }
  if (ring.isOpen && h < 0) h = ring.frontGlobal; if (pick) h = hov; if (h !== hov) { hov = h; books.hover(h); if (h >= 0 && !ring.isOpen) front.prewarm(h); }
  hoverPortal = null; if (mouse && live_ && !P.down && !P.ui && !walk && !ring.isOpen) { const r = hit(P.x * innerWidth / 2 + innerWidth / 2, P.y * innerHeight / 2 + innerHeight / 2); hoverPortal = r?.portal ?? null; cv.classList.toggle("pick", !!r); }
  for (const p of portals) if (p.group.visible) p.update(T, (hoverPortal === p.frame || focusPortal === p || wakeP === p.frame || ((walk?.jump || walk?.stairs) && walk.id === p.frame.userData.link.to)) ? 1 : 0, dt, still, camera, (walk?.jump || walk?.stairs) && walk.id === p.frame.userData.link.to ? (warp ? Math.max(0, 1 - warp.t * 3) : walk.t) : 0);
  ring.update(dt); front?.update(dt); capText(); dimMesh.forEach((m, i) => { const want = ring.isOpen && i !== books.slots[ring.ids[0]]?.case ? .6 : 0; m.material.opacity += (want - m.material.opacity) * (1 - Math.exp(-dt * 10)); });
  if (pick) { pick.t += dt; const look = new THREE.Vector3(); camera.getWorldDirection(look); look.y = 0; look.normalize(); if (!reduced) { ring.carry(pick.t, camera.position, look); const u = Math.min(1, Math.max(0, (pick.t - .4) / 1.2)); key.position.x = -1.5 + .5 * u; key.color.set(0xffd9a0).lerp(new THREE.Color(0xffa860), u); } const t = reduced ? pick.t / .3 : (pick.t - 1.25) / .35; carryVeil.style.opacity = Math.min(1, Math.max(0, t * t)); if (t >= 1 && !pick.go) { pick.go = true; location.href = pick.href; } }
  if (ring.isOpen && !ring.busy) { const g = ring.frontGlobal; if (g !== lastFront) { if (lastFront >= 0) cue("book-slide", .6); lastFront = g; } } else if (!ring.isOpen) lastFront = -1;
  if (!ring.isOpen && ringWas) { ringWas = false; $("#shelf").inert = false; cv.tabIndex = 0; (opener?.isConnected ? opener : cv).focus({ preventScroll: true }); }
  books.update(T, dt);
  arrows.forEach((a, i) => { a.material.opacity = (still ? .75 : .6 + .22 * Math.sin(T * 2 + i)) + (i === hoverArrow ? .25 : 0); a.position.y = a.userData.base + (still ? 0 : Math.sin(T * 1.6 + i) * .02); });
  // nothing is static: window glows breathe, the lamp flickers softly, the mist drifts, the dust and motes move
  glows.forEach((g, i) => { g.material.opacity = still ? .5 : .45 + .08 * Math.sin(T * .8 + i * 1.7); }); lamps.update(T);
  if (!still) { let i = 0; for (const m of flick) { const f = .9 + .07 * Math.sin(T * 9.1 + i) * Math.sin(T * 2.3 + i * 2) + .03 * Math.sin(T * 23 + i * 5); m.color.copy(m.userData.base).multiplyScalar(f); i++; } }
  for (let i = fades.length - 1; i >= 0; i--) { const m = fades[i]; m.opacity = Math.min(1, m.opacity + dt * 1.8); if (m.opacity >= 1) fades.splice(i, 1); }
  for (const b of billboards) b.rotation.y = Math.atan2(camera.position.x - b.position.x, camera.position.z - b.position.z);
  mist.forEach((m, i) => { m.material.map.offset.x = still ? 0 : T * .004 * (i ? -1 : 1); });
  if (!still) { const p = motes.geometry.attributes.position; for (let i = 0; i < NM; i++) { p.array[i * 3 + 1] += Math.sin(T * .3 + mv[i]) * .0015; p.array[i * 3] += Math.cos(T * .2 + mv[i]) * .001; } p.needsUpdate = true; floater(dt); }
  if (!(dbg.frames % 8)) $("#home").hidden = !(walk || cur !== home().id || Math.abs(wrap(yaw - sYaw(home()))) > .35 || pitch - sPitch(home()) > .4 || pitch - sPitch(home()) < -.4) || !live_ || !!desc;
  rU.uT.value = still ? 0 : T; rU.uUp.value = Math.max(desc?.fall ? (1 - desc.e) * (.9 + 1.4 * Math.sin(Math.PI * Math.min(1, desc.e * 1.6))) : 0, Math.min(1, (vp - .2) / .6)); /* the fall goes down through the rays, brighter than any look up (the film's beams) */ living?.update(dt); wonders.update(dt); sfx?.update(dt, camera); sky.update(camera); renderer.render(scene, camera);
  if (!dbg.frames++) { dbg.firstFrame = Math.round(performance.now()); document.documentElement.dataset.first = dbg.firstFrame; roomReady = true; if (!window.__intro) descend(FULL); $("#loading").hidden = true; reveal(); startFx(); setTimeout(showHint, 1800); }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

// the viewer's sunrays, loaded after the first frame: one beam per window onto its bookcase, dust only inside the beams
async function startFx() {
  let createStoryFx; try { ({ createStoryFx } = await import("../../live/storyfx.js")); } catch (err) { console.warn("library: storyfx failed", err); return; }
  sfx = createStoryFx(scene, renderer, { phone, reduced, tuck: false, page: new THREE.Box3(new THREE.Vector3(-1e4, -50, -1e4), new THREE.Vector3(1e4, 0, 1e4)) });  // no one-page clip, no top-quarter fade
  for (const s of room.shafts ?? []) { const f = new THREE.Vector3(...s.from), to = new THREE.Vector3(...s.to), H = f.y - to.y;
    sfx.play("sunrays", { at: to, width: s.r * (phone ? 1.6 : 1.8), height: H, from: [(f.x - to.x) / H, (f.z - to.z) / H], level: 2 }); }
  living = wireLiving(THREE, { scene, camera, room, fx: sfx, reduced, phone, onTap: () => {} }); living.setStation(cur); if (qs.get("living") === "0") living.living.auto = false;  // ?living=0: still (the film's last frame)  // the living shelves: rare slow moments on the other books, a few per station
}
