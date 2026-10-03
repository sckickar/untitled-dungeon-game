import { MW, MH } from "../config.js";
import { iso } from "../lib/iso.js";
import { rnd, ri, pick, others } from "../lib/math.js";
import { GIBS, RUNS } from "./assets/manifest.js";
import { tex } from "./assets/sheets.js";

const MAX_PARTS = 300;

export class Gore {
  constructor(view) {
    this.view = view;
    this.scene = view.scene;
    this.world = view.world;
    this.parts = [];
    this.bloodGrid = new Float32Array(MW * 4 * MH * 4);
    this.queue = [];
    this.glyphs = {};
    for (const c of "mcw") this.glyphs[c] = this.scene.make.bitmapText({ font: "font_" + c, text: "x" }, false);
  }

  addPart(o) {
    if (this.parts.length > MAX_PARTS) this.settle(this.parts.shift());
    o.spr = this.scene.add.image(0, 0, ...tex(o.key));
    o.life = o.life ?? 99;
    this.parts.push(o);
  }

  spray(x, y, z, dx, dy, n, c, spread, speed) {
    const base = dx || dy ? Math.atan2(dy, dx) : 0,
      sp = dx || dy ? spread : 3.14;
    for (let i = 0; i < n; i++) {
      const a = base + rnd(-sp, sp),
        s = rnd(0.3, 1) * speed;
      const cc = Math.random() < 0.12 ? pick(others(c)) : c;
      const q = Math.random(),
        stamp = q < 0.72 ? "d_" + cc + "1" : q < 0.92 ? "d_" + cc + "2" : pick(RUNS[cc]);
      this.addPart({
        x, y, z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: rnd(10, 60),
        key: "d_" + cc + "1",
        stamp,
        blood: cc === "m" ? 1 : 0,
        bounce: c === "w" ? 0.4 : 0,
        flick: c,
      });
    }
  }

  gib(x, y, z, c, ux, uy, s) {
    const a = Math.atan2(uy, ux) + rnd(-1.5, 1.5),
      key = pick(GIBS[c]);
    this.addPart({
      x, y, z,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      vz: rnd(40, 100),
      key,
      stamp: key,
      bounce: 0.45,
      slide: true,
      col: c,
      gibFlick: true,
      blood: c === "m" ? 2 : 0,
    });
  }

  debris(x, y, z, ux, uy, keys, n, scatter) {
    for (let i = 0; i < n; i++) {
      const k = pick(keys);
      let vx, vy;
      if (scatter) {
        const a = rnd(0, 6.283),
          s = rnd(0.5, 2.8);
        vx = Math.cos(a) * s + ux;
        vy = Math.sin(a) * s + uy;
      } else {
        vx = ux * rnd(0.5, 2) + rnd(-1, 1);
        vy = uy * rnd(0.5, 2) + rnd(-1, 1);
      }
      this.addPart({ x, y, z, vx, vy, vz: rnd(30, scatter ? 80 : 60), key: k, stamp: k, bounce: scatter ? 0.45 : 0.4 });
    }
  }

  floaters(x, y, n, { spread = 0.3, z = [0, 4], keys = ["d_c1", "d_w1"], life = [0.4, 0.8], ring = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      this.addPart({
        x: ring ? x + Math.cos(a) * ring : x + rnd(-spread, spread),
        y: ring ? y + Math.sin(a) * ring : y + rnd(-spread, spread),
        z: rnd(z[0], z[1]),
        vx: 0,
        vy: 0,
        vz: ring ? 20 : rnd(12, 26),
        key: ring ? keys[i % keys.length] : pick(keys),
        float: true,
        life: ring ? life[0] : rnd(life[0], life[1]),
      });
    }
  }

  glyph(x, y, c) {
    if (this.world.solidAt(x, y)) return;
    const g = this.glyphs[c],
      p = iso(x, y);
    const ch = pick("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz?!:;<>=+-");
    this.drawObj(g, Math.round(p.x - 4), Math.round(p.y - 5), (o) => o.setText(ch));
    if (Math.random() < 0.7) this.queue.push({ t: "kline", x: Math.round(p.x - 4 + ri(-1, 1)), y: Math.round(p.y - 5 + ri(1, 6)) });
  }

  drawObj(obj, x, y, prep) {
    this.queue.push({ obj, x, y, prep });
  }

