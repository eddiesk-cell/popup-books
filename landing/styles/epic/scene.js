// scene.js: the epic landing page's background. The shelf's own leather-and-gold book (Mali's midnight cover, an emblem in place of its title) lies closed, centred, in the dark, sinks and opens as the page scrolls,
// and the wonders burst out of its fold like an explosion that then hangs in slow motion (stories/LANDING-MOTION.md is the design).
//   const s = await mount(canvas, { reducedMotion })  ->  { progress(p 0..1), pointer(x, y -1..1), resize(), dispose() }
// Scroll decides what is on stage (the book's pose, which kind of wonder); each burst then plays in REAL TIME from the moment p crosses its threshold (the clock option lets a test freeze or step time).
// Needs the page's importmap to map "three" and "three/addons/" (as web/shelf/index.html does).
// Cost: the wonders are ONE instanced draw (every position is a closed form of the burst's age, evaluated in the vertex shader) and the dust, streak tails and motes ONE points draw; the night is one full-frame quad; the flash, the ring, the pillar,
// the page glow and the pool are one mesh; the book is frozen into one mesh per material when it rests. No shadows, no post-processing.
// Wonders: scene/sprites/wonders.webp + wonders.json (the art builder's gold atlas) when present, else the atlas drawn in scene/atlas.js; the letters are always drawn here.
import { makeAtlas, makeEmblemMap, drawEmblem } from "./scene/atlas.js";
import { COVER_AT } from "./timing.js";
let THREE, GLTFLoader, MeshoptDecoder, RoomEnvironment, mergeGeometries, loadOpenBook;  // loaded inside mount(): if one of them fails, mount() draws the still instead of this module failing to load

const SHELF = new URL("../../../shelf/", import.meta.url).href, SPRITES = new URL("./scene/sprites/", import.meta.url), FOV = 40, tV = Math.tan(FOV * Math.PI / 360), rad = Math.PI / 180;
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), ease = k => (k = cl(k)) * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k;
const MAXB = () => ({ blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });  // a 'lighten' blend: layers never add up past the brightest one, so the fold can never burn to white
const THR = [.20, .30, .40, .50, .60, .70, .80, .90];  // the beats: the big burst when the cover has opened, a smaller one for each new kind, then the constellations
// per beat: [external kinds, own groups, how many]. The kinds: 1 past, 2 fantasy, 3 magic and spirits, 4 play and creatures, 5 music and dance, 6 future, 7 dreams
const BEATS = [[[1], ["past"], 9], [[2], ["fantasy"], 9], [[3, 5], ["magic", "play"], 9], [[4], ["creatures"], 9], [["glyph"], ["glyph"], 9], [[6], ["future"], 9], [[7], ["dreams"], 9], [["const"], ["const"], 8]];
const SPECKS = [300, 120, 120, 120, 120, 120, 120, 50];
const COMMON = `uniform vec4 uB[8];  // per beat: x its age in seconds (negative before it), y fallen back into the book 0..1, z shrunk to a star 0..1, w strength
uniform float uP, uT, uBurst, uD, uD0, uSz, uH, uRec; uniform vec2 uFold, uPtr;
const float K = 3.2;  // every speed and spin falls away as e^(-K t): a hundredth of the launch speed by 1.5 s
const float TAIL = .6;  // an extra squared term in the slowing: the same launch, but the last of the speed is gone by about 2 s, so the float that follows is the drift alone
const float DRIFT_F = .22, DRIFT_A = .03;  // the hang's drift: noise cells per second, and its reach in world units per unit of distance (tuned with debug.probe)
float vh1( float n ) { return fract( sin( n * 12.9898 ) * 43758.5453 ); }
float vn1( float x ) { float i = floor( x ), f = fract( x ); f = f * f * ( 3. - 2. * f ); return mix( vh1( i ), vh1( i + 1. ), f ); }  // smooth 1-D value noise, 0..1
vec3 place( vec4 bs, float delay, float seed, vec2 dxy, float k, float lag, float Kk, out vec3 vel ) {  // launch, then drag: origin + (target - origin) x (1 - e^(-K t)), an arc, then a slow float
  float tt = max( bs.x - delay - lag, 0. ), g = 1. - exp( -Kk * tt - TAIL * tt * tt ), P0 = projectionMatrix[0][0], P1 = projectionMatrix[1][1], d1 = k * uD;
  vec2 tn = uFold + dxy + vec2( uPtr.x * .03, uPtr.y * .015 ) / k;
  vec3 F = vec3( uD0 * ( uFold.x + projectionMatrix[2][0] ) / P0, uD0 * ( uFold.y + projectionMatrix[2][1] ) / P1, -uD0 ), T = vec3( d1 * ( tn.x + projectionMatrix[2][0] ) / P0, d1 * ( tn.y + projectionMatrix[2][1] ) / P1, -d1 ), R = T - F;
  vec2 perp = vec2( -R.y, R.x ) / ( length( R.xy ) + 1e-4 ); vec3 pos = F + R * g; pos.xy += perp * length( R.xy ) * .14 * ( seed - .5 ) * 2. * sin( 3.14159 * g );  // paths are arcs
  pos.xy += ( vec2( vn1( uT * DRIFT_F + seed * 53. ), vn1( uT * DRIFT_F + seed * 53. + 17.3 ) ) - .5 ) * DRIFT_A * d1 * g;  // the hang: each piece wanders on a smooth, non-repeating noise path (never stops dead, never loops visibly, 2 to 6 px/s on screen)
  pos.y += ( uP - .2 ) * .04 * ( .4 + .6 / k ) * d1 * g;  // and rises as the page scrolls
  vel = R * ( Kk + 2. * TAIL * tt ) * exp( -Kk * tt - TAIL * tt * tt ) * step( 0., bs.x - delay - lag ); return mix( pos, F, bs.y );
}`;
const VERT = `attribute vec4 iA, iB, iC, iD, iE; varying vec2 vUv, vQ; varying float vAl, vBias, vFlag, vSheen, vStar; ${COMMON}
void main() {
  vec4 bs = uB[int( iA.x )]; float tt = bs.x - iA.y, live = step( 0., tt ), P1 = projectionMatrix[1][1], P0 = projectionMatrix[0][0]; vec3 vel; vec3 P = place( bs, iA.y, iA.z, iB.xy, iC.x, 0., iC.w, vel ); float cur = -P.z, dd = cur / uD;
  float launch = 1. - exp( -7. * max( tt, 0. ) ), sz = iC.y * uSz * 2. * iC.x * uD / P1 * ( .2 + .8 * launch + .04 * sin( launch * 3.14159 ) );  // a fifth of its size at the start, full with a small overshoot
  if ( iE.z > .5 ) sz = max( sz, 56. * cur / ( .5 * uH * P1 ) );  // letters: never under 28 px tall
  sz *= mix( 1., .16, bs.z ) * mix( 1., uRec, bs.w ) * ( 1. - .9 * bs.y );  // an older kind recedes (its pieces shrink to far size and stay readable), then turns to stars  // an old kind shrinks to a point of light
  vec2 sv = vec2( vel.x * P0, vel.y * P1 ) / cur, dn = sv / ( length( sv ) + 1e-5 ); float streak = 1. + clamp( length( sv ) * .32 / max( 2. * sz * P1 / cur, .02 ), 0., 7. ) * uBurst * ( 1. - bs.z );  // fast: stretched into a streak along its path
  float roll = iB.z + iB.w * ( 1. - exp( -iC.w * max( tt, 0. ) ) ) / iC.w + ( step( .5, iA.z ) * 2. - 1. ) * ( .035 + .07 * fract( iA.z * 7.31 ) ) * uT;  // spin falls away with the speed, then 2 to 6 degrees a second
  vec2 q = position.xy * vec2( iE.x, 1. ); q = vec2( q.x * cos( roll ) - q.y * sin( roll ), q.x * sin( roll ) + q.y * cos( roll ) ); q += dn * dot( q, dn ) * ( streak - 1. );
  vec4 clip = projectionMatrix * vec4( P + vec3( q * sz - dn * .5 * ( streak - 1. ) * sz, 0. ), 1. ); gl_Position = live > 0. ? clip : vec4( 0., 0., 2., 1. );
  vAl = live * smoothstep( 0., .05, tt ) * ( 1. - bs.y ) * smoothstep( .2, .5, dd ) * mix( 1., .5, smoothstep( 1.2, 4.5, dd ) ) * ( 1. - .7 * smoothstep( -.1, .8, clip.y / clip.w ) ) / sqrt( streak ) * mix( 1., 2.4 * ( .6 + .4 * sin( uT * 2. + iA.z * 50. ) ), bs.z ) * 1.05;  // far ones dimmer, the upper frame stays dark, a star twinkles
  vBias = 2.4 * smoothstep( .75, .3, dd ) + 3. * bs.z;  // very near ones are soft, out of focus
  vSheen = ( bs.x - 2. - iA.z * 3. ) / 1.2; vFlag = iE.y; vStar = bs.z; vQ = position.xy + .5; vUv = iD.xy + vec2( vQ.x, 1. - vQ.y ) * iD.zw;
}`;
const FRAG = `uniform sampler2D uMap, uPg1, uPg2, uPg3, uPg4; varying vec2 vUv, vQ; varying float vAl, vBias, vFlag, vSheen, vStar; void main() { vec4 t = vFlag < .5 ? texture2D( uMap, vUv, vBias ) : vFlag < 1.5 ? texture2D( uPg1, vUv, vBias ) : vFlag < 2.5 ? texture2D( uPg2, vUv, vBias ) : vFlag < 3.5 ? texture2D( uPg3, vUv, vBias ) : texture2D( uPg4, vUv, vBias ); vec3 c = t.rgb;
  if ( vSheen > 0. && vSheen < 1. ) c += c * exp( -pow( ( vQ.x * .7 + vQ.y * .3 - ( vSheen * 1.6 - .3 ) ) / .12, 2. ) ) * .8;  // once, a band of light slides across the foil
  float a = ( vFlag > .5 ? 1. : t.a ) * vAl, dt = smoothstep( 1., 0., length( vQ - .5 ) * 2. ) * vAl; gl_FragColor = vec4( min( mix( c, vec3( 1., .86, .56 ), vStar ), vec3( .86, .78, .52 ) ) * min( mix( a, dt * dt, vStar ), .9 ), 1. ); }`;  // a shrunk wonder is a round point of light, not a small square
