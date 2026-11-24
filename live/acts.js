// acts.js — the characters act out the story while it is read ("Acting" in LIVE-MASTERPLAN.md).
//
// spread.json "acts": [{ "line": "1.3", "word": "monkey", "who": "kapi", "do": "walk", "to": "tree", "stop": 0.06 }, ...]
//   line    the story line it belongs to; it starts with that line,
//   word    or when the reader reaches this word of it (voice/timing.json),
//   after   or once the same character's previous act is done (the value only names that act, e.g. "walk").
//   wait    true: the reading waits for this act to finish before it reads the next line.
//   to, face, ride: a point [x,y,z] in Blender coordinates, an object's name, or a character's name.
// do:
//   walk | run | swim | sneak | stepback
//                      go along the ground or water to `to`, end `stop` short of it (0.05) and face it, or `face`.
//                      The Walk / Run / Swim / Sneak / Step Back clip plays in place at its stride (assets/motion.json);
//                      or Idle slides. A clip marked "back" there (Step Back) moves backwards: the character keeps its
//                      face to where it came from, and does not turn round when it arrives.
//                      "clip": "<name>" on any of them plays that looping gait instead (the grandparents' "Walk Out"), at the
//                      pace of its motion.json row (one warning, Walk's pace, if there is none); a clip the character lacks: the act's own gait, one warning;
//                      without "clip" nothing changes.
//   sprint | dash      (the "ground" controller, V32) faster gaits, the standard set's Sprint and Dash (a looping burst run) at their own stride
//                      (clip userData "speed_h" when motion.json has no row). A body without the clip plays the stand-in at the standard rate, feet
//                      planted: Dash -> Run (1.7x, leaning forward), Sprint -> Run (1.8x), Sneak -> Walk (not in the five first books: as before).
//   jump               a ballistic arc (book-scale gravity) from the floor it stands on onto the floor at `to` (a point: the highest floor there,
//                      a rock's top; a name: its top), `up` (the clip's "apex_h", else 0.3 of its height) over the higher end. The standard Jump plays
//                      once: it crouches where it stands (at the clip's own pace), leaves the floor at the clip's "takeoff" and lands at its "land"; the
//                      flight takes its own time under that gravity and the clip's air is time-scaled to it (never the gravity to the clip); a longer `secs`
//                      raises the apex to fit, at most 1.2 x its own time (said once above that); a `secs` under its own flight keeps the apex and falls
//                      heavier (never slower). The book's
//                      gravity is 9.8 x height / 1.7 (the body as a person's size), or / its character's "real": <metres> (its true height: a monkey 0.5).
//                      An old Jump (no extras) spans the flight; with none it keeps its clip and its feet hang (toes down 40 degrees, airFeet).
//   climb              go straight up to the top surface of `to` (an object: the end point lands ON it), then step
//                      onto it; `clip` (Climb Up) plays on the way, then it holds `then`. Walk to the foot of it first.
//                      With motion.json's {"rise", "cycle"} for the clip, it climbs in whole cycles, rising with them
//                      (a "loop": false clip is played again each cycle); without, it loops at a body height a second.
//   clip               play `clip` once, then hold `then`. A Throw's `to` names a character to catch the jamun (it turns
//                      to the thrower; without it, the nearest catches). Otherwise, with `to`, travel there over the clip (onto its top
//                      surface when it is an object); a leap (a clip named jump|leap|hop|pounce|flip|bound) travels only while its feet are off the
//                      floor (its "takeoff"/"land" marks, else its own feet), never gliding through its crouch and landing; and one whose air time is
//                      longer than its own rise and fall under the jump act's gravity is played that much faster (never slower, at most 3x). With `ride` (a character): end on its back and ride along,
//                      e.g. {"do": "clip", "clip": "Mount", "ride": "bobo"}.
//   face               turn toward `face`.
//   fly                fly in an arc to `to`, `up` above it; onto a character: perch (`up` defaults to 0.9 of its
//                      height) and ride along; with `bone` ("rightUpperArm"), perch on the skin over that bone
//                      and ride the bone through its moves (Pip on Mali's shoulder); with "beside": true as well, hover
//                      beside that perch, clear of her head, facing where she faces (Pip, a lantern spirit). Plays `clip` or Fly. Pace: Fly in
//                      motion.json, or 2.5 heights a second.
//   float              drift gently to `to` (or hover where it is), over `secs` or at 0.35 heights a second,
//                      swaying a little; plays `clip` or what it holds. Mali rising with the lanterns, coming down at her door.
//                      "sway": <metres> is how far it bobs up and down on the way (a float 0.012, a fly 0, when the key is absent); write "sway": 0 for a
//                      body that walks on the ground (a Walk clip under a float), or it dips 12 mm into the floor.
//   rise               `who` (a character) or `what` (an object of the spread) rises straight up by `by` (0.12) over
//                      `secs` (1.2), and stays up: moonstones from the river, Pip peeking. An object's rises add up (a
//                      lantern a game woke 0.06 rises 0.6 more on "rose", and stays there).
//   glow               `who` glows to `by` (1; 0 is as it was) over `secs` (0.8), and stays so: Pip glowing goodnight.
//   hide | show        `who` (a cast character) or `what` (an object of the spread, via the `find` hook) vanishes / returns at once, or
//                      over `fade` seconds. Hidden: not drawn, no shadow, no tap, and it does not sink or move. "Read again" shows all.
//   shape              {"do": "shape", "what": "<prop>", "key": "Step3", "to": 1, "secs": 1, "only": true}: eases that shape key (morph
//                      target) from its weight now to `to` over `secs` (1), on every mesh under the prop that has it. "only": true eases
//                      every other key of those meshes to 0 meanwhile. A growth Step1..Step7 is seven acts on successive lines or
//                      words. A missing key warns once and ends the act. "Read again" puts every key back to its starting weight.
//                      With "line": "tap:<name>" it runs when that thing is tapped (every tap, also mid-act), not from the reading;
//                      with also "nth": 3 it runs only on the 3rd tap of that thing: taps 1 and 2 play its ordinary tap acts (those with no
//                      "nth"; with none, nothing), and after the highest nth the count starts again; "Read again" resets it;
//                      "back": <secs> returns the keys it moved to the weights they had that long after it has arrived,
//                      over `secs`: the shy plant folds (Fold 1) and opens again after 3 s.
//                      "line": "open" runs an act as the spread is built and again on "Read again" (before the first frame is drawn): a
//                      growth starts with {"line": "open", "do": "shape", "what": "<prop>", "key": "Step1", "to": 1, "secs": 0, "only": true},
//                      since with every key at 0 the prop shows its rest shape. "back" returns a key to the weight it had before the tap.
//   mood               `who` shows its face_<mood> (natural, happy, warm, sad, upset, pity, worried, sleepy, surprise), under a
//                      face_socket on its head; natural at first. Any act may carry "mood" too. No faces in the model: nothing
//   hold               `who` takes `what` (an object or a character) in its `hand` ("right" or "left") until an act
//                      with "release": true lets it go. Optional, and a hold without them is as it always was:
//                      "grip": [x, y, z]  the prop is seated by this point of itself (its own local units) on the hand bone instead of by its
//                                         origin; a node named "hold_grip" in the prop's glb does the same and wins over the field.
//                      The grip lands on the character's PALM, not its wrist (R41): an empty named "palm_r" / "palm_l" under the hand bone of its glb
//                      (the hand bone's origin is the wrist, 4-5 cm short of a closed fist). No page key: a character with the empty is seated by it, one
//                      without (every book before the gourd) on the wrist as ever. A hold with no grip, aim or hold_grip keeps the old seat either way.
//                      With a palm and no "aim" the prop is a TOOL in a fist and turns with it: its handle (its longest side) lies across the palm, its
//                      head on the thumb's side in either hand, its blade or face (the next longest side) the way the knuckles point. What the prop's glb
//                      needs: a node "hold_grip" where the fist closes and a node "hold_tip" at its working end (the axe's edge, the mallet's face).
//                      Without a hold_tip the head is the end farther from the grip, so a prop gripped past its middle must have one.
//                      "upright": true    for a jar, a lamp, a bowl (a thing that must not tip): with a palm it keeps the turn it stands with on the page
//                                         and only its grip rides the palm; without the key it is laid across the fist as a tool is. No effect
//                                         with "aim", or on a character without a palm (nothing turns it there).
//                      "aim": [x, y, z] | "<name>"  the prop's long axis points from the hand at that page point or named thing, every
//                                         frame it is held (the axis: from the grip toward a node named "hold_tip" in the glb, else toward the
//                                         end of its longest side that is farthest from the grip). Without a grip the prop's origin is the hand.
//                      A release of a prop held with a grip or aim lets it fall to what is under it (the page or a prop's top, a downward ray
//                      from five points of its box) in 0.35 s, unless a fly on it follows; "fall": true makes any release do it, false never.
//                      "lay": [x, y, z]   with "release": the prop is set down turned so (degrees about the page's x, then y, then z; "rot" about z after), and falls
//                                         to what is under it: a flute dropped flat in the grass. A code prop (props3d.js) takes the same "lay" on its row.
//   think              the line is `who`'s thought, not said aloud: while it is read `who` neither talks nor turns to
//                      anyone, and nobody turns to listen. With `face`, it looks there meanwhile (into the night).
// The series acts (Journey to the West, 2026-11-23: the set is a playground). A clip they ask for that the body lacks plays the nearest it has (or a
// pose made in code), said once per body: "<name> has no "<clip>" clip".
//   knock              a prop of the spread (`what`) is struck: it flies on a ballistic arc under book gravity (a jump's, 9.8 x the knocker's height / 1.7),
//                      tumbling; it bounces (dust where it lands, `started` with do "bounce": the foley "act:<what>:bounce"), rolls and comes to rest. Onto
//                      water (a floor mesh named water|river|pond|pool|stream|lake|sea, or inside the box of "water": "<name>") it splashes (rings) and sinks.
//                      Aim: "to" (a point or a name: it lands there first; "up" its apex over the higher end, 0.3 of the distance), else "dir" ([x, y] on the
//                      page, or a point or name to knock toward; default away from `who`) and "force" (the launch speed in the knocker's heights a second,
//                      4: it lands about 2.5 heights away) at "lift" degrees (35). "spin" turns a second (1.5). `who`: the knocker (its height is the scale;
//                      0.15 without). The effects play through the page's story effects (a spread with a "storyfx" list); without, none.
//   kick               `who` turns to `what`, plays "Kick" (or `clip`) and the knock above fires at the clip's contact (its userData "contact" seconds,
//                      else 0.45 of its length): {"do": "kick", "who": "wukong", "what": "pebble-1", "to": "pool"}. The act ends when the prop rests.
//   perch | hang | dangle  `who` climbs to `to` and stays there; "pose": sit (default) | stand | hang | dangle ("do": "hang" / "dangle" are a perch with that pose).
//                      `to`: a point, a named empty (its place: "pine-sit"), or a thing (its top). The way: "via" [points or names], else "on": "<tree or post>"
//                      (to its trunk's foot on the near side, up the trunk hand over hand to the perch's height, a step out onto it), else straight up from
//                      where it stands (as climb). It climbs at half its height a second ("rate" times that, or "secs" for the whole climb), "Climb Up"
//                      played again each cycle, sped up so its hands keep to the trunk (userData "rise_h" a cycle).
//                      Poses, with the house clips and their own placing notes: sit on a branch "Perch Sit" (its origin on the branch's top line), sit
//                      elsewhere "Sit", dangle "Sit Dangle" (its "edge_z" on the edge `to` names, the legs over it), hang "Hang" (its origin on the
//                      branch's line: `to` a point on it), stand: its Idle, the feet on `to`. On a branch it faces square to it, on the reader's side; else
//                      "face", else the reader (dangle: away from the middle of the thing it sits on). A body without the clip: the pose made in code on its
//                      Idle (sit, dangle: thighs level, shins hanging and swinging, hands on the thighs, the seat lowered onto `to`; hang: the hands on `to`).
//                      A perch on a "branch" (a node; default the parent of a named `to` when that parent is named branch|bough|limb) dips it and it springs
//                      back (its "Dip"/"Bend"/"Sag" shape key, else its first bone, else the node turned about its own origin; "dip": 5 degrees under the
//                      weight), shaking a few leaves down (storyfx "gust" with "shed"); the percher rides the dip. An act that moves it on its own feet
//                      ends the perch, and the branch springs back.
//   scout              `who` holds a lookout pose (its "Scout" clip, else a hand shading its eyes, made in code) and sweeps its head across "look" [points or
//                      names, or degrees off its facing, + to its left] (default 50, 0, -50: left, ahead, right), "secs" a look (1.2), then lowers the hand.
//                      A perched scout stays perched.
// A character the manifest puts `on` another rides it (its `at` is the offset; with "bone", on that bone's perch, `at` unused)
// until an act moves it on its own feet;
// clip, face and hold acts do not unseat it.
// While a character's own words are read it turns to the nearest other character, who turns back, and Talk plays if it has one.
// Only timing and geometry live here; live.js says where things are, plays the clips and moves the props.
import { glow } from "./games.js";
import { AnimationMixer, Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, LoopOnce, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Triangle, Vector2, Vector3 } from "../vendor/three/three.module.js";  // the module the page maps "three" to: one three.js

const MOVE = { walk: "Walk", run: "Run", swim: "Swim", sneak: "Sneak", stepback: "Step Back", sprint: "Sprint", dash: "Dash" };
const PACE = { walk: 0.9, run: 2.2, swim: 1.0, sneak: 0.45, stepback: 0.5, fly: 2.5, float: 0.35, climb: 0.8, sprint: 4.0, dash: 3.7 };  // body heights a second, when motion.json and the clip have no stride (sprint, dash: the standard set's 1.8x and 1.7x a run)
const FALL = { Dash: "Run", Sprint: "Run", Sneak: "Walk" };  // the standard clip set's stand-ins (tools/locomotion.py: Idle Walk Run Sprint Sneak Jump Dash Climb Up)
const TURN = 5;  // radians a second
const GO_TURN = 2.5, STEP = 0.35, CELL = 0.005, VY = 3;  // "ground": a go-to turns at 2.5 rad/s and steps up or down 0.35 of its height (its own height following its feet's floor at up to 3 body heights a second); a floor is read once a 5 mm cell

