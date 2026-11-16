// notice.js — the legal notice before every book (ACCOUNTS-MASTERPLAN.md, "The notice before every book"): a quiet gold-on-leather card on
// the title page (the reading language, the subtitle language under it), unspoken, gone after 4 s or a tap; the same text on the end card.
// notice.json holds the fixed sentence in five languages; the credit is the book's own (story.json "credit", translations.json "credit"),
// else notice.json's generic one.
const CSS = `#notice, #noticeEnd { font-size: 14px; line-height: 1.4; text-align: center; color: #f6e7c8; }
#notice { position: fixed; z-index: 7; left: 50%; translate: -50% 0; top: 62px; width: min(88vw, 30em); box-sizing: border-box; padding: 12px 16px; pointer-events: none;
  background: var(--leather, #2a1c14); border-radius: 8px; box-shadow: inset 0 0 0 2px var(--leather, #2a1c14), inset 0 0 0 3px var(--gold, #d9a441), 0 8px 22px #000a; transition: opacity .45s; }
#notice.gone { opacity: 0; } #notice p, #noticeEnd p { margin: 0; } #notice p + p, #noticeEnd p + p { margin-top: .5em; }
#notice .cr, #noticeEnd .cr { font-style: italic; color: #e8c877; font-size: .92em; } #notice .sub, #noticeEnd .sub { margin-top: .7em; padding-top: .7em; border-top: 1px solid #d9a44166; font-size: .95em; }
#noticeEnd { max-width: 34em; margin: 0 auto; padding: 0 16px; opacity: .8; font-size: 13px; }
.arriving #notice { visibility: hidden; }
@media (max-width: 560px) { #notice { top: 25vh; font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { #notice { transition: none; } }`;

export function makeNotice({ bookId, lib, story, getLang }) {
  const data = Promise.all([fetch("notice.json").then(r => r.json()), fetch(`${lib}translations.json`).then(r => r.json()).catch(() => ({}))]).catch(e => void console.warn("notice.json", e));
  const html = async () => {
    const [n, tr] = (await data) || []; if (!n) return "";
    if (!document.getElementById("noticeCss")) document.head.append(Object.assign(document.createElement("style"), { id: "noticeCss", textContent: CSS }));
    const t = story.origin === "original" ? n.original : n, lang = getLang(), block = l => {  // an original story (story.json "origin") says so and claims no folk tale
      const credit = l ? tr.credit?.[l] ?? (t === n ? n.credit[l] : "") : story.credit ?? (t === n ? n.credit[""] : "");  // the book's own credit; none in this language: the generic line in it
      return `<p>${t[l] ?? t[""]}</p>` + (credit ? `<p class="cr">${credit}</p>` : ""); };
    return block("") + (lang ? `<div class="sub" lang="${lang}">${block(lang)}</div>` : "");
  };
  return {
    async open() {  // the title page, first open of the book (a visit to the shelf's arrival waits until the book is on the desk)
      const h = await html(); if (!h) return;
      const el = Object.assign(document.createElement("div"), { id: "notice", innerHTML: h }); el.setAttribute("role", "note"); document.body.append(el);
      const gone = (now) => { clearTimeout(t); live = false; removeEventListener("pointerdown", gone, true); removeEventListener("keydown", gone, true); el.classList.add("gone"); now === true ? el.remove() : setTimeout(() => el.remove(), 500); };
      const place = () => { const r = document.getElementById("title"); r && !r.hidden && (el.style.top = `${Math.max(parseFloat(getComputedStyle(el).top), r.getBoundingClientRect().bottom + 10)}px`); };  // a phone's title above the book can run to two lines: the card sits under it
      // the notice and a story line never share the screen: the book opening (a turn by any road) takes the card away at once, and the page's auto-turn (live.auto, which waits 2.5 s on the closed page) is held until the card's own 4 s are done
      let t, t0, live = true; const keep = () => { if (!live) return; const L = window.live; if (L?.mode !== "closed") return gone(true); requestAnimationFrame(keep); const au = L.auto; au.on && au.t && (au.t = Math.max(au.t, t0 + 1500)); };  // shortcut: reaches live.auto.t from here; if live.js grows a hold for a splash, ask that instead
      const wait = setInterval(() => document.documentElement.classList.contains("arriving") || (clearInterval(wait), place(), (t = setTimeout(gone, 4000)), (t0 = performance.now()), requestAnimationFrame(keep), addEventListener("pointerdown", gone, true), addEventListener("keydown", gone, true)), 150);  // a tap is seen, never stopped: the page's own taps go on as before
    },
    async end(host) { const h = await html(); if (!h || host.querySelector("#noticeEnd")) return; host.append(Object.assign(document.createElement("div"), { id: "noticeEnd", innerHTML: h })); },
  };
}
