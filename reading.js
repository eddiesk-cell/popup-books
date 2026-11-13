// reading.js — the reading glue both players share (book.js, the pre-rendered book; live/live.js, the live 3D one):
// the story's words and subtitles for the Reader, the language buttons, the characters' touch lines, and the iPad
// sound unlock.
//
//   const words = await loadWords(base, book)        // {story, tr, timing, text, subs}, files named by book.json
//   const setLang = languages($("langs"), "kapi.lang", l => reader.setLang(l))
//   const said = touchLine(words, "kapi", lang)       // {id, text, sub} the next thing Kapi says when tapped, or null
//   unlock(reader.audio, sfx)                         // inside the first tap: iPad then lets these play later
export const LANGS = [["", "English only"], ["lo", "ລາວ"], ["th", "ไทย"], ["zh", "中文"], ["ja", "日本語"]];

const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });

export async function loadWords(base, { story, translations, timing }) {
  const [s, tr, t] = await Promise.all([story, translations, timing].map(f => json(base + f)));
  const text = {}, subs = { ...tr.lines };
  for (const l of [...s.spreads.flatMap(sp => sp.lines), ...s.moral, ...(s.game || [])]) text[l.id] = l.text;  // game: voiced prompts (game.N.start/praise)
  for (const [who, a] of Object.entries(s.touch)) a.forEach((w, i) => { text[`touch.${who}.${i}`] = w; subs[`touch.${who}.${i}`] = tr.touch?.[who]?.[i]; });
  return { story: s, tr, timing: t, text, subs };
}

export function languages(el, key, onSet) {  // the subtitle buttons; the choice is remembered per book
  el.innerHTML = LANGS.map(([k, n]) => `<button data-l="${k}" lang="${k || "en"}">${n}</button>`).join("");
  const set = l => {
    [...el.children].forEach(b => b.setAttribute("aria-pressed", b.dataset.l === l));
    try { localStorage.setItem(key, l); } catch {}
    onSet(l);
  };
  el.onclick = e => e.target.dataset.l != null && set(e.target.dataset.l);
  let l = ""; try { l = localStorage.getItem(key) || ""; } catch {}
  set(l);
  return set;
}

const last = {};
export function touchLine({ story, tr }, who, lang) {  // a different line each tap, never the same twice running
  const said = story.touch[who];
  if (!said) return null;
  const j = last[who] = ((last[who] ?? -1) + 1 + Math.floor(Math.random() * Math.max(1, said.length - 1))) % said.length;
  return { id: `touch.${who}.${j}`, text: said[j], sub: (lang && tr.touch?.[who]?.[j]?.[lang]) || "" };
}

const hush = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
export const unlock = (...audios) => audios.forEach(a => { a.src = hush; a.play().then(() => a.pause(), () => {}); });