export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);  // a character's front is +z at yaw 0
const look = (ch, p) => { if (p && Math.hypot(p.x - ch.pos.x, p.z - ch.pos.z) > 0.01) ch.want = yawTo(ch.pos, p); };  // standing on it: keep the heading
// a perch on a bone of `on` (Pip on Mali's "rightUpperArm"): the first skin straight above that bone, the top of the shoulder
// (not the hair hanging over it), kept as that point of the skin (its triangle and the weights on its corners), so the rider's
// feet stay on it however her skin moves (walk, hop, sit); without skin there, a point in the bone's own frame
// her matrices as posed this frame; updateMatrixWorld, not updateWorldMatrix, so a skinned mesh's bind inverse follows her too
// (it is what turns a skinned vertex back into her own space: stale, the perch lags a frame behind wherever she walks or turns)
const fresh = root => (root.parent?.updateWorldMatrix(true, false), root.updateMatrixWorld(true));
const skinned = root => { let s = false; root?.traverse(o => (s ||= !!o.isSkinnedMesh)); return s; };
// a skinned mesh's vertices where they are drawn, without three's per-vertex objects (getVertexPosition, ~0.3 µs a vertex, made a ray
// down Bobo 47 ms): its arrays copied once, each bone's matrix once a call, four weighted sums a vertex, three's own order of products
const rig = m => (m.userData.rig ??= (() => {
  const g = m.geometry, A = (a, n) => {
    const src = a.isInterleavedBufferAttribute ? a.data.array : a.array, st = a.isInterleavedBufferAttribute ? a.data.stride : n, o = a.offset ?? 0;
    const k = !a.normalized ? 1 : src instanceof Int8Array ? 127 : src instanceof Int16Array ? 32767 : 2 ** (8 * src.BYTES_PER_ELEMENT) - 1, out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = Math.max(src[i * st + o + c] / k, -1);  // three's denormalize (quantized positions too)
    return out;
  };
  return { p: A(g.attributes.position, 3), j: A(g.attributes.skinIndex, 4), w: A(g.attributes.skinWeight, 4), ix: g.index?.array, n: g.attributes.position.count,
    M: m.skeleton.bones.map(() => new Matrix4()), W: new Matrix4() };  // its bones' matrices, filled each call
})());
const drawn = (m, ids, out) => {  // world positions [x,y,z,...] of those vertices (all without ids) as its bones last stood (fresh() first)
  const { p, j, w, n, M, W } = rig(m), N = ids ? ids.length : n, P = W.multiplyMatrices(m.matrixWorld, m.bindMatrixInverse).elements;
  const E = m.skeleton.bones.map((b, k) => M[k].multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[k]).multiply(m.bindMatrix).elements);
  out ??= new Float32Array(3 * N);
  for (let q = 0; q < N; q++) {
    const i = ids ? ids[q] : q, x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
    let X = 0, Y = 0, Z = 0;
    for (let c = 4 * i; c < 4 * i + 4; c++) { const a = w[c], e = a && E[j[c]]; if (a) X += a * (e[0] * x + e[4] * y + e[8] * z + e[12]), Y += a * (e[1] * x + e[5] * y + e[9] * z + e[13]), Z += a * (e[2] * x + e[6] * y + e[10] * z + e[14]); }
    out[3 * q] = P[0] * X + P[4] * Y + P[8] * Z + P[12]; out[3 * q + 1] = P[1] * X + P[5] * Y + P[9] * Z + P[13]; out[3 * q + 2] = P[2] * X + P[6] * Y + P[10] * Z + P[14];
  }
  return out;
};
const corner = (ix, t) => (ix ? ix[t] : t);
const parts = m => (rig(m).parts ??= (() => {  // its vertices and triangles in small lumps (a 30th of its size) of their strongest bone's frame, bind pose:
  const { p, j, w, n, ix } = rig(m), L = m.skeleton.boneInverses.map(bi => new Matrix4().multiplyMatrices(bi, m.bindMatrix)), v = new Vector3(), of = [], lumps = new Map();
  const at = i => { let b = 0; for (let c = 1; c < 4; c++) if (w[4 * i + c] > w[4 * i + b]) b = c; return v.fromArray(p, 3 * i).applyMatrix4(L[j[4 * i + b]]), j[4 * i + b]; };
  const cell = new Box3().setFromArray(p).getSize(v).length() / 30;  // what a choice near a seat need draw is the lumps near it
  for (let i = 0; i < n; i++) {
    const k = at(i), key = `${k} ${Math.floor(v.x / cell)} ${Math.floor(v.y / cell)} ${Math.floor(v.z / cell)}`;
    if (!lumps.has(key)) lumps.set(key, { k, vs: [], ts: [], c: new Vector3(), r: 0 });
    const o = (of[i] = lumps.get(key)); o.vs.push(i); o.c.add(v);
  }
  lumps.forEach(o => o.c.divideScalar(o.vs.length));
  for (let i = 0; i < n; i++) at(i), (of[i].r = Math.max(of[i].r, v.distanceTo(of[i].c)));
  for (let t = 0; t < (ix ? ix.length : n); t += 3) of[corner(ix, t)].ts.push(t);
  return [...lumps.values()];
})());
const skin = (on, from, dir, far) => {  // the first skin of `on` a ray meets, as that point of the skin: its triangle and corner weights
  fresh(on.model);
  const ms = []; on.model.traverse(o => o.isMesh && o.visible && ms.push(o));
  if (!dir.x && !dir.z && ms.length && ms.every(o => o.isSkinnedMesh)) {  // straight up or down a skin: each triangle over that point, the nearest
    let best = null;
    for (const m of ms) {
      const P = drawn(m), { ix, n } = rig(m);
      for (let t = 0; t < (ix ? ix.length : n); t += 3) {
        const a = 3 * corner(ix, t), b = 3 * corner(ix, t + 1), c = 3 * corner(ix, t + 2), den = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]);
        if (Math.abs(den) < 1e-14) continue;
        const l1 = ((P[b + 2] - P[c + 2]) * (from.x - P[c]) + (P[c] - P[b]) * (from.z - P[c + 2])) / den, l2 = ((P[c + 2] - P[a + 2]) * (from.x - P[c]) + (P[a] - P[c]) * (from.z - P[c + 2])) / den;
        if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
        const y = l1 * P[a + 1] + l2 * P[b + 1] + (1 - l1 - l2) * P[c + 1], d = (y - from.y) * dir.y;
        if (d >= 0 && d <= far && !(best?.d <= d)) best = { d, m, idx: [a / 3, b / 3, c / 3], w: [l1, l2, 1 - l1 - l2], y };
      }
    }
    return best && { root: on.model, m: best.m, idx: best.idx, w: best.w, at: new Vector3(from.x, best.y, from.z) };
  }
  const sides = []; on.model.traverse(o => o.isMesh && (sides.push([o.material, o.material.side]), (o.material.side = DoubleSide)));  // both faces: it may leave from inside
  const hit = new Raycaster(from, dir, 0, far).intersectObject(on.model, true).find(i => i.object.visible && i.face);
  sides.forEach(([m, sd]) => (m.side = sd));
  if (!hit) return null;
  const m = hit.object, idx = [hit.face.a, hit.face.b, hit.face.c], v = idx.map(i => m.getVertexPosition(i, new Vector3()).applyMatrix4(m.matrixWorld));
  return { root: on.model, m, idx, w: new Triangle(...v).getBarycoord(hit.point, new Vector3()).toArray(), at: hit.point };
};
// a rider's seat and soles against its skinned mount's skin straight below (lengths at the pair's full size; `sc`: the size they stand at
// now, both growing as one): choose() takes, of the seat and of each sole, the vertices those bones mostly move within 3 cm of their
// lowest, and the mount's triangles within 5 mm round them, every second; gap(): for the seat and for the soles the closest of those
// rider vertices as now placed over the skin as now posed, read on the skin triangle straight under each (a vertex's height, or a grid
// point's, would stand for a slope's top), and the seat's height over the soles: carry() lets the pose decide which bears. Each well under
// a millisecond, so both run in the frame they are needed
const contact = (ch, on) => {
  const kid = [], mnt = [];
  ch.model.traverse(m => m.isSkinnedMesh && kid.push(m)); on.model.traverse(m => m.isSkinnedMesh && m.visible && mnt.push(m));
  if (!kid.length || !mnt.length) return null;
  const of = re => kid.map(m => {
    const { j, w, n } = rig(m), ids = m.skeleton.bones.map(b => re.test(b.name)), out = [];
    for (let i = 0; i < n; i++) for (let c = 4 * i; c < 4 * i + 4; c++) if (w[c] > 0.5 && ids[j[c]]) { out.push(i); break; }
    return out;
  });
  const zones = [of(/^hips$/), of(/^left.*(Foot|Toe)/), of(/^right.*(Foot|Toe)/)].map(all => ({ all }));  // the seat and each sole, each on its own patch of skin
  const pick = (z, sc) => {  // a part's vertices within 3 cm of its lowest, and the skin within 5 mm round them
    const e = 0.005 * sc, P = kid.map((m, k) => drawn(m, z.all[k])), low = Math.min(...P.map(o => o.filter((_, i) => i % 3 === 1).reduce((a, y) => Math.min(a, y), Infinity))) + 0.03 * sc;
    let lx = Infinity, hx = -Infinity, lz = Infinity, hz = -Infinity;
    z.pts = z.all.map((ids, k) => ids.filter((_, q) => P[k][3 * q + 1] <= low && ((lx = Math.min(lx, P[k][3 * q])), (hx = Math.max(hx, P[k][3 * q])), (lz = Math.min(lz, P[k][3 * q + 2])), (hz = Math.max(hz, P[k][3 * q + 2])), true)));
    z.patch = mnt.map(m => {  // only the lumps whose reach (and 1.5 cm for a bend between bones) comes near the region: their vertices and triangles
      const { ix, n } = rig(m), W = new Matrix4().multiplyMatrices(m.matrixWorld, m.bindMatrixInverse), Ms = m.skeleton.bones.map(b => new Matrix4().multiplyMatrices(W, b.matrixWorld)), c = new Vector3();
      const near = parts(m).filter(o => { c.copy(o.c).applyMatrix4(Ms[o.k]); const r = o.r * Ms[o.k].getMaxScaleOnAxis() + 0.015 * sc; return c.x + r >= lx - e && c.x - r <= hx + e && c.z + r >= lz - e && c.z - r <= hz + e; });
      const ids = near.flatMap(o => o.vs), P = drawn(m, ids), slot = (rig(m).slot ??= new Int32Array(n).fill(-1)), vs = [], tri = [];
      ids.forEach((i, q) => { if (P[3 * q] >= lx - e && P[3 * q] <= hx + e && P[3 * q + 2] >= lz - e && P[3 * q + 2] <= hz + e) slot[i] = vs.push(i) - 1; });
      for (const o of near) for (const t of o.ts) { const a = slot[corner(ix, t)], b = slot[corner(ix, t + 1)], c = slot[corner(ix, t + 2)]; if (a >= 0 && b >= 0 && c >= 0) tri.push(3 * a, 3 * b, 3 * c); }
      vs.forEach(i => (slot[i] = -1));  // as found, for the next choice
      return { m, vs, tri, buf: new Float32Array(3 * vs.length) };
    });
    z.rb = z.pts.map(ids => new Float32Array(3 * ids.length));
    z.box = local(z.pts.map((ids, k) => drawn(kid[k], ids)), 0.005);
  };
  const local = (R, e) => {  // where those rider vertices stand in the mount's own frame (x, z; its walk, roll and bloom aside), and a margin
    const L = new Matrix4().copy(on.body.matrixWorld).invert().elements, k = e / on.body.matrixWorld.getMaxScaleOnAxis(), b = [Infinity, -Infinity, Infinity, -Infinity];
    for (const o of R) for (let i = 0; i < o.length; i += 3) {
      const x = L[0] * o[i] + L[4] * o[i + 1] + L[8] * o[i + 2] + L[12], z = L[2] * o[i] + L[6] * o[i + 1] + L[10] * o[i + 2] + L[14];
      b[0] = Math.min(b[0], x); b[1] = Math.max(b[1], x); b[2] = Math.min(b[2], z); b[3] = Math.max(b[3], z);
    }
    return [b[0] - k, b[1] + k, b[2] - k, b[3] + k];
  };
  const choose = sc => { fresh(ch.model); fresh(on.model); zones.forEach(z => pick(z, sc)); };
  let T = new Float32Array(0), span = new Int32Array(0), list = new Int32Array(0), at = new Int32Array(0), fill = at;  // kept from call to call: little garbage 60 times a second
  const read = (z, sc, g) => {  // the part's closest, if closer than g; its rider vertices as now placed
    const R = kid.map((m, k) => drawn(m, z.pts[k], z.rb[k])), C = 0.00125 * sc, b = local(R, 0);
    z.moved = b[0] < z.box[0] || b[1] > z.box[1] || b[2] < z.box[2] || b[3] > z.box[3];  // off its patch
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; z.low = Infinity;
    for (const o of R) for (let i = 0; i < o.length; i += 3) x0 = Math.min(x0, o[i]), x1 = Math.max(x1, o[i]), z0 = Math.min(z0, o[i + 2]), z1 = Math.max(z1, o[i + 2]), (z.low = Math.min(z.low, o[i + 1]));
    if (x0 === Infinity) return g;
    // each skin triangle (its corners, flat) listed in the 1.25 mm cells its x, z span covers; a rider vertex then reads the triangles of
    // its own cell that hold it, at its own x, z
    const nx = Math.round((x1 - x0) / C) + 1, nz = Math.round((z1 - z0) / C) + 1, nt = z.patch.reduce((n, { tri }) => n + tri.length / 3, 0);
    if (at.length < nx * nz + 1) (at = new Int32Array(2 * (nx * nz + 1))), (fill = new Int32Array(at.length));
    at.fill(0, 0, nx * nz + 1);
    if (T.length < 9 * nt) (T = new Float32Array(18 * nt)), (span = new Int32Array(8 * nt));
    let s = 0, high = -Infinity;
    for (const { m, vs, tri, buf } of z.patch) {
      const P = drawn(m, vs, buf);
      for (let t = 0; t < tri.length; t += 3) {
        const a = tri[t], b = tri[t + 1], c = tri[t + 2], w = 9 * s;
        T[w] = P[a]; T[w + 1] = P[a + 1]; T[w + 2] = P[a + 2]; T[w + 3] = P[b]; T[w + 4] = P[b + 1]; T[w + 5] = P[b + 2]; T[w + 6] = P[c]; T[w + 7] = P[c + 1]; T[w + 8] = P[c + 2];
        high = Math.max(high, P[a + 1], P[b + 1], P[c + 1]);
        const g0 = Math.max(0, Math.round((Math.min(P[a], P[b], P[c]) - x0) / C)), g1 = Math.min(nx - 1, Math.round((Math.max(P[a], P[b], P[c]) - x0) / C));
        const h0 = Math.max(0, Math.round((Math.min(P[a + 2], P[b + 2], P[c + 2]) - z0) / C)), h1 = Math.min(nz - 1, Math.round((Math.max(P[a + 2], P[b + 2], P[c + 2]) - z0) / C));
        span[4 * s] = g0; span[4 * s + 1] = g1; span[4 * s + 2] = h0; span[4 * s + 3] = h1; s++;
        for (let gx = g0; gx <= g1; gx++) for (let gz = h0; gz <= h1; gz++) at[gx * nz + gz + 1]++;
      }
    }
    for (let q = 0; q < nx * nz; q++) at[q + 1] += at[q];
    if (list.length < at[nx * nz]) list = new Int32Array(2 * at[nx * nz]);
    fill.set(at.subarray(0, nx * nz + 1));
    for (let u = 0; u < s; u++) for (let gx = span[4 * u]; gx <= span[4 * u + 1]; gx++) for (let gz = span[4 * u + 2]; gz <= span[4 * u + 3]; gz++) list[fill[gx * nz + gz]++] = 9 * u;
    for (const step of [16, 1]) for (const o of R) for (let i = 0; i < o.length; i += 3 * step) {  // a sparse pass first, for a close bound
      if (o[i + 1] - high >= g) continue;  // as high over the highest skin as the closest gap so far: it cannot be closer
      const x = o[i], z = o[i + 2], q = Math.round((x - x0) / C) * nz + Math.round((z - z0) / C);
      let top = -Infinity;
      for (let u = at[q]; u < at[q + 1]; u++) {
        const w = list[u], ax = T[w], az = T[w + 2], bx = T[w + 3], bz = T[w + 5], cx = T[w + 6], cz = T[w + 8], den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(den) < 1e-14) continue;
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
        if (l1 < -1e-6 || l2 < -1e-6 || l1 + l2 > 1 + 1e-6) continue;
        top = Math.max(top, l1 * T[w + 1] + l2 * T[w + 4] + (1 - l1 - l2) * T[w + 7]);
      }
      if (top > -Infinity) g = Math.min(g, o[i + 1] - top);
    }
    return g;
  };
  const gap = sc => {  // fresh(ch.model) first, with the rider where it is to be drawn: the seat's gap, the soles', and the seat's height over
    fresh(on.model);  // the soles (full-size lengths); a part that has left its patch (a foot swung out) is chosen again at once
    const [seat, ...soles] = zones.map(z => { const v = read(z, sc, Infinity); return (z.moved ? (pick(z, sc), read(z, sc, Infinity)) : v) / sc; });
    const sole = Math.min(...soles), at = v => (v === Infinity ? null : v);
    return { seat: at(seat), soles: at(sole), h: (zones[0].low - Math.min(zones[1].low, zones[2].low)) / sc };
  };
  return { choose, gap };
};
// a held bowl or lamp, held by its rim with the bowl outboard of the hand: her arm hangs at her side, and stood on the hand a bowl rings
// her wrist and forearm. `it`: the held prop (its body's origin is its foot). at(v): where its foot goes now, laid out each frame from
// the hand as it now stands (its middle, its outer edge along her side) and the bowl as it now turns (its reach back toward the hand),
// the rim just over the hand's middle: it stays at her fingers however the hand turns or swings
export const byRim = (ch, bone, it) => {
  let m = null; ch.model.traverse(o => o.isSkinnedMesh && o.skeleton.bones.includes(bone) && (m = o));
  const k = m?.skeleton.bones.indexOf(bone), ids = m ? parts(m).filter(o => o.k === k).flatMap(o => o.vs) : [];
  if (!ids.length) return null;
  const buf = new Float32Array(3 * ids.length), c = new Vector3(), d = new Vector3(), w = new Vector3(), q = new Quaternion();
  let side = 0;
  const at = v => {
    fresh(ch.model); fresh(it.model);
    const P = drawn(m, ids, buf), foot = it.body.getWorldPosition(w).clone();
    c.set(0, 0, 0); for (let i = 0; i < P.length; i += 3) c.x += P[i], c.y += P[i + 1], c.z += P[i + 2];
    c.divideScalar(ids.length);
    d.set(1, 0, 0).applyQuaternion(ch.body.getWorldQuaternion(q)).setY(0).normalize();  // her side: that hand's way
    side ||= Math.sign(c.clone().sub(ch.body.getWorldPosition(w)).dot(d)) || 1;
    d.multiplyScalar(side);
    let out = 0, near = 0, top = -Infinity;
    for (let i = 0; i < P.length; i += 3) out = Math.max(out, (P[i] - c.x) * d.x + (P[i + 2] - c.z) * d.z);
    it.model.traverse(o => { if (o.isMesh) for (let i = 0; i < o.geometry.attributes.position.count; i++) w.fromBufferAttribute(o.geometry.attributes.position, i).applyMatrix4(o.matrixWorld), (near = Math.max(near, (foot.x - w.x) * d.x + (foot.z - w.z) * d.z)), (top = Math.max(top, w.y)); });
    return v.copy(c).addScaledVector(d, out + near + 0.001).setY(c.y - (top - foot.y) + 0.002);
  };
  return { at };
};
// a held tool seated by its grip and aimed (hold acts "grip" / "aim", R33). holdOf: what the prop holds in its own local units, read once as it is
// taken (null: neither field nor a "hold_grip" node, so the old seat); seatHeld: each frame, turn it from its rest so its axis looks along hand -> to
// (from rest each time, so no roll builds up), then move it so its grip is on the hand; dropOf: how far down a released prop falls
export const holdOf = (o, a) => {
  if (!o.getObjectByName("hold_grip") && !a.grip && a.aim == null) return null;  // touches nothing: a hold without the new fields is as it was
  o.updateWorldMatrix(true, true);
  const at = n => { const k = o.getObjectByName(n); return k && o.worldToLocal(k.getWorldPosition(new Vector3())); };
  const grip = at("hold_grip") ?? (a.grip ? new Vector3(...a.grip) : a.aim != null ? new Vector3() : null);
  if (!grip) return null;
  const rest = (o.userData.restQ ??= o.quaternion.clone());
  let axis = null, turn = null;
  if (a.aim == null && a.palm && a.upright) o.quaternion.copy(rest);  // R41 "upright" (a jar, a lamp): it stands as the page built it, whatever an earlier hold turned it to; only its grip rides the palm
  else if (a.aim != null || a.palm) {  // R41: a palm also needs the handle's axis (the fist turns the prop)
    const tip = at("hold_tip"), e = a.aim != null ? 0 : 1e-6;  // e: sides or ends this close (of the size) count as equal, so a float error never picks; 0 with an aim: the tests of R33 as they were
    let front = null;
    if (a.aim != null && tip) axis = tip.sub(grip);
    else {  // shortcut: the box of the meshes' own boxes (a skinned prop's rest pose); fine for a tool, upgrade by naming a "hold_tip" node
      const inv = new Matrix4().copy(o.matrixWorld).invert(), box = new Box3(), m = new Box3();
      o.traverse(c => c.isMesh && (c.geometry.boundingBox ?? c.geometry.computeBoundingBox(), box.union(m.copy(c.geometry.boundingBox).applyMatrix4(new Matrix4().multiplyMatrices(inv, c.matrixWorld)))));
      const s = box.getSize(new Vector3()), [k, k2] = ["x", "y", "z"].sort((p, q) => (Math.abs(s[q] - s[p]) > e * (s[p] + s[q]) ? s[q] - s[p] : 0));  // the longest side, then the next (equal sides: x, y, z)
      const end = k => new Vector3().setComponent("xyz".indexOf(k), (tip && Math.abs(tip[k] - grip[k]) > e * s[k] ? tip[k] - grip[k] : box.max[k] - grip[k] - (grip[k] - box.min[k]) + e * s[k]) >= 0 ? 1 : -1);  // which end of a side: toward the prop's hold_tip (its working end) when it has one off the grip that way, else the end farther from the grip (a grip in the middle: the + end)
      axis = end(k); front = end(k2);  // the handle toward the head; the blade or face
    }
    axis.normalize();
    const t = a.palm?.name === "palm_l" ? -1 : 1;  // the thumb's side: +X of palm_r, -X of palm_l (both empties: +Y along the fingers, +Z out of the palm, so X swaps sides between the hands)
    if (a.palm) turn = front ? new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(axis.clone().multiplyScalar(t), front, axis.clone().cross(front).multiplyScalar(t)).transpose()) : new Quaternion().setFromUnitVectors(axis, new Vector3(t, 0, 0));  // prop -> palm: head to the thumb, blade or face the way the knuckles point (the same grip mirrored in the other hand); with a hold_tip aim axis only the head
  }
  return { grip, axis, turn, rest, palm: a.palm };
};
export const seatHeld = (o, h, hand, to) => {
  if (h.palm) h.palm.updateWorldMatrix(true, false), hand = h.palm.getWorldPosition(new Vector3());  // the palm point, not the wrist the bone's origin is
  if (h.axis && to && to.distanceToSquared(hand) > 1e-12) {
    o.quaternion.copy(h.rest); o.updateWorldMatrix(true, false);
    const pq = o.parent.getWorldQuaternion(new Quaternion()), a = h.axis.clone().transformDirection(o.matrixWorld);
    o.quaternion.premultiply(pq).premultiply(new Quaternion().setFromUnitVectors(a, to.clone().sub(hand).normalize())).premultiply(pq.invert());
  } else if (h.turn) o.quaternion.copy(o.parent.getWorldQuaternion(new Quaternion()).invert().multiply(h.palm.getWorldQuaternion(new Quaternion())).multiply(h.turn));  // R41, no aim: a tool in a fist turns with it
  o.updateWorldMatrix(true, false);
  o.position.copy(o.parent.worldToLocal(o.getWorldPosition(new Vector3()).add(hand).sub(o.localToWorld(h.grip.clone()))));
};
export const dropOf = (o, root) => {  // a 9 x 9 grid of downward rays over the prop's box, against only the meshes under it; the highest support counts (a stick across a rim rests on the rim)
  const box = new Box3().setFromObject(o), col = new Box3(new Vector3(box.min.x, -Infinity, box.min.z), new Vector3(box.max.x, box.min.y + 0.002, box.max.z)), under = [], b = new Box3();
  root.traverse(m => { if (!m.isMesh || /card|wave|grass|crest/.test(m.name) || !b.setFromObject(m).intersectsBox(col)) return; for (let p = m; p; p = p.parent) if (p === o) return; under.push(m); });  // the paper's real height, as live.js's surf() reads it
  const rc = new Raycaster(), dn = new Vector3(0, -1, 0), v = new Vector3();
  let top = -Infinity;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) (rc.set(v.set(box.min.x + (box.max.x - box.min.x) * i / 8, box.min.y + 0.002, box.min.z + (box.max.z - box.min.z) * j / 8), dn), top = Math.max(top, rc.intersectObjects(under, false)[0]?.point.y ?? -Infinity));
  return top > -Infinity ? Math.max(0, box.min.y - top) : 0;
};
// a character's face: a "face_<mood>" object (a plate under a "face_socket" on its head, or a whole premade head) per mood (natural, happy, warm, sad, upset, pity, worried,
// sleepy, surprise); exactly the one asked for shows. A model without them (no faces yet): nothing to do
export const mood = (ch, m) => { const f = []; ch.model?.traverse(o => /^face_[a-z]+$/.test(o.name) && o.name !== "face_socket" && f.push(o)); if (!f.some(o => o.name === `face_${m}`)) return; f.forEach(o => o.scale.setScalar((o.visible = o.name === `face_${m}`) ? 1 : 0)); };  // anywhere in the model: premade skinned heads are not the socket's children (turtle R12); a mood the model lacks keeps the face it has (gourd R29: s01's "surprise" hid every head); the glb hides spares at scale 0 (glTF has no visibility)
const perch = (on, name) => {
  const b = on.model?.getObjectByName(name);
  if (!b) return null;
  fresh(on.model);
  const p = b.getWorldPosition(new Vector3());  // up from inside her: the first skin it leaves through
  return skin(on, p, new Vector3(0, 1, 0), 0.3 * on.height) ?? { bone: b, off: p.applyMatrix4(b.matrixWorld.clone().invert()) };
};
const onBone = pp => {  // where the perch is now
  if (!pp.m) return pp.bone.updateWorldMatrix(true, false), pp.off.clone().applyMatrix4(pp.bone.matrixWorld);
  fresh(pp.root);
  return pp.idx.reduce((s, i, k) => s.addScaledVector(pp.m.getVertexPosition(i, new Vector3()).applyMatrix4(pp.m.matrixWorld), pp.w[k]), new Vector3());
};
// riding: the rider's offset and heading are kept in the mount's own frame, so they turn with it; with a bone, on its perch
export const mount = (ch, on, at, bone = ch.c?.bone, beside = ch.c?.beside) => {
  const up = new ch.pos.constructor(0, 1, 0);
  ch.ride = { on, off: ch.pos.clone().sub(at(on)).applyAxisAngle(up, -on.yaw), dyaw: beside ? 0 : ch.yaw - on.yaw, up, bone, beside };
  if (beside) ch.want = null;  // he faces where she faces from now on, not where he flew from
};
// "beside": the rider hovers by the perch instead of standing on it (Pip, a lantern spirit, at Mali's shoulder), clear of her
// head both from in front of her and from the reader's eye: out along her side by her head's reach plus his own half-width, and
// when she turns side-on to the reader, back behind her shoulder line as far as that view needs; over it a little, bobbing; he
// faces where she faces. `eye`: the reader's eye, the viewer's camera (Acting's `cam`)
export const besidePoint = (ch, on, pp, p, eye) => {  // exported for the checks
  const side = new Vector3(Math.cos(on.yaw), 0, -Math.sin(on.yaw)), back = new Vector3(-Math.sin(on.yaw), 0, -Math.cos(on.yaw));
  const head = on.model.getObjectByName("head")?.getWorldPosition(new Vector3()) ?? p.clone();
  pp.side ??= Math.sign(p.clone().sub(on.body.position).dot(side)) || 1;  // her side the perch is on, kept: a hop never swaps it
  pp.headR ??= reach(on, head); pp.half ??= halfWidth(ch);
  side.multiplyScalar(pp.side);
  const rel = p.clone().sub(head).setY(0), s = Math.max(0, pp.headR + pp.half[0] + 0.01 - rel.dot(side)) + rel.dot(side);  // across: clear from her front
  let b = 0.012;  // a little behind her shoulder line, more when the reader sees her side-on
  if (eye) {
    const v = head.clone().sub(eye).setY(0).normalize(), perp = new Vector3(-v.z, 0, v.x);  // across the reader's view
    const R = pp.headR + 0.01 + Math.abs(perp.dot(side)) * pp.half[0] + Math.abs(perp.dot(back)) * pp.half[1];  // his half-width as the reader sees it
    const A = side.dot(perp) * s + back.dot(perp) * b, B = back.dot(perp);
    if (Math.abs(A) < R && Math.abs(B) > 0.05) b = Math.min(0.15, b + Math.max(0, (R - A * Math.sign(B)) / Math.abs(B)));
  }
  return head.clone().setY(p.y).addScaledVector(side, s).addScaledVector(back, b).add(rel.clone().sub(side.clone().multiplyScalar(rel.dot(side))))
    .setY(p.y + 0.01 + 0.0005 * Math.sin(performance.now() / 950 + (ch.ph ?? 0)));
};
const halfWidth = ch => {  // his half-width across his body and his half-depth, his own size (he faces where she faces): any turn
  ch.body.updateMatrixWorld(true);
  const inv = ch.body.matrixWorld.clone().invert(), b = new Box3();
  (ch.model ?? ch.body).traverse(m => m.isMesh && (m.geometry.boundingBox ?? m.geometry.computeBoundingBox(), b.union(m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)))));
  return [(b.max.x - b.min.x) / 2 * (ch.s0 ?? 1), (b.max.z - b.min.z) / 2 * (ch.s0 ?? 1)];
};
const reach = (on, head) => {  // how far her head (the skin above her neck, hair and all) reaches out from the head bone
  const neck = on.model.getObjectByName("neck")?.getWorldPosition(new Vector3()).y ?? head.y, v = new Vector3();
  let r = 0;
  on.model.traverse(m => { if (m.isMesh && m.visible) for (let i = 0; i < m.geometry.attributes.position.count; i++) {
    m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); if (v.y > neck) r = Math.max(r, Math.hypot(v.x - head.x, v.z - head.z)); } });
  return r;
};
export const carry = (ch, at, eye, last) => {  // with the mount's whole turn when it has a body (a boat that rocks: the rider's feet stay on its deck)
  const r = ch.ride, on = r.on.body?.visible === false && r.on.alt?.body.visible ? r.on.alt : r.on, q = on.body?.quaternion;  // V20: a mount card hidden for its pose partner (character "swap": "old-ox") passes its riders to that partner
  if (r.bone && (r.perch ??= perch(r.on, r.bone))) { const p = onBone(r.perch); return void ch.pos.copy(r.beside ? besidePoint(ch, r.on, r.perch, p, eye) : p); }  // found once its pose is live
  // a gap only between two skins (Kapi on Bobo), held from the mount's first visible frame: the rider grows with it as one piece,
  // its lengths (offset, gap, lift) at their full size times `f`. On a deck, or skinless, the page's height over its mount
  r.held ??= r.gap != null && skinned(ch.model) && skinned(r.on.model);
  const f = r.held && r.on.s0 ? r.on.body.scale.x / r.on.s0 : 1;
  if (r.held) { ch.body.scale.setScalar(ch.s0 * Math.max(f, 1e-4)); ch.body.visible = r.on.body.visible; }
  (q ? ch.pos.copy(r.off).applyQuaternion(q) : ch.pos.copy(r.off).applyAxisAngle(r.up, on.yaw)).multiplyScalar(f).add(at(on));
  // and on the back under it: the skin straight below where the page stands the rider carries it up, down and over through every clip
  // (a croc's breath, the waves game's roll). Unheld, taken as the mount appears and again once it stands full size
  const full = !r.on.s0 || r.on.body.scale.x >= r.on.s0 * 0.999;
  if ((r.seat === undefined || (full && !r.full && !r.held)) && r.on.model && r.on.body.visible) {  // under the rider's hips (its seat), else its root
    r.full = full;
    const hips = ch.model?.getObjectByName("hips"), at = ch.pos.clone().add(hips ? hips.getWorldPosition(new Vector3()).sub(ch.body.getWorldPosition(new Vector3())).setY(0) : new Vector3());
    const s = skin(r.on, at.add(new Vector3(0, r.on.height, 0)), new Vector3(0, -1, 0), 2 * r.on.height);
    r.seat = s && Object.assign(s, { off: ch.pos.clone().sub(s.at).divideScalar(f), q: q?.clone().invert() });  // false: nothing under it (beside, not on)
    if (r.seat && r.held) r.seat.off.y = r.gap;  // its gap over the skin under its hips, until measured
    r.lift = 0;
  }
  if (!r.seat) return;
  ch.pos.copy(onBone(r.seat)).add((r.seat.q ? r.seat.off.clone().applyQuaternion(r.seat.q).applyQuaternion(q) : r.seat.off.clone()).multiplyScalar(f));
  if (r.held && last && (r.contact ??= contact(ch, r.on) ?? false)) {
    // its seat (sitting, riding: the clip shown) or soles that close to the skin, measured in the frame's last carry (`last`) with the rider
    // posed and placed as it is to be drawn, so the lift is exact each frame: nothing to ease
    const now = performance.now();
    ch.body.position.copy(ch.pos).addScaledVector(r.up, r.lift * f); fresh(ch.model);
    if (!(now - r.chosen < 1000)) r.contact.choose(f), (r.chosen = now);
    const m = r.contact.gap(f), H = ch.height ?? 0.15, low = Math.min(m.seat ?? Infinity, m.soles ?? Infinity);
    // a sitting or riding clip holds the seat, any other the soles (switched with the clip, as it is cross-faded); through a clip played on
    // the mount (a Sit Down, a Stand Up: `stay`), which starts in one and ends in the other, the pose decides: the soles, handed to the
    // seat as its height over them falls from 2 cm to 1 (and back on standing up)
    const w = r.stay ? Math.min(1, Math.max(0, (0.133 * H - m.h) / (0.067 * H))) : +/Sit|Ride/.test(ch.cur?.getClip().name ?? ch.hold);
    const g = m.seat != null && w ? w * m.seat + (1 - w) * low : low;
    if (g < Infinity) r.lift += r.gap - g;
  }
  if (r.held) ch.pos.addScaledVector(r.up, r.lift * f);
};

