import { COL, iso, rnd, ri } from "../core/constants.js";
import { WDEF } from "../data/items.js";

export const pickups = {
  drop(kind, x, y, item) {
    const key = item ? WDEF[item.base].icon : kind === "arrows" ? "inv_arrow" : kind;
    const o = {
      kind, item, x, y, z: 4, vz: rnd(40, 60), vx: rnd(-1, 1), vy: rnd(-1, 1), rest: 0, t: rnd(0, 6),
      spr: this.add.image(0, 0, key).setOrigin(0.5, 1),
    };
    if (item) this.addOutline(o.spr, COL.w);
    this.picks.push(o);
  },

  removePick(o) {
    this.killOutline(o.spr);
    o.spr.destroy();
    const i = this.picks.indexOf(o);
    if (i >= 0) this.picks.splice(i, 1);
  },

  updatePicks(dt) {
    const p = this.p;
    for (let i = this.picks.length - 1; i >= 0; i--) {
      const o = this.picks[i];
      o.t += dt;
      if (o.z > 0 || o.vz > 0) {
        o.vz -= 230 * dt; o.z += o.vz * dt;
        const nx = o.x + o.vx * dt, ny = o.y + o.vy * dt;
        if (!this.solidAt(nx, o.y)) o.x = nx;
        if (!this.solidAt(o.x, ny)) o.y = ny;
        if (o.z <= 0) { o.z = 0; if (o.vz < -30) o.vz = -o.vz * 0.4; else { o.vz = 0; o.vx = o.vy = 0; } }
      } else o.rest += dt;
      if (!p.dead && !o.item) {
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
        if (o.rest > 0.25 && d < 1.4) { o.x += (dx / d) * 4 * dt; o.y += (dy / d) * 4 * dt; }
        if (d < 0.35 && o.rest > 0.1) {
          if (o.kind === "coin") { const g = ri(1, 4) * this.lvl; p.gold += g; this.pop(p.x, p.y, 14, "+" + g, "w"); }
          else if (o.kind === "potion") { if (this.addStack("potion", 1) > 0) continue; this.say("got a potion", 1.2); }
          else if (o.kind === "arrows") {
            const n = ri(3, 6), left = this.addStack("arrow", n);
            if (left === n) continue;
            this.pop(p.x, p.y, 14, "+" + (n - left), "w");
          } else { p.mp = Math.min(p.maxmp, p.mp + 5); this.pop(p.x, p.y, 14, "+5", "c"); }
          this.removePick(o);
          continue;
        }
      }
      const sp = iso(o.x, o.y), bob = o.rest > 0 && Math.floor(o.t * 2.5) % 2 ? 1 : 0;
      o.spr.setPosition(sp.x, sp.y + 1 - o.z - bob).setDepth(o.x + o.y);
      if (o.item) {
        this.syncOutline(o.spr);
        const c = o === this.hoverPick ? COL.c : COL.w;
        o.spr.outline.forEach((s) => s.setTintFill(c));
      }

    }
  },
};
