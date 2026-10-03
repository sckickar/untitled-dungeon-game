import { COL } from "../config.js";
import { iso } from "../lib/iso.js";
import { rnd, ri, clamp } from "../lib/math.js";
import { txt } from "./assets/fonts.js";

const BEAM_MAX = 10;

export class Pops {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }
  add(x, y, z, text, c) {
    const sp = iso(x, y),
      t = txt(this.scene, 0, 0, text, c).setOrigin(0.5, 1).setDepth(1e5);
    this.list.push({ t, x: sp.x + ri(-2, 2), y: sp.y - z, life: 0.6 });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt;
      f.y -= 16 * dt * (f.life > 0.3 ? 1 : 0.2);
      if (f.life <= 0) {
        f.t.destroy();
        this.list.splice(i, 1);
        continue;
      }
      f.t.setPosition(Math.round(f.x), Math.round(f.y));
    }
  }
}

export class Beams {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.byKey = new Map();
  }

  show({ key, x0, y0, x1, y1, life = 0.14 }) {
    let bm = key && this.byKey.get(key);
    if (!bm) {
      bm = this.make(life);
      if (key) {
        bm.key = key;
        this.byKey.set(key, bm);
      }
    }
    this.place(bm, x0, y0, x1, y1);
    bm.life = life;
  }

  make(life) {
    const bm = {
      segs: Array.from({ length: BEAM_MAX }, () => this.scene.add.image(0, 0, "lightning").setOrigin(0, 0.5).setVisible(false)),
      off: Array.from({ length: BEAM_MAX + 1 }, () => rnd(-2, 2)),
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      n: 1,
      life,
      jt: 0.04,
      flip: false,
    };
    this.list.push(bm);
    return bm;
  }

  place(bm, x0, y0, x1, y1) {
    const a = iso(x0, y0),
      b = iso(x1, y1);
    bm.a = { x: a.x, y: a.y - 4 };
    bm.b = { x: b.x, y: b.y - 4 };
    bm.n = clamp(Math.ceil(Math.hypot(bm.b.x - bm.a.x, bm.b.y - bm.a.y) / 7), 1, BEAM_MAX);
    bm.segs.forEach((s, i) => {
      const t = (i + 0.5) / bm.n;
      s.setDepth(x0 + (x1 - x0) * t + y0 + (y1 - y0) * t + 0.1);
    });
  }

  layout(bm) {
    const { a, b, n } = bm,
      dx = b.x - a.x,
      dy = b.y - a.y,
      l = Math.hypot(dx, dy) || 1,
      px = -dy / l,
      py = dx / l,
      pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        j = i === 0 || i === n ? 0 : bm.off[i];
      pts.push({ x: a.x + dx * t + px * j, y: a.y + dy * t + py * j });
    }
    bm.segs.forEach((s, i) => {
      if (i >= n) return s.setVisible(false);
      const p0 = pts[i],
        p1 = pts[i + 1];
      s.setVisible(true)
        .setPosition(Math.round(p0.x), Math.round(p0.y))
        .setRotation(Math.atan2(p1.y - p0.y, p1.x - p0.x))
        .setScale(Math.hypot(p1.x - p0.x, p1.y - p0.y) / 8, 1)
        .setTintFill((i % 2 === 0) === bm.flip ? COL.c : COL.w);
    });
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const bm = this.list[i];
      bm.life -= dt;
      bm.jt -= dt;
      if (bm.life <= 0) {
        bm.segs.forEach((s) => s.destroy());
        this.list.splice(i, 1);
        if (bm.key) this.byKey.delete(bm.key);
        continue;
      }
      if (bm.jt <= 0) {
        bm.jt = 0.04;
        bm.flip = !bm.flip;
        for (let j = 0; j < bm.off.length; j++) bm.off[j] = rnd(-2, 2);
      }
      this.layout(bm);
    }
  }
}
