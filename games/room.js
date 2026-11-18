// The Game Room: one gold-framed door per game, each hosted by a main character. Copy per language; ?lang= is passed on to the game and back to the library (same codes as the landing).
const G = { doors: ["Doors of Mystery", "Hosted by Kankak. Solve the sum, pick the right door.", "Play every day"], memory: ["Memory", "Hosted by Kapi. Find all the pairs.", "Play every day"] };
const TR = {
  en: { back: "← Back to the library", h: "The Game Room", sub: "Pick a door. Each game is hosted by a story hero. Play a little every day.", ...G },
  lo: { back: "← ກັບຄືນຫ້ອງສະໝຸດ", h: "ຫ້ອງເກມ", sub: "ເລືອກປະຕູ. ແຕ່ລະເກມມີຕົວເອກຂອງນິທານເປັນເຈົ້າພາບ. ຫຼິ້ນໜ້ອຍໜຶ່ງທຸກມື້.",
    doors: ["ປະຕູລຶກລັບ", "ເຈົ້າພາບ Kankak. ແກ້ເລກ ແລ້ວເລືອກປະຕູທີ່ຖືກ.", "ຫຼິ້ນໄດ້ທຸກມື້"], memory: ["ເກມຈື່ຈຳ", "ເຈົ້າພາບ Kapi. ຊອກຫາຄູ່ໃຫ້ຄົບ.", "ຫຼິ້ນໄດ້ທຸກມື້"] },  // DRAFT Vientiane Lao for the owner's native check
  th: { back: "← กลับห้องสมุด", h: "ห้องเกม", sub: "เลือกประตู แต่ละเกมมีตัวเอกของนิทานเป็นเจ้าบ้าน เล่นนิดหน่อยทุกวัน",
    doors: ["ประตูปริศนา", "เจ้าบ้าน กันกาก แก้โจทย์เลขแล้วเลือกประตูที่ถูก", "เล่นได้ทุกวัน"], memory: ["เกมจับคู่ความจำ", "เจ้าบ้าน กาปี หาคู่ให้ครบ", "เล่นได้ทุกวัน"] },
  zh: { back: "← 回到图书馆", h: "游戏室", sub: "选一扇门。每个游戏都由故事里的主角主持。每天玩一点。",
    doors: ["神秘之门", "主持人:坎卡。算出答案,选对门。", "每天都能玩"], memory: ["记忆配对", "主持人:卡皮。找出所有的一对。", "每天都能玩"] },
  ja: { back: "← 図書館へもどる", h: "ゲームのへや", sub: "とびらをえらぼう。ゲームごとにお話の主人公がホストです。まいにち少しだけ。",
    doors: ["なぞのとびら", "ホストはカンカク。けいさんして正しいとびらを。", "まいにち遊べます"], memory: ["しんけいすいじゃく", "ホストはカピ。ペアを全部見つけよう。", "まいにち遊べます"] },
  ko: { back: "← 도서관으로", h: "게임 방", sub: "문을 골라요. 게임마다 이야기 주인공이 진행해요. 매일 조금씩 놀아요.",
    doors: ["수수께끼 문", "진행: 칸칵. 계산하고 맞는 문을 골라요.", "매일 놀 수 있어요"], memory: ["기억력 게임", "진행: 카피. 짝을 모두 찾아요.", "매일 놀 수 있어요"] } };
const qs = new URLSearchParams(location.search); let lang = qs.get("lang"); if (!TR[lang]) { try { lang = localStorage.getItem("wst-lang"); } catch { lang = null; } } if (!TR[lang]) lang = "en";
const t = TR[lang], $ = s => document.querySelector(s), q = qs.has("lang") ? `?lang=${lang}` : "";
document.documentElement.lang = lang; document.title = t.h + " | Wonder of Saya Tales";
$("#gr-h").textContent = t.h; $("#gr-sub").textContent = t.sub; $("#gr-back").textContent = t.back; { const b = new URL($("#gr-back").href); if (q) b.searchParams.set("lang", lang); $("#gr-back").href = b; }  // back to the hall, in front of its door (?door=doors)
document.querySelectorAll(".gr-door").forEach(a => { const [n, d, p] = t[a.dataset.g === "doors" ? "doors" : "memory"]; a.href += q; a.querySelector("b").textContent = n; a.querySelector("small").textContent = d; a.querySelector("em").textContent = p; a.querySelector("img").alt = n; });
