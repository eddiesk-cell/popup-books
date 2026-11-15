// storyfx.js — the story effects (unit FX2, stories/EFFECTS.md sections 3 and 5): splash, wake, rings, sparkle, gust, shimmer, halo, notes, dust,
// rain, haze, embers, breath, shooting-star, dust-whirl, soft-lightning, puff, wash, bubbles, sunrays. The fx.js pattern: emit writes attributes once, all motion is
// in the vertex shaders from one time uniform, the clock is its own (update(dt) adds up), so a fixed-step recorder gets the same show every time.
//
// API (the wiring is written from this comment alone):
//   const sfx = createStoryFx(scene, renderer, { phone, reduced, sound })
//     phone    fewer particles: a budget of 600 live (3200 on desktop); when it is full NEW particles are dropped, nothing running is removed;
//              weather (rain, gust) may hold at most 60% of it, so an effect played during a storm always gets its particles
//     page     THREE.Box3 of the open book (world); nothing draws outside it (default x -1..1, z -0.666..0.666)
//     reduced  the reduced-motion forms (default: prefers-reduced-motion)
//     sound    (name, gain) => void; called once when an effect starts, gain <= 0.4; the module plays nothing itself
//   sfx.play(type, o) -> handle { stop(), done, live, type, level }   stop() fades everything it made out over 0.6 s
//     type     splash | wake | rings | sparkle | gust | shimmer | halo | notes | dust | rain | haze | embers | breath | shooting-star |
//              dust-whirl | soft-lightning | puff | wash | bubbles | sunrays   (aliases: heat-shimmer = haze, music-notes = notes level 2, wind-streaks = gust, green-wash = wash)
//     o.at     THREE.Vector3, where (world)            o.follow  an Object3D the effect rides with (its world position; effects sit low on it)
//     o.size   the subject's height in metres (0.1)    o.level   1 to 3 (each kind's own meaning, EFFECTS.md section 3)
//     o.secs   how long (else the kind's own length; halo, rain, haze, embers, breath, wash, wake, sparkle 1-2, notes 2 run until stop())
//     o.until  wake only: "stop": a follower that stops moving for 0.3 s ends it, its V fading into 3 slow rings
//     o.waterY the water's height (splash, wake, rings, shimmer; halo draws a reflection; rain makes rings on it, else dark spots)
//     o.dir    Vector3, wind or travel direction (gust, wake, notes, breath, dust-whirl, splash level 3's spray)
//     o.card   THREE.Texture for gust's leaves, petals, straw (one card at a time: the latest gust's)
//     o.shed   gust only: an Object3D (or Vector3) that 2 to 5 leaves are shaken loose from
//     o.toward Vector3: where shimmer's glint path points, where a shooting star goes
//     o.tint   [r, g, b] 0..1 (puff grey, wash colour, shimmer gold ...)   o.radius wash's radius (4 x size)   o.every  rings, breath (s)
//     o.region rings: { x0, x1, z0, z1, y } or a Box3     o.width rain and gust width (1.4)
//     o.area   [w, d] metres, a rectangle on the ground centred at o.at: shimmer, rain, haze, wash, gust and rings spread over it
//     o.every  splash, dust-whirl, shooting-star, puff: repeat every `every` s until stop() (at-rest life); rings, breath: their interval
//     bubbles  a few round bubbles rise from o.at (level 1-3: 3, 6, 12; o.area scatters the sources) and pop at the top of their rise; ends on its own
//     sunrays  soft beams from above onto o.at and up to 3 more spots (o.spots: [{ at: Vector3, level? }]), a pool of light on each, dust motes only inside a beam;
//              o.width (beam width, 0.12), o.height (0.7), o.from [dx, dz] (where the light is, per metre of height; default upstage-left); runs until stop()/o.secs,
//              fades in over 1.6 s and out over 1.5 s; reduced: beams and pools still, no motes. 1 beam draw; one mesh for every beam on the page (8 at most)
//   sfx.rings(every, region) -> handle   (the same as play("rings", { at, area, every }))
//     at-rest life on still water: one slow soft ring every `every` s (+-40%) at a random place in region
//   sfx.clear()             "Read again": everything gone at once
//   sfx.update(dt, camera)  every frame
//   sfx.stats()             { live, rings, cards, wakes, draws, effects, slots, held, dropped, budget, caps }   64 effects at once (the oldest is ended, done, to make room), 8 wakes
//   sfx.onScreen(camera, "rain"|"cards")  how many rain streaks or cards a child sees right now (the check's measure)
//   sfx.dispose()
// Guard rails held here, not by pages: nothing draws in the top quarter of the screen (faded out by screen height in every shader); nothing is
// brighter than a light cue and nothing full-frame changes faster than 0.5 s; follow effects sit below the subject's shoulders; nothing is a raycast target.
import * as THREE from "three";

const NS = 64, TAU = Math.PI * 2, LIFT = .003;  // what lies on the water sits 3 mm above the paper
const BIAS = "gl_Position.z -= 2e-4 * gl_Position.w;";
const PAGE = "uniform float uGround; float onPage(vec3 w) { vec3 d = w - cameraPosition; vec3 h = d.y < -1e-4 ? cameraPosition + d * max(1., (uGround - cameraPosition.y) / d.y) : w;" +  // where the eye's line through the point meets the page: the point shows over the book only if that does
  " float bx = mix(.06, .2, smoothstep(.1, -.4, h.z)); return smoothstep(uPage.x, uPage.x + bx, h.x) * smoothstep(uPage.y, uPage.y - bx, h.x) * smoothstep(uPage.w, uPage.w - .06, h.z) * smoothstep(uPage.z - 3., uPage.z - 2.5, h.z); }";  // nothing over the room: everything fades out at the open book's edges (wider at the back corners, beside a standing backdrop)
const TUCK = "a *= 1. - uTuck * smoothstep(.64, .73, gl_FragCoord.y / uH);";  // the read-along words sit in the top quarter: nothing reaches it
// Particle kinds: 0 dot (a crisp glint, ember) · 1 four-point star · 2 soft glow · 3 rain streak · 4 soft puff · 5 ring of light · 6 paper note · 7 reflection · 8 spot on the ground
// · 9 dust strung on a funnel helix · 10 wind line (a dot of a ribbon) · 11 fire spark (stretched, orange with a dark rim) · 12 water drop (paper-white, blue edge) · 13 bubble (clear, bright rim, dark outline, a glint)
const PVS = `uniform float uT, uH, uMinPx; uniform vec4 uS[${NS}], uPage; ${PAGE}
attribute vec3 aV; attribute vec4 aA, aC, aD, aE, aG; varying vec4 vC; varying float vK, vR, vAge, vW, vPx;
void main() {
  float age = uT - aA.x, life = aA.y, k = aA.w; vec4 S = uS[int(aD.z + .5)];
  if (age < 0. || age > life || S.w <= 0.) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  float u = age / life, sd = aD.w;
  vec3 p = position + aV * (aD.x < 1e-3 ? age : (1. - exp(-aD.x * age)) / aD.x); p.y -= .5 * aD.y * age * age;
  if (k > 8.5 && k < 9.5) { float r = aE.z * (.25 + 2.2 * u), an = aG.y * age + step(.5, sd) * 3.1416; p += vec3(cos(an) * r, aE.z * 6. * u, sin(an) * r); }  // two strands: the angle follows the height, so the dust is strung on a helix
  else if (aE.z > 0.) { float f = aG.y + sd * 2.; if ((k > 5.5 && k < 6.5) || (k > 9.5 && k < 12.5)) p.y += aE.z * sin(age * f + sd * 6.28); else { p.x += aE.z * sin(age * f + sd * 6.28); p.z += aE.z * cos(age * f * .8 + sd * 4.); } }
  p += S.xyz;
  float a = clamp(age / max(aE.x, 1e-3), 0., 1.) * clamp((life - age) / max(aE.y, 1e-3), 0., 1.) * aC.a * S.w;
  a *= onPage(p);
  if (aE.w > 0.) a *= .5 + .5 * pow(.5 + .5 * sin(age * aE.w + sd * 6.2832), 2.);
  float s = aA.z * (1. + aG.x * u); if (aG.w > 0. && k < 6.5) s *= 1. + .1 * sin(age * aG.w * 6.2832 + sd * 6.28);
  vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  gl_Position = c; ${BIAS} float px = s * uH * .5 * projectionMatrix[1][1] / c.w; gl_PointSize = clamp(px, k > 10.5 && k < 11.5 ? uMinPx * 2.5 : k < 1.5 || k > 9.5 ? uMinPx : k > 3.5 && k < 4.5 ? uMinPx * 2.5 : k > 2.5 && k < 3.5 ? uMinPx * 5. : 0., k > 2.5 && k < 3.5 ? 90. : k > 12.5 ? 40. : k > 11.5 ? 18. : 256.);  // rain streaks at most 90 px long, drops at most 18 px, at any camera  // a phone keeps dots and stars at least uMinPx wide, puffs 2.5 times that, rain streaks 5 times that long
  vC = vec4(aC.rgb, a); vK = k; vR = sd; vAge = age; vW = aG.w; vPx = gl_PointSize;
}`;
const PFS = `uniform float uH, uTuck; varying vec4 vC; varying float vK, vR, vAge, vW, vPx;
void main() {
  vec2 q = gl_PointCoord * 2. - 1.; q.y = -q.y; float d = length(q), m = 0.; vec3 col = vC.rgb;
  if (vK < .5) m = smoothstep(1., .5, d);
  else if (vK < 1.5) { float an = (vR - .5) * .5, c = cos(an), s = sin(an); vec2 r = abs(vec2(c * q.x - s * q.y, s * q.x + c * q.y));
    m = clamp(smoothstep(1., 0., r.x * 7. + r.y) + smoothstep(1., 0., r.y * 7. + r.x) + smoothstep(.3, .0, d), 0., 1.); }
  else if (vK < 2.5) m = exp(-d * d * 4.) * smoothstep(1., .75, d);
  else if (vK < 3.5) { float w = clamp(1.6 / vPx, .025, .12), x = abs(q.x);  // a streak at least 2 px wide: a paper-white core with a darker blue-grey edge, so it holds on white foam and dark water
    m = smoothstep(w * 1.9, w, x) * smoothstep(1., .35, abs(q.y)); col = mix(vec3(.25, .33, .42), vC.rgb, smoothstep(w, w * .35, x)); }
  else if (vK < 4.5 || (vK > 8.5 && vK < 9.5)) m = smoothstep(1., .15, d) * (.85 + .15 * sin(q.x * 5. + vR * 20.) * sin(q.y * 4. + vR * 9.));
  else if (vK < 5.5) m = smoothstep(.13, .0, abs(d - .8));
  else if (vK < 6.5) { vec2 h = (q - vec2(-.2, -.48)) * vec2(1., 1.45); float head = smoothstep(.3, .26, length(h)), stem = step(.04, q.x) * step(q.x, .14) * step(-.5, q.y) * step(q.y, .72),
      flag = step(.1, q.x) * step(q.x, .5) * step(.36 + q.x * .55, q.y) * step(q.y, .62 + q.x * .55); m = max(head, max(stem, flag)); }
  else if (vK < 7.5) m = exp(-(q.x * q.x * 9. + q.y * q.y * 1.3)) * (.7 + .3 * sin(q.y * 13. + vR * 6. + vAge * vW * 6.));
  else if (vK < 8.5) m = smoothstep(1., .45, length(q * vec2(1., 3.2)));
  else if (vK < 10.5) { float e = length(q * vec2(1., 2.6)); m = smoothstep(1., .7, e); col = mix(vec3(.2, .3, .38), vC.rgb, smoothstep(.8, .45, e)); }  // a dash along the wind: overlapping dashes draw one continuous line
  else if (vK < 11.5) { float e = length(q * vec2(2.8, 1.)); m = smoothstep(1., .7, e); col = mix(vec3(.5, .12, .02), vec3(1.5, .8, .25), smoothstep(.75, .1, e)); col = mix(col, vC.rgb, .35); }  // a spark: stretched along its rise, a dark red rim round a bright orange core
  else if (vK > 12.5) { vec2 g = q - vec2(-.36, .36); m = smoothstep(1., .9, d) * (.22 + .78 * smoothstep(.45, .78, d)) + .9 * smoothstep(.3, .1, length(g * vec2(1., 1.6)));  // a bubble: a clear disc, a bright rim, a glint
    col = mix(vC.rgb, vec3(.06, .22, .34), smoothstep(.7, .88, d) * (1. - smoothstep(.1, .3, length(g)))); m = min(m, 1.); }
  else { m = smoothstep(1., .8, d); col = mix(vec3(.3, .52, .68), vC.rgb, smoothstep(.85, .45, d)); }  // a drop: paper-white with a blue edge
  float a = vC.a * m; ${TUCK}
  if (a < .003) discard;
  gl_FragColor = vec4(col, min(a, 1.));
}`;
// The flat pool on the water and the ground: 0 ring that opens · 1 wash that spreads and stays · 2 ring held still · 3 wash that only fades in
const RVS = `uniform float uT; uniform vec4 uS[${NS}], uPage; ${PAGE} attribute vec3 aP; attribute vec4 aR, aC; attribute vec3 aS; varying vec2 vQ; varying float vA, vK, vW; varying vec3 vC;
void main() {
  float age = uT - aR.x, life = aR.y, k = aR.w, u = age / life; vec4 S = uS[int(aS.x + .5)];
  if (age < 0. || age > life || S.w <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float R = aR.z, a = aC.a * S.w;
  if (k < .5) { R *= .15 + .85 * (1. - (1. - u) * (1. - u)); a *= (1. - u * u) * min(1., age * 10.); }
  else if (k < 1.5) { float g = clamp(age / 3., 0., 1.); R *= 1. - (1. - g) * (1. - g); a *= min(1., age * 2.) * clamp((life - age) / .8, 0., 1.); }
  else if (k < 2.5) { R *= .75; a *= clamp(age / .15, 0., 1.) * clamp((life - age) / .3, 0., 1.); }
  else a *= clamp(age, 0., 1.) * clamp((life - age) / .8, 0., 1.);
  a *= onPage(S.xyz + aP);
  gl_Position = projectionMatrix * viewMatrix * vec4(S.xyz + aP + vec3(position.x * R * 2., ${LIFT}, -position.y * R * 2. * aS.z), 1.); ${BIAS}
  vQ = position.xy * 2.; vA = a; vK = k; vW = aS.y; vC = aC.rgb;
}`;
const RFS = `uniform float uH, uTuck; varying vec2 vQ; varying float vA, vK, vW; varying vec3 vC;
void main() { float d = length(vQ); vec3 c = vC; float m;
  if (vK < .5 || (vK > 1.5 && vK < 2.5)) { float crest = smoothstep(vW, 0., abs(d - 1. + vW)), shade = smoothstep(vW * 1.2, 0., abs(d - 1. + vW * 2.6)) * .75; m = max(crest, shade); c = mix(vec3(.05, .16, .2), vC, crest / max(m, 1e-3)); }  // a bright crest over a thin shadow: it reads on painted foam
  else m = smoothstep(1., .5, d);
  float a = vA * m; ${TUCK} if (a < .003) discard; gl_FragColor = vec4(c, a); }`;
