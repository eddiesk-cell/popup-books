// Doors of Mystery: a sum, three numbered doors, five right doors in a row reach the treasure. See ACCOUNTS-MASTERPLAN.md.
// Played in a 3D room (doors3d.js, owner 2026-11-18: "walking through the door when pick the right answer, and open the door to traps"); the flat doors below stay as the keyboard / screen-reader path and the no-WebGL fallback.
import { createDoors } from "./doors3d.js";
export const LIMIT_MIN = +new URLSearchParams(location.search).get("limit") || 15;  // the daily rest, the one setting (the parent area changes it later)
export const LEVELS = [["veryeasy", "Very Easy", 1], ["easy", "Easy", 1.5], ["medium", "Medium", 2], ["hard", "Hard", 2.5], ["veryhard", "Very Hard", 3]];
const HEROES = [["kankak", "Kankak"], ["kapi", "Kapi"], ["bobo", "Bobo"], ["lulu", "Lulu"]], IMG = "../../kapi/learn/img/", OPS = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)], shuf = (r, a) => a.map(v => [r(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
// per level: [ops, add/sub range, factor range, quotient range]
const SPEC = { veryeasy: ["+-", [1, 8], [1, 1]], easy: ["+-", [1, 20], [1, 1]], medium: ["+-*/", [5, 50], [2, 5]], hard: ["+-*/", [10, 100], [2, 9]], veryhard: ["+-*/", [50, 500], [3, 12]] };
export function makeSum(level, r = Math.random) {
  const [ops, [lo, hi], [flo, fhi]] = SPEC[level], op = pick(r, [...ops]); let a, b, ans, alt;
  if (op === "+") { if (level === "veryeasy") { a = int(r, 1, 5); b = int(r, 1, 5); } else { a = int(r, lo, hi); b = int(r, lo, level === "easy" ? 10 : hi); } ans = a + b; alt = Math.abs(a - b); }
  else if (op === "-") { a = int(r, level === "veryeasy" ? 2 : lo + 1, hi); b = int(r, level === "veryeasy" ? 1 : Math.min(lo, a - 1), a - 1); ans = a - b; alt = a + b; }
  else if (op === "*") { a = int(r, flo, fhi); b = int(r, flo, fhi); ans = a * b; alt = a + b; }
  else { b = int(r, flo, fhi); ans = int(r, flo, level === "veryhard" ? 15 : fhi); a = ans * b; alt = a - b; }  // whole by construction
  const pool = [...new Set([ans + 1, ans - 1, alt, ans + 2, ans - 2].filter(v => v >= 0 && v !== ans))], wrong = shuf(r, pool).slice(0, 2);
  return { a, b, op, ans, doors: shuf(r, [ans, ...wrong]) };
}
const himg = id => id === "kankak" ? "kankak.webp" : `${IMG}${id}.webp`, CHEER = ["Hooray!", "Up we go!", "Well done!", "Hop, hop, hop!"];
const $ = s => document.querySelector(s), fast = new URLSearchParams(location.search).has("fast"), calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const T = ms => fast ? ms / 20 : calm ? Math.min(ms, 500) : ms, wait = ms => new Promise(r => setTimeout(r, T(ms)));
const KEY = "doors.v1"; let S = { hist: {}, hero: "kankak", level: "easy", day: "", played: 0 };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {}  // shortcut: device-only stars; accounts sync them later
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
// a win is graded 3 (no wrong door), 2 (one or two), 1 (more); a level's stars = value x the grade reached in at least 3 of its last 5 wins, so replaying adds nothing
export const grade = w => w === 0 ? 3 : w <= 2 ? 2 : 1;
export const levelStars = (h = [], v) => { for (const k of [3, 2, 1]) if (h.filter(g => g >= k).length >= 3) return +(v * k / 3).toFixed(2); return 0; };
const total = () => +LEVELS.reduce((t, [id, , v]) => t + levelStars(S.hist[id], v), 0).toFixed(2);
const show = () => { const t = $("#dm-total"); t.dataset.v = total(); t.textContent = "\u2605 " + total(); };
const state = s => $("#dm").dataset.state = s;
const only = id => ["pick", "play", "win", "rest"].forEach(k => $("#dm-" + k).hidden = k !== id);
const say = t => $("#dm-say span").textContent = t;
let cur, streak = 0, wrongs = 0, busy = true, world = null, snd = null;
// The host is ONE data entry (owner 2026-11-18: hosts come from all our tales, Xieng Mieng in time; a host whose book is not made yet stands as a gilded statue: statue: true).
// Swap this entry, not the game code. model: a cast glb (relative to this page); img: the face on the menus.
export const HOST = { name: "Kankak", model: "../../live/chars/toad-kankak.glb", img: "kankak.webp", statue: false,
  hello: "Hello, I am Kankak! Pick the door with the right answer, five rooms in a row, and the Sky King will send the rain.", ask: "Which door is right?", rest: "Kankak is resting.",
  cheer: ["Hooray!", "Through we go!", "Well done!", "Hop, hop, hop!"],
  traps: { feathers: "Whoops! A bucket of feathers! Let's try a new door.", dragon: "Achoo! A sleepy baby dragon! Let's try a new door.", slide: "Wheee! The slide takes you back to the start!" } }, TRAPS = HOST.traps;
if (new URLSearchParams(location.search).has("statue")) HOST.statue = true;  // test: see the host as a gilded statue
const sound = n => snd?.then(s => s?.play(n, { gain: .8 }));
addEventListener("pointerdown", () => (snd ??= import("../../live/sound.js").then(m => m.addSound(m.manifestFor("kapi", "../../"))).catch(() => null)), { capture: true, once: true });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const rested = () => { if (S.day !== today()) { S.day = today(); S.played = 0; save(); } return S.played >= LIMIT_MIN * 60000; };
function rest() { only("rest"); state("rest"); busy = true; }
let last = Date.now(); setInterval(() => { const n = Date.now(), d = Math.min(n - last, 2000); last = n;  // time counts only while a game is on screen
  if (S.day !== today() && $("#dm").dataset.state === "rest") { rested(); only("pick"); state("pick"); } else if (["ask", "open", "dizzy"].includes($("#dm").dataset.state) && !document.hidden) { rested(); S.played += d; save(); } }, 1000);
function pips() { $("#dm-pips").innerHTML = [0, 1, 2, 3, 4].map(i => `<i class="${i < streak ? "on" : ""}"></i>`).join(""); $("#dm").dataset.streak = streak; }
function ask() {
  if (rested()) return rest();
  const prev = cur; do cur = makeSum(S.level); while (prev && cur.a === prev.a && cur.b === prev.b && cur.op === prev.op);  // never the same sum twice running
  const e = $("#dm-eq"); e.dataset.a = cur.a; e.dataset.b = cur.b; e.dataset.op = cur.op; e.dataset.level = S.level;
  e.textContent = `${cur.a} ${OPS[cur.op]} ${cur.b} = ?`;
  $("#dm-pics").innerHTML = S.level === "veryeasy" ? `<span class="dm-grp">${`<img src="${IMG}butterfly.webp" alt="">`.repeat(cur.a)}</span><b>${OPS[cur.op]}</b><span class="dm-grp ${cur.op === "-" ? "dm-gone" : ""}">${`<img src="${IMG}butterfly.webp" alt="">`.repeat(cur.b)}</span>` : "";
  $("#dm-doors").innerHTML = cur.doors.map((v, i) => `<button class="dm-door" data-v="${v}" aria-label="Door ${v}"><span class="dm-glow"></span><span class="dm-leaf dm-l"></span><span class="dm-leaf dm-r"></span><b class="dm-plaque">${v}</b></button>`).join("");
  const traps = Object.keys(TRAPS).sort(() => Math.random() - .5), kinds = cur.doors.map(v => (v === cur.ans ? "right" : traps.pop())); world?.ask(cur, kinds, streak);
  $("#dm-hero").className = ""; $("#dm-hero").style.cssText = ""; say(world ? HOST.ask : "Which gate leads up?"); pips(); busy = false; state("ask");
}
async function choose(btn) {
  if (busy || !btn) return; busy = true;
  if (world) {
    const i = [...$("#dm-doors").children].indexOf(btn), right = +btn.dataset.v === cur.ans; state(right ? "open" : "dizzy"); say(right ? HOST.cheer[streak % HOST.cheer.length] : TRAPS[world.kinds()[i]]);
    if (right) sound("ok"); else { streak = 0; wrongs++; sound("again"); } await world.open(i);
    if (right && ++streak >= 5) { win(); return world.enter(); } ask(); return world.enter();
  }
  if (+btn.dataset.v === cur.ans) {
    state("open"); btn.classList.add("dm-open"); say(CHEER[streak % CHEER.length]); await wait(700);
    const h = $("#dm-hero"), a = h.getBoundingClientRect(), b = btn.getBoundingClientRect();
    h.style.setProperty("--tx", b.left + b.width / 2 - a.left - a.width / 2 + "px"); h.style.setProperty("--ty", b.top + b.height * .75 - a.top - a.height / 2 + "px"); h.classList.add("walk"); await wait(900);
    streak++; if (streak >= 5) return win(); ask();
  } else {
    state("dizzy"); streak = 0; wrongs++; btn.classList.add("dm-shut"); $("#dm-hero").classList.add("dizzy"); say("Whoosh! A puff of wind! Let's try a new gate."); await wait(1700); ask();
  }
}
function win() {
  const v = LEVELS.find(l => l[0] === S.level)[2], before = total(), g = grade(wrongs), h = S.hist[S.level] = [...(S.hist[S.level] || []), g].slice(-5);
  save(); show(); only("win"); state("win"); sound("won"); world?.act("Cheer"); const gain = +(total() - before).toFixed(2), w = $("#dm-won"); w.dataset.gain = gain; w.dataset.grade = g;
  w.textContent = gain > 0 ? `The Sky King sends the rain! +${gain} \u2605` : `The Sky King sends the rain! ${"\u2605".repeat(g)}${"\u2606".repeat(3 - g)}`;
  $("#dm-hint").textContent = gain > 0 ? "" : `Three good wins out of your last five earn this level's stars (${levelStars(h, v)} of ${v} so far).`; busy = false;
}
function start() { streak = 0; wrongs = 0; if (rested()) return rest(); only("play"); ask(); }
$("#dm-doors").onclick = e => choose(e.target.closest(".dm-door"));
$("#dm-again").onclick = start; $("#dm-change").onclick = () => { only("pick"); state("pick"); };
$("#dm-heroes").innerHTML = HEROES.map(([id, n]) => `<button class="dm-pick" data-hero="${id}"><img src="${himg(id)}" alt=""><span>${n}</span></button>`).join("");
$("#dm-levels").innerHTML = LEVELS.map(([id, n, s]) => `<button class="dm-btn" data-level="${id}">${n}<small>${s} ★</small></button>`).join("");
const mark = () => document.querySelectorAll("[data-hero],[data-level]").forEach(b => b.classList.toggle("on", b.dataset.hero === S.hero || b.dataset.level === S.level));
$("#dm-pick").onclick = e => { const b = e.target.closest("[data-hero],[data-level]"); if (!b) return; if (b.dataset.hero) S.hero = b.dataset.hero; else { S.level = b.dataset.level; save(); mark(); setHero(); return start(); } save(); mark(); setHero(); };
const setHero = () => { $("#dm-hero img:not(.dm-puff)").src = $("#dm-winhero").src = himg(S.hero); };
mark(); setHero(); show(); only("pick"); if (rested()) rest();
$("#dm-hello").textContent = HOST.hello; $("#dm-rest h2").textContent = HOST.rest; document.querySelectorAll(".dm-host img, #dm-say img, #dm-resthero").forEach(i => (i.src = HOST.img, i.alt = HOST.name));
try { world = await createDoors($("#dm-3d"), { sound, host: HOST }); document.documentElement.classList.add("has3d"); world.S.onPick = h => choose($("#dm-doors").children[h.object.userData.door]); window.dm3d = { world, cur: () => cur }; if (!$("#dm-play").hidden) ask(); }
catch (e) { console.warn("doors: no 3D room, the flat doors play on", e); }
document.querySelector(".dm-back").href += location.search;
