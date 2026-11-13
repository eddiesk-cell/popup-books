// readalong.js: the words float over the scene on a see-through magic page, and each word glows as the
// storyteller says it, so a child can read along. A pure overlay: it watches a narrate.js Reader box (its word
// spans and their said/now classes) and never touches the book's code. The book button turns it on or off,
// and the choice is remembered for each reader.
//
//   <script src="../readalong.js" data-source="#read" data-theme="firefly" defer></script>
//   themes: firefly (Kapi), lantern (Mali). Preview another theme with ?readalong=lantern
//   the host page may move things out of its own controls' way: --ra-top, --ra-btn-top, --ra-btn-left (CSS vars),
//   and may add class "ra-dim" to <html> to fade the page while something important is behind it
(() => {
  const me = document.currentScript, source = me.dataset.source || ".rd";
  const theme = new URLSearchParams(location.search).get("readalong") || me.dataset.theme || "firefly";
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const remembered = () => { try { return localStorage.getItem("readalong") !== "off"; } catch { return true; } };
  const remember = on => { try { localStorage.setItem("readalong", on ? "on" : "off"); } catch {} };

  // Andika (SIL, drawn for children learning to read), self-hosted beside this script under the Open Font License
  document.head.insertAdjacentHTML("beforeend",
    `<link rel="stylesheet" href="${new URL("fonts/andika/andika.css", me.src)}">`);
  const style = document.createElement("style");
  style.textContent = `
  .ra-page { position: fixed; z-index: 50; left: 0; right: 0; top: var(--ra-top, max(12vh, 80px)); margin: auto; width: min(88vw, 30em);
    box-sizing: border-box; padding: .55em 1.2em .65em; border-radius: 1.1em; text-align: center; pointer-events: none;
    font: clamp(19px, 1.3vw + 1.3vh, 36px)/1.45 Andika, "Trebuchet MS", system-ui, sans-serif; word-spacing: .08em;
    color: var(--ink); background: var(--glass); border: 1px solid var(--edge);
    -webkit-backdrop-filter: blur(10px) saturate(1.3); backdrop-filter: blur(10px) saturate(1.3);
    box-shadow: 0 .4em 2.2em #0007, inset 0 0 1.4em var(--inner);
    opacity: 0; scale: .96; transition: opacity .5s, scale .5s; animation: ra-float 7s ease-in-out infinite; }
  .ra-page.show { opacity: 1; scale: 1; }
  /* something important is behind the page: only the glass steps aside; the words stay whole, with a soft halo */
  html.ra-dim .ra-page.show { background: none; border-color: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
  html.ra-dim .ra-page::before { opacity: 0; }
  html.ra-dim .ra-page { --outline: 0 0 1px var(--halo), 0 0 2px var(--halo), 0 0 3px var(--halo), 0 0 6px var(--halo), 0 0 12px var(--halo); }
  html.ra-dim .ra-page span:not(.now), html.ra-dim .ra-sub { text-shadow: var(--outline); }  /* a tight outline, so the words hold over a busy painting */
  html.ra-dim .ra-en .now { text-shadow: var(--outline), var(--glow); }
  html.ra-dim .ra-en .said { opacity: 1; }
  html:not(.ra-on) .ra-page { display: none; }
  html.ra-on :is(${source}) :is(.en, .sub) { opacity: 0 !important; }  /* the book's own words step aside (screen readers keep them) */
  .ra-page::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: radial-gradient(60% 40% at 50% 0%, var(--shine), transparent 70%); }
  .ra-page p { margin: 0; position: relative; }
  .ra-en span { display: inline-block; }  /* the glow leaves at once, so only one word ever shines */
  .ra-en .said { color: var(--said); opacity: .78; }  /* read words step back a little: the child keeps their place */
  .ra-en .now { color: var(--now); opacity: 1; text-shadow: var(--glow); transform: translateY(-.07em) scale(1.08);
    transition: color .12s, text-shadow .12s, transform .12s; }
  .ra-sub { font-size: .68em; margin-top: .2em !important; opacity: .9; }
  .ra-sub:empty { display: none; }
  .ra-spark { position: absolute; width: .3em; height: .3em; margin: -.15em; border-radius: 50%; pointer-events: none;
    background: radial-gradient(var(--spark), transparent 70%); animation: ra-spark .9s ease-out forwards; }
  .ra-btn { position: fixed; z-index: 51; top: var(--ra-btn-top, 12px); left: var(--ra-btn-left, 12px); width: 46px; height: 46px; padding: 9px; border-radius: 50%;
    cursor: pointer; color: var(--now); background: var(--glass); border: 1px solid var(--edge); box-shadow: 0 2px 10px #0006;
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .ra-btn[aria-pressed="false"] { opacity: .55; filter: grayscale(1); }
  .ra-btn:focus-visible { outline: 3px solid var(--now); outline-offset: 3px; }
  @keyframes ra-float { 50% { transform: translateY(-5px); } }
  @keyframes ra-spark { to { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.3); } }
  @media (prefers-reduced-motion: reduce) { .ra-page { animation: none; } .ra-en .now { transform: none; } }
  /* a sideways phone: height is scarce and width is not, so the page goes wide and short to keep the scene clear */
  @media (orientation: landscape) and (max-height: 500px) { .ra-page { top: var(--ra-top, 60px); width: 88vw; line-height: 1.3; padding: .35em 1.1em .45em; }
    .ra-en { white-space: nowrap; } .ra-en.ra-wrap { white-space: normal; } }  /* one line, its font fitted to the width (fit()); past the 15 px floor it may wrap */
  [data-theme="firefly"] { --ink: #fbf4dd; --said: #fff1c2; --now: #ffe27a; --spark: #fff7a8; --shine: #d8ffc420;
    --glow: 0 0 .25em #ffd54a, 0 0 .8em #ffb300aa; --edge: #d6ffc438; --inner: #aaffaa14;
    --glass: linear-gradient(160deg, #0e281eb8, #08161ab8); --halo: #04100c; }
  [data-theme="lantern"] { --ink: #3b2412; --said: #5a3010; --now: #7a2600; --spark: #ffb347; --shine: #ffffff66;
    --glow: 0 0 .3em #ffcf6b, 0 0 .9em #ffa53a; --edge: #a05a1e59; --inner: #ffc87859;
    --glass: linear-gradient(170deg, #fff4dedb, #f7deb8d1); --halo: #fff4de; }`;
  document.head.append(style);

  const page = document.createElement("div"), btn = document.createElement("button");
  page.className = "ra-page"; page.dataset.theme = btn.dataset.theme = theme;
  page.setAttribute("aria-hidden", "true");  // a copy of the Reader box, which stays in place for screen readers
  page.innerHTML = '<p class="ra-en"></p><p class="ra-sub"></p>';
  const [en, sub] = page.children;
  btn.className = "ra-btn"; btn.setAttribute("aria-label", "Words on the page");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
    '<path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5v13"/></svg>';
  const set = on => {
    document.documentElement.classList.toggle("ra-on", on); btn.setAttribute("aria-pressed", on); remember(on);
    if (!on) page.querySelectorAll(".ra-spark").forEach(s => s.remove());  // hidden sparks never finish their animation
  };
  btn.onclick = () => { set(!document.documentElement.classList.contains("ra-on")); fit(); };  // shown again: fitted to the width it has now
  btn.onpointerdown = e => e.stopPropagation();  // a tap on the button is never a page turn
  document.body.append(page, btn);
  set(remembered());

  const sparkle = w => {
    if (calm.matches || !document.documentElement.classList.contains("ra-on")) return;  // hidden page: no sparkles piling up
    const p = page.getBoundingClientRect(), r = w.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const s = document.createElement("i");
      s.className = "ra-spark"; s.onanimationend = () => s.remove();
      s.style.cssText = `left:${r.left - p.left + Math.random() * r.width}px;top:${r.top - p.top + Math.random() * r.height}px;` +
        `--dx:${(Math.random() - .5) * 2}em;--dy:${-.6 - Math.random()}em`;
      page.append(s);
    }
  };

  const sideways = matchMedia("(orientation: landscape) and (max-height: 500px)");
  const fit = () => {  // a sideways phone: one line, the font shrunk to the width, never under 15 px (then it wraps)
    page.style.fontSize = ""; en.classList.remove("ra-wrap");
    if (!sideways.matches || en.scrollWidth <= en.clientWidth) return;
    const px = parseFloat(getComputedStyle(page).fontSize) * en.clientWidth / en.scrollWidth;
    page.style.fontSize = `${Math.max(15, Math.floor(px * 10) / 10)}px`;
    if (px < 15) en.classList.add("ra-wrap");
  };
  addEventListener("resize", fit); document.fonts?.ready.then(fit);
  let text = "";
  const sync = box => {  // copy the Reader's words and which one is being said
    const words = [...box.querySelectorAll(".en span")], t = words.map(w => w.textContent).join(" ");
    if (t !== text) {
      text = t;
      en.replaceChildren(...words.flatMap((w, i) => [i ? " " : "", Object.assign(document.createElement("span"), { textContent: w.textContent })]));
      fit();
    }
    const s = box.querySelector(".sub");
    sub.textContent = s?.textContent || ""; sub.lang = s?.lang || "";
    [...en.children].forEach((w, i) => {
      const now = words[i].classList.contains("now");
      if (now && !w.classList.contains("now")) sparkle(w);
      w.classList.toggle("now", now); w.classList.toggle("said", words[i].classList.contains("said"));
    });
    page.classList.toggle("show", box.classList.contains("show") && !!t);
  };
  const watch = new MutationObserver(ms => sync(ms.at(-1).target.closest?.(source) || ms.at(-1).target.parentElement.closest(source)));
  document.querySelectorAll(source).forEach(b => watch.observe(b, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "lang"] }));
})();
