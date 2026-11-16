// atlas.js: every wonder of the epic background, drawn at start-up into ONE canvas texture (no files, no fonts shipped): gold paper-cuts with a cream cut edge, glyphs in the system's own fonts, stars, constellations.
// A shape is a string of parts joined by "|": "f:<svg path>" filled, "s<w>:<path>" stroked (width w), "e:<path>" cut out (filled eraser), "x<w>:<path>" cut out (stroked eraser). Coordinates 0..100, y down.
const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`, el = (x, y, a, b) => `M${x - a} ${y}a${a} ${b} 0 1 0 ${2 * a} 0a${a} ${b} 0 1 0 ${-2 * a} 0Z`;
const r4 = (x, y) => `M${x} ${y - 5}l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6Z`;  // a tiny sparkle
const S = {  // one string per wonder; generic archetypes of my own, gold paper-cut, friendly
  house: `f:M16 42L50 16L84 42Z|f:M24 42h52v22h-52Z|f:M28 64h5v22h-5ZM47 64h5v22h-5ZM67 64h5v22h-5Z|f:M4 92q11-9 23 0t23 0t23 0t23 0v8h-92Z|e:M36 50h10v9h-10Z|e:M54 50h10v9h-10Z|s3:M50 16V6`,
  palace: `f:M2 92L34 38L52 66L72 30L98 92Z|f:M62 30h20v-9h-20Z|f:M58 21L72 6L86 21Z|e:M69 30h6v-6h-6Z|s2.5:M72 6V-2|e:M26 56L34 46L42 56Z`,
  galleon: `f:M14 64h72l-10 16h-52Z|f:M48 14h4v50h-4Z|f:M54 16Q86 38 54 60Z|f:M46 24Q22 40 46 58Z|f:M52 14l14 4l-14 4Z|f:M2 90q12-12 24 0t24 0t24 0t24 0v10h-96Z|e:${c(40, 72, 2.3)}|e:${c(50, 72, 2.3)}|e:${c(60, 72, 2.3)}`,
  pyramid: `f:M6 84L50 20L94 84Z|f:M0 86h100v8h-100Z|f:${c(80, 20, 8)}|x1.8:M22 66H78|x1.8:M34 46H66|e:M45 84v-10h10v10Z`,
  castle: `f:M18 84V44h64V84Z|f:M8 84V30h20V84ZM72 84V30h20V84Z|f:M6 30L18 10L30 30ZM70 30L82 10L94 30Z|e:M44 84V66a6 6 0 0 1 12 0V84Z|e:M15 44h4v9h-4ZM81 44h4v9h-4Z|e:M16 58h4v8h-4ZM80 58h4v8h-4Z|f:M30 44v-6h6v6ZM44 44v-6h6v6ZM58 44v-6h6v6Z`,
  dino: `f:${el(46, 60, 24, 14)}|f:M62 54L74 24L82 26L74 58Z|f:${el(84, 24, 9, 5)}|f:M24 60L4 74L26 68Z|f:M32 70h6v16h-6ZM54 70h6v16h-6Z|e:${c(86, 23, 1.6)}|f:M36 48l3-8 3 8ZM46 46l3-8 3 8Z`,
  mammoth: `f:${el(50, 56, 28, 20)}|f:${el(72, 48, 16, 18)}|f:${c(42, 38, 16)}|s7:M86 56Q96 70 88 84|s3:M80 60Q92 62 90 74|f:M30 70h8v18h-8ZM62 70h8v18h-8Z|e:${c(78, 44, 1.8)}|e:${c(68, 44, 4)}`,
  knight: `f:M24 78V44A26 26 0 0 1 76 44V78Z|f:M50 18Q70 4 84 22Q66 18 56 28Z|e:M28 50h44v6h-44Z|e:M38 62h4v12h-4ZM58 62h4v12h-4Z`,
  scroll: `f:M18 22h64v56h-64Z|f:${el(18, 50, 7, 31)}|f:${el(82, 50, 7, 31)}|x2.2:M30 36Q42 56 54 40T72 62|x2.2:M62 32l10 10M72 32l-10 10|e:${c(34, 66, 5)}`,
  dragon: `s10:M10 74C22 40 40 94 54 62C66 36 84 58 82 34|f:M74 36L84 22L97 26L95 34L88 38Z|s3:M82 24L80 14|s3:M88 22L90 13|s4:M30 66L26 82|s4:M60 66L66 80|f:M22 56l3-8 3 8ZM44 70l3-8 3 8ZM64 50l3-8 3 8Z|e:${c(90, 28, 1.8)}|s2:M96 30Q100 38 96 44`,
  unicorn: `f:${el(46, 58, 22, 12)}|f:M58 52L70 28L80 32L72 58Z|f:M70 28L88 38L84 44L72 38Z|f:M78 30L86 6L82 32Z|f:M30 66h4v22h-4ZM38 68h4v20h-4ZM54 68h4v20h-4ZM62 66h4v22h-4Z|s4:M25 52Q12 56 16 76|s3:M66 30Q58 36 64 46|e:${c(80, 38, 1.4)}`,
  serpent: `s8:M4 82Q16 44 28 82Q40 44 52 82Q64 44 74 72|f:M68 70L80 48L96 54L94 66L82 76Z|e:${c(90, 55, 1.6)}|f:M0 90q12-8 25 0t25 0t25 0t25 0v10h-100Z`,
  giant: `f:${c(50, 22, 12)}|f:M30 86V50Q50 34 70 50V86Z|s8:M30 54L14 78|s8:M70 54L88 70|e:${c(45, 20, 1.8)}|e:${c(55, 20, 1.8)}|x2:M44 26Q50 31 56 26|e:${c(50, 60, 2.5)}|e:${c(50, 70, 2.5)}`,
  firebird: `f:M45 52C40 20 18 12 6 14C20 26 26 40 38 58Z|f:M52 50C62 24 82 20 94 22C84 34 76 46 62 58Z|f:M40 56C40 44 56 44 58 52C62 52 66 54 66 58C60 60 58 62 56 66C46 70 38 66 40 56Z|f:M58 52L70 50L62 58Z|s6:M44 66C40 84 30 92 14 94|s6:M48 68C48 86 44 94 38 98|s6:M52 66C58 84 66 90 82 92|f:M50 46L46 36L54 44Z|e:${c(60, 54, 1.6)}`,
  pegasus: `f:${el(46, 62, 20, 11)}|f:M58 56L68 36L78 40L70 62Z|f:M68 36L86 44L82 50L70 44Z|f:M30 70h4v20h-4ZM38 72h4v18h-4ZM52 72h4v18h-4ZM60 70h4v20h-4Z|s4:M27 58Q14 62 18 80|f:M44 54C30 22 14 22 4 30C22 32 28 46 38 60Z|f:M52 52C60 24 76 18 92 20C80 32 72 44 60 60Z|e:${c(78, 44, 1.4)}`,
  furry: `f:${c(50, 56, 30)}|f:M30 30L26 14L38 26ZM70 30L74 14L62 26Z|s6:M22 60L10 48|s6:M78 60L90 48|f:${el(38, 88, 10, 5)}|f:${el(62, 88, 10, 5)}|e:${c(40, 50, 7)}|e:${c(60, 50, 7)}|e:M36 68Q50 82 64 68Q50 72 36 68Z|f:M22 50l-6-2 4-4ZM78 50l6-2-4-4Z`,
  mermaid: `f:M50 8C70 20 62 50 54 62C60 74 78 76 90 70C84 90 62 92 50 78C38 92 16 90 10 70C22 76 40 74 46 62C38 50 30 20 50 8Z|x1.5:M42 24Q50 30 58 24|x1.5:M40 36Q50 42 60 36|x1.5:M42 48Q50 54 58 48`,
  troll: `s6:M4 50Q50 14 96 50|f:M10 94V46h6V94ZM84 94V46h6V94Z|f:${c(50, 68, 13)}|f:M38 64L28 56L38 70ZM62 64L72 56L62 70Z|f:M32 94Q50 78 68 94Z|e:${c(45, 66, 2.4)}|e:${c(55, 66, 2.4)}|x2:M44 74Q50 79 56 74|f:M0 94h100v6h-100Z`,
  wand: `s5:M20 84L66 38|f:M72 14Q74 30 88 32Q74 34 72 50Q70 34 56 32Q70 30 72 14Z|f:${r4(30, 28)}|f:${r4(84, 70)}|f:${r4(22, 56)}`,
  potion: `f:${c(50, 64, 24)}|f:M42 44h16V28H42Z|f:M40 20h20v8H40Z|e:${c(44, 68, 4)}|e:${c(58, 62, 3)}|e:${c(52, 74, 2.5)}`,
  crystal: `f:M50 6L76 36L62 90H38L24 36Z|x1.6:M24 36H76|x1.6:M50 6L42 36L38 90|x1.6:M50 6L58 36L62 90`,
  spellbook: `f:M14 30L50 40L86 30V78L50 88L14 78Z|x2:M50 40V88|x1.6:M24 46L42 52M24 56L42 62|x1.6:M58 52L76 46M58 62L76 56|f:M50 6l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z`,
  lantern: `f:M32 36h36v38h-36Z|f:M28 36L50 22L72 36Z|s3:M40 24Q50 6 60 24|f:M30 74h40v6h-40Z|e:${c(42, 52, 3)}|e:${c(58, 52, 3)}|x2:M42 62Q50 68 58 62|s3:M30 50Q18 46 14 54|s3:M70 50Q82 46 86 54`,
  forest: `f:${el(50, 58, 22, 28)}|f:M52 32Q70 6 88 14Q80 36 52 32Z|s2:M52 32L60 24|e:${c(42, 54, 3.5)}|e:${c(58, 54, 3.5)}|e:${el(50, 65, 5, 2.5)}|f:${el(40, 88, 7, 4)}|f:${el(60, 88, 7, 4)}|s4:M30 60L16 68|s4:M70 60L84 68`,
  ghost: `f:M24 86V46A26 30 0 0 1 76 46V86L66 78L58 88L50 78L42 88L34 78Z|e:${c(40, 46, 4)}|e:${c(60, 46, 4)}|e:M40 58Q50 70 60 58Z|s5:M24 62L10 54|s5:M76 62L90 54`,
  mask: `f:M18 28Q50 14 82 28Q80 66 50 86Q20 66 18 28Z|e:M28 38Q36 32 44 40Q36 46 28 38Z|e:M56 40Q64 32 72 38Q64 46 56 40Z|e:M36 62Q50 76 64 62Q50 68 36 62Z|f:M50 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3Z`,
  wisp: `f:M50 8Q76 40 70 66A22 22 0 0 1 30 66Q24 40 50 8Z|e:M50 42Q62 58 58 68A9 9 0 0 1 42 68Q38 58 50 42Z`,
  note1: `f:${el(36, 76, 12, 9)}|s5:M46 74V22|f:M46 22C60 28 70 38 66 54C62 42 54 40 46 38Z`,
  note2: `f:${el(28, 78, 11, 8)}|f:${el(70, 70, 11, 8)}|s4.5:M38 76V28|s4.5:M80 68V20|f:M38 28L80 20V32L38 40Z`,
  dancer: `f:${c(50, 18, 8)}|f:M50 46L26 76h48Z|s8:M50 26V50|s5:M50 34L28 20|s5:M50 34L72 22|s5:M44 72L38 92|s5:M56 72L66 88`,
  kite: `f:M50 6L76 40L50 74L24 40Z|x1.6:M50 8V72|x1.6:M26 40H74|s2.5:M50 74C40 82 60 88 50 96|f:M44 82l-6-4l0 8ZM56 88l6-4l0 8Z`,
  monkey: `s5:M64 74Q92 70 84 44Q82 36 90 32|f:${el(46, 62, 14, 19)}|f:${c(46, 30, 13)}|f:${c(32, 30, 5.5)}|f:${c(60, 30, 5.5)}|s5:M36 52Q24 62 30 74|s5:M56 52Q66 60 62 74|s6:M40 78L34 92|s6:M52 78L60 92|e:${el(46, 34, 7.5, 6)}`,
  toad: `f:${el(50, 62, 32, 22)}|f:${c(34, 40, 8)}|f:${c(66, 40, 8)}|f:${el(24, 80, 12, 8)}|f:${el(76, 80, 12, 8)}|f:M38 28L40 14L46 22L50 12L54 22L60 14L62 28Z|e:${c(34, 40, 3)}|e:${c(66, 40, 3)}|e:${el(50, 64, 16, 1.6)}`,
  turtle: `f:M16 64A34 30 0 0 1 84 64Z|f:${el(90, 56, 8, 6)}|f:${el(28, 70, 8, 5)}|f:${el(68, 70, 8, 5)}|f:M16 62L6 68L16 68Z|e:M40 62l5-9h10l5 9Z|e:M28 62l4-7l6 7Z|e:M62 62l6-7l4 7Z|e:${c(92, 54, 1.6)}`,
  fish: `f:${el(44, 50, 28, 16)}|f:M68 50L94 30L90 50L94 70Z|f:M36 36L50 22L56 36Z|e:${c(26, 46, 3)}|x2:M40 40Q46 50 40 60`,
  fish2: `f:M10 50Q40 24 74 50Q40 76 10 50Z|f:M72 50L96 36Q88 50 96 64Z|f:M44 34Q50 18 62 38Z|f:M44 66Q50 82 62 62Z|e:${c(22, 48, 2.6)}|x2.5:M36 34V66|x2.5:M48 36V64`,
  butterfly: `f:M50 50C30 10 5 20 12 42C18 50 40 55 50 50Z|f:M50 50C70 10 95 20 88 42C82 50 60 55 50 50Z|f:M50 52C30 58 15 62 24 82C34 90 46 70 50 52Z|f:M50 52C70 58 85 62 76 82C66 90 54 70 50 52Z|s5:M50 30L50 76|s2.5:M50 32Q44 18 38 14|s2.5:M50 32Q56 18 62 14|e:${c(28, 34, 5)}|e:${c(72, 34, 5)}`,
  owl: `f:${el(50, 58, 24, 30)}|f:M30 32L28 14L42 26ZM70 32L72 14L58 26Z|f:M26 56Q14 70 26 84ZM74 56Q86 70 74 84Z|f:M40 86h6v6h-6ZM54 86h6v6h-6Z|e:${c(40, 42, 8)}|e:${c(60, 42, 8)}|f:M46 52L50 60L54 52Z|x1.6:M40 68Q50 74 60 68|x1.6:M40 76Q50 82 60 76`,
  whale: `f:M8 56Q10 30 50 32Q92 34 94 60Q70 78 30 72Q12 70 8 56Z|f:M14 58Q2 50 4 34Q16 40 24 54Z|s3:M70 32V18|s3:M70 22Q62 14 58 18|s3:M70 22Q78 14 82 18|e:${c(76, 50, 2.4)}|x1.6:M62 62Q80 66 92 58|f:M46 70Q54 84 66 74Z`,
  fox: `f:M34 88Q30 56 50 50Q70 56 66 88Z|f:M32 40Q50 24 68 40Q62 56 50 58Q38 56 32 40Z|f:M32 40L30 16L46 30ZM68 40L70 16L54 30Z|f:M64 86Q94 84 92 54Q82 70 64 70Z|e:${c(42, 42, 2.2)}|e:${c(58, 42, 2.2)}|e:${c(50, 52, 2.4)}|e:M44 70Q50 86 56 70Z`,
  rocket: `f:M50 6Q72 28 66 66H34Q28 28 50 6Z|f:M34 56L18 78L34 74ZM66 56L82 78L66 74Z|e:${c(50, 38, 7)}|f:M42 70Q50 98 58 70Z|x2:M36 58H64`,
  robot: `f:M30 18h40v26h-40Z|s3:M50 18V8|f:${c(50, 8, 4)}|f:M26 48h48v34h-48Z|s6:M24 54L10 70|s6:M76 54L90 40|f:M34 82h10v10h-10ZM56 82h10v10h-10Z|e:${c(40, 30, 5)}|e:${c(60, 30, 5)}|x2:M40 38Q50 42 60 38|e:M40 58h20v12h-20Z`,
  city: `f:M10 62H90Q80 88 50 94Q20 88 10 62Z|f:M24 62V40h10V62ZM40 62V24h10V62ZM56 62V34h10V62ZM72 62V46h10V62Z|f:M40 24L45 10L50 24ZM56 34L61 22L66 34Z|e:M43 36h4v6h-4ZM59 44h4v6h-4ZM27 48h4v6h-4Z`,
  satellite: `f:M40 36h20v28h-20Z|f:M6 40h30v20H6ZM64 40h30v20H64Z|x1.4:M16 40V60M26 40V60M74 40V60M84 40V60|s3:M50 36V24|f:M40 24Q50 8 60 24Z|e:${c(50, 50, 5)}`,
  airship: `f:${el(50, 40, 40, 22)}|f:M38 70h24v10h-24Z|s1.8:M36 56L42 70|s1.8:M64 56L58 70|f:M14 34L4 22L18 28ZM14 46L4 58L18 52Z|x2:M20 40Q50 52 80 40|e:M42 73h5v4h-5ZM53 73h5v4h-5Z`,
  station: `s7:M10 54a40 14 0 1 0 80 0a40 14 0 1 0 -80 0|f:${c(50, 54, 14)}|e:${c(50, 54, 5)}|f:M44 8h12v28h-12ZM44 72h12v20h-12Z`,
  rover: `f:M22 52h56v14h-56Z|f:M36 52L42 38h18L68 52Z|f:${c(30, 72, 10)}|f:${c(70, 72, 10)}|e:${c(30, 72, 3.5)}|e:${c(70, 72, 3.5)}|s2.5:M64 38L74 20|f:${c(75, 18, 3)}|e:M44 42h12v8H44Z`,
  visor: `f:${c(50, 50, 34)}|e:M26 42Q50 30 74 42V62Q50 74 26 62Z|s3:M70 24L78 10|f:${c(79, 9, 3)}`,
  island: `f:M10 54Q50 44 90 54Q82 62 50 62Q18 62 10 54Z|f:M18 58Q50 100 82 58Z|f:${c(34, 38, 10)}|f:M32 48h4v8h-4Z|f:M58 54V40h14V54Z|f:M56 40L65 30L74 40Z|e:M62 46h6v8h-6Z`,
  cloudwhale: `f:M14 50Q16 30 48 32Q80 34 86 52Q66 62 34 58Q18 58 14 50Z|f:M14 50Q6 40 10 28Q20 34 24 46Z|e:${c(70, 46, 2.2)}|f:M6 78Q10 66 24 70Q30 60 44 68Q56 60 66 70Q82 64 90 78Z`,
  stairs: `f:M6 92V84H24V76H40V68H56V60H72V52H92V92Z|f:M60 52V22A12 12 0 0 1 84 22V52Z|e:M65 52V24A7 7 0 0 1 79 24V52Z`,
  moon: `f:${c(50, 50, 34)}|e:${c(66, 42, 28)}|x2:M24 50q4 5 8 0|x2:M26 62q3 3 6 0|s3:M70 22h10L70 34h10|s2.5:M86 8h6L86 16h6`,
  ringedA: `f:${c(50, 50, 22)}|s4:M6 56C24 72 76 62 94 40C76 30 24 40 6 56Z|x1.6:M32 38Q50 42 68 38`,
  ringedB: `f:${c(40, 56, 16)}|s3.5:M60 44C80 36 98 24 96 18C90 14 60 22 40 40|f:${c(76, 26, 6)}|x1.4:M28 52Q40 56 52 52`,
  comet: `f:${c(76, 28, 12)}|s10:M66 38Q40 56 8 80|s6:M70 40Q50 70 28 92|s4:M80 40Q74 70 64 96`,
  sun: `f:${c(50, 50, 22)}|s5:M50 6V20M50 80V94M6 50H20M80 50H94M19 19L29 29M71 71L81 81M81 19L71 29M29 71L19 81|e:${c(42, 46, 3)}|e:${c(58, 46, 3)}|x2.2:M40 58Q50 68 60 58`,
};
const GROUPS = { past: ["pyramid", "castle", "house", "galleon", "palace", "dino", "mammoth", "knight", "scroll"], fantasy: ["dragon", "unicorn", "serpent", "giant", "firebird", "pegasus", "furry", "mermaid", "troll"],
  magic: ["wand", "potion", "crystal", "spellbook", "lantern", "forest", "ghost", "mask", "wisp"], play: ["note1", "note2", "dancer", "kite"], creatures: ["monkey", "toad", "turtle", "fish", "fish2", "butterfly", "owl", "whale", "fox"],
  future: ["rocket", "robot", "city", "satellite", "airship", "station", "rover", "visor"], dreams: ["island", "cloudwhale", "stairs", "moon", "ringedA", "ringedB", "comet", "sun"] };
const SHAPES = Object.fromEntries(Object.entries(GROUPS).map(([k, v]) => [k, v.map(n => S[n])]));
const TEXTS = [  // [font stack, text] x2 per script: Latin, Lao, Thai, Chinese, Japanese, Korean, Arabic, Devanagari
  ["Georgia, serif", "Once"], ["Georgia, serif", "Tale"], ['"Lao Sangam MN","Noto Sans Lao","Lao UI",sans-serif', "ນິທານ"], ['"Lao Sangam MN","Noto Sans Lao","Lao UI",sans-serif', "ຝັນ"],
  ['"Thonburi","Sukhumvit Set",sans-serif', "นิทาน"], ['"Thonburi","Sukhumvit Set",sans-serif', "ฝัน"], ['"PingFang SC","Songti SC",serif', "故事"], ['"PingFang SC","Songti SC",serif', "梦"],
  ['"Hiragino Mincho ProN","Hiragino Sans",serif', "物語"], ['"Hiragino Mincho ProN","Hiragino Sans",serif', "ゆめ"], ['"Apple SD Gothic Neo",sans-serif', "이야기"], ['"Apple SD Gothic Neo",sans-serif', "꿈"],
  ['"Geeza Pro","Al Nile",serif', "حكاية"], ['"Geeza Pro","Al Nile",serif', "حلم"], ['"Kohinoor Devanagari","Devanagari Sangam MN",sans-serif', "कथा"], ['"Kohinoor Devanagari","Devanagari Sangam MN",sans-serif', "स्वप्न"],
];
const CREAM = "#fff0cc";
export function makeAtlas(THREE, size = 2048, { defer = false } = {}) {  // defer: the built-in paper-cut shapes are only reserved; A.drawShapes() draws them (when the sprite atlas is late or missing)  // -> { tex, cols, cells: { worlds, creatures, play, glyphs, stars, consts } } (arrays of cell numbers)
  const N = 10, cell = size / N, pad = cell * 0.09, cv = document.createElement("canvas"); cv.width = cv.height = size; const x = cv.getContext("2d"), cells = {}; let n = 0;
  const later = [], put = (i, f) => { const s = (cell - 2 * pad) / 100; x.save(); x.beginPath(); x.rect((i % N) * cell, Math.floor(i / N) * cell, cell, cell); x.clip(); x.translate((i % N) * cell + pad, Math.floor(i / N) * cell + pad); x.scale(s, s); f(s); x.restore(); }, at = f => { const i = n++; put(i, f); return i; }, shape = str => { const i = n++; if (defer) later.push([i, str]); else put(i, () => cut(str)); return i; };
  const gold = () => { const g = x.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, "#ffe8aa"); g.addColorStop(1, "#d9a043"); return g; };
  const cut = str => { x.lineJoin = x.lineCap = "round"; const P = str.split("|").map(s => { const [t, d] = [s.slice(0, s.indexOf(":")), s.slice(s.indexOf(":") + 1)]; return { k: t[0], w: +t.slice(1), p: new Path2D(d) }; });
    x.strokeStyle = x.fillStyle = CREAM; for (const q of P) { if (q.k === "f") { x.lineWidth = 5; x.stroke(q.p); x.fill(q.p); } else if (q.k === "s") { x.lineWidth = q.w + 5; x.stroke(q.p); } }  // the cream cut edge first,
    x.strokeStyle = x.fillStyle = gold(); for (const q of P) { if (q.k === "f") x.fill(q.p); else if (q.k === "s") { x.lineWidth = q.w; x.stroke(q.p); } }  // the gold over it,
    x.globalCompositeOperation = "destination-out"; for (const q of P) { if (q.k === "e") x.fill(q.p); else if (q.k === "x") { x.lineWidth = q.w; x.stroke(q.p); } } x.globalCompositeOperation = "source-over"; };  // then the cuts
  for (const k in SHAPES) if (k !== "future" && k !== "dreams") cells[k] = SHAPES[k].map(shape);
  cells.glyphs = TEXTS.map(([f, t]) => at(s => { let px = 74; x.textAlign = "center"; x.textBaseline = "middle"; do x.font = `700 ${px}px ${f}`; while (x.measureText(t).width > 96 && (px -= 4)); x.lineJoin = "round"; x.lineWidth = 3.4; x.strokeStyle = CREAM; x.strokeText(t, 50, 52); x.fillStyle = gold(); x.fillText(t, 50, 52); }));  // letters of many scripts, in the system's own fonts
  const glow = (r, a) => { const g = x.createRadialGradient(50, 50, 0, 50, 50, r); g.addColorStop(0, `rgba(255,226,150,${a})`); g.addColorStop(1, "rgba(255,200,110,0)"); x.fillStyle = g; x.fillRect(-20, -20, 140, 140); };
  const star = (k, rot) => { x.translate(50, 50); x.rotate(rot); x.scale(k, k); x.translate(-50, -50); x.fillStyle = CREAM; x.fill(new Path2D("M50 6Q53 47 94 50Q53 53 50 94Q47 53 6 50Q47 47 50 6Z")); };
  for (const k of ["future", "dreams"]) cells[k] = SHAPES[k].map(shape);
  cells.stars = [at(() => { glow(48, 0.55); star(0.8, 0); }), at(() => { glow(48, 0.5); star(0.7, 0); star(0.5, Math.PI / 4); }), at(() => glow(40, 0.9))];
  const R = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  cells.consts = [0, 1, 2].map(() => at(() => { const pts = Array.from({ length: 5 + Math.floor(R() * 3) }, (_, i) => [8 + i * 80 / 6 + R() * 8, 18 + R() * 64]); x.lineWidth = 0.55; x.strokeStyle = "rgba(255,236,190,.85)"; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke();  // fine points joined by hairlines
    for (const [a, b] of pts) { x.save(); x.translate(a - 50, b - 50); glow(7, 0.5); x.restore(); x.fillStyle = CREAM; x.beginPath(); x.arc(a, b, 1.3, 0, 7); x.fill(); } }));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4; tex.flipY = false;  // raw sRGB values, added together in sRGB: the shader writes them as they are
  return { tex, cols: N, cells, canvas: cv, drawShapes() { for (const [i, str] of later.splice(0)) put(i, () => cut(str)); tex.needsUpdate = true; } };
}

// the brand emblem (no cover art of its own yet): an eight-pointed star inside a fine double ring, tooled gold on the book's midnight leather. shortcut: replace with the brand's cover art when it is made
export function drawEmblem(x, cx, cy, R, mode = "map") {  // mode "map": gold on the colour map; "orm": the metal mask (ao 1, rough .35, metal 1)
  const gold = mode === "map" ? (() => { const g = x.createLinearGradient(cx, cy - R, cx, cy + R); g.addColorStop(0, "#f6dc92"); g.addColorStop(1, "#c8923c"); return g; })() : "rgb(255,90,255)";
  x.save(); x.strokeStyle = x.fillStyle = gold; x.lineJoin = "round"; x.lineWidth = R * 0.045; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke(); x.lineWidth = R * 0.02; x.beginPath(); x.arc(cx, cy, R * 0.9, 0, 7); x.stroke();
  x.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, r = i % 2 ? R * 0.2 : R * 0.76; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill();
  x.lineWidth = R * 0.018; x.beginPath(); x.arc(cx, cy, R * 0.3, 0, 7); x.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; x.beginPath(); x.arc(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, R * 0.025, 0, 7); x.fill(); }
  if (mode === "map") { x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000"; x.beginPath(); x.arc(cx, cy, R * 0.09, 0, 7); x.fill(); } x.restore(); }
export function makeEmblemMap(THREE) {  // the picture window's colour map: leather, then the emblem (4:3, as the window is)
  const w = 640, h = 480, cv = document.createElement("canvas"); cv.width = w; cv.height = h; const x = cv.getContext("2d");
  x.fillStyle = "#0e1840"; x.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${i % 2 ? "255,255,255" : "0,0,20"},.035)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  drawEmblem(x, w / 2, h / 2, 200); x.strokeStyle = "rgba(230,187,98,.55)"; x.lineWidth = 3; x.strokeRect(14, 14, w - 28, h - 28);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
