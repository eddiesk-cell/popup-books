// paperblend.js — T7 Part B (Eddie, 2026-11-24; Round 3 brightness & colour recovery):
// "The lighting is correct, but if everything looks dull, we adjust to make it brighter."
// Shared viewer pass for every book (no per-book hand tuning):
//   1. Tones bright cream paper rims ([0..8, 0..8] atlas patch & un-merged card-edge) and suppresses 1-2 px white
//      alpha-matte cutout halos so paper edges keep a tactile look without white sticker glow.
//   2. Shifts flat white RoomEnvironment energy into the real directional stage lights on day spreads (conserving total
//      frame brightness and boosting sunlit colourfulness while letting props and puppets take crisp shadows), and scales
//      scene.environmentIntensity with live light cues (midnight, isolation spot).
//   3. Adds hue-preserving upward page-bounce diffuse, soft vertical base AO at the floor crease, gentle depth harmony,
//      and soft-knee settling ONLY on extreme neon cutout saturation while preserving golden night glow (Mali) and vivid
//      mid-tone colours across every spread.
import * as THREE from "three";

const ATMO_RE = /(mist|fog|haze|glow|ray|steam|smoke|cloud|sky|water|river|pond|stream|ripple|wave)/i;
const FLOOR_NAME_RE = /^(page-|leaf-page|words)/i;
const _col = new THREE.Color(), _tmp = new THREE.Color();

