// readmode.js — Reading Mode (Eddie 2026-11-18, BOOK-STANDARD "Reading Mode; Auto and Reading skip games"): the child reads each
// line, taps "next", and only then is the line acted. The voice plays muted (narrate.js `silent`), so the acts, camera beats and
// light cues still follow its clock; the words show whole. live.js waits on next() before each line and skips the games.
// Controls: the Next pill by the words (or a tap on the words, Space, the right arrow); Back (the left arrow) shows the line before
// again, as the page now stands; on the page's last line Next turns the page.
const WORDS = {  // the button and controls in each subtitle language (reading.js LANGS): [mode, next line, back, next page]
  "": ["Read", "Next", "Back", "Next page"], lo: ["ອ່ານ", "ຕໍ່ໄປ", "ກັບຄືນ", "ໜ້າຕໍ່ໄປ"], th: ["อ่าน", "ถัดไป", "ย้อนกลับ", "หน้าถัดไป"],
  zh: ["阅读", "下一句", "上一句", "下一页"], ja: ["よむ", "つぎ", "もどる", "つぎのページ"] };

// reader: narrate.js Reader; live(): {sp, mode} now; lang(): the subtitle language; turn(): the page forward; changed(on): live.js's own switches
export function makeReadMode({ reader, live, lang, turn, changed }) {
  const $ = id => document.getElementById(id), btn = $("rmode"), nav = $("rnav"), back = $("rback"), next = $("rnext"), html = document.documentElement;
  let on = false, wait = null, view = 0, said = null;
  const lines = () => live().sp.page.lines;
  const cur = () => {  // the line the reader is on: the one waiting for "next", or the last once the page is read; null while a line is acted
    const { sp, mode } = live(); if (!sp || mode !== "open") return null;
    return wait?.sp === sp ? wait.i : sp.at >= lines().length ? lines().length - 1 : null;
  };
  const show = i => (reader.show(lines()[(view = i)]), true);
  const go = () => { const w = wait; wait = null; w.done(true); return true; };
  const forward = () => { const c = cur(); return c == null ? false : view < c ? show(view + 1) : wait ? go() : (turn(), true); };
  const backward = () => { const c = cur(); return c != null && view > 0 && show(view - 1); };
  const set = v => {
    on = v; reader.silent = v; reader.audio.muted = v; html.classList.toggle("readmode", v); btn.setAttribute("aria-pressed", v);
    try { localStorage.setItem("popup-read", v ? "1" : "0"); } catch { /* not remembered */ }
    if (!v && wait) go();  // off while a line waits: it is read aloud now, as before
    changed(v);
  };
  btn.onclick = () => (set(!on), btn.blur());  // blurred: Space is "next" now, never this button again
  next.onclick = forward; back.onclick = backward;
  for (const b of [btn, nav]) b.onpointerdown = e => e.stopPropagation();  // never a page turn under it
  addEventListener("click", e => on && e.target.closest?.(".ra-page, #read") && forward());  // a tap on the words reads on

  (function frame() {  // the controls: under the words (the read-along page, else the bar's own), their labels, and where the reader is
    requestAnimationFrame(frame);
    const L = lang(); if (L !== said) { said = L; btn.lastChild.textContent = (WORDS[L] ?? WORDS[""])[0]; back.setAttribute("aria-label", (WORDS[L] ?? WORDS[""])[2]); }
    const { sp, mode } = live(), shown = on && mode === "open" && !!sp && $("bar").classList.contains("on");
    nav.hidden = !shown; if (!shown) return;
    const c = cur(), W = WORDS[L] ?? WORDS[""], label = W[c != null && !wait && view >= c ? 3 : 1];
    if (next.firstChild.textContent !== label) next.firstChild.textContent = label;
    next.disabled = c == null; back.disabled = c == null || view <= 0;
    const ra = html.classList.contains("ra-on") && document.querySelector(".ra-page.show"), r = (ra || $("read")).getBoundingClientRect(), h = nav.offsetHeight;
    Object.assign(nav.style, { left: `${r.left}px`, width: `${r.width}px`, top: `${ra ? r.bottom + 2 : r.top - h - 6}px` });
    [...$("dots").children].forEach((d, j) => d.classList.toggle("look", c != null && j === view && view < c));  // the line shown again, when Back took the reader there
  })();

  let want = null; try { want = localStorage.getItem("popup-read"); } catch { /* not remembered */ }
  const q = new URLSearchParams(location.search);
  set((q.get("read") ?? (q.get("auto") === "1" ? "0" : want)) === "1");
  return {
    get on() { return on; },
    off: () => on && set(false),
    next(sp, i, still) {  // line i's words, whole, until the reader says "next": true; false once the reading has moved on (a turn, Read again)
      show(i); wait?.done(false);  // a wait still pending (Read again) lets its reading go
      return new Promise(done => {
        wait = { sp, i, done };
        const poll = () => wait?.done !== done ? 0 : still() ? setTimeout(poll, 100) : ((wait = null), done(false));
        poll();
      });
    },
    key(e) {  // Space and the right arrow: next; the left arrow: back (from the first line it turns the page back, as before); while a line is acted neither turns
      if (!on || live().mode !== "open") return false;
      if (e.key === " " || e.key === "ArrowRight") return e.preventDefault(), e.repeat || forward(), true;  // a held key reads one line, not the page
      if (e.key !== "ArrowLeft" || (view === 0 && cur() != null)) return false;  // the first line's back is the page's
      return e.preventDefault(), backward(), true;
    },
  };
}