const PVERT = `attribute vec4 pA, pB, pC; varying float vAl; ${COMMON} uniform float uE, uWait;
void main() {
  if ( pA.w > 2.5 ) {  // dust over the whole frame, at every scroll position: each mote lives one cycle (pB.x seconds), fading in and out, and takes a new random place each cycle (while it is invisible); in between it wanders on a slow noise path. pC.x is its depth: near = large, soft, quick, faint; far = fine, slow
    float cyc = uT / pB.x + pB.y, ci = floor( cyc ), fr = fract( cyc ), d = pC.x;
    vec2 base = vec2( vh1( pA.z * 91.7 + ci * 13.3 ), vh1( pA.z * 57.1 + ci * 7.7 + 3. ) ) * 2.1 - 1.05, wob = ( vec2( vn1( uT * .09 + pA.z * 33. ), vn1( uT * .09 + pA.z * 33. + 9.1 ) ) - .5 ) * .26 * ( .35 + d );
    gl_Position = vec4( base + wob + uPtr * .03 * d, 0., 1. ); gl_PointSize = mix( 3., 46., d * d * d ) * uH / 800.;
    float w = sin( 3.14159 * fr ); vAl = w * w * mix( .95, .24, d ) * ( .7 + .3 * sin( uT * ( 1.2 + 2. * pA.z ) + pA.z * 50. ) ); return;
  }
  if ( pA.w > 1.5 ) {  // ambient motes over the pages; while the wonders' art is on its way they rise from the fold and curl back in
    float ph = fract( pB.z + uT * ( .035 + uWait * .1 ) ); vec4 mv = viewMatrix * vec4( pB.x * .5 * mix( 1., .35 + .65 * ( 1. - ph ), uWait ) + sin( uT * .4 + pB.w * 30. + ph * 5. ) * .08, .05 + mix( ph * 2.4, 1.5 * sin( ph * 3.1416 ), uWait ), pB.y * .25, 1. );
    gl_Position = projectionMatrix * mv; gl_PointSize = ( 2. + pB.w * 4. ) * ( 1. + uWait * 1.6 ) * uH / 800.; vAl = sin( ph * 3.1416 ) * uE * ( .5 + .5 * sin( uT * 1.3 + pB.w * 99. ) ) * ( .7 + uWait * .5 ); return;
  }
  vec4 bs = uB[int( pA.x )]; float tt = bs.x - pA.y - pB.z; vec3 vel; vec3 P = place( bs, pA.y, pA.z, pB.xy, pC.x, pB.z, pC.w, vel );
  if ( tt < 0. ) { gl_Position = vec4( 0., 0., 2., 1. ); gl_PointSize = 0.; vAl = 0.; return; }
  float cur = -P.z, dd = cur / uD, sp = length( vec2( vel.x * projectionMatrix[0][0], vel.y * projectionMatrix[1][1] ) / cur ); gl_Position = projectionMatrix * vec4( P, 1. ); vec4 cp = gl_Position;
  float al = ( 1. - bs.y ) * smoothstep( .2, .5, dd ) * ( 1. - .5 * smoothstep( .1, .95, cp.y / cp.w ) );
  if ( pA.w < .5 ) { gl_PointSize = max( 1., pC.y * uH / 800. * sqrt( 1.2 / pC.x ) ); vAl = al * ( .45 + .55 * sin( uT * 2.1 + pA.z * 90. ) ) * .8; }  // dust: hangs and twinkles
  else { gl_PointSize = max( 1., ( 7. - pB.z * 30. ) * uH / 800. * sqrt( 1.2 / pC.x ) ); vAl = al * clamp( sp * .6, 0., 1. ) * ( 1. - pB.z * 5. ) * .8 * uBurst; }  // a wonder's tail of gold dust, only while it is fast
}`;
const PFRAG = `varying float vAl; void main() { float r = length( gl_PointCoord - .5 ); gl_FragColor = vec4( vec3( 1., .82, .45 ) * smoothstep( .5, 0., r ) * min( vAl, .9 ), 1. ); }`;
const GVERT = `attribute float kd; uniform vec4 uF, uPil; varying vec2 vUv; varying float vK; void main() { vUv = uv; vK = kd; vec3 p = position, r = normalize( vec3( cameraPosition.z, 0., -cameraPosition.x ) );
  if ( kd < .5 ) p = vec3( 0., position.y * uPil.x, 0. ) + r * position.x * uPil.y;  // the pillar shoots up from the fold in .18 s, then thins to a standing shaft
  else if ( kd > 3.5 && kd < 4.5 ) p = vec3( position.x * uF.z, position.y, position.z * uF.z );  // the ring races out across the pages
  else if ( kd > 2.5 && kd < 3.5 ) { vec3 up = vec3( viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1] ), rt = vec3( viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0] ); p = vec3( 0., .1, 0. ) + ( rt * position.x + up * position.y ) * uF.y; }  // the flash disc
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1. ); }`;
const GFRAG = `uniform vec3 uI; uniform vec4 uF, uPil; varying vec2 vUv; varying float vK; void main() { vec2 c = vUv - .5; vec3 col; float a;
  if ( vK < .5 ) { a = exp( -pow( c.x * 4., 2. ) ) * ( 1. - smoothstep( .2, .5, abs( c.x ) ) ) * smoothstep( 0., .1, vUv.y ) * pow( 1. - vUv.y, 2.4 ) * uI.x; col = vec3( 1., .78, .42 ); }
  else if ( vK < 1.5 ) { a = ( exp( -pow( c.x * ( 7. + uPil.z * 22. ), 2. ) ) * .5 + ( 1. - smoothstep( 0., .5, length( c * vec2( 1., 1.5 ) ) ) ) * .16 * ( 1. - uPil.z * .7 ) ) * ( 1. - smoothstep( .22, .5, abs( c.x ) ) ) * ( 1. - smoothstep( .22, .5, abs( c.y ) ) ) * uI.y * ( 1. + uPil.z ); col = vec3( 1., .9, .66 ); }  // the pages' core at the fold (a bright seam while the book breathes in)
  else if ( vK < 2.5 ) { a = ( 1. - smoothstep( 0., .5, length( c * vec2( 1., 1.3 ) ) ) ) * .45 * uI.z; col = vec3( 1., .66, .28 ); }
  else if ( vK < 3.5 ) { a = pow( 1. - smoothstep( 0., .5, length( c ) ), 1.6 ) * uF.x; col = vec3( 1., .8, .45 ); }  // the flash: gold, never white (peak under .85)
  else if ( vK < 4.5 ) { float r = length( c ); a = exp( -pow( ( r - .45 ) / .012, 2. ) ) * uF.w; col = vec3( 1., .82, .5 ); }  // a hairline ring
  else { float pg = step( .5, vUv.x ), u = fract( vUv.x * 2. ), row = floor( vUv.y * 19. ), fy = fract( vUv.y * 19. ), h = fract( sin( row * 12.9 + pg * 78.2 ) * 43758.5 ), ln = .5 + .45 * h, last = step( 16., row );
    a = step( .1, u ) * step( u, .1 + .8 * ln * ( 1. - .5 * last ) ) * step( 1., row ) * step( row, 16. ) * smoothstep( .35, .5, fy ) * ( 1. - smoothstep( .5, .65, fy ) ) * step( .12, h ) * 1. * uPil.w; col = vec3( 1., .86, .52 ); }  // faint gold lines of lettering, so the pages read as a book
  gl_FragColor = vec4( col * min( a, .9 ), 1. ); }`;
