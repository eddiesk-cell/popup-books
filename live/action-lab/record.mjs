// record.mjs: films an action slice of index.html frame by frame at 60 fps (the page's own clock, lab.renderAt(t)), mixes its sound cues, writes the mp4 and a 12-frame strip.
//   node web/live/action-lab/record.mjs <slice> <wide|tall|WxH> [--probe] [--still t1,t2] [--fps 60] [--out renders/review/action-slices]
//   node web/live/action-lab/record.mjs sheet <kapi|ox> --clips a,b,c [--out dir]   one sheet-<who>-<clip>.png a clip (8 frames, front over side) + sheets.json
// Runs on the desk (sandbox off) or on the Studio: tools/studio.sh run ../web/live/action-lab/record.mjs hit wide  (Metal there, SwiftShader on the desk)
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { execFileSync } from "node:child_process";
import { serve } from "../../../tools/camera_lib.mjs";
const ROOT = path.resolve(import.meta.dirname, "../../.."), HERE = import.meta.dirname, studio = os.homedir() !== "/Users/eddie";
const { chromium } = await import(studio ? `${os.homedir()}/popup-studio/node_modules/playwright-core/index.mjs` : "/Users/eddie/tmp_pw/node_modules/playwright-core/index.mjs");
const a = process.argv.slice(2), opt = (n, d) => { const i = a.indexOf(n); return i < 0 ? d : a.splice(i, 2)[1]; }, has = n => { const i = a.indexOf(n); return i >= 0 && a.splice(i, 1); };
const clipsOpt = opt("--clips"), probe = has("--probe"), still = opt("--still"), fps = +opt("--fps", 60), outDir = path.resolve(ROOT, opt("--out", "renders/review/action-slices")), [slice, fmt = "wide"] = a;
const [W, H] = slice === "sheet" ? [1600, 560] : /^\d+x\d+$/.test(fmt) ? fmt.split("x").map(Number) : fmt === "tall" ? [1080, 1920] : [1920, 1080], port = +process.env.CAM_PORT || 9100 + Math.floor(Math.random() * 800), tag = `${slice}-${fmt}`;
const server = await serve(ROOT, port), tmp = fs.mkdtempSync(path.join(os.tmpdir(), `lab-${tag}-`));
const browser = await chromium.launch({ channel: "chrome", headless: true, args: [studio ? "--use-angle=metal" : "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], failed = [];
try {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  page.on("pageerror", e => errors.push(e.message.slice(0, 300))); page.on("console", m => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("requestfailed", r => failed.push(r.url())); page.on("response", r => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  await page.goto(`http://127.0.0.1:${port}/web/live/action-lab/index.html?slice=${slice}&w=${W}&h=${H}${process.env.LAB_Q ? "&" + process.env.LAB_Q : ""}`, { timeout: 120000 });
  const dead = new Promise((_, no) => page.on("pageerror", e => no(new Error(`page error: ${e.message.slice(0, 300)}`))));  // fail at once, never wait out the timeout
  await Promise.race([page.waitForFunction(() => window.lab?.ready || null, null, { timeout: 240000 }), dead]);
  fs.mkdirSync(outDir, { recursive: true });
  if (clipsOpt) {  // clip sheets: fmt is who
    const all = {};
    for (const clip of clipsOpt.split(",")) { all[clip] = await page.evaluate(([w, c]) => window.lab.sheet(w, c), [fmt, clip]); await page.screenshot({ path: path.join(outDir, `sheet-${fmt}-${clip}.png`) }); }
    fs.writeFileSync(path.join(outDir, `sheets-${fmt}.json`), JSON.stringify(all, null, 1)); console.log(JSON.stringify({ sheets: Object.keys(all).length, errors, failed }));
  } else if (process.env.LAB_LEAKS) { const r = await page.evaluate(() => window.lab.leaks()); fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, `leaks-${tag}.json`), JSON.stringify(r, null, 1)); console.log(JSON.stringify({ leaks: { worst: r.worst, roomFrames: r.roomFrames } }));
  } else if (process.env.LAB_IMPACTS) { const r = await page.evaluate(() => window.lab.impacts()); fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, `impacts-${tag}.json`), JSON.stringify(r, null, 1));
    for (const [i, im] of r.entries()) { await page.evaluate(([T, p]) => window.lab.mark(T, p), [im.film + 2 / 60, [[...im.contact, "contact"], [...im.fx, "fx"]]]); await page.screenshot({ path: path.join(outDir, `impact-${tag}-${i}.jpg`), type: "jpeg", quality: 85 }); }
    console.log(JSON.stringify({ impacts: r, errors, failed }));
  } else if (process.env.LAB_HANDS) { const r = await page.evaluate(() => window.lab.handSheet()); fs.mkdirSync(outDir, { recursive: true }); await page.screenshot({ path: path.join(outDir, `hands-${slice}.png`), clip: { x: 0, y: 0, width: 1920, height: 240 } }); fs.writeFileSync(path.join(outDir, `hands-${slice}.json`), JSON.stringify(r, null, 1)); console.log(JSON.stringify({ hands: r, errors, failed }));
  } else if (process.env.LAB_AIR) { const r = await page.evaluate(w => window.lab.airSheet(w), process.env.LAB_AIR); await page.screenshot({ path: path.join(outDir, `air-${slice}-${process.env.LAB_AIR}.png`), clip: { x: 0, y: 0, width: 1920, height: 300 } }); console.log(JSON.stringify({ air: r }));
  } else if (process.env.LAB_TRACE) { console.log(JSON.stringify({ trace: await page.evaluate(() => window.lab.trace()) }));
  } else if (probe) { console.log(JSON.stringify(await page.evaluate(() => ({ info: window.lab.info, probe: window.lab.probe() })))); }
  else if (still) {  // single frames, for looking while building
    for (const t of still.split(",")) { await page.evaluate(t => window.lab.renderAt(t), +t); await page.screenshot({ path: path.join(outDir, `still-${tag}${process.env.LAB_TAG || ""}-${t}.jpg`), type: "jpeg", quality: 88 }); }
    console.log(JSON.stringify({ stills: still, errors, failed }));
  } else {
    const { dur, cues } = await page.evaluate(() => ({ dur: window.lab.dur, cues: window.lab.cues })), N = Math.round(dur * fps), ms = [];
    await page.evaluate(() => window.lab.renderAt(0));  // warm-up: shaders compile here, as a viewer would behind its loading cover
    for (let i = 0; i < N; i++) {
      ms.push(await page.evaluate(t => window.lab.renderAt(t), i / fps));
      await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 90 });
    }
    const mp4 = path.join(outDir, `${tag}.mp4`), cmd = ["-y", "-framerate", String(fps), "-i", path.join(tmp, "f%05d.jpg")], sfx = path.join(HERE, "sfx");
    const ins = cues.filter(([n]) => fs.existsSync(path.join(sfx, `${n}.wav`)));
    for (const [n] of ins) cmd.push("-i", path.join(sfx, `${n}.wav`));
    if (ins.length) {  // every cue at its frame time, at its own gain; a soft limiter on the sum
      const fc = ins.map(([, t, g = 1], k) => `[${k + 1}:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},volume=${g}[a${k}]`).join(";")
        + `;${ins.map((_, k) => `[a${k}]`).join("")}amix=inputs=${ins.length}:normalize=0,alimiter=limit=0.9,apad=whole_dur=${dur}[aud]`;
      cmd.push("-filter_complex", fc, "-map", "0:v", "-map", "[aud]", "-c:a", "aac", "-b:a", "192k", "-t", String(dur));
    }
    cmd.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart", mp4);
    execFileSync("ffmpeg", cmd, { stdio: "ignore" });
    const pick = Array.from({ length: 12 }, (_, k) => Math.min(N - 1, Math.round((k + 0.5) * N / 12)));  // 12 frames, evenly through the slice
    // the strip: 12 frames, evenly through the slice, tiled by ffmpeg (no python imaging needed on the Studio); their times go in the log line
    execFileSync("ffmpeg", ["-y", "-i", path.join(tmp, "f%05d.jpg"), "-vf", `select='${pick.map(i => `eq(n,${i})`).join("+")}',scale=${W > H ? 480 : 270}:-2,tile=${W > H ? "6x2" : "12x1"}`, "-frames:v", "1", "-q:v", "3", path.join(outDir, `${tag}-strip.jpg`)], { stdio: "ignore" });
    ms.sort((x, y) => x - y);
    console.log(JSON.stringify({ mp4, strip_s: pick.map(i => +(i / fps).toFixed(2)), frames: N, fps, sound: ins.length, frame_ms: { avg: +(ms.reduce((s, x) => s + x, 0) / N).toFixed(1), p99: +ms[Math.floor(N * 0.99)].toFixed(1), worst: +ms[N - 1].toFixed(1) }, errors, failed, gpu: studio ? "metal" : "swiftshader" }));
  }
} finally {
  await browser.close().catch(() => {}); server.closeAllConnections?.(); server.close();
  try { fs.renameSync(tmp, path.join(os.homedir(), ".Trash", path.basename(tmp))); } catch {}  // frames to the Trash, never rm
}
