// paperswap.js: a spread whose spread.json names "paperStatic" {merged, hide} (tools/glb_paper.py) draws its still paper as a few merged
// meshes from the frame the page has opened, and as the single animated cards while it turns. A viewer hook: no change to live.js.
const wait = setInterval(() => {
  const L = window.live; if (!L?.hooks) return; clearInterval(wait);
  L.hooks.push({ frame() {
    const S = L.S, p = S?.m?.paperStatic; if (!p) return;
    S.paperObjs ??= [p.merged, p.hide].map(l => l.map(n => S.root.getObjectByName(n)).filter(Boolean));
    const on = L.frame >= S.T1; if (S.paperOn === on) return;
    S.paperOn = on; S.paperObjs[0].forEach(o => (o.visible = on)); S.paperObjs[1].forEach(o => (o.visible = !on));
  } });
}, 50);