// A paper puppet story character ("model": "puppet:tong"), from ambient.js's puppet() ({root, pins, def, size}), as a model the
// viewer loads like a glTF ({scene, animations}), so every act above works on it as on a 3D character. Each move of its
// PUPPETS.md entry (hinge angles swung at its cycles a second) is a looping clip named as a model's are ("talk" -> "Talk",
// "sit-idle" -> "Sit Idle"); "Idle" is its rest and "Walk" its gait. The card always faces the reader, flipped to look the way
// its character faces: a flat puppet is never turned edge-on.
export function puppetModel(THREE, { root, pins, def, size, turned }) {
  const top = def.parts?.[0] ?? "body", hinges = def.hinges ?? {}, Z = new THREE.Vector3(0, 0, 1);
  for (const [n, pin] of Object.entries(pins)) pin.name = n;  // the clips find the pins by name
  const bake = (name, move, hz) => {  // whole cycles, about a second and more: rest -> the move's angles -> rest
    const n = Math.max(1, Math.round(1.2 * hz)), T = n / hz, times = Array.from({ length: 8 * n + 1 }, (_, i) => (T * i) / (8 * n));
    const k = t => 0.5 - 0.5 * Math.cos(2 * Math.PI * hz * t), p0 = pins[top].position;
    const tracks = Object.entries(move).flatMap(([h, v]) => {
      if (h === "_lift") return [new THREE.VectorKeyframeTrack(`${top}.position`, times, times.flatMap(t => [p0.x, p0.y + v * size * k(t), p0.z]))];
      const pin = h === "_tilt" ? top : h, [, lo = -180, hi = 180] = hinges[pin] ?? [];
      return pins[pin] ? [new THREE.QuaternionKeyframeTrack(`${pin}.quaternion`, times,
        times.flatMap(t => new THREE.Quaternion().setFromAxisAngle(Z, (Math.min(hi, Math.max(lo, v * k(t))) * Math.PI) / 180).toArray()))] : [];
    });
    return new THREE.AnimationClip(name, T, tracks);
  };
  const title = s => s.split(/[-_ ]/).map(w => w[0].toUpperCase() + w.slice(1)).join(" "), moves = def.moves ?? {}, hz = k => def.cycles?.[k] ?? 1;
  const walk = moves.walk ? "walk" : def.gait === "hop" && moves.bounce ? "bounce" : null;
  const animations = [bake("Idle", { _tilt: 0.2 }, 1 / 5.5),
    ...Object.entries(moves).filter(([k]) => !k.includes("#") && !/(^|[-_])idle$|^talk$/i.test(k)).map(([k, m]) => bake(title(k), m, hz(k))),
    ...(moves.walk ? [] : [bake("Walk", walk ? moves[walk] : { _tilt: 5 }, walk ? hz(walk) : 2)])];
  const scene = new (class extends THREE.Group {
    updateMatrixWorld(force) {  // undo whatever the body and its pivot turn, keep their left or right
      const turn = this.parent?.getWorldQuaternion(new THREE.Quaternion()), front = this.parent?.parent && Z.clone().applyQuaternion(this.parent.parent.getWorldQuaternion(new THREE.Quaternion()));
      if (turn) { this.quaternion.copy(turn.invert()); if (Math.abs(front?.x) > 0.2) this.scale.x = Math.sign(front.x); }  // puppets face +x
      const card = turned && front && (this.cardMesh ??= this.getObjectByName(top)?.children.find(o => o.isMesh));  // V13: a three-quarter card (def.turned) stands in for the front card while it faces sideways
      if (card) { this.flat ??= (card.material = card.material.clone()).map; const t = Math.abs(front.x) > 0.2 && this.walking ? turned : this.flat; if (card.material.map !== t) card.material.map = card.material.emissiveMap = t, card.material.needsUpdate = true; }  // shortcut: a light cue's restage (night card) is overwritten by this swap; per-stage cards when a book needs both
      super.updateMatrixWorld(force);
    }
  })();
  scene.userData.topName = top;
  scene.add(root);
  return { scene, animations };
}

