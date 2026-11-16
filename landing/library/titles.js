// titles.js: a book's title laid out like a printed cover, always in English (owner 2026-11-15: "the title of the book, shouldn't be translated... only in subtitle we translate"):
// the small words (the, and, of, a ...) small and italic in the body font, the names large in the head font, every line sized to fill the width; in another language the visitor's own title sits beneath as one small upright subtitle.
const CJK = '"Noto Sans Lao", "Thonburi", "Noto Sans Thai", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Georgia, serif';
export const HEAD = `"Cormorant Garamond", ${CJK}`, BODY = `"EB Garamond", ${CJK}`;
// every face the canvas text uses, Lao included (Lao only in Noto Sans Lao: the canvases redraw once these are in, so a late font is never left in a fallback face)
export const fontsReady = document.fonts ? Promise.all(['500 16px "Cormorant Garamond"', '400 16px "EB Garamond"', 'italic 400 16px "EB Garamond"', '400 16px "Noto Sans Lao"'].map(f => document.fonts.load(f, "Aaລາວ").catch(() => {}))) : Promise.resolve();
const SMALL = new Set(["the", "and", "of", "a", "an", "in", "on", "to", "for", "with"]);
export function titleLines(title, lang = "en") {
  const t = String(title).trim(), w = t.split(/\s+/); if (lang !== "en" || w.length < 2) return [{ t, big: true }];
  const out = []; for (const x of w) { const big = !SMALL.has(x.toLowerCase()), l = out.at(-1); if (l && l.big === big) l.t += " " + x; else out.push({ t: x, big }); }
  return out;
}
// draw into ctx x: centred on cx, inside the box (top, w, h); maxBig caps a big line's size; sub = the translated title (or "")
export function drawTitle(x, title, lang, cx, top, w, h, { color = "#f0cd7c", maxBig = 80, sub = "" } = {}) {
  let L = titleLines(title, lang); const bigF = s => `500 ${s}px ${HEAD}`, smallF = s => `italic 400 ${s}px ${BODY}`, subF = s => `400 ${s}px ${BODY}`, wid = (t, f) => (x.font = f, x.measureText(t).width);
  const fit = l => Math.min(maxBig, w / wid(l.t, bigF(100)) * 100);
  if (L.length === 1 && fit(L[0]) < maxBig * .55) {  // one tiny line: break it in two at the word boundary nearest its middle (Thai and Chinese have no spaces, so words come from Intl.Segmenter)
    const t = L[0].t, ws = [...new Intl.Segmenter(lang, { granularity: "word" }).segment(t)].map(s => s.index).filter(i => i > 0), cut = ws.sort((a, b) => Math.abs(a - t.length / 2) - Math.abs(b - t.length / 2))[0];
    if (cut) L = [{ t: t.slice(0, cut).trim(), big: true }, { t: t.slice(cut).trim(), big: true }];
  }
  const bigs = L.filter(l => l.big).map(fit), base = bigs.reduce((a, b) => a + b, 0) / bigs.length, sz = L.map(l => l.big ? fit(l) : Math.min(base * .45, w / wid(l.t, smallF(100)) * 100)), gap = i => sz[i] * 1.08;
  const ss = sub ? Math.min(base * .4, w / wid(sub, subF(100)) * 100) : 0, subH = ss * 1.7;  // the subtitle's slot leaves room for Thai and Lao tone marks
  const tot = sz.reduce((a, s, i) => a + gap(i), 0) + subH, k = Math.min(1, h / tot); let y = top + (h - tot * k) / 2;
  x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "middle";
  L.forEach((l, i) => { const s = sz[i] * k; y += gap(i) * k / 2; x.font = l.big ? bigF(s) : smallF(s); x.fillText(l.t, cx, y, w); y += gap(i) * k / 2; });
  if (sub) { x.font = subF(ss * k); x.fillText(sub, cx, y + subH * k * .55, w); }
}
// the same for HTML: the small words get an <i>, the translated title a <small> (styled in library.css)
export function titleNodes(title, sub = "", lang = "en") { const f = document.createDocumentFragment(); titleLines(title).forEach((l, i) => { if (i) f.append(" "); if (l.big) f.append(l.t); else { const e = document.createElement("i"); e.textContent = l.t; f.append(e); } });
  if (sub) { const e = document.createElement("small"); e.textContent = sub; e.lang = lang; f.append(e); } return f; }
