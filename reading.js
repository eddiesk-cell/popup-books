// reading.js — the reading glue both players share (book.js, the pre-rendered book; live/live.js, the live 3D one):
// the story's words and subtitles for the Reader, the language buttons, the characters' touch lines, and the iPad
// sound unlock.
//
//   const words = await loadWords(base, book)        // {story, tr, timing, text, subs}, files named by book.json
//   const setLang = languages($("langs"), "kapi.lang", l => reader.setLang(l))
//   const said = touchLine(words, "kapi", lang, spread) // {id, text, sub, words} the next thing Kapi (or a tapped THING: "tree", "frog-1", "fruit") says, or null.
//                                                        // `spread` ("s03" or "mali-s03") keeps lines that are only true on other spreads out; web/<book>/words.json, else story.json "touch"
//   unlock(reader.audio, sfx)                         // inside the first tap: iPad then lets these play later
export const LANGS = [["", "English only"], ["lo", "ລາວ"], ["th", "ไทย"], ["zh", "中文"], ["ja", "日本語"]];

const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });

export async function loadWords(base, { story, translations, timing }) {
  const opt = u => json(u).catch(() => null);  // tap-to-learn words are optional: web/<book>/words.json and voice/words/timing.json
  const [s, tr, t] = await Promise.all([story, translations, timing].map(f => json(base + f)));
  const [w, wt] = s.words === false ? [null, null] : await Promise.all([opt(base + "words.json"), opt(base + timing.replace(/timing\.json$/, "words/timing.json"))]);  // story.json "words": false: the book has no tap-to-learn words, so ask for none (a 404 is a failed request on the published site)
  const text = {}, subs = { ...tr.lines };
  for (const l of [...s.spreads.flatMap(sp => sp.lines), ...s.moral, ...(s.game || [])]) text[l.id] = l.text;  // game: voiced prompts (game.N.start/praise)
  for (const [who, a] of Object.entries(s.touch)) a.forEach((w, i) => { text[`touch.${who}.${i}`] = w; subs[`touch.${who}.${i}`] = tr.touch?.[who]?.[i]; });
  return { story: s, tr, timing: t, text, subs, w, wt };
}

export const SUB_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M7 11.2h4M13.4 11.2h3.6M7 15h6.6M16 15h1"/></svg>';
export function picker(el, items, key, onSet, { icon, label, lit = v => !!v, fallback = "" }) {  // a small round button that opens its list (owner: one button, then pick); items [[value, name, lang]], the choice kept under key
  el.style.cssText += ";position:relative;overflow:visible;flex:0 0 auto";  // the list hangs under the button
  el.innerHTML = `<button class="sub" aria-haspopup="true" aria-expanded="false" aria-label="${label}" title="${label}">${icon}</button><div class="sublist" style="display:none;position:absolute;top:100%;right:0;margin-top:6px;gap:4px;padding:6px;border-radius:14px;background:#17100cf5;box-shadow:0 6px 18px #0009">${items.map(([k, n, l]) => `<button data-l="${k}" lang="${l}">${n}</button>`).join("")}</div>`;
  const [sub, list] = el.children, open = on => { list.style.display = on ? "grid" : "none"; sub.setAttribute("aria-expanded", on);
    if (on) { list.style.left = "auto"; list.style.right = "0"; if (list.getBoundingClientRect().left < 8) list.style.left = "0", list.style.right = "auto"; } };  // a list that would leave the screen hangs the other way
  const set = l => {
    [...list.children].forEach(b => b.setAttribute("aria-pressed", b.dataset.l === l));
    sub.setAttribute("aria-pressed", !!lit(l));  // lit while it is not the default
    try { localStorage.setItem(key, l); } catch {}
    onSet(l);
  };
  el.onclick = e => { const b = e.target.closest("button"); if (b?.dataset.l != null) set(b.dataset.l), open(false); else if (b === sub) open(list.style.display === "none"); };  // the button holds an icon: its svg is the target
  el.onkeydown = e => e.key === "Escape" && (open(false), sub.focus());
  addEventListener("pointerdown", e => el.contains(e.target) || open(false), true);  // a tap anywhere else closes the list
  let l = fallback; try { l = localStorage.getItem(key) ?? fallback; } catch {}
  set(items.some(([k]) => k === l) ? l : fallback);
  return set;
}
export const languages = (el, key, onSet) => picker(el, LANGS.map(([k, n]) => [k, k ? n : "No subtitles", k || "en"]), key, onSet, { icon: SUB_ICON, label: "Subtitles" });  // the subtitle language, remembered per book

const last = {}, bags = {};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function touchLine({ story, tr, w, wt }, who, lang, spread = "") {
  // a shuffle bag per (pool, spread): every line that is true here is said once before any is said again, and the first of a new round is never the last of the old one.
  // The FIRST tap on a pool is always its line 0 (the thing's name, the character's greeting): the bag is shuffled without it and line 0 goes on the end, which is drawn first.
  const sp = String(spread).replace(/^.*-(?=s\d+$|moral$)/, ""), kind = w?.maps?.[sp]?.[who] ?? w?.map?.[who] ?? w?.map?.[String(who).replace(/-?\d+$/, "")], key = w?.chars?.[who] ? who : kind, pool = w?.chars?.[who] ?? w?.pools?.[kind];
  const ok = pool?.filter(id => !w.lines[id].sp || w.lines[id].sp.includes(sp));
  if (ok?.length) {
    const b = bags[`${key}|${sp}`] ??= { left: [], used: false };
    if (!b.left.length) {
      b.left = shuffle([...ok]);
      if (!b.used) b.left.push(b.left.splice(b.left.indexOf(ok[0]), 1)[0]);  // the first round: line 0 is drawn first
      else if (b.left.length > 1 && b.left.at(-1) === last[key]) [b.left[0], b.left[b.left.length - 1]] = [b.left.at(-1), b.left[0]];
      b.used = true;
    }
    const id = last[key] = b.left.pop(), l = w.lines[id];
    const wd = w.word?.[key]; return { id: `words/${id}`, text: l.en, sub: (lang && l[lang]) || "", tag: l.tag, word: wd && { text: wd.en, sub: (lang && wd[lang]) || "" }, words: wt?.[id]?.words, duration: wt?.[id]?.duration };
  }
  const said = story.touch[who];  // no words.json for this one: the book's own few lines, never the same twice running
  if (!said) return null;
  const j = last[who] = ((last[who] ?? -1) + 1 + Math.floor(Math.random() * Math.max(1, said.length - 1))) % said.length;
  return { id: `touch.${who}.${j}`, text: said[j], sub: (lang && tr.touch?.[who]?.[j]?.[lang]) || "" };
}

const hush = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";  // a tenth of a second of silence: an empty file may not count as played on iOS
export const unlock = (...audios) => Promise.all(audios.map(a => { a.src = hush; return a.play().then(() => (a.src === hush && a.pause(), true), () => false); }));  // true per voice let play; a line set while the hush played keeps playing