const spkNorm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function matchSpeakers(spk, list, book = "") {  // resolve a story.json speaker tag ("houyi", "queen", "rabbit", "suns") against cast entries
  if (!spk || spk === "narrator" || spk === "closing" || !list?.length) return [];
  const ns = spkNorm(spk), stem = ns.endsWith("s") && ns.length > 3 ? ns.slice(0, -1) : null;
  if (ns === "children") return list.filter(c => /^(village-)?(boy|girl|child)/.test(c.name));
  if (ns === "both") return list.filter(c => /^(pu|nya)-?nyeu/.test(c.name));
  const exact = list.filter(c => c.name === spk);
  if (exact.length) return exact;
  const pref = list.filter(c => spkNorm(c.name).startsWith(ns) || (stem && spkNorm(c.name).startsWith(stem)));
  if (pref.length) return pref;
  const tok = list.filter(c => c.name.toLowerCase().split(/[-_]/).some(w => spkNorm(w) === ns || (stem && spkNorm(w) === stem)) || spkNorm(c.name).includes(ns));
  if (tok.length) return tok;
  const modOf = c => {
    let m = (c.c?.model ?? c.model ?? "").split("/").pop().replace(/^puppet:/, "").replace(/\.glb$/, "");
    if (book && m.startsWith(`${book}-`)) m = m.slice(book.length + 1);
    return m;
  };
  const mPref = list.filter(c => spkNorm(modOf(c)).startsWith(ns) || (stem && spkNorm(modOf(c)).startsWith(stem)));
  if (mPref.length) return mPref;
  const mHead = list.filter(c => modOf(c).split("-").slice(0, 2).some(w => spkNorm(w) === ns || (stem && spkNorm(w) === stem)));
  if (mHead.length) return mHead;
  return list.filter(c => spkNorm(modOf(c)).includes(ns));
}
const turn = (a, b, max) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); };
const ease = k => k * k * (3 - 2 * k);

// R36, a cross-fade between grounded clips: a weighted mix of hip heights is not a pose any clip stands in (Little Lion, Run into Sit: a paw 6.5 mm
// under the page). While two or more clips blend and every one is grounded at the ends of the blend (the body's lowest foot within 2 mm of its floor in
// each clip's own pose: the outgoing ones as they are now, the incoming one at the fade's end), the body is lifted so the lowest foot stands at the mix of
// the clips' own feet now (no step at the blend's first and last frame). Never pinned: a fade with a leap, climb, hang, fly or swim (by clip name or act:
// their own take-off is right alone), a floating character (bob), or any clip whose own foot is off the floor.
const OFF = /^(fly|swim|jump|hop|ouch hop|leap|bounce|climb|pounce|swing|hang|drop|fall)/i, NOT_SOLE = /tail|ear|hair|whisk|finger|thumb|index|middle|ring|pinky|hand|arm|shoulder|head|neck|jaw|eye|chest|wing|antenn|horn|trunk/i, FLOOR = 0.002;
const soles = ch => (ch.soles ??= (() => {  // the vertices in the lowest 45% of the bind pose (a tail tip or a hand hanging low is no support), as [mesh, ids, out]
  fresh(ch.model); const ms = [], ys = []; let lo = Infinity, hi = -Infinity;
  ch.model.traverse(m => m.isSkinnedMesh && m.visible && m.matrixWorld.determinant() && ms.push(m));
  for (const m of ms) { const { p, n } = rig(m), e = m.matrixWorld.elements, y = new Float32Array(n); for (let i = 0; i < n; i++) lo = Math.min(lo, y[i] = e[1] * p[3 * i] + e[5] * p[3 * i + 1] + e[9] * p[3 * i + 2] + e[13]), hi = Math.max(hi, y[i]); ys.push(y); }
  return ms.map((m, k) => { const { j, w, n } = rig(m), ids = [], st = Math.max(1, n / 1500 | 0);
    for (let i = 0; i < n; i += st) { let b = 0; for (let c = 1; c < 4; c++) if (w[4 * i + c] > w[4 * i + b]) b = c; if (ys[k][i] < lo + 0.45 * (hi - lo) && !NOT_SOLE.test(m.skeleton.bones[j[4 * i + b]]?.name ?? "")) ids.push(i); }
    return [m, ids, new Float32Array(3 * ids.length)]; }).filter(s => s[1].length);
})());
const footAt = ch => {  // the lowest of those points above the body's own floor (where its origin stands), as the bones are now
  fresh(ch.model); let y = Infinity;
  for (const [m, ids, out] of soles(ch)) { drawn(m, ids, out); for (let i = 1; i < out.length; i += 3) y = Math.min(y, out[i]); }
  return y - ch.body.getWorldPosition(new Vector3()).y;
};
const footIn = (ch, clip, t) => {  // the same, in that clip alone at time t: a spare mixer poses it, then puts the bones back as they were
  const mx = new AnimationMixer(ch.model), a = mx.clipAction(clip).play(); a.time = t; mx.update(0);
  const y = footAt(ch); mx.stopAllAction(); mx.uncacheRoot(ch.model); return y;
};
const blendGround = ch => {  // after each of the mixer's updates; the body is at its own place here (live.js's place() set it just before)
  const run = ch.mix._actions.filter(a => a.isRunning() && a.getEffectiveWeight() > 0), was = ch.gset;  // shortcut: the mixer's private list, three has no public one; upgrade: live.js keeps the clip it fades from
  if (run.length < 2 || ch.ride || ch.perch || ch.goal?.perch || ch.c?.bob || !ch.body.visible || Math.abs(ch.body.scale.x - ch.s0) > 0.01 * ch.s0 || !soles(ch).length) return void (ch.gset = ch.grounded = null);
  ch.gset = new Set(run);
  const joined = run.filter(a => !was?.has(a));
  if (joined.length) {  // a clip joined: it is the one fading in (the lightest, when the blend is first seen), the rest stand where they are now
    const inn = was ? joined : [run.reduce((a, b) => (a.getEffectiveWeight() < b.getEffectiveWeight() ? a : b))], at = a => a.time + 0.3 * (1 - a.getEffectiveWeight()) * a.timeScale;  // 0.3 s: live.js loop()'s fade
    ch.grounded = (was ? ch.grounded : true) && !["fly", "float", "climb", "swim"].includes(ch.goal?.a?.do) && !run.some(a => OFF.test(a.getClip().name)) &&
      run.every(a => { const d = a.getClip().duration, t = !inn.includes(a) ? a.time : a.loop === LoopOnce ? Math.min(at(a), d) : at(a) % d; return Math.abs(footIn(ch, a.getClip(), t)) < FLOOR; });
  }
  if (!ch.grounded) return;
  const w = run.map(a => a.getEffectiveWeight()), tot = w.reduce((x, y) => x + y, 0);
  ch.body.position.y -= footAt(ch) - run.reduce((x, a, i) => x + w[i] * footIn(ch, a.getClip(), a.time), 0) / tot;  // the mix of the clips' own feet now
};

// "ground": true on a spread (BOOK-STANDARD "Characters walk; nothing glides; the floor is solid"). The floor under a point: one downward ray from a
// step above it, at the top faces of the spread's drawn, non-skinned meshes (page, pieces, cast props) whose box (taken once, at the first need) holds
// the point. shortcut: boxes are taken once and alpha cut-outs count as solid; upgrade if a stood-on prop moves on a spread or a cut-out card is walked over
const _v = new Vector3(), _n = new Vector3(), _dn = new Vector3(0, -1, 0), _rc = new Raycaster();
const floorAt = (ms, x, y, z, up, down, out) => {  // out: {m}, the mesh whose top it is
  let top = null;
  for (const [m, b] of ms) {
    if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || b.max.y < y - down || b.min.y > y + up) continue;
    _rc.set(_v.set(x, y + up, z), _dn); _rc.far = up + down;
    for (const h of _rc.intersectObject(m, false)) if (h.face && _n.copy(h.face.normal).transformDirection(m.matrixWorld).y > 0.5) { if (top === null || h.point.y > top) { top = h.point.y; if (out) out.m = m; } break; }
  }
  return top;
};
const floorY = (A, ch, k, x, z) => {  // the floor under (x, z), within a step of the body's height, for side k of the body: read again only when it crosses into a new 5 mm cell
  const f = (ch.fl ??= [[NaN, NaN, NaN], [NaN, NaN, NaN]])[k], cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  if (f[0] !== cx || f[1] !== cz) { const s = STEP * ch.height; f[0] = cx; f[1] = cz; f[2] = floorAt(A.floors(), x, ch.pos.y, z, s, s) ?? NaN; }
  return f[2];
};
// after the mixer (and blendGround): the floor is the LOWER of the floors under the body's two feet (the lowest sole on each side of it), never the floor
// under its middle (that floats both feet over a stone narrower than a stride and pops them up in one frame). So a raised piece is stood on once both feet
// are on it, and nothing lifts a body while one foot is still down beside it (that foot clips the piece instead: no foot placement yet). A go-to walker's
// height follows that floor at up to VY body heights a second (a step, never a pop); anyone else is lifted at once if a sole is below it, never lowered.
const solid = (A, ch, dt) => {
  if (ch.ride || ch.perch || ch.goal?.perch || ch.c?.bob || !ch.body.visible || ch.goal?.air || ch.goal?.climb || ch.goal?.hop || ch.goal?.jump || ch.slide || ch.goal?.a?.do === "swim" || A.holds.has(ch.name) ||
    ch.c?.at?.[2] < -0.01 || Math.abs(ch.body.scale.x - ch.s0) > 0.01 * ch.s0 || OFF.test(ch.cur?.getClip().name ?? "") || !soles(ch).length) return;
  const b = ch.body.position, dk = ch.goal?.go && A.floorNames.length ? floorAt(A.decks(), b.x, ch.pos.y, b.z, STEP * ch.height, STEP * ch.height) : null;
  if (dk !== null) { b.y += dk - ch.pos.y; ch.pos.y = dk; return; }  // on a deck (smooth, its slope limited): the deck under its own place, every frame
  fresh(ch.model); const c = Math.cos(ch.yaw), s = Math.sin(ch.yaw), ft = ch.ft ??= [[0, 0, 0], [0, 0, 0]];
  ft[0][1] = ft[1][1] = Infinity;
  for (const [m, ids, out] of soles(ch)) { drawn(m, ids, out); for (let i = 0; i < out.length; i += 3) { const f = ft[(out[i] - b.x) * c - (out[i + 2] - b.z) * s < 0 ? 0 : 1]; if (out[i + 1] < f[1]) f[0] = out[i], f[1] = out[i + 1], f[2] = out[i + 2]; } }
  let fl = Infinity;
  for (let k = 0; k < 2; k++) { const f = ft[k]; if (f[1] === Infinity) continue; const y = floorY(A, ch, k, f[0], f[2]); if (y === y) fl = Math.min(fl, y); }
  if (fl === Infinity) return;  // no floor within a step under its feet (a branch, a trunk): left as placed
  if (ch.goal?.go) { const v = VY * ch.height * dt, d = Math.max(-v, Math.min(v, fl - ch.pos.y)); ch.pos.y += d; b.y += d; return; }
  const below = fl - Math.min(ft[0][1], ft[1][1]);
  if (below > 0) b.y += below;
};
const GAIT = /^(walk|run|sneak)/i;

// "floors": ["wing", ...] (V32): cards the feet may stand on. A card stands upright, so a downward ray never meets it: each named group (a cast card
// by its name, or all of "wing-1", "wing-2"... for "wing") gets an invisible deck, made once it is all shown, along the group's drawn top edge (the
// highest solid texel of each 5 mm column, read by rays at the card as cast_check reads a card) and no steeper than SLOPE: where the edge is steeper
// (a wingtip sticking up, the group's ends) the deck is cut back to that slope, down to the cards' feet at both ends, so a walker steps on and off.
// The deck lies across the cards' plane (half a card high to each side); the go-to's floor rule and cast_check both stand on it (userData.deck).
const SLOPE = Math.tan(40 * Math.PI / 180), _uv = new Vector2(), _al = new Map(), _q = new Quaternion(), _q2 = new Quaternion();
export const opaque = (h, N = 128) => {  // the card's texel at a ray's hit is solid (alpha over half)
  const map = [].concat(h.object.material)[0].map; if (!map?.image || !h.uv) return true;
  let d = _al.get(map); if (d === undefined) { try { const x = Object.assign(document.createElement("canvas"), { width: N, height: N }).getContext("2d"); x.drawImage(map.image, 0, 0, N, N); d = x.getImageData(0, 0, N, N).data; } catch { d = null; } _al.set(map, d); }
  if (!d) return true; map.transformUv(_uv.copy(h.uv)); return d[(Math.min(N - 1, _uv.y * N | 0) * N + Math.min(N - 1, _uv.x * N | 0)) * 4 + 3] > 127;
};
const deckOf = bodies => {
  const ms = []; for (const b of bodies) b.traverse(m => m.isMesh && [].concat(m.material)[0].map && ms.push(m));
  if (!ms.length) return null;
  const nr = new Vector3().fromBufferAttribute(ms[0].geometry.attributes.normal, 0).transformDirection(ms[0].matrixWorld).setY(0).normalize(), ax = new Vector3(nr.z, 0, -nr.x);  // the cards' facing (level) and their row
  const o = new Box3().setFromObject(ms[0]).getCenter(new Vector3()), C = 0.005, cards = ms.map(m => { const b = new Box3().setFromObject(m), c = b.getCenter(new Vector3()).sub(o);
    const s = [b.min.x, b.max.x].flatMap(x => [b.min.z, b.max.z].map(z => (x - o.x) * ax.x + (z - o.z) * ax.z)); return { m, b, q: c.dot(nr), s0: Math.min(...s), s1: Math.max(...s) }; });
  const base = Math.min(...cards.map(k => k.b.min.y)), hi = Math.max(...cards.map(k => k.b.max.y)), pad = Math.ceil((hi - base) / SLOPE / C) + 1;
  const s0 = Math.min(...cards.map(k => k.s0)), n = Math.ceil((Math.max(...cards.map(k => k.s1)) - s0) / C) + 1 + 2 * pad, env = new Float32Array(n).fill(base), rc = new Raycaster(), P = new Vector3();
  for (let i = pad; i < n - pad; i++) { const s = s0 + (i - pad) * C;
    for (const k of cards) { if (s < k.s0 || s > k.s1) continue;
      for (let y = k.b.max.y; y > env[i]; y -= 0.001) { rc.set(P.copy(o).addScaledVector(ax, s).addScaledVector(nr, k.q + 0.05).setY(y), _n.copy(nr).negate()); rc.far = 0.1;
        const h = rc.intersectObject(k.m, false)[0]; if (h && opaque(h)) { env[i] = y; break; } } } }
  for (let i = 1; i < n; i++) env[i] = Math.min(env[i], env[i - 1] + SLOPE * C);  // the slope limit, both ways (a 1D distance transform)
  for (let i = n - 2; i >= 0; i--) env[i] = Math.min(env[i], env[i + 1] + SLOPE * C);
  const q = cards.reduce((x, k) => x + k.q, 0) / cards.length, D = 0.5 * (cards[0].b.max.y - cards[0].b.min.y), pos = [], ix = [];
  for (let i = 0; i < n; i++) for (const w of [-D, D]) P.copy(o).addScaledVector(ax, s0 + (i - pad) * C).addScaledVector(nr, q + w).setY(env[i]), pos.push(P.x, P.y, P.z);
  for (let i = 0; i < n - 1; i++) ix.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);  // faces up: (across) x (along) is +y
  const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(pos, 3)); g.setIndex(ix); g.computeVertexNormals();
  const m = Object.assign(new Mesh(g, new MeshBasicMaterial({ visible: false })), { name: "deck" }); m.userData.deck = true; m.updateMatrixWorld(true);
  return [m, new Box3().setFromObject(m)];
};
const seen = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };  // drawn: it and every parent visible (acts.js vis() hides every node of a card)
// a jump with no Jump clip: the feet hang in the air (action-lab motion.js airFeet, the toes-down part), off at take-off and landing
const hang = ch => {
  const g = ch.goal, k = g?.jump && !g.clip ? Math.max(0, Math.min(1, g.t / g.len / 0.15, (1 - g.t / g.len) / 0.15)) : 0; if (!k) return;
  _q.setFromAxisAngle(_n.set(1, 0, 0).applyQuaternion(ch.body.getWorldQuaternion(_q2)), 0.7 * ease(k));  // about the body's own right: +z (toes) goes down
  for (const f of (ch.feet ??= (() => { const r = []; ch.model.traverse(o => o.isBone && /(^|[:_])(left|right)foot$/i.test(o.name) && r.push(o)); return r; })())) {
    f.parent.getWorldQuaternion(_q2); f.quaternion.premultiply(_q2).premultiply(_q).premultiply(_q2.invert()); }
};

