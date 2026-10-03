import { VW, VH } from "../config.js";
import { txt } from "../view/assets/fonts.js";
import { chronicle } from "../content/chronicle.js";
import { sfx, music, setListener } from "../audio/engine.js";

const AFTER =
  "https://cyberspace.online/sajuuk/take-a-break-yall-deserve-it-gang-d";

const W = VW - 12,
  LINE = 9,
  TYPE = 38,
  HOLD = 2.6;

export class Ending extends Phaser.Scene {
  constructor() {
    super("ending");
  }

  init(stats) {
    this.stats = {
      depth: 15,
      lv: 1,
      kills: 0,
      gold: 0,
      time: 0,
      slain: [],
      party: [],
      ...stats,
    };
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");
    setListener(null);
    music("title", 3);
    this.pages = chronicle(this.stats);
    this.measure = txt(this, 0, 0, "", "w").setVisible(false);
    this.lines = [];
    this.page = -1;
    this.next();
    const advance = () => {
      if (this.leaving) return;
      sfx("select");
      if (this.shown < this.total) this.shown = this.total;
      else this.next();
    };
    this.input.keyboard.on("keydown", (e) => {
      if (["z", "Z", " ", "Enter", "j", "J", "x", "X"].includes(e.key))
        advance();
    });
    this.input.on("pointerdown", advance);
    const touch = this.sys.game.device.input.touch;
    this.prompt = txt(this, 0, VH - 14, touch ? "tap to continue" : "press z or click to continue", "w").setVisible(false);
    this.prompt.x = Math.round((VW - this.prompt.width) / 2);
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => this.prompt.setVisible(this.ready && !this.prompt.visible),
    });
  }

  wrap(s) {
    const out = [];
    let cur = "";
    for (const word of s.split(" ")) {
      const next = cur ? cur + " " + word : word;
      if (cur && this.measure.setText(next).width > W) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    out.push(cur);
    return out;
  }

  next() {
    for (const t of this.lines) t.destroy();
    this.lines = [];
    this.page++;
    this.wait = 0;
    // the last page waits for a click/key: leaving navigates the top window, which browsers only allow from user input
    this.last = this.page === this.pages.length - 1;
    this.ready = false;
    if (this.page >= this.pages.length) return this.leave();
    const rows = [];
    for (const l of this.pages[this.page]) {
      const [s, col] = Array.isArray(l) ? l : [l, "w"];
      if (!s) rows.push({ s: "", col, gap: true });
      else for (const r of this.wrap(s)) rows.push({ s: r, col });
    }
    const h = rows.reduce((n, r) => n + (r.gap ? LINE / 2 : LINE), 0);
    let y = Math.round((VH - h) / 2);
    for (const r of rows) {
      if (r.gap) {
        y += LINE / 2;
        continue;
      }
      const t = txt(this, 0, Math.round(y), "", r.col);
      t.full = r.s;
      t.x = Math.round((VW - this.measure.setText(r.s).width) / 2);
      this.lines.push(t);
      y += LINE;
    }
    this.total = this.lines.reduce((n, t) => n + t.full.length, 0);
    this.shown = 0;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    if (this.leaving) return;
    this.shown = Math.min(this.total, this.shown + TYPE * dt);
    let left = Math.floor(this.shown);
    for (const t of this.lines) {
      const n = Math.min(t.full.length, left);
      if (t.text.length !== n) t.setText(t.full.slice(0, n));
      left -= n;
    }
    if (this.shown < this.total) return;
    if (this.last) this.ready = true;
    else if ((this.wait += dt) > HOLD) this.next();
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.prompt.setVisible(false);
    try {
      window.top.location.href = AFTER; // navigate the whole tab, not just the iframe
    } catch {
      window.open(AFTER, "_blank"); // fallback if top navigation is blocked
    }
  }
}