const BVERT = `varying vec2 vN; void main() { vN = position.xy * 2.; gl_Position = vec4( vN, 1., 1. ); }`;
const BFRAG = `uniform float uT, uAsp, uDim; uniform vec2 uPtr, uFold; varying vec2 vN;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f ); return mix( mix( h21( i ), h21( i + vec2( 1., 0. ) ), f.x ), mix( h21( i + vec2( 0., 1. ) ), h21( i + 1. ), f.x ), f.y ); }
float stars( vec2 uv, float sc, float dens ) { vec2 g = uv * sc, i = floor( g ), f = fract( g ) - .5; float r = h21( i ); if ( r > dens ) return 0.; vec2 o = vec2( h21( i + 7.1 ), h21( i + 3.3 ) ) - .5; float d = length( f - o * .7 );
  return smoothstep( .06 + .05 * h21( i + 9. ), 0., d ) * ( .35 + .65 * h21( i + 1.5 ) ) * ( .75 + .25 * sin( uT * ( 1. + 3. * r ) + r * 60. ) ); }
void main() { vec2 n = vN, uv = vec2( n.x * uAsp, n.y ); vec3 col = mix( vec3( .034, .030, .050 ), vec3( .012, .012, .024 ), smoothstep( -1., 1., n.y ) );
  col += vec3( 1., .86, .62 ) * ( stars( uv + uPtr * .015, 8., .12 ) * .5 + stars( uv + uPtr * .04 + 3.1, 15., .14 ) * .4 + stars( uv + uPtr * .08 + 7.7, 27., .16 ) * .32 ) * uDim;  // three layers of stars, drifting with the pointer by depth
  float band = exp( -pow( ( n.y - ( .62 + .12 * n.x ) ) / .2, 2. ) ), neb = vn( uv * 1.6 + uPtr * .01 ) * .6 + vn( uv * 3.7 + 5. ) * .4; col += ( vec3( .10, .07, .16 ) + vec3( .06, .04, .01 ) ) * neb * band * .42 * uDim;  // a faint milky band high in the frame
  vec2 gq = vec2( n.x * uAsp * .62, n.y - uFold.y - .08 ); col += vec3( 1., .68, .36 ) * exp( -dot( gq, gq ) * 2.1 ) * ( .115 + .03 * sin( uT * .32 ) ) * uDim;  // the back glow: warm, wide, low, its edges gone into the night, breathing very slowly; never above the logo's gold
  gl_FragColor = vec4( col, 1. ); }`;

function standIn(old) {  // no WebGL (or the scene failed to build): one still frame on a FRESH canvas swapped in for the old one (a canvas that held WebGL cannot give a 2D context), and the same four methods
  const canvas = document.createElement("canvas"); for (const a of [...old.attributes]) canvas.setAttribute(a.name, a.value); canvas.removeAttribute("width"); canvas.removeAttribute("height"); old.replaceWith(canvas);
  const x = canvas.getContext("2d"), draw = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5), w = canvas.width = Math.round((canvas.clientWidth || 1280) * dpr), h = canvas.height = Math.round((canvas.clientHeight || 800) * dpr);
    x.fillStyle = "#09080e"; x.fillRect(0, 0, w, h); const g = x.createRadialGradient(w / 2, h * .62, 0, w / 2, h * .62, Math.max(w, h) * .5); g.addColorStop(0, "rgba(230,170,80,.28)"); g.addColorStop(1, "rgba(230,170,80,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const bw = Math.min(w * .42, h * .5), bh = bw * 1.1; x.shadowColor = "rgba(240,180,80,.5)"; x.shadowBlur = bw * .25; x.fillStyle = "#0f1a44"; x.strokeStyle = "#e6bb62"; x.lineWidth = Math.max(2, bw * .015);
    x.beginPath(); x.roundRect(w / 2 - bw / 2, h * .6 - bh / 2, bw, bh, bw * .04); x.fill(); x.shadowBlur = 0; x.stroke(); x.strokeRect(w / 2 - bw * .4, h * .6 - bh * .4, bw * .8, bh * .8);
    x.fillStyle = "rgba(255,230,170,.8)"; for (let i = 0; i < 40; i++) { const a = Math.sin(i * 12.9) * 43758.5, b = Math.sin(i * 78.2) * 24634.6; x.fillRect((a - Math.floor(a)) * w, (b - Math.floor(b)) * h * .45, 1.5, 1.5); } };
  draw(); return { progress() {}, pointer() {}, resize: draw, dispose() {} };
}

async function loadSprites(n = 1) {  // the art builder's atlas, when it is there. shortcut: absent files cost one 404 in the network panel; a manifest would avoid it
  try { const [j, im] = await Promise.all([fetch(new URL(n > 1 ? `wonders-${n}.json` : "wonders.json", SPRITES)).then(r => r.ok ? r.json() : Promise.reject()), new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = new URL(n > 1 ? `wonders-${n}.webp` : "wonders.webp", SPRITES).href; })]); return { j, im }; } catch { return null; }
}
const bake = (group, skip) => {  // the book frozen in its current pose: one mesh per material (what it cost: ~20 draws while it is hinged, ~10 at rest)
  group.updateMatrixWorld(true); const inv = group.matrixWorld.clone().invert(), by = new Map(), out = new THREE.Group();
  group.traverse(o => {
    if (!o.isMesh) return; for (let a = o; a && a !== group.parent; a = a.parent) if (!a.visible) return;
    const g = o.geometry, mats = [].concat(o.material), m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), flip = m.determinant() < 0, n = g.attributes.position.count;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : n, materialIndex: 0 }]) {
      const s = new THREE.BufferGeometry(); for (const [k, z] of [["position", 3], ["normal", 3], ["uv", 2]]) { const f = new THREE.BufferAttribute(new Float32Array(n * z), z), at = g.attributes[k]; if (at) for (let i = 0; i < n; i++) for (let c = 0; c < z; c++) f.array[i * z + c] = [at.getX, at.getY, at.getZ][c].call(at, i); s.setAttribute(k, f); }
      const ix = Array.from({ length: gr.count }, (_, i) => g.index ? g.index.getX(gr.start + i) : gr.start + i); if (flip) for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
      s.setIndex(ix); s.applyMatrix4(m); const mat = mats[gr.materialIndex]; if (mat === skip) continue; if (!by.has(mat)) by.set(mat, []); by.get(mat).push(s);
    }
  });
  for (const [mat, list] of by) out.add(new THREE.Mesh(list.length > 1 ? mergeGeometries(list) : list[0], mat)); return out;
};

