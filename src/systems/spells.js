import { COL, iso, rnd, ri, pick, norm } from "../core/constants.js";
import { SPELLS } from "../data/items.js";

const BEAM_MAX = 10;

export const spells = {
  cast(it, slot, pressed, held, dir, dt) {
    const p = this.p,
      S = SPELLS[it.spell];
    if (S.channel) {
      if (!held) return;
      if (p.mp < 0.5) {
        if (this.msgT <= 0) this.say("no mp", 0.8);
        return;
      }
      p.mp = Math.max(0, p.mp - S.mp * dt);
      p.channeling = true;
      p.castT = 0.1;
      if (it.spell === "flame") this.flameTick(it, dir, dt);
      else this.zapTick(it, slot, dir);
      return;
    }
    if (!pressed || p.cds[slot] > 0) return;
    if (p.mp < S.mp) {
      this.say("no mp", 0.8);
      return;
    }
    p.mp -= S.mp;
    p.cds[slot] = it.cd;
    p.castT = 0.25;
    this.castHeal(it);
  },

  traceBeam(x, y, dir, range) {
    const hits = new Set(),
      STEP = 0.1;
    for (let len = 0; len < range; len += STEP) {
      const nx = x + dir.x * STEP,
        ny = y + dir.y * STEP;
      if (this.solidAt(nx, ny)) break;
      x = nx;
      y = ny;
      for (const e of this.enemies)
        if (
          !hits.has(e) &&
          this.bodyPts(e).some(
            (b) => Math.hypot(b.x - x, b.y - y) < (b.r || e.r) + 0.2,
          )
        )
          hits.add(e);
      for (const o of this.props)
        if (!hits.has(o) && Math.hypot(o.x - x, o.y - y) < o.r + 0.1)
          hits.add(o);
    }
    return { x, y, hits };
  },

  zapTick(it, slot, dir) {
    const p = this.p,
      now = this.time.now,
      tick = (it.tick || SPELLS.lightning.tick) * 1000,
      dmg = Math.max(1, Math.floor((p.atk + it.atk) / 2)),
      tr = this.traceBeam(p.x, p.y, dir, 5);
    for (const t of tr.hits) {
      if ((t.zapT || 0) > now) continue;
      t.zapT = now + tick;
      if (this.props.includes(t)) this.hurtProp(t, 1, dir.x, dir.y);
      else this.hurtEnemy(t, dmg, dir.x, dir.y, 0.6, false, "w");
    }
    const bm = this.zaps[slot] || (this.zaps[slot] = this.makeBeam());
    this.setBeam(bm, p.x, p.y, tr.x, tr.y);
    bm.life = 0.06;
  },

  makeBeam(life = 0.14) {
    const bm = {
      segs: Array.from({ length: BEAM_MAX }, () =>
        this.add.image(0, 0, "lightning").setOrigin(0, 0.5).setVisible(false),
      ),
      off: Array.from({ length: BEAM_MAX + 1 }, () => rnd(-2, 2)),
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      n: 1,
      life,
      jt: 0.04,
      flip: false,
    };
    this.beams.push(bm);
    return bm;
  },

  setBeam(bm, x0, y0, x1, y1) {
    const a = iso(x0, y0),
      b = iso(x1, y1);
    bm.a = { x: a.x, y: a.y - 4 };
    bm.b = { x: b.x, y: b.y - 4 };
    bm.n = Phaser.Math.Clamp(
      Math.ceil(Math.hypot(bm.b.x - bm.a.x, bm.b.y - bm.a.y) / 7),
      1,
      BEAM_MAX,
    );
    bm.segs.forEach((s, i) => {
      const t = (i + 0.5) / bm.n;
      s.setDepth(x0 + (x1 - x0) * t + y0 + (y1 - y0) * t + 0.1);
    });
    return bm;
  },

  layoutBeam(bm) {
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
  },

  flameTick(it, dir, dt) {
    const p = this.p;
    p.flameT -= dt;
    while (p.flameT <= 0) {
      p.flameT += 0.04;
      const a = Math.atan2(dir.y, dir.x) + rnd(-0.25, 0.25),
        s = rnd(4.5, 5.5);
      this.flames.push({
        x: p.x + dir.x * 0.3,
        y: p.y + dir.y * 0.3,
        z: 4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5,
        dmg: 1 + Math.floor(it.atk / 2),
        spr: this.add.sprite(0, 0, "flame").play("flame"),
      });
    }
  },

  addFire(x, y) {
    if (this.solidAt(x, y) || this.fires.length >= 40) return;
    if (this.fires.some((f) => Math.hypot(f.x - x, f.y - y) < 0.3)) return;
    const sp = iso(x, y);
    this.fires.push({
      x,
      y,
      t: rnd(2.5, 4),
      tick: 0,
      spr: this.add
        .sprite(sp.x, sp.y + 2, "fire")
        .setOrigin(0.5, 1)
        .play({ key: "fire", startFrame: ri(0, 1) })
        .setDepth(x + y),
    });
  },

  castHeal(it) {
    const p = this.p,
      sp = iso(p.x, p.y);
    this.heals.push({
      x: p.x,
      y: p.y,
      t: 3,
      tick: 0,
      amt: 2 + Math.floor(p.lv / 2) + it.atk,
      spr: this.add
        .sprite(sp.x, sp.y, "heal-pentagram")
        .play("heal")
        .setDepth(-8e4),
    });
  },

  updateSpells(dt) {
    const p = this.p,
      now = this.time.now;

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const bm = this.beams[i];
      bm.life -= dt;
      bm.jt -= dt;
      if (bm.life <= 0) {
        bm.segs.forEach((s) => s.destroy());
        this.beams.splice(i, 1);
        for (const k in this.zaps) if (this.zaps[k] === bm) this.zaps[k] = null;
        continue;
      }
      if (bm.jt <= 0) {
        bm.jt = 0.04;
        bm.flip = !bm.flip;
        for (let j = 0; j < bm.off.length; j++) bm.off[j] = rnd(-2, 2);
      }
      this.layoutBeam(bm);
    }

    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.life -= dt;
      const nx = f.x + f.vx * dt,
        ny = f.y + f.vy * dt;
      let dead = f.life <= 0;
      if (!dead && this.solidAt(nx, ny)) {
        dead = true;
        this.addFire(f.x, f.y);
      } else if (!dead) {
        f.x = nx;
        f.y = ny;
      }
      if (!dead) {
        const u = norm(f.vx, f.vy);
        for (const e of [...this.enemies]) {
          if ((e.burnT || 0) > now) continue;
          if (
            this.bodyPts(e).some(
              (b) => Math.hypot(b.x - f.x, b.y - f.y) < (b.r || e.r) + 0.2,
            )
          ) {
            e.burnT = now + 150;
            this.hurtEnemy(e, f.dmg, u.x, u.y, 0.5);
            this.applyElem(e, "fire", 1, u.x, u.y);
          }
        }
        for (const o of [...this.props]) {
          if ((o.burnT || 0) > now) continue;
          if (Math.hypot(o.x - f.x, o.y - f.y) < o.r + 0.1) {
            o.burnT = now + 300;
            this.hurtProp(o, 1, u.x, u.y);
          }
        }
      }
      if (dead) {
        if (f.life <= 0 && Math.random() < 0.35) this.addFire(f.x, f.y);
        f.spr.destroy();
        this.flames.splice(i, 1);
        continue;
      }
      const sp = iso(f.x, f.y);
      f.spr
        .setPosition(Math.round(sp.x), Math.round(sp.y - f.z))
        .setDepth(f.x + f.y + 0.1);
    }

    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      f.tick -= dt;
      if (f.t <= 0) {
        f.spr.destroy();
        this.fires.splice(i, 1);
        continue;
      }
      if (f.tick <= 0) {
        f.tick = 0.4;
        for (const e of [...this.enemies])
          if (Math.hypot(e.x - f.x, e.y - f.y) < e.r + 0.25) {
            this.hurtEnemy(e, 1, 0, 0, 0, false, "m");
            this.applyElem(e, "fire", 1, 0, 0);
          }
      }
      f.spr.setVisible(f.t > 0.5 || Math.floor(f.t * 20) % 2 === 0);
    }

    for (let i = this.heals.length - 1; i >= 0; i--) {
      const h = this.heals[i];
      h.t -= dt;
      h.tick -= dt;
      if (h.t <= 0) {
        h.spr.destroy();
        this.heals.splice(i, 1);
        continue;
      }
      if (!p.dead && h.tick <= 0 && Math.hypot(p.x - h.x, p.y - h.y) < 0.8) {
        h.tick = 0.5;
        if (p.hp < p.maxhp) {
          p.hp = Math.min(p.maxhp, p.hp + h.amt);
          this.pop(p.x, p.y, 14, "+" + h.amt, "c");
          for (let k = 0; k < 3; k++)
            this.addPart({
              x: p.x + rnd(-0.3, 0.3),
              y: p.y + rnd(-0.3, 0.3),
              z: rnd(0, 4),
              vx: 0,
              vy: 0,
              vz: rnd(12, 26),
              key: pick(["d_c1", "d_w1"]),
              float: true,
              life: rnd(0.4, 0.8),
            });
        }
      }
      h.spr.setVisible(h.t > 0.5 || Math.floor(h.t * 20) % 2 === 0);
    }
  },
};
