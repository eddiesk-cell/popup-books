// narrate.js — the storyteller on the page. Plays a line's voice, lights each word as it is said, and
// shows the same line underneath in the child's own language. Reusable for any book voiced by
// tools/voice.py (one <id>.m4a per line plus timing.json: {id: {duration, words: [[start, end], ...]}}).
//
//   const r = new Reader(box, {voice: "kapi/voice/", timing, text: {id: "English..."}, subs: {id: {lo: "..."}}})
//   await r.say("1.1"); r.setLang("lo"); r.stop()

export class Reader {
  constructor(box, { voice, timing, text, subs, lang = "" }) {
    Object.assign(this, { box, voice, timing, text, subs, lang, audio: new Audio(), token: 0 });
    box.innerHTML = '<p class="en"></p><p class="sub"></p>';
    [this.en, this.sub] = box.children;
  }

  setLang(lang) { this.lang = lang; this.showSub(); }

  showSub() {
    const s = this.lang && this.subs[this.view]?.[this.lang];
    this.sub.textContent = s || ""; this.sub.lang = this.lang || "en";
  }

  // speak one line; resolves true when it has been read, false if something else took over
  // a line's words, all of them lit at once (Reading Mode: the child reads it), and its subtitle; nothing is said
  show(id, said = true) {
    this.view = id;
    this.en.innerHTML = this.text[id].split(" ").map(w => `<span${said ? ' class="said"' : ""}>${w}</span>`).join(" ");
    this.showSub();
    this.box.classList.add("show");
  }

  // `silent` (Reading Mode): the voice plays muted, so whatever follows its clock (acts, camera, lights) keeps time, and the words stay whole
  say(id) {
    this.audio.pause();
    const token = ++this.token, t = this.timing[id];
    this.id = id;
    this.show(id, !!this.silent);
    const spans = [...this.en.children];
    this.audio.muted = !!this.silent;
    this.audio.src = typeof this.voice === "function" ? this.voice(id) : `${this.voice}${id}.m4a`;  // voice: a folder, or id -> file (live.js: Lao or English per line)
    return new Promise(done => {
      const light = () => {
        if (token !== this.token) return done(false);
        const now = this.audio.currentTime;
        spans.forEach((s, i) => {
          s.classList.toggle("said", this.silent || now >= t.words[i][0]);
          s.classList.toggle("now", !this.silent && now >= t.words[i][0] && now < t.words[i][1]);
        });
        if (this.audio.ended) { spans.forEach(s => s.classList.add("said")); return done(true); }
        requestAnimationFrame(light);
      };
      this.audio.play().then(() => requestAnimationFrame(light), () => done(true));  // no sound allowed: show, don't hang
    });
  }

  async read(ids, pause = 450) {  // a page's lines, one after another; false if stopped part-way
    const run = this.runs = (this.runs || 0) + 1;
    for (const id of ids) {
      if (run !== this.runs || !(await this.say(id))) return false;
      await new Promise(r => setTimeout(r, pause));
    }
    return run === this.runs;
  }

  stop() { this.token++; this.runs = (this.runs || 0) + 1; this.audio.pause(); }
}