export async function mount(canvas, { reducedMotion = false, clock = () => performance.now() / 1000 } = {}) {  // clock: the idle clock in seconds (a test may freeze it)
  const phone = Math.min(innerWidth, innerHeight) < 600 || matchMedia("(pointer: coarse)").matches;
  const heroNew = new URLSearchParams(location.search).get("hero") === "new";  // a PILOT switch: ?hero=new shows the new hero book (hero-book.glb, assets/brand/book/) in place of the shelf's; without it nothing below differs from before
  try { [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }, { mergeGeometries }, { loadOpenBook }] = await Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/meshopt_decoder.module.js"), import("three/addons/environments/RoomEnvironment.js"), import("three/addons/utils/BufferGeometryUtils.js"), import("../../../shelf/bookmodel.js")]); }
  catch (e) { console.warn("epic scene: a module failed to load, drawing the still instead:", e.message); return standIn(canvas); }
  { const t = document.createElement("canvas"), gl = t.getContext("webgl2") || t.getContext("webgl"); if (!gl) return standIn(canvas); gl.getExtension("WEBGL_lose_context")?.loseContext(); }  // no WebGL: the still, without three printing an error
  let renderer; try { renderer = new THREE.WebGLRenderer({ canvas, antialias: heroNew || !phone, powerPreference: "high-performance" }); } catch (e) { return standIn(canvas); }
  try {
    renderer.debug.checkShaderErrors = false; renderer.setPixelRatio(heroNew ? Math.min(devicePixelRatio || 1, phone ? 2 : 1.5) : phone ? 1 : Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x09080e);  // ?hero=new: the new book is sharp on a phone too (measured: renders/review/hero-book/round-2)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .86;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(FOV, 1.6, 0.05, 60), rig = new THREE.Group(), env = new RoomEnvironment(), pm = new THREE.PMREMGenerator(renderer);
    env.traverse(o => o.material?.color?.multiply(new THREE.Color(1, .82, .62))); scene.environment = pm.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.34; pm.dispose(); env.dispose?.();
    let B, paper0, closedG, flatG, mixer = null;
    if (heroNew) {  // one skinned book, two draws; its 1-second clip "Open" is the opening (time 0 closed .. 1 open flat), driven from the scroll in place()
      const gl = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL("./hero-book.glb", import.meta.url).href), book = gl.scene; let paperM; mixer = new THREE.AnimationMixer(book); mixer.clipAction(gl.animations[0]).play(); mixer.setTime(0);
      book.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; for (const k of ["map", "normalMap", "roughnessMap", "aoMap"]) if (o.material[k]) o.material[k].anisotropy = 8; if (o.material.name === "paper") paperM = o.material; });  // a skinned mesh's bounds are its closed pose: never cull it
      paperM.color.setScalar(.66); paper0 = paperM.color.clone(); B = { group: book, materials: { paper: paperM } }; closedG = flatG = book; rig.add(book); scene.add(rig); book.updateMatrixWorld(true);
    } else {
    // The shelf's loader also fetches things this scene never shows; they are swapped for tiny stand-ins through a URL modifier (the title plate's picture, the closed book's glb, the leather's normal map: 300 KB saved). shortcut: re-point these if loadOpenBook's file names change
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", FLAT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNoaPgPAAODAgAApfuJAAAAAElFTkSuQmCC";
    const js = new TextEncoder().encode('{"asset":{"version":"2.0"},"scenes":[{}],"scene":0}   '), glb = new Uint8Array(20 + js.length), dv = new DataView(glb.buffer); dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.length, true); dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); glb.set(js, 20);
    const EMPTY = URL.createObjectURL(new Blob([glb]));
    THREE.DefaultLoadingManager.setURLModifier(u => /books\/mali\/plate\.webp$/.test(u) ? PNG : /leather-normal\.webp$/.test(u) ? FLAT : /shelf\/book\.glb$/.test(u) ? EMPTY : u);
    B = await loadOpenBook(THREE, loader, "mali", SHELF).finally(() => { THREE.DefaultLoadingManager.setURLModifier(undefined); URL.revokeObjectURL(EMPTY); });  // the closed book needs no wonders: the sprite atlas is fetched after the first frame
    // shortcut: no cover art of its own yet. ONE emblem (an eight-pointed star in a double ring, gold on the leather) is the picture window's colour map and is tooled small into the title's place on the cover's three maps (colour, normal, metal mask), in place of the title; replace when the brand cover is made
    Object.assign(B.plate.m.material, { map: makeEmblemMap(THREE), color: new THREE.Color(0xffffff), roughness: .55, clearcoat: .15, emissiveIntensity: .35, needsUpdate: true });
    [B.materials.cover.map, B.materials.cover.normalMap, B.materials.cover.aoMap].forEach((t, ti) => { const im = t.image, cv = document.createElement("canvas"), x = cv.getContext("2d", { willReadFrequently: true }); cv.width = im.width; cv.height = im.height; x.drawImage(im, 0, 0);
      const k = im.width / 672, d = x.getImageData(160 * k, 600 * k, 14 * k, 100 * k).data, m = [0, 1, 2, 3].map(c => { let s = 0; for (let i = c; i < d.length; i += 4) s += d[i]; return s / (d.length / 4); });
      const q = x.getImageData(172 * k, 592 * k, 334 * k, 122 * k), z = q.data; for (let i = 0; i < z.length; i += 4) { const n = (Math.random() - .5) * 4; z[i] = m[0] + n; z[i + 1] = m[1] + n; z[i + 2] = m[2] + n; z[i + 3] = m[3]; } x.putImageData(q, 172 * k, 592 * k);
      if (ti !== 1) { drawEmblem(x, 339 * k, 653 * k, 40 * k, ti ? "orm" : "map"); x.strokeStyle = ti ? "rgb(255,90,255)" : "#e0b45e"; x.lineWidth = 1.6 * k; x.beginPath(); x.moveTo(186 * k, 653 * k); x.lineTo(292 * k, 653 * k); x.moveTo(386 * k, 653 * k); x.lineTo(492 * k, 653 * k); x.stroke(); }
      t.image = cv; t.needsUpdate = true; });
    B.materials.paper.color.set(0xf1efe5).multiplyScalar(.38); paper0 = B.materials.paper.color.clone();  // the reader's paper, dimmed by the night
    { const g = B.materials.gilt; g.map = null; g.color.set(0xb88a3e); g.normalScale.set(.25, .25); g.roughness = .5; g.needsUpdate = true; }  // the page edges: smooth gilt, not the streaky texture
    B.materials.ribbon.color.set(0x7a1420); B.materials.band.color.set(0x7a1420);  // midnight and gold: a deep crimson ribbon, not pink
    B.group.traverse(o => { o.castShadow = o.receiveShadow = false; }); rig.add(B.group); scene.add(rig); const mc = B.group.getObjectByName("spine_mid_caps"); mc.visible = false;
    B.left.rotation.z = B.closedAngle; B.strap.rotation.z = 0; closedG = bake(B.group); B.left.rotation.z = 0; B.strap.rotation.z = B.strapOpen; flatG = bake(B.group, B.plate.m.material); rig.add(closedG, flatG);  // the plate faces down when open flat: not drawn then  // the resting poses, one mesh per material
    }
    const cb = new THREE.Box3(); if (heroNew) closedG.traverse(m => { if (m.isSkinnedMesh) { m.skeleton.update(); m.computeBoundingBox(); cb.union(m.boundingBox); } }); else closedG.children.forEach(m => { m.geometry.computeBoundingBox(); cb.union(m.geometry.boundingBox); }); const c0 = cb.getCenter(new THREE.Vector3()), ctr = new THREE.Vector3();
    const key = new THREE.SpotLight(0xffbe88, 95, 0, 0.9, 0.8, 2), rim = new THREE.DirectionalLight(0xffc870, 0.6), pageL = new THREE.PointLight(0xffd9a0, 0, 0, 2), glint = new THREE.PointLight(0xfff0cc, .5, 3, 2), fill = new THREE.HemisphereLight(0x5f78b8, 0x20140c, 0.3);
    key.position.set(-2.2, 3.4, 2.6); rim.position.set(2, 1.4, -3); pageL.position.set(0, 1.2, .1); scene.add(key, key.target, rim, pageL, glint, fill);

    // the wonders: the art builder's atlas pages when present (page 1 with the scene, the others lazily, one at a time, after the first burst has played), else the atlas drawn here
    const A = makeAtlas(THREE, phone ? 1024 : 2048, { defer: true }), R = (() => { let s = 20261114; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), rr = (a, b) => a + (b - a) * R(), shuf = a => a.map(v => [R(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]), pick = a => a[Math.floor(R() * a.length)];
    const cellRect = c => [(c % A.cols) / A.cols, Math.floor(c / A.cols) / A.cols, 1 / A.cols, 1 / A.cols], own = (n, glyph = false, kind = 0) => A.cells[n].map(c => ({ rect: cellRect(c), aspect: 1, flag: 0, glyph, kind }));
    const pages = [null, A.tex, A.tex, A.tex, A.tex], pieces = [], mkTex = im => { if (phone) { const c = document.createElement("canvas"); c.width = im.width >> 1; c.height = im.height >> 1; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); im = c; }  /* phones: half size */ const t = new THREE.Texture(im); t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; t.needsUpdate = true; return t; };
    const addPage = (r, n) => { pages[n] = mkTex(r.im); const W = r.im.width, H = r.im.height; r.j.forEach(s => pieces.push({ rect: [(s.x + .5) / W, (s.y + .5) / H, (s.w - 1) / W, (s.h - 1) / H], aspect: s.w / s.h, flag: n, glyph: false, kind: s.kind, name: s.name })); };
    const ownPieces = () => { A.drawShapes(); ["past", "fantasy", "magic", "creatures", "play", "future", "dreams"].forEach((n, i) => pieces.push(...own(n, false, [1, 2, 3, 4, 5, 6, 7][i]))); };  // the built-in paper-cuts: drawn only when the sprite atlas is late or missing
    const sprites = { settled: false, ok: false };
    const GLY = own("glyphs", true), CONST = own("consts"), STARP = A.cells.stars.map(c => ({ rect: cellRect(c), aspect: 1, flag: 0, glyph: false, kind: 0 })), KB = [[1], [2], [3, 5], [4], [], [6], [7], []];
    const items = [], specks = [], asp0 = (canvas.clientWidth || 1280) / (canvas.clientHeight || 800), nMid0 = asp0 < .8 ? 16 : 30;
    const counts = b => b === 0 ? [asp0 < .8 ? 4 : 6, nMid0, 70, 100] : b === 7 ? [0, 6, 0, 44] : [asp0 < .8 ? 2 : 3, asp0 < .8 ? 17 : 28, 20, 26];  // near, middle, far, deep: the big burst is about 200, each new kind about 60
    const TIER = [{ sz: .26, k: [.6, .75] }, { sz: .09, k: [1, 1.6] }, { sz: .037, k: [2.2, 3.2] }, { sz: .018, k: [3.6, 5] }];  // size as a share of the frame's height: far is a third of the middle, deep only just resolves
    BEATS.forEach((_, b) => {
      const [nN, nM, nF, nD] = counts(b), raw = Array.from({ length: nM }, (_, i) => { const rho = Math.sqrt((i + .5) / nM), th = i * 2.39996; return { x: rho * Math.cos(th), y: rho * Math.sin(th), rho }; }), xs = raw.map(p => p.x), ys = raw.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const pts = raw.map(p => ({ x: lerp(-.9, .9, (p.x - x0) / (x1 - x0 || 1)), y: lerp(.3, 1.4, (p.y - y0) / (y1 - y0 || 1)), rho: p.rho }));  // a golden-angle fan: every middle piece its own direction, evenly spread over the frame above the book
      const mk = (tier, dx, dy, delay, sz) => { const k = rr(...TIER[tier].k); items.push({ b, tier, delay, seed: R(), dx, dy, roll: rr(-.4, .4), spin: rr(-8, 8), k, K: lerp(2.6, 1.8, ease((k - 1.5) / 1.5)), size: sz * rr(.9, 1.1), tr: -1, rect: [0, 0, .01, .01], aspect: 1, flag: 0, glyph: false, kind: 0 }); };
      for (let i = 0; i < nN; i++) mk(0, (i % 2 ? 1 : -1) * rr(.8, .97), rr(.35, 1.1), rr(0, .06), TIER[0].sz * (asp0 < .8 ? .5 : 1));  // near ones pass the frame's edges, never the centre
      pts.forEach(p => mk(1, p.x, p.y, .1 * (1 - p.rho), b === 7 ? .2 : TIER[1].sz * (b ? (asp0 < .8 ? .78 : 1.25) : asp0 < .8 ? .8 : 1)));  // later kinds: middle pieces a third larger
      const fount = () => .12 + 1.2 * (1 - Math.sqrt(1 - R()));  // the far and deep tiers keep pouring out for 1.2 s more, thinning: the explosion's echo
      for (let i = 0; i < nF; i++) mk(2, rr(-1, 1), rr(.15, 1.45), fount(), TIER[2].sz); for (let i = 0; i < nD; i++) mk(3, rr(-1, 1), rr(.15, 1.45), fount(), b === 7 ? .022 : TIER[3].sz);
      for (let s = 0; s < SPECKS[b]; s++) { const a = rr(-55, 55) * rad, r = rr(.15, 1.25); specks.push({ b, delay: rr(0, .12), seed: R(), dx: r * Math.sin(a) * .95, dy: .2 + r * Math.cos(a) * 1.05, k: rr(.8, 3), px: rr(2, 6) }); }
    });
    const EXCL = new Set(["mountain-spirit", "magic-beans", "moon-phases", "northern-lights-as-ribbons", "handful-of-marbles"]), pkey = p => p.rect.join(), nmKeys = [];  // pieces that read as mud at near or middle size
    const poolNM = (b, n) => { if (b === 4) return shuf(GLY).slice(0, n); if (b === 7) return shuf(CONST).slice(0, n); const prev = new Set(nmKeys[b - 1] || []), ok = pieces.filter(p => !EXCL.has(p.name) && !prev.has(pkey(p))), mine = shuf(ok.filter(p => KB[b].includes(p.kind))), rest = shuf(ok.filter(p => !KB[b].includes(p.kind))); return mine.concat(rest).slice(0, n); };  // no shape twice among the near and middle pieces of a beat and the one before it
    const poolFD = b => b === 4 ? GLY.concat(shuf(pieces).slice(0, 24)) : b === 7 ? STARP : pieces;
    const refill = (b, onlyFD) => { if (!pieces.length && b !== 4 && b !== 7) return; const its = items.filter(it => it.b === b), nm = its.filter(i => i.tier < 2), pool = onlyFD ? null : poolNM(b, nm.length), f = poolFD(b); if (pool) { nm.forEach((it, i) => Object.assign(it, pool[i % pool.length])); nmKeys[b] = nm.map(pkey); } if (f.length) its.filter(i => i.tier >= 2).forEach(it => Object.assign(it, pick(f))); };
    BEATS.forEach((_, b) => refill(b));
    const N = items.length, I = (f, z) => Float32Array.from({ length: N * z }, (_, i) => f(items[Math.floor(i / z)], i % z)), g = new THREE.InstancedBufferGeometry(), plane = new THREE.PlaneGeometry(1, 1); g.index = plane.index; g.setAttribute("position", plane.getAttribute("position")); g.instanceCount = N;
    const row = { iA: it => [it.b, it.delay, it.seed, 0], iB: it => [it.dx, it.dy, it.roll, it.spin], iC: it => [it.k, it.size, 0, it.K], iD: it => it.rect, iE: it => [it.aspect, it.flag, it.glyph ? 1 : 0, 0] };
    for (const n in row) g.setAttribute(n, new THREE.InstancedBufferAttribute(I((it, j) => row[n](it)[j], 4), 4));
    const U = { uB: { value: Array.from({ length: 8 }, () => new THREE.Vector4(-1e3, 1, 0, 0)) }, uP: { value: 0 }, uT: { value: 0 }, uSz: { value: 1 }, uBurst: { value: reducedMotion ? 0 : 1 }, uD: { value: 4 }, uD0: { value: 4 }, uFold: { value: new THREE.Vector2() }, uPtr: { value: new THREE.Vector2() }, uE: { value: 0 }, uWait: { value: 0 }, uRec: { value: asp0 < .8 ? .4 : .5 }, uH: { value: 800 }, uAsp: { value: 1.6 }, uDim: { value: 1 }, uMap: { value: A.tex }, uPg1: { value: pages[1] }, uPg2: { value: pages[2] }, uPg3: { value: pages[3] }, uPg4: { value: pages[4] } };
    const writeD = () => { items.forEach((it, i) => { g.attributes.iD.array.set(it.rect, i * 4); g.attributes.iE.array.set([it.aspect, it.flag, it.glyph ? 1 : 0, 0], i * 4); }); g.attributes.iD.needsUpdate = g.attributes.iE.needsUpdate = true; };
    const lazy = { next: 2, busy: false, done: true };  // atlas pages 2, 3, 4 arrive one at a time after the first burst; their pieces are simply used from then on
    const more = () => { lazy.busy = true; loadSprites(lazy.next).then(r => { lazy.busy = false; if (!r) { lazy.done = true; return; } addPage(r, lazy.next); U["uPg" + lazy.next].value = pages[lazy.next]; lazy.next++; if (lazy.next > 4) lazy.done = true; BEATS.forEach((_, b) => { if (!S[b].on) refill(b); }); writeD(); }); };  // a beat already on stage keeps its pieces: nothing pops
    const add2 = (m, ro) => { m.frustumCulled = false; m.renderOrder = ro; scene.add(m); return m; };
    add2(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: U, vertexShader: BVERT, fragmentShader: BFRAG, depthTest: false, depthWrite: false })), -10);  // the night
    add2(new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, ...MAXB() })), 3);
    const T = 6, M = 110, MOTES = 160, pr = [], pa = new THREE.BufferGeometry();  // points: a tail of dust for each near and middle wonder (6), the specks of dust, a few ambient motes
    items.forEach(it => { if (it.tier < 2) { it.tr = pr.length; for (let j = 0; j < T; j++) pr.push([[it.b, it.delay, it.seed, 1], [it.dx, it.dy, .03 * (j + 1), 0], [it.k, 0, 0, it.K]]); } }); specks.forEach(s => pr.push([[s.b, s.delay, s.seed, 0], [s.dx, s.dy, 0, 0], [s.k, s.px, 0, 2.6]])); for (let i = 0; i < M; i++) pr.push([[0, 0, 0, 2], [rr(-1, 1), rr(-1, 1), R(), R()], [1, 0, 0, 0]]);
    for (let i = 0; i < MOTES; i++) pr.push([[0, 0, R(), 3], [rr(9, 22), R(), 0, 0], [R() ** 2.6, 0, 0, 0]]);  // the whole-frame dust: about 8% near and large, most far and fine
    const pn = pr.length; pa.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pn * 3), 3)); ["pA", "pB", "pC"].forEach((n, j) => pa.setAttribute(n, new THREE.BufferAttribute(Float32Array.from({ length: pn * 4 }, (_, i) => pr[Math.floor(i / 4)][j][i % 4]), 4)));
    add2(new THREE.Points(pa, new THREE.ShaderMaterial({ uniforms: U, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, ...MAXB() })), 4);
    // all the light in one mesh: the pillar and standing shaft, the pages' core, the pool under the book, the flash and the ring of the burst
    const GI = { uI: { value: new THREE.Vector3() }, uF: { value: new THREE.Vector4() }, uPil: { value: new THREE.Vector4(1, 1, 0, 0) } }, part = (geo, k, f) => { f(geo); geo.setAttribute("kd", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(k), 1)); return geo; };
    add2(new THREE.Mesh(mergeGeometries([part(new THREE.PlaneGeometry(1.7, 3.4), 0, q => q.translate(0, 1.72, 0)), part(new THREE.PlaneGeometry(2.1, 1.35), 1, q => q.rotateX(-Math.PI / 2).translate(0, .004, 0)), part(new THREE.PlaneGeometry(5, 3.6), 2, q => q.rotateX(-Math.PI / 2).translate(0, -.2, 0)), part(new THREE.PlaneGeometry(2, 2), 3, () => {}), part(new THREE.PlaneGeometry(2, 2), 4, q => q.rotateX(-Math.PI / 2).translate(0, .008, 0)), part(new THREE.PlaneGeometry(2, 1.33), 5, q => q.rotateX(-Math.PI / 2).translate(0, .007, 0))]),
      new THREE.ShaderMaterial({ uniforms: GI, vertexShader: GVERT, fragmentShader: GFRAG, transparent: true, depthWrite: false, ...MAXB(), polygonOffset: true, polygonOffsetFactor: -2 })), 2);

    // no piece rests on another: at the hang the boxes are pushed apart (given the screen's own shape) until none overlaps by more than about a twentieth, and kept in the frame above the book
    let laid = 0; const bx = it => { const h = 2 * it.size * U.uSz.value * .85; return [h * it.aspect / aspect / 2, h / 2]; };
    const relax = () => {  // near and middle pieces: none overlaps another (nor the receded pieces of the kind before), none sits in the centre column (the page's headline), near ones keep to the edges; any that cannot fit is dropped
      laid = aspect; const fy = U.uFold.value.y, ZONE = .24, bxk = (it, k) => { const [w, h] = bx(it); return [w * k, h * k]; };
      for (let b = 0; b < 8; b++) {
        const L = items.filter(it => it.b === b && it.tier < 2); if (!L.length) continue; L.forEach(it => { it.size0 ??= it.size; it.size = it.size0; });
        const O = items.filter(it => (it.b === b - 1 || (b === 7 && it.b === 5)) && it.tier < 2 && it.size > 0), okOf = o => b === 7 && o.b === 6 ? 1 : U.uRec.value;  // the kind before is on stage at the same time, receded to .35 (the constellations come on top of the last kind, full size)
        const lim = it => { const [w, h] = bx(it); it.dx = cl(it.dx, -(.97 - w), .97 - w); it.dy = cl(it.dy, .22 + h * .6, .96 - h - fy); if (Math.abs(it.dx) < ZONE + w) it.dx = (it.dx < 0 || (it.dx === 0 && it.seed < .5) ? -1 : 1) * Math.min(ZONE + w, .97 - w); if (it.tier === 0) it.dx = Math.sign(it.dx) * Math.max(Math.abs(it.dx), .8 - w * .5); };
        const push = (a, c, aw, ah, cw, ch, both) => { const ox = aw + cw - Math.abs(a.dx - c.dx), oy = ah + ch - Math.abs(a.dy - c.dy); if (ox > -.01 && oy > -.01) { const f = both ? .5 : 1; if (ox / (aw + cw) < oy / (ah + ch)) { const p = (ox + .01) * f * Math.sign(a.dx - c.dx || (a.seed - c.seed)); a.dx += p; if (both) c.dx -= p; } else { const p = (oy + .01) * f * Math.sign(a.dy - c.dy || (a.seed - c.seed)); a.dy += p; if (both) c.dy -= p; } return true; } return false; };
        for (let n = 0; n < 300; n++) { let moved = false;
          for (let i = 0; i < L.length; i++) { for (let j = i + 1; j < L.length; j++) { const [aw, ah] = bx(L[i]), [cw, ch] = bx(L[j]); moved = push(L[i], L[j], aw, ah, cw, ch, true) || moved; }
            for (const o of O) { const [aw, ah] = bx(L[i]), [cw, ch] = bxk(o, okOf(o)); moved = push(L[i], o, aw, ah, cw, ch, false) || moved; } }
          L.forEach(lim); if (!moved) break; }
        const hit = (a, c, k) => { const [aw, ah] = bx(a), [cw, ch] = bxk(c, k); return aw + cw - Math.abs(a.dx - c.dx) > 0 && ah + ch - Math.abs(a.dy - c.dy) > 0; };
        for (let i = 0; i < L.length; i++) { for (let j = i + 1; j < L.length; j++) if (L[i].size && L[j].size && hit(L[i], L[j], 1)) { const [aw, ah] = bx(L[i]), [cw, ch] = bx(L[j]); (aw * ah < cw * ch ? L[i] : L[j]).size = 0; } if (L[i].size) for (const o of O) if (hit(L[i], o, okOf(o))) L[i].size = 0; }  // no room for it: dropped
      }
      items.forEach((it, i) => { g.attributes.iB.array[i * 4] = it.dx; g.attributes.iB.array[i * 4 + 1] = it.dy; g.attributes.iC.array[i * 4 + 1] = it.size; if (it.tr >= 0) for (let j = 0; j < T; j++) { pa.attributes.pB.array[(it.tr + j) * 4] = it.dx; pa.attributes.pB.array[(it.tr + j) * 4 + 1] = it.dy; } }); g.attributes.iB.needsUpdate = g.attributes.iC.needsUpdate = true; pa.attributes.pB.needsUpdate = true;
    };

    // time: each beat plays in real time from the moment p crosses its threshold; going back up, it falls back into the book in half a second
    let waitT = null, P = 0, tgt = 0, pt = [0, 0], pc = [0, 0], W = 1, H = 1, aspect = 1.6, raf = 0, lastT = -1, lastNow = 0, dirty = true, alive = true, lastFire = -1e3, clk = null, busy = true; const fold = new THREE.Vector3();
    const S = Array.from({ length: 8 }, () => ({ on: false, t0: -1e3, rev: 1, star: 0, rec: 0 }));
    const tick = (t, dt) => {  // -> true while anything is still moving
      const kc = THR.filter(v => P >= v).length - 1; let moving = false, fresh = false;
      S.forEach((s, i) => {
        if (i <= kc && !s.on && pieces.length) { s.on = true; if (reducedMotion) s.t0 = t - 100; else if (i === kc && t - lastFire >= .8) { s.t0 = t + (i === 0 ? .45 : 0); lastFire = t; s.rev = 0; fresh = true; } else { s.t0 = t - 100; } }  // the big one breathes in for .45 s; a beat too soon after another (or skipped by a fast scroll) just fades in already hanging
        if (i > kc && s.on) s.on = false;
        const rate = 1 / .5, want = s.on ? 0 : 1, kcw = Math.min(kc, 6), st = i < kcw - 1 ? 1 : 0, rc = i === kcw - 1 && i < 7 ? 1 : 0, mv = (v, to, r) => v + Math.sign(to - v) * Math.min(Math.abs(to - v), dt * r);  // the kind before the current one recedes; the one before that is stars
        if (reducedMotion) { s.rev = want; s.star = st; s.rec = rc; } else { s.rev = mv(s.rev, want, rate); s.star = mv(s.star, st, 1 / 1.2); s.rec = mv(s.rec, rc, 1 / 1.2); }  // reduced motion: everything is there at once, still
        if (s.rev !== want || s.star !== st || s.rec !== rc || (s.on && t - s.t0 < 9)) moving = true;
        U.uB.value[i].set(t - s.t0, s.rev, s.star, s.rec);
      }); return moving;
    };
    const cr = new THREE.Vector3();
    const place = (p, t) => {
      if (p >= .2 && !pieces.length) { waitT ??= t; if ((sprites.settled && !sprites.ok) || t - waitT >= 8) { ownPieces(); BEATS.forEach((_, b) => refill(b)); writeD(); } } else if (pieces.length) waitT = null;  // the atlas is late: the book waits, breathing, and the burst fires the moment it is in (after 8 s the built-in shapes are drawn in full instead)
      const e1 = ease((p - .08) / .09), e2 = ease((p - COVER_AT) / .08), tt = cl((aspect - .7) / 1.2), x = cl((p - .2) / .03, 0, 9), settle = p > .2 ? .03 * Math.exp(-5 * x) * Math.abs(Math.sin(11 * x)) : 0, calm = reducedMotion ? 0 : 1, st = p < .09 ? 0 : p < .25 ? 1 : 2;
      const age0 = U.uB.value[0].x, k0 = calm * (age0 >= 0 && age0 < 9 && S[0].on ? Math.exp(-age0 * 2.6) * (1 - Math.exp(-age0 * 30)) : 0), waiting = p >= .2 && !pieces.length, breath = waiting ? (calm ? .7 + .17 * Math.sin(t * 2.4) + .13 * Math.sin(t * 3.7 + 1) : .8) : calm * (age0 < 0 && age0 > -.45 && S[0].on ? ease(1 + age0 / .45) : 0);  // the kick after the detonation; the held breath before it
      const dC = Math.max((heroNew ? .68 : .65) / (lerp(.7, .5, tt) * tV * aspect), .675 / (.6 * tV)), dO = Math.max((heroNew ? 1.33 : 1.15) / (lerp(.92, .58, tt) * tV * aspect), .45 / (.3 * tV)), D = lerp(dC, dO, e1) * (1 + .04 * k0 - .03 * breath), ele = lerp(60, 22, e1) * rad;
      if (heroNew) { mixer.setTime(Math.min(.9999, p < COVER_AT ? .1 * cl((p - .095) / (COVER_AT - .095)) : .1 + .9 * cl((p - COVER_AT) / .08))); closedG.position.x = -c0.x * (1 - e2); }  // the clasp unlatches up to COVER_AT, then the cover opens over the same stretch of scroll as before
      else {
      closedG.visible = st === 0; B.group.visible = st === 1; flatG.visible = st === 2; closedG.position.x = -.5; B.group.position.x = -.5 * (1 - e2);
      if (st === 1) { B.left.rotation.z = B.closedAngle * (1 - e2) - settle; B.strap.rotation.z = B.strapOpen * ease((p - .095) / .035); }
      }
      rig.rotation.set(-pc[1] * .05, lerp(-.1, 0, e1) + pc[0] * .1 + Math.sin(t * .3) * .02 * calm, 0); rig.position.y = Math.sin(t * .9) * .006 * calm - .02 * breath * .3; rig.scale.setScalar(1 - .015 * calm * (age0 >= 0 && age0 < 2 && S[0].on ? Math.exp(-age0 * 5) * Math.cos(age0 * 9) : 0)); rig.updateMatrixWorld(true);  // the book dips as it breathes in, recoils and springs back
      cam.position.set(pc[0] * .12 * D / 4, Math.sin(ele) * D + pc[1] * .05, Math.cos(ele) * D); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      let cx = 0, cy = 0; if (e1 < 1) { cr.copy(c0); closedG.localToWorld(cr).project(cam); cx = cr.x; cy = cr.y - (aspect < 1 ? -.1 : 0); }  // the closed book is centred on the frame (a little low on a phone), wherever its box sits
      cam.projectionMatrix.elements[8] += lerp(cx, 0, e1); cam.projectionMatrix.elements[9] += lerp(cy, .52, e1) - .03 * k0; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();  // the book sinks to the lower frame; the camera tips up a little at the kick
      fold.set(0, .1, 0).applyMatrix4(cam.matrixWorldInverse); U.uD0.value = -fold.z; fold.applyMatrix4(cam.projectionMatrix); U.uFold.value.set(fold.x, fold.y);
      const op = cl((p - .13) / .09), gl = ease(op) * (.55 + .3 * ease((p - .9) / .1)) + .05 * Math.sin(t * 1.1) * calm * ease(op), live = S.map((s, i) => [U.uB.value[i].x, i ? .4 : 1]).filter(([a]) => a >= 0 && a < 1), last = live.length ? live.reduce((m, v) => v[0] < m[0] ? v : m) : [9, 0];
      const fa = last[0], fs = last[1] * calm, flash = fa < .4 ? .62 * fs * Math.exp(-fa / .12) * (1 - Math.exp(-fa * 60)) : 0, ex = a => 1 - Math.pow(2, -10 * cl(a));  // ease-out-expo
      GI.uF.value.set(flash, 4.5 * ex(fa / .35) * fs, 6 * ex(fa / .5) * fs + .01, fa < .6 ? .7 * fs * (1 - fa / .6) : 0);
      GI.uPil.value.set(lerp(.05, 1, ex(fa / .18)), lerp(1, .5, ease(fa / 1.6)) * (1 + .5 * fs * Math.exp(-fa * 5)), breath, 0);
      const pg = calm ? (S[0].on && age0 >= 0 ? ease(age0 / 1.5) : 0) : (S[0].on ? 1 : 0); B.materials.paper.color.setRGB(paper0.r * (1 - .42 * pg), paper0.g * (1 - .42 * pg) * (1 - .04 * pg), paper0.b * (1 - .42 * pg) * (1 - .12 * pg));  // after the burst the pages ease down, warm, so the wonders lead
      GI.uPil.value.w = heroNew ? 0 : pg; pageL.intensity = 1.0 * gl * (1 + breath * .4) * (1 - .4 * pg); GI.uI.value.set(gl * (1 + .08 * Math.sin(t * .9) * calm) * (.7 + 1.3 * fs * Math.exp(-fa * 3.5)) * (1 - .5 * breath), (ease((p - .15) / .07) * .2 + .03 * Math.sin(t * 1.3) * calm * ease((p - .15) / .07)) * (1 - .4 * pg), .14 + .03 * Math.sin(t * .8) * calm + .3 * gl);
      U.uDim.value = 1 - .33 * breath;
      key.position.x = -2.2 + pc[0] * .8; glint.position.set(lerp(-.2, .7, (t * .06) % 1) * (1 - e2) + (-1.6 + 3.2 * ((t * .05) % 1)) * e2, lerp(.9, .7, e2), lerp(.35, .55, e2));  // a glint travels along the tooling
      U.uP.value = p; U.uT.value = t; U.uD.value = D; U.uSz.value = cl(aspect / 1.3, .6, 1) ** .7; U.uPtr.value.set(pc[0], pc[1]); U.uAsp.value = aspect;
      if (p >= .17 && laid !== aspect) relax();  // once the book lies open, where the fold sits on this screen is known
      U.uWait.value = waiting ? calm : 0; if (waiting) { GI.uI.value.x *= .6 + (.22 * Math.sin(t * 2.4) + .18 * Math.sin(t * 3.7 + 1)) * calm; GI.uF.value.x = calm ? .1 * (.5 + .28 * Math.sin(t * 2.4) + .22 * Math.sin(t * 3.7 + 1)) + .4 * ((t * .43) % 1) ** 2 : .15; /* the swell restarts every 2.3 s, so a picture never repeats a second later */ GI.uF.value.y = 3.2; }  // while the art is on its way: the seam breathes, the pillar and a soft glow pulse (steady in reduced motion)
      U.uE.value = (waiting ? .9 : p < .2 ? lerp(.22, .5, ease((p - .1) / .1)) : .4) * (p > .92 ? lerp(1, 1.4, ease((p - .92) / .08)) : 1);
    };
    const render = (t, dt = 0) => { busy = tick(t, dt); place(P, t); renderer.render(scene, cam); dirty = false; lastT = t; };
    const frame = now => {
      raf = 0; if (!alive || document.hidden) return; const t = reducedMotion ? 0 : clock(), dtc = clk === null ? 0 : Math.max(0, t - clk), rdt = Math.min(.1, (now - lastNow) / 1000 || .016); lastNow = now;
      const goal = reducedMotion && !pieces.length && !sprites.settled ? Math.min(tgt, .19) : tgt;  // reduced motion waits for the wonders' atlas before showing the beats, so they never appear blank
      if (P !== goal) { P = goal; dirty = true; }  // the pose is a pure function of p, in reduced motion too: no easing in time  // reduced motion: the same pictures, a slow fade between them
      for (const i of [0, 1]) if (pc[i] !== pt[i]) { pc[i] += reducedMotion ? pt[i] - pc[i] : (pt[i] - pc[i]) * (1 - Math.exp(-rdt * 6)); Math.abs(pt[i] - pc[i]) < 1e-3 ? (pc[i] = pt[i]) : 0; dirty = true; }
      if (!reducedMotion && !lazy.done && !lazy.busy && S[0].on && t - S[0].t0 > 4) more();
      const dt = reducedMotion ? rdt : dtc; if (dirty || busy || (!reducedMotion && t - lastT >= 1 / 30 - 1e-6)) { render(t, dt); clk = t; }  // idle life alone costs 30 frames a second, not 60
      if (!reducedMotion || dirty || busy || P !== goal) kick();
    };
    const kick = () => { if (!raf && alive && !document.hidden) raf = requestAnimationFrame(frame); };
    const vis = () => { dirty = true; kick(); }; document.addEventListener("visibilitychange", vis);
    const resize = () => { W = canvas.clientWidth || 1280; H = canvas.clientHeight || 800; aspect = W / H; renderer.setSize(W, H, false); cam.aspect = aspect; U.uH.value = H * renderer.getPixelRatio(); dirty = true; kick(); };
    resize(); await renderer.compileAsync(scene, cam).catch(() => {}); clk = reducedMotion ? 0 : clock(); render(clk); kick();
    loadSprites(1).then(r => { sprites.settled = true; if (r && alive) { sprites.ok = true; pieces.length = 0; addPage(r, 1); U.uPg1.value = pages[1]; lazy.done = false; BEATS.forEach((_, b) => { if (!S[b].on) refill(b); }); writeD(); } dirty = true; kick(); });  // after the first frame; a beat already on stage keeps its pieces, so nothing pops
    // debug.bench(n): GPU-synchronised ms per frame with and without the whole-frame dust (the last MOTES points), three rounds each, median
    const bench = (n = 40) => { const gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px), run = () => { sync(); const t = performance.now(); for (let i = 0; i < n; i++) renderer.render(scene, cam); sync(); return (performance.now() - t) / n; }, a = [], b = []; for (let r = 0; r < 3; r++) { pa.setDrawRange(0, pn); a.push(run()); pa.setDrawRange(0, pn - MOTES); b.push(run()); } pa.setDrawRange(0, pn); const m = v => v.sort((x, y) => x - y)[1]; return { withMs: +m(a).toFixed(2), withoutMs: +m(b).toFixed(2), extraMs: +(m(a) - m(b)).toFixed(2), motes: MOTES, points: pn }; };
    // debug.probe(ages, T0): the on-screen speed (CSS px/s) of every wonder at each age (s since its own launch), read back from the GPU by running the SAME place() in a one-pixel-per-piece pass into a float target, so the shader is measured, not re-implemented. Call after progress(>=.2) has rendered once.
    let rig2; const probe = (ages, T0 = 0, dt = .05) => {
      const w = 256, h = Math.ceil(N / w);
      rig2 ??= (() => { const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }), uAge = { value: 0 }, sc = new THREE.Scene(), mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...U, uAge }, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
        vertexShader: `attribute vec4 iA, iB, iC; varying vec2 vP; ${COMMON} uniform float uAge; void main() { vec3 vel; vec3 P = place( vec4( uAge + iA.y, 0., 0., 0. ), iA.y, iA.z, iB.xy, iC.x, 0., iC.w, vel ); vec4 c = projectionMatrix * vec4( P, 1. ); vP = c.xy / c.w; vec2 px = vec2( float( gl_InstanceID % ${w} ), float( gl_InstanceID / ${w} ) ); gl_Position = vec4( ( px + .5 + position.xy * .9 ) / vec2( ${w}., ${h}. ) * 2. - 1., 0., 1. ); }`,
        fragmentShader: "varying vec2 vP; void main() { gl_FragColor = vec4( vP, 1., 1. ); }" })); mesh.frustumCulled = false; sc.add(mesh); return { rt, uAge, sc, buf: new Float32Array(w * h * 4) }; })();
      const { rt, uAge, sc, buf } = rig2, t0 = U.uT.value, at = (age) => { uAge.value = age; U.uT.value = T0 + age; renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); return Float32Array.from(buf); };
      const keep = items.map((it, i) => it.b === 0 && it.size > 0 ? i : -1).filter(i => i >= 0);
      try { return { W, H, tier: keep.map(i => items[i].tier), rows: ages.map(a => { const lo = Math.max(a - dt, 0), hi = a + dt, A = at(lo), B = at(hi); return { age: a, speed: keep.map(i => { const j = i * 4; return Math.hypot((B[j] - A[j]) * W / 2, (B[j + 1] - A[j + 1]) * H / 2) / (hi - lo); }), valid: keep.every(i => B[i * 4 + 2] === 1) }; }) }; }
      finally { renderer.setRenderTarget(null); U.uT.value = t0; }
    };
    return {
      progress(p) { tgt = cl(+p || 0); if (tgt !== P) kick(); }, pointer(x, y) { pt = [cl(+x || 0, -1, 1), cl(+y || 0, -1, 1)]; kick(); }, resize,
      debug: { probe, bench, audit: () => { const on = items.filter(it => it.b === 0 && U.uB.value[0].x - it.delay >= 0 && U.uB.value[0].z < .5 && U.uB.value[0].y < .5); return { b0Live: on.length, b0NearMid: on.filter(it => it.tier < 2 && it.size > 0).length, glyphCellsInB0: on.filter(it => it.glyph).length, wrongAtlas: items.filter(it => it.flag > 0 && pages[it.flag] === A.tex).length, ownCellsInB0: on.filter(it => it.flag === 0).length, pieces: pieces.length }; }, state: S, bookBox: () => { rig.updateMatrixWorld(true); cam.updateMatrixWorld(); const xs = [], ys = []; for (const x of [cb.min.x, cb.max.x]) for (const y of [cb.min.y, cb.max.y]) for (const z of [cb.min.z, cb.max.z]) { const v = closedG.localToWorld(new THREE.Vector3(x, y, z)).project(cam); xs.push((v.x + 1) / 2); ys.push((1 - v.y) / 2); } return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }, tiers: () => { const c = [0, 0, 0, 0]; items.forEach(it => { const a = U.uB.value[it.b].x - it.delay; if (it.b === 0 && a >= 0 && U.uB.value[0].z < .5) c[it.tier]++; }); return c; }, liveNM: () => items.filter(it => it.tier < 2 && it.size > 0 && U.uB.value[it.b].x - it.delay >= 0 && U.uB.value[it.b].z < .5 && U.uB.value[it.b].y < .5).length, layoutLive: () => items.filter(it => it.tier < 2 && it.size > 0 && U.uB.value[it.b].x - it.delay >= 0 && U.uB.value[it.b].z < .5 && U.uB.value[it.b].y < .5).map(it => { const k = 1 - (1 - U.uRec.value) * U.uB.value[it.b].w, [hw, hh] = bx(it); return { b: it.b, tier: it.tier, x: it.dx + U.uFold.value.x, y: it.dy + U.uFold.value.y, hw: hw * k, hh: hh * k }; }), live: () => items.filter(it => U.uB.value[it.b].x - it.delay >= 0 && U.uB.value[it.b].z < .5 && U.uB.value[it.b].y < .5).length, items: N, layout: () => items.map(it => { const [hw, hh] = bx(it); return { b: it.b, tier: it.tier, star: false, x: it.dx + U.uFold.value.x, y: it.dy + U.uFold.value.y, hw, hh, k: it.k }; }), mats: B.materials, atlas: A.canvas, renderer, scene, cam, P: () => P, render, state: S, usedExternalSprites: sprites.ok },
      dispose() {
        alive = false; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", vis);
        scene.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); } }); scene.environment.dispose(); A.tex.dispose(); pages.forEach(t => t?.dispose()); renderer.dispose();
      },
    };
  } catch (e) { console.warn("epic scene: no WebGL scene, drawing the still instead:", e.message); try { THREE.DefaultLoadingManager.setURLModifier(undefined); renderer.dispose(); renderer.forceContextLoss?.(); } catch {} return standIn(canvas); }
}