  flush() {
    const Q = this.queue,
      rt = this.view.rt;
    if (!Q.length) return;
    rt.beginDraw();
    for (const s of Q) {
      if (s.obj) {
        s.prep?.(s.obj);
        rt.batchDraw(s.obj, s.x, s.y);
      } else rt.batchDrawFrame(s.t, s.fr, s.x, s.y);
    }
    rt.endDraw();
    Q.length = 0;
  }

  update(dt) {
    const W = this.world;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      if (q.flick && Math.random() < 0.3) q.spr.setTexture(...tex("d_" + (Math.random() < 0.7 ? q.flick : pick("mcw")) + "1"));
      if (q.gibFlick && Math.random() < 0.15) {
        q.stamp = pick(GIBS[Math.random() < 0.8 ? q.col : pick("mcw")]);
        q.spr.setTexture(...tex(q.stamp));
      }
      if (q.float) {
        q.life -= dt;
        q.z += q.vz * dt;
        if (q.life <= 0) {
          q.spr.destroy();
          this.parts.splice(i, 1);
          continue;
        }
      } else if (q.sliding) {
        const f = Math.pow(0.03, dt);
        q.vx *= f;
        q.vy *= f;
        const ox = q.x,
          oy = q.y;
        const nx = q.x + q.vx * dt;
        if (W.solidAt(nx, q.y)) q.vx *= -0.3;
        else q.x = nx;
        const ny = q.y + q.vy * dt;
        if (W.solidAt(q.x, ny)) q.vy *= -0.3;
        else q.y = ny;
        q.smear = (q.smear || 0) + Math.hypot(q.x - ox, q.y - oy);
        if (q.smear > 0.07) {
          q.smear = 0;
          this.stamp(Math.random() < 0.8 ? "d_" + q.col + "1" : pick(RUNS[q.col]), q.x, q.y, q.col === "m" ? 1 : 0);
        }
        if (Math.hypot(q.vx, q.vy) < 0.25) {
          this.settle(q);
          this.parts.splice(i, 1);
          continue;
        }
      } else {
        q.vz -= 230 * dt;
        const nx = q.x + q.vx * dt;
        if (W.solidAt(nx, q.y)) q.vx *= -0.4;
        else q.x = nx;
        const ny = q.y + q.vy * dt;
        if (W.solidAt(q.x, ny)) q.vy *= -0.4;
        else q.y = ny;
        q.z += q.vz * dt;
        if (q.z <= 0) {
          q.z = 0;
          if (q.bounce && q.vz < -35) {
            q.vz = -q.vz * q.bounce;
            q.vx *= 0.6;
            q.vy *= 0.6;
            if (q.col) this.stamp(pick(RUNS[q.col]), q.x, q.y, q.col === "m" ? 1 : 0);
          } else if (q.slide && Math.hypot(q.vx, q.vy) > 0.3) {
            q.sliding = true;
            q.vz = 0;
          } else {
            this.settle(q);
            this.parts.splice(i, 1);
            continue;
          }
        }
      }
      const sp = iso(q.x, q.y);
      q.spr.setPosition(Math.round(sp.x), Math.round(sp.y - q.z)).setDepth(q.x + q.y + 0.2);
    }
    this.flush();
  }

  settle(q) {
    if (q.stamp) this.stamp(q.stamp, q.x, q.y, q.blood);
    if (q.gibFlick && Math.random() < 0.5)
      this.stamp(pick(RUNS[pick([q.col, q.col, "m", "c", "w"])]), q.x + rnd(-0.12, 0.12), q.y + rnd(-0.12, 0.12));
    q.spr.destroy();
  }

  stamp(key, x, y, blood) {
    if (this.world.solidAt(x, y)) return;
    const p = iso(x, y),
      [t, fr] = tex(key),
      f = this.scene.textures.getFrame(t, fr);
    this.queue.push({ t, fr, x: Math.round(p.x - f.width / 2), y: Math.round(p.y - f.height / 2) });
    if (blood) this.bloodAdd(x, y, blood, 0);
  }

  bloodAdd(x, y, amt, rad) {
    const gx = Math.floor(x * 4),
      gy = Math.floor(y * 4);
    for (let j = -rad; j <= rad; j++)
      for (let i = -rad; i <= rad; i++) {
        const X = gx + i,
          Y = gy + j;
        if (X >= 0 && Y >= 0 && X < MW * 4 && Y < MH * 4) this.bloodGrid[Y * MW * 4 + X] += amt;
      }
  }

  bloodAt(x, y) {
    return this.bloodGrid[Math.floor(y * 4) * MW * 4 + Math.floor(x * 4)];
  }
}