// ---------- the series acts' bodies: the nearest clip a body has, poses made in code over the clip shown (after the mixer), a two-bone reach ----------
const NEAR = { Kick: ["Kick", "Stomp", "Walk"], Sit: ["Sit", "Sit Idle", "Sitting"], "Perch Sit": ["Perch Sit", "Sit"], "Sit Dangle": ["Sit Dangle", "Dangle", "Sit Ledge"], Hang: ["Hang", "Hang Idle", "Hanging"], Scout: ["Scout", "Look Around"] };
const said = new Set(), WATER = /water|river|pond|pool|stream|lake|sea/i;
const nearest = (ch, want, alt = "a pose in code") => {  // `want`, else the nearest clip the body has, else null; a stand-in is said once per body and clip (another worker makes the clips)
  const got = (NEAR[want] ?? [want]).find(n => ch.clips?.[n]) ?? null;
  if (got !== want && !said.has(`${ch.name}|${want}`)) { said.add(`${ch.name}|${want}`); console.warn(`${ch.name} has no "${want}" clip: ${got ? `"${got}" plays` : alt} until it is made`); }
  return got;
};
const PART = { UpperLeg: "UpLeg", LowerLeg: "Leg", Foot: "Foot", UpperArm: "Arm", LowerArm: "ForeArm", Hand: "Hand" };
const bone = (ch, n) => (ch.bn ??= {})[n] ??= (() => {  // "leftUpperLeg" (or mixamo's "LeftUpLeg"), "head", "neck"
  const [, s, p] = n.match(/^(left|right)(\w+)$/) ?? [], re = new RegExp(`(^|:)(${n}${s ? `|${s}${PART[p]}` : ""})$`, "i"); let b = null;
  ch.model?.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b;
})();
const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _d = new Vector3(), _e = new Vector3(), _f = new Vector3(), _g = new Vector3(), _bq = new Quaternion(), _hq = new Quaternion(), UP3 = new Vector3(0, 1, 0);
const turnBone = (b, q) => { b.parent.getWorldQuaternion(_q2); b.quaternion.premultiply(_q2).premultiply(q).premultiply(_q2.invert()); b.updateWorldMatrix(false, true); };  // q: a turn in the world's axes
const aimBone = (b, c, dir) => turnBone(b, _bq.setFromUnitVectors(_d.subVectors(c.getWorldPosition(_d), b.getWorldPosition(_e)).normalize(), dir));  // b turned so the line to c lies along dir
const grab = (ch, s, T) => {  // the hand of side s onto T: the elbow bent to the distance, then the arm swung onto T (the elbow's plane kept)
  const up = bone(ch, `${s}UpperArm`), lo = bone(ch, `${s}LowerArm`), hd = bone(ch, `${s}Hand`); if (!up || !lo || !hd) return;
  const S = up.getWorldPosition(_a), E = lo.getWorldPosition(_b), a = S.distanceTo(E), b = E.distanceTo(hd.getWorldPosition(_c));
  const c = Math.min(a + b - 1e-5, Math.max(Math.abs(a - b) + 1e-5, S.distanceTo(T))), u = _d.subVectors(S, E), w = _e.subVectors(_c, E), n = _f.crossVectors(u, w);
  if (n.lengthSq() > 1e-14) turnBone(lo, _hq.setFromAxisAngle(n.normalize(), Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - c * c) / (2 * a * b)))) - u.angleTo(w)));
  aimBone(up, hd, _g.subVectors(T, S).normalize());
};
const seats = ch => (ch.seats ??= (() => {  // the vertices of the hips and thighs (what a seated body rests on), as [mesh, ids, out]
  const out = []; ch.model.traverse(m => { if (!m.isSkinnedMesh || !m.visible) return; const { j, w, n } = rig(m), ok = m.skeleton.bones.map(b => /(^|:)(hips|(left|right)(upper|up)leg)$/i.test(b.name)), ids = [], st = Math.max(1, n / 3000 | 0);
    for (let i = 0; i < n; i += st) { let b = 0; for (let c = 1; c < 4; c++) if (w[4 * i + c] > w[4 * i + b]) b = c; if (ok[j[4 * i + b]]) ids.push(i); }
    if (ids.length) out.push([m, ids, new Float32Array(3 * ids.length)]); });
  return out;
})());
const seatY = ch => { let y = Infinity; for (const [m, ids, out] of seats(ch)) { drawn(m, ids, out); for (let i = 1; i < out.length; i += 3) y = Math.min(y, out[i]); } return y; };
// the poses in code, after the mixer (the clip's pose this frame is their start, so nothing builds up): a perch (seated legs, hands on the thighs or on the bar, the
// seat lowered onto the perch) and a scout (the head swept, a hand shading the eyes); each blended in by its k
const layer = ch => {
  fresh(ch.model);
  const P = ch.perch, S = ch.scout, H = ch.height, f = (ch.fw ??= new Vector3()).set(Math.sin(ch.yaw), 0, Math.cos(ch.yaw)), k = P ? ease(P.k) : 0;  // its own vector: grab() reuses the module's
  if (P?.legs && P.code && k) for (const [i, s] of ["left", "right"].entries()) {  // the thighs level and forward, the shins hanging (a dangle swings them)
    const th = bone(ch, `${s}UpperLeg`), sh = bone(ch, `${s}LowerLeg`), ft = bone(ch, `${s}Foot`); if (!th || !sh || !ft) break;
    P.v.copy(f).setY(-0.1).normalize(); aimBone(th, sh, P.w.subVectors(sh.getWorldPosition(P.w), th.getWorldPosition(_g)).normalize().lerp(P.v, k).normalize());
    const sw = 0.12 + (P.pose === "dangle" ? 0.22 * Math.sin(performance.now() / 1000 * 4.2 + i * Math.PI) : 0); P.v.set(f.x * sw, -1, f.z * sw).normalize();
    aimBone(sh, ft, P.w.subVectors(ft.getWorldPosition(P.w), sh.getWorldPosition(_g)).normalize().lerp(P.v, k).normalize());
    const hd = bone(ch, `${s}Hand`); if (hd) grab(ch, s, P.w.copy(hd.getWorldPosition(P.w)).lerp(_g.copy(th.getWorldPosition(_g)).lerp(sh.getWorldPosition(P.v), 0.6).addScaledVector(UP3, 0.05 * H), k));  // a hand on its thigh
  }
  if (P?.legs && P.code && k) { const dy = (P.at().y - seatY(ch)) * k; ch.body.position.y += dy; ch.body.updateMatrixWorld(true); }  // the seat on the perch (a clip seats itself)
  if (P?.pose === "hang" && P.code && k) for (const s of ["left", "right"]) { const hd = bone(ch, `${s}Hand`); if (hd) grab(ch, s, P.w.copy(hd.getWorldPosition(P.w)).lerp(P.v.copy(P.at()).addScaledVector(_g.set(f.z, 0, -f.x), (s === "left" ? 1 : -1) * P.half), k)); }  // the hands on the bar, a shoulder's width apart
  if (S) {
    const r = _g.set(f.z, 0, -f.x);  // up x forward: the turn that tips the face down
    for (const [n, w] of [["neck", 0.4], ["head", 0.6]]) { const b = bone(ch, n); if (b) turnBone(b, _hq.setFromAxisAngle(UP3, S.yaw * w).multiply(_bq.setFromAxisAngle(r, -S.pitch * w))); }
    const hd = bone(ch, `${S.hand}Hand`), head = bone(ch, "head");
    if (S.k && hd && head) {  // the hand at the brow, a little to its own side, the head's way
      const y = ch.yaw + S.yaw; S.f.set(Math.sin(y), 0, Math.cos(y));
      S.brow.copy(head.getWorldPosition(S.brow)).addScaledVector(S.f, 0.1 * H).addScaledVector(UP3, 0.07 * H).addScaledVector(_g.set(-S.f.z, 0, S.f.x), (S.hand === "right" ? 1 : -1) * 0.03 * H);
      grab(ch, S.hand, S.w.copy(hd.getWorldPosition(S.w)).lerp(S.brow, ease(S.k)));
    }
  }
};

export class Acting {
  // cast: [{name, pos, yaw, height, hold, clips, ride?: {on, off}}] (pos: a Vector3 at the feet)
  // where(to, top): a point, object or character name -> a new Vector3 or null (top: an object's top surface)
  // wordAt(line, word) -> seconds into the line
  // loop(ch, clip) / once(ch, clip, done) -> its length in seconds (0 and done() at once if the clip is missing)
  // raise(what, dy): lift an object of the spread by dy; hold(ch, what, hand, on): put it in a hand, or take it out
  // started(a): told as each act begins (live.js plays its "act:<who>:<do>" foley)
  // spot(what) / put(what, p): where a prop of the spread is now (world) / set it there (it stays): for a prop flying (fly with "what")
  // people: the names that are characters (who speak, or can): only they turn to talk; null, everyone in the cast
  // floors: the page's "floors" (cards to stand on); legacy: one of the five first books (no stand-in clips: they play as they always did)
  constructor(acts, cast, { where, wordAt, loop, once, raise = () => {}, hold = () => {}, motion = {}, started = () => {}, spot = () => null, put = () => {}, people = null, cam = null, find = () => null, ground = false, floors = [], legacy = false, book = "" }) {
    Object.assign(this, { book, ground, find, legacy, floorNames: floors, was: new Map(), fades: [], cast, where, wordAt, loop, once, raise, hold, motion, started, spot, put, people, cam, line: null, heard: 0, passed: new Set(), by: {}, rises: [], flights: [], glows: [], lifted: {}, holds: new Map(), shapes: [], base: new Map(), knocks: [], dips: [], later: [], knocked: new Set() });
    this.hold = (ch, what, hand, on, a) => (on ? this.holds.set(what, ch) : this.holds.delete(what), hold(ch, what, hand, on, a));  // who holds what, the games' holds too
    for (const ch of cast) (this.by[ch.name] = ch), mood(ch, "natural");
    for (const ch of cast) if (ch.mix && !ch.mix.grounding) { const up = ch.mix.update; ch.mix.grounding = true; ch.mix.update = function (dt) { const r = up.call(this, dt); if (ch.lean) ch.body.rotation.x += ch.lean; hang(ch); blendGround(ch); ch.solid?.(dt); if (ch.perch || ch.scout) layer(ch); return r; }; }  // R36; a dash's lean (live.js place() sets the rotation afresh each frame) and a jump's hanging feet, after the clip's pose
    for (const ch of cast) ch.solid = ground ? dt => solid(this, ch, dt) : null;  // "ground": the floor rule
    this.taps = {};  // taps counted per name, for "nth"
    this.acts = acts.map((a, i) => ({ ...a, state: "wait", prev: acts.slice(0, i).findLastIndex(b => b.who === a.who && !`${b.line}`.startsWith("tap:")) }));  // a tap act never links a chain

    this.thinks = new Map(acts.filter(a => a.do === "think").map(a => [a.line, a.who]));  // line -> who thinks it
    this.open();  // "line": "open" acts: the page's starting state, set before the spread is first drawn
  }

  // line: the line being read (null between pages), t: seconds into its voice, speaker: who says the word at t
  // dt: the real time since the last tick; a long frame (a slow device) is stepped in 0.05 s pieces, so the acts keep up with the voice
  tick(line, t, dt, speaker) {
    if (line !== this.line) { if (this.line) this.passed.add(this.line); this.line = line; this.heard = 0; }
    // a word counts from the tick after the voice reached it: the read-along lights it from the same voice in its own frame
    // callback, a moment earlier or later in the frame, so by then it is lit too. A word act never starts before its word glows.
    const heard = Math.min(t, this.heard); this.heard = t;
    for (let left = Math.min(dt, 2); left > 1e-9; left -= 0.05) {
      const step = Math.min(0.05, left);
      for (const a of this.acts) if (a.state === "wait" && this.ready(a, heard)) this.start(a);
      for (const ch of this.cast) this.move(ch, step);
      this.rises = this.rises.filter(r => { r.t += step; this.raise(r.what, (this.lifted[r.what] = r.from + r.by * ease(Math.min(1, r.t / r.len)))); return r.t < r.len || void r.done(); });
      this.glows = this.glows.filter(g => { g.t += step; glow(g.ch.body, (g.ch.glowing = g.from + (g.to - g.from) * ease(Math.min(1, g.t / g.len)))); return g.t < g.len || void g.done(); });
      const ended = []; this.shapes = this.shapes.filter(g => ((g.wait -= step) > 0 || ((g.t += step), g.set(ease(Math.min(1, g.t / g.len)))), g.t < g.len || !ended.push(g)));
      ended.forEach(g => g.fin(g));  // after the filter: a finished ease may start its return, which the filter would drop
      this.fades = this.fades.filter(f => (f.t += step, f.tick(Math.min(1, f.t / f.len)), f.t < f.len || void f.end()));
      this.later = this.later.filter(x => (x.t -= step) > 0 || void x.f());  // a kick's contact
      this.knocks = this.knocks.filter(k => this.roll(k, step));
      this.dips = this.dips.filter(d => this.spring(d, step));
      this.flights = this.flights.filter(f => {  // a prop let go flies on from where it was, along the characters' fly arc
        f.t += step; const k = Math.min(1, f.t / f.len);
        this.put(f.what, f.from.clone().lerp(f.to, ease(k)).add({ x: 0, y: f.arc * 4 * k * (1 - k), z: 0 }));
        return k < 1 || void f.done();
      });
    }
    const shown = this.cast.filter(c => c.body?.visible !== false && !this.was.has(c.body));
    const who = speaker ? matchSpeakers(speaker, shown, this.book) : [];
    this.talk(who, !!speaker && this.thinks.get(line) === speaker);
  }

  // hide / show an object: layer 1 and `visible` false on every node (the layer survives live.js setting a body's own `visible` each frame, and
  // takes the object out of the tap ray and the shadow pass too); the nodes' own state is kept to put back. A fade runs on clones of its materials.
  // shortcut: a fade on a model with a shared material clones per mesh; upgrade by pooling clones if a page fades many at once.
  vis(o, on, secs, done) {
    const hid = this.was.has(o);
    if (on ? !hid : hid) return done();
    const flip = () => {
      if (on) { for (const [m, v, k] of this.was.get(o)) (m.visible = v, m.layers.mask = k); this.was.delete(o); return; }
      const nodes = []; o.traverse(m => nodes.push([m, m.visible, m.layers.mask])); this.was.set(o, nodes);
      o.traverse(m => (m.visible = false, m.layers.set(1)));
    };
    if (!secs) return flip(), done();
    if (on) flip();
    const ms = [];
    o.traverse(m => { if (!m.isMesh) return; const was = m.material, c = [].concat(was).map(x => x.clone()); m.material = Array.isArray(was) ? c : c[0]; ms.push([m, was, c.map(x => [x, x.opacity, x.transparent])]); c.forEach(x => (x.transparent = true)); });
    const f = { t: 0, len: secs, tick: k => ms.forEach(([, , cs]) => cs.forEach(([x, o0]) => (x.opacity = o0 * (on ? k : 1 - k)))),
      end: () => { if (f.over) return; f.over = true; ms.forEach(([m, was, cs]) => (m.material = was, cs.forEach(([x]) => x.dispose()))); if (!on) flip(); done(); } };
    this.fades.push(f); f.tick(0);
  }