// Cards (gust): a cut-paper leaf, petal or straw tumbling on all axes; mode 0 flies, 1 falls and lies where it lands, 2 lies still
const CVS = `uniform float uT, uAsp, uH, uMaxPx; uniform vec4 uS[${NS}], uPage; ${PAGE} attribute vec3 aP, aV; attribute vec4 aA, aW, aX, aC; varying vec2 vUv; varying float vA; varying vec3 vC;
vec3 rot(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1. - cos(a)); }
void main() {
  float age = uT - aA.x, life = aA.y, sd = aX.y; vec4 S = uS[int(aA.w + .5)];
  if (age < 0. || age > life || S.w <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float t = age, lie = 0.;
  if (aX.z > 1.5) { t = 0.; lie = 1.; } else if (aX.z > .5) { float tl = (aP.y - aX.w) / max(-aV.y, 1e-3); if (age > tl) { t = tl; lie = 1.; } }
  vec3 p = aP + aV * t + vec3(0., aX.x * sin(t * 3. + sd * 6.28), aX.x * .6 * cos(t * 2.3 + sd * 4.)) * (1. - lie);
  vec4 cc = projectionMatrix * viewMatrix * vec4(S.xyz + p, 1.); float sz = min(aA.z, uMaxPx * cc.w / (uH * .5 * projectionMatrix[1][1]));  // a card never grows past uMaxPx on screen (a leaf by the lens would wall off the page)
  vec3 l = vec3(position.x * uAsp, position.y, 0.) * sz;
  l = lie > .5 ? rot(vec3(l.x, 0., -l.y), vec3(0., 1., 0.), sd * 6.28) : rot(l, normalize(aW.xyz), aW.w * t + sd * 6.28);
  gl_Position = projectionMatrix * viewMatrix * vec4(S.xyz + p + l, 1.); ${BIAS}
  vUv = uv; vC = aC.rgb; vA = aC.a * S.w * clamp(age / .2, 0., 1.) * clamp((life - age) / .45, 0., 1.) * onPage(S.xyz + p);
}`;
const CFS = `uniform float uH, uTuck, uMap0; uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying vec3 vC;
void main() { vec2 q = vUv * 2. - 1.; vec4 t = uMap0 > .5 ? texture2D(uMap, vUv) : vec4(.35, .55, .2, smoothstep(0., .06, .5 * (1. - q.x * q.x) - abs(q.y)));
  if (t.a < .5) discard; float a = vA; ${TUCK} if (a < .01) discard; gl_FragColor = vec4(t.rgb * vC * (gl_FrontFacing ? 1. : .72), a); }`;
// Sun rays: one soft additive beam sheet per beam, turned about its own axis to face the camera (never edge-on), dry-brush streaks and a dither against banding
const BVS = `uniform float uT; uniform vec4 uS[${NS}], uPage; ${PAGE} attribute vec3 aT, aB; attribute vec4 aA, aW; varying vec2 vQ; varying float vA;
void main() {
  float age = uT - aA.x, life = aA.y; vec4 S = uS[int(aA.w + .5)];
  if (age < 0. || age > life || S.w <= 0.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float t = position.y + .5; vec3 top = S.xyz + aT, bot = S.xyz + aB, p = mix(top, bot, t), side = normalize(cross(bot - top, p - cameraPosition)), wp = p + side * position.x * mix(aW.x, aW.y, t);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.); ${BIAS}
  vQ = vec2(position.x * 2., t); vA = aW.z * S.w * clamp(age / aW.w, 0., 1.) * smoothstep(.25, .6, length(cameraPosition - p)) * onPage(wp);  // faded in over aW.w s, out near the lens
}`;
const BFS = `uniform float uTuck, uH; varying vec2 vQ; varying float vA;
void main() { float x = abs(vQ.x), t = vQ.y, a = vA * pow(1. - smoothstep(0., 1., x), 1.5) * smoothstep(0., .3, t) * smoothstep(1., .9, t) * (.8 + .2 * sin(vQ.x * 23. + t * 3.) * sin(vQ.x * 9. - t * 5.));
  ${TUCK} if (a < .002) discard; a += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) * .004; gl_FragColor = vec4(1., .74, .3, a); }`;
// Wake: a V of two soft bright lines behind a swimmer, its dashes scrolling
const WVS = `attribute vec3 aUv; varying vec3 vUv; void main() { vUv = aUv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); ${BIAS} }`;
const WFS = `uniform float uT, uH, uTuck, uScroll; varying vec3 vUv;
void main() { float crest = exp(-vUv.y * vUv.y * 5.), shade = exp(-(vUv.y - .85) * (vUv.y - .85) * 5.) * .7, m = max(crest, shade);  // a bright crest with a thin shadow on its outer side, like the rings
  float a = vUv.z * m * sqrt(max(0., 1. - vUv.x)) * smoothstep(0., .06, vUv.x) * (.75 + .25 * sin(vUv.x * 38. - uT * uScroll * 7.)); ${TUCK} if (a < .003) discard;
  gl_FragColor = vec4(mix(vec3(.05, .16, .2), vec3(.95, .99, 1.), crest / max(m, 1e-3)), a); }`;

// Wind: one tapered stroke per line, thick in the middle and thin to nothing at both ends, gently waving, ending in a small curl; streaks run along it
const NVS = `uniform float uT, uW, uH; uniform vec4 uPage; ${PAGE} attribute vec2 aU; attribute vec3 aP, aD; attribute vec4 aA, aX; varying float vA, vSide;
vec3 at(float u, float age) {
  float L = aA.z, cu = .8, s = (u - cu) * L; vec3 head = aP + aD * aA.w * age, up = vec3(0., 1., 0.);
  if (u < cu) return head + aD * s + up * aX.x * sin(s / L * 9. - age * 5. + aX.y * 6.28) * smoothstep(0., .25 * L, -s);
  float r = L * .045, an = (u - cu) / (1. - cu) * 4.6; return head + aD * (r * sin(an)) + up * (r * (1. - cos(an)));
}
void main() {
  float age = uT - aA.x, life = aA.y, u = aU.x;
  if (age < 0. || age > life) { gl_Position = vec4(2., 2., 2., 1.); return; }
  vec3 p = at(u, age), q = at(min(u + .01, 1.), age) - p + at(u, age) - at(max(u - .01, 0.), age);
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.), c2 = projectionMatrix * viewMatrix * vec4(p + q, 1.);
  vec2 d = normalize((c2.xy / c2.w - c.xy / c.w) * vec2(uW, uH)), n = vec2(-d.y, d.x);
  float w = aX.z * pow(sin(3.1416 * u), .8);
  c.xy += n * aU.y * w / vec2(uW, uH) * c.w; gl_Position = c; ${BIAS}
  vSide = aU.y; vA = aX.w * smoothstep(0., .3, age) * smoothstep(life, life - .35, age) * (.75 + .25 * sin(u * 26. - age * 14.)) * onPage(p);
}`;
const NFS = `uniform float uH, uTuck; varying float vA, vSide;
void main() { float a = vA * smoothstep(1., .25, abs(vSide)); ${TUCK} if (a < .004) discard; gl_FragColor = vec4(.97, .98, 1., a); }`;

