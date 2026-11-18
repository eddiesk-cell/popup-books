// carvings.js: the fifty pictures carved on the backs of Memory's stone tablets (owner 2026-11-18: "like drawing carved into stones"), drawn from our tales' characters and things.
// Each is a few strokes of SVG path data in a 100 x 100 box. bakeAtlas() cuts them into one height map at load and turns it into a colour atlas (old stone, shadowed grooves,
// faded ochre-gold left in the lines, groove depth in alpha for the match glow) and a normal atlas, so the grooves catch the torchlight. 8 x 8 cells: 0-49 the figures,
// 50 the face side's emblem, 51 plain stone (the tablets' edges).
import { THREE, noise } from "../stage3d.js";
const O = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const FIGS = [
  ["sun", `${O(50, 50, 17)}M50 8v14M50 78v14M8 50h14M78 50h14M20 20l10 10M70 70l10 10M80 20l-10 10M30 70l-10 10`],
  ["moon", "M64 12a40 40 0 1 0 0 76a31 31 0 1 1 0-76"],
  ["star", "M50 8l11 30h32l-26 19 10 32-27-20-27 20 10-32-26-19h32z"],
  ["fish", `M12 50q20-26 50-14q8 4 14 14q-6 10-14 14q-30 12-50-14M76 50l16-16v32zM40 44v12M48 42v16${O(26, 46, 3)}`],
  ["boat", "M8 56h84l-16 20h-52zM50 56v-46M50 14l28 34h-28M30 56v-14h12"],
  ["lantern", "M50 6v10M38 16h24M32 28q18-16 36 0v36q-18 16-36 0zM38 80h24M50 74v6M42 38v20M58 38v20M32 46h36"],
  ["bird", "M6 40q22-22 44 8q22-30 44-8M44 58l6-8 6 8"],
  ["monkey", `${O(50, 28, 12)}${O(34, 24, 5)}${O(66, 24, 5)}M50 40v28M50 48l-20-10M50 48l20 12M50 68l-14 22M50 68l14 22M62 72q24 2 20-18q-3-10-11-4`],
  ["crocodile", `M6 50h56l30-14M62 50l30 10M14 50v12M28 50v12M42 50v12M66 47l4-6 4 5 4-6 4 5 4-6M6 50q-2-10 8-12${O(56, 42, 3)}`],
  ["toad", `${O(36, 28, 7)}${O(64, 28, 7)}M20 46q30-20 60 0q6 26-30 28q-36-2-30-28M22 62l-12 16h14M78 62l12 16h-14M38 56q12 8 24 0`],
  ["turtle", `M18 62q32-50 64 0zM18 62h64M30 62l-6 14M70 62l6 14M82 58q8-6 12 0${O(90, 52, 5)}M38 44l12 8 12-8M50 52v10`],
  ["snail", "M50 46a4 4 0 1 1-4 4a8 8 0 1 1 8 8a14 14 0 1 1-14-14a20 20 0 1 1 20 20M16 78h70q6-8-2-14M82 64l6-16M88 66l10-10"],
  ["butterfly", "M50 30v44M50 40q-34-30-36 6q2 18 36 4M50 40q34-30 36 6q-2 18-36 4M50 56q-26 4-22 22q10 6 22-14M50 56q26 4 22 22q-10 6-22-14M50 30l-8-12M50 30l8-12"],
  ["dragonfly", `${O(50, 16, 5)}M50 22v68M50 34l-38-8q-6 8 0 12zM50 34l38-8q6 8 0 12zM50 46l-32 4q-4 8 2 10zM50 46l32 4q4 8-2 10z`],
  ["lotus", "M50 82q-18-30 0-60q18 30 0 60M50 82q-34-6-38-38q26 4 38 38M50 82q34-6 38-38q-26 4-38 38M18 88h64"],
  ["tree", "M50 92v-42M50 70l-14-12M50 62l14-10M50 52q-30 0-28-22q4-20 28-18q24-2 28 18q2 22-28 22"],
  ["house", "M14 48l36-28 36 28zM22 48h56v22h-56zM26 70v22M50 70v22M74 70v22M44 56h12v14M18 92h18"],
  ["gourd", "M50 12v10M50 22q-10 0-10 12q0 8 6 12q-22 6-20 26q4 18 24 18t24-18q2-20-20-26q6-4 6-12q0-12-10-12M54 12q10-4 16 4"],
  ["drum", "M22 28a28 9 0 1 0 56 0a28 9 0 1 0-56 0M22 28v42q28 14 56 0v-42M30 34l10 38M70 34l-10 38M16 10l18 14M84 10l-18 14"],
  ["elephant", `M16 74v-28q0-20 26-20h16q24 0 24 22v8q0 12 8 22M82 56q-8 2-8 12M16 74v14M32 74v14M58 74v14M70 74v14M16 74h58M44 26q-8 14 6 20${O(68, 42, 3)}`],
  ["buffalo", `M14 30q8-20 30-6M86 30q-8-20-30-6M38 28q12-6 24 0q4 22-12 32q-16-10-12-32${O(44, 52, 2)}${O(56, 52, 2)}${O(43, 38, 3)}${O(57, 38, 3)}`],
  ["cat", `M28 30l6-18 12 12h8l12-12 6 18v22q0 20-22 20t-22-20zM28 54h-16M72 54h16M28 60h-14M72 60h14M46 54l4 4 4-4${O(40, 42, 3)}${O(60, 42, 3)}`],
  ["owl", `M28 22l10 8h24l10-8v52q0 16-22 16t-22-16zM50 50l-4 8h8z${O(40, 42, 8)}${O(60, 42, 8)}M38 90h24`],
  ["heron", "M30 42q0-14 14-14q10 0 12 8l22-4-20 10q2 24-26 26zM40 68l-4 24M50 68l4 24M54 30q-8-14-2-22"],
  ["duck", `M14 60q0 22 32 22h18q18 0 20-18q-12 2-20-2q8-10 2-22q-10-14-24-2q-6 8 0 18q-18-6-28 4M62 30l16 4-16 4${O(54, 32, 2)}M8 92h84`],
  ["gecko", `${O(50, 18, 6)}M50 24v40q0 14 10 20q8 4 2 10M50 34l-18-8-4 6M50 34l18-8 4 6M50 58l-18 8-2 8M50 58l18 8 2 8`],
  ["crab", `M28 52q22-22 44 0q-22 18-44 0M28 52l-12 10M28 58l-10 14M72 52l12 10M72 58l10 14M36 42q-22-6-18-26q12 4 10 14M64 42q22-6 18-26q-12 4-10 14${O(44, 40, 2)}${O(56, 40, 2)}`],
  ["mountain", "M6 86l30-50 14 20 14-28 30 58zM28 50l8 4 6-8M58 38l6 8 6-6"],
  ["rain cloud", "M22 68q-14 0-14-12t14-12q2-16 18-16q12 0 18 10q4-4 12-4q14 0 14 16q8 2 8 10t-12 8zM30 80l-4 10M50 80l-4 10M70 80l-4 10"],
  ["rainbow", "M8 80a42 42 0 0 1 84 0M20 80a30 30 0 0 1 60 0M32 80a18 18 0 0 1 36 0"],
  ["fire", "M50 92q-28 0-26-26q2-16 14-28q0 14 8 18q-4-24 14-44q0 22 12 32q12 12 8 26q-4 22-30 22M50 92q-12-2-10-14q2-10 10-14q8 6 10 14q2 12-10 14"],
  ["leaf", "M16 84q0-62 68-68q2 66-68 68M16 84l46-46M34 66h-12M42 58v-14M52 48h-12M56 44v-10"],
  ["mango", "M30 30q32-16 46 16q10 30-22 40q-32 6-30-26q0-16 6-30M50 22q4-10 14-12q-2 10-14 12"],
  ["nest", `M12 58q38 32 76 0M16 64q34 18 68 0M20 70q30 14 60 0${O(38, 48, 9)}${O(52, 46, 9)}${O(66, 50, 9)}`],
  ["bell", `M50 8v10M32 72q4-52 18-54q14 2 18 54zM24 72h52M38 40h24${O(50, 82, 5)}`],
  ["crown", `M16 72l-4-42 20 18 18-30 18 30 20-18-4 42zM16 82h68${O(50, 58, 4)}`],
  ["wheel", `${O(50, 50, 38)}${O(50, 50, 7)}M50 12v76M12 50h76M23 23l54 54M77 23l-54 54`],
  ["basket", "M14 44h72l-8 42h-56zM14 44q36-44 72 0M22 58h56M26 72h48M38 44l-4 42M62 44l4 42"],
  ["jar", "M38 14h24M40 14v10q-26 12-22 42q4 24 32 24t32-24q4-30-22-42v-10M22 50h56M26 64h48"],
  ["rocket", `M50 6q18 14 18 46v26h-36v-26q0-32 18-46M32 60l-14 24h14M68 60l14 24h-14M42 78l8 16 8-16${O(50, 36, 7)}`],
  ["spiral", "M50 46a4 4 0 1 1-4 4a8 8 0 1 1 8 8a14 14 0 1 1-14-14a20 20 0 1 1 20 20a28 28 0 1 1-28-28a36 36 0 1 1 36 36"],
  ["river", "M6 44q11-18 22 0t22 0t22 0t22 0M6 62q11-18 22 0t22 0t22 0t22 0M6 80q11-18 22 0t22 0t22 0t22 0"],
  ["naga", `M10 84q22 0 22-18t20-18t20-18q2-18 16-18q10 2 8 12q-4 8-14 4M14 80l-6 6M86 22l8-4${O(84, 18, 2)}`],
  ["bee", "M26 58a24 15 0 1 0 48 0a24 15 0 1 0-48 0M42 45v26M56 44v28M40 46q-16-28 6-26q10 2 6 22M58 44q10-26 24-14q4 10-20 16M74 58h12M20 52l-8-6M20 52l-8 2"],
  ["spider", `${O(50, 52, 11)}${O(50, 34, 7)}M40 46l-26-14-8 14M40 52l-30 2-6 14M40 58l-26 14-4 14M60 46l26-14 8 14M60 52l30 2 6 14M60 58l26 14 4 14M50 6v20`],
  ["stupa", "M50 4v14M42 26q8-14 16 0M36 40q14-20 28 0M26 56q24-24 48 0M18 56h64v30h-64zM44 86v-16h12v16M10 92h80"],
  ["palm", `M50 94q-6-42 6-64M56 30q-22-14-42-2M56 30q-6-22-28-24M56 30q8-20 32-16M56 30q24-4 36 14M56 30q10 8 12 24${O(60, 38, 3)}`],
  ["caterpillar", `${O(16, 62, 9)}${O(32, 56, 9)}${O(48, 62, 9)}${O(64, 56, 9)}${O(82, 58, 11)}M78 46l-4-12M88 46l4-12M20 72v8M36 66v8M52 72v8M68 66v8`],
  ["khene", "M30 10v80M40 6v84M50 12v78M60 6v84M70 10v80M24 50h52v16h-52z"],
  ["flower", `${O(50, 50, 8)}M50 42q-14-30 0-34q14 4 0 34M58 50q30-14 34 0q-4 14-34 0M50 58q14 30 0 34q-14-4 0-34M42 50q-30 14-34 0q4-14 34 0`],
];
const EMBLEM = `${O(50, 50, 30)}${O(50, 50, 22)}M50 14l6 30 30 6-30 6-6 30-6-30-30-6 30-6z`;