  floors() {  // the stood-on meshes and their world boxes, once (see floorAt), and the "floors" decks drawn now
    if (this.fms) return this.floorNames.length ? this.fms.concat(this.decks()) : this.fms;
    const root = this.cast[0]?.body.parent, skip = new Set(), b = new Box3(); this.fms = [];
    for (const c of this.cast) if (skinned(c.model)) c.body.traverse(o => skip.add(o));
    root?.updateMatrixWorld(true);
    root?.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || skip.has(m) || !m.visible) return; const mt = [].concat(m.material)[0]; if (mt.visible === false || mt.opacity < 0.98 || mt.depthWrite === false) return;
      this.fms.push([m, b.setFromObject(m).clone()]); });
    return this.floorNames.length ? this.fms.concat(this.decks()) : this.fms;
  }
  decks() {  // the "floors" groups' decks ([mesh, box]) whose cards are all drawn now; each made the first time it is
    const out = [];
    for (const d of (this.dk ??= this.floorNames.map(n => { const c = this.cast.filter(c => c.name === n || c.name.startsWith(`${n}-`)); return { n, c, b: c.map(c => c.body) }; }))) {
      if (!d.b.length) { const o = this.find(d.n); if (o) d.b.push(o); else continue; }  // a piece of the spread by name
      const ms = []; d.b.forEach(b => b.traverse(m => m.isMesh && [].concat(m.material)[0].map && ms.push(m)));
      if (!ms.length || !ms.every(seen) || d.c.some(c => Math.abs(c.body.scale.x - c.s0) > 0.01 * c.s0)) continue;  // hidden, or growing in: not yet
      if (d.m === undefined) d.m = deckOf(d.b);
      if (d.m) out.push(d.m);
    }
    return out;
  }
  goable(ch, a) {  // ground travel this key changes: a float along the ground by a walker (no clip, or a gait clip), or any ground move by a rigid body
    const rigid = !skinned(ch.model) && !ch.c?.model?.startsWith("puppet:"), on = this.by[a.to], h = ch.height;
    if (ch.c?.bob || this.holds.has(ch.name) || (rigid && this.prop(ch))) return false;
    if (MOVE[a.do]) return rigid && a.do !== "swim";
    if (a.do !== "float" || a.to == null || on || (a.up ?? 0) > STEP * h) return false;
    const to = this.where(a.to, true); if (!to || Math.abs(to.y - ch.pos.y) > STEP * h) return false;
    return rigid || (!!(ch.clips?.Walk || ch.clips?.Run) && (!a.clip || GAIT.test(a.clip)));
  }
  prop(ch) { return this.acts.some(b => b.do === "hold" && b.what === ch.name) || /prop/i.test(ch.c?.model?.split("/").pop() ?? ""); }  // a thing a hand takes, or a prop model: not a body (Rule 28 is about bodies)

  // ---------- the series acts (header): knock / kick, perch / hang / dangle, scout ----------
  knock(a, done) {
    const o = this.find(a.what);
    if (!o) return console.warn("nothing to knock:", a), done();
    o.updateWorldMatrix(true, true);
    const by = this.by[a.who], H = by?.height ?? 0.15, G = 9.8 * H / 1.7, box = new Box3().setFromObject(o), c = box.getCenter(new Vector3()), r = Math.max(1e-3, (box.max.y - box.min.y) / 2);
    const ms = this.floors().filter(([m]) => { for (let p = m; p; p = p.parent) if (p === o) return false; return true; }), wo = a.water && this.find(a.water), v = new Vector3(), to = a.to != null && this.where(a.to, true);
    if (to) {  // it lands at `to` first, `up` over the higher end
      const ty = (floorAt(ms, to.x, to.y, to.z, H, H) ?? to.y) + r, top = Math.max(c.y, ty) + (a.up ?? 0.3 * Math.hypot(to.x - c.x, to.z - c.z)), t1 = Math.sqrt(2 * (top - c.y) / G);
      v.set(to.x - c.x, 0, to.z - c.z).divideScalar(t1 + Math.sqrt(2 * (top - ty) / G)).setY(G * t1);
    } else {
      const d = Array.isArray(a.dir) && a.dir.length === 2 ? new Vector3(a.dir[0], 0, -a.dir[1]) : a.dir != null ? this.where(a.dir)?.sub(c) ?? new Vector3() : by ? c.clone().sub(by.pos) : new Vector3(1, 0, 0);
      const l = (a.lift ?? 35) * Math.PI / 180, sp = (a.force ?? 4) * H;
      if (d.setY(0).lengthSq() < 1e-12) d.set(1, 0, 0);
      v.copy(d.normalize()).multiplyScalar(sp * Math.cos(l)).setY(sp * Math.sin(l));
    }
    const w = new Vector3(v.z, 0, -v.x); w.multiplyScalar(w.lengthSq() > 1e-12 ? 2 * Math.PI * (a.spin ?? 1.5) / w.length() : 0);  // tumbling forward: about up x its way
    o.userData.knock0 ??= { p: o.position.clone(), q: o.quaternion.clone() }; this.knocked.add(o);
    this.knocks = this.knocks.filter(k => k.o !== o || void k.done());  // a new knock takes a rolling prop over
    this.knocks.push({ a, o, c, v, w, r, G, H, ms, mm: ms.map(([m]) => m), wb: wo && new Box3().setFromObject(wo), t: 0, roll: false, sink: -1, q: new Quaternion(), q0: o.getWorldQuaternion(new Quaternion()), off: o.getWorldPosition(new Vector3()).sub(c), at: new Vector3(), hit: {}, done });
  }
  roll(k, dt) {  // one step of a knocked prop (flying, bouncing, rolling, sinking); false once it rests
    const { c, v, w, r } = k; k.t += dt;
    let rest = k.t > 12;
    if (k.sink >= 0) { c.y -= 2 * r * dt; if ((k.sink += dt) > 0.8) return this.vis(k.o, false, 0, () => {}), k.done(), false; }  // in the water: it sinks out of sight
    else {
      if (!k.roll) v.y -= k.G * dt;
      const hz = Math.hypot(v.x, v.z);
      if (hz > 1e-6) {  // a wall ahead (a rock's side, not a card's cut-away paper): it bounces back off it
        _rc.set(c, _a.set(v.x / hz, 0, v.z / hz)); _rc.far = r + hz * dt;
        if (_rc.intersectObjects(k.mm, false).find(h => h.face && Math.abs(_n.copy(h.face.normal).transformDirection(h.object.matrixWorld).y) < 0.5 && opaque(h))) { const d = 2 * (v.x * _n.x + v.z * _n.z); v.x = 0.4 * (v.x - d * _n.x); v.z = 0.4 * (v.z - d * _n.z); }
      }
      c.addScaledVector(v, dt);
      const f = floorAt(k.ms, c.x, c.y - r, c.z, r + Math.abs(v.y) * dt, k.roll ? r : 2 * r, k.hit);
      if (k.roll && (f == null || f < c.y - 1.5 * r)) k.roll = false;  // off an edge: it falls again
      else if (f != null && c.y - r <= f + (k.roll ? r : 0)) {
        c.y = f + r;
        const vin = -v.y, fx = globalThis.live?.sfx;
        if (!k.roll && (WATER.test(k.hit.m?.name ?? "") || (k.wb && c.x >= k.wb.min.x && c.x <= k.wb.max.x && c.z >= k.wb.min.z && c.z <= k.wb.max.z))) {  // into the water: rings, and it sinks
          fx?.play("splash", { at: new Vector3(c.x, f, c.z), size: 5 * r, level: 1, waterY: f }); this.started({ ...k.a, who: null, do: "splash" }); k.sink = 0; v.set(0, 0, 0); w.set(0, 0, 0);
        } else if (!k.roll) {  // a landing: dust and a click, then a smaller bounce, or it rolls
          if (vin > 0.25 * Math.sqrt(k.G * k.H)) { fx?.play("dust", { at: new Vector3(c.x, f, c.z), size: Math.max(4 * r, 0.3 * k.H), level: 1 }); this.started({ ...k.a, who: null, do: "bounce" }); }
          if (vin * vin * 0.16 / (2 * k.G) > 0.15 * r) { v.y = 0.4 * vin; v.x *= 0.7; v.z *= 0.7; w.multiplyScalar(0.6); } else { v.y = 0; k.roll = true; }
        }
      }
      if (k.roll) {  // rolling, slowing (rolling friction 0.4), turning as far as it goes
        const s = Math.hypot(v.x, v.z), s2 = Math.max(0, s - 0.4 * k.G * dt);
        if (s2 < 0.002 * k.H) rest = true, w.set(0, 0, 0); else v.x *= s2 / s, v.z *= s2 / s, w.set(v.z, 0, -v.x).divideScalar(r);
      }
    }
    const wl = w.length(); if (wl > 1e-9) k.q.premultiply(_bq.setFromAxisAngle(_a.copy(w).divideScalar(wl), wl * dt));
    const o = k.o; o.parent.getWorldQuaternion(_q2); o.quaternion.copy(_q2.invert().multiply(_hq.copy(k.q).multiply(k.q0)));
    k.at.copy(k.off).applyQuaternion(k.q).add(c); o.position.copy(o.parent.worldToLocal(_a.copy(k.at))); this.put(k.a.what, k.at);  // put: the viewer keeps it there (moveProps)
    return !rest || void k.done();
  }
  kick(ch, a, done) {  // it turns to the prop, plays its kick, and the knock flies at the contact
    const at = this.spot(a.what) ?? this.where(a.what); if (!at) return console.warn("nothing to kick:", a), done();
    look(ch, at);
    const clip = nearest(ch, a.clip ?? "Kick", "the knock alone"), len = clip ? this.once(ch, clip, () => this.loop(ch, ch.hold)) : 0;
    this.later.push({ t: ch.clips?.[clip]?.userData?.contact ?? 0.45 * len, f: () => this.knock(a, done) });
  }
  scout(ch, a, done) {  // the lookout: its Scout clip, or a hand at the brow in code; the head swept over `look` (a number: degrees off its facing, + to its left)
    const H = ch.height, eye = ch.pos.clone().setY(ch.pos.y + 0.9 * H), clip = nearest(ch, a.clip ?? "Scout", "a hand at the brow in code");
    const pts = (a.look ?? [50, 0, -50]).map(p => typeof p === "number" ? eye.clone().add(new Vector3(Math.sin(ch.yaw + p * Math.PI / 180), 0, Math.cos(ch.yaw + p * Math.PI / 180)).multiplyScalar(6 * H)) : this.where(p)).filter(Boolean);
    const len = clip ? this.once(ch, clip, () => {}) : 0;  // its clip once, its last pose held
    ch.scout = { pts, eye, per: Math.max(a.secs ?? 1.2, len / Math.max(1, pts.length)), t: 0, yaw: 0, pitch: 0, k: 0, hand: a.hand ?? "right", clip, done, brow: new Vector3(), f: new Vector3(), w: new Vector3() };
  }
  perch(ch, a, done) {  // along its way (header) to the perch, then its pose; a branch under it dips
    const pose = a.do === "perch" ? a.pose ?? "sit" : a.do, H = ch.height, empty = n => { let m = false; n?.traverse(o => (m ||= !!o.isMesh)); return n && !m; };
    const spot = p => { const n = typeof p === "string" && this.find(p); return empty(n) ? n.getWorldPosition(new Vector3()) : this.where(p, true); };  // a named empty: its place; a thing: its top
    const node = typeof a.to === "string" ? this.find(a.to) : null, tgt = spot(a.to);
    if (!tgt) return console.warn(`nothing to ${a.do} on: "${a.to}" is not on this page`, a), done();
    this.unperch(ch); ch.moved = true; ch.ride = null;
    const br = a.branch ? this.find(a.branch) : empty(node) && /branch|bough|limb/i.test(node.parent?.name ?? "") ? node.parent : null, mid = node && !empty(node) ? new Box3().setFromObject(node).getCenter(new Vector3()) : null;
    const along = br && new Vector3(tgt.x, 0, tgt.z).sub(br.getWorldPosition(new Vector3()).setY(0)), side = along?.lengthSq() > 1e-8 ? Math.atan2(along.z, -along.x) : 0;  // on a branch: square to it (its clips hold the branch along their x), on the reader's side
    const yaw = a.face != null ? yawTo(tgt, this.where(a.face) ?? tgt) : pose === "dangle" && mid ? yawTo(mid, tgt) : br ? (Math.cos(side) >= 0 ? side : side + Math.PI) : 0, f = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));  // the reader faces +z
    fresh(ch.model);
    const o0 = ch.body.getWorldPosition(new Vector3()), [U, L, D, K, th, kn] = ["leftUpperArm", "leftLowerArm", "leftHand", "rightUpperArm", "leftUpperLeg", "leftLowerLeg"].map(n => bone(ch, n));
    const clip = pose === "stand" ? null : nearest(ch, { sit: br ? "Perch Sit" : "Sit", dangle: "Sit Dangle", hang: "Hang" }[pose]), pd = ch.clips?.[clip]?.userData ?? {};  // a clip's own "support" places it (the house clips' notes): a branch's top or line, a ledge's edge
    const P = { pose, code: !clip, legs: pose === "sit" || pose === "dangle", k: 0, br, half: U && K ? U.getWorldPosition(_a).distanceTo(K.getWorldPosition(_b)) / 2 : 0.12 * H, v: new Vector3(), w: new Vector3(), pt: new Vector3(), off: new Vector3() };
    if (clip) { if (pose === "dangle") P.off.copy(f).multiplyScalar(-(pd.edge_z ?? 0) * H); }  // Hang: its origin on the branch's line; Perch Sit: on its top; Sit Dangle: its edge (edge_z ahead of its origin) on the ledge's
    else if (pose === "hang") P.off.y = -((U ? U.getWorldPosition(_a).y - o0.y : 0.8 * H) + 0.95 * (U && L && D ? _a.distanceTo(L.getWorldPosition(_b)) + _b.distanceTo(D.getWorldPosition(_c)) + 0.04 * H : 0.4 * H));  // the hands on it: its shoulders under it by an arm
    else if (pose === "dangle") P.off.copy(f).multiplyScalar(-0.95 * (th && kn ? th.getWorldPosition(_a).distanceTo(kn.getWorldPosition(_b)) : 0.25 * H));  // its knees over the edge
    br?.updateWorldMatrix(true, false); P.local = br ? br.worldToLocal(tgt.clone()) : tgt; P.at = () => (br ? br.localToWorld(P.pt.copy(P.local)) : P.pt.copy(tgt));  // a dipping branch carries the point
    const end = tgt.clone().add(P.off), from = ch.pos.clone(), top = pose === "hang" ? end.y : tgt.y, pts = [from], tr = a.on != null ? this.find(a.on) : null, ax = tr ? tr.getWorldPosition(new Vector3()) : null;
    if (a.via) for (const p of [].concat(a.via)) { const q = spot(p); if (q) pts.push(q); }
    else if (tr) {  // up its trunk: beside it, square to the perch's way out, on the side it comes from
      const out = new Vector3(tgt.x - ax.x, 0, tgt.z - ax.z), side = new Vector3(from.x - ax.x, 0, from.z - ax.z);
      if (out.lengthSq() > 1e-8) { out.normalize(); const s1 = new Vector3(-out.z, 0, out.x); side.copy(s1.dot(side) >= 0 ? s1 : s1.negate()); }
      if (side.lengthSq() < 1e-8) side.set(0, 0, 1);
      side.normalize(); _rc.set(_a.copy(ax).addScaledVector(side, 2 * H).setY(from.y + 0.4 * H), _b.copy(side).negate()); _rc.far = 2 * H;
      const hit = _rc.intersectObject(tr, true)[0], foot = ax.clone().addScaledVector(side, (hit ? 2 * H - hit.distance : 0.05 * H) + (a.gap ?? 0.12) * H).setY(from.y);
      pts.push(foot, foot.clone().setY(top));
    } else pts.push(from.clone().setY(top));  // straight up where it stands (the climb act's way)
    pts.push(pose === "hang" ? end : end.clone().setY(tgt.y));
    const cu = a.clip ?? "Climb Up", cc = ch.clips?.[cu] ? cu : nearest(ch, cu, "it slides up"), ud = ch.clips?.[cc]?.userData ?? {}, vc = 0.5 * H * (a.rate ?? 1), segs = [];  // a monkey's climb: half its height a second (its clip, a slow ladder climb, sped up to keep its hands on the trunk)
    let t = 0, tc = 0; const walk = ch.clips?.Walk?.userData?.speed_h ? ch.clips.Walk.userData.speed_h * H : this.pace(ch, "walk");  // the Walk clip's own stride: the feet do not slide
    for (let i = 1; i < pts.length; i++) {  // a mostly upright leg is climbed, the last a step out (a little hop), the rest walked
      const A = pts[i - 1], Bp = pts[i], dy = Math.abs(Bp.y - A.y), dh = Math.hypot(Bp.x - A.x, Bp.z - A.z), kind = dy > dh ? "climb" : i === pts.length - 1 ? "step" : "walk";
      if (dy + dh < 1e-4) continue;
      const len = kind === "climb" ? dy / vc : Math.max(kind === "step" ? 0.4 : 0.2, (kind === "step" ? 1.5 : 1) * dh / walk); if (kind === "climb") tc += len;
      segs.push({ A, B: Bp, kind, len, yaw: kind === "climb" ? yawTo(A, ax ?? end) : dh > 1e-3 ? yawTo(A, Bp) : yaw });
    }
    const ks = a.secs && tc ? a.secs / tc : 1;  // "secs": the whole climb that long, the clip's pace with it
    for (const s of segs) { if (s.kind === "climb") s.len *= ks; s.t0 = t; t += s.len; }
    const cyc = (ud.rise_h > 0 ? ud.rise_h * H / vc : ud.cycle ?? 1) * ks;  // seconds a clip cycle takes on the trunk: one cycle's rise at the climb's pace
    const old = ch.goal; ch.goal = { a, perch: P, segs, t: 0, i: -1, cc, cyc, ts: (ud.cycle ?? 1) / cyc, kc: -1, yaw, clip, done }; if (old && old !== ch.goal) old.done?.();
  }
  airOf(ch, name) {  // a leaping clip's time off the floor and its feet's highest: [t0, t1 (s), apex (m)], from its "takeoff"/"land"/"apex_h" marks, else its own feet; null: not a leap, or none found
    const c = ch.clips?.[name], u = c?.userData ?? {}; if (!c || !/jump|leap|hop|pounce|flip|bound/i.test(name)) return null;
    if (u.land > u.takeoff) return [u.takeoff, u.land, (u.apex_h ?? 0.3) * ch.height];
    return (ch.airs ??= {})[name] ??= (() => { if (!ch.model || !soles(ch).length) return null; const n = 48, y = []; for (let i = 0; i <= n; i++) y.push(footIn(ch, c, i * c.duration / n));
      const i0 = y.findIndex(v => v > 0.04 * ch.height), i1 = y.findLastIndex(v => v > 0.04 * ch.height); return i0 < 0 ? null : [Math.max(0, i0 - 1) * c.duration / n, Math.min(n, i1 + 1) * c.duration / n, Math.max(...y)]; })();
  }
  unperch(ch) {  // off its perch: the branch springs back, its perch clip is no longer what it rests in, and it goes on from its feet (a hang's origin is the branch)
    const P = ch.perch; if (!P) return;
    if (P.dip) P.dip.load = 0;
    if (ch.hold === P.clip) ch.hold = "Idle";
    if (ch.model && soles(ch).length) ch.pos.y = Math.min(ch.pos.y, ch.body.getWorldPosition(_a).y + footAt(ch));
    ch.perch = null;
  }
  dip(o, p, deg, H) {  // a branch under a new weight: it sags `deg` with an overshoot, springs, and settles; a few leaves shaken down
    o.updateWorldMatrix(true, true);
    let morph = null, b = null; o.traverse(m => { const e = m.morphTargetDictionary && Object.entries(m.morphTargetDictionary).find(([k]) => /dip|bend|sag/i.test(k)); if (e && !morph) morph = [m, e[1]]; if (!b && m.isBone) b = m; });
    const n = b ?? o, piv = n.getWorldPosition(new Vector3()), d = new Vector3(p.x - piv.x, 0, p.z - piv.z), A = deg * Math.PI / 180;
    const ax = UP3.clone().cross(d.lengthSq() > 1e-10 ? d.normalize() : d.set(1, 0, 0)).applyQuaternion(n.parent.getWorldQuaternion(new Quaternion()).invert());  // about up x the way out: the tip goes down
    const D = { o, n, morph, q0: n.quaternion.clone(), ax, A, th: 0, v: 0.6 * 2 * Math.PI * 1.8 * A, load: 1 };  // landing on it: a kick of speed
    this.dips.push(D);
    globalThis.live?.sfx?.play("gust", { at: new Vector3(p.x, floorAt(this.floors(), p.x, p.y - 0.02, p.z, 0, 5) ?? p.y - H, p.z), shed: o, level: 2, size: 0.8 * H, tint: [0.45, 0.62, 0.3] });
    return D;
  }
  spring(D, dt) {  // the sag: a damped spring (1.8 Hz, damping 0.22) toward its load (1: the weight on it, 0: let go); false once settled unloaded
    const w = 2 * Math.PI * 1.8; D.v += (-w * w * (D.th - D.A * D.load) - 2 * 0.22 * w * D.v) * dt; D.th += D.v * dt;
    if (!D.load && Math.abs(D.th) < 1e-4 && Math.abs(D.v) < 1e-3) D.th = 0;
    this.bend(D);
    return D.load || D.th !== 0;
  }
  bend(D) {  // the sag drawn: a shape key's weight (the point stays), else the bone or node turned about its own origin
    if (D.morph) D.morph[0].morphTargetInfluences[D.morph[1]] = Math.max(0, D.th / D.A);
    else D.n.quaternion.setFromAxisAngle(D.ax, D.th).multiply(D.q0), D.n.updateWorldMatrix(false, true);
  }

  busy(line) { return this.acts.some(a => a.wait && a.line === line && a.state !== "done"); }  // the reading waits on these

  reset() {  // "Read again": every act waits for its line again; nobody is mid-act (live.js puts them back where the page began)
    this.fades.forEach(f => f.end()); this.fades = [];
    this.acts.forEach(a => (a.state = "wait")); this.taps = {}; this.passed.clear(); this.line = null; this.rises = []; this.glows = []; this.lifted = {}; this.shapes = [];
    this.later = []; this.knocks = []; for (const d of this.dips) (d.th = 0), this.bend(d); this.dips = [];  // knocked props back where the page put them, branches still
    for (const o of this.knocked) { const k0 = o.userData.knock0; o.quaternion.copy(k0.q); o.position.copy(k0.p); this.put(o.name, o.parent.localToWorld(k0.p.clone())); }
    for (const [m, w] of this.base) m.morphTargetInfluences.splice(0, w.length, ...w);
    for (const o of [...this.was.keys()]) this.vis(o, true, 0, () => {});
    for (const ch of this.cast) if (ch.glowing) glow(ch.body, (ch.glowing = 0));
    for (const ch of this.cast) (ch.goal = ch.slide = ch.facing = ch.perch = ch.scout = null), mood(ch, "natural");
    this.open();
  }

  open() { const tell = this.started; this.started = () => {}; this.acts.filter(a => a.line === "open").forEach(a => this.start(a)); this.started = tell; }  // the starting state (the banana plant a pup: Step1, secs 0) before the spread is first drawn, with no act foley

  // a tap on `name`: its acts whose line is "tap:<name>" start (again, whatever state they are in; a running one is cut short)
  tap(name) {
    const nth = a => +a.nth >= 1 ? +a.nth : (a.nth != null && (a.nthBad ??= (console.warn(`act "nth" is not a number of taps: it plays as an ordinary tap act`, a), true)), 0);  // "3" written as text counts as 3 (it never played, silently); anything else is said once
    const all = this.acts.filter(a => a.line === `tap:${name}`), top = Math.max(0, ...all.map(nth)), n = top ? this.taps[name] = (this.taps[name] ?? 0) + 1 : 0;
    (top ? all.filter(a => (all.some(b => nth(b) === n) ? nth(a) === n : !nth(a))) : all).forEach(a => this.start(a));
    if (n >= top) delete this.taps[name];  // "nth": the count starts again after the last surprise
  }

  // shape: ease shape keys of the meshes under `o`; with `back`, a second ease returns them after `back` s
  shape(a, o, done) {
    const key = a.key, ms = []; o.traverse(m => m.morphTargetDictionary && key in m.morphTargetDictionary && ms.push(m));
    if (!ms.length) return console.warn(`no shape key "${key}" under "${a.what}"`, a), done();
    const items = [];  // [mesh, key index, from, to, the weight to go back to]
    for (const m of ms) {
      if (!this.base.has(m)) this.base.set(m, [...m.morphTargetInfluences]);
      for (const [k, i] of Object.entries(m.morphTargetDictionary)) if (k === key || a.only) {  // "back" goes to the weight before this act, or, on a key still easing, before the act that moved it (a second tap mid-fold)
        const live = this.shapes.flatMap(g => g.items).find(([n, j]) => n === m && j === i);
        items.push([m, i, m.morphTargetInfluences[i], k === key ? a.to ?? 1 : 0, live ? live[4] : m.morphTargetInfluences[i]]);
      }
    }
    for (const g of this.shapes) g.items = g.items.filter(([m, i]) => !items.some(([n, j]) => n === m && j === i));  // the newest act on a key wins
    const run = (its, len, wait, fin) => this.shapes.push({ items: its, t: 0, len, wait, fin, set(k) { this.items.forEach(([m, i, f, t]) => (m.morphTargetInfluences[i] = f + (t - f) * k)); } });
    // shortcut: reset returns keys to their first-seen weight (this.base), then "open" acts run; upgrade if a page needs a reset to somewhere else
    const len = a.secs ?? 1;
    if (!len) items.forEach(([m, i, , t]) => (m.morphTargetInfluences[i] = t));  // secs 0: at once, not on the next tick (an "open" act lands before the first frame)
    run(items, len, 0, g => { done(); if (a.back != null && g.items.length) run(g.items.map(([m, i, , , b]) => [m, i, m.morphTargetInfluences[i], b, b]), len, a.back, () => {}); });  // a key a newer act took is not returned
  }

  ready(a, t) {
    const heard = this.passed.has(a.line) || (a.line === this.line && t >= (a.word ? this.wordAt(a.line, a.word) : 0));
    return heard && (a.after == null || a.prev < 0 || this.acts[a.prev].state === "done");
  }

  pace(ch, kind, clip) {  // motion.json: {"kapi": {"Walk": {"speed": book metres a second, "cycle": seconds}}}; clip: a move act's own gait ("clip": "Walk Out")
    const mo = this.motion[ch.name]?.[clip ?? (MOVE[kind] || kind[0].toUpperCase() + kind.slice(1))];
    return +(mo?.speed ?? mo) || PACE[kind] * ch.height;
  }

  at(on) { return on.body?.position ?? on.pos; }  // where a character stands, bobbing on the water included

  start(a) {
    const done = () => (a.state = "done");
    if (a.face != null && this.by[a.who]) this.by[a.who].faced = a.line;  // where it looks on this line is the page's, not the talk rule's
    if (a.do === "rise" && !a.who) return this.rises.push({ what: a.what, from: this.lifted[a.what] ?? 0, by: a.by ?? 0.12, t: 0, len: a.secs ?? 1.2, done }), void (a.state = "run"), void this.started(a);
    if (a.do === "hide" || a.do === "show") {
      const o = a.who ? this.by[a.who]?.body : this.find(a.what);
      if (!o) return done();
      return this.vis(o, a.do === "show", a.fade, done), void (a.state = a.state === "done" ? "done" : "run"), void this.started(a);
    }
    if (a.do === "shape") {  // the shape keys of a prop of the spread (the banana plant growing, the shy plant folding)
      const o = this.find(a.what);
      if (!o) return console.warn("nothing to shape:", a), done();
      return a.state = "run", this.shape(a, o, done), void this.started(a);
    }
    if (a.do === "glow") {  // games.js's warm light on a character's body
      const ch = this.by[a.who];
      if (!ch?.body) return done();
      return this.glows.push({ ch, from: ch.glowing ?? 0, to: a.by ?? 1, t: 0, len: a.secs ?? 0.8, done }), void (a.state = "run"), void this.started(a);
    }
    if (a.do === "knock") return a.state = "run", this.started(a), this.knock(a, done);
    if (a.do === "fly" && !a.who) {  // {"what": "kite", "do": "fly", "to": [x, y, z], "up": 0.3, "secs": 3}: a carried prop, away from where it is
      const from = this.spot(a.what), to = from && this.where(a.to);
      if (!to) return console.warn("nothing to fly:", a), done();
      to.y += a.up ?? 0;
      return this.flights.push({ what: a.what, from, to, arc: a.arc ?? 0.25 * from.distanceTo(to), t: 0, len: a.secs ?? 2, done }), void (a.state = "run"), void this.started(a);
    }
    const ch = this.by[a.who];
    if (!ch) return console.warn("act for a character not on this page:", a), done();
    if (a.mood) mood(ch, a.mood);  // {"do": "mood", "mood": "sad"}, or a mood on any other act
    if (a.do === "mood") return done();
    if (a.do === "kick" || a.do === "scout") return a.state = "run", this.started(a), this[a.do](ch, a, done);
    if (/^(perch|hang|dangle)$/.test(a.do)) return a.state = "run", this.started(a), this.perch(ch, a, done);
    if (this.ground && !a.go && this.goable(ch, a)) {  // "ground": a walker told to float along the ground walks there instead (go-to); a rigid body hops or does not travel
      const rigid = !skinned(ch.model) && !ch.c?.model?.startsWith("puppet:"), hop = this.motion[ch.name]?.Hop;
      if (rigid && (a.gait ?? hop?.gait) !== "hop") return (a.warned ??= (console.warn(`${ch.name} is rigid and does not glide along the ground: the act is refused (Rule 28; a hopper needs "gait": "hop")`, a), true)), done();
      a.go = rigid ? "hop" : a.do === "float" ? (GAIT.test(a.clip ?? "") && /^run/i.test(a.clip) ? "run" : "walk") : a.do;
    }
    const target = MOVE[a.do] || a.do === "climb" || a.do === "jump" || (a.do === "fly" || a.do === "float") && a.to != null ? a.to : a.do === "face" ? a.face : null;
    if (target != null && !this.where(target)) return console.warn(`nothing to ${a.do} to: "${target}" is not on this page`, a), done();
    a.state = "run"; this.started(a);
    const take = (slot, v) => { const old = ch[slot]; ch[slot] = v; if (old && old !== v) old.done?.(); };  // the act it replaces is finished, so a wait never hangs
    const stay = a.do === "clip" && a.ride && !a.to && ch.ride?.on === this.by[a.ride];  // a clip on the mount it rides (Sit Down, Stand Up on Bobo's back): the ride, and its hold, go on
    const moving = !stay && (MOVE[a.do] || ["fly", "float", "rise", "climb", "jump"].includes(a.do) || (a.do === "clip" && (a.to || a.ride)));
    if (moving) { ch.moved = true; ch.ride = null; this.unperch(ch); }  // on its own feet now: off whatever it rode, off its entrance path, off its perch
    if (a.go === "hop") {  // a rigid hopper: whole hops along the line, each an arc, a landing, and a rest (motion.json "Hop": {"gait": "hop", "hop": m, "hop_h": m, "cycle": s})
      const mo = this.motion[ch.name]?.Hop ?? {}, from = ch.pos.clone(), to = this.where(a.to).setY(from.y), d = Math.hypot(to.x - from.x, to.z - from.z), L = a.hop ?? mo.hop ?? 0.6 * ch.height;
      take("goal", { a, hop: true, from, to, n: Math.max(1, Math.ceil(d / L - 1e-6)), cyc: a.cycle ?? mo.cycle ?? 0.6, hh: a.hop_h ?? mo.hop_h ?? 0.35 * ch.height, t: 0, done });
      ch.want = yawTo(from, to);
    } else if (MOVE[a.go] || MOVE[a.do]) {
      const kind = MOVE[a.go] ? a.go : a.do, ground = !!this.ground && kind !== "swim";
      const clip = a.clip && ch.clips?.[a.clip] && (!a.go || GAIT.test(a.clip)) ? a.clip : null, own = MOVE[kind];  // a "clip" the character lacks: the act's own gait, one warning
      const sub = !this.legacy && !clip && !ch.clips?.[own] ? [FALL[own], FALL[FALL[own]]].find(n => n && ch.clips?.[n]) : null;  // no clip of its own: the standard set's stand-in, played at this gait's pace (feet planted)
      const gait = clip ?? sub ?? own, sh = !this.legacy && ch.clips?.[gait]?.userData?.speed_h, rate = (a.rate ?? 1) * (sub ? PACE[kind] / PACE[sub.toLowerCase()] : 1);
      const row = this.motion[ch.name]?.[gait] ?? (sh ? { speed_h: sh } : undefined);  // no motion.json row for this cast name: the clip's own stride (tools/locomotion.py "speed_h")
      if (a.clip && !clip) console.warn(`${ch.name} has no clip "${a.clip}": ${gait}`, a);
      else if (clip && !row) console.warn(`no motion row "${clip}" for ${ch.name}: Walk's pace`, a);
      if (ground && !ch.clips?.[gait]) return (a.warned ??= (console.warn(`${ch.name} has no "${gait}" clip: it does not glide along the ground, the act is refused`, a), true)), done();  // a go-to moves only while its gait plays: without one it would never arrive
      const back = row?.back ?? kind === "stepback";
      // "ground": the stride at the size it is staged (motion.json speed_h x height), so the feet stay where they land; otherwise the row's own speed
      const pace = (ground && row?.speed_h ? row.speed_h * ch.height : clip && !row ? this.pace(ch, "walk") : this.pace(ch, sub ? sub.toLowerCase() : kind, clip)) * rate;
      take("goal", { a, pace, rate, lean: kind === "dash" && sub ? 0.2 : 0, back, go: ground, gait, stop: a.go ? 0 : 0.05, done }); this.loop(ch, gait);
      if (ch.cur && ch.cur.getClip() === ch.clips?.[gait]) ch.cur.timeScale = rate;  // "rate": the clip and its pace both faster, the feet still planted
    } else if (a.do === "clip") {
      if (a.then) ch.hold = a.then;  // a mood is held from the moment it is set: a line said meanwhile is that mood's talk
      if (a.clip === a.then && !a.to && !a.ride) return this.loop(ch, a.clip), done();  // "clip": "Worry", "then": "Worry": worried now
      // a Throw "to" a character names who catches (live.js throws to ch.catcher, else the nearest), who turns to the thrower
      const catcher = /^Throw/.test(a.clip) && this.by[a.to];
      if (/^Throw/.test(a.clip)) ch.catcher = catcher || null;
      if (catcher && !catcher.goal) look(catcher, ch.pos);
      if (stay) { if (a.up != null) ch.ride.gap = a.up; if (a.face) look(ch, this.where(a.face)); ch.ride.stay = true; }
      const on = !stay && this.by[a.ride], from = ch.pos.clone();
      const base = on && (this.where(a.ride) ?? on.pos.clone()), back = on && on.model && skin(on, base.clone().setY(base.y + on.height), new Vector3(0, -1, 0), 2 * on.height)?.at;  // onto its skin
      const to = on ? base.setY((back ?? base).y + (a.up ?? on.height * 0.6)) : !catcher && a.to && this.where(a.to, true);
      const air = !on && to && this.airOf(ch, a.clip), lift = air ? to.y - from.y : 0, G = 9.8 * ch.height / (ch.c?.real ?? 1.7), A = air && Math.max(air[2], lift + 0.01 * ch.height);
      const rate = air ? Math.min(3, Math.max(1, (air[1] - air[0]) / (Math.sqrt(2 * A / G) + Math.sqrt(2 * Math.max(0, A - lift) / G)))) : 1;  // a leap whose air time is longer than its own rise and fall at the body's scale is played faster, never slower (at most 3x)
      const len = this.once(ch, a.clip, () => {
        if (stay && ch.ride) ch.ride.stay = false;
        if (a.then) ch.hold = a.then;
        this.loop(ch, ch.hold); done();
      });
      if (rate > 1 && ch.cur?.getClip() === ch.clips?.[a.clip]) ch.cur.timeScale = rate;
      if (to) take("slide", { from, to, t: 0, len: (len || 1) / rate, air, rate, done: on ? () => {  // mounted: it faces the way its mount faces, unless told where to look
        mount(ch, on, o => this.at(o)); ch.ride.gap = a.up;  // `up`: its height over the skin under its hips (carry's seat), the same on every read
        if (a.face) look(ch, this.where(a.face)); else { ch.ride.dyaw = 0; ch.want = null; ch.yaw = on.yaw; }
      } : a.face ? () => look(ch, this.where(a.face)) : null });
      if (on && !a.face) ch.want = on.yaw;  // and turns that way while it climbs on
      else if (!on && to && a.face) look(ch, this.where(a.face));  // a leap "to" a branch turns as told on the way, and lands so
    } else if (a.do === "jump") {  // a ballistic arc from the floor it stands on onto the floor at `to`
      const from = ch.pos.clone(), to = this.where(a.to, true), G = 9.8 * ch.height / (ch.c?.real ?? 1.7);  // gravity at book scale: its height as a 1.7 m person's, or as its "real" height in metres (a small monkey falls faster at its size)
      if (Array.isArray(a.to)) to.y = floorAt(this.floors(), to.x, to.y, to.z, 1, 0.05) ?? to.y;  // a point: onto the highest floor there (a rock's top)
      const clip = ch.clips?.Jump ? "Jump" : null, u = ch.clips?.Jump?.userData ?? {}, air = u.land > u.takeoff ? u.land - u.takeoff : 0;  // the standard Jump's own take-off and landing (tools/locomotion.py extras)
      const h0 = Math.max(from.y, to.y), flight = y => Math.sqrt(2 * (y - from.y) / G) + Math.sqrt(2 * (y - to.y) / G);
      let top = h0 + (a.up ?? (u.apex_h ?? 0.3) * ch.height), g = G, len = flight(top); const T = len;
      if (a.secs != null) {  // Eddie 2026-11-23: a jump that borrowed the clip's air time (or a long `secs`) floated in slow motion
        if (a.secs < T || T <= 1e-3) g = G * (T / a.secs) ** 2, len = a.secs;  // the plan's quicker hop: its apex kept, a heavier fall, never a slower one
        else {  // a longer one rises higher under the same gravity, at most 1.2 x its own flight
          const s = Math.min(a.secs, 1.2 * T), k = s * Math.sqrt(G / 2), r = (k * k - (from.y - to.y)) / (2 * k);  // r = sqrt(top - from.y), from sqrt(a) + sqrt(a + d) = k
          if (s < a.secs && !a.long) { a.long = true; console.warn(`jump "secs" ${a.secs} is over 1.2 x its own flight (${T.toFixed(2)} s): ${s.toFixed(2)} s`, a); }
          top = Math.max(h0, from.y + Math.max(0, r) ** 2); len = flight(top);
        }
      }
      len = Math.max(len, 1e-3); const rate = air ? air / len : 1;  // the clip's air is time-scaled to the flight, never the flight to the clip
      take("goal", { a, jump: true, from, to, v0: Math.sqrt(2 * g * (top - from.y)), G: g, t: 0, len, pre: air ? u.takeoff : 0, rate, clip, done }); ch.want = yawTo(from, to);
      if (clip) { const d = this.once(ch, clip, () => {}); if (d) ch.cur.timeScale = air ? 1 : d / len; }  // the crouch at the clip's own pace, the air time-scaled at take-off (move)  // it leaves the floor at the clip's take-off and lands at its landing; an old Jump (no extras) spans the flight
    } else if (a.do === "climb") {
      const to = this.where(a.to, true), clip = a.clip ?? "Climb Up", mo = this.motion[ch.name]?.[clip];
      const from = ch.pos.clone(), up = from.clone().setY(to.y), dy = Math.abs(to.y - from.y);
      // motion.json "Climb Up": {"rise": m a cycle, "cycle": s, "loop": false}: whole cycles, the body lifted with the clip's hands
      const n = mo?.rise > 0 && mo.cycle > 0 ? Math.max(1, Math.ceil(dy / mo.rise - 1e-6)) : 0;
      take("goal", { a, climb: [from, up, to], t: 0, n, cycle: mo?.cycle, each: n && mo.loop === false, clip, k: -1,
        legs: [n ? n * mo.cycle : dy / this.pace(ch, "climb"), Math.max(0.3, up.distanceTo(to) / this.pace(ch, "walk"))], done });
      ch.want = yawTo(from, to);
      if (!n || mo.loop !== false) this.loop(ch, clip);
    } else if (a.do === "fly" || a.do === "float") {
      const fly = a.do === "fly", on = this.by[a.to], from = ch.pos.clone(), pp = on && a.bone && perch(on, a.bone), at = pp ? (a.beside ? besidePoint(ch, on, pp, onBone(pp), this.cam?.position) : onBone(pp)) : this.where(a.to, !on);
      const up = a.up ?? (pp ? 0 : on ? on.height * 0.9 : 0), to = (at ?? from.clone()).setY((at?.y ?? from.y) + up);
      const dist = from.distanceTo(to), len = a.secs ?? Math.max(0.5, dist / this.pace(ch, a.do));
      take("goal", { a, air: true, from, up, on, pp, top: !on, s: 0, len, arc: fly ? 0.25 * dist : 0, sway: a.sway ?? (fly ? 0 : 0.012), done });
      this.loop(ch, a.clip ?? (fly ? "Fly" : ch.hold));
    } else if (a.do === "rise") {
      const from = ch.pos.clone();
      take("slide", { from, to: from.clone().setY(from.y + (a.by ?? 0.12)), t: 0, len: a.secs ?? 1.2, done });
    } else if (a.do === "hold") this.hold(ch, a.what, a.hand, !a.release, a), done();
    else if (a.do === "face" || a.do === "think" && a.face) take("facing", { a, done });
    else if (a.do === "think") done();
    else console.warn("unknown act:", a), done();
  }

  move(ch, dt) {
    const g = ch.goal, f = ch.facing, s = ch.slide;
    if (ch.model) ch.model.walking = /^(Walk|Run|Sprint|Sneak|Dash|Step Back)/.test(g?.gait ?? "");  // V15: a puppet's turned card (a walking pose) only while a gait carries it; standing, its front card mirrored to its side
    const sc = ch.scout;
    if (sc) {  // a scout's sweep: each look turned to over 0.5 s and held, then the head back and the hand down over 0.5 s
      sc.t += dt;
      const n = sc.pts.length, end = n * sc.per, ang = i => { const p = sc.pts[i], d = yawTo(ch.pos, p) - ch.yaw; return [Math.max(-1.2, Math.min(1.2, Math.atan2(Math.sin(d), Math.cos(d)))), Math.max(-0.6, Math.min(0.6, Math.atan2(p.y - sc.eye.y, Math.hypot(p.x - ch.pos.x, p.z - ch.pos.z))))]; };
      const i = Math.max(0, Math.min(n - 1, Math.floor(sc.t / sc.per))), u = ease(Math.min(1, (sc.t - i * sc.per) / 0.5)), [y0, p0] = i ? ang(i - 1) : [0, 0], [y1, p1] = n ? ang(i) : [0, 0], b = ease(Math.min(1, Math.max(0, (sc.t - end) / 0.5)));
      const w = sc.clip ? 0.5 : 1;  // over a Scout clip's own looking round, half the turn
      sc.yaw = (y0 + (y1 - y0) * u) * (1 - b) * w; sc.pitch = (p0 + (p1 - p0) * u) * (1 - b) * w; sc.k = sc.clip ? 0 : Math.min(1, sc.t / 0.4) * (1 - b);
      if (b >= 1) { ch.scout = null; if (sc.clip) this.loop(ch, ch.hold); sc.done(); }
    }
    if (g?.perch) {  // a perch's way: walked to the trunk, climbed (Climb Up again each cycle, at its rise), a step out onto it; then its pose
      g.t += dt;
      const i = g.segs.findIndex(s => g.t < s.t0 + s.len), s = g.segs[i];
      if (s) {
        if (i !== g.i) { g.i = i; g.kc = -1; if (s.kind !== "climb" || !g.cc) this.loop(ch, s.kind === "climb" ? ch.hold : "Walk"); }
        if (s.kind === "climb" && g.cc) { const kc = Math.floor((g.t - s.t0) / g.cyc); if (kc !== g.kc) { g.kc = kc; this.once(ch, g.cc, () => {}); if (ch.cur?.getClip() === ch.clips?.[g.cc]) ch.cur.timeScale = g.ts; } }
        const k = (g.t - s.t0) / s.len; ch.pos.lerpVectors(s.A, s.B, s.kind === "climb" ? k : ease(k)); if (s.kind === "step") ch.pos.y += 0.48 * ch.height * k * (1 - k);
        ch.want = s.yaw;
      } else {  // there: perched, posed, and the branch takes the weight
        const P = g.perch; ch.goal = null; ch.perch = P; ch.want = g.yaw; ch.pos.copy(P.at()).add(P.off);
        ch.hold = g.clip ?? g.a.then ?? "Idle"; P.clip = g.clip;
        this.loop(ch, ch.hold);
        if (P.br) P.dip = this.dip(P.br, P.at(), g.a.dip ?? 5, ch.height);
        g.done();
      }
    } else if (g?.climb) {  // straight up the trunk, then a step onto the branch
      g.t += dt;
      const [a, b, c] = g.climb, [t1, t2] = g.legs;
      if (g.t < t1) {
        ch.pos.lerpVectors(a, b, g.n ? g.t / t1 : ease(g.t / t1));  // by cycles: rising steadily, as the clip climbs
        if (g.each && Math.floor(g.t / g.cycle) !== g.k) g.k = Math.floor(g.t / g.cycle), this.once(ch, g.clip, () => {});  // a one-shot cycle, again
      } else {
        if (g.each && !g.top) g.top = true, this.loop(ch, "Walk");  // up: a step onto it
        ch.pos.lerpVectors(b, c, ease(Math.min(1, (g.t - t1) / t2)));
      }
      if (g.t >= t1 + t2) { ch.goal = null; if (g.a.then) ch.hold = g.a.then; this.loop(ch, ch.hold); g.done(); }
    } else if (g?.air) {  // fly or float: along a straight line to the target (which may move), lifted by the arc and the sway
      const to = (g.pp ? (g.a.beside ? besidePoint(ch, g.on, g.pp, onBone(g.pp), this.cam?.position) : onBone(g.pp)) : this.where(g.a.to, g.top)) ?? g.from.clone();
      to.y += g.up; g.s = Math.min(1, g.s + dt / g.len);
      ch.pos.lerpVectors(g.from, to, ease(g.s)).y += g.arc * 4 * g.s * (1 - g.s) + g.sway * Math.sin(Math.PI * g.s * Math.max(1, Math.round(g.len)));  // a sway that settles at both ends
      if (g.from.distanceTo(to) > 0.01) ch.want = yawTo(g.from, to);
      if (g.s >= 1) {
        ch.goal = null; this.loop(ch, ch.hold);
        if (g.on) mount(ch, g.on, o => this.at(o), g.a.bone, g.a.beside);  // perched: ride along (on its bone, when the act names one; or beside it)
        if (g.a.face) look(ch, this.where(g.a.face) ?? to);
        g.done();
      }
    } else if (g?.hop) {  // hops: each cycle an arc over the first 60% and a rest on the ground; the body faces its travel
      g.t += dt; const k = Math.min(g.n, g.t / g.cyc), i = Math.floor(k), u = Math.min(1, (k - i) / 0.6), air = i < g.n && k - i < 0.6;
      ch.pos.lerpVectors(g.from, g.to, Math.min(1, (i + (i < g.n ? ease(u) : 0)) / g.n)).y += air ? 4 * g.hh * u * (1 - u) : 0;
      if (g.t >= g.n * g.cyc) { ch.goal = null; ch.pos.copy(g.to); if (g.a.face) look(ch, this.where(g.a.face)); g.done(); }
    } else if (g?.jump) {  // level travel even in time, height under gravity: off the floor at its start, onto the floor at its end
      if (g.pre && g.t < g.pre && g.t + dt >= g.pre && ch.cur?.getClip() === ch.clips?.[g.clip]) ch.cur.timeScale = g.rate;  // off the floor: the clip's air to the flight's own time
      g.t += dt; const s = Math.max(0, Math.min(1, (g.t - g.pre) / g.len)), t = s * g.len;  // before its take-off it crouches where it stands
      ch.pos.lerpVectors(g.from, g.to, s).y = g.from.y + g.v0 * t - 0.5 * g.G * t * t;
      if (s >= 1) { ch.goal = null; ch.pos.copy(g.to); this.loop(ch, ch.hold); if (g.a.face) look(ch, this.where(g.a.face)); g.done(); }
    } else if (g?.go) {  // "ground" go-to: it turns toward the target at GO_TURN and walks along its own heading at its stride (the clip slowed with it
      // while it turns, so the planted feet stay planted), straight in over the last 0.4 s of travel; its height is the floor under it, a step up or down
      const to = this.where(g.a.to), d = to && _v.copy(to).sub(ch.pos).setY(0), left = d ? d.length() - (g.a.stop ?? g.stop) : 0;
      if (left <= 0.002) {
        ch.goal = null; if (ch.cur) ch.cur.timeScale = 1; this.loop(ch, ch.hold);
        if (!g.back || g.a.face) look(ch, this.where(g.a.face ?? g.a.to));
        g.done();
      } else {
        ch.want = Math.atan2(d.x, d.z) + (g.back ? Math.PI : 0);
        if (ch.cur?.getClip() !== ch.clips?.[g.gait]) { if (!ch.done) this.loop(ch, g.gait); }  // only the gait moves it: a clip the page plays meanwhile (a Dig on a word) waits, its `then` held for the arrival
        else {
        const near = left < g.pace * 0.4, k = near ? 1 : Math.max(0.35, Math.cos(ch.want - ch.yaw)), s = Math.min(left, g.pace * k * dt * ch.cur.getEffectiveWeight());  // as far as the gait shows: no travel on legs still fading in from a stand
        if (ch.cur && ch.cur.getClip() === ch.clips?.[g.gait]) ch.cur.timeScale = (g.rate ?? g.a.rate ?? 1) * k;
        if (near) d.normalize(); else d.set(Math.sin(ch.yaw), 0, Math.cos(ch.yaw)).multiplyScalar(g.back ? -1 : 1);
        ch.pos.addScaledVector(d, s);  // its height: solid(), from the floor under its feet
        }
      }
    } else if (g) {
      const to = this.where(g.a.to), d = to && to.clone().sub(ch.pos).setY(0), left = d ? d.length() - (g.a.stop ?? 0.05) : 0;
      if (left <= 0.002) {  // arrived: face what it came to, or what the act names
        ch.goal = null; this.loop(ch, ch.hold);
        if (!g.back || g.a.face) look(ch, this.where(g.a.face ?? g.a.to));
        g.done();
      } else { ch.pos.addScaledVector(d.normalize(), Math.min(left, g.pace * dt)); ch.want = Math.atan2(d.x, d.z) + (g.back ? Math.PI : 0); }
    }
    if (s) {
      s.t += dt; ch.pos.lerpVectors(s.from, s.to, s.air ? Math.min(1, Math.max(0, (s.t * s.rate - s.air[0]) / (s.air[1] - s.air[0]))) : ease(Math.min(1, s.t / s.len)));  // a leap travels while its feet are off the floor
      if (s.t >= s.len) ch.slide = null, s.done?.();
    }
    if (ch.perch && !ch.goal) { const P = ch.perch; ch.pos.copy(P.at()).add(P.off); P.k = Math.min(1, P.k + dt / (P.pose === "hang" ? 0.2 : 0.4)); }  // perched: on the point as it dips, the pose blending in
    const lw = ch.goal?.lean ?? 0; if (ch.lean || lw) ch.lean = Math.abs(lw - ch.lean) < 1e-3 ? lw : (ch.lean ?? 0) + (lw - (ch.lean ?? 0)) * Math.min(1, 6 * dt);  // a dash leans in, and straightens after
    if (ch.ride && !ch.slide) carry(ch, o => this.at(o), this.cam?.position);  // riding: carried along
    if (f && !g?.go) {  // a go-to walking: a face act waits for the arrival (it would steer the walk sideways)
      const p = this.where(f.a.face);
      look(ch, p);
      if (!p || ch.want == null || Math.abs(Math.sin((ch.want - ch.yaw) / 2)) < 0.02) { ch.facing = null; f.done(); }
    }
    if (ch.want != null) {
      ch.yaw = turn(ch.yaw, ch.want, (g?.go ? GO_TURN : TURN) * dt);
      if (Math.abs(Math.sin((ch.want - ch.yaw) / 2)) < 1e-4 && !ch.goal) ch.want = null;  // turned: a rider then turns with its mount
    }
    if (ch.ride) ch.want != null ? (ch.ride.dyaw = ch.yaw - ch.ride.on.yaw) : (ch.yaw = ch.ride.on.yaw + ch.ride.dyaw);
  }

  // Only the active speaker makes a small eased gesture on their turn (under 3 deg lean for paper, calm clip or head nod/turn for 3D);
  // silent listeners stand calm and never flip or spin.
  talk(speakers, think = false) {
    const list = Array.isArray(speakers) ? speakers : speakers ? [speakers] : [];
    const active = new Set(list), shown = this.cast.filter(c => c.body?.visible !== false && !this.was.has(c.body));
    const person = c => (!this.people || this.people.has(c.name)) && !/^(sun|crane|fish|frog|snail|season|sea-drum|shell-chime)/.test(c.name);
    for (const ch of this.cast) {
      const on = active.has(ch), was = !!ch.talking, paper = !!ch.c?.model?.startsWith("puppet:");
      const talkClip = !think && !paper ? (ch.clips?.[`${ch.hold} Talk`] ? `${ch.hold} Talk` : ch.hold === "Idle" && ch.clips?.Talk ? "Talk" : null) : null;
      if (on !== was && talkClip && !ch.goal) this.loop(ch, on ? talkClip : ch.hold);
      ch.talking = on;
      ch.thinking = on && think;
      if (!on) continue;
      const mine = c => c === ch.ride?.on || c.ride?.on === ch || this.holds.get(c.name) === ch || (c.ride && this.holds.get(c.ride.on.name) === ch);
      const near = shown.filter(c => c !== ch && !active.has(c) && person(c) && !mine(c) && Math.hypot(c.pos.x - ch.pos.x, c.pos.z - ch.pos.z) >= (ch.height ?? 0.1) * 0.25)
        .sort((a, b) => a.pos.distanceTo(ch.pos) - b.pos.distanceTo(ch.pos))[0];
      if (!was || ch.talkDir == null) ch.talkDir = near ? Math.sign(near.pos.x - ch.pos.x) || 1 : (ch.pos.x > 0 ? -1 : 1);
      ch.talkNear = !think && near && ch.faced !== this.line ? near : null;
    }
  }

  get poses() { return Object.fromEntries(this.cast.map(c => [c.name, { pos: c.pos.toArray(), yaw: c.yaw, hold: c.hold }])); }
}