function patchMaterial(mat, mode, shared) {
  if (!mat || !mat.isMeshStandardMaterial || mat.userData._pbPatched || mat.userData.selflit) return;
  if (mat.emissive?.getHex() && mat.emissiveIntensity >= 0.4) return;  // glowing flames/lamps stay self-lit
  mat.userData._pbPatched = mode;
  const img = mat.map?.image;
  const isAtlas = /^card-atlas/.test(mat.name || "") || (!!img && img.width >= 128 && img.height >= 128 && /^art-/.test(mat.name || ""));
  const atlasW = isAtlas && img ? img.width : 0, atlasH = isAtlas && img ? img.height : 0;
  const texW = img?.width || 0, texH = img?.height || 0;
  const hasCutout = (mode === "card" || mode === "puppet") && !!mat.map && (mat.alphaTest > 0 || mat.transparent) && texW > 0 && texH > 0;
  const uLocal = {
    uPBAtlas: { value: new THREE.Vector2(atlasW, atlasH) },
    uPBTexel: { value: new THREE.Vector2(hasCutout ? 2.0 / texW : 0, hasCutout ? 2.0 / texH : 0) },
    uPBMode: { value: mode === "card" ? 1.0 : mode === "puppet" ? 2.0 : 3.0 },  // 1=card, 2=puppet, 3=3d
    uPBDesat: { value: mode === "card" ? 0.28 : mode === "puppet" ? 0.16 : 0.24 },
    uPBBaseAO: { value: mode === "card" ? 0.78 : mode === "puppet" ? 0.78 : 0.86 },
    uPBBounceGain: { value: mode === "card" ? 1.08 : mode === "puppet" ? 0.68 : 0.88 },
    uPBHazeGain: { value: mode === "card" ? 0.085 : mode === "puppet" ? 0.040 : 0.050 },
  };
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => `${prevKey ? prevKey.call(mat) : ""}|pb3_${mode}_${atlasW > 0 ? 1 : 0}_${hasCutout ? 1 : 0}`;
  mat.onBeforeCompile = (sh, renderer) => {
    prevCompile?.call(mat, sh, renderer);
    Object.assign(sh.uniforms, shared, uLocal);
    sh.vertexShader = sh.vertexShader
      .replace("void main() {", "varying vec3 vPBWorld;\nvarying vec3 vPBWNormal;\nvoid main() {")
      .replace("#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vPBWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vPBWNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {",
        `varying vec3 vPBWorld;
        varying vec3 vPBWNormal;
        uniform float uPBOn, uPBFloorY, uPBMode, uPBDesat, uPBBaseAO, uPBBounceGain, uPBHazeGain, uPBMistAmt, uPBNightDesat, uPBDayMask, uPBVibrance;
        uniform vec2 uPBAtlas, uPBTexel;
        uniform vec3 uPBRimTint, uPBHaloScale, uPBSceneTint, uPBBounce, uPBMistCol;
        void main() {`)
      .replace("#include <map_fragment>",
        `#include <map_fragment>
        #ifdef USE_MAP
        if (uPBOn > 0.5) {
          float pbStanding = uPBMode > 1.5 ? 1.0 : (1.0 - smoothstep(0.65, 0.88, abs(vPBWNormal.y)));
          // 1. Tone glb_paper.py's [0..8, 0..8] bright cream paper rim patch to warm muted scene paper
          if (uPBAtlas.x > 0.0 && vMapUv.x < 9.5 / uPBAtlas.x && vMapUv.y < 9.5 / uPBAtlas.y) {
            diffuseColor.rgb *= uPBRimTint;
          } else if (uPBTexel.x > 0.0 && pbStanding > 0.05) {
            // 2. Suppress glaring white/cream alpha-matte fringe at 1-2 texel cutout boundaries (spares interior & coloured edges)
            float aMin = min(
              min(texture2D(map, vMapUv + vec2(uPBTexel.x, 0.0)).a, texture2D(map, vMapUv - vec2(uPBTexel.x, 0.0)).a),
              min(texture2D(map, vMapUv + vec2(0.0, uPBTexel.y)).a, texture2D(map, vMapUv - vec2(0.0, uPBTexel.y)).a)
            );
            float nearEdge = max(smoothstep(0.94, 0.45, aMin), smoothstep(0.96, 0.50, diffuseColor.a));
            float lumE = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            float mxE = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
            float mnE = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
            float satE = mxE > 0.005 ? (mxE - mnE) / mxE : 0.0;
            float halo = nearEdge * smoothstep(0.11, 0.28, lumE) * (1.0 - smoothstep(0.24, 0.54, satE)) * pbStanding;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uPBHaloScale, halo);
          }
          // 3. Soft-knee chroma settling ONLY on extreme neon cutout saturation on day spreads + vibrance recovery on muted tones
          if (pbStanding > 0.05) {
            float lumA = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
            float mxA = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
            float mnA = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
            float satA = mxA > 0.005 ? (mxA - mnA) / mxA : 0.0;
            // Settle ONLY bright overly vivid neon cutouts (never desaturate dark wood/lacquer or rich gold/red!)
            float brightSat = smoothstep(0.025, 0.09, lumA);
            float kSat = clamp(uPBDesat * uPBDayMask * brightSat * smoothstep(0.48, 0.88, satA) + uPBNightDesat * smoothstep(0.14, 0.55, satA), 0.0, 0.62) * pbStanding;
            // Gentle vibrance recovery on low/mid saturation so stone, wood, gold, and clothes stay rich and lively
            float vib = uPBVibrance * (1.0 - smoothstep(0.34, 0.76, satA)) * smoothstep(0.008, 0.045, lumA) * pbStanding;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lumA), kSat - vib);
            diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
            diffuseColor.rgb *= mix(vec3(1.0), uPBSceneTint, pbStanding);
          }
        }
        #endif`)
      .replace("#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        if (uPBOn > 0.5) {
          float pbStand = uPBMode > 1.5 ? 1.0 : (1.0 - smoothstep(0.65, 0.88, abs(vPBWNormal.y)));
          // 4. Hue-preserving upward page-bounce diffuse from live stage lights (smoothly zero on pitch-black shadows/doorways so darks never posterize grey!)
          float mxH = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
          float darkMask = smoothstep(0.008, 0.075, mxH);
          vec3 ownHue = diffuseColor.rgb / max(mxH, 0.008);
          vec3 liftTint = mix(vec3(1.0), ownHue, 0.92) * darkMask;
          reflectedLight.indirectDiffuse += (diffuseColor.rgb * uPBBounceGain + liftTint * uPBHazeGain * uPBDayMask) * uPBBounce * pbStand;
          // 5. Soft vertical ambient occlusion at the base crease where standing prop meets the floor
          float hFloor = max(0.0, vPBWorld.y - uPBFloorY);
          float baseAO = mix(mix(0.92, uPBBaseAO, uPBDayMask), 1.0, smoothstep(0.0, 0.042, hFloor));
          float aoMix = mix(1.0, baseAO, pbStand);
          reflectedLight.directDiffuse *= aoMix;
          reflectedLight.indirectDiffuse *= aoMix;
          // 6. Subtle depth mist harmonization on day spreads only (night spreads like Mali keep full rich glow)
          float depthK = clamp((-vPBWorld.z + 0.15) * 0.55, 0.0, 1.0) * uPBMistAmt * uPBDayMask * pbStand;
          reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, uPBMistCol, depthK);
        }`);
  };
  mat.needsUpdate = true;
}

function directLightsOf(sp) {
  const out = [];
  sp.stage?.traverse(o => { if (o.isDirectionalLight || o.isPointLight) out.push(o); });
  return out;
}

function measureDirect(lights, outColor) {
  let sumI = 0, r = 0, g = 0, b = 0;
  for (const l of lights) {
    const w = Math.max(0, l.intensity || 0);
    sumI += w;
    r += l.color.r * w; g += l.color.g * w; b += l.color.b * w;
  }
  if (sumI > 1e-4) outColor.setRGB(r / sumI, g / sumI, b / sumI);
  else outColor.setRGB(1, 1, 1);
  return sumI;
}

export function attachPaperBlend(sp, root, mode) {
  const pb = sp?.paperBlend;
  if (!pb || !root) return;
  root.traverse(o => {
    if (!o.isMesh || o.userData?.contactShadow || FLOOR_NAME_RE.test(o.name)) return;
    const mats = [].concat(o.material).filter(Boolean);
    for (const m of mats) {
      if (m.name === "card-edge") {
        if (!m.userData._pbEdgeToned) {
          m.userData._pbEdgeToned = true;
          m.userData._pbOrigColor = m.color.clone();
          m.color.multiplyScalar(pb.nativeStage === "night" ? 0.72 : 0.36);
          pb.edgeMats.push(m);
        }
        continue;
      }
      patchMaterial(m, mode, pb.u);
    }
  });
}

export function buildPaperBlend(sp, scene) {
  const nativeStage = sp.m?.stage?.name || "day";
  const isNight = nativeStage === "night";
  const floorY = sp.flat ? sp.flat.max.y : 0;
  const lights = directLightsOf(sp);
  // Conservation of light energy on day spreads: we lower flat white RoomEnvironment (0.30 -> 0.16) so shadows &
  // directional light shape every prop, and return that energy to the stage's directional lights (+16%) so the whole
  // spread stays just as bright and even more vibrant than before! Native night spreads (Mali) keep exact original lights.
  const lightBoost = isNight ? 1.0 : 1.15;
  const origLightI = new Map();
  for (const l of lights) {
    origLightI.set(l, l.intensity);
    if (lightBoost !== 1.0) l.intensity *= lightBoost;
  }
  const baseCol = new THREE.Color();
  const baseDirect = Math.max(0.1, measureDirect(lights, baseCol));
  const fogAmt = 0.0;  // keep real Three.js scene.fog; never wash props with extra grey mist overlay

  const u = {
    uPBOn: { value: 1.0 },
    uPBFloorY: { value: floorY },
    uPBDayMask: { value: isNight ? 0.0 : 1.0 },
    uPBVibrance: { value: isNight ? 0.0 : 0.24 },
    uPBRimTint: { value: new THREE.Vector3(isNight ? 0.62 : 0.30, isNight ? 0.58 : 0.28, isNight ? 0.52 : 0.25) },
    uPBHaloScale: { value: new THREE.Vector3(0.28, 0.26, 0.24) },
    uPBSceneTint: { value: new THREE.Vector3(1, 1, 1) },
    uPBBounce: { value: new THREE.Vector3(0, 0, 0) },
    uPBMistCol: { value: new THREE.Vector3(0.12, 0.12, 0.11) },
    uPBMistAmt: { value: fogAmt },
    uPBNightDesat: { value: 0.0 },
  };
  const pb = sp.paperBlend = {
    enabled: true,
    nativeStage, isNight, lights, origLightI, lightBoost, baseDirect,
    envBase: isNight ? 0.30 : 0.16,  // native night (Mali) keeps exact 0.30 baseline; day shifts 0.14 into real sunlight!
    u,
    edgeMats: [],
    patchedExtras: new WeakSet(),
  };

  // Patch standing cards & merged static paper sheets (skip selflit, backdrop skies, atmospheric soft cards, flat floor)
  const softSet = new Set(sp.m?.soft ?? []);
  const skipNames = new Set([
    ...(sp.m?.selflit ?? []),
    ...(sp.m?.backdrop ?? []),
    ...[...softSet].filter(n => ATMO_RE.test(n)),
  ]);
  const box = new THREE.Box3(), sz = new THREE.Vector3();
  const skipObj = o => {
    for (let p = o; p && p !== sp.root; p = p.parent) if (skipNames.has(p.name)) return true;
    return false;
  };
  sp.root.updateMatrixWorld(true);
  sp.root.traverse(o => {
    if (!o.isMesh || o.userData?.contactShadow || FLOOR_NAME_RE.test(o.name) || skipObj(o)) return;
    const mats = [].concat(o.material).filter(Boolean);
    const isMerged = /^paper-static/.test(o.name) || mats.some(m => /^card-atlas/.test(m.name || ""));
    if (!isMerged) {
      box.setFromObject(o).getSize(sz);
      if (sz.y < 0.006) return;  // flat floor card
    }
    for (const m of mats) {
      if (m.name === "card-edge") {
        if (!m.userData._pbEdgeToned) {
          m.userData._pbEdgeToned = true;
          m.userData._pbOrigColor = m.color.clone();
          m.color.multiplyScalar(isNight ? 0.72 : 0.36);
          pb.edgeMats.push(m);
        }
        continue;
      }
      if (/^(art|back|card-atlas)/.test(m.name || "")) patchMaterial(m, "card", u);
    }
  });

  // Patch cast puppets & 3D cast/props
  for (const ch of sp.cast ?? []) {
    if (ch.c?.candle || ch.c?.bob) continue;
    const mode = ch.c?.model?.startsWith("puppet:") ? "puppet" : "mesh3d";
    attachPaperBlend(sp, ch.model, mode);
  }

  // Recompute live page-bounce right before every render pass so it always matches the active lights honestly
  if (scene && !scene.userData._pbHooked) {
    scene.userData._pbHooked = true;
    const prevRender = scene.onBeforeRender;
    scene.onBeforeRender = function (...args) {
      prevRender?.apply(this, args);
      const cur = window.live?.S;
      if (cur?.paperBlend?.enabled) syncBounceUniforms(cur, scene);
    };
  }
  updatePaperBlend(sp, scene);
}

// Toggle paperblend off/on on the exact same frame (for blend_check.mjs frame brightness/saturation comparison & proof shots)
export function setPaperBlend(sp, scene, on) {
  const pb = sp?.paperBlend;
  if (!pb || pb.enabled === !!on) return;
  pb.enabled = !!on;
  pb.u.uPBOn.value = pb.enabled ? 1.0 : 0.0;
  // Toggle day-spread light energy boost cleanly
  if (pb.lightBoost !== 1.0) {
    const f = pb.enabled ? pb.lightBoost : 1 / pb.lightBoost;
    for (const l of pb.lights) l.intensity *= f;
  }
  // Toggle un-merged card-edge rim tint
  for (const m of pb.edgeMats) {
    if (!m.userData._pbOrigColor) continue;
    m.color.copy(m.userData._pbOrigColor);
    if (pb.enabled) m.color.multiplyScalar(pb.isNight ? 0.72 : 0.36);
  }
  // Toggle non-selflit puppet emissive (0.02 blended vs 0.15 pre-Part-B)
  const dk = (sp.root.userData.stage ?? pb.nativeStage) === "night";
  const pupGlow = (pb.enabled ? 0.02 : 0.15) * (dk ? 0.45 : 1.0);
  const togglePup = root => root?.traverse(o => {
    if (o.isMesh && o.material?.isMeshStandardMaterial && o.material.emissiveMap && !o.material.userData?.selflit && o.material.emissiveIntensity < 0.4) {
      o.material.emissiveIntensity = pupGlow;
    }
  });
  for (const ch of sp.cast ?? []) if (ch.c?.model?.startsWith("puppet:")) togglePup(ch.model);
  if (!pb.enabled) {
    if (scene) scene.environmentIntensity = 0.30;
  } else {
    updatePaperBlend(sp, scene);
  }
}

function syncBounceUniforms(sp, scene) {
  const pb = sp.paperBlend;
  if (!pb || !pb.enabled) return;
  const sumI = measureDirect(pb.lights, _col);
  // Keep night/blue light neutral so characters never turn blue (BOOK-STANDARD 2026-11-18)
  if (_col.b > _col.r) _col.lerp(_tmp.setRGB(1, 1, 1), 0.85);
  const ratio = Math.min(1.5, sumI / pb.baseDirect);
  // Upward page-bounce diffuse scales strictly with live stage light energy (0 on native night so Mali keeps exact gold/indigo)
  const bounceStrength = pb.isNight ? 0.0 : Math.min(0.52, sumI * 0.110);
  pb.u.uPBBounce.value.set(_col.r * bounceStrength, _col.g * bounceStrength, _col.b * bounceStrength);
  // Subtle live scene-light tint (12% on day, 0% on native night so Mali's warm gold & indigo stay exact)
  const tintMix = pb.isNight ? 0.0 : 0.12 * Math.min(1, ratio);
  pb.u.uPBSceneTint.value.set(
    1 + (_col.r - 1) * tintMix,
    1 + (_col.g - 1) * tintMix,
    1 + (_col.b - 1) * tintMix,
  );
  // Gentle scotopic saturation softening when a day/eve spread transitions down into low-light night/midnight
  const curStage = sp.root.userData.stage ?? pb.nativeStage;
  pb.u.uPBNightDesat.value = !pb.isNight && curStage === "night"
    ? 0.62 * Math.max(0, Math.min(1, (0.7 - ratio) / 0.45)) : 0.0;
  // Rim tone tracks live stage tint gently (warmer/lighter on night spreads so Mali keeps its subtle warm paper edge)
  const r0 = pb.isNight ? 0.62 : 0.30, g0 = pb.isNight ? 0.58 : 0.28, b0 = pb.isNight ? 0.52 : 0.25;
  pb.u.uPBRimTint.value.set(r0 * (0.7 + 0.3 * _col.r), g0 * (0.7 + 0.3 * _col.g), b0 * (0.7 + 0.3 * _col.b));
  // Depth mist colour from scene fog (with blue excess damped like live.js so night spreads don't over-blue props)
  const fc = scene?.fog?.color;
  const mistLevel = Math.min(0.16, sumI * 0.040);
  if (fc) {
    _tmp.copy(fc);
    if (_tmp.b > _tmp.r) _tmp.lerp(new THREE.Color(1, 1, 1).multiplyScalar((_tmp.r + _tmp.g + _tmp.b) / 3), 0.65);
    pb.u.uPBMistCol.value.set(_tmp.r * mistLevel * 1.4, _tmp.g * mistLevel * 1.4, _tmp.b * mistLevel * 1.4);
  } else pb.u.uPBMistCol.value.set(_col.r * mistLevel, _col.g * mistLevel, _col.b * mistLevel);
}

export function updatePaperBlend(sp, scene, life) {
  const pb = sp?.paperBlend;
  if (!pb || !pb.enabled) return;
  // Lazily attach to any newly loaded ambient extras (2D puppets & 3D extras)
  if (life?.extras) {
    for (const x of life.extras) {
      if (!x.p?.root || x.def?.selflit || pb.patchedExtras.has(x.p.root)) continue;
      pb.patchedExtras.add(x.p.root);
      attachPaperBlend(sp, x.p.root, x.e?.model ? "mesh3d" : "puppet");
    }
  }
  const sumI = measureDirect(pb.lights, _col);
  const ratio = Math.min(1.5, sumI / pb.baseDirect);
  const curStage = sp.root.userData.stage ?? pb.nativeStage;
  // Scale scene.environmentIntensity with live stage cues (midnight cue drops env proportionally, isolation spot multiplies via isoWash)
  if (scene) {
    const nightDrop = !pb.isNight && curStage === "night" ? 0.85 : 1.0;
    const isoWash = scene.userData.isoWash ?? 1.0;
    const cueScale = pb.isNight && Math.abs(ratio - 1.0) < 0.02 ? 1.0 : (0.14 + 0.86 * ratio) * nightDrop;
    scene.environmentIntensity = pb.envBase * cueScale * isoWash;
  }
  syncBounceUniforms(sp, scene);
}