export function bakeAtlas(N = 128) {
  const S = N * 8, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S); g.strokeStyle = "#fff"; g.lineCap = g.lineJoin = "round"; g.filter = "blur(1.6px)";  // the blur rounds each groove's floor
  const cell = (i, d, w) => { g.save(); g.translate((i % 8) * N, ((i / 8) | 0) * N); g.scale(N / 100, N / 100);
    g.lineWidth = 2.4; g.strokeRect(7, 7, 86, 86); g.translate(14, 14); g.scale(.72, .72); g.lineWidth = w; g.stroke(new Path2D(d)); g.restore(); };
  FIGS.forEach(([, d], i) => cell(i, d, 7.5)); cell(50, EMBLEM, 5.5);
  const H = g.getImageData(0, 0, S, S).data, h = (x, y) => H[(Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))) * 4] / 255;
  const col = new Uint8Array(S * S * 4), nor = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const gv = h(x, y), k = ((S - 1 - y) * S + x) * 4, st = .74 + .2 * noise(x / 11, y / 11) + .1 * noise(x / 3, y / 3) - .06 * (noise(x / 40, y / 40) > .7);  // rows flipped: v runs up
    const ochre = gv * .75 * (.35 + .65 * noise(x / 6 + 9, y / 6)), dark = 1 - .55 * gv;
    col[k] = 255 * Math.min(1, st * dark * (.6 * (1 - ochre) + .78 * ochre)); col[k + 1] = 255 * Math.min(1, st * dark * (.56 * (1 - ochre) + .56 * ochre)); col[k + 2] = 255 * Math.min(1, st * dark * (.5 * (1 - ochre) + .26 * ochre)); col[k + 3] = 255 * gv;
    const du = (h(x + 1, y) - h(x - 1, y)) * 3.2 + (noise(x / 2, y / 2) - .5) * .25, dv = (h(x, y - 1) - h(x, y + 1)) * 3.2 + (noise(x / 2 + 5, y / 2) - .5) * .25, l = Math.hypot(du, dv, 1);  // grooves are low: the normal leans away from the rising wall
    nor[k] = 127.5 * (1 + du / l); nor[k + 1] = 127.5 * (1 + dv / l); nor[k + 2] = 127.5 * (1 + 1 / l); nor[k + 3] = 255;
  }
  const tex = (d, srgb) => { const t = new THREE.DataTexture(d, S, S); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  return { map: tex(col, true), normalMap: tex(nor, false) };
}