const v3 = p => p?.isVector3 ? p.clone() : p ? new THREE.Vector3(...(Array.isArray(p) ? p : [p.x, p.y, p.z])) : null;
const flatDir = d => { const v = v3(d) ?? new THREE.Vector3(1, 0, 0); v.y = 0; return v.lengthSq() ? v.normalize() : v.set(1, 0, 0); };

export function createStoryFx(scene, renderer, { phone = false, reduced, sound, tuck = true, budget, page } = {}) {  // tuck: false and budget: Infinity are the test page's planted faults only
  reduced ??= typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PW = phone ? 1.6 : 1, rnd = Math.random,  // a phone draws water lines 1.6 times wider: they must read at 390 px
   r = (a, b) => a + (b - a) * rnd(), size2 = new THREE.Vector2(), BUDGET = budget ?? (phone ? 600 : 3200);  // live particles, both pools together
  const U = { uT: { value: 0 }, uH: { value: 800 }, uTuck: { value: tuck ? 1 : 0 }, uMinPx: { value: phone ? 4 : 0 }, uPage: { value: new THREE.Vector4(-1, 1, -.666, .666) }, uGround: { value: 0 }, uS: { value: Array.from({ length: NS }, () => new THREE.Vector4()) } };
  if (page) { U.uPage.value.set(page.min.x, page.max.x, page.min.z, page.max.z); U.uGround.value = page.max.y; }  // the open book's box (world): nothing draws over the room
  const PG = U.uPage.value;
  const root = new THREE.Group(); root.name = "storyfx"; scene.add(root);
  let T = 0, cam = null;

  // ---- the two particle pools. A living particle is never overwritten: a new one takes a dead place, or is dropped (counted) when the budget is full ----
  function pool(n, blending, order) {
    const g = new THREE.BufferGeometry(), S = { position: 3, aV: 3, aA: 4, aC: 4, aD: 4, aE: 4, aG: 4 }, F = {};
    for (const k in S) { F[k] = new Float32Array(n * S[k]); g.setAttribute(k, new THREE.BufferAttribute(F[k], S[k]).setUsage(THREE.DynamicDrawUsage)); }
    for (let i = 0; i < n; i++) F.aA[i * 4 + 1] = -1;  // every place starts dead
    const mesh = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: PVS, fragmentShader: PFS, blending, transparent: true, depthWrite: false }));
    mesh.frustumCulled = false; mesh.renderOrder = order; mesh.raycast = () => {}; root.add(mesh);
    return { F, g, mesh, n, head: 0, lo: n, hi: -1, end: 0, S, attrs: Object.keys(S), life: "aA", slotOf: i => F.aD[i * 4 + 2], dropped: 0 };
  }
  const PA = pool(phone ? 340 : 2400, THREE.AdditiveBlending, 6), PN = pool(phone ? 600 : 3200, THREE.NormalBlending, 5);  // the pools hold more than the budget: the budget is what binds, and it refuses

  // ---- the flat pool (rings, washes) and the cards: instanced quads ----
  function quads(n, VS, FS, S, blending, extra = {}, side = THREE.FrontSide) {
    const pg = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry(), F = {};
    g.index = pg.index; g.setAttribute("position", pg.attributes.position); g.setAttribute("uv", pg.attributes.uv); g.instanceCount = n;
    for (const k in S) { F[k] = new Float32Array(n * S[k]); g.setAttribute(k, new THREE.InstancedBufferAttribute(F[k], S[k]).setUsage(THREE.DynamicDrawUsage)); }
    const life = S.aR ? "aR" : "aA"; for (let i = 0; i < n; i++) F[life][i * 4 + 1] = -1;
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...U, ...extra }, vertexShader: VS, fragmentShader: FS, blending, transparent: true, depthWrite: false, side }));
    mesh.frustumCulled = false; mesh.raycast = () => {}; root.add(mesh);
    return { F, g, mesh, n, head: 0, lo: n, hi: -1, end: 0, life, S, attrs: Object.keys(S), dropped: 0 };
  }
  const RQ = quads(128, RVS, RFS, { aP: 3, aR: 4, aC: 4, aS: 3 }, THREE.NormalBlending); RQ.mesh.renderOrder = 4; RQ.slotOf = i => RQ.F.aS[i * 3];
  const cardU = { uMap: { value: null }, uMap0: { value: 0 }, uAsp: { value: 1 }, uMaxPx: { value: phone ? 60 : 80 } };
  const CQ = quads(phone ? 64 : 96, CVS, CFS, { aP: 3, aV: 3, aA: 4, aW: 4, aX: 4, aC: 4 }, THREE.NormalBlending, cardU, THREE.DoubleSide); CQ.mesh.renderOrder = 5; CQ.slotOf = i => CQ.F.aA[i * 4 + 3];

  // the budget: live particles counted by when they die (0.1 s bins), not by walking the pools each frame. Weather (rain, gust) has its own count and may hold
  // at most WEATHER of the budget, so a splash, a puff or a landing played during a downpour always finds room
  const NB = 1200, binOf = t => Math.floor(t * 10); let curBin = 0, warned = false;
  const counter = () => { const BIN = new Int32Array(NB), far = [], c = { live: 0,
    add: end => { const bi = binOf(end); c.live++; if (bi - curBin < NB) BIN[bi % NB]++; else far.push(end); },  // counted out when its bin has fully passed: never under the truth
    sub: end => { const bi = binOf(end); if (bi < curBin) return; c.live--; if (bi - curBin < NB) BIN[bi % NB]--; else far.splice(far.indexOf(end), 1); },
    tick: bin => { c.live -= BIN[bin % NB]; BIN[bin % NB] = 0; },
    pull: () => { for (let i = far.length - 1; i >= 0; i--) if (binOf(far[i]) - curBin < NB) { BIN[binOf(far[i]) % NB]++; far.splice(i, 1); } } }; return c; };
  const ALL = counter(), WX = counter(), WEATHER = Math.round(BUDGET * .6);
  const countDown = () => { for (const now = binOf(T); curBin < now; curBin++) { ALL.tick(curBin); WX.tick(curBin); } ALL.pull(); WX.pull(); };
  const alive = (Q, i) => { const b = Q.F[Q.life][i * 4], l = Q.F[Q.life][i * 4 + 1]; return l > 0 && T < b + l; };
  const put = (Q, vals, end, wx) => {
    if (Q === PA || Q === PN) { if (ALL.live >= BUDGET || (wx && WX.live >= WEATHER)) return drop(Q); }
    let i = Q.head, k = 0; while (k < Q.n && alive(Q, i)) { i = (i + 1) % Q.n; k++; }
    if (k === Q.n) return drop(Q);
    Q.head = (i + 1) % Q.n; Q.lo = Math.min(Q.lo, i); Q.hi = Math.max(Q.hi, i);
    for (const a of Q.attrs) Q.F[a].set(vals[a], i * Q.S[a]);
    if (Q === PA || Q === PN) { ALL.add(end); if (wx) WX.add(end); }
    return true;
  };
  function drop(Q) { Q.dropped++; if (!warned) { warned = true; console.warn(`storyfx: full (${ALL.live} live of ${BUDGET}, weather ${WX.live} of ${WEATHER}); new particles are being dropped, nothing running is removed`); } return false; }

  // ---- slots: one per effect (two for a kind that rides a follower and drops things behind it). A taken slot ends its owner first, never shares ----
  const slots = Array.from({ length: NS }, (_, i) => ({ i, used: false, anchor: new THREE.Vector3(), fade: 1, rate: 0, owner: null }));
  const slot = owner => {
    let s = slots.find(s => !s.used);
    if (!s) { const old = effects.reduce((a, b) => (a.t0 <= b.t0 ? a : b)); finish(old); effects.splice(effects.indexOf(old), 1); s = slots.find(s => !s.used); }  // all 64 taken: the oldest effect ends (done), then its slot is free
    Object.assign(s, { used: true, fade: 1, rate: 0, owner }); return s;
  };
  function kill(si) {  // a freed slot's particles end now and never come back when the slot is reused
    for (const Q of [PA, PN, RQ, CQ, BQ]) for (let i = 0; i < Q.n; i++) if (Math.round(Q.slotOf(i)) === si && Q.F[Q.life][i * 4 + 1] > 0) {
      if ((Q === PA || Q === PN) && alive(Q, i)) { const end = Q.F.aA[i * 4] + Q.F.aA[i * 4 + 1]; ALL.sub(end); if (Q.F.aG[i * 4 + 2] > .5) WX.sub(end); }
      Q.F[Q.life][i * 4 + 1] = -1; Q.lo = Math.min(Q.lo, i); Q.hi = Math.max(Q.hi, i); }
    slots[si].used = false; slots[si].owner = null; U.uS.value[si].w = 0;
  }

  // one particle: p is local to the slot's anchor (a "world" slot shared with a still effect takes world positions); d = delay before birth
  const local = (s, p) => s.proxyOf ? [p[0] - s.proxyOf.anchor.x, p[1] - s.proxyOf.anchor.y, p[2] - s.proxyOf.anchor.z] : p;
  const P = (e, s, o, pool = PA) => {
    const b = T + (o.d ?? 0), life = o.l, p = local(s, o.p ?? [0, 0, 0]);
    if (e.follow && s === e.s && p[1] > .6 * e.size) p[1] = .6 * e.size;  // below the subject's shoulders
    const c = o.c ?? [1, 1, 1];
    if (!put(pool, { position: p, aV: o.v ?? [0, 0, 0], aA: [b, life, o.s, o.k ?? 0], aC: [c[0], c[1], c[2], o.a ?? 1], aD: [o.dr ?? 0, o.g ?? 0, s.i, o.seed ?? rnd()],
      aE: [o.fi ?? .05, o.fo ?? .2, o.wob ?? 0, o.tw ?? 0], aG: [o.grow ?? 0, o.wf ?? 2, e.weather ? 1 : 0, o.br ?? 0] }, b + life, e.weather)) return;
    pool.end = Math.max(pool.end, b + life); e.die = Math.max(e.die, b + life);
  };
  const ring = (e, s, o) => { const b = T + (o.d ?? 0), c = o.c ?? [1, 1, 1];
    if (put(RQ, { aP: local(s, o.p ?? [0, 0, 0]), aR: [b, o.l, o.r, o.k ?? 0], aC: [c[0], c[1], c[2], o.a ?? .5], aS: [s.i, Math.min(.3, (o.w ?? .1) * PW), o.asp ?? 1] })) { RQ.end = Math.max(RQ.end, b + o.l); e.die = Math.max(e.die, b + o.l); } };
  const card = (e, s, o) => { const b = T + (o.d ?? 0), c = o.c ?? [1, 1, 1], ax = [r(-1, 1), r(-1, 1), r(-1, 1)];
    if (put(CQ, { aP: local(s, o.p), aV: o.v ?? [0, 0, 0], aA: [b, o.l, o.s, s.i], aW: [ax[0], ax[1] + .01, ax[2], o.spin ?? r(3, 8)], aX: [o.fl ?? .015, rnd(), o.mode ?? 0, o.gy ?? -9], aC: [c[0], c[1], c[2], o.a ?? 1] })) {
      CQ.end = Math.max(CQ.end, b + o.l); e.die = Math.max(e.die, b + o.l); } };

  // ---- wakes: one mesh for every swimmer on the page (8 wakes, one draw); each a history of its swimmer's path, rebuilt each frame ----
  const K = 24, WN = 8, WV = 2 * K * 2;
  const wg = new THREE.BufferGeometry(), wpos = new Float32Array(WN * WV * 3), wuv = new Float32Array(WN * WV * 3), widx = [];
  for (let w = 0; w < WN; w++) for (let arm = 0; arm < 2; arm++) for (let i = 0; i < K; i++) { const j = w * WV + (arm * K + i) * 2; wuv.set([i / (K - 1), -1, 0, i / (K - 1), 1, 0], j * 3);
    if (i < K - 1) widx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  wg.setAttribute("position", new THREE.BufferAttribute(wpos, 3).setUsage(THREE.DynamicDrawUsage)); wg.setAttribute("aUv", new THREE.BufferAttribute(wuv, 3).setUsage(THREE.DynamicDrawUsage)); wg.setIndex(widx);
  const wmesh = new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uH: U.uH, uTuck: U.uTuck, uScroll: { value: reduced ? 0 : 1 } }, vertexShader: WVS, fragmentShader: WFS,
    blending: THREE.NormalBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  wmesh.frustumCulled = false; wmesh.visible = false; wmesh.renderOrder = 4; wmesh.raycast = () => {}; root.add(wmesh);
  const wakes = Array.from({ length: WN }, (_, n) => ({ n, owner: null, hist: [], t0: -1 }));
  function buildWake(w, e, alpha) {  // the V: the path behind the swimmer, each point pushed sideways by its distance behind; an arm stops where the path turned back (no arm crosses itself)
    const o = w.n * WV, A = e.armLen, k = [.26, .36, .46][e.L - 1], wd = e.size * [.07, .1, .13][e.L - 1] * (phone ? 2.4 : 1), H = w.hist, head = w.head;
    for (let arm = 0; arm < 2; arm++) { const sg = arm ? 1 : -1; let cut = false;
      for (let i = 0; i < K; i++) {
        const h = i ? H[H.length - i] : head, j = o + (arm * K + i) * 2;
        if (h && h.dir.x * head.dir.x + h.dir.z * head.dir.z < .3) cut = true;
        if (!h || cut) { wpos.copyWithin(j * 3, (j - 2) * 3, j * 3); wuv[j * 3 + 2] = wuv[j * 3 + 5] = 0; continue; }
        const dist = Math.min(A, w.D - h.d), px = -h.dir.z * sg, pz = h.dir.x * sg, ax = h.p.x + px * dist * k, az = h.p.z + pz * dist * k;
        const tx = -h.dir.x + px * k, tz = -h.dir.z + pz * k, l = Math.hypot(tx, tz) || 1, cx = -tz / l * wd, cz = tx / l * wd;
        wpos.set([ax - cx, h.p.y, az - cz, ax + cx, h.p.y, az + cz], j * 3);
        wuv[j * 3] = wuv[j * 3 + 3] = dist / A; wuv[j * 3 + 2] = wuv[j * 3 + 5] = alpha;
      } }
    wg.attributes.position.needsUpdate = true; wg.attributes.aUv.needsUpdate = true;
  }
  const hideWake = w => { wpos.fill(0, w.n * WV * 3, (w.n + 1) * WV * 3); for (let j = w.n * WV; j < (w.n + 1) * WV; j++) wuv[j * 3 + 2] = 0; wg.attributes.position.needsUpdate = true; wg.attributes.aUv.needsUpdate = true; };

  // the ground under a point of the screen (x, y in -1..1), for effects spread across what the camera sees
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), V2 = new THREE.Vector2();
  const ground = (x, y, gy, m = [0, 0, 0, 0]) => { if (!cam) return null; V2.set(x, y); ray.setFromCamera(V2, cam); plane.constant = -gy; const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
    return p && p.x > PG.x + m[0] && p.x < PG.y - m[1] && p.z > PG.z + m[2] && p.z < PG.w - m[3] ? p : null; };  // on the open pages only, m metres in from their left, right, back, front edges
  const onGround = (y0, y1, gy, m, tries = 8) => { for (let i = 0; i < tries; i++) { const p = ground(r(-1.05, 1.05), r(y0, y1), gy, m); if (p) return p; } return null; };
  const toEdge = (g, d, m = .03) => { let t = 9; if (d.x > 1e-4) t = Math.min(t, (PG.y - m - g.x) / d.x); if (d.x < -1e-4) t = Math.min(t, (PG.x + m - g.x) / d.x);  // how far from g along d to the page's edge
    if (d.z > 1e-4) t = Math.min(t, (PG.w - m - g.z) / d.z); if (d.z < -1e-4) t = Math.min(t, (PG.z + m - g.z) / d.z); return Math.max(0, t); };

  // ---- wind lines: one instanced strip mesh, 16 strokes ----
  const SEG = 40, WIN = 16, sg = new THREE.PlaneGeometry(1, 1, SEG, 1), ng = new THREE.InstancedBufferGeometry(), NF = {}, NS2 = { aP: 3, aD: 3, aA: 4, aX: 4 };
  ng.index = sg.index; const su = new Float32Array((SEG + 1) * 2 * 2); for (let j = 0; j <= 1; j++) for (let i = 0; i <= SEG; i++) su.set([i / SEG, j ? -1 : 1], (j * (SEG + 1) + i) * 2);
  ng.setAttribute("position", sg.attributes.position); ng.setAttribute("aU", new THREE.BufferAttribute(su, 2)); ng.instanceCount = WIN;
  for (const k in NS2) { NF[k] = new Float32Array(WIN * NS2[k]); ng.setAttribute(k, new THREE.InstancedBufferAttribute(NF[k], NS2[k]).setUsage(THREE.DynamicDrawUsage)); }
  for (let i = 0; i < WIN; i++) NF.aA[i * 4 + 1] = -1;
  const nmesh = new THREE.Mesh(ng, new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uH: U.uH, uW: { value: 1280 }, uTuck: U.uTuck, uPage: U.uPage, uGround: U.uGround }, vertexShader: NVS, fragmentShader: NFS,
    blending: THREE.NormalBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  nmesh.frustumCulled = false; nmesh.visible = false; nmesh.renderOrder = 6; nmesh.raycast = () => {}; root.add(nmesh); let nhead = 0, nend = 0;
  const windLine = (start, dir, len, speed, life) => { let i = nhead, k = 0; while (k < WIN && T < NF.aA[i * 4] + NF.aA[i * 4 + 1]) { i = (i + 1) % WIN; k++; } if (k === WIN) return;  // all 16 drawing: this one is skipped
    nhead = (i + 1) % WIN; NF.aP.set(start.toArray(), i * 3); NF.aD.set(dir.toArray(), i * 3); NF.aA.set([T, life, len, speed], i * 4); NF.aX.set([len * .05, rnd(), phone ? 5.5 : 4, .9], i * 4);
    for (const k in NS2) ng.attributes[k].needsUpdate = true; nend = Math.max(nend, T + life); };

  const BQ = quads(8, BVS, BFS, { aT: 3, aB: 3, aA: 4, aW: 4 }, THREE.AdditiveBlending, {}, THREE.DoubleSide); BQ.mesh.renderOrder = 6; BQ.slotOf = i => BQ.F.aA[i * 4 + 3];  // sun rays: 8 beams at once (a drawn one is never overwritten)
  const effects = [];
  const area = (e, o) => o.area && { w: o.area[0], d: o.area[1] };  // a rectangle on the ground centred at the anchor
  const hook = (name, L) => name && sound?.(name, [.25, .32, .4][(L ?? 2) - 1]);
  const tint = (o, c) => o.tint ?? c;

  // ---- the kinds ----
  const KINDS = {
    splash(e, o) {
      const s = e.size, L = e.L, S = e.s;
      if (reduced) return ring(e, S, { r: s * .6, l: 1.1, k: 2, a: .9, w: .12 });  // held 0.65 s
      hook(["splash-small", "tail-splash", "wave-slap"][L - 1], L);
      ring(e, S, { r: s * [.35, .5, .65][L - 1], l: 1.4, a: .95, w: .12 });  // level 2: about 0.8 x the subject's height across at its middle
      const g = 20 * s, h = s * [.3, .5, .55][L - 1], vh = s * [1.2, 1.8, 3][L - 1], dir = flatDir(o.dir), a0 = Math.atan2(dir.z, dir.x);
      for (let i = 0, n = [6, 10, 22][L - 1]; i < n; i++) {  // level 3, the slap: a wide fan of spray thrown sideways, along o.dir (away from the face)
        const an = L === 3 ? a0 + r(-.7, .7) : i / n * TAU + r(-.3, .3), vy = Math.sqrt(2 * g * h) * r(.55, 1), sp = vh * r(.45, 1), vx = Math.cos(an) * sp, vz = Math.sin(an) * sp, tl = 2 * vy / g, rr = s * r(.15, .3);
        const p = [Math.cos(an) * rr, 0, Math.sin(an) * rr];
        P(e, S, { p, v: [vx, vy, vz], g, l: tl, s: s * r(.08, .12), k: 12, c: [.97, .99, 1], a: 1, fi: .02, fo: .06 }, PN);  // paper-white drops with a blue edge
        if (i % (L === 3 ? 2 : 1) === 0) ring(e, S, { p: [p[0] + vx * tl, 0, p[2] + vz * tl], d: tl, r: s * .14, l: .8, a: .75, w: .16 });
      }
      for (let i = 0; i < 7; i++) { const an = i / 7 * TAU, rr = s * .12;  // the crown
        P(e, S, { p: [Math.cos(an) * rr, 0, Math.sin(an) * rr], v: [Math.cos(an) * s * .4, s * r(1.5, 2.2) * (L === 1 ? .6 : 1), Math.sin(an) * s * .4], g: 30 * s, l: .4, s: s * .09, k: 12, c: [.97, .99, 1], a: 1, fi: .02, fo: .12 }, PN); }
      for (let i = 0; i < 8; i++) { const an = rnd() * TAU, rr = s * r(.3, .9); P(e, S, { p: [Math.cos(an) * rr, LIFT, Math.sin(an) * rr], d: r(0, .15), l: .5, s: s * .07, k: 1, c: [1.3, 1.3, 1.2], a: .8, fi: .1, fo: .25, tw: 18 }); }  // the glints near it brighten
    },
    wake(e, o) {
      let w = wakes.find(w => !w.owner);
      if (!w) { const oe = wakes.reduce((a, b) => (a.t0 <= b.t0 ? a : b)).owner; finish(oe); effects.splice(effects.indexOf(oe), 1); w = wakes.find(w => !w.owner); }  // all 8 swimming: the oldest wake ends (done) first
      const s = e.size, A = e.armLen = s * [2, 2.6, 3][e.L - 1], step = A / (K - 2);  // each arm 2.6 times the swimmer at level 2
      w.owner = e; w.t0 = T; w.hist = []; w.D = 0; e.wake = w; e.alpha = [.75, .95, 1][e.L - 1];
      e.still = reduced || !o.follow; e.die = Infinity;
      const p0 = e.s.anchor.clone(); p0.y = e.wy + LIFT; const dir = flatDir(o.dir);
      if (e.still) { for (let i = K - 2; i >= 1; i--) w.hist.push({ p: p0.clone().addScaledVector(dir, -i * step), d: (K - 2 - i) * step, dir }); w.D = (K - 2) * step; w.head = { p: p0, d: w.D, dir }; return; }
      hook("water-swish", e.L);
      let foam = 0, rg = 0, idle = 0; const last = p0.clone(), p = new THREE.Vector3(); w.head = { p: p0.clone(), d: 0, dir: dir.clone() }; w.hist.push({ p: p0.clone(), d: 0, dir: dir.clone() });
      e.tick = dt => {
        p.copy(e.s.anchor); p.y = e.wy + LIFT; const mv = p.distanceTo(last);
        if (mv > 1e-4) { dir.subVectors(p, last).setY(0).normalize(); w.D += mv; idle = 0; last.copy(p); } else idle += dt;
        w.head.p.copy(p); w.head.d = w.D; w.head.dir.copy(dir);
        if (w.D - w.hist[w.hist.length - 1].d >= step) { w.hist.push({ p: p.clone(), d: w.D, dir: dir.clone() }); if (w.hist.length > K - 1) w.hist.shift(); }
        if (e.o.until === "stop" && idle > .3 && T - e.t0 > .5) { for (let i = 0; i < 3; i++) ring(e, e.w, { p: [p.x, p.y, p.z], d: i * .6, r: s * .6, l: 2.2, a: .8, w: .1 }); e.stop(); return; }
        if (idle > 0) return;
        if ((foam += dt) > .07) { foam = 0; for (let i = 0; i < e.L + 1; i++) P(e, e.w, { p: [p.x + dir.x * s * .25 + r(-1, 1) * s * .1, p.y, p.z + dir.z * s * .25 + r(-1, 1) * s * .1], v: [0, s * .2, 0], l: .5, s: s * .08, k: 4, c: [.95, .97, 1], a: .85, fi: .05, fo: .3 }, PN); }  // a little foam at the front: paper-white flecks, no glow
        if (e.L === 3 && rnd() < .5) P(e, e.w, { p: [p.x + dir.x * s * .25, p.y, p.z + dir.z * s * .25], v: [dir.x * s * .8 + r(-1, 1) * s * .4, s * r(1, 1.8), dir.z * s * .8 + r(-1, 1) * s * .4], g: 30 * s, l: .3, s: s * .07, k: 12, c: [.97, .99, 1], a: 1, fi: .02, fo: .05 }, PN);
        if ((rg += dt) > .6 && w.hist.length > 4) { rg = 0; const h = w.hist[Math.floor(w.hist.length / 3)]; if (h.dir.dot(dir) > .3) ring(e, e.w, { p: [h.p.x, h.p.y, h.p.z], r: s * .45, l: 1.4, a: .85, w: .1 }); }  // a ring at the tail every 0.6 s
      };
    },
    rings(e, o) {
      if (reduced) return;
      const g = o.region ?? (o.area && { x0: e.s.anchor.x - o.area[0] / 2, x1: e.s.anchor.x + o.area[0] / 2, z0: e.s.anchor.z - o.area[1] / 2, z1: e.s.anchor.z + o.area[1] / 2, y: e.wy }), b = g?.isBox3 ? { x0: g.min.x, x1: g.max.x, z0: g.min.z, z1: g.max.z, y: g.max.y } : g ?? { x0: e.s.anchor.x - .5, x1: e.s.anchor.x + .5, z0: e.s.anchor.z - .2, z1: e.s.anchor.z + .2, y: e.wy };
      const every = o.every ?? 4; let next = r(.2, 1) * every * .3; e.die = Infinity;
      e.tick = () => { if (T - e.t0 < next) return; next = T - e.t0 + every * r(.6, 1.4);
        const p = [r(b.x0, b.x1), b.y, r(b.z0, b.z1)], rr = r(.055, .07) * (e.size / .1) * (phone ? 1.2 : 1);  // grows to about 0.12 m across, a second ring following inside it, as a fish's kiss makes
        ring(e, e.w, { p, r: rr, l: 2.2, a: 1, w: .13 }); ring(e, e.w, { p, d: .4, r: rr * .7, l: 1.8, a: .8, w: .15 }); };
    },
    sparkle(e, o) {
      const s = e.size, L = e.L, S = e.s, c = tint(o, [1.5, 1.15, .6]), mid = s * .35;
      if (reduced) return P(e, S, { p: [0, mid, 0], l: e.secs ?? 1e6, s: s * [.9, 1.2, 1.4][L - 1], k: 2, c, a: [.22, .3, .36][L - 1], fi: .15, fo: .3 });
      hook(L === 3 ? "bridge-shimmer" : "gold-shimmer", L);
      if (L === 3) {  // the burst: the halo flares, 50 big gold stars thrown wide and low (below the face), then glitter falling for 2 s
        P(e, S, { p: [0, mid, 0], l: 1.8, s: s * 2.2, k: 2, c, a: .5, fi: .08, fo: 1.3 });
        P(e, S, { p: [0, mid, 0], l: .9, s: s * .9, k: 2, c: [1.6, 1.4, 1], a: .55, fi: .05, fo: .7 });
        for (let i = 0; i < 50; i++) { const an = i * 2.39996, sp = s * r(3, 5.5);
          P(e, S, { p: [0, mid * .8, 0], v: [Math.cos(an) * sp, s * r(-.6, .6), Math.sin(an) * sp], dr: 2.5, g: s * 1.5, l: r(1.4, 2.2), s: s * r(.17, .25), k: 1, c: [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2], a: 1, fi: .03, fo: .8, tw: r(8, 14) }); }
        for (let i = 0; i < 40; i++) { const an = rnd() * TAU, rr = s * r(.2, 1.1);
          P(e, S, { p: [Math.cos(an) * rr, s * r(.25, .55), Math.sin(an) * rr], v: [0, -s * .12, 0], d: r(.1, .6), l: r(1.6, 2.2), s: s * r(.08, .12), k: 1, c: [1.6, 1.3, .8], a: .9, fi: .1, fo: .8, tw: r(10, 18) }); }
        return;
      }
      e.die = Infinity; const f = front(e.s.anchor);  // the halo sits a little in front of the thing, so the thing does not hide it
      P(e, S, { p: [f.x * s * .35, mid, f.z * s * .35], l: e.secs ?? 1e6, s: s * [.9, 1.3][L - 1], k: 2, c, a: [.22, .34][L - 1], fi: .4, fo: .1, br: .4 });
      const n = [12, 24][L - 1]; let acc = n * .7; const last = e.s.anchor.clone();
      e.tick = dt => {
        for (acc += dt * n / 1.5; acc >= 1; acc--) { const an = rnd() * TAU, rr = s * r(.35, .6), f = front(e.s.anchor);  // round it, more of them in front
          P(e, S, { p: [Math.cos(an) * rr + f.x * s * .2, mid + r(-.3, .25) * s, Math.sin(an) * rr + f.z * s * .2], v: [0, s * .1, 0], l: r(1.2, 2), s: s * r(.13, .18), k: 1, c: [c[0] * 1.2, c[1] * 1.2, c[2] * 1.2], a: 1, fi: .25, fo: .5, tw: r(6, 12) }); }
        const mv = e.s.anchor.distanceTo(last); last.copy(e.s.anchor);
        if (mv > .0004 && rnd() < Math.min(1, mv / dt * 8)) { const a = e.s.anchor;  // falling off behind as it moves
          P(e, e.w, { p: [a.x + r(-1, 1) * s * .4, a.y + mid + r(-.2, .2) * s, a.z + r(-1, 1) * s * .4], v: [0, -s * .15, 0], g: s * .6, l: r(.7, 1.1), s: s * .1, k: 1, c, a: .8, fi: .03, fo: .5, tw: 14 }); }
      };
    },
    gust(e, o) {
      const s = e.size, L = e.L, S = e.s, A = e.s.anchor, c = tint(o, [1, 1, 1]);
      if (o.card) { cardU.uMap.value = o.card; cardU.uMap0.value = 1; const im = o.card.image; cardU.uAsp.value = im?.width ? im.width / im.height : 1; }  // shortcut: one card texture at a time (the latest gust's); a second texture if two cards ever blow together
      const cs = s * .45, gy = o.waterY ?? A.y;  // cards about half the subject's height
      if (reduced) { for (let i = 0; i < 2; i++) card(e, S, { p: [(i - .5) * s * .6, gy - A.y + LIFT, r(-1, 1) * s * .2], l: e.secs ?? 2.5, s: cs, mode: 2, c }); return; }
      if (o.shed) {
        hook("leaves-rustle-big", L); const bx = o.shed.isObject3D ? new THREE.Box3().setFromObject(o.shed) : new THREE.Box3().setFromCenterAndSize(v3(o.shed), new THREE.Vector3(s, s, s));
        for (let i = 0, n = [2, 3, 5][L - 1]; i < n; i++) { const p = [r(bx.min.x, bx.max.x), r((bx.min.y + bx.max.y) / 2, bx.max.y), r(bx.min.z, bx.max.z)].map((x, k) => x - A.getComponent(k)), vy = -r(.09, .14);
          card(e, S, { p, v: [r(-.03, .03), vy, r(-.02, .02)], d: i * r(.1, .35), l: (p[1] - (gy - A.y)) / -vy + 1.6, s: s * .35, mode: 1, gy: gy - A.y + LIFT, fl: .02, spin: r(2, 4), c }); }
        return;
      }
      hook("wind-whoosh", L);
      // the wind blows across what the camera sees: each card and each wind line crosses the view, so a reading camera sees the same stream as a wide one
      const dir = flatDir(o.dir), cross = [3.5, 2.4, 1.5][L - 1], dur = o.secs ?? [2, 2.5, 3][L - 1], want = [8, 15, 24][L - 1], lines = [3, 5, 8][L - 1], ar = o.area;
      const where = () => { const g = !ar && cam ? onGround(-.95, .3, gy, [.1, .1, .28, .05]) : null; if (g) return g; const w = ar?.[0] ?? o.width ?? 1.4, d = ar?.[1] ?? .6; return new THREE.Vector3(A.x + r(-w / 2, w / 2), gy, A.z + r(-d / 2, d / 2)); };
      const half = g => cam ? cam.position.distanceTo(g) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect * 1.15 : (ar?.[0] ?? o.width ?? 1.4) / 2;  // speed is set by the view (the same look at any framing), the path by the page
      const back = dir.clone().negate();
      let acc = want * .25, la = 1;
      e.tick = dt => {
        if (T - e.t0 > dur) { e.tick = null; return; }
        for (acc += dt * want / cross; acc >= 1; acc--) { const g = where(), tb = toEdge(g, back, .12), tf = toEdge(g, dir, .12), v = 2 * half(g) / cross * r(.85, 1.15), st = g.clone().addScaledVector(dir, -tb); st.y += r(.006, .09) * (s / .1);
          if (tb + tf > .05) card(e, S, { p: [st.x - A.x, st.y - A.y, st.z - A.z], v: [dir.x * v, r(-.02, .05), dir.z * v], d: r(0, dt), l: (tb + tf) / v, s: cs * r(.8, 1.15), fl: .025, spin: r(5, 11), c }); }  // each card crosses the pages only
        for (la += dt * lines / dur; la >= 1; la--) { const g = where(), tb = toEdge(g, back, 0), tf = toEdge(g, dir, 0), v = 2 * half(g) / cross * 1.3, len = THREE.MathUtils.clamp((tb + tf) * .35, .08, .45), st = g.clone().addScaledVector(dir, -tb); st.y += r(.03, .12) * (s / .1);
          windLine(st, dir, len, v, (tb + tf + len) / v); e.die = Math.max(e.die, T + (tb + tf + len) / v); }
      };
    },
    shimmer(e, o) {
      const s = e.size, L = e.L, S = e.s, ar = area(e, o), base = ar ? new THREE.Vector3(0, 0, ar.d / 2) : new THREE.Vector3(), to = v3(o.toward) ?? e.s.anchor.clone().add(new THREE.Vector3(0, 0, ar ? -ar.d / 2 : -.6)), d = to.sub(e.s.anchor).sub(base); d.y = 0;  // with an area: from its near edge across it
      const c = tint(o, L === 3 ? [1.45, 1.05, .45] : [1.15, 1.22, 1.35]), perp = new THREE.Vector3(-d.z, 0, d.x).normalize(), hold = Math.max(0, (e.secs ?? 6) - 4.5), y = e.wy - e.s.anchor.y + LIFT;
      for (let i = 0, n = [60, 150, 200][L - 1]; i < n; i++) { const t = Math.pow(rnd(), .8), w = (1 - t * .7) * (ar ? ar.w * [.12, .2, .3][L - 1] : [.08, .14, .2][L - 1] * (s / .1)), off = r(-1, 1) * w * rnd();
        const p = [base.x + d.x * t + perp.x * off, y, base.z + d.z * t + perp.z * off];
        if (reduced) P(e, S, { p, l: e.secs ?? 3, s: s * r(.1, .16), k: 1, c, a: .9, fi: .15, fo: .3 });
        else P(e, S, { p, v: [.006, 0, 0], d: t * .6, l: 4.5 + hold, s: s * r(.1, .16), k: 1, c, a: .9, fi: 1.5, fo: 3, tw: r(6, 14) });
      }
    },
    halo(e, o) {
      const s = e.size, L = e.L, S = e.s, R = s * [.5, 1, 2][L - 1], c = tint(o, [1.3, .8, .4]), life = e.secs ?? 1e6;
      e.die = Infinity;
      P(e, S, { l: life, s: R, k: 2, c, a: [.36, .48, .55][L - 1], fi: reduced ? .15 : .4, fo: .1, br: reduced ? 0 : r(.3, .5) });
      P(e, S, { l: life, s: R * .25, k: 2, c: [1.4, 1.1, .7], a: .5, fi: reduced ? .15 : .3, fo: .1 });
      const y0 = e.s.anchor.y; if (o.waterY != null && y0 > o.waterY + .005) P(e, S, { p: [0, (o.waterY - (y0 - o.waterY) * .35) - y0, .002], l: life, s: R * 1.5, k: 7, c, a: .22, fi: reduced ? .15 : .4, fo: .1, br: reduced ? 0 : 1 });
      if (reduced) return;
      hook("candle-light", L);
      let acc = 0; e.tick = dt => { for (acc += dt * [.6, 2, 8][L - 1]; acc >= 1; acc--) P(e, S, { p: [r(-1, 1) * R * .1, R * .1, r(-1, 1) * R * .1], v: [0, s * r(.4, .7), 0], l: r(1, 1.6), s: s * .035, k: 0, c: [1.6, .75, .3], a: .9, fi: .1, fo: .6, wob: s * .05, wf: 3 }); };
    },
    notes(e, o) {
      const s = e.size, L = e.L, S = e.s, c = tint(o, [1.25, 1.1, .8]);
      if (reduced) return P(e, S, { p: [0, s * .3, 0], l: 1.1, s: s * .5, k: 5, c, a: .7, fi: .15, fo: .3 });  // held 0.65 s
      const beat = () => P(e, S, { p: [0, s * .3, 0], v: [0, s * .5, 0], l: 1.2, s: s * .3, k: 5, c, a: .75, fi: .08, fo: .8, grow: 2.5 });
      if (L === 1) return beat();
      e.die = Infinity; beat();
      const dir = flatDir(o.dir); let next = 0;
      e.tick = () => { if (T - e.t0 < next) return; next = T - e.t0 + 2.4; const a = e.s.anchor;
        for (let i = 0, n = 3 + Math.floor(rnd() * 3); i < n; i++) P(e, e.w, { p: [a.x, a.y + s * .45, a.z], v: [dir.x * s * 1.2, s * .25, dir.z * s * 1.2], d: i * .35, l: 3, s: s * .35, k: 6, c: [1, .94, .78], a: .95, fi: .3, fo: 1, wob: s * .12, wf: 2.4 }, PN); };
    },
    dust(e, o) {
      if (reduced) return;
      const s = e.size, L = e.L, S = e.s, c = tint(o, [.62, .5, .36]); hook(["hop-land", "kapi-land"][L - 1], L);
      for (let i = 0, n = [6, 12][L - 1]; i < n; i++) { const an = i / n * TAU + r(-.3, .3), sp = s * [1.2, 1.8][L - 1] * r(.6, 1);
        P(e, S, { p: [Math.cos(an) * s * .1, s * .02, Math.sin(an) * s * .1], v: [Math.cos(an) * sp, s * r(.2, .5), Math.sin(an) * sp], dr: 6, g: s * 1.5, l: r(.6, .9), s: s * (phone ? .38 : .2), k: 4, c, a: .8, fi: .04, fo: .45, grow: .9 }, PN); }
      for (let i = 0; i < 2 + L; i++) { const an = rnd() * TAU, sp = s * r(.8, 1.4);
        P(e, S, { p: [0, s * .02, 0], v: [Math.cos(an) * sp, s * r(1, 1.6), Math.sin(an) * sp], g: 30 * s, l: .4, s: s * .06, k: 0, c: c.map(x => x * .5), a: 1, fi: .02, fo: .08 }, PN); }
    },
    rain(e, o) {
      // drops fall across what the camera sees (below the read-along quarter), not in a fixed box: a reading camera sees as much rain as a wide one
      const L = e.L, S = e.s, A = e.s.anchor, gy = o.waterY ?? A.y, H = .28, sp = 1.6, life = H / sp, wx = flatDir(o.dir).x * .3, ar = o.area;
      const at = (y0 = -.95, y1 = .45, m = [.25, .25, .28, .1]) => { const g = !ar && cam ? onGround(y0, y1, gy, m) : null; if (g) return [g.x - A.x, g.y - A.y, g.z - A.z];  // in from the side edges by about the fall height
        const w = ar?.[0] ?? o.width ?? 1.4, d = ar?.[1] ?? .6, cl = (v, lo, hi) => Math.min(Math.max(v, lo), hi);  // no ground under the view (or an area): the box round the anchor, kept on the page with the same margins (review 3: a corner anchor spilled veil over the room)
        const span = (c, h, lo, hi) => cl(r(Math.max(c - h, lo), Math.min(c + h, hi)), lo, hi);  // uniform over the part of the box on the page; the nearest edge only if none of it is (review 4: clamping each point piled drops on the margin)
        return [span(A.x, w / 2, PG.x + m[0], PG.y - m[1]) - A.x, gy - A.y, span(A.z, d / 2, PG.z + m[2], PG.w - m[3]) - A.z]; };
      const DROP = { k: 3, s: .07, c: [.93, .96, 1], a: .85 };
      if (reduced) { for (let i = 0; i < 100; i++) { const p = at(); p[1] += r(.02, H); P(e, S, { ...DROP, p, l: e.secs ?? 3, fi: .15, fo: .3 }, PN); } return; }  // a still curtain
      hook(L === 1 ? "rain-light" : "rain-heavy", L); e.die = Infinity;
      const n = [60, 150, 300][L - 1], veil = [4, 8, 12][L - 1], water = o.waterY != null, spots = o.spots ?? !water; let acc = n * .5, ra = 0, sa = 0, va = veil;
      e.tick = dt => {
        for (acc += dt * n / life; acc >= 1; acc--) { const p = at(); p[1] += H; p[0] -= wx * life; P(e, S, { ...DROP, p, v: [wx, -sp, 0], d: r(0, dt), l: life, fi: .03, fo: .03 }, PN); }
        for (va += dt * veil / 2.5; va >= 1; va--) { const p = at(-.6, .35, [.35, .35, .1, .3]); p[1] += r(.06, .18); P(e, S, { p, v: [wx * .3, -.08, 0], l: 2.5, s: .32, k: 4, c: [.6, .66, .75], a: [.06, .09, .13][L - 1], fi: .8, fo: .8, grow: .3 }, PN); }  // a soft grey-blue veil in the air
        if (water) for (ra += dt * [8, 20, 36][L - 1]; ra >= 1; ra--) { const p = at(); ring(e, S, { p, r: r(.015, .03), l: .6, a: .7, w: .16 });  // where it lands: a ring and a little splash
          for (let j = 0; j < 2; j++) P(e, S, { p: [p[0], p[1] + LIFT, p[2]], v: [r(-1, 1) * .08, r(.25, .4), r(-1, 1) * .08], g: 4, l: .18, s: .014, k: 12, c: [.97, .99, 1], a: 1, fi: .01, fo: .05 }, PN); }
        if (spots) for (sa += dt * [2, 5, 8][L - 1]; sa >= 1; sa--) { const p = at(); p[1] += LIFT; P(e, S, { p, l: 2.5, s: .02, k: 8, c: [.1, .08, .06], a: .25, fi: .2, fo: 1.2 }, PN); }
      };
    },
    haze(e, o) {
      if (reduced) return;
      const s = e.size, n = [12, 20][e.L - 1], S = e.s; let acc = n * .4; e.die = Infinity;
      const ar = area(e, o); e.tick = dt => { for (acc += dt * n / 3; acc >= 1; acc--) { const an = rnd() * TAU, rr = s * r(0, .8);
        P(e, S, { p: ar ? [r(-.5, .5) * ar.w, s * r(0, .15), r(-.5, .5) * ar.d] : [Math.cos(an) * rr, s * r(0, .15), Math.sin(an) * rr], v: [0, s * .08, 0], l: r(2.5, 3.5), s: s * .15, k: 4, c: tint(o, [1, .9, .7]), a: .25, fi: .8, fo: 1.2, grow: .6, wob: s * .06, wf: 1.5 }); } };
    },
    embers(e, o) {
      const s = e.size, L = e.L, S = e.s;
      P(e, S, { p: [0, s * .1, 0], l: e.secs ?? 1e6, s: s * [.4, .6, .9][L - 1], k: 2, c: [1.3, .65, .3], a: L > 1 || reduced ? .3 : 0, fi: reduced ? .15 : .3, fo: .1 });
      if (reduced) return;
      hook("fire-crackle", L); e.die = Infinity;
      const n = [12, 24, 48][L - 1], life = 1.05; let acc = 0, sm = 0;
      e.tick = dt => {
        for (acc += dt * n / life; acc >= 1; acc--) { const an = rnd() * TAU, rr = s * .25 * L * rnd();  // fire sparks: stretched, flickering, rising fast, orange with a dark rim so they hold on a sunlit page
          P(e, S, { p: [Math.cos(an) * rr, s * .05, Math.sin(an) * rr], v: [r(-.15, .15) * s, s * r(1.1, 1.9) * (1 + L * .25), r(-.15, .15) * s], l: life * r(.75, 1.25), s: s * r(.1, .14) * (L === 3 ? 1.15 : 1) * (phone ? 1.3 : 1), k: 11,
            c: [1, r(.45, .7), .1], a: 1, fi: .04, fo: .45, wob: s * .06, wf: 4, tw: r(14, 26) }, PN); }
        if (L > 1) for (sm += dt * [0, 1.5, 3][L - 1]; sm >= 1; sm--) P(e, S, { p: [r(-1, 1) * s * .1, s * .5 * L / 2, r(-1, 1) * s * .1], v: [0, s * .5, 0], l: 2.4, s: s * .35, k: 4, c: [.45, .43, .42], a: .16, fi: .4, fo: 1.2, grow: 1.8, wob: s * .1, wf: 1 }, PN);  // a little smoke
      };
    },
    bubbles(e, o) {  // a few round bubbles rise from a point and pop at the top of their rise (the painted water is the page: its surface is the paper, so the bubbles rise in front of it)
      const s = e.size, L = e.L, S = e.s, ar = area(e, o), n = [3, 6, 12][L - 1], gap = [.5, .3, .15][L - 1], rise = s * [.9, 1.2, 1.5][L - 1], sz = s * [.16, .17, .19][L - 1] * (phone ? 1.8 : 1), c = [.97, .99, 1];
      const src = () => ar ? [r(-.5, .5) * ar.w, 0, r(-.5, .5) * ar.d] : [r(-1, 1) * s * .3, 0, r(-1, 1) * s * .15];
      if (reduced) { for (let i = 0; i < n; i++) { const p = src(); p[1] = rise * (i + .5) / n; P(e, S, { p, l: e.secs ?? 1.2, s: sz * r(.7, 1.2), k: 13, c, a: .95, fi: .15, fo: .3 }, PN); } return; }
      for (let i = 0; i < n; i++) { const p = src(), d = i * gap + r(0, gap * .5), sp = s * r(.5, .7), l = rise / sp, z = sz * r(.7, 1.2);
        P(e, S, { p, v: [0, sp, 0], d, l, s: z, k: 13, c, a: .95, fi: .12, fo: .04, wob: s * .1, wf: r(2.5, 4), grow: .25 }, PN);
        for (let j = 0; j < 3; j++) { const an = rnd() * TAU; P(e, S, { p: [p[0], p[1] + rise, p[2]], v: [Math.cos(an) * s * .25, s * r(.3, .6), Math.sin(an) * s * .25], g: 20 * s, d: d + l, l: .22, s: z * .3, k: 12, c, a: 1, fi: .01, fo: .08 }, PN); } }  // the pop: three specks
    },
    sunrays(e, o) {  // soft beams from above onto the main spot (o.at) and up to 3 others (o.spots: [{ at, level? }]); a pool of light on each, dust motes drifting only inside a beam. Fades in over 1.6 s and out over 1.5 s (stop()).
      const L = e.L, S = e.s, A = e.s.anchor, life = (e.secs ?? 1e6) + 1.5, W = o.width ?? .12, H = o.height ?? .7, lat = o.from ?? [-.25, -.45], fin = reduced ? .15 : 1.6, c = [1.45, 1.0, .4];
      e.die = Infinity; e.fadeOut = 1.5;
      const spots = [{ at: A, L, w: W, main: 1 }, ...(o.spots ?? []).slice(0, 3).map(s2 => ({ at: v3(Array.isArray(s2) || s2.isVector3 ? s2 : s2.at), L: Math.max(1, s2.level ?? L - 1), w: W * .7 }))], beams = [];
      for (const sp of spots) { const b = sp.at.clone().sub(A);  // the beam ends on the hero (in a tree too); a followed main spot's pool lies on the water or ground under the body, never over a face (reviews 7, 8)
        const t = b.clone().add(new THREE.Vector3(lat[0] * H, H, lat[1] * H)), al = [.26, .4, .56][sp.L - 1] * (sp.main ? 1 : .6);
        if (put(BQ, { aT: t.toArray(), aB: b.toArray(), aA: [T, life, 0, S.i], aW: [sp.w * .9, sp.w * 1.15, al, fin] }, T + life)) { BQ.end = Math.max(BQ.end, T + life); beams.push({ t, b, w0: sp.w * .9, w1: sp.w * 1.15, main: sp.main, L: sp.L }); }
        ring(e, S, { p: sp.main && o.follow ? [b.x, e.wy - A.y, b.z] : b.toArray(), r: sp.w * .9, asp: 1.5, l: life, k: 3, c, a: [.1, .17, .26][sp.L - 1] * (sp.main ? 1 : .7) }); }
      e.beams = beams; if (reduced) return;
      const mote = bm => { const t = r(.15, .95), ax = bm.b.clone().sub(bm.t), e1 = new THREE.Vector3(-ax.z, 0, ax.x).normalize(), e2 = ax.clone().normalize().cross(e1), hw = THREE.MathUtils.lerp(bm.w0, bm.w1, t) / 2, an = rnd() * TAU, rr = Math.sqrt(rnd()) * hw * .55,
          p = bm.t.clone().addScaledVector(ax, t).addScaledVector(e1, Math.cos(an) * rr).addScaledVector(e2, Math.sin(an) * rr);
        P(e, S, { p: p.toArray(), v: [r(-.0015, .0015), r(-.005, .004), r(-.0015, .0015)], l: r(6, 10), s: r(.007, .012) * (phone ? 1.4 : 1), k: 2, c: [1.7, 1.2, .5], a: .9, fi: 1.2, fo: 1.5, wob: .006, wf: r(.4, .9), tw: r(.6, 1.4) }); };
      const mpb = [8, 14, 22][L - 1] * (phone ? .6 : 1), per = bm => mpb * (bm.main ? 1 : .45);  // motes hanging in a beam (their lives average 8 s)
      e.tick = dt => { for (const bm of beams) for (bm.acc = (bm.acc ?? 0) + dt * per(bm) / 8; bm.acc >= 1; bm.acc--) mote(bm); };
      for (const bm of beams) for (let i = 0, n = Math.round(per(bm)); i < n; i++) mote(bm);  // the dust is already hanging there when the beam fades in
    },
    breath(e, o) {
      if (reduced) return;
      const s = e.size, dir = flatDir(o.dir), every = o.every ?? 2; let next = 0; e.die = Infinity;
      e.tick = () => { if (T - e.t0 < next) return; next = T - e.t0 + every; const a = e.s.anchor, m = e.follow ? [a.x + dir.x * s * .15, a.y + s * .6, a.z + dir.z * s * .15] : [a.x, a.y, a.z];
        { const seed = rnd(); for (let i = 0; i < 12; i++) P(e, e.w, { p: m, v: [dir.x * s * .5, s * .22, dir.z * s * .5], d: i * .035, dr: 1.2, l: .9, s: s * (phone ? .19 : .1) * (1 + i / 12), k: 4, c: tint(o, [.93, .96, 1]), a: phone ? .85 : .7, fi: .08, fo: .5, grow: 1.6, wob: s * .06, wf: 5, seed }, PN); } };  // a thin wisp from the mouth: puffs on one curling path  // a wisp from the mouth, curling up
    },
    "shooting-star"(e, o) {
      const s = e.size, to = v3(o.toward) ?? e.s.anchor.clone().add(new THREE.Vector3(.5, -.08, 0)), d = to.clone().sub(e.s.anchor), c = tint(o, [1.6, 1.45, 1.1]);
      if (reduced) return P(e, e.s, { p: d.toArray(), l: 1.5, s: s * .22, k: 1, c, a: .9, fi: .15, fo: .3 });
      hook("star-chime", 1); const v = d.clone().divideScalar(1.2).toArray();
      P(e, e.s, { v, l: 1.2, s: s * .24, k: 1, c, a: 1, fi: .1, fo: .05 });
      for (let i = 1; i < 36; i++) P(e, e.s, { v, d: i * .007, l: 1.2, s: s * .08 * (1 - i / 40), k: 0, c, a: .9 * (1 - i / 36), fi: .1, fo: .05 });  // the tail: a line of sparks on the head's own path
      P(e, e.s, { p: d.toArray(), d: 1.2, l: 1.6, s: s * .24, k: 1, c, a: .95, fi: .15, fo: .7, tw: 8 });
    },
    "dust-whirl"(e, o) {
      if (reduced) return;
      const s = e.size, dir = flatDir(o.dir), W = o.width ?? .5, v = dir.clone().multiplyScalar(W / 4), c = tint(o, [.3, .2, .1]);
      for (let i = 0; i < 160; i++) { const t = i * .025;  // dust strung on two strands of a funnel: tight at the ground, wider as it rises, two turns
        if (i % 20 === 0) for (let j = 0; j < 3; j++) P(e, e.s, { p: [v.x * t + r(-1, 1) * s * .15, 0, v.z * t + r(-1, 1) * s * .15], v: [v.x * .5, s * .1, v.z * .5], d: t, l: 1.4, s: s * .35, k: 4, c, a: .3, fi: .2, fo: .8, grow: 1.4 }, PN);  // loose puffs at the base
        P(e, e.s, { p: [v.x * t, 0, v.z * t], v: v.toArray(), d: t, l: 1.6, s: s * .16, k: 9, c, a: .65, fi: .1, fo: .4, grow: .6, wob: s * .25, wf: 8, seed: i % 2 ? .75 : .25 }, PN); }
    },
    "soft-lightning"(e, o) {
      if (reduced) return;
      const R = e.size * 3, c = tint(o, [.75, .82, 1]);  // at most 0.5 brighter, each rise at least 0.6 s: never a flash
      for (const [d, a] of [[0, .5], [1.4, .35], [2.4, .45]]) P(e, e.s, { d, l: 1.5, s: R, k: 2, c, a, fi: .6, fo: .8 });
    },
    puff(e, o) {
      const s = e.size * [.6, 1, 1.6][e.L - 1], c = tint(o, [.95, .95, .95]);  // 1 small, 2 a sneeze, 3 a cloud landing
      for (let i = 0, n = reduced ? 6 : [6, 10, 16][e.L - 1]; i < n; i++) { const an = rnd() * TAU, rr = s * r(0, .2), p = [Math.cos(an) * rr, s * r(0, .2), Math.sin(an) * rr];
        if (reduced) P(e, e.s, { p, l: 1.4, s: s * .3, k: 4, c, a: .5, fi: .2, fo: .4 }, PN);
        else P(e, e.s, { p, v: [Math.cos(an) * s * .4, s * r(.1, .3), Math.sin(an) * s * .4], dr: 2, l: r(1.2, 1.8), s: s * .2, k: 4, c, a: .55, fi: .15, fo: .9, grow: 1.6 }, PN); }
    },
    wash(e, o) {
      const ar = area(e, o), R = ar ? ar.w / 2 : o.radius ?? e.size * 4; e.die = Infinity;
      ring(e, e.s, { p: [0, 0, 0], r: R, asp: ar ? ar.d / ar.w : 1, l: e.secs ?? 1e6, k: reduced ? 3 : 1, c: tint(o, [.45, .75, .3]), a: .35 });
    },
  };
  const ALIAS = { "heat-shimmer": ["haze"], "music-notes": ["notes", 2], "wind-streaks": ["gust"], "green-wash": ["wash"] };
  const RIDE = { wake: 1, sparkle: 1, halo: 1, embers: 1, notes: 1, breath: 1, haze: 1 };  // kinds that ride with o.follow; the rest start where it is
  const REPEAT = { splash: 1, "dust-whirl": 1, "shooting-star": 1, puff: 1 };
  const ONESHOT = { splash: 1, dust: 1, puff: 1, "shooting-star": 1, "dust-whirl": 1, "soft-lightning": 1, gust: 1, shimmer: 1 };  // these end on their own length
  const own = e => (e.w.proxyOf ? [e.s] : [e.s, e.w]);

  function play(type, o = {}) {
    let L = o.level; if (ALIAS[type]) { L ??= ALIAS[type][1]; type = ALIAS[type][0]; }
    if (!KINDS[type]) throw new Error(`storyfx: no effect "${type}"`);
    L = Math.max(1, Math.min(type === "notes" || type === "dust" || type === "haze" ? 2 : 3, Math.round(L ?? 2)));
    const at = v3(o.at) ?? o.follow?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(), size = o.size ?? .1;
    const e = { type, o, L, size, t0: T, die: T, follow: RIDE[type] ? o.follow ?? null : null, secs: o.secs, stopping: false, done: false, wy: o.waterY ?? at.y, weather: type === "rain" || type === "gust" };
    e.s = slot(e); e.s.anchor.copy(at); if (type === "splash") e.s.anchor.y = e.wy;  // the effect's own slot: a riding kind's moves with its follower
    if (e.follow) { e.w = slot(e); e.w.anchor.set(0, 0, 0); } else e.w = { i: e.s.i, proxyOf: e.s };  // what falls off behind a follower stays where it fell: a world slot; a still effect needs none
    e.stop = now => { if (e.stopping) return; e.stopping = true; e.tick = null; e.fadeT = T; for (const s of own(e)) s.rate = now ? 1e9 : 1 / (e.fadeOut ?? .6); };
    const h = { type, level: L, stop: () => e.stop(), get done() { return e.done; }, get live() { return e.done ? 0 : own(e).reduce((n, s) => n + count(PA, i => Math.round(PA.slotOf(i)) === s.i) + count(PN, i => Math.round(PN.slotOf(i)) === s.i), 0); } }; e.h = h;  // live: its particles now (for checks)
    KINDS[type](e, o);
    if (o.every && REPEAT[type] && !reduced) { let next = o.every; e.die = Infinity; e.tick = () => { if (T - e.t0 >= next) { next += o.every; KINDS[type](e, o); } }; }  // at rest: again and again until stop()
    e.end = o.secs != null ? T + o.secs : Infinity;
    if (ONESHOT[type] && o.secs == null) e.end = Infinity;
    effects.push(e); return h;
  }
  const rings = (every, region, o = {}) => play("rings", { ...o, every, region });

  function finish(e) { e.done = true; for (const s of own(e)) if (s.owner === e) kill(s.i); if (e.wake) { e.wake.owner = null; hideWake(e.wake); } }
  const camPos = new THREE.Vector3(0, 1, 3), FR = new THREE.Vector3(), front = a => { FR.copy(camPos).sub(a); FR.y = 0; return FR.lengthSq() ? FR.normalize() : FR.set(0, 0, 1); };  // toward the camera, on the ground
  function update(dt, camera) {
    if (camera) { cam = camera; camPos.copy(camera.position); }
    dt = Math.min(Math.max(dt, 0), .1); T += dt; U.uT.value = T; renderer.getDrawingBufferSize(size2); U.uH.value = size2.y; countDown();
    for (let i = effects.length - 1; i >= 0; i--) { const e = effects[i];
      if (e.follow && !e.stopping) e.follow.getWorldPosition(e.s.anchor);  // shortcut: rides the follower's origin (its feet); a per-kind offset if a page needs one
      if (!e.stopping && T >= e.end) e.stop();
      e.tick?.(dt);
      if (e.wake) buildWake(e.wake, e, e.alpha * (e.stopping ? Math.max(0, 1 - (T - e.fadeT) / .6) : Math.min(1, (T - e.t0) / (reduced ? .15 : .3))));
      if (e.stopping) for (const s of own(e)) s.fade = Math.max(0, s.fade - dt * s.rate);
      if ((e.stopping && own(e).every(s => s.fade <= 0)) || (!e.stopping && !e.tick && !e.wake && e.end === Infinity && T > e.die + .05)) { finish(e); effects.splice(i, 1); }
    }
    for (const s of slots) if (s.used) U.uS.value[s.i].set(s.anchor.x, s.anchor.y, s.anchor.z, s.fade);
    for (const Q of [PA, PN, RQ, CQ, BQ]) {
      if (Q.hi >= Q.lo) { for (const a of Q.attrs) { const at = Q.g.attributes[a];  // only what was written goes up; ranges not yet sent (no frame drawn since) are kept, merged into one when many
        if (at.updateRanges.length > 8) { at.clearUpdateRanges(); at.addUpdateRange(0, Q.n * Q.S[a]); } else at.addUpdateRange(Q.lo * Q.S[a], (Q.hi - Q.lo + 1) * Q.S[a]); at.needsUpdate = true; } Q.lo = Q.n; Q.hi = -1; }
      Q.mesh.visible = T < Q.end && slots.some(s => s.used); }
    wmesh.visible = wakes.some(w => w.owner); nmesh.visible = T < nend; renderer.getDrawingBufferSize(size2); nmesh.material.uniforms.uW.value = size2.x;
  }
  function clear() { for (const e of effects) finish(e); effects.length = 0; NF.aA.fill(-1); for (let i = 0; i < WIN; i++) NF.aA[i * 4] = 0; ng.attributes.aA.needsUpdate = true; nend = 0; for (const s of slots) if (s.used) kill(s.i); for (const Q of [PA, PN, RQ, CQ, BQ]) Q.end = 0; update(0); }
  const count = (Q, f = () => true) => { let c = 0; for (let i = 0; i < Q.n; i++) { const s = Math.round(Q.slotOf(i)); if (alive(Q, i) && slots[s]?.used && U.uS.value[s].w > 0 && f(i)) c++; } return c; };
  function stats() {
    const a = count(PA), n = count(PN), rg = count(RQ), cd = count(CQ), bm = count(BQ), wk = wakes.filter(w => w.owner).length, held = Q => count(Q, i => Q.F[Q.life][i * 4 + 1] > 1e4);
    return { live: a + n, additive: a, normal: n, rings: rg, cards: cd, beams: bm, wakes: wk, draws: (a > 0) + (n > 0) + (rg > 0) + (cd > 0) + (wk > 0) + nmesh.visible + (count(BQ) > 0), effects: effects.length,
      slots: slots.filter(s => s.used).length, held: held(PA) + held(PN), heldRings: held(RQ), dropped: PA.dropped + PN.dropped, budget: BUDGET, counted: ALL.live, weather: WX.live, weatherCap: WEATHER,
      caps: { additive: PA.n, normal: PN.n, rings: RQ.n, cards: CQ.n, beams: BQ.n, wakes: WN, slots: NS }, time: T };
  }
  function onScreen(camera, what = "rain") {  // a child's count: rain streaks (or cards) whose middle is on screen below the read-along quarter right now
    const v = new THREE.Vector3(), seen = (x, y, z, s) => { v.set(x + U.uS.value[s].x, y + U.uS.value[s].y, z + U.uS.value[s].z).project(camera); return Math.abs(v.x) < 1 && v.y > -1 && v.y < .5 && v.z < 1; };
    let c = 0;
    if (what === "cards") { const F = CQ.F; for (let i = 0; i < CQ.n; i++) { const age = T - F.aA[i * 4], s = Math.round(F.aA[i * 4 + 3]); if (alive(CQ, i) && age >= 0 && slots[s]?.used && seen(F.aP[i * 3] + F.aV[i * 3] * age, F.aP[i * 3 + 1] + F.aV[i * 3 + 1] * age, F.aP[i * 3 + 2] + F.aV[i * 3 + 2] * age, s)) c++; } }
    else { const F = PN.F; for (let i = 0; i < PN.n; i++) { const age = T - F.aA[i * 4], s = Math.round(F.aD[i * 4 + 2]); if (F.aA[i * 4 + 3] === 3 && alive(PN, i) && age >= 0 && slots[s]?.used && seen(F.position[i * 3] + F.aV[i * 3] * age, F.position[i * 3 + 1] + F.aV[i * 3 + 1] * age, F.position[i * 3 + 2] + F.aV[i * 3 + 2] * age, s)) c++; } }
    return c;
  }
  function dispose() { clear(); scene.remove(root); root.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); }
  return { play, rings, clear, update, stats, onScreen, dispose, get time() { return T; }, root };
}
